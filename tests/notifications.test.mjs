import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

function compile(path, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(
    transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), {
      loader: "tsx",
      format: "cjs",
      jsx: "automatic",
    }).code,
    {
      module,
      exports: module.exports,
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
      console: { error() {}, warn() {} },
    },
  );
  return module.exports;
}
const payment = compile("../src/app/utils/payment.ts", {});
const bookingHelpers = compile("../src/app/utils/bookingNotifications.ts", {
  "./payment": payment,
});
const settle = () => new Promise(setImmediate);
const docSnapshot = (id, data) => ({ id, data: () => data });
const snapshot = (changes) => ({
  docs: changes.map((change) => change.doc),
  docChanges: () => changes,
});

function harness() {
  let cursor = 0,
    authCallback,
    failWrites = false;
  const slots = [],
    effects = [],
    listeners = [],
    saved = new Map();
  const auth = { currentUser: null };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = value;
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
      if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j]))
        slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) {
        const cleanup = slots[i]?.cleanup;
        slots[i] = { deps };
        effects.push(() => {
          cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const firestore = {
    doc: (db, collection, id) => ({ collection, id }),
    collection: (db, collection) => ({ collection, constraints: [] }),
    query: (base, ...constraints) => ({
      ...base,
      constraints: [...base.constraints, ...constraints],
    }),
    where: (field, op, value) => ({ kind: "where", field, op, value }),
    orderBy: (field, direction) => ({ kind: "order", field, direction }),
    limit: (count) => ({ kind: "limit", count }),
    getDoc: async () => ({
      exists: () => true,
      data: () => ({ firstName: "Guest" }),
    }),
    onSnapshot(query, next, error) {
      const listener = { query, next, error, active: true };
      listeners.push(listener);
      return () => {
        listener.active = false;
      };
    },
    serverTimestamp: () => ({ toMillis: () => saved.size + 1 }),
    runTransaction: async (db, action) => {
      if (failWrites) throw Error("Write denied");
      await action({
        get: async (ref) => ({ exists: () => saved.has(ref.id) }),
        set: (ref, data) => saved.set(ref.id, data),
      });
    },
  };
  const Provider = compile("../src/app/context/AppContext.tsx", {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "../utils/bookingNotifications": bookingHelpers,
    "../services/customerBookings": {},
    "../components/firebase": { auth, customerDb: {} },
    "firebase/auth": {
      onAuthStateChanged: (unused, callback) => {
        authCallback = callback;
        return () => {};
      },
    },
    "firebase/firestore": firestore,
  }).AppProvider;
  function render(children = "rooms") {
    cursor = 0;
    const result = Provider({ children });
    effects.splice(0).forEach((effect) => effect());
    return result.props.value;
  }
  return {
    render,
    saved,
    listeners,
    listener: (collection) =>
      listeners.findLast(
        (listener) =>
          listener.active && listener.query.collection === collection,
      ),
    async signIn(id = "customer") {
      render();
      auth.currentUser = { uid: id };
      await authCallback(auth.currentUser);
      render();
    },
    async signOut() {
      auth.currentUser = null;
      await authCallback(null);
      render();
    },
    failWrites(value) {
      failWrites = value;
    },
  };
}

test("newest-first query is scoped to the signed-in customer and limited to 100", async () => {
  const h = harness();
  await h.signIn();
  const { query } = h.listener("Notifications");
  assert.ok(
    query.constraints.some(
      (c) =>
        c.kind === "where" && c.field === "userId" && c.value === "customer",
    ),
  );
  assert.ok(
    query.constraints.some(
      (c) =>
        c.kind === "order" && c.field === "createdAt" && c.direction === "desc",
    ),
  );
  assert.ok(
    query.constraints.some((c) => c.kind === "limit" && c.count === 100),
  );
  assert.equal(h.render().notificationsLoading, true);
});

test("missing-index fallback selects the newest 100; listener failure preserves records and exposes retry", async () => {
  const h = harness();
  await h.signIn();
  h.listener("Notifications").error({ code: "failed-precondition" });
  const fallback = h.listener("Notifications");
  assert.equal(fallback.query.constraints.length, 1);
  fallback.next({
    docs: Array.from({ length: 150 }, (_, i) =>
      docSnapshot(`n${i}`, {
        title: `Update ${i}`,
        createdAt: { toMillis: () => i },
        read: false,
      }),
    ),
  });
  let value = h.render();
  assert.equal(value.notifications.length, 100);
  assert.equal(value.notifications[0].id, "n149");
  assert.equal(value.notifications[99].id, "n50");
  assert.equal(value.notificationsLoading, false);
  fallback.error({ code: "permission-denied" });
  value = h.render();
  assert.match(value.notificationsError, /could not be loaded/);
  assert.equal(value.notifications.length, 100);
  value.retryNotifications();
  h.render();
  assert.equal(fallback.active, false);
  h.listener("Notifications").next({ docs: [] });
  assert.equal(h.render().notificationsError, "");
});

test("booking changes are monitored across pages, without historical floods or duplicate events", async () => {
  const h = harness();
  await h.signIn();
  const listener = h.listener("Bookings");
  const base = { totalPrice: 10000, status: "pending", amountPaid: 0 };
  listener.next(
    snapshot([{ type: "added", doc: docSnapshot("booking", base) }]),
  );
  await settle();
  assert.equal(h.saved.size, 0);
  h.render("services");
  assert.equal(h.listener("Bookings"), listener);
  const approved = {
    ...base,
    status: "confirmed",
    amountPaid: 5000,
    paymentStatus: "partial",
  };
  listener.next(
    snapshot([{ type: "modified", doc: docSnapshot("booking", approved) }]),
  );
  await settle();
  assert.equal(h.saved.size, 2);
  listener.next(
    snapshot([{ type: "modified", doc: docSnapshot("booking", approved) }]),
  );
  await settle();
  assert.equal(h.saved.size, 2);
  for (const value of h.saved.values()) assert.equal(value.userId, "customer");
});

test("failed notification creation is retryable and signed-out listeners cannot write", async () => {
  const h = harness();
  await h.signIn();
  const listener = h.listener("Bookings");
  listener.next(
    snapshot([
      { type: "added", doc: docSnapshot("booking", { status: "pending" }) },
    ]),
  );
  h.failWrites(true);
  const changed = {
    type: "modified",
    doc: docSnapshot("booking", { status: "confirmed" }),
  };
  listener.next(snapshot([changed]));
  await settle();
  assert.match(h.render().notificationsError, /could not be saved/);
  h.failWrites(false);
  h.render().retryNotifications();
  h.render();
  await settle();
  assert.equal(h.saved.size, 1);
  assert.equal(h.render().notificationsError, "");
  await h.signOut();
  assert.equal(listener.active, false);
  listener.next(
    snapshot([
      {
        type: "modified",
        doc: docSnapshot("booking", { status: "cancelled" }),
      },
    ]),
  );
  await settle();
  assert.equal(h.saved.size, 1);
  assert.equal(h.render().notifications.length, 0);
});

test("a rejected submission does not falsely announce another payment received", () => {
  const before = bookingHelpers.bookingNotificationState({
    totalPrice: 10000,
    amountPaid: 5000,
    paymentStatus: "pending_verification",
  });
  const changes = bookingHelpers.bookingChangeNotifications(
    "booking",
    {
      totalPrice: 10000,
      amountPaid: 5000,
      paymentStatus: "partial",
    },
    before,
  );
  assert.equal(changes.length, 0);
});

test("separate amount and verification updates still announce the verified payment once", () => {
  const initial = bookingHelpers.bookingNotificationState({
    totalPrice: 10000,
    amountPaid: 0,
    paymentStatus: "pending_verification",
  });
  const amountUpdate = {
    totalPrice: 10000,
    amountPaid: 5000,
    paymentStatus: "pending_verification",
  };
  assert.equal(
    bookingHelpers.bookingChangeNotifications("booking", amountUpdate, initial)
      .length,
    0,
  );
  const waiting = bookingHelpers.bookingNotificationState(
    amountUpdate,
    initial,
  );
  const verified = { ...amountUpdate, paymentStatus: "partial" };
  const changes = bookingHelpers.bookingChangeNotifications(
    "booking",
    verified,
    waiting,
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].title, "Partial Payment Received");
  assert.equal(
    bookingHelpers.bookingChangeNotifications(
      "booking",
      verified,
      bookingHelpers.bookingNotificationState(verified, waiting),
    ).length,
    0,
  );
});

test("the bell distinguishes loading and failure from an empty inbox, and exposes retry", () => {
  let stateIndex = 0,
    retries = 0;
  const app = {
    user: { firstName: "Guest" },
    notifications: [],
    unreadCount: 0,
    notificationsLoading: true,
    notificationsError: "",
    retryNotifications: () => {
      retries++;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const Layout = compile("../src/app/components/Layout.tsx", {
    react: {
      useState: (initial) => [stateIndex++ === 1 ? true : initial, () => {}],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../../hooks/useAsyncAction": {
      useAsyncAction: () => ({ pending: false, run: (fn) => fn() }),
    },
    "../../hooks/useResortSettings": {
      useResortSettings: () => ({ settings: {} }),
    },
    "react-router": {
      Link: "link",
      useNavigate: () => () => {},
      useLocation: () => ({ pathname: "/rooms" }),
    },
    "../context/AppContext": { useApp: () => app },
    "./FloatingAI": { __esModule: true, default: "assistant" },
    "lucide-react": {},
  }).default;
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return Array.isArray(node)
      ? node.flatMap(nodes)
      : [node, ...nodes(node.props?.children)];
  }
  function render() {
    stateIndex = 0;
    return nodes(Layout({ children: "Rooms" }));
  }
  let result = render();
  assert.ok(
    result.some((node) => node.props?.children === "Loading notifications..."),
  );
  assert.equal(
    result.some((node) => node.props?.children === "No notifications yet"),
    false,
  );
  app.notificationsLoading = false;
  app.notificationsError = "Notifications could not be loaded. Please retry.";
  result = render();
  assert.ok(result.some((node) => node.props?.role === "alert"));
  assert.equal(
    result.some((node) => node.props?.children === "No notifications yet"),
    false,
  );
  assert.equal(
    result.some((node) => node.props?.children === "You're all caught up"),
    false,
  );
  result
    .find(
      (node) =>
        node.type === "button" && node.props.children === "Retry updates",
    )
    .props.onClick();
  assert.equal(retries, 1);
});
