import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

function harness() {
  const state = [];
  let cursor = 0;
  const react = {
    useRef(value) { const i = cursor++; return state[i] ??= { current: value }; },
    useState(value) {
      const i = cursor++;
      if (!(i in state)) state[i] = value;
      return [state[i], (value) => { state[i] = value; }];
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(transformSync(readFileSync(
    new URL("../src/hooks/useAsyncAction.ts", import.meta.url), "utf8",
  ), { loader: "ts", format: "cjs" }).code, {
    module, exports: module.exports, require: () => react,
  });
  return () => { cursor = 0; return module.exports.useAsyncAction(); };
}

test("blocks repeated calls before a rerender and shows progress until completion", async () => {
  const render = harness();
  const action = render();
  let complete;
  let calls = 0;
  const work = () => { calls++; return new Promise((resolve) => { complete = resolve; }); };
  const first = action.run(work);
  await action.run(work);
  assert.equal(calls, 1);
  assert.equal(render().pending, true);
  complete("saved");
  assert.equal(await first, "saved");
  assert.equal(render().pending, false);
  assert.equal(await render().run(async () => "retry"), "retry");
});

test("failure releases the lock and allows retry", async () => {
  const render = harness();
  await assert.rejects(render().run(async () => { throw Error("Network failed"); }), /Network failed/);
  assert.equal(render().pending, false);
  assert.equal(await render().run(async () => "saved"), "saved");
});

test("early validation return releases the lock; synchronous failures do too", async () => {
  const render = harness();
  await render().run(async () => undefined);
  assert.equal(render().pending, false);
  await assert.rejects(render().run(() => { throw Error("Validation failed"); }), /Validation failed/);
  assert.equal(render().pending, false);
});
