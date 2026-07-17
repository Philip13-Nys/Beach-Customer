import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import {
  CreditCard,
  Smartphone,
  Building2,
  CheckCircle2,
  Lock,
  AlertCircle,
} from "lucide-react";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard },
  { id: "gcash", label: "GCash", icon: Smartphone },
  { id: "bank", label: "Bank Transfer", icon: Building2 },
];

export default function Payment() {
  const { bookings, modifyBooking, pendingPayment, setPendingPayment, user } =
    useApp();
  const navigate = useNavigate();

  if (!user) {
    navigate("/auth");
    return null;
  }

  const unpaid = bookings.filter(
    (b) => b.paymentStatus !== "paid" && b.status !== "cancelled",
  );
  const target = pendingPayment ?? (unpaid.length > 0 ? unpaid[0] : null);

  const [method, setMethod] = useState<"card" | "gcash" | "bank">("card");
  const [card, setCard] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [gcashNum, setGcashNum] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (method === "card") {
      if (!card.number || !card.name || !card.expiry || !card.cvv) {
        setError("Please fill in all card details.");
        return;
      }
      if (card.number.replace(/\s/g, "").length < 16) {
        setError("Invalid card number.");
        return;
      }
    } else if (method === "gcash") {
      if (!gcashNum || gcashNum.length < 10) {
        setError("Please enter a valid GCash number.");
        return;
      }
    }

    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      if (target) {
        modifyBooking(target.id, { paymentStatus: "paid" });
        setPendingPayment(null);
      }
      setSuccess(true);
    }, 2000);
  };

  const formatCard = (val: string) =>
    val
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const formatExpiry = (val: string) =>
    val
      .replace(/\D/g, "")
      .slice(0, 4)
      .replace(/(\d{2})(\d)/, "$1/$2");

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
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
          Payment Successful!
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Your payment of{" "}
          <strong className="text-accent">
            ₱{target?.totalPrice.toLocaleString()}
          </strong>{" "}
          has been processed. Your booking is now fully confirmed.
        </p>
        <div className="bg-secondary rounded-xl p-4 mb-6 text-left">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Transaction ID</span>
            <span
              className="font-medium text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              TXN-{Date.now().toString().slice(-8)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Method</span>
            <span className="font-medium text-foreground capitalize">
              {method === "card"
                ? "Credit/Debit Card"
                : method === "gcash"
                  ? "GCash"
                  : "Bank Transfer"}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate("/booking-history")}
          className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors w-full"
        >
          View My Bookings
        </button>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1
          className="text-foreground mb-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.875rem",
            fontWeight: 700,
          }}
        >
          All Paid Up!
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          You have no outstanding payments at the moment.
        </p>
        <button
          onClick={() => navigate("/booking-history")}
          className="text-sm text-primary hover:underline"
        >
          View all bookings
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1
        className="text-foreground mb-2"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
        }}
      >
        Complete Payment
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Secure your reservation with a one-time payment.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Payment form */}
        <div className="lg:col-span-3">
          <form onSubmit={handlePay} className="space-y-5">
            {/* Method selector */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2
                className="font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Payment Method
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setMethod(pm.id as typeof method)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium ${
                      method === pm.id
                        ? "border-primary bg-secondary text-primary"
                        : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <pm.icon className="w-5 h-5" />
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment details */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2
                className="font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {method === "card"
                  ? "Card Details"
                  : method === "gcash"
                    ? "GCash Details"
                    : "Bank Transfer Instructions"}
              </h2>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {method === "card" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={card.number}
                      onChange={(e) =>
                        setCard((c) => ({
                          ...c,
                          number: formatCard(e.target.value),
                        }))
                      }
                      className={inputClass}
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      placeholder="As printed on card"
                      value={card.name}
                      onChange={(e) =>
                        setCard((c) => ({ ...c, name: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={card.expiry}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            expiry: formatExpiry(e.target.value),
                          }))
                        }
                        className={inputClass}
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        CVV
                      </label>
                      <input
                        type="password"
                        placeholder="•••"
                        value={card.cvv}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                        className={inputClass}
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {method === "gcash" && (
                <div className="space-y-3">
                  <div className="flex justify-center mb-2">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center">
                      <Smartphone className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      GCash Mobile Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+63 9XX XXX XXXX"
                      value={gcashNum}
                      onChange={(e) => setGcashNum(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A payment request will be sent to your GCash account. Please
                    approve it within 5 minutes.
                  </p>
                </div>
              )}

              {method === "bank" && (
                <div className="space-y-3">
                  <div className="bg-secondary rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ["Bank Name", "BDO Unibank, Inc."],
                      ["Account Name", "Sabang Beach and Diving Resort Inc."],
                      ["Account Number", "1234-5678-9012"],
                      ["Branch", "Puerto Princesa, Palawan"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span
                          className="font-medium text-foreground"
                          style={
                            label === "Account Number"
                              ? { fontFamily: "var(--font-mono)" }
                              : {}
                          }
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    After transferring, send proof of payment to{" "}
                    <strong>payments@sabangbeach.ph</strong> with your booking
                    reference number{" "}
                    <span className="font-mono text-primary">
                      {target.bookingRef}
                    </span>
                    .
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-4 h-4 flex-shrink-0 text-primary" />
              Your payment information is encrypted and secured by 256-bit SSL
              encryption.
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-accent text-white font-semibold py-4 rounded-xl hover:bg-accent/90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {processing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                  Processing…
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Pay ₱
                  {target.totalPrice.toLocaleString()}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="relative h-36">
              <img
                src={target.roomImage}
                alt={target.roomName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <h3 className="text-white font-semibold text-sm">
                  {target.roomName}
                </h3>
                <p
                  className="text-white/70 text-xs"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {target.bookingRef}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {target.checkIn} – {target.checkOut}
                </span>
                <span className="text-foreground">
                  {target.nights} night{target.nights > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room rate</span>
                <span>
                  ₱{(target.roomRate * target.nights).toLocaleString()}
                </span>
              </div>
              {target.addOns.map((a, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span>₱{a.price.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-3 border-t border-border">
                <span>Total Due</span>
                <span className="text-accent">
                  ₱{target.totalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
