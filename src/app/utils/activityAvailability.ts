// Kept identical in the customer and management apps: units or participant slots are
// shared by standalone services and service room add-ons in Philippine time.
// Packages have booking dates/participants but do not reserve timed inventory.
export type ActivityRecord = Record<string, any>;
export type ActivitySelection = {
  itemId: string;
  itemType: string;
  bookingDate: string;
  bookingTime: string;
  participants: number;
  quantity?: number;
};
export type ActivityReservation = {
  resourceKey: string;
  date: string;
  start: number;
  end: number;
  participants: number;
  quantity?: number;
  capacityType?: "units";
  allocationState?: "held" | "confirmed";
};
export type ActivityPolicy = {
  capacity: number;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  days: number[];
  capacityType?: "participants" | "units";
  participantsPerUnit?: number;
};

const activeStatuses = [
  "confirmed",
  "approved",
  "reserved",
  "checked-in",
  "checkedin",
  "occupied",
];
const status = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
export const activityKind = (item: ActivityRecord) =>
  status(item.itemType || item.bookingType || item.type || item.category) ===
  "package"
    ? "package"
    : "service";
export const activityKey = (item: ActivityRecord) =>
  `${activityKind(item)}:${item.id}`;
export const activityBookingKey = (booking: ActivityRecord) =>
  `${booking._bookingStore || "customer"}_${booking.id}`;
