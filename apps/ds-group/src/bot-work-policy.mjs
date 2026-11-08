import { createHash } from 'node:crypto';
import {
  FILE_TOOLS,
  admitted,
  policyError,
  serverOf,
} from './governance.mjs';

export const workRequestId = (botId, eventId) =>
  `matrix-${createHash('sha256').update(`${botId}\0${eventId}`).digest('hex')}`;
export const denyWork = (message) =>
  Object.assign(policyError(403, message), { code: 'BOT_WORK_DENIED' });
const unique = (value) =>
  Array.isArray(value) &&
  value.every((id) => typeof id === 'string' && id) &&
  new Set(value).size === value.length;

export function validateOwnerGrants(input) {
  if (
    !input ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    !Array.isArray(input.grants) ||
    input.grants.length > 100
  ) {
    throw policyError(400, 'Invalid owner work grants');
  }
  const seen = new Set();
  return {
    revision: input.revision,
    grants: input.grants.map((grant) => {
      if (
        !grant ||
        typeof grant.roomId !== 'string' ||
        !/^![^\s]{1,500}$/.test(grant.roomId) ||
        seen.has(grant.roomId) ||
        typeof grant.enabled !== 'boolean' ||
        !unique(grant.requesterIds) ||
        grant.requesterIds.length > 100 ||
        grant.requesterIds.some((id) => !/^@[^:\s]+:[^\s]+$/.test(id)) ||
        !unique(grant.tools) ||
        grant.tools.some((tool) => !FILE_TOOLS.includes(tool))
      )
        throw policyError(400, 'Invalid owner room grant');
      seen.add(grant.roomId);
      return {
        roomId: grant.roomId,
        enabled: grant.enabled,
        requesterIds: [...grant.requesterIds].sort(),
        tools: [...grant.tools].sort(),
      };
    }),
  };
}

export function trustedRoomParticipants({ policy, locals, joinedIds }) {
  const local = new Map(locals.map((person) => [person.id, person]));
  return joinedIds.flatMap((id) => {
    const person =
      local.get(id) ||
      (serverOf(id) !== policy.serverName && admitted(policy, id)
        ? policy.members.find((person) => person.id === id && person.enabled)
        : undefined);
    if (!person) return [];
    return [
      {
        id: person.id,
        name: person.name,
        kind: person.kind,
        homeServer: serverOf(person.id),
        ...(person.localpart ? { localpart: person.localpart } : {}),
        ...(person.ownerId ? { ownerId: person.ownerId } : {}),
        ...(person.role ? { role: person.role } : {}),
      },
    ];
  });
}
