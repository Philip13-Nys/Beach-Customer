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
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
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

  googleLogin: () => Promise<boolean>;

  logout: () => Promise<void>;

  googleRegister: (data: {
    firstName: string;
    lastName: string;
    phone: string;
    nationality: string;
  }) => Promise<boolean>;

  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    password: string;
  }) => Promise<boolean>;

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
          const newUser = {
            firstName: firebaseUser.displayName?.split(" ")[0] || "",
            lastName:
              firebaseUser.displayName?.split(" ").slice(1).join(" ") || "",
            email: firebaseUser.email || "",
            phone: "",
            nationality: "",
            avatar: firebaseUser.photoURL || "",
            memberSince: new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            createdAt: new Date(),
            provider: "google",
          };

          await setDoc(userRef, newUser);

          setUser({
            id: firebaseUser.uid,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            email: newUser.email,
            phone: newUser.phone,
            nationality: newUser.nationality,
            avatar: newUser.avatar,
            memberSince: newUser.memberSince,
          });

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

  const register = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    password: string;
  }): Promise<boolean> => {
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );

      const firebaseUser = result.user;
      await sendEmailVerification(firebaseUser);
      await setDoc(doc(customerDb, "Users", firebaseUser.uid), {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        nationality: data.nationality,
        avatar: "",
        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        createdAt: new Date(),
        provider: "email",
      });

      await signOut(auth);
      return true;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      const firebaseUser = result.user;

      if (!firebaseUser.emailVerified) {
        await signOut(auth);

        throw new Error("EMAIL_NOT_VERIFIED");
      }

      return true;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const googleLogin = async (): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      // Sign in with Google
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      console.log("Google UID:", firebaseUser.uid);
      console.log("Google Email:", firebaseUser.email);

      if (!firebaseUser.email) {
        throw new Error("Google account does not have an email.");
      }

      // Firestore document
      const userRef = doc(customerDb, "Users", firebaseUser.uid);

      // Check if profile already exists
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const displayName = firebaseUser.displayName || "";
        const nameParts = displayName.trim().split(/\s+/);

        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const userData = {
          firstName,
          lastName,
          email: firebaseUser.email,
          phone: "",
          nationality: "",
          avatar: firebaseUser.photoURL || "",
          memberSince: new Date().toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
          createdAt: new Date(),
          provider: "google",
        };

        // SAVE TO FIRESTORE
        await setDoc(userRef, userData);

        console.log("Google user saved to Firestore!");
      } else {
        console.log("Google user already exists in Firestore.");
      }

      return true;
    } catch (error: any) {
      console.error("Google Login Error:", error);
      throw error;
    }
  };

  const googleRegister = async (data: {
    firstName: string;
    lastName: string;
    phone: string;
    nationality: string;
  }): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      // Google authentication
      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        throw new Error("Google account does not have an email address.");
      }

      // Firebase UID
      const userRef = doc(customerDb, "Users", firebaseUser.uid);

      // Check if profile already exists
      const existingUser = await getDoc(userRef);

      if (existingUser.exists()) {
        console.log("Google account already has a profile.");

        return true;
      }

      // Create Firestore profile
      await setDoc(userRef, {
        firstName: data.firstName,
        lastName: data.lastName,

        // Email comes ONLY from Google
        email: firebaseUser.email,

        phone: data.phone,
        nationality: data.nationality,

        avatar: firebaseUser.photoURL || "",

        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),

        createdAt: new Date(),

        provider: "google",
      });

      console.log("Google account registered successfully.");
      console.log("Firebase UID:", firebaseUser.uid);
      console.log("Google Email:", firebaseUser.email);

      return true;
    } catch (error: any) {
      console.error("Google registration error:", error);
      console.error("Code:", error.code);
      console.error("Message:", error.message);

      return false;
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
        googleLogin,
        googleRegister,
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
