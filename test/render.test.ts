import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import { toString } from "hast-util-to-string";
import type { Element } from "hast";
import { resolveOrThrow } from "../src/options";
import { makeContext } from "../src/render/context";
import { clientConfig, renderForm, renderMissing, scriptJson } from "../src/render/form";
import type { FormDefinition, FormField } from "../src/types";
import { contact, options } from "./helpers";

const ARMORED = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----";

function render(def: FormDefinition, extra: Record<string, unknown> = {}, lang = "en") {
  const opts = resolveOrThrow(options({ forms: { f: def }, ...extra }));
  const form = opts.forms.f!;
  const ctx = makeContext(opts, form, {
    lang,
    idPrefix: "qf-f",
    page: { title: "Page", slug: "docs/page" },
    serve: false,
  });
  const tree = renderForm(form, ctx);
  return { tree, html: toHtml(tree), config: clientConfig(form, ctx) };
}

function field(f: FormField, lang = "en") {
  const { tree, html } = render(contact({ fields: [f] }), {}, lang);
  const wrapper = tree.children.find(
    (c): c is Element => c.type === "element" && c.properties.dataField === f.name,
  );
  return { tree, html, wrapper };
}

describe("renderForm", () => {
  it("renders a form with id, language, hidden envelope fields, button, status and config", () => {
    const { html, tree } = render(contact({ title: { en: "Contact", de: "Kontakt" } }));
    expect(tree.tagName).toBe("form");
    expect(tree.properties.className).toEqual(["quartz-form"]);
    expect(tree.properties.dataForm).toBe("f");
    expect(tree.properties.method).toBe("post");
    expect(tree.properties.action).toBe("https://example.org/forms/send.php");
    expect(html).toContain('<h3 class="quartz-form__title">Contact</h3>');
    expect(html).toContain('<input type="hidden" name="form" value="f">');
    expect(html).toContain('<input type="hidden" name="lang" value="en">');
    expect(html).toContain('<input type="hidden" name="ts" value="">');
    expect(html).toContain('<button type="submit" class="quartz-form__button">Send</button>');
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('<script type="application/json" class="quartz-form-config">');
    expect(html).not.toContain('name="page"');
  });

  it("speaks the page language, from the plugin's texts and the form's records", () => {
    const { html } = render(contact({ title: { en: "Contact", de: "Kontakt" } }), {}, "de-DE");
    expect(html).toContain("Kontakt</h3>");
    expect(html).toContain(">Senden</button>");
    expect(html).toContain("Nachricht");
    expect(html).toContain("(Pflichtfeld)");
  });

  it("renders a text input with label, required mark, hint and error slot wired by aria", () => {
    const { html } = field({
      type: "email",
      name: "email",
      label: "E-mail",
      required: true,
      hint: "We reply here.",
      autocomplete: "email",
    });
    expect(html).toContain(
      '<label class="quartz-form__label" for="qf-f-email">E-mail<span class="quartz-form__required" aria-hidden="true"> *</span><span class="quartz-form__sr-only"> (required)</span></label>',
    );
    expect(html).toContain(
      '<input id="qf-f-email" name="email" required aria-required="true" aria-describedby="qf-f-email-hint qf-f-email-error" autocomplete="email" maxlength="2000" type="email">',
    );
    expect(html).toContain('<p class="quartz-form__hint" id="qf-f-email-hint">We reply here.</p>');
    expect(html).toContain('<p class="quartz-form__error" id="qf-f-email-error" hidden></p>');
  });

  it("gives a textarea its rows and the textarea length limit, a number its bounds", () => {
    expect(field({ type: "textarea", name: "m", label: "M", rows: 3 }).html).toContain(
      '<textarea id="qf-f-m" name="m" aria-describedby="qf-f-m-error" maxlength="20000" rows="3"></textarea>',
    );
    expect(
      field({ type: "number", name: "n", label: "N", min: 1, max: 9, step: 2 }).html,
    ).toContain('min="1" max="9" step="2" inputmode="decimal"');
  });

  it("renders select with a placeholder option, radio and checkboxes as fieldsets", () => {
    const opts = [
      { value: "a", label: { en: "Alpha", de: "Alpha" } },
      { value: "b", label: "Beta" },
    ];
    const select = field({
      type: "select",
      name: "s",
      label: "S",
      required: true,
      options: opts,
    }).html;
    expect(select).toContain('<select id="qf-f-s" name="s" required aria-required="true"');
    expect(select).toContain('<option value="" selected disabled>Please choose</option>');
    expect(select).toContain('<option value="b">Beta</option>');

    const radio = field({
      type: "radio",
      name: "r",
      label: "R",
      required: true,
      options: opts,
    }).html;
    expect(radio).toContain(
      '<fieldset class="quartz-form__group" id="qf-f-r" aria-describedby="qf-f-r-error" data-required="true" data-minimum="1">',
    );
    expect(radio).toContain('<legend class="quartz-form__label">R<span');
    expect(radio).toContain('<input type="radio" id="qf-f-r-0" name="r" value="a" required>');

    const boxes = field({ type: "checkboxes", name: "c", label: "C", options: opts }).html;
    expect(boxes).toContain('<input type="checkbox" id="qf-f-c-1" name="c" value="b">');
    expect(boxes).not.toContain("data-required");
  });

  it("renders a scale as radios from min to max with captions", () => {
    const { html } = field({
      type: "scale",
      name: "rating",
      label: "Rating",
      min: 1,
      max: 3,
      minLabel: "Low",
      maxLabel: "High",
    });
    expect(html).toContain('<span class="quartz-form__scale-caption">Low</span>');
    expect(html).toContain('<input type="radio" id="qf-f-rating-3" name="rating" value="3">');
    expect(html).not.toContain('value="4"');
  });

  it("renders consent as a required checkbox with the sentence and the link", () => {
    const { html } = field({
      type: "consent",
      name: "ok",
      text: "I agree.",
      link: "/privacy",
    });
    expect(html).toContain(
      '<input type="checkbox" id="qf-f-ok" name="ok" value="yes" required aria-required="true" aria-describedby="qf-f-ok-error">',
    );
    expect(html).toContain(
      'I agree. <a href="/privacy" target="_blank" rel="noopener">Privacy policy</a>',
    );
  });

  it("renders the pgpKey field with a file button, a textarea and a status line", () => {
    const { html } = field({ type: "pgpKey", name: "key", label: "Your key" });
    expect(html).toContain(
      '<input type="file" id="qf-f-key-file" name="_key_file" accept=".asc, .gpg, .pgp, .txt, application/pgp-keys" class="quartz-form__sr-only">',
    );
    expect(html).toContain(
      '<textarea id="qf-f-key" name="key" rows="4" aria-describedby="qf-f-key-hint qf-f-key-error" placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----" maxlength="16384" spellcheck="false" data-pgp-key="true"></textarea>',
    );
    expect(html).toContain(
      '<p class="quartz-form__key-status" id="qf-f-key-status" role="status"></p>',
    );
    expect(html).toContain("Or paste the armored key here.");
  });

  it("renders a hidden field and the honeypot, and leaves the honeypot out when off", () => {
    const { html } = field({ type: "hidden", name: "topic", value: "sales" });
    expect(html).toContain('<input type="hidden" name="topic" value="sales">');
    expect(html).toContain(
      '<div class="quartz-form__hp" aria-hidden="true"><label for="qf-f-_hp_website">Website</label><input type="text" id="qf-f-_hp_website" name="_hp_website" tabindex="-1" autocomplete="off"></div>',
    );
    const off = render(contact({ spam: { honeypot: false } })).html;
    expect(off).not.toContain("_hp_website");
  });

  it("writes the page context only when asked, and never for an anonymous form", () => {
    const yes = render(contact({ pageContext: true }));
    expect(yes.html).toContain('<input type="hidden" name="page" value="docs/page">');
    expect(yes.html).toContain("Refers to the page “Page”.");
    expect(yes.config.page).toEqual({ title: "Page", slug: "docs/page" });
    const anon = render(contact({ pageContext: true, anonymous: true }));
    expect(anon.html).not.toContain('name="page"');
    expect(anon.html).toContain("This form is anonymous");
    expect(anon.config.page).toBeUndefined();
  });

  it("with encryption required: no action, disabled button, noscript notice, keys in the config", () => {
    const { tree, html, config } = render(contact({ encryption: { mode: "required" } }), {
      keys: { k: { armored: ARMORED } },
    });
    expect(tree.properties.action).toBeUndefined();
    expect(html).toContain(
      '<button type="submit" class="quartz-form__button" disabled data-enable-with-js="true">',
    );
    expect(html).toContain(
      '<noscript><p class="quartz-form__note quartz-form__note--noscript">This form sends encrypted and needs JavaScript to do so.</p></noscript>',
    );
    expect(html).toContain('<p class="quartz-form__encrypted" data-fingerprint="true" hidden></p>');
    expect(config.encryption).toEqual({ mode: "required", keys: [ARMORED], showFingerprint: true });
    expect(config.success.text).toBe("Thank you, your message has been sent encrypted.");
  });

  it("with noScript off: no action and a disabled button until the script runs, own notice", () => {
    const { tree, html } = render(contact({ spam: { noScript: false } }));
    expect(tree.properties.action).toBeUndefined();
    expect(html).toContain(
      '<button type="submit" class="quartz-form__button" disabled data-enable-with-js="true">',
    );
    expect(html).toContain(
      '<noscript><p class="quartz-form__note quartz-form__note--noscript">This form needs JavaScript to send.</p></noscript>',
    );
  });

  it("with encryption optional: the plaintext action stays, the toggle waits for the script", () => {
    const { tree, html } = render(contact({ encryption: { mode: "optional" } }), {
      keys: { k: { armored: ARMORED } },
    });
    expect(tree.properties.action).toBe("https://example.org/forms/send.php");
    // Not ticked and not enabled: without the script the post is plaintext, and the box must not
    // claim otherwise. The script ticks it (client test).
    expect(html).toContain(
      '<input type="checkbox" id="qf-f-_encrypt" name="_encrypt" value="yes" disabled data-enable-with-js="true">',
    );
    expect(html).not.toContain('value="yes" checked');
    expect(html).toContain(">Send encrypted</label>");
    expect(html).toContain(
      '<noscript><p class="quartz-form__note quartz-form__note--noscript">Without JavaScript this form sends unencrypted.</p></noscript>',
    );
    expect(render(contact()).html).not.toContain("<noscript>");
  });

  it("reads a key from a file", () => {
    const { config } = render(contact({ encryption: { mode: "optional" } }), {
      keys: { k: { file: "test/fixtures/public.asc" } },
    });
    expect(config.encryption.keys[0]).toMatch(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/);
  });

  it("targets the presets and mailto", () => {
    const w3 = render(contact(), { transport: { kind: "web3forms", url: "KEY" } });
    expect(w3.tree.properties.action).toBe("https://api.web3forms.com/submit");
    expect(w3.html).toContain('<input type="hidden" name="access_key" value="KEY">');
    const fs = render(contact(), { transport: { kind: "formspree", url: "abc" } });
    expect(fs.tree.properties.action).toBe("https://formspree.io/f/abc");
    const mail = render(contact({ recipient: "o@example.org" }), { transport: { kind: "mailto" } });
    expect(mail.tree.properties.action).toBe("mailto:o@example.org");
    expect(mail.tree.properties.encType).toBe("text/plain");
    expect(mail.html).toContain("Your mail program opens with the message.");
    const extra = render(contact(), {
      transport: { kind: "endpoint", url: "https://e.example/x", extra: { to: "sales" } },
    });
    expect(extra.html).toContain('<input type="hidden" name="to" value="sales">');
  });

  it("puts the rules the browser needs into the config", () => {
    const { config } = render(
      contact({
        fields: [
          {
            type: "text",
            name: "t",
            label: { en: "T", de: "T" },
            required: true,
            pattern: "^a+$",
            maxLength: 10,
          },
          { type: "radio", name: "r", label: "R", options: [{ value: "x", label: "X" }] },
          { type: "scale", name: "s", label: "S", min: 1, max: 5 },
          { type: "consent", name: "c", text: "ok" },
        ],
      }),
    );
    expect(config.fields).toEqual([
      { name: "t", type: "text", label: "T", required: true, maxLength: 10, pattern: "^a+$" },
      {
        name: "r",
        type: "radio",
        label: "R",
        required: false,
        options: ["x"],
        optionLabels: { x: "X" },
      },
      { name: "s", type: "scale", label: "S", required: false, min: 1, max: 5 },
      { name: "c", type: "consent", label: "ok", required: true },
    ]);
    expect(config.transport).toEqual({
      kind: "relay",
      url: "https://example.org/forms/send.php",
      format: "json",
      extra: {},
    });
    // The recipient's name is the relay's business: nothing in the page names it.
    expect("recipient" in config).toBe(false);
    expect(config.spam.pow).toBe(false);
    expect(config.texts.required).toBe("This field is required.");
  });

  it("escapes < in the embedded JSON so it cannot close the script", () => {
    expect(scriptJson({ a: "</script><b>" })).toBe('{"a":"\\u003c/script>\\u003cb>"}');
    const { html } = render(contact({ title: "</script>" }));
    expect(html.split("</script>").length).toBe(2);
  });

  it("extra class names sit next to the fixed one; the missing hint only shows in serve mode", () => {
    const { tree } = render(contact({ className: "wide fancy" }));
    expect(tree.properties.className).toEqual(["quartz-form", "wide", "fancy"]);
    expect(renderMissing("x", false)).toBeNull();
    expect(toString(renderMissing("x", true)!)).toBe("quartz-forms: no form x in options.forms.");
  });
});

describe("captcha container", () => {
  it("renders the provider's container with the site key, never for anonymous forms", () => {
    const turnstile = render(
      contact({ spam: { captcha: "turnstile", captchaSiteKey: "abc" } }),
    ).html;
    expect(turnstile).toContain(
      '<div class="quartz-form__captcha cf-turnstile" data-sitekey="abc" data-captcha="turnstile"></div>',
    );
    const h = render(contact({ spam: { captcha: "hcaptcha", captchaSiteKey: "abc" } })).html;
    expect(h).toContain('class="quartz-form__captcha h-captcha"');
    const anon = render(
      contact({ anonymous: true, spam: { captcha: "hcaptcha", captchaSiteKey: "abc" } }),
    );
    expect(anon.html).not.toContain("quartz-form__captcha");
    expect(anon.config.spam.captcha).toBe("none");
    expect(render(contact()).html).not.toContain("quartz-form__captcha");
  });
});
