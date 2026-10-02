import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useApp } from "../context/AppContext";
import FloatingAI from "./FloatingAI";
import {
  Waves,
  Menu,
  X,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Anchor,
  Home,
  Bed,
  Calendar,
  Clock,
  CreditCard,
  MessageCircle,
  Star,
  Bot,
  Activity,
  Check,
  CheckCheck,
} from "lucide-react";

const navLinks = [
  { label: "Home", href: "/", icon: Home },
  { label: "Rooms", href: "/rooms", icon: Bed },
  { label: "Activities", href: "/services", icon: Activity },
];

const authNavLinks = [{ label: "My Bookings", href: "/booking-history" }];

const guestLinks = [
  { label: "My Bookings", href: "/bookings", icon: Calendar },
  { label: "Booking History", href: "/booking-history", icon: Clock },
  { label: "Payments", href: "/payment", icon: CreditCard },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "AI Assistant", href: "/ai-assistant", icon: Bot },
  { label: "Contact / Chat", href: "/inquiries", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const {
    user,
    logout,
    unreadCount,
    notifications,
    markNotificationRead,
    markAllRead,
  } = useApp();

  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUserMenuOpen(false);
      setMenuOpen(false);
      setNotificationsOpen(false);
      navigate("/");
    }
  };

  const isActive = (href: string) =>
    href === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(href);

  const notificationLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  const formatDate = (value: any) => {
    if (!value) return "Just now";

    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);

    if (Number.isNaN(date.getTime())) return "Just now";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      if (!notification.read) {
        await markNotificationRead(notification.id);
      }
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    } finally {
      setNotificationsOpen(false);
    }

    if (notification.targetPath) {
      navigate(notification.targetPath);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-2">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <Anchor className="w-5 h-5 text-white" />
              </div>

              <div className="min-w-0">
                <div
                  className="text-xs sm:text-sm font-semibold text-primary leading-tight truncate max-w-[150px] sm:max-w-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Sabang Beach and Diving Resort
                </div>

                <div className="hidden sm:block text-[10px] text-muted-foreground leading-none tracking-wide uppercase">
                  Beach & Dive Resort
                </div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-accent"
                      : "text-foreground hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {user &&
                authNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "text-accent"
                        : "text-foreground hover:text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}

              <Link
                to="/inquiries"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Contact
              </Link>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              {user ? (
                <>
                  {/* Notifications dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={notificationLabel}
                      title={notificationLabel}
                      aria-expanded={notificationsOpen}
                      onClick={() => {
                        setNotificationsOpen((open) => !open);
                        setUserMenuOpen(false);
                      }}
                      className="relative p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <Bell
                        className="w-5 h-5 text-foreground"
                        aria-hidden="true"
                      />

                      {unreadCount > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-semibold"
                        >
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {notificationsOpen && (
                      <div className="absolute right-0 top-full mt-2 w-[min(92vw,380px)] bg-white rounded-xl shadow-xl border border-border z-[60] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              Notifications
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {unreadCount > 0
                                ? `${unreadCount} unread`
                                : "You're all caught up"}
                            </p>
                          </div>

                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllRead}
                              className="text-xs font-medium text-primary hover:text-primary/70 flex items-center gap-1"
                            >
                              <CheckCheck className="w-4 h-4" />
                              Mark all read
                            </button>
                          )}
                        </div>

                        <div className="max-h-[min(65vh,440px)] overflow-y-auto">
                          {!notifications || notifications.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                              <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                                <Bell className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <p className="text-sm font-medium text-foreground">
                                No notifications yet
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Updates about your bookings and payments will
                                appear here.
                              </p>
                            </div>
                          ) : (
                            notifications
                              .slice(0, 20)
                              .map((notification: any) => (
                                <button
                                  type="button"
                                  key={notification.id}
                                  onClick={() =>
                                    handleNotificationClick(notification)
                                  }
                                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/70 transition-colors ${
                                    !notification.read
                                      ? "bg-primary/[0.04]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                        !notification.read
                                          ? "bg-accent"
                                          : "bg-transparent"
                                      }`}
                                    />

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground leading-snug">
                                          {notification.title || "Notification"}
                                        </p>
                                        {!notification.read && (
                                          <span className="text-[10px] text-accent font-semibold flex-shrink-0">
                                            NEW
                                          </span>
                                        )}
                                      </div>

                                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        {notification.message || ""}
                                      </p>

                                      <p className="text-[10px] text-muted-foreground mt-2">
                                        {formatDate(notification.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))
                          )}
                        </div>

                        <div className="px-4 py-2 border-t border-border bg-muted/30 flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">
                            Latest updates
                          </span>
                          <button
                            type="button"
                            onClick={() => setNotificationsOpen(false)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User menu */}
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Open user menu"
                      aria-expanded={userMenuOpen}
                      onClick={() => {
                        setUserMenuOpen((open) => !open);
                        setNotificationsOpen(false);
                      }}
                      className="flex items-center gap-1 sm:gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-full border border-border hover:bg-muted transition-colors max-w-[120px] sm:max-w-none"
                    >
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />

                      <span className="text-sm font-medium text-foreground hidden sm:block truncate max-w-[80px]">
                        {user.firstName}
                      </span>

                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-border py-2 z-50">
                        <div className="px-4 py-2 border-b border-border mb-1">
                          <div className="text-sm font-semibold text-foreground">
                            {user.firstName} {user.lastName}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </div>

                        {guestLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          >
                            <link.icon className="w-4 h-4 text-muted-foreground" />
                            {link.label}
                          </Link>
                        ))}

                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-red-50 w-full transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <Link
                    to="/auth"
                    className="text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap px-1.5 sm:px-2 py-1.5"
                  >
                    Sign In
                  </Link>

                  <Link
                    to="/auth?tab=register"
                    className="text-xs sm:text-sm font-medium bg-accent text-white px-2.5 sm:px-4 py-2 rounded-full hover:bg-accent/90 transition-colors whitespace-nowrap"
                  >
                    <span className="sm:hidden">Sign Up</span>
                    <span className="hidden sm:inline">Sign Up Now!</span>
                  </Link>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                className="md:hidden p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-white py-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-secondary text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}

              {user &&
                guestLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                ))}

              {!user && (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4" />
                  Sign In / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Floating AI Assistant */}
      <FloatingAI />

      {/* Footer */}
      <footer className="bg-primary text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-white" />
                </div>

                <div>
                  <div
                    className="font-semibold text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Sabang Beach and Diving Resort
                  </div>

                  <div className="text-xs text-white/60 uppercase tracking-wide">
                    Beach & Dive Resort
                  </div>
                </div>
              </div>

              <p className="text-white/70 text-sm leading-relaxed max-w-xs">
                A top tropical getaway in Oriental Mindoro, famous for its
                white-sand beaches and world-class scuba diving.
              </p>

              <div className="flex items-center gap-2 mt-4">
                <Waves className="w-4 h-4 text-accent" />
                <span className="text-white/60 text-xs">
                  Est. 2015 · Puerto Galera, Philippines
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-3">
                Explore
              </h4>

              <ul className="space-y-2">
                {[
                  ["Rooms", "/rooms"],
                  ["Activities", "/services"],
                  ["Dining", "#"],
                  ["Gallery", "#"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-white/60 text-sm hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-3">
                Contact
              </h4>

              <ul className="space-y-2 text-white/60 text-sm">
                <li>📍 Sabang, Puerto Galera</li>
                <li>📞 +63 48 555 0192</li>
                <li>✉️ hello@sabangbeach.ph</li>
                <li className="pt-2">
                  <Link
                    to="/inquiries"
                    className="text-accent hover:text-accent/80 transition-colors text-sm font-medium"
                  >
                    Send a message →
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 sm:mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p className="text-white/40 text-xs">
              © 2026 Sabang Beach & Diving Resorts. All rights reserved.
            </p>

            <div className="flex flex-wrap justify-center sm:justify-end gap-x-4 gap-y-2 text-white/40 text-xs">
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>

              <a href="#" className="hover:text-white transition-colors">
                Terms of Service
              </a>

              <a href="#" className="hover:text-white transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