export function mergeActivityBookings(
  customer: ActivityRecord[],
  staff: ActivityRecord[],
): ActivityRecord[] {
  const references = new Set(
    customer.flatMap((booking) =>
      [booking.id, booking.bookingId, booking.bookingRef]
        .filter(Boolean)
        .map(String),
    ),
  );
  const seen = new Set<string>();
  return [
    ...customer,
    ...staff.filter((booking) => {
      const links = [booking.id, booking.bookingId, booking.bookingRef]
        .filter(Boolean)
        .map(String);
      if (links.some((link) => references.has(link) || seen.has(link)))
        return false;
      links.forEach((link) => seen.add(link));
      return true;
    }),
  ];
}
export function activityMinutes(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const raw = value.trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw))
    return Number(raw.slice(0, 2)) * 60 + Number(raw.slice(3));
  const twelve = raw.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(am|pm)$/i);
  return twelve
    ? ((Number(twelve[1]) % 12) + (twelve[3].toLowerCase() === "pm" ? 12 : 0)) *
        60 +
        Number(twelve[2])
    : NaN;
}
export function activityTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function activityTimeLabel(value: string): string {
  const minutes = activityMinutes(value);
  if (!Number.isFinite(minutes)) return value;
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}
export function activityDate(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function activityPolicy(item: ActivityRecord): ActivityPolicy | null {
  const raw = item.availability;
  if (
    !raw ||
    !Number.isInteger(raw.capacity) ||
    raw.capacity < 0 ||
    raw.capacity > 10000 ||
    !Number.isInteger(raw.durationMinutes) ||
    raw.durationMinutes < 1 ||
    raw.durationMinutes > 1440 ||
    !Number.isFinite(activityMinutes(raw.opensAt)) ||
    !Number.isFinite(activityMinutes(raw.closesAt)) ||
    activityMinutes(raw.opensAt) >= activityMinutes(raw.closesAt) ||
    raw.durationMinutes >
      activityMinutes(raw.closesAt) - activityMinutes(raw.opensAt) ||
    !Array.isArray(raw.days) ||
    !raw.days.length ||
    raw.days.some(
      (day: unknown) =>
        !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6,
    )
  )
    return null;
  if (
    raw.capacityType !== undefined &&
    !["participants", "units"].includes(raw.capacityType)
  )
    return null;
  if (
    raw.capacityType === "units" &&
    (!Number.isInteger(raw.participantsPerUnit) ||
      raw.participantsPerUnit < 1 ||
      raw.participantsPerUnit > 10000)
  )
    return null;
  return raw;
}
export function activityEnabled(item: ActivityRecord): boolean {
  return (
    item.available !== false &&
    item.isAvailable !== false &&
    item.deleted !== true &&
    (!item.status || ["active", "available"].includes(status(item.status)))
  );
}
function findActivity(
  id: string,
  kind: string,
  catalog: ActivityRecord[],
  name?: string,
): ActivityRecord | undefined {
  const normalized = id.replace(/^(service|package)-/, "");
  const exact = catalog.find(
    (item) => activityKind(item) === kind && String(item.id) === normalized,
  );
  if (exact) return exact;
  const matches = catalog.filter(
    (item) =>
      activityKind(item) === kind && name && status(item.name) === status(name),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function selectionReservations(
  selection: ActivitySelection,
  catalog: ActivityRecord[],
): ActivityReservation[] {
  const item = findActivity(selection.itemId, selection.itemType, catalog);
  if (!item)
    throw new Error("This activity no longer exists. Refresh the page.");
  // Packages are offers, not timed inventory resources. Their included-service
  // descriptions do not allocate equipment or participant slots.
  if (activityKind(item) === "package") return [];
  const policy = activityPolicy(item);
  if (!policy)
    throw new Error(
      `The schedule for ${item.name} has not been configured. Contact the resort.`,
    );
  if (!activityDate(selection.bookingDate))
    throw new Error("Choose a valid activity date.");
  if (
    !Number.isInteger(selection.participants) ||
    selection.participants < 1 ||
    selection.participants > 10000
  )
    throw new Error("Choose a valid number of participants.");
  const start = activityMinutes(selection.bookingTime),
    end = start + policy.durationMinutes;
  const weekday = new Date(`${selection.bookingDate}T00:00:00Z`).getUTCDay();
  if (
    !Number.isFinite(start) ||
    (start - activityMinutes(policy.opensAt)) % policy.durationMinutes !== 0
  )
    throw new Error(`Choose a scheduled session for ${item.name}.`);
  return [item].map((resource) => {
    const current = activityPolicy(resource);
    if (
      !activityEnabled(resource) ||
      !current ||
      !current.days.includes(weekday) ||
      start < activityMinutes(current.opensAt) ||
      end > activityMinutes(current.closesAt)
    )
      throw new Error(
        `${resource.name} is unavailable for this date and session.`,
      );
    const unitBased = current.capacityType === "units";
    const quantity =
      activityKey(resource) === activityKey(item)
        ? selection.quantity
        : Math.ceil(
            selection.participants / (current.participantsPerUnit || 1),
          );
    if (
      unitBased &&
      (!Number.isInteger(quantity) ||
        Number(quantity) < 1 ||
        Number(quantity) > 10000 ||
        selection.participants >
          Number(quantity) * current.participantsPerUnit!)
    )
      throw new Error(
        resource.name +
          ": choose a valid unit quantity that can accommodate the participants.",
      );
    return {
      resourceKey: activityKey(resource),
      date: selection.bookingDate,
      start,
      end,
      participants: selection.participants,
      ...(unitBased ? { quantity, capacityType: "units" as const } : {}),
    };
  });
}
export function activitySelections(
  booking: ActivityRecord,
): ActivitySelection[] {
  const selections: ActivitySelection[] = [];
  if (
    ["service", "package", "activity"].includes(
      status(booking.itemType || booking.bookingType),
    )
  )
    selections.push({
      itemId: String(
        booking.itemId ||
          booking.serviceId ||
          booking.packageId ||
          booking.roomId ||
          "",
      ),
      itemType: activityKind(booking),
      bookingDate: booking.bookingDate || booking.checkIn,
      bookingTime: booking.bookingTime,
      participants: Number(booking.participants ?? booking.guests ?? 1),
      ...(booking.quantity !== undefined
        ? { quantity: Number(booking.quantity) }
        : {}),
    });
  for (const item of booking.addOns || [])
    selections.push({
      itemId: String(item.id || item.serviceId || item.packageId || ""),
      itemType: activityKind(item),
      bookingDate: item.bookingDate || "",
      bookingTime: item.bookingTime || "",
      participants: Number(item.participants ?? 1),
      ...(item.quantity !== undefined
        ? { quantity: Number(item.quantity) }
        : {}),
    });
  return selections;
}
export function bookingActivityReservations(
  booking: ActivityRecord,
  catalog: ActivityRecord[],
) {
  for (const selection of activitySelections(booking).filter(
    (selection) => selection.itemType === "package",
  )) {
    if (
      !Number.isInteger(selection.participants) ||
      selection.participants < 1 ||
      selection.participants > 10000
    )
      throw new Error("Choose a valid whole number of package participants.");
    const item = findActivity(selection.itemId, "package", catalog);
    if (!item || !activityEnabled(item))
      throw new Error(
        "A selected package is unavailable. Refresh your selection.",
      );
  }
  const selections = activitySelections(booking).filter(
    (selection) => selection.itemType !== "package",
  );
  if (
    !["service", "package", "activity"].includes(
      status(booking.itemType || booking.bookingType),
    )
  ) {
    if (
      selections.some(
        (selection) =>
          selection.bookingDate < booking.checkIn ||
          selection.bookingDate > booking.checkOut,
      )
    )
      throw new Error("Choose activity dates within the room stay.");
  }
  return selections.flatMap((selection) =>
    selectionReservations(selection, catalog),
  );
}

export function readActivityPolicy(form: {
  get: (key: string) => unknown;
  getAll: (key: string) => unknown[];
}): ActivityPolicy {
  const availability = {
    capacity: Number(form.get("activityCapacity")),
    durationMinutes: Number(form.get("activityDuration")),
    opensAt: String(form.get("activityOpensAt") || ""),
    closesAt: String(form.get("activityClosesAt") || ""),
    days: [...new Set(form.getAll("activityDays").map(Number))],
  };
  const mode = String(form.get("activityCapacityType") || "participants");
  if (form.get("activityCapacityType"))
    Object.assign(availability, { capacityType: mode });
  if (mode === "units")
    Object.assign(availability, {
      participantsPerUnit: Number(form.get("activityParticipantsPerUnit")),
    });
  if (
    ["activityCapacity", "activityDuration"].some(
      (key) => !String(form.get(key) ?? "").trim(),
    ) ||
    !activityPolicy({ availability })
  )
    throw new Error(
      "Enter a whole participant capacity (0–10,000), valid operating hours and session length, and select at least one operating day.",
    );
  return availability;
}
export function activityOccupies(booking: ActivityRecord): boolean {
  const current = status(booking.status);
  if (activeStatuses.includes(current)) return true;
  // Hotel check-out does not cancel a scheduled activity on departure day.
  return (
    ["checked-out", "completed"].includes(current) &&
    !["service", "package", "activity"].includes(
      status(booking.itemType || booking.bookingType),
    )
  );
}
function legacyReservations(
  booking: ActivityRecord,
  catalog: ActivityRecord[],
): ActivityReservation[] {
  const allSelections = activitySelections(booking);
  const selections = allSelections.filter(
    (selection) => selection.itemType !== "package",
  );
  if (!selections.length)
    return allSelections.length ||
      !Array.isArray(booking.activityReservations) ||
      booking.activityReservations.some((entry: ActivityReservation) =>
        entry.resourceKey.startsWith("package:"),
      )
      ? []
      : booking.activityReservations;
  if (
    Array.isArray(booking.activityReservations) &&
    !allSelections.some((selection) => selection.itemType === "package")
  )
    return booking.activityReservations;
  return selections.flatMap((selection) => {
    const index = allSelections.indexOf(selection);
    try {
      const requests = selectionReservations(selection, catalog);
      // Older mixed room/package snapshots lack source metadata. Keep only
      // actual standalone service selections, preserving their longest matching
      // historical interval so removing packages cannot undersell service use.
      return requests.map((request) => {
        const originals: ActivityReservation[] = (
          booking.activityReservations || []
        ).filter(
          (entry: ActivityReservation) =>
            entry.resourceKey === request.resourceKey &&
            entry.date === request.date &&
            entry.start === request.start &&
            entry.participants === request.participants,
        );
        const original = originals.sort((a, b) => b.end - a.end)[0];
        return original
          ? { ...original, end: Math.max(original.end, request.end) }
          : request;
      });
    } catch {
      const addon =
        booking.addOns?.[
          index -
            (["service", "package", "activity"].includes(
              status(booking.itemType || booking.bookingType),
            )
              ? 1
              : 0)
        ];
      const item = findActivity(
        selection.itemId,
        selection.itemType,
        catalog,
        addon?.name ||
          booking.itemName ||
          booking.serviceName ||
          booking.packageName,
      );
      if (!item) return [];
      const dates: string[] = [];
      const startDate = selection.bookingDate || booking.checkIn;
      const endDate = selection.bookingDate || booking.checkOut || startDate;
      if (!activityDate(startDate) || !activityDate(endDate)) return [];
      for (
        let day = Date.parse(`${startDate}T00:00:00Z`), count = 0;
        day <= Date.parse(`${endDate}T00:00:00Z`) && count < 366;
        day += 86400000, count++
      )
        dates.push(new Date(day).toISOString().slice(0, 10));
      // Existing unscheduled reservations conservatively occupy the full day.
      const linked = [item];
      return dates.flatMap((date) =>
        linked.map((resource) => ({
          resourceKey: activityKey(resource),
          date,
          start: 0,
          end: 1440,
          participants: Math.max(1, Number(selection.participants) || 1),
        })),
      );
    }
  });
}
export function occupiedActivities(
  catalog: ActivityRecord[],
  bookings: ActivityRecord[],
  allocations: ActivityRecord = {},
  excludeKey = "",
): ActivityReservation[] {
  const result: ActivityReservation[] = [],
    seen = new Set<string>();
  for (const booking of bookings) {
    const key = activityBookingKey(booking);
    seen.add(key);
    if (key === excludeKey) continue;
    const allocation = allocations[key];
    const closed =
      ["cancelled", "canceled", "rejected"].includes(status(booking.status)) ||
      (["checked-out", "completed"].includes(status(booking.status)) &&
        !activityOccupies(booking));
    if (closed) continue;
    const legacyPackageAllocation = allocation?.requests?.some(
      (request: ActivityReservation) =>
        request.resourceKey.startsWith("package:"),
    );
    if (
      activitySelections(booking).length &&
      activitySelections(booking).every(
        (selection) => selection.itemType === "package",
      )
    )
      continue;
    if (allocation && legacyPackageAllocation) {
      if (activityOccupies(booking))
        result.push(...legacyReservations(booking, catalog));
    } else if (allocation) result.push(...allocationOccupied(allocation));
    else if (activityOccupies(booking))
      result.push(...legacyReservations(booking, catalog));
  }
  // A held operation must continue reserving places if its booking write fails
  // ambiguously; release requires checking the actual booking in the staff app.
  for (const [key, allocation] of Object.entries(allocations))
    if (key !== excludeKey && !seen.has(key))
      result.push(...allocationOccupied(allocation));
  return result;
}
function allocationOccupied(allocation: ActivityRecord): ActivityReservation[] {
  const requests =
    allocation.state === "held" && Array.isArray(allocation.occupiedRequests)
      ? allocation.occupiedRequests
      : allocation.requests;
  return requests.map((request: ActivityReservation) => ({
    ...request,
    allocationState: allocation.state === "held" ? "held" : "confirmed",
  }));
}
export const activityCapacityType = (item: ActivityRecord) =>
  activityPolicy(item)?.capacityType === "units" ? "units" : "participants";
export const activityCapacityLabel = (item: ActivityRecord) =>
  activityCapacityType(item) === "units" ? "units" : "participant slots";
export function reservationQuantity(entry: ActivityReservation) {
  const value = Number(
    entry.capacityType === "units" ? entry.quantity : entry.participants,
  );
  // Corrupt historical quantities must not create imaginary spare capacity.
  return Number.isInteger(value) && value >= 1 && value <= 10000
    ? value
    : 10000;
}

// Until an edit commits, protect the old and proposed schedules. On a shared
// interval the same booking uses the larger quantity, rather than counting twice.
export function heldActivityReservations(
  previous: ActivityReservation[],
  next: ActivityReservation[],
): ActivityReservation[] {
  const result: ActivityReservation[] = [];
  const keys = new Set(
    [...previous, ...next].map((entry) => entry.resourceKey + "|" + entry.date),
  );
  for (const key of keys) {
    const before = previous.filter(
      (entry) => entry.resourceKey + "|" + entry.date === key,
    );
    const after = next.filter(
      (entry) => entry.resourceKey + "|" + entry.date === key,
    );
    const entries = [...before, ...after],
      sample = entries[0];
    const points = [
      ...new Set(entries.flatMap((entry) => [entry.start, entry.end])),
    ].sort((a, b) => a - b);
    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index],
        end = points[index + 1];
      const sums = [before, after].map((values) =>
        values
          .filter((entry) => entry.start < end && entry.end > start)
          .reduce(
            (sum, entry) => ({
              quantity: sum.quantity + reservationQuantity(entry),
              participants: sum.participants + Number(entry.participants || 1),
            }),
            { quantity: 0, participants: 0 },
          ),
      );
      const quantity = Math.max(...sums.map((sum) => sum.quantity));
      if (!quantity) continue;
      result.push({
        resourceKey: sample.resourceKey,
        date: sample.date,
        start,
        end,
        participants:
          sample.capacityType === "units"
            ? Math.max(...sums.map((sum) => sum.participants))
            : quantity,
        ...(sample.capacityType === "units"
          ? { capacityType: "units", quantity }
          : {}),
      });
    }
  }
  return result;
}
function peakBreakdown(
  request: ActivityReservation,
  reservations: ActivityReservation[],
) {
  const events: { time: number; change: number; held: boolean }[] = [];
  for (const entry of reservations)
    if (
      entry.resourceKey === request.resourceKey &&
      entry.date === request.date &&
      entry.start < request.end &&
      entry.end > request.start
    ) {
      const count = reservationQuantity(entry),
        held = entry.allocationState === "held";
      events.push(
        { time: Math.max(entry.start, request.start), change: count, held },
        { time: Math.min(entry.end, request.end), change: -count, held },
      );
    }
  events.sort((a, b) => a.time - b.time || a.change - b.change);
  let confirmed = 0,
    held = 0,
    peak = 0,
    reserved = 0,
    processing = 0;
  for (const event of events) {
    if (event.held) held += event.change;
    else confirmed += event.change;
    if (confirmed + held > peak) {
      peak = confirmed + held;
      reserved = confirmed;
      processing = held;
    }
  }
  return { peak, reserved, held: processing };
}
const peakUsage = (
  request: ActivityReservation,
  reservations: ActivityReservation[],
) => peakBreakdown(request, reservations).peak;
function incompatibleCapacity(
  item: ActivityRecord,
  occupied: ActivityReservation[],
) {
  return occupied.some(
    (entry) =>
      entry.resourceKey === activityKey(item) &&
      (entry.capacityType || "participants") !== activityCapacityType(item),
  );
}
export function assertActivityCapacity(
  requests: ActivityReservation[],
  catalog: ActivityRecord[],
  occupied: ActivityReservation[],
): void {
  for (const request of requests) {
    const item = catalog.find(
      (item) => activityKey(item) === request.resourceKey,
    );
    const policy = item && activityPolicy(item);
    if (
      item &&
      incompatibleCapacity(
        item,
        occupied.filter(
          (entry) =>
            entry.date === request.date &&
            entry.start < request.end &&
            entry.end > request.start,
        ),
      )
    )
      throw new Error(
        item.name +
          ": existing reservations use a different counting mode. Review them before changing service units/slots.",
      );
    if (
      !policy ||
      peakUsage(request, [...occupied, ...requests]) > policy.capacity
    )
      throw new Error(
        `${item?.name || "Activity"} does not have enough available places for the selected session. Choose another time or fewer participants.`,
      );
  }
}
export function activitySession(
  item: ActivityRecord,
  date: string,
  time: string,
  catalog: ActivityRecord[],
  occupied: ActivityReservation[],
  now = Date.now(),
) {
  const policy = activityPolicy(item),
    total = policy?.capacity || 0,
    capacityType = activityCapacityType(item);
  try {
    const requests = selectionReservations(
      {
        itemId: item.id,
        itemType: activityKind(item),
        bookingDate: date,
        bookingTime: time,
        participants: 1,
        quantity: 1,
      },
      catalog,
    );
    const primary = requests[0],
      primaryUsage = peakBreakdown(primary, occupied);
    for (const request of requests) {
      const resource = catalog.find(
        (resource) => activityKey(resource) === request.resourceKey,
      )!;
      if (
        incompatibleCapacity(
          resource,
          occupied.filter(
            (entry) =>
              entry.date === request.date &&
              entry.start < request.end &&
              entry.end > request.start,
          ),
        )
      )
        throw new Error(
          "Existing reservations need a counting-mode review. Contact the resort.",
        );
    }
    let remaining = Math.max(0, total - primaryUsage.peak);
    for (const request of requests.slice(1)) {
      const resource = catalog.find(
          (resource) => activityKey(resource) === request.resourceKey,
        )!,
        current = activityPolicy(resource)!;
      const free = Math.max(0, current.capacity - peakUsage(request, occupied));
      if (capacityType === "participants")
        remaining = Math.min(
          remaining,
          current.capacityType === "units"
            ? free * current.participantsPerUnit!
            : free,
        );
      else if (free === 0) remaining = 0;
    }
    const started =
      Date.parse(date + "T" + activityTime(primary.start) + ":00+08:00") <= now;
    return {
      total,
      reserved: primaryUsage.reserved,
      held: primaryUsage.held,
      remaining: started ? 0 : remaining,
      capacityType,
      error: started
        ? "This session has already started. Choose a later time."
        : "",
      endTime: activityTime(primary.end),
      linkedLimited: remaining < Math.max(0, total - primaryUsage.peak),
    };
  } catch (error) {
    return {
      total,
      reserved: 0,
      held: 0,
      remaining: 0,
      capacityType,
      error:
        error instanceof Error
          ? error.message
          : "Unable to check activity availability.",
      endTime: "",
      linkedLimited: false,
    };
  }
}
export function activitySlots(item: ActivityRecord, date: string): string[] {
  if (activityKind(item) === "package") return [];
  const policy = activityPolicy(item);
  if (
    !policy ||
    !activityDate(date) ||
    !policy.days.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
  )
    return [];
  const result: string[] = [];
  for (
    let start = activityMinutes(policy.opensAt);
    start + policy.durationMinutes <= activityMinutes(policy.closesAt);
    start += policy.durationMinutes
  )
    result.push(activityTime(start));
  return result;
}

export function hasAvailableActivitySession(
  item: ActivityRecord,
  first: string,
  last: string,
  catalog: ActivityRecord[],
  occupied: ActivityReservation[],
  now = Date.now(),
) {
  if (!activityDate(first) || !activityDate(last) || last < first) return false;
  for (
    let day = Date.parse(first), count = 0;
    day <= Date.parse(last) && count < 366;
    day += 86400000, count++
  ) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (
      activitySlots(item, date).some(
        (time) =>
          activitySession(item, date, time, catalog, occupied, now).remaining >
          0,
      )
    )
      return true;
  }
  return false;
}

