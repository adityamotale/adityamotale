import type { APIRoute } from 'astro';
import { getAllBlogPosts } from '../lib/blog';

function formatISODate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    } else if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ? site.href.replace(/\/$/, '') : 'https://adii.fyi';
  const posts = await getAllBlogPosts();

  const blogEntries = posts
    .map((post) => {
      const lastMod = formatISODate(
        post.frontmatter.lastUpdated || post.frontmatter.created
      );
      return `  <url>
    <loc>${baseUrl}/blogs/${post.frontmatter.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${blogEntries}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
