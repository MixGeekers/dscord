import { Avatar } from "./Avatar";
import { Button, Checkbox, Input } from "../../../ui/controls";
import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  FormEvent,
  MouseEvent,
  SyntheticEvent,
} from "react";
import { messageOf, readStored } from "../api";
import { newRequestId } from "../identifiers";
import { useTranslation } from "../locale";
import { Icon } from "./Icons";
import { dialogMessages } from "../locales/dialogs";
import { kernelMessages } from "../locales/kernel";
import { botHomeMessages } from "../locales/bot-home";
import { connectionLabel } from "../bot-kernel";
import type { Api, Participant, Role, Room, Session } from "../types";
import { InfoList, ScrollArea } from "../../../ui/layout";
import type { InfoItem } from "../../../ui/layout";

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}

function cancelDialog(
  event: SyntheticEvent<HTMLDialogElement>,
  canClose: boolean,
  onClose: () => void,
) {
  event.preventDefault();
  if (canClose) onClose();
}

function dismissBackdrop(
  event: MouseEvent<HTMLDialogElement>,
  canClose: boolean,
  onClose: () => void,
) {
  if (!canClose || event.target !== event.currentTarget) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;
  if (outside) onClose();
}

interface PendingGroup {
  requestId: string;
  name: string;
  inviteIds: string[];
}

interface RoomDialogProps {
  mode: "create" | "add" | null;
  session: Session | null;
  room: Room | null;
  participants: Participant[];
  api: Api;
  pendingStorageKey?: string;
  onRoom(room: Room): void;
  onChanged(): void | Promise<void>;
  onClose(): void;
  onError(message: string): void;
}

