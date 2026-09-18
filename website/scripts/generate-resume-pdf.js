import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../..');
const statsPath = path.resolve(rootDir, 'data/github-stats.json');
const blogsDir = path.resolve(rootDir, 'blogs');

let stats = {
  lines_of_code: { net_lines: 32000, total_additions: 45000, total_deletions: 13000 },
  repositories: { public: 18, private: 12 },
  contributions: { commits: 1450 },
  streaks_and_consistency: { longest_streak_days: 42, active_days_count: 280, activity_rate_percentage: 76.5 },
  pull_requests: { merge_rate_percentage: 94.2, merged: 65, total: 69 },
  repositories_contributed_to: [],
  languages: [
    { name: 'Rust', percentage: 48 },
    { name: 'TypeScript', percentage: 26 },
    { name: 'Dart', percentage: 16 },
    { name: 'C', percentage: 10 }
  ]
};

if (fs.existsSync(statsPath)) {
  try {
    stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
  } catch (err) {
    console.warn('Could not parse github-stats.json, using fallback stats', err);
  }
}

let blogPosts = [];
if (fs.existsSync(blogsDir)) {
  const files = fs.readdirSync(blogsDir).filter((f) => f.endsWith('.md'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(blogsDir, f), 'utf-8');
    const titleMatch = raw.match(/^title:\s*(.*)$/m);
    const slugMatch = raw.match(/^slug:\s*(.*)$/m);
    const dateMatch = raw.match(/^created:\s*(.*)$/m);
    if (titleMatch && slugMatch) {
      blogPosts.push({
        title: titleMatch[1].trim(),
        slug: slugMatch[1].trim(),
        date: dateMatch ? dateMatch[1].trim() : ''
      });
    }
  }
}

