import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes } from "./helpers/runtime.mjs";
const rules = compile("src/app/utils/activityAvailability.ts", {}, { Error });
const date = "2099-11-10";
const service = {
  id: "boat",
  name: "Boat",
  itemType: "service",
  price: 100,
  status: "active",
  availability: {
    capacity: 5,
    durationMinutes: 60,
    opensAt: "08:00",
    closesAt: "10:00",
    days: [0, 1, 2, 3, 4, 5, 6],
  },
};
const pack = {
  id: "family",
  name: "Family package",
  itemType: "package",
  packagePrice: 50,
  status: "active",
  serviceIds: ["boat"],
  availability: { ...service.availability, capacity: 0 },
};
const catalog = [service, pack];
const packageBooking = {
  id: "package",
  bookingType: "package",
  itemType: "package",
  itemId: "family",
  bookingDate: date,
  checkIn: date,
  checkOut: date,
  participants: 3,
  status: "confirmed",
};
const serviceRequest = {
  resourceKey: "service:boat",
  date,
  start: 480,
  end: 540,
  participants: 2,
};
const oldRequests = [
  { ...serviceRequest, resourceKey: "package:family", participants: 3 },
  { ...serviceRequest, participants: 3 },
];

test("package preflight validates the catalog without reading service capacity or locks", async () => {
  const reads = [];
  const { checkActivityBooking } = compile(
    "src/app/services/activityBookings.ts",
    {
      "firebase/firestore": {
        collection: (_db, name) => name,
        getDocsFromServer: async (ref) => {
          reads.push(ref);
          return { docs: [{ id: pack.id, data: () => pack }] };
        },
      },
      "../components/firebase": { db: {}, customerDb: {} },
      "../utils/activityAvailability": rules,
    },
    { Error },
  );
  assert.equal((await checkActivityBooking(packageBooking)).length, 0);
  assert.deepEqual(reads, ["packages"]);
});

