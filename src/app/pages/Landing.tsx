import { Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
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
import { useResortSettings } from "../../hooks/useResortSettings";

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
  bookingId?: string;
  bookingRef?: string;
  guestName: string;
  guestAvatar?: string;
  roomName?: string;
  serviceName?: string;
  rating: number;
  comment: string;
  date: string;
  status?: string;
}

interface FirestoreRoom {
  id: string;
  roomTypeId?: unknown;
  typeId?: unknown;
  roomType?: unknown;
  roomTypeName?: string;
  typeName?: string;
  type?: unknown;
  name?: string;
  status?: string;
  isAvailable?: boolean;
  [key: string]: unknown;
}

interface FirestoreBooking {
  id: string;
  roomTypeId?: unknown;
  typeId?: unknown;
  roomType?: unknown;
  roomTypeName?: string;
  roomName?: string;
  room?: unknown;
  type?: unknown;
  roomQuantity?: number;
  roomsBooked?: number;
  quantity?: number;
  checkIn?: unknown;
  checkOut?: unknown;
  bookingDate?: unknown;
  bookingType?: string;
  itemType?: string;
  serviceId?: string;
  packageId?: string;
  status?: string;
  userId?: string;
  email?: string;
  customerEmail?: string;
  [key: string]: unknown;
}

const FEATURE_ICONS = [Anchor, Shield, Award, Waves];

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

const toLocalDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getDateOnly = (value: unknown): string => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : toLocalDateString(value);
  }

  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? toLocalDateString(date)
        : "";
    }

    const seconds = timestamp.seconds ?? timestamp._seconds;

    if (typeof seconds === "number") {
      return toLocalDateString(new Date(seconds * 1000));
    }
  }

  return "";
};

const getCalendarDays = (month: Date) => {
  const startOffset = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
  ).getDay();

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

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
        obj.typeName ??
        obj.value,
    );
  }

  return String(value).trim().toLowerCase();
};

const isCancelledBooking = (status = "") =>
  ["cancelled", "canceled", "rejected", "declined", "void", "deleted"].includes(
    normalize(status),
  );

const isRoomBookable = (room: FirestoreRoom): boolean => {
  if (room.isAvailable === false) return false;

  return ![
    "maintenance",
    "inactive",
    "deleted",
    "unavailable",
    "out of service",
    "out-of-service",
  ].includes(normalize(room.status));
};

const isRoomBooking = (booking: FirestoreBooking): boolean => {
  const type = normalize(booking.bookingType || booking.itemType);

  if (
    ["service", "package", "activity"].includes(type) ||
    booking.serviceId ||
    booking.packageId
  ) {
    return false;
  }

  if (booking.bookingDate && !booking.checkIn && !booking.checkOut) {
    return false;
  }

  return Boolean(booking.checkIn && booking.checkOut);
};

const getRoomTypeKeys = (roomType: Room): string[] =>
  [roomType.id, roomType.name].map(normalize).filter(Boolean);

const matchesRoomType = (
  record: Record<string, unknown>,
  roomType: Room,
): boolean => {
  const keys = getRoomTypeKeys(roomType);

  const values = [
    record.roomTypeId,
    record.typeId,
    record.roomType,
    record.roomTypeName,
    record.typeName,
    record.roomName,
    record.room,
    record.type,
  ]
    .map(normalize)
    .filter(Boolean);

  return values.some((value) => keys.includes(value));
};

const getInventoryCount = (
  roomType: Room,
  inventoryRooms: FirestoreRoom[],
): number => {
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
): number =>
  bookings.reduce((total, booking) => {
    if (isCancelledBooking(String(booking.status ?? ""))) return total;
    if (!isRoomBooking(booking)) return total;
    if (!matchesRoomType(booking, roomType)) return total;

    const checkInDate = getDateOnly(booking.checkIn);
    const checkOutDate = getDateOnly(booking.checkOut);

    if (!checkInDate || !checkOutDate) return total;
    if (!(checkInDate <= date && checkOutDate > date)) return total;

    const rawQuantity =
      booking.roomQuantity ?? booking.roomsBooked ?? booking.quantity ?? 1;

    const quantity = Number(rawQuantity);
    const roomsBooked =
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    return total + roomsBooked;
  }, 0);

