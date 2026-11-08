import test from "node:test";
import assert from "node:assert/strict";
import { compile, jsx, nodes, hooks } from "./helpers/runtime.mjs";
const r = compile("src/app/utils/activityAvailability.ts", {}, { Error });
const date = "2099-11-10";
const policy = {
  capacity: 3,
  capacityType: "units",
  participantsPerUnit: 5,
  durationMinutes: 60,
  opensAt: "08:00",
  closesAt: "10:00",
  days: [0, 1, 2, 3, 4, 5, 6],
};
const boat = {
  id: "boat",
  itemType: "service",
  name: "Banana boat",
  availability: policy,
};
const catalog = [boat];
const selection = (quantity = 1, participants = 5) => ({
  itemId: "boat",
  itemType: "service",
  bookingDate: date,
  bookingTime: "08:00",
  quantity,
  participants,
});
const booking = (id, quantity = 1, extra = {}) => ({
  ...selection(quantity),
  id,
  bookingType: "service",
  status: "confirmed",
  ...extra,
});
const count = (bookings) => r.occupiedActivities(catalog, bookings);

test("physical units are independent of participants and do not change pricing inputs", () => {
  const [request] = r.selectionReservations(selection(2, 8), catalog);
  assert.equal(request.quantity, 2);
  assert.equal(request.participants, 8);
  const session = r.activitySession(
    boat,
    date,
    "08:00",
    catalog,
    count([booking("one", 2, { participants: 8 })]),
  );
  assert.equal(session.total, 3);
  assert.equal(session.reserved, 2);
  assert.equal(session.remaining, 1);
  assert.throws(
    () =>
      r.assertActivityCapacity(
        r.selectionReservations(selection(2), catalog),
        catalog,
        count([booking("one", 2)]),
      ),
    /enough available places/,
  );
});

test("unit selections reject fractional/negative/missing quantities and excessive passengers", () => {
  for (const value of [0, -1, 1.5, NaN, undefined])
    assert.throws(
      () =>
        r.selectionReservations({ ...selection(), quantity: value }, catalog),
      /unit quantity/,
    );
  assert.throws(
    () => r.selectionReservations(selection(1, 6), catalog),
    /accommodate/,
  );
  assert.doesNotThrow(() => r.selectionReservations(selection(2, 6), catalog));
});

test("corrupt historical quantities cannot increase advertised availability", () => {
  for (const quantity of [-1, 0, 1.5, undefined]) {
    const occupied = [
      { ...r.selectionReservations(selection(), catalog)[0], quantity },
    ];
    assert.equal(
      r.activitySession(boat, date, "08:00", catalog, occupied).remaining,
      0,
    );
  }
});

test("legacy participant capacity remains unchanged when capacityType is absent", () => {
  const item = {
    ...boat,
    availability: { ...policy, capacityType: undefined },
  };
  const requests = r.selectionReservations(selection(99, 2), [item]);
  assert.equal(requests[0].quantity, undefined);
  assert.equal(
    r.activitySession(item, date, "08:00", [item], requests).remaining,
    1,
  );
});

test("packages ignore historical capacity/link fields and do not reserve equipment", () => {
  const pack = {
    id: "pack",
    itemType: "package",
    name: "Adventure",
    serviceIds: ["boat"],
    availability: { ...policy, capacityType: "participants", capacity: 20 },
  };
  const combined = [boat, pack];
  const requests = r.selectionReservations(
    { ...selection(), itemId: "pack", itemType: "package", participants: 6 },
    combined,
  );
  assert.equal(requests.length, 0);
  const used = r.selectionReservations(selection(2, 8), combined);
  assert.equal(r.activitySlots(pack, date).length, 0);
  assert.doesNotThrow(() => r.assertActivityCapacity(requests, combined, used));
});

test("reserved, processing and pending quantities remain separate; cancelled and completed activities release units", () => {
  const confirmed = booking("confirmed"),
    heldBooking = booking("held", 1, { status: "pending" }),
    pending = booking("pending", 3, { status: "pending" });
  const allocations = {
    customer_held: {
      state: "held",
      requests: r.selectionReservations(selection(), catalog),
    },
  };
  const bookings = [confirmed, heldBooking, pending];
  const occupied = r.occupiedActivities(catalog, bookings, allocations);
  const row = r.activitySession(boat, date, "08:00", catalog, occupied);
  assert.equal(row.reserved, 1);
  assert.equal(row.held, 1);
  assert.equal(row.remaining, 1);
  const pendingRows = r.activityAvailabilityRows(
    catalog,
    r.pendingActivityReservations(catalog, bookings, allocations),
    date,
  );
  assert.equal(pendingRows[0].reserved, 3);
  for (const status of ["cancelled", "completed", "checked-out"])
    assert.equal(
      r.activitySession(
        boat,
        date,
        "08:00",
        catalog,
        count([booking("closed", 3, { status })]),
      ).remaining,
      3,
    );
});

