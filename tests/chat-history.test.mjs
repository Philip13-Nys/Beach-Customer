import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { compile, hooks, jsx, settle } from "./helpers/runtime.mjs";

const chatUtils = compile(
  "src/app/utils/chatHistory.ts",
  {},
  { crypto: { randomUUID } },
);

function harness({
  storage = new Map(),
  cloud = new Map(),
  identity = "guest",
  fetchImpl,
} = {}) {
  const runtime = hooks(),
    listeners = [];
  const app = {
    user: identity === "guest" ? null : { id: identity },
    authLoading: false,
  };
  const auth = { currentUser: identity === "guest" ? null : { uid: identity } };
  let failWrites = false;
  const reference = (base, ...parts) => ({
    path: [base.path || "", ...parts].filter(Boolean).join("/"),
  });
  function snapshot(path) {
    return {
      docs: [...cloud]
        .filter(
          ([key]) =>
            key.startsWith(`${path}/`) &&
            !key.slice(path.length + 1).includes("/"),
        )
        .map(([key, data]) => ({
          id: key.split("/").at(-1),
          data: () => data,
        })),
    };
  }
  function emit() {
    listeners
      .filter((l) => l.active)
      .forEach((l) => l.next(snapshot(l.ref.path)));
  }
  const firestore = {
    collection: reference,
    doc: reference,
    onSnapshot(ref, next, error) {
      const listener = { ref, next, error, active: true };
      listeners.push(listener);
      queueMicrotask(() => {
        if (listener.active) next(snapshot(ref.path));
      });
      return () => {
        listener.active = false;
      };
    },
    writeBatch() {
      const entries = [];
      return {
        set: (ref, data) => entries.push([ref.path, data]),
        commit: async () => {
          if (failWrites) throw Error("Cloud unavailable");
          entries.forEach(([path, data]) => cloud.set(path, data));
          queueMicrotask(emit);
        },
      };
    },
  };
  const Provider = compile(
    "src/app/context/ChatContext.tsx",
    {
      react: runtime.api,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "firebase/firestore": firestore,
      "../components/firebase": { auth, customerDb: {} },
      "./AppContext": { useApp: () => app },
      "../utils/chatHistory": chatUtils,
    },
    {
      localStorage: {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
      },
      AbortController,
      fetch:
        fetchImpl ||
        (async () => ({
          ok: true,
          json: async () => ({ response: "Welcome to the resort" }),
        })),
    },
  ).ChatProvider;
  function render(children = "rooms") {
    runtime.reset();
    const value = Provider({ children }).props.value;
    runtime.flush();
    return value;
  }
  return {
    render,
    storage,
    cloud,
    listeners,
    async ready() {
      for (let i = 0; i < 4; i++) {
        render();
        await settle();
      }
      return render();
    },
    switchUser(id, loading = false) {
      app.authLoading = loading;
      app.user = id === "guest" ? null : { id };
      auth.currentUser = id === "guest" ? null : { uid: id };
    },
    failWrites(value) {
      failWrites = value;
    },
    cleanup: runtime.cleanup,
  };
}

test("guest conversations survive page navigation and refresh; new chat archives rather than deletes", async () => {
  const storage = new Map(),
    h = harness({ storage });
  await h.ready();
  await h.render().send("What rooms are available?", "/mock-ai", {});
  assert.equal(h.render("reviews").messages.length, 2);
  const oldId = h.render().currentId;
  h.render().startNew();
  assert.equal(h.render().messages.length, 0);
  assert.equal(h.render().sessions.length, 2);
  h.render().select(oldId);
  assert.equal(h.render().messages[0].text, "What rooms are available?");
  const fresh = harness({ storage });
  await fresh.ready();
  assert.equal(fresh.render().messages.length, 2);
  assert.equal(fresh.render().currentId, oldId);
  h.cleanup();
  fresh.cleanup();
});

