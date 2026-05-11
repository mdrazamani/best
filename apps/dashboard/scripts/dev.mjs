import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..", "..");

const configuredTarget = process.env.VITE_PROXY_TARGET?.trim();
const candidateTargets = [
  ...(configuredTarget ? [configuredTarget] : []),
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://[::1]:3000",
];
const proxyTargets = [...new Set(candidateTargets)];

const apiStartTimeoutMs = Number(process.env.DASHBOARD_API_BOOT_TIMEOUT_MS ?? 120_000);
const apiPollIntervalMs = 1_500;
const localViteEntry = path.join(appDir, "node_modules", "vite", "bin", "vite.js");
const hasLocalViteEntry = existsSync(localViteEntry);

let apiProcess = null;
let viteProcess = null;

function run(command, args, cwd, options = {}) {
  return spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: options.shell ?? false,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });
}

async function isApiReachable(target) {
  try {
    const url = new URL("/v1", target).toString();
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveReachableTarget() {
  for (const target of proxyTargets) {
    // eslint-disable-next-line no-await-in-loop
    if (await isApiReachable(target)) {
      return target;
    }
  }
  return null;
}

function terminateChildren(signal = "SIGTERM") {
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill(signal);
  }
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill(signal);
  }
}

async function ensureApi() {
  const reachableBeforeStart = await resolveReachableTarget();
  if (reachableBeforeStart) {
    return reachableBeforeStart;
  }

  console.log("[dashboard:dev] API is not reachable. Starting @errnox/api ...");
  apiProcess = run("npm", ["--prefix", "apps/api", "run", "dev"], repoRoot, { shell: true });

  let apiProcessFailed = false;
  apiProcess.once("exit", () => {
    apiProcessFailed = true;
  });
  apiProcess.once("error", () => {
    apiProcessFailed = true;
  });

  const deadline = Date.now() + apiStartTimeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const reachableTarget = await resolveReachableTarget();
    if (reachableTarget) {
      console.log(`[dashboard:dev] API is ready at ${reachableTarget}.`);
      return reachableTarget;
    }
    if (apiProcessFailed) {
      console.warn("[dashboard:dev] API process exited before becoming reachable.");
      return configuredTarget || "http://127.0.0.1:3000";
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(apiPollIntervalMs);
  }

  console.warn("[dashboard:dev] Timed out waiting for API. Starting Vite anyway.");
  return configuredTarget || "http://127.0.0.1:3000";
}

async function main() {
  const viteArgs = process.argv.slice(2);
  const skipApiBootstrap =
    process.env.DASHBOARD_SKIP_API_BOOTSTRAP === "true" ||
    viteArgs.includes("--help") ||
    viteArgs.includes("-h") ||
    viteArgs.includes("--version") ||
    viteArgs.includes("-v");

  let proxyTarget = configuredTarget || "http://127.0.0.1:3000";
  if (!skipApiBootstrap) {
    proxyTarget = await ensureApi();
  } else {
    proxyTarget = (await resolveReachableTarget()) ?? proxyTarget;
  }

  console.log(`[dashboard:dev] Using API proxy target ${proxyTarget}`);

  const viteEnv = { VITE_PROXY_TARGET: proxyTarget };
  if (hasLocalViteEntry) {
    viteProcess = run(process.execPath, [localViteEntry, ...viteArgs], appDir, { env: viteEnv });
  } else {
    viteProcess = run("vite", viteArgs, appDir, { shell: true, env: viteEnv });
  }

  viteProcess.on("exit", (code, signal) => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill("SIGTERM");
    }
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => terminateChildren("SIGINT"));
process.on("SIGTERM", () => terminateChildren("SIGTERM"));

main().catch((error) => {
  console.error("[dashboard:dev] Failed to start dev stack:", error);
  terminateChildren("SIGTERM");
  process.exit(1);
});