export async function generateResumePdf() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setProducer('pdf-lib');

  const fontRegularPath = path.resolve(rootDir, 'website/fonts/JetBrainsMono-Regular.ttf');
  const regularBytes = fs.readFileSync(fontRegularPath);
  const font = await doc.embedFont(regularBytes, { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = doc.addPage([pageWidth, pageHeight]);

  const cText = rgb(0.12, 0.11, 0.18);
  const cSubtle = rgb(0.38, 0.36, 0.46);
  const cMuted = rgb(0.55, 0.53, 0.62);
  const cAccent = rgb(0.85, 0.38, 0.52);
  const cPine = rgb(0.19, 0.45, 0.56);
  const cFoam = rgb(0.22, 0.55, 0.60);
  const cGold = rgb(0.82, 0.55, 0.20);
  const cBorder = rgb(0.85, 0.84, 0.88);
  const cDot = rgb(0.70, 0.68, 0.76);

  const left = 36;
  const right = 559;
  let y = 804;

  function addLink(rect, url) {
    const linkAnnotation = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: rect,
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url)
      }
    });
    const linkRef = doc.context.register(linkAnnotation);
    page.node.addAnnot(linkRef);
  }

  function drawDottedUnderline(x1, x2, lineY, color = cDot) {
    const dotSpacing = 2.4;
    const dotWidth = 0.8;
    for (let cur = x1; cur < x2; cur += dotSpacing) {
      page.drawRectangle({
        x: cur,
        y: lineY,
        width: Math.min(dotWidth, x2 - cur),
        height: 0.5,
        color
      });
    }
  }

  function drawClickableText(text, x, yPos, size, url, textColor = cSubtle, dotColor = cDot) {
    page.drawText(text, { x, y: yPos, size, font, color: textColor });
    const textW = font.widthOfTextAtSize(text, size);
    drawDottedUnderline(x, x + textW, yPos - 1.5, dotColor);
    addLink([x, yPos - 2.5, x + textW, yPos + size + 1], url);
    return textW;
  }

  function renderAsciiArtLogo(startX, topY, cellW = 3.2, cellH = 6.4) {
    const logoLines = [
      "▄▀█ █▀▄ █ ▀█▀ █▄█ ▄▀█   █▀▄▀█ █▀█ ▀█▀ ▄▀█ █   █▀▀",
      "█▀█ █▄▀ █  █   █  █▀█   █ ▀ █ █▄█  █  █▀█ █▄▄ ██▄"
    ];

    for (let r = 0; r < logoLines.length; r++) {
      const lineStr = logoLines[r];
      const rowY = topY - (r * cellH);
      for (let c = 0; c < lineStr.length; c++) {
        const char = lineStr[c];
        const cellX = startX + (c * cellW);
        if (char === '█') {
          page.drawRectangle({
            x: cellX,
            y: rowY - cellH + 0.5,
            width: cellW - 0.2,
            height: cellH - 0.5,
            color: cAccent
          });
        } else if (char === '▀') {
          page.drawRectangle({
            x: cellX,
            y: rowY - (cellH / 2) + 0.5,
            width: cellW - 0.2,
            height: (cellH / 2) - 0.5,
            color: cAccent
          });
        } else if (char === '▄') {
          page.drawRectangle({
            x: cellX,
            y: rowY - cellH + 0.5,
            width: cellW - 0.2,
            height: (cellH / 2) - 0.5,
            color: cAccent
          });
        }
      }
    }
  }

  function drawSectionHeader(title) {
    y -= 24;
    page.drawText('>', { x: left, y, size: 8.5, font, color: cAccent });
    page.drawText(title.toUpperCase(), { x: left + 10, y, size: 8.5, font, color: cText });
    const titleWidth = font.widthOfTextAtSize(title.toUpperCase(), 8.5);
    page.drawLine({
      start: { x: left + 14 + titleWidth, y: y + 3 },
      end: { x: right, y: y + 3 },
      thickness: 0.5,
      color: cBorder
    });
    y -= 14;
  }

  renderAsciiArtLogo(left, y, 3.2, 6.4);
  addLink([left, y - 14, left + 165, y + 2], 'https://adii.fyi');

  const siteUrl = 'https://adii.fyi';
  const siteUrlW = font.widthOfTextAtSize(siteUrl, 8.5);
  drawClickableText(siteUrl, right - siteUrlW, y - 6, 8.5, 'https://adii.fyi', cAccent, cAccent);

  y -= 24;
  page.drawText('hello, my name is Aditya — an engineer by choice', {
    x: left,
    y,
    size: 8.5,
    font,
    color: cSubtle
  });

  drawSectionHeader('About');
  const aboutLines = [
    "Engineer by choice. Passionate about systems programming, database architecture, and low-latency design.",
    "I learn fast, love hand-crafting reliable codebases, and obsess over micro-optimizations. Right now, I'm",
    "building embedded storage engines and speeding up mundane routines using SIMD."
  ];
  for (const line of aboutLines) {
    page.drawText(line, { x: left, y, size: 7.5, font, color: cSubtle });
    y -= 12;
  }

  y -= 2;
  let curNavX = left;
  curNavX += drawClickableText('github', curNavX, y, 7.5, 'https://github.com/adityamotale', cSubtle, cDot);

  page.drawText(' / ', { x: curNavX, y, size: 7.5, font, color: cMuted });
  curNavX += font.widthOfTextAtSize(' / ', 7.5);

  curNavX += drawClickableText('twitter', curNavX, y, 7.5, 'https://x.com/arctic_byte', cSubtle, cDot);

  page.drawText(' / ', { x: curNavX, y, size: 7.5, font, color: cMuted });
  curNavX += font.widthOfTextAtSize(' / ', 7.5);

  drawClickableText('linkedin', curNavX, y, 7.5, 'https://www.linkedin.com/in/aditya-motale', cSubtle, cDot);

  const topProjects = (stats.repositories_contributed_to || [])
    .filter(
      (r) =>
        !r.is_private &&
        !r.is_fork &&
        !r.repository.endsWith('/website') &&
        Boolean(r.description)
    )
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.repository.split('/')[1] || r.repository,
      url: `https://github.com/${r.repository}`,
      description: r.description
    }));

  if (topProjects.length > 0) {
    drawSectionHeader('Projects');
    for (const proj of topProjects) {
      const nameW = drawClickableText(proj.name, left, y, 7.5, proj.url, cPine, cDot);
      page.drawText(` — ${proj.description}`, {
        x: left + nameW,
        y,
        size: 7.5,
        font,
        color: cSubtle
      });
      y -= 12;
    }
  }

  drawSectionHeader('Education');
  const eduCol1 = left;
  const eduCol2 = left + 265;

  page.drawText('degree:', { x: eduCol1, y, size: 7.5, font, color: cSubtle });
  page.drawText('B.Tech (CSE)', { x: eduCol1 + 48, y, size: 7.5, font, color: cText });

  page.drawText('period:', { x: eduCol2, y, size: 7.5, font, color: cSubtle });
  page.drawText('Jun 2020 – Jun 2024 (4 yrs)', { x: eduCol2 + 48, y, size: 7.5, font, color: cText });
  y -= 14;

  page.drawText('major:', { x: eduCol1, y, size: 7.5, font, color: cSubtle });
  page.drawText('Computer Science & Engineering', { x: eduCol1 + 48, y, size: 7.5, font, color: cText });

  page.drawText('status:', { x: eduCol2, y, size: 7.5, font, color: cSubtle });
  page.drawText('Graduated', { x: eduCol2 + 48, y, size: 7.5, font, color: cText });
  y -= 14;

  page.drawText('inst:', { x: eduCol1, y, size: 7.5, font, color: cSubtle });
  page.drawText('Marathwada Inst. of Technology', { x: eduCol1 + 48, y, size: 7.5, font, color: cText });

  page.drawText('place:', { x: eduCol2, y, size: 7.5, font, color: cSubtle });
  page.drawText('CPSN, Maharashtra, Bharat', { x: eduCol2 + 48, y, size: 7.5, font, color: cText });

  drawSectionHeader('Experience');

  function drawExperienceEntry({ tag, period, role, repos, orgs, stack, impact }) {
    page.drawText(`[ ${tag} ]`, { x: left, y, size: 8.5, font, color: cText });
    const periodW = font.widthOfTextAtSize(period, 7.5);
    page.drawText(period, { x: right - periodW, y, size: 7.5, font, color: cMuted });
    y -= 14;

    if (role) {
      page.drawText('role:', { x: left + 10, y, size: 7.5, font, color: cMuted });
      page.drawText(role, { x: left + 46, y, size: 7.5, font, color: cText });
      y -= 13;
    }

    if (repos && Array.isArray(repos)) {
      page.drawText('repos:', { x: left + 10, y, size: 7.5, font, color: cMuted });
      let curX = left + 46;
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        curX += drawClickableText(repo.name, curX, y, 7.5, repo.url, cPine, cDot);

        if (i < repos.length - 1) {
          page.drawText(' · ', { x: curX, y, size: 7.5, font, color: cMuted });
          curX += font.widthOfTextAtSize(' · ', 7.5);
        }
      }
      y -= 13;
    }

    if (orgs) {
      page.drawText('orgs:', { x: left + 10, y, size: 7.5, font, color: cMuted });
      page.drawText(orgs, { x: left + 46, y, size: 7.5, font, color: cText });
      y -= 13;
    }

    if (stack) {
      page.drawText('stack:', { x: left + 10, y, size: 7.5, font, color: cMuted });
      page.drawText(stack, { x: left + 46, y, size: 7.5, font, color: cSubtle });
      y -= 13;
    }

    if (impact) {
      page.drawText('impact:', { x: left + 10, y, size: 7.5, font, color: cMuted });
      page.drawText(impact, { x: left + 46, y, size: 7.5, font, color: cSubtle });
      y -= 13;
    }
    y -= 6;
  }

  const MIN_CONTRIBUTIONS = 100;
  const TOP_COUNT = 5;

  let pid7Repos = (stats.repositories_contributed_to || [])
    .filter((r) => r.repository && r.repository.startsWith('pid7-org/'))
    .filter((r) => (r.total_contributions || 0) >= MIN_CONTRIBUTIONS)
    .sort((a, b) => (b.total_contributions || 0) - (a.total_contributions || 0))
    .slice(0, TOP_COUNT)
    .map((r) => ({
      name: r.repository.replace(/^pid7-org\//, ''),
      url: `https://github.com/${r.repository}`,
      contributions: r.total_contributions
    }));

  if (pid7Repos.length === 0) {
    pid7Repos = ['turbofox', 'frozen-core', 'ashwa', 'kosa', 'rta'].map((name) => ({
      name,
      url: `https://github.com/pid7-org/${name}`
    }));
  }

  drawExperienceEntry({
    tag: 'OSS Contributions',
    period: 'Sep 2024 — Present',
    role: 'Core Maintainer & Systems Developer',
    repos: pid7Repos,
    stack: 'Rust · SIMD · Embedded Storage · Systems Programming',
    impact: 'Building hardware-accelerated algorithms, embedded KV stores & storage engines'
  });

  drawExperienceEntry({
    tag: 'Freelance & Contract · Web & Tooling',
    period: 'Jul 2024 — Present',
    role: 'Web & Tooling Developer (Multiple Clients)',
    stack: 'Astro · React · TypeScript · Microservices · VS Code API',
    impact: 'Shipped startup landing pages, SMTP microservices & event ticket booking'
  });

  drawExperienceEntry({
    tag: 'Internships · Mobile Engineering',
    period: 'Nov 2021 — Apr 2024 (9 mos total)',
    orgs: 'kraftbase (1 mo) · Rojgary (5 mos) · FOLKDevelopers (3 mos)',
    stack: 'Flutter · Dart · State Management · REST APIs',
    impact: 'Built MVP mobile apps for multiple clients from scratch, refactored codebases & enhanced reliability'
  });

  drawSectionHeader('Writing');
  const postsToShow = blogPosts.slice(0, 3);
  if (postsToShow.length === 0) {
    postsToShow.push({
      title: "There's More to Performance Than Big-O",
      slug: 'theres-more-to-performance-than-big-o',
      date: '15-09-2026'
    });
  }

  for (const post of postsToShow) {
    drawClickableText(post.title, left, y, 7.5, `https://adii.fyi/blogs/${post.slug}`, cText, cDot);

    const dateW = font.widthOfTextAtSize(post.date, 7.5);
    page.drawText(post.date, { x: right - dateW, y, size: 7.5, font, color: cMuted });
    y -= 14;
  }

  drawSectionHeader('Telemetry');

  function getAsciiBar(pct, len = 14) {
    const safePct = Math.max(0, Math.min(100, pct));
    const filled = Math.min(len, Math.floor((safePct / 100) * len));
    const empty = len - filled;
    return {
      filled: '#'.repeat(filled),
      empty: '.'.repeat(empty),
      pctFormatted: `${safePct.toFixed(1)}%`
    };
  }

  const fmt = new Intl.NumberFormat('en-US');
  const formatCompact = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  const loc = stats.lines_of_code || {};
  const netLines = loc.net_lines || 32150;
  const totalAdd = loc.total_additions || 45200;
  const totalDel = loc.total_deletions || 13050;
  const totalChurn = totalAdd + totalDel;
  const addRatio = totalChurn > 0 ? (totalAdd / totalChurn) * 100 : 0;
  const churnBar = getAsciiBar(addRatio, 14);

  const reposContributed = stats.repositories_contributed_to?.length || 18;
  const pubRepos = stats.repositories?.public || 12;
  const privRepos = stats.repositories?.private || 6;
  const orgRepos = Math.max(0, reposContributed - (pubRepos + privRepos));

  const totalCommits = stats.repositories_contributed_to?.reduce((s, r) => s + (r.commits || 0), 0) || stats.contributions?.commits || 1450;

  const prMergeRate = stats.pull_requests?.merge_rate_percentage || 94.2;
  const prBar = getAsciiBar(prMergeRate, 14);

  const activityRate = stats.streaks_and_consistency?.activity_rate_percentage || 76.5;
  const streakBar = getAsciiBar(activityRate, 14);

  const longestStreak = stats.streaks_and_consistency?.longest_streak_days || 42;
  const activeDays = stats.streaks_and_consistency?.active_days_count || 280;

  const topLangs = (stats.languages || [])
    .slice(0, 3)
    .map((l) => `${l.name} ${Math.round(l.percentage)}%`)
    .join(' · ') || 'Rust 48% · TypeScript 26% · Dart 16%';

  const col1X = left;
  const col2X = left + 265;

  const charW = font.widthOfTextAtSize('#', 7.5);

  page.drawText('&', { x: col1X, y, size: 7.5, font, color: cMuted });
  page.drawText('loc:', { x: col1X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText(`${fmt.format(netLines)} (+${formatCompact(totalAdd)} / -${formatCompact(totalDel)})`, { x: col1X + 48, y, size: 7.5, font, color: cText });

  page.drawText('+', { x: col2X, y, size: 7.5, font, color: cMuted });
  page.drawText('prs:', { x: col2X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText('[', { x: col2X + 48, y, size: 7.5, font, color: cMuted });
  page.drawText(prBar.filled, { x: col2X + 48 + charW, y, size: 7.5, font, color: cFoam });
  page.drawText(prBar.empty, { x: col2X + 48 + charW + (prBar.filled.length * charW), y, size: 7.5, font, color: cBorder });
  page.drawText(`] ${prBar.pctFormatted}`, { x: col2X + 48 + charW + (14 * charW), y, size: 7.5, font, color: cText });
  y -= 15;

  page.drawText('%', { x: col1X, y, size: 7.5, font, color: cMuted });
  page.drawText('churn:', { x: col1X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText('[', { x: col1X + 48, y, size: 7.5, font, color: cMuted });
  page.drawText(churnBar.filled, { x: col1X + 48 + charW, y, size: 7.5, font, color: cPine });
  page.drawText(churnBar.empty, { x: col1X + 48 + charW + (churnBar.filled.length * charW), y, size: 7.5, font, color: cBorder });
  page.drawText(`] ${churnBar.pctFormatted}`, { x: col1X + 48 + charW + (14 * charW), y, size: 7.5, font, color: cText });

  page.drawText('@', { x: col2X, y, size: 7.5, font, color: cMuted });
  page.drawText('active:', { x: col2X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText('[', { x: col2X + 48, y, size: 7.5, font, color: cMuted });
  page.drawText(streakBar.filled, { x: col2X + 48 + charW, y, size: 7.5, font, color: cGold });
  page.drawText(streakBar.empty, { x: col2X + 48 + charW + (streakBar.filled.length * charW), y, size: 7.5, font, color: cBorder });
  page.drawText(`] ${streakBar.pctFormatted}`, { x: col2X + 48 + charW + (14 * charW), y, size: 7.5, font, color: cText });
  y -= 15;

  page.drawText('#', { x: col1X, y, size: 7.5, font, color: cMuted });
  page.drawText('repos:', { x: col1X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText(`${reposContributed} (${pubRepos} public, ${privRepos} private, ${orgRepos} org)`, { x: col1X + 48, y, size: 7.5, font, color: cText });

  page.drawText('^', { x: col2X, y, size: 7.5, font, color: cMuted });
  page.drawText('streak:', { x: col2X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText(`${longestStreak} days (${activeDays} active)`, { x: col2X + 48, y, size: 7.5, font, color: cText });
  y -= 15;

  page.drawText('*', { x: col1X, y, size: 7.5, font, color: cMuted });
  page.drawText('commits:', { x: col1X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText(`${fmt.format(totalCommits)}`, { x: col1X + 48, y, size: 7.5, font, color: cText });

  page.drawText('$', { x: col2X, y, size: 7.5, font, color: cMuted });
  page.drawText('stack:', { x: col2X + 10, y, size: 7.5, font, color: cSubtle });
  page.drawText(topLangs, { x: col2X + 48, y, size: 7.5, font, color: cText });

  return await doc.save();
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const outputPath = path.resolve(publicDir, 'adityamotale.pdf');

generateResumePdf().then((pdfBytes) => {
  const newBuffer = Buffer.from(pdfBytes);
  if (fs.existsSync(outputPath)) {
    const existingBuffer = fs.readFileSync(outputPath);
    if (existingBuffer.equals(newBuffer)) {
      console.log(`ℹ️ Resume PDF is up to date: ${outputPath}`);
      return;
    }
  }
  fs.writeFileSync(outputPath, newBuffer);
  console.log(`✅ Resume PDF successfully generated at: ${outputPath} (${pdfBytes.length} bytes)`);
}).catch((err) => {
  console.error('❌ Failed to generate resume PDF:', err);
  process.exit(1);
});
