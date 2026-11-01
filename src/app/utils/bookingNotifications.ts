import { getPaymentSummary } from "./payment";

export function bookingNotificationState(
  data: Record<string, any>,
  previous?: { verifiedAmountPaid: number },
) {
  const amountPaid = Number(data.amountPaid ?? 0);
  const paymentStatus = getPaymentSummary({
    totalPrice: data.totalPrice ?? data.totalAmount ?? data.total,
    amountPaid,
    paymentStatus: data.paymentStatus,
  }).paymentStatus;
  return {
    status: String(data.status ?? "").trim().toLowerCase(),
    paymentStatus,
    amountPaid,
    verifiedAmountPaid: paymentStatus === "pending_verification"
      ? previous?.verifiedAmountPaid ?? amountPaid : amountPaid,
  };
}

export function bookingChangeNotifications(
  id: string,
  data: Record<string, any>,
  previous: ReturnType<typeof bookingNotificationState>,
) {
  const current = bookingNotificationState(data, previous);
  const reference = data.bookingRef || id;
  const room = data.roomName || data.itemName || "your reservation";
  const targetPath = `/booking-confirmation/${id}`;
  const result: { eventId: string; type: string; title: string; message: string; targetPath: string }[] = [];
  const titles: Record<string, string> = {
    confirmed: "Booking Confirmed", cancelled: "Booking Cancelled", completed: "Stay Completed",
  };
  if (current.status !== previous.status && titles[current.status]) {
    result.push({
      eventId: `booking-status-${id}-${current.status}`,
      type: "booking",
      title: titles[current.status],
      message: `Your booking ${reference} for ${room} has been marked as ${current.status}.`,
      targetPath,
    });
  }
  // A verification-state change alone is not evidence of money received.
  if (current.amountPaid > previous.verifiedAmountPaid &&
      ["paid", "partial"].includes(current.paymentStatus)) {
    result.push({
      eventId: `payment-received-${id}-${Math.round(current.amountPaid * 100)}`,
      type: "payment",
      title: current.paymentStatus === "paid" ? "Payment Confirmed" : "Partial Payment Received",
      message: `Your payment for booking ${reference} has been recorded. Status: ${current.paymentStatus}.`,
      targetPath,
    });
  }
  return result;
}
