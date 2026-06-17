#!/usr/bin/env node
// PostToolUse (tras Write/Edit/MultiEdit): formatea + lint + typecheck sobre lo editado
// (Plan.md §2.6). DEFENSIVO: si aún no hay tooling (package.json / node_modules), hace no-op
// limpio para no romper edits durante Fase 0/1. NO-bloqueante: surfacea avisos por stderr sin
// deshacer el cambio. Multiplataforma (Node puro → Windows-safe).
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}
let data;
try {
  data = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0);
}

const cwd = data.cwd || process.cwd();
const input = (data && data.tool_input) || {};
const file = input.file_path || input.path || '';
if (!file) process.exit(0);

if (!existsSync(path.join(cwd, 'package.json'))) process.exit(0); // Fase 0: aún sin tooling
const binDir = path.join(cwd, 'node_modules', '.bin');
if (!existsSync(binDir)) process.exit(0);

const isWin = process.platform === 'win32';
const bin = (name) => {
  const p = path.join(binDir, isWin ? `${name}.cmd` : name);
  return existsSync(p) ? p : null;
};
const run = (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });

const ext = path.extname(file).toLowerCase();
const fmtExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md']);
const warnings = [];

try {
  if (fmtExts.has(ext)) {
    const prettier = bin('prettier');
    if (prettier) run(prettier, ['--write', file]);
  }
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    const eslint = bin('eslint');
    if (eslint) {
      const r = run(eslint, ['--fix', file]);
      if (r.status) warnings.push(`ESLint reportó problemas en ${path.basename(file)}:\n${(r.stdout || '').slice(-1500)}`);
    }
  }
  if (['.ts', '.tsx'].includes(ext)) {
    const tsc = bin('tsc');
    if (tsc) {
      const r = run(tsc, ['--noEmit']);
      if (r.status) warnings.push(`Type-check (tsc --noEmit) falló:\n${(r.stdout || '').slice(-2000)}`);
    }
  }
} catch {
  process.exit(0); // nunca rompas el flujo por el hook
}

if (warnings.length) {
  process.stderr.write('[format-lint] ' + warnings.join('\n---\n') + '\n');
}
process.exit(0);
