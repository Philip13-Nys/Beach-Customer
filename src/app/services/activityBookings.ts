import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
} from "firebase/firestore";
import { db, customerDb } from "../components/firebase";
import {
  mergeActivityBookings,
  activitySelections,
  assertActivityCapacity,
  bookingActivityReservations,
  occupiedActivities,
  type ActivityRecord,
} from "../utils/activityAvailability";
const sources = () => [
  collection(db, "services"),
  collection(db, "packages"),
  collection(customerDb, "Bookings"),
  collection(db, "reservations"),
];
export function combineActivityInventory(
  data: ActivityRecord[][],
  allocations: ActivityRecord,
) {
  const catalog = [
    ...data[0].map((item) => ({ ...item, itemType: "service" })),
    ...data[1].map((item) => ({ ...item, itemType: "package" })),
  ];
  const bookings = mergeActivityBookings(
    data[2].map((item) => ({ ...item, _bookingStore: "customer" })),
    data[3].map((item) => ({ ...item, _bookingStore: "staff" })),
  );
  return {
    catalog,
    bookings,
    allocations,
    occupied: occupiedActivities(catalog, bookings, allocations),
  };
}
export async function checkActivityBooking(booking: ActivityRecord) {
  if (
    !booking.addOns?.length &&
    !["service", "package", "activity"].includes(
      booking.itemType || booking.bookingType,
    )
  )
    return [];
  const selections = activitySelections(booking);
  if (
    selections.length &&
    selections.every((selection) => selection.itemType === "package")
  ) {
    const packages = await getDocsFromServer(collection(db, "packages"));
    return bookingActivityReservations(
      booking,
      packages.docs.map((document) => ({
        ...document.data(),
        id: document.id,
        itemType: "package",
      })),
    );
  }
  const [snapshots, lock] = await Promise.all([
    Promise.all(sources().map((source) => getDocsFromServer(source))),
    getDocFromServer(doc(db, "BookingLocks", "activityInventory")),
  ]);
  const data = snapshots.map((snapshot) =>
    snapshot.docs.map((document) => ({ ...document.data(), id: document.id })),
  );
  const current = combineActivityInventory(
    data,
    lock.data()?.allocations || {},
  );
  const requests = bookingActivityReservations(booking, current.catalog);
  for (const request of requests)
    if (
      Date.parse(`${request.date}T00:00:00+08:00`) + request.start * 60000 <=
      Date.now()
    )
      throw new Error(
        "An activity session has already started. Choose a later time.",
      );
  assertActivityCapacity(requests, current.catalog, current.occupied);
  return requests;
}