export function RoomDialog({
  mode,
  session,
  room,
  participants,
  api,
  pendingStorageKey,
  onRoom,
  onChanged,
  onClose,
  onError,
}: RoomDialogProps) {
  const t = useTranslation(dialogMessages);
  const dialog = useDialog(mode !== null);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const isAdd = mode === "add";
  // Other people and your own Bots; adding leaves out who is already here.
  const choices = participants.filter(
    (person) =>
      !!session &&
      person.id !== session.user_id &&
      (person.kind === "human" || person.ownerId === session.user_id) &&
      !(isAdd && room?.participantIds.includes(person.id)),
  );

  useEffect(() => {
    setError("");
    if (mode === null) return;
    const saved =
      mode === "create" && session
        ? readStored<PendingGroup>(
            pendingStorageKey ?? `ds-group.pending-room.${session.user_id}`,
          )
        : null;
    setName(saved?.name ?? "");
    setSelectedIds(saved?.inviteIds ?? []);
    setRestored(Boolean(saved));
  }, [mode, session?.user_id, pendingStorageKey]);

  function toggleMember(id: string, selected: boolean) {
    setSelectedIds((current) =>
      selected
        ? [...new Set([...current, id])]
        : current.filter((value) => value !== id),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !mode || busy) return;
    const eligible = new Set(choices.map((person) => person.id));
    const inviteIds = selectedIds.filter((id) => eligible.has(id)).sort();
    if (isAdd && !inviteIds.length) {
      setError(t("chooseMember"));
      return;
    }
    if (!isAdd && !name.trim()) {
      setError(t("chooseName"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "create") {
        const key =
          pendingStorageKey ?? `ds-group.pending-room.${session.user_id}`;
        const saved = readStored<PendingGroup>(key);
        const cleanName = name.trim();
        const sameRequest =
          saved?.name === cleanName &&
          JSON.stringify(saved.inviteIds) === JSON.stringify(inviteIds);
        const request: PendingGroup = {
          name: cleanName,
          inviteIds,
          requestId: sameRequest ? saved.requestId : newRequestId(),
        };
        sessionStorage.setItem(key, JSON.stringify(request));
        const result = await api<Room>("/api/rooms", {
          method: "POST",
          body: request,
        });
        if (!result.roomId) throw new Error(t("groupReceiptMissing"));
        sessionStorage.removeItem(key);
        onRoom(result);
        try {
          await onChanged();
        } catch (cause) {
          onError(messageOf(cause));
        }
      } else if (room) {
        const result = await api<Room>(
          `/api/rooms/${encodeURIComponent(room.roomId)}/invite`,
          { method: "POST", body: { participantIds: inviteIds } },
        );
        const statuses = new Set(
          (result.joinResults ?? []).map((item) => item.status),
        );
        if (statuses.has("approval_required")) onError(t("approvalRequired"));
        else if (statuses.has("pending")) onError(t("partialAdd"));
        else if (statuses.has("invited")) onError(t("invitedElsewhere"));
        await onChanged();
      }
      onClose();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  const title = t(isAdd ? "addMembers" : "createGroup");
  return (
    <dialog
      ref={dialog}
      id="room-dialog"
      className="room-dialog"
      aria-labelledby="room-dialog-title"
      onCancel={(event) => cancelDialog(event, !busy, onClose)}
      onClick={(event) => dismissBackdrop(event, !busy, onClose)}
    >
      <form id="room-form" onSubmit={(event) => void submit(event)}>
        <div className="dialog-heading">
          <h2 id="room-dialog-title">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            id="close-room-dialog"
            className="icon-button"
            type="button"
            aria-label={t("close")}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        </div>
        <ScrollArea className="dialog-scroll-region">
          <div id="room-name-field" hidden={isAdd}>
            <label htmlFor="new-room-name">{t("groupName")}</label>
            <Input
              id="new-room-name"
              maxLength={80}
              autoComplete="off"
              required={!isAdd}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <label id="room-choice-label">
            {t(isAdd ? "chooseMembers" : "inviteMembers")}
          </label>
          <div id="room-choices" className="room-choices">
            {choices.map((person) => (
              <label key={person.id} className="room-choice">
                <Checkbox
                  value={person.id}
                  checked={selectedIds.includes(person.id)}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    toggleMember(person.id, checked)
                  }
                />
                <Avatar member={person} />
                <span className="room-choice-identity">
                  <span>{person.name}</span>
                  <small className="member-full-id">{person.id}</small>
                </span>
                {person.kind === "bot" && (
                  <span className="member-kind">BOT</span>
                )}
              </label>
            ))}
            {!choices.length && (
              <p className="muted small">
                {t(isAdd ? "everyoneHere" : "noMembers")}
              </p>
            )}
          </div>
          <p id="room-form-error" className="settings-feedback" role="alert">
            {error || (restored ? t("pendingGroup") : "")}
          </p>
        </ScrollArea>
        <footer className="dialog-footer">
          <Button
            variant="default"
            id="room-submit"
            className="primary-button login-submit"
            type="submit"
            disabled={busy || (isAdd && !choices.length)}
          >
            {t(
              isAdd ? (busy ? "adding" : "add") : busy ? "creating" : "create",
            )}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}

interface MemberDialogProps {
  member: Participant | null;
  session: Session | null;
  room: Room | null;
  roles: Role[];
  botStatus?: string;
  owner?: Participant;
  onManageBot?(id: string): void;
  /** Opens the person's own account settings, where their avatar and name are changed. */
  onEditProfile?(): void;
  onDirect(id: string): void;
  onMention(member: Participant): void;
  onClose(): void;
}

export function MemberDialog({
  member,
  session,
  room,
  roles,
  botStatus,
  owner,
  onManageBot,
  onEditProfile,
  onDirect,
  onMention,
  onClose,
}: MemberDialogProps) {
  const t = useTranslation(dialogMessages);
  const kernelText = useTranslation(kernelMessages);
  const homeText = useTranslation(botHomeMessages);
  const dialog = useDialog(member !== null);
  const membership = member
    ? roles.filter((role) => role.memberIds.includes(member.id))
    : [];
  const self = !!member && member.id === session?.user_id;
  const ownBot =
    member?.kind === "bot" && !!session && member.ownerId === session.user_id;
  const details: InfoItem[] = [];
  if (member?.kind === "bot")
    details.push({
      label: t("memberStatus"),
      value: (
        <span className="bot-connection-status">
          {kernelText(connectionLabel(botStatus))}
        </span>
      ),
    });
  if (member?.kind === "bot" && member.ownerId)
    details.push({
      label: kernelText("owner"),
      value: (
        <span className="bot-profile-owner">
          {owner?.name ?? member.ownerId}
          {owner?.name && (
            <small className="member-full-id">{member.ownerId}</small>
          )}
        </span>
      ),
    });
  if (membership.length)
    details.push({
      label: t("memberRoles"),
      value: (
        <span id="member-dialog-roles" className="member-role-list">
          {membership.map((role) => (
            <span
              key={role.id}
              className="role-badge"
              style={{ "--role-color": role.color } as CSSProperties}
            >
              {role.name}
            </span>
          ))}
        </span>
      ),
    });
  return (
    <dialog
      ref={dialog}
      id="member-dialog"
      className="member-dialog"
      aria-labelledby="member-dialog-name"
      onCancel={(event) => cancelDialog(event, true, onClose)}
      onClick={(event) => dismissBackdrop(event, true, onClose)}
    >
      <Button
        variant="ghost"
        size="icon"
        id="close-member"
        className="icon-button dialog-close"
        type="button"
        aria-label={t("closeProfile")}
        onClick={onClose}
      >
        <Icon name="close" />
      </Button>
      <div
        className="member-banner"
        data-kind={member?.kind}
        aria-hidden="true"
      />
      <header className="member-dialog-head">
        <div id="member-dialog-avatar" className="member-dialog-avatar">
          <Avatar member={member} size={512} />
        </div>
        <h2 id="member-dialog-name">{member?.name}</h2>
        <p id="member-dialog-id">{member?.id}</p>
      </header>
      {details.length > 0 && (
        <ScrollArea className="dialog-scroll-region">
          <InfoList items={details} />
        </ScrollArea>
      )}
      <div className="dialog-footer member-dialog-actions">
        <Button
          variant="default"
          id="member-dm"
          type="button"
          hidden={!member || self}
          onClick={() => {
            if (member) {
              onClose();
              onDirect(member.id);
            }
          }}
        >
          {t("sendMessage")}
        </Button>
        <Button
          variant="secondary"
          id="member-mention"
          type="button"
          disabled={
            !session || !member || !room?.participantIds.includes(member.id)
          }
          onClick={() => {
            if (member) {
              onClose();
              onMention(member);
            }
          }}
        >
          {t("mention")}
        </Button>
        {self && onEditProfile && (
          <Button
            id="member-edit-profile"
            variant="ghost"
            type="button"
            onClick={onEditProfile}
          >
            <Icon name="edit" />
            {t("editProfile")}
          </Button>
        )}
        {ownBot && onManageBot && member && (
          <Button
            id="member-bot-home"
            variant="ghost"
            type="button"
            onClick={() => onManageBot(member.id)}
          >
            <Icon name="bot" />
            {homeText("home")}
          </Button>
        )}
      </div>
    </dialog>
  );
}
