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
  pageUrl?: string;
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
  state.email = `rum-e2e+${state.unique}@errnox.test`;
  state.pageUrl = `https://shop.example.test/checkout/${state.unique}`;

  const page = await browser.newPage();
  await page.goto(`${state.baseUrl}/login?next=%2Frum`);
  await page.locator('input[type="email"]').fill(state.email);
  await page.locator('form button[type="submit"]').click();

  const otp = await waitForOtpCodeFromLog(state.apiLogPath, 60_000);
  await page.locator('input[inputmode="numeric"]').fill(otp);
  await page.locator('form button[type="submit"]').click();
  await waitForUrl(page, /\/(onboarding|rum|overview|workspaces)/, 60_000);

  state.session = await readDashboardSession(page);

  const workspace = await apiRequest<Workspace>({
    baseUrl: state.apiBaseUrl,
    token: state.session.token,
    path: "/workspaces",
    method: "POST",
    body: {
      name: `RUM Workspace ${state.unique}`,
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
      name: `RUM Project ${state.unique}`,
      slug: `rum-${state.unique}`,
      platform: "node",
      environmentDefault: "production",
      status: "active",
    },
  });
  state.projectId = project.id;
  state.projectKey = project.apiKey ?? project.api_key ?? undefined;

  const events = [
    { metric: "lcp", value: 2450.4, rating: "poor" },
    { metric: "lcp", value: 1980.1, rating: "needs-improvement" },
    { metric: "inp", value: 380.2, rating: "poor" },
    { metric: "fcp", value: 1210.8, rating: "good" },
    { metric: "ttfb", value: 420.7, rating: "needs-improvement" },
    { metric: "cls", value: 0.19, rating: "needs-improvement" },
  ];

  for (const [index, sample] of events.entries()) {
    await sendIngestEvent({
      ingestUrl: state.ingestUrl,
      projectKey: must(state.projectKey, "projectKey"),
      event: {
        type: "rum",
        message: `web-vital-${sample.metric}-${index}`,
        level: "info",
        environment: "production",
        release: "2026.03.01",
        tags: {
          metric_name: sample.metric,
          value: String(sample.value),
          rating: sample.rating,
          page_url: `${must(state.pageUrl, "pageUrl")}?token=secret-${index}`,
          user_agent: "playwright-e2e",
          viewport: "1440x900",
          navigation_type: "navigate",
          browser: "chrome",
        },
      },
    });
  }

  await waitFor(
    "rum overview ready",
    async () => {
      const payload = await apiRequest<any>({
        baseUrl: state.apiBaseUrl,
        token: must(state.session, "session").token,
        path: "/rum/overview",
        query: {
          workspaceId: must(state.workspaceId, "workspaceId"),
          projectIds: must(state.projectId, "projectId"),
          timeRange: "24h",
        },
      });
      return Array.isArray(payload.rows) && payload.rows.length > 0 ? payload : null;
    },
    120_000,
    1_500
  );

  await page.close();
});

test("browser rum: render charts and slow pages from ingested vitals", async ({ page }) => {
  await gotoAuthed(page, "/rum");
  await expect(page.getByTestId("rum-page")).toBeVisible();

  await page.getByTestId("rum-filter-page-prefix").fill("https://shop.example.test/checkout");

  const pagesResponse = page.waitForResponse(
    (response) => response.url().includes("/v1/rum/pages") && response.request().method() === "GET",
    { timeout: 45_000 }
  );
  await page.getByTestId("rum-run-button").click();
  await pagesResponse;

  await expect(page.getByText(must(state.pageUrl, "pageUrl"))).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("chrome")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("?token=secret-0")).toHaveCount(0);
});
