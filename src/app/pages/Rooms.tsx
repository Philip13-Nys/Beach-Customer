import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Users, Filter, X, Search } from "lucide-react";
import { db, customerDb } from "../components/firebase";
import { collection, getDocs } from "firebase/firestore";

type RoomType = {
  id: string;
  name: string;
  count: number;
  availableCount?: number;
  amenities: string[];
  maxGuests: number;
  basePrice: number;
  image: string;
};

type Booking = {
  id: string;
  status?: string;
  checkIn?: any;
  checkOut?: any;
  roomTypeId?: string;
  roomId?: string;
  roomName?: string;
  roomType?: string | { id?: string; name?: string };
  quantity?: number;
  rooms?: number;
  numberOfRooms?: number;
};

type IndividualRoom = {
  id: string;
  roomId: string;
  roomTypeId: string;
  roomTypeName: string;
  type?: string;
  status: string;
};

function toDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && value.seconds != null) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingOverlaps(
  booking: Booking,
  requestedCheckIn: Date,
  requestedCheckOut: Date,
): boolean {
  const checkIn = toDate(booking.checkIn);
  const checkOut = toDate(booking.checkOut);

  if (!checkIn || !checkOut) return false;

  return (
    dateOnly(checkIn) < dateOnly(requestedCheckOut) &&
    dateOnly(checkOut) > dateOnly(requestedCheckIn)
  );
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isInactiveBooking(status?: string): boolean {
  return ["cancelled", "canceled", "rejected", "declined"].includes(
    normalize(status),
  );
}

function isBlockingBooking(status?: string): boolean {
  return ["pending", "confirmed", "approved"].includes(normalize(status));
}

function getBookingQuantity(booking: Booking): number {
  const raw = Number(
    booking.quantity ?? booking.numberOfRooms ?? booking.rooms ?? 1,
  );

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

function getBookingTypeValues(booking: Booking): string[] {
  const values = [
    booking.roomTypeId,
    booking.roomName,
    typeof booking.roomType === "string"
      ? booking.roomType
      : booking.roomType?.id,
    typeof booking.roomType === "object" ? booking.roomType?.name : undefined,
  ];

  return values.map(normalize).filter(Boolean);
}

function roomMatchesBookingType(
  room: IndividualRoom,
  booking: Booking,
): boolean {
  const bookingValues = getBookingTypeValues(booking);
  const roomTypeId = normalize(room.roomTypeId);
  const roomTypeName = normalize(room.roomTypeName);

  return (
    bookingValues.includes(roomTypeId) || bookingValues.includes(roomTypeName)
  );
}

function bookingMatchesIndividualRoom(
  room: IndividualRoom,
  booking: Booking,
): boolean {
  const bookingRoomId = normalize(booking.roomId);

  if (!bookingRoomId) return false;

  // Direct individual-room match.
  if (
    bookingRoomId === normalize(room.id) ||
    bookingRoomId === normalize(room.roomId)
  ) {
    return true;
  }

  return false;
}

export default function Rooms() {
  const [params] = useSearchParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minCapacity, setMinCapacity] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [individualRooms, setIndividualRooms] = useState<IndividualRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const guestsParam = params.get("guests")
    ? parseInt(params.get("guests")!, 10)
    : 1;

  const checkInParam = params.get("checkIn");
  const checkOutParam = params.get("checkOut");

  const requestedCheckIn = checkInParam ? toDate(checkInParam) : null;
  const requestedCheckOut = checkOutParam ? toDate(checkOutParam) : null;

  const hasValidDateRange =
    !!requestedCheckIn &&
    !!requestedCheckOut &&
    dateOnly(requestedCheckIn) < dateOnly(requestedCheckOut);

  const availableIdsParam = params.get("availableRoomTypes");
  const hasAvailabilityParam = availableIdsParam !== null;

  const availableIds = useMemo(
    () =>
      new Set(
        (availableIdsParam || "")
          .split(",")
          .map((id) => id.trim().toLowerCase())
          .filter(Boolean),
      ),
    [availableIdsParam],
  );

  useEffect(() => {
    let active = true;

    const loadRooms = async () => {
      setLoading(true);

      try {
        const [roomTypesResult, bookingsResult, individualRoomsResult] =
          await Promise.allSettled([
            getDocs(collection(db, "roomTypes")),
            getDocs(collection(customerDb, "Bookings")),
            getDocs(collection(db, "rooms")),
          ]);

        if (!active) return;

        if (roomTypesResult.status === "rejected") {
          console.error("Failed to load room types:", roomTypesResult.reason);
          setRooms([]);
          setBookings([]);
          setIndividualRooms([]);
          return;
        }

        const roomTypesSnapshot = roomTypesResult.value;

        const roomData: RoomType[] = roomTypesSnapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            name: String(data.name || ""),
            count: Math.max(
              0,
              Number(data.count ?? data.quantity ?? data.totalRooms ?? 0),
            ),
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            maxGuests: Number(data.maxGuests ?? data.capacity ?? 1),
            basePrice: Number(data.basePrice ?? data.price ?? 0),
            image: String(data.image || ""),
          };
        });

        // Match room type names to their Firestore document IDs,
        // as the Admin Room Availability page does.
        const nameToRoomTypeId: Record<string, string> = {};

        roomData.forEach((roomType) => {
          const name = normalize(roomType.name);
          if (name) nameToRoomTypeId[name] = roomType.id;
        });

        let individualRoomData: IndividualRoom[] = [];

        if (individualRoomsResult.status === "fulfilled") {
          individualRoomData = individualRoomsResult.value.docs.map(
            (roomDoc) => {
              const data = roomDoc.data();
              const typeName = String(
                data.type ||
                  data.roomTypeName ||
                  (typeof data.roomType === "string"
                    ? data.roomType
                    : data.roomType?.name) ||
                  "",
              );

              const directTypeId = String(
                data.roomTypeId ||
                  data.typeId ||
                  (typeof data.roomType === "object"
                    ? data.roomType?.id
                    : "") ||
                  "",
              );

              const resolvedTypeId =
                directTypeId || nameToRoomTypeId[normalize(typeName)] || "";

              return {
                id: roomDoc.id,
                roomId: String(data.roomId || roomDoc.id),
                roomTypeId: resolvedTypeId,
                roomTypeName: typeName,
                type: typeName,
                status: normalize(data.status || "available"),
              };
            },
          );
        } else {
          console.warn(
            "Could not load individual rooms:",
            individualRoomsResult.reason,
          );
        }

        let bookingData: Booking[] = [];

        if (bookingsResult.status === "fulfilled") {
          bookingData = bookingsResult.value.docs.map((bookingDoc) => ({
            id: bookingDoc.id,
            ...bookingDoc.data(),
          })) as Booking[];
        } else {
          console.error(
            "Failed to load customer bookings:",
            bookingsResult.reason,
          );
        }

        console.log("ROOM TYPE MAP:", nameToRoomTypeId);
        console.log("INDIVIDUAL ROOMS:", individualRoomData);
        console.log("CUSTOMER BOOKINGS:", bookingData);

        setRooms(roomData);
        setBookings(bookingData);
        setIndividualRooms(individualRoomData);
      } catch (error) {
        console.error("Error loading rooms:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRooms();

    return () => {
      active = false;
    };
  }, []);

  const roomsWithAvailability = useMemo(() => {
    return rooms
      .map((roomType) => {
        const typeRooms = individualRooms.filter(
          (room) =>
            normalize(room.roomTypeId) === normalize(roomType.id) ||
            normalize(room.roomTypeName) === normalize(roomType.name),
        );

        // Use actual individual-room inventory when available.
        // Fall back to roomTypes.count only if no individual room docs
        // can be matched to this room type.
        const hasIndividualInventory = typeRooms.length > 0;

        const inventory = hasIndividualInventory
          ? typeRooms.filter((room) => room.status !== "maintenance")
          : [];

        const activeBookings = bookings.filter(
          (booking) =>
            isBlockingBooking(booking.status) &&
            !isInactiveBooking(booking.status) &&
            hasValidDateRange &&
            requestedCheckIn &&
            requestedCheckOut &&
            bookingOverlaps(booking, requestedCheckIn, requestedCheckOut),
        );

        let availableCount = 0;

        if (!hasValidDateRange || !requestedCheckIn || !requestedCheckOut) {
          // Without dates, show the count of rooms not in maintenance.
          availableCount = hasIndividualInventory
            ? inventory.length
            : roomType.count;
        } else if (hasIndividualInventory) {
          // Count individual rooms that have no matching booking.
          const typeBookings = activeBookings.filter((booking) =>
            roomMatchesBookingType(
              {
                id: "",
                roomId: "",
                roomTypeId: roomType.id,
                roomTypeName: roomType.name,
                status: "",
              },
              booking,
            ),
          );

          const specificallyBookedRoomIds = new Set<string>();
          let typeLevelBookedCount = 0;

          typeBookings.forEach((booking) => {
            const bookingRoomId = normalize(booking.roomId);

            const matchingIndividualRoom = inventory.find(
              (room) =>
                bookingRoomId === normalize(room.id) ||
                bookingRoomId === normalize(room.roomId),
            );

            if (matchingIndividualRoom) {
              specificallyBookedRoomIds.add(matchingIndividualRoom.id);
            } else {
              // If roomId contains the type ID (rather than a room ID),
              // the booking represents a quantity of rooms of this type.
              const isTypeLevelBooking =
                bookingRoomId === normalize(roomType.id) ||
                getBookingTypeValues(booking).includes(
                  normalize(roomType.id),
                ) ||
                getBookingTypeValues(booking).includes(
                  normalize(roomType.name),
                );

              if (isTypeLevelBooking) {
                typeLevelBookedCount += getBookingQuantity(booking);
              }
            }
          });

          const unbookedIndividualCount = inventory.filter(
            (room) => !specificallyBookedRoomIds.has(room.id),
          ).length;

          availableCount = Math.max(
            0,
            unbookedIndividualCount - typeLevelBookedCount,
          );
        } else {
          // No individual room records were found for this type.
          // Calculate from the room type's configured inventory.
          const bookedCount = activeBookings.reduce((total, booking) => {
            const values = getBookingTypeValues(booking);
            const matchesType =
              values.includes(normalize(roomType.id)) ||
              values.includes(normalize(roomType.name)) ||
              normalize(booking.roomId) === normalize(roomType.id);

            return matchesType ? total + getBookingQuantity(booking) : total;
          }, 0);

          availableCount = Math.max(0, roomType.count - bookedCount);
        }

        return {
          ...roomType,
          availableCount,
        };
      })
      .filter(
        (room) =>
          room.availableCount! > 0 &&
          (!hasAvailabilityParam || availableIds.has(room.id.toLowerCase())),
      );
  }, [
    rooms,
    bookings,
    individualRooms,
    hasValidDateRange,
    requestedCheckIn,
    requestedCheckOut,
    hasAvailabilityParam,
    availableIds,
  ]);

  const searchText = search.toLowerCase();

  const categories = [
    "All",
    ...Array.from(new Set(roomsWithAvailability.map((room) => room.name))),
  ];

  const filtered = roomsWithAvailability.filter((room) => {
    const matchSearch =
      room.name.toLowerCase().includes(searchText) ||
      room.amenities.some((amenity) =>
        amenity.toLowerCase().includes(searchText),
      );

    const matchCategory = category === "All" || room.name === category;
    const matchPrice = room.basePrice <= maxPrice;
    const matchCapacity =
      room.maxGuests >= Math.max(minCapacity, guestsParam || 1);

    return matchSearch && matchCategory && matchPrice && matchCapacity;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "#0A2540",
          }}
        >
          Our Accommodations
        </h1>

        <p className="text-muted-foreground text-sm mt-1">
          {filtered.length} room type
          {filtered.length !== 1 ? "s" : ""} available · Sabang, Puerto
        </p>

        {hasValidDateRange && (
          <p className="text-muted-foreground text-xs mt-1">
            Showing room types available for {dateOnly(requestedCheckIn!)} to{" "}
            {dateOnly(requestedCheckOut!)}
          </p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 flex-shrink-0">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-white border border-border rounded-xl text-sm font-medium mb-4"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filters
            </span>
            {filterOpen ? <X className="w-4 h-4" /> : null}
          </button>

          <div
            className={`${
              filterOpen ? "block" : "hidden"
            } lg:block bg-white rounded-2xl border border-border p-5 space-y-6`}
          >
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Search
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Room name or feature..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Room Type
              </label>

              <div className="space-y-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      category === cat
                        ? "bg-secondary text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Max Price: ₱{maxPrice.toLocaleString()}/night
              </label>

              <input
                type="range"
                min={0}
                max={50000}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-primary"
              />

              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>₱50,000</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Min. Capacity: {minCapacity} guest
                {minCapacity > 1 ? "s" : ""}
              </label>

              <input
                type="range"
                min={1}
                max={6}
                value={minCapacity}
                onChange={(e) => setMinCapacity(Number(e.target.value))}
                className="w-full accent-primary"
              />

              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>6</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSearch("");
                setCategory("All");
                setMaxPrice(50000);
                setMinCapacity(1);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Loading rooms...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="text-4xl mb-3">🏖️</div>

              <p className="font-medium text-foreground">
                {hasValidDateRange
                  ? "No rooms available for these dates"
                  : "No rooms match your filters"}
              </p>

              <p className="text-sm mt-1">
                {hasValidDateRange
                  ? "Try different check-in or check-out dates"
                  : "Try adjusting your search criteria"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: RoomType }) {
  const displayCount = room.availableCount ?? room.count;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-52 overflow-hidden">
        {room.image ? (
          <img
            src={room.image}
            alt={room.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400">No image available</span>
          </div>
        )}

        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-medium text-primary">
            {room.name}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="font-semibold text-foreground leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
            }}
          >
            {room.name}
          </h3>
        </div>

        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Up to {room.maxGuests} guests
          </span>

          <span>
            {displayCount} room
            {displayCount !== 1 ? "s" : ""}
          </span>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed mb-4">
          Comfortable accommodation for up to {room.maxGuests} guests.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {room.amenities.slice(0, 4).map((amenity) => (
            <span
              key={amenity}
              className="px-2 py-0.5 bg-secondary text-primary text-[10px] rounded-full"
            >
              {amenity}
            </span>
          ))}

          {room.amenities.length > 4 && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full">
              +{room.amenities.length - 4} more
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <span className="text-accent font-bold text-xl">
              ₱{room.basePrice.toLocaleString()}
            </span>

            <span className="text-muted-foreground text-xs">/night</span>
          </div>

          <Link
            to={`/rooms/${room.id}`}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
