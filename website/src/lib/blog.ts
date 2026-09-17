import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parseMarkdownBlog } from './md_parser/index.ts';
import type { ParsedBlogPost } from './md_parser/types.ts';

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
      // Format: DD-MM-YYYY
      return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0])
      ).getTime();
    } else if (parts[0].length === 4) {
      // Format: YYYY-MM-DD
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
