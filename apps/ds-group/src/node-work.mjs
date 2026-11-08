/** All credentials and proofs stay at the Bot's original home. */
export function createNodeWorkClient(
  coreUrl,
  nodeSecret,
  botId,
  fetchImpl = fetch,
) {
  async function call(route, body) {
    let response;
    try {
      response = await fetchImpl(new URL(route, coreUrl), {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${nodeSecret}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (cause) {
      throw Object.assign(new Error('Home work authority is unavailable'), {
        networkError: true,
        cause,
      });
    }
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(result.error || 'Bot work authorization rejected'),
        { status: response.status, code: result.code },
      );
    return result;
  }
  return {
    join: (roomId) =>
      call(`/internal/bots/${encodeURIComponent(botId)}/join`, { roomId }),
    directory: (roomId) =>
      call(
        `/internal/bots/${encodeURIComponent(botId)}/rooms/${encodeURIComponent(roomId)}/directory`,
      ),
  };
}
