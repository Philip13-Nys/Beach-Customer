import { Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { customerDb, db } from "../components/firebase";
import {
  Star,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Waves,
  Shield,
  Award,
  Users,
  Anchor,
  ArrowRight,
  Bot,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

interface Room {
  id: string;
  name: string;
  type?: string;
  images?: string[];
  image?: string;
  price: number;
  capacity: number;
  rating?: number;
  reviews?: number;
  available?: boolean;
  count?: number;
  quantity?: number;
  totalRooms?: number;
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

interface FirestoreRoom {
  id: string;
  roomTypeId?: any;
  typeId?: any;
  roomType?: any;
  roomTypeName?: string;
  type?: any;
  status?: string;
  isAvailable?: boolean;
}

interface FirestoreBooking {
  id: string;
  roomTypeId?: any;
  typeId?: any;
  roomType?: any;
  roomTypeName?: string;
  roomName?: string;
  room?: any;
  roomQuantity?: number;
  roomsBooked?: number;
  quantity?: number;
  checkIn?: any;
  checkOut?: any;
  status?: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateOnly = (value: any): string => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value?.toDate && typeof value.toDate === "function") {
    return toLocalDateString(value.toDate());
  }

  if (value instanceof Date) {
    return toLocalDateString(value);
  }

  return "";
};

const getCalendarDays = (month: Date) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const startOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
};

const normalize = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    return normalize(
      obj.id ??
        obj.roomTypeId ??
        obj.typeId ??
        obj.name ??
        obj.roomTypeName ??
        obj.value,
    );
  }

  return String(value).trim().toLowerCase();
};

const isCancelledBooking = (status = "") =>
  ["cancelled", "canceled", "rejected", "declined"].includes(normalize(status));

const isRoomBookable = (room: FirestoreRoom) => {
  if (room.isAvailable === false) return false;

  const status = normalize(room.status);

  return ![
    "maintenance",
    "inactive",
    "deleted",
    "unavailable",
    "occupied",
    "reserved",
    "out of service",
    "out-of-service",
  ].includes(status);
};

const getRoomTypeKeys = (roomType: Room) => {
  return [roomType.id, roomType.name].map(normalize).filter(Boolean);
};

const matchesRoomType = (record: Record<string, any>, roomType: Room) => {
  const keys = getRoomTypeKeys(roomType);

  const values = [
    record.roomTypeId,
    record.typeId,
    record.roomType,
    record.roomTypeName,
    record.roomName,
    record.room,
  ]
    .map(normalize)
    .filter(Boolean);

  return values.some((value) => keys.includes(value));
};

const getInventoryCount = (roomType: Room, inventoryRooms: FirestoreRoom[]) => {
  const matchingRooms = inventoryRooms.filter((room) =>
    matchesRoomType(room, roomType),
  );

  if (matchingRooms.length > 0) {
    return matchingRooms.filter(isRoomBookable).length;
  }

  return Math.max(
    0,
    Number(roomType.count ?? roomType.quantity ?? roomType.totalRooms ?? 0) ||
      0,
  );
};