test("an in-flight edit protects old and proposed capacity without counting the same booking twice", () => {
  const old = r.selectionReservations(selection(3, 5), catalog),
    next = r.selectionReservations(selection(1, 5), catalog);
  const union = r.heldActivityReservations(old, next);
  assert.equal(
    r.activitySession(boat, date, "08:00", catalog, union).remaining,
    0,
  );
  const later = next.map((entry) => ({ ...entry, start: 540, end: 600 }));
  const both = r.heldActivityReservations(old, later);
  assert.equal(
    r.activitySession(boat, date, "08:00", catalog, both).remaining,
    0,
  );
  assert.equal(
    r.activitySession(boat, date, "09:00", catalog, both).remaining,
    2,
  );
  const occupied = r.occupiedActivities(catalog, [booking("editing", 3)], {
    customer_editing: {
      state: "held",
      requests: later,
      occupiedRequests: both,
    },
  });
  assert.equal(
    r.activitySession(boat, date, "08:00", catalog, occupied).held,
    3,
  );
});

test("configuration changes preserve future bookings and prevent unsafe mode/quantity changes", () => {
  assert.throws(
    () =>
      r.validateActivityPolicyChange(
        boat,
        { ...policy, capacityType: "participants" },
        catalog,
        [booking("future")],
        {},
      ),
    /Cannot change/,
  );
  assert.throws(
    () =>
      r.validateActivityPolicyChange(
        boat,
        { ...policy, capacityType: "participants" },
        catalog,
        [booking("pending", 1, { status: "pending" })],
        {},
      ),
    /Cannot change/,
  );
  assert.throws(
    () =>
      r.validateActivityPolicyChange(
        boat,
        { ...policy, capacity: 1 },
        catalog,
        [booking("future", 2)],
        {},
      ),
    /below 2/,
  );
  assert.throws(
    () =>
      r.validateActivityPolicyChange(
        boat,
        { ...policy, participantsPerUnit: 2 },
        catalog,
        [booking("future")],
        {},
      ),
    /too small/,
  );
  assert.doesNotThrow(() =>
    r.validateActivityPolicyChange(
      boat,
      { ...policy, capacity: 4 },
      catalog,
      [booking("future", 2)],
      {},
    ),
  );
  assert.doesNotThrow(() =>
    r.validateActivityPolicyChange(
      boat,
      { ...policy, capacityType: "participants" },
      catalog,
      [booking("old", 1, { status: "cancelled" })],
      {},
    ),
  );
});

test("sold-out dates are disabled while another stay date can still be selected", () => {
  const occupied = count([
    booking("first", 3),
    booking("second", 3, { bookingTime: "09:00" }),
  ]);
  assert.equal(
    r.hasAvailableActivitySession(boat, date, date, catalog, occupied),
    false,
  );
  assert.equal(
    r.hasAvailableActivitySession(boat, date, "2099-11-11", catalog, occupied),
    true,
  );
  assert.equal(
    r.hasAvailableActivitySession(boat, "invalid", date, catalog, occupied),
    false,
  );
});

test("unit picker emits quantity separately, preserves it across dates and disables insufficient sessions", () => {
  const Picker = compile("src/app/components/ActivitySchedulePicker.tsx", {
    "../utils/activityAvailability": r,
    "react/jsx-runtime": { jsx, jsxs: jsx },
  }).default;
  let changed;
  const tree = nodes(
    Picker({
      item: boat,
      value: { ...selection(2, 8) },
      onChange: (value) => (changed = value),
      catalog,
      occupied: count([booking("one", 2)]),
      minDate: date,
    }),
  );
  assert.equal(
    tree.find((node) => node.type === "option" && node.props.value === "08:00")
      .props.disabled,
    true,
  );
  tree
    .find((node) => node.props["aria-label"] === "Banana boat units")
    .props.onChange({ target: { value: "3" } });
  assert.equal(changed.quantity, 3);
  assert.equal(changed.participants, 8);
  tree
    .find((node) => node.props["aria-label"] === "Banana boat date")
    .props.onChange({ target: { value: "2099-11-11" } });
  assert.equal(changed.quantity, 2);
  assert.equal(changed.bookingTime, "");
});

