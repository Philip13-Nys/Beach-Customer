import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useApp } from "../context/AppContext";
import { Eye, EyeOff, Anchor, CheckCircle2, AlertCircle } from "lucide-react";

export default function Auth() {
  const { user, login, register, googleLogin, googleRegister } = useApp();

  const [params] = useSearchParams();

  const [tab, setTab] = useState<"login" | "register">(
    params.get("tab") === "register" ? "register" : "login",
  );

  const navigate = useNavigate();

  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoginError("");

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    try {
      const success = await login(loginEmail.trim(), loginPassword);

      if (success) {
        navigate("/");
      } else {
        setLoginError("Invalid email or password.");
      }
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.message === "EMAIL_NOT_VERIFIED") {
        setLoginError(
          "Your email is not verified. Please check your email and verify your account before signing in.",
        );
        return;
      }

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setLoginError("Invalid email or password.");
        return;
      }

      setLoginError(error.message || "Login failed.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError("");
    setRegisterError("");

    try {
      const success = await googleLogin();

      if (success) {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Google login error:", error);

      if (error.message === "ACCOUNT_NOT_REGISTERED") {
        setLoginError(
          "This Google account is not registered. Please create an account first.",
        );
        return;
      }

      if (error.code === "auth/popup-closed-by-user") {
        return;
      }

      if (error.code === "auth/popup-blocked") {
        setLoginError("Google sign-in popup was blocked by your browser.");
        return;
      }

      setLoginError(
        error.message || "Google sign-in failed. Please try again.",
      );
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setRegisterError("");

    // Validate required fields
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setRegisterError("Please fill in all required fields.");
      return;
    }

    // Password length
    if (form.password.length < 8) {
      setRegisterError("Password must be at least 8 characters.");
      return;
    }

    // Confirm password
    if (form.password !== form.confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    try {
      const success = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        nationality: form.nationality.trim(),
        password: form.password,
      });

      if (success) {
        setRegisterError("");

        alert(
          "Account created successfully! Please check your email and click the verification link before signing in.",
        );

        setForm({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          nationality: "",
          password: "",
          confirmPassword: "",
        });

        setTab("login");
      }
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.code === "auth/email-already-in-use") {
        setRegisterError(
          "This email is already registered. Please sign in instead.",
        );
        return;
      }

      if (error.code === "auth/invalid-email") {
        setRegisterError("Please enter a valid email address.");
        return;
      }

      if (error.code === "auth/weak-password") {
        setRegisterError("Password must be at least 6 characters.");
        return;
      }

      setRegisterError(
        error.message || "Registration failed. Please try again.",
      );
    }
  };

  const handleGoogleRegister = async () => {
    setRegisterError("");

    if (!form.phone.trim()) {
      setRegisterError("Please enter your phone number.");
      return;
    }

    try {
      const success = await googleRegister({
        firstName: "",
        lastName: "",
        phone: form.phone.trim(),
        nationality: form.nationality.trim(),
      });

      if (success) {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Google registration error:", error);

      if (error.message === "ACCOUNT_ALREADY_EXISTS") {
        setRegisterError(
          "This Google account is already registered. Please sign in instead.",
        );
        return;
      }

      if (error.code === "auth/popup-closed-by-user") {
        return;
      }

      if (error.code === "auth/popup-blocked") {
        setRegisterError("Google sign-up popup was blocked by your browser.");
        return;
      }

      setRegisterError(
        error.message || "Google registration failed. Please try again.",
      );
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
                  Sign in using your verified email account.
                </p>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address
                </label>

                <input
                  type="email"
                  placeholder="cunag@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Password */}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showLoginPwd ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login */}
              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>

                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">
                    OR
                  </span>
                </div>
              </div>

              {/* Google Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full border border-border bg-white text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.92-4.18 2.92-7.39z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.51A9.74 9.74 0 0 0 12 21.5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.54 13.61A5.85 5.85 0 0 1 6.23 12c0-.56.1-1.1.31-1.61V7.88H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.12l3.24-2.51z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6.36c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.51C7.31 8.08 9.46 6.36 12 6.36z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-xs text-muted-foreground">
                No account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setLoginError("");
                    setTab("register");
                  }}
                  className="text-primary font-medium"
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
                  Enter your information to create your account.
                </p>
              </div>

              {registerError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {registerError}
                </div>
              )}

              {/* Name */}
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
                      setForm((f) => ({
                        ...f,
                        firstName: e.target.value,
                      }))
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
                      setForm((f) => ({
                        ...f,
                        lastName: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Email address *
                </label>

                <input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      email: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              {/* Phone & Nationality */}
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
                      setForm((f) => ({
                        ...f,
                        phone: e.target.value,
                      }))
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
                      setForm((f) => ({
                        ...f,
                        nationality: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
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
                      setForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    className={inputClass + " pr-10"}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                    setForm((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Create Account
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>

                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">
                    OR
                  </span>
                </div>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleRegister}
                className="w-full border border-border bg-white text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.92-4.18 2.92-7.39z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.51A9.74 9.74 0 0 0 12 21.5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.54 13.61A5.85 5.85 0 0 1 6.23 12c0-.56.1-1.1.31-1.61V7.88H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.12l3.24-2.51C7.31 8.08 9.46 6.36 12 6.36z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6.36c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.51C7.31 8.08 9.46 6.36 12 6.36z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRegisterError("");
                    setTab("login");
                  }}
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
