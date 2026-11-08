import { auth, customerDb } from "../components/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { cancellationReason, isCompletedBooking } from "../utils/bookingPolicy";
import { bookingKind, bookingReviewFields } from "../utils/bookingPresentation";

export async function cancelCustomerBooking(id: string, remarks: string) {
  const customer = auth.currentUser;
  if (!customer) throw new Error("Please log in before cancelling a booking.");
  const cancellationRemarks = String(remarks || "").trim();
  if (cancellationRemarks.length < 5 || cancellationRemarks.length > 1000)
    throw new Error(
      "Please provide a cancellation reason of 5–1,000 characters.",
    );
  await runTransaction(customerDb, async (transaction) => {
    const ref = doc(customerDb, "Bookings", id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("This booking no longer exists.");
    const booking = snapshot.data();
    if (booking.userId !== customer.uid)
      throw new Error("You can only cancel your own bookings.");
    const auditRef = doc(
      customerDb,
      "Users",
      customer.uid,
      "bookingCancellations",
      id,
    );
    if (
      booking.status === "cancelled" &&
      booking.cancelledByUid === customer.uid
    ) {
      const audit = await transaction.get(auditRef);
      if (
        audit.exists() &&
        audit.data().cancellationReason === cancellationRemarks
      )
        return;
    }
    const reason = cancellationReason(booking);
    if (reason) throw new Error(reason);
    transaction.update(ref, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledByUid: customer.uid,
    });
    // Availability currently reads Bookings publicly. Keep personal remarks
    // and actor contact information in an owner/staff-only audit document.
    transaction.set(auditRef, {
      bookingId: id,
      userId: customer.uid,
      cancellationReason: cancellationRemarks,
      cancelledAt: serverTimestamp(),
      cancelledByUid: customer.uid,
      cancelledBy: customer.email || customer.uid,
    });
  });
}

export async function submitBookingReview(
  id: string,
  rating: number,
  feedback: string,
  category?: string,
) {
  const customer = auth.currentUser;
  if (!customer) throw new Error("Please log in to submit a review.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new Error("Select a rating from 1 to 5 stars.");
  const comment = feedback.trim();
  if (comment.length < 5 || comment.length > 1000)
    throw new Error("Written feedback must contain 5–1,000 characters.");
  if (category && !["overall", "room", "service"].includes(category))
    throw new Error("Choose a valid review category.");
  // Preserve compatibility with historical random-ID review documents.
  const legacy = await getDocs(
    query(
      collection(customerDb, "reviews"),
      where("userId", "==", customer.uid),
    ),
  );
  if (legacy.docs.some((review) => review.data().bookingId === id))
    throw new Error("You have already reviewed this booking.");
  await runTransaction(customerDb, async (transaction) => {
    const bookingRef = doc(customerDb, "Bookings", id);
    const reviewRef = doc(customerDb, "reviews", id);
    const [bookingSnapshot, existingReview] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(reviewRef),
    ]);
    if (!bookingSnapshot.exists())
      throw new Error("This booking no longer exists.");
    const booking = bookingSnapshot.data();
    if (
      booking.userId !== customer.uid ||
      !isCompletedBooking(booking.status)
    ) {
      throw new Error(
        "Only your own completed bookings are eligible for a verified review.",
      );
    }
    const kind = bookingKind(booking);
    if (
      (category === "service" && kind === "room") ||
      (category === "room" && kind !== "room")
    ) {
      throw new Error("Choose a booking that matches your review category.");
    }
    if (existingReview.exists())
      throw new Error("You have already reviewed this booking.");
    transaction.set(reviewRef, {
      ...bookingReviewFields(booking),
      ...(category ? { category } : {}),
      bookingId: id,
      bookingRef: booking.bookingRef || id,
      userId: customer.uid,
      guestName:
        customer.displayName || customer.email?.split("@")[0] || "Guest",
      guestAvatar: customer.photoURL || "",
      rating,
      comment,
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      status: "published",
    });
  });
}
