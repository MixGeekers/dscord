import { useState } from "react";
import type { FormEvent } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button, Checkbox, Input, Textarea } from "../../ui/controls";
import { Select } from "../../ui/select";
import { Field, ToolFields, lines } from "./fields";
import { useLocale, useTranslation } from "./locale";
import { adminMessages } from "./messages";
import type { Policy } from "./types";

export type Collection = "partners" | "members" | "rooms" | "bots";

export default function PolicyCollection({
  section,
  policy,
  onChange,
  readOnly,
  invite,
  busy,
}: {
  section: Collection;
  policy: Policy;
  onChange(policy: Policy): void;
  readOnly: boolean;
  invite(roomId: string, memberId: string): void;
  busy: boolean;
}) {
  const t = useTranslation(adminMessages);
  const { locale } = useLocale();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const key =
    section === "partners"
      ? "partners"
      : section === "members"
        ? "members"
        : section === "rooms"
          ? "rooms"
          : "botPolicies";
  const idKey =
    section === "partners"
      ? "serverName"
      : section === "members"
        ? "id"
        : section === "rooms"
          ? "roomId"
          : "botId";
  const records = policy[key] as unknown as Record<string, unknown>[];
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const str = (key: string) => String(data.get(key) || "").trim();
    const common = { enabled: data.get("enabled") === "on" };
    let row: Record<string, unknown>;
    if (section === "partners")
      row = {
        ...common,
        serverName: str("serverName"),
        name: str("name"),
        ...(str("publicUrl") ? { publicUrl: str("publicUrl") } : {}),
      };
    else if (section === "members")
      row = {
        ...common,
        id: str("id"),
        name: str("name"),
        kind: str("kind"),
        ...(str("ownerId") ? { ownerId: str("ownerId") } : {}),
      };
    else if (section === "rooms")
      row = {
        ...common,
        roomId: str("roomId"),
        authority: str("authority"),
        name: str("name"),
        memberIds: lines(data.get("memberIds")),
        botIds: lines(data.get("botIds")),
        tools: data.getAll("tools"),
      };
    else
      row = {
        ...common,
        botId: str("botId"),
        roomIds: lines(data.get("roomIds")),
        requesterIds: lines(data.get("requesterIds")),
        tools: data.getAll("tools"),
        canDelegate: false,
      };
    onChange({
      ...policy,
      [key]: [
        ...records.filter(
          (record) =>
            record[idKey] !== (editing?.[idKey] || row[idKey]) &&
            record[idKey] !== row[idKey],
        ),
        row,
      ],
    });
    setEditing(null);
    setReset((value) => value + 1);
  }
  const value = (field: string, fallback = "") =>
    String(editing?.[field] ?? fallback);
  const many = (field: string) =>
    (editing?.[field] as string[] | undefined)?.join("\n") || "";
  const detailName = (field: string) => {
    const names: Record<string, string> = {
      publicUrl: t("publicUrl"),
      kind: t("kind"),
      ownerId: t("owner"),
      authority: t("authority"),
      memberIds: t("roomMembers"),
      botIds: t("botIds"),
      roomIds: t("roomIds"),
      requesterIds: t("requesterIds"),
      tools: t("tools"),
    };
    return names[field] || field;
  };
  const hint = t(
    section === "partners"
      ? "partnerHint"
      : section === "members"
        ? "memberHint"
        : section === "rooms"
          ? "roomHint"
          : "botHint",
  );
  return (
    <div className={`admin-section-layout ${readOnly ? "is-single" : ""}`}>
      <section
        className="admin-panel admin-list-panel"
        aria-label={t("entries")}
      >
        <div className="admin-panel-heading">
          <div>
            <h2>{t("entries")}</h2>
            <p>{hint}</p>
          </div>
          <span
            className="admin-count"
            aria-label={t("entryCount", { count: records.length })}
          >
            {new Intl.NumberFormat(locale).format(records.length)}
          </span>
        </div>
        {records.length === 0 && <p className="admin-empty">{t("none")}</p>}
        <div className="admin-list">
          {records.map((row) => {
            const id = String(row[idKey]);
            return (
              <article className="admin-list-row" key={id}>
                <div className="admin-row-top">
                  <div className="admin-row-identity">
                    <strong>{String(row.name || id)}</strong>
                    {Boolean(row.name) && <code>{id}</code>}
                  </div>
                  <span
                    className={`admin-state ${row.enabled ? "is-good" : "is-muted"}`}
                  >
                    {row.enabled ? t("enabled") : t("closed")}
                  </span>
                </div>
                <dl className="admin-detail-list">
                  {Object.entries(row)
                    .filter(
                      ([field, val]) =>
                        ![idKey, "enabled", "name", "canDelegate"].includes(
                          field,
                        ) &&
                        val !== undefined &&
                        val !== "" &&
                        (!Array.isArray(val) || val.length > 0),
                    )
                    .map(([field, val]) => (
                      <div key={field}>
                        <dt>{detailName(field)}</dt>
                        <dd>
                          {Array.isArray(val)
                            ? val.join(", ")
                            : field === "kind"
                              ? val === "bot"
                                ? t("bot")
                                : val === "human"
                                  ? t("human")
                                  : String(val)
                              : String(val)}
                        </dd>
                      </div>
                    ))}
                </dl>
                {!readOnly && (
                  <div className="admin-row-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditing(row);
                        setPendingRemoval(null);
                        setReset((value) => value + 1);
                      }}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="admin-remove-trigger"
                      onClick={() =>
                        setPendingRemoval(pendingRemoval === id ? null : id)
                      }
                    >
                      <Trash2 aria-hidden="true" />
                      {t("remove")}
                    </Button>
                  </div>
                )}
                {pendingRemoval === id && (
                  <div
                    className="admin-confirm"
                    role="group"
                    aria-label={t("confirmRemove")}
                  >
                    <p>
                      {t("confirmRemove")} <code>{id}</code>
                    </p>
                    <div className="admin-actions">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          onChange({
                            ...policy,
                            [key]: records.filter(
                              (item) => item[idKey] !== row[idKey],
                            ),
                          });
                          if (editing?.[idKey] === row[idKey]) {
                            setEditing(null);
                            setReset((value) => value + 1);
                          }
                          setPendingRemoval(null);
                        }}
                      >
                        {t("confirm")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPendingRemoval(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
                {section === "rooms" &&
                  row.authority === policy.serverName &&
                  !readOnly && (
                    <form
                      className="admin-invite"
                      onSubmit={(event) => {
                        event.preventDefault();
                        invite(
                          String(row.roomId),
                          String(
                            new FormData(event.currentTarget).get("memberId"),
                          ),
                        );
                      }}
                    >
                      <Field label={t("inviteMember")}>
                        <Select
                          name="memberId"
                          required
                          defaultValue={(row.memberIds as string[])[0]}
                          options={(row.memberIds as string[]).map(
                            (memberId) => ({
                              value: memberId,
                              label: memberId,
                            }),
                          )}
                        />
                      </Field>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="submit"
                        disabled={busy || !(row.memberIds as string[]).length}
                      >
                        {t("invite")}
                      </Button>
                    </form>
                  )}
              </article>
            );
          })}
        </div>
      </section>
      {!readOnly && (
        <form
          className="admin-panel admin-editor"
          key={reset}
          onSubmit={update}
        >
          <div className="admin-panel-heading">
            <div>
              <h2>{editing ? t("editEntry") : t("addEntry")}</h2>
              <p>{t("entryFormHint")}</p>
            </div>
            {!editing && <Plus size={18} aria-hidden="true" />}
          </div>
          <div className="admin-form-fields">
            {section !== "bots" && (
              <Field label={t("name")}>
                <Input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={value("name")}
                />
              </Field>
            )}
            {section === "partners" && (
              <>
                <Field label={t("server")}>
                  <Input
                    name="serverName"
                    required
                    placeholder="partner.example.org"
                    defaultValue={value("serverName")}
                  />
                </Field>
                <Field label={t("publicUrl")}>
                  <Input
                    name="publicUrl"
                    type="url"
                    defaultValue={value("publicUrl")}
                  />
                </Field>
              </>
            )}
            {section === "members" && (
              <>
                <Field label={t("identity")}>
                  <Input
                    name="id"
                    required
                    placeholder="@member:partner.example.org"
                    defaultValue={value("id")}
                  />
                </Field>
                <Field label={t("kind")}>
                  <Select
                    name="kind"
                    defaultValue={value("kind", "human")}
                    options={[
                      { value: "human", label: t("human") },
                      { value: "bot", label: t("bot") },
                    ]}
                  />
                </Field>
                <Field label={t("owner")}>
                  <Input name="ownerId" defaultValue={value("ownerId")} />
                </Field>
              </>
            )}
            {section === "rooms" && (
              <>
                <Field label={t("roomId")}>
                  <Input
                    name="roomId"
                    required
                    defaultValue={value("roomId")}
                  />
                </Field>
                <Field label={t("authority")}>
                  <Input
                    name="authority"
                    required
                    defaultValue={value("authority", policy.serverName)}
                  />
                </Field>
                <Field label={t("roomMembers")}>
                  <Textarea name="memberIds" defaultValue={many("memberIds")} />
                </Field>
                <Field label={t("botIds")}>
                  <Textarea name="botIds" defaultValue={many("botIds")} />
                </Field>
                <ToolFields current={editing?.tools as string[]} />
              </>
            )}
            {section === "bots" && (
              <>
                <Field label={t("identity")}>
                  <Input
                    name="botId"
                    required
                    placeholder={`@bot:${policy.serverName}`}
                    pattern={`@[^:\\s]+:${policy.serverName.replaceAll(".", "\\.")}`}
                    defaultValue={value("botId")}
                  />
                </Field>
                <Field label={t("roomIds")}>
                  <Textarea
                    name="roomIds"
                    required
                    defaultValue={many("roomIds")}
                  />
                </Field>
                <Field label={t("requesterIds")}>
                  <Textarea
                    name="requesterIds"
                    required
                    defaultValue={many("requesterIds")}
                  />
                </Field>
                <ToolFields current={editing?.tools as string[]} />
                <p className="admin-hint">{t("botScope")}</p>
              </>
            )}
            <label className="admin-checkbox">
              <Checkbox
                name="enabled"
                defaultChecked={editing ? editing.enabled === true : true}
              />
              {t("enabled")}
            </label>
          </div>
          <div className="admin-form-actions">
            <Button variant="default" type="submit">
              {editing ? t("edit") : t("add")}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setEditing(null);
                setReset((value) => value + 1);
              }}
            >
              {t("reset")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
