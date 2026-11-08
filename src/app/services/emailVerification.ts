import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { auth } from "../components/firebase";

const COOLDOWN = 60_000;
const attempts = new Map<string, number>();
export function verificationCooldown(email: string): number {
  const key = `verification-sent:${email.trim().toLowerCase()}`;
  let sent = attempts.get(key) || 0;
  try {
    sent = Math.max(sent, Number(localStorage.getItem(key)) || 0);
  } catch {
    /* Storage may be disabled. */
  }
  return Math.max(0, Math.ceil((sent + COOLDOWN - Date.now()) / 1000));
}
export function markVerificationSent(email: string) {
  const key = `verification-sent:${email.trim().toLowerCase()}`;
  attempts.set(key, Date.now());
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* Firebase also throttles delivery. */
  }
}
let resending = false;
let verificationSession: Promise<Auth> | undefined;
function resendSession() {
  verificationSession ??= (async () => {
    // Use the same Firebase project with isolated in-memory authentication.
    // Resending must never sign the main app in or switch its current account.
    const app =
      getApps().find((app) => app.name === "verification-mail") ||
      initializeApp(auth.app.options, "verification-mail");
    const session = getAuth(app);
    await setPersistence(session, inMemoryPersistence);
    return session;
  })().catch((error) => {
    verificationSession = undefined;
    throw error;
  });
  return verificationSession;
}
export async function resendVerification(email: string, password: string) {
  if (resending)
    throw new Error("A verification request is already in progress.");
  const seconds = verificationCooldown(email);
  if (seconds)
    throw new Error(
      `Please wait ${seconds} seconds before requesting another verification email.`,
    );
  if (!email.trim() || !password)
    throw new Error(
      "Enter your email address and password to resend verification.",
    );
  resending = true;
  let temporaryUser: typeof auth.currentUser = null;
  let session: Auth | undefined;
  try {
    session = await resendSession();
    const result = await signInWithEmailAndPassword(
      session,
      email.trim(),
      password,
    );
    temporaryUser = result.user;
    await temporaryUser.reload();
    if (temporaryUser.emailVerified) {
      await temporaryUser.getIdToken(true);
      return "Your email address is verified. You can now sign in and use booking features.";
    }
    // Reserve the cooldown before calling Firebase, including failed/rate-limited attempts.
    markVerificationSent(email);
    await sendEmailVerification(temporaryUser);
    return "A new verification link has been sent. Please check your inbox and spam or junk folder.";
  } finally {
    resending = false;
    if (temporaryUser && session?.currentUser?.uid === temporaryUser.uid)
      await signOut(session);
  }
}

export async function requireVerifiedCustomer() {
  const customer = auth.currentUser;
  if (!customer)
    throw new Error("Please log in before submitting a booking request.");
  await customer.reload();
  if (auth.currentUser?.uid !== customer.uid)
    throw new Error("Your session changed. Please sign in again.");
  if (!customer.emailVerified)
    throw new Error(
      "Please verify your email address before using booking features. You can request another verification email on the sign-in page.",
    );
  await customer.getIdToken(true);
  return customer;
}
