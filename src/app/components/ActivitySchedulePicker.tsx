import {
  activityCapacityLabel,
  activityPolicy,
  activitySession,
  activitySlots,
  activityTimeLabel,
  type ActivityRecord,
  type ActivityReservation,
} from "../utils/activityAvailability";

export type ActivitySchedule = {
  bookingDate: string;
  bookingTime: string;
  participants: number;
  quantity?: number;
};
export default function ActivitySchedulePicker({
  item,
  value,
  onChange,
  catalog,
  occupied,
  loading,
  error,
  minDate,
  maxDate,
  disabled = false,
}: {
  item: ActivityRecord;
  value: ActivitySchedule;
  onChange: (value: ActivitySchedule) => void;
  catalog: ActivityRecord[];
  occupied: ActivityReservation[];
  loading: boolean;
  error: string;
  minDate: string;
  maxDate?: string;
  disabled?: boolean;
}) {
  const policy = activityPolicy(item);
  const unitBased = policy?.capacityType === "units";
  const selectedValue = unitBased
    ? { ...value, quantity: value.quantity ?? 1 }
    : value;
  const requested = unitBased ? selectedValue.quantity! : value.participants;
  const session = activitySession(
    item,
    value.bookingDate,
    value.bookingTime,
    catalog,
    occupied,
  );
  return (
    <fieldset
      disabled={disabled || loading || Boolean(error)}
      className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3"
    >
      <legend className="px-1 text-xs font-medium">
        Activity schedule · Philippine time
      </legend>
      {!policy && (
        <p role="status" className="text-xs text-amber-700">
          Schedule not configured. Contact the resort before booking this
          activity.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Checking available sessions...
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Date
          <input
            aria-label={`${item.name} date`}
            type="date"
            min={minDate}
            max={maxDate}
            value={value.bookingDate}
            onChange={(event) =>
              onChange({
                ...selectedValue,
                bookingDate: event.target.value,
                bookingTime: "",
              })
            }
            className="mt-1 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs">
          Session
          <select
            aria-label={`${item.name} session`}
            value={value.bookingTime}
            disabled={!value.bookingDate || !policy}
            onChange={(event) =>
              onChange({ ...selectedValue, bookingTime: event.target.value })
            }
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {!value.bookingDate ? "Choose a date" : "Choose a session"}
            </option>
            {activitySlots(item, value.bookingDate).map((time) => {
              const available = activitySession(
                item,
                value.bookingDate,
                time,
                catalog,
                occupied,
              );
              return (
                <option
                  key={time}
                  value={time}
                  disabled={
                    available.remaining < requested || Boolean(available.error)
                  }
                >
                  {activityTimeLabel(time)} –{" "}
                  {activityTimeLabel(available.endTime)} ·{" "}
                  {available.error
                    ? "Unavailable"
                    : `${available.remaining} of ${available.total} available`}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {unitBased && (
        <label className="block text-xs">
          Units to reserve
          <input
            aria-label={`${item.name} units`}
            type="number"
            min={1}
            max={session.error ? policy.capacity : session.remaining}
            value={selectedValue.quantity}
            onChange={(event) =>
              onChange({
                ...selectedValue,
                quantity: Math.max(
                  1,
                  Math.min(10000, Number(event.target.value) || 1),
                ),
              })
            }
            className="ml-2 w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm"
          />
        </label>
      )}
      <label className="block text-xs">
        Participants
        <input
          aria-label={`${item.name} participants`}
          type="number"
          min={1}
          max={Math.min(
            100,
            unitBased
              ? requested * policy.participantsPerUnit!
              : policy?.capacity || 100,
          )}
          value={value.participants}
          onChange={(event) =>
            onChange({
              ...selectedValue,
              participants: Math.max(
                1,
                Math.min(100, Number(event.target.value) || 1),
              ),
            })
          }
          className="ml-2 w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm"
        />
      </label>
      {unitBased && (
        <p className="text-[11px] text-muted-foreground">
          Up to {policy.participantsPerUnit} participants per unit. Prices
          remain per participant.
        </p>
      )}
      {value.bookingTime && (
        <p
          role="status"
          className={`text-xs ${session.error || session.remaining < requested || (unitBased && value.participants > requested * policy.participantsPerUnit!) ? "text-red-700" : "text-green-700"}`}
        >
          {session.error ||
            `${session.remaining} of ${session.total} available (${activityCapacityLabel(item)}). Reserved: ${session.reserved}; confirmation in progress: ${session.held}.${session.remaining < requested ? " Choose a smaller quantity or another session." : ""}${unitBased && value.participants > requested * policy.participantsPerUnit! ? " Select enough units for the participants." : ""}`}
        </p>
      )}
      {policy && (
        <p className="text-[11px] text-muted-foreground">
          {policy.durationMinutes}-minute sessions. Availability is subject to
          receptionist confirmation.
        </p>
      )}
    </fieldset>
  );
}
