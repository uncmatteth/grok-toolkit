'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {jsonRead} = require('./core');
function lockServer(state) {
  const file = path.join(state, 'server-lock.json');
  const value = { pid: process.pid, nonce: crypto.randomUUID() };
  if (fs.existsSync(file)) {
    const old = jsonRead(file, null);
    let live = true;
    if (Number.isSafeInteger(old?.pid) && old.pid > 0) {
      try { process.kill(old.pid, 0); } catch (error) { if (error.code === 'ESRCH') live = false; }
    }
    if (live) throw new Error('Another bridge server may be running. Stop it before starting a second instance.');
    fs.unlinkSync(file);
  }
  fs.writeFileSync(file, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  return () => { if (jsonRead(file, null)?.nonce === value.nonce) fs.unlinkSync(file); };
}
module.exports = {lockServer};
