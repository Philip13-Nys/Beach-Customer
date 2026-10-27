import { useState, useEffect } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router";
import { useApp } from "../context/AppContext";
import { Users, Check, ArrowLeft } from "lucide-react";

import { db } from "../components/firebase";
import { doc, getDoc } from "firebase/firestore";

type RoomType = {
  id: string;
  name: string;
  count: number;
  amenities: string[];
  maxGuests: number;
  basePrice: number;
  image: string;
};

type BookingDates = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  returnTo?: string;
};

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Read dates from the URL first so they survive page refreshes.
  // Fall back to React Router state when URL parameters are unavailable.
  const bookingDates = (location.state || {}) as BookingDates;

  const checkIn = searchParams.get("checkIn") || bookingDates.checkIn || "";

  const checkOut = searchParams.get("checkOut") || bookingDates.checkOut || "";

  const guestsValue = searchParams.get("guests") || bookingDates.guests;

  const parsedGuests = Number(guestsValue);
  const guests =
    Number.isFinite(parsedGuests) && parsedGuests > 0
      ? Math.floor(parsedGuests)
      : 1;

  const [room, setRoom] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [reservationFeePercent, setReservationFeePercent] = useState(5);

  // Format YYYY-MM-DD without timezone-related date shifts.
  const formatDate = (date: string) => {
    if (!date) return "Select date";

    const parts = date.split("-").map(Number);

    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return "Select date";
    }

    const [year, month, day] = parts;
    const parsedDate = new Date(year, month - 1, day);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return "Select date";
    }

    return parsedDate.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const checkInLabel = formatDate(checkIn);
  const checkOutLabel = formatDate(checkOut);

  // Calculate nights using local date components to avoid timezone shifts.
  const parseLocalDate = (value: string): Date | null => {
    if (!value) return null;

    const parts = value.split("-").map(Number);

    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  };

  const checkInDate = parseLocalDate(checkIn);
  const checkOutDate = parseLocalDate(checkOut);

  const nights =
    checkInDate && checkOutDate
      ? Math.max(
          0,
          Math.round(
            (checkOutDate.getTime() - checkInDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;

  const estimatedNights = nights > 0 ? nights : 1;
  const roomTotal = room ? room.basePrice * estimatedNights : 0;

  const reservationFee = Math.round(roomTotal * (reservationFeePercent / 100));

  const estimatedTotal = roomTotal + reservationFee;

  // Load room type details from Firestore.
  useEffect(() => {
    let active = true;

    const loadRoom = async () => {
      if (!id) {
        setRoom(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const roomRef = doc(db, "roomTypes", id);
        const roomSnap = await getDoc(roomRef);

        if (!active) return;

        if (roomSnap.exists()) {
          const data = roomSnap.data();

          const roomData: RoomType = {
            id: roomSnap.id,
            name: String(data.name || ""),
            count: Math.max(
              0,
              Number(data.count ?? data.quantity ?? data.totalRooms ?? 0),
            ),
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            maxGuests: Math.max(
              1,
              Number(data.maxGuests ?? data.capacity ?? 1),
            ),
            basePrice: Math.max(0, Number(data.basePrice ?? data.price ?? 0)),
            image: String(data.image || ""),
          };

          setRoom(roomData);
        } else {
          setRoom(null);
        }
      } catch (error) {
        console.error("Error loading room:", error);

        if (active) setRoom(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRoom();

    return () => {
      active = false;
    };
  }, [id]);

  // Load the reservation fee percentage.
  useEffect(() => {
    let active = true;

    const loadReservationFee = async () => {
      try {
        const feeRef = doc(db, "settings", "reservationFee");
        const feeSnap = await getDoc(feeRef);

        if (!active || !feeSnap.exists()) return;

        const percent = Number(feeSnap.data().percent);

        if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
          setReservationFeePercent(percent);
        }
      } catch (error) {
        console.error("Error loading reservation fee:", error);
      }
    };

    loadReservationFee();

    return () => {
      active = false;
    };
  }, []);

  // Preserve dates, guest count, and availability filters when returning
  // to the room list.
  const buildRoomsUrl = () => {
    const params = new URLSearchParams();

    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);

    params.set("guests", String(guests));

    const availableRoomTypes = searchParams.get("availableRoomTypes");

    if (availableRoomTypes !== null) {
      params.set("availableRoomTypes", availableRoomTypes);
    }

    return `/rooms?${params.toString()}`;
  };

  // Preserve the same selection when continuing to booking or authentication.
  const bookingState = {
    checkIn,
    checkOut,
    guests,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-muted-foreground">Loading room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>

        <p className="font-medium text-foreground">Room not found</p>

        <Link
          to={buildRoomsUrl()}
          className="mt-4 text-primary text-sm hover:underline"
        >
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        to={buildRoomsUrl()}
        state={bookingState}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rooms
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <div className="relative rounded-2xl overflow-hidden h-72 md:h-96 bg-muted mb-3">
            {room.image ? (
              <img
                src={room.image}
                alt={room.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No image available
              </div>
            )}

            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-medium text-primary">
                {room.name}
              </span>
            </div>
          </div>

          <h1
            className="text-foreground mb-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.875rem",
              fontWeight: 700,
            }}
          >
            {room.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              Up to {room.maxGuests} guests
            </span>

            <span>
              {room.count} room{room.count !== 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Comfortable accommodation for up to {room.maxGuests} guests.
          </p>

          <div className="mb-6">
            <h2
              className="font-semibold text-foreground mb-3"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Amenities
            </h2>

            {room.amenities.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {room.amenities.map((amenity, index) => (
                  <div
                    key={`${amenity}-${index}`}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {amenity}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No amenities listed.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 bg-white rounded-2xl border border-border shadow-lg p-6">
            <div className="mb-4">
              <span className="text-accent font-bold text-3xl">
                ₱{room.basePrice.toLocaleString()}
              </span>

              <span className="text-muted-foreground text-sm">/night</span>
            </div>

            {room.count <= 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">😞</div>

                <p className="font-medium text-foreground">
                  This room is unavailable
                </p>

                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Check back later or explore other options.
                </p>

                <Link
                  to={buildRoomsUrl()}
                  state={bookingState}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Browse all rooms
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-muted rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Check-in
                      </div>

                      <div className="text-sm font-medium text-foreground">
                        {checkInLabel}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Check-out
                      </div>

                      <div className="text-sm font-medium text-foreground">
                        {checkOutLabel}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Guests
                    </div>

                    <div className="text-sm font-medium text-foreground">
                      {guests} guest{guests !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      navigate("/auth", {
                        state: {
                          ...bookingState,
                          returnTo: `/booking/${room.id}`,
                        },
                      });

                      return;
                    }

                    navigate(`/booking/${room.id}`, {
                      state: bookingState,
                    });
                  }}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
                >
                  Reserve This Room
                </button>

                <p className="text-center text-xs text-muted-foreground mt-3">
                  No charge yet — confirm on the next step
                </p>

                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ₱{room.basePrice.toLocaleString()} × {estimatedNights}{" "}
                      {estimatedNights === 1 ? "night" : "nights"}
                    </span>

                    <span className="text-foreground">
                      ₱{roomTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Reservation fee ({reservationFeePercent}%)
                    </span>

                    <span className="text-foreground">
                      ₱{reservationFee.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between font-semibold text-sm pt-2 border-t border-border">
                    <span>Estimated total</span>

                    <span className="text-accent">
                      ₱{estimatedTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
