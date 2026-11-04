import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes } from "./helpers/runtime.mjs";

const presentation = compile("src/app/utils/bookingPresentation.ts");
const policy = compile("src/app/utils/bookingPolicy.ts", {
  "./bookingPresentation": presentation,
});
const summaries = compile("src/app/utils/reviews.ts");

function harness(user = null, authLoading = false) {
  const runtime = hooks(),
    listeners = {},
    submissions = [];
  const app = { user, authLoading };
  const publication = {
    reviews: [
      summaries.normalizeReview("b1", {
        rating: 5,
        comment: "Excellent stay",
        guestName: "Guest",
        bookingId: "b1",
      }),
    ],
    loading: false,
    error: "",
  };
  const Reviews = compile("src/app/pages/Reviews.tsx", {
    react: runtime.api,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../../hooks/useAsyncAction": compile("src/hooks/useAsyncAction.ts", {
      react: runtime.api,
    }),
    "../../hooks/usePublishedReviews": {
      usePublishedReviews: () => publication,
    },
    "../utils/reviews": summaries,
    "../utils/bookingPolicy": policy,
    "../utils/bookingPresentation": presentation,
    "../services/customerBookings": {
      submitBookingReview: async (...args) => submissions.push(args),
    },
    "../context/AppContext": { useApp: () => app },
    "react-router": { Link: "link" },
    "lucide-react": {},
    "../components/firebase": { customerDb: {} },
    "firebase/firestore": {
      collection: (db, name) => name,
      query: (base) => base,
      where: () => ({}),
      onSnapshot: (name, next) => {
        listeners[name] = next;
        return () => {};
      },
    },
  }).default;
  function render() {
    runtime.reset();
    const result = Reviews();
    runtime.flush();
    return nodes(result);
  }
  return { render, app, publication, listeners, submissions };
}
const hasText = (result, value) =>
  result.some((node) => node.props.children === value);
const categoryButton = (result, name) =>
  result.find((node) => node.type === "button" && node.props.children === name);

function loadBookings(h, bookings, reviewed = []) {
  h.listeners.Bookings({
    docs: bookings.map(([id, data]) => ({ id, data: () => data })),
  });
  h.listeners.reviews({
    docs: reviewed.map((bookingId) => ({ data: () => ({ bookingId }) })),
  });
}

test("guests can view individual reviews and overall rating; writing prompts login and preserves return path", () => {
  const h = harness();
  let result = h.render();
  assert.ok(hasText(result, "Excellent stay"));
  assert.ok(hasText(result, "Overall Resort Rating"));
  result
    .find(
      (node) =>
        node.type === "button" && node.props.children === "Write a Review",
    )
    .props.onClick();
  result = h.render();
  assert.ok(hasText(result, "Please log in to submit a review."));
  const login = result.find(
    (node) => node.type === "link" && node.props.to === "/auth",
  );
  assert.equal(login.props.state.returnTo, "/reviews");
  assert.equal(
    result.some((node) => node.type === "form"),
    false,
  );
  assert.equal(h.submissions.length, 0);
});

test("authentication initialization is shown as loading rather than as a guest", () => {
  const h = harness(null, true),
    result = h.render();
  assert.ok(hasText(result, "Loading your account..."));
  assert.equal(hasText(result, "Write a Review"), false);
  assert.ok(hasText(result, "Excellent stay"));
});

test("Reviews and Feedback renders every current and legacy review rather than a two-review preview", () => {
  const h = harness();
  h.publication.reviews = [
    "current-one",
    "current-two",
    "legacy-admin:one",
    "legacy-admin:two",
  ].map((id) =>
    summaries.normalizeReview(id, { rating: 4, comment: `Feedback ${id}` }),
  );
  const result = h.render();
  for (const review of h.publication.reviews)
    assert.ok(hasText(result, review.comment));
});

