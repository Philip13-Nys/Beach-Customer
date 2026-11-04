import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "./helpers/runtime.mjs";

const presentation = compile("src/app/utils/bookingPresentation.ts");
const policy = compile("src/app/utils/bookingPolicy.ts", {
  "./bookingPresentation": presentation,
});
const reviewUtils = compile("src/app/utils/reviews.ts");

function serviceHarness(booking = {}) {
  const auth = { currentUser: { uid: "customer", displayName: "Test Guest" } };
  const documents = new Map([
    [
      "Bookings/b1",
      {
        userId: "customer",
        status: "pending",
        checkIn: "2099-11-10",
        amountPaid: 5000,
        ...booking,
      },
    ],
  ]);
  const writes = [];
  let legacy = [],
    queue = Promise.resolve();
  const firestore = {
    collection: (db, name) => name,
    query: (base) => base,
    where: () => ({}),
    doc: (db, name, id) => `${name}/${id}`,
    getDocs: async () => ({
      docs: legacy.map((data) => ({ data: () => data })),
    }),
    serverTimestamp: () => "server-time",
    runTransaction(db, fn) {
      const work = queue.then(async () => {
        const staged = [];
        await fn({
          get: async (ref) => ({
            exists: () => documents.has(ref),
            data: () => documents.get(ref),
          }),
          update: (ref, data) => staged.push({ ref, data, update: true }),
          set: (ref, data) => staged.push({ ref, data, update: false }),
        });
        for (const write of staged) {
          documents.set(
            write.ref,
            write.update
              ? { ...documents.get(write.ref), ...write.data }
              : write.data,
          );
          writes.push(write);
        }
      });
      queue = work.catch(() => {});
      return work;
    },
  };
  const service = compile("src/app/services/customerBookings.ts", {
    "../components/firebase": { auth, customerDb: {} },
    "firebase/firestore": firestore,
    "../utils/bookingPolicy": policy,
    "../utils/bookingPresentation": presentation,
  });
  return {
    auth,
    documents,
    writes,
    service,
    legacy: (value) => {
      legacy = value;
    },
  };
}

test("cancellation eligibility depends on booking status, with no time cutoff", () => {
  for (const checkIn of [
    "2000-01-01",
    new Date().toISOString().slice(0, 10),
    "2099-11-10",
    "",
  ]) {
    assert.equal(policy.cancellationReason({ status: "pending", checkIn }), "");
    assert.equal(
      policy.cancellationReason({
        status: "confirmed",
        checkIn,
        itemType: "service",
      }),
      "",
    );
  }
  assert.match(
    policy.cancellationReason({ status: "checked-in" }),
    /Only pending/,
  );
});

test("cancellation preserves the booking and all financial fields", async () => {
  for (const fields of [
    { status: "pending" },
    { status: "confirmed" },
    { status: "confirmed", checkIn: "2000-01-01" },
    { status: "pending", checkIn: new Date().toISOString().slice(0, 10) },
  ]) {
    const h = serviceHarness({
      ...fields,
      totalPrice: 10000,
      paymentStatus: "partial",
    });
    await h.service.cancelCustomerBooking("b1");
    const saved = h.documents.get("Bookings/b1");
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.amountPaid, 5000);
    assert.equal(saved.totalPrice, 10000);
    assert.equal(saved.paymentStatus, "partial");
    assert.deepEqual(Object.keys(h.writes[0].data).sort(), [
      "cancelledAt",
      "status",
    ]);
  }
});

test("cancellation rejects another user's booking and non-cancellable states", async () => {
  for (const booking of [
    { userId: "other" },
    { status: "checked-in" },
    { status: "checked-out" },
    { status: "cancelled" },
    { status: "completed" },
  ]) {
    const h = serviceHarness(booking);
    await assert.rejects(h.service.cancelCustomerBooking("b1"));
    assert.equal(h.writes.length, 0);
  }
  const h = serviceHarness();
  h.auth.currentUser = null;
  await assert.rejects(h.service.cancelCustomerBooking("b1"), /log in/);
});

test("review submission requires an owned completed booking and valid separate fields", async () => {
  for (const booking of [
    { status: "pending" },
    { status: "confirmed" },
    { status: "completed", userId: "other" },
  ]) {
    const h = serviceHarness(booking);
    await assert.rejects(
      h.service.submitBookingReview("b1", 5, "Very nice stay"),
    );
    assert.equal(h.writes.length, 0);
  }
  const h = serviceHarness({ status: "checked-out", roomName: "Suite" });
  for (const rating of [0, 6, 1.5, NaN])
    await assert.rejects(
      h.service.submitBookingReview("b1", rating, "Nice stay"),
    );
  await assert.rejects(h.service.submitBookingReview("b1", 5, "x"));
  await h.service.submitBookingReview("b1", 4, "  Great service and food  ");
  const review = h.documents.get("reviews/b1");
  assert.equal(review.rating, 4);
  assert.equal(review.comment, "Great service and food");
  assert.equal(review.bookingId, "b1");
  assert.equal(review.userId, "customer");
});

test("canonical transactions reject simultaneous duplicates; legacy records also block resubmission", async () => {
  const h = serviceHarness({ status: "completed" });
  const results = await Promise.allSettled([
    h.service.submitBookingReview("b1", 5, "Great stay"),
    h.service.submitBookingReview("b1", 3, "Good stay"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(h.writes.length, 1);
  const legacy = serviceHarness({ status: "completed" });
  legacy.legacy([{ bookingId: "b1" }]);
  await assert.rejects(
    legacy.service.submitBookingReview("b1", 5, "Great stay"),
    /already reviewed/,
  );
  assert.equal(legacy.writes.length, 0);
});

test("review categories must match the fresh booking type and service reviews keep service/package metadata", async () => {
  for (const [booking, category] of [
    [{ status: "completed", roomName: "Suite" }, "service"],
    [
      { status: "completed", itemType: "service", serviceName: "Night Dive" },
      "room",
    ],
  ]) {
    const h = serviceHarness(booking);
    await assert.rejects(
      h.service.submitBookingReview("b1", 5, "Great experience", category),
      /matches your review category/,
    );
    assert.equal(h.writes.length, 0);
  }
  for (const kind of ["service", "package"]) {
    const h = serviceHarness({
      status: "completed",
      itemType: kind,
      itemId: "catalog-item",
      itemName: "Dive Trip",
    });
    await h.service.submitBookingReview("b1", 5, "Great experience", "service");
    const review = h.documents.get("reviews/b1");
    assert.equal(review.itemType, kind);
    assert.equal(review.itemId, "catalog-item");
    assert.equal(review.category, "service");
  }
});

test("overall ratings exclude duplicate bookings and invalid stars; edits and removals recalculate", () => {
  const reviews = [
    { id: "legacy", bookingId: "b1", rating: 1 },
    { id: "b1", bookingId: "b1", rating: 5 },
    { id: "b2", bookingId: "b2", rating: 3 },
    { id: "bad", rating: 9 },
  ];
  assert.equal(reviewUtils.reviewSummary(reviews).average, 4);
  assert.equal(reviewUtils.reviewSummary(reviews).count, 2);
  reviews[2].rating = 1;
  assert.equal(reviewUtils.reviewSummary(reviews).average, 3);
  assert.equal(
    reviewUtils.reviewSummary(reviews.filter((r) => r.bookingId !== "b2"))
      .average,
    5,
  );
  assert.equal(reviewUtils.reviewSummary([]).average, 0);
  assert.equal(
    reviewUtils.normalizeReview("old", { rating: 4, feedback: "Legacy text" })
      .comment,
    "Legacy text",
  );
});
