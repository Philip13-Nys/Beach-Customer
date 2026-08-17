import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

import {
  Booking,
  Notification,
  sampleBookings,
  sampleNotifications,
} from "../data/mockData";

import { auth, customerDb } from "../components/firebase";

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { doc, getDoc, setDoc } from "firebase/firestore";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  avatar: string;
  memberSince: string;
}

interface AppContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    data: Omit<User, "id" | "avatar" | "memberSince"> & { password: string },
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  cancelBooking: (id: string) => void;
  modifyBooking: (id: string, updates: Partial<Booking>) => void;
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
  pendingPayment: Booking | null;
  setPendingPayment: (b: Booking | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("cbr_bookings") || JSON.stringify(sampleBookings),
      );
    } catch {
      return sampleBookings;
    }
  });
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("cbr_notifs") ||
          JSON.stringify(sampleNotifications),
      );
    } catch {
      return sampleNotifications;
    }
  });
  const [pendingPayment, setPendingPayment] = useState<Booking | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const userRef = doc(customerDb, "Users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.error(
            "User profile not found in Firestore:",
            firebaseUser.uid,
          );

          setUser(null);
          return;
        }

        const data = snap.data();

        setUser({
          id: firebaseUser.uid,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || firebaseUser.email || "",
          phone: data.phone || "",
          nationality: data.nationality || "",
          avatar: data.avatar || "",
          memberSince: data.memberSince || "",
        });
      } catch (error) {
        console.error("Error loading user profile:", error);

        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem("cbr_bookings", JSON.stringify(bookings));
  }, [bookings]);
  useEffect(() => {
    localStorage.setItem("cbr_notifs", JSON.stringify(notifications));
  }, [notifications]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      console.log("Login successful:", userCredential.user.uid);
      console.log("Email:", userCredential.user.email);

      return true;
    } catch (error: any) {
      console.error("Firebase Login Error");
      console.error("Code:", error.code);
      console.error("Message:", error.message);

      return false;
    }
  };

  const register = async (
    data: Omit<User, "id" | "avatar" | "memberSince"> & {
      password: string;
    },
  ): Promise<boolean> => {
    try {
      const { firstName, lastName, email, phone, nationality, password } = data;

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const firebaseUser = userCredential.user;

      // Create Firestore user profile
      await setDoc(doc(customerDb, "Users", firebaseUser.uid), {
        firstName,
        lastName,
        email: firebaseUser.email || email,
        phone,
        nationality,
        avatar: "",
        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        createdAt: new Date(),
      });

      console.log("Firebase account created:", firebaseUser.uid);
      console.log("User profile created in Firestore");

      return true;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem(
        "cbr_registered_" + updated.email,
        JSON.stringify(updated),
      );
    }
  };

  const addBooking = (booking: Booking) => {
    setBookings((prev) => [booking, ...prev]);
    setNotifications((prev) => [
      {
        id: "n_" + Date.now(),
        type: "booking",
        title: "Booking Confirmed!",
        message: `Your reservation for ${booking.roomName} (${booking.checkIn} – ${booking.checkOut}) has been confirmed. Ref: ${booking.bookingRef}`,
        date: new Date().toISOString().split("T")[0],
        read: false,
      },
      ...prev,
    ]);
  };

  const cancelBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
    );
    const booking = bookings.find((b) => b.id === id);
    if (booking) {
      setNotifications((prev) => [
        {
          id: "n_" + Date.now(),
          type: "booking",
          title: "Booking Cancelled",
          message: `Your reservation for ${booking.roomName} (Ref: ${booking.bookingRef}) has been cancelled.`,
          date: new Date().toISOString().split("T")[0],
          read: false,
        },
        ...prev,
      ]);
    }
  };

  const modifyBooking = (id: string, updates: Partial<Booking>) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateProfile,
        bookings,
        addBooking,
        cancelBooking,
        modifyBooking,
        notifications,
        markNotificationRead,
        markAllRead,
        unreadCount,
        pendingPayment,
        setPendingPayment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
