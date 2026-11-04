export function isCompletedBooking(status: unknown): boolean {
  return ["completed", "checkedout", "finished"].includes(
    String(status ?? "")
      .toLowerCase()
      .replace(/[\s_-]/g, ""),
  );
}

export function cancellationReason(booking: Record<string, any>): string {
  if (
    !["pending", "confirmed"].includes(
      String(booking.status).trim().toLowerCase(),
    )
  ) {
    return "Only pending or confirmed bookings can be cancelled.";
  }
  return "";
}
