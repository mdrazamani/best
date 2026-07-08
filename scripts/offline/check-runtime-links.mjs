import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const scanRoots = [
  'apps/api/src',
  'apps/dashboard/src',
  'apps/dashboard/public',
  'apps/dashboard/index.html',
  'apps/android-local/src',
  'apps/android-local/public',
  'apps/android-local/index.html',
];

const ignoredDirs = new Set(['node_modules', 'dist', 'build', 'coverage', '.gradle']);
const allowedUrlPatterns = [
  /^http:\/\/localhost(?::\d+)?(?:\/|$)/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/,
  /^http:\/\/api(?::\d+)?(?:\/|$)/,
  /^http:\/\/dashboard(?::\d+)?(?:\/|$)/,
  /^https:\/\/localhost(?:\/|$)/,
  /^http:\/\/www\.w3\.org\//,
  /^http:\/\/schemas\./,
  /^https:\/\/schemas\./,
  /^data:/,
];

const urlPattern = /\bhttps?:\/\/[^\s"'`<>)]+/g;
const findings = [];

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    if (ignoredDirs.has(path.split(/[\\/]/).pop())) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }

  if (!/\.(ts|tsx|js|jsx|css|html|svg|json|conf)$/.test(path)) return;
  const content = readFileSync(path, 'utf8');
  const matches = content.match(urlPattern) ?? [];
  for (const url of matches) {
    if (!allowedUrlPatterns.some((pattern) => pattern.test(url))) {
      findings.push(`${relative(root, path)} -> ${url}`);
    }
  }
}

for (const item of scanRoots) {
  walk(join(root, item));
}

if (findings.length) {
  console.error('External runtime URLs found:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('No external runtime URLs found in app runtime sources.');
