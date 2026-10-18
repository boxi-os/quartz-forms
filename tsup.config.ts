import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";
import fs from "fs";
import path from "path";
import { validateManifest } from "./src/build/validate-manifest";
import { BROWSER_FILES, NODE_FILE } from "./src/pgp/load";

validateManifest();

/**
 * Esbuild plugin that bundles `.inline.ts` files into browser-ready JavaScript strings and
 * compiles `.scss` files to CSS strings. Copied from the sibling plugins (quartz-navigations);
 * mirrors Quartz v5's own `inline-script-loader` in `quartz/cli/handlers.js`. The vitest config
 * mirrors both loaders so tests see the same strings.
 */
const inlineScriptPlugin: Plugin = {
  name: "inline-script-loader",
  setup(parentBuild) {
    const absWorkingDir = parentBuild.initialOptions.absWorkingDir ?? process.cwd();

    parentBuild.onLoad({ filter: /\.scss$/ }, async (args) => {
      const sass = await import("sass");
      const result = sass.compile(args.path);
      return { contents: result.css, loader: "text" };
    });

    parentBuild.onLoad({ filter: /\.inline\.ts$/ }, async (args) => {
      const esbuild = await import("esbuild");
      const fs = await import("fs");
      let text = await fs.promises.readFile(args.path, "utf8");

      // Strip export statements that were added for the module system —
      // inline scripts run in a <script> tag, not as ES modules
      text = text.replace(/^export default /gm, "");
      text = text.replace(/^export /gm, "");

      const result = await esbuild.build({
        stdin: {
          contents: text,
          loader: "ts",
          resolveDir: path.dirname(args.path),
          sourcefile: path.relative(absWorkingDir, args.path),
        },
        write: false,
        bundle: true,
        minify: true,
        platform: "browser",
        format: "esm",
        target: "es2020",
        sourcemap: false,
        external: ["http://*", "https://*"],
      });

      const js = result.outputFiles?.[0]?.text;
      if (!js) throw new Error(`inline-script-loader: no JS output for ${args.path}`);
      return { contents: js, loader: "text" };
    });
  },
};

/**
 * Singleton externals: packages that must resolve to the Quartz host's own copy at runtime.
 * Only peerDependencies may appear here; Quartz symlinks them into a pre-built plugin and
 * installs nothing else (`linkPeerDependencies()` in `quartz/plugins/loader/gitLoader.ts`).
 */
const SINGLETON_EXTERNALS = [/^preact($|\/)/, /^@jackyzha0\/quartz($|\/)/, /^vfile($|\/)/];

/**
 * OpenPGP.js is not bundled either: the browser loads it as a separate file from
 * `static/quartz-forms/openpgp/`, the build step from `dist/vendor/openpgp/node/`. Both are
 * copied below from the installed package, unmodified, with its LGPL licence text; a
 * development checkout before the first build falls back to the dev dependency (`src/pgp/load.ts`).
 */
const OPENPGP_EXTERNAL = [/^openpgp($|\/)/];

function copyVendor(): void {
  const from = path.resolve("node_modules/openpgp");
  const to = path.resolve("dist/vendor/openpgp");
  fs.mkdirSync(path.join(to, "node"), { recursive: true });
  for (const file of BROWSER_FILES)
    fs.copyFileSync(path.join(from, "dist/lightweight", file), path.join(to, file));
  fs.copyFileSync(path.join(from, "dist", NODE_FILE), path.join(to, NODE_FILE));
  fs.copyFileSync(path.join(from, "LICENSE"), path.join(to, "LICENSE"));
  const pkg = JSON.parse(fs.readFileSync(path.join(from, "package.json"), "utf8"));
  fs.writeFileSync(
    path.join(to, "VERSION"),
    `openpgp ${pkg.version} (${pkg.license}), copied unmodified from the npm package by tsup.config.ts\n`,
  );
}

/** tsup externalizes `dependencies`; `@quartz-community/*` must be pulled back into the bundle. */
const FORCE_BUNDLED = [/^@quartz-community\//];

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
    "components/index": "src/components/index.ts",
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  splitting: true,
  outDir: "dist",
  platform: "node",
  noExternal: FORCE_BUNDLED,
  external: [...SINGLETON_EXTERNALS, ...OPENPGP_EXTERNAL],
  onSuccess: async () => {
    copyVendor();
  },
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "preact";
  },
  esbuildPlugins: [inlineScriptPlugin],
});
