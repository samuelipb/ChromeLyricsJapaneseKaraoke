#!/usr/bin/env node
// PreToolUse guard (Plan.md §2.6 / §8). Bloquea:
//   (1) escribir archivos de secretos/credenciales (.env, *.pem, id_rsa, secrets.json…),
//   (2) bloques de clave privada pegados en cualquier archivo,
//   (3) patrones de CÓDIGO REMOTO/inseguro (eval, new Function, <script src=http…>) en el
//       CÓDIGO FUENTE de la extensión.
// NO inspecciona contenido de docs (.md) ni de archivos bajo .claude/ (ahí estos patrones
// aparecen como ejemplos a documentar). Multiplataforma (Node puro, sin bash → Windows-safe).
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}
function allow() {
  process.exit(0);
}
function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

let data;
try {
  data = JSON.parse(readStdin() || '{}');
} catch {
  allow();
}

const input = (data && data.tool_input) || {};
const filePath = input.file_path || input.path || '';
if (!filePath) allow();

const base = path.basename(filePath).toLowerCase();
const norm = String(filePath).replace(/\\/g, '/');

// --- (1) Rutas de secretos (cualquier extensión) ---
const isExample = /\.(example|sample|template)$/.test(base);
const secretName =
  base === '.env' ||
  (base.startsWith('.env.') && !/\.(example|sample|template)$/.test(base)) ||
  /\.(pem|key|p12|pfx|keystore|jks)$/.test(base) ||
  base === 'id_rsa' ||
  base === 'id_dsa' ||
  base === 'id_ecdsa' ||
  base === 'secrets.json' ||
  base === 'credentials.json';
if (secretName && !isExample) {
  deny(
    `Bloqueado por guard: "${base}" parece un archivo de secretos/credenciales. ` +
      `No se versionan secretos (Plan.md §8). Si necesitas un ejemplo, usa "*.example" sin valores reales.`,
  );
}

// --- Contenido a inspeccionar (Write/Edit/MultiEdit) ---
let content = '';
if (typeof input.content === 'string') content += input.content;
if (typeof input.new_string === 'string') content += '\n' + input.new_string;
if (Array.isArray(input.edits)) {
  for (const e of input.edits) {
    if (e && typeof e.new_string === 'string') content += '\n' + e.new_string;
  }
}

// --- (2) Bloque de clave privada en CUALQUIER archivo ---
if (/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(content)) {
  deny('Bloqueado por guard: el contenido incluye un bloque "PRIVATE KEY". Nunca lo guardes en el repo.');
}

// --- (3) Código remoto SOLO en código fuente de la extensión ---
const isSource = /\.(ts|tsx|js|jsx|mjs|cjs|html)$/.test(base);
const underClaude = norm.includes('/.claude/') || norm.startsWith('.claude/');
const isMarkdown = base.endsWith('.md');
if (isSource && !underClaude && !isMarkdown && content) {
  const patterns = [
    [/\beval\s*\(/, 'eval(...)'],
    [/new\s+Function\s*\(/, 'new Function(...)'],
    [/\.then\s*\(\s*eval\s*\)/, 'fetch(...).then(eval)'],
    [/<script[^>]+src\s*=\s*["']?\s*https?:/i, '<script src="http…">'],
    [/import\s*\(\s*[`'"]\s*https?:/i, 'import("http…")'],
    [/document\.write\s*\(/, 'document.write(...)'],
  ];
  for (const [re, label] of patterns) {
    if (re.test(content)) {
      deny(
        `Bloqueado por guard: patrón de código remoto/inseguro "${label}" en ${base}. ` +
          `MV3 prohíbe código remoto y eval (Plan.md §8 · rules/security.md). ` +
          `Empaqueta todo localmente y construye el DOM con nodos + texto escapado.`,
      );
    }
  }
}

allow();
