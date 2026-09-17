import type { APIContext } from 'astro';
import { getAllBlogPosts, parseDateToTimestamp } from '../lib/blog';

export async function GET(context: APIContext) {
  const site = context.site
    ? context.site.href.replace(/\/$/, '')
    : 'https://adii.fyi';
  const posts = await getAllBlogPosts();

  const staticUrls = [
    {
      loc: `${site}/`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: '1.0',
    },
  ];

  const blogUrls = posts.map((post) => {
    const timestamp =
      parseDateToTimestamp(post.frontmatter.lastUpdated) ||
      parseDateToTimestamp(post.frontmatter.created);
    const lastmod = timestamp
      ? new Date(timestamp).toISOString()
      : new Date().toISOString();
    return {
      loc: `${site}/blogs/${post.frontmatter.slug}/`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.8',
    };
  });

  const allUrls = [...staticUrls, ...blogUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
