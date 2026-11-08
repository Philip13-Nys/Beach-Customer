import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes, settle } from "./helpers/runtime.mjs";

const registration = compile("src/app/utils/registration.ts");
const availability = compile("src/app/utils/availability.ts");
const reference = compile("src/app/utils/paymentReference.ts");
const payments = compile("src/app/utils/payment.ts");
const manual = compile("src/app/utils/manualPayment.ts", {
  "./payment": payments,
  "./paymentReference": reference,
});
test("Philippine mobile numbers normalize to +639 and reject malformed input", () => {
  assert.equal(
    registration.normalizePhilippineMobile("09171234567"),
    "+639171234567",
  );
  assert.equal(
    registration.normalizePhilippineMobile("+639171234567"),
    "+639171234567",
  );
  for (const value of [
    "",
    "0917123456",
    "091712345678",
    "08171234567",
    "639171234567",
    "+6309171234567",
    "09abcdefgh1",
    "0917 1234567",
    "0917-1234567",
    "+639171234567!",
  ])
    assert.throws(() => registration.normalizePhilippineMobile(value));
});

const type = { id: "suite", name: "Suite" };
const rooms = [1, 2].map((n) => ({
  id: `room-${n}`,
  roomTypeId: "suite",
  status: "available",
}));
const stay = {
  id: "one",
  roomId: "suite",
  status: "confirmed",
  checkIn: "2099-11-10",
  checkOut: "2099-11-12",
  roomCount: 1,
};
const count = (bookings, legacy = [], inventory = rooms) =>
  availability.remainingRooms(
    type,
    inventory,
    bookings,
    legacy,
    "2099-11-10",
    "2099-11-12",
  );
test("availability uses confirmed/occupied reservations, physical rooms, and exclusive check-out", () => {
  for (const status of [
    "pending",
    "pending-payment-verification",
    "cancelled",
    "checked-out",
  ])
    assert.equal(count([{ ...stay, status }]), 2);
  for (const status of ["confirmed", "checked-in", "reserved"])
    assert.equal(count([{ ...stay, status }]), 1);
  assert.equal(count([{ ...stay, checkOut: "2099-11-10" }]), 2);
  assert.equal(count([stay, { ...stay, id: "two" }]), 0);
  assert.equal(count([], [], []), 0);
  assert.equal(
    count(
      [],
      [],
      rooms.map((room) => ({ ...room, status: "maintenance" })),
    ),
    0,
  );
});
test("availability counts peak nights, deduplicates mirrors and respects physical assignments", () => {
  assert.equal(
    count([
      { ...stay, checkOut: "2099-11-11" },
      { ...stay, id: "two", checkIn: "2099-11-11" },
    ]),
    1,
  );
  assert.equal(count([stay], [{ ...stay, id: "mirror", bookingId: "one" }]), 1);
  assert.equal(
    count(
      [{ ...stay, status: "cancelled" }],
      [{ ...stay, id: "mirror", bookingId: "one" }],
    ),
    2,
  );
  assert.equal(
    count([
      { ...stay, checkOut: "2099-11-11", assignedRoomIds: ["room-1"] },
      {
        ...stay,
        id: "two",
        checkIn: "2099-11-11",
        assignedRoomIds: ["room-2"],
      },
    ]),
    0,
  );
});
test("duplicate date ranges use checkout-exclusive intervals and include pending requests", () => {
  assert.equal(
    availability.dateRangesOverlap(stay, "2099-11-11", "2099-11-13"),
    true,
  );
  assert.equal(
    availability.dateRangesOverlap(stay, "2099-11-12", "2099-11-13"),
    false,
  );
  assert.equal(
    availability.dateRangesOverlap(
      { checkIn: "2099-11-10", checkOut: "2099-11-10", itemType: "service" },
      "2099-11-10",
      "2099-11-11",
    ),
    true,
  );
  assert.equal(
    availability.activeRequest({ status: "pending-payment-verification" }),
    true,
  );
  assert.equal(availability.activeRequest({ status: "cancelled" }), false);
  assert.equal(availability.activeRequest({}), true);
  assert.equal(Number.isNaN(availability.calendarDay("2026-02-30")), true);
});
const payment = {
  reference: "1234567890123",
  settings: {
    isEnabled: true,
    downPaymentPercent: 50,
    gcashNumber: "09171234567",
    accountName: "Resort",
  },
};
test("booking payment requires configured instructions and a reference number without an image", () => {
  assert.equal(manual.validManualPayment(payment, 10000), true);
  for (const change of [
    { reference: "" },
    { reference: "bad" },
    { settings: null },
    { settings: { ...payment.settings, isEnabled: false } },
    { settings: { ...payment.settings, downPaymentPercent: 0 } },
  ])
    assert.equal(
      manual.validManualPayment({ ...payment, ...change }, 10000),
      false,
    );
  assert.equal(manual.validManualPayment(payment, NaN), false);
});
test("payment references accept 10–20 digits and reject malformed values", () => {
  for (const value of ["1234567890", "12345678901234567890", " 1234567890123 "])
    assert.equal(reference.validPaymentReference(value), true);
  for (const value of [
    "",
    "123456789",
    "123456789012345678901",
    "GC1234567890",
    "12345-67890",
    "12345 67890",
  ])
    assert.equal(reference.validPaymentReference(value), false);
});

