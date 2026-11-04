import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks } from "./helpers/runtime.mjs";

function harness() {
  const runtime = hooks(),
    listeners = {},
    stopped = [];
  const useReviews = compile("src/hooks/usePublishedReviews.ts", {
    react: runtime.api,
    "../app/components/firebase": { customerDb: "customer", db: "admin" },
    "../app/utils/reviews": compile("src/app/utils/reviews.ts"),
    "firebase/firestore": {
      collection: (db, name) => ({ db, name }),
      query: (ref, condition) => ({ ...ref, condition }),
      where: (...args) => args,
      onSnapshot(ref, next, error) {
        listeners[ref.db] = { ref, next, error };
        return () => stopped.push(ref.db);
      },
    },
  }).usePublishedReviews;
  const render = () => {
    runtime.reset();
    const result = useReviews();
    runtime.flush();
    return result;
  };
  const emit = (source, rows) =>
    listeners[source].next({
      docs: rows.map(([id, data]) => ({ id, data: () => data })),
    });
  render();
  return { render, emit, listeners, stopped, cleanup: runtime.cleanup };
}

test("review feed combines published customer reviews with publicly displayed legacy admin feedback", () => {
  const h = harness();
  assert.deepEqual(h.listeners.customer.ref.condition, [
    "status",
    "==",
    "published",
  ]);
  h.emit("customer", [
    [
      "c1",
      {
        bookingId: "b1",
        rating: 5,
        status: "published",
        comment: "New review",
      },
    ],
  ]);
  assert.equal(h.render().loading, true);
  h.emit("admin", [
    ["a1", { rating: 4, comment: "Older feedback" }],
    ["a2", { rating: 3, status: "published" }],
    ["draft", { rating: 5, status: "pending" }],
    ["hidden", { rating: 5, status: "hidden" }],
  ]);
  const result = h.render();
  assert.equal(result.loading, false);
  assert.equal(result.reviews.length, 3);
  assert.ok(
    result.reviews.some((review) => review.comment === "Older feedback"),
  );
  assert.equal(
    result.reviews.some((review) =>
      ["pending", "hidden"].includes(review.status),
    ),
    false,
  );
  assert.equal(result.error, "");
  h.cleanup();
  assert.equal(h.stopped.length, 2);
});

test("source ID collisions are preserved while duplicate bookings are counted once", () => {
  const h = harness();
  h.emit("customer", [
    ["same", { rating: 5 }],
    ["b1", { bookingId: "b1", rating: 4 }],
  ]);
  h.emit("admin", [
    ["same", { rating: 2 }],
    ["old", { bookingId: "b1", rating: 1 }],
  ]);
  const result = h.render();
  assert.equal(result.reviews.length, 3);
  assert.equal(
    result.reviews.find((review) => review.bookingId === "b1").rating,
    4,
  );
  h.emit("admin", []);
  assert.equal(h.render().reviews.length, 2);
  h.cleanup();
});

test("one failed source cannot hide reviews from the other source, and late callbacks are ignored", () => {
  const h = harness();
  h.emit("customer", [["one", { rating: 5, status: "published" }]]);
  h.listeners.admin.error(Error("Unavailable"));
  assert.equal(h.render().reviews.length, 1);
  assert.equal(h.render().loading, false);
  assert.match(h.render().error, /Some reviews/);
  h.cleanup();
  h.emit("admin", [["late", { rating: 3 }]]);
  assert.equal(h.render().reviews.length, 1);
});
