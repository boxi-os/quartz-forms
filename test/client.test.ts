// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { toHtml } from "hast-util-to-html";
import { resolveOrThrow } from "../src/options";
import { makeContext } from "../src/render/context";
import { renderForm } from "../src/render/form";
import type { FormDefinition, QuartzFormsOptions } from "../src/types";
import type { FormField } from "../src/types";
import { contact, options } from "./helpers";
import {
  conditionCases,
  conditionFields,
  mailCases,
  mailFields,
  mailPage,
  parityCases,
  parityFields,
  type ParityOutcome,
} from "./parity-cases";

/**
 * Runs the browser script the way Quartz does: compiled to plain JS, evaluated once, driven by
 * the `nav` event, against the markup the real renderer produces.
 */
const cleanups: (() => void)[] = [];
const fetchMock = vi.fn();
const navigateMock = vi.fn();

function mount(
  def: FormDefinition,
  extra: Partial<QuartzFormsOptions> = {},
  lang = "en",
  page = { title: "Page", slug: "docs/page" },
) {
  const opts = resolveOrThrow(options({ forms: { f: def }, ...extra }));
  const form = opts.forms.f!;
  const ctx = makeContext(opts, form, {
    lang,
    idPrefix: "qf-f",
    page,
    serve: false,
  });
  document.body.dataset.basepath = "";
  document.body.innerHTML = `<main>${toHtml(renderForm(form, ctx))}</main>`;
  return document.querySelector<HTMLFormElement>("form.quartz-form")!;
}

async function nav() {
  for (const fn of cleanups.splice(0)) fn();
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "docs/page" } }) as never);
  await tick();
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  // the handler awaits fetch and json(); give it a few turns
  for (let i = 0; i < 5; i++) await tick();
}

/** Waits, in real time, until `done` holds: for what waits out a time trap of a second. */
async function until(done: () => boolean, ms = 4000) {
  const end = performance.now() + ms;
  while (!done() && performance.now() < end) await new Promise((r) => setTimeout(r, 20));
}

function fill(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  el.value = value;
}

function status(form: HTMLFormElement) {
  const el = form.querySelector<HTMLElement>(".quartz-form__status")!;
  return { state: el.dataset.state, text: el.textContent };
}

function errorOf(form: HTMLFormElement, name: string) {
  const el = form.querySelector<HTMLElement>(`[data-field="${name}"] .quartz-form__error`)!;
  return el.hidden ? null : el.textContent;
}

function ok(body: unknown = { ok: true }, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeAll(() => {
  window.addCleanup = (fn) => cleanups.push(fn as () => void);
  (window as unknown as { __quartzFormsNavigate: unknown }).__quartzFormsNavigate = navigateMock;
  vi.stubGlobal("fetch", fetchMock);
  const source = fs.readFileSync(path.join(__dirname, "../src/scripts/forms.inline.ts"), "utf8");
  // esbuild refuses to run inside jsdom's realm, so strip types with the TypeScript compiler.
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  });
  // The field check alone, for the parity catalog (the script keeps nothing on window itself).
  new Function(
    `${outputText};window.__qfTest = { qfCheck, qfActive, QF_POW_WORKER, qfSolveHere, qfNoncePrefix };`,
  )();
});