test("live availability board filters sessions and exports the same unit counts", () => {
  const h = hooks();
  let exported;
  const Panel = compile(
    "../Resort Management System/src/app/components/ServiceAvailabilityPanel.tsx",
    {
      react: h.api,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "react-router-dom": { Link: "a" },
      "../useActivityAvailability": {
        useActivityAvailability: () => ({
          catalog,
          occupied: count([booking("one", 2)]),
          bookings: [booking("one", 2)],
          allocations: {},
          loading: false,
          error: "",
        }),
      },
      "../activityAvailability": r,
      "../reportData": {
        toCsv: (rows) => rows,
        downloadFile: (rows) => (exported = rows),
      },
    },
  ).default;
  const render = () => {
    h.reset();
    return nodes(Panel({ exportable: true }));
  };
  let tree = render();
  tree
    .find((node) => node.props["aria-label"] === "Service availability date")
    .props.onChange({ target: { value: date } });
  tree = render();
  tree
    .find((node) => node.props["aria-label"] === "Service session filter")
    .props.onChange({ target: { value: "08:00" } });
  tree = render();
  tree
    .find(
      (node) =>
        node.type === "button" &&
        node.props.children === "Export availability CSV",
    )
    .props.onClick();
  assert.equal(exported.length, 2);
  assert.equal(exported[1][4], "units");
  assert.equal(exported[1][5], 3);
  assert.equal(exported[1][6], 2);
  assert.equal(exported[1][9], 1);
});

test("availability reports use a bounded fresh snapshot and preserve capacity units", async () => {
  let reads = 0;
  const api = compile(
    "../Resort Management System/src/app/reportData.ts",
    {
      "./activitySnapshot": {
        readActivitySnapshot: async () => {
          reads++;
          return {
            catalog,
            bookings: [],
            allocations: {},
            occupied: count([booking("one", 2)]),
          };
        },
      },
      "./activityAvailability": r,
      "./bookingAvailability": { localDate: () => date },
      "firebase/firestore": {},
      "./firebase": {},
      "./bookingStore": {},
    },
    { Error },
  );
  const rows = await api.reportRows("Service Availability", date, date);
  assert.equal(reads, 1);
  assert.equal(rows[1][4], "units");
  assert.equal(rows[1][5], 3);
  assert.equal(rows[1][6], 2);
  assert.equal(rows[1][9], 1);
  await assert.rejects(
    api.reportRows("Service Availability", date, "2100-01-01"),
    /up to 31 days/,
  );
});

test("live inventory updates quantities on booking cancellation and manager changes without a refresh", () => {
  const h = hooks(),
    listeners = new Map();
  let stopped = 0;
  const sources = { db: "admin", customerDb: "customer" };
  const sdk = {
    collection: (db, name) => db + ":" + name,
    doc: (db, name, id) => db + ":" + name + "/" + id,
    onSnapshot: (ref, next, error) => {
      listeners.set(ref, { next, error });
      return () => stopped++;
    },
  };
  const combine = compile("src/app/services/activityBookings.ts", {
    "firebase/firestore": sdk,
    "../components/firebase": sources,
    "../utils/activityAvailability": r,
  }).combineActivityInventory;
  const hook = compile("src/hooks/useActivityAvailability.ts", {
    react: h.api,
    "firebase/firestore": sdk,
    "../app/components/firebase": sources,
    "../app/services/activityBookings": { combineActivityInventory: combine },
    "../app/utils/activityAvailability": r,
  }).useActivityAvailability;
  const render = () => {
    h.reset();
    return hook();
  };
  const emit = (ref, records) =>
    listeners
      .get(ref)
      .next({
        docs: records.map(({ id, ...data }) => ({ id, data: () => data })),
      });
  render();
  h.flush();
  emit("admin:services", [boat]);
  emit("admin:packages", []);
  emit("customer:Bookings", [booking("live", 2)]);
  emit("admin:reservations", []);
  listeners
    .get("admin:BookingLocks/activityInventory")
    .next({ data: () => ({ allocations: {} }) });
  let state = render();
  assert.equal(state.loading, false);
  assert.equal(
    r.activitySession(
      state.catalog[0],
      date,
      "08:00",
      state.catalog,
      state.occupied,
    ).remaining,
    1,
  );
  emit("customer:Bookings", [booking("live", 2, { status: "cancelled" })]);
  state = render();
  assert.equal(
    r.activitySession(
      state.catalog[0],
      date,
      "08:00",
      state.catalog,
      state.occupied,
    ).remaining,
    3,
  );
  emit("admin:services", [
    { ...boat, availability: { ...policy, capacity: 4 } },
  ]);
  state = render();
  assert.equal(
    r.activitySession(
      state.catalog[0],
      date,
      "08:00",
      state.catalog,
      state.occupied,
    ).remaining,
    4,
  );
  listeners.get("admin:services").error(Error("permission denied"));
  assert.match(render().error, /Unable to verify/);
  h.cleanup();
  assert.equal(stopped, 5);
});
