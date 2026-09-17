import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  parseFrontmatter,
  parseMarkdownBlog,
  parseSimpleMarkdownInline,
  parseTableBlock,
  splitTableRow,
  isTableDelimiterRow,
  getColumnAlignment,
  slugify,
  validateBlogPost,
  validateAllBlogPosts,
  isValidDateString,
} from "../src/index.ts";

const DUMMY_BLOG_POST = `---
slug: dummy-speed-test
title: Dummy Benchmark & Table Post
created: 10-09-2026
last-updated: 12-09-2026
description: A mock blog post containing all markdown extensions for isolated unit testing.
tags: rust, benchmarks, simd, tables
---

Welcome to this synthetic blog post demonstrating **bold text**, _italic text_, and \`inline code\`.
We also reference inline math $E = mc^2$ and citation[^algo-1].

## ⁕ Benchmark Summary

Below is a standalone table comparing execution metrics:

| Metric | Baseline | Optimized | Speedup |
| :--- | :---: | ---: | ---: |
| Latency | 66 ns | 11 ns | **6.0x** |
| Cycles | 174 | 29 | **6.0x** |
| Branch Misses | 21% | 0% | 100% |

## § Custom Block With Table

<>
| Operation | Throughput | Status |
|:---|:---:|---:|
| Vector Scan | 4.2 GB/s | \`PASS\` |
| Bitmask Filter | 8.9 GB/s | \`PASS\` |
@desc High-performance vector scanning benchmarks on dummy data
</>

## Code Snippet Example

<>
\`\`\`rust
pub fn dummy_simd_scan(data: &[u8]) -> usize {
    data.iter().filter(|&&b| b == 0xFF).count()
}
\`\`\`
@desc Rust implementation of dummy scan
</>

~
\`\`\`c
int dummy_c_scan(const unsigned char *buf, size_t len);
\`\`\`
@desc C extern signature
~

> [!TIP]
> Hardware acceleration yields significant latency reductions.

> [!WARNING]
> Ensure alignment before calling unaligned load intrinsics.

{@anim (001) visual demo showing 512-bit vector register comparison}

{ANIM002: second animation format demo}

### Equations Section

$$
\\text{Speedup} = \\frac{T_{\\text{old}}}{T_{\\text{new}}}
$$

Here is an unordered list:

* First item with \`code\`
* Second item with **emphasis**

And an ordered list:

1. Initialize buffer
2. Load vector register
3. Compute mask

@glossary

* SIMD: Single Instruction Multiple Data parallel execution model.
* AVX-512: 512-bit vector extensions on modern x86 processors.

@references

[^algo-1]: Fast scanning algorithm reference guide, 2026.
`;

describe("mdparser: Frontmatter Parsing", () => {
  it("correctly parses valid YAML frontmatter fields", () => {
    const { frontmatter, content } = parseFrontmatter(DUMMY_BLOG_POST);
    assert.equal(frontmatter.slug, "dummy-speed-test");
    assert.equal(frontmatter.title, "Dummy Benchmark & Table Post");
    assert.equal(frontmatter.created, "10-09-2026");
    assert.equal(frontmatter.lastUpdated, "12-09-2026");
    assert.equal(
      frontmatter.description,
      "A mock blog post containing all markdown extensions for isolated unit testing.",
    );
    assert.deepEqual(frontmatter.tags, [
      "rust",
      "benchmarks",
      "simd",
      "tables",
    ]);
    assert.ok(content.startsWith("Welcome to this synthetic blog post"));
  });

  it("falls back to default values when optional fields are missing", () => {
    const minimal = `---
slug: minimal-post
---
Body text only`;
    const { frontmatter, content } = parseFrontmatter(minimal);
    assert.equal(frontmatter.slug, "minimal-post");
    assert.equal(frontmatter.title, "Untitled Post");
    assert.equal(frontmatter.created, "");
    assert.equal(frontmatter.lastUpdated, "");
    assert.deepEqual(frontmatter.tags, []);
    assert.equal(frontmatter.description, undefined);
    assert.equal(content, "Body text only");
  });

  it("supports id as fallback for slug", () => {
    const markdown = `---
id: custom-id-slug
title: Post with ID
---
Content`;
    const { frontmatter } = parseFrontmatter(markdown);
    assert.equal(frontmatter.slug, "custom-id-slug");
  });

  it("throws error when frontmatter block is missing", () => {
    assert.throws(
      () => parseFrontmatter("No frontmatter here\nJust text"),
      /Invalid blog markdown: missing YAML frontmatter block/,
    );
  });
});