beforeEach(() => {
  fetchMock.mockReset();
  navigateMock.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const quick = { spam: { minSeconds: 0 } } satisfies Partial<FormDefinition>;

describe("validation in the browser", () => {
  it("fills the timestamp, switches off native validation and reports empty required fields", async () => {
    const form = mount(contact(quick));
    await nav();
    expect(form.noValidate).toBe(true);
    const ts = Number((form.elements.namedItem("ts") as HTMLInputElement).value);
    expect(Math.abs(ts - Date.now())).toBeLessThan(1000);
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorOf(form, "message")).toBe("This field is required.");
    expect(errorOf(form, "name")).toBeNull();
    const area = form.elements.namedItem("message") as HTMLTextAreaElement;
    expect(area.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(area);
    expect(status(form)).toEqual({ state: "error", text: "Please check one field." });
  });

  it("checks types, bounds, patterns, choices and consent, in the page language", async () => {
    const form = mount(
      contact({
        ...quick,
        fields: [
          { type: "email", name: "email", label: "E", required: true },
          { type: "url", name: "url", label: "U" },
          { type: "tel", name: "tel", label: "T" },
          { type: "number", name: "n", label: "N", min: 1, max: 5 },
          { type: "text", name: "code", label: "C", pattern: "[A-Z]{3}" },
          { type: "text", name: "long", label: "L", maxLength: 3 },
          {
            type: "radio",
            name: "r",
            label: "R",
            required: true,
            options: [{ value: "a", label: "A" }],
          },
          {
            type: "checkboxes",
            name: "c",
            label: "C",
            required: true,
            options: [{ value: "a", label: "A" }],
          },
          { type: "scale", name: "s", label: "S", required: true, min: 1, max: 3 },
          { type: "consent", name: "ok", text: "ok" },
        ],
      }),
      {},
      "de",
    );
    await nav();
    fill(form, "email", "nope");
    fill(form, "url", "ftp://x");
    fill(form, "tel", "12");
    fill(form, "n", "7");
    fill(form, "code", "abc");
    fill(form, "long", "abcd");
    await submit(form);
    expect(errorOf(form, "email")).toBe("Bitte gib eine gültige E-Mail-Adresse ein.");
    expect(errorOf(form, "url")).toBe("Bitte gib eine gültige Webadresse ein.");
    // The same rule as the relay's: umlauts pass, a domain without a dot does not.
    fill(form, "email", "müller@münchen.de");
    fill(form, "url", "https://münchen.de/weg?x=1");
    await submit(form);
    expect(errorOf(form, "email")).toBeNull();
    expect(errorOf(form, "url")).toBeNull();
    fill(form, "email", "ada@localhost");
    fill(form, "url", "https://exa mple.org");
    await submit(form);
    expect(errorOf(form, "email")).toBe("Bitte gib eine gültige E-Mail-Adresse ein.");
    expect(errorOf(form, "url")).toBe("Bitte gib eine gültige Webadresse ein.");
    fill(form, "email", "nope");
    fill(form, "url", "ftp://x");
    expect(errorOf(form, "tel")).toBe("Bitte gib eine gültige Telefonnummer ein.");
    expect(errorOf(form, "n")).toBe("Bitte gib höchstens 5 ein.");
    expect(errorOf(form, "code")).toBe("Bitte verwende das verlangte Format.");
    expect(errorOf(form, "long")).toBe("Bitte verwende höchstens 3 Zeichen.");
    expect(errorOf(form, "r")).toBe("Bitte wähle eine Option.");
    expect(errorOf(form, "c")).toBe("Bitte wähle mindestens eine Option.");
    expect(errorOf(form, "s")).toBe("Bitte wähle eine Option.");
    expect(errorOf(form, "ok")).toBe("Bitte stimme vor dem Senden zu.");
    expect(status(form).text).toBe("Bitte prüfe 10 Felder.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates a field when the visitor leaves it, and clears the error once it is fixed", async () => {
    const form = mount(
      contact({
        ...quick,
        fields: [
          { type: "email", name: "email", label: "E" },
          { type: "textarea", name: "m", label: "M", required: true },
        ],
      }),
    );
    await nav();
    const email = form.elements.namedItem("email") as HTMLInputElement;
    email.value = "bad";
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");
    email.value = "a@b.co";
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBeNull();
    // leaving an optional field empty says nothing
    email.value = "";
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBeNull();
  });

  it("moves nothing while a button is pressed: the check of the field left waits for the click", async () => {
    // Fiftieth review, M1: the press took the focus, the error line went, the button slid 14px
    // from under the pointer and the click was lost.
    const form = mount(
      contact({ ...quick, fields: [{ type: "email", name: "email", label: "E" }] }),
    );
    await nav();
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    email.value = "bad";
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");

    email.value = "a@b.co";
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");
    document.body.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");
    await new Promise((r) => setTimeout(r, 0));
    expect(errorOf(form, "email")).toBeNull();

    // the same for an error that appears, and a release anywhere ends the wait
    email.value = "worse";
    form.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBeNull();
    document.body.dispatchEvent(new Event("pointercancel", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");
  });

  it("holds the check for a press anywhere on the page: a second form's button slid too", async () => {
    // Fifty-first review, N1: the wait listened for presses in its own form only. Focus in the
    // first form, a press on the second form's button below: the first form's error line
    // appeared, the second button slid 28px and the click was lost.
    const first = mount(
      contact({ ...quick, fields: [{ type: "email", name: "email", label: "E" }] }),
    );
    const main = document.querySelector("main")!;
    main.insertAdjacentHTML("beforeend", main.innerHTML);
    await nav();
    const second = document.querySelectorAll<HTMLFormElement>("form.quartz-form")[1]!;
    expect(second.dataset.qfBound).toBe("1");
    const email = first.elements.namedItem("email") as HTMLInputElement;
    const button = second.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    email.value = "bad";
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(first, "email")).toBeNull();
    button.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(errorOf(first, "email")).toBe("Please enter a valid e-mail address.");
  });

  it("ends a press whose release the page never sees: the window lost the focus, the page was hidden", async () => {
    // Fifty-second review, N1: a press on the page, then a switch to another window; the release
    // went elsewhere, and every form's check waited for the next release anywhere.
    const form = mount(
      contact({ ...quick, fields: [{ type: "email", name: "email", label: "E" }] }),
    );
    await nav();
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const tick = () => new Promise((r) => setTimeout(r, 0));

    email.value = "bad";
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBeNull();
    window.dispatchEvent(new Event("blur"));
    await tick();
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");

    email.value = "bad@";
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange") as never);
    await tick();
    // Shown again, but by the check of before: the press still holds this one.
    fill(form, "email", "ok@example.org");
    email.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(errorOf(form, "email")).toBe("Please enter a valid e-mail address.");
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange") as never);
    await tick();
    expect(errorOf(form, "email")).toBeNull();
    visibility.mockRestore();
  });
});

describe("sending", () => {
  it("posts the envelope to the relay and shows the success sentence in place", async () => {
    const form = mount(contact(quick));
    await nav();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "name", "Ada");
    fill(form, "message", "Hello there");
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.org/forms/send.php");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      form: "f",
      lang: "en",
      // Neither time trap nor proof of work: no ticket was fetched, the stamp stays empty.
      ts: "",
      encrypted: false,
      fields: { name: "Ada", message: "Hello there" },
    });
    expect(status(form)).toEqual({
      state: "success",
      text: "Thank you, your message has been sent.",
    });
    // Hidden with the fields' grid, which is a child of the form (qfFinish hides those).
    expect(
      (form.querySelector('[data-field="name"]') as HTMLElement).closest("[hidden]"),
    ).not.toBeNull();
    expect(form.dataset.state).toBe("sent");
  });

  it("sends the page along only when the form has page context", async () => {
    const form = mount(contact({ ...quick, pageContext: true }));
    await nav();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "x");
    await submit(form);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect([body.page, body.pageTitle]).toEqual(["docs/page", "Page"]);
  });

  it("pretends to send when the honeypot is filled, and sends nothing", async () => {
    const form = mount(contact(quick));
    await nav();
    fill(form, "message", "spam");
    fill(form, "_hp_website", "http://spam.example");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(form).state).toBe("success");
  });

  it("refuses a submission faster than minSeconds, and later sends the relay's stamp from when the page opened", async () => {
    const form = mount(contact({ spam: { minSeconds: 3 } }));
    // The ticket is fetched when the page opens: the relay's signed stamp of this moment.
    fetchMock.mockResolvedValueOnce(ok({ ok: true, pow: false, stamp: "1700000000.abc" }));
    await nav();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://example.org/forms/send.php?challenge=f",
    );
    // A GET to the site's own host carries no Origin, and under the site's `Referrer-Policy:
    // no-referrer` no Referer either; the relay then knows no origin (second review, aside 1,
    // measured in Chrome 2026-10-19). The request asks for an origin-only Referer itself.
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1]).toMatchObject({
      referrerPolicy: "strict-origin",
    });
    fill(form, "message", "quick");
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(status(form)).toEqual({ state: "error", text: "Please wait a moment before sending." });
    vi.setSystemTime(Date.now() + 4000);
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body.ts).toBe("1700000000.abc");
  });

  it("fetches the ticket again at send time when the one from page open failed", async () => {
    const form = mount(contact({ spam: { minSeconds: 0, pow: true } }));
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await nav();
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("?challenge=") ? ok({ ok: true, pow: false, stamp: "5.sig" }) : ok(),
    );
    fill(form, "message", "x");
    await submit(form);
    for (let i = 0; i < 10; i++) await tick();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body));
    expect(body.ts).toBe("5.sig");
  });

  // Third review, M2 (2026-10-19): a stamp the relay does not take - older than a day, or none
  // because the ticket never came - ended in "please reload the page", and the reload lost what
  // was typed. The relay checks the stamp before proof and captcha, so a new one costs neither.
  const relayTaking = (good: string, posts: string[]) =>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("?challenge=")) return ok({ ok: true, pow: false, stamp: good });
      const ts = String(JSON.parse(String(init!.body)).ts);
      posts.push(ts);
      return ts === good ? ok() : ok({ ok: false, error: "stamp" }, { status: 400 });
    });

  it("fetches a new stamp when the relay refuses the old one, waits the time trap out, sends once more", async () => {
    const form = mount(contact({ spam: { minSeconds: 1 } }));
    fetchMock.mockResolvedValueOnce(ok({ ok: true, pow: false, stamp: "1.old" }));
    await nav();
    vi.setSystemTime(Date.now() + 25 * 3600_000);
    fill(form, "message", "the next day");
    const posts: string[] = [];
    relayTaking("2.new", posts);
    const started = performance.now();
    await submit(form);
    await until(() => status(form).state === "success");
    expect(status(form).state).toBe("success");
    expect(posts).toEqual(["1.old", "2.new"]);
    expect(performance.now() - started).toBeGreaterThanOrEqual(990);
  });

  it("sends without a reload when the ticket of the page's opening never came, and keeps the new one", async () => {
    const form = mount(contact({ spam: { minSeconds: 1 } }));
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await nav();
    vi.setSystemTime(Date.now() + 5000);
    fill(form, "message", "x");
    const posts: string[] = [];
    relayTaking("3.sig", posts);
    // the relay takes the stamp but refuses the field: the next send needs no ticket and no wait
    fetchMock.mockImplementationOnce(async () =>
      ok({ ok: false, error: "stamp" }, { status: 400 }),
    );
    fetchMock.mockImplementationOnce(async () => ok({ ok: true, pow: false, stamp: "3.sig" }));
    fetchMock.mockImplementationOnce(async () =>
      ok({ ok: false, errors: [{ field: "message", code: "too_long" }] }, { status: 400 }),
    );
    await submit(form);
    await until(() => errorOf(form, "message") !== null);
    expect(errorOf(form, "message")).not.toBeNull();
    const calls = fetchMock.mock.calls.length;
    await submit(form);
    await until(() => status(form).state === "success");
    expect(status(form).state).toBe("success");
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
    expect(posts).toEqual(["3.sig"]);
  });

  it("asks for a reload only when the new stamp is refused too, or none comes", async () => {
    const form = mount(contact({ spam: { minSeconds: 1 } }));
    fetchMock.mockResolvedValueOnce(ok({ ok: true, pow: false, stamp: "1.old" }));
    await nav();
    vi.setSystemTime(Date.now() + 5000);
    fill(form, "message", "x");
    // a new stamp comes, but the relay refuses it as well: one more try, not more
    const posts: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("?challenge=")) return ok({ ok: true, pow: false, stamp: "2.new" });
      posts.push(String(JSON.parse(String(init!.body)).ts));
      return ok({ ok: false, error: "stamp" }, { status: 400 });
    });
    await submit(form);
    await until(() => status(form).state === "error");
    expect(status(form).text).toBe("Please reload the page and send again.");
    expect(posts).toEqual(["1.old", "2.new"]);
    // no new stamp comes at all
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("?challenge=")
        ? Promise.reject(new TypeError("network"))
        : ok({ ok: false, error: "stamp" }, { status: 400 }),
    );
    await submit(form);
    await until(() => fetchMock.mock.calls.length >= 2);
    for (let i = 0; i < 5; i++) await tick();
    expect(status(form).text).toBe("Please reload the page and send again.");
  });

  it("waits the time trap out on a stamp fetched at send time for the proof of work", async () => {
    // With pow, a page whose opening ticket failed fetched one at send time and sent its stamp at
    // once: the relay answered "too fast" at every try (noticed with M2 of the third review).
    const form = mount(contact({ spam: { minSeconds: 1, pow: true } }));
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await nav();
    vi.setSystemTime(Date.now() + 5000);
    fill(form, "message", "x");
    let issued = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("?challenge=")) {
        issued = performance.now();
        return ok({ ok: true, pow: false, stamp: "4.sig" });
      }
      return performance.now() - issued >= 990
        ? ok()
        : ok({ ok: false, error: "too_fast" }, { status: 400 });
    });
    await submit(form);
    await until(() => status(form).state === "success" || status(form).state === "error");
    expect(status(form).state).toBe("success");
  });

  it("shows the relay's field errors at the fields and its rate limit as a sentence", async () => {
    const form = mount(
      contact({
        ...quick,
        fields: [...contact().fields!, { type: "email", name: "mail", label: "Mail" }],
      }),
    );
    await nav();
    fill(form, "message", "x");
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "message", code: "too_long" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(errorOf(form, "message")).toBe("Please use at most 20000 characters.");
    expect(status(form).text).toBe("Please check one field.");
    // "invalid" from the relay is named by the field's type, not as a pattern mismatch.
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "name", code: "invalid" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(errorOf(form, "name")).toBe("Please use the requested format.");
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "mail", code: "invalid" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(errorOf(form, "mail")).toBe("Please enter a valid e-mail address.");
    // a value that was not a string at all missed no format
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "name", code: "malformed" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(errorOf(form, "name")).toBe("This value could not be read.");
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    await submit(form);
    expect(status(form).text).toBe("Too many messages at the moment. Please try again later.");
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await submit(form);
    expect(status(form).text).toBe("The message could not be sent. Please try again later.");
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    expect(button.disabled).toBe(false);
  });

  it("says every refusal of the relay in the page's words, and names the code for the site owner only", async () => {
    // Review finding 19 (2026-10-19): the relay's English `message` was quoted inside the page's
    // sentence ("Die Nachricht wurde nicht angenommen: please wait a moment before sending"), and
    // errors for fields this page does not know (a stale config.generated.php) were skipped
    // with the summary "Please check 0 field(s)."
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const form = mount(contact(quick));
    await nav();
    fill(form, "message", "x");
    const refusals: [string, string, string][] = [
      ["too_fast", "please wait a moment before sending", "Please wait a moment before sending."],
      ["stamp", "the time stamp is missing", "Please reload the page and send again."],
      [
        "pow",
        "this proof of work was already used",
        "The check before sending did not pass. Please try again.",
      ],
      [
        "captcha",
        "the captcha was not solved",
        "The check could not be confirmed. Please complete it again.",
      ],
      [
        "rate_limited",
        "too many messages at the moment",
        "Too many messages at the moment. Please try again later.",
      ],
      [
        "too_large",
        "the submission is too large",
        "The message is too large to send. Please shorten it.",
      ],
      // What the visitor cannot change (the relay's configuration, its mail server) is said as
      // "could not be sent", and the code goes to the console, where the site owner looks.
      ["origin", "origin not allowed", "The message could not be sent. Please try again later."],
      [
        "secret_config",
        "secret is a placeholder",
        "The message could not be sent. Please try again later.",
      ],
      [
        "captcha_verify",
        "provider unreachable",
        "The message could not be sent. Please try again later.",
      ],
      [
        "mail",
        "the mail could not be handed over",
        "The message could not be sent. Please try again later.",
      ],
    ];
    for (const [code, message, expected] of refusals) {
      warn.mockClear();
      fetchMock.mockResolvedValueOnce(ok({ ok: false, error: code, message }, { status: 400 }));
      await submit(form);
      expect([code, status(form).text]).toEqual([code, expected]);
      expect(status(form).text).not.toContain(message);
      if (expected.startsWith("The message could not be sent")) {
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]).includes(code)).toBe(true);
        expect(String(warn.mock.calls[0]).includes(message)).toBe(true);
      }
    }
    // Field errors for fields this page does not have: not "0 fields", but "could not be sent".
    warn.mockClear();
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "ghost", code: "unknown_field" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(status(form).text).toBe("The message could not be sent. Please try again later.");
    expect(String(warn.mock.calls[0])).toContain("ghost");
    // A field the page knows but the relay does not (configs drifted apart): the same, not
    // "please use the requested format" under a field the visitor filled correctly.
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "message", code: "unknown_field" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(errorOf(form, "message")).toBeNull();
    expect(status(form).text).toBe("The message could not be sent. Please try again later.");
    warn.mockRestore();
  });

  it("quotes an own endpoint's message, whose words the site chose itself", async () => {
    const form = mount(
      contact({ ...quick, transport: { kind: "endpoint", url: "https://e.example/x" } }),
    );
    await nav();
    fill(form, "message", "x");
    fetchMock.mockResolvedValueOnce(ok({ ok: false, message: "Postfach voll" }, { status: 400 }));
    await submit(form);
    expect(status(form).text).toBe("The message was not accepted: Postfach voll");
  });

  it("refuses a submission above maxBytes before sending, and says the relay's 413 the same way", async () => {
    const small = mount(contact({ spam: { minSeconds: 0, maxBytes: 500 } }));
    await nav();
    fill(small, "message", "ü".repeat(300)); // 300 characters, 600 bytes in UTF-8
    await submit(small);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(small).text).toBe("The message is too large to send. Please shorten it.");
    const form = mount(contact(quick));
    await nav();
    fill(form, "message", "x");
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "too_large", message: "the submission is too large" },
        { status: 413 },
      ),
    );
    await submit(form);
    expect(status(form).text).toBe("The message is too large to send. Please shorten it.");
  });

  it("redirects to the site's page after a successful send", async () => {
    const form = mount(contact({ ...quick, success: { mode: "redirect", slug: "thanks" } }));
    document.body.dataset.basepath = "/repo";
    await nav();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "x");
    await submit(form);
    expect(navigateMock).toHaveBeenCalledWith("/repo/thanks");
  });

  it("opens the mail program with subject and the serialised message for mailto", async () => {
    const form = mount(
      contact({
        ...quick,
        recipient: "o@example.org",
        subject: "Hi",
        fields: [
          { type: "text", name: "name", label: "Name" },
          { type: "textarea", name: "message", label: "Message", required: true },
        ],
      }),
      {
        transport: { kind: "mailto" },
      },
    );
    await nav();
    fill(form, "name", "Ada");
    fill(form, "message", "Line one\nLine two");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    const url = navigateMock.mock.calls[0]![0] as string;
    expect(url.startsWith("mailto:o@example.org?subject=Hi&body=")).toBe(true);
    expect(decodeURIComponent(url.split("&body=")[1]!)).toBe(
      "Name: Ada\nMessage:\nLine one\nLine two",
    );
    expect(status(form).state).toBe("success");
  });

  it("sends nothing with the demo transport and shows the message, then brings the form back", async () => {
    const form = mount(
      contact({
        ...quick,
        success: { mode: "redirect", slug: "thanks" },
        pageContext: true,
        fields: [
          { type: "text", name: "name", label: "Name" },
          { type: "textarea", name: "message", label: "Message", required: true },
        ],
      }),
      { transport: { kind: "demo" } },
      "de",
    );
    await nav();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(false);
    fill(form, "name", "Ada");
    fill(form, "message", "Zeile eins\nZeile zwei");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    // The demo stays on the page even when the form would redirect after a real send.
    expect(navigateMock).not.toHaveBeenCalled();
    expect(status(form)).toEqual({
      state: "success",
      text: "Nichts wurde gesendet. So wäre die Nachricht angekommen:",
    });
    const output = form.querySelector<HTMLElement>(".quartz-form__demo")!;
    // The plugin's own line in the page's language, like the labels (it was English until 0.5.4).
    expect(output.textContent).toBe(
      "Name: Ada\nMessage:\nZeile eins\nZeile zwei\n\nSeite: Page (docs/page)",
    );
    expect(form.querySelector<HTMLElement>(".quartz-form__fields")!.hidden).toBe(true);

    const again = form.querySelector<HTMLButtonElement>(".quartz-form__demo-again")!;
    expect(again.textContent).toBe("Noch einmal");
    again.click();
    expect(form.querySelector(".quartz-form__demo")).toBeNull();
    expect(form.querySelector(".quartz-form__demo-again")).toBeNull();
    expect(form.querySelector<HTMLElement>(".quartz-form__fields")!.hidden).toBe(false);
    expect((form.elements.namedItem("name") as HTMLInputElement).value).toBe("Ada");
    expect(form.dataset.state).toBeUndefined();
    expect(status(form)).toEqual({ state: "", text: "" });
    expect(button.disabled).toBe(false);
    await submit(form);
    expect(form.querySelectorAll(".quartz-form__demo")).toHaveLength(1);
  });

  it("says that nothing was sent even where the form has a thank-you of its own", async () => {
    // Fiftieth review, N1: the owner's success.text stood in the live region of a demo.
    const form = mount(
      contact({ ...quick, success: { mode: "inline", text: "Danke, wir melden uns bald." } }),
      { transport: { kind: "demo" } },
      "de",
    );
    await nav();
    fill(form, "name", "Ada");
    fill(form, "message", "Hallo");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(form)).toEqual({
      state: "success",
      text: "Nichts wurde gesendet. So wäre die Nachricht angekommen:",
    });
  });

  it("lets a demo be tried at once: the time trap protects nothing that is never sent", async () => {
    // Fiftieth review, side list: a reader quicker than three seconds read "please wait".
    const form = mount(contact({ spam: { minSeconds: 3 } }), { transport: { kind: "demo" } }, "de");
    await nav();
    fill(form, "name", "Ada");
    fill(form, "message", "Hallo");
    await submit(form);
    expect(status(form)).toEqual({
      state: "success",
      text: "Nichts wurde gesendet. So wäre die Nachricht angekommen:",
    });
  });

  it("posts flat fields to an endpoint, as JSON or as a form body, with the extra fields", async () => {
    const json = mount(contact(quick), {
      transport: { kind: "endpoint", url: "https://e.example/x", extra: { to: "sales" } },
    });
    await nav();
    fetchMock.mockResolvedValueOnce(ok());
    fill(json, "message", "x");
    await submit(json);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ to: "sales", name: "", message: "x" });

    const form = mount(contact(quick), {
      transport: { kind: "endpoint", url: "https://e.example/x", format: "form" },
    });
    await nav();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "y");
    await submit(form);
    const body = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("message")).toBe("y");
  });

  it("enables the button of an encryption-required form and refuses to send while encryption is unavailable", async () => {
    const form = mount(contact({ ...quick, encryption: { mode: "required" } }), {
      keys: {
        k: {
          armored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nx\n-----END PGP PUBLIC KEY BLOCK-----",
        },
      },
    });
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    expect(button.disabled).toBe(true);
    await nav();
    expect(button.disabled).toBe(false);
    fill(form, "message", "secret");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(form).text).toBe("Encryption could not be loaded; the message was not sent.");
  });

  it("binds a form once, even when nav fires again", async () => {
    const form = mount(contact(quick));
    await nav();
    await nav();
    fetchMock.mockResolvedValue(ok());
    fill(form, "message", "x");
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("encryption", () => {
  // jsdom gives the test its own `Uint8Array`, while Node's TextEncoder (which OpenPGP.js uses)
  // returns Node's. OpenPGP.js checks `instanceof` against the global, so the global is Node's here.
  beforeAll(() => {
    vi.stubGlobal("Uint8Array", Object.getPrototypeOf(Buffer.prototype).constructor);
  });

  it("shows the demo's message encrypted when the form encrypts, decryptable with the owner's key", async () => {
    const openpgp = await import("openpgp");
    const { generatePair, decrypt } = await import("./keys");
    const pair = await generatePair();
    (window as unknown as { __quartzFormsOpenpgp: unknown }).__quartzFormsOpenpgp = openpgp;
    const form = mount(contact({ ...quick, encryption: { mode: "required" } }), {
      transport: { kind: "demo" },
      keys: { owner: { armored: pair.publicKey } },
    });
    await nav();
    for (let i = 0; i < 10; i++) await tick();
    fill(form, "message", "Top secret");
    await submit(form);
    for (let i = 0; i < 20; i++) await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    const output = form.querySelector<HTMLElement>(".quartz-form__demo")!.textContent!;
    expect(output).toMatch(/^-----BEGIN PGP MESSAGE-----/);
    expect(form.querySelector(".quartz-form__demo")!.classList).toContain(
      "quartz-form__demo--armored",
    );
    expect(output).not.toContain("Top secret");
    expect(await decrypt(output, pair.privateKey)).toBe("Message:\nTop secret");
    expect(status(form).text).toBe(
      "Nothing was sent. This is the message as it would have arrived, encrypted in your browser:",
    );
    delete (window as unknown as { __quartzFormsOpenpgp?: unknown }).__quartzFormsOpenpgp;
  }, 30_000);

  it("sends a service the page beside a plaintext message only", async () => {
    // Fiftieth review, N3: _page travelled in the clear beside the ciphertext.
    const openpgp = await import("openpgp");
    const { generatePair, decrypt } = await import("./keys");
    const pair = await generatePair();
    (window as unknown as { __quartzFormsOpenpgp: unknown }).__quartzFormsOpenpgp = openpgp;
    const bodyOf = async (mode: "required" | "off") => {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(ok());
      const form = mount(contact({ ...quick, encryption: { mode }, pageContext: true }), {
        transport: { kind: "endpoint", url: "https://e.example/x" },
        keys: { owner: { armored: pair.publicKey } },
      });
      await nav();
      for (let i = 0; i < 10; i++) await tick();
      fill(form, "message", "Top secret");
      await submit(form);
      await until(() => fetchMock.mock.calls.length > 0);
      return JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    };
    const encrypted = await bodyOf("required");
    expect(encrypted._page).toBeUndefined();
    expect(await decrypt(encrypted.message, pair.privateKey)).toContain("Page: Page (docs/page)");
    expect((await bodyOf("off"))._page).toBe("docs/page");
    delete (window as unknown as { __quartzFormsOpenpgp?: unknown }).__quartzFormsOpenpgp;
  }, 30_000);

  it("encrypts the serialised message for the recipient key and shows the fingerprint", async () => {
    const openpgp = await import("openpgp");
    const { generatePair, decrypt } = await import("./keys");
    const pair = await generatePair();
    (window as unknown as { __quartzFormsOpenpgp: unknown }).__quartzFormsOpenpgp = openpgp;
    const form = mount(
      contact({
        ...quick,
        encryption: { mode: "required" },
        pageContext: true,
        fields: [
          { type: "text", name: "name", label: "Name" },
          { type: "textarea", name: "message", label: "Message", required: true },
          {
            type: "checkboxes",
            name: "topics",
            label: "Topics",
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
          },
        ],
      }),
      { keys: { owner: { armored: pair.publicKey } } },
    );
    await nav();
    for (let i = 0; i < 10; i++) await tick();
    const line = form.querySelector<HTMLElement>("[data-fingerprint]")!;
    expect(line.hidden).toBe(false);
    expect(line.textContent).toMatch(
      /^Encrypted in your browser for the key ([0-9A-F]{4} ){9}[0-9A-F]{4}\.$/,
    );

    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "name", "Ada");
    fill(form, "message", "Top secret");
    (form.querySelector('input[name="topics"][value="b"]') as HTMLInputElement).checked = true;
    await submit(form);
    for (let i = 0; i < 20; i++) await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.encrypted).toBe(true);
    expect(body.fields).toBeUndefined();
    // Review finding 23 (2026-10-19): the slug travelled beside the ciphertext in the clear and
    // the relay wrote it under the armor; the page is part of the encrypted text and stays there.
    expect(body.page).toBeUndefined();
    expect(body.pageTitle).toBeUndefined();
    expect(body.ciphertext).toMatch(/^-----BEGIN PGP MESSAGE-----/);
    expect(JSON.stringify(body)).not.toContain("Top secret");
    expect(await decrypt(body.ciphertext, pair.privateKey)).toBe(
      "Name: Ada\nMessage:\nTop secret\nTopics: B\n\nPage: Page (docs/page)",
    );
    expect(status(form)).toEqual({
      state: "success",
      text: "Thank you, your message has been sent encrypted.",
    });
    delete (window as unknown as { __quartzFormsOpenpgp?: unknown }).__quartzFormsOpenpgp;
  }, 30_000);

  it("sends plain text when the visitor unticks the optional encryption", async () => {
    const openpgp = await import("openpgp");
    const { generatePair } = await import("./keys");
    const pair = await generatePair();
    (window as unknown as { __quartzFormsOpenpgp: unknown }).__quartzFormsOpenpgp = openpgp;
    const form = mount(contact({ ...quick, encryption: { mode: "optional" } }), {
      keys: { owner: { armored: pair.publicKey } },
    });
    const toggle = form.elements.namedItem("_encrypt") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.checked).toBe(false);
    await nav();
    // The script enables and ticks the box; the visitor may untick it.
    expect(toggle.disabled).toBe(false);
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "plain");
    await submit(form);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ encrypted: false, fields: { message: "plain" } });
    delete (window as unknown as { __quartzFormsOpenpgp?: unknown }).__quartzFormsOpenpgp;
  }, 30_000);

  it("checks the visitor's own key and shows its fingerprint, or why it is refused", async () => {
    const openpgp = await import("openpgp");
    const { generatePair } = await import("./keys");
    const [visitor, expiredKey] = await Promise.all([
      generatePair({ name: "Visitor" }),
      generatePair({ expired: true }),
    ]);
    (window as unknown as { __quartzFormsOpenpgp: unknown }).__quartzFormsOpenpgp = openpgp;
    const form = mount(
      contact({
        ...quick,
        fields: [
          { type: "pgpKey", name: "key", label: "Key" },
          { type: "textarea", name: "message", label: "M", required: true },
        ],
      }),
    );
    await nav();
    const area = form.elements.namedItem("key") as HTMLTextAreaElement;
    const leave = async () => {
      area.dispatchEvent(new Event("focusout", { bubbles: true }));
      for (let i = 0; i < 10; i++) await tick();
    };
    area.value = visitor.publicKey;
    await leave();
    expect(errorOf(form, "key")).toBeNull();
    expect(form.querySelector("#qf-f-key-status")!.textContent).toMatch(
      /^Key accepted, fingerprint ([0-9A-F]{4} ){9}[0-9A-F]{4}\.$/,
    );
    area.value = visitor.privateKey;
    await leave();
    expect(errorOf(form, "key")).toBe("This is a private key. Please provide your public key.");
    area.value = expiredKey.publicKey;
    await leave();
    expect(errorOf(form, "key")).toBe("This key has expired.");
    area.value = "hello";
    await leave();
    expect(errorOf(form, "key")).toBe("This is not a PGP public key.");

    // Review finding 25 (2026-10-19): sending looked for the public-key marker only and cleared
    // the error shown at the field; an expired key, a private key and a paste of both blocks
    // (OpenPGP.js reads the first and calls it public) went out. Now the check runs at send time.
    fill(form, "message", "hi");
    for (const [text, error] of [
      [expiredKey.publicKey, "This key has expired."],
      [visitor.privateKey, "This is a private key. Please provide your public key."],
      [
        `${visitor.publicKey.trim()}\n${visitor.privateKey.trim()}`,
        "This is a private key. Please provide your public key.",
      ],
    ]) {
      area.value = text!;
      await submit(form);
      for (let i = 0; i < 10; i++) await tick();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(errorOf(form, "key")).toBe(error);
      expect(status(form).text).toBe("Please check one field.");
      expect(document.activeElement).toBe(area);
    }

    // the key travels inside the message
    area.value = visitor.publicKey;
    await leave();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "hi");
    await submit(form);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.fields.key).toBe(visitor.publicKey.trim());
    delete (window as unknown as { __quartzFormsOpenpgp?: unknown }).__quartzFormsOpenpgp;
  }, 30_000);

  it("sends a pasted key unchecked, and says so, when OpenPGP.js cannot be loaded", async () => {
    // Second review, price of the fixes (2026-10-19): since the key is parsed at send time, a
    // failed import() of the library (network, content blocker, CSP) read as "not a public key",
    // and a form that does not even encrypt could not be sent with a key pasted. Nothing is
    // injected here, so the import of the static URL fails as it would in such a browser.
    const form = mount(
      contact({
        ...quick,
        fields: [
          { type: "pgpKey", name: "key", label: "Key" },
          { type: "textarea", name: "message", label: "M", required: true },
        ],
      }),
    );
    await nav();
    const area = form.elements.namedItem("key") as HTMLTextAreaElement;
    const leave = async () => {
      area.dispatchEvent(new Event("focusout", { bubbles: true }));
      for (let i = 0; i < 10; i++) await tick();
    };
    const pasted =
      "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nmQENBF...\n-----END PGP PUBLIC KEY BLOCK-----";
    area.value = pasted;
    await leave();
    expect(errorOf(form, "key")).toBeNull();
    expect(form.querySelector("#qf-f-key-status")!.textContent).toBe(
      "The key could not be checked; it is sent as pasted.",
    );
    // The markers are still looked at: a private key does not go out.
    area.value =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nlQ...\n-----END PGP PRIVATE KEY BLOCK-----";
    fill(form, "message", "hi");
    await submit(form);
    for (let i = 0; i < 10; i++) await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorOf(form, "key")).toBe("This is a private key. Please provide your public key.");

    area.value = pasted;
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    for (let i = 0; i < 10; i++) await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.fields.key).toBe(pasted);
    expect(errorOf(form, "key")).toBeNull();
  });
});

