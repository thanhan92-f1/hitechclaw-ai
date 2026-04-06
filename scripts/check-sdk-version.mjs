import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedVersion = process.argv[2]?.trim();
const packageJsonPath = resolve(process.cwd(), "packages/sdk/package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = String(packageJson.version ?? "").trim();
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!currentVersion || !semverPattern.test(currentVersion)) {
  console.error(`[sdk-version] packages/sdk/package.json has invalid version: ${currentVersion || "<empty>"}`);
  process.exit(1);
}

if (!expectedVersion) {
  console.log(`[sdk-version] Current SDK version: ${currentVersion}`);
  process.exit(0);
}

if (!semverPattern.test(expectedVersion)) {
  console.error(`[sdk-version] Expected version is not valid semver: ${expectedVersion}`);
  process.exit(1);
}

if (currentVersion !== expectedVersion) {
  console.error(
    `[sdk-version] Version mismatch. packages/sdk/package.json is ${currentVersion} but expected ${expectedVersion}.`
  );
  process.exit(1);
}

console.log(`[sdk-version] SDK version matches expected value: ${currentVersion}`);
