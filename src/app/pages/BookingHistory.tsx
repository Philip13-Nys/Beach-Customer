import { Link, Navigate, useLocation } from "react-router";
import { Booking, useApp } from "../context/AppContext";
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
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, customerDb } from "../components/firebase";

type BookingWithPayment = Booking & {
  id: string;
  amountPaid?: number;
  remainingBalance?: number;
  bookingRef?: string;
  roomImage?: string;
  roomName?: string;
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

const isReviewEligible = (status?: string) =>
  ["completed", "checked-out", "checked out"].includes(normalizeStatus(status));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const location = useLocation();

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
  const { user } = useApp();

  const [bookings, setBookings] = useState<BookingWithPayment[]>([]);
  const [filter, setFilter] = useState<
    "all" | "confirmed" | "completed" | "cancelled"
  >("all");

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
      : bookings.filter(
          (booking) => normalizeStatus(booking.status) === filter,
        );

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!user || !currentUser) {
      setBookings([]);
      return;
    }

    const customerUid = currentUser.uid;

    if (user.id && user.id !== customerUid) {
      console.error("Booking History user does not match auth.currentUser.");
      setBookings([]);
      return;
    }

    const bookingsQuery = query(
      collection(customerDb, "Bookings"),
      where("userId", "==", customerUid),
    );

    const previousStatuses = new Map<
      string,
      { status: string; paymentStatus: string }
    >();

    let isFirstSnapshot = true;
    let isActive = true;

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        if (!isActive) return;

        const bookingList: BookingWithPayment[] = snapshot.docs.map(
          (bookingDoc) => {
            const data = bookingDoc.data();

            const totalPrice = Number(
              data.totalPrice ?? data.totalAmount ?? data.total ?? 0,
            );

            const amountPaid = Number(data.amountPaid ?? 0);
            const remainingBalance = Math.max(0, totalPrice - amountPaid);

            const paymentStatus =
              remainingBalance <= 0
                ? "paid"
                : amountPaid > 0
                  ? "partial"
                  : "unpaid";

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

        setBookings(bookingList);

        if (isFirstSnapshot) {
          snapshot.docs.forEach((bookingDoc) => {
            const data = bookingDoc.data();

            previousStatuses.set(bookingDoc.id, {
              status: normalizeStatus(data.status),
              paymentStatus: String(data.paymentStatus ?? ""),
            });
          });

          isFirstSnapshot = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "modified") return;

          const bookingId = change.doc.id;
          const data = change.doc.data();
          const oldStatus = previousStatuses.get(bookingId);

          const totalPrice = Number(
            data.totalPrice ?? data.totalAmount ?? data.total ?? 0,
          );

          const amountPaid = Number(data.amountPaid ?? 0);
          const remainingBalance = Math.max(0, totalPrice - amountPaid);

          const newStatus = {
            status: normalizeStatus(data.status),
            paymentStatus:
              remainingBalance <= 0
                ? "paid"
                : amountPaid > 0
                  ? "partial"
                  : "unpaid",
          };

          previousStatuses.set(bookingId, newStatus);

          if (!oldStatus) return;

          const bookingRef = data.bookingRef || bookingId;
          const roomName = data.roomName || "your reservation";

          const notifications: {
            type: string;
            title: string;
            message: string;
          }[] = [];

          if (oldStatus.status !== newStatus.status) {
            if (newStatus.status === "confirmed") {
              notifications.push({
                type: "booking",
                title: "Booking Confirmed",
                message: `Your booking ${bookingRef} for ${roomName} has been confirmed.`,
              });
            } else if (newStatus.status === "cancelled") {
              notifications.push({
                type: "booking",
                title: "Booking Cancelled",
                message: `Your booking ${bookingRef} for ${roomName} has been cancelled.`,
              });
            } else if (newStatus.status === "completed") {
              notifications.push({
                type: "booking",
                title: "Stay Completed",
                message: `Your stay for booking ${bookingRef} has been marked as completed.`,
              });
            }
          }

          if (oldStatus.paymentStatus !== newStatus.paymentStatus) {
            if (newStatus.paymentStatus === "paid") {
              notifications.push({
                type: "payment",
                title: "Payment Confirmed",
                message: `Your payment for booking ${bookingRef} has been marked as paid.`,
              });
            } else if (newStatus.paymentStatus === "partial") {
              notifications.push({
                type: "payment",
                title: "Partial Payment Received",
                message: `A partial payment for booking ${bookingRef} has been recorded.`,
              });
            }
          }

          for (const notification of notifications) {
            if (!isActive) return;

            addDoc(collection(customerDb, "Notifications"), {
              userId: customerUid,
              role: "customer",
              bookingId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              targetPath: `/booking-confirmation/${bookingId}`,
              read: false,
              createdAt: serverTimestamp(),
            }).catch((error) => {
              console.error("Could not create customer notification:", error);
            });
          }
        });
      },
      (error) => {
        console.error("Booking listener error:", error);
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

  const handleCancel = async (id: string) => {
    try {
      await updateDoc(doc(customerDb, "Bookings", id), {
        status: "cancelled",
      });

      setBookings((previous) =>
        previous.map((booking) =>
          booking.id === id ? { ...booking, status: "cancelled" } : booking,
        ),
      );

      setCancelTarget(null);
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  };

  const handleModify = async () => {
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

    const paymentStatus =
      remainingBalance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";

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

  const handleSubmitReview = async () => {
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
      const existingReviewQuery = query(
        collection(customerDb, "reviews"),
        where("userId", "==", currentUser.uid),
        where("bookingId", "==", target.id),
      );

      const existingReviews = await getDocs(existingReviewQuery);

      if (!existingReviews.empty) {
        setReviewedBookingIds((previous) =>
          previous.includes(target.id) ? previous : [...previous, target.id],
        );

        setReviewError("You have already reviewed this booking.");
        return;
      }

      const guestName =
        currentUser.displayName || currentUser.email?.split("@")[0] || "Guest";

      await addDoc(collection(customerDb, "reviews"), {
        bookingId: target.id,
        bookingRef: target.bookingRef || target.id,
        userId: currentUser.uid,
        guestName,
        guestAvatar: currentUser.photoURL || "",
        roomName: target.roomName || "Resort Stay",
        rating: reviewRating,
        comment,
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        status: "published",
      });

      setReviewedBookingIds((previous) =>
        previous.includes(target.id) ? previous : [...previous, target.id],
      );

      setReviewSuccess(true);
    } catch (error) {
      console.error("Error submitting review:", error);
      setReviewError(
        "Unable to submit your review. Please check your connection and try again.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-600",
    completed: "bg-blue-100 text-blue-700",
    "checked-out": "bg-blue-100 text-blue-700",
    "checked out": "bg-blue-100 text-blue-700",
  };

  const paymentColors: Record<string, string> = {
    paid: "bg-green-50 text-green-600",
    partial: "bg-orange-50 text-orange-600",
    unpaid: "bg-red-50 text-red-600",
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

      {filtered.length === 0 ? (
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

            const paymentStatus =
              remainingBalance <= 0
                ? "paid"
                : amountPaid > 0
                  ? "partial"
                  : "unpaid";

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-0">
                  <div className="sm:w-44 h-36 sm:h-auto flex-shrink-0">
                    <img
                      src={
                        booking.roomImage ||
                        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
                      }
                      alt={booking.roomName || "Booked room"}
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
                          {booking.roomName || "Resort Stay"}
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
                          {booking.status
                            ? booking.status.charAt(0).toUpperCase() +
                              booking.status.slice(1)
                            : "Unknown"}
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
                              : "Unpaid"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {booking.checkIn || "—"} – {booking.checkOut || "—"}
                      </span>

                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {booking.guests ?? 0} guests · {booking.nights ?? 0}{" "}
                        nights
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
                        <>
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

                          <button
                            type="button"
                            onClick={() => setCancelTarget(booking.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-destructive px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </>
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
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />

              <h2
                className="font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Cancel Reservation?
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mb-5">
              This action cannot be undone. Please review our cancellation
              policy before proceeding. Free cancellation is available up to 48
              hours before check-in.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Keep Booking
              </button>

              <button
                type="button"
                onClick={() => handleCancel(cancelTarget)}
                className="flex-1 bg-destructive text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Yes, Cancel
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
                    className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Update
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
                      {reviewTarget.roomName || "Resort Stay"} ·{" "}
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