describe("proof of work", () => {
  it("fetches the challenge, finds a nonce with the required leading zero bits and sends both", async () => {
    const { createHash } = await import("node:crypto");
    const form = mount(contact({ ...quick, spam: { minSeconds: 0, pow: true, powDifficulty: 8 } }));
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("?challenge=f")) {
        expect(init?.method ?? "GET").toBe("GET");
        return ok({ ok: true, pow: true, challenge: "abc123", difficulty: 8 });
      }
      return ok();
    });
    await nav(); // the ticket with the challenge comes with the page, not at send time
    fill(form, "message", "work");
    await submit(form);
    for (let i = 0; i < 50; i++) await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://example.org/forms/send.php?challenge=f",
    );
    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body.pow).toEqual({
      challenge: "abc123",
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{12}-\d+$/),
    });
    const digest = createHash("sha256").update(`abc123:${body.pow.nonce}`).digest();
    expect(digest[0]).toBe(0); // 8 leading zero bits
    expect(status(form).state).toBe("success");
  }, 30_000);

  it("works the proof out again when the stamp is refused and the new ticket has another challenge", async () => {
    // Fiftieth review, N2: after a changed secret the retry of 0ef9f41 sent the new stamp with the
    // old proof, and the relay answered "pow"; only a second click sent.
    const form = mount(contact({ spam: { minSeconds: 1, pow: true, powDifficulty: 8 } }));
    fetchMock.mockResolvedValueOnce(
      ok({ ok: true, pow: true, challenge: "old", difficulty: 8, stamp: "1.old" }),
    );
    await nav();
    vi.setSystemTime(Date.now() + 5000);
    fill(form, "message", "x");
    const posts: [string, string][] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("?challenge="))
        return ok({ ok: true, pow: true, challenge: "new", difficulty: 8, stamp: "2.new" });
      const body = JSON.parse(String(init!.body));
      posts.push([body.ts, body.pow?.challenge]);
      if (body.ts !== "2.new") return ok({ ok: false, error: "stamp" }, { status: 400 });
      return body.pow?.challenge === "new"
        ? ok()
        : ok({ ok: false, error: "pow" }, { status: 400 });
    });
    await submit(form);
    await until(() => status(form).state === "success" || status(form).state === "error");
    expect(status(form).state).toBe("success");
    expect(posts).toEqual([
      ["1.old", "old"],
      ["2.new", "new"],
    ]);
  }, 30_000);

  it("works the proof out again on a new ticket when a form without a time trap is refused as pow", async () => {
    // QuartzControl review 2026-10-30, noticed beside N6: without a time trap the relay checks no
    // stamp, so a proof whose challenge was signed with the old secret is refused as "pow", and
    // the retry above, which asks for "stamp", never came.
    const form = mount(contact({ spam: { minSeconds: 0, pow: true, powDifficulty: 8 } }));
    fetchMock.mockResolvedValueOnce(
      ok({ ok: true, pow: true, challenge: "old", difficulty: 8, stamp: "1.old" }),
    );
    await nav();
    fill(form, "message", "x");
    const posts: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("?challenge="))
        return ok({ ok: true, pow: true, challenge: "new", difficulty: 8, stamp: "2.new" });
      const body = JSON.parse(String(init!.body));
      posts.push(body.pow?.challenge);
      return body.pow?.challenge === "new"
        ? ok()
        : ok({ ok: false, error: "pow" }, { status: 400 });
    });
    await submit(form);
    await until(() => status(form).state === "success" || status(form).state === "error");
    expect(status(form).state).toBe("success");
    expect(posts).toEqual(["old", "new"]);
  }, 30_000);

  it("does not send again on pow when the new ticket has the same challenge", async () => {
    const form = mount(contact({ spam: { minSeconds: 0, pow: true, powDifficulty: 8 } }));
    fetchMock.mockResolvedValueOnce(
      ok({ ok: true, pow: true, challenge: "same", difficulty: 8, stamp: "1" }),
    );
    await nav();
    fill(form, "message", "x");
    let sent = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("?challenge="))
        return ok({ ok: true, pow: true, challenge: "same", difficulty: 8, stamp: "2" });
      sent++;
      return ok({ ok: false, error: "pow" }, { status: 400 });
    });
    await submit(form);
    await until(() => status(form).state === "success" || status(form).state === "error");
    expect(status(form).state).toBe("error");
    expect(sent).toBe(1);
  }, 30_000);

  it("hashes in a Worker made from a Blob, sends its nonce and terminates it", async () => {
    // Review finding 18 (2026-10-19): on the main thread, yielding after every 64 hashes, 16 bits
    // took 3 to 35 s in Chrome; the same loop in a Worker takes 0.1 to 0.9 s.
    const { createHash } = await import("node:crypto");
    const blobs: Blob[] = [];
    const terminate = vi.fn();
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string) {
        expect(url).toBe("blob:fake");
      }
      postMessage(data: { challenge: string; difficulty: number; prefix: string }) {
        expect(data).toEqual({
          challenge: "abc123",
          difficulty: 8,
          prefix: expect.stringMatching(/^[A-Za-z0-9_-]{12}-$/),
        });
        void Promise.resolve().then(() => this.onmessage?.({ data: "424242" } as MessageEvent));
      }
      terminate = terminate;
    }
    const w = window as unknown as Record<string, unknown>;
    const u = URL as unknown as Record<string, unknown>;
    w.Worker = FakeWorker;
    u.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:fake";
    });
    u.revokeObjectURL = vi.fn();
    try {
      const form = mount(
        contact({ ...quick, spam: { minSeconds: 0, pow: true, powDifficulty: 8 } }),
      );
      fetchMock.mockImplementation(async (url: string) =>
        String(url).includes("?challenge=f")
          ? ok({ ok: true, pow: true, challenge: "abc123", difficulty: 8 })
          : ok(),
      );
      await nav();
      fill(form, "message", "work");
      await submit(form);
      for (let i = 0; i < 50; i++) await tick();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
      expect(body.pow).toEqual({ challenge: "abc123", nonce: "424242" });
      expect(terminate).toHaveBeenCalledTimes(1);
      expect(u.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
      // The Worker's source is the same rule as the main thread's: SHA-256 over challenge:nonce.
      expect(blobs.length).toBe(1);
      const source = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blobs[0]!);
      });
      expect(source).toContain('crypto.subtle.digest("SHA-256"');
      expect(source).toContain('challenge + ":" + nonce');
      void createHash;
    } finally {
      delete w.Worker;
      delete u.createObjectURL;
      delete u.revokeObjectURL;
    }
  }, 30_000);

  it("hashes on the main thread when no Worker can run (a CSP without blob:) or the Worker fails", async () => {
    const { createHash } = await import("node:crypto");
    const w = window as unknown as Record<string, unknown>;
    const u = URL as unknown as Record<string, unknown>;
    let answers = 0;
    class FailingWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        if (answers++ === 0) throw new DOMException("blocked", "SecurityError");
      }
      postMessage() {
        void Promise.resolve().then(() => this.onerror?.());
      }
      terminate() {}
    }
    w.Worker = FailingWorker;
    u.createObjectURL = vi.fn(() => "blob:fake");
    u.revokeObjectURL = vi.fn();
    try {
      for (const round of [1, 2]) {
        fetchMock.mockReset();
        const form = mount(
          contact({ ...quick, spam: { minSeconds: 0, pow: true, powDifficulty: 8 } }),
        );
        fetchMock.mockImplementation(async (url: string) =>
          String(url).includes("?challenge=f")
            ? ok({ ok: true, pow: true, challenge: `round${round}`, difficulty: 8 })
            : ok(),
        );
        await nav();
        fill(form, "message", "work");
        await submit(form);
        for (let i = 0; i < 50; i++) await tick();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
        expect(body.pow.challenge).toBe(`round${round}`);
        const digest = createHash("sha256").update(`round${round}:${body.pow.nonce}`).digest();
        expect([round, digest[0]]).toEqual([round, 0]);
      }
      expect(answers).toBe(2); // constructed twice: thrown once, failed once
    } finally {
      delete w.Worker;
      delete u.createObjectURL;
      delete u.revokeObjectURL;
    }
  }, 30_000);

  it("starts the nonce at a random prefix, so visitors sharing the hour's challenge never spend the same proof", async () => {
    // Second review, finding 1 (2026-10-19): the challenge is HMAC(form|hour), the same for every
    // visitor of the hour, and both solvers counted from 0, so every browser found the same nonce
    // (193903 for "abc123" at 16 bits, in Chrome and WebKit alike). The first post spent it and
    // every later one in that hour got "400 pow: already used". The relay suite never saw it
    // because its solver started at a random number. This runs the Worker's source itself.
    const { createHash } = await import("node:crypto");
    const { QF_POW_WORKER, qfSolveHere, qfNoncePrefix } = (
      window as unknown as Record<
        string,
        {
          QF_POW_WORKER: string;
          qfSolveHere: (c: string, d: number, p: string) => Promise<string>;
          qfNoncePrefix: () => string;
        }
      >
    ).__qfTest!;
    const posted = vi.fn();
    const onmessage = new Function(
      "postMessage",
      `let onmessage; ${QF_POW_WORKER}; return onmessage;`,
    )(posted) as (e: { data: unknown }) => Promise<void>;
    const nonces: string[] = [];
    for (let i = 0; i < 2; i++) {
      posted.mockClear();
      await onmessage({ data: { challenge: "abc123", difficulty: 8, prefix: qfNoncePrefix() } });
      nonces.push(String(posted.mock.calls[0]![0]));
    }
    nonces.push(await qfSolveHere("abc123", 8, qfNoncePrefix()));
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{12}-\d+$/); // what the relay accepts, 64 at most
      expect(createHash("sha256").update(`abc123:${nonce}`).digest()[0]).toBe(0);
    }
    expect(new Set(nonces.map((n) => n.slice(0, 13))).size).toBe(3);
  }, 30_000);

  it("sends no proof when the relay says the form does not need one", async () => {
    const form = mount(contact({ ...quick, spam: { minSeconds: 0, pow: true } }));
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("?challenge=") ? ok({ ok: true, pow: false }) : ok(),
    );
    await nav();
    fill(form, "message", "x");
    await submit(form);
    for (let i = 0; i < 10; i++) await tick();
    const body = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body.pow).toBeUndefined();
  });
});

