export const GET_VIEWER_QUERY = `
  query getViewer($cursor: String) {
    viewer {
      id
      login
      name
      organizations(first: 50) {
        nodes {
          login
        }
      }
      allRepos: repositories(affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], first: 100, after: $cursor) {
        nodes {
          nameWithOwner
          name
          isPrivate
          isFork
          isArchived
          description
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
          latestRelease {
            tagName
            name
            publishedAt
            url
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

export const GET_REPO_COMMIT_LOC_QUERY = `
  query getRepoCommitLOC($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      isPrivate
      isFork
      languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
        edges {
          size
          node {
            name
            color
          }
        }
      }
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

export const GET_CONTRIBUTIONS_QUERY = `
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
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
      }
    }
  }
`;

export const GET_PRS_QUERY = `
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
          repository {
            nameWithOwner
            isPrivate
            isFork
            isArchived
            description
          }
        }
      }
    }
  }
`;

export const GET_RELEASES_QUERY = `
  query getReleases($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          tagName
          name
          publishedAt
          url
        }
      }
    }
  }
`;
