import { useAvailabilityRecords } from "../../hooks/useRoomAvailability";
import { remainingRooms } from "../utils/availability";
import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Users, Filter, X, Search } from "lucide-react";
import { db } from "../components/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

type RoomType = {
  id: string;
  name: string;
  description: string;
  count: number;
  availableCount?: number;
  availabilityKnown?: boolean;
  amenities: string[];
  maxGuests: number;
  basePrice: number;
  image: string;
};

type ResortSettings = {
  resortName: string;
  address: string;
};

const DEFAULT_SETTINGS: ResortSettings = {
  resortName: "Sabang Beach and Diving Resort",
  address: "Sabang, Puerto",
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

export default function Rooms() {
  const inventory = useAvailabilityRecords();
  const [params] = useSearchParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minCapacity, setMinCapacity] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [roomError, setRoomError] = useState("");
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<ResortSettings>(DEFAULT_SETTINGS);

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

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const settingsSnapshot = await getDoc(
          doc(db, "publicSettings", "general"),
        );

        if (!active || !settingsSnapshot.exists()) return;

        const data = settingsSnapshot.data();

        setSettings({
          resortName:
            typeof data.resortName === "string" && data.resortName.trim()
              ? data.resortName.trim()
              : DEFAULT_SETTINGS.resortName,
          address:
            typeof data.address === "string" && data.address.trim()
              ? data.address.trim()
              : DEFAULT_SETTINGS.address,
        });
      } catch (error) {
        console.error("Failed to load resort settings:", error);
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "roomTypes"),
        (snapshot) => {
          setRooms(
            snapshot.docs.map((document) => {
              const data = document.data();
              return {
                ...data,
                id: document.id,
                name: String(data.name || ""),
                description: String(data.description || "").trim(),
                count: Math.max(
                  0,
                  Number(data.count ?? data.quantity ?? data.totalRooms ?? 0),
                ),
                amenities: Array.isArray(data.amenities) ? data.amenities : [],
                maxGuests: Number(data.maxGuests ?? data.capacity ?? 1),
                basePrice: Number(data.basePrice ?? data.price ?? 0),
                image: String(data.image || ""),
              };
            }),
          );
          setLoading(false);
          setRoomError("");
        },
        () => {
          setLoading(false);
          setRooms([]);
          setRoomError("Unable to load rooms. Please try again later.");
        },
      ),
    [],
  );

  const roomsWithAvailability = useMemo(() => {
    const start =
      checkInParam ||
      new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const end =
      checkOutParam ||
      new Date(Date.parse(start + "T00:00:00Z") + 86400000)
        .toISOString()
        .slice(0, 10);
    return rooms.map((room) => ({
      ...room,
      availabilityKnown: !inventory.error && !inventory.loading,
      availableCount:
        inventory.error || inventory.loading
          ? 0
          : remainingRooms(
              room,
              inventory.rooms,
              inventory.bookings,
              inventory.reservations,
              start,
              end,
            ),
    }));
  }, [rooms, inventory, checkInParam, checkOutParam]);

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
      {(roomError || inventory.error) && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {roomError || inventory.error}
        </p>
      )}
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
          {filtered.length !== 1 ? "s" : ""} · {settings.address}
        </p>

        {hasValidDateRange && (
          <p className="text-muted-foreground text-xs mt-1">
            Room availability for {dateOnly(requestedCheckIn!)} to{" "}
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
          {loading || inventory.loading ? (
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
                <RoomCard
                  key={room.id}
                  room={room}
                  checkIn={checkInParam || ""}
                  checkOut={checkOutParam || ""}
                  guests={guestsParam}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  checkIn,
  checkOut,
  guests,
}: {
  room: RoomType;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const displayCount = room.availableCount ?? room.count;

  const detailParams = new URLSearchParams();

  if (checkIn) detailParams.set("checkIn", checkIn);
  if (checkOut) detailParams.set("checkOut", checkOut);

  detailParams.set("guests", String(guests));

  const detailUrl = `/rooms/${room.id}?${detailParams.toString()}`;

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

        <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-line break-words mb-4">
          {room.description ||
            `Comfortable accommodation for up to ${room.maxGuests} guests.`}
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

          {displayCount <= 0 ? (
            <button
              disabled
              className="text-sm font-medium px-4 py-2 rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
            >
              {room.availabilityKnown === false
                ? "Unavailable"
                : "Fully Booked"}
            </button>
          ) : (
            <Link
              to={detailUrl}
              state={{ checkIn, checkOut, guests }}
              className="text-sm font-medium px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              View Details
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
