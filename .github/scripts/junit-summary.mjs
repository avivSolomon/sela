// Writes a test summary table to the GitHub job summary: for each expected
// test suite, how many tests passed, failed and were skipped, read from the
// JUnit reports Vitest writes in CI. A suite without a report is listed as
// "not run". Failures are always shown as failures; this script only reports
// and never changes the job result (the test step does that).
//
// Usage: node junit-summary.mjs [sela|upstream|all]   (default: all)
//   sela      the packages of the app (required "Sela checks")
//   upstream  Actual packages that Sela does not use ("Upstream checks")
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const selaSuites = [
  [
    'web app (desktop-client)',
    'packages/desktop-client/test-results/junit.xml',
  ],
  ['core (node)', 'packages/loot-core/test-results/junit-node.xml'],
  ['core (web)', 'packages/loot-core/test-results/junit-web.xml'],
  ['components', 'packages/component-library/test-results/junit-web.xml'],
  ['crdt', 'packages/crdt/test-results/junit.xml'],
];
const upstreamSuites = [
  ['api', 'packages/api/test-results/junit.xml'],
  ['sync-server', 'packages/sync-server/test-results/junit.xml'],
  ['ci-actions', 'packages/ci-actions/test-results/junit.xml'],
  [
    'eslint-plugin-actual',
    'packages/eslint-plugin-actual/test-results/junit.xml',
  ],
];
const group = process.argv[2] || 'all';
const suites =
  group === 'sela'
    ? selaSuites
    : group === 'upstream'
      ? upstreamSuites
      : [...selaSuites, ...upstreamSuites];

function count(xml) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  // Each <testcase ...> is either self-closing or has a body with
  // <failure>, <error> or <skipped>.
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[3] || '';
    if (/<(failure|error)\b/.test(body)) {
      failed++;
      const name = /\bname="([^"]*)"/.exec(m[1])?.[1] ?? '?';
      const cls = /\bclassname="([^"]*)"/.exec(m[1])?.[1] ?? '';
      failures.push(`${cls} > ${name}`);
    } else if (/<skipped\b/.test(body)) {
      skipped++;
    } else {
      passed++;
    }
  }
  return { passed, failed, skipped, failures };
}

const rows = [];
const allFailures = [];
for (const [name, file] of suites) {
  if (!existsSync(file)) {
    rows.push(`| ${name} | - | - | - | not run (no report) |`);
    continue;
  }
  const r = count(readFileSync(file, 'utf8'));
  const status = r.failed > 0 ? 'FAILED' : 'passed';
  rows.push(
    `| ${name} | ${r.passed} | ${r.failed} | ${r.skipped} | ${status} |`,
  );
  for (const f of r.failures) allFailures.push(`- ${name}: ${f}`);
}

const out = [
  `## Unit test results (${group === 'sela' ? 'Sela app packages' : group === 'upstream' ? 'upstream packages Sela does not use' : 'all packages'})`,
  '',
  '| Suite | Passed | Failed | Skipped | Status |',
  '| --- | ---: | ---: | ---: | --- |',
  ...rows,
  '',
  allFailures.length
    ? `### Failed tests (${allFailures.length})\n\n${allFailures.slice(0, 50).join('\n')}`
    : 'No failed tests.',
  '',
  'Not run in CI: end-to-end (Playwright) and visual regression tests.',
  '',
].join('\n');

console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
}
