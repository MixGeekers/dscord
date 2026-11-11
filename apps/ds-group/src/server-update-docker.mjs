import http from 'node:http';

/** Docker API access belongs to the updater container, never Core or the administration process. */
export class UpdateDocker {
  constructor({ socketPath = '/var/run/docker.sock' } = {}) { this.socketPath = socketPath; }
  request(method, route, body, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const request = http.request({ socketPath: this.socketPath, path: `/v1.45${route}`, method,
        timeout, headers: { 'Content-Type': 'application/json' } }, response => {
        const chunks = []; let length = 0;
        response.on('data', chunk => {
          length += chunk.length;
          if (length > 16 * 1024 * 1024) request.destroy(new Error('Docker response too large'));
          else chunks.push(chunk);
        });
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let value;
          try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
          if (response.statusCode >= 400) reject(Object.assign(new Error(value?.message || 'Docker operation failed'), { status: response.statusCode }));
          else resolve(value);
        });
      });
      request.on('timeout', () => request.destroy(new Error('Docker operation timed out')));
      request.on('error', reject);
      request.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  inspect(id) { return this.request('GET', `/containers/${encodeURIComponent(id)}/json`); }
  async project() {
    const self = await this.inspect(process.env.HOSTNAME);
    const project = self.Config.Labels?.['com.docker.compose.project'];
    if (!project) throw new Error('Run the updater as part of its Compose project');
    return project;
  }
  async containers(project) {
    const filters = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${project}`] }));
    return this.request('GET', `/containers/json?all=true&filters=${filters}`);
  }
  async pull(image) {
    const result = await this.request('POST', `/images/create?fromImage=${encodeURIComponent(image)}`, undefined, 600000);
    const events = typeof result === 'string' ? result.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [result];
    if (events.some(event => event?.error)) throw new Error('Image download failed');
  }
  stop(id) { return this.request('POST', `/containers/${id}/stop?t=60`); }
  start(id) { return this.request('POST', `/containers/${id}/start`); }
  remove(id) { return this.request('DELETE', `/containers/${id}?force=true`); }
  rename(id, name) { return this.request('POST', `/containers/${id}/rename?name=${encodeURIComponent(name.replace(/^\//, ''))}`); }
  async replace(original, image, jobId) {
    const name = original.Name.replace(/^\//, '');
    const endpoints = Object.fromEntries(Object.entries(original.NetworkSettings.Networks).map(([network, endpoint]) => [network, {
      Aliases: (endpoint.Aliases || []).filter(alias => alias !== original.Id && alias !== original.Id.slice(0, 12)),
      ...(endpoint.IPAMConfig ? { IPAMConfig: endpoint.IPAMConfig } : {}),
      ...(endpoint.DriverOpts ? { DriverOpts: endpoint.DriverOpts } : {}),
    }]));
    const config = { ...original.Config };
    if (config.Hostname === original.Id.slice(0, 12)) delete config.Hostname;
    const host = structuredClone(original.HostConfig);
    // A Compose port of 0 was allocated once. Reuse that actual port across replacement.
    for (const [port, bindings] of Object.entries(original.NetworkSettings.Ports || {})) {
      if (bindings?.length && host.PortBindings?.[port]) host.PortBindings[port] = bindings;
    }
    const created = await this.request('POST', `/containers/create?name=${encodeURIComponent(name)}`, {
      ...config, Image: image, Labels: { ...config.Labels, 'org.dscord.update-job': jobId },
      HostConfig: host, NetworkingConfig: { EndpointsConfig: endpoints },
    });
    await this.start(created.Id);
    return created.Id;
  }
}
