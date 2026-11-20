'use strict';

// Bounded MCP JSON-RPC transports. The supported protocol revisions are declared
// explicitly; this module does not claim to implement every optional MCP feature.
const { LIMIT } = require('./core');
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const instructions = 'Local desktop only. Verify target and obtain explicit authorization before starting. Stop and verify ownership release.';
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
async function dispatch(bridge, message, scopes = null, authGuard = null) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (message.id !== undefined && typeof message.id !== 'string' && !Number.isSafeInteger(message.id))) return rpcError(null, -32600, 'Invalid JSON-RPC request');
  const id = message.id;
  if (id === undefined) return null; // notifications are never executed as tool calls
  const params = message.params || {};
  let result;
  switch (message.method) {
    case 'initialize': result = { protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: bridge.serverInfo || { name: 'bridgebrain-direct-chat', version: '0.1.0' }, instructions: bridge.instructions || instructions }; break;
    case 'ping': result = {}; break;
    case 'tools/list': result = { tools: bridge.tools.map(tool => bridge.config.publicUrl ? { ...tool, securitySchemes: [{ type: 'oauth2', scopes: [`bridge.${bridge.handlers.get(tool.name).permission}`] }] } : tool) }; break;
    case 'tools/call':
      if (!params || typeof params.name !== 'string') return rpcError(id, -32602, 'Tool name is required');
      try {
        const value = await bridge.call(params.name, params.arguments || {}, scopes, authGuard);
        if (value && value._image) { const { _image, ...metadata } = value; result = { content: [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', data: _image, mimeType: value.mimeType || 'image/jpeg' }], isError: false }; }
        else result = { content: [{ type: 'text', text: JSON.stringify(value) }], isError: false };
      } catch (error) {
        result = { content: [{ type: 'text', text: error.message || 'Tool failed' }], isError: true };
        const scope = /^OAuth grant lacks (bridge\.[a-z]+)/.exec(error.message || '')?.[1];
        if (scope && bridge.config.publicUrl) result._meta = { 'mcp/www_authenticate': [`Bearer resource_metadata="${publicOrigin(bridge.config.publicUrl)}/.well-known/oauth-protected-resource", error="insufficient_scope", error_description="Reconnect and locally approve the required permission", scope="${scope}"`] };
      }
      break;
    default: return rpcError(id, -32601, 'Method not found');
  }
  return { jsonrpc: '2.0', id, result };
}
function startStdio(bridge, input = process.stdin, output = process.stdout, onEnd = () => bridge.close()) {
  let buffered = ''; let active = 0; let closing = false; let stopped;
  const send = response => { if (response && !closing) output.write(`${JSON.stringify(response)}\n`); };
  const done = () => {
    if (!closing) {
      closing = true; buffered = '';
      try { stopped = Promise.resolve(onEnd()); } catch (error) { stopped = Promise.reject(error); }
      stopped.catch(() => {});
    }
    return stopped;
  };
  input.setEncoding('utf8');
  input.on('data', data => {
    if (closing) return;
    buffered += data;
    if (Buffer.byteLength(buffered) > 4 * LIMIT) { send(rpcError(null, -32600, 'Request exceeds size limit')); input.destroy(); done(); return; }
    for (;;) {
      const end = buffered.indexOf('\n'); if (end < 0) break;
      const line = buffered.slice(0, end); buffered = buffered.slice(end + 1);
      if (!line.trim()) continue;
      let message; try { message = JSON.parse(line); } catch { send(rpcError(null, -32700, 'Invalid JSON')); continue; }
      if (active >= 16) { send(rpcError(message.id, -32000, 'Too many concurrent requests')); continue; }
      active++;
      dispatch(bridge, message).then(send, () => send(rpcError(message.id, -32603, 'Internal error'))).finally(() => { active--; });
    }
  });
  input.on('end', done);
  input.on('error', done);
  input.on('close', done);
  output.on('error', done);
  return { close: () => { input.destroy(); return done(); } };
}
module.exports = {startStdio};
