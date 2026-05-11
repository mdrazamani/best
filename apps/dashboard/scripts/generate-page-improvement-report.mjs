import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const pagesDir = resolve(ROOT, "src", "pages");
const appPath = resolve(ROOT, "src", "App.tsx");
const reportDir = resolve(ROOT, "docs");
const markdownReportPath = resolve(reportDir, "dashboard-page-improvement-report.md");
const jsonReportPath = resolve(pagesDir, "page-improvement-report.generated.json");

const categoryByPath = [
  { match: /^\/(overview|issues|alerts|event-explorer|logs|performance|sessions|releases|artifacts|deployments|crons|uptime|ping-checks)/, category: "Monitoring" },
  { match: /^\/(projects|workspaces|members|teams|organization|environments|project-settings|api-keys|opentelemetry)/, category: "Workspace" },
  { match: /^\/(trends|discover|rum|trace-explorer|discover-lite|error-frequency|user-impact)/, category: "Analytics" },
  { match: /^\/(billing|payments|plans-usage|integrations|security-scans|settings|profile|support|notifications|onboarding|docs)/, category: "Settings" },
];

const sentryByPageName = {
  IssuesPage: "Issues list and triage views",
  IssueDetailPage: "Issue Details page",
  AlertsPage: "Metric and issue alerts",
  PerformancePage: "Performance and Insights",
  ReleasesPage: "Releases and Health",
  DiscoverPage: "Explore/Discover query builder",
  DiscoverLitePage: "Saved query style discover views",
  LogsPage: "Logs explorer",
  LogDetailPage: "Event payload detail view",
  OverviewPage: "Stats / project overview",
  SessionsPage: "Release health sessions",
  ReplayPlayerPage: "Session replay",
  RUMPage: "Frontend insights",
  TraceExplorerPage: "Trace Explorer",
  BillingPage: "Billing settings",
  OrganizationSsoPage: "Organization SSO settings",
  OrganizationAuditPage: "Security audit",
};

const referenceLinks = [
  "https://docs.sentry.io/product/issues/issue-details/",
  "https://docs.sentry.io/product/stats/",
  "https://docs.sentry.io/product/explore/traces/",
  "https://docs.sentry.io/api/discover/",
  "https://docs.sentry.io/api/releases/",
  "https://www.w3.org/TR/WCAG22/",
];

const sentryStrengthTemplates = {
  IssuesPage: [
    "Fast triage primitives (status tabs, bulk actions, ownership visibility).",
    "Dense but readable issue rows with actionable metadata.",
  ],
  IssueDetailPage: [
    "Strong header-to-graph-to-detail information hierarchy.",
    "Rich sidebar context (first/last seen, activity, linked issues, participants).",
  ],
  DiscoverPage: [
    "Flexible query + aggregate workflow with clear feedback loops.",
    "Saved query patterns that preserve analyst flow.",
  ],
  PerformancePage: [
    "Clear pivot between overview KPIs and drill-down traces/spans.",
    "High-fidelity trend interactions with stable filter state.",
  ],
  ReleasesPage: [
    "Release health and deploy context presented together.",
    "Fast comparison of regressions across versions.",
  ],
  TraceExplorerPage: [
    "Span-centric query and aggregate controls with sortable datasets.",
    "Direct navigation from aggregate row to trace inspection.",
  ],
};

function sentryStrengthsFor(pageName) {
  return (
    sentryStrengthTemplates[pageName] ?? [
      "Consistent page hierarchy with high signal-first summaries.",
      "Actionable system feedback and low-friction drill-down interactions.",
    ]
  );
}

function beforeAfterFor(pageName, metrics) {
  return [
    {
      area: "Information hierarchy",
      before: metrics.hasPageHeader
        ? "Header exists but can drift from card/content hierarchy."
        : "Page-level hierarchy is inconsistent without a shared semantic header.",
      after: "Shared header/actions/content rhythm with predictable scan path and stable landmarks.",
    },
    {
      area: "State handling",
      before: metrics.hasLoadingState
        ? "Loading is present but not uniformly paired with empty/error fallbacks."
        : "Async state transitions are under-specified for first-load and refetch moments.",
      after: "Explicit loading, empty, and error variants with deterministic transitions and next-step CTAs.",
    },
    {
      area: "Accessibility",
      before:
        metrics.ariaCount > 0
          ? "Accessibility semantics are partially implemented."
          : "Interactive controls and structural semantics need stronger accessible naming.",
      after: "WCAG-oriented landmarks, labels, keyboard parity, and visible focus treatment.",
    },
    {
      area: "Code architecture",
      before:
        metrics.lines > 900
          ? "Large route files blend orchestration, transformations, and view logic."
          : "Some render-time logic and concerns remain coupled.",
      after: "Feature-sliced hooks/components with narrower responsibilities and lower regression risk.",
    },
  ];
}

