import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import * as firestore from "firebase/firestore";
import { compile } from "./helpers/runtime.mjs";
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
  writeBatch,
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
function client(uid, role, verified = true) {
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
          mockUserToken: { sub: uid, user_id: uid, email_verified: verified, ...(role ? { role } : {}) },
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
      value instanceof Date ? { timestampValue: value.toISOString() } : typeof value === "number"
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
  createdAt: new Date(Date.now() - 172800000),
};
const denied = (work) =>
  assert.rejects(work, (error) => error.code === "permission-denied");
async function cancelOwned(db, id, changes = {}, reason = "Our travel plans have changed.") {
  const batch = writeBatch(db);
  batch.update(doc(db, "Bookings", id), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledByUid: "customer", ...changes });
  batch.set(doc(db, "Users/customer/bookingCancellations", id), {
    bookingId: id, userId: "customer", cancellationReason: reason,
    cancelledAt: serverTimestamp(), cancelledByUid: "customer", cancelledBy: "customer",
  });
  await batch.commit();
}

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

test("rules: owners can cancel eligible rooms and activities after 24 hours without changing financial data", async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (const [id, extra] of [
    ["pending", {}],
    ["confirmed", { status: "confirmed" }],
    ["pending-payment-verification", { status: "pending-payment-verification" }],
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
    await cancelOwned(customer, id);
    const saved = (await getDoc(doc(customer, "Bookings", id))).data();
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.amountPaid, 5000);
    assert.equal("cancellationReason" in saved, false);
    const audit = doc(customer, "Users/customer/bookingCancellations", id);
    assert.equal((await getDoc(audit)).data().cancellationReason, "Our travel plans have changed.");
    await denied(() => getDoc(doc(other, "Users/customer/bookingCancellations", id)));
    await denied(() => getDoc(doc(guest, "Users/customer/bookingCancellations", id)));
    await denied(() => updateDoc(audit, { cancellationReason: "Overwritten reason" }));
  }
  const reviewer = client("audit-reviewer", "receptionist");
  assert.equal((await getDoc(doc(reviewer, "Users/customer/bookingCancellations/pending"))).data().cancellationReason, "Our travel plans have changed.");
});

