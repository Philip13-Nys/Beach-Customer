import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";

import {
  collection,
  getDocs,
  query,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { customerDb } from "../components/firebase";

import {
  Star,
  ChevronRight,
  ChevronLeft,
  Waves,
  Shield,
  Award,
  Users,
  Anchor,
  ArrowRight,
  Bot,
  MapPin,
  Mail,
  CalendarDays,
  X,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

interface Room {
  id: string;
  name: string;
  type: string;
  images?: string[];
  image?: string;
  price: number;
  capacity: number;
  rating?: number;
  reviews?: number;
  available?: boolean;
}

interface Service {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  duration: string;
}

interface Review {
  id: string;
  guestName: string;
  guestAvatar?: string;
  roomName?: string;
  serviceName?: string;
  rating: number;
  comment: string;
  date: string;
}

interface Booking {
  id: string;
  checkIn?: unknown;
  checkOut?: unknown;
  status?: string;
  roomId?: string;
  roomTypeId?: string;
  guestName?: string;
  adults?: number;
  children?: number;
}

/* =========================================================
   HELPERS
========================================================= */

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseFirestoreDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();

    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  if (typeof value === "number") {
    const date = new Date(value);

    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function startOfDay(date: Date) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

function dateKey(date: Date) {
  return formatDateInput(date);
}

function addDays(date: Date, amount: number) {
  const d = new Date(date);

  d.setDate(d.getDate() + amount);

  return d;
}

function isBeforeDay(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function getDaysBetweenInclusive(start: Date, end: Date) {
  const days: string[] = [];

  let current = startOfDay(start);
  const finalDate = startOfDay(end);

  while (current <= finalDate) {
    days.push(dateKey(current));

    current = addDays(current, 1);
  }

  return days;
}

/*
 * Hotel nights exclude checkout date.
 *
 * Example:
 *
 * Check-in  Dec 17
 * Check-out Dec 23
 *
 * Nights:
 * Dec 17
 * Dec 18
 * Dec 19
 * Dec 20
 * Dec 21
 * Dec 22
 *
 * Total = 6 nights
 */
function getNightDates(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return [];

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }

  const dates: string[] = [];

  let current = startOfDay(start);
  const checkout = startOfDay(end);

  while (current < checkout) {
    dates.push(dateKey(current));

    current = addDays(current, 1);
  }

  return dates;
}

/* =========================================================
   STAR RATING
========================================================= */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

/* =========================================================
   PREMIUM MINI AVAILABILITY CALENDAR
========================================================= */

interface MiniCalendarProps {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
  unavailableDates: Set<string>;
  loading: boolean;
}

function MiniCalendar({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  unavailableDates,
  loading,
}: MiniCalendarProps) {
  const today = startOfDay(new Date());

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const selectedCheckIn = checkIn ? new Date(`${checkIn}T00:00:00`) : null;

  const selectedCheckOut = checkOut ? new Date(`${checkOut}T00:00:00`) : null;

  /* =======================================================
     SYNC CALENDAR WITH CHECK-IN
  ======================================================= */

  useEffect(() => {
    if (!checkIn) return;

    const selectedDate = new Date(`${checkIn}T00:00:00`);

    if (isNaN(selectedDate.getTime())) return;

    setCurrentMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
  }, [checkIn]);

  /* =======================================================
     CALENDAR DAYS
  ======================================================= */

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startingWeekday = firstDay.getDay();

    // Always render a complete 6-row / 42-cell calendar,
    // including the trailing days from the next month.
    const days: Date[] = [];

    for (let index = 0; index < 42; index++) {
      const dayNumber = index - startingWeekday + 1;
      days.push(new Date(year, month, dayNumber));
    }

    return days;
  }, [currentMonth]);

  /* =======================================================
     MONTH LABEL
  ======================================================= */

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  /* =======================================================
     NIGHT COUNT
  ======================================================= */

  const numberOfNights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);

    const difference = end.getTime() - start.getTime();

    if (difference <= 0) return 0;

    return Math.ceil(difference / (1000 * 60 * 60 * 24));
  }, [checkIn, checkOut]);

  /* =======================================================
     DATE HELPERS
  ======================================================= */

  const isUnavailable = (date: Date) => {
    return unavailableDates.has(dateKey(date));
  };

  const isPast = (date: Date) => {
    return isBeforeDay(date, today);
  };

  const isToday = (date: Date) => {
    return isSameDay(date, today);
  };

  const isSelectedCheckIn = (date: Date) => {
    return selectedCheckIn !== null && isSameDay(date, selectedCheckIn);
  };

  const isSelectedCheckOut = (date: Date) => {
    return selectedCheckOut !== null && isSameDay(date, selectedCheckOut);
  };

  const isInRange = (date: Date) => {
    if (!selectedCheckIn || !selectedCheckOut) {
      return false;
    }

    return date > selectedCheckIn && date < selectedCheckOut;
  };

  /* =======================================================
     DATE CLICK
  ======================================================= */

  const handleDateClick = (date: Date) => {
    if (isPast(date)) return;

    if (isUnavailable(date)) return;

    const value = dateKey(date);

    /*
     * No check-in yet.
     */
    if (!checkIn) {
      onCheckInChange(value);
      onCheckOutChange("");

      return;
    }

    /*
     * Both dates already exist.
     * Start a new selection.
     */
    if (checkIn && checkOut) {
      onCheckInChange(value);
      onCheckOutChange("");

      return;
    }

    /*
     * Clicked same/before check-in.
     * Make this the new check-in.
     */
    if (value <= checkIn) {
      onCheckInChange(value);
      onCheckOutChange("");

      return;
    }

    /*
     * Validate every night between
     * check-in and check-out.
     */
    const range = getDaysBetweenInclusive(
      new Date(`${checkIn}T00:00:00`),
      date,
    );

    const hasUnavailable = range.some((day) => unavailableDates.has(day));

    if (hasUnavailable) {
      onCheckInChange(value);
      onCheckOutChange("");

      return;
    }

    onCheckOutChange(value);
  };

  /* =======================================================
     MONTH NAVIGATION
  ======================================================= */

  const previousMonth = () => {
    const previous = new Date(currentMonth);

    previous.setMonth(previous.getMonth() - 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    if (previous >= thisMonth) {
      setCurrentMonth(previous);
    }
  };

  const nextMonth = () => {
    const next = new Date(currentMonth);

    next.setMonth(next.getMonth() + 1);

    setCurrentMonth(next);
  };

  const isCurrentMonth = () => {
    return (
      currentMonth.getFullYear() === today.getFullYear() &&
      currentMonth.getMonth() === today.getMonth()
    );
  };

  /* =======================================================
     FORMAT SELECTED DATE
  ======================================================= */

  const formatSelectedDate = (value: string) => {
    if (!value) return null;

    const date = new Date(`${value}T00:00:00`);

    if (isNaN(date.getTime())) return null;

    return {
      weekday: date.toLocaleDateString("en-US", {
        weekday: "short",
      }),
      month: date.toLocaleDateString("en-US", {
        month: "short",
      }),
      day: date.getDate(),
      year: date.getFullYear(),
    };
  };

  const formattedCheckIn = formatSelectedDate(checkIn);
  const formattedCheckOut = formatSelectedDate(checkOut);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(10,37,64,0.08)]">
      {/* TOP ACCENT */}

      <div className="h-1.5 bg-gradient-to-r from-[#ef7048] via-[#f58c65] to-[#0a2540]" />

      {/* HEADER */}

      <div className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1ec]">
              <CalendarDays className="h-5 w-5 text-[#ef7048]" />
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#ef7048]">
                Select your stay
              </p>

              <h3 className="mt-0.5 text-[16px] font-bold text-[#0a2540]">
                {monthLabel}
              </h3>
            </div>
          </div>

          {/* MONTH NAVIGATION */}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={previousMonth}
              disabled={isCurrentMonth()}
              aria-label="Previous month"
              className="
                flex h-9 w-9 items-center justify-center
                rounded-xl border border-slate-200
                bg-white text-slate-500
                transition-all
                hover:border-[#ef7048]
                hover:bg-[#fff7f3]
                hover:text-[#ef7048]
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="
                flex h-9 w-9 items-center justify-center
                rounded-xl border border-slate-200
                bg-white text-slate-500
                transition-all
                hover:border-[#ef7048]
                hover:bg-[#fff7f3]
                hover:text-[#ef7048]
              "
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SELECTED DATE SUMMARY */}

        <div className="mt-4 rounded-2xl bg-[#f7fafb] p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {/* CHECK IN */}

            <div
              className={`
                relative overflow-hidden rounded-xl px-3 py-2.5
                transition-all
                ${
                  checkIn
                    ? "bg-white shadow-sm ring-1 ring-[#ef7048]/20"
                    : "bg-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`
                    flex h-7 w-7 shrink-0 items-center justify-center
                    rounded-lg
                    ${
                      checkIn
                        ? "bg-[#0a2540] text-white"
                        : "bg-slate-200 text-slate-400"
                    }
                  `}
                >
                  <span className="text-[9px] font-bold">IN</span>
                </div>

                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Check-in
                  </p>

                  {formattedCheckIn ? (
                    <p className="truncate text-[11px] font-bold text-[#0a2540]">
                      {formattedCheckIn.month} {formattedCheckIn.day},{" "}
                      {formattedCheckIn.year}
                    </p>
                  ) : (
                    <p className="text-[10px] font-medium text-slate-400">
                      Select date
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* CHECK OUT */}

            <div
              className={`
                relative overflow-hidden rounded-xl px-3 py-2.5
                transition-all
                ${
                  checkOut
                    ? "bg-white shadow-sm ring-1 ring-[#ef7048]/20"
                    : "bg-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`
                    flex h-7 w-7 shrink-0 items-center justify-center
                    rounded-lg
                    ${
                      checkOut
                        ? "bg-[#0a2540] text-white"
                        : "bg-slate-200 text-slate-400"
                    }
                  `}
                >
                  <span className="text-[8px] font-bold">OUT</span>
                </div>

                <div className="min-w-0">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Check-out
                  </p>

                  {formattedCheckOut ? (
                    <p className="truncate text-[11px] font-bold text-[#0a2540]">
                      {formattedCheckOut.month} {formattedCheckOut.day},{" "}
                      {formattedCheckOut.year}
                    </p>
                  ) : (
                    <p className="text-[10px] font-medium text-slate-400">
                      {checkIn ? "Select date" : "After check-in"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOADING */}

      {loading && (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 sm:mx-6">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />

          <span className="text-[10px] font-medium text-blue-700">
            Checking room availability...
          </span>
        </div>
      )}

      {/* CALENDAR */}

      <div className="px-5 pb-5 sm:px-6">
        {/* WEEKDAYS */}

        <div className="mb-2 grid grid-cols-7">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
            <div
              key={day}
              className="
                py-2
                text-center
                text-[8px]
                font-bold
                uppercase
                tracking-wider
                text-slate-400
              "
            >
              {day}
            </div>
          ))}
        </div>

        {/* DATES */}
        <div className="overflow-hidden rounded-b-xl border-x border-b border-slate-200">
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const key = dateKey(date);

              const dateMonth = date.getMonth();
              const currentMonthNumber = currentMonth.getMonth();
              const dateYear = date.getFullYear();
              const currentYear = currentMonth.getFullYear();

              const isCurrentMonthDate =
                dateMonth === currentMonthNumber && dateYear === currentYear;

              const unavailable = isUnavailable(date);
              const past = isPast(date);
              const todayDate = isToday(date);

              const isCheckIn = isSelectedCheckIn(date);
              const isCheckOut = isSelectedCheckOut(date);
              const inRange = isInRange(date);

              const disabled = past || unavailable || !isCurrentMonthDate;

              return (
                <div
                  key={key}
                  className={`
                    relative min-h-[48px] border-b border-r border-slate-200
                    sm:min-h-[52px]
                    ${!isCurrentMonthDate ? "bg-slate-50" : "bg-white"}
                    ${inRange ? "bg-[#fff1ec]" : ""}
                  `}
                >
                  {/* BOOKED DATE HIGHLIGHT */}
                  {isCurrentMonthDate && unavailable && (
                    <div className="absolute inset-0 bg-red-50" />
                  )}

                  {/* SELECTED RANGE */}
                  {isCheckIn && selectedCheckOut && (
                    <div className="absolute inset-y-0 left-1/2 right-0 bg-[#fff1ec]" />
                  )}

                  {isCheckOut && selectedCheckIn && (
                    <div className="absolute inset-y-0 left-0 right-1/2 bg-[#fff1ec]" />
                  )}

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDateClick(date)}
                    className={`
                      relative z-10 flex h-full min-h-[48px] w-full flex-col
                      items-center justify-between px-1 py-1.5 transition
                      sm:min-h-[52px] sm:px-1.5
                      ${
                        !isCurrentMonthDate
                          ? "cursor-default text-slate-300"
                          : disabled
                            ? "cursor-not-allowed"
                            : "cursor-pointer hover:bg-[#fff7f3]"
                      }
                    `}
                  >
                    {/* DATE NUMBER */}
                    <span
                      className={`
                        flex h-6 w-6 items-center justify-center rounded-full
                        text-[10px] font-semibold sm:h-7 sm:w-7 sm:text-[11px]
                        ${
                          isCheckIn || isCheckOut
                            ? "bg-[#0a2540] text-white shadow-sm"
                            : todayDate
                              ? "bg-blue-600 text-white"
                              : unavailable
                                ? "text-red-400"
                                : isCurrentMonthDate
                                  ? "text-slate-700"
                                  : "text-slate-300"
                        }
                      `}
                    >
                      {date.getDate()}
                    </span>

                    {/* EVENT / STATUS INDICATOR */}
                    {isCurrentMonthDate && !isCheckIn && !isCheckOut && (
                      <div className="flex items-center gap-1">
                        <span
                          className={`
                            h-1.5 w-1.5 rounded-full
                            ${unavailable ? "bg-red-400" : "bg-emerald-400"}
                          `}
                        />

                        <span
                          className={`
                            hidden text-[7px] font-medium sm:block
                            ${unavailable ? "text-red-400" : "text-emerald-500"}
                          `}
                        >
                          {unavailable ? "Booked" : "Available"}
                        </span>
                      </div>
                    )}

                    {/* TODAY */}
                    {todayDate && !isCheckIn && !isCheckOut && (
                      <span className="absolute right-1 top-1 text-[5px] font-bold text-blue-600">
                        TODAY
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER INFO */}

      <div className="border-t border-slate-100 bg-[#fbfcfd] px-5 py-4 sm:px-6">
        {/* STEP 1 */}

        {!checkIn && !checkOut && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1ec]">
              <CalendarDays className="h-4 w-4 text-[#ef7048]" />
            </div>

            <div>
              <p className="text-[11px] font-bold text-[#0a2540]">
                Choose your check-in date
              </p>

              <p className="mt-0.5 text-[9px] text-slate-400">
                Click an available date to begin your stay.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2 */}

        {checkIn && !checkOut && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1ec]">
              <ChevronRight className="h-4 w-4 text-[#ef7048]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#0a2540]">
                Now choose your check-out
              </p>

              <p className="mt-0.5 text-[9px] text-slate-400">
                Select any available date after your check-in.
              </p>
            </div>

            <span className="rounded-full bg-[#fff1ec] px-2.5 py-1 text-[9px] font-bold text-[#ef7048]">
              Step 2
            </span>
          </div>
        )}

        {/* COMPLETED */}

        {checkIn && checkOut && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-emerald-600"
                ></svg>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#0a2540]">
                  Your stay is selected
                </p>

                <p className="mt-0.5 truncate text-[9px] text-slate-400">
                  {numberOfNights} {numberOfNights === 1 ? "night" : "nights"} ·{" "}
                  {formattedCheckIn?.month} {formattedCheckIn?.day} —{" "}
                  {formattedCheckOut?.month} {formattedCheckOut?.day}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onCheckInChange("");
                onCheckOutChange("");
              }}
              className="
                shrink-0
                rounded-lg
                px-2.5
                py-1.5
                text-[9px]
                font-bold
                text-slate-400
                transition
                hover:bg-slate-100
                hover:text-[#ef7048]
              "
            >
              Reset
            </button>
          </div>
        )}

        {/* LEGEND */}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[9px] text-slate-400">Available</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />

            <span className="text-[9px] text-slate-400">Booked</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0a2540]" />

            <span className="text-[9px] text-slate-400">Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TIME OPTIONS
========================================================= */

const TIME_OPTIONS = [
  "12:00 AM",
  "1:00 AM",
  "2:00 AM",
  "3:00 AM",
  "4:00 AM",
  "5:00 AM",
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
];

/* =========================================================
   MINICAL RESERVATION MODAL
========================================================= */

interface MinicalReservationModalProps {
  open: boolean;
  onClose: () => void;

  rooms: Room[];
  bookings: Booking[];

  checkIn: string;
  checkOut: string;
  guests: string;

  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
  onGuestsChange: (value: string) => void;
}

function MinicalReservationModal({
  open,
  onClose,
  rooms,
  bookings,
  checkIn,
  checkOut,
  guests,
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
}: MinicalReservationModalProps) {
  const [bookingType, setBookingType] = useState("Reservation");

  const [bookingSource, setBookingSource] = useState("Walk-in / Telephone");

  const [guestName, setGuestName] = useState("");

  const [children, setChildren] = useState("0");

  const [selectedRoomType, setSelectedRoomType] = useState("");

  const [selectedRoom, setSelectedRoom] = useState("");

  const [checkInTime, setCheckInTime] = useState("12:00 AM");

  const [checkOutTime, setCheckOutTime] = useState("12:00 AM");

  const [chargeType, setChargeType] = useState("Room Charge");

  const [rateType, setRateType] = useState("Nightly");

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const TAX_RATE = 0;

  /* =======================================================
     ROOM TYPES
  ======================================================= */

  const roomTypes = useMemo(() => {
    return Array.from(
      new Map(
        rooms.map((room) => [room.type || room.name, room.type || room.name]),
      ).values(),
    );
  }, [rooms]);

  /* =======================================================
     INITIAL ROOM TYPE
  ======================================================= */

  useEffect(() => {
    if (!selectedRoomType && roomTypes.length > 0) {
      setSelectedRoomType(roomTypes[0]);
    }
  }, [roomTypes, selectedRoomType]);

  /* =======================================================
     ROOM FILTER
  ======================================================= */

  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (room) => (room.type || room.name) === selectedRoomType,
    );
  }, [rooms, selectedRoomType]);

  /* =======================================================
     AUTO SELECT FIRST ROOM
  ======================================================= */

  useEffect(() => {
    if (!selectedRoomType) return;

    const matchingRoom = rooms.find(
      (room) => (room.type || room.name) === selectedRoomType,
    );

    if (matchingRoom) {
      setSelectedRoom(matchingRoom.id);
    } else {
      setSelectedRoom("");
    }
  }, [selectedRoomType, rooms]);

  /* =======================================================
     SELECTED ROOM
  ======================================================= */

  const selectedRoomData = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoom);
  }, [rooms, selectedRoom]);

  /* =======================================================
     NUMBER OF NIGHTS
  ======================================================= */

  const numberOfDays = useMemo(() => {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(`${checkIn}T00:00:00`);

    const end = new Date(`${checkOut}T00:00:00`);

    const difference = end.getTime() - start.getTime();

    if (difference <= 0) return 0;

    return Math.ceil(difference / (1000 * 60 * 60 * 24));
  }, [checkIn, checkOut]);

  /* =======================================================
     RATE CALCULATIONS
  ======================================================= */

  const nightlyRate = Number(selectedRoomData?.price || 0);

  const totalBeforeTax = nightlyRate * numberOfDays;

  const taxAmount = totalBeforeTax * TAX_RATE;

  const totalWithTax = totalBeforeTax + taxAmount;

  const averageRate = numberOfDays > 0 ? totalBeforeTax / numberOfDays : 0;

  /* =======================================================
     ROOM AVAILABILITY
  ======================================================= */

  const selectedRoomUnavailable = useMemo(() => {
    if (!selectedRoom || !checkIn || !checkOut) {
      return false;
    }

    const requestedNights = getNightDates(checkIn, checkOut);

    if (requestedNights.length === 0) {
      return false;
    }

    return bookings.some((booking) => {
      const status = String(booking.status || "confirmed").toLowerCase();

      if (
        status === "cancelled" ||
        status === "canceled" ||
        status === "rejected"
      ) {
        return false;
      }

      if (booking.roomId !== selectedRoom) {
        return false;
      }

      const bookingCheckIn = parseFirestoreDate(booking.checkIn);

      const bookingCheckOut = parseFirestoreDate(booking.checkOut);

      if (!bookingCheckIn || !bookingCheckOut) {
        return false;
      }

      const bookedNights = getNightDates(
        formatDateInput(bookingCheckIn),
        formatDateInput(bookingCheckOut),
      );

      return requestedNights.some((night) => bookedNights.includes(night));
    });
  }, [selectedRoom, checkIn, checkOut, bookings]);

  /* =======================================================
     CLOSE
  ======================================================= */

  if (!open) {
    return null;
  }

  /* =======================================================
     CREATE RESERVATION
  ======================================================= */

  const handleCreateReservation = async () => {
    if (saving) return;

    if (!guestName.trim()) {
      alert("Please enter the guest name.");
      return;
    }

    if (!checkIn) {
      alert("Please select a check-in date.");
      return;
    }

    if (!checkOut) {
      alert("Please select a check-out date.");
      return;
    }

    if (checkOut <= checkIn) {
      alert("Check-out must be after check-in.");
      return;
    }

    if (!selectedRoom) {
      alert("Please select a room.");
      return;
    }

    if (selectedRoomUnavailable) {
      alert(
        "This room is already booked for one or more of the selected nights. Please choose another room or date.",
      );

      return;
    }

    if (numberOfDays <= 0) {
      alert("The reservation must contain at least one night.");

      return;
    }

    try {
      setSaving(true);

      const reservation = {
        guestName: guestName.trim(),

        adults: Number(guests),

        children: Number(children),

        bookingType,

        bookingSource,

        checkIn,

        checkOut,

        checkInTime,

        checkOutTime,

        roomId: selectedRoom,

        roomTypeId:
          selectedRoomData?.type || selectedRoomData?.name || selectedRoomType,

        roomName: selectedRoomData?.name || "",

        chargeType,

        rateType,

        rate: nightlyRate,

        averageRate,

        numberOfDays,

        subtotal: totalBeforeTax,

        taxRate: TAX_RATE,

        taxAmount,

        total: totalWithTax,

        notes: notes.trim(),

        status: "confirmed",

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(customerDb, "bookings"), reservation);

      alert("Reservation created successfully!");

      setGuestName("");

      setChildren("0");

      setBookingType("Reservation");

      setBookingSource("Walk-in / Telephone");

      setCheckInTime("12:00 AM");

      setCheckOutTime("12:00 AM");

      setChargeType("Room Charge");

      setRateType("Nightly");

      setNotes("");

      onCheckInChange("");

      onCheckOutChange("");

      onClose();

      window.location.reload();
    } catch (error) {
      console.error("Error creating reservation:", error);

      alert("Unable to create reservation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}

        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5 sm:px-7">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">
              New Reservation
            </h2>

            <p className="text-xs text-slate-400">
              Create a new guest reservation
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTENT */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* BOOKING DETAIL */}

          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booking Detail
            </h3>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Booking Type
                </label>

                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option>Reservation</option>

                  <option>Walk-in</option>

                  <option>Group</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Booking Source
                </label>

                <select
                  value={bookingSource}
                  onChange={(e) => setBookingSource(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option>Walk-in / Telephone</option>

                  <option>Website</option>

                  <option>Booking.com</option>

                  <option>Agoda</option>

                  <option>Expedia</option>

                  <option>Travel Agent</option>
                </select>
              </div>
            </div>
          </div>

          {/* GUEST */}

          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Guest
            </h3>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_180px_180px]">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Guest
                </label>

                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Adults
                </label>

                <select
                  value={guests}
                  onChange={(e) => onGuestsChange(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((number) => (
                    <option key={number} value={number}>
                      {number} adult
                      {number > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Children
                </label>

                <select
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5].map((number) => (
                    <option key={number} value={number}>
                      {number} {number === 1 ? "Child" : "Children"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STAY DETAILS */}

          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stay Details
            </h3>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* CHECK IN */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Check-in Date
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="flex">
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => onCheckInChange(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-l-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                  />

                  <select
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="h-10 w-32 rounded-r-md border-y border-r border-slate-300 bg-white px-2 text-xs text-slate-600 outline-none"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CHECK OUT */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Check-out Date
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="flex">
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || undefined}
                    onChange={(e) => onCheckOutChange(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-l-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                  />

                  <select
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="h-10 w-32 rounded-r-md border-y border-r border-slate-300 bg-white px-2 text-xs text-slate-600 outline-none"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ROOM */}

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_130px]">
              {/* ROOM TYPE */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Room Type
                </label>

                <select
                  value={selectedRoomType}
                  onChange={(e) => setSelectedRoomType(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  {roomTypes.length === 0 && (
                    <option value="">No room types</option>
                  )}

                  {roomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* ROOM */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Room
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 ${
                    selectedRoomUnavailable
                      ? "border-red-400"
                      : "border-slate-300"
                  }`}
                >
                  <option value="">Select room</option>

                  {filteredRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                      {room.available === false ? " (Unavailable)" : ""}
                    </option>
                  ))}
                </select>

                {selectedRoomUnavailable && (
                  <p className="mt-1 text-[11px] text-red-500">
                    This room is booked for the selected dates.
                  </p>
                )}
              </div>

              {/* DAYS */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  No of Days
                </label>

                <input
                  value={numberOfDays}
                  readOnly
                  className="h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3 text-sm text-slate-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* CHARGES */}

          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Charges
            </h3>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_160px_1fr]">
              {/* CHARGE TYPE */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Charge Type
                </label>

                <div className="flex">
                  <select
                    value={chargeType}
                    onChange={(e) => setChargeType(e.target.value)}
                    className="h-10 flex-1 rounded-l-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option>Room Charge</option>

                    <option>Extra Charge</option>

                    <option>Package</option>
                  </select>

                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value)}
                    className="h-10 w-28 rounded-r-md border-y border-r border-slate-300 bg-white px-2 text-xs text-slate-600 outline-none"
                  >
                    <option>Nightly</option>

                    <option>Daily</option>

                    <option>Fixed</option>
                  </select>
                </div>
              </div>

              {/* RATE */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Rate
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    ₱
                  </span>

                  <input
                    value={nightlyRate}
                    readOnly
                    className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 pl-7 pr-3 text-sm text-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* TOTAL */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Total
                </label>

                <div className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3">
                  <span className="text-sm font-semibold text-slate-700">
                    ₱{totalBeforeTax.toLocaleString("en-PH")}
                  </span>

                  <span className="text-[11px] text-slate-400">
                    with tax: ₱{totalWithTax.toLocaleString("en-PH")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* AVERAGE RATE */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Average Rate
                </label>

                <input
                  value={`₱${Math.round(averageRate).toLocaleString("en-PH")}`}
                  readOnly
                  className="h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3 text-sm text-slate-600 outline-none"
                />
              </div>

              {/* TOTAL PRE TAX */}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Total Pre Tax
                </label>

                <div className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3">
                  <span className="text-sm text-slate-700">
                    ₱{totalBeforeTax.toLocaleString("en-PH")}
                  </span>

                  <span className="text-[11px] text-slate-400">
                    with tax: ₱{totalWithTax.toLocaleString("en-PH")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* NOTES */}

          <div className="px-5 py-6 sm:px-8">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Booking Notes
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Max. 2000 characters"
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-1 text-right text-[10px] text-slate-400">
              {notes.length}/2000
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreateReservation}
            disabled={saving}
            className="rounded-md bg-[#1677c8] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1268ae] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating Reservation..." : "Create Reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

export default function Landing() {
  const [checkIn, setCheckIn] = useState("");

  const [checkOut, setCheckOut] = useState("");

  const [guests, setGuests] = useState("2");

  const [reservationOpen, setReservationOpen] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);

  const [services, setServices] = useState<Service[]>([]);

  const [reviews, setReviews] = useState<Review[]>([]);

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);

  const [bookingLoading, setBookingLoading] = useState(true);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    const loadLandingData = async () => {
      try {
        const [
          roomsSnapshot,
          servicesSnapshot,
          reviewsSnapshot,
          bookingsSnapshot,
        ] = await Promise.all([
          getDocs(query(collection(customerDb, "roomTypes"), limit(6))),

          getDocs(query(collection(customerDb, "services"), limit(6))),

          getDocs(query(collection(customerDb, "reviews"), limit(2))),

          getDocs(collection(customerDb, "bookings")),
        ]);

        const roomData = roomsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Room[];

        const serviceData = servicesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Service[];

        const reviewData = reviewsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Review[];

        const bookingData = bookingsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];

        setRooms(roomData);

        setServices(serviceData);

        setReviews(reviewData);

        setBookings(bookingData);
      } catch (error) {
        console.error("Error loading landing page data:", error);
      } finally {
        setLoading(false);

        setBookingLoading(false);
      }
    };

    loadLandingData();
  }, []);

  /* =======================================================
     UNAVAILABLE DATES
  ======================================================= */

  const unavailableDates = useMemo(() => {
    const dates = new Set<string>();

    bookings.forEach((booking) => {
      const status = String(booking.status || "confirmed").toLowerCase();

      if (
        status === "cancelled" ||
        status === "canceled" ||
        status === "rejected"
      ) {
        return;
      }

      const start = parseFirestoreDate(booking.checkIn);

      const end = parseFirestoreDate(booking.checkOut);

      if (!start || !end) return;

      let current = startOfDay(start);

      const checkout = startOfDay(end);

      while (current < checkout) {
        dates.add(dateKey(current));

        current = addDays(current, 1);
      }
    });

    return dates;
  }, [bookings]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearch = () => {
    if (!checkIn) {
      alert("Please select a check-in date.");

      return;
    }

    if (!checkOut) {
      alert("Please select a check-out date.");

      return;
    }

    if (checkOut <= checkIn) {
      alert("Check-out must be after check-in.");

      return;
    }

    const range = getDaysBetweenInclusive(
      new Date(`${checkIn}T00:00:00`),
      new Date(`${checkOut}T00:00:00`),
    );

    const nights = range.slice(0, -1);

    const hasUnavailable = nights.some((date) => unavailableDates.has(date));

    if (hasUnavailable) {
      alert(
        "One or more selected nights are already booked. Please choose another date.",
      );

      return;
    }

    const params = new URLSearchParams();

    params.set("checkIn", checkIn);

    params.set("checkOut", checkOut);

    params.set("guests", guests);

    window.location.href = `/rooms?${params.toString()}`;
  };

  /* =======================================================
     OPEN RESERVATION
  ======================================================= */

  const openReservation = () => {
    setReservationOpen(true);
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="overflow-hidden bg-background">
      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative min-h-[calc(100vh-72px)] overflow-hidden">
        {/* BACKGROUND */}

        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2200&h=1400&fit=crop&auto=format)",
          }}
        >
          <div className="absolute inset-0 bg-[#06243b]/55" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#06243b]/85 via-[#06243b]/45 to-transparent" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#06243b]/80 via-transparent to-[#06243b]/20" />
        </div>

        {/* CONTENT */}

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1600px] items-center px-5 py-12 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid w-full grid-cols-1 items-center gap-10 xl:grid-cols-[1fr_520px]">
            {/* LEFT */}

            <div className="max-w-4xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-[#ef7048]" />

                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  Puerto Galera · Philippines
                </span>
              </div>

              <h1
                className="max-w-4xl text-white"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(3.5rem, 7vw, 7rem)",
                  lineHeight: 0.94,
                  fontWeight: 700,
                }}
              >
                Dive Into
                <br />
                <em className="font-normal">Paradise.</em>
              </h1>

              <p
                className="mt-5 max-w-2xl text-2xl text-white/90 sm:text-3xl"
                style={{
                  fontFamily: "var(--font-display)",
                }}
              >
                Wake Up to the Sea.
              </p>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                World-class diving, pristine white sand beaches, and luxurious
                island accommodations — all in one breathtaking destination.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur">
                  <Waves className="mr-2 inline h-4 w-4" />
                  50+ Dive Sites
                </div>

                <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur">
                  <Shield className="mr-2 inline h-4 w-4" />
                  Safety First
                </div>

                <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur">
                  <Award className="mr-2 inline h-4 w-4" />
                  Premium Service
                </div>
              </div>
            </div>

            {/* BOOKING PANEL */}

            <div className="w-full">
              <div className="overflow-hidden rounded-[28px] border border-white/30 bg-white/95 shadow-2xl backdrop-blur-xl">
                {/* HEADER */}

                <div className="border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef7048]">
                        Plan Your Stay
                      </div>

                      <h2
                        className="mt-1 text-2xl font-bold text-[#0a2540]"
                        style={{
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        Make a reservation
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a2540]">
                      <CalendarDays className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  {/* PREMIUM CALENDAR */}

                  <MiniCalendar
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onCheckInChange={setCheckIn}
                    onCheckOutChange={setCheckOut}
                    unavailableDates={unavailableDates}
                    loading={bookingLoading}
                  />

                  {/* GUESTS */}

                  <div className="mt-4">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Guests
                    </label>

                    <select
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#ef7048] focus:ring-2 focus:ring-[#ef7048]/20"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} Guest
                          {n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* RESERVATION */}

                  <button
                    type="button"
                    onClick={openReservation}
                    className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ef7048] px-5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#df5f38] hover:shadow-xl"
                  >
                    <CalendarDays className="h-5 w-5" />
                    Make Reservation
                  </button>

                  {/* SEARCH ROOMS */}

                  <button
                    type="button"
                    onClick={handleSearch}
                    className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-600 transition hover:border-[#ef7048] hover:text-[#ef7048]"
                  >
                    Browse Available Rooms
                  </button>

                  <p className="mt-3 text-center text-[10px] text-slate-400">
                    Select your dates and create your reservation directly from
                    the form.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          STATS
      ===================================================== */}

      <section className="relative z-10 bg-[#0a2540] text-white">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-white/10 md:grid-cols-4 md:divide-x">
          {[
            {
              value: "50+",
              label: "Dive Sites",
            },
            {
              value: "6",
              label: "Room Types",
            },
            {
              value: "2,000+",
              label: "Happy Guests",
            },
            {
              value: "4.9★",
              label: "Average Rating",
            },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-7 text-center lg:py-9">
              <div
                className="text-3xl font-bold text-[#ef7048] lg:text-4xl"
                style={{
                  fontFamily: "var(--font-display)",
                }}
              >
                {stat.value}
              </div>

              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          ROOMS
      ===================================================== */}

      <section className="mx-auto max-w-[1600px] px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#ef7048]">
              Accommodations
            </p>

            <h2
              className="text-4xl font-bold text-[#0a2540] lg:text-5xl"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Your Home By the Sea
            </h2>
          </div>

          <Link
            to="/rooms"
            className="hidden items-center gap-1.5 text-sm font-medium text-[#0a2540] transition hover:text-[#ef7048] sm:flex"
          >
            View all rooms
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-96 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
            {rooms.slice(0, 3).map((room) => {
              const roomImage =
                room.images?.[0] ||
                room.image ||
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800";

              return (
                <Link
                  key={room.id}
                  to={`/rooms/${room.id}`}
                  className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="relative h-72 overflow-hidden">
                    <img
                      src={roomImage}
                      alt={room.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />

                    <div className="absolute left-4 top-4">
                      <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold capitalize text-[#0a2540] backdrop-blur">
                        {room.type?.replace("-", " ")}
                      </span>
                    </div>

                    {room.available === false && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white">
                          Fully Booked
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3
                      className="text-xl font-semibold text-[#0a2540]"
                      style={{
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {room.name}
                    </h3>

                    <div className="mt-2 flex items-center gap-2">
                      <StarRating rating={room.rating || 0} />

                      <span className="text-xs text-slate-400">
                        ({room.reviews || 0})
                      </span>
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-[#ef7048]">
                          ₱{Number(room.price || 0).toLocaleString("en-PH")}
                        </span>

                        <span className="ml-1 text-xs text-slate-400">
                          /night
                        </span>
                      </div>

                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Users className="h-4 w-4" />
                        Up to {room.capacity}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================
          ACTIVITIES
      ===================================================== */}

      <section className="bg-[#f3f8fa]">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#ef7048]">
                Experiences
              </p>

              <h2
                className="text-4xl font-bold text-[#0a2540] lg:text-5xl"
                style={{
                  fontFamily: "var(--font-display)",
                }}
              >
                Island Adventures
              </h2>
            </div>

            <Link
              to="/services"
              className="hidden items-center gap-1.5 text-sm font-medium text-[#0a2540] transition hover:text-[#ef7048] sm:flex"
            >
              All activities
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((service) => (
              <Link
                key={service.id}
                to="/services"
                className="group relative h-80 overflow-hidden rounded-3xl shadow-sm transition hover:shadow-2xl"
              >
                <img
                  src={service.image}
                  alt={service.name}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="text-xs uppercase tracking-wider text-white/60">
                    {service.category}
                  </span>

                  <h3
                    className="mt-1 text-2xl font-semibold text-white"
                    style={{
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {service.name}
                  </h3>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold text-[#ef7048]">
                      ₱{Number(service.price || 0).toLocaleString("en-PH")}
                    </span>

                    <span className="text-xs text-white/70">
                      {service.duration}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY US
      ===================================================== */}

      <section className="mx-auto max-w-[1600px] px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#ef7048]">
            Why Sabang Beach and Diving Resorts
          </p>

          <h2
            className="text-4xl font-bold text-[#0a2540] lg:text-5xl"
            style={{
              fontFamily: "var(--font-display)",
            }}
          >
            The Difference Is in the Details
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Anchor,
              title: "PADI-Certified Diving",
              desc: "Expert dive masters with 15+ years guiding guests through 50+ local dive sites.",
            },
            {
              icon: Shield,
              title: "Safety First",
              desc: "International safety standards, first aid certified staff, and emergency protocols at every activity.",
            },
            {
              icon: Award,
              title: "Award-Winning Service",
              desc: "TripAdvisor Certificate of Excellence for 5 consecutive years.",
            },
            {
              icon: Waves,
              title: "Pristine Location",
              desc: "Nestled in a protected marine sanctuary with unparalleled biodiversity.",
            },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf5f7]">
                <item.icon className="h-7 w-7 text-[#0a2540]" />
              </div>

              <h3
                className="mb-2 text-lg font-semibold text-[#0a2540]"
                style={{
                  fontFamily: "var(--font-display)",
                }}
              >
                {item.title}
              </h3>

              <p className="text-sm leading-relaxed text-slate-500">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          REVIEWS
      ===================================================== */}

      <section className="bg-[#0a2540] text-white">
        <div className="mx-auto max-w-[1600px] px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#ef7048]">
              Guest Stories
            </p>

            <h2
              className="text-4xl font-bold lg:text-5xl"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              What Our Guests Say
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {reviews.slice(0, 2).map((review) => (
              <div
                key={review.id}
                className="rounded-3xl border border-white/10 bg-white/10 p-7 backdrop-blur"
              >
                <div className="mb-5 flex items-center gap-3">
                  <img
                    src={
                      review.guestAvatar ||
                      "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(review.guestName)
                    }
                    alt={review.guestName}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-[#ef7048]/50"
                  />

                  <div>
                    <div className="text-sm font-semibold">
                      {review.guestName}
                    </div>

                    <div className="text-xs text-white/50">
                      {review.roomName || review.serviceName}
                    </div>
                  </div>

                  <div className="ml-auto flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i <= review.rating
                            ? "fill-[#ef7048] text-[#ef7048]"
                            : "text-white/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm italic leading-relaxed text-white/80">
                  "{review.comment}"
                </p>

                <p className="mt-4 text-xs text-white/40">{review.date}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/reviews"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Read all reviews
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          AI
      ===================================================== */}

      <section className="mx-auto max-w-[1600px] px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col items-center gap-10 rounded-[32px] border border-slate-200 bg-gradient-to-br from-[#edf5f7] to-white p-8 md:flex-row md:p-12">
          <div className="flex-1">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0a2540]">
              <Bot className="h-8 w-8 text-white" />
            </div>

            <h2
              className="mb-3 text-3xl font-bold text-[#0a2540]"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Meet Your AI Travel Assistant
            </h2>

            <p className="mb-5 max-w-xl text-sm leading-relaxed text-slate-500">
              Not sure what to book? Our AI concierge helps you find the perfect
              room and activities based on your preferences, budget, and travel
              dates.
            </p>

            <Link
              to="/ai-assistant"
              className="inline-flex items-center gap-2 rounded-full bg-[#0a2540] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#123b5d]"
            >
              Chat with AI Assistant
              <Bot className="h-4 w-4" />
            </Link>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#0a2540] px-3 py-2 text-xs text-white">
                  I want a romantic beachfront room for 3 nights in June.
                </div>
              </div>

              <div className="flex">
                <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a2540]">
                  <Bot className="h-4 w-4 text-white" />
                </div>

                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  I can help you find the perfect beachfront room and check
                  available dates.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          CONTACT
      ===================================================== */}

      <section className="bg-slate-100">
        <div className="mx-auto max-w-[1600px] px-5 py-16 text-center sm:px-8 lg:px-12 xl:px-16">
          <h2
            className="mb-3 text-3xl font-bold text-[#0a2540]"
            style={{
              fontFamily: "var(--font-display)",
            }}
          >
            Need Help Planning Your Stay?
          </h2>

          <p className="mb-8 text-sm text-slate-500">
            Our team is available 7 days a week to assist you.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="tel:+63485550192"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-[#0a2540] transition hover:shadow-md"
            >
              +63 48 555 0192
            </a>

            <a
              href="mailto:hello@SabangBeach.ph"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-[#0a2540] transition hover:shadow-md"
            >
              <Mail className="h-4 w-4" />
              hello@SabangBeach.ph
            </a>

            <Link
              to="/inquiries"
              className="flex items-center gap-2 rounded-full bg-[#ef7048] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#df5f38]"
            >
              <MapPin className="h-4 w-4" />
              Send a Message
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          RESERVATION MODAL
      ===================================================== */}

      <MinicalReservationModal
        open={reservationOpen}
        onClose={() => setReservationOpen(false)}
        rooms={rooms}
        bookings={bookings}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        onCheckInChange={setCheckIn}
        onCheckOutChange={setCheckOut}
        onGuestsChange={setGuests}
      />
    </div>
  );
}
