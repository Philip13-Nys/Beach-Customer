import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { rooms, sampleReviews } from "../data/mockData";
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

export default function RoomDetail() {
  const { id } = useParams();
  const room = rooms.find((r) => r.id === id);
  const { user } = useApp();
  const navigate = useNavigate();
  const [imgIdx, setImgIdx] = useState(0);

  if (!room)
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-medium text-foreground">Room not found</p>
        <Link to="/rooms" className="mt-4 text-primary text-sm hover:underline">
          Back to rooms
        </Link>
      </div>
    );

  const reviews = sampleReviews.filter((r) => r.roomName === room.name);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link
        to="/rooms"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to rooms
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: images + info */}
        <div className="lg:col-span-3">
          {/* Image gallery */}
          <div className="relative rounded-2xl overflow-hidden h-72 md:h-96 bg-muted mb-3">
            <img
              src={room.images[imgIdx]}
              alt={room.name}
              className="w-full h-full object-cover"
            />
            {room.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setImgIdx(
                      (i) => (i - 1 + room.images.length) % room.images.length,
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % room.images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {room.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-medium text-primary capitalize">
                {room.type.replace("-", " ")}
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {room.images.length > 1 && (
            <div className="flex gap-2 mb-6">
              {room.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition-colors ${i === imgIdx ? "border-primary" : "border-transparent"}`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

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
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <strong className="text-foreground">{room.rating}</strong> (
              {room.reviews} reviews)
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> Up to {room.capacity} guests
            </span>
            <span className="flex items-center gap-1">
              <Maximize2 className="w-4 h-4" /> {room.size} m²
            </span>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {room.description}
          </p>

          {/* Amenities */}
          <div className="mb-6">
            <h2
              className="font-semibold text-foreground mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Amenities
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {room.amenities.map((a) => (
                <div
                  key={a}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <h2
                className="font-semibold text-foreground mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Guest Reviews
              </h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-muted rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={review.guestAvatar}
                        alt={review.guestName}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-sm text-foreground">
                          {review.guestName}
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {review.date}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      "{review.comment}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Booking card */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 bg-white rounded-2xl border border-border shadow-lg p-6">
            <div className="mb-4">
              <span className="text-accent font-bold text-3xl">
                ₱{room.price.toLocaleString()}
              </span>
              <span className="text-muted-foreground text-sm">/night</span>
            </div>

            {!room.available ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">😞</div>
                <p className="font-medium text-foreground">
                  This room is fully booked
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
                      Up to {room.capacity}
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
                      ₱{room.price.toLocaleString()} × 1 night
                    </span>
                    <span className="text-foreground">
                      ₱{room.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service fee</span>
                    <span className="text-foreground">
                      ₱{Math.round(room.price * 0.05).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-sm pt-2 border-t border-border">
                    <span>Estimated total</span>
                    <span className="text-accent">
                      ₱{Math.round(room.price * 1.05).toLocaleString()}
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
