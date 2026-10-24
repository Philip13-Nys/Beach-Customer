import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import {
  User,
  Phone,
  Mail,
  Lock,
  Camera,
  CheckCircle2,
  LogOut,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { customerDb, auth } from "../components/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type PasswordForm = {
  current: string;
  next: string;
  confirm: string;
};

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/auth", { replace: true });
  }, [user, navigate]);

  if (!user) return null;
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
  const currentUser = auth.currentUser;

  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [tab, setTab] = useState<"info" | "password">("info");

  const [form, setForm] = useState<ProfileForm>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? currentUser?.email ?? "",
    phone: user?.phone ?? "",
  });

  const [avatar, setAvatar] = useState(
    currentUser?.photoURL || user?.avatar || "",
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [pwdForm, setPwdForm] = useState<PasswordForm>({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  
  useEffect(() => {
    setForm({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? currentUser?.email ?? "",
      phone: user?.phone ?? "",
    });
    setAvatar(user?.avatar ?? currentUser?.photoURL ?? "");
  }, [
    user?.firstName,
    user?.lastName,
    user?.email,
    user?.phone,
    user?.avatar,
    currentUser?.email,
    currentUser?.photoURL,
  ]);

  useEffect(() => {
    let active = true;

    const loadBookings = async () => {
      if (!currentUser) {
        if (active) setLoadingBookings(false);
        return;
      }

      try {
        const bookingsRef = collection(customerDb, "Bookings");
        const bookingQuery = query(
          bookingsRef,
          where("userId", "==", currentUser.uid),
        );
        const snapshot = await getDocs(bookingQuery);

        if (!active) return;
        setBookings(
          snapshot.docs.map((bookingDoc) => ({
            id: bookingDoc.id,
            ...bookingDoc.data(),
          })),
        );
      } catch (error) {
        console.error("Error loading customer bookings:", error);
      } finally {
        if (active) setLoadingBookings(false);
      }
    };

    void loadBookings();
    return () => {
      active = false;
    };
  }, [currentUser]);

  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(
    (booking) => booking.status === "pending",
  ).length;
  const completedBookings = bookings.filter(
    (booking) =>
      booking.status === "completed" || booking.status === "confirmed",
  ).length;
  const totalSpent = bookings
    .filter(
      (booking) =>
        booking.paymentStatus === "paid" || booking.status === "completed",
    )
    .reduce((total, booking) => total + Number(booking.totalPrice || 0), 0);

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setProfileError("");

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!firstName || !lastName || !email) {
      setProfileError("First name, last name, and email are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    if (!currentUser) {
      setProfileError("Your session has expired. Please sign in again.");
      return;
    }

    setSaving(true);

    try {
      const updatedProfile: ProfileForm = {
        firstName,
        lastName,
        email,
        phone,
      };

   
      if (email !== (currentUser.email ?? "").toLowerCase()) {
        await updateEmail(currentUser, email);
      }

      const displayName = `${firstName} ${lastName}`.trim();
      await updateFirebaseProfile(currentUser, {
        displayName,
        photoURL: avatar || null,
      });

     
      const userDocRef = doc(customerDb, "Users", currentUser.uid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (userDocSnapshot.exists()) {
        await updateDoc(userDocRef, {
          ...updatedProfile,
          avatar,
          displayName,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const usersQuery = query(
          collection(customerDb, "Users"),
          where("uid", "==", currentUser.uid),
        );
        const userSnapshot = await getDocs(usersQuery);

        if (!userSnapshot.empty) {
          await updateDoc(userSnapshot.docs[0].ref, {
            ...updatedProfile,
            avatar,
            displayName,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            ...updatedProfile,
            avatar,
            displayName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

     
      await Promise.resolve(updateProfile(updatedProfile));
      setForm(updatedProfile);
      setSaved(true);
    } catch (error: any) {
      console.error("Error updating profile:", error);

      if (error?.code === "auth/requires-recent-login") {
        setProfileError(
          "For security, please sign out and sign in again before changing your email address.",
        );
      } else if (error?.code === "auth/email-already-in-use") {
        setProfileError(
          "That email address is already linked to another account.",
        );
      } else if (error?.code === "auth/invalid-email") {
        setProfileError("Please enter a valid email address.");
      } else if (error?.code === "auth/operation-not-allowed") {
        setProfileError(
          "Email changes are not enabled for this Firebase project.",
        );
      } else {
        setProfileError(
          error?.message || "Could not save your profile. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPwdMsg("");

    if (!currentUser || !currentUser.email) {
      setPwdMsg("Your session is unavailable. Please sign in again.");
      return;
    }

    if (!pwdForm.current) {
      setPwdMsg("Enter your current password.");
      return;
    }
    if (pwdForm.next.length < 8) {
      setPwdMsg("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(pwdForm.next) || !/[0-9]/.test(pwdForm.next)) {
      setPwdMsg(
        "New password must contain at least one letter and one number.",
      );
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdMsg("The new passwords do not match.");
      return;
    }
    if (pwdForm.current === pwdForm.next) {
      setPwdMsg(
        "Your new password must be different from your current password.",
      );
      return;
    }

    setPwdLoading(true);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        pwdForm.current,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, pwdForm.next);

      setPwdMsg("success");
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch (error: any) {
      console.error("Error changing password:", error);

      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/wrong-password"
      ) {
        setPwdMsg("Your current password is incorrect.");
      } else if (error?.code === "auth/requires-recent-login") {
        setPwdMsg(
          "Please sign out and sign in again, then try changing your password.",
        );
      } else if (error?.code === "auth/weak-password") {
        setPwdMsg("Choose a stronger password (at least 8 characters).");
      } else {
        setPwdMsg(error?.message || "Could not update your password.");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleAvatarSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const file = input.files?.[0];


    input.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Please choose an image smaller than 5 MB.");
      return;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      setProfileError(
        "Cloudinary is not configured. Please check your .env file.",
      );
      return;
    }

    if (!currentUser) {
      setProfileError("Please sign in again.");
      return;
    }

    setUploadingAvatar(true);
    setProfileError("");
    setSaved(false);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "resort-profile-images");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        throw new Error(
          result.error?.message || "Cloudinary image upload failed.",
        );
      }

      const imageUrl = result.secure_url;

     
      setAvatar(imageUrl);

     
      await updateFirebaseProfile(currentUser, {
        photoURL: imageUrl,
      });

      
      const userDocRef = doc(customerDb, "Users", currentUser.uid);

      const userDocSnapshot = await getDoc(userDocRef);

      if (userDocSnapshot.exists()) {
        await updateDoc(userDocRef, {
          avatar: imageUrl,
          photoURL: imageUrl,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const usersQuery = query(
          collection(customerDb, "Users"),
          where("uid", "==", currentUser.uid),
        );

        const userSnapshot = await getDocs(usersQuery);

        if (!userSnapshot.empty) {
          await updateDoc(userSnapshot.docs[0].ref, {
            avatar: imageUrl,
            photoURL: imageUrl,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await setDoc(userDocRef, {
            uid: currentUser.uid,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            avatar: imageUrl,
            photoURL: imageUrl,
            displayName: `${form.firstName} ${form.lastName}`.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      
      await Promise.resolve(
        updateProfile({
          ...form,
          avatar: imageUrl,
        }),
      );

      setSaved(true);
    } catch (error: any) {
      console.error("Profile image upload error:", error);

      setProfileError(
        error?.message || "Could not upload your profile picture.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const memberSince = user?.memberSince || "—";
  const avatarSrc =
    avatar ||
    currentUser?.photoURL ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${form.firstName} ${form.lastName}`.trim() || "Guest",
    )}&background=E8EEF5&color=0A2540`;

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
  
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-border text-center">
            <div className="relative inline-block mb-4">
              <img
                src={avatarSrc}
                alt={`${form.firstName} ${form.lastName}`}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-secondary"
              />
              <label
                htmlFor="profile-avatar"
                title={
                  uploadingAvatar
                    ? "Uploading profile picture"
                    : "Choose profile picture"
                }
                className={`absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-md hover:bg-accent/90 transition-colors ${
                  uploadingAvatar ? "cursor-wait opacity-70" : "cursor-pointer"
                }`}
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
                disabled={uploadingAvatar}
              />
            </div>
            {uploadingAvatar && (
              <p className="text-xs text-muted-foreground mb-2">
                Uploading picture to Cloudinary...
              </p>
            )}
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {form.firstName} {form.lastName}
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">{form.email}</p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Member since {memberSince}
            </div>

            <div className="mt-6 space-y-2">
              {[
                { label: "Personal Info", value: "info" as const },
                { label: "Change Password", value: "password" as const },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setTab(item.value);
                    setProfileError("");
                    setPwdMsg("");
                  }}
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
                type="button"
                onClick={async () => {
                  await logout();
                  navigate("/", { replace: true });
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>

       
        <div className="lg:col-span-2">
        
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-xs text-muted-foreground">
                Total Bookings
              </div>
              <div className="text-2xl font-bold text-primary mt-1">
                {loadingBookings ? "..." : totalBookings}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-2xl font-bold text-accent mt-1">
                {loadingBookings ? "..." : pendingBookings}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {loadingBookings ? "..." : completedBookings}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Total Spent</div>
              <div className="text-xl font-bold text-primary mt-1">
                {loadingBookings ? "..." : `₱${totalSpent.toLocaleString()}`}
              </div>
            </div>
          </div>

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

              {profileError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {saved && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm mb-5">
                  <CheckCircle2 className="w-4 h-4" />
                  Profile updated successfully!
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        firstName: event.target.value,
                      }))
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
                    required
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        lastName: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        phone: event.target.value,
                      }))
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
                      {memberSince}
                    </div>
                  </div>
                  <div className="bg-muted rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">
                      Account Status
                    </div>
                    <div className="font-medium text-green-600 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  disabled={saving || uploadingAvatar}
                  className="bg-primary text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handlePasswordChange}
              className="bg-white rounded-2xl p-6 border border-border"
            >
              <h2
                className="font-semibold text-foreground mb-5 flex items-center gap-2"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                }}
              >
                <Lock className="w-5 h-5 text-primary" />
                Change Password
              </h2>

              {pwdMsg === "success" ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm mb-5">
                  <CheckCircle2 className="w-4 h-4" />
                  Password changed successfully!
                </div>
              ) : pwdMsg ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-5">
                  {pwdMsg}
                </div>
              ) : null}

              <div className="space-y-4">
                {[
                  { label: "Current Password", key: "current" as const },
                  { label: "New Password", key: "next" as const },
                  { label: "Confirm New Password", key: "confirm" as const },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete={
                        field.key === "current"
                          ? "current-password"
                          : "new-password"
                      }
                      value={pwdForm[field.key]}
                      onChange={(event) =>
                        setPwdForm((previous) => ({
                          ...previous,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-secondary rounded-xl text-xs text-primary">
                Password must be at least 8 characters long and contain at least
                one letter and one number.
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="bg-primary text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {pwdLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