/** A stand-in for the provider's API (`window.turnstile` / `window.hcaptcha`). */
function fakeProvider() {
  let n = 0;
  return {
    render: vi.fn((_el: HTMLElement, _opts: unknown) => `w${++n}`),
    reset: vi.fn(),
    remove: vi.fn(),
    getResponse: vi.fn(() => ""),
  };
}
const turnstileForm = (siteKey = "site-key") =>
  contact({ ...quick, spam: { minSeconds: 0, captcha: "turnstile", captchaSiteKey: siteKey } });

describe("captcha", () => {
  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    delete (window as unknown as { hcaptcha?: unknown }).hcaptcha;
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });

  it("loads the provider script once, explicitly and persisted, and renders the widget when it arrives", async () => {
    const form = mount(turnstileForm());
    expect(
      form.querySelector(".quartz-form__captcha.cf-turnstile")?.getAttribute("data-sitekey"),
    ).toBe("site-key");
    await nav();
    const scripts = document.head.querySelectorAll<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com"]',
    );
    expect(scripts.length).toBe(1);
    // Explicit rendering, and Quartz keeps the element in the head across SPA navigations.
    expect(scripts[0]!.src).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(scripts[0]!.hasAttribute("data-persist")).toBe(true);
    await nav();
    expect(
      document.head.querySelectorAll('script[src^="https://challenges.cloudflare.com"]').length,
    ).toBe(1);

    fill(form, "message", "x");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(form).text).toBe("Please complete the check below before sending.");

    // The script arrives: the one bound form gets one widget, in its container, with its key.
    const turnstile = fakeProvider();
    (window as unknown as { turnstile: unknown }).turnstile = turnstile;
    scripts[0]!.dispatchEvent(new Event("load"));
    await tick();
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(turnstile.render.mock.calls[0]).toEqual([
      form.querySelector(".quartz-form__captcha"),
      { sitekey: "site-key" },
    ]);

    // the widget writes its token into a hidden input inside the container
    const token = document.createElement("input");
    token.type = "hidden";
    token.name = "cf-turnstile-response";
    token.value = "tok-123";
    form.querySelector(".quartz-form__captcha")!.appendChild(token);
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.captcha).toBe("tok-123");
  });

  it("renders a widget on a page reached by SPA navigation, removes the old one and resets after a failed send", async () => {
    // Review finding 8 (2026-10-19): with implicit rendering the provider rendered only the
    // containers present when its script ran; the form of the next page stayed without a widget
    // (measured in Chrome: empty container, "complete the check" for ever).
    const turnstile = fakeProvider();
    (window as unknown as { turnstile: unknown }).turnstile = turnstile;
    const a = mount(turnstileForm());
    await nav();
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(turnstile.render.mock.calls[0]![0]).toBe(a.querySelector(".quartz-form__captcha"));
    // No second script: the provider is already there.
    expect(document.head.querySelectorAll('script[src^="https://challenges"]').length).toBe(0);

    const b = mount(turnstileForm("other-key"));
    await nav();
    expect(turnstile.remove).toHaveBeenCalledWith("w1");
    expect(turnstile.render).toHaveBeenCalledTimes(2);
    expect(turnstile.render.mock.calls[1]).toEqual([
      b.querySelector(".quartz-form__captcha"),
      { sitekey: "other-key" },
    ]);

    fill(b, "message", "x");
    await submit(b);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status(b).text).toBe("Please complete the check below before sending.");

    // Without a hidden field, the token is asked from the provider for this form's widget.
    turnstile.getResponse.mockImplementation(((id: string) =>
      id === "w2" ? "tok-b" : "") as never);
    fetchMock.mockResolvedValueOnce(ok({ ok: false, error: "captcha" }, { status: 400 }));
    await submit(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.captcha).toBe("tok-b");
    expect(turnstile.reset).toHaveBeenCalledWith("w2");
  });

  it("renders no widget and loads no script for an anonymous form", async () => {
    const form = mount(
      contact({
        ...quick,
        anonymous: true,
        spam: { minSeconds: 0, captcha: "hcaptcha", captchaSiteKey: "k" },
      }),
    );
    expect(form.querySelector(".quartz-form__captcha")).toBeNull();
    await nav();
    expect(document.head.querySelector('script[src^="https://js.hcaptcha.com"]')).toBeNull();
    fetchMock.mockResolvedValueOnce(ok());
    fill(form, "message", "x");
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders an hCaptcha widget when its onload callback says the API is ready, not at load", async () => {
    // At the script's `load` event hCaptcha's API is not ready yet: rendering there logged
    // "should not render before js api is fully loaded" in Chrome, WebKit and Firefox (2026-10-22).
    const form = mount(
      contact({ ...quick, spam: { minSeconds: 0, captcha: "hcaptcha", captchaSiteKey: "k" } }),
    );
    await nav();
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[src^="https://js.hcaptcha.com"]',
    );
    expect(script?.src).toBe(
      "https://js.hcaptcha.com/1/api.js?render=explicit&onload=qfHcaptchaOnload",
    );
    const hcaptcha = fakeProvider();
    (window as unknown as { hcaptcha: unknown }).hcaptcha = hcaptcha;
    script!.dispatchEvent(new Event("load"));
    await tick();
    expect(hcaptcha.render).not.toHaveBeenCalled();
    (window as unknown as { qfHcaptchaOnload: () => void }).qfHcaptchaOnload();
    await tick();
    expect(hcaptcha.render).toHaveBeenCalledTimes(1);
    expect(hcaptcha.render.mock.calls[0]![0]).toBe(form.querySelector(".quartz-form__captcha"));
  });

  it("hands a service its token under the widget's own field name, and shows the service's field message", async () => {
    const form = mount(
      contact({ ...quick, spam: { minSeconds: 0, captcha: "hcaptcha", captchaSiteKey: "k" } }),
      {
        transport: { kind: "formspree", url: "abc" },
      },
    );
    await nav();
    const token = document.createElement("textarea");
    token.name = "h-captcha-response";
    token.value = "h-tok";
    form.querySelector(".quartz-form__captcha")!.appendChild(token);
    fill(form, "message", "x");
    fetchMock.mockResolvedValueOnce(
      ok(
        { errors: [{ field: "message", code: "TYPE_TEXT", message: "should be text" }] },
        { status: 422 },
      ),
    );
    await submit(form);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://formspree.io/f/abc");
    expect(JSON.parse(String(init.body))["h-captcha-response"]).toBe("h-tok");
    expect(errorOf(form, "message")).toBe("should be text");
  });
});

