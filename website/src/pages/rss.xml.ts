import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllBlogPosts, parseDateToTimestamp } from '../lib/blog';

export async function GET(context: APIContext) {
  const posts = await getAllBlogPosts();
  return rss({
    title: 'aditya motale ~ an engineer by choice',
    description: 'an engineer by choice',
    site: context.site || 'https://adii.fyi',
    items: posts.map((post) => {
      const timestamp = parseDateToTimestamp(post.frontmatter.created);
      const pubDate = timestamp ? new Date(timestamp) : new Date();
      return {
        title: post.frontmatter.title,
        pubDate,
        description: post.frontmatter.description || post.frontmatter.title,
        link: `/blogs/${post.frontmatter.slug}/`,
        categories: post.frontmatter.tags || [],
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
