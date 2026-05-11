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
  traceId?: string;
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

test.beforeAll(async ({ browser }) => {
  state.baseUrl = getRequiredEnv("ERRNOX_E2E_BASE_URL");
  state.apiBaseUrl = getRequiredEnv("ERRNOX_E2E_API_URL");
  state.ingestUrl = getRequiredEnv("ERRNOX_E2E_INGEST_URL");
  state.apiLogPath = getRequiredEnv("ERRNOX_E2E_API_LOG");
  state.email = `trace-explorer-e2e+${state.unique}@errnox.test`;
  state.traceId = `trace-exp-${state.unique}`;

  const page = await browser.newPage();
  await page.goto(`${state.baseUrl}/login?next=%2Ftrace-explorer`);
  await page.locator('input[type="email"]').fill(state.email);
  await page.locator('form button[type="submit"]').click();

  const otp = await waitForOtpCodeFromLog(state.apiLogPath, 60_000);
  await page.locator('input[inputmode="numeric"]').fill(otp);
  await page.locator('form button[type="submit"]').click();
  await waitForUrl(page, /\/(onboarding|trace-explorer|overview|workspaces)/, 60_000);

  state.session = await readDashboardSession(page);

  const workspace = await apiRequest<Workspace>({
    baseUrl: state.apiBaseUrl,
    token: state.session.token,
    path: "/workspaces",
    method: "POST",
    body: {
      name: `Trace Explorer Workspace ${state.unique}`,
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
      name: `Trace Explorer Project ${state.unique}`,
      slug: `trace-explorer-${state.unique}`,
      platform: "node",
      environmentDefault: "production",
      status: "active",
    },
  });
  state.projectId = project.id;
  state.projectKey = project.apiKey ?? project.api_key ?? undefined;

  await sendIngestEvent({
    ingestUrl: state.ingestUrl,
    projectKey: must(state.projectKey, "projectKey"),
    event: {
      type: "transaction",
      message: `GET /checkout/${state.unique}`,
      transaction_name: `GET /checkout/${state.unique}`,
      op: "http.server",
      duration_ms: 1420,
      status: "error",
      trace_id: must(state.traceId, "traceId"),
      span_id: "span-root-1",
      server_name: "checkout-api",
      level: "error",
      environment: "production",
      release: "2026.03.01",
    },
  });
  await sendIngestEvent({
    ingestUrl: state.ingestUrl,
    projectKey: must(state.projectKey, "projectKey"),
    event: {
      type: "transaction",
      message: `POST /payments/${state.unique}`,
      transaction_name: `POST /payments/${state.unique}`,
      op: "http.client",
      duration_ms: 380,
      status: "ok",
      trace_id: must(state.traceId, "traceId"),
      span_id: "span-child-1",
      server_name: "payments",
      level: "info",
      environment: "production",
      release: "2026.03.01",
    },
  });

  await waitFor(
    "trace explorer search ready",
    async () => {
      const payload = await apiRequest<any>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: `/performance/traces/search?workspaceId=${encodeURIComponent(must(state.workspaceId, "workspaceId"))}&projectIds=${encodeURIComponent(must(state.projectId, "projectId"))}&timeRange=24h&service=checkout-api&limit=50`,
      });
      const items = Array.isArray(payload.items) ? payload.items : [];
      return items.some((item) => String(item.traceId ?? "") === must(state.traceId, "traceId")) ? payload : null;
    },
    120_000,
    1_500
  );

  await page.close();
});

test("trace explorer: search and open trace timeline", async ({ page }) => {
  await gotoAuthed(page, "/trace-explorer");
  await expect(page.getByTestId("trace-explorer-page")).toBeVisible();

  await page.getByTestId("trace-filter-service").fill("checkout-api");

  const runResponse = page.waitForResponse(
    (response) => response.url().includes("/v1/performance/traces/search") && response.request().method() === "GET",
    { timeout: 45_000 }
  );
  await page.getByTestId("trace-search-run-button").click();
  await runResponse;

  await expect(page.getByTestId(`trace-row-${must(state.traceId, "traceId")}`)).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(`trace-row-${must(state.traceId, "traceId")}`).click();

  await expect.poll(() => page.url(), { timeout: 30_000 }).toContain("/performance?");
  await expect.poll(() => page.url(), { timeout: 30_000 }).toContain(`trace=${encodeURIComponent(must(state.traceId, "traceId"))}`);
});