function testMatrixFor(pageName, metrics) {
  return {
    unit: [
      `${pageName}: renders core header and primary content bands with deterministic copy keys.`,
      `${pageName}: maps API/domain models to presentational rows/cards correctly.`,
      `${pageName}: guards invalid params and fallback values without runtime throw.`,
    ],
    integration: [
      `${pageName}: loading -> success transition with preserved user filter/query state.`,
      `${pageName}: empty dataset path exposes clear action and recovery affordance.`,
      `${pageName}: API error path shows retry affordance and prevents stale action execution.`,
      metrics.hasDataTable
        ? `${pageName}: table interactions (sort/select/paginate) remain keyboard-accessible.`
        : `${pageName}: primary interactive controls are keyboard reachable and stateful.`,
    ],
  };
}

function extractRouteMap(appSource) {
  const lazyRegex = /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\.then\(\(module\)\s*=>\s*\(\{\s*default:\s*module\.(\w+)\s*\}\)\)\s*,?\s*\)\s*;/g;
  const routeRegex = /<Route\s+path="([^"]+)"\s+element={<(\w+)/g;

  const localToExport = new Map();
  for (const match of appSource.matchAll(lazyRegex)) {
    localToExport.set(match[1], match[3]);
  }

  const routeMap = new Map();
  for (const match of appSource.matchAll(routeRegex)) {
    const path = match[1];
    const local = match[2];
    const exportName = localToExport.get(local);
    if (!exportName) {
      continue;
    }
    const current = routeMap.get(exportName) ?? [];
    current.push(path);
    routeMap.set(exportName, current);
  }
  return routeMap;
}

function pageCategory(routePaths) {
  for (const path of routePaths) {
    for (const row of categoryByPath) {
      if (row.match.test(path)) {
        return row.category;
      }
    }
  }
  return "General";
}

function severityFromMetrics(metrics) {
  const riskScore =
    (metrics.lines > 1200 ? 4 : metrics.lines > 800 ? 3 : metrics.lines > 500 ? 2 : 1) +
    (metrics.hookCount > 35 ? 3 : metrics.hookCount > 20 ? 2 : metrics.hookCount > 8 ? 1 : 0) +
    (metrics.ariaCount === 0 ? 2 : metrics.ariaCount < 3 ? 1 : 0) +
    (metrics.hasLoadingState ? 0 : 2) +
    (metrics.hasErrorState ? 0 : 2) +
    (metrics.hasEmptyState ? 0 : 1) +
    (metrics.hasPageHeader ? 0 : 2);

  if (riskScore >= 11) return "high";
  if (riskScore >= 7) return "medium";
  return "low";
}

