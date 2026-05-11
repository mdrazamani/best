import { expect, test, type Page } from "@playwright/test";
import {
  apiRequest,
  getRequiredEnv,
  readDashboardSession,
  seedDashboardStorage,
  sendIngestEvent,
  waitFor,
  waitForOtpCodeFromLog,
  waitForUrl,
  type DashboardSession,
} from "./helpers";

type Workspace = { id: string; name: string };
type Project = { id: string; apiKey?: string | null; api_key?: string | null };

const state: {
  unique: string;
  baseUrl: string;
  apiBaseUrl: string;
  ingestUrl: string;
  apiLogPath: string;
  email: string;
  session?: DashboardSession;
  workspaceId?: string;
  projectId?: string;
  projectKey?: string;
  sessionId?: string;
  longSessionId?: string;
} = {
  unique: `${Date.now()}`,
  baseUrl: "",
  apiBaseUrl: "",
  ingestUrl: "",
  apiLogPath: "",
  email: "",
};

test.describe.configure({ mode: "serial" });

function must<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }
  return value as T;
}

async function gotoAuthed(page: Page, route: string) {
  await seedDashboardStorage(page, {
    session: must(state.session, "session"),
    workspaceId: state.workspaceId ?? null,
    projectId: state.projectId ?? null,
    locale: "en",
  });
  await page.goto(route);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

test.beforeAll(async ({ browser }) => {
  state.baseUrl = getRequiredEnv("ERRNOX_E2E_BASE_URL");
  state.apiBaseUrl = getRequiredEnv("ERRNOX_E2E_API_URL");
  state.ingestUrl = getRequiredEnv("ERRNOX_E2E_INGEST_URL");
  state.apiLogPath = getRequiredEnv("ERRNOX_E2E_API_LOG");
  state.email = `replay-e2e+${state.unique}@errnox.test`;
  state.sessionId = `sess-replay-${state.unique}`;
  state.longSessionId = `sess-replay-long-${state.unique}`;
  const replayId = `rep-replay-${state.unique}`;
  const longReplayId = `rep-replay-long-${state.unique}`;

  const page = await browser.newPage();
  await page.goto(`${state.baseUrl}/login?next=%2Fsessions`);
  await page.locator('input[type="email"]').fill(state.email);
  await page.locator('form button[type="submit"]').click();

  const otp = await waitForOtpCodeFromLog(state.apiLogPath, 60_000);
  await page.locator('input[inputmode="numeric"]').fill(otp);
  await page.locator('form button[type="submit"]').click();
  await waitForUrl(page, /\/(onboarding|sessions|overview|workspaces)/, 60_000);

  state.session = await readDashboardSession(page);

  const workspace = await apiRequest<Workspace>({
    baseUrl: state.apiBaseUrl,
    token: state.session.token,
    path: "/workspaces",
    method: "POST",
    body: {
      name: `Replay Workspace ${state.unique}`,
      timezone: "UTC",
      locale: "en",
    },
  });
  state.workspaceId = workspace.id;

  const project = await apiRequest<Project>({
    baseUrl: state.apiBaseUrl,
    token: state.session.token,
    path: "/projects",
    method: "POST",
    body: {
      workspaceId: workspace.id,
      name: `Replay Project ${state.unique}`,
      slug: `replay-${state.unique}`,
      platform: "node",
      environmentDefault: "production",
      status: "active",
    },
  });
  state.projectId = project.id;
  state.projectKey = project.apiKey ?? project.api_key ?? undefined;

  const baseTs = new Date();
  const frame0Ts = new Date(baseTs.getTime() - 6_000).toISOString();
  const frame1Ts = new Date(baseTs.getTime() - 3_000).toISOString();

  await sendIngestEvent({
    ingestUrl: state.ingestUrl,
    projectKey: must(state.projectKey, "projectKey"),
    event: {
      message: `Replay ingest ${state.unique}`,
      level: "info",
      environment: "production",
      tags: {
        feature: "session_replay",
        session_id: must(state.sessionId, "sessionId"),
        replay_id: replayId,
      },
      context: {
        session: {
          id: must(state.sessionId, "sessionId"),
          status: "ok",
        },
        replay: {
          replay_id: replayId,
          session_id: must(state.sessionId, "sessionId"),
          url: `https://shop.example.test/${state.unique}`,
          actions: [
            { at: frame0Ts, type: "navigation", url: `https://shop.example.test/${state.unique}` },
            { at: frame1Ts, type: "click", target: "#buy" },
          ],
          segments: [
            {
              at: frame0Ts,
              encoding: "json",
              mime_type: "application/json",
              payload: JSON.stringify({
                dom_snapshot: "<html><body><h1>Checkout</h1><button id='buy'>Buy</button></body></html>",
                events: [{ type: "navigation", url: `https://shop.example.test/${state.unique}` }],
              }),
            },
            {
              at: frame1Ts,
              encoding: "json",
              mime_type: "application/json",
              payload: JSON.stringify({
                dom_snapshot: "<html><body><h1>Checkout</h1><button id='buy'>Clicked</button></body></html>",
                events: [
                  { type: "click", target: "#buy" },
                  { type: "network", url: "https://api.example.test/checkout" },
                ],
              }),
            },
          ],
        },
      },
    },
  });

  const longBaseTs = Date.now() - 120_000;
  const longSegments = Array.from({ length: 88 }, (_, index) => {
    const at = new Date(longBaseTs + index * 1_000).toISOString();
    const events: Array<Record<string, unknown>> = [];
    if (index % 3 === 0) {
      events.push({ type: "click", target: `#cta-${index}` });
    }
    if (index === 35) {
      events.push({ type: "console_error", level: "error", message: "checkout failed" });
    } else if (index % 9 === 0) {
      events.push({ type: "console_log", level: "info", message: `step-${index}` });
    }
    if (index === 37 || index % 11 === 0) {
      events.push({ type: "network", url: `https://api.example.test/segment/${index}` });
    }
    return {
      at,
      encoding: "json",
      mime_type: "application/json",
      payload: JSON.stringify({
        dom_snapshot: `<html><body><h1>Session ${index}</h1><button id='cta-${index}'>Step ${index}</button></body></html>`,
        events,
      }),
    };
  });
  const longActions = longSegments.slice(0, 36).map((segment, index) => ({
    at: segment.at,
    type: index % 2 === 0 ? "navigation" : "click",
    target: `#cta-${index}`,
    url: `https://shop.example.test/long/${state.unique}/${index}`,
  }));

  const segmentedPayloads = chunk(longSegments, 22);
  for (const [index, payloadSegments] of segmentedPayloads.entries()) {
    await sendIngestEvent({
      ingestUrl: state.ingestUrl,
      projectKey: must(state.projectKey, "projectKey"),
      event: {
        message: `Replay ingest long ${state.unique} part ${index + 1}`,
        level: index === 1 ? "error" : "info",
        environment: "production",
        tags: {
          feature: "session_replay",
          session_id: must(state.longSessionId, "longSessionId"),
          replay_id: longReplayId,
        },
        context: {
          session: {
            id: must(state.longSessionId, "longSessionId"),
            status: index === 1 ? "crashed" : "ok",
          },
          replay: {
            replay_id: longReplayId,
            session_id: must(state.longSessionId, "longSessionId"),
            url: `https://shop.example.test/long/${state.unique}`,
            actions: index === 0 ? longActions : [],
            segments: payloadSegments,
          },
        },
      },
    });
  }

  await waitFor(
    "replay frames indexed",
    async () => {
      const payload = await apiRequest<any>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: `/sessions/${encodeURIComponent(must(state.sessionId, "sessionId"))}/replay`,
        query: {
          projectId: must(state.projectId, "projectId"),
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
          chunkLimit: 5,
        },
      });
      return Number(payload.count ?? 0) > 0 ? payload : null;
    },
    120_000,
    1_500
  );

  await waitFor(
    "long replay frames indexed",
    async () => {
      const payload = await apiRequest<any>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: `/sessions/${encodeURIComponent(must(state.longSessionId, "longSessionId"))}/replay`,
        query: {
          projectId: must(state.projectId, "projectId"),
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
          chunkLimit: 8,
        },
      });
      return Number(payload.count ?? 0) >= 70 ? payload : null;
    },
    120_000,
    1_500
  );

  await page.close();
});

