import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import {
  Star,
  Users,
  Maximize2,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

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

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const loadRoom = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const roomRef = doc(db, "roomTypes", id);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
          const data = roomSnap.data();

          const roomData: RoomType = {
            id: roomSnap.id,
            name: data.name || "",
            count: Number(data.count || 0),
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            maxGuests: Number(data.maxGuests || 1),
            basePrice: Number(data.basePrice || 0),
            image: data.image || "",
          };

          setRoom(roomData);
        } else {
          setRoom(null);
        }
      } catch (error) {
        console.error("Error loading room:", error);
        setRoom(null);
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [id]);

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

        <Link to="/rooms" className="mt-4 text-primary text-sm hover:underline">
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link
        to="/rooms"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rooms
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-3">
          {/* Image */}
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

          {/* Room info */}
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
              {room.count} room
              {room.count !== 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Comfortable accommodation for up to {room.maxGuests} guests.
          </p>

          {/* Amenities */}
          <div className="mb-6">
            <h2
              className="font-semibold text-foreground mb-3"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Amenities
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {room.amenities.map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT - BOOKING */}
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
                  Check back later or explore other options
                </p>

                <Link
                  to="/rooms"
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
                        Select date
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Check-out
                      </div>

                      <div className="text-sm font-medium text-foreground">
                        Select date
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Guests
                    </div>

                    <div className="text-sm font-medium text-foreground">
                      Up to {room.maxGuests}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      navigate("/auth");
                      return;
                    }

                    navigate(`/booking/${room.id}`);
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
                      ₱{room.basePrice.toLocaleString()} × 1 night
                    </span>

                    <span className="text-foreground">
                      ₱{room.basePrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service fee</span>

                    <span className="text-foreground">
                      ₱{Math.round(room.basePrice * 0.05).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between font-semibold text-sm pt-2 border-t border-border">
                    <span>Estimated total</span>

                    <span className="text-accent">
                      ₱{Math.round(room.basePrice * 1.05).toLocaleString()}
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
