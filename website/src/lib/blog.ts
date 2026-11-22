import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parseMarkdownBlog } from 'mdparser';
import type { ParsedBlogPost } from 'mdparser';

export function getBlogDir(): string {
  const candidate1 = path.resolve(process.cwd(), 'blogs');
  const candidate2 = path.resolve(process.cwd(), '../blogs');
  if (fsSync.existsSync(candidate1)) return candidate1;
  if (fsSync.existsSync(candidate2)) return candidate2;
  return candidate2;
}

export function formatBlogDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
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

export function parseDateToTimestamp(dStr: string): number {
  if (!dStr) return 0;
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0])
      ).getTime();
    } else if (parts[0].length === 4) {
      return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
      ).getTime();
    }
  }
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
}

export async function getAllBlogPosts(): Promise<ParsedBlogPost[]> {
  try {
    const blogDir = getBlogDir();
    const files = await fs.readdir(blogDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const posts: ParsedBlogPost[] = [];
    for (const file of mdFiles) {
      const filePath = path.join(blogDir, file);
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const parsed = await parseMarkdownBlog(rawContent);
      posts.push(parsed);
    }

    return posts.sort((a, b) => {
      return (
        parseDateToTimestamp(b.frontmatter.created) -
        parseDateToTimestamp(a.frontmatter.created)
      );
    });
  } catch {
    return [];
  }
}

export interface WritingItem {
  title: string;
  url: string;
  dateStr: string;
  timestamp: number;
  isExternal?: boolean;
}

export function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return '';
  return match[1].replace(/^pid7\s*[×\-–—|]\s*/i, '').trim();
}

export async function fetchPid7BlogPosts(): Promise<WritingItem[]> {
  try {
    const sitemapRes = await fetch('https://pid7.com/sitemap.xml', {
      signal: AbortSignal.timeout(5000),
    });
    if (!sitemapRes.ok) return [];

    const xml = await sitemapRes.text();
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    const blogEntries: { loc: string; lastmod: string }[] = [];

    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
      const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (!locMatch) continue;

      const loc = locMatch[1].trim();
      if (!loc.includes('/blog/')) continue;

      blogEntries.push({
        loc,
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : '',
      });
    }

    const items: WritingItem[] = [];
    await Promise.all(
      blogEntries.map(async ({ loc, lastmod }) => {
        try {
          const pageRes = await fetch(loc, {
            signal: AbortSignal.timeout(5000),
          });
          if (!pageRes.ok) return;

          const html = await pageRes.text();
          let title = extractTitleFromHtml(html);
          if (!title) {
            const slug = loc.split('/').filter(Boolean).pop() || '';
            title = slug.replace(/[-_]/g, ' ');
          }

          const pubDateMatch =
            html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i) ||
            html.match(
              /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i
            );

          const dateStr = pubDateMatch ? pubDateMatch[1] : lastmod;
          items.push({
            title,
            url: loc,
            dateStr,
            timestamp: parseDateToTimestamp(dateStr),
            isExternal: true,
          });
        } catch {
          // fallback if individual post fetch fails
          const slug = loc.split('/').filter(Boolean).pop() || '';
          items.push({
            title: slug.replace(/[-_]/g, ' '),
            url: loc,
            dateStr: lastmod,
            timestamp: parseDateToTimestamp(lastmod),
            isExternal: true,
          });
        }
      })
    );

    return items;
  } catch {
    return [];
  }
}

export async function getRecentWriting(limit = 5): Promise<WritingItem[]> {
  const [localPosts, pid7Posts] = await Promise.all([
    getAllBlogPosts(),
    fetchPid7BlogPosts(),
  ]);

  const items: WritingItem[] = [
    ...localPosts.map((p) => ({
      title: p.frontmatter.title,
      url: `/blogs/${p.frontmatter.slug}`,
      dateStr: p.frontmatter.created,
      timestamp: parseDateToTimestamp(p.frontmatter.created),
      isExternal: false,
    })),
    ...pid7Posts,
  ];

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, limit);
}

export async function getBlogPostBySlug(
  slug: string
): Promise<ParsedBlogPost | undefined> {
  const posts = await getAllBlogPosts();
  return posts.find(
    (p) =>
      p.frontmatter.slug === slug ||
      p.frontmatter.slug.toLowerCase() === slug.toLowerCase()
  );
}

export async function getTopRecentBlogPosts(
  limit = 5
): Promise<ParsedBlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts.slice(0, limit);
}