test("verification resend has a persistent cooldown, signs out temporary users and refreshes real Auth state", async () => {
  let time = 1_000_000,
    sent = 0,
    reloads = 0,
    tokenRefreshes = 0;
  const storage = new Map(),
    auth = { currentUser: null, app: { options: {} } },
    session = { currentUser: null };
  const user = {
    uid: "customer",
    emailVerified: false,
    reload: async () => {
      reloads++;
    },
    getIdToken: async (force) => {
      assert.equal(force, true);
      tokenRefreshes++;
    },
  };
  const service = compile(
    "src/app/services/emailVerification.ts",
    {
      "../components/firebase": { auth },
      "firebase/app": { getApps: () => [], initializeApp: () => ({}) },
      "firebase/auth": {
        getAuth: () => session,
        setPersistence: async () => {},
        inMemoryPersistence: {},
        sendEmailVerification: async () => {
          sent++;
        },
        signInWithEmailAndPassword: async (target) => {
          assert.equal(target, session);
          session.currentUser = user;
          return { user };
        },
        signOut: async (target) => {
          target.currentUser = null;
        },
      },
    },
    {
      Date: class extends Date {
        static now() {
          return time;
        }
      },
      localStorage: {
        getItem: (key) => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
      },
    },
  );
  await assert.rejects(service.requireVerifiedCustomer(), /log in/);
  await service.resendVerification("guest@example.invalid", "password");
  assert.equal(sent, 1);
  assert.equal(auth.currentUser, null);
  assert.equal(session.currentUser, null);
  assert.equal(service.verificationCooldown("GUEST@example.invalid"), 60);
  await assert.rejects(
    service.resendVerification("guest@example.invalid", "password"),
    /wait 60/,
  );
  time += 60000;
  auth.currentUser = user;
  await assert.rejects(service.requireVerifiedCustomer(), /verify your email/);
  user.emailVerified = true;
  assert.equal((await service.requireVerifiedCustomer()).uid, "customer");
  assert.ok(reloads >= 3);
  assert.equal(tokenRefreshes, 1);
});

for (const [code, expected] of [
  [null, "verified successfully"],
  ["auth/expired-action-code", "expired"],
  ["auth/invalid-action-code", "invalid or has already been used"],
]) {
  test(`email verification action handles ${code || "success"}`, async () => {
    const runtime = hooks();
    let applied = 0;
    const View = compile(
      "src/app/pages/VerifyEmail.tsx",
      {
        react: runtime.api,
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "react-router": {
          Link: "link",
          useSearchParams: () => [new URLSearchParams("oobCode=example")],
        },
        "../components/firebase": { auth: {} },
        "firebase/auth": {
          checkActionCode: async () => {
            if (code) throw { code };
            return { operation: "VERIFY_EMAIL" };
          },
          applyActionCode: async () => {
            applied++;
          },
        },
      },
      { URLSearchParams, window: { location: { search: "", pathname: "/" } } },
    ).default;
    runtime.reset();
    View();
    runtime.flush();
    await settle();
    runtime.reset();
    const rendered = nodes(View());
    assert.ok(
      rendered.some(
        (node) =>
          typeof node.props.children === "string" &&
          node.props.children.includes(expected),
      ),
    );
    assert.equal(applied, code ? 0 : 1);
    assert.equal(
      rendered.find((node) => node.type === "a").props.href,
      "/#/auth",
    );
  });
}