// A stay can span multiple independent sessions. Show the best single session,
// never sum equipment/slots across dates into misleading available inventory.
export function activityStayAvailability(
  item: ActivityRecord,
  first: string,
  last: string,
  catalog: ActivityRecord[],
  occupied: ActivityReservation[],
  now = Date.now(),
) {
  let best:
    | (ReturnType<typeof activitySession> & { date: string; time: string })
    | null = null;
  if (
    !activityDate(first) ||
    !activityDate(last) ||
    last < first ||
    activityKind(item) === "package"
  )
    return best;
  for (
    let day = Date.parse(first), count = 0;
    day <= Date.parse(last) && count < 366;
    day += 86400000, count++
  ) {
    const date = new Date(day).toISOString().slice(0, 10);
    for (const time of activitySlots(item, date)) {
      if (Date.parse(`${date}T${time}:00+08:00`) <= now) continue;
      const session = {
        ...activitySession(item, date, time, catalog, occupied, now),
        date,
        time,
      };
      if (
        !best ||
        session.remaining > best.remaining ||
        (best.error && !session.error)
      )
        best = session;
      if (
        !session.error &&
        session.total > 0 &&
        session.remaining === session.total
      )
        return session;
    }
  }
  return best;
}

export function activityAvailabilityRows(
  catalog: ActivityRecord[],
  occupied: ActivityReservation[],
  date: string,
  now = Date.now(),
) {
  return catalog.flatMap((item) =>
    activitySlots(item, date).map((time) => ({
      id: item.id,
      name: String(item.name || item.id),
      itemType: activityKind(item),
      date,
      time,
      label: activityCapacityLabel(item),
      ...activitySession(item, date, time, catalog, occupied, now),
    })),
  );
}

