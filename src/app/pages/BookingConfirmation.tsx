import { useParams, Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { customerDb } from "../components/firebase";
import {
  CheckCircle2,
  Calendar,
  Users,
  CreditCard,
  Download,
  ArrowRight,
} from "lucide-react";

type Booking = {
  id: string;
  bookingRef?: string;
  status?: string;
  paymentStatus?: string;
  totalPrice?: number;
  subtotal?: number;
  reservationFee?: number;
  reservationFeePercent?: number;
  roomRate?: number;
  nights?: number;
  guests?: number;
  roomName?: string;
  roomImage?: string;
  checkIn?: string;
  checkOut?: string;
  addOns?: { name: string; price?: number }[];
  specialRequests?: string;
};

export default function BookingConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setBooking(null);
      setLoading(false);
      setError("Missing booking ID.");
      return;
    }

    setLoading(true);
    setError("");

    const bookingRef = doc(customerDb, "Bookings", id);

    const unsubscribe = onSnapshot(
      bookingRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setBooking({
            id: snapshot.id,
            ...snapshot.data(),
          } as Booking);
          setError("");
        } else {
          setBooking(null);
          setError("Booking not found.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to booking:", err);
        setBooking(null);
        setError("Unable to load live booking details. Please try again.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [id]);

  const formatPeso = (amount: number) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatStatus = (value?: string) => {
    const status = value || "pending";
    return (
      status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ")
    );
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Loading booking...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-medium text-foreground">
          {error || "Booking not found."}
        </p>
        <Link
          to="/booking-history"
          className="text-primary text-sm mt-2 block hover:underline"
        >
          View all bookings
        </Link>
      </div>
    );
  }

  const total = Number(booking.totalPrice ?? 0);
  const fee = Number(booking.reservationFee ?? 0);
  const feePercent = Number(booking.reservationFeePercent ?? 0);
  const subtotal = Number(booking.subtotal ?? total - fee);
  const nights = Number(booking.nights ?? 0);
  const guests = Number(booking.guests ?? 0);
  const paymentStatus = booking.paymentStatus ?? "unpaid";
  const bookingStatus = booking.status ?? "pending";

  return (
    <div className="print-area max-w-2xl mx-auto px-4 py-12">
      {/* Success header */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>

        <h1
          className="text-foreground mb-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 700,
          }}
        >
          Booking Details
        </h1>

        <p className="text-muted-foreground text-sm">
          Your reservation details and payment status are shown below. Booking
          updates will appear automatically.
        </p>

        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 rounded-full">
          <span className="text-xs text-muted-foreground">
            Booking Reference:
          </span>
          <span
            className="text-sm font-bold text-primary"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {booking.bookingRef ?? booking.id}
          </span>
        </div>
      </div>

      {/* Booking details card */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm mb-6">
        <div className="flex items-center gap-4 p-5 border-b border-border">
          {booking.roomImage ? (
            <img
              src={booking.roomImage}
              alt={booking.roomName ?? "Booked room"}
              className="w-20 h-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-16 rounded-xl bg-secondary flex-shrink-0" />
          )}

          <div className="min-w-0">
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {booking.roomName ?? "Room Booking"}
            </h2>

            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  bookingStatus === "confirmed"
                    ? "bg-green-100 text-green-700"
                    : bookingStatus === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {formatStatus(bookingStatus)}
              </span>

              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  paymentStatus === "paid"
                    ? "bg-blue-100 text-blue-700"
                    : paymentStatus === "partial"
                      ? "bg-orange-100 text-orange-700"
                      : paymentStatus === "pending_verification"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                }`}
              >
                Payment: {formatStatus(paymentStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* Stay details */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Check-in</div>
              <div className="text-sm font-semibold text-foreground">
                {booking.checkIn ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">From 2:00 PM</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Check-out</div>
              <div className="text-sm font-semibold text-foreground">
                {booking.checkOut ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Until 12:00 PM
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Guests</div>
              <div className="text-sm font-semibold text-foreground">
                {guests} guest{guests === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-muted-foreground">
                {nights} night{nights === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="px-5 pb-5">
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">
              Price Breakdown
            </h3>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Room ({nights} night{nights === 1 ? "" : "s"})
              </span>
              <span>{formatPeso(Number(booking.roomRate ?? 0) * nights)}</span>
            </div>

            {Array.isArray(booking.addOns) &&
              booking.addOns.map((addon, index) => (
                <div key={index} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{addon.name}</span>
                  <span>{formatPeso(Number(addon.price ?? 0))}</span>
                </div>
              ))}

            <div className="flex justify-between gap-3 text-sm border-t border-border pt-3">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPeso(subtotal)}</span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Reservation Fee ({feePercent}%)
              </span>
              <span>{formatPeso(fee)}</span>
            </div>

            <div className="flex justify-between gap-3 text-base font-bold border-t border-border pt-3">
              <span>Total Amount</span>
              <span className="text-accent">{formatPeso(total)}</span>
            </div>
          </div>
        </div>

        {Array.isArray(booking.addOns) && booking.addOns.length > 0 && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Booked Activities
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.addOns.map((addon, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 bg-secondary text-primary text-xs rounded-full"
                >
                  {addon.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {booking.specialRequests && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="text-xs text-muted-foreground mb-1">
              Special Requests
            </div>
            <p className="text-sm text-foreground">{booking.specialRequests}</p>
          </div>
        )}
      </div>

      {/* What's next */}
      <div className="bg-secondary rounded-2xl p-5 mb-6">
        <h3
          className="font-semibold text-foreground mb-3 text-sm"
          style={{ fontFamily: "var(--font-display)" }}
        >
          What happens next?
        </h3>

        <div className="space-y-2">
          {[
            "Your booking is saved. Check this page for status updates.",
            "The resort team will review your reservation.",
            "Complete your payment if it is still unpaid.",
            "Prepare for your stay and enjoy your trip!",
          ].map((step, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                {index + 1}
              </div>
              <p className="text-sm text-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="print:hidden flex flex-col sm:flex-row gap-3">
        {["unpaid", "rejected"].includes(paymentStatus) && (
          <button
            type="button"
            onClick={() => {
              navigate(`/payment?bookingId=${encodeURIComponent(booking.id)}`);
            }}
            className="flex-1 bg-accent text-white text-center py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            {paymentStatus === "rejected" ? "Resubmit Payment" : "Pay Now"}
          </button>
        )}

        <Link
          to="/booking-history"
          className="flex-1 border border-border text-foreground text-center py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          View All Bookings
          <ArrowRight className="w-4 h-4" />
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}
