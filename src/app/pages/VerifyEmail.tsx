import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { auth } from "../components/firebase";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const code =
    params.get("oobCode") ||
    new URLSearchParams(window.location.search).get("oobCode") ||
    "";
  const [message, setMessage] = useState(
    "Checking your email verification link...",
  );
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        if (!code)
          throw Object.assign(new Error(), {
            code: "auth/invalid-action-code",
          });
        const info = await checkActionCode(auth, code);
        if (info.operation !== "VERIFY_EMAIL")
          throw Object.assign(new Error(), {
            code: "auth/invalid-action-code",
          });
        await applyActionCode(auth, code);
        if (auth.currentUser) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
        }
        if (active)
          setMessage(
            "Your email address has been verified successfully. Please sign in to access booking features.",
          );
      } catch (error: any) {
        if (active)
          setMessage(
            error.code === "auth/expired-action-code"
              ? "This verification link has expired. Please request a new link on the sign-in page."
              : error.code === "auth/invalid-action-code"
                ? "This verification link is invalid or has already been used. Try signing in, or request a new verification email."
                : "We could not verify your email address. Check your connection and try the link again.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <main className="max-w-lg mx-auto p-6 my-12 bg-white rounded-2xl border border-border">
      <h1
        className="text-2xl font-semibold mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Email Verification
      </h1>
      <p
        role="status"
        aria-busy={loading}
        className="text-sm text-muted-foreground mb-6"
      >
        {message}
      </p>
      <a
        href={`${window.location.pathname}#/auth`}
        className="text-primary underline"
      >
        Back to Sign In
      </a>
    </main>
  );
}
