type BookingRecord = Record<string, any>;

export function bookingKind(
  booking: BookingRecord,
): "room" | "service" | "package" {
  const type = String(
    booking.itemType || booking.bookingType || "",
  ).toLowerCase();
  if (type === "package" || booking.packageId || booking.packageName)
    return "package";
  if (
    ["service", "activity"].includes(type) ||
    booking.serviceId ||
    booking.serviceName ||
    String(booking.bookingRef || "").startsWith("ACT-")
  )
    return "service";
  return "room";
}

export function bookingName(booking: BookingRecord): string {
  return bookingKind(booking) === "room"
    ? booking.roomName || "Resort Stay"
    : booking.itemName ||
        booking.serviceName ||
        booking.packageName ||
        "Activity Booking";
}

export function bookingStatusLabel(booking: BookingRecord): string {
  const status = String(booking.status || "").trim();
  const compact = status.toLowerCase().replace(/[\s_-]/g, "");
  if (compact === "pendingpaymentverification")
    return "Pending Payment Verification";
  if (bookingKind(booking) !== "room") {
    if (["checkedin", "inprogress"].includes(compact)) return "In Progress";
    if (["checkedout", "completed", "finished"].includes(compact))
      return "Completed";
  }
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
}

export function bookingReviewFields(booking: BookingRecord) {
  const kind = bookingKind(booking);
  if (kind === "room")
    return {
      category: "room",
      roomName: bookingName(booking),
      roomId: booking.roomId || "",
    };
  return {
    category: "service",
    itemType: kind,
    itemId: booking.itemId || booking.serviceId || booking.packageId || "",
    itemName: bookingName(booking),
    ...(kind === "package"
      ? {
          packageId: booking.packageId || booking.itemId || "",
          packageName: bookingName(booking),
        }
      : {
          serviceId: booking.serviceId || booking.itemId || "",
          serviceName: bookingName(booking),
        }),
  };
}

export function activityRating(
  item: { id: string; name: string; itemType?: string },
  reviews: BookingRecord[],
) {
  const kind = item.itemType || "service";
  const ratings = reviews
    .filter((review) => {
      if (review.status !== "published" || bookingKind(review) !== kind)
        return false;
      const id = review.itemId || review.serviceId || review.packageId;
      if (id) return id === item.id;
      return (
        bookingName(review).trim().toLowerCase() ===
        item.name.trim().toLowerCase()
      );
    })
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  return {
    count: ratings.length,
    average: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0,
  };
}
