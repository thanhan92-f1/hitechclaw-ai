import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const esmPath = resolve(distDir, "index.js");
const cjsPath = resolve(distDir, "index.cjs");

copyFileSync(esmPath, cjsPath);
const cjsSource = readFileSync(cjsPath, "utf8")
  .replace("export class HiTechClawAI", "class HiTechClawAI")
  .concat("\nmodule.exports = { HiTechClawAI };\n");
writeFileSync(cjsPath, cjsSource, "utf8");
