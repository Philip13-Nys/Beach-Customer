import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import {
  User,
  Phone,
  Globe,
  Mail,
  Lock,
  Camera,
  CheckCircle2,
  LogOut,
} from "lucide-react";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const navigate = useNavigate();
  if (!user) {
    navigate("/auth");
    return null;
  }
  return <>{children}</>;
}

export default function Profile() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const { user, updateProfile, logout } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"info" | "password">("info");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    firstName: user!.firstName,
    lastName: user!.lastName,
    email: user!.email,
    phone: user!.phone,
    nationality: user!.nationality,
  });

  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwdMsg, setPwdMsg] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.next.length < 8) {
      setPwdMsg("New password must be at least 8 characters.");
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdMsg("Passwords do not match.");
      return;
    }
    setPwdMsg("success");
    setPwdForm({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwdMsg(""), 3000);
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "#0A2540",
          }}
        >
          My Profile
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal information and account credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-border text-center">
            <div className="relative inline-block mb-4">
              <img
                src={user!.avatar}
                alt={user!.firstName}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-secondary"
              />
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-md hover:bg-accent/90 transition-colors">
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {user!.firstName} {user!.lastName}
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {user!.email}
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Member since {user!.memberSince}
            </div>

            <div className="mt-6 space-y-2">
              {[
                { label: "Personal Info", value: "info" as const },
                { label: "Change Password", value: "password" as const },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    tab === item.value
                      ? "bg-secondary text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main form */}
        <div className="lg:col-span-2">
          {tab === "info" ? (
            <form
              onSubmit={handleSave}
              className="bg-white rounded-2xl p-6 border border-border"
            >
              <h2
                className="font-semibold text-foreground mb-5"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                }}
              >
                Personal Information
              </h2>

              {saved && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm mb-5">
                  <CheckCircle2 className="w-4 h-4" /> Profile updated
                  successfully!
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" /> First
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                  Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nationality: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Account Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">
                      Member Since
                    </div>
                    <div className="font-medium text-foreground mt-0.5">
                      {user!.memberSince}
                    </div>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">
                      Account Status
                    </div>
                    <div className="font-medium text-green-600 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />{" "}
                      Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  className="bg-primary text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handlePwd}
              className="bg-white rounded-2xl p-6 border border-border"
            >
              <h2
                className="font-semibold text-foreground mb-5 flex items-center gap-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                }}
              >
                <Lock className="w-5 h-5 text-primary" /> Change Password
              </h2>

              {pwdMsg === "success" ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm mb-5">
                  <CheckCircle2 className="w-4 h-4" /> Password changed
                  successfully!
                </div>
              ) : pwdMsg ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-5">
                  {pwdMsg}
                </div>
              ) : null}

              <div className="space-y-4">
                {[
                  { label: "Current Password", key: "current" },
                  { label: "New Password", key: "next" },
                  { label: "Confirm New Password", key: "confirm" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="password"
                      value={pwdForm[field.key as keyof typeof pwdForm]}
                      onChange={(e) =>
                        setPwdForm((f) => ({
                          ...f,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-secondary rounded-xl text-xs text-primary">
                Password must be at least 8 characters long and contain a mix of
                letters and numbers.
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  className="bg-primary text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