test("rules: cancellation rejects foreign ownership, completed stays and money changes", async () => {
  for (const [id, extra] of [
    ["foreign", { userId: "other" }],
    ["checked-in", { status: "checked-in" }],
    ["checked-out", { status: "checked-out" }],
    ["cancelled", { status: "cancelled" }],
    ["too-early", { createdAt: new Date() }],
    ["past-date", { checkIn: "2000-01-01" }],
  ]) {
    await seed(`Bookings/${id}`, { ...booking, ...extra });
    await denied(() => cancelOwned(customer, id));
  }
  await seed("Bookings/money", booking);
  await denied(() =>
    cancelOwned(customer, "money", { amountPaid: 0 }),
  );
  await seed("Bookings/short-reason", booking);
  await denied(() => cancelOwned(customer, "short-reason", {}, " "));
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

const referenceUtils = compile("src/app/utils/paymentReference.ts");
const summaryUtils = compile("src/app/utils/payment.ts");
const paymentUtils = compile("src/app/utils/manualPayment.ts", { "./payment": summaryUtils, "./paymentReference": referenceUtils });
const availabilityUtils = compile("src/app/utils/availability.ts");
const paymentInput = { reference: "1234567890123", settings: { downPaymentPercent: 50, isEnabled: true, gcashNumber: "09171234567", accountName: "Resort" } };
function requestService(db, uid, bypassClientValidation = false) {
  // Keep FieldValue instances intact while adapting VM object literals to the
  // SDK's native-realm plain-object validation. All database work remains real.
  const nativeData = value => Array.isArray(value) ? value.map(nativeData)
    : value?.constructor?.name === "Object" ? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, nativeData(nested)])) : value;
  const sdk = { ...firestore, runTransaction: (store, callback) => firestore.runTransaction(store, tx => callback({
    get: ref => tx.get(ref), set: (ref, data) => tx.set(ref, nativeData(data)), update: (ref, data) => tx.update(ref, nativeData(data)),
  })) };
  return compile("src/app/services/bookingRequests.ts", {
    "./activityBookings": { checkActivityBooking: async () => [] },
    "firebase/firestore": sdk, "../components/firebase": { customerDb: db },
    "./emailVerification": { requireVerifiedCustomer: async () => ({ uid }) },
    "../utils/availability": availabilityUtils, "../utils/payment": summaryUtils,
    "../utils/manualPayment": bypassClientValidation ? { ...paymentUtils, validManualPayment: () => true } : paymentUtils,
    "../utils/registration": compile("src/app/utils/registration.ts"),
  });
}
const requestData = (uid, checkIn = "2099-11-10", checkOut = "2099-11-12") => ({ userId: uid, checkIn, checkOut, roomId: "suite", roomName: "Suite", roomCount: 1, guests: 2, nights: Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000), totalPrice: 10000, bookingRef: `${uid}-${checkIn}` });
test("rules and real transactions: reference-only requests atomically save an unpaid booking, payment and account revision", async () => {
  const db = client("request-owner"), service = requestService(db, "request-owner");
  await setDoc(doc(db, "Users/request-owner"), { phone: "+639171234567" });
  await service.submitBookingRequest("request-one", requestData("request-owner"), paymentInput);
  const data = (await getDoc(doc(db, "Bookings/request-one"))).data();
  assert.equal(data.status, "pending-payment-verification");
  assert.equal(data.amountPaid, 0); assert.equal(data.paymentStatus, "pending_verification");
  assert.equal(data.remainingBalance, 10000);
  const submitted = (await getDoc(doc(db, "Payments/deposit-request-one"))).data();
  assert.equal(submitted.referenceNumber, paymentInput.reference);
  assert.equal("proof" in submitted, false);
  assert.equal("proofOfPayment" in submitted, false);
  await denied(() => getDoc(doc(other, "Payments/deposit-request-one")));
  await denied(() => getDoc(doc(guest, "Payments/deposit-request-one")));
  await denied(() => updateDoc(doc(db, "Bookings/request-one"), { status: "confirmed", amountPaid: 5000 }));
  await denied(() => updateDoc(doc(db, "Bookings/request-one"), { totalPrice: 1 }));
  await updateDoc(doc(db, "Users/request-owner"), { role: "admin" });
  await denied(() => updateDoc(doc(db, "Bookings/request-one"), { status: "confirmed" }));
  // A refreshed/retried request reuses the document, without another payment or revision.
  await service.submitBookingRequest("request-one", requestData("request-owner"), paymentInput);
  assert.equal((await getDoc(doc(db, "Users/request-owner/bookingState/requests"))).data().revision, 1);
  const reviewer = client("reviewer", "receptionist");
  await denied(() => updateDoc(doc(reviewer, "Bookings/request-one"), { status: "confirmed" }));
  const verified = writeBatch(reviewer);
  verified.update(doc(reviewer, "Payments/deposit-request-one"), { status: "completed", verificationStatus: "verified" });
  verified.update(doc(reviewer, "Bookings/request-one"), { status: "pending", amountPaid: 5000, paymentStatus: "partial", remainingBalance: 5000 });
  await verified.commit();
  await updateDoc(doc(reviewer, "Bookings/request-one"), { status: "confirmed" });
});
test("rules: unverified accounts and invalid references cannot submit bookings", async () => {
  for (const [uid, verified, reference] of [["unverified-owner", false, paymentInput.reference], ["invalid-reference", true, "invalid"]]) {
    const db = client(uid, undefined, verified);
    await setDoc(doc(db, "Users", uid), { phone: "+639171234567" });
    await denied(() => requestService(db, uid, true).submitBookingRequest(uid, requestData(uid), { ...paymentInput, reference }));
    assert.equal((await getDoc(doc(db, "Bookings", uid))).exists(), false);
  }
});
test("cancelled requests permit a new request, and legacy mobile numbers normalize atomically", async () => {
  const uid = "cancelled-owner", db = client(uid), service = requestService(db, uid);
  await seed(`Users/${uid}`, { phone: "09171234567" });
  await seed("Bookings/cancelled-request", { ...booking, ...requestData(uid), status: "cancelled" });
  const id = await service.submitBookingRequest("cancelled-request", requestData(uid), paymentInput);
  assert.notEqual(id, "cancelled-request");
  assert.equal((await getDoc(doc(db, "Bookings/cancelled-request"))).data().status, "cancelled");
  assert.equal((await getDoc(doc(db, "Bookings", id))).data().bookingRef, `CBR-${id}`);
  assert.equal((await getDoc(doc(db, "Users", uid))).data().phone, "+639171234567");
});
test("real transactions: simultaneous overlapping app requests produce one winner; checkout-adjacent dates are allowed", async () => {
  const db = client("race-owner"), service = requestService(db, "race-owner");
  await setDoc(doc(db, "Users/race-owner"), { phone: "+639171234567" });
  const outcomes = await Promise.allSettled(["race-one", "race-two"].map(id => service.submitBookingRequest(id, requestData("race-owner"), paymentInput)));
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.match(outcomes.find(result => result.status === "rejected").reason.message, /existing reservation/);
  await service.submitBookingRequest("race-adjacent", requestData("race-owner", "2099-11-12", "2099-11-13"), paymentInput);
  const saved = await getDocs(query(collection(db, "Bookings"), where("userId", "==", "race-owner")));
  assert.equal(saved.size, 2);
});
test("rules: direct requests cannot omit the pending payment, verification claim or account revision", async () => {
  await denied(() => setDoc(doc(customer, "Bookings/no-payment"), { ...requestData("customer"), status: "pending", amountPaid: 0, paymentStatus: "unpaid" }));
  await denied(() => setDoc(doc(customer, "Bookings/fake-confirmed"), { ...requestData("customer"), status: "confirmed", amountPaid: 10000, paymentStatus: "paid" }));
  await denied(() => setDoc(doc(customer, "Payments/unpaired"), { bookingId: "new", customerId: "customer", amount: 1000, status: "pending", verificationStatus: "pending", referenceNumber: "1234567890123" }));
  await denied(() => setDoc(doc(customer, "Users/other/bookingState/requests"), { revision: 1, bookingId: "fake", updatedAt: serverTimestamp() }));
});
test("rules: profile registration validates normalized phone numbers", async () => {
  const db = client("phone-owner");
  await denied(() => setDoc(doc(db, "Users/phone-owner"), { phone: "not-a-number" }));
  await setDoc(doc(db, "Users/phone-owner"), { phone: "+639171234567" });
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

test("rules: legacy payments must be paired with an owned booking update; inquiry queries remain authorized", async () => {
  await seed("Bookings/new", {
    ...booking,
    amountPaid: 0,
    paymentStatus: "unpaid",
  });
  const batch = writeBatch(customer);
  batch.set(doc(customer, "Payments/new"), {
    customerId: "customer",
    bookingId: "new",
    amount: 5000,
    status: "pending",
    verificationStatus: "pending",
    referenceNumber: "1234567890123",
  });
  batch.update(doc(customer, "Bookings/new"), {
    paymentStatus: "pending_verification",
    paymentRecordId: "new",
    paymentReference: "1234567890123",
    remainingBalance: 10000,
  });
  await batch.commit();
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
