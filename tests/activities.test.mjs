import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { hooks, settle } from "./helpers/runtime.mjs";

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
  let reads = 0;
  const runtime = hooks();
  const legacy = { id: "old", bookingId: "activity-booking", roomName: "Resort Stay", status: "published", rating: 5 };
  const publication = { reviews: [legacy], loading: false, error: "" };
  const module = compile("../src/hooks/useActivityReviews.ts", {
    react: runtime.api,
    "./usePublishedReviews": { usePublishedReviews: () => publication },
    "../app/utils/bookingPresentation": helpers,
    "../app/components/firebase": { customerDb: {} },
    "firebase/firestore": {
      doc: (db, collection, id) => id,
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
    runtime.reset();
    const value = module.useActivityReviews();
    runtime.flush();
    return value;
  }
  render(); await settle();
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
  publication.reviews = [legacy]; render(); await settle();
  assert.equal(reads, 1, "Linked booking is cached");
  publication.reviews = [
      {
          id: "new",
          ...bookingReviewFields({
            itemType: "service",
            itemId: "s1",
            itemName: "Night Dive",
          }),
          status: "published",
          rating: 4,
      },
    ];
  render(); await settle();
  assert.equal(reads, 1, "New reviews need no booking lookup");
  result = render();
  assert.equal(
    activityRating({ id: "s1", name: "Night Dive" }, result.reviews).average,
    4,
  );
  runtime.cleanup();
});
