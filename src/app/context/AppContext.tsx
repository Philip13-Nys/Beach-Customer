import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

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

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  userId?: string;
  role?: string;
  eventId?: string;
  targetPath?: string;
  createdAt?: any;
}

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  roomImage: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  roomRate: number;
  addOns: { name: string; price: number }[];
  totalPrice: number;

  status: "confirmed" | "pending" | "cancelled" | "completed";

  paymentStatus: "paid" | "partial" | "unpaid" | "pending_verification";

  paymentMethod?: string;
  transactionId?: string;
  paidAt?: any;

  downPaymentAmount?: number;
  remainingBalance?: number;
  paymentReference?: string;
  paymentRecordId?: string;

  userId?: string;
  customerName?: string;
  email?: string;

  bookingRef: string;
  createdAt: string;
  specialRequests?: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  memberSince: string;
}

interface CreateNotificationInput {
  eventId: string;
  type: string;
  title: string;
  message: string;
  targetPath?: string;
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
  }) => Promise<boolean>;

  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<boolean>;

  updateProfile: (data: Partial<User>) => void;

  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  cancelBooking: (id: string) => void;
  modifyBooking: (id: string, updates: Partial<Booking>) => void;

  notifications: Notification[];
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: number;
  createNotification: (data: CreateNotificationInput) => Promise<void>;

  pendingPayment: Booking | null;
  setPendingPayment: (b: Booking | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function formatNotificationDate(value: any): string {
  if (!value) return "";

  let date: Date | null = null;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  } else if (typeof value === "object" && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function safeEventId(eventId: string): string {
  return encodeURIComponent(eventId.trim()).replace(/\./g, "%2E");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingPayment, setPendingPayment] = useState<Booking | null>(null);

  // Keep track of the active Firebase session so a delayed
  // profile request cannot overwrite a newer login.
  useEffect(() => {
    let activeUid: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        activeUid = null;
        setUser(null);
        setBookings([]);
        setNotifications([]);
        return;
      }

      activeUid = firebaseUser.uid;
      const uid = firebaseUser.uid;

      try {
        const userRef = doc(customerDb, "Users", uid);

        const snap = await getDoc(userRef);

        if (activeUid !== uid) return;

        if (!snap.exists()) {
          const displayName = firebaseUser.displayName || "";
          const nameParts = displayName.trim().split(/\s+/);

          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ");

          const newUser = {
            firstName,
            lastName,
            email: firebaseUser.email || "",
            phone: "",
            avatar: firebaseUser.photoURL || "",
            memberSince: new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            createdAt: new Date(),
            provider: "google",
          };

          await setDoc(userRef, newUser);

          if (activeUid !== uid) return;

          setUser({
            id: uid,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            email: newUser.email,
            phone: newUser.phone,
            avatar: newUser.avatar,
            memberSince: newUser.memberSince,
          });

          return;
        }

        const data = snap.data();

        if (activeUid !== uid) return;

        setUser({
          id: uid,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || firebaseUser.email || "",
          phone: data.phone || "",
          avatar: data.avatar || firebaseUser.photoURL || "",
          memberSince: data.memberSince || "",
        });
      } catch (error) {
        if (activeUid !== uid) return;

        console.error("Error loading user profile:", error);

        // Keep the authenticated identity available even
        // if the profile document cannot be loaded.
        setUser({
          id: uid,
          firstName: firebaseUser.displayName?.split(" ")[0] || "",
          lastName:
            firebaseUser.displayName?.split(" ").slice(1).join(" ") || "",
          email: firebaseUser.email || "",
          phone: "",
          avatar: firebaseUser.photoURL || "",
          memberSince: "",
        });
      }
    });

    return () => {
      activeUid = null;
      unsubscribe();
    };
  }, []);

  // Email registration
  const register = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
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

  // Email login
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      const firebaseUser = result.user;
      await firebaseUser.reload();

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

  // Google login
  const googleLogin = async (): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        throw new Error("Google account does not have an email.");
      }

      const userRef = doc(customerDb, "Users", firebaseUser.uid);

      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const displayName = firebaseUser.displayName || "";
        const nameParts = displayName.trim().split(/\s+/);

        await setDoc(userRef, {
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" "),
          email: firebaseUser.email,
          phone: "",
          avatar: firebaseUser.photoURL || "",
          memberSince: new Date().toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
          createdAt: new Date(),
          provider: "google",
        });
      }

      return true;
    } catch (error: any) {
      console.error("Google Login Error:", error);
      throw error;
    }
  };

  // Google registration
  const googleRegister = async (data: {
    firstName: string;
    lastName: string;
    phone: string;
  }): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        throw new Error("Google account does not have an email address.");
      }

      const userRef = doc(customerDb, "Users", firebaseUser.uid);

      const existingUser = await getDoc(userRef);

      if (existingUser.exists()) {
        return true;
      }

      await setDoc(userRef, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: firebaseUser.email,
        phone: data.phone,
        avatar: firebaseUser.photoURL || "",
        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        createdAt: new Date(),
        provider: "google",
      });

      return true;
    } catch (error: any) {
      console.error("Google registration error:", error);
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      return false;
    }
  };

  // Logout
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      setBookings([]);
      setNotifications([]);
      setPendingPayment(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Update profile locally
  const updateProfile = (data: Partial<User>) => {
    if (!user) return;

    const updated = {
      ...user,
      ...data,
    };

    setUser(updated);

    localStorage.setItem(
      "cbr_registered_" + updated.email,
      JSON.stringify(updated),
    );
  };

  // Create a notification for the currently signed-in
  // customer. The receptionist page can also create docs
  // directly using this same collection and field format.
  const createNotification = useCallback(
    async (data: CreateNotificationInput) => {
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        console.warn("Cannot create notification: no authenticated user.");
        return;
      }

      const eventId = data.eventId.trim();

      if (!eventId) {
        console.warn("Cannot create notification: eventId is required.");
        return;
      }

      const notificationId = `${firebaseUser.uid}_${safeEventId(eventId)}`;

      const notificationRef = doc(customerDb, "Notifications", notificationId);

      try {
        await runTransaction(customerDb, async (transaction) => {
          const existing = await transaction.get(notificationRef);

          if (existing.exists()) return;

          transaction.set(notificationRef, {
            userId: firebaseUser.uid,
            role: "customer",
            eventId,
            type: data.type || "system",
            title: data.title || "Notification",
            message: data.message || "",
            targetPath: data.targetPath || "",
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      } catch (error) {
        console.error("Error creating notification:", error);
        throw error;
      }
    },
    [],
  );

  // Real-time Firestore notification listener.
  useEffect(() => {
    const uid = user?.id;

    if (!uid) {
      setNotifications([]);
      return;
    }

    setNotifications([]);

    const notificationsQuery = query(
      collection(customerDb, "Notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items: Notification[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            type: data.type || "system",
            title: data.title || "Notification",
            message: data.message || "",
            date: formatNotificationDate(data.createdAt),
            read: Boolean(data.read),
            userId: data.userId,
            role: data.role,
            eventId: data.eventId,
            targetPath: data.targetPath || "",
            createdAt: data.createdAt,
          };
        });

        setNotifications(items);
      },
      (error) => {
        console.error("Error listening to notifications:", error);
        setNotifications([]);
      },
    );

    return () => unsubscribe();
  }, [user?.id]);

  // Mark one notification as read.
  const markNotificationRead = useCallback(
    async (id: string): Promise<void> => {
      if (!user?.id || !id) return;

      try {
        await updateDoc(doc(customerDb, "Notifications", id), {
          read: true,
        });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        throw error;
      }
    },
    [user?.id],
  );

  // Mark all currently loaded notifications as read.
  const markAllRead = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    try {
      const unread = notifications.filter((notification) => !notification.read);

      for (let start = 0; start < unread.length; start += 450) {
        const batch = writeBatch(customerDb);
        const chunk = unread.slice(start, start + 450);

        chunk.forEach((notification) => {
          batch.update(doc(customerDb, "Notifications", notification.id), {
            read: true,
          });
        });

        await batch.commit();
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }, [user?.id, notifications]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  // Local booking list + notification.
  const addBooking = (booking: Booking) => {
    setBookings((prev) => {
      if (prev.some((item) => item.id === booking.id)) {
        return prev;
      }

      return [booking, ...prev];
    });

    void createNotification({
      eventId: `booking-created-${booking.bookingRef || booking.id}`,
      type: "booking",
      title: "Booking submitted",
      message:
        `Your reservation for ${booking.roomName} ` +
        `(${booking.checkIn} – ${booking.checkOut}) ` +
        `has been submitted. Ref: ${booking.bookingRef}`,
      targetPath: "/my-bookings",
    }).catch((error) => {
      console.error("Booking notification failed:", error);
    });
  };

  // Cancel booking in Firestore.
  const cancelBooking = async (id: string): Promise<void> => {
    try {
      const booking = bookings.find((item) => item.id === id);

      await updateDoc(doc(customerDb, "Bookings", id), {
        status: "cancelled",
      });

      setBookings((prev) =>
        prev.map((bookingItem) =>
          bookingItem.id === id
            ? {
                ...bookingItem,
                status: "cancelled",
              }
            : bookingItem,
        ),
      );

      if (booking) {
        void createNotification({
          eventId: `booking-cancelled-${booking.bookingRef || id}`,
          type: "booking",
          title: "Booking cancelled",
          message:
            `Your reservation for ${booking.roomName} ` +
            `(${booking.checkIn} – ${booking.checkOut}) ` +
            `has been cancelled. Ref: ${booking.bookingRef}`,
          targetPath: "/my-bookings",
        }).catch((error) => {
          console.error("Cancellation notification failed:", error);
        });
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
      throw error;
    }
  };

  // Update booking in Firestore.
  const modifyBooking = async (
    id: string,
    updates: Partial<Booking>,
  ): Promise<void> => {
    try {
      await updateDoc(doc(customerDb, "Bookings", id), updates);

      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === id
            ? {
                ...booking,
                ...updates,
              }
            : booking,
        ),
      );
    } catch (error) {
      console.error("Error modifying booking:", error);
      throw error;
    }
  };

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
        createNotification,

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

  if (!ctx) {
    throw new Error("useApp must be inside AppProvider");
  }

  return ctx;
}
