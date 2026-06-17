#!/usr/bin/env node
// SessionStart: inyecta PROGRESS.md como contexto al abrir/retomar sesión, para arrancar con
// el estado del proyecto (Plan.md §2.6 / §2.7). Si no existe PROGRESS.md, no-op. Node → Windows-safe.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}
let data = {};
try {
  data = JSON.parse(readStdin() || '{}');
} catch {
  /* sin stdin: usamos cwd actual */
}

const cwd = data.cwd || process.cwd();
const progressPath = path.join(cwd, 'PROGRESS.md');
if (!existsSync(progressPath)) process.exit(0);

let body = '';
try {
  body = readFileSync(progressPath, 'utf8');
} catch {
  process.exit(0);
}
if (body.length > 12000) body = body.slice(0, 12000) + '\n…(truncado; abre PROGRESS.md para el resto)';

const context = 'Contexto de retoma (PROGRESS.md). Lee la sección "PRÓXIMA TAREA" antes de actuar:\n\n' + body;
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }),
);
process.exit(0);
