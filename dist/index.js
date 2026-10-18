import { createRequire } from 'module';
import { resolveOptions } from './chunk-LVBNGFRY.js';
export { FormBox_default as FormBox, defaultOptions, resolveOptions } from './chunk-LVBNGFRY.js';

createRequire(import.meta.url);

// src/transformer.ts
var Forms = (userOpts) => {
  resolveOptions(userOpts);
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
  resolveOptions(userOpts);
  return {
    name: "FormsAssets",
    async emit() {
      return [];
    }
  };
};

export { Forms, FormsAssets };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map