import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useApp } from "../context/AppContext";
import { getPaymentSummary } from "../utils/payment";
import { validPaymentReference } from "../utils/paymentReference";
import { requireVerifiedCustomer } from "../services/emailVerification";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Copy,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

import { db, customerDb } from "../components/firebase";
import {
  doc,
  getDoc,
  collection,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

type GcashSettings = {
  gcashNumber: string;
  accountName: string;
  qrImageUrl: string;
  downPaymentPercent: number;
  isEnabled: boolean;
};

type Booking = {
  id: string;
  bookingRef?: string;
  paymentStatus?: string;
  status?: string;
  totalPrice?: number;
  roomRate?: number;
  nights?: number;
  roomName?: string;
  reservationFeePercent?: number;
  reservationFee?: number;
  subtotal?: number;
  roomImage?: string;
  checkIn?: string;
  checkOut?: string;
  amountPaid?: number;
  downPaymentAmount?: number;
  remainingBalance?: number;
  addOns?: { name: string; price: number }[];
  [key: string]: any;
};

export default function Payment() {
  const {
    pendingPayment,
    setPendingPayment,
    user,
    authLoading,
    createNotification,
  } = useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [firestoreBooking, setFirestoreBooking] = useState<Booking | null>(
    null,
  );
  const [bookingLoading, setBookingLoading] = useState(Boolean(bookingId));

  const [settings, setSettings] = useState<GcashSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [paymentRecordId, setPaymentRecordId] = useState("");
  const submittingRef = useRef(false);

  const target: Booking | null = bookingId
    ? firestoreBooking
    : ((pendingPayment as Booking | null) ?? firestoreBooking);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    let active = true;

    const loadBooking = async () => {
      if (!bookingId || !user) {
        setFirestoreBooking(null);
        setBookingLoading(false);
        return;
      }

      setBookingLoading(true);
      setFirestoreBooking(null);

      try {
        const snapshot = await getDoc(doc(customerDb, "Bookings", bookingId));

        if (!active) return;

        if (snapshot.exists()) {
          setFirestoreBooking({
            id: snapshot.id,
            ...snapshot.data(),
          } as Booking);
        } else {
          setFirestoreBooking(null);
        }
      } catch (err) {
        console.error("Error loading booking:", err);
        if (active) {
          setError("Unable to load this booking. Please try again.");
          setFirestoreBooking(null);
        }
      } finally {
        if (active) {
          setBookingLoading(false);
        }
      }
    };

    loadBooking();

    return () => {
      active = false;
    };
  }, [bookingId, user]);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setSettingsLoading(true);

      try {
        const snapshot = await getDoc(doc(db, "paymentSettings", "gcash"));

        if (!active) return;

        if (snapshot.exists()) {
          setSettings(snapshot.data() as GcashSettings);
        } else {
          setSettings(null);
          setError(
            "The resort has not configured its GCash payment details yet.",
          );
        }
      } catch (err) {
        console.error("Error loading GCash settings:", err);

        if (active) {
          setSettings(null);
          setError(
            "Unable to load the resort's payment details. Please try again later.",
          );
        }
      } finally {
        if (active) {
          setSettingsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const percent = Number(settings?.downPaymentPercent ?? 0);

  const {
    validAmounts,
    validPercent,
    remainingBalance,
    paymentStatus,
    isBalancePayment,
    amountDue,
    balanceAfterVerification,
  } = getPaymentSummary(target ?? {}, percent);
  const paymentLabel = isBalancePayment ? "Balance Payment" : "Down Payment";

  const total = Number(target?.totalPrice ?? 0);
  const amountPaid = Number(target?.amountPaid ?? 0);

  const reservationFee = Number(target?.reservationFee ?? 0);
  const reservationFeePercent = Number(target?.reservationFeePercent ?? 0);
  const subtotal = Number(target?.subtotal ?? total - reservationFee);

  const formatPeso = (amount: number) =>
    `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  const handleCopyNumber = async () => {
    if (!settings?.gcashNumber) return;

    try {
      await navigator.clipboard.writeText(settings.gcashNumber);
    } catch (err) {
      console.error("Could not copy GCash number:", err);
      setError("Could not copy the number. Please copy it manually.");
    }
  };

  const handlePay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current || success) return;
    setError("");

    if (!user) {
      navigate("/auth");
      return;
    }

    if (bookingLoading) {
      setError("Please wait while your booking loads.");
      return;
    }

    if (!target) {
      setError("No booking was found for this payment.");
      return;
    }

    if (
      paymentStatus === "paid" ||
      paymentStatus === "pending_verification" ||
      target.status === "cancelled"
    ) {
      setError(
        paymentStatus === "pending_verification"
          ? "Your payment is already awaiting verification."
          : "This booking is not eligible for payment.",
      );
      return;
    }

    if (settingsLoading) {
      setError("Please wait for the payment details to load.");
      return;
    }

    if (!settings || !settings.isEnabled) {
      setError("GCash payments are currently unavailable.");
      return;
    }

    if (!settings.gcashNumber || !settings.accountName) {
      setError("The resort's GCash details are incomplete.");
      return;
    }

    if (!validAmounts) {
      setError(
        "This booking has invalid payment amounts. Please contact the resort.",
      );
      return;
    }

    if ((!isBalancePayment && !validPercent) || amountDue <= 0) {
      setError("The resort's down payment settings are invalid.");
      return;
    }

    const cleanReference = referenceNumber.trim();

    if (!validPaymentReference(cleanReference)) {
      setError(
        "Enter the 10–20 digit GCash reference number from your receipt.",
      );
      return;
    }

    submittingRef.current = true;
    setProcessing(true);

    try {
      await requireVerifiedCustomer();
      const paymentRef = doc(collection(customerDb, "Payments"));
      const bookingRef = doc(customerDb, "Bookings", target.id);

      const batch = writeBatch(customerDb);

      batch.set(paymentRef, {
        bookingId: target.id,
        bookingRef: target.bookingRef ?? "",

        guest: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        room: target.roomName ?? "",
        method: "gcash",
        type: amountDue >= remainingBalance ? "balance" : "partial",
        amount: amountDue,

        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),

        status: "pending",
        receiptNo: `GC-${Date.now()}`,
        referenceNumber: cleanReference,
        verificationStatus: "pending",

        customerId: user.id,
        customerName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        customerEmail: user.email ?? "",
        totalPrice: total,
        remainingBalance,
        paymentMethod: "GCash",
        gcashNumber: settings.gcashNumber,
        createdAt: serverTimestamp(),
      });

      batch.update(bookingRef, {
        paymentStatus: "pending_verification",
        paymentMethod: "GCash",
        paymentReference: cleanReference,
        paymentRecordId: paymentRef.id,
        remainingBalance,
        ...(!isBalancePayment ? { downPaymentAmount: amountDue } : {}),
      });

      await batch.commit();

      setFirestoreBooking({
        ...target,
        paymentStatus: "pending_verification",
        paymentMethod: "GCash",
        ...(!isBalancePayment ? { downPaymentAmount: amountDue } : {}),
        remainingBalance,
        paymentReference: cleanReference,
        paymentRecordId: paymentRef.id,
      });

      setPendingPayment(null);
      setPaymentRecordId(paymentRef.id);

      try {
        await createNotification({
          eventId: `payment-submitted-${paymentRef.id}`,
          type: "payment",
          title: "Payment submitted",
          message: `Your GCash payment of ${formatPeso(
            amountDue,
          )} for booking ${
            target.bookingRef ?? target.id
          } has been submitted. Reference: ${cleanReference}. Status: Pending verification.`,
          targetPath: "/booking-history",
        });
      } catch (notificationError) {
        console.error(
          "Payment was saved, but the notification could not be created:",
          notificationError,
        );
      }

      setSuccess(true);
    } catch (err) {
      console.error("Payment submission error:", err);
      setError(
        "Could not submit your payment. Please check your connection and try again.",
      );
    } finally {
      submittingRef.current = false;
      setProcessing(false);
    }
  };

  if (authLoading)
    return (
      <p role="status" className="py-12 text-center">
        Loading your account...
      </p>
    );
  if (!user) {
    return null;
  }

  if (bookingLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Loading your booking...</p>
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
          No Payment Needed
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          We couldn't find an eligible booking for this payment.
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

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>

          <h1
            className="text-foreground mb-2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            Payment Submitted!
          </h1>

          <p className="text-muted-foreground text-sm mb-6">
            Your payment details have been submitted. The resort must verify
            your GCash transaction before your payment is accepted.
          </p>
        </div>

        <div className="bg-secondary rounded-xl p-5 mb-6 space-y-4">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Booking Reference</span>
            <span className="font-medium text-foreground">
              {target.bookingRef ?? target.id}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Payment Record</span>
            <span className="font-mono text-xs break-all text-right">
              {paymentRecordId}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">GCash Reference</span>
            <span className="font-medium text-foreground">
              {referenceNumber.trim()}
            </span>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>{paymentLabel}</span>
              <span className="font-semibold">{formatPeso(amountDue)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Remaining Balance</span>
              <span>{formatPeso(remainingBalance)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-border pt-4">
            <span className="text-sm font-medium">Payment Status</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
              Pending Verification
            </span>
          </div>
        </div>

        <div className="flex gap-2 items-start text-xs text-muted-foreground mb-6">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          Keep your GCash receipt until the resort confirms your payment.
        </div>

        <button
          onClick={() => navigate(`/booking-confirmation/${target.id}`)}
          className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors w-full"
        >
          View Booking Confirmation
        </button>

        <button
          onClick={() => navigate("/booking-history")}
          className="text-sm text-primary hover:underline w-full mt-4"
        >
          Back to Booking History
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={() => navigate("/booking-history")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to bookings
      </button>

      <h1
        className="text-foreground mb-2"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
        }}
      >
        {paymentLabel}
      </h1>

      <p className="text-muted-foreground text-sm mb-8">
        {isBalancePayment
          ? "Pay your outstanding balance through the resort's GCash account."
          : "Pay your reservation down payment through the resort's GCash account."}
      </p>

      {paymentStatus === "pending_verification" && (
        <p
          role="status"
          className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
        >
          Your payment is awaiting verification. Please wait for the resort to
          review it before submitting another payment.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <form onSubmit={handlePay} className="space-y-5">
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>

                <div>
                  <h2 className="font-semibold text-foreground">
                    Pay via GCash
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Manual bank transfer
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {settingsLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Loading resort payment details...
                </p>
              ) : !settings ? (
                <p className="text-sm text-red-600">
                  Payment details are not available. Please contact the resort.
                </p>
              ) : !settings.isEnabled ? (
                <p className="text-sm text-red-600">
                  GCash payments are currently disabled.
                </p>
              ) : (
                <>
                  <div className="bg-secondary rounded-xl p-5 text-center space-y-3">
                    {settings.qrImageUrl ? (
                      <img
                        src={settings.qrImageUrl}
                        alt="Resort GCash QR code"
                        className="w-56 h-56 object-contain mx-auto bg-white rounded-xl p-2"
                      />
                    ) : (
                      <div className="w-56 h-32 mx-auto rounded-xl bg-white flex items-center justify-center text-xs text-muted-foreground">
                        QR code not provided
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Account Name
                      </p>
                      <p className="font-semibold text-foreground">
                        {settings.accountName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        GCash Number
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-xl font-bold text-foreground">
                          {settings.gcashNumber}
                        </p>
                        <button
                          type="button"
                          onClick={handleCopyNumber}
                          className="p-2 rounded-lg hover:bg-white"
                          title="Copy GCash number"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border border-border rounded-xl p-4">
                    <h3 className="font-semibold text-sm mb-3">How to Pay</h3>

                    <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                      <li>Open GCash and select Send Money or Scan QR.</li>
                      <li>
                        Enter the resort's account details or scan its QR code.
                      </li>
                      <li>
                        Send exactly{" "}
                        <strong className="text-foreground">
                          {formatPeso(amountDue)}
                        </strong>
                        .
                      </li>
                      <li>
                        Copy the reference number from your GCash transaction
                        receipt.
                      </li>
                      <li>
                        Enter the reference number below and submit your
                        payment.
                      </li>
                    </ol>
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="referenceNumber"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      GCash Reference Number
                    </label>

                    <input
                      id="referenceNumber"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter the 10–20 digit reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className={inputClass}
                      maxLength={20}
                      minLength={10}
                      pattern="[0-9]{10,20}"
                      required
                    />

                    <p className="text-xs text-muted-foreground mt-2">
                      Enter the 10–20 digit reference number from your GCash
                      receipt, without letters or symbols.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
              Your payment will remain pending until the resort verifies your
              transaction.
            </div>

            <button
              type="submit"
              disabled={
                processing ||
                !validPaymentReference(referenceNumber) ||
                bookingLoading ||
                settingsLoading ||
                !settings?.isEnabled ||
                !validAmounts ||
                (!isBalancePayment && !validPercent) ||
                amountDue <= 0 ||
                !target ||
                paymentStatus === "paid" ||
                paymentStatus === "pending_verification" ||
                target.status === "cancelled"
              }
              className="w-full bg-accent text-white font-semibold py-4 rounded-xl hover:bg-accent/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing
                ? "Submitting Payment..."
                : paymentStatus === "pending_verification"
                  ? "Awaiting Verification"
                  : `Submit ${formatPeso(amountDue)} ${paymentLabel}`}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="relative h-36">
              {target.roomImage ? (
                <img
                  src={target.roomImage}
                  alt={target.roomName ?? "Room"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-secondary" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />

              <div className="absolute bottom-3 left-4">
                <h3 className="text-white font-semibold text-sm">
                  {target.roomName ?? "Room Booking"}
                </h3>
                <p className="text-white/70 text-xs">
                  {target.bookingRef ?? target.id}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Check-in / Check-out
                </span>
                <span className="text-right">
                  {target.checkIn ?? "—"} – {target.checkOut ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Nights</span>
                <span>
                  {target.nights ?? 0} night
                  {Number(target.nights ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Room rate / booking
                </span>
                <span>
                  {formatPeso(
                    Number(target.roomRate ?? 0) * Number(target.nights ?? 0),
                  )}
                </span>
              </div>

              {target.addOns?.map((a, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span>{formatPeso(Number(a.price ?? 0))}</span>
                </div>
              ))}

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPeso(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Reservation Fee ({reservationFeePercent}%)
                  </span>
                  <span>{formatPeso(reservationFee)}</span>
                </div>

                <div className="flex justify-between font-semibold border-t border-border pt-3">
                  <span>Total Booking</span>
                  <span>{formatPeso(total)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Amount Paid (Verified)
                  </span>
                  <span>{formatPeso(amountPaid)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isBalancePayment
                      ? "Balance Payment"
                      : `Down Payment (${percent}%)`}
                  </span>
                  <span>{formatPeso(amountDue)}</span>
                </div>

                <div className="flex justify-between text-base font-bold pt-3 border-t border-border">
                  <span>Pay Now</span>
                  <span className="text-accent">{formatPeso(amountDue)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Remaining Balance
                  </span>
                  <span>{formatPeso(remainingBalance)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Balance after this payment is verified:{" "}
                {formatPeso(balanceAfterVerification)}. Your current balance
                changes only after verification.
              </p>

              <div className="bg-amber-50 text-amber-800 rounded-xl p-3 text-xs leading-relaxed">
                Your booking payment is not considered verified until the resort
                checks your GCash reference number and confirms receipt of the
                payment.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
