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
  serverTimestamp,
} from "firebase/firestore";
import { auth, customerDb } from "../components/firebase";

type BookingWithPayment = Booking & {
  amountPaid?: number;
  remainingBalance?: number;
};

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
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

  const filtered =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  // Listen for booking and payment status changes in real time.
  // Notifications are created by the customer while signed in.
  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!user || !currentUser) {
      setBookings([]);
      return;
    }

    const customerUid = currentUser.uid;

    // Avoid accidentally listening as a different account than
    // the one represented by the app context.
    if (user.id && user.id !== customerUid) {
      console.error(
        "Booking History user does not match customerAuth.currentUser.",
      );
      setBookings([]);
      return;
    }

    const q = query(
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
      q,
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
              id: bookingDoc.id,
              ...data,
              totalPrice,
              amountPaid,
              remainingBalance,
              paymentStatus,
            } as BookingWithPayment;
          },
        );

        setBookings(bookingList);

        // Initial snapshot establishes the baseline.
        // Do not notify for old statuses already in Firestore.
        if (isFirstSnapshot) {
          snapshot.docs.forEach((bookingDoc) => {
            const data = bookingDoc.data();

            previousStatuses.set(bookingDoc.id, {
              status: data.status ?? "",
              paymentStatus: data.paymentStatus ?? "",
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
            status: data.status ?? "",
            paymentStatus:
              remainingBalance <= 0
                ? "paid"
                : amountPaid > 0
                  ? "partial"
                  : "unpaid",
          };

          // Update baseline immediately to prevent repeated attempts.
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

  const handleCancel = async (id: string) => {
    try {
      await updateDoc(doc(customerDb, "Bookings", id), {
        status: "cancelled",
      });

      setBookings((prev) =>
        prev.map((booking) =>
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
      return;
    }

    const checkInDate = new Date(`${modifyDates.checkIn}T00:00:00`);
    const checkOutDate = new Date(`${modifyDates.checkOut}T00:00:00`);

    if (
      Number.isNaN(checkInDate.getTime()) ||
      Number.isNaN(checkOutDate.getTime()) ||
      checkOutDate <= checkInDate
    ) {
      console.error("Check-out must be after check-in.");
      return;
    }

    const nights = Math.ceil(
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

    try {
      await updateDoc(doc(customerDb, "Bookings", modifyTarget.id), {
        checkIn: modifyDates.checkIn,
        checkOut: modifyDates.checkOut,
        nights,
        totalPrice,
        remainingBalance,
        paymentStatus,
      });

      setBookings((prev) =>
        prev.map((booking) =>
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

      setTimeout(() => {
        setModifyTarget(null);
        setModifySuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error modifying booking:", error);
    }
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-600",
    completed: "bg-blue-100 text-blue-700",
  };

  const paymentColors: Record<string, string> = {
    paid: "bg-green-50 text-green-600",
    partial: "bg-orange-50 text-orange-600",
    unpaid: "bg-red-50 text-red-600",
  };

  const totalSpent = bookings
    .filter((b) => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + Number(b.amountPaid ?? b.totalPrice ?? 0), 0);

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.checkIn) >= new Date(),
  ).length;

  const completed = bookings.filter((b) => b.status === "completed").length;

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

      {/* Stats row */}
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

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(["all", "confirmed", "completed", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-primary text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
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

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-0">
                  <div className="sm:w-44 h-36 sm:h-auto flex-shrink-0">
                    <img
                      src={booking.roomImage}
                      alt={booking.roomName}
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
                          {booking.roomName}
                        </h2>
                        <p
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {booking.bookingRef}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            statusColors[booking.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {booking.status.charAt(0).toUpperCase() +
                            booking.status.slice(1)}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            paymentColors[
                              remainingBalance <= 0
                                ? "paid"
                                : amountPaid > 0
                                  ? "partial"
                                  : "unpaid"
                            ] || "bg-gray-50 text-gray-600"
                          }`}
                        >
                          {remainingBalance <= 0
                            ? "Paid"
                            : amountPaid > 0
                              ? "Partial"
                              : "Unpaid"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {booking.checkIn} – {booking.checkOut}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {booking.guests} guests · {booking.nights} nights
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" />₱
                        {totalPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* Payment balance details */}
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

                    {booking.addOns?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {booking.addOns.map((a, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-secondary text-primary text-[10px] rounded-full"
                          >
                            {a.name}
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

                      {remainingBalance > 0 && (
                        <Link
                          to={`/payment?bookingId=${booking.id}`}
                          className="flex items-center gap-1.5 text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {amountPaid > 0 ? "Pay Balance" : "Pay Now"}
                        </Link>
                      )}

                      {booking.status === "confirmed" && (
                        <>
                          <button
                            onClick={() => {
                              setModifyTarget(booking);
                              setModifyDates({
                                checkIn: booking.checkIn,
                                checkOut: booking.checkOut,
                              });
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Modify
                          </button>
                          <button
                            onClick={() => setCancelTarget(booking.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-destructive px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </>
                      )}

                      {booking.status === "completed" && (
                        <Link
                          to="/reviews"
                          className="flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                          ⭐ Leave Review
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel modal */}
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
                onClick={() => setCancelTarget(null)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={() => handleCancel(cancelTarget)}
                className="flex-1 bg-destructive text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modify modal */}
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
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      New Check-in Date
                    </label>
                    <input
                      type="date"
                      value={modifyDates.checkIn}
                      onChange={(e) =>
                        setModifyDates((d) => ({
                          ...d,
                          checkIn: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      New Check-out Date
                    </label>
                    <input
                      type="date"
                      value={modifyDates.checkOut}
                      onChange={(e) =>
                        setModifyDates((d) => ({
                          ...d,
                          checkOut: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModifyTarget(null)}
                    className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
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
    </div>
  );
}
