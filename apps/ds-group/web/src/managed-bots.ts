import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf } from "./api";
import { listBots, listDevices } from "./central";
import type { BotConnection, Device, ManagedBot } from "./central";
import type { Session } from "./types";

const POLL_MS = 3000;

export interface ManagedBots {
  /** Whether this session can reach the central server as the person; without it Bots can only be looked at. */
  available: boolean;
  issuer: string;
  token: string;
  bots: ManagedBot[];
  devices: Device[];
  loaded: boolean;
  error: string;
  reload(): Promise<void>;
}

/**
 * The person's Bots and devices at the central server, read every few seconds while `active`, so a Bot coming
 * online on a device shows up without a reload.
 */
export function useManagedBots(
  session: Session | null,
  active: boolean,
): ManagedBots {
  const issuer = session?.binding?.centralIssuer ?? "";
  const token = session?.central?.token ?? "";
  const available = Boolean(issuer && token);
  const [bots, setBots] = useState<ManagedBot[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!issuer || !token) return;
    const current = ++generation.current;
    try {
      const [nextBots, nextDevices] = await Promise.all([
        listBots(issuer, token),
        listDevices(issuer, token),
      ]);
      if (current !== generation.current) return;
      setBots(nextBots);
      setDevices(nextDevices);
      setLoaded(true);
      setError("");
    } catch (reason) {
      if (current === generation.current) setError(messageOf(reason));
    }
  }, [issuer, token]);
  useEffect(() => {
    generation.current++;
    setBots([]);
    setDevices([]);
    setLoaded(false);
    setError("");
  }, [issuer, token]);
  useEffect(() => {
    if (!active || !available) return undefined;
    void reload();
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [active, available, reload]);
  return { available, issuer, token, bots, devices, loaded, error, reload };
}

/** Whether a device's Bots are without their decision model: no key, switched off, or its last check failed. */
export const lacksDecision = (device: Device | undefined) =>
  Boolean(
    device?.decision &&
    (!device.decision.configured ||
      !device.decision.enabled ||
      device.decision.available === false),
  );

export const sameServer = (left: string, right: string) => {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
};

export type BotStage =
  | "noDevice"
  | "deviceOffline"
  | "failed"
  | "notHere"
  | "starting"
  | BotConnection;

/** Where a Bot stands on one chat server, in the order a person would fix things: device first, then setup, then the connection. */
export function botStage(
  bot: ManagedBot,
  server: string,
): { stage: BotStage; detail?: string } {
  if (!bot.runtime) return { stage: "noDevice" };
  if (!bot.runtime.online) return { stage: "deviceOffline" };
  if (bot.runtime.error) return { stage: "failed", detail: bot.runtime.error };
  const here = bot.settings.servers.find((item) => sameServer(item, server));
  if (!here) return { stage: "notHere" };
  const connection = bot.runtime.servers?.[here];
  // The device has not acted on this setup yet.
  if (!connection || (bot.runtime.revision ?? 0) < bot.settings.revision)
    return { stage: connection?.status === "online" ? "online" : "starting" };
  return { stage: connection.status, detail: connection.error };
}