describe("the message as the recipient reads it", () => {
  it("names choices by their labels and draws checkboxes as boxes", async () => {
    const form = mount(
      contact({
        ...quick,
        transport: { kind: "mailto" },
        recipient: "o@example.org",
        fields: [
          {
            type: "select",
            name: "topic",
            label: "Topic",
            options: [{ value: "bug", label: { en: "Bug report", de: "Fehler" } }],
          },
          {
            type: "checkboxes",
            name: "days",
            label: "Days",
            options: [
              { value: "mo", label: "Monday" },
              { value: "tu", label: "Tuesday" },
            ],
          },
          { type: "checkbox", name: "news", label: "Send me news" },
          { type: "consent", name: "ok", text: "I agree." },
          { type: "textarea", name: "m", label: "Message", required: true },
        ],
      }),
      { transport: { kind: "mailto" } },
    );
    await nav();
    (form.elements.namedItem("topic") as HTMLSelectElement).value = "bug";
    (form.querySelector('input[name="days"][value="tu"]') as HTMLInputElement).checked = true;
    (form.elements.namedItem("ok") as HTMLInputElement).checked = true;
    fill(form, "m", "hi");
    await submit(form);
    const url = navigateMock.mock.calls[0]![0] as string;
    expect(decodeURIComponent(url.split("&body=")[1]!)).toBe(
      "Topic: Bug report\nDays: Tuesday\n[ ] Send me news\n[x] I agree.\nMessage:\nhi",
    );
  });
});

