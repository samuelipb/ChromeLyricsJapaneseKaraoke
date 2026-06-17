#!/usr/bin/env node
// Stop / SubagentStop: corre la suite de tests si existe (Plan.md §2.6). DEFENSIVO y
// NO-bloqueante por defecto: reporta fallos por stderr pero deja terminar (evita bucles).
// Respeta stop_hook_active para no re-disparar en cadena. Multiplataforma (Node → Windows-safe).
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

// Evita bucles: si ya estamos en una continuación disparada por un stop-hook, no re-correr.
if (data.stop_hook_active === true) process.exit(0);

const cwd = data.cwd || process.cwd();
const pkgPath = path.join(cwd, 'package.json');
if (!existsSync(pkgPath)) process.exit(0); // Fase 0: aún sin tests
if (!existsSync(path.join(cwd, 'node_modules'))) process.exit(0);

let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch {
  process.exit(0);
}
const testScript = pkg.scripts && pkg.scripts.test;
if (!testScript || /no test specified/i.test(testScript)) process.exit(0);

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
let r;
try {
  r = spawnSync(npm, ['test', '--silent'], { cwd, encoding: 'utf8' });
} catch {
  process.exit(0);
}

if (r && r.status) {
  // Para hacerlo BLOQUEANTE (que Claude no termine hasta arreglar los tests), cambia a:
  //   process.stderr.write(...); process.exit(2);
  process.stderr.write('[run-tests] La suite de tests FALLÓ:\n' + ((r.stdout || '') + (r.stderr || '')).slice(-2500) + '\n');
}
process.exit(0);
