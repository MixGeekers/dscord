import { httpOrigin } from "./client-config.ts";
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

export interface DiscoveredServer {
  origin: string;
  name: string;
  serverName: string;
  centralIssuer: string | null;
}

export async function discoverServer(
  address: string,
  signal?: AbortSignal,
): Promise<DiscoveredServer> {
  const origin = httpOrigin(address.trim(), "Server address", true);
  const options: RequestInit = {
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
  };
  const response = await fetch(
    new URL("/.well-known/dscord/client", origin),
    options,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value = (await response.json()) as {
    schemaVersion: number;
    name?: string;
    central: { issuer: string } | null;
    home: { serverName: string };
  };
  if (value.schemaVersion !== 2 || !value.home?.serverName)
    throw new Error("This address is not a DSCord service");
  return {
    origin,
    name: value.name || value.home.serverName,
    serverName: value.home.serverName,
    centralIssuer: value.central?.issuer ?? null,
  };
}
