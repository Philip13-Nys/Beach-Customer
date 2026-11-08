import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useApp } from "../context/AppContext";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../components/firebase";
import TermsModal from "../components/TermsModal";
import PrivacyPolicyDialog from "../components/PrivacyPolicyDialog";
import {
  Eye,
  EyeOff,
  Anchor,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import TurnstileWidget from "../components/TurnstileWidget";
import { verifyTurnstile } from "../components/verifyTurnstile";
import { normalizePhilippineMobile, VERIFICATION_MESSAGE } from "../utils/registration";
import { resendVerification, verificationCooldown } from "../services/emailVerification";

const DEFAULT_RESORT_NAME = "Sabang Beach and Diving Resort";
const PASSWORD_POLICY_HINT =
  "Use a minimum of 8 characters, including an uppercase letter, a number, and a special character.";
const FIREBASE_PASSWORD_SYMBOLS = "^$*.[]{}()?\"!@#%&/\\,><':;|_~";

export default function Auth() {
  const { user, authLoading, login, register, googleLogin, googleRegister } = useApp();

  const [resortName, setResortName] = useState(DEFAULT_RESORT_NAME);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const submittingRef = useRef(false);
  const [showTerms, setShowTerms] = useState(false);

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedReturn = location.state?.returnTo ||
    (location.state?.from ? `${location.state.from.pathname || ""}${location.state.from.search || ""}` : "") || params.get("returnTo");
  const authDestination = typeof requestedReturn === "string" && requestedReturn.startsWith("/") &&
    !requestedReturn.startsWith("//") && !requestedReturn.startsWith("/auth") ? requestedReturn : "/";

  const [tab, setTab] = useState<"login" | "register">(
    params.get("tab") === "register" ? "register" : "login",
  );

  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  useEffect(() => {
    const update = () => setResendSeconds(verificationCooldown(loginEmail));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [loginEmail]);

  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  const verificationFlow =
    tab === "register" ? "register" : forgotPassword ? "reset" : "login";
  const [tokenFlow, setTokenFlow] = useState("");

  useEffect(() => {
    setTurnstileToken("");
    setTokenFlow("");
  }, [verificationFlow]);

  const resetVerification = () => {
    setTurnstileToken("");
    setTokenFlow("");
    setVerificationAttempt((attempt) => attempt + 1);
  };

  const handleVerification = (token: string) => {
    setTurnstileToken(token);
    setTokenFlow(verificationFlow);
    const clearVerificationError = (error: string) =>
      error.toLowerCase().includes("security verification") ? "" : error;
    setLoginError(clearVerificationError);
    setRegisterError(clearVerificationError);
    setResetError(clearVerificationError);
  };

  const verificationWidget = (
    <TurnstileWidget
      key={`${verificationFlow}-${verificationAttempt}`}
      onVerify={handleVerification}
      onExpire={() => {
        setTurnstileToken("");
        setTokenFlow("");
      }}
      onError={() => {
        setTurnstileToken("");
        setTokenFlow("");
      }}
    />
  );

  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  useEffect(() => {
    const settingsRef = doc(db, "publicSettings", "general");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setResortName(DEFAULT_RESORT_NAME);
          return;
        }

        const settings = snapshot.data();

        setResortName(
          typeof settings.resortName === "string" && settings.resortName.trim()
            ? settings.resortName.trim()
            : DEFAULT_RESORT_NAME,
        );
      },
      (error) => {
        console.error("Failed to load resort settings:", error);
        setResortName(DEFAULT_RESORT_NAME);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(authDestination, { replace: true });
    }
  }, [user, authLoading, authDestination, navigate]);

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setResetError("");
    setResetSuccess("");

    const email = resetEmail.trim();

    if (!email) {
      setResetError("Please enter your email address.");
      return;
    }

    if (!turnstileToken || tokenFlow !== verificationFlow) {
      setResetError("Please complete the security verification.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setResetLoading(true);

    try {
      const isVerified = await verifyTurnstile(turnstileToken);

      // The widget and its single-use token are reset in finally.

      if (!isVerified) {
        setResetError("Security verification failed. Please try again.");
        return;
      }

      await sendPasswordResetEmail(auth, email);

      setResetSuccess(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.",
      );
    } catch (error: any) {
      console.error("Password reset error:", error);

      if (error.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else if (error.code === "auth/user-not-found") {
        setResetError("The account is not registered.");
      } else if (error.code === "auth/too-many-requests") {
        setResetError(
          "Too many attempts. Please wait a while before trying again.",
        );
      } else if (error.code === "auth/network-request-failed") {
        setResetError("Network error. Please check your internet connection.");
      } else {
        setResetError(
          "Unable to send the password reset email. Please try again.",
        );
      }
    } finally {
      setResetLoading(false);
      resetVerification();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoginError("");

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    if (!turnstileToken || tokenFlow !== verificationFlow) {
      setLoginError("Please complete the security verification.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const isVerified = await verifyTurnstile(turnstileToken);

      // The widget and its single-use token are reset in finally.

      if (!isVerified) {
        setLoginError(
          "Security verification failed or expired. Please try again.",
        );
        return;
      }

      const success = await login(loginEmail.trim(), loginPassword);

      if (success) {
        navigate(authDestination, { replace: true });
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
    } finally {
      resetVerification();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError("");
    setRegisterError("");

    if (!turnstileToken || tokenFlow !== verificationFlow) {
      setLoginError("Please complete the security verification.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const isVerified = await verifyTurnstile(turnstileToken);

      // The widget and its single-use token are reset in finally.

      if (!isVerified) {
        setLoginError("Security verification failed. Please try again.");
        return;
      }

      const success = await googleLogin();

      if (success) {
        navigate(authDestination, { replace: true });
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
    } finally {
      resetVerification();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setRegisterError("");
    try { normalizePhilippineMobile(form.phone); }
    catch (error) { setRegisterError((error as Error).message); return; }

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

    if (!form.termsAccepted) {
      setRegisterError(
        "Please agree to the Terms of Service and acknowledge the Privacy Policy to create an account.",
      );
      return;
    }

    if (form.password.length < 8) {
      setRegisterError("Password must be at least 8 characters.");
      return;
    }

    const hasSpecialCharacter = Array.from(form.password).some((character) =>
      FIREBASE_PASSWORD_SYMBOLS.includes(character),
    );
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password) || !hasSpecialCharacter) {
      setRegisterError(
        "Password must include an uppercase letter, a number, and a special character such as ! or @.",
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    if (!turnstileToken || tokenFlow !== verificationFlow) {
      setRegisterError("Please complete the security verification.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const isVerified = await verifyTurnstile(turnstileToken);

      // The widget and its single-use token are reset in finally.

      if (!isVerified) {
        setRegisterError(
          "Security verification failed or expired. Please try again.",
        );
        return;
      }

      const success = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });

      if (success) {
        setRegisterError("");

        alert(
          VERIFICATION_MESSAGE,
        );

        setForm({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          termsAccepted: false,
        });

        setTab("login");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === "auth/too-many-requests") {
        setRegisterError("Firebase temporarily limited verification emails. If your account was created, use Resend verification email on the sign-in page after waiting a few minutes.");
        return;
      }

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
        setRegisterError("Password must be at least 8 characters.");
        return;
      }

      setRegisterError(
        error.message || "Registration failed. Please try again.",
      );
    } finally {
      resetVerification();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    setRegisterError("");
    try { normalizePhilippineMobile(form.phone); }
    catch (error) { setRegisterError((error as Error).message); return; }
    if (!form.termsAccepted) {
      setRegisterError("Please agree to the Terms of Service and acknowledge the Privacy Policy to create an account.");
      return;
    }
    if (!form.phone.trim()) {
      setRegisterError("Please enter your phone number.");
      return;
    }

    if (!turnstileToken || tokenFlow !== verificationFlow) {
      setRegisterError("Please complete the security verification.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const isVerified = await verifyTurnstile(turnstileToken);

      // The widget and its single-use token are reset in finally.

      if (!isVerified) {
        setRegisterError("Security verification failed. Please try again.");
        return;
      }

      const success = await googleRegister({
        firstName: "",
        lastName: "",
        phone: form.phone.trim(),
      });

      if (success) {
        navigate(authDestination, { replace: true });
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
    } finally {
      resetVerification();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60";

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://cdn.pixabay.com/video/2025/03/15/265145_large.mp4"
            type="video/mp4"
          />
        </video>

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
              {resortName}
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
              Create your account to access exclusive bookings, manage your
              reservations, and enjoy member benefits at {resortName}.
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
            © {new Date().getFullYear()} {resortName}
          </p>
        </div>
      </div>

      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>

            <span
              className="text-primary font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {resortName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
            className="flex items-center gap-2 mb-6 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-8">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (submittingRef.current) return;
                  resetVerification();
                  setTab(t);
                  setLoginError("");
                  setRegisterError("");
                }}
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
            forgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <h1
                    className="text-foreground mb-1"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.875rem",
                      fontWeight: 700,
                    }}
                  >
                    Forgot Password?
                  </h1>

                  <p className="text-muted-foreground text-sm">
                    Enter the email address associated with your account. We'll
                    send you a link to reset your password.
                  </p>
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {resetError}
                  </div>
                )}

                {resetSuccess && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{resetSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Email address
                  </label>

                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                {verificationWidget}

                <button
                  type="submit"
                  disabled={resetLoading || submitting}
                  className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? "Sending reset link..." : "Send Reset Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (submittingRef.current) return;
                    resetVerification();
                    setForgotPassword(false);
                    setResetError("");
                    setResetSuccess("");
                    setLoginError("");
                    setTurnstileToken("");
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
              </form>
            ) : (
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
                {verificationMessage && <p role="status" className="rounded-xl bg-blue-50 p-3 text-xs text-primary">{verificationMessage}</p>}
                <button type="button" disabled={submitting || resendSeconds > 0}
                  className="text-xs text-primary text-left hover:underline disabled:opacity-50"
                  onClick={async () => {
                    if (submittingRef.current) return;
                    submittingRef.current = true;
                    setSubmitting(true);
                    setResending(true);
                    setVerificationMessage("");
                    try { setVerificationMessage(await resendVerification(loginEmail, loginPassword)); }
                    catch (error: any) { setLoginError(error.code === "auth/too-many-requests" ? "Too many verification requests. Please wait a few minutes and try again." : error.code?.startsWith("auth/") ? "Unable to resend verification. Check your email and password, then try again." : error.message); }
                    finally { submittingRef.current = false; setSubmitting(false); setResending(false); setResendSeconds(verificationCooldown(loginEmail)); }
                  }}>
                  {resending ? "Sending verification email..." : resendSeconds ? `Resend verification email in ${resendSeconds}s` : "Resend verification email"}
                </button>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Email address
                  </label>

                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="sign-in-password" className="block text-xs font-medium text-foreground">
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(loginEmail);
                        setResetError("");
                        setResetSuccess("");
                        if (submittingRef.current) return;
                        resetVerification();
                        setForgotPassword(true);
                        setTurnstileToken("");
                      }}
                      className="text-xs text-primary font-medium hover:text-accent transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="sign-in-password"
                      type={showLoginPwd ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={inputClass + " pr-10"}
                    />

                    <button
                      type="button"
                      aria-label={
                        showLoginPwd ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowLoginPwd((previous) => !previous)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showLoginPwd ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {verificationWidget}

                <button
                  type="submit"
                  disabled={submitting}
                aria-busy={submitting}
                  className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {submitting && !resending ? "Signing in..." : "Sign In"}
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

                <button
                  type="button"
                  disabled={submitting}
                aria-busy={submitting}
                  onClick={handleGoogleLogin}
                  className="w-full border border-border bg-white text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
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
                  {submitting ? "Please wait..." : "Continue with Google"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  No account yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginError("");
                      setRegisterError("");
                      if (submittingRef.current) return;
                      resetVerification();
                      setTab("register");
                    }}
                    className="text-primary font-medium"
                  >
                    Create one
                  </button>
                </p>
              </form>
            )
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
                    autoComplete="given-name"
                    required
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
                    autoComplete="family-name"
                    required
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
                    setForm((f) => ({
                      ...f,
                      email: e.target.value,
                    }))
                  }
                  autoComplete="email"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Phone *
                </label>

                <input
                  type="tel"
                  placeholder="09171234567 or +639171234567"
                  inputMode="tel"
                  maxLength={13}
                  pattern="(09[0-9]{9}|\+639[0-9]{9})"
                  title="Use 09171234567 or +639171234567 without spaces."
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value,
                    }))
                  }
                  autoComplete="tel"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="sign-up-password" className="block text-xs font-medium text-foreground mb-1.5">
                  Password *
                </label>

                <div className="relative">
                  <input
                    id="sign-up-password"
                    aria-describedby="sign-up-password-policy"
                    type={showPwd ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    required
                    className={inputClass + " pr-10"}
                  />

                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    onClick={() => setShowPwd((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPwd ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p id="sign-up-password-policy" className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {PASSWORD_POLICY_HINT}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Confirm password *
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        confirmPassword: e.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    required
                    className={inputClass + " pr-10"}
                  />

                  <button
                    type="button"
                    aria-label={
                      showConfirmPwd ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowConfirmPwd((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showConfirmPwd ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  id="termsAccepted"
                  type="checkbox"
                  aria-labelledby="sign-up-consent"
                  checked={form.termsAccepted}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      termsAccepted: e.target.checked,
                    }));

                    if (e.target.checked) {
                      setRegisterError("");
                    }
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />

                <p id="sign-up-consent" className="min-w-0 text-pretty text-sm leading-5 text-muted-foreground">
                  <label htmlFor="termsAccepted" className="cursor-pointer text-sm font-normal leading-5">
                    I agree to the
                  </label>{" "}
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="cursor-pointer text-sm font-normal leading-5 whitespace-nowrap text-primary underline underline-offset-2 hover:text-accent"
                  >
                    Terms of Service
                  </button>
                  {" "}<label htmlFor="termsAccepted" className="cursor-pointer text-sm font-normal leading-5">
                    and acknowledge the
                  </label>{" "}
                  <PrivacyPolicyDialog />.
                </p>
              </div>

              {verificationWidget}

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {submitting ? "Creating account..." : "Create Account"}
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

              <button
                type="button"
                disabled={submitting}
                aria-busy={submitting}
                onClick={handleGoogleRegister}
                className="w-full border border-border bg-white text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
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
                {submitting ? "Please wait..." : "Continue with Google"}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRegisterError("");
                    if (submittingRef.current) return;
                    resetVerification();
                    setTab("login");
                  }}
                  className="text-primary font-medium hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
