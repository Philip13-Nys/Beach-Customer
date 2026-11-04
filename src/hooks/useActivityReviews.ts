import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { customerDb } from "../app/components/firebase";
import { bookingReviewFields } from "../app/utils/bookingPresentation";

export function useActivityReviews() {
  const [reviews, setReviews] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let revision = 0;
    const linkedBookings = new Map<string, Record<string, any>>();
    const unsubscribe = onSnapshot(
      query(
        collection(customerDb, "reviews"),
        where("status", "==", "published"),
      ),
      async (snapshot) => {
        const currentRevision = ++revision;
        try {
          const resolved = await Promise.all(
            snapshot.docs.map(async (reviewDoc) => {
              const review = reviewDoc.data();
              // Older activity reviews were stored as "Resort Stay". Resolve their
              // linked booking without changing any historical database records.
              if (
                review.bookingId &&
                !review.itemType &&
                !review.serviceName &&
                !review.packageName &&
                (!review.roomName || review.roomName === "Resort Stay")
              ) {
                let booking = linkedBookings.get(review.bookingId);
                if (!booking) {
                  const saved = await getDoc(
                    doc(customerDb, "Bookings", review.bookingId),
                  );
                  if (saved.exists()) {
                    booking = saved.data();
                    linkedBookings.set(review.bookingId, booking);
                  }
                }
                if (booking)
                  return { ...review, ...bookingReviewFields(booking) };
              }
              return review;
            }),
          );
          if (active && revision === currentRevision) {
            setReviews(resolved);
            setLoading(false);
            setError("");
          }
        } catch (err) {
          console.error("Could not load activity ratings:", err);
          if (active && revision === currentRevision) {
            setLoading(false);
            setError("Ratings unavailable");
          }
        }
      },
      (err) => {
        console.error("Could not listen to activity ratings:", err);
        if (active) {
          revision++;
          setLoading(false);
          setError("Ratings unavailable");
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { reviews, loading, error };
}
