import { expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";

export type DashboardSession = {
  token: string;
  refreshToken?: string;
  user?: { id: string; email: string };
};

export type DashboardStorageSeed = {
  session: DashboardSession;
  workspaceId?: string | null;
  projectId?: string | null;
  locale?: "en" | "fa" | "ar";
};

export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

export async function seedDashboardStorage(page: Page, input: DashboardStorageSeed) {
  await page.addInitScript((seed: DashboardStorageSeed) => {
    window.localStorage.setItem("errnox_session", JSON.stringify(seed.session));
    window.localStorage.setItem("errnox_locale", seed.locale ?? "en");
    if (seed.workspaceId) {
      window.localStorage.setItem("errnox_workspace", seed.workspaceId);
    } else {
      window.localStorage.removeItem("errnox_workspace");
    }
    if (seed.projectId) {
      window.localStorage.setItem("errnox_project", seed.projectId);
    } else {
      window.localStorage.removeItem("errnox_project");
    }
  }, input);
}

export async function waitForOtpCodeFromLog(logPath: string, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await tryReadFile(logPath);
    const matches = [...content.matchAll(/Your OTP code:\s*(\d{6})/g)];
    if (matches.length > 0) {
      return matches[matches.length - 1]?.[1] ?? "";
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for OTP in ${logPath}`);
}

export async function readDashboardSession(page: Page): Promise<DashboardSession> {
  const raw = await page.evaluate(() => window.localStorage.getItem("errnox_session"));
  if (!raw) {
    throw new Error("Missing errnox_session in localStorage");
  }
  const parsed = JSON.parse(raw) as DashboardSession;
  if (!parsed.token) {
    throw new Error("Session token missing in errnox_session");
  }
  return parsed;
}

export async function apiRequest<T>(input: {
  baseUrl: string;
  token: string;
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}): Promise<T> {
  const url = new URL(
    input.path.replace(/^\//, ""),
    input.baseUrl.endsWith("/") ? input.baseUrl : `${input.baseUrl}/`
  );
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: input.method ?? (input.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${input.token}`,
      ...(input.body ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error?.message ?? (payload as any)?.message ?? `HTTP ${response.status}`;
    throw new Error(`API ${input.path} failed: ${message}`);
  }
  return ((payload as any)?.data ?? payload) as T;
}

export async function waitFor<T>(
  label: string,
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 60_000,
  intervalMs = 500
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  if (lastError) {
    throw new Error(`${label} timed out (last error: ${lastError instanceof Error ? lastError.message : String(lastError)})`);
  }
  throw new Error(`${label} timed out`);
}

export async function sendIngestEvent(input: {
  ingestUrl: string;
  projectKey: string;
  event: Record<string, unknown>;
}) {
  const response = await fetch(input.ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ERRNOX-API-KEY": input.projectKey,
    },
    body: JSON.stringify(input.event),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error?.message ?? (payload as any)?.message ?? `HTTP ${response.status}`;
    throw new Error(`Ingest request failed: ${message}`);
  }
  return payload;
}

export async function waitForUrl(page: Page, pattern: RegExp, timeoutMs = 30_000) {
  await expect.poll(() => page.url(), { timeout: timeoutMs }).toMatch(pattern);
}

async function tryReadFile(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
