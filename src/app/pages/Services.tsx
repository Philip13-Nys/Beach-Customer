import { useActivityAvailability } from "../../hooks/useActivityAvailability";
import ActivitySchedulePicker from "../components/ActivitySchedulePicker";
import PackageBookingFields from "../components/PackageBookingFields";
import {
  activityCapacityLabel,
  activityPolicy,
  activitySession,
  activitySlots,
  activityTimeLabel,
  type ActivityRecord,
} from "../utils/activityAvailability";
import { useActivityReviews } from "../../hooks/useActivityReviews";
import { activityRating } from "../utils/bookingPresentation";
import { ActivityRating } from "../components/ActivityRating";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useState, useEffect } from "react";
import BookingPayment, {
  emptyManualPayment,
  validManualPayment,
} from "../components/BookingPayment";
import { requestKey, submitBookingRequest } from "../services/bookingRequests";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { auth } from "../components/firebase";
import {
  Clock,
  Users,
  ChevronRight,
  X,
  Calendar,
  CheckCircle2,
  Package as PackageIcon,
} from "lucide-react";

type ActivityItem = ActivityRecord & {
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
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

function mapActivity(
  id: string,
  data: Record<string, any>,
  itemType: "service" | "package",
): ActivityItem {
  const status =
    typeof data.status === "string" ? data.status.toLowerCase() : "";

  const rawPrice =
    (itemType === "package" ? data.packagePrice : undefined) ??
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
    ...data,
    id,
    name: data.name || data.packageName || data.title || "",
    category: data.category || "",
    description: data.description || "",
    duration:
      itemType === "package"
        ? ""
        : activityPolicy(data)
          ? `${activityPolicy(data)!.durationMinutes} minutes`
          : data.duration || "",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    maxParticipants: Math.max(
      1,
      itemType === "package"
        ? 100
        : Number(
            activityPolicy(data)?.capacityType === "units"
              ? Math.min(
                  100,
                  activityPolicy(data)!.capacity *
                    activityPolicy(data)!.participantsPerUnit!,
                )
              : (activityPolicy(data)?.capacity ??
                  data.maxParticipants ??
                  data.maxGuests ??
                  data.capacity ??
                  1),
          ),
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
  const bookingAction = useAsyncAction();
  const activityReviews = useActivityReviews();

  const [cat, setCat] = useState<Category>("All");
  const inventory = useActivityAvailability();
  const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState(getLocalDateString);
  const liveSelected = selectedItem
    ? inventory.catalog.find(
        (item) =>
          item.id === selectedItem.id &&
          item.itemType === selectedItem.itemType,
      )
    : null;
  const selected = liveSelected
    ? mapActivity(liveSelected.id, liveSelected, liveSelected.itemType)
    : selectedItem
      ? { ...selectedItem, available: false }
      : null;
  const [services, setServices] = useState<ActivityItem[]>([]);
  const [packages, setPackages] = useState<ActivityItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [manualPayment, setManualPayment] = useState(emptyManualPayment);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [participants, setParticipants] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [booked, setBooked] = useState(false);

  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [savedBookingRef, setSavedBookingRef] = useState("");

  const requestedQuantity =
    selected?.itemType === "service" &&
    activityPolicy(selected)?.capacityType === "units"
      ? quantity
      : participants;
  const invalidUnitQuantity =
    selected?.itemType === "service" &&
    activityPolicy(selected)?.capacityType === "units" &&
    (!Number.isInteger(quantity) ||
      quantity < 1 ||
      participants > quantity * activityPolicy(selected)!.participantsPerUnit!);
  const { user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    setServices(
      inventory.catalog
        .filter((item) => item.itemType === "service")
        .map((item) => mapActivity(item.id, item, "service")),
    );
    setPackages(
      inventory.catalog
        .filter((item) => item.itemType === "package")
        .map((item) => mapActivity(item.id, item, "package")),
    );
    setLoadingServices(inventory.loading);
    setLoadError(inventory.error);
  }, [inventory.catalog, inventory.loading, inventory.error]);

  const matchesCategory = (item: ActivityItem) => {
    if (cat === "All") return true;

    return catMap[cat].includes(normalizeCategory(item.category));
  };

  const filteredServices = services.filter(matchesCategory);
  const filteredPackages = packages.filter(matchesCategory);

  const closeBooking = () => {
    if (bookingAction.pending) return;
    setSelectedItem(null);
    setBooked(false);
    setBookingDate("");
    setBookingTime("");
    setParticipants(1);
    setQuantity(1);
    setSavingBooking(false);
    setBookingError("");
    setSavedBookingRef("");
    setManualPayment(emptyManualPayment());
  };

  const performBook = async () => {
    if (savingBooking) return;

    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || (user as any)?.uid;

    if (!userId) {
      navigate("/auth");
      return;
    }

    if (
      !selected ||
      !bookingDate ||
      (selected.itemType === "service" && !bookingTime)
    ) {
      setBookingError(
        "Please select a booking date and, for services, a session.",
      );
      return;
    }

    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > selected.maxParticipants
    ) {
      setBookingError("Please enter a valid number of participants.");
      return;
    }

    if (bookingDate < getLocalDateString()) {
      setBookingError("Please select today or a future date.");
      return;
    }

    if (!validManualPayment(manualPayment, selected.price * participants)) {
      setBookingError("Please provide your down payment reference number.");
      return;
    }
    const availability =
      selected.itemType === "service"
        ? activitySession(
            selected,
            bookingDate,
            bookingTime,
            inventory.catalog,
            inventory.occupied,
          )
        : null;
    if (
      !selected.available ||
      inventory.loading ||
      inventory.error ||
      (availability &&
        (availability.error ||
          availability.remaining < requestedQuantity ||
          invalidUnitQuantity))
    ) {
      setBookingError(
        inventory.error ||
          availability?.error ||
          "This selection is unavailable. Choose another service session or package.",
      );
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

      const totalPrice = selected.price * participants;
      const signature = JSON.stringify([
        selected.itemType,
        selected.id,
        bookingDate,
        bookingTime,
        participants,
        quantity,
        totalPrice,
        manualPayment.reference.trim(),
      ]);
      const requestId = requestKey(userId, signature);
      const bookingRef = "ACT-" + requestId;

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
        itemImage: selected.image || "",
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
        ...(selected.itemType === "service" &&
        activityPolicy(selected)?.capacityType === "units"
          ? { quantity }
          : {}),
        nights: 0,
        duration: selected.duration || "",

        pricePerPerson: selected.price,
        totalPrice,
        amountPaid: 0,
        remainingBalance: totalPrice,

        addOns: [],
      };

      const savedId = await submitBookingRequest(
        requestId,
        bookingData,
        manualPayment,
      );

      setSavedBookingRef(`ACT-${savedId}`);
      setBooked(true);
    } catch (error) {
      console.error("Error saving activity booking:", error);
      setBookingError(
        error instanceof Error
          ? error.message
          : "Your booking could not be saved. Please try again.",
      );
    } finally {
      setSavingBooking(false);
    }
  };

  const handleBook = () => {
    return bookingAction.run(() => performBook());
  };

  const renderActivityCard = (item: ActivityItem) => {
    const isPackage = item.itemType === "package";
    const policy = isPackage ? null : activityPolicy(item);
    const sessions = activitySlots(item, availabilityDate).map((time) => ({
      time,
      ...activitySession(
        item,
        availabilityDate,
        time,
        inventory.catalog,
        inventory.occupied,
      ),
    }));
    const availablePlaces = Math.max(
      0,
      ...sessions.map((session) => session.remaining),
    );
    const canOpenDetails =
      item.available &&
      (isPackage || (Boolean(policy) && availablePlaces > 0)) &&
      !inventory.loading &&
      !inventory.error;
    const upcomingSessions = sessions.filter(
      (session) =>
        Date.parse(`${availabilityDate}T${session.time}:00+08:00`) > Date.now(),
    );
    const availabilityMessage = (() => {
      if (inventory.loading) return "Checking availability...";
      if (inventory.error)
        return "Unable to check availability. Please try again.";
      if (!policy)
        return "Schedule Not Set · Contact the resort for scheduling.";
      if (!item.available || policy.capacity === 0)
        return "Unavailable on the selected date.";
      if (!sessions.length)
        return `No sessions scheduled on ${availabilityDate}. Choose another date.`;
      if (!upcomingSessions.length)
        return availabilityDate === getLocalDateString()
          ? "No remaining sessions today. Choose another date."
          : `All sessions on ${availabilityDate} have passed. Choose another date.`;
      if (availablePlaces === 0)
        return upcomingSessions.every((session) => !session.error)
          ? `Fully booked on ${availabilityDate}. Choose another date.`
          : `No available sessions on ${availabilityDate}. Choose another date.`;
      return `${availablePlaces} of ${policy.capacity} ${activityCapacityLabel(item)} available on ${availabilityDate}`;
    })();
    return (
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
                  difficultyColor[item.difficulty] ||
                  "bg-gray-100 text-gray-600"
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

          <div className="mb-3">
            <ActivityRating
              {...activityRating(item, activityReviews.reviews)}
              loading={activityReviews.loading}
              error={activityReviews.error}
            />
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed mb-3 line-clamp-2">
            {item.description || "Discover this resort experience."}
          </p>

          {!isPackage && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {item.duration || "Duration not set"}
              </span>

              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {policy
                  ? `${policy.capacity} ${activityCapacityLabel(item)} per session`
                  : "Schedule not configured"}
              </span>
            </div>
          )}

          {!isPackage && (
            <p className="mb-3 text-xs text-muted-foreground">
              {policy
                ? `${activityTimeLabel(policy.opensAt)} – ${activityTimeLabel(policy.closesAt)} · `
                : ""}
              {availabilityMessage}
            </p>
          )}
          {policy && !inventory.loading && !inventory.error && (
            <details className="mb-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Session quantities · total, reserved, available
              </summary>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto">
                {sessions.map((session) => (
                  <li key={session.time}>
                    {activityTimeLabel(session.time)} · Total {session.total} ·
                    Reserved {session.reserved} · Processing {session.held} ·{" "}
                    {session.remaining} available
                    {session.error ? ` · ${session.error}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
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
                if (canOpenDetails) {
                  setSelectedItem(item);
                  setBookingDate(availabilityDate);
                  setBookingTime("");
                  setParticipants(1);
                  setQuantity(1);
                  setBooked(false);
                }
              }}
              disabled={!canOpenDetails}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors bg-accent text-white enabled:hover:bg-accent/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              View Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            View activity details, schedules, prices, and available units or
            participant slots before making a reservation.
          </p>
        </div>
      </div>

      <label className="mb-5 flex flex-wrap items-center gap-3 text-sm font-medium">
        Check availability for
        <input
          aria-label="Activity availability date"
          type="date"
          min={getLocalDateString()}
          value={availabilityDate}
          onChange={(event) => setAvailabilityDate(event.target.value)}
          className="rounded-xl border border-border bg-white px-4 py-2"
        />
        <span className="text-xs font-normal text-muted-foreground">
          Philippine time · availability is subject to confirmation
        </span>
      </label>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-booking-title"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
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
                disabled={bookingAction.pending}
                className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center"
                aria-label="Close booking modal"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <div className="absolute bottom-3 left-4">
                <h2
                  id="activity-booking-title"
                  className="text-white font-semibold"
                >
                  {selected.name}
                </h2>
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

                  {selected.itemType === "service" && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Time</span>
                      <span>{activityTimeLabel(bookingTime)}</span>
                    </div>
                  )}

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
                    Payment status: Pending verification · Booking status:
                    Pending payment verification
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
                  disabled={bookingAction.pending}
                  className="mt-2 w-full border border-border py-2.5 rounded-xl text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="p-5">
                <p className="mb-3 text-sm text-muted-foreground">
                  {selected.description}
                </p>
                {selected.itemType === "package" ? (
                  <PackageBookingFields
                    name={selected.name}
                    value={{ bookingDate, bookingTime: "", participants }}
                    onChange={(value) => {
                      setBookingDate(value.bookingDate);
                      setParticipants(value.participants);
                      setBookingError("");
                    }}
                    minDate={getLocalDateString()}
                    disabled={bookingAction.pending}
                  />
                ) : (
                  <ActivitySchedulePicker
                    item={selected}
                    value={{ bookingDate, bookingTime, participants, quantity }}
                    onChange={(value) => {
                      setBookingDate(value.bookingDate);
                      setBookingTime(value.bookingTime);
                      setParticipants(value.participants);
                      setQuantity(value.quantity || 1);
                      setBookingError("");
                    }}
                    catalog={inventory.catalog}
                    occupied={inventory.occupied}
                    loading={inventory.loading}
                    error={inventory.error}
                    minDate={getLocalDateString()}
                    disabled={bookingAction.pending}
                  />
                )}

                <div className="flex justify-between text-sm font-semibold text-foreground mb-4 p-3 bg-secondary rounded-xl">
                  <span>Total</span>
                  <span className="text-accent">
                    ₱{(selected.price * participants).toLocaleString("en-PH")}
                  </span>
                </div>

                <BookingPayment
                  total={selected.price * participants}
                  value={manualPayment}
                  onChange={setManualPayment}
                  disabled={bookingAction.pending}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeBooking}
                    disabled={bookingAction.pending}
                    className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleBook}
                    aria-busy={bookingAction.pending}
                    disabled={
                      bookingAction.pending ||
                      inventory.loading ||
                      Boolean(inventory.error) ||
                      (selected.itemType === "service" &&
                        (activitySession(
                          selected,
                          bookingDate,
                          bookingTime,
                          inventory.catalog,
                          inventory.occupied,
                        ).remaining < requestedQuantity ||
                          Boolean(invalidUnitQuantity))) ||
                      !bookingDate ||
                      (selected.itemType === "service" && !bookingTime) ||
                      participants < 1 ||
                      participants > selected.maxParticipants ||
                      !validManualPayment(
                        manualPayment,
                        selected.price * participants,
                      )
                    }
                    className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    {bookingAction.pending
                      ? "Submitting Booking..."
                      : "Submit Booking Request"}
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
