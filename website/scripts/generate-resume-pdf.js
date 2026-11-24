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

// User contact credentials
const CONTACT = {
  email: 'adityamotale.22@gmail.com',
  phone: '+91 8329437944',
  site: 'https://adii.fyi',
  github: 'https://github.com/adityamotale',
  twitter: 'https://x.com/arctic_byte',
  linkedin: 'https://www.linkedin.com/in/aditya-motale'
};

let stats = {
  categories: {
    organization: { commits: 2218 },
    personal: { commits: 1550 },
    external_oss: { total_contributions: 11 }
  },
  lines_of_code: { net_lines: 87823, total_additions: 1748252, total_deletions: 926304 },
  repositories: { public: 18, private: 10, total: 53 },
  contributions: { commits: 3580 },
  streaks_and_consistency: { current_streak_days: 12, longest_streak_days: 112, active_days_count: 1036, activity_rate_percentage: 95.7 },
  pull_requests: { merge_rate_percentage: 97.4, merged: 228, total: 234 },
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

function formatBlogDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

function parseDateToTimestamp(dStr) {
  if (!dStr) return 0;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    } else if (parts[0].length === 4) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    }
  }
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
}

async function getRecentWritingList(limit = 5) {
  const items = [];

  // Local blog posts
  if (fs.existsSync(blogsDir)) {
    const files = fs.readdirSync(blogsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const raw = fs.readFileSync(path.join(blogsDir, f), 'utf-8');
      const titleMatch = raw.match(/^title:\s*(.*)$/m);
      const slugMatch = raw.match(/^slug:\s*(.*)$/m);
      const dateMatch = raw.match(/^created:\s*(.*)$/m);
      if (titleMatch && slugMatch) {
        const rawDate = dateMatch ? dateMatch[1].trim() : '';
        items.push({
          title: titleMatch[1].trim(),
          url: `https://adii.fyi/blog/${slugMatch[1].trim()}`,
          dateStr: formatBlogDate(rawDate),
          timestamp: parseDateToTimestamp(rawDate),
          isExternal: false
        });
      }
    }
  }

  // Fetch pid7 blog posts if reachable
  try {
    const sitemapRes = await fetch('https://pid7.com/sitemap.xml', {
      signal: AbortSignal.timeout(2000)
    });
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
      for (const block of urlBlocks) {
        const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
        const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
        if (!locMatch || !locMatch[1].includes('/blog/')) continue;
        const loc = locMatch[1].trim();
        const lastmod = lastmodMatch ? lastmodMatch[1].trim() : '';

        try {
          const pageRes = await fetch(loc, { signal: AbortSignal.timeout(2000) });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch
              ? titleMatch[1].replace(/^pid7\s*[×\-–—|]\s*/i, '').trim()
              : loc.split('/').filter(Boolean).pop().replace(/[-_]/g, ' ');
            const pubDateMatch = html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i);
            const dateVal = pubDateMatch ? pubDateMatch[1] : lastmod;
            items.push({
              title,
              url: loc,
              dateStr: formatBlogDate(dateVal),
              timestamp: parseDateToTimestamp(dateVal),
              isExternal: true
            });
          }
        } catch {}
      }
    }
  } catch {}

  // Fallback to ensure pid7 articles are included even in offline/sandboxed execution
  if (!items.some((p) => p.url.includes('pid7.com'))) {
    items.push({
      title: 'Searching through 150 GiB of Text per Second with SIMD',
      url: 'https://pid7.com/blog/searching-150gb-text-per-second',
      dateStr: formatBlogDate('13-11-2026'),
      timestamp: parseDateToTimestamp('13-11-2026'),
      isExternal: true
    });
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, limit);
}

