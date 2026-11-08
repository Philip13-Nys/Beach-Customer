import {
  activityCapacityLabel,
  activityDate,
  activityKind,
  activityPolicy,
  activitySession,
  activityStayAvailability,
  activityTimeLabel,
  type ActivityRecord,
  type ActivityReservation,
} from "../utils/activityAvailability";

export default function ServiceAddOnAvailability({
  item,
  firstDate,
  lastDate,
  catalog,
  occupied,
  selected,
  loading,
  error,
}: {
  item: ActivityRecord;
  firstDate: string;
  lastDate: string;
  catalog: ActivityRecord[];
  occupied: ActivityReservation[];
  selected?: { bookingDate: string; bookingTime: string };
  loading: boolean;
  error: string;
}) {
  if (activityKind(item) === "package") return null;
  const policy = activityPolicy(item);
  let message = "",
    detail = "",
    available = false;
  if (loading) message = "Checking service availability...";
  else if (error) message = "Unable to check service availability.";
  else if (!policy) message = "Schedule not configured.";
  else if (
    !activityDate(firstDate) ||
    !activityDate(lastDate) ||
    lastDate < firstDate
  )
    message = "Choose stay dates to check availability.";
  else if (
    selected?.bookingTime &&
    (selected.bookingDate < firstDate || selected.bookingDate > lastDate)
  )
    message = "Select a session within your stay.";
  else {
    const session = selected?.bookingTime
      ? {
          ...activitySession(
            item,
            selected.bookingDate,
            selected.bookingTime,
            catalog,
            occupied,
          ),
          date: selected.bookingDate,
          time: selected.bookingTime,
        }
      : activityStayAvailability(item, firstDate, lastDate, catalog, occupied);
    if (!session) message = "No remaining sessions for these dates.";
    else if (session.error) message = session.error;
    else {
      available = session.remaining > 0;
      message = `${selected?.bookingTime ? "" : "Up to "}${session.remaining} of ${session.total} ${activityCapacityLabel(item)} available${selected?.bookingTime ? "" : " per session"}${available ? "" : session.total ? " · Fully booked" : " · Unavailable"}`;
      detail = `${selected?.bookingTime ? "Selected" : "Best availability"}: ${session.date} · ${activityTimeLabel(session.time)}`;
    }
  }
  return (
    <span
      role="status"
      aria-live="polite"
      className={`mt-1 block text-xs leading-relaxed ${loading || !policy ? "text-muted-foreground" : available ? "text-green-700" : "text-amber-700"}`}
    >
      {message}
      {detail && (
        <span className="block text-[11px] text-muted-foreground">
          {detail}
        </span>
      )}
    </span>
  );
}
