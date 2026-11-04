import { Star } from "lucide-react";

export function ActivityRating({
  average,
  count,
  loading,
  error,
  light = false,
}: {
  average: number;
  count: number;
  loading?: boolean;
  error?: string;
  light?: boolean;
}) {
  if (loading || error)
    return (
      <span
        className={`text-xs ${light ? "text-white/80" : "text-muted-foreground"}`}
      >
        {error || "Loading ratings..."}
      </span>
    );
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={
        count
          ? `${average.toFixed(1)} out of 5 from ${count} reviews`
          : "No ratings yet"
      }
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${star <= Math.round(average) ? "fill-yellow-400 text-yellow-400" : light ? "text-white/60" : "text-gray-300"}`}
          />
        ))}
      </span>
      <span
        className={`text-xs ${light ? "text-white/90" : "text-muted-foreground"}`}
      >
        {count ? `${average.toFixed(1)} (${count})` : "(0)"}
      </span>
    </div>
  );
}
