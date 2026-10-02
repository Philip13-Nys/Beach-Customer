import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useApp } from "../context/AppContext";
import {
  ArrowLeft,
  Calendar,
  Users,
  Plus,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { auth, db, customerDb } from "../components/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

type RoomType = {
  id: string;
  name: string;
  count: number;
  amenities: string[];
  maxGuests: number;
  basePrice: number;
  image: string;
};

type SelectedAddOn = {
  id: string;
  type: "service" | "package";
  name: string;
  price: number;
  services: string[];
};

export default function BookingPage() {
  const { id } = useParams();
  const { user, createNotification } = useApp();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [room, setRoom] = useState<RoomType | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingAddOns, setLoadingAddOns] = useState(true);
  const [availableRooms, setAvailableRooms] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [reservationFeePercent, setReservationFeePercent] = useState(5);
  const [arrivalTime, setArrivalTime] = useState("");

  useEffect(() => {
    const loadAddOns = async () => {
      try {
        const [servicesSnap, packagesSnap] = await Promise.all([
          getDocs(collection(db, "services")),
          getDocs(collection(db, "packages")),
        ]);

        const serviceData = servicesSnap.docs
          .map((item) => ({
            id: item.id,
            type: "service",
            ...item.data(),
          }))
          .filter((item: any) => item.status === "active");

        const packageData = packagesSnap.docs
          .map((item) => ({
            id: item.id,
            type: "package",
            ...item.data(),
          }))
          .filter((item: any) => item.status === "active");

        setAddOnServices(serviceData);
        setPackages(packageData);
      } catch (error) {
        console.error("Error loading services and packages:", error);
      } finally {
        setLoadingAddOns(false);
      }
    };

    loadAddOns();
  }, []);

  useEffect(() => {
    const loadReservationFee = async () => {
      try {
        const feeSnap = await getDoc(doc(db, "settings", "reservationFee"));

        if (feeSnap.exists()) {
          const percent = Number(feeSnap.data().percent);

          if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
            setReservationFeePercent(percent);
          }
        }
      } catch (error) {
        console.error("Error loading reservation fee:", error);
      }
    };

    loadReservationFee();
  }, []);

  useEffect(() => {
    const loadRoom = async () => {
      if (!id) {
        setLoadingRoom(false);
        return;
      }

      try {
        console.log("Loading room from ADMIN Firestore:", id);

        const roomRef = doc(db, "roomTypes", id);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
          const data = roomSnap.data();

          const roomData: RoomType = {
            id: roomSnap.id,
            name: data.name || "",
            count: Number(data.count || 0),
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            maxGuests: Number(data.maxGuests || 1),
            basePrice: Number(data.basePrice || 0),
            image: data.image || "",
          };

          setRoom(roomData);
        } else {
          console.error("Room not found in db:", id);
          setRoom(null);
        }
      } catch (error) {
        console.error("Error loading room:", error);
        setRoom(null);
      } finally {
        setLoadingRoom(false);
      }
    };

    loadRoom();
  }, [id]);

  const formatArrivalTime = (time: string) => {
    if (!time) return "Not selected";

    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const checkRoomAvailability = async () => {
    if (!room || !checkIn || !checkOut) {
      return false;
    }

    if (checkOut <= checkIn) {
      setAvailableRooms(0);
      return false;
    }

    setCheckingAvailability(true);

    try {
      const bookingsQuery = query(
        collection(customerDb, "Bookings"),
        where("roomId", "==", room.id),
      );

      const bookingsSnap = await getDocs(bookingsQuery);

      let bookedRooms = 0;

      bookingsSnap.forEach((bookingDoc) => {
        const booking = bookingDoc.data();

        if (booking.status === "cancelled") {
          return;
        }

        const existingCheckIn = new Date(`${booking.checkIn}T00:00:00`);
        const existingCheckOut = new Date(`${booking.checkOut}T00:00:00`);
        const selectedCheckIn = new Date(`${checkIn}T00:00:00`);
        const selectedCheckOut = new Date(`${checkOut}T00:00:00`);

        const overlaps =
          selectedCheckIn < existingCheckOut &&
          selectedCheckOut > existingCheckIn;

        if (overlaps) {
          bookedRooms++;
        }
      });

      const remainingRooms = Math.max(0, room.count - bookedRooms);

      setAvailableRooms(remainingRooms);

      return remainingRooms > 0;
    } catch (error) {
      console.error("Availability check failed:", error);
      alert("Unable to check room availability.");
      return false;
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (!room) return;

    void checkRoomAvailability();
  }, [room, checkIn, checkOut]);

  useEffect(() => {
    if (!loadingRoom && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loadingRoom, navigate]);

  if (loadingRoom) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-muted-foreground">Loading room...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!room) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Room not found.{" "}
        <Link to="/rooms" className="text-primary">
          Back to rooms
        </Link>
      </div>
    );
  }

  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
    ),
  );

  const addOns: SelectedAddOn[] = selectedAddOns
    .map((selectedId): SelectedAddOn | null => {
      if (selectedId.startsWith("package-")) {
        const packageId = selectedId.replace("package-", "");
        const pkg = packages.find((p) => p.id === packageId);

        if (!pkg) return null;

        return {
          id: pkg.id,
          type: "package",
          name: pkg.name,
          price: Number(pkg.packagePrice || 0),
          services: Array.isArray(pkg.services) ? pkg.services : [],
        };
      }

      const svc = addOnServices.find((s) => s.id === selectedId);

      if (!svc) return null;

      return {
        id: svc.id,
        type: "service",
        name: svc.name,
        price: Number(svc.price || 0),
        services: [],
      };
    })
    .filter((item): item is SelectedAddOn => item !== null);

  const addOnTotal = addOns.reduce((sum, item) => sum + item.price, 0);
  const roomTotal = room.basePrice * nights;
  const subtotal = roomTotal + addOnTotal;
  const reservationFee = Math.round(subtotal * (reservationFeePercent / 100));
  const total = subtotal + reservationFee;

  const toggleAddOn = (addonId: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addonId)
        ? prev.filter((item) => item !== addonId)
        : [...prev, addonId],
    );
  };

  const handleConfirm = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Please log in first.");
      return;
    }

    if (!arrivalTime) {
      alert("Please select your estimated time of arrival.");
      return;
    }

    const checkInDate = new Date(`${checkIn}T00:00:00`);
    const checkOutDate = new Date(`${checkOut}T00:00:00`);

    if (checkOutDate <= checkInDate) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    if (guests < 1 || guests > room.maxGuests) {
      alert(`This room allows a maximum of ${room.maxGuests} guests.`);
      return;
    }

    const stillAvailable = await checkRoomAvailability();

    if (!stillAvailable) {
      alert("Sorry, this room is no longer available for the selected dates.");
      setStep("form");
      return;
    }

    try {
      console.log("Starting booking...");

      const userRef = doc(customerDb, "Users", currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("Your user profile was not found in the database.");
        return;
      }

      const userData = userSnap.data();
      const customerName = `${userData.firstName || ""} ${
        userData.lastName || ""
      }`.trim();
      const customerEmail = userData.email || currentUser.email || "";
      const customerPhone = userData.phone || "";

      const bookingData = {
        userId: currentUser.uid,
        customerName,
        customerEmail,
        customerPhone,
        roomId: room.id,
        roomName: room.name,
        roomImage: room.image,
        checkIn,
        checkOut,
        arrivalTime,
        guests,
        nights,
        roomRate: room.basePrice,
        addOns,
        subtotal,
        reservationFeePercent,
        reservationFee,
        totalPrice: total,
        status: "pending",
        paymentStatus: "unpaid",
        bookingRef:
          "CBR-" +
          new Date().getFullYear() +
          "-" +
          Math.floor(Math.random() * 900 + 100),
        specialRequests,
        createdAt: serverTimestamp(),
      };

      // Save the customer's booking first.
      const bookingDocRef = await addDoc(
        collection(customerDb, "Bookings"),
        bookingData,
      );

      console.log("Customer booking created:", bookingDocRef.id);

      // Create the notification only after the booking is saved.
      // Notification failure must not undo the successful booking.
      try {
        await createNotification({
          eventId: `booking-created-${bookingDocRef.id}`,
          type: "booking",
          title: "Booking submitted",
          message: `Your reservation for ${room.name} (${checkIn} – ${checkOut}) has been submitted. Ref: ${bookingData.bookingRef}`,
          targetPath: "/booking-history",
        });

        console.log("Booking notification created successfully.");
      } catch (notificationError) {
        console.error("Booking notification failed:", notificationError);
      }

      // Save the corresponding reservation in the admin database.
      const reservationData = {
        bookingId: bookingDocRef.id,
        roomTypeId: room.id,
        roomName: room.name,
        checkIn,
        checkOut,
        arrivalTime,
        guests,
        customerName,
        customerEmail,
        status: "reserved",
        createdAt: serverTimestamp(),
      };

      try {
        const reservationRef = await addDoc(
          collection(db, "reservations"),
          reservationData,
        );

        console.log("Admin reservation created:", reservationRef.id);
      } catch (reservationError) {
        console.error("Admin reservation creation failed:", reservationError);

        alert(
          "Your customer booking was saved, but the admin reservation could not be created. Please contact the resort.",
        );
      }

      navigate(`/booking-confirmation/${bookingDocRef.id}`);
    } catch (error: any) {
      console.error("BOOKING ERROR:", error);

      alert(`Booking failed: ${error.message || "Unknown error"}`);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  if (step === "confirm") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1
          className="text-foreground mb-6"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.875rem",
            fontWeight: 700,
          }}
        >
          Review Your Booking
        </h1>

        <div className="bg-white rounded-2xl border border-border overflow-hidden mb-6">
          <div className="flex gap-4 p-5 border-b border-border">
            <img
              src={room.image}
              alt={room.name}
              className="w-24 h-18 rounded-xl object-cover flex-shrink-0"
              style={{ height: 72 }}
            />
            <div>
              <h2
                className="font-semibold text-foreground"
                style={{
                  fontFamily: "var(--font-display)",
                }}
              >
                {room.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Up to {room.maxGuests} guests
              </p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-2 gap-4 text-sm border-b border-border">
            <div>
              <div className="text-xs text-muted-foreground">Check-in</div>
              <div className="font-medium">{checkIn}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Check-out</div>
              <div className="font-medium">{checkOut}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                Estimated Arrival
              </div>
              <div className="font-medium">
                {formatArrivalTime(arrivalTime)}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Guests</div>
              <div className="font-medium">
                {guests} guest{guests > 1 ? "s" : ""}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="font-medium">
                {nights} night{nights > 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {addOns.length > 0 && (
            <div className="p-5 border-b border-border">
              <div className="text-xs text-muted-foreground mb-2">
                Add-on Activities & Packages
              </div>

              {addOns.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex justify-between text-sm py-1"
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    ₱{item.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Room × {nights} nights
              </span>
              <span>₱{roomTotal.toLocaleString()}</span>
            </div>

            {addOnTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activities</span>
                <span>₱{addOnTotal.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Reservation fee ({reservationFeePercent}%)
              </span>
              <span>₱{reservationFee.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-accent">₱{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep("form")}
            className="flex-1 border border-border text-foreground py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit Details
          </button>

          <button
            onClick={handleConfirm}
            className="flex-1 bg-accent text-white py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Confirm Booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        to={`/rooms/${room.id}`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to room details
      </Link>

      <h1
        className="text-foreground mb-2"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          fontWeight: 700,
        }}
      >
        Book Your Stay
      </h1>

      <p className="text-muted-foreground text-sm mb-8">{room.name}</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-border p-5 sm:p-6">
            <h2
              className="font-semibold text-foreground mb-5 flex items-center gap-2"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              <Calendar className="w-4 h-4 text-primary" />
              Stay Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Check-in *
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    const newCheckIn = e.target.value;
                    setCheckIn(newCheckIn);

                    if (newCheckIn >= checkOut) {
                      const nextDay = new Date(`${newCheckIn}T00:00:00`);
                      nextDay.setDate(nextDay.getDate() + 1);
                      setCheckOut(nextDay.toISOString().split("T")[0]);
                    }
                  }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Check-out *
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-foreground mb-2">
                Estimated Time of Arrival *
              </label>
              <input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                required
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Select the approximate time you expect to arrive at the resort.
              </p>
            </div>

            <div className="mt-5">
              {checkingAvailability ? (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-sm text-gray-600">
                    Checking room availability...
                  </p>
                </div>
              ) : availableRooms > 0 ? (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-700">
                    {availableRooms} room
                    {availableRooms !== 1 ? "s" : ""} available for these dates.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-700">
                    No rooms available for these dates.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-3">
                <span className="inline-flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Number of Guests
                </span>
              </label>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Guests</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum {room.maxGuests} guests
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    disabled={guests <= 1}
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease guests"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <span className="w-6 text-center font-semibold text-foreground">
                    {guests}
                  </span>

                  <button
                    type="button"
                    disabled={guests >= room.maxGuests}
                    onClick={() =>
                      setGuests((g) => Math.min(room.maxGuests, g + 1))
                    }
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase guests"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <h2
              className="font-semibold text-foreground mb-1"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Add Activities & Packages (Optional)
            </h2>

            <p className="text-xs text-muted-foreground mb-5">
              Enhance your stay with curated island experiences and special
              packages.
            </p>

            {loadingAddOns ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Loading activities and packages...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {addOnServices.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Activities & Services
                    </h3>

                    <div className="space-y-3">
                      {addOnServices.map((svc) => (
                        <label
                          key={svc.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAddOns.includes(svc.id)}
                            onChange={() => toggleAddOn(svc.id)}
                            className="w-4 h-4 accent-primary rounded"
                          />

                          {svc.image ? (
                            <img
                              src={svc.image}
                              alt={svc.name}
                              className="w-12 h-9 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-9 rounded-lg bg-secondary flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground">
                              {svc.name}
                            </div>

                            {svc.duration && (
                              <div className="text-xs text-muted-foreground">
                                {svc.duration}
                              </div>
                            )}
                          </div>

                          <span className="text-accent font-semibold text-sm flex-shrink-0">
                            +₱
                            {Number(svc.price || 0).toLocaleString()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {packages.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Packages
                    </h3>

                    <div className="space-y-3">
                      {packages.map((pkg) => {
                        const packageId = `package-${pkg.id}`;
                        const isSelected = selectedAddOns.includes(packageId);

                        return (
                          <label
                            key={pkg.id}
                            className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAddOn(packageId)}
                                className="w-4 h-4 mt-1 accent-primary"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">
                                      {pkg.name}
                                    </div>

                                    {pkg.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {pkg.description}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-right flex-shrink-0">
                                    {Number(pkg.originalPrice || 0) >
                                      Number(pkg.packagePrice || 0) && (
                                      <div className="text-xs text-muted-foreground line-through">
                                        ₱
                                        {Number(
                                          pkg.originalPrice,
                                        ).toLocaleString()}
                                      </div>
                                    )}

                                    <div className="text-sm font-bold text-accent">
                                      +₱
                                      {Number(
                                        pkg.packagePrice || 0,
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                </div>

                                {Array.isArray(pkg.services) &&
                                  pkg.services.length > 0 && (
                                    <div className="mt-3">
                                      <div className="text-xs font-medium text-foreground mb-1.5">
                                        Includes:
                                      </div>

                                      <div className="flex flex-wrap gap-1.5">
                                        {pkg.services.map(
                                          (service: string, index: number) => (
                                            <span
                                              key={index}
                                              className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground"
                                            >
                                              {service}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {addOnServices.length === 0 && packages.length === 0 && (
                  <div className="py-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      No activities or packages are currently available.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <h2
              className="font-semibold text-foreground mb-1"
              style={{
                fontFamily: "var(--font-display)",
              }}
            >
              Special Requests
            </h2>

            <p className="text-xs text-muted-foreground mb-3">
              Let us know about any preferences or special occasions.
            </p>

            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="E.g., early check-in, anniversary setup, dietary requirements, extra bed..."
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24 bg-white rounded-2xl border border-border shadow-lg overflow-hidden">
            <div className="relative h-36">
              <img
                src={room.image}
                alt={room.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <h3
                  className="text-white font-semibold text-sm"
                  style={{
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {room.name}
                </h3>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ₱{room.basePrice.toLocaleString()} × {nights} night
                    {nights > 1 ? "s" : ""}
                  </span>
                  <span>₱{roomTotal.toLocaleString()}</span>
                </div>

                {addOns.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span>₱{item.price.toLocaleString()}</span>
                  </div>
                ))}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Reservation fee ({reservationFeePercent}%)
                  </span>
                  <span>₱{reservationFee.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center font-bold text-base pt-4 mt-3 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-accent text-xl">
                    ₱{total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 p-2.5 bg-secondary rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                Free cancellation up to 48 hours before check-in.
              </div>

              <button
                disabled={checkingAvailability || availableRooms <= 0}
                onClick={async () => {
                  if (!arrivalTime) {
                    alert("Please select your estimated time of arrival.");
                    return;
                  }

                  const available = await checkRoomAvailability();

                  if (!available) {
                    return;
                  }

                  setStep("confirm");
                }}
                className={`w-full font-semibold py-3.5 rounded-xl transition-colors text-sm ${
                  checkingAvailability || availableRooms <= 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-accent text-white hover:bg-accent/90"
                }`}
              >
                {checkingAvailability
                  ? "Checking Availability..."
                  : availableRooms <= 0
                    ? "No Rooms Available"
                    : "Review & Confirm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
