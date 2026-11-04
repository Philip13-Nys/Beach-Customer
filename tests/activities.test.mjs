import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

function compile(path, mocks = {}) {
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
      console: { error() {} },
      require: (name) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
    },
  );
  return module.exports;
}
const helpers = compile("../src/app/utils/bookingPresentation.ts");
const {
  bookingKind,
  bookingName,
  bookingStatusLabel,
  bookingReviewFields,
  activityRating,
} = helpers;

test("activity and package names take precedence over legacy Resort Stay labels", () => {
  assert.equal(
    bookingName({
      itemType: "service",
      itemName: "Snorkeling",
      roomName: "Resort Stay",
    }),
    "Snorkeling",
  );
  assert.equal(bookingName({ serviceName: "Night Dive" }), "Night Dive");
  assert.equal(
    bookingName({ packageId: "p1", packageName: "Island Package" }),
    "Island Package",
  );
  assert.equal(bookingName({ roomName: "Deluxe Room" }), "Deluxe Room");
  assert.equal(bookingKind({ bookingRef: "ACT-123" }), "service");
});

test("activity status wording changes without changing stored staff statuses", () => {
  for (const status of [
    "checked-in",
    "checked in",
    "checked_in",
    "checkedin",
  ]) {
    const booking = { itemType: "service", status };
    assert.equal(bookingStatusLabel(booking), "In Progress");
    assert.equal(booking.status, status);
  }
  for (const status of [
    "checked-out",
    "checked out",
    "checked_out",
    "completed",
  ]) {
    assert.equal(
      bookingStatusLabel({ bookingType: "package", status }),
      "Completed",
    );
  }
  assert.equal(
    bookingStatusLabel({ roomName: "Suite", status: "checked-in" }),
    "Checked-in",
  );
});

test("review metadata links activities to their catalog item and leaves room reviews separate", () => {
  const service = bookingReviewFields({
    itemType: "service",
    itemId: "s1",
    itemName: "Night Dive",
  });
  assert.equal(service.serviceId, "s1");
  assert.equal(service.serviceName, "Night Dive");
  assert.equal("roomName" in service, false);
  const pkg = bookingReviewFields({
    itemType: "package",
    itemId: "p1",
    itemName: "Dive Package",
  });
  assert.equal(pkg.packageId, "p1");
  assert.equal("serviceId" in pkg, false);
  assert.equal(
    bookingReviewFields({ roomId: "r1", roomName: "Suite" }).roomName,
    "Suite",
  );
});

test("ratings use only published valid reviews for the same activity type and ID", () => {
  const item = { id: "s1", name: "Night Dive", itemType: "service" };
  const review = {
    status: "published",
    itemType: "service",
    itemId: "s1",
    rating: 5,
  };
  const result = activityRating(item, [
    review,
    { ...review, rating: 3 },
    { ...review, itemId: "other", itemName: "Night Dive", rating: 1 },
    { ...review, itemType: "package", rating: 1 },
    { ...review, status: "hidden", rating: 1 },
    { ...review, rating: 9 },
    { ...review, rating: "invalid" },
    { status: "published", roomName: "Night Dive", rating: 1 },
  ]);
  assert.equal(result.count, 2);
  assert.equal(result.average, 4);
  assert.equal(activityRating(item, []).average, 0);
  assert.equal(
    activityRating(item, [
      { status: "published", serviceName: " night dive ", rating: 4 },
    ]).count,
    1,
  );
});

test("legacy activity reviews resolve through their booking without rewriting historical data", async () => {
  let next,
    reads = 0,
    stopped = false;
  const state = [],
    effects = [];
  let cursor = 0;
  const module = compile("../src/hooks/useActivityReviews.ts", {
    react: {
      useEffect: (effect) => effects.push(effect),
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [
          state[i],
          (value) => {
            state[i] = value;
          },
        ];
      },
    },
    "../app/utils/bookingPresentation": helpers,
    "../app/components/firebase": { customerDb: {} },
    "firebase/firestore": {
      collection: () => ({}),
      doc: (db, collection, id) => id,
      query: (base) => base,
      where: () => ({}),
      onSnapshot: (query, callback) => {
        next = callback;
        return () => {
          stopped = true;
        };
      },
      getDoc: async (id) => {
        reads++;
        assert.equal(id, "activity-booking");
        return {
          exists: () => true,
          data: () => ({
            itemType: "service",
            itemId: "s1",
            itemName: "Night Dive",
          }),
        };
      },
    },
  });
  function render() {
    cursor = 0;
    return module.useActivityReviews();
  }
  render();
  const cleanup = effects.shift()();
  const legacy = {
    bookingId: "activity-booking",
    roomName: "Resort Stay",
    status: "published",
    rating: 5,
  };
  const docs = [{ data: () => legacy }];
  await next({ docs });
  let result = render();
  assert.equal(result.loading, false);
  assert.equal(result.error, "");
  assert.equal(
    activityRating({ id: "s1", name: "Night Dive" }, result.reviews).count,
    1,
  );
  assert.equal(
    legacy.roomName,
    "Resort Stay",
    "Original record remains untouched",
  );
  await next({ docs });
  assert.equal(reads, 1, "Linked booking is cached");
  await next({
    docs: [
      {
        data: () => ({
          ...bookingReviewFields({
            itemType: "service",
            itemId: "s1",
            itemName: "Night Dive",
          }),
          status: "published",
          rating: 4,
        }),
      },
    ],
  });
  assert.equal(reads, 1, "New reviews need no booking lookup");
  result = render();
  assert.equal(
    activityRating({ id: "s1", name: "Night Dive" }, result.reviews).average,
    4,
  );
  cleanup();
  assert.equal(stopped, true);
});
