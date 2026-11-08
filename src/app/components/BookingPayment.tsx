import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { getPaymentSummary } from "../utils/payment";
import type { ManualPayment } from "../utils/manualPayment";
export { emptyManualPayment, validManualPayment } from "../utils/manualPayment";
import { CANCELLATION_POLICY } from "../utils/bookingPolicy";

export default function BookingPayment({
  total,
  value,
  onChange,
  disabled = false,
}: {
  total: number;
  value: ManualPayment;
  onChange: (value: ManualPayment) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const stop = onSnapshot(
      doc(db, "paymentSettings", "gcash"),
      (snapshot) => {
        onChange({
          ...latest.current,
          settings: snapshot.exists() ? snapshot.data() : null,
        });
        setLoading(false);
        setError(
          snapshot.exists()
            ? ""
            : "Payment instructions are not configured. Please contact the resort before submitting a request.",
        );
      },
      () => {
        setLoading(false);
        setError(
          "Payment instructions could not be loaded. Please try again later.",
        );
        onChange({ ...latest.current, settings: null });
      },
    );
    return stop;
  }, []);
  const summary = getPaymentSummary(
    { totalPrice: total, amountPaid: 0 },
    Number(value.settings?.downPaymentPercent),
  );
  const peso = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <section
      className="bg-white rounded-2xl border border-border p-5 mb-6 space-y-4"
      aria-label="Required down payment"
    >
      <h2
        className="font-semibold text-lg"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Required Down Payment
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Customers are required to submit their down payment reference number
        before completing a booking request. Your reservation will only be
        confirmed once payment and room availability have been verified by our
        receptionist.
      </p>
      {loading ? (
        <p role="status" className="text-sm">
          Loading payment instructions...
        </p>
      ) : value.settings?.isEnabled !== true || !summary.validPercent ? (
        <p role="alert" className="text-sm text-red-700">
          Online payment submissions are unavailable. Please contact the resort.
        </p>
      ) : (
        <>
          <div className="bg-muted rounded-xl p-4 text-sm space-y-2">
            <p className="flex justify-between gap-3">
              <span>Down payment ({value.settings.downPaymentPercent}%)</span>
              <strong>{peso(summary.amountDue)}</strong>
            </p>
            <p className="flex justify-between gap-3">
              <span>Balance after payment verification</span>
              <strong>{peso(summary.balanceAfterVerification)}</strong>
            </p>
            <p>
              GCash:{" "}
              <strong className="break-all">
                {value.settings.gcashNumber}
              </strong>
            </p>
            <p>
              Account name: <strong>{value.settings.accountName}</strong>
            </p>
            {value.settings.qrImageUrl && (
              <img
                src={value.settings.qrImageUrl}
                alt="Resort GCash payment QR code"
                className="w-40 h-40 object-contain mx-auto bg-white rounded-lg"
              />
            )}
          </div>
          <label className="block text-sm">
            GCash reference number
            <input
              value={value.reference}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...value, reference: e.target.value })
              }
              inputMode="numeric"
              maxLength={20}
              placeholder="10–20 digits from your receipt"
              className="mt-2 w-full border border-border rounded-xl p-3 text-sm"
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {CANCELLATION_POLICY}
      </p>
    </section>
  );
}