test("session replay player renders and plays timeline", async ({ page }) => {
  const from = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const to = encodeURIComponent(new Date().toISOString());
  await gotoAuthed(
    page,
    `/sessions/replay/${encodeURIComponent(must(state.sessionId, "sessionId"))}?from=${from}&to=${to}`
  );

  await expect(page.getByTestId("replay-player-page")).toBeVisible();
  await expect(page.getByTestId("sessions-player")).toBeVisible();
  await expect(page.getByTestId("sessions-player-overlay")).toBeVisible();

  const currentTime = page.getByTestId("sessions-player-current-time");
  const before = (await currentTime.textContent()) ?? "";

  await page.getByTestId("sessions-player-toggle").click();
  await page.waitForTimeout(1_100);

  const after = (await currentTime.textContent()) ?? "";
  expect(after).not.toEqual(before);
});

test("session replay player auto-prefetches long sessions and supports jump controls", async ({ page }) => {
  const from = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const to = encodeURIComponent(new Date().toISOString());
  await gotoAuthed(
    page,
    `/sessions/replay/${encodeURIComponent(must(state.longSessionId, "longSessionId"))}?from=${from}&to=${to}`
  );

  await expect(page.getByTestId("replay-player-page")).toBeVisible();
  await expect(page.getByTestId("sessions-player")).toBeVisible();

  const timeline = page.getByTestId("sessions-player-timeline");
  const initialMax = Number((await timeline.getAttribute("max")) ?? "0");
  expect(initialMax).toBeGreaterThan(10);

  await timeline.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, Math.max(0, initialMax - 1));

  await expect.poll(async () => {
    return Number((await timeline.getAttribute("max")) ?? "0");
  }, { timeout: 45_000 }).toBeGreaterThan(initialMax);

  await expect(page.getByRole("button", { name: /Next error/i })).toBeVisible();
  const currentTime = page.getByTestId("sessions-player-current-time");
  const before = (await currentTime.textContent()) ?? "";
  await page.getByRole("button", { name: /Next error/i }).click();
  const after = (await currentTime.textContent()) ?? "";
  expect(after).not.toEqual(before);
});
