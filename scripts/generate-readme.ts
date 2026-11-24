import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

interface RepoStat {
  repository: string;
  total_contributions?: number;
  commits?: number;
  pull_requests?: number;
  issues?: number;
  reviews?: number;
  is_private?: boolean;
  is_fork?: boolean;
  description?: string;
  has_banner?: boolean;
  primary_language?: {
    name: string;
    color?: string;
  };
}

interface LanguageStat {
  name: string;
  color?: string;
  loc?: number;
  percentage: number;
}

interface MetricSummary {
  lines_of_code: {
    total_additions: number;
    total_deletions: number;
    net_lines: number;
  };
  commits: number;
  pull_requests: {
    total: number;
    merged: number;
    merge_rate_percentage?: number;
  };
  streaks_and_consistency: {
    longest_streak_days: number;
    active_days_count: number;
    activity_rate_percentage: number;
  };
  repositories: {
    total?: number;
    public: number;
    private: number;
    org?: number;
  };
  languages?: LanguageStat[];
  label?: string;
}

interface ReleaseItem {
  repo: string;
  tag_name: string;
  title?: string;
  published_at?: string;
  url?: string;
}

interface YearlyContribution {
  year: number;
  total: number;
  days?: number[];
  weeks?: number[];
}

interface GithubStats {
  metadata?: Record<string, unknown>;
  lines_of_code: {
    total_additions: number;
    total_deletions: number;
    net_lines: number;
  };
  categories?: {
    organization?: {
      commits?: number;
      total_contributions?: number;
    };
    personal?: {
      commits?: number;
      total_contributions?: number;
    };
    external_oss?: {
      total_contributions?: number;
    };
  };
  repositories: {
    total_owned: number;
    public: number;
    private: number;
    forks?: number;
    total_stars?: number;
    total_forks?: number;
  };
  contributions: {
    commits: number;
    pull_requests: number;
    issues: number;
    reviews: number;
    private: number;
    public: number;
    total: number;
  };
  streaks_and_consistency: {
    longest_streak_days: number;
    current_streak_days: number;
    active_days_count: number;
    total_days_in_period: number;
    activity_rate_percentage: number;
  };
  pull_requests: {
    total: number;
    merged: number;
    open: number;
    closed_unmerged: number;
    merge_rate_percentage: number;
  };
  repositories_contributed_to?: RepoStat[];
  languages?: LanguageStat[];
  releases?: ReleaseItem[];
  weekly_summary?: MetricSummary;
  monthly_history?: MetricSummary[];
  yearly_contributions?: YearlyContribution[];
}

const fmt = new Intl.NumberFormat("en-US");

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatBlogDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split(/[-/]/);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[2];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${months[monthIdx]} ${day}, ${year}`;
      }
    } else if (parts[0].length === 4) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${months[monthIdx]} ${day}, ${year}`;
      }
    }
  }
  return dateStr;
}

function formatReleaseDate(isoStr?: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function parseDateToTimestamp(dStr: string): number {
  if (!dStr) return 0;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0]),
      ).getTime();
    } else if (parts[0].length === 4) {
      return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
      ).getTime();
    }
  }
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
}

function getBlogPosts(rootDir: string, limit = 5) {
  const blogDir = path.join(rootDir, "blogs");
  if (!existsSync(blogDir)) return [];

  const files = readdirSync(blogDir).filter((f) => f.endsWith(".md"));
  const posts: {
    title: string;
    slug: string;
    created: string;
    timestamp: number;
  }[] = [];

  for (const file of files) {
    const raw = readFileSync(path.join(blogDir, file), "utf-8");
    const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) continue;

    const fm = frontmatterMatch[1];
    const slugMatch = fm.match(/^slug:\s*(.+)$/m);
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    const createdMatch = fm.match(/^created:\s*(.+)$/m);

    const slug = slugMatch ? slugMatch[1].trim() : file.replace(/\.md$/, "");
    const title = titleMatch ? titleMatch[1].trim() : slug;
    const created = createdMatch ? createdMatch[1].trim() : "";

    posts.push({
      title,
      slug,
      created,
      timestamp: parseDateToTimestamp(created),
    });
  }

  posts.sort((a, b) => b.timestamp - a.timestamp);
  return posts.slice(0, limit);
}

interface WritingEntry {
  title: string;
  url: string;
  dateStr: string;
  timestamp: number;
}

