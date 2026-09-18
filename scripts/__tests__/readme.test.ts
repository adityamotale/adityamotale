import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown with all badges, clickable SVG rows, and clean About section", () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const readme = generateReadme(rootDir);

    // Verify badges
    assert.ok(
      readme.includes("https://adii.fyi"),
      "Should include website badge link",
    );
    assert.ok(
      readme.includes("badge/website-adii.fyi"),
      "Should include website badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume badge link",
    );
    assert.ok(
      readme.includes("badge/resume-adityamotale.pdf"),
      "Should include resume badge",
    );
    assert.ok(
      readme.includes("github/v/release/adityamotale/adityamotale"),
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
      readme.includes(
        "workflow/status/adityamotale/adityamotale/activity.yaml",
      ),
      "Should include activity workflow badge",
    );
    assert.ok(
      readme.includes("workflow/status/adityamotale/adityamotale/release.yaml"),
      "Should include release workflow badge",
    );
    assert.ok(
      readme.includes("workflow/status/adityamotale/adityamotale/test.yaml"),
      "Should include test workflow badge",
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
