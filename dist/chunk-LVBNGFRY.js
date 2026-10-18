import { createRequire } from 'module';

createRequire(import.meta.url);

// src/options.ts
var defaultOptions = {
  forms: {},
  frontmatterKey: "form",
  codeBlockLang: "quartz-form",
  language: "auto"
};
function resolveOptions(userOpts) {
  const opts = { ...defaultOptions, ...userOpts ?? {} };
  return { ...opts, forms: opts.forms ?? {} };
}

// src/components/styles/forms.scss
var forms_default = ".quartz-form {\n  --quartz-forms-gap: 0.75rem;\n  display: flex;\n  flex-direction: column;\n  gap: var(--quartz-forms-gap);\n}";

// src/scripts/forms.inline.ts
var forms_inline_default = 'document.addEventListener("nav",()=>{let n=document.querySelectorAll("form.quartz-form");for(let e of n){let t=o=>{o.preventDefault()};e.addEventListener("submit",t),window.addCleanup(()=>e.removeEventListener("submit",t))}});\n';

// src/components/FormBox.tsx
var FormBox_default = ((userOpts) => {
  const opts = resolveOptions(userOpts);
  const FormBox = (_props) => {
    if (Object.keys(opts.forms).length === 0) return null;
    return null;
  };
  FormBox.css = forms_default;
  FormBox.afterDOMLoaded = forms_inline_default;
  return FormBox;
});

export { FormBox_default, defaultOptions, resolveOptions };
//# sourceMappingURL=chunk-LVBNGFRY.js.map
//# sourceMappingURL=chunk-LVBNGFRY.js.map