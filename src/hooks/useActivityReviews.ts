import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { customerDb } from "../app/components/firebase";
import { bookingReviewFields } from "../app/utils/bookingPresentation";
import { usePublishedReviews } from "./usePublishedReviews";

export function useActivityReviews() {
  const publication = usePublishedReviews();
  const [reviews, setReviews] = useState<Record<string, any>[]>([]);
  const [resolving, setResolving] = useState(true);
  const linkedBookings = useRef(new Map<string, Record<string, any>>());

  useEffect(() => {
    let active = true;
    setResolving(true);
    void Promise.all(publication.reviews.map(async review => {
      // Resolve old labels without rewriting historical review records.
      if (review.bookingId && !review.itemType && !review.serviceName && !review.packageName &&
          (!review.roomName || review.roomName === "Resort Stay")) {
        try {
          let booking = linkedBookings.current.get(review.bookingId);
          if (!booking) {
            const saved = await getDoc(doc(customerDb, "Bookings", review.bookingId));
            if (saved.exists()) {
              booking = saved.data();
              linkedBookings.current.set(review.bookingId, booking);
            }
          }
          if (booking) return { ...review, ...bookingReviewFields(booking) };
        } catch (error) {
          // One inaccessible legacy booking must not hide the review itself.
          console.error("Could not resolve the reviewed activity:", error);
        }
      }
      return review;
    })).then(resolved => {
      if (active) { setReviews(resolved); setResolving(false); }
    });
    return () => { active = false; };
  }, [publication.reviews]);
  return { reviews, loading: publication.loading || resolving, error: publication.error };
}
