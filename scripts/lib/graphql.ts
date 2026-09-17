import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GraphQLOptions {
  token?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export function getGitHubToken(): string {
  const envToken =
    process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const cliToken = execFileSync("gh", ["auth", "token"], {
      encoding: "utf-8",
    }).trim();
    if (cliToken) return cliToken;
  } catch {}

  throw new Error(
    'Missing GitHub token: Set GH_TOKEN or authenticate via "gh auth login"',
  );
}

export async function runGraphQLAsync<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options?: GraphQLOptions,
): Promise<T> {
  const token = options?.token || getGitHubToken();
  const cliArgs = ["api", "graphql", "-f", `query=${query}`];

  for (const [key, val] of Object.entries(variables)) {
    if (val !== undefined && val !== null) {
      cliArgs.push("-F", `${key}=${val}`);
    }
  }

  const maxRetries = options?.maxRetries ?? 3;
  let delayMs = options?.retryDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stdout } = await execFileAsync("gh", cliArgs, {
        encoding: "utf-8",
        env: { ...process.env, GH_TOKEN: token },
        maxBuffer: 50 * 1024 * 1024,
      });

      const parsed = JSON.parse(stdout);
      if (parsed.errors?.length) {
        throw new Error(
          `GraphQL errors: ${parsed.errors.map((e: { message: string }) => e.message).join("; ")}`,
        );
      }

      if (!parsed.data) {
        throw new Error('GraphQL response missing "data" payload.');
      }

      return parsed.data as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isTransient = /HTTP (499|502|503|403)|ETIMEDOUT|ECONNRESET/.test(
        message,
      );

      if (isTransient && attempt < maxRetries) {
        console.warn(
          `[GraphQL Retry] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      const sanitizedMsg = token
        ? message.replaceAll(token, "[REDACTED]")
        : message;
      throw new Error(`GraphQL request failed: ${sanitizedMsg}`);
    }
  }

  throw new Error("GraphQL request failed after retries.");
}
