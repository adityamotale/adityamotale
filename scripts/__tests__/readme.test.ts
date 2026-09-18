import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown with Rosé Pine styled assets and required sections", () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const readme = generateReadme(rootDir);

    // Verify resume button
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume link",
    );
    assert.ok(
      readme.includes("shields.io/badge/resume-adityamotale.pdf"),
      "Should include styled resume badge",
    );

    // Verify SVG assets exist
    const assetsDir = path.join(rootDir, "assets");
    assert.ok(
      existsSync(path.join(assetsDir, "header.svg")),
      "Should generate header.svg",
    );
    assert.ok(
      existsSync(path.join(assetsDir, "telemetry.svg")),
      "Should generate telemetry.svg",
    );
    assert.ok(
      existsSync(path.join(assetsDir, "monthly.svg")),
      "Should generate monthly.svg",
    );
    assert.ok(
      existsSync(path.join(assetsDir, "weekly.svg")),
      "Should generate weekly.svg",
    );
    assert.ok(
      existsSync(path.join(assetsDir, "education.svg")),
      "Should generate education.svg",
    );

    // Verify SVG content uses Rosé Pine Dawn colors
    const headerSvg = readFileSync(path.join(assetsDir, "header.svg"), "utf-8");
    assert.ok(
      headerSvg.includes("#d7827e"),
      "Header SVG should contain Rosé Pine Rose accent color",
    );
    assert.ok(
      headerSvg.includes("JetBrains Mono"),
      "Header SVG should use JetBrains Mono font",
    );

    const telemetrySvg = readFileSync(
      path.join(assetsDir, "telemetry.svg"),
      "utf-8",
    );
    assert.ok(
      telemetrySvg.includes("#286983"),
      "Telemetry SVG should contain Rosé Pine Pine color for churn",
    );
    assert.ok(
      telemetrySvg.includes("#56949f"),
      "Telemetry SVG should contain Rosé Pine Foam color for PRs",
    );
    assert.ok(
      telemetrySvg.includes("#ea9d34"),
      "Telemetry SVG should contain Rosé Pine Gold color for streak/active",
    );

    // Verify README embeds SVGs
    assert.ok(
      readme.includes("./assets/header.svg"),
      "README should embed header.svg",
    );
    assert.ok(
      readme.includes("./assets/telemetry.svg"),
      "README should embed telemetry.svg",
    );
    assert.ok(
      readme.includes("./assets/monthly.svg"),
      "README should embed monthly.svg",
    );
    assert.ok(
      readme.includes("./assets/weekly.svg"),
      "README should embed weekly.svg",
    );
    assert.ok(
      readme.includes("./assets/education.svg"),
      "README should embed education.svg",
    );

    // Verify About section
    assert.ok(readme.includes("### > ABOUT"), "Should include About header");
    assert.ok(
      readme.includes("Passionate about systems programming"),
      "Should include about text",
    );
    assert.ok(
      readme.includes("https://github.com/adityamotale"),
      "Should include github link",
    );

    // Verify Projects section
    assert.ok(
      readme.includes("### > PROJECTS"),
      "Should include Projects header",
    );
    assert.ok(
      readme.includes("turbofox"),
      "Should include top contributed project",
    );

    // Verify Writing section
    assert.ok(
      readme.includes("### > WRITING"),
      "Should include Writing header",
    );

    // Verify Experience section
    assert.ok(
      readme.includes("### > EXPERIENCE"),
      "Should include Experience header",
    );
    assert.ok(
      readme.includes("OSS Contributions"),
      "Should include OSS Experience",
    );
    assert.ok(
      readme.includes("Freelance & Contract"),
      "Should include Freelance Experience",
    );
    assert.ok(
      readme.includes("Internships · Mobile Engineering"),
      "Should include Mobile Internship Experience",
    );

    // Verify Skipped Sections (status & compare)
    assert.ok(!readme.includes("STATUS"), "Should NOT include Status section");
    assert.ok(
      !readme.includes("COMPARE"),
      "Should NOT include Compare section",
    );
  });
});
