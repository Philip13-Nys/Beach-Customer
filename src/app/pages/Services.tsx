import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { auth, customerDb, db } from "../components/firebase";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  Clock,
  Users,
  Star,
  ChevronRight,
  X,
  Calendar,
  CheckCircle2,
  Package as PackageIcon,
} from "lucide-react";

type ActivityItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: string;
  price: number;
  maxParticipants: number;
  available: boolean;
  image: string;
  difficulty?: string;
  schedule: string[];
  itemType: "service" | "package";
};

const CATEGORIES = ["All", "Diving", "Water Activities", "Tour"] as const;
type Category = (typeof CATEGORIES)[number];

const DEFAULT_TIME_SLOTS = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
];

const catMap: Record<Category, string[]> = {
  All: [
    "diving",
    "snorkeling",
    "water-activities",
    "water-sports",
    "tours",
    "tour",
    "island",
  ],
  Diving: ["diving", "snorkeling"],
  "Water Activities": ["water-activities", "water-sports"],
  Tour: ["tours", "tour", "island"],
};

const normalizeCategory = (category: string) =>
  category
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const difficultyColor: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  "Beginner – Advanced": "bg-blue-100 text-blue-700",
  Advanced: "bg-red-100 text-red-600",
  Easy: "bg-green-100 text-green-700",
  "All levels": "bg-gray-100 text-gray-600",
};

