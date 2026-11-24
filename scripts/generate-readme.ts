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

const SVG_ICONS: Record<string, string> = {
  github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#d7827e"><style>@media (prefers-color-scheme: dark) { * { fill: #ea9a97 !important; } }</style><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>`,
  "file-text": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>`,
  rss: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" fill="#d7827e" /></svg>`,
  "external-link": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>`,
  "book-open": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d7827e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><style>@media (prefers-color-scheme: dark) { * { stroke: #ea9a97 !important; } }</style><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>`,
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

function generateLanguageAsciiChart(languages?: LanguageStat[]): string {
  if (!languages || languages.length === 0) return "";
  const top = languages.slice(0, 5);
  const otherLangs = languages.slice(5);
  const otherLoc = otherLangs.reduce((sum, l) => sum + (l.loc || 0), 0);
  const totalLoc = languages.reduce((sum, l) => sum + (l.loc || 0), 0);
  const otherPct = totalLoc > 0 ? (otherLoc / totalLoc) * 100 : 0;

  const items = [
    ...top.map((l) => ({ name: l.name, pct: l.percentage, loc: l.loc || 0 })),
  ];
  if (otherLoc > 0 || otherPct > 0) {
    items.push({ name: "Other", pct: otherPct, loc: otherLoc });
  }

  const barWidth = 36;
  const lines: string[] = [];

  for (const item of items) {
    const filled = Math.max(
      item.pct > 0 ? 1 : 0,
      Math.round((item.pct / 100) * barWidth),
    );
    const empty = Math.max(0, barWidth - filled);
    const bar = "█".repeat(filled) + " ".repeat(empty);
    const name = item.name.padEnd(12, " ");
    const pctStr = `${item.pct.toFixed(1).padStart(5, " ")}%`;
    const locStr = `${formatLocCompact(item.loc)} loc`.padStart(10, " ");
    lines.push(`${name} [${bar}] ${pctStr}  ${locStr}`);
  }

  return lines.join("\n");
}

function generateContributionsSvg(yearlyData: YearlyContribution[]): string {
  const currentYear = new Date().getFullYear();
  const width = 680;
  const height = 230;
  const padLeft = 32;
  const padRight = 36;
  const padTop = 48;
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
    <text x="12" y="30" class="muted" font-size="11">// yearly activity · annual velocity &amp; cumulative</text>

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
): Promise<string> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch release banner (${response.status}): ${url}`,
    );
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) {
    throw new Error(`Unexpected release banner content type: ${contentType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:image/png;base64,${bytes.toString("base64")}`;
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

function generateWordmarkSvg(fontDataUri: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 112" width="320" height="112" fill="none">
  <title>aditya</title>
  <style>
    @font-face {
      font-family: 'Instrument Serif';
      font-style: italic;
      font-weight: 400;
      src: url("${fontDataUri}") format('woff2');
    }
    text {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: 98px;
      fill: #d7827e;
    }
  </style>
  <text x="8" y="82">aditya</text>
</svg>`;
}

export async function generateReadme(
  rootDir: string,
  fetchImpl: typeof fetch = fetch,
  writeReleaseAsset = true,
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
    path.join(assetsDir, "header.svg"),
    generateWordmarkSvg(fontDataUri),
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
    .slice(0, 4)
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

  const rustLang = (stats.languages || []).find((l) => l.name === "Rust");
  const rustPct = rustLang ? rustLang.percentage.toFixed(0) : "68";
  const rustLocFormatted = rustLang ? formatCompact(rustLang.loc || 0) : "1.2M";
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

  const latestRelease = stats.releases?.[0];
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
    if (writeReleaseAsset) {
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

  const projectGridRows: string[] = [];
  for (let i = 0; i < projects.length; i += 2) {
    const p1 = projects[i];
    const p2 = projects[i + 1];
    const cell1 = `    <td width="50%" valign="top">
      <a href="${p1.url}"><img src="${p1.bannerUrl}" width="100%" alt="${p1.name}" /></a>
      <br />
      <b><a href="${p1.url}">${p1.name}</a></b> &#183; <code>${p1.language}</code> &#183; <sub>${p1.contributions} contribs</sub><br />
      ${p1.description}
    </td>`;
    const cell2 = p2
      ? `    <td width="50%" valign="top">
      <a href="${p2.url}"><img src="${p2.bannerUrl}" width="100%" alt="${p2.name}" /></a>
      <br />
      <b><a href="${p2.url}">${p2.name}</a></b> &#183; <code>${p2.language}</code> &#183; <sub>${p2.contributions} contribs</sub><br />
      ${p2.description}
    </td>`
      : `    <td width="50%" valign="top"></td>`;

    projectGridRows.push(`  <tr>\n${cell1}\n${cell2}\n  </tr>`);
  }

  const projectTable = [
    `<table width="100%">`,
    ...projectGridRows,
    `</table>`,
  ].join("\n");

  const writingItems = blogPosts
    .map(
      (post) =>
        `- <img src="./assets/icons/book-open.svg" width="14" height="14" align="absmiddle" /> [**${post.title}**](https://adii.fyi/blogs/${post.slug}) &mdash; <sub>${formatBlogDate(post.created)}</sub>`,
    )
    .join("\n");

  const badges = [
    `[![Website](https://img.shields.io/badge/website-adii.fyi-d7827e?style=flat-square&logo=googlechrome&logoColor=d7827e&labelColor=faf4ed)](https://adii.fyi)`,
    `[![Resume](https://img.shields.io/badge/resume-adityamotale.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=d7827e&labelColor=faf4ed)](https://adii.fyi/adityamotale.pdf)`,
    `[![Release](https://img.shields.io/github/v/release/adityamotale/adityamotale?style=flat-square&label=release&logo=github&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/releases)`,
    `[![GitHub](https://img.shields.io/badge/github-adityamotale-d7827e?style=flat-square&logo=github&logoColor=d7827e&labelColor=faf4ed)](https://github.com/adityamotale)`,
    `[![Twitter](https://img.shields.io/badge/twitter-@arctic__byte-d7827e?style=flat-square&logo=x&logoColor=d7827e&labelColor=faf4ed)](https://x.com/arctic_byte)`,
    `[![LinkedIn](https://img.shields.io/badge/linkedin-aditya--motale-d7827e?style=flat-square&logo=linkedin&logoColor=d7827e&labelColor=faf4ed)](https://www.linkedin.com/in/aditya-motale)`,
    `[![Test](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/test.yaml?style=flat-square&label=tests&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/test.yaml)`,
    `[![Activity](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/activity.yaml?style=flat-square&label=activity&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/activity.yaml)`,
    `[![Release Action](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/release.yaml?style=flat-square&label=release%20workflow&logo=githubactions&logoColor=d7827e&labelColor=faf4ed&color=d7827e)](https://github.com/adityamotale/adityamotale/actions/workflows/release.yaml)`,
  ].join(" ");

  const headerBlock = `<a id="top"></a>

${badges}

<img src="./assets/header.svg" width="320" height="112" alt="aditya" />`;

  const projectsBlock = `## <a id="projects"></a>~ PROJECTS

${projectTable}`;

  const writingBlock = `## <a id="writing"></a>~ WRITING

${writingItems}

<p>
  <img src="./assets/icons/external-link.svg" width="12" height="12" align="absmiddle" /> <sub><a href="https://adii.fyi/blog">view all posts &rarr;</a></sub>
</p>`;

  const telemetryBlock = `## <a id="telemetry"></a>~ TELEMETRY

<table width="100%">
  <tr>
    <td width="50%">
      <img src="./assets/icons/activity.svg" width="14" height="14" align="absmiddle" /> <b>Lines of Code</b><br />
      <code>${fmt.format(netLines)} net</code> <sub>(+${formatCompact(totalAdd)} / -${formatCompact(totalDel)})</sub>
    </td>
    <td width="50%">
      <img src="./assets/icons/git-pull-request.svg" width="14" height="14" align="absmiddle" /> <b>Pull Requests</b><br />
      <code>${prMergeRate}% merged</code> <sub>(${stats.pull_requests.merged} of ${stats.pull_requests.total})</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./assets/icons/git-commit.svg" width="14" height="14" align="absmiddle" /> <b>Commits</b><br />
      <code>${fmt.format(totalCommits)}</code> <sub>(pub + org)</sub>
    </td>
    <td width="50%">
      <img src="./assets/icons/zap.svg" width="14" height="14" align="absmiddle" /> <b>Activity & Streaks</b><br />
      <code>${activeDaysFormatted}d active</code> <sub>(${stats.streaks_and_consistency.current_streak_days}d current / ${stats.streaks_and_consistency.longest_streak_days}d max)</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./assets/icons/layers.svg" width="14" height="14" align="absmiddle" /> <b>Repositories</b><br />
      <code>${totalReposContributed} contributed</code> <sub>(${publicRepos} pub &#183; ${privateRepos} pri &#183; ${orgRepos} org)</sub>
    </td>
    <td width="50%">
      <img src="./assets/icons/globe.svg" width="14" height="14" align="absmiddle" /> <b>Scope Distribution</b><br />
      <code>${orgPct}% org &#183; ${personalPct}% personal</code>
    </td>
  </tr>
</table>

${yearlyData.length > 0 ? `<img src="./assets/contributions.svg" width="100%" alt="Contributions chart" />` : ""}`;

  const totalTrackedLoc = (stats.languages || []).reduce(
    (sum, l) => sum + (l.loc || 0),
    0,
  );
  const totalTrackedLangs = stats.languages?.length || 0;
  const primaryLang = stats.languages?.[0];
  const primaryLangName = primaryLang?.name || "Rust";
  const primaryLangPct = primaryLang
    ? primaryLang.percentage.toFixed(1)
    : "72.6";
  const primaryLangLoc = primaryLang
    ? formatLocCompact(primaryLang.loc || 0)
    : "1.16M";

  const languageAsciiChart = generateLanguageAsciiChart(stats.languages);
  const languagesBlock = `## <a id="languages"></a>~ LANGUAGES

<table width="100%">
  <tr>
    <td width="50%">
      <img src="./assets/icons/code.svg" width="14" height="14" align="absmiddle" /> <b>Primary Language</b><br />
      <code>${primaryLangName} ${primaryLangPct}%</code> <sub>(${primaryLangLoc} loc)</sub>
    </td>
    <td width="50%">
      <img src="./assets/icons/layers.svg" width="14" height="14" align="absmiddle" /> <b>Codebase Volume</b><br />
      <code>${formatLocCompact(totalTrackedLoc)} loc</code> <sub>(${totalTrackedLangs} languages tracked)</sub>
    </td>
  </tr>
</table>

\`\`\`text
${languageAsciiChart}
\`\`\``;

  const footerBlock = `---

<p align="center">
  <a href="https://adii.fyi"><b>aditya</b></a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/github.svg" width="13" height="13" align="absmiddle" /> <a href="https://github.com/adityamotale">github</a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/twitter.svg" width="13" height="13" align="absmiddle" /> <a href="https://x.com/arctic_byte">twitter</a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/linkedin.svg" width="13" height="13" align="absmiddle" /> <a href="https://www.linkedin.com/in/aditya-motale">linkedin</a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/file-text.svg" width="13" height="13" align="absmiddle" /> <a href="https://adii.fyi/adityamotale.pdf">resume</a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/globe.svg" width="13" height="13" align="absmiddle" /> <a href="https://adii.fyi">website</a> &nbsp;&#183;&nbsp;
  <img src="./assets/icons/rss.svg" width="13" height="13" align="absmiddle" /> <a href="https://adii.fyi/rss.xml">rss</a> &nbsp;&#183;&nbsp;
  <a href="#top"><code>[eof]</code></a>
</p>`;

  const sections = [headerBlock];

  if (latestReleaseBlock) {
    sections.push(latestReleaseBlock);
  }

  sections.push(projectsBlock);
  sections.push(writingBlock);
  sections.push(telemetryBlock);
  sections.push(languagesBlock);
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
