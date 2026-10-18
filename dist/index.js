import { createRequire } from 'module';
import { resolveOrThrow, logHints } from './chunk-JGSMUCPV.js';
export { FormBox_default as FormBox, defaultOptions, resolveOptions, resolveOrThrow, templateNames, templateOf } from './chunk-JGSMUCPV.js';

createRequire(import.meta.url);

// src/transformer.ts
var Forms = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  return {
    name: "Forms",
    markdownPlugins() {
      return [];
    },
    htmlPlugins() {
      return [];
    }
  };
};

// src/emitter.ts
var FormsAssets = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  return {
    name: "FormsAssets",
    async emit() {
      return [];
    }
  };
};

// src/text.ts
function resolveText(text, lang) {
  if (text === void 0) return void 0;
  if (typeof text === "string") return text;
  const entries = Object.entries(text);
  if (entries.length === 0) return void 0;
  const want = lang.toLowerCase();
  const exact = entries.find(([k]) => k.toLowerCase() === want);
  if (exact) return exact[1];
  const primary = want.split(/[-_]/)[0];
  const sub = entries.find(([k]) => k.toLowerCase().split(/[-_]/)[0] === primary);
  if (sub) return sub[1];
  return entries[0][1];
}

export { Forms, FormsAssets, resolveText };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map