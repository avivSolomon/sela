// Format check that ignores Windows line endings.
//
// With core.autocrlf=true, Git checks out some files (Markdown, JSON, YAML,
// .mjs, snapshots...) with CRLF, while the formatter (oxfmt) expects LF. The
// repository content is LF, so those reports are not real problems.
//
// Usage: node scripts/format-check-lf.mjs [file ...]
//   no files: checks the whole repository (like "oxfmt --check .")
// Exit code 1 only when a file is badly formatted after converting CRLF to LF.
// Read-only: never writes files.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oxfmt = path.join(root, 'node_modules', 'oxfmt', 'bin', 'oxfmt');
const files = process.argv.slice(2);

const first = spawnSync(
  process.execPath,
  [oxfmt, '--check', ...(files.length ? files : ['.'])],
  {
    cwd: root,
    encoding: 'utf8',
  },
);
if (first.error) throw first.error;
if (first.status === 0) {
  console.log(
    `Format check passed (${files.length ? `${files.length} files` : 'whole repository'}).`,
  );
  process.exit(0);
}

// oxfmt lists each problem file as "path (12ms)".
const listed = (first.stdout + first.stderr)
  .split(/\r?\n/)
  .map(line => /^(\S.*?) \(\d+ms\)$/.exec(line)?.[1])
  .filter(Boolean);
if (listed.length === 0) {
  process.stdout.write(first.stdout + first.stderr);
  process.exit(first.status ?? 1);
}

const real = [];
const lineEndingsOnly = [];
for (const file of listed) {
  const lf = readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  const out = spawnSync(process.execPath, [oxfmt, `--stdin-filepath=${file}`], {
    cwd: root,
    input: lf,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (out.status === 0 && out.stdout === lf) lineEndingsOnly.push(file);
  else real.push(file);
}

console.log(
  `Line endings only (CRLF on disk, LF in the repository) - not a problem: ${lineEndingsOnly.length} file(s).`,
);
if (real.length) {
  console.log(`Badly formatted: ${real.length} file(s):`);
  for (const f of real) console.log(`  ${f}`);
  process.exit(1);
}
console.log('Format check passed.');