export function validateActivityPolicyChange(
  item: ActivityRecord,
  next: ActivityPolicy,
  catalog: ActivityRecord[],
  bookings: ActivityRecord[],
  allocations: ActivityRecord,
  now = Date.now(),
) {
  const key = activityKey(item),
    previousMode = activityCapacityType(item),
    nextMode = next.capacityType || "participants";
  const future = (request: ActivityReservation) =>
    request.resourceKey === key &&
    Date.parse(request.date + "T00:00:00+08:00") + request.end * 60000 > now;
  const occupied = occupiedActivities(catalog, bookings, allocations).filter(
    future,
  );
  const pending = bookings
    .filter((booking) =>
      ["pending", "pending-payment-verification"].includes(
        status(booking.status),
      ),
    )
    .map((booking) => ({ ...booking, status: "confirmed" }));
  if (
    previousMode !== nextMode &&
    (occupied.length || occupiedActivities(catalog, pending).some(future))
  )
    throw new Error(
      "Cannot change units/participant slots while this service has future reservations or pending requests. Complete or cancel them first.",
    );
  const peak = occupied.reduce(
    (maximum, request) =>
      Math.max(
        maximum,
        peakUsage({ ...request, start: 0, end: 1440 }, occupied),
      ),
    0,
  );
  if (next.capacity < peak)
    throw new Error(
      "Cannot reduce total capacity below " +
        peak +
        " already reserved or held. Existing bookings have been preserved.",
    );
  if (
    nextMode === "units" &&
    occupied.some(
      (request) =>
        request.participants >
        reservationQuantity(request) * next.participantsPerUnit!,
    )
  )
    throw new Error(
      "The participants per unit would be too small for an existing reservation.",
    );
}

export function pendingActivityReservations(
  catalog: ActivityRecord[],
  bookings: ActivityRecord[],
  allocations: ActivityRecord = {},
) {
  return occupiedActivities(
    catalog,
    bookings
      .filter(
        (booking) =>
          ["pending", "pending-payment-verification"].includes(
            status(booking.status),
          ) && !allocations[activityBookingKey(booking)],
      )
      .map((booking) => ({ ...booking, status: "confirmed" })),
  );
}
