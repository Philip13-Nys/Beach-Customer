export function isCompletedBooking(status: unknown): boolean {
  return ["completed", "checkedout", "finished"].includes(
    String(status ?? "")
      .toLowerCase()
      .replace(/[\s_-]/g, ""),
  );
}

export const CANCELLATION_POLICY =
  "Cancellation Policy: Reservation cancellation becomes available 24 hours after the booking request was submitted and must be completed before check-in. Customers must provide a valid reason for cancellation.";

export function cancellationReason(
  booking: Record<string, any>,
  now = Date.now(),
): string {
  if (
    !["pending", "pending-payment-verification", "confirmed"].includes(
      String(booking.status).trim().toLowerCase(),
    )
  ) {
    return "Only pending or confirmed bookings can be cancelled.";
  }
  const created = booking.createdAt;
  const createdTime =
    typeof created?.toMillis === "function"
      ? created.toMillis()
      : created?.seconds != null
        ? Number(created.seconds) * 1000
        : created instanceof Date
          ? created.getTime()
          : Date.parse(created);
  if (!Number.isFinite(createdTime))
    return "The request date could not be verified. Please contact the resort to cancel.";
  if (now < createdTime + 86_400_000)
    return "Cancellation becomes available 24 hours after your booking request was submitted.";
  // Resort dates use Philippine time regardless of the visitor's device timezone.
  const date = String(booking.checkIn || booking.bookingDate || "").slice(
    0,
    10,
  );
  const checkIn = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(checkIn) || now >= checkIn)
    return "Online cancellation must be completed before the check-in date. Please contact the resort.";
  return "";
}
