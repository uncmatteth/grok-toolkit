'use strict';

// This is a tool executor, not a model client. Shell access is an explicit trust
// grant, NOT an operating-system sandbox. See SECURITY.md before enabling it.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const desktopInputMayContainText = args => ['type', 'press', 'hotkey'].includes(args.operation)
  || ['text', 'key', 'keys'].some(key => Object.hasOwn(args, key));
const uuid = () => crypto.randomUUID();
const LIMIT = 2 * 1024 * 1024;
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
function fail(message) { throw new Error(message); }
function privateDir(dir, verify = false) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (verify) {
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) fail('Bridge state directories must be private and owned by the current user');
  }
}
function jsonRead(file, fallback) {
  let fd;
  try {
    if (fs.lstatSync(file).isSymbolicLink()) fail('Private state/configuration must not be a symlink');
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) fail('Private state/configuration must be a private regular file owned by the current user');
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function atomic(file, data, mode = 0o600) {
  const tmp = `${file}.${uuid()}.tmp`;
  try {
    fs.writeFileSync(tmp, data, { flag: 'wx', mode });
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, file);
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
function jsonWrite(file, data) { atomic(file, `${JSON.stringify(data, null, 2)}\n`); }
function cleanEnv(extra = {}) {
  const names = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'SHELL', 'TERM', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'DISPLAY', 'XAUTHORITY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'XDG_CURRENT_DESKTOP'];
  const env = {};
  for (const key of names) if (process.env[key] !== undefined) env[key] = process.env[key];
  for (const [key, value] of Object.entries(extra)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || /^(OPENAI|CODEX|ANTHROPIC|BRIDGEBRAIN|CONTROL_PLANE|NODE_OPTIONS|PYTHONPATH|LD_|DYLD_)/i.test(key)) fail('Sensitive/provider/runtime environment overrides are not accepted');
    if (typeof value !== 'string' || value.includes('\0')) fail('Environment values must be NUL-free strings');
    env[key] = value;
  }
  return env;
}

function desktopCompanionCommand(config = {}) {
  if (process.platform !== 'linux') fail('This package supports Linux only');
  const python = config.python || 'python3';
  return { command: python, args: [path.join(__dirname, 'ui_backend.py')] };
}
function stopChild(child, force = false) {
  if (child.pid) { try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); } catch {} }
}
const str = (maxLength = 16384) => ({ type: 'string', maxLength });
const num = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const arr = (items, maxItems = 100) => ({ type: 'array', items, maxItems });
const enumeration = (...values) => ({ type: 'string', enum: values });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const bool = { type: 'boolean' };
function validate(schema, value, label = 'arguments') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
    for (const key of schema.required || []) if (!(key in value)) fail(`${label}.${key} is required`);
    for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, key)) fail(`Unexpected ${label}.${key}`);
      validate(schema.properties[key], item, `${label}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > schema.maxItems) fail(`${label} has invalid array size`);
    value.forEach((item, index) => validate(schema.items, item, `${label}[${index}]`));
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum) fail(`${label} is outside its integer range`);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.includes('\0') || value.length > (schema.maxLength || LIMIT)) fail(`${label} must be a bounded NUL-free string`);
    if (schema.enum && !schema.enum.includes(value)) fail(`${label} has an invalid value`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail(`${label} must be boolean`);
}

class DirectBridge {
  constructor(config) {
    this.config = config;
    this.state = path.resolve(config.stateDir);
    this.helper = null;
    this.helperPending = new Map();
    this.helperSeq = 0;
    this.helperQueue = Promise.resolve();
    this.closing = false;
  }
  registerTools() {
    const add = this.tool.bind(this);
    add('bridge_status', 'Identify current host and desktop ownership.', obj({}), 'read', true, () => null);
    add('desktop', 'Use the optional local GUI backend for screen/mouse/keyboard. On Wayland, call start and approve the OS share dialog; stop revokes this temporary session. Requires a separate desktop grant. ', obj({ operation: enumeration('status', 'start', 'stop', 'screenshot', 'move', 'click', 'double_click', 'drag', 'scroll', 'press', 'hotkey', 'type'), x: num(0, 65535), y: num(0, 65535), amount: num(-100, 100), key: str(64), keys: arr(str(64), 8), text: str(16384), button: enumeration('left', 'middle', 'right') }, ['operation']), 'desktop', false, a => this.ui({ ...a, kind: 'desktop' }));
  }
  call(name, args) {
    if (name !== 'desktop') fail('Only desktop operation transport is supported');
    return this.ui({ ...args, kind: 'desktop' });
  }
  ui(args) {
    if (this.closing) return Promise.reject(new Error('Bridge is stopped; queued UI actions were cancelled'));
    // A single ordered GUI lane prevents two concurrent clicks or typing actions
    // from racing on the same desktop/browser session.
    const task = this.helperQueue.catch(() => {}).then(() => this.uiRequest(args));
    this.helperQueue = task; return task;
  }
  uiRequest(args) {
    if (this.closing) return Promise.reject(new Error('Bridge is stopped; queued UI actions were cancelled'));
    if (!this.helper) {
      const companion = desktopCompanionCommand(this.config);
      const child = spawn(companion.command, [...companion.args, '--state', this.state], { env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
      this.helper = child; let buffered = '';
      const dead = () => {
        if (this.helper === child) this.helper = null;
        for (const pending of this.helperPending.values()) { clearTimeout(pending.timer); pending.reject(new Error('UI backend stopped; run the local doctor and inspect OS permissions/dependencies')); }
        this.helperPending.clear();
      };
      child.on('error', dead); child.on('exit', dead); child.stdin.on('error', () => {});
      child.stderr.on('data', () => {}); // No browser paths, login data or typed text in logs.
      child.stdout.on('data', data => {
        buffered += data.toString('utf8');
        if (buffered.length > 8 * LIMIT) { child.kill(); return; }
        for (;;) {
          const end = buffered.indexOf('\n'); if (end < 0) break;
          const line = buffered.slice(0, end); buffered = buffered.slice(end + 1);
          let message; try { message = JSON.parse(line); } catch { child.kill(); break; }
          const pending = this.helperPending.get(message.id); if (!pending) continue;
          this.helperPending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result);
        }
      });
    }
    return new Promise((resolve, reject) => {
      const id = ++this.helperSeq;
      const timer = setTimeout(() => { this.helperPending.delete(id); this.helper?.kill(); reject(new Error('UI operation timed out; no successful action is claimed')); }, args.kind === 'desktop' && args.operation === 'start' ? 150000 : 45000);
      this.helperPending.set(id, { resolve, reject, timer });
      this.helper.stdin.write(`${JSON.stringify({ id, ...args })}\n`);
    });
  }
  close() {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = (async () => {
      const waits = [];
      for (const pending of this.helperPending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Bridge is stopped; the active UI action was cancelled. Inspect its outcome before retrying.')); }
      this.helperPending.clear();
      const helper = this.helper; this.helper = null;
      if (helper) {
        waits.push(new Promise(resolve => helper.once('close', resolve)));
        helper.stdin.destroy(); stopChild(helper);
        const force = setTimeout(() => stopChild(helper, true), 1500); force.unref();
        helper.once('close', () => clearTimeout(force));
      }
      let timer;
      try { await Promise.race([Promise.all(waits), new Promise(resolve => { timer = setTimeout(resolve, 2200); })]); }
      finally { clearTimeout(timer); }
    })();
    return this.closePromise;
  }
}
module.exports = {DirectBridge, desktopInputMayContainText, hash, privateDir, jsonRead, validate, LIMIT};
