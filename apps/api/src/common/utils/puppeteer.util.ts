import * as fs from 'fs';

type LaunchOptions = {
  headless: true;
  args: string[];
  executablePath?: string;
};

const EXECUTABLE_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_SHIM,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable'
].filter(Boolean) as string[];

export function buildPuppeteerLaunchOptions(): LaunchOptions {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const executablePath = EXECUTABLE_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) {
    return { headless: true, args };
  }
  return { headless: true, args, executablePath };
}