export async function generateResumePdf() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  doc.setProducer('pdf-lib');

  const fontRegularPath = path.resolve(rootDir, 'website/fonts/JetBrainsMono-Regular.ttf');
  const fontBoldPath = path.resolve(rootDir, 'website/fonts/JetBrainsMono-Bold.ttf');
  const fontSerifPath = path.resolve(
    rootDir,
    'website/node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff'
  );

  const regularBytes = fs.readFileSync(fontRegularPath);
  const boldBytes = fs.readFileSync(fontBoldPath);
  const serifBytes = fs.readFileSync(fontSerifPath);

  const font = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });
  const fontSerifItalic = await doc.embedFont(serifBytes, { subset: true });

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

  function drawSectionHeader(title, comment = '') {
    y -= 17;
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
      y -= 9.5;
      page.drawText(`// ${comment}`, { x: left + 10, y, size: 6.8, font, color: cMuted });
    }
    y -= 9.5;
  }

  // Header: Wordmark "aditya" in Instrument Serif Italic & Site Link
  const logoSize = 28;
  const logoBaseline = y - 18;
  page.drawText('aditya', {
    x: left,
    y: logoBaseline,
    size: logoSize,
    font: fontSerifItalic,
    color: cAccent
  });
  const logoW = fontSerifItalic.widthOfTextAtSize('aditya', logoSize);
  addLink([left, logoBaseline - 4, left + logoW, logoBaseline + logoSize], CONTACT.site);

  const siteUrlW = font.widthOfTextAtSize(CONTACT.site, 8);
  drawClickableText(CONTACT.site, right - siteUrlW, logoBaseline + 2, 8, CONTACT.site, cAccent, cAccent);

  // Contact details directly below wordmark
  y = logoBaseline - 16;
  let curContactX = left;
  page.drawText('email: ', { x: curContactX, y, size: 7.2, font, color: cMuted });
  curContactX += font.widthOfTextAtSize('email: ', 7.2);
  curContactX += drawClickableText(CONTACT.email, curContactX, y, 7.2, `mailto:${CONTACT.email}`, cText, cDot);

  page.drawText('  ·  phone: ', { x: curContactX, y, size: 7.2, font, color: cMuted });
  curContactX += font.widthOfTextAtSize('  ·  phone: ', 7.2);
  curContactX += drawClickableText(CONTACT.phone, curContactX, y, 7.2, `tel:${CONTACT.phone.replace(/[\s-]/g, '')}`, cText, cDot);

  // Social / Profiles row
  y -= 11.5;
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
    y -= 3.5;
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
    y -= 10.5;
  }

  // 4. WRITING (Top 5 posts matching homepage including pid7 posts)
  drawSectionHeader('Writing', 'recent posts');
  const writingList = await getRecentWritingList(5);

  for (const post of writingList) {
    const postTitleW = drawClickableText(post.title, left, y, 7.2, post.url, cText, cDot);
    if (post.isExternal) {
      page.drawText(' [ext ↗]', {
        x: left + postTitleW,
        y,
        size: 6.5,
        font,
        color: cMuted
      });
    }
    const dateW = font.widthOfTextAtSize(post.dateStr, 7.2);
    page.drawText(post.dateStr, { x: right - dateW, y, size: 7.2, font, color: cMuted });
    y -= 10.5;
  }

  // 5. TELEMETRY (3x2 Grid matching homepage structure)
  drawSectionHeader('Telemetry', 'metrics');

  const formatCompact = (num) => {
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return String(num);
  };

  // Scope
  const orgCommits = stats.categories?.organization?.commits ?? 2218;
  const personalCommits = stats.categories?.personal?.commits ?? 1550;
  const ossContribs = stats.categories?.external_oss?.total_contributions ?? 11;
  const totalScope = orgCommits + personalCommits + ossContribs || 1;
  const orgPct = Math.round((orgCommits / totalScope) * 100);
  const personalPct = Math.round((personalCommits / totalScope) * 100);

  // PRs
  const prData = stats.pull_requests || {};
  const prMergeRate = (prData.merge_rate_percentage ?? 97.4).toFixed(1);
  const prMerged = prData.merged ?? 228;

  // Churn
  const loc = stats.lines_of_code || {};
  const addFormatted = formatCompact(loc.total_additions || 1748252);
  const delFormatted = formatCompact(loc.total_deletions || 926304);
  const addDelRatio = ((loc.total_additions || 1748252) / ((loc.total_deletions || 926304) || 1)).toFixed(2);

  // Streak
  const streaks = stats.streaks_and_consistency || {};
  const currentStreak = streaks.current_streak_days ?? 12;
  const longestStreak = streaks.longest_streak_days ?? 112;

  // Languages
  const languages = stats.languages || [];
  const getLangPct = (name, fallback) => {
    const found = languages.find((l) => l.name === name);
    return found ? Math.round(found.percentage) : fallback;
  };
  const rustPct = getLangPct('Rust', 73);
  const cPct = getLangPct('C', 7);
  const tsPct = getLangPct('TypeScript', 8);
  const asmPct = getLangPct('Assembly', 4);

  // Repositories
  const reposContributed = stats.repositories_contributed_to?.length || stats.repositories?.total || 53;
  const reposPublic = stats.repositories?.public ?? 18;
  const reposPrivate = stats.repositories?.private ?? 10;

  const col1X = left;
  const col2X = left + 265;

  // Row 1: prs (left) & scope (right)
  page.drawText('prs:', { x: col1X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${prMergeRate}% merge rate`, { x: col1X + 44, y, size: 7.2, font: fontBold, color: cText });
  const prMergeW = fontBold.widthOfTextAtSize(`${prMergeRate}% merge rate`, 7.2);
  page.drawText(` (${prMerged} merged)`, { x: col1X + 44 + prMergeW, y, size: 7.2, font, color: cMuted });

  page.drawText('scope:', { x: col2X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${orgPct}% org`, { x: col2X + 44, y, size: 7.2, font: fontBold, color: cText });
  const orgW = fontBold.widthOfTextAtSize(`${orgPct}% org`, 7.2);
  page.drawText(' · ', { x: col2X + 44 + orgW, y, size: 7.2, font, color: cMuted });
  const dotW1 = font.widthOfTextAtSize(' · ', 7.2);
  page.drawText(`${personalPct}% personal`, { x: col2X + 44 + orgW + dotW1, y, size: 7.2, font, color: cSubtle });
  y -= 11;

  // Row 2: churn (left) & streak (right)
  page.drawText('churn:', { x: col1X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${addDelRatio}:1 ratio`, { x: col1X + 44, y, size: 7.2, font: fontBold, color: cText });
  const churnRatioW = fontBold.widthOfTextAtSize(`${addDelRatio}:1 ratio`, 7.2);
  page.drawText(` (+${addFormatted} / -${delFormatted})`, { x: col1X + 44 + churnRatioW, y, size: 7.2, font, color: cMuted });

  page.drawText('streak:', { x: col2X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${currentStreak}d current`, { x: col2X + 44, y, size: 7.2, font: fontBold, color: cText });
  const streakW = fontBold.widthOfTextAtSize(`${currentStreak}d current`, 7.2);
  page.drawText(` (${longestStreak}d max)`, { x: col2X + 44 + streakW, y, size: 7.2, font, color: cMuted });
  y -= 11;

  // Row 3: stack (left) & repos (right)
  page.drawText('stack:', { x: col1X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`Rust ${rustPct}%`, { x: col1X + 44, y, size: 7.2, font: fontBold, color: cText });
  const rustW = fontBold.widthOfTextAtSize(`Rust ${rustPct}%`, 7.2);
  page.drawText(' · ', { x: col1X + 44 + rustW, y, size: 7.2, font, color: cMuted });
  const dotW2 = font.widthOfTextAtSize(' · ', 7.2);
  page.drawText(`TS ${tsPct}% · C ${cPct}% · Asm ${asmPct}%`, { x: col1X + 44 + rustW + dotW2, y, size: 7.2, font, color: cSubtle });

  page.drawText('repos:', { x: col2X, y, size: 7.2, font, color: cSubtle });
  page.drawText(`${reposContributed} tracked`, { x: col2X + 44, y, size: 7.2, font: fontBold, color: cText });
  const reposW = fontBold.widthOfTextAtSize(`${reposContributed} tracked`, 7.2);
  page.drawText(` (${reposPublic} pub · ${reposPrivate} pri)`, { x: col2X + 44 + reposW, y, size: 7.2, font, color: cMuted });

  // 6. EDUCATION
  drawSectionHeader('Education', 'degree & background');
  const eduCol1 = left;
  const eduCol2 = left + 265;

  page.drawText('degree:', { x: eduCol1, y, size: 7.2, font, color: cSubtle });
  page.drawText('B.Tech (CSE)', { x: eduCol1 + 44, y, size: 7.2, font: fontBold, color: cText });

  page.drawText('period:', { x: eduCol2, y, size: 7.2, font, color: cSubtle });
  page.drawText('Jun 2020 – Jun 2024 (4 yrs)', { x: eduCol2 + 44, y, size: 7.2, font, color: cText });
  y -= 11;

  page.drawText('major:', { x: eduCol1, y, size: 7.2, font, color: cSubtle });
  page.drawText('Computer Science & Engineering', { x: eduCol1 + 44, y, size: 7.2, font, color: cText });

  page.drawText('inst:', { x: eduCol2, y, size: 7.2, font, color: cSubtle });
  page.drawText('Marathwada Inst. of Technology', { x: eduCol2 + 44, y, size: 7.2, font, color: cText });

  return await doc.save();
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate aditya.pdf as requested
const outputPath = path.resolve(publicDir, 'aditya.pdf');
const legacyPath = path.resolve(publicDir, 'adityamotale.pdf');

generateResumePdf().then((pdfBytes) => {
  const newBuffer = Buffer.from(pdfBytes);

  fs.writeFileSync(outputPath, newBuffer);
  // Also preserve adityamotale.pdf for test and script compatibility
  fs.writeFileSync(legacyPath, newBuffer);

  console.log(`✅ Resume PDF successfully generated at: ${outputPath} (${pdfBytes.length} bytes)`);
}).catch((err) => {
  console.error('❌ Failed to generate resume PDF:', err);
  process.exit(1);
});
