import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown with all sections unified as Rosé Pine Dawn SVG cards", () => {
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

    // Verify all section SVG assets exist
    const assetsDir = path.join(rootDir, "assets");
    const requiredAssets = [
      "header.svg",
      "about.svg",
      "projects.svg",
      "writing.svg",
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

    // Verify Header SVG has single line ASCII art name
    const headerSvg = readFileSync(path.join(assetsDir, "header.svg"), "utf-8");
    assert.ok(
      headerSvg.includes("▄▀█ █▀▄ █ ▀█▀ █▄█ ▄▀█   █▀▄▀█ █▀█ ▀█▀ ▄▀█ █   █▀▀"),
      "Header SVG should contain side-by-side single-line ASCII art name line 1",
    );
    assert.ok(
      headerSvg.includes("█▀█ █▄▀ █  █   █  █▀█   █ ▀ █ █▄█  █  █▀█ █▄▄ ██▄"),
      "Header SVG should contain side-by-side single-line ASCII art name line 2",
    );
    assert.ok(
      headerSvg.includes("hello, my name is Aditya — an engineer by choice"),
      "Header SVG should contain subtitle",
    );

    // Verify Rosé Pine Dawn colors across cards
    const aboutSvg = readFileSync(path.join(assetsDir, "about.svg"), "utf-8");
    assert.ok(
      aboutSvg.includes("#d7827e"),
      "About SVG should use accent color #d7827e",
    );

    const projectsSvg = readFileSync(
      path.join(assetsDir, "projects.svg"),
      "utf-8",
    );
    assert.ok(
      projectsSvg.includes("turbofox"),
      "Projects SVG should contain top project",
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
  });
});
