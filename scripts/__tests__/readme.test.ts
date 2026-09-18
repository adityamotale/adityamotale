import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown with Shields.io Rosé Pine Dawn badges, clickable SVG rows, and clean About section", () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const readme = generateReadme(rootDir);

    // Verify badge links and Shields.io URLs
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/website-adii.fyi-286983?logo=googlechrome&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include website Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi"),
      "Should include website link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/resume-adityamotale.pdf-d7827e?logo=googledocs&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include resume Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/github/v/release/adityamotale/adityamotale?label=release&logo=github&logoColor=faf4ed&labelColor=575279&color=ea9d34",
      ),
      "Should include release Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/github-adityamotale-575279?logo=github&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include GitHub Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/twitter-@arctic__byte-56949f?logo=x&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include Twitter/X Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/linkedin-aditya--motale-286983?logo=linkedin&logoColor=faf4ed&labelColor=575279",
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

    // Verify all section SVG assets exist
    const assetsDir = path.join(rootDir, "assets");
    const requiredAssets = [
      "header.svg",
      "about.svg",
      "projects-header.svg",
      "project-0.svg",
      "writing-header.svg",
      "writing-0.svg",
      "education.svg",
      "experience.svg",
      "telemetry.svg",
      "monthly.svg",
      "weekly.svg",
    ];

    for (const asset of requiredAssets) {
      assert.ok(
        existsSync(path.join(assetsDir, asset)),
        `Should generate ${asset}`,
      );
      assert.ok(
        readme.includes(`./assets/${asset}`),
        `README should reference ${asset}`,
      );
    }

    // Verify clickable project and writing links in README
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
  });
});
