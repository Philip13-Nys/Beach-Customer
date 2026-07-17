import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useApp } from "../context/AppContext";
import { Eye, EyeOff, Anchor, CheckCircle2, AlertCircle } from "lucide-react";
import { auth, db } from "../components/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";

export default function Auth() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"login" | "register">(
    params.get("tab") === "register" ? "register" : "login",
  );
  const { user, login, register } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user]);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    try {
      const userCredentials = await signInWithEmailAndPassword(
        auth,
        loginEmail,
        loginPassword,
      );
      console.log("User logged in:", userCredentials.user);
      navigate("/");
    } catch (error: any) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setLoginError("Invalid email or password.");
      } else {
        setLoginError(error.message);
      }
    }
  };

  // Register state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    password: "",
    confirmPassword: "",
  });

  const [registerError, setRegisterError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    const {
      firstName,
      lastName,
      email,
      phone,
      nationality,
      password,
      confirmPassword,
    } = form;

    if (!firstName || !lastName || !email || !phone || !password) {
      setRegisterError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setRegisterError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    register({ firstName, lastName, email, phone, nationality, password });
    navigate("/");

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      console.log("User created:", user);
      if (user) {
        await setDoc(doc(db, "Users", user.uid), {
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: phone,
          nationality: nationality,
        });
        console.log("User data saved to Firestore");
      }
    } catch (error) {
      console.error("Error saving user data to Firestore:", error);
    }
  };
  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60";

  return (
    <div className="min-h-screen flex">
      {/* Left visual */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=1200&fit=crop&auto=format"
          alt="Diving at Sabang Resorts"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/50 to-primary/70" />
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-white font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sabang Diving Resort
            </span>
          </Link>
          <div>
            <h2
              className="text-white mb-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.5rem",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Your island adventure starts here.
            </h2>
            <p className="text-white/70 leading-relaxed text-sm">
              Create your account to access exclusive booking, manage
              reservations, and unlock member benefits at Sabang Resorts.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              {[
                "Access personalized room recommendations",
                "Manage all your bookings in one place",
                "Receive exclusive member offers & promos",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-white/80 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/40 text-xs">
            © 2026 Sabang Beach & Diving Resorts
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-primary font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sabang Diving and Beach Resorts
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-8">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tab === t
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h1
                  className="text-foreground mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.875rem",
                    fontWeight: 700,
                  }}
                >
                  Welcome back
                </h1>
                <p className="text-muted-foreground text-sm">
                  Sign in to manage your reservations.
                </p>
              </div>
              {loginError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {loginError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showLoginPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPwd(!showLoginPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPwd ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    className="text-xs text-primary hover:text-accent transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>
              <p className="text-center text-xs text-muted-foreground">
                No account yet?{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="text-primary font-medium hover:text-accent transition-colors"
                >
                  Create one
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <h1
                  className="text-foreground mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.875rem",
                    fontWeight: 700,
                  }}
                >
                  Create your account
                </h1>
                <p className="text-muted-foreground text-sm">
                  Start planning your island escape today.
                </p>
              </div>
              {registerError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{" "}
                  {registerError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    First name *
                  </label>
                  <input
                    type="text"
                    placeholder="Juan"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Last name *
                  </label>
                  <input
                    type="text"
                    placeholder="Dela Cruz"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address *
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    placeholder="+63 9XX XXX XXXX"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Nationality
                  </label>
                  <input
                    type="text"
                    placeholder="Filipino"
                    value={form.nationality}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nationality: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Confirm password *
                </label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-white py-3 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors mt-1"
              >
                Create Account
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-primary font-medium hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              </p>
              <p className="text-center text-[10px] text-muted-foreground/70">
                By creating an account you agree to our{" "}
                <a href="#" className="underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="underline">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
