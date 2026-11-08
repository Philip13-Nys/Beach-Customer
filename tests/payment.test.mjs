import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

function compile(path, mocks = {}, globals = {}) {
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
        assert.ok(name in mocks, `Unexpected import: ${name}`);
        return mocks[name];
      },
      console: { error() {} },
      setInterval: () => 0,
      clearInterval() {},
      ...globals,
    },
  );
  return module.exports;
}

const helpers = compile("../src/app/utils/payment.ts");
const bookingPresentation = compile("../src/app/utils/bookingPresentation.ts");
const { getPaymentSummary } = helpers;

test("initial deposit keeps existing rounding but never exceeds the balance", () => {
  assert.equal(getPaymentSummary({ totalPrice: 10000 }, 50).amountDue, 5000);
  assert.equal(
    getPaymentSummary({ totalPrice: 100.25 }, 100).amountDue,
    100.25,
  );
  assert.equal(getPaymentSummary({ totalPrice: 100.25 }, 50).amountDue, 51);
});

test("a balance payment settles only the verified outstanding amount", () => {
  for (const percent of [50, 10, undefined]) {
    const result = getPaymentSummary(
      { totalPrice: 10000, amountPaid: 8000 },
      percent,
    );
    assert.equal(result.amountDue, 2000);
    assert.equal(result.balanceAfterVerification, 0);
    assert.equal(result.paymentStatus, "partial");
  }
  assert.equal(
    getPaymentSummary({ totalPrice: 100.3, amountPaid: 100.1 }, 50).amountDue,
    0.2,
  );
});

test("pending verification and rejection survive monetary status calculation", () => {
  for (const amountPaid of [0, 5000]) {
    const result = getPaymentSummary(
      { totalPrice: 10000, amountPaid, paymentStatus: "pending_verification" },
      50,
    );
    assert.equal(result.paymentStatus, "pending_verification");
    assert.equal(result.remainingBalance, 10000 - amountPaid);
  }
  assert.equal(
    getPaymentSummary({ totalPrice: 10000, paymentStatus: "rejected" })
      .paymentStatus,
    "rejected",
  );
  assert.equal(
    getPaymentSummary({ totalPrice: 10000, amountPaid: 10000 }).paymentStatus,
    "paid",
  );
  assert.equal(
    getPaymentSummary({ totalPrice: 10000, amountPaid: 12000 }, 50).amountDue,
    0,
  );
});

test("invalid amounts cannot produce a payable amount or a paid status", () => {
  for (const booking of [
    {},
    { totalPrice: -10 },
    { totalPrice: "bad" },
    { totalPrice: 100, amountPaid: -1 },
    { totalPrice: 100, amountPaid: Infinity },
  ]) {
    const result = getPaymentSummary(booking, 50);
    assert.equal(result.validAmounts, false);
    assert.equal(result.amountDue, 0);
    assert.equal(result.paymentStatus, "unpaid");
  }
  assert.equal(getPaymentSummary({ totalPrice: 100 }, 0).amountDue, 0);
});