async function fetchPid7Writing(
  fetchImpl: typeof fetch,
): Promise<WritingEntry[]> {
  const sitemapRes = await fetchImpl("https://pid7.com/sitemap.xml", {
    signal: AbortSignal.timeout(5000),
  });
  if (!sitemapRes.ok) {
    throw new Error(`Failed to fetch pid7 sitemap (${sitemapRes.status})`);
  }

  const xml = await sitemapRes.text();
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  const entries = await Promise.all(
    blocks
      .filter((block) => block.includes("/blog/"))
      .map(async (block) => {
        const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
        if (!loc) return null;
        const lastmod =
          block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() || "";

        const pageRes = await fetchImpl(loc, {
          signal: AbortSignal.timeout(5000),
        });
        if (!pageRes.ok) {
          throw new Error(
            `Failed to fetch pid7 post (${pageRes.status}): ${loc}`,
          );
        }
        const html = await pageRes.text();
        const title =
          html
            .match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
            ?.replace(/^pid7\s*[×\-–—|]\s*/i, "")
            .trim() ||
          loc.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ||
          "Untitled";
        const dateStr =
          html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i)?.[1] ||
          html.match(
            /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
          )?.[1] ||
          lastmod;

        return {
          title,
          url: loc,
          dateStr,
          timestamp: parseDateToTimestamp(dateStr),
        };
      }),
  );

  return entries.filter((entry): entry is WritingEntry => entry !== null);
}

const SVG_ICONS: Record<string, string> = {
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>`,
  github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>`,
  activity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>`,
  "git-pull-request": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" /></svg>`,
  "git-commit": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.05" y1="12" x2="22.95" y2="12" /></svg>`,
  zap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>`,
  layers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>`,
};

function formatLocCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function generateLanguagesSvg(languages: LanguageStat[]): string {
  const width = 680;
  const primary = languages[0];
  const totalLoc = languages.reduce((sum, l) => sum + (l.loc || 0), 0);
  const otherLoc = languages.slice(5).reduce((sum, l) => sum + (l.loc || 0), 0);
  const otherPct = totalLoc > 0 ? (otherLoc / totalLoc) * 100 : 0;
  const items = [
    ...languages.slice(0, 5).map((l) => ({ name: l.name, pct: l.percentage })),
    { name: "Other", pct: otherPct },
  ].filter((item) => item.pct > 0);
  const opacities = [1, 0.8, 0.65, 0.5, 0.38, 0.25];
  let x = 0;
  const segments = items
    .map((item, i) => {
      const segWidth =
        i === items.length - 1
          ? width - x
          : Math.round((item.pct / 100) * width);
      const rect = `<rect x="${x}" y="88" width="${segWidth}" height="10" fill="#d7827e" fill-opacity="${opacities[i] || 0.25}" clip-path="url(#bar-clip)" />`;
      x += segWidth;
      return rect;
    })
    .join("\n    ");
  const legend = escapeXml(
    items.map((item) => `${item.name} ${item.pct.toFixed(1)}%`).join(" · "),
  );
  const primaryName = escapeXml(primary?.name || "Rust");
  const primaryPct = primary ? primary.percentage.toFixed(1) : "72.6";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 138" width="${width}" height="138" fill="none">
  <title>language distribution</title>
  <defs>
    <clipPath id="bar-clip">
      <rect x="0" y="88" width="${width}" height="10" rx="5" />
    </clipPath>
  </defs>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text { fill: #575279; }
    .muted { fill: #9893a5; }
  </style>
  <g class="mono">
    <text x="0" y="16" fill="#d7827e" font-size="11" font-weight="700">&gt;</text>
    <text x="14" y="16" class="text" font-size="11" font-weight="700" letter-spacing="0.08em">LANGUAGES</text>
    <text x="0" y="52" fill="#d7827e" font-size="13" font-weight="700">${primaryName} ${primaryPct}%</text>
    <text x="0" y="72" class="muted" font-size="11">${formatLocCompact(totalLoc)} loc · ${languages.length} languages tracked</text>
    <rect x="0" y="88" width="${width}" height="10" rx="5" fill="#dfdad9" />
    ${segments}
    <text x="0" y="120" class="muted" font-size="10">${legend}</text>
  </g>
</svg>`;
}

function generateContributionsSvg(yearlyData: YearlyContribution[]): string {
  const currentYear = new Date().getFullYear();
  const width = 680;
  const height = 216;
  const padLeft = 32;
  const padRight = 36;
  const padTop = 34;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rawMax = Math.max(...yearlyData.map((y) => y.total), 100);
  const step = rawMax > 2000 ? 1000 : rawMax > 1000 ? 500 : 250;
  const yMax = Math.ceil(rawMax / step) * step;

  const gridValues: number[] = [];
  for (let v = step; v <= yMax; v += step) {
    gridValues.push(v);
  }

  const monthTicks = [
    { label: "JAN", day: 0 },
    { label: "FEB", day: 31 },
    { label: "MAR", day: 59 },
    { label: "APR", day: 90 },
    { label: "MAY", day: 120 },
    { label: "JUN", day: 151 },
    { label: "JUL", day: 181 },
    { label: "AUG", day: 212 },
    { label: "SEP", day: 243 },
    { label: "OCT", day: 273 },
    { label: "NOV", day: 304 },
    { label: "DEC", day: 334 },
  ];

  const generateSmoothPath = (points: number[]) => {
    if (!points || points.length === 0) return "";
    const n = points.length;
    const divisor = 365;

    const sampled: Array<{ x: number; y: number }> = [];
    const stride = Math.max(1, Math.floor(n / 60));
    for (let i = 0; i < n; i += stride) {
      sampled.push({
        x: +(padLeft + (i / divisor) * plotW).toFixed(1),
        y: +(padTop + plotH - (points[i] / yMax) * plotH).toFixed(1),
      });
    }
    if (n > 1) {
      sampled.push({
        x: +(padLeft + ((n - 1) / divisor) * plotW).toFixed(1),
        y: +(padTop + plotH - (points[n - 1] / yMax) * plotH).toFixed(1),
      });
    }

    if (sampled.length === 1) return `M ${sampled[0].x} ${sampled[0].y}`;

    let d = `M ${sampled[0].x} ${sampled[0].y}`;
    for (let i = 0; i < sampled.length - 1; i++) {
      const p0 = sampled[i];
      const p1 = sampled[i + 1];
      const dx = p1.x - p0.x;
      const cp1x = +(p0.x + dx * 0.5).toFixed(1);
      const cp2x = +(p0.x + dx * 0.5).toFixed(1);
      d += ` C ${cp1x} ${p0.y}, ${cp2x} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const getYearOpacity = (yr: number) => {
    if (yr === currentYear) return 1.0;
    const years = yearlyData.filter((y) => y.year !== currentYear);
    const idx = years.findIndex((y) => y.year === yr);
    if (idx === -1) return 0.25;
    return +(0.2 + (idx / Math.max(years.length - 1, 1)) * 0.35).toFixed(2);
  };

  const cur = yearlyData.find((y) => y.year === currentYear);
  const curPts = cur?.days || cur?.weeks || [];
  const curPath = curPts.length > 0 ? generateSmoothPath(curPts) : "";
  const curLastIdx = curPts.length - 1;
  const curLastX = +(padLeft + (curLastIdx / 365) * plotW).toFixed(1);
  const curLastY = +(
    padTop +
    plotH -
    (curPts[curLastIdx] / yMax) * plotH
  ).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${height}" width="100%" height="${height}" fill="none">
  <style>
    .mono { font-family: 'JetBrains Mono', monospace, ui-monospace; }
    .accent { fill: #d7827e; font-weight: 600; }
    .accent-stroke { stroke: #d7827e; }
    .accent-fill { fill: #d7827e; }
    .text { fill: #575279; font-weight: 700; }
    .muted { fill: #9893a5; font-weight: 400; }
    .header-line { stroke: #dfdad9; }
    @media (prefers-color-scheme: dark) {
      .accent { fill: #ea9a97; }
      .accent-stroke { stroke: #ea9a97; }
      .accent-fill { fill: #ea9a97; }
      .text { fill: #e0def4; }
      .muted { fill: #6e6a86; }
      .header-line { stroke: #44415a; }
    }
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" letter-spacing="0.06em">CONTRIBUTIONS</text>
    <line x1="120" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />

    <!-- Guidelines -->
    ${gridValues
      .map((val) => {
        const y = +(padTop + plotH - (val / yMax) * plotH).toFixed(1);
        return `<line x1="${padLeft}" y1="${y}" x2="${padLeft + plotW}" y2="${y}" stroke="#dfdad9" stroke-dasharray="2 4" stroke-width="0.75" class="header-line" /><text x="${padLeft - 5}" y="${y + 3}" text-anchor="end" class="muted" font-size="8">${formatCompact(val)}</text>`;
      })
      .join("\n    ")}

    <!-- Base axis -->
    <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#dfdad9" stroke-width="0.75" class="header-line" />

    <!-- Months -->
    ${monthTicks
      .map((m) => {
        const x = +(padLeft + (m.day / 365) * plotW).toFixed(1);
        return `<line x1="${x}" y1="${padTop + plotH}" x2="${x}" y2="${padTop + plotH + 3}" stroke="#dfdad9" stroke-width="0.75" class="header-line" /><text x="${x}" y="${height - 6}" text-anchor="middle" class="muted" font-size="8">${m.label}</text>`;
      })
      .join("\n    ")}

    <!-- Historical curves -->
    ${yearlyData
      .filter((y) => y.year !== currentYear)
      .map((series) => {
        const pts = series.days || series.weeks || [];
        if (pts.length === 0) return "";
        const pathD = generateSmoothPath(pts);
        const opacity = getYearOpacity(series.year);
        const lastIdx = pts.length - 1;
        const lastY = +(padTop + plotH - (pts[lastIdx] / yMax) * plotH).toFixed(
          1,
        );
        const lastX = +(padLeft + plotW).toFixed(1);
        return `<g><path d="${pathD}" fill="none" stroke="#797593" stroke-width="1.15" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" /><text x="${lastX + 5}" y="${lastY + 3}" class="muted" font-size="8.5">&apos;${String(series.year).slice(2)}</text></g>`;
      })
      .join("\n    ")}

    <!-- Current year curve -->
    ${
      curPath
        ? `<g><path d="${curPath}" fill="none" class="accent-stroke" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" /><circle cx="${curLastX}" cy="${curLastY}" r="2.5" class="accent-fill" /><text x="${curLastX + 5}" y="${curLastY - 3}" class="accent" font-size="9" font-weight="600">&apos;${String(currentYear).slice(2)}</text></g>`
        : ""
    }
  </g>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapSvgText(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (line) lines.push(line);

  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visible[maxLines - 1] = `${visible[maxLines - 1]
      .slice(0, maxChars - 1)
      .trimEnd()}…`;
  }
  return visible;
}

async function fetchBannerDataUri(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("image/png")) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function generateReleaseSvg(
  repo: string,
  tag: string,
  date: string,
  description: string,
  bannerDataUri: string,
): string {
  const width = 680;
  const bannerY = 24;
  const bannerH = 227;
  const metaY = bannerY + bannerH + 27;
  const descY = metaY + 22;
  const height = descY + 14;
  const repoText = escapeXml(repo);
  const tagText = escapeXml(tag);
  const dateText = date ? escapeXml(date) : "";
  const metaTail = [tagText, dateText].filter(Boolean).join("  &#183;  ");
  const descText = escapeXml(wrapSvgText(description, 96, 1)[0] || "");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
  <title>${repoText} ${tagText} release</title>
  <defs>
    <clipPath id="banner-clip">
      <rect x="0" y="${bannerY}" width="${width}" height="${bannerH}" rx="6" />
    </clipPath>
  </defs>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text { fill: #575279; }
    .subtle { fill: #797593; }
    .muted { fill: #9893a5; }
    .accent { fill: #d7827e; }
  </style>
  <g class="mono">
    <text x="0" y="14" class="accent" font-size="11" font-weight="700">&gt;</text>
    <text x="14" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.08em">LATEST RELEASE</text>
    <image href="${bannerDataUri}" x="0" y="${bannerY}" width="${width}" height="${bannerH}" clip-path="url(#banner-clip)" preserveAspectRatio="xMidYMid slice" />
    <text x="0" y="${metaY}" font-size="11"><tspan class="text" font-weight="700">${repoText}</tspan>${
      metaTail ? `<tspan class="muted">  &#183;  ${metaTail}</tspan>` : ""
    }</text>
    <text x="0" y="${descY}" class="subtle" font-size="11">${descText}</text>
  </g>
</svg>`;
}

interface ProjectCardData {
  name: string;
  language: string;
  contributions?: number;
  description: string;
}

function generateTopProjectSvg(
  project: ProjectCardData,
  bannerDataUri: string,
): string {
  const width = 680;
  const bannerY = 24;
  const bannerH = 227;
  const metaY = bannerY + bannerH + 27;
  const descY = metaY + 22;
  const height = descY + 14;
  const nameText = escapeXml(project.name);
  const metaText = escapeXml(
    [project.language, `${project.contributions || 0} contribs`].join(" · "),
  );
  const descText = escapeXml(wrapSvgText(project.description, 96, 1)[0] || "");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
  <title>${nameText} top project</title>
  <defs>
    <clipPath id="banner-clip">
      <rect x="0" y="${bannerY}" width="${width}" height="${bannerH}" rx="6" />
    </clipPath>
  </defs>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .subtle { fill: #797593; }
    .muted { fill: #9893a5; }
    .accent { fill: #d7827e; }
  </style>
  <g class="mono">
    <text x="0" y="14" fill="#d7827e" font-size="11" font-weight="700">&gt;</text>
    <text x="14" y="14" fill="#575279" font-size="11" font-weight="700" letter-spacing="0.08em">TOP PROJECT</text>
    <image href="${bannerDataUri}" x="0" y="${bannerY}" width="${width}" height="${bannerH}" clip-path="url(#banner-clip)" preserveAspectRatio="xMidYMid slice" />
    <text x="0" y="${metaY}" font-size="11"><tspan class="accent" font-weight="700">${nameText}</tspan><tspan class="muted">  &#183;  ${metaText}</tspan></text>
    <text x="0" y="${descY}" class="subtle" font-size="11">${descText}</text>
  </g>
</svg>`;
}

function generateWritingHeaderSvg(): string {
  const width = 680;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24" fill="none">
  <title>WRITING</title>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text { fill: #575279; }
  </style>
  <g class="mono">
    <text x="0" y="16" fill="#d7827e" font-size="11" font-weight="700">&gt;</text>
    <text x="14" y="16" class="text" font-size="11" font-weight="700" letter-spacing="0.08em">WRITING</text>
  </g>
</svg>`;
}

function generateWritingSvg(title: string, date: string): string {
  const width = 680;
  const titleText = escapeXml(wrapSvgText(title, 88, 1)[0] || "");
  const dateText = escapeXml(date);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24" fill="none">
  <title>${titleText}</title>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .muted { fill: #9893a5; }
  </style>
  <g class="mono">
    <text x="0" y="16" fill="#d7827e" font-size="12" font-weight="600">${titleText}</text>
    ${
      dateText
        ? `<text x="${width}" y="16" text-anchor="end" class="muted" font-size="11">${dateText}</text>`
        : ""
    }
  </g>
</svg>`;
}

function generateFooterSvg(fontDataUri: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 48" width="680" height="48" fill="none">
  <title>aditya — adii.fyi</title>
  <style>
    @font-face {
      font-family: 'Instrument Serif';
      font-style: italic;
      font-weight: 400;
      src: url("${fontDataUri}") format('woff2');
    }
    .name {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: 30px;
      fill: #d7827e;
    }
    .site {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      fill: #9893a5;
    }
  </style>
  <text x="0" y="34" class="name">aditya</text>
  <text x="680" y="33" text-anchor="end" class="site">adii.fyi</text>
</svg>`;
}

interface TelemetryMetric {
  icon: string;
  label: string;
  value: string;
  detail: string;
}

function inlineIcon(name: string): string {
  return SVG_ICONS[name]
    .replace(/^<svg[^>]*>/, "")
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/<\/svg>$/, "")
    .trim();
}

function generateTelemetrySvg(metrics: TelemetryMetric[]): string {
  const width = 680;
  const firstY = 52;
  const rowH = 48;
  const height = firstY + (metrics.length / 2) * rowH + 12;
  const cells = metrics
    .map((metric, i) => {
      const x = i % 2 === 0 ? 0 : 340;
      const y = firstY + Math.floor(i / 2) * rowH;
      const detail = metric.detail
        ? `<text x="${x + 22}" y="${y + 30}" class="muted" font-size="10">(${escapeXml(metric.detail)})</text>`
        : "";
      return `<g>
      <svg x="${x}" y="${y - 11}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inlineIcon(metric.icon)}</svg>
      <text x="${x + 22}" y="${y}" class="subtle" font-size="10">${escapeXml(metric.label)}</text>
      <text x="${x + 22}" y="${y + 16}" class="text" font-size="12" font-weight="600">${escapeXml(metric.value)}</text>
      ${detail}
    </g>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
  <title>telemetry metrics</title>
  <style>
    .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text { fill: #575279; }
    .subtle { fill: #797593; }
    .muted { fill: #9893a5; }
  </style>
  <g class="mono">
    <text x="0" y="16" fill="#d7827e" font-size="11" font-weight="700">&gt;</text>
    <text x="14" y="16" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">TELEMETRY</text>
    ${cells}
  </g>
</svg>`;
}

export async function generateReadme(
  rootDir: string,
  fetchImpl: typeof fetch = fetch,
  writeAssets = true,
): Promise<string> {
  const statsPath = path.join(rootDir, "data", "github-stats.json");
  if (!existsSync(statsPath)) {
    throw new Error(`Stats file not found at: ${statsPath}`);
  }

  const assetsDir = path.join(rootDir, "assets");
  const iconsDir = path.join(assetsDir, "icons");
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  for (const [name, svg] of Object.entries(SVG_ICONS)) {
    writeFileSync(path.join(iconsDir, `${name}.svg`), svg, "utf-8");
  }

  const fontDataUri = `data:font/woff2;base64,${readFileSync(
    path.join(assetsDir, "fonts", "instrument-serif-latin-400-italic.woff2"),
  ).toString("base64")}`;
  writeFileSync(
    path.join(assetsDir, "footer.svg"),
    generateFooterSvg(fontDataUri),
    "utf-8",
  );

  const stats: GithubStats = JSON.parse(readFileSync(statsPath, "utf-8"));

  const BANNER_REPOS = new Set([
    "pid7-org/turbofox",
    "pid7-org/ashwa",
    "adityamotale/shyena",
    "pid7-org/turbo_crc",
  ]);

  const FALLBACK_DESCRIPTIONS: Record<string, string> = {
    "pid7-org/ashwa":
      "Hardware accelerated routines for single substring search",
    "pid7-org/turbo_crc":
      "Hardware accelerated implementation of CRC32C for computing 32-bit CRC",
  };

  const projects = (stats.repositories_contributed_to || [])
    .filter(
      (r) => !r.is_private && (r.has_banner || BANNER_REPOS.has(r.repository)),
    )
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, 1)
    .map((r) => {
      const [owner, name] = r.repository.split("/");
      const description =
        r.description || FALLBACK_DESCRIPTIONS[r.repository] || "";
      return {
        repo: r.repository,
        owner,
        name: name || r.repository,
        description,
        contributions: r.total_contributions,
        language: r.primary_language?.name || "Rust",
        languageColor: r.primary_language?.color || "#dea584",
        url: `https://github.com/${r.repository}`,
        bannerUrl: `https://raw.githubusercontent.com/${r.repository}/master/assets/banner.png`,
      };
    });

  const blogPosts = getBlogPosts(rootDir, 5);

  const totalAdd = stats.lines_of_code.total_additions;
  const totalDel = stats.lines_of_code.total_deletions;
  const netLines = stats.lines_of_code.net_lines;

  const totalReposContributed = stats.repositories_contributed_to?.length || 0;
  const publicRepos = stats.repositories.public;
  const privateRepos = stats.repositories.private;
  const orgRepos = Math.max(
    0,
    totalReposContributed - (publicRepos + privateRepos),
  );

  const totalCommits =
    stats.repositories_contributed_to?.reduce(
      (sum, r) => sum + (r.commits || 0),
      0,
    ) || stats.contributions.commits;

  const prMergeRate = stats.pull_requests.merge_rate_percentage;

  const orgCommits =
    stats.categories?.organization?.commits ??
    stats.categories?.organization?.total_contributions ??
    2218;
  const personalCommits =
    stats.categories?.personal?.commits ??
    stats.categories?.personal?.total_contributions ??
    1550;
  const totalScope = orgCommits + personalCommits || 1;
  const orgPct = Math.round((orgCommits / totalScope) * 100);
  const personalPct = Math.round((personalCommits / totalScope) * 100);

  const commitsCompact =
    totalCommits >= 1000
      ? formatCompact(totalCommits)
      : totalCommits.toString();
  const activeDaysFormatted =
    stats.streaks_and_consistency.active_days_count?.toLocaleString() ||
    "1,036";

  const yearlyData = stats.yearly_contributions || [];
  if (yearlyData.length > 0) {
    writeFileSync(
      path.join(assetsDir, "contributions.svg"),
      generateContributionsSvg(yearlyData),
      "utf-8",
    );
  }

  const latestRelease = (stats.releases || []).find((rel) => {
    const info = stats.repositories_contributed_to?.find(
      (r) => r.repository === rel.repo,
    );
    return info?.has_banner || BANNER_REPOS.has(rel.repo);
  });
  let latestReleaseBlock = "";
  if (latestRelease) {
    const repoInfo = stats.repositories_contributed_to?.find(
      (r) => r.repository === latestRelease.repo,
    );
    const releaseDesc =
      repoInfo?.description ||
      latestRelease.title ||
      "Latest repository release";
    const formattedReleaseDate = formatReleaseDate(latestRelease.published_at);
    const releaseRepoShort =
      latestRelease.repo.split("/")[1] || latestRelease.repo;
    const releaseBannerUrl = `https://raw.githubusercontent.com/${latestRelease.repo}/master/assets/banner.png`;
    const releaseUrl =
      latestRelease.url ||
      `https://github.com/${latestRelease.repo}/releases/tag/${latestRelease.tag_name}`;

    const bannerDataUri = await fetchBannerDataUri(releaseBannerUrl, fetchImpl);
    if (bannerDataUri) {
      if (writeAssets) {
        writeFileSync(
          path.join(assetsDir, "latest-release.svg"),
          generateReleaseSvg(
            releaseRepoShort,
            latestRelease.tag_name,
            formattedReleaseDate,
            releaseDesc,
            bannerDataUri,
          ),
          "utf-8",
        );
      }

      const cardAlt = escapeXml(
        `${releaseRepoShort} ${latestRelease.tag_name} release`,
      );

      latestReleaseBlock = `<a id="latest-release"></a>

<a href="${releaseUrl}"><img src="./assets/latest-release.svg" width="100%" alt="${cardAlt}" /></a>`;
    }
  }

  let projectsBlock = "";
  if (projects[0]) {
    const project = projects[0];
    const bannerDataUri = await fetchBannerDataUri(
      project.bannerUrl,
      fetchImpl,
    );
    if (bannerDataUri) {
      if (writeAssets) {
        writeFileSync(
          path.join(assetsDir, "top-project.svg"),
          generateTopProjectSvg(project, bannerDataUri),
          "utf-8",
        );
      }
      const alt = escapeXml(`${project.name} top project`);
      projectsBlock = `<a href="${project.url}"><img src="./assets/top-project.svg" width="100%" alt="${alt}" /></a>`;
    }
  }

  const localWriting: WritingEntry[] = blogPosts.map((post) => ({
    title: post.title,
    url: `https://adii.fyi/blog/${post.slug}`,
    dateStr: post.created,
    timestamp: post.timestamp,
  }));
  const externalWriting = await fetchPid7Writing(fetchImpl);
  const writingEntries = [...localWriting, ...externalWriting]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const badges = [
    `[![Website](https://img.shields.io/badge/website-adii.fyi-d7827e?style=flat-square&logo=googlechrome&logoColor=d7827e&labelColor=faf4ed)](https://adii.fyi)`,
    `[![Resume](https://img.shields.io/badge/resume-aditya.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=d7827e&labelColor=faf4ed)](https://adii.fyi/aditya.pdf)`,
    `[![Release](https://img.shields.io/github/v/release/adityamotale/adityamotale?style=flat-square&label=release&logo=github&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/releases)`,
    `[![GitHub](https://img.shields.io/badge/github-adityamotale-d7827e?style=flat-square&logo=github&logoColor=d7827e&labelColor=faf4ed)](https://github.com/adityamotale)`,
    `[![Twitter](https://img.shields.io/badge/twitter-@arctic__byte-d7827e?style=flat-square&logo=x&logoColor=d7827e&labelColor=faf4ed)](https://x.com/arctic_byte)`,
    `[![LinkedIn](https://img.shields.io/badge/linkedin-aditya--motale-d7827e?style=flat-square&logo=linkedin&logoColor=d7827e&labelColor=faf4ed)](https://www.linkedin.com/in/aditya-motale)`,
    `[![Test](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/test.yaml?style=flat-square&label=tests&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/test.yaml)`,
    `[![Activity](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/activity.yaml?style=flat-square&label=activity&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/activity.yaml)`,
    `[![Release Action](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/release.yaml?style=flat-square&label=release%20workflow&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/release.yaml)`,
  ].join(" ");

  const headerBlock = `<a id="top"></a>

${badges}`;

  let writingBlock = "";
  if (writingEntries.length > 0) {
    if (writeAssets) {
      writeFileSync(
        path.join(assetsDir, "writing-header.svg"),
        generateWritingHeaderSvg(),
        "utf-8",
      );
    }
    writingBlock = [
      `<img src="./assets/writing-header.svg" width="100%" alt="Writing" />`,
      ...writingEntries.map((entry, i) => {
        const formattedDate = formatBlogDate(entry.dateStr);
        if (writeAssets) {
          writeFileSync(
            path.join(assetsDir, `writing-${i}.svg`),
            generateWritingSvg(entry.title, formattedDate),
            "utf-8",
          );
        }
        return `<a href="${escapeXml(entry.url)}"><img src="./assets/writing-${i}.svg" width="100%" alt="${escapeXml(entry.title)}" /></a>`;
      }),
    ].join("\n");
  }

  writeFileSync(
    path.join(assetsDir, "telemetry.svg"),
    generateTelemetrySvg([
      {
        icon: "activity",
        label: "Lines of Code",
        value: `${fmt.format(netLines)} net`,
        detail: `+${formatCompact(totalAdd)} / -${formatCompact(totalDel)}`,
      },
      {
        icon: "git-pull-request",
        label: "Pull Requests",
        value: `${prMergeRate}% merged`,
        detail: `${stats.pull_requests.merged} of ${stats.pull_requests.total}`,
      },
      {
        icon: "git-commit",
        label: "Commits",
        value: fmt.format(totalCommits),
        detail: "pub + org",
      },
      {
        icon: "zap",
        label: "Activity & Streaks",
        value: `${activeDaysFormatted}d active`,
        detail: `${stats.streaks_and_consistency.current_streak_days}d current / ${stats.streaks_and_consistency.longest_streak_days}d max`,
      },
      {
        icon: "layers",
        label: "Repositories",
        value: `${totalReposContributed} contributed`,
        detail: `${publicRepos} pub · ${privateRepos} pri · ${orgRepos} org`,
      },
      {
        icon: "globe",
        label: "Scope Distribution",
        value: `${orgPct}% org · ${personalPct}% personal`,
        detail: "",
      },
    ]),
    "utf-8",
  );

  const telemetryBlock = `<a id="telemetry"></a>

<img src="./assets/telemetry.svg" width="100%" alt="telemetry metrics" />

${
  yearlyData.length > 0
    ? `<img src="./assets/contributions.svg" width="100%" alt="Contributions chart" />`
    : ""
}`;

  const allLanguages = stats.languages || [];
  let languagesBlock = "";
  if (allLanguages.length > 0) {
    if (writeAssets) {
      writeFileSync(
        path.join(assetsDir, "languages.svg"),
        generateLanguagesSvg(allLanguages),
        "utf-8",
      );
    }
    languagesBlock = `<img src="./assets/languages.svg" width="100%" alt="language distribution" />`;
  }

  const footerBlock = `<a href="https://adii.fyi"><img src="./assets/footer.svg" width="100%" alt="aditya — adii.fyi" /></a>`;

  const sections = [headerBlock];

  if (latestReleaseBlock) {
    sections.push(latestReleaseBlock);
  }

  sections.push(telemetryBlock);
  if (projectsBlock) {
    sections.push(projectsBlock);
  }
  sections.push(writingBlock);
  if (languagesBlock) {
    sections.push(languagesBlock);
  }
  sections.push(footerBlock);

  return sections.join("\n\n") + "\n";
}

async function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const readmePath = path.join(rootDir, "README.md");

  console.log("🔄 Generating Markdown/HTML README.md and inline icons...");
  const content = await generateReadme(rootDir);
  writeFileSync(readmePath, content, "utf-8");
  console.log("✅ Successfully updated README.md and assets/icons/!");
}

if (process.argv[1] === import.meta.filename) {
  main();
}
