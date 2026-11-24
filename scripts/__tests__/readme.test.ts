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
        "https://img.shields.io/badge/resume-aditya.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=d7827e&labelColor=faf4ed",
      ),
      "Should include resume Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/aditya.pdf"),
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
      readme.indexOf('id="telemetry"'),
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

    assert.ok(
      readme.includes(
        '<img src="./assets/telemetry.svg" width="100%" alt="telemetry metrics" />',
      ) &&
        readme.includes('<img src="./assets/contributions.svg" width="100%"'),
      "Telemetry should use the SVG card and keep the contributions chart",
    );
    assert.ok(
      !readme.includes("~ TELEMETRY"),
      "Telemetry title should live inside the SVG card",
    );
    const telemetryCard = readFileSync(
      path.join(rootDir, "assets", "telemetry.svg"),
      "utf-8",
    );
    for (const value of [
      "TELEMETRY",
      "Lines of Code",
      "697,167 net",
      "+1.6M / -900.3k",
      "97.4% merged",
      "228 of 234",
      "3,515",
      "1,037d active",
      "12d current / 112d max",
      "53 contributed",
      "62% org · 38% personal",
      'stroke="#d7827e"',
    ]) {
      assert.ok(
        telemetryCard.includes(value),
        `Telemetry card should include ${value}`,
      );
    }
    assert.ok(
      !telemetryCard.includes("prefers-color-scheme"),
      "Telemetry card should be light-only",
    );

    const iconsDir = path.join(rootDir, "assets", "icons");
    const requiredIcons = [
      "twitter.svg",
      "linkedin.svg",
      "globe.svg",
      "external-link.svg",
      "book-open.svg",
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
    for (const icon of [
      "github.svg",
      "layers.svg",
      "activity.svg",
      "git-pull-request.svg",
      "git-commit.svg",
      "zap.svg",
    ]) {
      assert.ok(
        existsSync(path.join(iconsDir, icon)),
        `Should generate inline icon ${icon}`,
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

    assert.equal(
      readme.split("<table").length - 1,
      1,
      "Only the footer should use a table",
    );
    assert.ok(
      !readme.includes("~ PROJECTS") && !readme.includes('id="projects"'),
      "Projects should be a single linked card with no header or anchor",
    );
    assert.ok(
      readme.includes(
        '<a href="https://github.com/pid7-org/turbofox"><img src="./assets/top-project.svg" width="100%"',
      ),
      "Top project should be a single full-width linked card",
    );
    const topProjectCard = readFileSync(
      path.join(rootDir, "assets", "top-project.svg"),
      "utf-8",
    );
    for (const value of [
      "TOP PROJECT",
      "turbofox",
      "Rust",
      "925 contribs",
      "data:image/png;base64,",
      "#d7827e",
    ]) {
      assert.ok(
        topProjectCard.includes(value),
        `Top project card should include ${value}`,
      );
    }
    assert.ok(
      !topProjectCard.includes("prefers-color-scheme"),
      "Top project card should be light-only",
    );

    // Section targets
    const sectionTargets = [
      'id="top"',
      'id="latest-release"',
      'id="writing"',
      'id="telemetry"',
    ];
    for (const target of sectionTargets) {
      assert.ok(
        readme.includes(target),
        `README should contain anchor ${target}`,
      );
    }

    // Heading format verification (~ prefix, no > and no // comments)
    assert.ok(
      readme.includes('## <a id="writing"></a>~ WRITING'),
      "README headings should use ~ prefix",
    );
    assert.ok(
      !readme.includes("> WRITING"),
      "README headings should not use > symbol",
    );
    assert.ok(!readme.includes("// bio"), "README should not contain // bio");
    assert.ok(
      !readme.includes("// metrics"),
      "README should not contain // metrics",
    );

    assert.ok(
      !readme.includes("~ ABOUT") &&
        !readme.includes("~ EXPERIENCE") &&
        !readme.includes("~ EDUCATION"),
      "README should not contain about, experience, or education sections",
    );

    assert.ok(
      !readme.includes("./assets/header.svg"),
      "README should not contain the top wordmark SVG",
    );

    // No backticks in section titles
    assert.ok(
      !readme.includes("`>`"),
      "README should not wrap > in backticks in titles",
    );

    // Languages SVG verification
    assert.ok(
      readme.includes(
        '<img src="./assets/languages.svg" width="100%" alt="language distribution" />',
      ) &&
        !readme.includes("~ LANGUAGES") &&
        !readme.includes('id="languages"'),
      "Languages should be a single full-width SVG with no heading or anchor",
    );
    const languagesCard = readFileSync(
      path.join(rootDir, "assets", "languages.svg"),
      "utf-8",
    );
    for (const value of [
      "LANGUAGES",
      "Rust 72.6%",
      "1.60M loc",
      "29 languages tracked",
      "TypeScript 8.2%",
      "Other 8.7%",
      "#d7827e",
    ]) {
      assert.ok(
        languagesCard.includes(value),
        `Languages card should include ${value}`,
      );
    }
    assert.ok(
      !languagesCard.includes("prefers-color-scheme"),
      "Languages card should be light-only",
    );
    assert.ok(
      !readme.includes("Rust         [██"),
      "README should not contain the ASCII language chart",
    );

    // Footer verification
    const footer = readme.slice(readme.lastIndexOf("---"));
    for (const expected of [
      '<a href="https://adii.fyi"><img src="./assets/footer-name.svg" width="110" height="40"',
      '<a href="https://x.com/arctic_byte"><img src="./assets/icons/twitter.svg" width="15" height="15"',
      '<a href="https://www.linkedin.com/in/aditya-motale"><img src="./assets/icons/linkedin.svg" width="15" height="15"',
      '<a href="https://adii.fyi"><img src="./assets/icons/globe.svg" width="15" height="15"',
      '<a href="https://adii.fyi"><img src="./assets/footer-site.svg" width="90" height="24"',
    ]) {
      assert.ok(footer.includes(expected), `Footer should include ${expected}`);
    }
    assert.ok(
      footer.includes('<table width="100%">') &&
        footer.includes('width="40%" align="left"') &&
        footer.includes('width="20%" align="center"') &&
        footer.includes('width="40%" align="right"'),
      "Footer should span full width with left, center, and right cells",
    );
    assert.ok(
      !footer.includes("[eof]") && !footer.includes("rss.xml"),
      "Footer should contain only the name, site, and icon links",
    );
    const footerName = readFileSync(
      path.join(rootDir, "assets", "footer-name.svg"),
      "utf-8",
    );
    assert.ok(
      footerName.includes("aditya") &&
        footerName.includes("data:font/woff2;base64,") &&
        footerName.includes("#d7827e"),
      "Footer name should reuse the italic serif wordmark",
    );
    const footerSite = readFileSync(
      path.join(rootDir, "assets", "footer-site.svg"),
      "utf-8",
    );
    assert.ok(
      footerSite.includes("adii.fyi") && footerSite.includes("#9893a5"),
      "Footer site should be muted monospace text",
    );

    const topIdx = readme.indexOf('id="top"');
    const releaseIdx = readme.indexOf('id="latest-release"');
    const telemetryIdx = readme.indexOf('id="telemetry"');
    const topProjectIdx = readme.indexOf("./assets/top-project.svg");
    const writingIdx = readme.indexOf('id="writing"');
    const languagesIdx = readme.indexOf("./assets/languages.svg");

    assert.ok(topIdx < releaseIdx, "Top must precede Latest Release");
    assert.ok(
      releaseIdx < telemetryIdx,
      "Latest Release must precede Telemetry",
    );
    assert.ok(
      telemetryIdx < topProjectIdx,
      "Telemetry must precede Top Project",
    );
    assert.ok(topProjectIdx < writingIdx, "Top Project must precede Writing");
    assert.ok(writingIdx < languagesIdx, "Writing must precede Languages");
  });
});
