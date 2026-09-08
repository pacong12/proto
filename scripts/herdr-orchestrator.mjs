#!/usr/bin/env node
/**
 * herdr-orchestrator.mjs - Workspaces & Pane Orchestrator for Herdr
 */
import { execSync } from 'node:child_process';

const HERDR_ENV = process.env.HERDR_ENV === '1';

export function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    console.error(`Command failed: ${cmd}`, error.message);
    return null;
  }
}

export function listPanes() {
  if (!HERDR_ENV) {
    console.info('Not running in HERDR_ENV; skipping herdr pane list.');
    return [];
  }
  const out = runCommand('herdr pane list');
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

console.log('Herdr Orchestration Tooling Initialized.');
