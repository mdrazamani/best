import * as fs from 'fs';

type LaunchOptions = {
  headless: true;
  args: string[];
  executablePath?: string;
};

const EXECUTABLE_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
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
