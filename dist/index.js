import { createRequire } from 'module';
import { resolveOrThrow, logHints } from './chunk-APOAHHRS.js';
export { FormBox_default as FormBox, Forms, defaultOptions, resolveOptions, resolveOrThrow, resolveText, templateNames, templateOf } from './chunk-APOAHHRS.js';

createRequire(import.meta.url);

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

export { FormsAssets };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map