function buildRecommendations(metrics, pageName) {
  const recommendations = {
    uiux: [],
    functional: [],
    performance: [],
    codeQuality: [],
    accessibility: [],
    securityReliability: [],
    testing: [],
  };

  recommendations.uiux.push("Align spacing rhythm to 8/12/16/24 token steps and keep header-actions-content visual hierarchy consistent.");
  recommendations.functional.push("Consolidate state transitions so loading, success, empty, and error flows are mutually exclusive and deterministic.");

  if (!metrics.hasPageHeader) {
    recommendations.uiux.push("Introduce `PageHeader` to unify page-level title, description, and action affordances.");
  }
  if (!metrics.hasWidgetCard) {
    recommendations.uiux.push("Group content in `WidgetCard` sections to improve scanability and progressive disclosure.");
  }
  if (!metrics.hasLoadingState) {
    recommendations.uiux.push("Add explicit loading skeletons for all async blocks to avoid layout jumps.");
  }
  if (!metrics.hasEmptyState) {
    recommendations.uiux.push("Add action-oriented empty states with next-step CTAs.");
  }

  if (metrics.lines > 900) {
    recommendations.functional.push("Split page into route-level shell + feature subcomponents to reduce regression surface.");
    recommendations.codeQuality.push("Extract hooks into `hooks/` with focused contracts (query state, filters, transformations). ");
  }
  if (metrics.hookCount > 20) {
    recommendations.performance.push("Memoize derived collections and move heavy transforms into selectors/hooks to reduce re-renders.");
  }
  if (!metrics.hasErrorState) {
    recommendations.functional.push("Add explicit recoverable error states with retry actions per data source.");
  }

  recommendations.performance.push("Ensure query keys are stable and prefer cache-aware refetch policies for fast back/forward navigation.");
  recommendations.codeQuality.push("Replace inline ad-hoc object creation in render with precomputed constants/hooks where possible.");

  if (metrics.ariaCount === 0) {
    recommendations.accessibility.push("Add semantic landmarks and accessible names for interactive controls.");
  } else {
    recommendations.accessibility.push("Run keyboard-only flow check and validate visible focus style for all actionable controls.");
  }

  recommendations.securityReliability.push("Validate route params and query inputs with defensive parsing before API calls.");
  recommendations.securityReliability.push("Guard mutation actions against duplicate submissions and stale entity identifiers.");

  recommendations.testing.push("Add page-level smoke render with mocked providers and API edge-case fixtures.");
  recommendations.testing.push("Cover success/error/empty states and one key action path in integration tests.");

  return recommendations;
}

function summarize(metrics) {
  const score = Math.max(
    35,
    100 -
      (metrics.lines > 1200 ? 16 : metrics.lines > 800 ? 10 : metrics.lines > 500 ? 6 : 2) -
      (metrics.hookCount > 35 ? 12 : metrics.hookCount > 20 ? 8 : metrics.hookCount > 8 ? 4 : 1) -
      (metrics.ariaCount === 0 ? 10 : metrics.ariaCount < 3 ? 5 : 0) -
      (metrics.hasLoadingState ? 0 : 6) -
      (metrics.hasErrorState ? 0 : 6) -
      (metrics.hasEmptyState ? 0 : 4) -
      (metrics.hasPageHeader ? 0 : 8),
  );

  const target = Math.min(98, score + (score < 65 ? 22 : score < 80 ? 15 : 10));
  return { score, target };
}

