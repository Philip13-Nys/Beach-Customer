import { cancellationReason, isCompletedBooking } from "../utils/bookingPolicy";
import { cancelCustomerBooking, submitBookingReview } from "../services/customerBookings";
import {
  bookingKind,
  bookingName,
  bookingStatusLabel,
} from "../utils/bookingPresentation";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Link, Navigate, useLocation } from "react-router";
import { Booking, useApp } from "../context/AppContext";
import { getPaymentSummary } from "../utils/payment";
import {
  Calendar,
  Users,
  CreditCard,
  Eye,
  X,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Star,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { auth, customerDb } from "../components/firebase";

type BookingWithPayment = Booking & {
  id: string;
  amountPaid?: number;
  remainingBalance?: number;
  bookingRef?: string;
  roomImage?: string;
  roomName?: string;
  bookingType?: string;
  itemType?: string;
  itemId?: string;
  itemName?: string;
  serviceId?: string;
  serviceName?: string;
  packageId?: string;
  packageName?: string;
  itemImage?: string;
  bookingDate?: string;
  bookingTime?: string;
  participants?: number;
  roomRate?: number;
  checkIn: string;
  checkOut: string;
  guests?: number;
  nights?: number;
  addOns?: { name: string; price?: number }[];
  totalPrice: number;
  status: string;
  paymentStatus?: string;
};

type ReviewTarget = BookingWithPayment;

const normalizeStatus = (status?: string) =>
  (status || "").toLowerCase().trim();

const isReviewEligible = isCompletedBooking;

function bookingCreatedTime(value: any): number {
  const time =
    typeof value?.toMillis === "function"
      ? value.toMillis()
      : value instanceof Date
        ? value.getTime()
        : value && typeof value === "object" && "seconds" in value
          ? Number(value.seconds) * 1000 + Number(value.nanoseconds || 0) / 1e6
          : typeof value === "string" || typeof value === "number"
            ? new Date(value).getTime()
            : 0;
  return Number.isFinite(time) ? time : 0;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) return <p role="status" className="py-12 text-center text-muted-foreground">Loading your account...</p>;
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function StarPicker({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Choose a rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={rating === star}
          className="rounded-lg p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Star
            className={`h-8 w-8 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}

      <span className="ml-2 text-sm text-muted-foreground">
        {rating > 0
          ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]
          : "Select a rating"}
      </span>
    </div>
  );
}

export default function BookingHistory() {
  return (
    <RequireAuth>
      <BookingHistoryContent />
    </RequireAuth>
  );
}

function BookingHistoryContent() {
  const cancelAction = useAsyncAction();
  const modifyAction = useAsyncAction();
  const reviewAction = useAsyncAction();

  const { user } = useApp();

  const [bookings, setBookings] = useState<BookingWithPayment[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [filter, setFilter] = useState<
    "all" | "confirmed" | "completed" | "cancelled"
  >("all");

  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [modifyTarget, setModifyTarget] = useState<BookingWithPayment | null>(
    null,
  );

  const [modifyDates, setModifyDates] = useState({
    checkIn: "",
    checkOut: "",
  });

  const [modifySuccess, setModifySuccess] = useState(false);
  const [modifyError, setModifyError] = useState("");

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);

  const filtered =
    filter === "all"
      ? bookings
      : bookings.filter((booking) =>
          filter === "completed"
            ? isReviewEligible(booking.status)
            : normalizeStatus(booking.status) === filter,
        );

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!user || !currentUser) {
      setBookings([]);
      setBookingsLoading(false);
      return;
    }

    const customerUid = currentUser.uid;

    if (user.id && user.id !== customerUid) {
      console.error("Booking History user does not match auth.currentUser.");
      setBookings([]);
      setBookingsLoading(false);
      setBookingsError("Your session could not be verified. Please log in again.");
      return;
    }

    const bookingsQuery = query(
      collection(customerDb, "Bookings"),
      where("userId", "==", customerUid),
    );

    let isActive = true;
    setBookingsLoading(true);
    setBookingsError("");

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        if (!isActive) return;

        const bookingList: BookingWithPayment[] = snapshot.docs.map(
          (bookingDoc) => {
            const data = bookingDoc.data({ serverTimestamps: "estimate" });

            const totalPrice = Number(
              data.totalPrice ?? data.totalAmount ?? data.total ?? 0,
            );

            const amountPaid = Number(data.amountPaid ?? 0);
            const remainingBalance = Math.max(0, totalPrice - amountPaid);

            const { paymentStatus } = getPaymentSummary({
              totalPrice,
              amountPaid,
              paymentStatus: data.paymentStatus,
            });

            return {
              ...data,
              id: bookingDoc.id,
              totalPrice,
              amountPaid,
              remainingBalance,
              paymentStatus,
              status: String(data.status ?? "pending"),
              checkIn: String(data.checkIn ?? ""),
              checkOut: String(data.checkOut ?? ""),
            } as BookingWithPayment;
          },
        );

        bookingList.sort(
          (a, b) =>
            bookingCreatedTime(b.createdAt) - bookingCreatedTime(a.createdAt) ||
            a.id.localeCompare(b.id),
        );
        setBookings(bookingList);
        setBookingsLoading(false);
        setBookingsError("");
      },
      (error) => {
        console.error("Booking listener error:", error);
        if (isActive) {
          setBookingsLoading(false);
          setBookingsError("Unable to load your booking history. Please refresh and try again.");
        }
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setReviewedBookingIds([]);
      return;
    }

    const reviewsQuery = query(
      collection(customerDb, "reviews"),
      where("userId", "==", currentUser.uid),
    );

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const ids = snapshot.docs
          .map((reviewDoc) => String(reviewDoc.data().bookingId ?? ""))
          .filter(Boolean);

        setReviewedBookingIds([...new Set(ids)]);
      },
      (error) => {
        console.error("Could not load existing reviews:", error);
      },
    );

    return unsubscribe;
  }, [user]);

  const performCancel = async (id: string) => {
    try {
      setCancelError("");
      setCancelMessage("");
      await cancelCustomerBooking(id);

      setBookings((previous) =>
        previous.map((booking) =>
          booking.id === id ? { ...booking, status: "cancelled" } : booking,
        ),
      );

      setCancelTarget(null);
      setCancelMessage("Booking cancelled successfully. Any refund must be arranged with the resort.");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      setCancelError(error instanceof Error ? error.message : "Unable to cancel this booking. Please try again.");
    }
  };

  const handleCancel = (id: string) => {
    return cancelAction.run(() => performCancel(id));
  };

  const performModify = async () => {
    if (!modifyTarget || !modifyDates.checkIn || !modifyDates.checkOut) {
      setModifyError("Please select both check-in and check-out dates.");
      return;
    }

    const checkInDate = new Date(`${modifyDates.checkIn}T00:00:00`);
    const checkOutDate = new Date(`${modifyDates.checkOut}T00:00:00`);

    if (
      Number.isNaN(checkInDate.getTime()) ||
      Number.isNaN(checkOutDate.getTime()) ||
      checkOutDate <= checkInDate
    ) {
      setModifyError("Check-out must be after check-in.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      setModifyError("Check-in cannot be in the past.");
      return;
    }

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / 86400000,
    );

    const addOnsTotal = (modifyTarget.addOns || []).reduce(
      (sum, addon) => sum + Number(addon.price || 0),
      0,
    );

    const totalPrice =
      Number(modifyTarget.roomRate || 0) * nights + addOnsTotal;

    const amountPaid = Number(modifyTarget.amountPaid || 0);
    const remainingBalance = Math.max(0, totalPrice - amountPaid);

    const { paymentStatus } = getPaymentSummary({
      totalPrice,
      amountPaid,
      paymentStatus: modifyTarget.paymentStatus,
    });

    setModifyError("");

    try {
      await updateDoc(doc(customerDb, "Bookings", modifyTarget.id), {
        checkIn: modifyDates.checkIn,
        checkOut: modifyDates.checkOut,
        nights,
        totalPrice,
        remainingBalance,
        paymentStatus,
      });

      setBookings((previous) =>
        previous.map((booking) =>
          booking.id === modifyTarget.id
            ? {
                ...booking,
                checkIn: modifyDates.checkIn,
                checkOut: modifyDates.checkOut,
                nights,
                totalPrice,
                remainingBalance,
                paymentStatus,
              }
            : booking,
        ),
      );

      setModifySuccess(true);

      window.setTimeout(() => {
        setModifyTarget(null);
        setModifySuccess(false);
        setModifyError("");
      }, 1500);
    } catch (error) {
      console.error("Error modifying booking:", error);
      setModifyError("Unable to update this reservation. Please try again.");
    }
  };

  const handleModify = () => {
    return modifyAction.run(() => performModify());
  };

  const openReviewModal = (booking: BookingWithPayment) => {
    if (!isReviewEligible(booking.status)) return;

    if (reviewedBookingIds.includes(booking.id)) return;

    setReviewTarget(booking);
    setReviewRating(0);
    setReviewComment("");
    setReviewError("");
    setReviewSuccess(false);
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;

    setReviewTarget(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewError("");
    setReviewSuccess(false);
  };

  const performSubmitReview = async () => {
    const currentUser = auth.currentUser;
    const target = reviewTarget;

    if (!currentUser || !target) {
      setReviewError("Please sign in again before submitting your review.");
      return;
    }

    if (!isReviewEligible(target.status)) {
      setReviewError("You can only review a completed booking.");
      return;
    }

    if (reviewedBookingIds.includes(target.id)) {
      setReviewError("You have already submitted a review for this booking.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Please select a star rating from 1 to 5.");
      return;
    }

    const comment = reviewComment.trim();

    if (comment.length < 5) {
      setReviewError("Please enter feedback with at least 5 characters.");
      return;
    }

    if (comment.length > 1000) {
      setReviewError("Your feedback must be 1,000 characters or fewer.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");

    try {
      await submitBookingReview(target.id, reviewRating, comment);

      setReviewedBookingIds((previous) =>
        previous.includes(target.id) ? previous : [...previous, target.id],
      );

      setReviewSuccess(true);
    } catch (error) {
      console.error("Error submitting review:", error);
      setReviewError(
        error instanceof Error ? error.message : "Unable to submit your review. Please try again.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSubmitReview = () => {
    return reviewAction.run(() => performSubmitReview());
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-600",
    completed: "bg-blue-100 text-blue-700",
    "checked-in": "bg-indigo-100 text-indigo-700",
    "checked in": "bg-indigo-100 text-indigo-700",
    "checked-out": "bg-blue-100 text-blue-700",
    "checked out": "bg-blue-100 text-blue-700",
  };

  const paymentColors: Record<string, string> = {
    paid: "bg-green-50 text-green-600",
    partial: "bg-orange-50 text-orange-600",
    unpaid: "bg-red-50 text-red-600",
    pending_verification: "bg-amber-100 text-amber-700",
    rejected: "bg-red-50 text-red-600",
  };

  const totalSpent = bookings
    .filter((booking) => booking.paymentStatus === "paid")
    .reduce(
      (sum, booking) =>
        sum + Number(booking.amountPaid ?? booking.totalPrice ?? 0),
      0,
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = bookings.filter((booking) => {
    if (normalizeStatus(booking.status) !== "confirmed" || !booking.checkIn) {
      return false;
    }

    const checkIn = new Date(`${booking.checkIn}T00:00:00`);

    return !Number.isNaN(checkIn.getTime()) && checkIn >= today;
  }).length;

  const completed = bookings.filter((booking) =>
    isReviewEligible(booking.status),
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {cancelMessage && <p role="status" className="my-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{cancelMessage}</p>}
      {cancelError && !cancelTarget && <p role="alert" className="my-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{cancelError}</p>}
      {bookingsError && <p role="alert" className="my-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{bookingsError}</p>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 700,
              color: "#0A2540",
            }}
          >
            Booking History
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            {bookings.length} total reservation
            {bookings.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Link
          to="/rooms"
          className="text-sm font-medium text-primary border border-primary px-4 py-2 rounded-full hover:bg-secondary transition-colors"
        >
          + New Booking
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: "Total Bookings",
            value: bookings.length,
            color: "text-foreground",
          },
          {
            label: "Upcoming Stays",
            value: upcoming,
            color: "text-blue-600",
          },
          {
            label: "Completed",
            value: completed,
            color: "text-green-600",
          },
          {
            label: "Total Spent",
            value: totalSpent > 0 ? `₱${totalSpent.toLocaleString()}` : "—",
            color: "text-accent",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-border rounded-2xl px-4 py-3"
          >
            <div
              className={`text-xl font-bold ${stat.color}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {stat.value}
            </div>

            <div className="text-xs text-muted-foreground mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(["all", "confirmed", "completed", "cancelled"] as const).map(
          (statusFilter) => (
            <button
              key={statusFilter}
              type="button"
              onClick={() => setFilter(statusFilter)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === statusFilter
                  ? "bg-primary text-white"
                  : "bg-white border border-border text-foreground hover:bg-muted"
              }`}
            >
              {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </button>
          ),
        )}
      </div>

      {bookingsLoading && !bookings.length ? <p role="status" className="py-12 text-center text-muted-foreground">Loading your bookings...</p>
      : bookingsError && !bookings.length ? null
      : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏖️</div>

          <p className="font-medium text-foreground">No bookings found</p>

          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Your {filter !== "all" ? filter : ""} reservations will appear here.
          </p>

          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-accent/90 transition-colors"
          >
            Browse Rooms
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => {
            const totalPrice = Number(booking.totalPrice || 0);
            const amountPaid = Number(booking.amountPaid || 0);
            const remainingBalance = Math.max(0, totalPrice - amountPaid);
            const hasReviewed = reviewedBookingIds.includes(booking.id);
            const normalizedStatus = normalizeStatus(booking.status);
            const isActivity = bookingKind(booking) !== "room";

            const { paymentStatus } = getPaymentSummary(booking);

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-0">
                  <div className="sm:w-44 h-36 sm:h-auto flex-shrink-0">
                    <img
                      src={
                        booking.itemImage ||
                        booking.roomImage ||
                        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
                      }
                      alt={bookingName(booking)}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div>
                        <h2
                          className="font-semibold text-foreground"
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "1.1rem",
                          }}
                        >
                          {bookingName(booking)}
                        </h2>

                        <p
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {booking.bookingRef || booking.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            statusColors[normalizedStatus] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {bookingStatusLabel(booking)}
                        </span>

                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            paymentColors[paymentStatus]
                          }`}
                        >
                          {paymentStatus === "paid"
                            ? "Paid"
                            : paymentStatus === "partial"
                              ? "Partial"
                              : paymentStatus === "pending_verification"
                                ? "Pending Verification"
                                : paymentStatus === "rejected"
                                  ? "Payment Rejected"
                                  : "Unpaid"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {isActivity
                          ? `${booking.bookingDate || booking.checkIn || "—"}${booking.bookingTime ? ` · ${booking.bookingTime}` : ""}`
                          : `${booking.checkIn || "—"} – ${booking.checkOut || "—"}`}
                      </span>

                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {isActivity
                          ? `${booking.participants ?? booking.guests ?? 0} participants`
                          : `${booking.guests ?? 0} guests · ${booking.nights ?? 0} nights`}
                      </span>

                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" />₱
                        {totalPrice.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs mb-3">
                      <span className="text-muted-foreground">
                        Total:{" "}
                        <strong className="text-foreground">
                          ₱{totalPrice.toLocaleString()}
                        </strong>
                      </span>

                      <span className="text-muted-foreground">
                        Amount Paid:{" "}
                        <strong className="text-green-700">
                          ₱{amountPaid.toLocaleString()}
                        </strong>
                      </span>

                      <span className="text-muted-foreground">
                        Remaining Balance:{" "}
                        <strong
                          className={
                            remainingBalance > 0
                              ? "text-red-600"
                              : "text-green-700"
                          }
                        >
                          ₱{remainingBalance.toLocaleString()}
                        </strong>
                      </span>
                    </div>

                    {booking.addOns && booking.addOns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {booking.addOns.map((addon, index) => (
                          <span
                            key={`${addon.name}-${index}`}
                            className="px-2 py-0.5 bg-secondary text-primary text-[10px] rounded-full"
                          >
                            {addon.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                      <Link
                        to={`/booking-confirmation/${booking.id}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </Link>

                      {remainingBalance > 0 &&
                        paymentStatus !== "pending_verification" &&
                        paymentStatus !== "paid" &&
                        normalizedStatus !== "cancelled" && (
                          <Link
                            to={`/payment?bookingId=${booking.id}`}
                            className="flex items-center gap-1.5 text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {amountPaid > 0 ? "Pay Balance" : "Pay Now"}
                          </Link>
                        )}

                      {normalizedStatus === "confirmed" && (
                          <button
                            type="button"
                            onClick={() => {
                              setModifyTarget(booking);
                              setModifyDates({
                                checkIn: booking.checkIn,
                                checkOut: booking.checkOut,
                              });
                              setModifyError("");
                              setModifySuccess(false);
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Modify
                          </button>
                      )}

                      {["pending", "confirmed"].includes(normalizedStatus) && (
                        <div>
                          <button
                            type="button"
                            onClick={() => { setCancelError(""); setCancelTarget(booking.id); }}
                            disabled={Boolean(cancellationReason(booking)) || cancelAction.pending}
                            className="disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium text-destructive px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel Booking
                          </button>
                          {cancellationReason(booking) && <p className="mt-1 text-xs text-muted-foreground max-w-sm">{cancellationReason(booking)}</p>}
                        </div>
                      )}

                      {isReviewEligible(booking.status) &&
                        (hasReviewed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Review Submitted
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReviewModal(booking)}
                            className="flex items-center gap-1.5 text-xs font-medium bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Leave Feedback & Rating
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />

              <h2
                id="cancel-booking-title"
                className="font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Cancel Reservation?
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mb-5">
              This action cannot be undone. Your reservation will be marked as
              cancelled. Cancelling does not automatically issue a refund.
            </p>

            {cancelError && <p role="alert" className="mb-4 text-sm text-red-700">{cancelError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelAction.pending}
                className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Keep Booking
              </button>

              <button
                type="button"
                onClick={() => handleCancel(cancelTarget)}
                disabled={cancelAction.pending}
                aria-busy={cancelAction.pending}
                className="flex-1 bg-destructive text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                {cancelAction.pending ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modifyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2
              className="font-semibold text-foreground mb-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem",
              }}
            >
              Modify Reservation
            </h2>

            {modifySuccess ? (
              <div className="flex items-center gap-2 text-green-700 py-4 justify-center">
                <CheckCircle2 className="w-5 h-5" />
                Reservation updated!
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <div>
                    <label
                      htmlFor="modify-checkin"
                      className="block text-xs font-medium text-foreground mb-1.5"
                    >
                      New Check-in Date
                    </label>

                    <input
                      id="modify-checkin"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={modifyDates.checkIn}
                      onChange={(event) => {
                        setModifyDates((dates) => ({
                          ...dates,
                          checkIn: event.target.value,
                          checkOut:
                            dates.checkOut &&
                            dates.checkOut <= event.target.value
                              ? ""
                              : dates.checkOut,
                        }));
                        setModifyError("");
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="modify-checkout"
                      className="block text-xs font-medium text-foreground mb-1.5"
                    >
                      New Check-out Date
                    </label>

                    <input
                      id="modify-checkout"
                      type="date"
                      min={
                        modifyDates.checkIn
                          ? (() => {
                              const nextDate = new Date(
                                `${modifyDates.checkIn}T00:00:00`,
                              );
                              nextDate.setDate(nextDate.getDate() + 1);
                              return [
                                nextDate.getFullYear(),
                                String(nextDate.getMonth() + 1).padStart(
                                  2,
                                  "0",
                                ),
                                String(nextDate.getDate()).padStart(2, "0"),
                              ].join("-");
                            })()
                          : new Date().toISOString().slice(0, 10)
                      }
                      value={modifyDates.checkOut}
                      onChange={(event) => {
                        setModifyDates((dates) => ({
                          ...dates,
                          checkOut: event.target.value,
                        }));
                        setModifyError("");
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {modifyError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">
                    {modifyError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (modifyAction.pending) return;
                      setModifyTarget(null);
                      setModifyError("");
                    }}
                    className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleModify}
                    disabled={modifyAction.pending || modifySuccess}
                    aria-busy={modifyAction.pending}
                    className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {modifyAction.pending ? "Updating..." : "Update"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
          >
            {reviewSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-700" />
                </div>

                <h2
                  id="review-modal-title"
                  className="text-xl font-semibold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Thank You for Your Feedback!
                </h2>

                <p className="text-sm text-muted-foreground mb-5">
                  Your rating and feedback have been submitted successfully.
                </p>

                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <p className="text-xs text-accent uppercase tracking-wider font-medium mb-1">
                      Guest Feedback
                    </p>

                    <h2
                      id="review-modal-title"
                      className="text-xl font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Rate Your Stay
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                      {bookingName(reviewTarget)} ·{" "}
                      {reviewTarget.bookingRef || reviewTarget.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeReviewModal}
                    disabled={reviewSubmitting}
                    aria-label="Close review form"
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-3">
                    How would you rate your experience?
                  </label>

                  <StarPicker
                    rating={reviewRating}
                    onChange={setReviewRating}
                  />
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="review-comment"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Your Feedback
                  </label>

                  <textarea
                    id="review-comment"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Tell us about your stay, our staff, the room, or your overall experience..."
                    rows={5}
                    maxLength={1000}
                    className="w-full resize-y px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <p className="text-right text-xs text-muted-foreground mt-1">
                    {reviewComment.length}/1000
                  </p>
                </div>

                {reviewError && (
                  <p
                    className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4"
                    role="alert"
                  >
                    {reviewError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    disabled={reviewSubmitting}
                    className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={reviewSubmitting}
                    className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {reviewSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Star className="w-4 h-4" />
                        Submit Review
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
