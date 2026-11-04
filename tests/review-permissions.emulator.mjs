import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  setLogLevel,
} from "firebase/firestore";

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787")
  throw Error(
    "This test requires the localhost Firestore emulator on port 8787.",
  );
const projectId = "demo-review-permissions",
  host = "http://127.0.0.1:8787";
const base = `${host}/v1/projects/${projectId}/databases/(default)/documents`;
setLogLevel("silent");
const apps = [];
function client(uid) {
  const app = initializeApp(
    { projectId, apiKey: "demo-key" },
    `review-permissions-${apps.length}`,
  );
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(
    db,
    "127.0.0.1",
    8787,
    uid ? { mockUserToken: { sub: uid, user_id: uid } } : {},
  );
  return db;
}
const customer = client("customer"),
  other = client("other"),
  guest = client();
after(async () => {
  await Promise.all(apps.map(deleteApp));
});

async function loadRules(file) {
  const response = await fetch(
    `${host}/emulator/v1/projects/${projectId}:securityRules`,
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
                new URL(`../docs/${file}`, import.meta.url),
                "utf8",
              ),
            },
          ],
        },
      }),
    },
  );
  assert.ok(response.ok, `Rule compilation failed: ${await response.text()}`);
}
async function seed(path, data) {
  const response = await fetch(`${base}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          { stringValue: value },
        ]),
      ),
    }),
  });
  assert.ok(response.ok, "Could not seed local test fixtures");
}
const denied = (work) =>
  assert.rejects(work, (error) => error.code === "permission-denied");

test("deployed rules reproduce the missing-review permission error before submission", async () => {
  await loadRules("firestore-review-fix.before.rules");
  const reset = await fetch(
    `${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer owner" },
      signal: AbortSignal.timeout(10000),
    },
  );
  assert.ok(reset.ok);
  await seed("Bookings/b1", { userId: "customer", status: "checked-out" });
  await denied(() =>
    runTransaction(customer, async (transaction) => {
      await transaction.get(doc(customer, "reviews/b1"));
    }),
  );
});

test("review-only patch enables the owned transaction without exposing another customer's reviews", async () => {
  await loadRules("firestore-review-fix.after.rules");
  const ref = doc(customer, "reviews/b1");
  await runTransaction(customer, async (transaction) => {
    const saved = await transaction.get(ref);
    assert.equal(saved.exists(), false);
    transaction.set(ref, {
      userId: "customer",
      bookingId: "b1",
      rating: 5,
      comment: "Very nice stay",
      status: "published",
      createdAt: serverTimestamp(),
    });
  });
  assert.equal(
    (
      await getDocs(
        query(collection(guest, "reviews"), where("status", "==", "published")),
      )
    ).size,
    1,
  );
  assert.equal(
    (
      await getDocs(
        query(
          collection(customer, "reviews"),
          where("userId", "==", "customer"),
        ),
      )
    ).size,
    1,
  );
  await denied(() =>
    setDoc(ref, {
      userId: "customer",
      bookingId: "b1",
      rating: 5,
      comment: "Duplicate submission",
    }),
  );

  await seed("Bookings/absent", { userId: "customer", status: "checked-out" });
  assert.equal((await getDoc(doc(customer, "reviews/absent"))).exists(), false);
  await denied(() => getDoc(doc(other, "reviews/absent")));
  await denied(() => getDoc(doc(guest, "reviews/absent")));
  await seed("Bookings/private", { userId: "customer", status: "checked-out" });
  await seed("reviews/private", {
    userId: "other",
    status: "pending",
    comment: "Private review",
  });
  await denied(() => getDoc(doc(customer, "reviews/private")));
});