function paymentHarness(booking, { failCommit = false } = {}) {
  const state = [];
  let cursor = 0;
  const writes = [];
  let commits = 0;
  const jsx = (type, props) => ({ type, props });
  const app = {
    user: { id: "customer", firstName: "Test", lastName: "Guest" },
    pendingPayment: booking,
    setPendingPayment(value) {
      app.pendingPayment = value;
    },
    createNotification: async () => {},
    modifyBooking() {
      assert.fail("Submission must not perform a second booking write");
    },
  };
  const mocks = {
    react: {
      useEffect() {},
      useRef(value) {
        const i = cursor++;
        return (state[i] ??= { current: value });
      },
      useState(value) {
        const i = cursor++;
        if (!(i in state)) state[i] = value;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-router": {
      useNavigate: () => () => {},
      useSearchParams: () => [new URLSearchParams()],
    },
    "../context/AppContext": { useApp: () => app },
    "../utils/payment": helpers,
    "../utils/paymentReference": compile("../src/app/utils/paymentReference.ts"),
    "../services/emailVerification": { requireVerifiedCustomer: async () => ({ uid: "customer" }) },
    "../utils/bookingPresentation": bookingPresentation,
    "../utils/bookingPolicy": compile("../src/app/utils/bookingPolicy.ts", { "./bookingPresentation": bookingPresentation }),
    "../services/customerBookings": {},
    "lucide-react": {},
    "../components/firebase": { db: {}, customerDb: {} },
    "firebase/firestore": {
      doc: (...parts) => ({ id: "payment-record", parts }),
      collection: (...parts) => parts,
      serverTimestamp: () => "server-time",
      writeBatch: () => ({
        set: (ref, data) => writes.push({ operation: "set", data }),
        update: (ref, data) => writes.push({ operation: "update", data }),
        commit: async () => {
          commits++;
          if (failCommit) throw Error("Offline");
        },
      }),
    },
  };
  const Component = compile("../src/app/pages/Payment.tsx", mocks).default;
  function render() {
    cursor = 0;
    return Component();
  }
  render();
  state[2] = {
    downPaymentPercent: 50,
    gcashNumber: "09000000000",
    accountName: "Resort",
    isEnabled: true,
  };
  state[3] = false;
  state[4] = "1234567890123";
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return Array.isArray(node)
      ? node.flatMap(nodes)
      : [node, ...nodes(node.props?.children)];
  }
  return {
    writes,
    state,
    render,
    nodes,
    get commits() {
      return commits;
    },
    submit: () =>
      nodes(render())
        .find((n) => n.type === "form")
        .props.onSubmit({ preventDefault() {} }),
  };
}

test("balance submission writes one pending payment atomically and preserves settled money", async () => {
  const harness = paymentHarness({
    id: "booking",
    totalPrice: 10000,
    amountPaid: 8000,
    downPaymentAmount: 5000,
  });
  await Promise.all([harness.submit(), harness.submit()]);
  assert.equal(harness.commits, 1);
  assert.equal(harness.writes[0].data.amount, 2000);
  assert.equal(harness.writes[0].data.type, "balance");
  assert.equal(harness.writes[0].data.status, "pending");
  assert.equal("proof" in harness.writes[0].data, false);
  assert.equal("proofOfPayment" in harness.writes[0].data, false);
  assert.equal(harness.nodes(harness.render()).some(node => node.type === "input" && node.props.type === "file"), false);
  const update = harness.writes[1].data;
  assert.equal(update.paymentStatus, "pending_verification");
  assert.equal(update.remainingBalance, 2000);
  assert.equal("amountPaid" in update, false);
  assert.equal("downPaymentAmount" in update, false);
  assert.ok(
    harness
      .nodes(harness.render())
      .some((node) => node.props?.children === "Payment Submitted!"),
    "Shows submission success even when using context booking",
  );
});

test("initial deposit stays unverified; pending and fully paid bookings cannot submit", async () => {
  const initial = paymentHarness({ id: "booking", totalPrice: 10000 });
  await initial.submit();
  assert.equal(initial.writes[0].data.amount, 5000);
  assert.equal(initial.writes[1].data.remainingBalance, 10000);
  assert.equal(initial.writes[1].data.downPaymentAmount, 5000);
  for (const booking of [
    { paymentStatus: "pending_verification", amountPaid: 0 },
    { paymentStatus: "partial", amountPaid: 10000 },
    { status: "cancelled", amountPaid: 0 },
  ]) {
    const harness = paymentHarness({
      id: "booking",
      totalPrice: 10000,
      ...booking,
    });
    await harness.submit();
    assert.equal(harness.commits, 0);
  }
});

test("failed commit does not show success and allows retry", async () => {
  const harness = paymentHarness(
    { id: "booking", totalPrice: 10000 },
    { failCommit: true },
  );
  await harness.submit();
  assert.equal(harness.state[6], false);
  assert.equal(harness.state[5], false);
  await harness.submit();
  assert.equal(harness.commits, 2);
});