describe("mdparser: Markdown Tables", () => {
  it("splits table row into cells correctly, handling leading/trailing pipes and escapes", () => {
    const cells1 = splitTableRow("| Col 1 | Col 2 | Col 3 |");
    assert.deepEqual(cells1, ["Col 1", "Col 2", "Col 3"]);

    const cells2 = splitTableRow("Col A | Col B");
    assert.deepEqual(cells2, ["Col A", "Col B"]);

    const cellsEscaped = splitTableRow("| Key | Escaped \\| Pipe | Val |");
    assert.deepEqual(cellsEscaped, ["Key", "Escaped | Pipe", "Val"]);
  });

  it("validates table delimiter rows correctly", () => {
    assert.equal(isTableDelimiterRow(["---", "---"]), true);
    assert.equal(isTableDelimiterRow([":---", ":---:", "---:"]), true);
    assert.equal(isTableDelimiterRow([":-:", ":-", "-:"]), true);
    assert.equal(isTableDelimiterRow(["abc", "---"]), false);
    assert.equal(isTableDelimiterRow([]), false);
  });

  it("determines column alignment from delimiter syntax", () => {
    assert.equal(getColumnAlignment(":---"), "left");
    assert.equal(getColumnAlignment("---"), "left");
    assert.equal(getColumnAlignment(":---:"), "center");
    assert.equal(getColumnAlignment(":-:"), "center");
    assert.equal(getColumnAlignment("---:"), "right");
    assert.equal(getColumnAlignment("-:"), "right");
  });

  it("parses standalone markdown table block with alignments and cell formatting", () => {
    const tableMd = `| Item | Alignment | Score |
|:---|:---:|---:|
| **Alpha** | Center | \`100\` |
| *Beta* | Center | \`200\` |`;

    const html = parseTableBlock(tableMd);
    assert.ok(html !== null);
    assert.ok(
      html.includes(
        '<table class="w-full text-left font-mono text-xs sm:text-sm border-collapse">',
      ),
    );
    assert.ok(
      html.includes(
        '<th scope="col" class="py-2.5 px-3.5 sm:py-3 sm:px-4 text-left">Item</th>',
      ),
    );
    assert.ok(
      html.includes(
        '<th scope="col" class="py-2.5 px-3.5 sm:py-3 sm:px-4 text-center">Alignment</th>',
      ),
    );
    assert.ok(
      html.includes(
        '<th scope="col" class="py-2.5 px-3.5 sm:py-3 sm:px-4 text-right">Score</th>',
      ),
    );
    assert.ok(html.includes("<strong>Alpha</strong>"));
    assert.ok(html.includes("<em>Beta</em>"));
    assert.ok(html.includes("<code>100</code>"));
    assert.ok(html.includes("<code>200</code>"));
  });

  it("renders table with optional description caption when inside custom blocks", () => {
    const tableMd = `| Metric | Value |
|---|---|
| IPC | 2.5 |`;

    const html = parseTableBlock(tableMd, "Benchmarking IPC results");
    assert.ok(html !== null);
    assert.ok(html.includes("custom-table-container"));
    assert.ok(html.includes("table-desc"));
    assert.ok(html.includes("Benchmarking IPC results"));
  });

  it("returns null for non-table markdown blocks", () => {
    assert.equal(
      parseTableBlock("Just a normal paragraph without pipes."),
      null,
    );
    assert.equal(parseTableBlock("Single line with pipe | not table"), null);
    assert.equal(parseTableBlock("Line 1 | Line 2\nNot delimiter line"), null);
  });
});

describe("mdparser: Full Blog Post Parser (Isolated Dummy Post)", () => {
  it("parses dummy post and renders standalone table HTML", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes('<div class="custom-table-container'));
    assert.ok(parsed.html.includes("Latency"));
    assert.ok(parsed.html.includes("66 ns"));
    assert.ok(parsed.html.includes("<strong>6.0x</strong>"));
  });

  it("parses markdown table inside custom angle block <> with @desc caption", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes("Vector Scan"));
    assert.ok(parsed.html.includes("4.2 GB/s"));
    assert.ok(
      parsed.html.includes(
        "High-performance vector scanning benchmarks on dummy data",
      ),
    );
  });

  it("renders custom angle and tilde code blocks with Shiki syntax highlighting and copy buttons", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes("custom-code-block-angle"));
    assert.ok(parsed.html.includes("custom-code-block-tilde"));
    assert.ok(parsed.html.includes("rust"));
    assert.ok(parsed.html.includes("copy-code-btn"));
    assert.ok(parsed.html.includes("Rust implementation of dummy scan"));
    assert.ok(parsed.html.includes("C extern signature"));
    assert.ok(parsed.html.includes("data-code="));
  });

  it("renders callouts for [!TIP] and [!WARNING]", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes("callout-tip"));
    assert.ok(
      parsed.html.includes(
        "Hardware acceleration yields significant latency reductions.",
      ),
    );
    assert.ok(parsed.html.includes("callout-warning"));
    assert.ok(
      parsed.html.includes(
        "Ensure alignment before calling unaligned load intrinsics.",
      ),
    );
  });

  it("renders animation tags for both {@anim (...)} and {ANIM...}", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes('data-anim-id="001"'));
    assert.ok(
      parsed.html.includes(
        "visual demo showing 512-bit vector register comparison",
      ),
    );
    assert.ok(parsed.html.includes('data-anim-id="ANIM002"'));
    assert.ok(parsed.html.includes("second animation format demo"));
  });

  it("renders LaTeX math equations via KaTeX", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes("katex"));
    assert.ok(parsed.html.includes("Speedup"));
  });

  it("renders headers with section anchors and symbols (§ and ⁕)", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes('id="benchmark-summary"'));
    assert.ok(parsed.html.includes("⁕"));
    assert.ok(parsed.html.includes('id="custom-block-with-table"'));
    assert.ok(parsed.html.includes("§"));
    assert.ok(parsed.html.includes('id="equations-section"'));
  });

  it("renders ordered and unordered lists", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.html.includes('<ul class="list-none'));
    assert.ok(parsed.html.includes("First item with <code>code</code>"));
    assert.ok(parsed.html.includes('<ol class="list-decimal'));
    assert.ok(parsed.html.includes("Initialize buffer"));
  });

  it("extracts glossary section into structured items", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.equal(parsed.glossary.length, 2);
    assert.equal(parsed.glossary[0].term, "SIMD");
    assert.ok(
      parsed.glossary[0].definitionHtml.includes(
        "Single Instruction Multiple Data",
      ),
    );
    assert.equal(parsed.glossary[1].term, "AVX-512");
  });

  it("extracts references and links footnotes in prose", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.equal(parsed.references.length, 1);
    assert.equal(parsed.references[0].id, "algo-1");
    assert.ok(
      parsed.references[0].contentHtml.includes(
        "Fast scanning algorithm reference guide",
      ),
    );
    assert.ok(parsed.html.includes('href="#fn-algo-1"'));
    assert.ok(parsed.html.includes('id="fnref-algo-1"'));
  });

  it("calculates word count and reading time", async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    assert.ok(parsed.wordCount > 10);
    assert.ok(parsed.readTimeMinutes >= 1);
  });
});