describe("conditional fields", () => {
  const fields: FormField[] = [
    {
      type: "radio",
      name: "topic",
      label: "Topic",
      options: [
        { value: "a", label: "Event" },
        { value: "b", label: "Other" },
      ],
    },
    {
      type: "text",
      name: "guests",
      label: "Guests",
      required: true,
      showIf: { field: "topic", equals: "a" },
    },
    { type: "textarea", name: "msg", label: "Message" },
  ];

  it("shows a field while its condition holds, and requires it only then", async () => {
    const form = mount(contact({ ...quick, fields }));
    await nav();
    const wrapper = form.querySelector('[data-field="guests"]') as HTMLElement;
    const input = form.elements.namedItem("guests") as HTMLInputElement;
    expect(wrapper.hidden).toBe(true);
    expect(input.hasAttribute("required")).toBe(false);
    const a = form.querySelector('input[name="topic"][value="a"]') as HTMLInputElement;
    a.checked = true;
    a.dispatchEvent(new Event("change", { bubbles: true }));
    expect(wrapper.hidden).toBe(false);
    expect(input.getAttribute("aria-required")).toBe("true");
    await submit(form);
    expect(errorOf(form, "guests")).toBe("This field is required.");
    expect(fetchMock).not.toHaveBeenCalled();
    const b = form.querySelector('input[name="topic"][value="b"]') as HTMLInputElement;
    b.checked = true;
    b.dispatchEvent(new Event("change", { bubbles: true }));
    expect(wrapper.hidden).toBe(true);
    expect(errorOf(form, "guests")).toBeNull();
  });

  it("sends only what counts: a value left in a hidden field stays behind", async () => {
    const form = mount(contact({ ...quick, fields }));
    await nav();
    fill(form, "guests", "12");
    const b = form.querySelector('input[name="topic"][value="b"]') as HTMLInputElement;
    b.checked = true;
    b.dispatchEvent(new Event("change", { bubbles: true }));
    fill(form, "msg", "hello");
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      fields: Record<string, unknown>;
    };
    expect(sent.fields).toEqual({ topic: "b", msg: "hello" });
  });
});

