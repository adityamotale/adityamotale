import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRepositoryActivities,
  calculateLanguages,
  calculateRepositorySummary,
  calculateStreaks,
} from "../lib/aggregator.ts";
import type { ViewerRepoNode } from "../lib/collector.ts";

describe("calculateLanguages", () => {
  it("aggregates bytes, calculates percentages, and sorts descending for owned repos", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/repo1",
        name: "repo1",
        isPrivate: false,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [
            { size: 600, node: { name: "Rust", color: "#dea584" } },
            { size: 400, node: { name: "TypeScript", color: "#3178c6" } },
          ],
        },
      },
      {
        nameWithOwner: "adityamotale/repo2",
        name: "repo2",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [{ size: 1000, node: { name: "Rust", color: null } }],
        },
      },
      {
        nameWithOwner: "otherorg/repo3",
        name: "repo3",
        isPrivate: false,
        isFork: false,
        stargazerCount: 10,
        forkCount: 2,
        owner: { login: "otherorg" },
        languages: {
          edges: [{ size: 5000, node: { name: "Go", color: "#00ADD8" } }],
        },
      },
    ];

    const result = calculateLanguages(repos, "adityamotale");

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Rust");
    assert.equal(result[0].bytes, 1600);
    assert.equal(result[0].percentage, 80);
    assert.equal(result[0].color, "#dea584"); // preserved non-null color across repos

    assert.equal(result[1].name, "TypeScript");
    assert.equal(result[1].bytes, 400);
    assert.equal(result[1].percentage, 20);
    assert.equal(result[1].color, "#3178c6");
  });

  it("handles zero total bytes and empty repositories without division by zero", () => {
    const emptyRepo: ViewerRepoNode = {
      nameWithOwner: "adityamotale/empty",
      name: "empty",
      isPrivate: false,
      isFork: false,
      stargazerCount: 0,
      forkCount: 0,
      owner: { login: "adityamotale" },
    };

    assert.deepEqual(calculateLanguages([], "adityamotale"), []);
    assert.deepEqual(calculateLanguages([emptyRepo], "adityamotale"), []);
  });
});

describe("calculateRepositorySummary", () => {
  it("correctly aggregates owned repository counts, stars, and forks", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/public-repo",
        name: "public-repo",
        isPrivate: false,
        isFork: false,
        stargazerCount: 5,
        forkCount: 2,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "adityamotale/private-repo",
        name: "private-repo",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "adityamotale/forked-repo",
        name: "forked-repo",
        isPrivate: false,
        isFork: true,
        stargazerCount: 1,
        forkCount: 3,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "org/not-owned",
        name: "not-owned",
        isPrivate: false,
        isFork: false,
        stargazerCount: 100,
        forkCount: 50,
        owner: { login: "org" },
      },
    ];

    const result = calculateRepositorySummary(repos, "adityamotale");

    assert.equal(result.total_owned, 3);
    assert.equal(result.public, 2);
    assert.equal(result.private, 1);
    assert.equal(result.forks, 1);
    assert.equal(result.total_stars, 6);
    assert.equal(result.total_forks, 5);
  });
});