test("only completed unreviewed bookings appear and rating and feedback are passed separately", async () => {
  const h = harness({ id: "customer" });
  h.render();
  h.listeners.Bookings({
    docs: [
      {
        id: "pending",
        data: () => ({ status: "pending", roomName: "Pending Room" }),
      },
      {
        id: "done",
        data: () => ({
          status: "checked-out",
          roomName: "Suite",
          checkIn: "2026-10-01",
        }),
      },
    ],
  });
  h.listeners.reviews({ docs: [] });
  let result = h.render();
  assert.equal(result.filter((node) => node.type === "option").length, 1);
  assert.equal(
    result.find((node) => node.type === "option").props.value,
    "done",
  );
  result
    .find(
      (node) =>
        typeof node.type === "function" && node.type.name === "StarPicker",
    )
    .props.onChange(4);
  result
    .find((node) => node.type === "textarea")
    .props.onChange({ target: { value: "Lovely room and staff" } });
  result = h.render();
  await result
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  assert.equal(h.submissions[0][0], "done");
  assert.equal(h.submissions[0][1], 4);
  assert.equal(h.submissions[0][2], "Lovely room and staff");
  assert.ok(hasText(h.render(), "Thank you!"));
});

test("review edits and deletions update the separate overall summary without NaN", () => {
  const h = harness();
  const average = () =>
    h
      .render()
      .find(
        (node) =>
          node.type === "output" &&
          node.props["aria-label"] === "Overall resort rating",
      )?.props.children;
  assert.equal(average(), "5.0");
  h.publication.reviews[0].rating = 3;
  assert.equal(average(), "3.0");
  h.publication.reviews = [];
  assert.equal(average(), "—");
});

test("category changes show matching completed rooms, services and packages and reset stale booking choices", () => {
  const h = harness({ id: "customer" });
  h.render();
  loadBookings(
    h,
    [
      ["room", { status: "checked-out", roomName: "Deluxe Rooms" }],
      [
        "service",
        { status: "completed", itemType: "service", serviceName: "Night Dive" },
      ],
      [
        "package",
        {
          status: "finished",
          itemType: "package",
          packageName: "Island Package",
        },
      ],
      ["pending", { status: "pending", itemType: "service" }],
      ["reviewed", { status: "completed", itemType: "service" }],
    ],
    ["reviewed"],
  );
  let result = h.render();
  assert.deepEqual(
    result.filter((n) => n.type === "option").map((n) => n.props.value),
    ["room", "service", "package"],
  );
  categoryButton(result, "Service").props.onClick();
  result = h.render();
  assert.deepEqual(
    result.filter((n) => n.type === "option").map((n) => n.props.value),
    ["service", "package"],
  );
  assert.equal(result.find((n) => n.type === "select").props.value, "service");
  result
    .find((n) => n.type === "select")
    .props.onChange({ target: { value: "package" } });
  categoryButton(h.render(), "Room").props.onClick();
  result = h.render();
  assert.deepEqual(
    result.filter((n) => n.type === "option").map((n) => n.props.value),
    ["room"],
  );
  assert.equal(result.find((n) => n.type === "select").props.value, "room");
  categoryButton(result, "Service").props.onClick();
  assert.equal(
    h.render().find((n) => n.type === "select").props.value,
    "service",
  );
});

test("a missing service booking shows an explanation and lets the customer return to Room", () => {
  const h = harness({ id: "customer" });
  h.render();
  loadBookings(h, [["room", { status: "checked-out", roomName: "Suite" }]]);
  categoryButton(h.render(), "Service").props.onClick();
  let result = h.render();
  assert.equal(result.find((n) => n.type === "select").props.value, "");
  assert.equal(result.find((n) => n.type === "select").props.disabled, true);
  assert.ok(
    result.some(
      (n) =>
        n.type === "p" &&
        [n.props.children]
          .flat()
          .join("")
          .startsWith("No completed, unreviewed service or package"),
    ),
  );
  assert.equal(
    result.some((n) => n.type === "button" && n.props.type === "submit"),
    false,
  );
  categoryButton(result, "Room").props.onClick();
  result = h.render();
  assert.equal(result.find((n) => n.type === "select").props.value, "room");
  assert.ok(result.some((n) => n.type === "textarea"));
});

test("service review submission uses the selected package booking rather than a previously selected room", async () => {
  const h = harness({ id: "customer" });
  h.render();
  loadBookings(h, [
    ["room", { status: "checked-out", roomName: "Suite" }],
    [
      "package",
      { status: "completed", itemType: "package", packageName: "Dive Package" },
    ],
  ]);
  categoryButton(h.render(), "Service").props.onClick();
  let result = h.render();
  result
    .find((n) => typeof n.type === "function" && n.type.name === "StarPicker")
    .props.onChange(5);
  result
    .find((n) => n.type === "textarea")
    .props.onChange({ target: { value: "Excellent dive trip" } });
  result = h.render();
  await result
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.submissions[0], [
    "package",
    5,
    "Excellent dive trip",
    "service",
  ]);
});
