import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Booking, Notification, sampleBookings, sampleNotifications } from '../data/mockData';
import { auth, db } from "../components/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
  login: (email: string, password: string) => boolean;
  register: (data: Omit<User, 'id' | 'avatar' | 'memberSince'> & { password: string }) => boolean;
  logout: () => void;
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

const DEMO_USER: User = {
  id: 'u1',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex.rivera@email.com',
  phone: '+63 917 555 0100',
  nationality: 'Filipino',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&auto=format',
  memberSince: 'January 2025',
};

export function AppProvider({ children }: { children: ReactNode }) {
 const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try { return JSON.parse(localStorage.getItem('cbr_bookings') || JSON.stringify(sampleBookings)); } catch { return sampleBookings; }
  });
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try { return JSON.parse(localStorage.getItem('cbr_notifs') || JSON.stringify(sampleNotifications)); } catch { return sampleNotifications; }
  });
  const [pendingPayment, setPendingPayment] = useState<Booking | null>(null);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const snap = await getDoc(doc(db, "Users", firebaseUser.uid));

      if (snap.exists()) {
        const data = snap.data();

        setUser({
          id: firebaseUser.uid,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          nationality: data.nationality,
          avatar: "",
          memberSince: "",
        });
      }
    } else {
      setUser(null);
    }
  });

  return unsubscribe;
}, []);

  useEffect(() => { localStorage.setItem('cbr_bookings', JSON.stringify(bookings)); }, [bookings]);
  useEffect(() => { localStorage.setItem('cbr_notifs', JSON.stringify(notifications)); }, [notifications]);

 const login = () => true;

  const register = (data: Omit<User, 'id' | 'avatar' | 'memberSince'> & { password: string }): boolean => {
    const { password: _, ...rest } = data;
    const newUser: User = {
      ...rest,
      id: 'u_' + Date.now(),
      avatar: `https://ui-avatars.com/api/?name=${rest.firstName}+${rest.lastName}&background=0A3D62&color=fff`,
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
    localStorage.setItem('cbr_registered_' + data.email, JSON.stringify(newUser));
    setUser(newUser);
    setBookings([]);
    setNotifications([{
      id: 'n_welcome',
      type: 'system',
      title: 'Welcome to Sabang Beach and Diving Resort!',
      message: `Hi ${newUser.firstName}! Your account is ready. Start exploring our rooms and activities.`,
      date: new Date().toISOString().split('T')[0],
      read: false,
    }]);
    return true;
  };

 const logout = async () => {
  await signOut(auth);
};

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem('cbr_registered_' + updated.email, JSON.stringify(updated));
    }
  };

  const addBooking = (booking: Booking) => {
    setBookings(prev => [booking, ...prev]);
    setNotifications(prev => [{
      id: 'n_' + Date.now(),
      type: 'booking',
      title: 'Booking Confirmed!',
      message: `Your reservation for ${booking.roomName} (${booking.checkIn} – ${booking.checkOut}) has been confirmed. Ref: ${booking.bookingRef}`,
      date: new Date().toISOString().split('T')[0],
      read: false,
    }, ...prev]);
  };

  const cancelBooking = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      setNotifications(prev => [{
        id: 'n_' + Date.now(),
        type: 'booking',
        title: 'Booking Cancelled',
        message: `Your reservation for ${booking.roomName} (Ref: ${booking.bookingRef}) has been cancelled.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
      }, ...prev]);
    }
  };

  const modifyBooking = (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      user, login, register, logout, updateProfile,
      bookings, addBooking, cancelBooking, modifyBooking,
      notifications, markNotificationRead, markAllRead, unreadCount,
      pendingPayment, setPendingPayment,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
