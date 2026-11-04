import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { usePublishedReviews } from "../../hooks/usePublishedReviews";
import { reviewSummary } from "../utils/reviews";
import { isCompletedBooking } from "../utils/bookingPolicy";
import { bookingKind, bookingName } from "../utils/bookingPresentation";
import { submitBookingReview } from "../services/customerBookings";
import { useApp } from "../context/AppContext";
import { Star, CheckCircle2, Send } from "lucide-react";
import {
  collection,
  onSnapshot, query, where,
} from "firebase/firestore";
import { customerDb } from "../components/firebase";

function StarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          aria-pressed={value === i}
          className="rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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

function reviewDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function Reviews() {
  const reviewAction = useAsyncAction();
  const { user, authLoading } = useApp();
  const { reviews, loading: loadingReviews, error: reviewsError } = usePublishedReviews();
  const [bookings, setBookings] = useState<Record<string, any>[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const completedBookings = bookings.filter(b => isCompletedBooking(b.status) && !reviewedIds.includes(b.id));

  useEffect(() => {
    setBookings([]); setReviewedIds([]); setEligibilityError("");
    if (authLoading || !user?.id) { setBookingsLoading(false); return; }
    let active = true;
    let bookingsReady = false, reviewsReady = false;
    setBookingsLoading(true);
    const failed = (error: unknown) => {
      console.error("Review eligibility could not be loaded:", error);
      if (active) { setEligibilityError("Unable to check your completed bookings. Please refresh and try again."); setBookingsLoading(false); }
    };
    const stopBookings = onSnapshot(query(collection(customerDb, "Bookings"), where("userId", "==", user.id)), snapshot => {
      if (!active) return;
      setBookings(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
      bookingsReady = true; setBookingsLoading(!reviewsReady);
    }, failed);
    const stopReviews = onSnapshot(query(collection(customerDb, "reviews"), where("userId", "==", user.id)), snapshot => {
      if (!active) return;
      setReviewedIds(snapshot.docs.map(d => String(d.data().bookingId || "")));
      reviewsReady = true; setBookingsLoading(!bookingsReady);
    }, failed);
    return () => { active = false; stopBookings(); stopReviews(); };
  }, [user?.id, authLoading]);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<"room" | "service" | "overall">(
    "overall",
  );
  const [selectedBooking, setSelectedBooking] = useState("");
  const categoryBookings = completedBookings.filter(booking => category === "overall" ||
    (category === "room" ? bookingKind(booking) === "room" : bookingKind(booking) !== "room"));
  const selectedBookingId = categoryBookings.some(b => b.id === selectedBooking) ? selectedBooking : categoryBookings[0]?.id || "";
  const [submitted, setSubmitted] = useState(false);
  const performSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitError("");
    if (!user) { setLoginPrompt(true); return; }
    if (authLoading || bookingsLoading || eligibilityError) return;
    if (!selectedBookingId) { setSubmitError("Complete an eligible booking before submitting a verified review."); return; }
    try {
      await submitBookingReview(selectedBookingId, rating, comment, category);
      setReviewedIds(previous => [...new Set([...previous, selectedBookingId])]);
      setSubmitted(true); setRating(0); setComment("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your review. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return reviewAction.run(() => performSubmit(e));
  };

  const summary = reviewSummary(reviews);
  const avgRating = summary.count ? summary.average.toFixed(1) : "—";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-6 sm:mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-6 lg:gap-8">
        <div className="min-w-0 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-border p-5 sm:p-6">
            <h2
              className="font-semibold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}
            >
              Leave a Review
            </h2>

            {authLoading ? <p role="status" className="text-sm text-muted-foreground">Loading your account...</p>
            : !user ? (
              <div className="space-y-3 text-sm">
                <button type="button" onClick={() => setLoginPrompt(true)} className="rounded-xl bg-primary px-4 py-2 text-white">Write a Review</button>
                {loginPrompt && <p role="status">Please log in to submit a review.</p>}
                <Link to="/auth" state={{ returnTo: "/reviews" }} className="block text-primary underline">Log In</Link>
              </div>
            ) : bookingsLoading ? <p role="status" className="text-sm text-muted-foreground">Loading your completed bookings...</p>
            : eligibilityError ? <p role="alert" className="text-sm text-red-600">{eligibilityError}</p>
            : submitted ? (
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
                <button type="button" onClick={() => setSubmitted(false)} className="mt-3 text-sm text-primary underline">Write another review</button>
              </div>
            ) : completedBookings.length === 0 ? <p className="text-sm text-muted-foreground">You can submit one verified review for each completed booking. Your completed, unreviewed bookings will appear here.</p> : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p id="review-category-label" className="block text-xs font-medium text-foreground mb-2">
                    Review Category
                  </p>
                  <div role="group" aria-labelledby="review-category-label" className="grid grid-cols-3 gap-2">
                    {(["overall", "room", "service"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
                        disabled={reviewAction.pending}
                        onClick={() => {
                          if (category !== c) { setCategory(c); setSelectedBooking(""); }
                          setSubmitError("");
                        }}
                        className={`py-2 text-xs rounded-xl border transition-colors font-medium disabled:opacity-50 ${
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
                  <label htmlFor="review-booking" className="block text-xs font-medium text-foreground mb-2">
                    Booking to Review
                  </label>
                  <select
                    id="review-booking"
                    value={selectedBookingId}
                    disabled={reviewAction.pending || !categoryBookings.length}
                    onChange={(e) => { setSelectedBooking(e.target.value); setSubmitError(""); }}
                    className="w-full min-w-0 rounded-xl border border-border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {!categoryBookings.length && <option value="">No eligible {category === "service" ? "services or packages" : "rooms"}</option>}
                    {categoryBookings.map(b => <option key={b.id} value={b.id}>{bookingName(b)} · {reviewDate(b.bookingDate || b.checkIn)}</option>)}
                  </select>
                </div>

                {!categoryBookings.length ? (
                  <div role="status" className="rounded-xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
                    <p>No completed, unreviewed {category === "service" ? "service or package" : "room"} bookings are available. Each completed booking can be reviewed once.</p>
                    <Link to="/booking-history" className="mt-3 inline-block font-medium text-primary underline underline-offset-2">View Booking History</Link>
                  </div>
                ) : <>
                <div>
                  <p id="review-stars-label" className="block text-xs font-medium text-foreground mb-2">
                    Star Rating
                  </p>
                  <div role="group" aria-labelledby="review-stars-label" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StarPicker value={rating} onChange={setRating} disabled={reviewAction.pending} />
                    {rating > 0 && <span className="text-xs font-medium text-accent">{LABELS[rating]}</span>}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-feedback" className="block text-xs font-medium text-foreground mb-1.5">
                    Written Feedback
                  </label>
                  <textarea
                    id="review-feedback"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={category === "service" ? "Tell us about your service, activity, or package experience..."
                      : category === "room" ? "Tell us about your room, comfort, and cleanliness..."
                      : "Share what you enjoyed and what we could improve..."}
                    rows={4}
                    disabled={reviewAction.pending}
                    maxLength={1000}
                    className="block w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>At least 5 characters</span>
                    <span>{comment.length}/1000</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reviewAction.pending || !selectedBookingId || !rating || comment.trim().length < 5}
                  aria-busy={reviewAction.pending}
                  className="w-full bg-accent text-white py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {reviewAction.pending ? "Submitting..." : "Submit Review"}
                </button>
                </>}
                {submitError && <p role="alert" className="text-sm text-red-600">{submitError}</p>}
              </form>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col lg:h-[max(28rem,calc(100dvh-14rem))]">
          <div className="shrink-0 bg-primary text-white rounded-2xl p-5 sm:p-6 flex items-center gap-5 sm:gap-8">
            <div className="text-center">
              <p className="mb-2 text-xs text-white/80">Overall Resort Rating</p>
              <output
                aria-label="Overall resort rating"
                className="block text-5xl font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {avgRating}
              </output>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(Number(avgRating)) ? "fill-accent text-accent" : "text-white/30"}`}
                  />
                ))}
              </div>
              <div className="text-xs text-white/60 mt-1">
                {summary.count} ratings
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.valid.filter((r) => r.rating === n).length;
                const pct = summary.count ? Math.round((count / summary.count) * 100) : 0;
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

          <div className="flex shrink-0 items-center justify-between gap-3 py-4">
            <h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Guest Reviews</h2>
            <span className="text-xs text-muted-foreground">{reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
          </div>
          <div
            role="region"
            aria-label="Customer reviews"
            tabIndex={0}
            className="min-h-0 max-h-[60dvh] lg:max-h-none lg:flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-2xl pr-2 pb-1 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {loadingReviews && <p role="status">Loading reviews...</p>}
            {reviewsError && <p role="alert" className="text-sm text-red-600">{reviewsError}</p>}
            {!loadingReviews && !reviewsError && !reviews.length && <p className="text-sm text-muted-foreground">No published reviews yet.</p>}
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl border border-border p-4 sm:p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={review.guestAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.guestName)}`}
                    alt={review.guestName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <h3 className="min-w-0 max-w-full break-words font-semibold text-foreground text-sm">
                        {review.guestName}
                      </h3>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {reviewDate(review.date)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      <div aria-label={`${review.rating} out of 5 stars`} className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
                          />
                        ))}
                      </div>
                      {(review.serviceName || review.packageName || review.roomName || review.itemName) &&
                        <span className="text-xs text-muted-foreground">· {review.serviceName || review.packageName || review.roomName || review.itemName}</span>}
                    </div>
                  </div>
                </div>
                <p className="whitespace-pre-line break-words text-sm text-muted-foreground leading-relaxed">
                  {review.comment}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
