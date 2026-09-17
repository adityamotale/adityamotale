import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { formatBlogDate, parseDateToTimestamp } from '../blog.ts';
import { parseMarkdownBlog } from '../md_parser/index.ts';

const DUMMY_BLOG_A = `---
slug: test-blog-a
title: Blog A Title
created: 01-08-2026
tags: rust
---
First post content.`;

const DUMMY_BLOG_B = `---
slug: test-blog-b
title: Blog B Title
created: 15-09-2026
tags: simd
---
Second post content with table:

| Col1 | Col2 |
|---|---|
| A | B |
`;

const DUMMY_BLOG_C = `---
slug: test-blog-c
title: Blog C Title
created: 10-09-2026
tags: performance
---
Third post content.`;

describe('blog: Date Formatting & Timestamp Utilities', () => {
  it('formats DD-MM-YYYY dates correctly', () => {
    assert.equal(formatBlogDate('15-09-2026'), 'Sep 15, 2026');
    assert.equal(formatBlogDate('01-01-2026'), 'Jan 1, 2026');
  });

  it('formats YYYY-MM-DD dates correctly', () => {
    assert.equal(formatBlogDate('2026-09-15'), 'Sep 15, 2026');
  });

  it('returns raw string for unrecognized formats or empty strings', () => {
    assert.equal(formatBlogDate(''), '');
    assert.equal(formatBlogDate('unknown-date'), 'unknown-date');
  });

  it('converts DD-MM-YYYY and YYYY-MM-DD to comparable timestamps', () => {
    const tsA = parseDateToTimestamp('01-08-2026');
    const tsB = parseDateToTimestamp('15-09-2026');
    const tsC = parseDateToTimestamp('10-09-2026');

    assert.ok(tsB > tsC);
    assert.ok(tsC > tsA);
  });
});

describe('blog: Chronological Sorting on Dummy Posts', () => {
  it('sorts dummy posts descending by created date (most recent first)', async () => {
    const postA = await parseMarkdownBlog(DUMMY_BLOG_A);
    const postB = await parseMarkdownBlog(DUMMY_BLOG_B);
    const postC = await parseMarkdownBlog(DUMMY_BLOG_C);

    const unsorted = [postA, postB, postC];
    const sorted = unsorted.sort(
      (a, b) =>
        parseDateToTimestamp(b.frontmatter.created) -
        parseDateToTimestamp(a.frontmatter.created)
    );

    assert.equal(sorted[0].frontmatter.slug, 'test-blog-b'); // 15-09-2026
    assert.equal(sorted[1].frontmatter.slug, 'test-blog-c'); // 10-09-2026
    assert.equal(sorted[2].frontmatter.slug, 'test-blog-a'); // 01-08-2026
  });

  it('limits top recent posts correctly', async () => {
    const postA = await parseMarkdownBlog(DUMMY_BLOG_A);
    const postB = await parseMarkdownBlog(DUMMY_BLOG_B);
    const postC = await parseMarkdownBlog(DUMMY_BLOG_C);

    const sorted = [postB, postC, postA];
    const top2 = sorted.slice(0, 2);

    assert.equal(top2.length, 2);
    assert.equal(top2[0].frontmatter.slug, 'test-blog-b');
    assert.equal(top2[1].frontmatter.slug, 'test-blog-c');
  });
});
