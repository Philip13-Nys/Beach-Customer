import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import * as sdk from "firebase/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  test(
    "service quantity permissions require an explicit local emulator",
    { skip: true },
    () => {},
  );
} else {
  assert.equal(
    process.env.FIRESTORE_EMULATOR_HOST,
    "127.0.0.1:8788",
    "Only the isolated local emulator is allowed.",
  );
  const project = "demo-service-quantity-rules",
    host = "http://127.0.0.1:8788";
  const base = `${host}/v1/projects/${project}/databases/(default)/documents`;
  const result = await fetch(
    `${host}/emulator/v1/projects/${project}:securityRules`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        rules: {
          files: [
            {
              name: "firestore.rules",
              content: readFileSync(
                new URL(
                  "../docs/admin-service-quantity.rules",
                  import.meta.url,
                ),
                "utf8",
              ),
            },
          ],
        },
      }),
    },
  );
  assert.ok(result.ok, `Staged rules did not compile: ${await result.text()}`);
  assert.ok(
    (
      await fetch(
        `${host}/emulator/v1/projects/${project}/databases/(default)/documents`,
        { method: "DELETE", headers: { Authorization: "Bearer owner" } },
      )
    ).ok,
  );
  const value = (v) =>
    typeof v === "number"
      ? { integerValue: String(v) }
      : typeof v === "boolean"
        ? { booleanValue: v }
        : { stringValue: v };
  async function seed(path, data) {
    const response = await fetch(`${base}/${path}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, value(v)]),
        ),
      }),
    });
    assert.ok(response.ok, await response.text());
  }
  const apps = [],
    databases = [];
  function client(uid) {
    const app = initializeApp(
      { projectId: project, apiKey: "demo-key" },
      "quantity-rules-" + apps.length,
    );
    apps.push(app);
    const db = sdk.getFirestore(app);
    databases.push(db);
    sdk.connectFirestoreEmulator(
      db,
      "127.0.0.1",
      8788,
      uid ? { mockUserToken: { sub: uid, user_id: uid } } : {},
    );
    return db;
  }
  sdk.setLogLevel("silent");
  for (const [uid, role] of [
    ["admin", "Administrator"],
    ["manager", "Manager"],
    ["reception", "Receptionist"],
    ["customer", "Customer"],
    ["disabled", "Manager"],
  ])
    await seed("Users/" + uid, {
      role,
      status: "Active",
      ...(uid === "disabled" ? { disabled: true } : {}),
    });
  const admin = client("admin"),
    manager = client("manager"),
    reception = client("reception"),
    customer = client("customer"),
    disabled = client("disabled"),
    unprofiled = client("unknown"),
    guest = client();
  const policy = {
    capacity: 3,
    capacityType: "units",
    participantsPerUnit: 5,
    opensAt: "08:00",
    closesAt: "17:00",
    durationMinutes: 60,
    days: [0, 1, 2, 3, 4, 5, 6],
  };
  const denied = (promise) =>
    assert.rejects(promise, (error) => error.code === "permission-denied");
  test.after(async () => {
    await Promise.all(databases.map((db) => sdk.terminate(db)));
    await Promise.all(apps.map(deleteApp));
  });

  test("only enabled manager/admin accounts can configure service quantities", async () => {
    for (const db of [admin, manager])
      await sdk.setDoc(sdk.doc(db, "services", "boat"), {
        name: "Boat",
        availability: policy,
      });
    for (const db of [reception, customer, disabled, unprofiled, guest])
      await denied(
        sdk.updateDoc(sdk.doc(db, "services", "boat"), {
          "availability.capacity": 99,
        }),
      );
    assert.equal(
      (await sdk.getDoc(sdk.doc(guest, "services", "boat"))).data().availability
        .capacity,
      3,
    );
    await sdk.setDoc(sdk.doc(manager, "packages", "bundle"), {
      availability: policy,
    });
    await denied(
      sdk.setDoc(sdk.doc(reception, "packages", "bundle"), {
        availability: policy,
      }),
    );
  });
  test("malformed policies are rejected even for managers", async () => {
    for (const changes of [
      { capacity: -1 },
      { capacity: 2.5 },
      { capacityType: "unknown" },
      { participantsPerUnit: 0 },
      { opensAt: "bad" },
      { days: [9] },
    ])
      await denied(
        sdk.setDoc(sdk.doc(manager, "services", "invalid"), {
          availability: { ...policy, ...changes },
        }),
      );
  });
  test("users cannot promote themselves through overlapping rules; presence updates still work", async () => {
    for (const [db, id] of [
      [customer, "customer"],
      [reception, "reception"],
      [manager, "manager"],
    ])
      await denied(
        sdk.updateDoc(sdk.doc(db, "Users", id), { role: "Administrator" }),
      );
    await sdk.updateDoc(sdk.doc(reception, "Users", "reception"), {
      status: "Inactive",
      lastActive: sdk.serverTimestamp(),
    });
    await sdk.updateDoc(sdk.doc(reception, "Users", "reception"), {
      status: "Active",
      lastActive: sdk.serverTimestamp(),
    });
    await denied(
      sdk.setDoc(sdk.doc(guest, "Users", "forged"), { role: "Manager" }),
    );
    await sdk.setDoc(sdk.doc(admin, "Users", "new-reception"), {
      role: "Receptionist",
      status: "Inactive",
    });
  });
  test("reception can reserve a revisioned allocation but customers/guests cannot alter inventory", async () => {
    const lock = (db) => sdk.doc(db, "BookingLocks", "activityInventory");
    await sdk.setDoc(lock(reception), {
      revision: 1,
      allocations: {},
      updatedAt: sdk.serverTimestamp(),
    });
    await sdk.updateDoc(lock(reception), {
      revision: 2,
      updatedAt: sdk.serverTimestamp(),
    });
    await denied(
      sdk.updateDoc(lock(reception), {
        revision: 2,
        updatedAt: sdk.serverTimestamp(),
      }),
    );
    for (const db of [customer, guest, disabled])
      await denied(
        sdk.setDoc(lock(db), {
          revision: 3,
          allocations: {},
          updatedAt: sdk.serverTimestamp(),
        }),
      );
    assert.equal((await sdk.getDoc(lock(guest))).data().revision, 2);
  });
}
