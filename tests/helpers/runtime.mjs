import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

export function compile(path, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const source = readFileSync(
    new URL(`../../${path}`, import.meta.url),
    "utf8",
  );
  vm.runInNewContext(
    transformSync(source, { loader: "tsx", format: "cjs", jsx: "automatic" })
      .code,
    {
      module,
      exports: module.exports,
      console: { error() {}, warn() {} },
      setInterval: () => 0,
      clearInterval() {},
      require(name) {
        if (!(name in mocks)) throw Error(`Unexpected import: ${name}`);
        return mocks[name];
      },
      ...globals,
    },
  );
  return module.exports;
}

export function hooks() {
  const slots = [],
    effects = [];
  let cursor = 0;
  const api = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((d, k) => d !== slots[i].deps[k]))
        slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((d, k) => d !== slots[i].deps[k])) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  return {
    api,
    reset: () => {
      cursor = 0;
    },
    flush: () => effects.splice(0).forEach((f) => f()),
    cleanup: () => slots.forEach((s) => s?.cleanup?.()),
  };
}
export const jsx = (type, props) => ({ type, props: props || {} });
export function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return Array.isArray(node)
    ? node.flatMap(nodes)
    : [node, ...nodes(node.props?.children)];
}
export const settle = () => new Promise(setImmediate);
