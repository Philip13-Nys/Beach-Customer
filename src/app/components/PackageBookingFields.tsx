import type { ActivitySchedule } from "./ActivitySchedulePicker";

export default function PackageBookingFields({
  name,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  showDate = true,
}: {
  name: string;
  value: ActivitySchedule;
  onChange: (value: ActivitySchedule) => void;
  minDate: string;
  maxDate?: string;
  disabled?: boolean;
  showDate?: boolean;
}) {
  const update = (changes: Partial<ActivitySchedule>) =>
    onChange({
      bookingDate: value.bookingDate,
      participants: value.participants,
      ...changes,
      bookingTime: "",
    });
  return (
    <fieldset
      disabled={disabled}
      className="my-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {showDate && (
        <label className="text-xs">
          Booking date
          <input
            aria-label={`${name} booking date`}
            type="date"
            min={minDate}
            max={maxDate}
            value={value.bookingDate}
            onChange={(event) => update({ bookingDate: event.target.value })}
            className="mt-1 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
      )}
      <label className="text-xs">
        Participants
        <input
          aria-label={`${name} participants`}
          type="number"
          min={1}
          max={100}
          step={1}
          value={value.participants}
          onChange={(event) =>
            update({ participants: Number(event.target.value) })
          }
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
    </fieldset>
  );
}
