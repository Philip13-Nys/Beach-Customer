import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes } from "./helpers/runtime.mjs";

const rules = compile("src/app/utils/activityAvailability.ts", {}, { Error });
const date = "2099-11-10";
const policy = {
  capacity: 5,
  opensAt: "08:00",
  closesAt: "12:00",
  durationMinutes: 60,
  days: [0, 1, 2, 3, 4, 5, 6],
};
const service = {
  id: "snorkel",
  itemType: "service",
  name: "Snorkeling",
  price: 1000,
  status: "active",
  availability: policy,
};
const bundle = {
  id: "bundle",
  itemType: "package",
  name: "Sea package",
  serviceIds: ["snorkel"],
  availability: { ...policy, capacity: 8, durationMinutes: 120 },
};
const catalog = [service, bundle];
const selection = (
  participants = 1,
  bookingTime = "08:00",
  itemId = "snorkel",
  itemType = "service",
) => ({ itemId, itemType, participants, bookingDate: date, bookingTime });
const booked = (id, participants, bookingTime = "08:00", extra = {}) => ({
  id,
  _bookingStore: "customer",
  status: "confirmed",
  bookingType: "service",
  ...selection(participants, bookingTime),
  ...extra,
});

test("sessions respect hours, weekdays, duration and Philippine start times", () => {
  assert.deepEqual(
    [...rules.activitySlots(service, date)],
    ["08:00", "09:00", "10:00", "11:00"],
  );
  assert.equal(
    rules.activitySession(service, date, "08:00", catalog, []).remaining,
    5,
  );
  assert.equal(
    rules.activitySession(service, date, "08:30", catalog, []).remaining,
    0,
  );
  assert.equal(
    rules.activitySession(service, date, "12:00", catalog, []).remaining,
    0,
  );
  assert.equal(
    rules.activitySession(
      service,
      date,
      "08:00",
      catalog,
      [],
      Date.parse(date + "T08:00:00+08:00"),
    ).remaining,
    0,
  );
  const closed = {
    ...service,
    availability: { ...policy, days: [(new Date(date).getUTCDay() + 1) % 7] },
  };
  assert.equal(rules.activitySlots(closed, date).length, 0);
  assert.equal(rules.activityMinutes("8:00 AM"), 480);
  assert.equal(rules.activityMinutes("12:00 PM"), 720);
  assert.equal(
    rules.activityPolicy({
      ...service,
      availability: { ...policy, capacity: 1.5 },
    }),
    null,
  );
});

test("confirmed online and walk-in participants share capacity; pending/cancelled requests do not", () => {
  const bookings = [
    booked("online", 2),
    booked("walkin", 1, "08:00", { _bookingStore: "staff" }),
    booked("pending", 100, "08:00", { status: "pending" }),
    booked("cancelled", 100, "08:00", { status: "cancelled" }),
  ];
  const occupied = rules.occupiedActivities(catalog, bookings);
  assert.equal(
    rules.activitySession(service, date, "08:00", catalog, occupied).remaining,
    2,
  );
  assert.equal(
    rules.activitySession(service, date, "09:00", catalog, occupied).remaining,
    5,
  );
  assert.throws(
    () =>
      rules.assertActivityCapacity(
        rules.selectionReservations(selection(3), catalog),
        catalog,
        occupied,
      ),
    /enough available places/,
  );
});

test("packages allocate no timed inventory while standalone add-ons still validate capacity and dates", () => {
  assert.equal(rules.activitySlots(bundle, date).length, 0);
  const combined = [
    ...rules.selectionReservations(
      selection(4, "08:00", "bundle", "package"),
      catalog,
    ),
    ...rules.selectionReservations(selection(2), catalog),
  ];
  assert.equal(combined.length, 1);
  assert.doesNotThrow(() =>
    rules.assertActivityCapacity(combined, catalog, []),
  );
  const room = {
    checkIn: date,
    checkOut: "2099-11-12",
    addOns: [
      {
        id: "snorkel",
        type: "service",
        bookingDate: date,
        bookingTime: "10:00",
        participants: 2,
      },
    ],
  };
  assert.equal(
    rules.bookingActivityReservations(room, catalog)[0].participants,
    2,
  );
  assert.throws(
    () =>
      rules.bookingActivityReservations(
        { ...room, checkOut: "2099-11-09" },
        catalog,
      ),
    /within the room stay/,
  );
});

