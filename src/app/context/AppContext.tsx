import { cancelCustomerBooking } from "../services/customerBookings";
import { normalizePhilippineMobile } from "../utils/registration";
import { markVerificationSent } from "../services/emailVerification";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import {
  bookingNotificationState,
  bookingChangeNotifications,
  bookingConfirmationNotification,
  distinctBookingConfirmations,
} from "../utils/bookingNotifications";

import { auth, db, customerDb } from "../components/firebase";
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
  addOns: { name: string; price: number; quantity?: number; type?: string }[];
  totalPrice: number;

  status: "confirmed" | "pending" | "cancelled" | "completed";

  paymentStatus:
    | "paid"
    | "partial"
    | "unpaid"
    | "pending_verification"
    | "rejected";

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
function customerProfile(
  id: string,
  data: Record<string, any>,
  email = "",
): User {
  return {
    id,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || email,
    phone: data.phone || "",
    avatar: data.avatar || "",
    memberSince: data.memberSince || "",
  };
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
  authLoading: boolean;

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
  cancelBooking: (id: string, reason: string) => Promise<void>;
  modifyBooking: (id: string, updates: Partial<Booking>) => void;

  notifications: Notification[];
  notificationsLoading: boolean;
  notificationsError: string;
  retryNotifications: () => void;
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
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (typeof value === "object" && value.seconds) {
    date = new Date(value.seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return "";

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
  const [authLoading, setAuthLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingPayment, setPendingPayment] = useState<Booking | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [notificationMonitorError, setNotificationMonitorError] = useState("");
  const [notificationWriteError, setNotificationWriteError] = useState("");
  const [notificationRetry, setNotificationRetry] = useState(0);
  const failedNotifications = useRef(
    new Map<string, { userId: string; input: CreateNotificationInput }>(),
  );

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentGeneration = ++generation;
      setAuthLoading(true);
      if (!firebaseUser) {
        setUser(null);
        setBookings([]);
        setNotifications([]);
        setAuthLoading(false);
        return;
      }
      if (!firebaseUser.emailVerified) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setUser(null);
      try {
        const userRef = doc(customerDb, "Users", firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (!active || generation !== currentGeneration) return;

        // Account profiles are created only by registration after contact validation.
        if (!snap.exists()) return;

        const data = snap.data();

        setUser({
          id: firebaseUser.uid,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || firebaseUser.email || "",
          phone: data.phone || "",
          avatar: data.avatar || "",
          memberSince: data.memberSince || "",
        });
      } catch (error) {
        console.error("Error loading user profile:", error);
        if (active && generation === currentGeneration) setUser(null);
      } finally {
        if (active && generation === currentGeneration) setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      generation++;
      unsubscribe();
    };
  }, []);

  const register = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<boolean> => {
    const phone = normalizePhilippineMobile(data.phone);
    let createdUser: typeof auth.currentUser = null;
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );

      const firebaseUser = result.user;
      createdUser = firebaseUser;

      await setDoc(doc(customerDb, "Users", firebaseUser.uid), {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone,
        avatar: "",
        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        createdAt: new Date(),
        provider: "email",
      });
      try {
        await sendEmailVerification(firebaseUser);
      } catch {
        throw new Error(
          "Your account was created, but the verification email could not be sent. Please use Resend verification email on the sign-in page after waiting a few minutes.",
        );
      }
      markVerificationSent(data.email);
      return true;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      if (createdUser && auth.currentUser?.uid === createdUser.uid)
        await signOut(auth);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;
      await firebaseUser.reload();

      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      await firebaseUser.getIdToken(true);
      const profile = await getDoc(doc(customerDb, "Users", firebaseUser.uid));
      if (!profile.exists()) {
        await signOut(auth);
        throw new Error(
          "Your account is verified, but its customer profile is incomplete. Please contact the resort for help completing registration.",
        );
      }
      if (auth.currentUser?.uid !== firebaseUser.uid)
        throw new Error("Your session changed. Please sign in again.");
      setUser(
        customerProfile(
          firebaseUser.uid,
          profile.data(),
          firebaseUser.email || "",
        ),
      );
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

      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        throw new Error("Google account does not have an email.");
      }

      const userRef = doc(customerDb, "Users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        throw new Error("ACCOUNT_NOT_REGISTERED");
      }
      await firebaseUser.reload();
      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      await firebaseUser.getIdToken(true);
      if (auth.currentUser?.uid !== firebaseUser.uid)
        throw new Error("Your session changed. Please sign in again.");
      setUser(
        customerProfile(
          firebaseUser.uid,
          userSnap.data(),
          firebaseUser.email || "",
        ),
      );
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
  }): Promise<boolean> => {
    const phone = normalizePhilippineMobile(data.phone);
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
        if (auth.currentUser?.uid === firebaseUser.uid)
          setUser(
            customerProfile(
              firebaseUser.uid,
              existingUser.data(),
              firebaseUser.email,
            ),
          );
        return true;
      }

      const profile = {
        firstName:
          data.firstName || firebaseUser.displayName?.split(" ")[0] || "",
        lastName:
          data.lastName ||
          firebaseUser.displayName?.split(" ").slice(1).join(" ") ||
          "",
        email: firebaseUser.email,
        phone,
        avatar: firebaseUser.photoURL || "",
        memberSince: new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        createdAt: new Date(),
        provider: "google",
      };
      await setDoc(userRef, profile);
      if (auth.currentUser?.uid === firebaseUser.uid)
        setUser({ id: firebaseUser.uid, ...profile });

      return true;
    } catch (error: any) {
      console.error("Google registration error:", error);
      console.error("Code:", error.code);
      console.error("Message:", error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setBookings([]);
      setNotifications([]);
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
        failedNotifications.current.delete(notificationId);
        if (
          auth.currentUser?.uid === firebaseUser.uid &&
          failedNotifications.current.size === 0
        ) {
          setNotificationWriteError("");
        }
      } catch (error) {
        console.error("Error creating notification:", error);
        if (auth.currentUser?.uid === firebaseUser.uid) {
          failedNotifications.current.set(notificationId, {
            userId: firebaseUser.uid,
            input: data,
          });
          setNotificationWriteError(
            "An update could not be saved to your notifications. Please retry.",
          );
        }
        throw error;
      }
    },
    [],
  );

  const retryNotifications = useCallback(() => {
    setNotificationRetry((attempt) => attempt + 1);
    for (const entry of failedNotifications.current.values()) {
      if (entry.userId === auth.currentUser?.uid) {
        void createNotification(entry.input).catch(() => {});
      }
    }
  }, [createNotification]);

  useEffect(() => {
    const userId = user?.id;
    setNotificationWriteError("");
    for (const [key, entry] of failedNotifications.current) {
      if (entry.userId !== userId) failedNotifications.current.delete(key);
    }
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    setNotificationMonitorError("");
    if (!userId) return;
    let active = true;
    let initialized = false;
    const previous = new Map<
      string,
      ReturnType<typeof bookingNotificationState>
    >();
    const unsubscribe = onSnapshot(
      query(collection(customerDb, "Bookings"), where("userId", "==", userId)),
      (snapshot) => {
        if (!active || auth.currentUser?.uid !== userId) return;
        setNotificationMonitorError("");
        for (const change of snapshot.docChanges()) {
          const id = change.doc.id;
          if (change.type === "removed") {
            previous.delete(id);
            continue;
          }
          const data = change.doc.data();
          const oldState = previous.get(id);
          previous.set(id, bookingNotificationState(data, oldState));
          // Seed existing bookings without generating a flood of old updates.
          if (!initialized || !oldState) continue;
          for (const input of bookingChangeNotifications(id, data, oldState)) {
            if (input.eventId === `booking-confirmed-${id}`) {
              void (async () => {
                let reference: string | undefined;
                try {
                  const display = await getDoc(
                    doc(
                      db,
                      "DisplayReferences",
                      `BK_${encodeURIComponent(id)}`,
                    ),
                  );
                  const value = display.data()?.value;
                  if (
                    typeof value === "string" &&
                    /^BK-[A-Z0-9-]+$/.test(value)
                  )
                    reference = value;
                } catch {
                  /* Keep the fallback alert available if the optional display-code lookup fails. */
                }
                if (!active || auth.currentUser?.uid !== userId) return;
                await createNotification(
                  bookingConfirmationNotification(id, data, reference),
                );
              })().catch(() => {});
            } else void createNotification(input).catch(() => {});
          }
        }
        initialized = true;
      },
      (error) => {
        console.error("Booking notification monitor failed:", error);
        if (active && auth.currentUser?.uid === userId) {
          setNotificationMonitorError(
            "Booking updates could not be monitored. Please retry.",
          );
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id, notificationRetry, createNotification]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const userId = user?.id;
    setNotifications([]);
    setNotificationLoadError("");
    if (!user?.id) {
      setNotificationsLoading(false);
      return;
    }
    setNotificationsLoading(true);

    const ownerQuery = query(
      collection(customerDb, "Notifications"),
      where("userId", "==", user.id),
    );

    const listen = (ordered: boolean) =>
      onSnapshot(
        ordered
          ? query(ownerQuery, orderBy("createdAt", "desc"), limit(100))
          : ownerQuery,
        (snapshot) => {
          if (!active || auth.currentUser?.uid !== userId) return;
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

          items.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });

          setNotifications(distinctBookingConfirmations(items).slice(0, 100));
          setNotificationsLoading(false);
          setNotificationLoadError("");
        },
        (error) => {
          if (!active || auth.currentUser?.uid !== userId) return;
          // Keep the frontend usable if the deployed database lacks the compound index.
          // The fallback still reads only this user's records and selects the newest 100.
          if (ordered && error.code === "failed-precondition") {
            console.warn(
              "Using notification sorting fallback; check the Firestore index:",
              error,
            );
            unsubscribe = listen(false);
            return;
          }
          console.error("Error listening to notifications:", error);
          setNotificationsLoading(false);
          setNotificationLoadError(
            "Notifications could not be loaded. Please retry.",
          );
        },
      );

    unsubscribe = listen(true);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id, notificationRetry]);

  const notificationsError =
    notificationLoadError || notificationMonitorError || notificationWriteError;

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;

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

  const markAllRead = useCallback(async () => {
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

  const addBooking = (booking: Booking) => {
    setBookings((prev) => {
      if (prev.some((item) => item.id === booking.id)) return prev;
      return [booking, ...prev];
    });

    void createNotification({
      eventId: `booking-created-${booking.bookingRef || booking.id}`,
      type: "booking",
      title: "Booking submitted",
      message: `Your reservation for ${booking.roomName} (${booking.checkIn} – ${booking.checkOut}) has been submitted. Ref: ${booking.bookingRef}`,
      targetPath: "/my-bookings",
    }).catch((error) => {
      console.error("Booking notification failed:", error);
    });
  };

  const cancelBooking = async (id: string, reason: string) => {
    try {
      const booking = bookings.find((item) => item.id === id);

      await cancelCustomerBooking(id, reason);

      setBookings((prev) =>
        prev.map((bookingItem) =>
          bookingItem.id === id
            ? { ...bookingItem, status: "cancelled" }
            : bookingItem,
        ),
      );

      if (booking) {
        void createNotification({
          eventId: `booking-cancelled-${booking.bookingRef || id}`,
          type: "booking",
          title: "Booking cancelled",
          message: `Your reservation for ${booking.roomName} (${booking.checkIn} – ${booking.checkOut}) has been cancelled. Ref: ${booking.bookingRef}`,
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

  const modifyBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      await updateDoc(doc(customerDb, "Bookings", id), updates);

      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === id ? { ...booking, ...updates } : booking,
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
        authLoading,
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
        notificationsLoading,
        notificationsError,
        retryNotifications,
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
