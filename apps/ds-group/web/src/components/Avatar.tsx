import { useState } from "react";
import type { Participant } from "../types";
import { avatarColor, useAvatar } from "../avatar-profiles";

export function Avatar({
  member,
  id,
  className = "",
  size = 128,
}: {
  member?: Partial<Participant> | null;
  id?: string;
  className?: string;
  size?: number;
}) {
  const avatar = useAvatar(member);
  const url = avatar?.sizes?.[size] ?? avatar?.url;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      id={id}
      className={`avatar avatar-${member?.kind ?? "human"} ${className}`}
      style={{
        backgroundColor: avatarColor(
          member?.globalId || member?.id || member?.name || "?",
        ),
      }}
      aria-hidden="true"
    >
      {url && failed !== url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed(url)}
        />
      ) : (
        [...(member?.name || "?")][0]
      )}
    </span>
  );
}