test("packages need no time, configured schedule or capacity and create no allocations", () => {
  assert.equal(
    rules.bookingActivityReservations(packageBooking, catalog).length,
    0,
  );
  assert.equal(
    rules.bookingActivityReservations({ ...packageBooking, itemId: "bare" }, [
      { id: "bare", itemType: "package", name: "Bare package" },
    ]).length,
    0,
  );
  assert.equal(rules.activitySlots(pack, date).length, 0);
  assert.throws(
    () =>
      rules.bookingActivityReservations(
        { ...packageBooking, participants: 1.5 },
        catalog,
      ),
    /whole number/,
  );
});
test("old package snapshots and known package holds no longer consume service inventory", () => {
  const booking = { ...packageBooking, activityReservations: oldRequests };
  const occupied = rules.occupiedActivities(catalog, [booking], {
    customer_package: { requests: oldRequests, state: "confirmed" },
  });
  assert.equal(occupied.length, 0);
  assert.equal(
    rules.activitySession(service, date, "08:00", catalog, occupied).remaining,
    5,
  );
});
test("mixed room bookings retain separately selected service reservations without package allocations", () => {
  const room = {
    id: "mixed",
    status: "confirmed",
    checkIn: date,
    checkOut: "2099-11-12",
    addOns: [
      { id: "family", type: "package", participants: 3 },
      {
        id: "boat",
        type: "service",
        bookingDate: date,
        bookingTime: "08:00",
        participants: 2,
      },
    ],
    activityReservations: [...oldRequests, serviceRequest],
  };
  const occupied = rules.occupiedActivities(catalog, [room], {
    customer_mixed: { requests: room.activityReservations, state: "confirmed" },
  });
  assert.equal(occupied.length, 1);
  assert.equal(occupied[0].participants, 2);
  assert.equal(
    rules.activitySession(service, date, "08:00", catalog, occupied).remaining,
    3,
  );
  assert.equal(
    rules.bookingActivityReservations(
      { ...room, addOns: [room.addOns[0]] },
      catalog,
    ).length,
    0,
  );
});
test("package fields show only date and participants and discard obsolete time/unit values", () => {
  const Fields = compile("src/app/components/PackageBookingFields.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
  }).default;
  let changed;
  const props = {
    name: "Family",
    value: {
      bookingDate: date,
      bookingTime: "08:00",
      quantity: 99,
      participants: 2,
    },
    minDate: date,
    onChange: (value) => (changed = value),
  };
  const tree = nodes(Fields(props));
  assert.equal(tree.filter((node) => node.type === "input").length, 2);
  assert.equal(
    tree.some((node) => node.type === "select" || node.props.type === "time"),
    false,
  );
  tree
    .find((node) => node.props["aria-label"] === "Family participants")
    .props.onChange({ target: { value: "3" } });
  assert.equal(changed.participants, 3);
  assert.equal(changed.bookingTime, "");
  assert.equal(changed.quantity, undefined);
  assert.equal(
    nodes(Fields({ ...props, showDate: false })).filter(
      (node) => node.type === "input",
    ).length,
    1,
  );
});
test("customer package dialog and submission work without a session even with old zero capacity", async () => {
  const h = hooks(),
    saved = [];
  const inventory = {
    catalog: [pack],
    occupied: [],
    loading: false,
    error: "",
  };
  const Page = compile(
    "src/app/pages/Services.tsx",
    {
      react: h.api,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "lucide-react": {},
      "../../hooks/useActivityAvailability": {
        useActivityAvailability: () => inventory,
      },
      "../utils/activityAvailability": rules,
      "../components/ActivitySchedulePicker": {
        __esModule: true,
        default: "service-picker",
      },
      "../components/PackageBookingFields": {
        __esModule: true,
        default: "package-fields",
      },
      "../../hooks/useActivityReviews": {
        useActivityReviews: () => ({ reviews: [], loading: false, error: "" }),
      },
      "../utils/bookingPresentation": { activityRating: () => ({}) },
      "../components/ActivityRating": { ActivityRating: "ratings" },
      "../../hooks/useAsyncAction": {
        useAsyncAction: () => ({ pending: false, run: (fn) => fn() }),
      },
      "../components/BookingPayment": {
        default: "payment",
        emptyManualPayment: () => ({ reference: "1234567890" }),
        validManualPayment: () => true,
      },
      "../services/bookingRequests": {
        requestKey: () => "package-request",
        submitBookingRequest: async (id, data) => {
          saved.push(data);
          return id;
        },
      },
      "react-router": { useNavigate: () => () => {} },
      "../context/AppContext": {
        useApp: () => ({ user: { uid: "customer" } }),
      },
      "../components/firebase": {
        auth: {
          currentUser: { uid: "customer", email: "test@example.invalid" },
        },
      },
    },
    { Error },
  ).default;
  const render = () => {
    h.reset();
    const tree = nodes(Page());
    h.flush();
    return tree;
  };
  render();
  let tree = render();
  const details = tree.find(
    (node) =>
      node.type === "button" &&
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).some(
        (child) => typeof child === "string" && child.trim() === "View Details",
      ),
  );
  assert.equal(details.props.disabled, false);
  details.props.onClick();
  tree = render();
  assert.ok(tree.some((node) => node.type === "package-fields"));
  assert.equal(
    tree.some((node) => node.type === "service-picker"),
    false,
  );
  const fields = tree.find((node) => node.type === "package-fields");
  fields.props.onChange({
    bookingDate: date,
    bookingTime: "",
    participants: 3,
  });
  tree = render();
  const submit = tree.find(
    (node) => node.type === "button" && node.props["aria-busy"] === false,
  );
  assert.equal(submit.props.disabled, false);
  await submit.props.onClick();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].bookingTime, "");
  assert.equal(saved[0].quantity, undefined);
  assert.equal(saved[0].totalPrice, 150);
});
