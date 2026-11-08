import test from "node:test";
import assert from "node:assert/strict";
import { compile, jsx } from "./helpers/runtime.mjs";

const rules = compile("src/app/utils/activityAvailability.ts");
const date = "2099-11-10",
  last = "2099-11-11";
const service = {
  id: "snorkel",
  itemType: "service",
  name: "Snorkeling",
  availability: {
    capacity: 4,
    opensAt: "08:00",
    closesAt: "10:00",
    durationMinutes: 60,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
};
const reserved = (date, start, participants) => ({
  resourceKey: "service:snorkel",
  date,
  start,
  end: start + 60,
  participants,
});
const Component = compile("src/app/components/ServiceAddOnAvailability.tsx", {
  "../utils/activityAvailability": rules,
  "react/jsx-runtime": { jsx, jsxs: jsx },
}).default;
const props = {
  item: service,
  firstDate: date,
  lastDate: last,
  catalog: [service],
  occupied: [],
  loading: false,
  error: "",
};
const content = (value) =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(content).join(" ")
      : value && typeof value === "object"
        ? content(value.props?.children)
        : "";

test("stay summary shows the best individual session instead of summing capacity across dates", () => {
  const occupied = [
    reserved(date, 480, 3),
    reserved(date, 540, 4),
    reserved(last, 480, 2),
    reserved(last, 540, 3),
  ];
  const best = rules.activityStayAvailability(
    service,
    date,
    last,
    [service],
    occupied,
  );
  assert.equal(best.remaining, 2);
  assert.equal(best.total, 4);
  assert.equal(best.date, last);
  assert.equal(best.time, "08:00");
  const text = content(Component({ ...props, occupied }));
  assert.match(text, /Up to 2 of 4 participant slots available per session/);
  assert.match(text, /Best availability: 2099-11-11/);
});

test("selected session shows exact equipment quantity and follows live inventory updates", () => {
  const item = {
    ...service,
    availability: {
      ...service.availability,
      capacityType: "units",
      participantsPerUnit: 2,
    },
  };
  const selected = { bookingDate: date, bookingTime: "08:00" };
  const occupied = [
    { ...reserved(date, 480, 4), quantity: 2, capacityType: "units" },
  ];
  const current = { ...props, item, catalog: [item], selected, occupied };
  assert.match(content(Component(current)), /2 of 4 units available/);
  assert.match(content(Component(current)), /Selected: 2099-11-10/);
  assert.doesNotMatch(content(Component(current)), /Up to/);
  assert.match(
    content(Component({ ...current, occupied: [] })),
    /4 of 4 units available/,
  );
});

test("sold-out sessions, passed dates and invalid stay dates have distinct messages", () => {
  const occupied = [reserved(date, 480, 4), reserved(date, 540, 4)];
  assert.match(
    content(Component({ ...props, lastDate: date, occupied })),
    /0 of 4 participant slots available per session · Fully booked/,
  );
  assert.match(
    content(
      Component({ ...props, firstDate: "2000-11-10", lastDate: "2000-11-10" }),
    ),
    /No remaining sessions/,
  );
  assert.match(
    content(Component({ ...props, firstDate: "" })),
    /Choose stay dates/,
  );
  assert.match(
    content(
      Component({
        ...props,
        selected: { bookingDate: "2099-11-12", bookingTime: "08:00" },
      }),
    ),
    /within your stay/,
  );
});

test("loading/read errors do not display stale available quantities and packages have no inventory badge", () => {
  assert.match(
    content(Component({ ...props, loading: true })),
    /Checking service availability/,
  );
  const text = content(Component({ ...props, error: "permission-denied" }));
  assert.match(text, /Unable to check/);
  assert.doesNotMatch(text, /4 of 4/);
  assert.match(
    content(
      Component({ ...props, item: { ...service, availability: undefined } }),
    ),
    /Schedule not configured/,
  );
  assert.equal(
    Component({ ...props, item: { id: "package", itemType: "package" } }),
    null,
  );
});
