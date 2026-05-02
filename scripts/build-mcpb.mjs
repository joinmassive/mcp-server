import archiver from "archiver";
import { execFileSync } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

if (manifest.version !== pkg.version) {
  throw new Error(
    `Version mismatch: manifest.json=${manifest.version} package.json=${pkg.version}`,
  );
}

if (!existsSync(resolve(root, "dist", "index.js"))) {
  throw new Error("dist/index.js not found. Run `npm run build` first.");
}

// TODO: when Tasks 12/14/15 land, ensure manifest.tools[] stays in sync with
// the tools registered in src/tools/*.ts. A sync check could be automated by
// importing each tool module and comparing names; for v0.1.0 it's manual.

// Stage a clean prod-only install in a temp dir so we never bundle the
// developer's working-tree node_modules (which contains devDependencies).
const staging = mkdtempSync(resolve(tmpdir(), "mcpb-staging-"));
console.error(`Staging clean prod install in ${staging}...`);
copyFileSync(resolve(root, "package.json"), resolve(staging, "package.json"));
copyFileSync(resolve(root, "package-lock.json"), resolve(staging, "package-lock.json"));
execFileSync(
  "npm",
  ["ci", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts"],
  { cwd: staging, stdio: ["ignore", "ignore", "inherit"], shell: false },
);

const outDir = resolve(root, "dist-mcpb");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `${manifest.name}-${manifest.version}.mcpb`);

const output = createWriteStream(outPath);
const archive = archiver("zip", { zlib: { level: 9 } });

try {
  archive.pipe(output);
  archive.file(resolve(root, "manifest.json"), { name: "manifest.json" });
  archive.file(resolve(root, "package.json"), { name: "package.json" });
  archive.file(resolve(root, "LICENSE"), { name: "LICENSE" });
  // TODO: ${__dirname} placeholder in manifest.json's mcp_config.args resolves
  // to the unpacked bundle directory at install time. Verify behavior in Task 10.
  archive.directory(resolve(root, "dist"), "dist");
  archive.directory(resolve(staging, "node_modules"), "node_modules");
  if (existsSync(resolve(root, "icon.png"))) {
    archive.file(resolve(root, "icon.png"), { name: "icon.png" });
  }
  if (existsSync(resolve(root, "README.md"))) {
    archive.file(resolve(root, "README.md"), { name: "README.md" });
  }

  await new Promise((res, rej) => {
    output.on("close", res);
    output.on("error", rej);
    archive.on("error", rej);
    archive.finalize();
  });

  console.error(`Built ${outPath} (${statSync(outPath).size} bytes)`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