function getSchedule(data: Record<string, any>): string[] {
  const raw =
    data.schedule ??
    data.timeSlots ??
    data.availableTimes ??
    data.availableTimeSlots;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((slot: any) => {
      if (typeof slot === "string") return slot.trim();

      if (slot && typeof slot === "object") {
        return String(slot.time ?? slot.label ?? slot.startTime ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function mapActivity(
  id: string,
  data: Record<string, any>,
  itemType: "service" | "package",
): ActivityItem {
  const status =
    typeof data.status === "string" ? data.status.toLowerCase() : "";

  const rawPrice =
    data.price ??
    data.basePrice ??
    data.packagePrice ??
    data.totalPrice ??
    data.amount ??
    data.rate ??
    0;

  const parsedPrice =
    typeof rawPrice === "number"
      ? rawPrice
      : Number(String(rawPrice).replace(/[₱,\s]/g, ""));

  return {
    id,
    name: data.name || data.packageName || data.title || "",
    category: data.category || "",
    description: data.description || "",
    duration: data.duration || "",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    maxParticipants: Math.max(
      1,
      Number(data.maxParticipants ?? data.maxGuests ?? data.capacity ?? 1),
    ),
    available: status
      ? ["active", "available"].includes(status)
      : data.available !== false && data.isAvailable !== false,
    image: itemType === "service" ? data.image || data.imageUrl || "" : "",
    difficulty: data.difficulty || "",
    schedule: getSchedule(data),
    itemType,
  };
}

export default function Services() {
  const [cat, setCat] = useState<Category>("All");
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [services, setServices] = useState<ActivityItem[]>([]);
  const [packages, setPackages] = useState<ActivityItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [participants, setParticipants] = useState(1);
  const [booked, setBooked] = useState(false);

  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [savedBookingRef, setSavedBookingRef] = useState("");

  const { user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      setLoadingServices(true);
      setLoadError("");

      try {
        const [serviceSnapshot, packageSnapshot] = await Promise.all([
          getDocs(collection(db, "services")),
          getDocs(collection(db, "packages")),
        ]);

        if (cancelled) return;

        setServices(
          serviceSnapshot.docs.map((doc) =>
            mapActivity(doc.id, doc.data(), "service"),
          ),
        );

        setPackages(
          packageSnapshot.docs.map((doc) =>
            mapActivity(doc.id, doc.data(), "package"),
          ),
        );
      } catch (error) {
        console.error("Error loading services and packages:", error);

        if (!cancelled) {
          setLoadError(
            "Unable to load activities. Check your Firebase connection and collection permissions.",
          );
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, []);

  const matchesCategory = (item: ActivityItem) => {
    if (cat === "All") return true;

    return catMap[cat].includes(normalizeCategory(item.category));
  };

  const filteredServices = services.filter(matchesCategory);
  const filteredPackages = packages.filter(matchesCategory);

  const closeBooking = () => {
    setSelected(null);
    setBooked(false);
    setBookingDate("");
    setBookingTime("");
    setParticipants(1);
    setSavingBooking(false);
    setBookingError("");
    setSavedBookingRef("");
  };

  const handleBook = async () => {
    if (savingBooking) return;

    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || (user as any)?.uid;

    if (!userId) {
      navigate("/auth");
      return;
    }

    if (!selected || !bookingDate || !bookingTime) {
      setBookingError("Please select a date and time.");
      return;
    }

    if (participants < 1 || participants > selected.maxParticipants) {
      setBookingError("Please enter a valid number of participants.");
      return;
    }

    if (bookingDate < getLocalDateString()) {
      setBookingError("Please select today or a future date.");
      return;
    }

    setSavingBooking(true);
    setBookingError("");

    try {
      const customerName =
        currentUser?.displayName ||
        (user as any)?.displayName ||
        (user as any)?.name ||
        currentUser?.email ||
        (user as any)?.email ||
        "Customer";

      const email = currentUser?.email || (user as any)?.email || "";

      const bookingRef = `ACT-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`;

      const totalPrice = selected.price * participants;

      const bookingData = {
        bookingRef,

        userId,
        customerName,
        email,
        phone: (user as any)?.phone || currentUser?.phoneNumber || "",

        bookingType: selected.itemType,
        itemType: selected.itemType,
        itemId: selected.id,
        itemName: selected.name,
        serviceId: selected.itemType === "service" ? selected.id : null,
        packageId: selected.itemType === "package" ? selected.id : null,
        serviceName: selected.itemType === "service" ? selected.name : null,
        packageName: selected.itemType === "package" ? selected.name : null,

        bookingDate,
        bookingTime,
        checkIn: bookingDate,
        checkOut: bookingDate,
        guests: participants,
        participants,
        nights: 0,
        duration: selected.duration || "",

        pricePerPerson: selected.price,
        totalPrice,
        amountPaid: 0,
        remainingBalance: totalPrice,
        paymentStatus: "unpaid",

        addOns: [],
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(customerDb, "Bookings"), bookingData);

      setSavedBookingRef(bookingRef);
      setBooked(true);
    } catch (error) {
      console.error("Error saving activity booking:", error);
      setBookingError(
        "Your booking could not be saved. Please check your connection and try again.",
      );
    } finally {
      setSavingBooking(false);
    }
  };

  const renderActivityCard = (item: ActivityItem) => (
    <div
      key={`${item.itemType}-${item.id}`}
      className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 group"
    >
      <div
        className={`relative overflow-hidden ${
          item.itemType === "package" ? "h-24" : "h-48"
        }`}
      >
        {item.itemType === "service" && item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : item.itemType === "package" ? (
          <div className="w-full h-full bg-gradient-to-r from-amber-50 to-orange-100 flex items-center justify-center">
            <PackageIcon className="w-10 h-10 text-amber-600" />
          </div>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No Image Available
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <span className="px-2.5 py-1 bg-white/95 rounded-full text-[10px] font-medium text-primary capitalize">
            {item.category.replace(/-/g, " ") || item.itemType}
          </span>

          {item.itemType === "package" && (
            <span className="px-2.5 py-1 bg-amber-100 rounded-full text-[10px] font-medium text-amber-800 flex items-center gap-1">
              <PackageIcon className="w-3 h-3" />
              Package
            </span>
          )}

          {item.difficulty && (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                difficultyColor[item.difficulty] || "bg-gray-100 text-gray-600"
              }`}
            >
              {item.difficulty}
            </span>
          )}
        </div>

        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-medium text-sm bg-black/60 px-3 py-1 rounded-full">
              Unavailable
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3
          className="font-semibold text-foreground mb-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.1rem",
          }}
        >
          {item.name}
        </h3>

        <p className="text-muted-foreground text-xs leading-relaxed mb-3 line-clamp-2">
          {item.description || "Discover this resort experience."}
        </p>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {item.duration || "Duration not set"}
          </span>

          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Max {item.maxParticipants}
          </span>

          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            4.8
          </span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <span className="text-accent font-bold text-xl">
              ₱{item.price.toLocaleString("en-PH")}
            </span>
            <span className="text-muted-foreground text-xs">/person</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (item.available) {
                setSelected(item);
                setBookingDate("");
                setBookingTime("");
                setParticipants(1);
                setBooked(false);
              }
            }}
            disabled={!item.available}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
              item.available
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Book
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="relative rounded-3xl overflow-hidden h-56 mb-10">
        <img
          src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&h=500&fit=crop&auto=format"
          alt="Activities"
          className="w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
            Island Experiences
          </p>

          <h1
            className="text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.5rem",
              fontWeight: 700,
            }}
          >
            Activities &amp; Services
          </h1>

          <p className="text-white/80 text-sm mt-2 max-w-md">
            Dive, snorkel, explore, relax — discover activities and packages for
            your perfect island itinerary.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-8">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCat(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              cat === category
                ? "bg-primary text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {loadingServices ? (
        <div className="py-16 text-center text-muted-foreground">
          Loading services and packages...
        </div>
      ) : loadError ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Check that both services and packages exist in the Firebase project
            connected to this page.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Activities &amp; Services
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Explore our individual resort experiences.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredServices.length} items
              </span>
            </div>

            {filteredServices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No services found in this category.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServices.map(renderActivityCard)}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Resort Packages
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Discover our available packages and bundled experiences.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredPackages.length} packages
              </span>
            </div>

            {filteredPackages.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-border rounded-2xl">
                <PackageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  No packages found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add packages to your Firestore packages collection to display
                  them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPackages.map(renderActivityCard)}
              </div>
            )}
          </section>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="relative h-32">
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-300" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />

              <button
                type="button"
                onClick={closeBooking}
                className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center"
                aria-label="Close booking modal"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <div className="absolute bottom-3 left-4">
                <h2 className="text-white font-semibold">{selected.name}</h2>
                <p className="text-white/80 text-xs">
                  {selected.itemType === "package" ? "Package" : "Activity"} · ₱
                  {selected.price.toLocaleString("en-PH")} per person
                </p>
              </div>
            </div>

            {booked ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />

                <h3 className="font-semibold text-foreground mb-1">
                  Booking Request Submitted!
                </h3>

                <p className="text-sm text-muted-foreground mb-4">
                  Your {selected.itemType} booking has been saved successfully.
                  The receptionist can now view your booking request.
                </p>

                <div className="bg-secondary rounded-xl p-4 text-left space-y-2 text-sm mb-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-semibold break-all">
                      {savedBookingRef}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Activity</span>
                    <span className="font-medium text-right">
                      {selected.name}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Date</span>
                    <span>{bookingDate}</span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Time</span>
                    <span>{bookingTime}</span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Participants</span>
                    <span>{participants}</span>
                  </div>

                  <div className="flex justify-between gap-3 border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-accent">
                      ₱{(selected.price * participants).toLocaleString("en-PH")}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground pt-1">
                    Payment status: Unpaid · Booking status: Pending
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    closeBooking();
                    navigate("/booking-history");
                  }}
                  className="w-full bg-accent text-white py-2.5 rounded-xl text-sm font-medium"
                >
                  View Booking History
                </button>

                <button
                  type="button"
                  onClick={closeBooking}
                  className="mt-2 w-full border border-border py-2.5 rounded-xl text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="p-5">
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Preferred Date
                    </label>

                    <input
                      type="date"
                      value={bookingDate}
                      min={getLocalDateString()}
                      onChange={(e) => {
                        setBookingDate(e.target.value);
                        setBookingTime("");
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Time Slot
                    </label>

                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      disabled={!bookingDate}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!bookingDate ? "Choose a date first" : "Select a time"}
                      </option>

                      {(selected.schedule.length > 0
                        ? selected.schedule
                        : DEFAULT_TIME_SLOTS
                      ).map((time, index) => (
                        <option key={`${time}-${index}`} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Participants (max {selected.maxParticipants})
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={selected.maxParticipants}
                      value={participants}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setParticipants(
                          Math.min(
                            selected.maxParticipants,
                            Math.max(1, value || 1),
                          ),
                        );
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm font-semibold text-foreground mb-4 p-3 bg-secondary rounded-xl">
                  <span>Total</span>
                  <span className="text-accent">
                    ₱{(selected.price * participants).toLocaleString("en-PH")}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeBooking}
                    className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={
                      !bookingDate ||
                      !bookingTime ||
                      participants < 1 ||
                      participants > selected.maxParticipants
                    }
                    className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
