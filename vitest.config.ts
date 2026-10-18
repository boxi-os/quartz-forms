import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Mirrors the tsup loaders: `.inline.ts` and `.scss` imports resolve to strings in the build,
 * so tests must see strings too instead of executing browser code in Node. The resolved id is
 * a virtual one (`\0` prefix) so Vitest's own CSS handling, which hands back an empty module
 * for anything whose id looks like a stylesheet, never sees the `.scss` file.
 */
const PREFIX = "\0string-import:";
/** Appended so the id no longer ends in `.scss`, which is what Vitest's CSS check looks at. */
const SUFFIX = ".txt";

function toFile(id: string): string {
  const file = id.slice(PREFIX.length, -SUFFIX.length);
  // Vitest hands ids inside the root back root-relative ("/src/…").
  return fs.existsSync(file) ? file : path.join(process.cwd(), file);
}

const stringImports: Plugin = {
  name: "string-imports",
  enforce: "pre",
  resolveId(source, importer) {
    if (source.startsWith(PREFIX)) return source;
    if (!/\.inline(\.ts)?$|\.scss$/.test(source)) return null;
    const withExt = /\.inline$/.test(source) ? `${source}.ts` : source;
    const abs = path.isAbsolute(withExt)
      ? withExt
      : path.resolve(importer ? path.dirname(importer) : process.cwd(), withExt);
    return PREFIX + abs + SUFFIX;
  },
  load(id) {
    if (!id.startsWith(PREFIX)) return null;
    return { code: `export default ${JSON.stringify(fs.readFileSync(toFile(id), "utf8"))};` };
  },
};

export default defineConfig({
  plugins: [stringImports],
  test: {
    environment: "node",
    env: { QUARTZ_FORMS_DEV_OPENPGP: "1" },
    include: ["test/**/*.test.ts"],
    reporters: ["default"],
  },
});
