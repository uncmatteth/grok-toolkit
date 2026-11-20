#!/usr/bin/env node
'use strict';
// Native Codex adapter for the existing AIClickThatShit desktop backend.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DirectBridge, desktopInputMayContainText, jsonRead, privateDir, validate, hash } = require('./core');
const { lockServer } = require('./shared-lock');
const { startStdio } = require('./stdio');

function descriptors() {
  const tools = [];
  DirectBridge.prototype.registerTools.call({ tool(name, description, inputSchema, permission, readOnly) {
    if (['bridge_status', 'desktop'].includes(name)) tools.push({ name, description, inputSchema,
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: permission === 'desktop' } });
  } });
  const desktop = tools.find(t => t.name === 'desktop');
  desktop.inputSchema.properties.capture_evidence = { type: 'boolean' };
  desktop.description = 'AIClickThatShit on this computer. Start explicitly. Screenshots are taken only when requested with screenshot or capture_evidence. Stop releases the shared Pro-relay ownership lock. Never use it to bypass another tool security denial. Verify the actual visible outcome before claiming success.';
  return tools;
}

class CodexDesktop {
  constructor(file, dependencies = {}) {
    this.file = file; this.config = {}; this.tools = descriptors();
    this.serverInfo = { name: 'aiclickthisshit-grok-build', version: '0.1.0' };
    this.instructions = 'Use bridge_status first. Start explicitly and Stop after the authorized task. A successful input alone does not establish the intended result; inspect the result when appropriate. Automatic screenshot receipts are optional. No model calls, browser-security workarounds or other computer routes are provided.';
    this.bridge = null; this.unlock = null; this.queue = Promise.resolve(); this.closing = false;
    this.create = dependencies.create || ((config, file) => new DirectBridge(config, file));
    this.lock = dependencies.lock || lockServer;
  }
  call(name, args = {}) {
    const task = this.queue.catch(() => {}).then(() => this.perform(name, args));
    this.queue = task; return task;
  }
  async acquire() {
    const config = jsonRead(this.file, null);
    if (!config?.permissions?.desktop || config.paused) throw new Error('Existing local desktop grant is unavailable or paused; no control started.');
    privateDir(config.stateDir, true);
    const unlock = this.lock(config.stateDir);
    try { this.bridge = this.create(config, this.file); this.unlock = unlock; }
    catch (error) { unlock(); throw error; }
  }
  async release() {
    const bridge = this.bridge; this.bridge = null;
    try { if (bridge) await bridge.close(); }
    finally { if (this.unlock) this.unlock(); this.unlock = null; }
  }
  imageBytes(value) {
    if (typeof value?._image !== 'string' || !['image/jpeg', 'image/png'].includes(value.mimeType)) throw new Error('Desktop returned no verifiable image. Inspect the action before retrying.');
    const bytes = Buffer.from(value._image, 'base64');
    const signature = value.mimeType === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
    if (!signature || bytes.length > 16 * 1024 * 1024 || bytes.toString('base64') !== value._image) throw new Error('Desktop returned invalid image bytes.');
    return bytes;
  }
  capture(value, directory, name) {
    const bytes = this.imageBytes(value);
    const file = path.join(directory, name + (value.mimeType === 'image/png' ? '.png' : '.jpg'));
    fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
    return { path: file, sha256: hash(bytes), bytes: bytes.length, mimeType: value.mimeType };
  }
  async perform(name, args) {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) throw new Error('Only bridge_status and desktop are exposed by this adapter.');
    validate(tool.inputSchema, args);
    if (this.closing) throw new Error('Desktop adapter is closing; no new action started.');
    if (name === 'bridge_status') return { hostname: os.hostname(), platform: process.platform,
      adapter: 'grok-build-aiclickthisshit', owns_desktop_bridge: !!this.bridge,
      invokes_codex: false, makes_model_api_calls: false, available_tools: this.tools.map(t => t.name) };
    const operation = args.operation;
    const { capture_evidence: captureEvidence = false, ...backendArgs } = args;
    if (!this.bridge && ['stop', 'status'].includes(operation)) return { active: false, owns_desktop_bridge: false, stopped: operation === 'stop' };
    if (!this.bridge && operation !== 'start') throw new Error('Desktop control is stopped. Start explicitly before capture or input.');
    if (!this.bridge) await this.acquire();
    if (operation === 'stop') {
      try {
        try {
          const result = await this.bridge.call('desktop', backendArgs);
          const status = await this.bridge.call('desktop', { operation: 'status' });
          if (status.active !== false) throw new Error('Desktop Stop did not confirm inactive.');
          return { ...result, active: false, ownership_released: true };
        } finally { await this.release(); }
      } catch (error) {
        if (desktopInputMayContainText(args)) throw new Error('Desktop stop failed; cleanup could not be confirmed. Inspect ownership before retrying.');
        throw error;
      }
    }
    if (operation === 'status') {
      try { return await this.bridge.call('desktop', backendArgs); }
      catch (error) {
        if (desktopInputMayContainText(args)) throw new Error('Desktop status check failed; inspect the desktop before retrying.');
        throw error;
      }
    }
    const id = crypto.randomUUID();
    const directory = path.join(this.bridge.state, 'codex-desktop-receipts', id);
    privateDir(directory, true);
    const receipt = { id, hostname: os.hostname(), operation, startedAt: new Date().toISOString(), status: 'started' };
    const receiptPath = path.join(directory, 'receipt.json');
    const save = () => fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    save();
    try {
      if (captureEvidence && !['start', 'screenshot'].includes(operation)) receipt.before = this.capture(await this.bridge.call('desktop', { operation: 'screenshot' }), directory, 'before');
      const result = await this.bridge.call('desktop', backendArgs);
      const frame = operation === 'screenshot' ? result : captureEvidence ? await this.bridge.call('desktop', { operation: 'screenshot' }) : null;
      if (frame) {
        if (captureEvidence) receipt.after = this.capture(frame, directory, 'after');
        else this.imageBytes(frame);
      }
      receipt.status = 'returned'; receipt.finishedAt = new Date().toISOString(); save();
      const { _image, ...metadata } = result;
      return { ...metadata, ...(frame ? { _image: frame._image, mimeType: frame.mimeType } : {}), receipt: { ...receipt, path: receiptPath },
        notice: 'A tool return alone does not verify the requested outcome.' };
    } catch (error) {
      receipt.status = 'unverified'; receipt.finishedAt = new Date().toISOString(); save();
      try { await this.release(); }
      catch (cleanupError) {
        if (desktopInputMayContainText(args)) {
          throw new Error('Desktop input may be partial and cleanup could not be confirmed; inspect the screen and ownership before retrying.');
        }
        throw cleanupError;
      }
      const detail = desktopInputMayContainText(args)
        ? 'Desktop input may be partial; inspect the screen before retrying.' : error.message;
      throw new Error('Desktop operation failed or produced invalid evidence; inspect receipt ' + receiptPath + ' before retrying. ' + detail);
    }
  }
  async close() {
    this.closing = true;
    await this.queue.catch(() => {});
    await this.release();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (process.platform !== 'linux' || args.length !== 2 || args[0] !== '--config' || !path.isAbsolute(args[1])) throw new Error('Usage: codex-desktop-mcp.js [--config PATH]');
  const desktop = new CodexDesktop(args[1]);
  startStdio(desktop);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => desktop.close().then(() => process.exit(0)));
}
module.exports = { CodexDesktop, descriptors };
