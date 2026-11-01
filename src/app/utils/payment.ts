export type PaymentStatus =
  | "paid"
  | "partial"
  | "unpaid"
  | "pending_verification"
  | "rejected";

type PaymentInput = {
  totalPrice?: unknown;
  amountPaid?: unknown;
  paymentStatus?: unknown;
};

export function getPaymentSummary(booking: PaymentInput, depositPercent?: unknown) {
  const total = Number(booking.totalPrice ?? 0);
  const paid = Number(booking.amountPaid ?? 0);
  const validAmounts =
    Number.isFinite(total) && total > 0 &&
    Number.isFinite(paid) && paid >= 0;
  const totalCents = validAmounts ? Math.round(total * 100) : 0;
  const paidCents = validAmounts ? Math.round(paid * 100) : 0;
  const remainingBalance = Math.max(0, totalCents - paidCents) / 100;
  const storedStatus = String(booking.paymentStatus ?? "").trim().toLowerCase();
  const paymentStatus: PaymentStatus =
    storedStatus === "pending_verification" ? "pending_verification" :
    validAmounts && remainingBalance === 0 ? "paid" :
    storedStatus === "rejected" ? "rejected" :
    validAmounts && paidCents > 0 ? "partial" : "unpaid";

  const percent = Number(depositPercent);
  const validPercent = Number.isFinite(percent) && percent > 0 && percent <= 100;
  const isBalancePayment = validAmounts && paidCents > 0;
  // Preserve the existing whole-peso rounding for initial deposits only.
  const requestedAmount = isBalancePayment
    ? remainingBalance
    : validAmounts && validPercent ? Math.ceil((totalCents / 100 * percent) / 100) : 0;
  const amountDue = validAmounts ? Math.min(remainingBalance, requestedAmount) : 0;

  return {
    validAmounts,
    validPercent,
    remainingBalance,
    paymentStatus,
    isBalancePayment,
    amountDue,
    balanceAfterVerification: Math.max(0, Math.round((remainingBalance - amountDue) * 100)) / 100,
  };
}
