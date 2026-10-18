import fs from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Mirrors the tsup loaders: `.inline.ts` and `.scss` imports resolve to strings in the build,
 * so tests must see strings too instead of executing browser code in Node.
 */
const stringImports: Plugin = {
  name: "string-imports",
  enforce: "pre",
  load(id) {
    if (/\.inline\.ts$/.test(id) || /\.scss$/.test(id)) {
      return { code: `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};` };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [stringImports],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    reporters: ["default"],
  },
});
