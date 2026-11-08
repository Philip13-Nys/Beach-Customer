export type RecordData = Record<string, any>;
export const normalizedStatus = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
export function occupiesRoom(booking: RecordData): boolean {
  return [
    "confirmed",
    "approved",
    "reserved",
    "checked-in",
    "checkedin",
    "occupied",
  ].includes(normalizedStatus(booking.status));
}
export function activeRequest(booking: RecordData): boolean {
  return [
    "pending",
    "pending-payment-verification",
    "confirmed",
    "approved",
    "reserved",
    "checked-in",
    "checkedin",
    "occupied",
  ].includes(normalizedStatus(booking.status || "pending"));
}
export function calendarDay(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time / 86400000
    : NaN;
}
function resortDate(value: any): string {
  const date = value?.toDate
    ? value.toDate()
    : value instanceof Date
      ? value
      : null;
  return date
    ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10)
    : String(value || "").slice(0, 10);
}
export function dateRangesOverlap(
  a: RecordData,
  start: string,
  end: string,
): boolean {
  const first = calendarDay(resortDate(a.checkIn || a.bookingDate));
  const last = calendarDay(resortDate(a.checkOut || a.bookingDate));
  const requestedStart = calendarDay(start),
    requestedEnd = calendarDay(end);
  // Same-day activities occupy that calendar day; room check-out remains exclusive.
  return first < requestedEnd && Math.max(first + 1, last) > requestedStart;
}
export function remainingRooms(
  type: RecordData,
  rooms: RecordData[],
  bookings: RecordData[],
  legacy: RecordData[],
  start: string,
  end: string,
): number {
  if (
    type.deleted ||
    type.isActive === false ||
    type.available === false ||
    ["inactive", "unavailable", "deleted"].includes(
      normalizedStatus(type.status),
    )
  )
    return 0;
  const first = calendarDay(start),
    last = calendarDay(end);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    last <= first ||
    last - first > 365
  )
    return 0;
  const normalize = (v: unknown) =>
    String(v || "")
      .trim()
      .toLowerCase();
  const matches = (r: RecordData) =>
    [
      r.roomTypeId,
      r.typeId,
      r.roomId,
      r.type,
      r.roomTypeName,
      r.roomName,
      r.roomType?.id,
      typeof r.roomType === "object" ? r.roomType?.name : r.roomType,
    ].some(
      (v) =>
        v && [normalize(type.id), normalize(type.name)].includes(normalize(v)),
    );
  const blocked = [
    "maintenance",
    "inactive",
    "deleted",
    "unavailable",
    "out-of-service",
    "cleaning",
  ];
  const pool = rooms.filter(
    (r) =>
      matches(r) &&
      !r.deleted &&
      r.isActive !== false &&
      r.isAvailable !== false &&
      !blocked.includes(normalizedStatus(r.status)) &&
      !blocked.includes(normalizedStatus(r.condition)),
  );
  const ids = new Set(pool.map((r) => String(r.id)));
  const merged = mergeAvailabilityBookings(bookings, legacy);
  const today = calendarDay(
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
  );
  const assigned = new Set<string>(
    first <= today && last > today
      ? pool
          .filter((r) =>
            ["occupied", "checked-in"].includes(normalizedStatus(r.status)),
          )
          .map((r) => String(r.id))
      : [],
  );
  const anonymous = new Map<number, number>();
  for (const b of merged) {
    if (!occupiesRoom(b) || (!matches(b) && !ids.has(String(b.roomId))))
      continue;
    if (
      !Number.isFinite(calendarDay(resortDate(b.checkIn))) ||
      !Number.isFinite(calendarDay(resortDate(b.checkOut)))
    )
      return 0;
    if (!dateRangesOverlap(b, start, end)) continue;
    const occupied = [
      ...new Set(
        [
          ...(Array.isArray(b.assignedRoomIds) ? b.assignedRoomIds : []),
          ...(ids.has(String(b.roomId)) ? [b.roomId] : []),
        ].map(String),
      ),
    ].filter((id) => ids.has(id));
    occupied.forEach((id: string) => assigned.add(id));
    const quantity = Math.max(
      1,
      Math.floor(Number(b.roomCount ?? b.numberOfRooms ?? b.quantity ?? 1)) ||
        1,
    );
    const unassigned = Math.max(0, quantity - occupied.length);
    for (
      let day = Math.max(first, calendarDay(resortDate(b.checkIn)));
      day < Math.min(last, calendarDay(resortDate(b.checkOut)));
      day++
    )
      anonymous.set(day, (anonymous.get(day) || 0) + unassigned);
  }
  return Math.max(
    0,
    pool.length - assigned.size - Math.max(0, ...anonymous.values()),
  );
}
export function mergeAvailabilityBookings(
  bookings: RecordData[],
  legacy: RecordData[],
): RecordData[] {
  const references = new Set(
    bookings.flatMap((b) =>
      [b.id, b.bookingId, b.bookingRef].filter(Boolean).map(String),
    ),
  );
  const seen = new Set<string>();
  return [
    ...bookings,
    ...legacy.filter((b) => {
      const link = String(b.bookingId || b.bookingRef || "");
      if (link && (references.has(link) || seen.has(link))) return false;
      if (link) seen.add(link);
      return true;
    }),
  ];
}