function metricsForPage(source) {
  const lines = source.split(/\r?\n/).length;
  const hookCount = (source.match(/\buse(State|Effect|Memo|Callback|Query|Mutation|Ref)\b/g) ?? []).length;
  const ariaCount = (source.match(/aria-[a-z-]+=/g) ?? []).length;
  return {
    lines,
    hookCount,
    ariaCount,
    hasPageHeader: /<PageHeader\b|PageHeader\s/.test(source),
    hasWidgetCard: /<WidgetCard\b/.test(source),
    hasDataTable: /<DataTable\b/.test(source),
    hasLoadingState: /isLoading|loading|Skeleton|variant=\"loading\"/.test(source),
    hasErrorState: /isError|\berror\b|catch\s*\(/i.test(source),
    hasEmptyState: /EmptyState|\bempty\b|no[A-Z]/i.test(source),
  };
}

const appSource = readFileSync(appPath, "utf8");
const routeMap = extractRouteMap(appSource);
const files = readdirSync(pagesDir).filter((file) => file.endsWith("Page.tsx")).sort((a, b) => a.localeCompare(b));

const entries = files.map((file) => {
  const fullPath = resolve(pagesDir, file);
  const source = readFileSync(fullPath, "utf8");
  const pageName = file.replace(/\.tsx$/, "");
  const routes = Array.from(new Set(routeMap.get(pageName) ?? []));
  const metrics = metricsForPage(source);
  const risk = severityFromMetrics(metrics);
  const { score, target } = summarize(metrics);
  const recommendations = buildRecommendations(metrics, pageName);
  const sentryStrengths = sentryStrengthsFor(pageName);
  const beforeAfter = beforeAfterFor(pageName, metrics);
  const testMatrix = testMatrixFor(pageName, metrics);
  return {
    pageName,
    file,
    routes,
    category: pageCategory(routes),
    sentryComparable: sentryByPageName[pageName] ?? "Closest equivalent in Sentry navigation category",
    risk,
    scores: {
      current: score,
      target,
    },
    metrics,
    recommendations,
    sentryComparison: {
      strengths: sentryStrengths,
      upgradeIntent:
        "Adopt Sentry-grade information density while improving readability, accessibility, and action discoverability.",
      beforeAfter,
    },
    testMatrix,
    documentation: {
      improved: "Global primitives now provide stronger accessibility semantics, responsive table behavior, and action grouping consistency.",
      why: "Unified primitives reduce drift and make page-level upgrades predictable across monitoring, analytics, and settings experiences.",
      maintenance: "Keep route contracts, page UX contracts, and this generated matrix in sync by rerunning `npm run audit:pages` after page updates.",
      edgeCases: "Validate no-project, no-workspace, unauthorized, API error, and empty dataset behavior for each route variant.",
    },
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  totalPages: entries.length,
  references: referenceLinks,
  entries,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const markdownParts = [];
markdownParts.push("# Dashboard Page Improvement Report");
markdownParts.push("");
markdownParts.push(`Generated: ${report.generatedAt}`);
markdownParts.push(`Pages audited: ${report.totalPages}`);
markdownParts.push("");
markdownParts.push("## References");
markdownParts.push("");
for (const reference of referenceLinks) {
  markdownParts.push(`- ${reference}`);
}
markdownParts.push("");
markdownParts.push("## Summary");
markdownParts.push("");
markdownParts.push("| Page | Routes | Category | Sentry Comparable | Risk | Current Score | Target Score |");
markdownParts.push("| --- | --- | --- | --- | --- | ---: | ---: |");
for (const entry of entries) {
  markdownParts.push(`| ${entry.pageName} | ${entry.routes.join("<br>") || "-"} | ${entry.category} | ${entry.sentryComparable} | ${entry.risk.toUpperCase()} | ${entry.scores.current} | ${entry.scores.target} |`);
}

for (const entry of entries) {
  markdownParts.push("");
  markdownParts.push(`## ${entry.pageName}`);
  markdownParts.push("");
  markdownParts.push(`- File: \`${entry.file}\``);
  markdownParts.push(`- Routes: ${entry.routes.length ? entry.routes.map((path) => `\`${path}\``).join(", ") : "None"}`);
  markdownParts.push(`- Sentry comparison baseline: ${entry.sentryComparable}`);
  markdownParts.push(`- Sentry strengths to match/exceed: ${entry.sentryComparison.strengths.join(" | ")}`);
  markdownParts.push(`- Before vs after target: ${entry.scores.current} -> ${entry.scores.target}`);
  markdownParts.push(`- Risk: ${entry.risk.toUpperCase()}`);
  markdownParts.push("");
  markdownParts.push("### UI/UX Enhancement");
  for (const item of entry.recommendations.uiux) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Functional Review");
  for (const item of entry.recommendations.functional) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Code Quality");
  for (const item of entry.recommendations.codeQuality) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Performance");
  for (const item of entry.recommendations.performance) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Accessibility");
  for (const item of entry.recommendations.accessibility) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Security & Reliability");
  for (const item of entry.recommendations.securityReliability) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Test Plan");
  for (const item of entry.recommendations.testing) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Sentry Before vs After");
  for (const item of entry.sentryComparison.beforeAfter) {
    markdownParts.push(`- ${item.area} | Before: ${item.before} | After: ${item.after}`);
  }
  markdownParts.push("### Unit Test Matrix");
  for (const item of entry.testMatrix.unit) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Integration Test Matrix");
  for (const item of entry.testMatrix.integration) {
    markdownParts.push(`- ${item}`);
  }
  markdownParts.push("### Documentation");
  markdownParts.push(`- What improved: ${entry.documentation.improved}`);
  markdownParts.push(`- Why improved: ${entry.documentation.why}`);
  markdownParts.push(`- Maintenance: ${entry.documentation.maintenance}`);
  markdownParts.push(`- Edge cases: ${entry.documentation.edgeCases}`);
}

writeFileSync(markdownReportPath, `${markdownParts.join("\n")}\n`, "utf8");
console.log(`Wrote ${jsonReportPath}`);
console.log(`Wrote ${markdownReportPath}`);
