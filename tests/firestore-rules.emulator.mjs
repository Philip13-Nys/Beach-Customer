import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  setLogLevel,
} from "firebase/firestore";

// Deliberately refuse all non-local endpoints and use a demo project, never production.
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787") {
  throw Error(
    "Start the local emulator and set FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 before running this file.",
  );
}
const projectId = "demo-customer-fixes";
const base = `http://127.0.0.1:8787/v1/projects/${projectId}/databases/(default)/documents`;
const rules = await fetch(
  `http://127.0.0.1:8787/emulator/v1/projects/${projectId}:securityRules`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      rules: {
        files: [
          {
            name: "firestore.rules",
            content: readFileSync(
              new URL("../firestore.rules", import.meta.url),
              "utf8",
            ),
          },
        ],
      },
    }),
  },
);
assert.ok(rules.ok, `Rules did not compile: ${await rules.text()}`);
const reset = await fetch(
  `http://127.0.0.1:8787/emulator/v1/projects/${projectId}/databases/(default)/documents`,
  {
    method: "DELETE",
    headers: { Authorization: "Bearer owner" },
    signal: AbortSignal.timeout(10000),
  },
);
assert.ok(reset.ok, "Could not reset disposable emulator fixtures.");
setLogLevel("silent");
const apps = [];
function client(uid, role) {
  const app = initializeApp(
    { projectId, apiKey: "demo-key" },
    `rules-${apps.length}`,
  );
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(
    db,
    "127.0.0.1",
    8787,
    uid
      ? {
          mockUserToken: { sub: uid, user_id: uid, ...(role ? { role } : {}) },
        }
      : {},
  );
  return db;
}
after(async () => {
  await Promise.all(apps.map(deleteApp));
});
const customer = client("customer"),
  other = client("other"),
  guest = client();

