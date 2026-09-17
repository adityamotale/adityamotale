import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllBlogPosts } from '../blog.ts';
import { validateBlogPost, validateAllBlogPosts } from '../validator.ts';
import { parseMarkdownBlog } from 'mdparser';

describe('blogs_validator: Catching Authoring Mistakes (Unit Checks)', () => {
  it('catches missing or invalid frontmatter fields', async () => {
    const invalidPost = `---
slug: Invalid Slug With Spaces!
title:
created: 99-99-9999
tags:
---
Post body text.`;

    const parsed = await parseMarkdownBlog(invalidPost);
    const errors = validateBlogPost(parsed);

    assert.ok(errors.some((e) => e.field === 'slug'));
    assert.ok(errors.some((e) => e.field === 'title'));
    assert.ok(errors.some((e) => e.field === 'created'));
    assert.ok(errors.some((e) => e.field === 'tags'));
  });

  it('catches unlinked footnote citations', async () => {
    const postWithBrokenFootnote = `---
slug: broken-footnote
title: Post with Missing Reference
created: 01-09-2026
tags: test
---
Here is a citation[^missing-ref] that has no definition.

@references

[^other-ref]: Other reference.
`;

    const parsed = await parseMarkdownBlog(postWithBrokenFootnote);
    const errors = validateBlogPost(parsed);

    assert.ok(
      errors.some(
        (e) =>
          e.field === 'references' &&
          e.message.includes("Footnote citation '[^missing-ref]'")
      )
    );
  });

  it('catches duplicate slugs across multiple posts', async () => {
    const post1 = await parseMarkdownBlog(`---
slug: duplicate-slug
title: Post 1
created: 01-09-2026
tags: a
---
Content 1`);

    const post2 = await parseMarkdownBlog(`---
slug: duplicate-slug
title: Post 2
created: 02-09-2026
tags: b
---
Content 2`);

    const errors = validateAllBlogPosts([post1, post2]);
    assert.ok(
      errors.some((e) => e.message.includes("Duplicate slug 'duplicate-slug'"))
    );
  });
});

describe('Live Blog Post Content Validator (blogs/ integrity suite)', () => {
  it('validates all live blog posts in blogs/ directory for formatting and structure', async () => {
    const posts = await getAllBlogPosts();
    assert.ok(
      posts.length > 0,
      'Should find at least one blog post in blogs/ directory'
    );

    const validationErrors = validateAllBlogPosts(posts);
    if (validationErrors.length > 0) {
      const formattedErrors = validationErrors
        .map((e) => `  - [${e.slug || 'unknown'}][${e.field}]: ${e.message}`)
        .join('\n');
      assert.fail(
        `Blog validation failed with ${validationErrors.length} error(s):\n${formattedErrors}`
      );
    }

    for (const post of posts) {
      assert.ok(
        post.frontmatter.title,
        `Post '${post.frontmatter.slug}' missing title`
      );
      assert.ok(post.frontmatter.slug, 'Post missing slug');
      assert.match(
        post.frontmatter.created,
        /^(?:\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/,
        `Post '${post.frontmatter.slug}' has invalid created date`
      );
      assert.ok(
        Array.isArray(post.frontmatter.tags) &&
          post.frontmatter.tags.length > 0,
        `Post '${post.frontmatter.slug}' missing tags`
      );
      assert.ok(
        post.html.length > 0,
        `Post '${post.frontmatter.slug}' HTML is empty`
      );
      assert.ok(
        post.wordCount > 0,
        `Post '${post.frontmatter.slug}' word count is 0`
      );
      assert.ok(
        post.readTimeMinutes >= 1,
        `Post '${post.frontmatter.slug}' read time < 1 min`
      );
    }
  });
});
