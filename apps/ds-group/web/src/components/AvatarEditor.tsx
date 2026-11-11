import { useEffect, useRef, useState } from "react";
import { Button, Input } from "../../../ui/controls";
import { messageOf } from "../api";
import { useTranslation } from "../locale";
import { avatarMessages } from "../locales/avatars";
import { publishAvatar } from "../avatar-profiles";
import { Avatar } from "./Avatar";
import type { AvatarProfile, Participant, Session } from "../types";

type ImageDraft = { file: File; url: string; width: number; height: number };
export function AvatarEditor({
  session,
  member,
  botId,
  onChanged,
}: {
  session: Session;
  member: Partial<Participant>;
  botId?: string;
  onChanged?(): void;
}) {
  const t = useTranslation(avatarMessages);
  const text = useRef(t);
  text.current = t;
  const issuer = session.binding?.centralIssuer;
  const token = session.central?.token;
  const scope = `${issuer}/${token}/${botId || member.globalId || session.user_id}`;
  const current = useRef(scope);
  current.current = scope;
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [maxBytes, setMaxBytes] = useState(5 * 1024 * 1024);
  const [draft, setDraft] = useState<ImageDraft | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const cropStage = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(240);
  const fileInput = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const isBot = member.kind === "bot";
  const route = (id?: string) =>
    isBot
      ? `/api/bots/${encodeURIComponent(id || botId || profile?.id || "")}/avatar`
      : "/api/me/avatar";
  const limit = Math.round((maxBytes / 1048576) * 10) / 10;
  useEffect(
    () => () => {
      if (draft) URL.revokeObjectURL(draft.url);
    },
    [draft],
  );
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setDraft(null);
    setBusy(false);
    setError("");
    setNotice("");
    setLoading(true);
    if (!issuer || !token) {
      setLoading(false);
      return;
    }
    void (async () => {
      let id = botId;
      if (isBot && !id && member.globalId) {
        const response = await fetch(
          new URL(
            `/api/profiles?ids=${encodeURIComponent(member.globalId)}`,
            issuer,
          ),
          { signal: controller.signal, credentials: "omit" },
        );
        id = (await response.json()).profiles?.[0]?.id;
      }
      if (isBot && !id) throw new Error(text.current("unavailable"));
      const response = await fetch(new URL(route(id), issuer), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(text.current("unavailable"));
      const data = await response.json();
      if (current.current !== scope || controller.signal.aborted) return;
      setProfile(data.profile);
      setMaxBytes(data.maxUploadBytes);
      publishAvatar(data.profile);
    })()
      .catch((reason) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, reload]);

  useEffect(() => {
    if (!draft || !cropStage.current) return;
    const element = cropStage.current;
    const update = () =>
      setViewport(element.getBoundingClientRect().width || 240);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [draft]);

  async function choose(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("format"));
      return;
    }
    if (file.size > maxBytes) {
      setError(t("tooLarge", { size: limit }));
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (current.current !== scope) {
        URL.revokeObjectURL(url);
        return;
      }
      if (image.naturalWidth * image.naturalHeight > 40_000_000)
        throw new Error();
      setDraft({
        file,
        url,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setZoom(1);
      setPosition({ x: 0.5, y: 0.5 });
    } catch {
      URL.revokeObjectURL(url);
      if (current.current === scope) setError(t("invalid"));
    }
  }
  async function save(remove = false) {
    if (!profile || !issuer || !token || (!remove && !draft)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const query = new URLSearchParams({
      version: String(profile.profileVersion),
    });
    if (!remove && draft) {
      const size = Math.max(
        1,
        Math.floor(Math.min(draft.width, draft.height) / zoom),
      );
      query.set("size", String(size));
      query.set("left", String(Math.round((draft.width - size) * position.x)));
      query.set("top", String(Math.round((draft.height - size) * position.y)));
    }
    try {
      const response = await fetch(new URL(`${route()}?${query}`, issuer), {
        method: remove ? "DELETE" : "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(!remove && draft ? { "Content-Type": draft.file.type } : {}),
        },
        body: remove ? undefined : draft?.file,
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (current.current !== scope) return;
      if (!response.ok) {
        if (response.status === 409) {
          const latest = await fetch(new URL(route(), issuer), {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
            cache: "no-store",
          });
          if (latest.ok && current.current === scope) {
            const value = await latest.json();
            setProfile(value.profile);
            publishAvatar(value.profile);
          }
          throw new Error(t("changed"));
        }
        throw new Error(
          data.code === "AVATAR_TOO_LARGE"
            ? t("tooLarge", { size: limit })
            : data.code === "AVATAR_FORMAT"
              ? t("format")
              : data.code === "AVATAR_INVALID_IMAGE"
                ? t("invalid")
                : data.error || `HTTP ${response.status}`,
        );
      }
      setProfile(data.profile);
      publishAvatar(data.profile);
      setDraft(null);
      setNotice(t(remove ? "restored" : "saved"));
      onChanged?.();
    } catch (reason) {
      if (current.current === scope) setError(messageOf(reason));
    } finally {
      if (current.current === scope) setBusy(false);
    }
  }
  if (!issuer || !token) return null;
  const edge = draft ? Math.min(draft.width, draft.height) / zoom : 1;
  const scale = viewport / edge;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const imageStyle = draft
    ? {
        width: draft.width * scale,
        height: draft.height * scale,
        left: -(draft.width - edge) * position.x * scale,
        top: -(draft.height - edge) * position.y * scale,
      }
    : {};
  return (
    <section
      className="avatar-editor"
      aria-label={t("avatar")}
      data-avatar-editor={member.globalId || member.id}
    >
      <div className="avatar-editor-identity">
        <Avatar member={{ ...member, ...profile }} size={512} />
        <div>
          <strong>{member.name}</strong>
          <small>{t(isBot ? "bot" : "human")}</small>
        </div>
      </div>
      <p className="small muted">{t("scope")}</p>
      {loading ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          <Input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={busy || !profile}
            aria-label={t("change")}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="settings-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !profile}
              onClick={() => fileInput.current?.click()}
            >
              {t(draft ? "choose" : "change")}
            </Button>
            {profile?.avatar && !draft && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {t("remove")}
              </Button>
            )}
            {!profile && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReload((value) => value + 1)}
              >
                {t("retry")}
              </Button>
            )}
          </div>
          <p className="small muted">{t("help", { size: limit })}</p>
          {draft && (
            <div className="avatar-crop-editor">
              <div
                className="avatar-crop-stage"
                ref={cropStage}
                role="group"
                aria-label={t("crop")}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pointers.current.set(event.pointerId, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onPointerMove={(event) => {
                  const old = pointers.current.get(event.pointerId);
                  if (!old || busy) return;
                  const other = [...pointers.current.entries()].find(
                    ([id]) => id !== event.pointerId,
                  )?.[1];
                  if (other) {
                    const before = Math.hypot(old.x - other.x, old.y - other.y);
                    const after = Math.hypot(
                      event.clientX - other.x,
                      event.clientY - other.y,
                    );
                    if (before > 0)
                      setZoom((value) =>
                        Math.min(4, Math.max(1, (value * after) / before)),
                      );
                  } else
                    setPosition((value) => ({
                      x: clamp(
                        value.x -
                          (event.clientX - old.x) /
                            Math.max(1, (draft.width - edge) * scale),
                      ),
                      y: clamp(
                        value.y -
                          (event.clientY - old.y) /
                            Math.max(1, (draft.height - edge) * scale),
                      ),
                    }));
                  pointers.current.set(event.pointerId, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onPointerUp={(event) =>
                  pointers.current.delete(event.pointerId)
                }
                onPointerCancel={(event) =>
                  pointers.current.delete(event.pointerId)
                }
                onLostPointerCapture={(event) =>
                  pointers.current.delete(event.pointerId)
                }
              >
                <img
                  src={draft.url}
                  alt=""
                  draggable={false}
                  style={imageStyle}
                />
                <div className="avatar-crop-mask" />
              </div>
              <label>
                {t("zoom")}
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.01"
                  value={zoom}
                  disabled={busy}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
              <label>
                {t("horizontal")}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={position.x}
                  disabled={busy}
                  onChange={(event) =>
                    setPosition((value) => ({
                      ...value,
                      x: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                {t("vertical")}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={position.y}
                  disabled={busy}
                  onChange={(event) =>
                    setPosition((value) => ({
                      ...value,
                      y: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="avatar-crop-preview" aria-label={t("preview")}>
                <div>
                  <img
                    src={draft.url}
                    alt=""
                    style={Object.fromEntries(
                      Object.entries(imageStyle).map(([key, value]) => [
                        key,
                        (Number(value) * 40) / viewport,
                      ]),
                    )}
                  />
                </div>
                <span>{member.name}</span>
              </div>
              <div className="settings-actions">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {t(busy ? "saving" : "save")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null);
                    setError("");
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {busy && !draft && <p role="status">{t("saving")}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
