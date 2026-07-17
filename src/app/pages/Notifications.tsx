import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import {
  Bell,
  CheckCheck,
  BookOpen,
  CreditCard,
  Clock,
  Gift,
  Settings,
} from "lucide-react";

const typeConfig: Record<
  string,
  { icon: typeof Bell; color: string; bg: string }
> = {
  booking: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-100" },
  payment: { icon: CreditCard, color: "text-green-600", bg: "bg-green-100" },
  reminder: { icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
  promo: { icon: Gift, color: "text-purple-600", bg: "bg-purple-100" },
  system: { icon: Settings, color: "text-gray-600", bg: "bg-gray-100" },
};

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const navigate = useNavigate();
  if (!user) {
    navigate("/auth");
    return null;
  }
  return <>{children}</>;
}

export default function Notifications() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}

function NotificationsContent() {
  const { notifications, markNotificationRead, markAllRead, unreadCount } =
    useApp();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 700,
              color: "#0A2540",
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors border border-border px-4 py-2 rounded-full hover:bg-muted"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Booking confirmations, payment updates, and promos will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const config = typeConfig[notif.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <div
                key={notif.id}
                onClick={() => !notif.read && markNotificationRead(notif.id)}
                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
                  notif.read
                    ? "bg-white border-border opacity-70"
                    : "bg-white border-primary/20 shadow-sm"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm font-semibold ${notif.read ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {notif.date}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
