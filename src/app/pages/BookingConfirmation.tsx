import { useParams, Link } from "react-router";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../components/firebase";
import { useApp } from "../context/AppContext";
import {
  CheckCircle2,
  Calendar,
  Users,
  CreditCard,
  Download,
  ArrowRight,
} from "lucide-react";

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBooking = async () => {
      if (!id) return;

      const snap = await getDoc(doc(db, "Bookings", id));

      if (snap.exists()) {
        setBooking({
          id: snap.id,
          ...snap.data(),
        });
      }

      setLoading(false);
    };

    loadBooking();
  }, [id]);

  if (loading) {
    return <div className="text-center py-20">Loading booking...</div>;
  }
  if (!booking)
    return (
      <div className="text-center py-24 text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-medium text-foreground">Booking not found.</p>
        <Link
          to="/booking-history"
          className="text-primary text-sm mt-2 block hover:underline"
        >
          View all bookings
        </Link>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
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
          Booking Confirmed!
        </h1>
        <p className="text-muted-foreground text-sm">
          Your reservation has been successfully placed. A confirmation email
          has been sent to your registered email address.
        </p>
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 rounded-full">
          <span className="text-xs text-muted-foreground">
            Booking Reference:
          </span>
          <span
            className="text-sm font-bold text-primary"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {booking.bookingRef}
          </span>
        </div>
      </div>

      {/* Booking details card */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm mb-6">
        <div className="flex items-center gap-4 p-5 border-b border-border">
          <img
            src={booking.roomImage}
            alt={booking.roomName}
            className="w-20 h-16 rounded-xl object-cover flex-shrink-0"
          />
          <div>
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {booking.roomName}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  booking.status === "confirmed"
                    ? "bg-green-100 text-green-700"
                    : booking.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {booking.status.charAt(0).toUpperCase() +
                  booking.status.slice(1)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  booking.paymentStatus === "paid"
                    ? "bg-blue-100 text-blue-700"
                    : booking.paymentStatus === "partial"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                Payment: {booking.paymentStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Check-in</div>
              <div className="text-sm font-semibold text-foreground">
                {booking.checkIn}
              </div>
              <div className="text-xs text-muted-foreground">From 2:00 PM</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Check-out</div>
              <div className="text-sm font-semibold text-foreground">
                {booking.checkOut}
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
                {booking.guests} guest{booking.guests > 1 ? "s" : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {booking.nights} night{booking.nights > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="text-sm font-bold text-accent">
                ₱{booking.totalPrice.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {booking.addOns.length > 0 && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Booked Activities
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.addOns.map((a: any, i: number) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-secondary text-primary text-xs rounded-full"
                >
                  {a.name}
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
            "Confirmation email sent to your registered address",
            "Our team will reach out with check-in details 48 hours before arrival",
            "Complete your payment to secure the booking",
            "Pack your bags and get ready for paradise!",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {booking.paymentStatus === "unpaid" && (
          <Link
            to="/payment"
            className="flex-1 bg-accent text-white text-center py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" /> Pay Now
          </Link>
        )}
        <Link
          to="/booking-history"
          className="flex-1 border border-border text-foreground text-center py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          View All Bookings <ArrowRight className="w-4 h-4" />
        </Link>
        <button
          onClick={() => window.print()}
          className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Download
        </button>
      </div>
    </div>
  );
}
