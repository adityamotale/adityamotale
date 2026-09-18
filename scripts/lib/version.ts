export function bumpSemver(
  version: string,
  type: "patch" | "minor" | "major" = "patch",
): string {
  const parts = version
    .trim()
    .split(".")
    .map((num) => parseInt(num, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
  let [major, minor, patch] = parts;
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

export function updateChangelog(
  currentChangelog: string,
  newVersion: string,
  dateStr: string,
  message: string,
): string {
  const newEntry = `## [${newVersion}] - ${dateStr}\n\n- ${message.trim()}\n`;

  if (currentChangelog.includes(`## [${newVersion}]`)) {
    return currentChangelog;
  }

  const headerMatch = currentChangelog.match(/^(# Changelog\s*\n+)/i);
  if (headerMatch) {
    const header = headerMatch[0];
    const rest = currentChangelog.slice(header.length).trimStart();
    return (
      `${header}${newEntry}\n${rest}`.replace(/\n{3,}/g, "\n\n").trim() + "\n"
    );
  }

  return (
    `# Changelog\n\n${newEntry}\n${currentChangelog}`
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

export function updatePackageJson(content: string, newVersion: string): string {
  const json = JSON.parse(content);
  json.version = newVersion;
  return JSON.stringify(json, null, 2) + "\n";
}

export function updatePackageLock(content: string, newVersion: string): string {
  const json = JSON.parse(content);
  json.version = newVersion;
  if (json.packages && json.packages[""]) {
    json.packages[""].version = newVersion;
  }
  return JSON.stringify(json, null, 2) + "\n";
}