describe("mdparser: Slugify, Dates, and Inline Utilities", () => {
  it("slugifies titles with special characters and symbols", () => {
    assert.equal(slugify("§ Hello World!"), "hello-world");
    assert.equal(
      slugify("⁕ AVX-512 & SIMD Performance"),
      "avx-512-simd-performance",
    );
    assert.equal(slugify("Simple Title 123"), "simple-title-123");
  });

  it("parses inline markdown links, formatting and math", () => {
    const input =
      "Check **bold**, _italic_, `code`, and [Google](https://google.com) plus $x+y$.";
    const output = parseSimpleMarkdownInline(input);
    assert.ok(output.includes("<strong>bold</strong>"));
    assert.ok(output.includes("<em>italic</em>"));
    assert.ok(output.includes("<code>code</code>"));
    assert.ok(
      output.includes(
        '<a href="https://google.com" target="_blank" rel="noreferrer">Google</a>',
      ),
    );
    assert.ok(output.includes("katex"));
  });

  it("validates date strings according to format and calendar bounds", () => {
    assert.equal(isValidDateString("15-09-2026"), true);
    assert.equal(isValidDateString("2026-09-15"), true);
    assert.equal(isValidDateString("99-99-9999"), false);
    assert.equal(isValidDateString("invalid-date"), false);
  });
});

describe("mdparser: Authoring Error Catching (Validator Unit Tests)", () => {
  it("catches missing frontmatter, bad dates, and empty tags", async () => {
    const invalidPost = `---
slug: Invalid Slug Spaces!
title:
created: 99-99-9999
tags:
---
Body text.`;

    const parsed = await parseMarkdownBlog(invalidPost);
    const errors = validateBlogPost(parsed);

    assert.ok(errors.some((e) => e.field === "slug"));
    assert.ok(errors.some((e) => e.field === "title"));
    assert.ok(errors.some((e) => e.field === "created"));
    assert.ok(errors.some((e) => e.field === "tags"));
  });

  it("catches unlinked footnote citations", async () => {
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
          e.field === "references" &&
          e.message.includes("Footnote citation '[^missing-ref]'"),
      ),
    );
  });

  it("catches duplicate slugs across multiple posts", async () => {
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
      errors.some((e) => e.message.includes("Duplicate slug 'duplicate-slug'")),
    );
  });
});

describe("mdparser: Live Blog Integrity Suite (blogs/ directory)", () => {
  it("validates all live blog posts in blogs/ directory for formatting and structure", async () => {
    const blogsDir = path.resolve(process.cwd(), "../blogs");
    const targetDir = fsSync.existsSync(blogsDir)
      ? blogsDir
      : path.resolve(process.cwd(), "blogs");

    assert.ok(
      fsSync.existsSync(targetDir),
      `Blogs directory should exist at ${targetDir}`,
    );

    const files = await fs.readdir(targetDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    assert.ok(
      mdFiles.length > 0,
      "Should find at least one markdown post in blogs/",
    );

    const parsedPosts = [];
    for (const file of mdFiles) {
      const filePath = path.join(targetDir, file);
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = await parseMarkdownBlog(raw);
      parsedPosts.push({ parsed, file });
    }

    const allErrors = [];
    for (const { parsed, file } of parsedPosts) {
      const errors = validateBlogPost(parsed, file);
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      const formatted = allErrors
        .map((e) => `  - [${e.file || e.slug}][${e.field}]: ${e.message}`)
        .join("\n");
      assert.fail(`Live blog validation failed:\n${formatted}`);
    }
  });
});
