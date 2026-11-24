import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { generateReadme } from "../generate-readme.ts";

describe("readme generator", () => {
  test("generates complete README markdown matching website UI and section structure", () => {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const readme = generateReadme(rootDir);

    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/website-adii.fyi-286983?style=flat-square&logo=googlechrome&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include website Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi"),
      "Should include website link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/resume-adityamotale.pdf-d7827e?style=flat-square&logo=googledocs&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include resume Shields badge",
    );
    assert.ok(
      readme.includes("https://adii.fyi/adityamotale.pdf"),
      "Should include resume link",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/github/v/release/adityamotale/adityamotale?style=flat-square&label=release&logo=github&logoColor=faf4ed&labelColor=575279&color=ea9d34",
      ),
      "Should include release Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/github-adityamotale-575279?style=flat-square&logo=github&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include GitHub Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/twitter-@arctic__byte-56949f?style=flat-square&logo=x&logoColor=faf4ed&labelColor=575279",
      ),
      "Should include Twitter/X Shields badge",
    );
    assert.ok(
      readme.includes(
        "https://img.shields.io/badge/linkedin-aditya--motale-286983?style=flat-square&logo=linkedin&logoColor=faf4ed&labelColor=575279",
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

    const assetsDir = path.join(rootDir, "assets");
    const requiredAssets = [
      "header.svg",
      "latest-release.svg",
      "about.svg",
      "projects-header.svg",
      "project-0.svg",
      "writing-header.svg",
      "writing-0.svg",
      "experience.svg",
      "telemetry.svg",
      "contributions.svg",
      "education.svg",
      "footer.svg",
      "monthly.svg",
      "weekly.svg",
    ];

    for (const asset of requiredAssets) {
      assert.ok(
        existsSync(path.join(assetsDir, asset)),
        `Should generate ${asset}`,
      );
    }

    const readmeAssets = [
      "header.svg",
      "latest-release.svg",
      "about.svg",
      "projects-header.svg",
      "project-0.svg",
      "writing-header.svg",
      "writing-0.svg",
      "experience.svg",
      "telemetry.svg",
      "contributions.svg",
      "education.svg",
      "footer.svg",
    ];

    for (const asset of readmeAssets) {
      assert.ok(
        readme.includes(`./assets/${asset}`),
        `README should reference ${asset}`,
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

    const headerIdx = readme.indexOf("./assets/header.svg");
    const releaseIdx = readme.indexOf("./assets/latest-release.svg");
    const aboutIdx = readme.indexOf("./assets/about.svg");
    const projectsIdx = readme.indexOf("./assets/projects-header.svg");
    const writingIdx = readme.indexOf("./assets/writing-header.svg");
    const experienceIdx = readme.indexOf("./assets/experience.svg");
    const telemetryIdx = readme.indexOf("./assets/telemetry.svg");
    const contribIdx = readme.indexOf("./assets/contributions.svg");
    const educationIdx = readme.indexOf("./assets/education.svg");
    const footerIdx = readme.indexOf("./assets/footer.svg");

    assert.ok(headerIdx < releaseIdx, "Header must precede Latest Release");
    assert.ok(releaseIdx < aboutIdx, "Latest Release must precede About");
    assert.ok(aboutIdx < projectsIdx, "About must precede Projects");
    assert.ok(projectsIdx < writingIdx, "Projects must precede Writing");
    assert.ok(writingIdx < experienceIdx, "Writing must precede Experience");
    assert.ok(
      experienceIdx < telemetryIdx,
      "Experience must precede Telemetry",
    );
    assert.ok(
      telemetryIdx < contribIdx,
      "Telemetry must precede Contributions",
    );
    assert.ok(
      contribIdx < educationIdx,
      "Contributions must precede Education",
    );
    assert.ok(educationIdx < footerIdx, "Education must precede Footer");
  });
});
