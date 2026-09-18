import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTransientGraphQLError } from "../lib/graphql.ts";

describe("isTransientGraphQLError", () => {
  it("identifies GitHub internal and transient GraphQL errors", () => {
    assert.equal(
      isTransientGraphQLError(
        "gh: Something went wrong while executing your query on 2026-09-18T05:52:57Z. Please include `6401:310C76:342F9FD:AF244F1:6AACD1B5` when reporting this issue.",
      ),
      true,
    );
    assert.equal(isTransientGraphQLError("HTTP 502: Bad Gateway"), true);
    assert.equal(
      isTransientGraphQLError("HTTP 503: Service Unavailable"),
      true,
    );
    assert.equal(isTransientGraphQLError("HTTP 504: Gateway Timeout"), true);
    assert.equal(
      isTransientGraphQLError("HTTP 500: Internal Server Error"),
      true,
    );
    assert.equal(isTransientGraphQLError("HTTP 429: Too Many Requests"), true);
    assert.equal(
      isTransientGraphQLError("You have exceeded a secondary rate limit"),
      true,
    );
    assert.equal(isTransientGraphQLError("was submitted too quickly"), true);
    assert.equal(
      isTransientGraphQLError("ETIMEDOUT: Connection timed out"),
      true,
    );
    assert.equal(
      isTransientGraphQLError("ECONNRESET: Connection reset by peer"),
      true,
    );
    assert.equal(isTransientGraphQLError("socket hang up"), true);
  });

  it("identifies non-transient errors correctly", () => {
    assert.equal(isTransientGraphQLError("HTTP 401: Bad credentials"), false);
    assert.equal(isTransientGraphQLError("HTTP 404: Not Found"), false);
    assert.equal(
      isTransientGraphQLError(
        "Field 'invalidField' doesn't exist on type 'Viewer'",
      ),
      false,
    );
  });
});
