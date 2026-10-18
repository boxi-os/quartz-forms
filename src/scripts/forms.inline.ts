// Browser script of quartz-forms. Runs on every `nav` event (Quartz's SPA router); every
// listener is paired with `window.addCleanup`. Must stay a plain script: no `export`, no
// `declare global` (the build strips `export` statements and inlines the file into a <script>).
document.addEventListener("nav", () => {
  const forms = document.querySelectorAll<HTMLFormElement>("form.quartz-form");
  for (const form of forms) {
    const onSubmit = (event: Event) => {
      event.preventDefault();
    };
    form.addEventListener("submit", onSubmit);
    window.addCleanup(() => form.removeEventListener("submit", onSubmit));
  }
});
