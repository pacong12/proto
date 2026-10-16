import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * RFC 9116 security.txt for the app and the docs. The Expires check fails 30 days ahead of the
 * date, so the file is renewed before scanners start treating it as stale.
 */
const FILES = [
  'apps/frontoffice/public/.well-known/security.txt',
  'apps/docs/src/public/.well-known/security.txt',
];
const DAY = 24 * 60 * 60 * 1000;

function fields(file: string): Record<string, string> {
  const text = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf(':');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

describe.each(FILES)('%s', (file) => {
  const f = fields(file);

  it('has the required Contact and Expires fields', () => {
    expect(f.Contact).toMatch(/^https:\/\//);
    expect(f.Expires).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('expires in more than 30 days and less than a year', () => {
    const remaining = new Date(f.Expires).getTime() - Date.now();
    expect(remaining, 'renew Expires in security.txt').toBeGreaterThan(30 * DAY);
    expect(remaining).toBeLessThan(366 * DAY);
  });

  it('declares its canonical URL through the site URL placeholder', () => {
    expect(f.Canonical).toMatch(/^%(APP|DOCS)_URL%\/\.well-known\/security\.txt$/);
  });
});
