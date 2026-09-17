import { runGraphQLAsync } from "./graphql.ts";
import type { DateRange, PullRequestSummary } from "./types.ts";

const GET_VIEWER_REPOS_QUERY = `
  query getViewerRepos($cursor: String) {
    viewer {
      login
      id
      allRepos: repositories(affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], first: 100, after: $cursor) {
        nodes {
          nameWithOwner
          name
          isPrivate
          isFork
          stargazerCount
          forkCount
          owner { login }
          defaultBranchRef { name }
          languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const GET_REPO_COMMIT_LOC_QUERY = `
  query getRepoCommitLOC($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      isPrivate
      isFork
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, author: { id: $authorId }, since: $since, until: $until, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                oid
                additions
                deletions
              }
            }
          }
        }
      }
    }
  }
`;

const GET_CONTRIBUTIONS_QUERY = `
  query getContributions($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner isPrivate }
          contributions { totalCount }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner isPrivate }
          contributions { totalCount }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner isPrivate }
          contributions { totalCount }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner isPrivate }
          contributions { totalCount }
        }
      }
    }
  }
`;

const GET_PRS_QUERY = `
  query getPRs($searchQuery: String!, $cursor: String) {
    search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          title
          state
          merged
        }
      }
    }
  }
`;

export interface ViewerRepoNode {
  nameWithOwner: string;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  stargazerCount: number;
  forkCount: number;
  owner: { login: string };
  defaultBranchRef?: { name: string } | null;
  languages?: {
    edges: Array<{
      size: number;
      node: {
        name: string;
        color: string | null;
      };
    }>;
  };
}

export interface ViewerContext {
  login: string;
  id: string;
  repositories: ViewerRepoNode[];
}

export interface RepoContribDelta {
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  isPrivate: boolean;
}

export interface WindowContributions {
  totalContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  restricted: number;
  daily: Record<string, number>;
  repoContributions: Map<string, RepoContribDelta>;
}

export interface RepoLocStat {
  repository: string;
  is_private: boolean;
  is_fork: boolean;
  additions: number;
  deletions: number;
  commit_count: number;
}

export async function fetchViewerContext(): Promise<ViewerContext> {
  const repositories: ViewerRepoNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let login = "";
  let id = "";

  while (hasNextPage) {
    const data: any = await runGraphQLAsync(GET_VIEWER_REPOS_QUERY, { cursor });
    const viewer = data.viewer;
    if (!viewer) break;

    login = viewer.login;
    id = viewer.id;

    for (const node of viewer.allRepos?.nodes || []) {
      repositories.push(node);
    }

    hasNextPage = viewer.allRepos?.pageInfo?.hasNextPage;
    cursor = viewer.allRepos?.pageInfo?.endCursor;
  }

  return { login, id, repositories };
}

export async function fetchContributionsWindow(
  fromISO: string,
  toISO: string,
): Promise<WindowContributions> {
  const data: any = await runGraphQLAsync(GET_CONTRIBUTIONS_QUERY, {
    from: fromISO,
    to: toISO,
  });
  const cc = data.viewer?.contributionsCollection;
  if (!cc) {
    throw new Error(`Failed to fetch contributions for ${fromISO} - ${toISO}`);
  }

  const daily: Record<string, number> = {};
  for (const week of cc.contributionCalendar?.weeks || []) {
    for (const day of week.contributionDays || []) {
      daily[day.date] = day.contributionCount;
    }
  }

  const repoContributions = new Map<string, RepoContribDelta>();

  const getOrCreate = (name: string, isPrivate: boolean): RepoContribDelta => {
    if (!repoContributions.has(name)) {
      repoContributions.set(name, {
        commits: 0,
        issues: 0,
        pullRequests: 0,
        reviews: 0,
        isPrivate,
      });
    }
    return repoContributions.get(name)!;
  };

  const tally = (items: any[], field: keyof RepoContribDelta) => {
    for (const item of items || []) {
      const entry = getOrCreate(
        item.repository.nameWithOwner,
        item.repository.isPrivate,
      );
      (entry[field] as number) += item.contributions?.totalCount || 0;
    }
  };

  tally(cc.commitContributionsByRepository, "commits");
  tally(cc.issueContributionsByRepository, "issues");
  tally(cc.pullRequestContributionsByRepository, "pullRequests");
  tally(cc.pullRequestReviewContributionsByRepository, "reviews");

  return {
    totalContributions: cc.contributionCalendar?.totalContributions || 0,
    commits: cc.totalCommitContributions || 0,
    issues: cc.totalIssueContributions || 0,
    pullRequests: cc.totalPullRequestContributions || 0,
    reviews: cc.totalPullRequestReviewContributions || 0,
    restricted: cc.restrictedContributionsCount || 0,
    daily,
    repoContributions,
  };
}

export async function fetchRepoLOC(
  viewerId: string,
  repos: Array<{ nameWithOwner: string; isPrivate: boolean; isFork: boolean }>,
  dateRange: DateRange,
  concurrency = 5,
): Promise<Map<string, RepoLocStat>> {
  const results = new Map<string, RepoLocStat>();

  for (let i = 0; i < repos.length; i += concurrency) {
    const chunk = repos.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ nameWithOwner, isPrivate, isFork }) => {
        const [owner, name] = nameWithOwner.split("/");
        if (!owner || !name) return;

        let additions = 0;
        let deletions = 0;
        let commitCount = 0;
        let cursor: string | null = null;
        let hasNextPage = true;

        try {
          while (hasNextPage) {
            const data: any = await runGraphQLAsync(GET_REPO_COMMIT_LOC_QUERY, {
              owner,
              name,
              authorId: viewerId,
              since: dateRange.from,
              until: dateRange.to,
              cursor,
            });

            const history = data.repository?.defaultBranchRef?.target?.history;
            if (!history?.nodes) break;

            for (const commit of history.nodes) {
              commitCount++;
              additions += commit.additions || 0;
              deletions += commit.deletions || 0;
            }

            hasNextPage = history.pageInfo?.hasNextPage;
            cursor = history.pageInfo?.endCursor;
          }

          if (commitCount > 0 || additions > 0 || deletions > 0) {
            results.set(nameWithOwner, {
              repository: nameWithOwner,
              is_private: isPrivate,
              is_fork: isFork,
              additions,
              deletions,
              commit_count: commitCount,
            });
          }
        } catch {}
      }),
    );
  }

  return results;
}

export async function fetchPullRequests(
  username: string,
  dateRange: DateRange,
): Promise<PullRequestSummary> {
  const fromDate = dateRange.from.slice(0, 10);
  const toDate = dateRange.to.slice(0, 10);
  const searchQuery = `author:${username} type:pr created:${fromDate}..${toDate}`;

  let total = 0;
  let merged = 0;
  let open = 0;
  let closedUnmerged = 0;
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: any = await runGraphQLAsync(GET_PRS_QUERY, {
      searchQuery,
      cursor,
    });
    const search = data.search;
    if (!search?.nodes) break;

    for (const pr of search.nodes) {
      total++;
      if (pr.merged) merged++;
      else if (pr.state === "OPEN") open++;
      else closedUnmerged++;
    }

    hasNextPage = search.pageInfo?.hasNextPage;
    cursor = search.pageInfo?.endCursor;
  }

  const mergeRate =
    total > 0 ? parseFloat(((merged / total) * 100).toFixed(2)) : 0;

  return {
    total,
    merged,
    open,
    closed_unmerged: closedUnmerged,
    merge_rate_percentage: mergeRate,
  };
}
