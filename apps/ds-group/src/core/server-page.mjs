/**
 * This chat server's public page for the central index: what it is called, what it is about and how big it is.
 * It names the central server it trusts and carries the challenge an operator got from that central server,
 * which is how the central server knows the operator controls this origin.
 */
export function serverPage({ policy, identity, participants }) {
  const { directory } = policy;
  if (!directory.challenge || !identity.central || !identity.home.coreUrl) return undefined;
  return {
    schemaVersion: 1,
    central: identity.central.issuer,
    origin: identity.home.coreUrl,
    challenge: directory.challenge,
    listed: directory.listed,
    name: directory.name || identity.home.serverName || new URL(identity.home.coreUrl).hostname,
    description: directory.description,
    tags: directory.tags,
    join: 'central-account',
    members: {
      people: participants.filter(person => person.kind === 'human').length,
      bots: participants.filter(person => person.kind === 'bot').length,
    },
  };
}
