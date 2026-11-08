import { getPaymentSummary } from "./payment";

export function bookingConfirmationNotification(
  id: string,
  data: Record<string, any>,
  displayReference?: string,
) {
  const kind = String(data.itemType || data.bookingType || "").toLowerCase();
  const label =
    kind === "package" || data.packageId
      ? "Package"
      : ["service", "activity"].includes(kind) ||
          data.serviceId ||
          String(data.bookingRef || "").startsWith("ACT-")
        ? "Service"
        : "Room";
  const name =
    label === "Package"
      ? data.packageName || data.itemName || "Package"
      : label === "Service"
        ? data.serviceName || data.activityName || data.itemName || "Service"
        : data.roomTypeName || data.roomType || data.roomName || "Room stay";
  const reference =
    displayReference ||
    data.displayBookingId ||
    data.bookingId ||
    data.bookingRef ||
    id;
  return {
    eventId: `booking-confirmed-${id}`,
    type: "booking",
    title: "Booking Confirmed",
    message: `Your booking ${reference} has been confirmed. ${label}: ${name}. Date: ${data.checkIn || data.bookingDate || "—"}.`,
    targetPath: "/booking-history",
  };
}

// Older customer listeners used a different event ID for the same confirmation.
// Prefer the receptionist's canonical document without deleting historical data.
export function distinctBookingConfirmations<
  T extends { id: string; userId?: string; eventId?: string },
>(items: T[]): T[] {
  const identity = (item: T) => {
    let event = item.eventId || "";
    if (!event && item.userId && item.id.startsWith(`${item.userId}_`)) {
      try {
        event = decodeURIComponent(item.id.slice(item.userId.length + 1));
      } catch {
        return null;
      }
    }
    const canonical = event.match(/^booking-confirmed-(.+)$/);
    const legacy = event.match(/^booking-status-(.+)-confirmed$/);
    const id = canonical?.[1] || legacy?.[1];
    return id
      ? { key: `${item.userId || ""}|${id}`, canonical: Boolean(canonical) }
      : null;
  };
  const chosen = new Map<string, { item: T; canonical: boolean }>();
  for (const item of items) {
    const key = identity(item);
    if (
      key &&
      (!chosen.has(key.key) ||
        (key.canonical && !chosen.get(key.key)!.canonical))
    )
      chosen.set(key.key, { item, canonical: key.canonical });
  }
  return items.filter((item) => {
    const key = identity(item);
    return !key || chosen.get(key.key)?.item === item;
  });
}

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
    status: String(data.status ?? "")
      .trim()
      .toLowerCase(),
    paymentStatus,
    amountPaid,
    verifiedAmountPaid:
      paymentStatus === "pending_verification"
        ? (previous?.verifiedAmountPaid ?? amountPaid)
        : amountPaid,
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
  const result: {
    eventId: string;
    type: string;
    title: string;
    message: string;
    targetPath: string;
  }[] = [];
  const titles: Record<string, string> = {
    confirmed: "Booking Confirmed",
    cancelled: "Booking Cancelled",
    completed: "Stay Completed",
  };
  if (current.status !== previous.status && titles[current.status]) {
    result.push(
      current.status === "confirmed"
        ? bookingConfirmationNotification(id, data)
        : {
            eventId: `booking-status-${id}-${current.status}`,
            type: "booking",
            title: titles[current.status],
            message: `Your booking ${reference} for ${room} has been marked as ${current.status}.`,
            targetPath,
          },
    );
  }
  // A verification-state change alone is not evidence of money received.
  if (
    current.amountPaid > previous.verifiedAmountPaid &&
    ["paid", "partial"].includes(current.paymentStatus)
  ) {
    result.push({
      eventId: `payment-received-${id}-${Math.round(current.amountPaid * 100)}`,
      type: "payment",
      title:
        current.paymentStatus === "paid"
          ? "Payment Confirmed"
          : "Partial Payment Received",
      message: `Your payment for booking ${reference} has been recorded. Status: ${current.paymentStatus}.`,
      targetPath,
    });
  }
  return result;
}
