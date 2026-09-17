# mdparser

An opinionated, fast Markdown blog compiler with built-in LaTeX equations, Shiki syntax highlighting, responsive tables, callouts, footnotes, and post validation.

## Features

- **YAML Frontmatter**: Parses title, slug, created/lastUpdated dates, tags, and description.
- **GFM Markdown Tables**: Responsive table blocks with column alignments (`:---`, `:---:`, `---:`) and cell styling (bold, italics, code, math).
- **Custom Blocks**: `<>` and `~` containers with language tags, copy buttons, and captions (`@desc`).
- **LaTeX Math**: Inline `$math$` and display `$$math$$` powered by KaTeX.
- **Callouts**: `> [!INFO]`, `> [!TIP]`, `> [!NOTE]`, `> [!TASK]`, `> [!WARNING]`, `> [!CAUTION]`.
- **Glossary & Footnotes**: Automatic extraction of `@glossary` definitions and `@references` footnote anchors.
- **Integrity Validation**: Built-in validator catching syntax leaks, unlinked citations, bad dates, and malformed tags.

## Installation

### In Local Workspace / Monorepo (Dev Dependency)

```json
{
  "devDependencies": {
    "mdparser": "file:../mdparser"
  }
}
```

### In Other Projects via GitHub

To install directly from GitHub without publishing to npm:

```bash
# Using Git repository URL with subdirectory (npm 7+)
npm install --save-dev git+https://github.com/adityamotale/adityamotale.git#master&subdirectory=mdparser
```

Or if extracted to its own repository:

```bash
npm install --save-dev github:adityamotale/mdparser#master
```

## Quickstart

```typescript
import { parseMarkdownBlog, validateBlogPost } from "mdparser";

const rawMarkdown = `---
slug: fast-simd-scans
title: Fast SIMD Scans in Rust
created: 15-09-2026
tags: rust, simd, performance
---

Benchmarking vector throughput:

| Metric | Latency | Speedup |
|:---|:---:|---:|
| Baseline | 66 ns | 1.0x |
| AVX2 | 11 ns | **6.0x** |
`;

// Parse markdown to HTML and structured metadata
const post = await parseMarkdownBlog(rawMarkdown);
console.log(post.frontmatter);
console.log(post.html);

// Validate blog post structure and content
const errors = validateBlogPost(post);
if (errors.length > 0) {
  console.error("Blog validation errors:", errors);
}
```
