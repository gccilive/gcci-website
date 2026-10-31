// Run after `npm run build`: node --test scripts/check-rendering.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/decorative-animation.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

test("globe geometry is identical between prerender and hydration", () => {
  const globe = ts.transpileModule(
    readFileSync(
      new URL("../src/components/fest/Globe.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const require = createRequire(import.meta.url);
  const sandbox = {
    exports: {},
    require: (name) =>
      name === "@/lib/decorative-animation" ? {} : require(name),
  };
  vm.runInNewContext(globe, sandbox);
  assert.equal(
    renderToStaticMarkup(createElement(sandbox.exports.Globe)),
    renderToStaticMarkup(createElement(sandbox.exports.Globe)),
  );
});

test("countdown markup survives hydration long after the static build", () => {
  const countdown = ts.transpileModule(
    readFileSync(new URL("../src/components/fest/Countdown.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  let now = new Date("2026-10-20T00:00:00Z").getTime();
  class Clock extends Date {
    static now() { return now; }
  }
  const sandbox = { exports: {}, require: createRequire(import.meta.url), Date: Clock };
  vm.runInNewContext(countdown, sandbox);
  const server = renderToStaticMarkup(createElement(sandbox.exports.Countdown));
  now += 7 * 86400000;
  const client = renderToStaticMarkup(createElement(sandbox.exports.Countdown));
  assert.equal(client, server);
  assert.equal((server.match(/>--<\/div>/g) ?? []).length, 4);
});

function animationEnvironment({ desktop = false, observer = true } = {}) {
  const frames = new Map();
  const mediaEvents = new Map();
  const documentEvents = new Map();
  const media = {
    matches: desktop,
    addEventListener: (name, listener) => mediaEvents.set(name, listener),
    removeEventListener: (name) => mediaEvents.delete(name),
  };
  const document = {
    hidden: false,
    addEventListener: (name, listener) => documentEvents.set(name, listener),
    removeEventListener: (name) => documentEvents.delete(name),
  };
  let observe;
  let disconnected = false;
  let nextFrame = 0;
  const sandbox = {
    exports: {},
    document,
    window: { matchMedia: () => media },
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    IntersectionObserver: observer
      ? class {
          constructor(callback) {
            observe = callback;
          }
          observe() {}
          disconnect() {
            disconnected = true;
          }
        }
      : undefined,
  };
  vm.runInNewContext(compiled, sandbox);
  const element = { dataset: {} };
  const draws = [];
  const stop = sandbox.exports.animateWhenVisible(element, (dt) =>
    draws.push(dt),
  );
  return {
    frames,
    media,
    mediaEvents,
    document,
    documentEvents,
    element,
    draws,
    stop,
    visible: (value) => observe([{ isIntersecting: value }]),
    get disconnected() {
      return disconnected;
    },
  };
}

test("mobile and reduced-motion decoration never schedule animation frames", () => {
  const env = animationEnvironment();
  env.visible(true);
  assert.equal(env.element.dataset.animate, "false");
  assert.equal(env.frames.size, 0);
  assert.deepEqual(env.draws, []);
  env.stop();
  assert.equal(env.mediaEvents.size, 0);
  assert.equal(env.documentEvents.size, 0);
  assert.equal(env.disconnected, true);
});

test("desktop decoration starts in view, stops offscreen/hidden and responds to media changes", () => {
  const env = animationEnvironment({ desktop: true });
  assert.equal(env.frames.size, 0);
  env.visible(true);
  assert.equal(env.frames.size, 1);
  const [id, draw] = [...env.frames][0];
  env.frames.delete(id);
  draw(50);
  assert.deepEqual(env.draws, [0.05]);
  assert.equal(env.frames.size, 1);
  env.visible(false);
  assert.equal(env.frames.size, 0);
  env.visible(true);
  env.document.hidden = true;
  env.documentEvents.get("visibilitychange")();
  assert.equal(env.frames.size, 0);
  env.document.hidden = false;
  env.documentEvents.get("visibilitychange")();
  assert.equal(env.frames.size, 1);
  env.media.matches = false;
  env.mediaEvents.get("change")();
  assert.equal(env.frames.size, 0);
  assert.equal(env.element.dataset.animate, "false");
  env.media.matches = true;
  env.mediaEvents.get("change")();
  env.stop();
  assert.equal(env.frames.size, 0);
  assert.equal(env.disconnected, true);
});

test("missing IntersectionObserver does not break the static mobile backdrop", () => {
  const env = animationEnvironment({ observer: false });
  assert.equal(env.frames.size, 0);
  env.stop();
});

const routes = [
  "",
  "agenda",
  "awards",
  "employment-zone",
  "podcast-room",
  "principals-conclave",
  "sponsors",
  "volunteers",
];
for (const route of routes) {
  test(`/${route} ships visible content and image URLs without JavaScript`, () => {
    const html = readFileSync(
      resolve(".output/public", route, "index.html"),
      "utf8",
    );
    assert.match(html, /<h1[\s>]/);
    assert.match(html, /<footer[\s>]/);
    // Inline animation shorthands override the mobile stylesheet.
    assert.doesNotMatch(html, /style="[^"]*animation:[^"]*infinite/);
    const hidden = [...html.matchAll(/<[^>]+style="([^"]*)"[^>]*>/g)].filter(
      ([, style]) => /(?:^|;)opacity:0(?:;|$)/.test(style),
    );
    // Only intentionally collapsed FAQ answers may start hidden.
    for (const [tag] of hidden) {
      assert.equal(route, "");
      assert.match(tag, /height:0/);
    }
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g))
      assert.match(tag, /src="[^"]+"/);
    if (!route) {
      const video = html.match(/<video\b[^>]*>/)?.[0];
      assert.ok(video);
      assert.match(video, /src="[^"]+"/);
      assert.match(video, /preload="none"/);
      assert.match(video, /poster="[^"]+"/);
      assert.doesNotMatch(video, /autoplay/i);
      assert.match(html, /loading="lazy"/);
      // The above-the-fold brand must load immediately; galleries may wait.
      const logo = [...html.matchAll(/<img\b[^>]*>/g)].find(([tag]) =>
        tag.includes('alt="GCCI"'),
      )?.[0];
      assert.ok(logo);
      assert.doesNotMatch(logo, /loading="lazy"/);
      assert.match(html, /<span>10,000<\/span>/);
      assert.match(html, /id="register"/);
    }
  });
}
