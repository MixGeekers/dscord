/**
 * This chat server's public page for the central index: what it is called, what it is about and how big it is.
 * Served from this server's own origin and naming the central server it trusts, the page is what lets that central
 * server list it.
 */
export function serverPage({ policy, identity, participants }) {
  const { directory } = policy;
  if (!identity.central || !identity.home.coreUrl) return undefined;
  return {
    schemaVersion: 1,
    central: identity.central.issuer,
    origin: identity.home.coreUrl,
    discovery: directory.discovery,
    name: directory.name || identity.home.serverName || new URL(identity.home.coreUrl).hostname,
    description: directory.description,
    tags: directory.tags,
    join: directory.join,
    members: {
      people: participants.filter(person => person.kind === 'human').length,
      bots: participants.filter(person => person.kind === 'bot').length,
    },
  };
}
