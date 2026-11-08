export const DEFAULT_STAY_TIMES = {
  checkInTime: "14:00",
  checkOutTime: "11:00",
};

export function isStayTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatStayTime(value: string): string {
  if (!isStayTime(value)) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}
