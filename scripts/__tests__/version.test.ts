import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  bumpSemver,
  updateChangelog,
  updatePackageJson,
  updatePackageLock,
} from "../lib/version.ts";

describe("version utilities", () => {
  describe("bumpSemver", () => {
    test("increments patch version by default", () => {
      assert.strictEqual(bumpSemver("0.1.0"), "0.1.1");
      assert.strictEqual(bumpSemver("0.1.9"), "0.1.10");
      assert.strictEqual(bumpSemver("1.2.3", "patch"), "1.2.4");
    });

    test("increments minor version and resets patch", () => {
      assert.strictEqual(bumpSemver("0.1.4", "minor"), "0.2.0");
      assert.strictEqual(bumpSemver("1.9.9", "minor"), "1.10.0");
    });

    test("increments major version and resets minor and patch", () => {
      assert.strictEqual(bumpSemver("0.1.4", "major"), "1.0.0");
      assert.strictEqual(bumpSemver("1.2.3", "major"), "2.0.0");
    });

    test("throws on invalid semver strings", () => {
      assert.throws(() => bumpSemver("invalid"), /Invalid semver version/);
      assert.throws(() => bumpSemver("1.0"), /Invalid semver version/);
    });
  });

  describe("updateChangelog", () => {
    test("prepends new version release below header", () => {
      const initial =
        "# Changelog\n\n## [0.1.0] - 2026-09-18\n\n- initial base release\n";
      const updated = updateChangelog(
        initial,
        "0.1.1",
        "2026-09-25",
        "update github activity and coding metrics",
      );

      assert.strictEqual(
        updated,
        "# Changelog\n\n## [0.1.1] - 2026-09-25\n\n- update github activity and coding metrics\n\n## [0.1.0] - 2026-09-18\n\n- initial base release\n",
      );
    });

    test("does not duplicate if version entry already exists", () => {
      const initial =
        "# Changelog\n\n## [0.1.0] - 2026-09-18\n\n- initial base release\n";
      const updated = updateChangelog(
        initial,
        "0.1.0",
        "2026-09-18",
        "initial base release",
      );
      assert.strictEqual(updated, initial);
    });
  });

  describe("updatePackageJson and updatePackageLock", () => {
    test("updates package.json version field", () => {
      const original = JSON.stringify(
        { name: "website", version: "0.1.0", type: "module" },
        null,
        2,
      );
      const updated = updatePackageJson(original, "0.1.1");
      const parsed = JSON.parse(updated);
      assert.strictEqual(parsed.version, "0.1.1");
      assert.strictEqual(parsed.name, "website");
    });

    test("updates package-lock.json top-level and root package versions", () => {
      const original = JSON.stringify(
        {
          name: "website",
          version: "0.1.0",
          packages: {
            "": {
              name: "website",
              version: "0.1.0",
            },
          },
        },
        null,
        2,
      );
      const updated = updatePackageLock(original, "0.1.1");
      const parsed = JSON.parse(updated);
      assert.strictEqual(parsed.version, "0.1.1");
      assert.strictEqual(parsed.packages[""].version, "0.1.1");
    });
  });
});