describe("steps", () => {
  const fields: FormField[] = [
    {
      type: "radio",
      name: "kind",
      label: "Kind",
      options: [
        { value: "event", label: "Event" },
        { value: "survey", label: "Survey" },
      ],
    },
    { type: "text", name: "name", label: "Name", required: true },
    { type: "pageBreak", title: "Details", showIf: { field: "kind", equals: "event" } },
    { type: "text", name: "guests", label: "Guests", required: true },
    { type: "pageBreak" },
    { type: "textarea", name: "msg", label: "Message", required: true },
  ];
  const step = (form: HTMLFormElement, i: number) =>
    form.querySelector<HTMLElement>(`.quartz-form__step[data-step="${i}"]`)!;
  const open = (form: HTMLFormElement) =>
    [0, 1, 2].filter((i) => !step(form, i).hidden).map((i) => i);
  const progress = (form: HTMLFormElement) =>
    form.querySelector<HTMLElement>(".quartz-form__progress")!.textContent;
  const button = (form: HTMLFormElement, which: "back" | "next") =>
    form.querySelector<HTMLButtonElement>(`button[data-step-${which}]`)!;
  const choose = (form: HTMLFormElement, value: string) => {
    const radio = form.querySelector<HTMLInputElement>(`input[name="kind"][value="${value}"]`)!;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const click = async (el: HTMLElement) => {
    el.click();
    for (let i = 0; i < 3; i++) await tick();
  };

  it("shows no count while only one step counts", async () => {
    // Third review, aside (2026-10-19): with the only other step skipped, "Step 1 of 1" stood
    // above the form.
    const form = mount(contact({ ...quick, fields: fields.slice(0, 4) }));
    await nav();
    const line = form.querySelector<HTMLElement>(".quartz-form__progress")!;
    expect([line.hidden, line.textContent]).toEqual([true, ""]);
    expect(form.dataset.qfStep).toBe("last");
    choose(form, "event");
    expect([line.hidden, line.textContent]).toEqual([false, "Step 1 of 2"]);
    choose(form, "survey");
    expect([line.hidden, line.textContent]).toEqual([true, ""]);
  });

  it("opens one step at a time, checks only the open one and counts the steps that count", async () => {
    const form = mount(contact({ ...quick, fields }));
    await nav();
    expect(open(form)).toEqual([0]);
    // "Details" counts only for an event, so two steps for now
    expect(progress(form)).toBe("Step 1 of 2");
    expect(button(form, "back").hidden).toBe(true);
    expect(button(form, "next").hidden).toBe(false);
    expect(form.dataset.qfStep).toBe("middle");
    expect(form.querySelector('button[type="submit"]')!.hasAttribute("data-qf-later")).toBe(true);

    await click(button(form, "next"));
    expect(open(form)).toEqual([0]);
    expect(errorOf(form, "name")).toBe("This field is required.");
    // the steps after it are not checked yet
    expect(errorOf(form, "msg")).toBeNull();
    expect(status(form).text).toBe("Please check one field.");
    expect(document.activeElement).toBe(form.elements.namedItem("name"));

    fill(form, "name", "Ada");
    choose(form, "event");
    expect(progress(form)).toBe("Step 1 of 3");
    await click(button(form, "next"));
    expect(open(form)).toEqual([1]);
    expect(progress(form)).toBe("Step 2 of 3: Details");
    expect(status(form).text).toBe("");
    expect(document.activeElement).toBe(form.querySelector(".quartz-form__step-title"));
    expect(button(form, "back").hidden).toBe(false);

    await click(button(form, "back"));
    expect(open(form)).toEqual([0]);
    // a step without a heading: its first field
    expect(document.activeElement).toBe(form.querySelector('input[name="kind"]'));

    choose(form, "survey");
    await click(button(form, "next"));
    expect(open(form)).toEqual([2]);
    expect(progress(form)).toBe("Step 2 of 2");
    expect(form.dataset.qfStep).toBe("last");
    expect(button(form, "next").hidden).toBe(true);
    expect(document.activeElement).toBe(form.elements.namedItem("msg"));

    fill(form, "msg", "hello");
    fill(form, "guests", "12");
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      fields: Record<string, unknown>;
    };
    // the passed-over step's field stays behind
    expect(sent.fields).toEqual({ kind: "survey", name: "Ada", msg: "hello" });
  });

  it("goes on with Return before the last step, and sends from the last one", async () => {
    const form = mount(contact({ ...quick, fields }));
    await nav();
    fill(form, "name", "Ada");
    await submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(open(form)).toEqual([2]);
    fill(form, "msg", "hello");
    fetchMock.mockResolvedValueOnce(ok());
    await submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(status(form).state).toBe("success");
  });

  it("opens the step of the first field the relay refused", async () => {
    const form = mount(contact({ ...quick, fields }));
    await nav();
    fill(form, "name", "Ada");
    await click(button(form, "next"));
    fill(form, "msg", "hello");
    fetchMock.mockResolvedValueOnce(
      ok(
        { ok: false, error: "invalid", errors: [{ field: "name", code: "too_long" }] },
        { status: 400 },
      ),
    );
    await submit(form);
    expect(open(form)).toEqual([0]);
    expect(errorOf(form, "name")).toBe("Please use at most 2000 characters.");
    expect(document.activeElement).toBe(form.elements.namedItem("name"));
    expect(form.dataset.qfStep).toBe("middle");
  });

  it("renders the captcha when the last step first opens", async () => {
    const turnstile = fakeProvider();
    (window as unknown as { turnstile: unknown }).turnstile = turnstile;
    try {
      const form = mount(
        contact({
          ...quick,
          spam: { minSeconds: 0, captcha: "turnstile", captchaSiteKey: "site-key" },
          fields,
        }),
      );
      await nav();
      expect(turnstile.render).not.toHaveBeenCalled();
      fill(form, "name", "Ada");
      await click(button(form, "next"));
      expect(turnstile.render).toHaveBeenCalledTimes(1);
      await click(button(form, "back"));
      await click(button(form, "next"));
      expect(turnstile.render).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as unknown as { turnstile?: unknown }).turnstile;
    }
  });
});