test("booking history preserves pending status and restores payment actions after review", () => {
  let cursor = 0;
  const state = [];
  const effects = [];
  const listeners = {};
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: {
      useEffect: (effect) => effects.push(effect),
      useState(value) {
        const i = cursor++;
        if (!(i in state)) state[i] = value;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-router": {
      Link: "link",
      Navigate: "navigate",
      useLocation: () => ({}),
    },
    "../context/AppContext": { useApp: () => ({ user: { id: "customer" } }) },
    "../utils/payment": helpers,
    "../utils/bookingPresentation": bookingPresentation,
    "../utils/bookingPolicy": compile("../src/app/utils/bookingPolicy.ts", { "./bookingPresentation": bookingPresentation }),
    "../services/customerBookings": {},
    "lucide-react": {},
    "../components/firebase": {
      auth: { currentUser: { uid: "customer" } },
      customerDb: {},
    },
    "firebase/firestore": {
      collection: (db, name) => ({ name }),
      query: (collection) => collection,
      where: () => ({}),
      onSnapshot(query, callback) {
        listeners[query.name] = callback;
        return () => {};
      },
    },
  };
  mocks.react.useRef = (value) => {
    const i = cursor++;
    return (state[i] ??= { current: value });
  };
  mocks["../../hooks/useAsyncAction"] = compile(
    "../src/hooks/useAsyncAction.ts",
    { react: mocks.react },
  );
  const root = compile("../src/app/pages/BookingHistory.tsx", mocks).default();
  const Content = root.props.children.type;
  function render() {
    cursor = 0;
    return Content();
  }
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return Array.isArray(node)
      ? node.flatMap(nodes)
      : [node, ...nodes(node.props?.children)];
  }
  render();
  effects.splice(0).forEach((effect) => effect());
  for (const [paymentStatus, amountPaid, expectedLabel, canPay] of [
    ["pending_verification", 0, "Pending Verification", false],
    ["pending_verification", 5000, "Pending Verification", false],
    ["partial", 5000, "Partial", true],
    ["paid", 10000, "Paid", false],
    ["rejected", 0, "Payment Rejected", true],
  ]) {
    listeners.Bookings({
      docs: [
        {
          id: "booking",
          data: () => ({
            userId: "customer",
            totalPrice: 10000,
            amountPaid,
            paymentStatus,
            status: "confirmed",
          }),
        },
      ],
      docChanges: () => [],
    });
    const result = nodes(render());
    assert.ok(
      result.some((node) => node.props?.children === expectedLabel),
      expectedLabel,
    );
    assert.equal(
      result.some(
        (node) =>
          node.type === "link" &&
          node.props.to === "/payment?bookingId=booking",
      ),
      canPay,
    );
  }

  listeners.Bookings({
    docs: [
      ["Old", "2026-11-01T10:00:00Z"],
      ["Missing date", undefined],
      ["Newest", { toMillis: () => Date.parse("2026-11-04T10:00:00Z") }],
      ["Middle", { seconds: Date.parse("2026-11-03T10:00:00Z") / 1000 }],
    ].map(([name, createdAt]) => ({
      id: name,
      data: () => ({
        roomName: name,
        createdAt,
        status: "confirmed",
        totalPrice: 10000,
      }),
    })),
    docChanges: () => [],
  });
  const cardNames = () =>
    nodes(render())
      .filter((node) => node.type === "h2")
      .map((node) => node.props.children);
  assert.deepEqual(cardNames(), ["Newest", "Middle", "Old", "Missing date"]);
  nodes(render())
    .find(
      (node) => node.type === "button" && node.props.children === "Confirmed",
    )
    .props.onClick();
  assert.deepEqual(
    cardNames(),
    ["Newest", "Middle", "Old", "Missing date"],
    "Filtering preserves creation order",
  );
});
