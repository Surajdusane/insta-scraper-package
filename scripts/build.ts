import { $ } from "bun";

await $`rm -rf dist`;

await $`bun build ./src/index.ts --outfile ./dist/index.js --format esm --target node`;
await $`bun build ./src/index.ts --outfile ./dist/index.cjs --format cjs --target node`;
await $`bunx tsc`;

console.log("Build complete: dist/index.js (ESM), dist/index.cjs (CJS), dist/types/*.d.ts");
