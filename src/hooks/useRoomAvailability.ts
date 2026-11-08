import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db, customerDb } from "../app/components/firebase";
import { remainingRooms, type RecordData } from "../app/utils/availability";

const sources = () => [
  collection(db, "rooms"),
  collection(customerDb, "Bookings"),
  collection(db, "reservations"),
];
const records = (snapshot: any): RecordData[] =>
  snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
export function useAvailabilityRecords() {
  const [state, setState] = useState<{
    rooms: RecordData[];
    bookings: RecordData[];
    reservations: RecordData[];
    loading: boolean;
    error: string;
  }>({ rooms: [], bookings: [], reservations: [], loading: true, error: "" });
  useEffect(() => {
    let active = true;
    const data: (RecordData[] | undefined)[] = [];
    const stops = sources().map((source, i) =>
      onSnapshot(
        source,
        (snapshot) => {
          data[i] = records(snapshot);
          if (active && data[0] && data[1] && data[2])
            setState({
              rooms: data[0],
              bookings: data[1],
              reservations: data[2],
              loading: false,
              error: "",
            });
        },
        () => {
          data[i] = undefined;
          if (active)
            setState({
              rooms: [],
              bookings: [],
              reservations: [],
              loading: false,
              error:
                "Unable to verify room availability. Please try again later.",
            });
        },
      ),
    );
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, []);
  return state;
}
export async function checkAvailability(
  type: RecordData,
  start: string,
  end: string,
) {
  const currentType = await getDocFromServer(doc(db, "roomTypes", type.id));
  if (!currentType.exists()) return 0;
  const [rooms, bookings, reservations] = await Promise.all(
    sources().map((source) => getDocs(source)),
  );
  return remainingRooms(
    { ...currentType.data(), id: type.id },
    records(rooms),
    records(bookings),
    records(reservations),
    start,
    end,
  );
}
export function useRoomAvailability(
  type: RecordData | null,
  start: string,
  end: string,
) {
  const [state, setState] = useState({
    available: 0,
    loading: true,
    error: "",
    key: "",
  });
  const key = `${type?.id || ""}:${start}:${end}`;
  useEffect(() => {
    if (!type) return;
    let active = true;
    const data: (RecordData[] | undefined)[] = [];
    setState({ available: 0, loading: true, error: "", key });
    const unsubscribe = sources().map((source, i) =>
      onSnapshot(
        source,
        (snapshot) => {
          data[i] = records(snapshot);
          if (active && data[0] && data[1] && data[2])
            setState({
              available: remainingRooms(
                type,
                data[0],
                data[1],
                data[2],
                start,
                end,
              ),
              loading: false,
              error: "",
              key,
            });
        },
        () => {
          data[i] = undefined;
          if (active)
            setState({
              available: 0,
              loading: false,
              error:
                "Unable to verify room availability. Please try again later.",
              key,
            });
        },
      ),
    );
    return () => {
      active = false;
      unsubscribe.forEach((stop) => stop());
    };
  }, [type?.id, type?.name, start, end]);
  return state.key === key ? state : { available: 0, loading: true, error: "" };
}
