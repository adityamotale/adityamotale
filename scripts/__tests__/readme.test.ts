import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown with Rosé Pine Dawn custom pill badges, clickable SVG rows, and clean About section", () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const readme = generateReadme(rootDir);

    // Verify badge links
    assert.ok(
      readme.includes("https://adii.fyi"),
      "Should include website badge link",
    );
    assert.ok(
      readme.includes("./assets/badge-website.svg"),
      "Should include website SVG badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume badge link",
    );
    assert.ok(
      readme.includes("./assets/badge-resume.svg"),
      "Should include resume SVG badge",
    );
    assert.ok(
      readme.includes("./assets/badge-release.svg"),
      "Should include release tag badge",
    );
    assert.ok(
      readme.includes("https://github.com/adityamotale"),
      "Should include GitHub social badge link",
    );
    assert.ok(
      readme.includes("https://x.com/arctic_byte"),
      "Should include Twitter/X social badge link",
    );
    assert.ok(
      readme.includes("https://www.linkedin.com/in/aditya-motale"),
      "Should include LinkedIn social badge link",
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

    // Verify all badge and section SVG assets exist
    const assetsDir = path.join(rootDir, "assets");
    const requiredAssets = [
      "badge-website.svg",
      "badge-resume.svg",
      "badge-release.svg",
      "badge-github.svg",
      "badge-twitter.svg",
      "badge-linkedin.svg",
      "badge-tests.svg",
      "badge-activity.svg",
      "badge-release-action.svg",
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

    // Verify badge SVG uses Rosé Pine Dawn styling
    const resumeBadgeSvg = readFileSync(
      path.join(assetsDir, "badge-resume.svg"),
      "utf-8",
    );
    assert.ok(
      resumeBadgeSvg.includes("#fffaf3"),
      "Badge SVG should use Rosé Pine Dawn surface background",
    );
    assert.ok(
      resumeBadgeSvg.includes("#dfdad9"),
      "Badge SVG should use Rosé Pine Dawn highlight border",
    );
    assert.ok(
      resumeBadgeSvg.includes("#797593"),
      "Badge SVG should use Rosé Pine Dawn subtle text",
    );

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

    // Verify About SVG does NOT contain bottom social link text
    const aboutSvg = readFileSync(path.join(assetsDir, "about.svg"), "utf-8");
    assert.ok(
      !aboutSvg.includes("github / twitter / linkedin"),
      "About SVG should not contain social link text",
    );
    assert.ok(
      aboutSvg.includes("Passionate about systems programming"),
      "About SVG should contain about paragraph",
    );
  });
});
