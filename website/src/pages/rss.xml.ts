import type { APIRoute } from 'astro';
import { getAllBlogPosts, parseDateToTimestamp } from '../lib/blog';

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ? site.href.replace(/\/$/, '') : 'https://adii.fyi';
  const posts = await getAllBlogPosts();

  const items = posts
    .map((post) => {
      const timestamp = parseDateToTimestamp(post.frontmatter.created);
      const pubDate = timestamp
        ? new Date(timestamp).toUTCString()
        : new Date().toUTCString();
      const desc =
        post.frontmatter.description ||
        post.frontmatter.title ||
        'an engineer by choice';
      const categories = (post.frontmatter.tags || [])
        .map((t) => `      <category><![CDATA[${t}]]></category>`)
        .join('\n');
      return `    <item>
      <title><![CDATA[${post.frontmatter.title}]]></title>
      <description><![CDATA[${desc}]]></description>
      <link>${baseUrl}/blogs/${post.frontmatter.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blogs/${post.frontmatter.slug}</guid>
      <pubDate>${pubDate}</pubDate>
${categories ? `${categories}\n` : ''}    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>aditya motale ~ an engineer by choice</title>
    <description>an engineer by choice</description>
    <link>${baseUrl}/</link>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
${items}
  </channel>
</rss>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
