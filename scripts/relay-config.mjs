#!/usr/bin/env node
// Writes relay/php/config.generated.php from a site's quartz.config.yaml: the forms, their
// fields and spam settings, so the relay checks what the build and the browser check. Creates
// relay/php/config.php once (with a fresh secret) and never touches it again: addresses and
// origins are yours.
//
//   npm run relay:config -- /path/to/site [--out relay/php] [--skip-pattern-check]
//
// A thin wrapper around `node dist/cli.js relay` (src/cli.ts), which is what an installed copy
// and QuartzControl run; needs the plugin built (`npm run build`). With a `php` on the PATH every
// field pattern is compiled the way send.php compiles it, and a pattern PCRE cannot read stops
// the run: `--skip-pattern-check` writes the config anyway.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a === "--skip-pattern-check");
const args = argv.filter((a) => a !== "--skip-pattern-check");
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? (args[outIndex + 1] ?? "") : path.join(root, "relay", "php");
const site = args.filter((a, i) => a !== "--out" && i !== outIndex + 1)[0];

const { main } = await import(pathToFileURL(path.join(root, "dist", "cli.js")).href);
const forward = ["relay", ...(site ? ["--site", site] : []), "--out", out, ...flags];
process.exitCode = await main(forward);
