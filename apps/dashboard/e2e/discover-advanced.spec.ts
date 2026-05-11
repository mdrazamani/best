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
type SavedView = { id: string; name: string };

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
  searchToken?: string;
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
  state.email = `discover-advanced-e2e+${state.unique}@errnox.test`;
  state.searchToken = `discover-advanced-${state.unique}`;

  const page = await browser.newPage();
  await page.goto(`${state.baseUrl}/login?next=%2Fdiscover`);
  await page.locator('input[type="email"]').fill(state.email);
  await page.locator('form button[type="submit"]').click();

  const otp = await waitForOtpCodeFromLog(state.apiLogPath, 60_000);
  await page.locator('input[inputmode="numeric"]').fill(otp);
  await page.locator('form button[type="submit"]').click();
  await waitForUrl(page, /\/(onboarding|discover|overview|workspaces)/, 60_000);

  state.session = await readDashboardSession(page);

  const workspace = await apiRequest<Workspace>({
    baseUrl: state.apiBaseUrl,
    token: state.session.token,
    path: "/workspaces",
    method: "POST",
    body: {
      name: `Discover Advanced Workspace ${state.unique}`,
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
      name: `Discover Advanced Project ${state.unique}`,
      slug: `discover-advanced-${state.unique}`,
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
      message: `Discover event ${state.searchToken}`,
      level: "error",
      release: "2026.03.01",
      environment: "production",
      tags: { service: "checkout", "http.method": "POST" },
      user: { id: "u-discover-1" },
      exception: {
        type: "TypeError",
        value: `Discover event ${state.searchToken}`,
        frames: [{ filename: "/srv/app/src/discover-advanced.ts", function: "handle", line_no: 21, in_app: true }],
      },
    },
  });
  await sendIngestEvent({
    ingestUrl: state.ingestUrl,
    projectKey: must(state.projectKey, "projectKey"),
    event: {
      type: "transaction",
      message: `GET /discover/${state.unique}`,
      transaction_name: `GET /discover/${state.unique}`,
      duration_ms: 935,
      status: "ok",
      environment: "production",
      release: "2026.03.01",
      user: { id: "u-discover-1" },
      tags: { service: "checkout", "http.method": "GET" },
    },
  });
  await sendIngestEvent({
    ingestUrl: state.ingestUrl,
    projectKey: must(state.projectKey, "projectKey"),
    event: {
      type: "log",
      message: `Discover log ${state.searchToken}`,
      level: "info",
      environment: "production",
      release: "2026.03.01",
      tags: { service: "worker", module: "discover" },
    },
  });

  await waitFor(
    "discover advanced query ready",
    async () => {
      const payload = await apiRequest<any>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: "/discover",
        method: "POST",
        body: {
          workspaceId: must(state.workspaceId, "workspaceId"),
          projectIds: [must(state.projectId, "projectId")],
          dataset: "events",
          timeRange: "24h",
          q: must(state.searchToken, "searchToken"),
          columns: ["environment"],
          groupBy: ["environment"],
          filters: [{ field: "environment", op: "eq", value: "production" }],
          aggregates: [{ op: "count", alias: "count" }],
          sort: [{ key: "count", direction: "desc" }],
          limit: 50,
        },
      });
      return Array.isArray(payload.rows) && payload.rows.length > 0 ? payload : null;
    },
    120_000,
    1_500
  );

  await page.close();
});

test("discover advanced: run query, save view, reload, and load saved query", async ({ page }) => {
  const viewName = `Discover Advanced Saved ${state.unique}`;

  await gotoAuthed(page, "/discover");
  await expect(page.getByTestId("discover-page")).toBeVisible();

  const searchInput = page.getByTestId("discover-search-input");
  await searchInput.fill(must(state.searchToken, "searchToken"));

  const runResponse = page.waitForResponse(
    (response) => response.url().includes("/v1/discover") && response.request().method() === "POST",
    { timeout: 45_000 }
  );
  await page.getByTestId("discover-run-button").click();
  await runResponse;
  await expect(page.getByTestId("discover-row-0")).toBeVisible({ timeout: 30_000 });

  let promptHandled = false;
  let confirmHandled = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt" && !promptHandled) {
      promptHandled = true;
      await dialog.accept(viewName);
      return;
    }
    if (dialog.type() === "confirm" && !confirmHandled) {
      confirmHandled = true;
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });

  await page.getByTestId("saved-view-save-button").click();

  const savedView = await waitFor<SavedView>(
    "discover advanced saved view created",
    async () => {
      const views = await apiRequest<SavedView[]>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: "/saved-views",
        query: {
          workspaceId: must(state.workspaceId, "workspaceId"),
          scope: "discover",
        },
      });
      return views.find((view) => view.name === viewName) ?? null;
    },
    45_000,
    1_000
  );

  await searchInput.fill("");
  await page.getByTestId("discover-run-button").click();
  await page.reload();

  const loadResponse = page.waitForResponse(
    (response) => response.url().includes("/v1/discover") && response.request().method() === "POST",
    { timeout: 45_000 }
  );

  await page.getByTestId("saved-view-load-button").click();
  await page.getByTestId(`saved-view-load-${savedView.id}`).click();
  await loadResponse;

  await expect(searchInput).toHaveValue(must(state.searchToken, "searchToken"));
  await expect(page.getByTestId("discover-row-0")).toBeVisible({ timeout: 30_000 });
});