async function seed(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "number"
        ? { integerValue: String(value) }
        : typeof value === "boolean"
          ? { booleanValue: value }
          : { stringValue: value },
    ]),
  );
  const result = await fetch(`${base}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ fields }),
  });
  assert.ok(result.ok, `Could not seed ${path}: ${await result.text()}`);
}
const booking = {
  userId: "customer",
  status: "pending",
  checkIn: "2099-11-10",
  amountPaid: 5000,
  totalPrice: 10000,
  paymentStatus: "partial",
};
const denied = (work) =>
  assert.rejects(work, (error) => error.code === "permission-denied");

test("rules: private chat is owner-only and stored messages cannot be silently rewritten", async () => {
  const path = "Users/customer/chatSessions/session";
  await setDoc(doc(customer, path), {
    title: "Conversation",
    createdAt: 1,
    updatedAt: 2,
  });
  const message = {
    id: "message",
    role: "user",
    text: "Private question",
    createdAt: 1,
    timestamp: "12:00 PM",
  };
  await setDoc(doc(customer, `${path}/messages/message`), message);
  await setDoc(doc(customer, `${path}/messages/message`), message);
  assert.equal(
    (await getDoc(doc(customer, `${path}/messages/message`))).data().text,
    "Private question",
  );
  await denied(() => getDoc(doc(other, `${path}/messages/message`)));
  await denied(() => getDoc(doc(guest, path)));
  await denied(() =>
    updateDoc(doc(customer, `${path}/messages/message`), {
      text: "Overwritten",
    }),
  );
});

test("rules: owners can cancel pending/confirmed rooms and activities without changing financial data", async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (const [id, extra] of [
    ["pending", {}],
    ["confirmed", { status: "confirmed" }],
    ["past-date", { checkIn: "2000-01-01" }],
    ["near-start", { checkIn: tomorrow }],
    [
      "near-activity",
      { itemType: "service", bookingDate: tomorrow, bookingTime: "02:00 PM" },
    ],
    [
      "activity",
      {
        itemType: "service",
        bookingDate: "2099-11-10",
        bookingTime: "12:30 PM",
      },
    ],
  ]) {
    await seed(`Bookings/${id}`, { ...booking, ...extra });
    await updateDoc(doc(customer, "Bookings", id), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });
    const saved = (await getDoc(doc(customer, "Bookings", id))).data();
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.amountPaid, 5000);
  }
});

test("rules: cancellation rejects foreign ownership, completed stays and money changes", async () => {
  for (const [id, extra] of [
    ["foreign", { userId: "other" }],
    ["checked-in", { status: "checked-in" }],
    ["checked-out", { status: "checked-out" }],
    ["cancelled", { status: "cancelled" }],
  ]) {
    await seed(`Bookings/${id}`, { ...booking, ...extra });
    await denied(() =>
      updateDoc(doc(customer, "Bookings", id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      }),
    );
  }
  await seed("Bookings/money", booking);
  await denied(() =>
    updateDoc(doc(customer, "Bookings/money"), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      amountPaid: 0,
    }),
  );
  await denied(() =>
    updateDoc(doc(customer, "Bookings/money"), { status: "completed" }),
  );
  await denied(() =>
    updateDoc(doc(guest, "Bookings/money"), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    }),
  );
});

test("rules: verified review transactions can read an absent canonical document and submit once", async () => {
  await seed("Bookings/reviewable", { ...booking, status: "checked-out" });
  const ref = doc(customer, "reviews/reviewable");
  await runTransaction(customer, async (transaction) => {
    const saved = await transaction.get(ref);
    assert.equal(saved.exists(), false);
    transaction.set(ref, {
      bookingId: "reviewable",
      userId: "customer",
      rating: 5,
      comment: "Excellent stay",
      createdAt: serverTimestamp(),
      status: "published",
    });
  });
  assert.equal(
    (await getDoc(doc(guest, "reviews/reviewable"))).data().rating,
    5,
  );
  await denied(() =>
    setDoc(ref, {
      bookingId: "reviewable",
      userId: "customer",
      rating: 3,
      comment: "Duplicate review",
      createdAt: serverTimestamp(),
      status: "published",
    }),
  );
  await updateDoc(ref, {
    rating: 4,
    comment: "Updated feedback",
    updatedAt: serverTimestamp(),
  });
  const published = await getDocs(
    query(collection(guest, "reviews"), where("status", "==", "published")),
  );
  assert.ok(
    published.docs.some(
      (review) => review.id === "reviewable" && review.data().rating === 4,
    ),
  );
  const own = await getDocs(
    query(collection(customer, "reviews"), where("userId", "==", "customer")),
  );
  assert.ok(own.docs.some((review) => review.id === "reviewable"));
});

test("rules: review submissions reject guests, other owners, incomplete bookings and invalid stars", async () => {
  for (const [id, extra, db, rating] of [
    ["review-guest", { status: "completed" }, guest, 5],
    ["review-foreign", { status: "completed", userId: "other" }, customer, 5],
    ["review-pending", {}, customer, 5],
    ["review-invalid", { status: "completed" }, customer, 6],
  ]) {
    await seed(`Bookings/${id}`, { ...booking, ...extra });
    await denied(() =>
      setDoc(doc(db, "reviews", id), {
        bookingId: id,
        userId: "customer",
        rating,
        comment: "Written feedback",
        status: "published",
        createdAt: serverTimestamp(),
      }),
    );
  }
  await denied(() =>
    setDoc(doc(customer, "reviews/random-id"), {
      bookingId: "reviewable",
      userId: "customer",
      rating: 5,
      comment: "Duplicate review",
      status: "published",
      createdAt: serverTimestamp(),
    }),
  );
});

test("rules: existing booking creation, payment submission and inquiry queries remain authorized", async () => {
  await setDoc(doc(customer, "Bookings/new"), {
    ...booking,
    amountPaid: 0,
    paymentStatus: "unpaid",
  });
  await setDoc(doc(customer, "Payments/new"), {
    customerId: "customer",
    bookingId: "new",
    amount: 5000,
    status: "pending",
    verificationStatus: "pending",
  });
  await updateDoc(doc(customer, "Bookings/new"), {
    paymentStatus: "pending_verification",
    paymentRecordId: "new",
  });
  await setDoc(doc(customer, "Inquiries/new"), {
    userId: "customer",
    message: "Please help",
  });
  const own = await getDocs(
    query(collection(customer, "Inquiries"), where("userId", "==", "customer")),
  );
  assert.equal(own.size, 1);
  await denied(() => getDocs(collection(other, "Inquiries")));
});
