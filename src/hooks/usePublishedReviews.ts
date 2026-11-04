import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Query,
} from "firebase/firestore";
import { customerDb, db } from "../app/components/firebase";
import {
  normalizeReview,
  uniqueReviews,
  type CustomerReview,
} from "../app/utils/reviews";

export function usePublishedReviews() {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const records = new Map<string, CustomerReview[]>();
    const pending = new Set(["customer", "legacy"]);
    const failed = new Set<string>();
    const publish = () => {
      if (!active) return;
      setReviews(uniqueReviews([...records.values()].flat()));
      setLoading(pending.size > 0);
      setError(
        failed.size
          ? "Some reviews could not be loaded. Please refresh to try again."
          : "",
      );
    };
    const listen = (source: string, reference: Query<DocumentData>) =>
      onSnapshot(
        reference,
        (snapshot) => {
          if (!active) return;
          records.set(
            source,
            snapshot.docs.flatMap((review) => {
              const data = review.data();
              // The old page publicly displayed admin reviews without a status.
              // Explicit moderation states must still stay out of the public feed.
              if (
                source === "legacy" &&
                data.status != null &&
                data.status !== "published"
              )
                return [];
              const id =
                source === "legacy" ? `legacy-admin:${review.id}` : review.id;
              return [
                normalizeReview(
                  id,
                  source === "legacy" ? { ...data, status: "published" } : data,
                ),
              ];
            }),
          );
          pending.delete(source);
          failed.delete(source);
          publish();
        },
        (err) => {
          if (!active) return;
          console.error(`Could not load ${source} reviews:`, err);
          pending.delete(source);
          failed.add(source);
          publish();
        },
      );
    const stopCustomer = listen(
      "customer",
      query(
        collection(customerDb, "reviews"),
        where("status", "==", "published"),
      ),
    );
    const stopLegacy = listen("legacy", collection(db, "reviews"));
    return () => {
      active = false;
      stopCustomer();
      stopLegacy();
    };
  }, []);
  return { reviews, loading, error };
}
