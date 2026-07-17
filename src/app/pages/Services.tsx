import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { services, Service } from "../data/mockData";
import { useApp } from "../context/AppContext";
import {
  Clock,
  Users,
  Star,
  ChevronRight,
  X,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const CATEGORIES = [
  "All",
  "Diving",
  "Snorkeling",
  "Water Sports",
  "Island",
  "Wellness",
];

const catMap: Record<string, Service["category"][]> = {
  All: ["diving", "snorkeling", "water-sports", "island", "wellness"],
  Diving: ["diving"],
  Snorkeling: ["snorkeling"],
  "Water Sports": ["water-sports"],
  Island: ["island"],
  Wellness: ["wellness"],
};

const difficultyColor: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  "Beginner – Advanced": "bg-blue-100 text-blue-700",
  Advanced: "bg-red-100 text-red-600",
  Easy: "bg-green-100 text-green-700",
  "All levels": "bg-gray-100 text-gray-600",
};

export default function Services() {
  const [cat, setCat] = useState("All");
  const [selected, setSelected] = useState<Service | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [participants, setParticipants] = useState(1);
  const [booked, setBooked] = useState(false);
  const { user } = useApp();
  const navigate = useNavigate();

  const filtered = services.filter((s) => catMap[cat].includes(s.category));

  const handleBook = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!bookingDate || !bookingTime) return;
    setBooked(true);
    setTimeout(() => {
      setSelected(null);
      setBooked(false);
      setBookingDate("");
      setBookingTime("");
      setParticipants(1);
    }, 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero strip */}
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
            Activities & Services
          </h1>
          <p className="text-white/80 text-sm mt-2 max-w-md">
            Dive, snorkel, explore, relax — curate your perfect island itinerary
            from our expert-led activities.
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              cat === c
                ? "bg-primary text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((svc) => (
          <div
            key={svc.id}
            className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 group"
          >
            <div className="relative h-48 overflow-hidden">
              <img
                src={svc.image}
                alt={svc.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2.5 py-1 bg-white/95 rounded-full text-[10px] font-medium text-primary capitalize">
                  {svc.category.replace("-", " ")}
                </span>
                {svc.difficulty && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${difficultyColor[svc.difficulty] || "bg-gray-100 text-gray-600"}`}
                  >
                    {svc.difficulty}
                  </span>
                )}
              </div>
              {!svc.available && (
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
                {svc.name}
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed mb-3 line-clamp-2">
                {svc.description}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {svc.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Max {svc.maxParticipants}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />{" "}
                  4.8
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <span className="text-accent font-bold text-xl">
                    ₱{svc.price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">/person</span>
                </div>
                <button
                  onClick={() => svc.available && setSelected(svc)}
                  disabled={!svc.available}
                  className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                    svc.available
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  Book <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Booking modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="relative h-32">
              <img
                src={selected.image}
                alt={selected.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-3 left-4">
                <h2
                  className="text-white font-semibold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {selected.name}
                </h2>
                <p className="text-white/70 text-xs">
                  ₱{selected.price.toLocaleString()} per person
                </p>
              </div>
            </div>

            {booked ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3
                  className="font-semibold text-foreground mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Activity Booked!
                </h3>
                <p className="text-sm text-muted-foreground">
                  We'll send details to your email shortly.
                </p>
              </div>
            ) : (
              <div className="p-5">
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
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
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a time</option>
                      {selected.schedule.map((t) => (
                        <option key={t} value={t}>
                          {t}
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
                      onChange={(e) => setParticipants(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm font-semibold text-foreground mb-4 p-3 bg-secondary rounded-xl">
                  <span>Total</span>
                  <span className="text-accent">
                    ₱{(selected.price * participants).toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(null)}
                    className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={!bookingDate || !bookingTime}
                    className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
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
