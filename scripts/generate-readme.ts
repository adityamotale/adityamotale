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

const BAR_LENGTH = 12;
const FILLED_GLYPH = "█";
const EMPTY_GLYPH = "░";

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
  .accent-stroke { stroke: #d7827e; }
  .accent-fill { fill: #d7827e; }
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
    .accent-stroke { stroke: #ea9a97; }
    .accent-fill { fill: #ea9a97; }
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

function generateHeaderSvg(
  rustPct = "68",
  rustLoc = "1.2M",
  commits = "3,580",
  activeDays = "1,036",
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 82" width="100%" height="82" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono">
    <text x="0" y="18" class="accent" font-size="12.5" font-weight="600" xml:space="preserve">▄▀█ █▀▄ █ ▀█▀ █▄█ ▄▀█   █▀▄▀█ █▀█ ▀█▀ ▄▀█ █   █▀▀</text>
    <text x="0" y="34" class="accent" font-size="12.5" font-weight="600" xml:space="preserve">█▀█ █▄▀ █  █   █  █▀█   █ ▀ █ █▄█  █  █▀█ █▄▄ ██▄</text>
    <text x="0" y="58" class="subtle" font-size="11.5">hello, my name is Aditya — an engineer by choice</text>
    <text x="0" y="74" class="muted" font-size="11">// rust ${rustPct}% · ${rustLoc} loc · ${commits} commits · ${activeDays}d active</text>
  </g>
</svg>`;
}

function generateLatestReleaseSvg(
  repoName: string,
  tagName: string,
  formattedDate: string,
  description: string,
): string {
  const repoShort = repoName.split("/")[1] || repoName;
  const descSafe = escapeXml(
    description.length > 95 ? `${description.slice(0, 92)}...` : description,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 86" width="100%" height="86" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">LATEST RELEASE</text>
    <line x1="125" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// ${escapeXml(repoName)}</text>

    <text x="12" y="52">
      <tspan class="text" font-weight="600">${escapeXml(repoShort)}</tspan>
      <tspan class="muted"> [ </tspan><tspan class="gold" font-weight="600">${escapeXml(tagName)}</tspan><tspan class="muted"> ]</tspan>
    </text>
    <text x="680" y="52" text-anchor="end" class="muted">${escapeXml(formattedDate)}</text>

    <text x="12" y="72" class="subtle">${descSafe}</text>
  </g>
</svg>`;
}

function generateAboutSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 115" width="100%" height="115" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">ABOUT</text>
    <line x1="65" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// bio</text>

    <text x="12" y="50" class="subtle">An engineer by choice. It bugs me how slow and messy most software is,</text>
    <text x="12" y="68" class="subtle">so I build things the way they should work: fast, without the bloat, and</text>
    <text x="12" y="86" class="subtle">knowing what&apos;s actually going on underneath. I don&apos;t stick to one lane;</text>
    <text x="12" y="104" class="subtle">I just figure out how the engine works and ship.</text>
  </g>
</svg>`;
}

function generateProjectsHeaderSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 36" width="100%" height="36" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">PROJECTS</text>
    <line x1="85" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// selected work</text>
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 36" width="100%" height="36" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">WRITING</text>
    <line x1="75" y1="10" x2="590" y2="10" class="header-line" stroke-width="1" />
    <text x="600" y="14" class="subtle" font-size="11">[view all]</text>
    <line x1="665" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// recent posts</text>
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
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">EDUCATION</text>
    <line x1="92" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// degree &amp; background</text>

    <text x="12" y="54">
      <tspan class="subtle">degree:</tspan>  <tspan class="text" font-weight="600">B.Tech</tspan> <tspan class="muted">(CSE)</tspan>
    </text>
    <text x="340" y="54">
      <tspan class="subtle">period:</tspan>  <tspan class="text" font-weight="600">Jun 2020 – Jun 2024</tspan> <tspan class="muted">(4 yrs)</tspan>
    </text>

    <text x="12" y="74">
      <tspan class="subtle">major:</tspan>   <tspan class="text" font-weight="600">Computer Science &amp; Engineering</tspan>
    </text>
    <text x="340" y="74">
      <tspan class="subtle">inst:</tspan>    <tspan class="text" font-weight="600">Marathwada Inst. of Technology</tspan>
    </text>
  </g>
</svg>`;
}

function generateExperienceSvg(pid7Repos: { name: string }[]): string {
  const repoNames = pid7Repos.map((r) => r.name).join(" · ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 440" width="100%" height="440" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">EXPERIENCE</text>
    <line x1="102" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// 2021 → mobile · 2024 → web &amp; tooling · now → systems</text>

    <text x="0" y="56" class="text" font-weight="600">[ Systems Engineering · pid7-org ]</text>
    <text x="680" y="56" text-anchor="end" class="muted">Sep 2024 — Present</text>
    <text x="0" y="74">
      <tspan class="subtle">  role:</tspan>   <tspan class="text" font-weight="600">Core Contributor · Systems Architecture &amp; Implementation</tspan>
    </text>
    <text x="0" y="92">
      <tspan class="subtle">  repos:</tspan>  <tspan class="text" font-weight="600">${escapeXml(repoNames)}</tspan>
    </text>
    <text x="0" y="110">
      <tspan class="subtle">  stack:</tspan>  <tspan class="text">Core: Rust · SIMD | Concurrency: Lock-Free | Storage: Memory-Mapped I/O</tspan>
    </text>
    <text x="0" y="128">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Shipped a lock-free concurrent KV engine with memory-mapped</tspan>
    </text>
    <text x="0" y="146">
      <tspan class="text">          I/O and explicit sync barriers; production SIMD paths prioritize</tspan>
    </text>
    <text x="0" y="164">
      <tspan class="text">          deterministic latency and memory efficiency</tspan>
    </text>

    <text x="0" y="194" class="text" font-weight="600">[ Freelance &amp; Contract · Web &amp; Tooling ]</text>
    <text x="680" y="194" text-anchor="end" class="muted">Jul 2024 — Present</text>
    <text x="0" y="212">
      <tspan class="subtle">  role:</tspan>   <tspan class="text" font-weight="600">Full-Stack Developer &amp; Tooling Engineer · 3 Clients</tspan>
    </text>
    <text x="0" y="230">
      <tspan class="subtle">  stack:</tspan>  <tspan class="text">Frontend: Astro · TypeScript | Backend: Microservices | Tooling: VS Code API</tspan>
    </text>
    <text x="0" y="248">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Delivered a transactional email service and event-ticketing</tspan>
    </text>
    <text x="0" y="266">
      <tspan class="text">          platform end to end; built VS Code extensions for internal</tspan>
    </text>
    <text x="0" y="284">
      <tspan class="text">          developer workflows across client projects</tspan>
    </text>

    <text x="0" y="314" class="text" font-weight="600">[ Internships · Mobile Engineering ]</text>
    <text x="680" y="314" text-anchor="end" class="muted">Nov 2021 — Apr 2024 · 9 mos</text>
    <text x="0" y="332">
      <tspan class="subtle">  role:</tspan>   <tspan class="text" font-weight="600">Flutter Developer · 3 Organizations</tspan>
    </text>
    <text x="0" y="350">
      <tspan class="subtle">  orgs:</tspan>   <tspan class="text">kraftbase (1 mo) · Rojgary (5 mos) · FOLKDevelopers (3 mos)</tspan>
    </text>
    <text x="0" y="368">
      <tspan class="subtle">  stack:</tspan>  <tspan class="text">Mobile: Flutter · Dart | Architecture: State Management | APIs: REST</tspan>
    </text>
    <text x="0" y="386">
      <tspan class="subtle">  impact:</tspan> <tspan class="text">Led Flutter delivery across three organizations; built MVPs,</tspan>
    </text>
    <text x="0" y="404">
      <tspan class="text">          refactored production apps, and delivered features during</tspan>
    </text>
    <text x="0" y="422">
      <tspan class="text">          active release cycles</tspan>
    </text>
  </g>
</svg>`;
}

function generateTelemetrySvg(
  title: string,
  netLoc: string,
  additions: string,
  deletions: string,
  reposTotal: number | string,
  reposDetail: string,
  commits: string,
  stack: string,
  prBar: { filled: string; empty: string; pctFormatted: string },
  activeBar: { filled: string; empty: string; pctFormatted: string },
  streakDays: number | string,
  maxStreakDays: number | string,
  churnBar: { filled: string; empty: string; pctFormatted: string },
): string {
  const lineStart = 24 + title.length * 7.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 128" width="100%" height="128" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">${escapeXml(title.toUpperCase())}</text>
    <line x1="${lineStart}" y1="10" x2="680" y2="10" class="header-line" stroke-width="1" />
    <text x="12" y="30" class="muted" font-size="11">// metrics</text>

    <!-- Row 1: loc & prs -->
    <text x="12" y="52">
      <tspan class="subtle">loc</tspan><tspan class="muted">     : </tspan><tspan class="text" font-weight="600">${escapeXml(netLoc)}</tspan> <tspan class="muted text-xs">(+${escapeXml(additions)} / -${escapeXml(deletions)})</tspan>
    </text>
    <text x="340" y="52">
      <tspan class="subtle">prs</tspan><tspan class="muted">    : [</tspan><tspan class="foam">${escapeXml(prBar.filled)}</tspan><tspan class="bar-empty">${escapeXml(prBar.empty)}</tspan><tspan class="muted">] </tspan><tspan class="text" font-weight="600">${escapeXml(prBar.pctFormatted)}</tspan>
    </text>

    <!-- Row 2: commits & active -->
    <text x="12" y="72">
      <tspan class="subtle">commits</tspan><tspan class="muted"> : </tspan><tspan class="text" font-weight="600">${escapeXml(commits)}</tspan> <tspan class="muted text-xs">(pub + org)</tspan>
    </text>
    <text x="340" y="72">
      <tspan class="subtle">active</tspan><tspan class="muted"> : [</tspan><tspan class="gold">${escapeXml(activeBar.filled)}</tspan><tspan class="bar-empty">${escapeXml(activeBar.empty)}</tspan><tspan class="muted">] </tspan><tspan class="text" font-weight="600">${escapeXml(activeBar.pctFormatted)}</tspan>
    </text>

    <!-- Row 3: repos & streak -->
    <text x="12" y="92">
      <tspan class="subtle">repos</tspan><tspan class="muted">   : </tspan><tspan class="text" font-weight="600">${escapeXml(String(reposTotal))}</tspan> <tspan class="muted text-xs">(${escapeXml(reposDetail)})</tspan>
    </text>
    <text x="340" y="92">
      <tspan class="subtle">streak</tspan><tspan class="muted"> : </tspan><tspan class="text" font-weight="600">${escapeXml(String(streakDays))}d</tspan> <tspan class="muted text-xs">current (${escapeXml(String(maxStreakDays))}d max)</tspan>
    </text>

    <!-- Row 4: stack & churn -->
    <text x="12" y="112">
      <tspan class="subtle">stack</tspan><tspan class="muted">   : </tspan><tspan class="text" font-weight="600">${escapeXml(stack)}</tspan>
    </text>
    <text x="340" y="112">
      <tspan class="subtle">churn</tspan><tspan class="muted">  : </tspan><tspan class="text" font-weight="600">${escapeXml(churnBar.pctFormatted)}</tspan> <tspan class="muted text-xs">net retention</tspan>
    </text>
  </g>
</svg>`;
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
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <text x="0" y="14" class="accent" font-size="12">&gt;</text>
    <text x="12" y="14" class="text" font-weight="700" letter-spacing="0.06em">CONTRIBUTIONS</text>
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

function generateFooterSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 36" width="100%" height="36" fill="none">
  <style>
    ${SVG_STYLE}
  </style>
  <g class="mono" font-size="11.5">
    <line x1="0" y1="8" x2="680" y2="8" class="header-line" stroke-width="1" />
    <text x="0" y="26" class="accent" font-weight="600">aditya</text>
    <text x="60" y="26" class="muted">[eof]</text>
    <text x="680" y="26" text-anchor="end" class="subtle">github · x · linkedin · adii.fyi</text>
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

  const blogPosts = getBlogPosts(rootDir, 5);

  const pid7Repos = (stats.repositories_contributed_to || [])
    .filter((r) => r.repository.startsWith("pid7-org/"))
    .filter((r) => (r.total_contributions || 0) >= 100)
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.repository.replace(/^pid7-org\//, ""),
      url: `https://github.com/${r.repository}`,
    }));

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

  const rustLang = (stats.languages || []).find((l) => l.name === "Rust");
  const rustPct = rustLang ? rustLang.percentage.toFixed(0) : "68";
  const rustLocFormatted = rustLang ? formatCompact(rustLang.loc || 0) : "1.2M";
  const netLocFormatted = formatCompact(netLines);
  const commitsCompact =
    totalCommits >= 1000
      ? formatCompact(totalCommits)
      : totalCommits.toString();
  const activeDaysFormatted =
    stats.streaks_and_consistency.active_days_count?.toLocaleString() ||
    "1,036";

  writeFileSync(
    path.join(assetsDir, "header.svg"),
    generateHeaderSvg(
      rustPct,
      rustLocFormatted,
      commitsCompact,
      activeDaysFormatted,
    ),
    "utf-8",
  );

  const latestRelease = stats.releases?.[0];
  if (latestRelease) {
    const repoInfo = stats.repositories_contributed_to?.find(
      (r) => r.repository === latestRelease.repo,
    );
    const releaseDesc =
      repoInfo?.description ||
      latestRelease.title ||
      "Latest repository release";
    const formattedReleaseDate = formatReleaseDate(latestRelease.published_at);
    writeFileSync(
      path.join(assetsDir, "latest-release.svg"),
      generateLatestReleaseSvg(
        latestRelease.repo,
        latestRelease.tag_name,
        formattedReleaseDate,
        releaseDesc,
      ),
      "utf-8",
    );
  }

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
    totalReposContributed,
    `${publicRepos} pub · ${privateRepos} pri · ${orgRepos} org`,
    fmt.format(totalCommits),
    topLanguages,
    prBar,
    streakBar,
    stats.streaks_and_consistency.current_streak_days,
    stats.streaks_and_consistency.longest_streak_days,
    churnBar,
  );
  writeFileSync(path.join(assetsDir, "telemetry.svg"), telemetrySvg, "utf-8");

  const yearlyData = stats.yearly_contributions || [];
  if (yearlyData.length > 0) {
    writeFileSync(
      path.join(assetsDir, "contributions.svg"),
      generateContributionsSvg(yearlyData),
      "utf-8",
    );
  }

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

    const mRepos = targetMonth.repositories || {
      total: 0,
      public: 0,
      private: 0,
      org: 0,
    };

    const monthlySvg = generateTelemetrySvg(
      mLabel,
      fmt.format(mNet),
      formatCompact(mAdd),
      formatCompact(mDel),
      mRepos.total || 0,
      `${mRepos.public} pub · ${mRepos.private} pri · ${mRepos.org ?? 0} org`,
      fmt.format(targetMonth.commits),
      mTopLanguages,
      mPrBar,
      mStreakBar,
      targetMonth.streaks_and_consistency.current_streak_days,
      targetMonth.streaks_and_consistency.longest_streak_days,
      mChurnBar,
    );
    writeFileSync(path.join(assetsDir, "monthly.svg"), monthlySvg, "utf-8");
    hasMonthly = true;
  }

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

    const wRepos = w.repositories || {
      total: 0,
      public: 0,
      private: 0,
      org: 0,
    };

    const weeklySvg = generateTelemetrySvg(
      "Last Week",
      fmt.format(wNet),
      formatCompact(wAdd),
      formatCompact(wDel),
      wRepos.total || 0,
      `${wRepos.public} pub · ${wRepos.private} pri · ${wRepos.org ?? 0} org`,
      fmt.format(w.commits),
      wTopLanguages,
      wPrBar,
      wStreakBar,
      w.streaks_and_consistency.current_streak_days,
      w.streaks_and_consistency.longest_streak_days,
      wChurnBar,
    );
    writeFileSync(path.join(assetsDir, "weekly.svg"), weeklySvg, "utf-8");
    hasWeekly = true;
  }

  writeFileSync(
    path.join(assetsDir, "footer.svg"),
    generateFooterSvg(),
    "utf-8",
  );

  const badges = [
    `[![Website](https://img.shields.io/badge/website-adii.fyi-286983?style=flat-square&logo=googlechrome&logoColor=faf4ed&labelColor=575279)](https://adii.fyi)`,
    `[![Resume](https://img.shields.io/badge/resume-adityamotale.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=faf4ed&labelColor=575279)](https://adii.fyi/adityamotale.pdf)`,
    `[![Release](https://img.shields.io/github/v/release/adityamotale/adityamotale?style=flat-square&label=release&logo=github&logoColor=faf4ed&labelColor=575279&color=ea9d34)](https://github.com/adityamotale/adityamotale/releases)`,
    `[![GitHub](https://img.shields.io/badge/github-adityamotale-575279?style=flat-square&logo=github&logoColor=faf4ed&labelColor=575279)](https://github.com/adityamotale)`,
    `[![Twitter](https://img.shields.io/badge/twitter-@arctic__byte-56949f?style=flat-square&logo=x&logoColor=faf4ed&labelColor=575279)](https://x.com/arctic_byte)`,
    `[![LinkedIn](https://img.shields.io/badge/linkedin-aditya--motale-286983?style=flat-square&logo=linkedin&logoColor=faf4ed&labelColor=575279)](https://www.linkedin.com/in/aditya-motale)`,
    `[![Test](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/test.yaml?style=flat-square&label=tests&logo=githubactions&logoColor=faf4ed&labelColor=575279&color=56949f)](https://github.com/adityamotale/adityamotale/actions/workflows/test.yaml)`,
    `[![Activity](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/activity.yaml?style=flat-square&label=activity&logo=githubactions&logoColor=faf4ed&labelColor=575279&color=286983)](https://github.com/adityamotale/adityamotale/actions/workflows/activity.yaml)`,
    `[![Release Action](https://img.shields.io/github/actions/workflow/status/adityamotale/adityamotale/release.yaml?style=flat-square&label=release%20workflow&logo=githubactions&logoColor=faf4ed&labelColor=575279&color=907aa9)](https://github.com/adityamotale/adityamotale/actions/workflows/release.yaml)`,
  ].join(" ");

  const projectItems = [
    `![Projects](./assets/projects-header.svg)`,
    ...projects.map(
      (p, i) => `[![${p.name}](./assets/project-${i}.svg)](${p.url})`,
    ),
  ].join("\n");

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

  const sections = [badges, `![Aditya](./assets/header.svg)`];

  if (latestRelease) {
    const releaseUrl =
      latestRelease.url ||
      `https://github.com/${latestRelease.repo}/releases/tag/${latestRelease.tag_name}`;
    sections.push(
      `[![Latest Release: ${latestRelease.repo}](./assets/latest-release.svg)](${releaseUrl})`,
    );
  }

  sections.push(`![About](./assets/about.svg)`);
  sections.push(projectItems);
  sections.push(writingItems);
  sections.push(`![Experience](./assets/experience.svg)`);
  sections.push(`![Telemetry](./assets/telemetry.svg)`);

  if (yearlyData.length > 0) {
    sections.push(`![Contributions](./assets/contributions.svg)`);
  } else if (hasMonthly) {
    sections.push(`![Last Month](./assets/monthly.svg)`);
    if (hasWeekly) {
      sections.push(`![Last Week](./assets/weekly.svg)`);
    }
  }

  sections.push(`![Education](./assets/education.svg)`);
  sections.push(`![Footer](./assets/footer.svg)`);

  return sections.join("\n\n") + "\n";
}

function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const readmePath = path.join(rootDir, "README.md");

  console.log(
    "🔄 Generating unified Rosé Pine Dawn themed README.md, two-tone badges, and clickable SVG rows...",
  );
  const content = generateReadme(rootDir);
  writeFileSync(readmePath, content, "utf-8");
  console.log("✅ Successfully updated README.md and assets/!");
}

if (process.argv[1] === import.meta.filename) {
  main();
}
