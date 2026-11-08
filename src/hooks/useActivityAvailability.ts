import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, customerDb } from "../app/components/firebase";
import { combineActivityInventory } from "../app/services/activityBookings";
import {
  occupiedActivities,
  type ActivityRecord,
} from "../app/utils/activityAvailability";

const sources = () => [
  collection(db, "services"),
  collection(db, "packages"),
  collection(customerDb, "Bookings"),
  collection(db, "reservations"),
];
export function useActivityAvailability() {
  const [state, setState] = useState<{
    catalog: ActivityRecord[];
    bookings: ActivityRecord[];
    allocations: ActivityRecord;
    occupied: ReturnType<typeof occupiedActivities>;
    loading: boolean;
    error: string;
  }>({
    catalog: [],
    bookings: [],
    allocations: {},
    occupied: [],
    loading: true,
    error: "",
  });
  useEffect(() => {
    let active = true;
    const data: ActivityRecord[][] = [];
    let allocations: ActivityRecord = {},
      lockReady = false;
    const errors = new Set<number>();
    const publish = () => {
      if (
        active &&
        !errors.size &&
        data.filter(Boolean).length === 4 &&
        lockReady
      )
        setState({
          ...combineActivityInventory(data, allocations),
          loading: false,
          error: "",
        });
    };
    const failed = (index: number) => {
      errors.add(index);
      if (active)
        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            "Unable to verify activity availability. Refresh the page to retry.",
        }));
    };
    const stops = sources().map((source, index) =>
      onSnapshot(
        source,
        (snapshot) => {
          data[index] = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id,
          }));
          errors.delete(index);
          publish();
        },
        () => failed(index),
      ),
    );
    stops.push(
      onSnapshot(
        doc(db, "BookingLocks", "activityInventory"),
        (snapshot) => {
          allocations = snapshot.data()?.allocations || {};
          lockReady = true;
          errors.delete(4);
          publish();
        },
        () => failed(4),
      ),
    );
    const timer = setInterval(publish, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      stops.forEach((stop) => stop());
    };
  }, []);
  return state;
}
