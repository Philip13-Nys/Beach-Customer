import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes } from "./helpers/runtime.mjs";

const presentation = compile("src/app/utils/bookingPresentation.ts");
const policy = compile("src/app/utils/bookingPolicy.ts", {
  "./bookingPresentation": presentation,
});

function harness(cancel = async () => {}) {
  const runtime = hooks(),
    listeners = {},
    failures = {};
  const app = { user: { id: "customer" }, authLoading: false };
  const Root = compile(
    "src/app/pages/BookingHistory.tsx",
    {
      react: runtime.api,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "../../hooks/useAsyncAction": compile("src/hooks/useAsyncAction.ts", {
        react: runtime.api,
      }),
      "../utils/bookingPolicy": policy,
      "../utils/bookingPresentation": presentation,
      "../utils/payment": compile("src/app/utils/payment.ts"),
      "../services/customerBookings": { cancelCustomerBooking: cancel },
      "../context/AppContext": { useApp: () => app },
      "react-router": {
        Link: "link",
        Navigate: "navigate",
        useLocation: () => ({}),
      },
      "lucide-react": {},
      "../components/firebase": {
        auth: { currentUser: { uid: "customer" } },
        customerDb: {},
      },
      "firebase/firestore": {
        collection: (db, name) => name,
        query: (base) => base,
        where: () => ({}),
        onSnapshot(name, next, failed) {
          listeners[name] = next;
          failures[name] = failed;
          return () => {};
        },
      },
    },
    { Error },
  ).default;
  const Content = Root().props.children.type;
  function render() {
    runtime.reset();
    const result = Content();
    runtime.flush();
    return nodes(result);
  }
  render();
  const load = (values) =>
    listeners.Bookings({
      docs: values.map((data, index) => ({
        id: `b${index}`,
        data: () => ({
          userId: "customer",
          roomName: "Suite",
          checkIn: "2099-11-10",
          checkOut: "2099-11-12",
          status: "pending",
          totalPrice: 10000,
          amountPaid: 5000,
          paymentStatus: "partial",
          ...data,
        }),
      })),
    });
  return { render, load, failures };
}

const buttons = (result, label) =>
  result.filter(
    (node) =>
      node.type === "button" &&
      (node.props.children === label || node.props.children?.includes?.(label)),
  );

test("history offers cancellation for pending/confirmed bookings without a time cutoff", () => {
  const h = harness();
  h.load([
    { status: "pending" },
    { status: "confirmed" },
    { status: "checked-in" },
    { status: "checked-out" },
    { status: "cancelled" },
    { checkIn: "2000-01-01" },
  ]);
  const result = h.render(),
    cancel = buttons(result, "Cancel Booking");
  assert.equal(cancel.length, 3);
  assert.equal(cancel.filter((button) => button.props.disabled).length, 0);
  assert.equal(
    result.some(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.includes("48 hours"),
    ),
    false,
  );
});

test("cancellation requires confirmation, blocks repeated submits and displays success immediately", async () => {
  let complete,
    calls = 0;
  const h = harness(() => {
    calls++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  h.load([{}]);
  buttons(h.render(), "Cancel Booking")[0].props.onClick();
  assert.equal(calls, 0);
  let result = h.render();
  assert.ok(result.some((node) => node.props.role === "dialog"));
  const confirm = buttons(result, "Yes, Cancel")[0];
  const pending = confirm.props.onClick();
  confirm.props.onClick();
  assert.equal(calls, 1);
  assert.equal(buttons(h.render(), "Cancelling...")[0].props.disabled, true);
  complete();
  await pending;
  result = h.render();
  assert.equal(buttons(result, "Cancel Booking").length, 0);
  assert.ok(
    result.some(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.startsWith("Booking cancelled successfully"),
    ),
  );
});

test("failed cancellation preserves the booking and shows the error with a retry action", async () => {
  const h = harness(async () => {
    throw Error("Unable to connect. Please try again.");
  });
  h.load([{}]);
  buttons(h.render(), "Cancel Booking")[0].props.onClick();
  await buttons(h.render(), "Yes, Cancel")[0].props.onClick();
  const result = h.render();
  assert.ok(
    result.some(
      (node) =>
        node.props.role === "alert" &&
        node.props.children.includes("Unable to connect"),
    ),
  );
  assert.equal(buttons(result, "Yes, Cancel")[0].props.disabled, false);
  assert.equal(buttons(result, "Cancel Booking").length, 1);
});

test("history distinguishes initial loading and listener failure from an empty account", () => {
  const h = harness();
  assert.ok(
    h
      .render()
      .some((node) => node.props.children === "Loading your bookings..."),
  );
  h.failures.Bookings(Error("Permission denied"));
  const result = h.render();
  assert.ok(result.some((node) => node.props.role === "alert"));
  assert.equal(
    result.some((node) => node.props.children === "No bookings found"),
    false,
  );
});
