import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { rooms, services, Booking } from "../data/mockData";
import { useApp } from "../context/AppContext";
import {
  ArrowLeft,
  Calendar,
  Users,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { auth, db } from "../components/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function BookingPage() {
  const { roomId } = useParams();
  const room = rooms.find((r) => r.id === roomId);
  const { user, addBooking, setPendingPayment } = useApp();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [step, setStep] = useState<"form" | "confirm">("form");

  if (!user) {
    navigate("/auth");
    return null;
  }
  if (!room)
    return (
      <div className="text-center py-20 text-muted-foreground">
        Room not found.{" "}
        <Link to="/rooms" className="text-primary">
          Back to rooms
        </Link>
      </div>
    );

  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
    ),
  );
  const addOnServices = services.slice(0, 4);
  const addOns = selectedAddOns.map((id) => {
    const svc = addOnServices.find((s) => s.id === id)!;
    return { name: svc.name, price: svc.price };
  });
  const addOnTotal = addOns.reduce((sum, a) => sum + a.price, 0);
  const roomTotal = room.price * nights;
  const serviceFee = Math.round(roomTotal * 0.05);
  const total = roomTotal + addOnTotal + serviceFee;

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleConfirm = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        alert("Please login first.");
        return;
      }

      const userSnap = await getDoc(doc(db, "Users", currentUser.uid));

      const userData = userSnap.data();

      const docRef = await addDoc(collection(db, "Bookings"), {
        userId: currentUser!.uid,

        customerName: `${userData?.firstName} ${userData?.lastName}`,
        customerEmail: userData?.email,
        customerPhone: userData?.phone,

        roomId: room.id,
        roomName: room.name,

        checkIn,
        checkOut,
        guests,
        nights,

        roomRate: room.price,

        addOns,

        totalPrice: total,

        status: "confirmed",
        paymentStatus: "unpaid",

        bookingRef:
          "CBR-" +
          new Date().getFullYear() +
          "-" +
          Math.floor(Math.random() * 900 + 100),
        specialRequests,
        createdAt: serverTimestamp(),
      });

      navigate(`/booking-confirmation/${docRef.id}`);
    } catch (error) {
      console.error(error);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  if (step === "confirm") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1
          className="text-foreground mb-6"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.875rem",
            fontWeight: 700,
          }}
        >
          Review Your Booking
        </h1>
        <div className="bg-white rounded-2xl border border-border overflow-hidden mb-6">
          <div className="flex gap-4 p-5 border-b border-border">
            <img
              src={room.images[0]}
              alt={room.name}
              className="w-24 h-18 rounded-xl object-cover flex-shrink-0"
              style={{ height: 72 }}
            />
            <div>
              <h2
                className="font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {room.name}
              </h2>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {room.type.replace("-", " ")} · {room.size} m²
              </p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4 text-sm border-b border-border">
            <div>
              <div className="text-xs text-muted-foreground">Check-in</div>
              <div className="font-medium">{checkIn}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Check-out</div>
              <div className="font-medium">{checkOut}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Guests</div>
              <div className="font-medium">
                {guests} guest{guests > 1 ? "s" : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="font-medium">
                {nights} night{nights > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {addOns.length > 0 && (
            <div className="p-5 border-b border-border">
              <div className="text-xs text-muted-foreground mb-2">
                Add-on Activities
              </div>
              {addOns.map((a, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span>{a.name}</span>
                  <span className="text-muted-foreground">
                    ₱{a.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Room × {nights} nights
              </span>
              <span>₱{roomTotal.toLocaleString()}</span>
            </div>
            {addOnTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activities</span>
                <span>₱{addOnTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service fee</span>
              <span>₱{serviceFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-accent">₱{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("form")}
            className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit Details
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-accent text-white py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Confirm Booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        to={`/rooms/${room.id}`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to room details
      </Link>

      <h1
        className="text-foreground mb-2"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
        }}
      >
        Book Your Stay
      </h1>
      <p className="text-muted-foreground text-sm mb-8">{room.name}</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Dates */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2
              className="font-semibold text-foreground mb-4 flex items-center gap-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Calendar className="w-4 h-4 text-primary" /> Stay Dates
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Check-in *
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (e.target.value >= checkOut) setCheckOut(e.target.value);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Check-out *
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="blosck text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" /> Number
                of Guests
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-medium text-foreground">
                  {guests}
                </span>
                <button
                  onClick={() =>
                    setGuests((g) => Math.min(room.capacity, g + 1))
                  }
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">
                  (max {room.capacity})
                </span>
              </div>
            </div>
          </div>

          {/* Add-ons */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2
              className="font-semibold text-foreground mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Add Activities (Optional)
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Enhance your stay with curated island experiences.
            </p>
            <div className="space-y-3">
              {addOnServices.map((svc) => (
                <label
                  key={svc.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedAddOns.includes(svc.id)}
                    onChange={() => toggleAddOn(svc.id)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <img
                    src={svc.image}
                    alt={svc.name}
                    className="w-12 h-9 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {svc.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {svc.duration}
                    </div>
                  </div>
                  <span className="text-accent font-semibold text-sm flex-shrink-0">
                    +₱{svc.price.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Special requests */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <h2
              className="font-semibold text-foreground mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Special Requests
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Let us know about any preferences or special occasions.
            </p>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="E.g., early check-in, anniversary setup, dietary requirements, extra bed..."
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 bg-white rounded-2xl border border-border shadow-lg overflow-hidden">
            <div className="relative h-36">
              <img
                src={room.images[0]}
                alt={room.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <h3
                  className="text-white font-semibold text-sm"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {room.name}
                </h3>
              </div>
            </div>
            <div className="p-5">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ₱{room.price.toLocaleString()} × {nights} night
                    {nights > 1 ? "s" : ""}
                  </span>
                  <span>₱{roomTotal.toLocaleString()}</span>
                </div>
                {addOns.map((a, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{a.name}</span>
                    <span>₱{a.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Service fee (5%)
                  </span>
                  <span>₱{serviceFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-accent">₱{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 p-2.5 bg-secondary rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                Free cancellation up to 48 hours before check-in.
              </div>

              <button
                onClick={() => setStep("confirm")}
                className="w-full bg-accent text-white font-semibold py-3.5 rounded-xl hover:bg-accent/90 transition-colors text-sm"
              >
                Review & Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
