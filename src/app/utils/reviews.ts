export type CustomerReview = {
  id: string;
  bookingId?: string;
  userId?: string;
  rating: number;
  comment: string;
  guestName: string;
  guestAvatar: string;
  date: string;
  status?: string;
  roomName?: string;
  serviceName?: string;
  packageName?: string;
  createdAt?: any;
  [key: string]: any;
};

export function normalizeReview(
  id: string,
  data: Record<string, any>,
): CustomerReview {
  return {
    ...data,
    id,
    rating: Number(data.rating),
    comment: String(data.comment ?? data.feedback ?? ""),
    guestName: String(data.guestName || "Guest"),
    guestAvatar: String(data.guestAvatar || ""),
    date:
      typeof data.date === "string"
        ? data.date
        : data.createdAt?.toDate?.().toLocaleDateString("en-PH") || "",
  };
}

export function uniqueReviews(reviews: CustomerReview[]): CustomerReview[] {
  const result = new Map<string, CustomerReview>();
  // Prefer canonical booking-ID documents when both a legacy and a modern review exist.
  for (const review of reviews) {
    const key = review.bookingId
      ? `booking:${review.bookingId}`
      : `review:${review.id}`;
    if (!result.has(key) || review.id === review.bookingId)
      result.set(key, review);
  }
  const createdTime = (review: CustomerReview) => {
    const saved = review.createdAt;
    const time =
      typeof saved?.toMillis === "function"
        ? saved.toMillis()
        : typeof saved?.toDate === "function"
          ? saved.toDate().getTime()
          : typeof saved?.seconds === "number"
            ? saved.seconds * 1000
            : Date.parse(review.date);
    return Number.isFinite(time) ? time : 0;
  };
  return [...result.values()].sort(
    (a, b) => createdTime(b) - createdTime(a) || a.id.localeCompare(b.id),
  );
}

export function reviewSummary(reviews: CustomerReview[]) {
  const valid = uniqueReviews(reviews).filter(
    (r) => Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5,
  );
  return {
    valid,
    count: valid.length,
    average: valid.length
      ? valid.reduce((sum, r) => sum + r.rating, 0) / valid.length
      : 0,
  };
}
