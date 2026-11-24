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

// Configurable contact details
const CONTACT = {
  email: process.env.RESUME_EMAIL || 'aditya@adii.fyi',
  phone: process.env.RESUME_PHONE || '+91 91720 00000',
  site: 'https://adii.fyi',
  github: 'https://github.com/adityamotale',
  twitter: 'https://x.com/arctic_byte',
  linkedin: 'https://www.linkedin.com/in/aditya-motale'
};

let stats = {
  lines_of_code: { net_lines: 87823, total_additions: 201200, total_deletions: 113400 },
  repositories: { public: 18, private: 10, total: 53 },
  contributions: { commits: 3580 },
  streaks_and_consistency: { longest_streak_days: 112, active_days_count: 1036, activity_rate_percentage: 95.7 },
  pull_requests: { merge_rate_percentage: 97.4, merged: 46, total: 47 },
  repositories_contributed_to: [],
  languages: [
    { name: 'Rust', percentage: 73.0 },
    { name: 'TypeScript', percentage: 8.0 },
    { name: 'C', percentage: 7.0 },
    { name: 'Assembly', percentage: 4.0 }
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
  const fontBoldPath = path.resolve(rootDir, 'website/fonts/JetBrainsMono-Bold.ttf');
  const regularBytes = fs.readFileSync(fontRegularPath);
  const boldBytes = fs.readFileSync(fontBoldPath);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = doc.addPage([pageWidth, pageHeight]);

  // Rosé Pine Dawn (Light Theme) Palette with Rose Accent
  const cBase = rgb(0.980, 0.957, 0.929);    // #faf4ed (Dawn surface base)
  const cText = rgb(0.341, 0.322, 0.475);    // #575279 (Dawn text)
  const cSubtle = rgb(0.475, 0.459, 0.576);  // #797593 (Dawn subtle)
  const cMuted = rgb(0.596, 0.576, 0.647);   // #9893a5 (Dawn muted)
  const cAccent = rgb(0.843, 0.510, 0.494);  // #d7827e (Dawn rose accent)
  const cPine = rgb(0.157, 0.412, 0.514);    // #286983 (Dawn pine)
  const cFoam = rgb(0.337, 0.580, 0.624);    // #56949f (Dawn foam)
  const cGold = rgb(0.918, 0.616, 0.204);    // #ea9d34 (Dawn gold)
  const cBorder = rgb(0.875, 0.855, 0.851);  // #dfdad9 (Dawn highlight-med)
  const cDot = rgb(0.760, 0.740, 0.780);     // dotted underline

  // Draw full-page Dawn light background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: cBase
  });

  const left = 36;
  const right = 559;
  let y = 808;

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

  function drawClickableText(text, x, yPos, size, url, textColor = cSubtle, dotColor = cDot, useBold = false) {
    const f = useBold ? fontBold : font;
    page.drawText(text, { x, y: yPos, size, font: f, color: textColor });
    const textW = f.widthOfTextAtSize(text, size);
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

  function drawSectionHeader(title, comment = '') {
    y -= 16;
    page.drawText('>', { x: left, y, size: 8, font: fontBold, color: cAccent });
    page.drawText(title.toUpperCase(), { x: left + 10, y, size: 8, font: fontBold, color: cText });
    const titleWidth = fontBold.widthOfTextAtSize(title.toUpperCase(), 8);
    page.drawLine({
      start: { x: left + 14 + titleWidth, y: y + 3 },
      end: { x: right, y: y + 3 },
      thickness: 0.5,
      color: cBorder
    });
    if (comment) {
      y -= 10;
      page.drawText(`// ${comment}`, { x: left + 10, y, size: 6.8, font, color: cMuted });
    }
    y -= 10;
  }

  // Header: ASCII Logo & Website Link
  renderAsciiArtLogo(left, y, 3.2, 6.4);
  addLink([left, y - 14, left + 165, y + 2], CONTACT.site);

  const siteUrlW = font.widthOfTextAtSize(CONTACT.site, 8);
  drawClickableText(CONTACT.site, right - siteUrlW, y - 6, 8, CONTACT.site, cAccent, cAccent);

  y -= 22;
  page.drawText('hello, my name is Aditya — an engineer by choice', {
    x: left,
    y,
    size: 7.8,
    font,
    color: cSubtle
  });

  // Contact Row 1: Email · Phone
  y -= 11;
  let curContactX = left;
  page.drawText('email: ', { x: curContactX, y, size: 7.2, font, color: cMuted });
  curContactX += font.widthOfTextAtSize('email: ', 7.2);
  curContactX += drawClickableText(CONTACT.email, curContactX, y, 7.2, `mailto:${CONTACT.email}`, cText, cDot);

  page.drawText('   ·   phone: ', { x: curContactX, y, size: 7.2, font, color: cMuted });
  curContactX += font.widthOfTextAtSize('   ·   phone: ', 7.2);
  curContactX += drawClickableText(CONTACT.phone, curContactX, y, 7.2, `tel:${CONTACT.phone.replace(/[\s-]/g, '')}`, cText, cDot);

  // Contact Row 2: Handles
  y -= 10;
  let curNavX = left;
  curNavX += drawClickableText('github', curNavX, y, 7.2, CONTACT.github, cSubtle, cDot);

  page.drawText(' / ', { x: curNavX, y, size: 7.2, font, color: cMuted });
  curNavX += font.widthOfTextAtSize(' / ', 7.2);

  curNavX += drawClickableText('twitter', curNavX, y, 7.2, CONTACT.twitter, cSubtle, cDot);

  page.drawText(' / ', { x: curNavX, y, size: 7.2, font, color: cMuted });
  curNavX += font.widthOfTextAtSize(' / ', 7.2);

  drawClickableText('linkedin', curNavX, y, 7.2, CONTACT.linkedin, cSubtle, cDot);

  // 1. ABOUT
  drawSectionHeader('About', 'bio');
  const aboutLines = [
    "An engineer by choice. It bugs me how slow and messy most software is, so I build things the way",
    "they should work: fast, without the bloat, and knowing what's actually going on underneath.",
    "Right now, building embedded storage engines and speeding up mundane routines using SIMD."
  ];
  for (const line of aboutLines) {
    page.drawText(line, { x: left, y, size: 7.2, font, color: cSubtle });
    y -= 10.5;
  }

  // 2. EXPERIENCE
  drawSectionHeader('Experience', '2021 -> mobile · 2024 -> web & tooling · now -> systems');

  function drawExperienceEntry({ tag, period, role, repos, orgs, stack, impact, impact2 }) {
    page.drawText(`[ ${tag} ]`, { x: left, y, size: 7.8, font: fontBold, color: cText });
    const periodW = font.widthOfTextAtSize(period, 7.2);
    page.drawText(period, { x: right - periodW, y, size: 7.2, font, color: cMuted });
    y -= 11.5;

    if (role) {
      page.drawText('role:', { x: left + 10, y, size: 7.2, font, color: cMuted });
      page.drawText(role, { x: left + 48, y, size: 7.2, font, color: cText });
      y -= 10.5;
    }

    if (repos && Array.isArray(repos)) {
      page.drawText('repos:', { x: left + 10, y, size: 7.2, font, color: cMuted });
      let curX = left + 48;
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        curX += drawClickableText(repo.name, curX, y, 7.2, repo.url, cPine, cDot);

        if (i < repos.length - 1) {
          page.drawText(' · ', { x: curX, y, size: 7.2, font, color: cMuted });
          curX += font.widthOfTextAtSize(' · ', 7.2);
        }
      }
      y -= 10.5;
    }

    if (orgs) {
      page.drawText('orgs:', { x: left + 10, y, size: 7.2, font, color: cMuted });
      page.drawText(orgs, { x: left + 48, y, size: 7.2, font, color: cText });
      y -= 10.5;
    }

    if (stack) {
      page.drawText('stack:', { x: left + 10, y, size: 7.2, font, color: cMuted });
      page.drawText(stack, { x: left + 48, y, size: 7.2, font, color: cSubtle });
      y -= 10.5;
    }

    if (impact) {
      page.drawText('impact:', { x: left + 10, y, size: 7.2, font, color: cMuted });
      page.drawText(impact, { x: left + 48, y, size: 7.2, font, color: cSubtle });
      y -= 10.5;
    }

    if (impact2) {
      page.drawText(impact2, { x: left + 48, y, size: 7.2, font, color: cSubtle });
      y -= 10.5;
    }
    y -= 4;
  }

  const pid7Repos = [
    { name: 'turbofox', url: 'https://github.com/pid7-org/turbofox' },
    { name: 'ashwa', url: 'https://github.com/pid7-org/ashwa' },
    { name: 'turbo_crc', url: 'https://github.com/pid7-org/turbo_crc' },
    { name: 'frozen-core', url: 'https://github.com/pid7-org/frozen-core' },
    { name: 'kosa', url: 'https://github.com/pid7-org/kosa' }
  ];

  drawExperienceEntry({
    tag: 'Systems Engineering · pid7-org',
    period: 'Sep 2024 — Present',
    role: 'Core Contributor · Systems Architecture & Implementation',
    repos: pid7Repos,
    stack: 'Core: Rust · SIMD | Concurrency: Lock-Free | Storage: Memory-Mapped I/O',
    impact: 'Shipped a lock-free concurrent KV engine with memory-mapped I/O and explicit sync barriers;',
    impact2: 'production SIMD paths prioritize deterministic latency and memory efficiency'
  });

  drawExperienceEntry({
    tag: 'Freelance & Contract · Web & Tooling',
    period: 'Jul 2024 — Present',
    role: 'Full-Stack Developer & Tooling Engineer · 3 Clients',
    stack: 'Frontend: Astro · TypeScript | Backend: Microservices | Tooling: VS Code API',
    impact: 'Delivered transactional email service and event-ticketing platform end to end;',
    impact2: 'built VS Code extensions for internal developer workflows across client projects'
  });

  drawExperienceEntry({
    tag: 'Internships · Mobile Engineering',
    period: 'Nov 2021 — Apr 2024 · 9 mos total',
    orgs: 'kraftbase (1 mo) · Rojgary (5 mos) · FOLKDevelopers (3 mos)',
    stack: 'Flutter · Dart · Reactive State Management · REST APIs',
    impact: 'Built MVP mobile apps for clients from scratch, refactored codebases & enhanced reliability'
  });

  // 3. PROJECTS
  drawSectionHeader('Projects', 'featured projects across orgs & personal');
  const featuredProjects = [
    {
      name: 'turbofox',
      url: 'https://github.com/pid7-org/turbofox',
      desc: 'Embedded concurrent KV storage engine with memory-mapped persistence & lock-free index'
    },
    {
      name: 'ashwa',
      url: 'https://github.com/pid7-org/ashwa',
      desc: 'Hardware accelerated routines for single substring search using AVX2 SIMD intrinsics'
    },
    {
      name: 'turbo_crc',
      url: 'https://github.com/pid7-org/turbo_crc',
      desc: 'Hardware accelerated CRC32C checksum calculation using dedicated CPU instructions'
    },
    {
      name: 'shyena',
      url: 'https://github.com/adityamotale/shyena',
      desc: 'Keyboard-first automation launcher & transient PowerShell runtime for Windows'
    }
  ];

  for (const proj of featuredProjects) {
    const nameW = drawClickableText(proj.name, left, y, 7.2, proj.url, cPine, cDot, true);
    page.drawText(` — ${proj.desc}`, {
      x: left + nameW,
      y,
      size: 7.2,
      font,
      color: cSubtle
    });
    y -= 11;
  }

  // 4. WRITING (Dedicated Section)
  drawSectionHeader('Writing', 'technical essays & deep dives');
  const postsToShow = blogPosts.slice(0, 2);
  if (postsToShow.length === 0) {
    postsToShow.push({
      title: "There's More to Performance Than Big-O",
      slug: 'theres-more-to-performance-than-big-o',
      date: '15-09-2026'
    });
  }

  for (const post of postsToShow) {
    drawClickableText(post.title, left, y, 7.2, `https://adii.fyi/blog/${post.slug}`, cText, cDot);
    const dateW = font.widthOfTextAtSize(post.date, 7.2);
    page.drawText(post.date, { x: right - dateW, y, size: 7.2, font, color: cMuted });
    y -= 11;
  }

  // 5. TELEMETRY (Dedicated Section)
  drawSectionHeader('Telemetry', 'metrics');

  function getAsciiBar(pct, len = 14) {
    const safePct = Math.max(0, Math.min(100, pct));
    const filled = Math.min(len, Math.floor((safePct / 100) * len));
    const empty = len - filled;
    return {
      filled: '█'.repeat(filled),
      empty: '░'.repeat(empty),
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
  const netLines = loc.net_lines || 87823;
  const totalAdd = loc.total_additions || 201200;
  const totalDel = loc.total_deletions || 113400;
  const totalChurn = totalAdd + totalDel;
  const addRatio = totalChurn > 0 ? (totalAdd / totalChurn) * 100 : 64.0;
  const churnBar = getAsciiBar(addRatio, 12);

  const reposContributed = stats.repositories_contributed_to?.length || stats.repositories?.total || 53;
  const pubRepos = stats.repositories?.public || 18;
  const privRepos = stats.repositories?.private || 10;

  const totalCommits = stats.contributions?.commits || 3580;
  const prMergeRate = stats.pull_requests?.merge_rate_percentage || 97.4;
  const prBar = getAsciiBar(prMergeRate, 12);

  const activityRate = stats.streaks_and_consistency?.activity_rate_percentage || 95.7;
  const streakBar = getAsciiBar(activityRate, 12);

  const longestStreak = stats.streaks_and_consistency?.longest_streak_days || 112;
  const currentStreak = stats.streaks_and_consistency?.current_streak_days || 12;
  const activeDays = stats.streaks_and_consistency?.active_days_count || 1036;

  const topLangs = (stats.languages || [])
    .slice(0, 4)
    .map((l) => `${l.name} ${Math.round(l.percentage)}%`)
    .join(' · ') || 'Rust 73% · TS 8% · C 7% · Asm 4%';

  const col1X = left;
  const col2X = left + 265;
  const charW = font.widthOfTextAtSize('█', 7.2);

  // Row 1: loc & prs
  page.drawText('&', { x: col1X, y, size: 7.2, font, color: cMuted });
  page.drawText('loc:', { x: col1X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${fmt.format(netLines)} (+${formatCompact(totalAdd)} / -${formatCompact(totalDel)})`, { x: col1X + 48, y, size: 7.2, font, color: cText });

  page.drawText('+', { x: col2X, y, size: 7.2, font, color: cMuted });
  page.drawText('prs:', { x: col2X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText('[', { x: col2X + 48, y, size: 7.2, font, color: cMuted });
  page.drawText(prBar.filled, { x: col2X + 48 + charW, y, size: 7.2, font, color: cFoam });
  page.drawText(prBar.empty, { x: col2X + 48 + charW + (prBar.filled.length * charW), y, size: 7.2, font, color: cBorder });
  page.drawText(`] ${prBar.pctFormatted}`, { x: col2X + 48 + charW + (12 * charW), y, size: 7.2, font, color: cText });
  y -= 11.5;

  // Row 2: churn & active
  page.drawText('%', { x: col1X, y, size: 7.2, font, color: cMuted });
  page.drawText('churn:', { x: col1X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText('[', { x: col1X + 48, y, size: 7.2, font, color: cMuted });
  page.drawText(churnBar.filled, { x: col1X + 48 + charW, y, size: 7.2, font, color: cPine });
  page.drawText(churnBar.empty, { x: col1X + 48 + charW + (churnBar.filled.length * charW), y, size: 7.2, font, color: cBorder });
  page.drawText(`] ${churnBar.pctFormatted}`, { x: col1X + 48 + charW + (12 * charW), y, size: 7.2, font, color: cText });

  page.drawText('@', { x: col2X, y, size: 7.2, font, color: cMuted });
  page.drawText('active:', { x: col2X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText('[', { x: col2X + 48, y, size: 7.2, font, color: cMuted });
  page.drawText(streakBar.filled, { x: col2X + 48 + charW, y, size: 7.2, font, color: cGold });
  page.drawText(streakBar.empty, { x: col2X + 48 + charW + (streakBar.filled.length * charW), y, size: 7.2, font, color: cBorder });
  page.drawText(`] ${streakBar.pctFormatted}`, { x: col2X + 48 + charW + (12 * charW), y, size: 7.2, font, color: cText });
  y -= 11.5;

  // Row 3: repos & streak
  page.drawText('#', { x: col1X, y, size: 7.2, font, color: cMuted });
  page.drawText('repos:', { x: col1X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${reposContributed} (${pubRepos} pub · ${privRepos} pri)`, { x: col1X + 48, y, size: 7.2, font, color: cText });

  page.drawText('^', { x: col2X, y, size: 7.2, font, color: cMuted });
  page.drawText('streak:', { x: col2X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${currentStreak}d current (${longestStreak}d max)`, { x: col2X + 48, y, size: 7.2, font, color: cText });
  y -= 11.5;

  // Row 4: commits & stack
  page.drawText('*', { x: col1X, y, size: 7.2, font, color: cMuted });
  page.drawText('commits:', { x: col1X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${fmt.format(totalCommits)} (${activeDays}d active)`, { x: col1X + 48, y, size: 7.2, font, color: cText });

  page.drawText('$', { x: col2X, y, size: 7.2, font, color: cMuted });
  page.drawText('stack:', { x: col2X + 10, y, size: 7.2, font, color: cSubtle });
  page.drawText(topLangs, { x: col2X + 48, y, size: 7.2, font, color: cText });
  y -= 4;

  // 6. EDUCATION
  drawSectionHeader('Education', 'degree & background');
  const eduCol1 = left;
  const eduCol2 = left + 265;

  page.drawText('degree:', { x: eduCol1, y, size: 7.2, font, color: cSubtle });
  page.drawText('B.Tech (CSE)', { x: eduCol1 + 48, y, size: 7.2, font: fontBold, color: cText });

  page.drawText('period:', { x: eduCol2, y, size: 7.2, font, color: cSubtle });
  page.drawText('Jun 2020 – Jun 2024 (4 yrs)', { x: eduCol2 + 48, y, size: 7.2, font, color: cText });
  y -= 11.5;

  page.drawText('major:', { x: eduCol1, y, size: 7.2, font, color: cSubtle });
  page.drawText('Computer Science & Engineering', { x: eduCol1 + 48, y, size: 7.2, font, color: cText });

  page.drawText('inst:', { x: eduCol2, y, size: 7.2, font, color: cSubtle });
  page.drawText('Marathwada Inst. of Technology', { x: eduCol2 + 48, y, size: 7.2, font, color: cText });

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