const isRoomTypeAvailableForStay = (
  roomType: Room,
  inventoryRooms: FirestoreRoom[],
  bookings: FirestoreBooking[],
  checkIn: string,
  checkOut: string,
  guestCount: number,
): boolean => {
  if (roomType.available === false) return false;

  if (roomType.capacity > 0 && roomType.capacity < guestCount) {
    return false;
  }

  const inventoryCount = getInventoryCount(roomType, inventoryRooms);
  if (inventoryCount <= 0) return false;

  const cursor = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  if (
    Number.isNaN(cursor.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= cursor
  ) {
    return false;
  }

  while (cursor < end) {
    if (
      inventoryCount -
        getBookedCount(roomType, bookings, toLocalDateString(cursor)) <=
      0
    ) {
      return false;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return true;
};

const mapRoomType = (id: string, data: Record<string, unknown>): Room => ({
  id,
  name: String(
    data.name ?? data.roomTypeName ?? data.typeName ?? data.title ?? "",
  ),
  type: String(data.type ?? data.category ?? ""),
  images: Array.isArray(data.images)
    ? data.images.filter((image): image is string => typeof image === "string")
    : [],
  image: String(data.image ?? data.imageUrl ?? ""),
  price: Number(data.basePrice ?? data.price ?? data.rate ?? 0),
  capacity: Number(data.maxGuests ?? data.capacity ?? data.maxOccupancy ?? 0),
  rating: Number(data.rating ?? 0),
  reviews: Number(data.reviews ?? data.reviewCount ?? 0),
  available: data.available !== false,
  count: Number(data.count ?? data.quantity ?? data.totalRooms ?? 0),
  quantity: Number(data.quantity ?? data.count ?? data.totalRooms ?? 0),
  totalRooms: Number(data.totalRooms ?? data.count ?? data.quantity ?? 0),
});

const mapInventoryRoom = (
  id: string,
  data: Record<string, unknown>,
): FirestoreRoom => ({ ...data, id }) as FirestoreRoom;

const mapBooking = (
  id: string,
  data: Record<string, unknown>,
): FirestoreBooking => ({ ...data, id }) as FirestoreBooking;

export default function Landing() {
  const navigate = useNavigate();
  const { settings: resortSettings } = useResortSettings();

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

  const [calendarDataLoading, setCalendarDataLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const todayString = toLocalDateString(new Date());

  const resortName =
    resortSettings.resortName?.trim() || "Sabang Beach and Diving Resort";

  const resortDescription =
    resortSettings.description?.trim() ||
    "A tropical getaway offering comfortable accommodations, beautiful beaches, and memorable resort activities.";

  const features = resortSettings.features;

  // Always preserve stay details in the URL, even if router state is lost
  // after a refresh or the guest opens the link directly.
  const buildStayParams = (
    checkInDate: string,
    checkOutDate: string,
    guestCount: string | number,
  ) => {
    const params = new URLSearchParams();

    if (checkInDate) params.set("checkIn", checkInDate);
    if (checkOutDate) params.set("checkOut", checkOutDate);

    params.set("guests", String(guestCount || 2));

    return params;
  };

  const stayState = {
    checkIn,
    checkOut,
    guests: Number(guests),
  };

  const buildRoomListUrl = () => {
    const params = buildStayParams(checkIn, checkOut, guests);
    return `/rooms?${params.toString()}`;
  };

  const buildRoomDetailUrl = (roomId: string) => {
    const params = buildStayParams(checkIn, checkOut, guests);
    return `/rooms/${encodeURIComponent(roomId)}?${params.toString()}`;
  };

  useEffect(() => {
    let isMounted = true;

    async function loadLandingData() {
      try {
        const [
          roomTypesSnapshot,
          servicesSnapshot,
          reviewsSnapshot,
          inventorySnapshot,
          bookingsSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "roomTypes")),
          getDocs(collection(db, "services")),
          getDocs(
            query(
              collection(customerDb, "reviews"),
              where("status", "==", "published"),
            ),
          ),
          getDocs(collection(db, "rooms")),
          getDocs(collection(customerDb, "Bookings")),
        ]);

        if (!isMounted) return;

        const allRoomTypes = roomTypesSnapshot.docs.map((docSnap) =>
          mapRoomType(docSnap.id, docSnap.data() as Record<string, unknown>),
        );

        setAvailabilityRoomTypes(allRoomTypes);
        setRooms(allRoomTypes.slice(0, 6));

        setServices(
          servicesSnapshot.docs.map((docSnap) => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              name: String(data.name ?? data.serviceName ?? data.title ?? ""),
              category: String(data.category ?? data.type ?? "Activity"),
              image: String(data.image ?? data.imageUrl ?? ""),
              price: Number(data.price ?? data.basePrice ?? 0),
              duration: String(data.duration ?? ""),
            };
          }),
        );

        setReviews(
          reviewsSnapshot.docs
            .map((docSnap) => {
              const data = docSnap.data();
              const createdAt = data.createdAt;

              const reviewDate =
                typeof data.date === "string"
                  ? data.date
                  : createdAt &&
                      typeof createdAt === "object" &&
                      "toDate" in createdAt &&
                      typeof createdAt.toDate === "function"
                    ? createdAt.toDate().toISOString()
                    : "";

              return {
                id: docSnap.id,
                bookingId: data.bookingId,
                bookingRef: data.bookingRef,
                guestName: String(data.guestName ?? "Guest"),
                guestAvatar:
                  typeof data.guestAvatar === "string"
                    ? data.guestAvatar
                    : undefined,
                roomName:
                  typeof data.roomName === "string" ? data.roomName : undefined,
                serviceName:
                  typeof data.serviceName === "string"
                    ? data.serviceName
                    : undefined,
                rating: Number(data.rating ?? 0),
                comment: String(data.comment ?? ""),
                date: reviewDate,
                status: data.status,
                sortDate:
                  createdAt &&
                  typeof createdAt === "object" &&
                  "toDate" in createdAt &&
                  typeof createdAt.toDate === "function"
                    ? createdAt.toDate().getTime()
                    : Date.parse(reviewDate) || 0,
              };
            })
            .sort(
              (a, b) =>
                Number((b as Review & { sortDate?: number }).sortDate ?? 0) -
                Number((a as Review & { sortDate?: number }).sortDate ?? 0),
            )
            .map(({ sortDate: _sortDate, ...review }) => review as Review),
        );

        setInventoryRooms(
          inventorySnapshot.docs.map((docSnap) =>
            mapInventoryRoom(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          ),
        );

        setBookings(
          bookingsSnapshot.docs.map((docSnap) =>
            mapBooking(docSnap.id, docSnap.data() as Record<string, unknown>),
          ),
        );
      } catch (error) {
        console.error("Error loading landing page data:", error);

        if (isMounted) {
          setAvailabilityError("Unable to load room availability right now.");
        }
      } finally {
        if (isMounted) setCalendarDataLoading(false);
      }
    }

    void loadLandingData();

    return () => {
      isMounted = false;
    };
  }, []);

  const changeCalendarMonth = (amount: number) => {
    setCalendarMonth((current) => {
      const nextMonth = new Date(
        current.getFullYear(),
        current.getMonth() + amount,
        1,
      );

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return nextMonth < currentMonth ? currentMonth : nextMonth;
    });
  };

  const handleSelectDate = (dateString: string) => {
    setAvailabilityError("");

    if (dateString < todayString) return;

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

      const currentRoomTypes = roomTypesSnapshot.docs.map((docSnap) =>
        mapRoomType(docSnap.id, docSnap.data() as Record<string, unknown>),
      );

      const currentInventory = inventorySnapshot.docs.map((docSnap) =>
        mapInventoryRoom(docSnap.id, docSnap.data() as Record<string, unknown>),
      );

      const currentBookings = bookingsSnapshot.docs.map((docSnap) =>
        mapBooking(docSnap.id, docSnap.data() as Record<string, unknown>),
      );

      setAvailabilityRoomTypes(currentRoomTypes);
      setInventoryRooms(currentInventory);
      setBookings(currentBookings);

      const availableRoomTypeIds = currentRoomTypes
        .filter((roomType) =>
          isRoomTypeAvailableForStay(
            roomType,
            currentInventory,
            currentBookings,
            checkIn,
            checkOut,
            Number(guests),
          ),
        )
        .map((roomType) => roomType.id);

      if (availableRoomTypeIds.length === 0) {
        setAvailabilityError(
          "No room types are available for those dates. Please choose different dates.",
        );
        return;
      }

      const params = buildStayParams(checkIn, checkOut, guests);
      params.set("availableRoomTypes", availableRoomTypeIds.join(","));

      navigate(`/rooms?${params.toString()}`, {
        state: {
          checkIn,
          checkOut,
          guests: Number(guests),
          availableRoomTypes: availableRoomTypeIds,
        },
      });
    } catch (error) {
      console.error("Error checking room availability:", error);
      setAvailabilityError(
        "Unable to check room availability. Please try again.",
      );
    } finally {
      setCheckingAvailability(false);
    }
  };

  const validRatings = reviews
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);

  const averageRating =
    validRatings.length > 0
      ? validRatings.reduce((sum, rating) => sum + rating, 0) /
        validRatings.length
      : 0;

  const guestCount = new Set(
    bookings
      .filter((booking) => !isCancelledBooking(String(booking.status ?? "")))
      .map((booking) =>
        normalize(booking.userId ?? booking.email ?? booking.customerEmail),
      )
      .filter(Boolean),
  ).size;

  return (
    <div className="bg-background">
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
                  {resortSettings.address || resortName}
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
                {resortName}
                <br />
                <em>Dive Into Paradise.</em>
              </h1>

              <p className="text-white/80 text-lg mb-10 max-w-xl leading-relaxed whitespace-pre-line">
                {resortDescription}
              </p>
            </div>

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

                        const dateString = toLocalDateString(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth(),
                            day,
                          ),
                        );

                        const isPast = dateString < todayString;
                        const isCheckIn = dateString === checkIn;
                        const isCheckOut = dateString === checkOut;
                        const isInRange =
                          Boolean(checkIn && checkOut) &&
                          dateString > checkIn &&
                          dateString < checkOut;
                        const isToday = dateString === todayString;

                        const availableTypeCount = availabilityRoomTypes.filter(
                          (roomType) => {
                            if (
                              roomType.capacity > 0 &&
                              roomType.capacity < Number(guests)
                            ) {
                              return false;
                            }

                            return (
                              roomType.available !== false &&
                              getInventoryCount(roomType, inventoryRooms) -
                                getBookedCount(roomType, bookings, dateString) >
                                0
                            );
                          },
                        ).length;

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

                <div className="mt-4">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-border bg-muted/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((number) => (
                      <option key={number} value={number}>
                        {number} {number === 1 ? "Guest" : "Guests"}
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

      <section className="bg-primary text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              {
                value: String(availabilityRoomTypes.length),
                label: "Room Types",
              },
              { value: String(services.length), label: "Activities" },
              { value: String(guestCount), label: "Guests with Bookings" },
              {
                value: validRatings.length
                  ? `${averageRating.toFixed(1)}★`
                  : "N/A",
                label: "Average Guest Rating",
              },
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
            to={buildRoomListUrl()}
            state={stayState}
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

            const roomReviews = reviews.filter(
              (review) =>
                (review.roomName || "").trim().toLowerCase() ===
                room.name.trim().toLowerCase(),
            );

            const ratings = roomReviews
              .map((review) => Number(review.rating))
              .filter((rating) => rating >= 1 && rating <= 5);

            const roomAverage =
              ratings.length > 0
                ? ratings.reduce((sum, rating) => sum + rating, 0) /
                  ratings.length
                : 0;

            return (
              <Link
                key={room.id}
                to={buildRoomDetailUrl(room.id)}
                state={stayState}
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
                    <StarRating rating={roomAverage} />
                    <span className="text-xs text-muted-foreground">
                      {ratings.length > 0
                        ? `${roomAverage.toFixed(1)} (${ratings.length})`
                        : "(0)"}
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
            to={buildRoomListUrl()}
            state={stayState}
            className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-accent transition-colors"
          >
            View all rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

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
            {services.slice(0, 3).map((service) => (
              <Link
                key={service.id}
                to="/services"
                className="group relative rounded-2xl overflow-hidden h-64 shadow-sm hover:shadow-xl transition-all"
              >
                {service.image ? (
                  <img
                    src={service.image}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                    <Waves className="w-12 h-12 text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <span className="text-white/70 text-xs uppercase tracking-wider">
                    {service.category}
                  </span>
                  <h3
                    className="text-white font-semibold text-lg mt-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {service.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-accent font-semibold text-sm">
                      ₱{Number(service.price || 0).toLocaleString()}
                    </span>
                    <span className="text-white/70 text-xs">
                      {service.duration}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-[#F8F5F0]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <p className="text-[#F15A35] text-sm font-medium uppercase tracking-[0.12em] mb-4">
              WHY {resortName.toUpperCase()}
            </p>

            <h2
              className="text-[#0A2540] text-3xl md:text-4xl font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The Difference Is in the Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {features.map((feature, index) => {
              const FeatureIcon = FEATURE_ICONS[index] ?? Anchor;

              return (
                <div
                  key={`${feature.title}-${index}`}
                  className="flex flex-col items-center text-center px-2"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#E5F3F7] flex items-center justify-center mb-4">
                    <FeatureIcon className="w-7 h-7 text-[#0A456B]" />
                  </div>

                  <h3
                    className="font-semibold text-[#0A2540] text-sm mb-2 leading-snug"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {feature.title}
                  </h3>

                  <p className="text-[#64748B] text-sm leading-relaxed max-w-[260px]">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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

          {reviews.length > 0 ? (
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
                        {review.roomName ||
                          review.serviceName ||
                          "Resort guest"}
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

                  <p className="text-white/40 text-xs mt-3">
                    {review.date
                      ? new Date(review.date).toLocaleDateString()
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-white/70 text-sm">
              Guest reviews will appear here once they are published.
            </p>
          )}

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
                  msg: `I can help you find a room and activities at ${resortName}. Shall I check availability?`,
                },
              ].map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                      message.role === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {message.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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

          <p className="text-muted-foreground text-sm mb-3">
            Our team is available to assist you.
          </p>

          <p className="text-muted-foreground text-sm mb-8">
            Check-in: {resortSettings.checkInTime || "14:00"}
            {" · "}
            Check-out: {resortSettings.checkOutTime || "11:00"}
            {" · "}
            Front desk: {resortSettings.frontDeskHours || "24/7"}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {resortSettings.phone && (
              <a
                href={`tel:${resortSettings.phone.replace(/[^\d+]/g, "")}`}
                className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
              >
                <Phone className="w-4 h-4" />
                {resortSettings.phone}
              </a>
            )}

            {resortSettings.email && (
              <a
                href={`mailto:${resortSettings.email}`}
                className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
              >
                <Mail className="w-4 h-4" />
                {resortSettings.email}
              </a>
            )}

            <Link
              to="/inquiries"
              className="flex items-center gap-2 text-sm font-medium bg-accent text-white px-5 py-3 rounded-full hover:bg-accent/90 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Send a Message
            </Link>
          </div>

          {resortSettings.address && (
            <p className="text-muted-foreground text-sm mt-6">
              <MapPin className="w-4 h-4 inline-block mr-1" />
              {resortSettings.address}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
