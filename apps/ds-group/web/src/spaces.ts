import type { Room } from "./types";

export interface SpaceRoom {
  roomId: string;
  name: string;
  status: "joined" | "restricted";
  canSend: boolean;
}
export interface SpaceInvitation {
  roomId: string;
  name: string;
  inviterId?: string;
  canJoin: boolean;
  status: "invited" | "approval_required";
}
export interface CollaborationSpace {
  serverName: string;
  name: string;
  home: boolean;
  status: "connected" | "revoked" | "offline";
  rooms: SpaceRoom[];
  invitations: SpaceInvitation[];
}
export interface SpacesResult {
  homeServer: string;
  userId: string;
  spaces: CollaborationSpace[];
}

export function matrixServer(id: string): string {
  return id.slice(id.indexOf(":") + 1);
}

export function roomsInSpace(
  rooms: Room[],
  space: CollaborationSpace | null,
): Room[] {
  if (space?.status === "revoked") return [];
  const membership = new Map(
    space?.rooms.map((room) => [room.roomId, room]) ?? [],
  );
  return rooms.flatMap((room) => {
    const fact = membership.get(room.roomId);
    if (!fact || fact.status !== "joined") return [];
    return [
      {
        ...room,
        serverId: space!.serverName,
        membership: "joined" as const,
        permissions: { ...room.permissions, sendMessages: fact.canSend },
      },
    ];
  });
}
