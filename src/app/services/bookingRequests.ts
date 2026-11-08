import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { customerDb } from "../components/firebase";
import { requireVerifiedCustomer } from "./emailVerification";
import {
  activeRequest,
  calendarDay,
  dateRangesOverlap,
} from "../utils/availability";
import { getPaymentSummary } from "../utils/payment";
import { validManualPayment, type ManualPayment } from "../utils/manualPayment";
import { normalizePhilippineMobile } from "../utils/registration";
import { checkActivityBooking } from "./activityBookings";

export const DUPLICATE_BOOKING_MESSAGE =
  "You already have an existing reservation or pending booking request for the selected dates. Please review your booking history before submitting another reservation.";
export function requestKey(userId: string, signature: string) {
  // Stored before the network operation, so retries and refreshes reuse the same document.
  const key = `booking-request:${userId}:${signature}`;
  let id = "";
  try {
    id = sessionStorage.getItem(key) || "";
  } catch {
    /* In-memory ref still protects this page. */
  }
  if (!id) {
    id = doc(collection(customerDb, "Bookings")).id;
    try {
      sessionStorage.setItem(key, id);
    } catch {
      /* Storage can be disabled. */
    }
  }
  return id;
}

export async function submitBookingRequest(
  id: string,
  data: Record<string, any>,
  payment: ManualPayment,
): Promise<string> {
  const customer = await requireVerifiedCustomer();
  if (data.userId !== customer.uid)
    throw new Error("You can only submit your own booking requests.");
  if (!Number.isInteger(data.guests) || data.guests < 1 || data.guests > 100)
    throw new Error("Enter a valid whole number of guests or participants.");
  if (!validManualPayment(payment, data.totalPrice))
    throw new Error(
      "Provide a valid payment reference number before submitting your request.",
    );
  const first = calendarDay(data.checkIn),
    last = calendarDay(data.checkOut);
  const isActivity = ["service", "package", "activity"].includes(
    data.bookingType || data.itemType,
  );
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    (isActivity ? last !== first : last <= first || last - first > 365)
  )
    throw new Error(
      "Choose valid booking dates. Room stays must be between 1 and 365 nights.",
    );
  const end = isActivity
    ? new Date((first + 1) * 86400000).toISOString().slice(0, 10)
    : data.checkOut;
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  if (data.checkIn < today)
    throw new Error("Choose today or a future booking date.");
  const amount = getPaymentSummary(
    { totalPrice: data.totalPrice, amountPaid: 0 },
    Number(payment.settings!.downPaymentPercent),
  ).amountDue;
  const bookingRef = doc(customerDb, "Bookings", id);
  const paymentRef = doc(customerDb, "Payments", `deposit-${id}`);
  const lockRef = doc(
    customerDb,
    "Users",
    customer.uid,
    "bookingState",
    "requests",
  );
  const profileRef = doc(customerDb, "Users", customer.uid);
  const saved = await getDocFromServer(bookingRef);
  if (saved.exists()) {
    if (saved.data().userId !== customer.uid)
      throw new Error("This request belongs to another account.");
    if (saved.data().status === "cancelled") {
      const replacement = doc(collection(customerDb, "Bookings")).id;
      try {
        for (let index = 0; index < sessionStorage.length; index++) {
          const key = sessionStorage.key(index);
          if (
            key?.startsWith(`booking-request:${customer.uid}:`) &&
            sessionStorage.getItem(key) === id
          )
            sessionStorage.setItem(key, replacement);
        }
      } catch {
        /* The transaction still checks for active overlaps. */
      }
      return submitBookingRequest(replacement, data, payment);
    }
    return id;
  }
  const profile = await getDocFromServer(profileRef);
  if (!profile.exists())
    throw new Error(
      "Your customer profile was not found. Please complete registration before booking.",
    );
  try {
    normalizePhilippineMobile(String(profile.data().phone || ""));
  } catch {
    throw new Error(
      "Please update your Philippine mobile number in Profile before submitting a booking request.",
    );
  }
  const activityReservations = await checkActivityBooking(data);
  const preflight = await getDocsFromServer(
    query(
      collection(customerDb, "Bookings"),
      where("userId", "==", customer.uid),
    ),
  );
  if (
    preflight.docs.some(
      (snapshot) =>
        activeRequest(snapshot.data()) &&
        dateRangesOverlap(snapshot.data(), data.checkIn, end),
    )
  )
    throw new Error(DUPLICATE_BOOKING_MESSAGE);
  let observedRevision = -1;
  const commit = () =>
    runTransaction(customerDb, async (transaction) => {
      const [existing, lock, freshProfile] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(lockRef),
        transaction.get(profileRef),
      ]);
      observedRevision = Number(lock.data()?.revision || 0);
      if (existing.exists()) {
        if (existing.data().userId !== customer.uid)
          throw new Error("This request belongs to another account.");
        if (existing.data().status === "cancelled")
          throw new Error(
            "This request was cancelled. Return to the room list to start a new request.",
          );
        return id;
      }
      // The per-account revision serializes app submissions across tabs/devices.
      // Read again on every transaction retry to catch a request committed by another tab.
      const own = await getDocsFromServer(
        query(
          collection(customerDb, "Bookings"),
          where("userId", "==", customer.uid),
        ),
      );
      const tracked = await Promise.all(
        own.docs.map((snapshot) => transaction.get(snapshot.ref)),
      );
      if (
        tracked.some(
          (snapshot) =>
            snapshot.exists() &&
            activeRequest(snapshot.data()) &&
            dateRangesOverlap(snapshot.data(), data.checkIn, end),
        )
      )
        throw new Error(DUPLICATE_BOOKING_MESSAGE);
      if (!freshProfile.exists())
        throw new Error("Your customer profile could not be verified.");
      const phone = normalizePhilippineMobile(
        String(freshProfile.data().phone || ""),
      );
      if (freshProfile.data().phone !== phone)
        transaction.update(profileRef, { phone });
      transaction.set(lockRef, {
        revision: Number(lock.data()?.revision || 0) + 1,
        bookingId: id,
        updatedAt: serverTimestamp(),
      });
      transaction.set(bookingRef, {
        ...data,
        customerPhone: phone,
        phone,
        status: "pending-payment-verification",
        paymentStatus: "pending_verification",
        amountPaid: 0,
        ...(activityReservations.length ? { activityReservations } : {}),
        bookingRef: `${isActivity ? "ACT" : "CBR"}-${id}`,
        remainingBalance: data.totalPrice,
        downPaymentPercent: Number(payment.settings!.downPaymentPercent),
        downPaymentAmount: amount,
        paymentId: paymentRef.id,
        requestVersion: 2,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(paymentRef, {
        bookingId: id,
        bookingRef: `${isActivity ? "ACT" : "CBR"}-${id}`,
        customerId: customer.uid,
        userId: customer.uid,
        guest: data.customerName || "Customer",
        room: data.roomName || data.itemName || "Reservation",
        amount,
        method: "gcash",
        type: amount === data.totalPrice ? "full" : "partial",
        paymentType: "downpayment",
        status: "pending",
        verificationStatus: "pending",
        referenceNumber: payment.reference.trim(),
        receiptNo: `DEP-${id}`,
        createdAt: serverTimestamp(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toISOString().slice(11, 19),
      });
      return id;
    });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await commit();
    } catch (error: any) {
      // Rules can reject a stale revision before the SDK retries an optimistic
      // conflict. Retry only when another request actually advanced our lock.
      if (error.code !== "permission-denied" || attempt === 2) throw error;
      const current = await getDocFromServer(lockRef);
      if (Number(current.data()?.revision || 0) <= observedRevision)
        throw error;
      const own = await getDocsFromServer(
        query(
          collection(customerDb, "Bookings"),
          where("userId", "==", customer.uid),
        ),
      );
      if (
        own.docs.some(
          (snapshot) =>
            activeRequest(snapshot.data()) &&
            dateRangesOverlap(snapshot.data(), data.checkIn, end),
        )
      )
        throw new Error(DUPLICATE_BOOKING_MESSAGE);
    }
  }
  throw new Error(
    "Another booking request is being processed. Please check your booking history and try again.",
  );
}