describe("parity with the relay", () => {
  it("judges every case of the shared catalog as the relay does (test/parity-cases.ts)", async () => {
    const form = mount({ recipient: "owner", fields: parityFields, ...quick });
    await nav();
    const cfg = JSON.parse(form.querySelector(".quartz-form-config")!.textContent!) as {
      fields: { name: string }[];
      texts: Record<string, string>;
    };
    const { qfCheck } = (
      window as unknown as Record<string, { qfCheck: (...a: unknown[]) => string | null }>
    ).__qfTest!;
    const t = cfg.texts;
    const judge = (message: string | null, max?: number): ParityOutcome => {
      if (message === null) return "ok";
      if (message === t.required || message === t.consentRequired) return "required";
      if (max !== undefined && message === t.tooLong!.replace("{max}", String(max)))
        return "too_long";
      if (message === t.chooseOne || message === t.chooseAtLeastOne) return "not_an_option";
      return "invalid";
    };
    const disagreements: string[] = [];
    for (const c of parityCases) {
      const rule = cfg.fields.find((f) => f.name === c.field) as { maxLength?: number };
      const got = judge(qfCheck(cfg, rule, c.value), rule.maxLength);
      const sameVerdict = (got === "ok") === (c.relay === "ok");
      const sameCode = !["required", "too_long"].includes(c.relay) || got === c.relay;
      if (!sameVerdict || !sameCode)
        disagreements.push(
          `${c.field} ${JSON.stringify(c.value)}: relay ${c.relay}, script ${got}`,
        );
    }
    expect(disagreements).toEqual([]);
  });

  it("decides which conditional fields count as the relay does (test/parity-cases.ts, conditionCases)", async () => {
    const form = mount({ recipient: "owner", fields: conditionFields, ...quick });
    await nav();
    const cfg = JSON.parse(form.querySelector(".quartz-form-config")!.textContent!) as {
      fields: { name: string; required: boolean }[];
      texts: Record<string, string>;
    };
    const { qfCheck, qfActive } = (
      window as unknown as Record<
        string,
        {
          qfCheck: (...a: unknown[]) => string | null;
          qfActive: (cfg: unknown, values: Record<string, unknown>) => Set<string>;
        }
      >
    ).__qfTest!;
    const disagreements: string[] = [];
    for (const c of conditionCases) {
      const active = qfActive(cfg, c.values);
      for (const [name, want] of Object.entries(c.expect)) {
        const rule = cfg.fields.find((f) => f.name === name)!;
        const got = !active.has(name)
          ? "dropped"
          : qfCheck(cfg, rule, c.values[name] ?? "") === cfg.texts.required
            ? "required"
            : "ok";
        if (got !== want)
          disagreements.push(`${JSON.stringify(c.values)} ${name}: relay ${want}, script ${got}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("writes the mail the relay writes (test/parity-cases.ts, mailCases)", async () => {
    const differences: string[] = [];
    for (const c of mailCases) {
      navigateMock.mockReset();
      const form = mount(
        {
          recipient: "o@example.org",
          transport: { kind: "mailto" },
          pageContext: true,
          fields: mailFields,
          ...quick,
        },
        {},
        c.lang ?? "en",
        mailPage,
      );
      await nav();
      fill(form, "name", c.typed.name);
      for (const value of c.typed.topics)
        (form.querySelector(`input[name="topics"][value="${value}"]`) as HTMLInputElement).checked =
          true;
      fill(form, "msg", c.typed.msg);
      (form.elements.namedItem("news") as HTMLInputElement).checked = c.typed.news;
      fill(form, "detail", c.typed.detail ?? "");
      fill(form, "key", c.typed.key ?? "");
      await submit(form);
      // A pasted key is checked at send time; OpenPGP.js is not there, so it goes as pasted.
      for (let i = 0; i < 10 && navigateMock.mock.calls.length === 0; i++)
        await new Promise((r) => setTimeout(r, 0));
      const url = navigateMock.mock.calls[0]![0] as string;
      const mail = decodeURIComponent(url.split("&body=")[1]!);
      if (mail !== c.mail) differences.push(`${c.note}: ${JSON.stringify(mail)}`);
    }
    expect(differences).toEqual([]);
  });

  it("the relay's whitespace list (QF_WS in send.php) is this engine's \\s, over every code point", () => {
    // Second review, finding 10 (2026-10-19): PCRE's Unicode `\s` has U+0085 and U+180E and lacks
    // U+FEFF, so the relay spells the browser's list out; this keeps the two from drifting apart.
    const php = fs.readFileSync(path.join(__dirname, "../relay/php/send.php"), "utf8");
    const body = /^const QF_WS = '([^']+)';$/m.exec(php)?.[1];
    expect(body).toBeDefined();
    const list = new RegExp(`^[${body!.replace(/\\x\{([0-9a-f]+)\}/g, "\\u{$1}")}]$`, "u");
    const differences: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const ch = String.fromCodePoint(cp);
      if (/^\s$/u.test(ch) !== list.test(ch)) differences.push(`U+${cp.toString(16)}`);
    }
    expect(differences).toEqual([]);
  });
});
