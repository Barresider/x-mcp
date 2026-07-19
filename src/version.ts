import { readFileSync } from "fs";
import { resolve } from "path";

interface PackageMetadata {
  version?: unknown;
}

const packageMetadata = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
) as PackageMetadata;

if (typeof packageMetadata.version !== "string" || packageMetadata.version === "") {
  throw new Error("package.json must define a non-empty version");
}

export const packageVersion = packageMetadata.version;