test("shared holds count immediately, avoid duplicate counts and release on cancellation", () => {
  const requests = rules.selectionReservations(selection(3), catalog);
  const allocations = { customer_online: { requests, state: "held" } };
  const booking = booked("online", 3, "08:00", { status: "pending" });
  assert.equal(
    rules.activitySession(
      service,
      date,
      "08:00",
      catalog,
      rules.occupiedActivities(catalog, [booking], allocations),
    ).remaining,
    2,
  );
  assert.equal(
    rules.activitySession(
      service,
      date,
      "08:00",
      catalog,
      rules.occupiedActivities(
        catalog,
        [{ ...booking, status: "confirmed" }],
        allocations,
      ),
    ).remaining,
    2,
  );
  assert.equal(
    rules.activitySession(
      service,
      date,
      "08:00",
      catalog,
      rules.occupiedActivities(
        catalog,
        [{ ...booking, status: "cancelled" }],
        allocations,
      ),
    ).remaining,
    5,
  );
  assert.equal(
    rules.occupiedActivities(catalog, [booking], allocations, "customer_online")
      .length,
    0,
  );
  const walkin = booked("walkin", 3, "08:00", { _bookingStore: "staff" });
  const merged = rules.mergeActivityBookings([], [walkin]);
  assert.equal(merged[0].id, "walkin");
  assert.equal(
    rules.activitySession(
      service,
      date,
      "08:00",
      catalog,
      rules.occupiedActivities(catalog, merged, {
        staff_walkin: { requests, state: "confirmed" },
      }),
    ).remaining,
    2,
  );
});

test("departure-day room add-ons remain reserved; unscheduled legacy bookings block conservatively", () => {
  const room = {
    id: "room",
    status: "checked-out",
    checkIn: date,
    checkOut: "2099-11-11",
    addOns: [
      {
        id: "snorkel",
        type: "service",
        bookingDate: "2099-11-11",
        bookingTime: "10:00",
        participants: 2,
      },
    ],
  };
  const occupied = rules.occupiedActivities(catalog, [room]);
  assert.equal(
    rules.activitySession(service, "2099-11-11", "10:00", catalog, occupied)
      .remaining,
    3,
  );
  const legacy = rules.occupiedActivities(catalog, [booked("legacy", 3, "")]);
  assert.equal(
    rules.activitySession(service, date, "11:00", catalog, legacy).remaining,
    2,
  );
});

test("overlapping reservations count peak usage rather than summing non-overlapping sessions", () => {
  const occupied = rules.occupiedActivities(catalog, [
    booked("first", 3),
    booked("second", 3, "09:00"),
  ]);
  const longer = {
    ...service,
    availability: { ...policy, durationMinutes: 120 },
  };
  assert.equal(
    rules.activitySession(longer, date, "08:00", [longer], occupied).remaining,
    2,
  );
  assert.doesNotThrow(() =>
    rules.assertActivityCapacity(
      rules.selectionReservations(selection(2), [longer]),
      [longer],
      occupied,
    ),
  );
});

test("manager policy parsing rejects missing, fractional and malformed configuration", () => {
  const input = {
    activityCapacity: "5",
    activityDuration: "60",
    activityOpensAt: "08:00",
    activityClosesAt: "12:00",
  };
  const parse = (changes) =>
    rules.readActivityPolicy({
      get: (key) => ({ ...input, ...changes })[key],
      getAll: () => ["0", "1", "2", "3", "4", "5", "6"],
    });
  assert.equal(parse({}).capacity, 5);
  for (const change of [
    { activityCapacity: "" },
    { activityCapacity: "2.5" },
    { activityDuration: "9999" },
    { activityOpensAt: "14:00" },
  ])
    assert.throws(() => parse(change), /participant capacity/);
});

test("activity schedule picker disables sold-out sessions and exposes the selected session's remaining places", () => {
  const picker = compile("src/app/components/ActivitySchedulePicker.tsx", {
    "../utils/activityAvailability": rules,
    "react/jsx-runtime": { jsx, jsxs: jsx },
  }).default;
  const tree = nodes(
    picker({
      item: service,
      catalog,
      occupied: rules.occupiedActivities(catalog, [booked("full", 5)]),
      loading: false,
      error: "",
      minDate: date,
      value: { bookingDate: date, bookingTime: "08:00", participants: 1 },
      onChange() {},
    }),
  );
  assert.equal(
    tree.find((node) => node.type === "option" && node.props.value === "08:00")
      .props.disabled,
    true,
  );
  assert.equal(
    tree.find((node) => node.type === "option" && node.props.value === "09:00")
      .props.disabled,
    false,
  );
  assert.ok(
    tree.some(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.includes("0 of 5 available"),
    ),
  );
});
