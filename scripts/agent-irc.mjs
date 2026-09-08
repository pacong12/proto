#!/usr/bin/env node
/**
 * agent-irc.mjs - Agent communication script for Proto agents
 * Supports Redis-backed IPC and fallback file-based logging
 */
import fs from 'node:fs';
import path from 'node:path';

const _REDIS_URL = process.env.REDIS_URL;
const LOG_FILE = path.join(process.cwd(), '.agent-irc.log');
const _AGENTS = ['conductor', 'vault', 'contracts', 'face', 'deck', 'ops', 'qa', 'reviewer'];

const [,, cmd, ...args] = process.argv;

function fmt(msg) {
  const t = new Date(msg.ts).toISOString().slice(11, 19);
  const to = msg.to === 'all' ? '#proto' : `@${msg.to}`;
  return `[${t}] <${msg.from}> ${to}: ${msg.body}`;
}

function appendLog(msg) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(msg) + '\n');
}

function readLogs(limit = 40) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l));
}

async function main() {
  if (cmd === 'send') {
    const [from, to, ...rest] = args;
    if (!from || !to || !rest.length) {
      console.error('usage: node scripts/agent-irc.mjs send <from> <to|all> <message>');
      process.exit(1);
    }
    const msg = { ts: Date.now(), from, to, body: rest.join(' ') };
    appendLog(msg);
    console.log(fmt(msg));
  } else if (cmd === 'log') {
    const limit = parseInt(args[0] ?? '40', 10);
    const rows = readLogs(limit);
    rows.forEach((msg) => console.log(fmt(msg)));
  } else if (cmd === 'listen' || cmd === 'tail') {
    console.log(`[irc] Watching ${LOG_FILE}...`);
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');
    let pos = fs.statSync(LOG_FILE).size;
    setInterval(() => {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > pos) {
        const stream = fs.createReadStream(LOG_FILE, { start: pos, end: stats.size });
        stream.on('data', (chunk) => {
          const lines = chunk.toString().trim().split('\n').filter(Boolean);
          lines.forEach((l) => {
            try {
              console.log(fmt(JSON.parse(l)));
            } catch {
              console.log(l);
            }
          });
        });
        pos = stats.size;
      }
    }, 500);
  } else {
    console.log(`usage:
  node scripts/agent-irc.mjs send <from> <to|all> <message>
  node scripts/agent-irc.mjs log [limit]
  node scripts/agent-irc.mjs listen <agent>
  node scripts/agent-irc.mjs tail`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