test("an in-flight AI response survives navigation and repeated clicks send only once", async () => {
  let complete,
    calls = 0;
  const h = harness({
    fetchImpl: () => {
      calls++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  await h.ready();
  const request = h.render().send("Tell me about diving", "/mock-ai", {});
  await h.render("services").send("Tell me about diving", "/mock-ai", {});
  assert.equal(calls, 1);
  assert.equal(h.render().busy, true);
  complete({
    ok: true,
    json: async () => ({ response: "Diving is available" }),
  });
  await request;
  assert.equal(h.render("ai-assistant").messages.length, 2);
  assert.equal(h.render().messages[1].text, "Diving is available");
  assert.equal(h.render().busy, false);
  h.cleanup();
});

test("signed-in messages sync privately, restore on another device and never duplicate on reload", async () => {
  const cloud = new Map(),
    h = harness({ identity: "customer", cloud });
  await h.ready();
  await h.render().send("Hi", "/mock-ai", {});
  await h.ready();
  const messagePaths = [...cloud.keys()].filter((path) =>
    path.includes("/messages/"),
  );
  assert.equal(messagePaths.length, 2);
  assert.ok(
    messagePaths.every((path) =>
      path.startsWith("Users/customer/chatSessions/"),
    ),
  );
  const anotherDevice = harness({ identity: "customer", cloud });
  await anotherDevice.ready();
  assert.equal(anotherDevice.render().messages.length, 2);
  anotherDevice.listeners
    .filter((l) => l.active)
    .forEach((l) =>
      l.next({
        docs: [...cloud]
          .filter(
            ([path]) =>
              path.startsWith(l.ref.path + "/") &&
              !path.slice(l.ref.path.length + 1).includes("/"),
          )
          .map(([path, data]) => ({
            id: path.split("/").at(-1),
            data: () => data,
          })),
      }),
    );
  assert.equal(anotherDevice.render().messages.length, 2);
  h.cleanup();
  anotherDevice.cleanup();
});

test("sign-out hides private history, aborts pending replies, and keeps guest storage separate", async () => {
  let complete;
  const h = harness({
    identity: "customer",
    fetchImpl: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  await h.ready();
  const request = h.render().send("Private question", "/mock-ai", {});
  h.switchUser("guest", true);
  assert.equal(h.render().messages.length, 0);
  h.switchUser("guest");
  await h.ready();
  complete({ ok: true, json: async () => ({ response: "Private reply" }) });
  await request;
  assert.equal(h.render().messages.length, 0);
  assert.ok(h.storage.has("cbr_chat_v1_customer"));
  assert.ok(h.storage.has("cbr_chat_v1_guest"));
  h.cleanup();
});

test("cloud failures preserve device history and explicit retry syncs it later", async () => {
  const h = harness({ identity: "customer" });
  await h.ready();
  h.failWrites(true);
  await h.render().send("Please save this", "/mock-ai", {});
  await settle();
  assert.equal(h.render().messages.length, 2);
  assert.match(h.render().error, /sync failed/);
  h.failWrites(false);
  h.render().retrySync();
  await h.ready();
  assert.equal(
    [...h.cloud.keys()].filter((path) => path.includes("/messages/")).length,
    2,
  );
  assert.equal(h.render().messages.length, 2);
  h.cleanup();
});

test("retrying cloud sync keeps an in-flight conversation busy", async () => {
  let complete;
  const h = harness({
    identity: "customer",
    fetchImpl: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  await h.ready();
  const request = h.render().send("Question while syncing", "/mock-ai", {});
  h.render().retrySync();
  await h.ready();
  assert.equal(h.render().busy, true);
  complete({ ok: true, json: async () => ({ response: "Saved reply" }) });
  await request;
  assert.equal(h.render().busy, false);
  assert.equal(h.render().messages.length, 2);
  h.cleanup();
});

test("malformed stored history cannot crash chat; message IDs merge in chronological order", () => {
  assert.equal(chatUtils.readChatArchive("not-json").sessions.length, 1);
  const later = { id: "b", role: "ai", text: "Reply", createdAt: 2 },
    earlier = { id: "a", role: "user", text: "Question", createdAt: 1 };
  const merged = chatUtils.mergeChatMessages([later, earlier], [earlier]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "a");
});