const getBookedCount = (
  roomType: Room,
  bookings: FirestoreBooking[],
  date: string,
) => {
  return bookings.reduce((total, booking) => {
    if (isCancelledBooking(String(booking.status ?? ""))) {
      return total;
    }

    if (!matchesRoomType(booking, roomType)) {
      return total;
    }

    const checkInDate = getDateOnly(booking.checkIn);
    const checkOutDate = getDateOnly(booking.checkOut);

    if (!checkInDate || !checkOutDate) return total;

    if (!(checkInDate <= date && checkOutDate > date)) {
      return total;
    }

    const quantity = Number(
      booking.roomQuantity ?? booking.roomsBooked ?? booking.quantity ?? 1,
    );

    return total + Math.max(1, quantity || 1);
  }, 0);
};
export default function Landing() {
  const navigate = useNavigate();

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [rooms, setRooms] = useState<Room[]>([]);

  const [availabilityRoomTypes, setAvailabilityRoomTypes] = useState<Room[]>(
    [],
  );

  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [inventoryRooms, setInventoryRooms] = useState<FirestoreRoom[]>([]);
  const [bookings, setBookings] = useState<FirestoreBooking[]>([]);

  const [loading, setLoading] = useState(true);
  const [calendarDataLoading, setCalendarDataLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const todayString = toLocalDateString(new Date());

  useEffect(() => {
    let isMounted = true;

    const loadLandingData = async () => {
      try {
        const [
          roomTypesSnapshot,
          servicesSnapshot,
          reviewsSnapshot,
          inventorySnapshot,
          bookingsSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "roomTypes")),
          getDocs(query(collection(db, "services"), limit(6))),
          getDocs(query(collection(db, "reviews"), limit(2))),

          getDocs(collection(db, "rooms")),

          getDocs(collection(customerDb, "Bookings")),
        ]);

        if (!isMounted) return;

        const allRoomTypes = roomTypesSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Room[];

        setAvailabilityRoomTypes(allRoomTypes);
        setRooms(allRoomTypes.slice(0, 6));

        setServices(
          servicesSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Service[],
        );

        setReviews(
          reviewsSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Review[],
        );

        setInventoryRooms(
          inventorySnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as FirestoreRoom[],
        );

        setBookings(
          bookingsSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as FirestoreBooking[],
        );
      } catch (error) {
        console.error("Error loading landing page data:", error);

        if (isMounted) {
          setAvailabilityError("Unable to load room availability right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setCalendarDataLoading(false);
        }
      }
    };

    loadLandingData();

    return () => {
      isMounted = false;
    };
  }, []);

  const changeCalendarMonth = (amount: number) => {
    setCalendarMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() + amount, 1);
    });
  };

  const handleSelectDate = (dateString: string) => {
    setAvailabilityError("");

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateString);
      setCheckOut("");
      return;
    }

    if (dateString <= checkIn) {
      setCheckIn(dateString);
      setCheckOut("");
      return;
    }

    setCheckOut(dateString);
  };

  const calendarDays = getCalendarDays(calendarMonth);

  const monthLabel = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const getAvailableTypeCount = (dateString: string) => {
    return availabilityRoomTypes.filter((roomType) => {
      const inventoryCount = getInventoryCount(roomType, inventoryRooms);

      if (inventoryCount <= 0) return false;

      const bookedCount = getBookedCount(roomType, bookings, dateString);

      return inventoryCount - bookedCount > 0;
    }).length;
  };

  const handleSearch = async () => {
    setAvailabilityError("");

    if (!checkIn || !checkOut) {
      setAvailabilityError("Please select your check-in and check-out dates.");
      return;
    }

    if (checkIn < todayString) {
      setAvailabilityError("Please select today or a future check-in date.");
      return;
    }

    if (checkOut <= checkIn) {
      setAvailabilityError("Check-out must be after check-in.");
      return;
    }

    setCheckingAvailability(true);

    try {
      const [roomTypesSnapshot, inventorySnapshot, bookingsSnapshot] =
        await Promise.all([
          getDocs(collection(db, "roomTypes")),
          getDocs(collection(db, "rooms")),
          getDocs(collection(customerDb, "Bookings")),
        ]);

      const currentRoomTypes = roomTypesSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Use the same Firestore field mapping during a fresh search.
          price: Number(data.basePrice ?? data.price ?? 0),
          capacity: Number(data.maxGuests ?? data.capacity ?? 0),
          count: Number(data.count ?? data.quantity ?? data.totalRooms ?? 0),
        };
      }) as Room[];

      const currentInventory = inventorySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FirestoreRoom[];

      const currentBookings = bookingsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FirestoreBooking[];

      // Keep the calendar in sync with the latest Firestore data.
      setAvailabilityRoomTypes(currentRoomTypes);
      setInventoryRooms(currentInventory);
      setBookings(currentBookings);

      const availableRoomTypeIds = currentRoomTypes
        .filter((roomType) => {
          const inventoryCount = getInventoryCount(roomType, currentInventory);

          if (inventoryCount <= 0) return false;

          const cursor = new Date(`${checkIn}T00:00:00`);
          const end = new Date(`${checkOut}T00:00:00`);

          while (cursor < end) {
            const date = toLocalDateString(cursor);

            const bookedCount = getBookedCount(roomType, currentBookings, date);

            if (inventoryCount - bookedCount <= 0) {
              return false;
            }

            cursor.setDate(cursor.getDate() + 1);
          }

          return true;
        })
        .map((roomType) => String(roomType.id));

      if (availableRoomTypeIds.length === 0) {
        setAvailabilityError(
          "No room types are available for those dates. Please choose different dates.",
        );
        return;
      }

      const params = new URLSearchParams();
      params.set("checkIn", checkIn);
      params.set("checkOut", checkOut);
      params.set("guests", guests);
      params.set("availableRoomTypes", availableRoomTypeIds.join(","));

      navigate(`/rooms?${params.toString()}`);
    } catch (error) {
      console.error("Error checking room availability:", error);

      setAvailabilityError(
        "Unable to check room availability. Please try again.",
      );
    } finally {
      setCheckingAvailability(false);
    }
  };

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&auto=format)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/40 to-background/90" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-3 py-1 bg-accent/20 border border-accent/40 rounded-full text-accent text-xs font-medium uppercase tracking-wider">
                  Puerto, Philippines
                </span>
              </div>

              <h1
                className="text-white mb-6 leading-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 700,
                }}
              >
                Dive Into Paradise.
                <br />
                <em>Wake Up to the Sea.</em>
              </h1>

              <p className="text-white/80 text-lg mb-10 max-w-xl leading-relaxed">
                World-class diving, pristine white sand beaches, and luxurious
                island accommodations — all in one breathtaking destination.
              </p>
            </div>

            {/* Reservation Card */}
            <div className="w-full max-w-xl lg:ml-auto">
              <div className="bg-white/95 backdrop-blur rounded-2xl p-4 sm:p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-accent uppercase tracking-wider font-medium">
                      Plan Your Stay
                    </p>
                    <h3
                      className="text-xl font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Make a reservation
                    </h3>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border overflow-hidden bg-white">
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-accent flex items-center justify-center">
                          <CalendarDays className="w-5 h-5" />
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                            Select your stay
                          </p>
                          <p
                            className="font-semibold text-foreground"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {monthLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeCalendarMonth(-1)}
                          disabled={
                            calendarMonth.getFullYear() ===
                              new Date().getFullYear() &&
                            calendarMonth.getMonth() === new Date().getMonth()
                          }
                          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => changeCalendarMonth(1)}
                          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Check-in
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {checkIn
                            ? new Date(
                                `${checkIn}T00:00:00`,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Select date"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Check-out
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {checkOut
                            ? new Date(
                                `${checkOut}T00:00:00`,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Select date"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Calendar */}
                  <div className="p-3 sm:p-4">
                    <div className="grid grid-cols-7 mb-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="text-center text-[10px] font-semibold uppercase text-muted-foreground py-2"
                          >
                            {day}
                          </div>
                        ),
                      )}
                    </div>

                    <div className="grid grid-cols-7 border-l border-t border-border">
                      {calendarDays.map((day, index) => {
                        if (day === null) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="min-h-[60px] border-r border-b border-border bg-muted/30"
                            />
                          );
                        }

                        const date = new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth(),
                          day,
                        );

                        const dateString = toLocalDateString(date);
                        const isPast = dateString < todayString;
                        const isCheckIn = dateString === checkIn;
                        const isCheckOut = dateString === checkOut;
                        const isInRange =
                          Boolean(checkIn && checkOut) &&
                          dateString > checkIn &&
                          dateString < checkOut;
                        const isToday = dateString === todayString;

                        const availableTypeCount =
                          getAvailableTypeCount(dateString);
                        const isAvailable = availableTypeCount > 0;

                        return (
                          <button
                            key={dateString}
                            type="button"
                            disabled={isPast || calendarDataLoading}
                            onClick={() => handleSelectDate(dateString)}
                            className={`min-h-[60px] border-r border-b border-border flex flex-col items-center justify-center gap-1 transition-colors ${
                              isPast
                                ? "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                                : isCheckIn || isCheckOut
                                  ? "bg-primary text-white"
                                  : isInRange
                                    ? "bg-primary/10 text-primary"
                                    : "bg-white text-foreground hover:bg-primary/5"
                            }`}
                          >
                            <span
                              className={`text-xs font-semibold ${
                                isToday && !isCheckIn && !isCheckOut
                                  ? "text-accent"
                                  : ""
                              }`}
                            >
                              {day}
                            </span>

                            {!isPast && (
                              <span
                                className={`text-[8px] leading-none ${
                                  isCheckIn || isCheckOut
                                    ? "text-white/80"
                                    : isAvailable
                                      ? "text-green-700"
                                      : "text-red-600"
                                }`}
                              >
                                {calendarDataLoading
                                  ? "Loading"
                                  : availabilityError ===
                                      "Unable to load room availability right now."
                                    ? "Error"
                                    : isAvailable
                                      ? "Available"
                                      : "Full"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                        Available
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                        Fully booked
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Selected
                      </span>
                    </div>

                    {calendarDataLoading && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Loading room availability...
                      </p>
                    )}
                  </div>
                </div>

                {/* Guests */}
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                    Guests
                  </label>

                  <select
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-border bg-muted/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Guest" : "Guests"}
                      </option>
                    ))}
                  </select>
                </div>

                {availabilityError && (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {availabilityError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={checkingAvailability || calendarDataLoading}
                  className="mt-4 w-full bg-accent hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {checkingAvailability ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Checking Availability...
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4" />
                      Go to Room
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-primary text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "50+", label: "Dive Sites" },
              { value: "6", label: "Room Types" },
              { value: "2,000+", label: "Happy Guests" },
              { value: "4.9★", label: "Average Rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  className="text-2xl font-bold text-accent"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {stat.value}
                </div>
                <div className="text-white/60 text-xs uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
              Accommodations
            </p>
            <h2
              className="text-foreground"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.25rem",
                fontWeight: 700,
              }}
            >
              Your Home By the Sea
            </h2>
          </div>

          <Link
            to="/rooms"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors"
          >
            View all rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rooms.slice(0, 3).map((room) => {
            const roomImage =
              room.images?.[0] ||
              room.image ||
              "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800";

            return (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border"
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={roomImage}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-white/90 rounded-full text-xs font-medium text-primary capitalize">
                      {room.type?.replace("-", " ")}
                    </span>
                  </div>

                  {room.available === false && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">
                        Fully Booked
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3
                    className="font-semibold text-foreground text-base leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {room.name}
                  </h3>

                  <div className="flex items-center gap-2 mb-3 mt-2">
                    <StarRating rating={room.rating || 0} />
                    <span className="text-xs text-muted-foreground">
                      ({room.reviews || 0})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-accent font-bold text-lg">
                        ₱{Number(room.price || 0).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        /night
                      </span>
                    </div>

                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Up to {room.capacity}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-accent transition-colors"
          >
            View all rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Activities preview */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
                Experiences
              </p>
              <h2
                className="text-foreground"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2.25rem",
                  fontWeight: 700,
                }}
              >
                Island Adventures
              </h2>
            </div>

            <Link
              to="/services"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              All activities <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.slice(0, 3).map((svc) => (
              <Link
                key={svc.id}
                to="/services"
                className="group relative rounded-2xl overflow-hidden h-64 shadow-sm hover:shadow-xl transition-all"
              >
                <img
                  src={svc.image}
                  alt={svc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <span className="text-white/70 text-xs uppercase tracking-wider">
                    {svc.category}
                  </span>
                  <h3
                    className="text-white font-semibold text-lg mt-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {svc.name}
                  </h3>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-accent font-semibold text-sm">
                      ₱{Number(svc.price || 0).toLocaleString()}
                    </span>
                    <span className="text-white/70 text-xs">
                      {svc.duration}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
            Why Sabang Beach and Diving Resorts
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#0A2540",
            }}
          >
            The Difference Is in the Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-7 h-7 text-primary" />
              </div>

              <h3
                className="font-semibold text-foreground mb-2 text-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.title}
              </h3>

              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
              Guest Stories
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.25rem",
                fontWeight: 700,
              }}
            >
              What Our Guests Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.slice(0, 2).map((review) => (
              <div
                key={review.id}
                className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={
                      review.guestAvatar ||
                      "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(review.guestName || "Guest")
                    }
                    alt={review.guestName}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-accent/50"
                  />

                  <div>
                    <div className="font-semibold text-white text-sm">
                      {review.guestName}
                    </div>
                    <div className="text-white/50 text-xs">
                      {review.roomName || review.serviceName}
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i <= review.rating
                            ? "fill-accent text-accent"
                            : "text-white/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-white/80 text-sm leading-relaxed italic">
                  "{review.comment}"
                </p>
                <p className="text-white/40 text-xs mt-3">{review.date}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/reviews"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors border border-white/20 rounded-full px-5 py-2.5 hover:bg-white/10"
            >
              Read all reviews <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Assistant teaser */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-secondary to-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 border border-border">
          <div className="flex-1">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-5">
              <Bot className="w-8 h-8 text-white" />
            </div>

            <h2
              className="text-foreground mb-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.875rem",
                fontWeight: 700,
              }}
            >
              Meet Your AI Travel Assistant
            </h2>

            <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-md">
              Not sure what to book? Our AI concierge helps you find the perfect
              room and activities based on your preferences, budget, and travel
              dates — available 24/7.
            </p>

            <Link
              to="/ai-assistant"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-primary/90 transition-colors"
            >
              Chat with AI Assistant <Bot className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex-shrink-0 w-full md:w-80">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-border space-y-3">
              {[
                {
                  role: "user",
                  msg: "I want a romantic beachfront room for 3 nights in June with snorkeling.",
                },
                {
                  role: "ai",
                  msg: "I recommend the Sabang Beachfront Villa! It's right on the beach, rated 4.9★, and I can add a Snorkeling Safari to your booking. Shall I check availability?",
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact section */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-foreground mb-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            Need Help Planning Your Stay?
          </h2>

          <p className="text-muted-foreground text-sm mb-8">
            Our team is available 7 days a week to assist you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="tel:+6348555019"
              className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
            >
              <Phone className="w-4 h-4" /> +63 48 555 0192
            </a>

            <a
              href="mailto:hello@SabangBeach.ph"
              className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
            >
              <Mail className="w-4 h-4" /> hello@SabangBeach.ph
            </a>

            <Link
              to="/inquiries"
              className="flex items-center gap-2 text-sm font-medium bg-accent text-white px-5 py-3 rounded-full hover:bg-accent/90 transition-colors"
            >
              <MapPin className="w-4 h-4" /> Send a Message
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
