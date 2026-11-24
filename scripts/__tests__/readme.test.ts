import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete Markdown/HTML README with operational navs, responsive grid, inline icons, and social footer", async () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const stubFetch: typeof fetch = async () =>
      new Response(Buffer.from("banner"), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    const readme = await generateReadme(rootDir, stubFetch, false);

    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/website-adii.fyi-d7827e?style=flat-square&logo=googlechrome&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include website Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi"),
      "Should include website link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/resume-adityamotale.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include resume Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/github/v/release/adityamotale/adityamotale?style=flat-square&label=release&logo=github&logoColor=d7827e&labelColor=faf4ed&color=d7827e",
      ),
      "Should include release Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/github-adityamotale-d7827e?style=flat-square&logo=github&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include GitHub Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/twitter-@arctic__byte-d7827e?style=flat-square&logo=x&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include Twitter/X Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/linkedin-aditya--motale-d7827e?style=flat-square&logo=linkedin&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include LinkedIn Shields badge",
    );
    assert.ok(
      readme.includes("actions/workflows/activity.yaml"),
      "Should include activity workflow badge link",
    );
    assert.ok(
      readme.includes("actions/workflows/release.yaml"),
      "Should include release workflow badge link",
    );
    assert.ok(
      readme.includes("actions/workflows/test.yaml"),
      "Should include test workflow badge link",
    );

    const releaseSection = readme.slice(
      readme.indexOf('id="latest-release"'),
      readme.indexOf('id="about"'),
    );
    const releaseUrl =
      "https://github.com/adityamotale/shyena/releases/tag/v0.0.102";
    assert.ok(
      releaseSection.includes(
        `<a href="${releaseUrl}"><img src="./assets/latest-release.svg" width="100%"`,
      ),
      "Should link the entire release section card to the release",
    );
    assert.equal(
      releaseSection.split("<img").length - 1,
      1,
      "Release section should contain exactly one image",
    );
    assert.ok(
      !releaseSection.includes("<table") &&
        !releaseSection.includes("~ LATEST RELEASE") &&
        !releaseSection.includes("raw.githubusercontent.com"),
      "Release section should be a single SVG with no heading or remote banner",
    );

    const releaseCard = readFileSync(
      path.join(rootDir, "assets", "latest-release.svg"),
      "utf-8",
    );
    for (const value of [
      "LATEST RELEASE",
      "shyena",
      "v0.0.102",
      "Nov 20, 2026",
      "Keyboard-first launcher",
      "data:image/png;base64,",
      "#d7827e",
    ]) {
      assert.ok(
        releaseCard.includes(value),
        `Release card should include ${value}`,
      );
    }
    assert.ok(
      !releaseCard.includes("prefers-color-scheme") &&
        !releaseCard.includes("#fffaf3") &&
        !releaseCard.includes("#f2e9e1") &&
        !releaseCard.includes("view release"),
      "Release card should be borderless, light-only, and free of tag pill/CTA styling",
    );

    const iconsDir = path.join(rootDir, "assets", "icons");
    const requiredIcons = [
      "github.svg",
      "twitter.svg",
      "linkedin.svg",
      "globe.svg",
      "file-text.svg",
      "rss.svg",
      "external-link.svg",
      "calendar.svg",
      "code.svg",
      "briefcase.svg",
      "graduation-cap.svg",
      "book-open.svg",
      "activity.svg",
      "git-pull-request.svg",
      "git-commit.svg",
      "zap.svg",
      "layers.svg",
    ];

    for (const icon of requiredIcons) {
      assert.ok(
        existsSync(path.join(iconsDir, icon)),
        `Should generate icon ${icon}`,
      );
      assert.ok(
        readme.includes(`./assets/icons/${icon}`),
        `README should reference icon ${icon}`,
      );
    }

    assert.ok(
      readme.includes("https://github.com/pid7-org/turbofox"),
      "README should link to project repository",
    );
    assert.ok(
      readme.includes(
        "https://adii.fyi/blogs/theres-more-to-performance-than-big-o",
      ),
      "README should link to blog post",
    );

    assert.ok(
      readme.includes('<table width="100%">'),
      "README should render a full-width 2-column project grid table",
    );
    assert.ok(
      readme.includes("raw.githubusercontent.com"),
      "README should embed banner images from raw githubusercontent",
    );

    // Section targets
    const sectionTargets = [
      'id="top"',
      'id="latest-release"',
      'id="about"',
      'id="projects"',
      'id="writing"',
      'id="experience"',
      'id="telemetry"',
      'id="languages"',
      'id="education"',
    ];
    for (const target of sectionTargets) {
      assert.ok(
        readme.includes(target),
        `README should contain anchor ${target}`,
      );
    }

    // Heading format verification (~ prefix, no > and no // comments)
    assert.ok(
      readme.includes('## <a id="about"></a>~ ABOUT'),
      "README headings should use ~ prefix",
    );
    assert.ok(
      !readme.includes("> ABOUT"),
      "README headings should not use > symbol",
    );
    assert.ok(!readme.includes("// bio"), "README should not contain // bio");
    assert.ok(
      !readme.includes("// metrics"),
      "README should not contain // metrics",
    );

    // Experience section should not have disclosure arrows (<details>/<summary>)
    assert.ok(
      !readme.includes("<details"),
      "Experience section should not use <details>",
    );
    assert.ok(
      !readme.includes("<summary"),
      "Experience section should not use <summary>",
    );

    // Wordmark verification
    assert.ok(
      readme.includes(
        '<img src="./assets/header.svg" width="320" height="112" alt="aditya" />',
      ),
      "README should use the SVG wordmark",
    );
    assert.ok(
      !readme.includes("▄▀█") && !readme.includes("█▀█"),
      "README should not contain ASCII block-art wordmark",
    );
    const wordmark = readFileSync(
      path.join(rootDir, "assets", "header.svg"),
      "utf-8",
    );
    assert.ok(
      wordmark.includes("aditya") &&
        wordmark.includes("data:font/woff2;base64,") &&
        wordmark.includes("#d7827e") &&
        wordmark.includes("Instrument Serif"),
      "Wordmark SVG should embed the italic serif font in the rose accent",
    );

    // No backticks in section titles
    assert.ok(
      !readme.includes("`>`"),
      "README should not wrap > in backticks in titles",
    );

    // ASCII Language chart verification
    assert.ok(
      readme.includes("Rust         [██"),
      "README should contain ASCII language distribution chart for Rust",
    );
    assert.ok(
      readme.includes("TypeScript   ["),
      "README should contain ASCII language distribution chart for TypeScript",
    );

    // Social footer verification
    assert.ok(
      readme.includes("https://adii.fyi/rss.xml"),
      "Footer should include RSS feed link",
    );
    assert.ok(
      readme.includes("[eof]"),
      "Footer should include return-to-top [eof] button",
    );

    const topIdx = readme.indexOf('id="top"');
    const releaseIdx = readme.indexOf('id="latest-release"');
    const aboutIdx = readme.indexOf('id="about"');
    const projectsIdx = readme.indexOf('id="projects"');
    const writingIdx = readme.indexOf('id="writing"');
    const experienceIdx = readme.indexOf('id="experience"');
    const telemetryIdx = readme.indexOf('id="telemetry"');
    const languagesIdx = readme.indexOf('id="languages"');
    const educationIdx = readme.indexOf('id="education"');

    assert.ok(topIdx < releaseIdx, "Top must precede Latest Release");
    assert.ok(releaseIdx < aboutIdx, "Latest Release must precede About");
    assert.ok(aboutIdx < projectsIdx, "About must precede Projects");
    assert.ok(projectsIdx < writingIdx, "Projects must precede Writing");
    assert.ok(writingIdx < experienceIdx, "Writing must precede Experience");
    assert.ok(
      experienceIdx < telemetryIdx,
      "Experience must precede Telemetry",
    );
    assert.ok(telemetryIdx < languagesIdx, "Telemetry must precede Languages");
    assert.ok(languagesIdx < educationIdx, "Languages must precede Education");
  });
});