describe("calculateStreaks", () => {
  it("accurately computes streaks, active days, and busiest day", () => {
    const daily = {
      "2026-09-01": 2,
      "2026-09-02": 5,
      "2026-09-03": 10,
      "2026-09-04": 0,
      "2026-09-05": 1,
      "2026-09-06": 3,
    };

    const dateRange = {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-06T23:59:59Z",
    };

    const result = calculateStreaks(daily, dateRange);

    assert.equal(result.longest_streak_days, 3);
    assert.equal(result.current_streak_days, 2);
    assert.equal(result.active_days_count, 5);
    assert.equal(result.total_days_in_period, 6);
    assert.equal(result.activity_rate_percentage, 83.33);
    assert.deepEqual(result.busiest_day, { date: "2026-09-03", count: 10 });
  });

  it("resets current streak to 0 if the latest day in period has zero contributions", () => {
    const daily = {
      "2026-09-01": 5,
      "2026-09-02": 8,
      "2026-09-03": 0, // broken at the end
    };

    const result = calculateStreaks(daily, {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-03T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 2);
    assert.equal(result.current_streak_days, 0);
  });

  it("handles completely inactive periods safely", () => {
    const daily = {
      "2026-01-01": 0,
      "2026-01-02": 0,
    };

    const result = calculateStreaks(daily, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 0);
    assert.equal(result.current_streak_days, 0);
    assert.equal(result.active_days_count, 0);
    assert.equal(result.activity_rate_percentage, 0);
    assert.deepEqual(result.busiest_day, { date: "", count: 0 });
  });

  it("sorts chronological order even if keys are unordered", () => {
    const daily = {
      "2026-01-03": 1,
      "2026-01-01": 1,
      "2026-01-02": 1,
    };

    const result = calculateStreaks(daily, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-03T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 3);
    assert.equal(result.current_streak_days, 3);
  });
});

describe("buildRepositoryActivities", () => {
  it("unifies contributions and LOC records into non-duplicated items", () => {
    const repoContributions = new Map([
      [
        "user/repo-a",
        {
          commits: 10,
          issues: 2,
          pullRequests: 1,
          reviews: 0,
          isPrivate: false,
        },
      ],
      [
        "user/repo-b",
        { commits: 5, issues: 0, pullRequests: 0, reviews: 1, isPrivate: true },
      ],
    ]);

    const locResults = new Map([
      [
        "user/repo-a",
        {
          repository: "user/repo-a",
          is_private: false,
          is_fork: false,
          additions: 200,
          deletions: 50,
          commit_count: 8,
        },
      ],
      [
        "user/repo-c",
        {
          repository: "user/repo-c",
          is_private: false,
          is_fork: true,
          additions: 50,
          deletions: 10,
          commit_count: 2,
        },
      ],
    ]);

    const viewerRepos: ViewerRepoNode[] = [
      {
        nameWithOwner: "user/repo-a",
        name: "repo-a",
        isPrivate: false,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "user" },
      },
      {
        nameWithOwner: "user/repo-b",
        name: "repo-b",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "user" },
      },
      {
        nameWithOwner: "user/repo-c",
        name: "repo-c",
        isPrivate: false,
        isFork: true,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "user" },
      },
    ];

    const result = buildRepositoryActivities({
      repoContributions,
      locResults,
      viewerRepos,
    });

    assert.equal(result.length, 3);

    const repoA = result.find((r) => r.repository === "user/repo-a")!;
    assert.equal(repoA.commits, 10);
    assert.equal(repoA.issues, 2);
    assert.equal(repoA.pull_requests, 1);
    assert.equal(repoA.additions, 200);
    assert.equal(repoA.deletions, 50);
    assert.equal(repoA.net_lines, 150);
    assert.equal(repoA.total_contributions, 13);
    assert.equal(repoA.is_private, false);

    const repoB = result.find((r) => r.repository === "user/repo-b")!;
    assert.equal(repoB.commits, 5);
    assert.equal(repoB.additions, 0);
    assert.equal(repoB.deletions, 0);
    assert.equal(repoB.total_contributions, 6);
    assert.equal(repoB.is_private, true);

    const repoC = result.find((r) => r.repository === "user/repo-c")!;
    assert.equal(repoC.commits, 2);
    assert.equal(repoC.additions, 50);
    assert.equal(repoC.deletions, 10);
    assert.equal(repoC.net_lines, 40);
    assert.equal(repoC.total_contributions, 2);
    assert.equal(repoC.is_fork, true);

    assert.equal(result[0].repository, "user/repo-a");
    assert.equal(result[1].repository, "user/repo-b");
    assert.equal(result[2].repository, "user/repo-c");
  });

  it("correctly calculates negative net lines when deletions exceed additions", () => {
    const locResults = new Map([
      [
        "user/refactor-repo",
        {
          repository: "user/refactor-repo",
          is_private: false,
          is_fork: false,
          additions: 30,
          deletions: 120,
          commit_count: 3,
        },
      ],
    ]);

    const result = buildRepositoryActivities({
      repoContributions: new Map(),
      locResults,
      viewerRepos: [],
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].net_lines, -90);
    assert.equal(result[0].additions, 30);
    assert.equal(result[0].deletions, 120);
  });
});
