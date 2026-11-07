import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../src');

interface Import {
  file: string;
  target: string;
  typeOnly: boolean;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Every relative import and re-export in src, as paths relative to src. */
const imports: Import[] = sourceFiles(SRC).flatMap((file) => {
  const code = fs.readFileSync(file, 'utf8');
  const statement = /^(import type|import|export type|export)\b[^;]*?from '(\.[^']+)'/gm;
  return [...code.matchAll(statement)].map((match) => ({
    file: path.relative(SRC, file),
    target: path.relative(SRC, path.resolve(path.dirname(file), match[2])),
    typeOnly: match[1].endsWith('type'),
  }));
});

const moduleOf = (p: string) => /^modules\/([^/]+)/.exec(p)?.[1];

describe('API module boundaries', () => {
  it('finds the source imports it checks', () => {
    expect(imports.length).toBeGreaterThan(100);
  });

  it('crosses modules only through their public index', () => {
    const deep = imports.filter(({ file, target }) => {
      const to = moduleOf(target);
      return to !== undefined && to !== moduleOf(file) && target !== `modules/${to}`;
    });
    expect(deep).toEqual([]);
  });

  it('has no dependency cycle between modules', () => {
    const edges = new Map<string, Set<string>>();
    for (const { file, target } of imports) {
      const [from, to] = [moduleOf(file), moduleOf(target)];
      if (from && to && from !== to) edges.set(from, (edges.get(from) ?? new Set()).add(to));
    }
    const cycles: string[] = [];
    const walk = (node: string, trail: string[]) => {
      if (trail.includes(node)) {
        cycles.push([...trail.slice(trail.indexOf(node)), node].join(' -> '));
        return;
      }
      for (const next of edges.get(node) ?? []) walk(next, [...trail, node]);
    };
    for (const node of edges.keys()) walk(node, []);
    expect(cycles).toEqual([]);
  });

  it('keeps core free of modules and the app', () => {
    const leaks = imports.filter(
      ({ file, target }) =>
        file.startsWith('core/') && (target.startsWith('modules/') || target.startsWith('app')),
    );
    expect(leaks).toEqual([]);
  });

  it('lets modules reach the app for types only', () => {
    const runtime = imports.filter(
      ({ file, target, typeOnly }) => moduleOf(file) && target.startsWith('app') && !typeOnly,
    );
    expect(runtime).toEqual([]);
  });

  it('leaves the moved aggregates out of the tokens module', () => {
    const tokens = sourceFiles(path.join(SRC, 'modules/tokens')).map((f) => path.basename(f));
    for (const moved of [
      'sqlite-trade.store.ts',
      'sqlite-social.store.ts',
      'sqlite-order.store.ts',
    ]) {
      expect(tokens).not.toContain(moved);
    }
  });
});
