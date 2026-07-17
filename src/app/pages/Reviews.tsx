import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { sampleReviews } from "../data/mockData";
import { Star, CheckCircle2, Send } from "lucide-react";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              i <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const navigate = useNavigate();
  if (!user) {
    navigate("/auth");
    return null;
  }
  return <>{children}</>;
}

export default function Reviews() {
  return (
    <RequireAuth>
      <ReviewsContent />
    </RequireAuth>
  );
}

function ReviewsContent() {
  const { user, bookings } = useApp();
  const completedBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "confirmed",
  );

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<"room" | "service" | "overall">(
    "overall",
  );
  const [selectedBooking, setSelectedBooking] = useState(
    completedBookings[0]?.id || "",
  );
  const [submitted, setSubmitted] = useState(false);
  const [reviews, setReviews] = useState(sampleReviews);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !comment) return;
    const newReview = {
      id: "rev_" + Date.now(),
      guestName: user!.firstName + " " + user!.lastName,
      guestAvatar: user!.avatar,
      rating,
      comment,
      date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      roomName: completedBookings.find((b) => b.id === selectedBooking)
        ?.roomName,
    };
    setReviews((prev) => [newReview, ...prev]);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setComment("");
    }, 4000);
  };

  const avgRating = (
    reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  ).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "#0A2540",
          }}
        >
          Reviews & Feedback
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your experience and help future guests plan their perfect stay.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Submit form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border p-5 sticky top-24">
            <h2
              className="font-semibold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}
            >
              Leave a Review
            </h2>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3
                  className="font-semibold text-foreground mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Thank you!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your review helps us improve and assists fellow travelers.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {completedBookings.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Review For
                    </label>
                    <select
                      value={selectedBooking}
                      onChange={(e) => setSelectedBooking(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {completedBookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.roomName} · {b.checkIn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Review Category
                  </label>
                  <div className="flex gap-2">
                    {(["overall", "room", "service"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`flex-1 py-2 text-xs rounded-lg border transition-colors font-medium ${
                          category === c
                            ? "bg-primary text-white border-primary"
                            : "border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">
                    Your Rating
                  </label>
                  <StarPicker value={rating} onChange={setRating} />
                  {rating > 0 && (
                    <p className="text-sm text-accent font-medium mt-1">
                      {LABELS[rating]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your Experience
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share the highlights of your stay — what you loved, what surprised you, and what future guests should know..."
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/60"
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {comment.length}/500
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!rating || !comment.trim()}
                  className="w-full bg-accent text-white py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> Submit Review
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Reviews list */}
        <div className="lg:col-span-3">
          {/* Summary */}
          <div className="bg-primary text-white rounded-2xl p-5 mb-6 flex items-center gap-5">
            <div className="text-center">
              <div
                className="text-5xl font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {avgRating}
              </div>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(Number(avgRating)) ? "fill-accent text-accent" : "text-white/30"}`}
                  />
                ))}
              </div>
              <div className="text-xs text-white/60 mt-1">
                {reviews.length} reviews
              </div>
            </div>
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = reviews.filter((r) => r.rating === n).length;
                const pct = Math.round((count / reviews.length) * 100);
                return (
                  <div key={n} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-white/70 w-3">{n}</span>
                    <Star className="w-3 h-3 fill-accent text-accent flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-6">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review cards */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl border border-border p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={review.guestAvatar}
                    alt={review.guestName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground text-sm">
                        {review.guestName}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {review.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
                          />
                        ))}
                      </div>
                      {review.roomName && (
                        <span className="text-xs text-muted-foreground">
                          · {review.roomName}
                        </span>
                      )}
                      {review.serviceName && (
                        <span className="text-xs text-muted-foreground">
                          · {review.serviceName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "{review.comment}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
