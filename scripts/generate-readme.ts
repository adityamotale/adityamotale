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

interface GithubStats {
  metadata?: Record<string, unknown>;
  lines_of_code: {
    total_additions: number;
    total_deletions: number;
    net_lines: number;
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
  weekly_summary?: MetricSummary;
  monthly_history?: MetricSummary[];
}

const fmt = new Intl.NumberFormat("en-US");

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

const BAR_LENGTH = 16;
const FILLED_GLYPH = "#";
const EMPTY_GLYPH = ".";

function getAsciiBar(pct: number, len = BAR_LENGTH) {
  const safePct = Math.max(0, Math.min(100, pct));
  const filled = Math.min(len, Math.floor((safePct / 100) * len));
  const empty = len - filled;
  return {
    filled: FILLED_GLYPH.repeat(filled),
    empty: EMPTY_GLYPH.repeat(empty),
    bar: `[${FILLED_GLYPH.repeat(filled)}${EMPTY_GLYPH.repeat(empty)}]`,
    pctFormatted: `${safePct.toFixed(1)}%`,
  };
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const SVG_STYLE = `
  .mono {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }
  .accent { fill: #d7827e; font-weight: 600; }
  .text { fill: #575279; font-weight: 500; }
  .subtle { fill: #797593; font-weight: 400; }
  .muted { fill: #9893a5; font-weight: 400; }
  .pine { fill: #286983; font-weight: 700; }
  .foam { fill: #56949f; font-weight: 700; }
  .gold { fill: #ea9d34; font-weight: 700; }
  .love { fill: #b4637a; font-weight: 700; }
  .bar-empty { fill: #dfdad9; }
  .header-line { stroke: #dfdad9; }

  @media (prefers-color-scheme: dark) {
    .accent { fill: #ea9a97; }
    .text { fill: #e0def4; }
    .subtle { fill: #908caa; }
    .muted { fill: #6e6a86; }
    .pine { fill: #3e8fb0; }
    .foam { fill: #9ccfd8; }
    .gold { fill: #f6c177; }
    .love { fill: #eb6f92; }
    .bar-empty { fill: #44415a; }
    .header-line { stroke: #44415a; }
  }
`;

function generateBadgeSvg(text: string, dotColor?: string): string {
  const charWidth = 6.8;
  const padding = 20;
  const hasDot = Boolean(dotColor);
  const dotExtra = hasDot ? 12 : 0;
  const width = Math.max(
    50,
    Math.round(padding + text.length * charWidth + dotExtra),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 22" width="${width}" height="22" fill="none">
  <style>
    .badge-bg { fill: #fffaf3; stroke: #dfdad9; stroke-width: 1; }
    .badge-text { fill: #797593; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 500; }
    @media (prefers-color-scheme: dark) {
      .badge-bg { fill: #2a273f; stroke: #44415a; }
      .badge-text { fill: #908caa; }
    }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="21" rx="10.5" class="badge-bg" />
  ${hasDot ? `<circle cx="12" cy="11" r="3" fill="${dotColor}" />` : ""}
  <text x="${hasDot ? (width + 12) / 2 : width / 2}" y="14.5" text-anchor="middle" class="badge-text">${escapeXml(text)}</text>
</svg>`;
}

function generateHeaderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 75" width="100%" height="75" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono">
    <text x="0" y="18" class="accent" font-size="12.5" font-weight="600" xml:space="preserve">▄▀█ █▀▄ █ ▀█▀ █▄█ ▄▀█   █▀▄▀█ █▀█ ▀█▀ ▄▀█ █   █▀▀</text>
    <text x="0" y="34" class="accent" font-size="12.5" font-weight="600" xml:space="preserve">█▀█ █▄▀ █  █   █  █▀█   █ ▀ █ █▄█  █  █▀█ █▄▄ ██▄</text>
    <text x="0" y="60" class="subtle" font-size="11.5">hello, my name is Aditya — an engineer by choice</text>
  </g>
</svg>`;
}

function generateAboutSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 95" width="100%" height="95" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">ABOUT</text>
    <line x1="65" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />

    <text x="0" y="36" class="subtle">Engineer by choice. Passionate about systems programming, database architecture,</text>
    <text x="0" y="54" class="subtle">and low-latency design. I learn fast, love hand-crafting reliable codebases,</text>
    <text x="0" y="72" class="subtle">and obsess over micro-optimizations. Right now, I&apos;m building embedded storage</text>
    <text x="0" y="90" class="subtle">engines and speeding up mundane routines using SIMD.</text>
  </g>
</svg>`;
}

function generateProjectsHeaderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 24" width="100%" height="24" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">PROJECTS</text>
    <line x1="85" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
  </g>
</svg>`;
}

function generateProjectRowSvg(name: string, description: string): string {
  const namePad = name.padEnd(14, " ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 20" width="100%" height="20" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14">
      <tspan class="text" font-weight="600">${escapeXml(namePad)}</tspan> <tspan class="muted">—</tspan> <tspan class="subtle">${escapeXml(description)}</tspan>
    </text>
  </g>
</svg>`;
}

function generateWritingHeaderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 24" width="100%" height="24" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">WRITING</text>
    <line x1="75" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
  </g>
</svg>`;
}

function generateWritingRowSvg(title: string, dateStr: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 20" width="100%" height="20" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14">
      <tspan class="text" font-weight="600">${escapeXml(title)}</tspan>
    </text>
    <text x="680" y="14" text-anchor="end" class="muted">
      ${escapeXml(formatBlogDate(dateStr))}
    </text>
  </g>
</svg>`;
}

function generateEducationSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 95" width="100%" height="95" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">EDUCATION</text>
    <line x1="92" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />

    <!-- Row 1 -->
    <text x="0" y="38">
      <tspan class="subtle">degree:</tspan>  <tspan class="text" font-weight="600">B.Tech</tspan> <tspan class="muted">(CSE)</tspan>
    </text>
    <text x="340" y="38">
      <tspan class="subtle">period:</tspan>  <tspan class="text" font-weight="600">Jun 2020 – Jun 2024</tspan> <tspan class="muted">(4 yrs)</tspan>
    </text>

    <!-- Row 2 -->
    <text x="0" y="58">
      <tspan class="subtle">major:</tspan>   <tspan class="text" font-weight="600">Computer Science &amp; Engineering</tspan>
    </text>
    <text x="340" y="58">
      <tspan class="subtle">status:</tspan>  <tspan class="text" font-weight="600">Graduated</tspan>
    </text>

    <!-- Row 3 -->
    <text x="0" y="78">
      <tspan class="subtle">inst:</tspan>    <tspan class="text" font-weight="600">Marathwada Inst. of Technology</tspan>
    </text>
    <text x="340" y="78">
      <tspan class="subtle">place:</tspan>   <tspan class="text" font-weight="600">CPSN, Maharashtra, Bharat</tspan>
    </text>
  </g>
</svg>`;
}

function generateExperienceSvg(pid7Repos: { name: string }[]): string {
  const repoNames = pid7Repos.map((r) => r.name).join(" · ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 255" width="100%" height="255" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">EXPERIENCE</text>
    <line x1="102" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />

    <!-- 1. OSS Contributions -->
    <text x="0" y="38" class="text" font-weight="600">[ OSS Contributions ]</text>
    <text x="680" y="38" text-anchor="end" class="muted">Sep 2024 — Present</text>
    <text x="0" y="56">
      <tspan class="subtle">  role:</tspan>   <tspan class="text" font-weight="600">Core Maintainer &amp; Systems Developer</tspan>
    </text>
    <text x="0" y="74">
      <tspan class="subtle">  repos:</tspan>  <tspan class="text" font-weight="600">${escapeXml(repoNames)}</tspan>
    </text>
    <text x="0" y="92">
      <tspan class="subtle">  stack:</tspan>  <tspan class="text">Rust · SIMD · Embedded Storage · Systems Programming</tspan>
    </text>
    <text x="0" y="110">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Building hardware-accelerated algorithms, embedded KV stores &amp; storage engines</tspan>
    </text>

    <!-- 2. Freelance -->
    <text x="0" y="136" class="text" font-weight="600">[ Freelance &amp; Contract · Web &amp; Tooling ]</text>
    <text x="680" y="136" text-anchor="end" class="muted">Jul 2024 — Present</text>
    <text x="0" y="154">
      <tspan class="subtle">  role:</tspan>   <tspan class="text" font-weight="600">Web &amp; Tooling Developer</tspan> <tspan class="muted">(Multiple Clients)</tspan>
    </text>
    <text x="0" y="172">
      <tspan class="subtle">  stack:</tspan>  <tspan class="text">Astro · React · TypeScript · Microservices · VS Code API</tspan>
    </text>
    <text x="0" y="190">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Shipped startup landing pages, SMTP microservices &amp; event ticket booking</tspan>
    </text>

    <!-- 3. Internships -->
    <text x="0" y="216" class="text" font-weight="600">[ Internships · Mobile Engineering ]</text>
    <text x="680" y="216" text-anchor="end" class="muted">Nov 2021 — Apr 2024 (9 mos total)</text>
    <text x="0" y="234">
      <tspan class="subtle">  orgs:</tspan>   <tspan class="text">kraftbase (1 mo) · Rojgary (5 mos) · FOLKDevelopers (3 mos)</tspan>
    </text>
    <text x="0" y="252">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Built MVP mobile apps for clients from scratch, refactored &amp; enhanced reliability</tspan>
    </text>
  </g>
</svg>`;
}

function generateTelemetrySvg(
  title: string,
  netLoc: string,
  additions: string,
  deletions: string,
  churnBar: { filled: string; empty: string; pctFormatted: string },
  reposTotal: number | string,
  reposDetail: string,
  commits: string,
  prBar: { filled: string; empty: string },
  prValue: string,
  activeBar: { filled: string; empty: string; pctFormatted: string },
  streakDays: number | string,
  activeDays: number | string,
  stack: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 120" width="100%" height="120" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <!-- Header -->
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-size="11" font-weight="700" letter-spacing="0.06em">${escapeXml(title.toUpperCase())}</text>
    <line x1="${24 + title.length * 7.5}" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />

    <!-- Row 1 -->
    <text x="0" y="38">
      <tspan class="muted">&amp;</tspan> <tspan class="subtle">loc:</tspan>     <tspan class="text" font-weight="600">${escapeXml(netLoc)}</tspan> <tspan class="muted text-xs">(+${escapeXml(additions)} / -${escapeXml(deletions)})</tspan>
    </text>
    <text x="340" y="38">
      <tspan class="muted">+</tspan> <tspan class="subtle">prs:</tspan>     <tspan class="muted">[</tspan><tspan class="foam">${escapeXml(prBar.filled)}</tspan><tspan class="bar-empty">${escapeXml(prBar.empty)}</tspan><tspan class="muted">]</tspan> <tspan class="text" font-weight="600">${escapeXml(prValue)}</tspan>
    </text>

    <!-- Row 2 -->
    <text x="0" y="58">
      <tspan class="muted">%</tspan> <tspan class="subtle">churn:</tspan>   <tspan class="muted">[</tspan><tspan class="pine">${escapeXml(churnBar.filled)}</tspan><tspan class="bar-empty">${escapeXml(churnBar.empty)}</tspan><tspan class="muted">]</tspan> <tspan class="text" font-weight="600">${escapeXml(churnBar.pctFormatted)}</tspan>
    </text>
    <text x="340" y="58">
      <tspan class="muted">@</tspan> <tspan class="subtle">active:</tspan>  <tspan class="muted">[</tspan><tspan class="gold">${escapeXml(activeBar.filled)}</tspan><tspan class="bar-empty">${escapeXml(activeBar.empty)}</tspan><tspan class="muted">]</tspan> <tspan class="text" font-weight="600">${escapeXml(activeBar.pctFormatted)}</tspan>
    </text>

    <!-- Row 3 -->
    <text x="0" y="78">
      <tspan class="muted">#</tspan> <tspan class="subtle">repos:</tspan>   <tspan class="text" font-weight="600">${escapeXml(String(reposTotal))}</tspan> <tspan class="muted text-xs">(${escapeXml(reposDetail)})</tspan>
    </text>
    <text x="340" y="78">
      <tspan class="muted">^</tspan> <tspan class="subtle">streak:</tspan>  <tspan class="text" font-weight="600">${escapeXml(String(streakDays))} days</tspan> <tspan class="muted text-xs">(${escapeXml(String(activeDays))} active)</tspan>
    </text>

    <!-- Row 4 -->
    <text x="0" y="98">
      <tspan class="muted">*</tspan> <tspan class="subtle">commits:</tspan> <tspan class="text" font-weight="600">${escapeXml(commits)}</tspan>
    </text>
    <text x="340" y="98">
      <tspan class="muted">$</tspan> <tspan class="subtle">stack:</tspan>   <tspan class="text" font-weight="600">${escapeXml(stack)}</tspan>
    </text>
  </g>
</svg>`;
}

export function generateReadme(rootDir: string): string {
  const statsPath = path.join(rootDir, "data", "github-stats.json");
  if (!existsSync(statsPath)) {
    throw new Error(`Stats file not found at: ${statsPath}`);
  }

  const assetsDir = path.join(rootDir, "assets");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const stats: GithubStats = JSON.parse(readFileSync(statsPath, "utf-8"));

  // Get current release version from website/package.json
  const websitePkgPath = path.join(rootDir, "website", "package.json");
  const websitePkg = existsSync(websitePkgPath)
    ? JSON.parse(readFileSync(websitePkgPath, "utf-8"))
    : { version: "0.2.0" };
  const releaseTag = `v${websitePkg.version || "0.2.0"}`;

  // 1. Projects
  const projects = (stats.repositories_contributed_to || [])
    .filter(
      (r) =>
        !r.is_private &&
        !r.is_fork &&
        !r.repository.endsWith("/website") &&
        Boolean(r.description),
    )
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.repository.split("/")[1] || r.repository,
      url: `https://github.com/${r.repository}`,
      description: r.description || "",
    }));

  // 2. Writing
  const blogPosts = getBlogPosts(rootDir, 5);

  // 3. Experience pid7 repos
  const pid7Repos = (stats.repositories_contributed_to || [])
    .filter((r) => r.repository.startsWith("pid7-org/"))
    .filter((r) => (r.total_contributions || 0) >= 100)
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.repository.replace(/^pid7-org\//, ""),
      url: `https://github.com/${r.repository}`,
    }));

  // 4. Telemetry (All Time)
  const totalAdd = stats.lines_of_code.total_additions;
  const totalDel = stats.lines_of_code.total_deletions;
  const netLines = stats.lines_of_code.net_lines;
  const totalChurn = totalAdd + totalDel;
  const churnRatio = totalChurn > 0 ? (totalAdd / totalChurn) * 100 : 0;
  const churnBar = getAsciiBar(churnRatio, 16);

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
  const prBar = getAsciiBar(prMergeRate, 16);

  const activeRate = stats.streaks_and_consistency.activity_rate_percentage;
  const streakBar = getAsciiBar(activeRate, 16);

  const topLanguages =
    (stats.languages || [])
      .slice(0, 3)
      .map((l) => `${l.name} ${Math.round(l.percentage)}%`)
      .join(" · ") || "--";

  // 5. Generate Rosé Pine Dawn Custom Badge SVGs
  writeFileSync(
    path.join(assetsDir, "badge-website.svg"),
    generateBadgeSvg("adii.fyi"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-resume.svg"),
    generateBadgeSvg("resume", "#d7827e"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-release.svg"),
    generateBadgeSvg(releaseTag, "#ea9d34"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-github.svg"),
    generateBadgeSvg("github"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-twitter.svg"),
    generateBadgeSvg("twitter"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-linkedin.svg"),
    generateBadgeSvg("linkedin"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-tests.svg"),
    generateBadgeSvg("tests", "#56949f"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-activity.svg"),
    generateBadgeSvg("activity", "#286983"),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "badge-release-action.svg"),
    generateBadgeSvg("release", "#907aa9"),
    "utf-8",
  );

  // 6. Generate All Main SVGs in Rosé Pine Dawn / Moon palette
  writeFileSync(
    path.join(assetsDir, "header.svg"),
    generateHeaderSvg(),
    "utf-8",
  );
  writeFileSync(path.join(assetsDir, "about.svg"), generateAboutSvg(), "utf-8");
  writeFileSync(
    path.join(assetsDir, "education.svg"),
    generateEducationSvg(),
    "utf-8",
  );
  writeFileSync(
    path.join(assetsDir, "experience.svg"),
    generateExperienceSvg(pid7Repos),
    "utf-8",
  );

  // Projects Header & Rows
  writeFileSync(
    path.join(assetsDir, "projects-header.svg"),
    generateProjectsHeaderSvg(),
    "utf-8",
  );
  projects.forEach((p, i) => {
    writeFileSync(
      path.join(assetsDir, `project-${i}.svg`),
      generateProjectRowSvg(p.name, p.description),
      "utf-8",
    );
  });

  // Writing Header & Rows
  writeFileSync(
    path.join(assetsDir, "writing-header.svg"),
    generateWritingHeaderSvg(),
    "utf-8",
  );
  blogPosts.forEach((post, i) => {
    writeFileSync(
      path.join(assetsDir, `writing-${i}.svg`),
      generateWritingRowSvg(post.title, post.created),
      "utf-8",
    );
  });

  const telemetrySvg = generateTelemetrySvg(
    "Telemetry",
    fmt.format(netLines),
    formatCompact(totalAdd),
    formatCompact(totalDel),
    churnBar,
    totalReposContributed,
    `${publicRepos} public, ${privateRepos} private, ${orgRepos} org`,
    fmt.format(totalCommits),
    prBar,
    prBar.pctFormatted,
    streakBar,
    stats.streaks_and_consistency.longest_streak_days,
    stats.streaks_and_consistency.active_days_count,
    topLanguages,
  );
  writeFileSync(path.join(assetsDir, "telemetry.svg"), telemetrySvg, "utf-8");

  // 7. Monthly Stats
  const monthlyList = stats.monthly_history || [];
  const targetMonth = monthlyList[monthlyList.length - 1];

  let hasMonthly = false;
  if (targetMonth) {
    const mAdd = targetMonth.lines_of_code.total_additions;
    const mDel = targetMonth.lines_of_code.total_deletions;
    const mNet = targetMonth.lines_of_code.net_lines;
    const mChurn = mAdd + mDel;
    const mChurnRatio = mChurn > 0 ? (mAdd / mChurn) * 100 : 0;
    const mChurnBar = getAsciiBar(mChurnRatio, 16);

    const mPrTotal = targetMonth.pull_requests.total;
    const mPrMerged = targetMonth.pull_requests.merged;
    const mPrMergeRate =
      targetMonth.pull_requests.merge_rate_percentage ??
      (mPrTotal > 0 ? (mPrMerged / mPrTotal) * 100 : 0);
    const mPrBar = getAsciiBar(mPrMergeRate, 16);

    const mActiveRate =
      targetMonth.streaks_and_consistency.activity_rate_percentage;
    const mStreakBar = getAsciiBar(mActiveRate, 16);

    const mTopLanguages =
      (targetMonth.languages || [])
        .slice(0, 3)
        .map((l) => `${l.name} ${Math.round(l.percentage)}%`)
        .join(" · ") || "--";

    const mLabel = "Last Month";

    const monthlySvg = generateTelemetrySvg(
      mLabel,
      fmt.format(mNet),
      formatCompact(mAdd),
      formatCompact(mDel),
      mChurnBar,
      targetMonth.repositories.total || 0,
      `${targetMonth.repositories.public} public, ${targetMonth.repositories.private} private, ${targetMonth.repositories.org ?? 0} org`,
      fmt.format(targetMonth.commits),
      mPrBar,
      `${mPrMerged}/${mPrTotal}`,
      mStreakBar,
      targetMonth.streaks_and_consistency.longest_streak_days,
      targetMonth.streaks_and_consistency.active_days_count,
      mTopLanguages,
    );
    writeFileSync(path.join(assetsDir, "monthly.svg"), monthlySvg, "utf-8");
    hasMonthly = true;
  }

  // 8. Weekly Stats
  let hasWeekly = false;
  if (stats.weekly_summary) {
    const w = stats.weekly_summary;
    const wAdd = w.lines_of_code.total_additions;
    const wDel = w.lines_of_code.total_deletions;
    const wNet = w.lines_of_code.net_lines;
    const wChurn = wAdd + wDel;
    const wChurnRatio = wChurn > 0 ? (wAdd / wChurn) * 100 : 0;
    const wChurnBar = getAsciiBar(wChurnRatio, 16);

    const wPrTotal = w.pull_requests.total;
    const wPrMerged = w.pull_requests.merged;
    const wPrMergeRate =
      w.pull_requests.merge_rate_percentage ??
      (wPrTotal > 0 ? (wPrMerged / wPrTotal) * 100 : 0);
    const wPrBar = getAsciiBar(wPrMergeRate, 16);

    const wActiveRate = w.streaks_and_consistency.activity_rate_percentage;
    const wStreakBar = getAsciiBar(wActiveRate, 16);

    const wTopLanguages =
      (w.languages || [])
        .slice(0, 3)
        .map((l) => `${l.name} ${Math.round(l.percentage)}%`)
        .join(" · ") || "--";

    const weeklySvg = generateTelemetrySvg(
      "Last Week",
      fmt.format(wNet),
      formatCompact(wAdd),
      formatCompact(wDel),
      wChurnBar,
      w.repositories.total || 0,
      `${w.repositories.public} public, ${w.repositories.private} private, ${w.repositories.org ?? 0} org`,
      fmt.format(w.commits),
      wPrBar,
      `${wPrMerged}/${wPrTotal}`,
      wStreakBar,
      w.streaks_and_consistency.longest_streak_days,
      w.streaks_and_consistency.active_days_count,
      wTopLanguages,
    );
    writeFileSync(path.join(assetsDir, "weekly.svg"), weeklySvg, "utf-8");
    hasWeekly = true;
  }

  // Construct Badges (Website, Resume, Release Tag, Socials, Actions) with Rosé Pine Dawn Custom Pill Badges
  const badges = [
    `[![website](./assets/badge-website.svg)](https://adii.fyi)`,
    `[![resume](./assets/badge-resume.svg)](https://adii.fyi/adityamotale.pdf)`,
    `[![${releaseTag}](./assets/badge-release.svg)](https://github.com/adityamotale/adityamotale/releases)`,
    `[![github](./assets/badge-github.svg)](https://github.com/adityamotale)`,
    `[![twitter](./assets/badge-twitter.svg)](https://x.com/arctic_byte)`,
    `[![linkedin](./assets/badge-linkedin.svg)](https://www.linkedin.com/in/aditya-motale)`,
    `[![tests](./assets/badge-tests.svg)](https://github.com/adityamotale/adityamotale/actions/workflows/test.yaml)`,
    `[![activity](./assets/badge-activity.svg)](https://github.com/adityamotale/adityamotale/actions/workflows/activity.yaml)`,
    `[![release](./assets/badge-release-action.svg)](https://github.com/adityamotale/adityamotale/actions/workflows/release.yaml)`,
  ].join("\n");

  // Projects clickable rows
  const projectItems = [
    `![Projects](./assets/projects-header.svg)`,
    ...projects.map(
      (p, i) => `[![${p.name}](./assets/project-${i}.svg)](${p.url})`,
    ),
  ].join("\n");

  // Writing clickable rows
  const writingItems =
    blogPosts.length > 0
      ? [
          `![Writing](./assets/writing-header.svg)`,
          ...blogPosts.map(
            (post, i) =>
              `[![${post.title}](./assets/writing-${i}.svg)](https://adii.fyi/blogs/${post.slug})`,
          ),
        ].join("\n")
      : `![Writing](./assets/writing-header.svg)`;

  // Construct Full README
  const sections = [
    badges,
    `![Aditya Motale](./assets/header.svg)`,
    `![About](./assets/about.svg)`,
    projectItems,
    writingItems,
    `![Education](./assets/education.svg)`,
    `![Experience](./assets/experience.svg)`,
    `![Telemetry](./assets/telemetry.svg)`,
  ];

  if (hasMonthly) {
    sections.push(`![Last Month](./assets/monthly.svg)`);
  }

  if (hasWeekly) {
    sections.push(`![Last Week](./assets/weekly.svg)`);
  }

  return sections.join("\n\n") + "\n";
}

function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const readmePath = path.join(rootDir, "README.md");

  console.log(
    "🔄 Generating unified Rosé Pine Dawn themed README.md, custom pill badges, and clickable SVG rows...",
  );
  const content = generateReadme(rootDir);
  writeFileSync(readmePath, content, "utf-8");
  console.log("✅ Successfully updated README.md and assets/!");
}

if (process.argv[1] === import.meta.filename) {
  main();
}
