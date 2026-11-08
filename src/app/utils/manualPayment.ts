import { getPaymentSummary } from "./payment";
import { validPaymentReference } from "./paymentReference";

export type ManualPayment = {
  reference: string;
  settings: Record<string, any> | null;
};
export const emptyManualPayment = (): ManualPayment => ({
  reference: "",
  settings: null,
});
export function validManualPayment(value: ManualPayment, total: number) {
  const summary = getPaymentSummary(
    { totalPrice: total, amountPaid: 0 },
    Number(value.settings?.downPaymentPercent),
  );
  return (
    value.settings?.isEnabled === true &&
    Boolean(value.settings?.gcashNumber && value.settings?.accountName) &&
    summary.validAmounts &&
    summary.validPercent &&
    summary.amountDue > 0 &&
    validPaymentReference(value.reference)
  );
}
