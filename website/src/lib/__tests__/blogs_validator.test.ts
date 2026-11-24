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
