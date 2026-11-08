export interface AttachmentSource {
  roomId?: string;
  eventId?: string;
}
export function roomAttachmentRoute(
  id: string,
  source: AttachmentSource,
  metadata = false,
): string {
  const suffix = metadata ? "/metadata" : "";
  if (source.roomId && source.eventId) {
    return `/api/rooms/${encodeURIComponent(source.roomId)}/attachments/${encodeURIComponent(id)}${suffix}?eventId=${encodeURIComponent(source.eventId)}`;
  }
  return `/api/attachments/${encodeURIComponent(id)}${suffix}`;
}
