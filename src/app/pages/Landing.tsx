import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { rooms, services, sampleReviews } from "../data/mockData";
import {
  Search,
  Star,
  ChevronRight,
  Waves,
  Shield,
  Award,
  Users,
  Anchor,
  ArrowRight,
  Bot,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function Landing() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests);
    navigate("/rooms?" + params.toString());
  };

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&auto=format)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/40 to-background/90" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-5">
              <span className="px-3 py-1 bg-accent/20 border border-accent/40 rounded-full text-accent text-xs font-medium uppercase tracking-wider">
                Palawan, Philippines
              </span>
            </div>
            <h1
              className="text-white mb-6 leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                fontWeight: 700,
              }}
            >
              Dive Into Paradise.
              <br />
              <em>Wake Up to the Sea.</em>
            </h1>
            <p className="text-white/80 text-lg mb-10 max-w-xl leading-relaxed">
              World-class diving, pristine white sand beaches, and luxurious
              island accommodations — all in one breathtaking destination.
            </p>

            {/* Search Widget */}
            <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-2xl max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Check-in
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Check-out
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    min={checkIn || new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Guest{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleSearch}
                className="mt-3 w-full bg-accent hover:bg-accent/90 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search Available Rooms
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-primary text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "50+", label: "Dive Sites" },
              { value: "6", label: "Room Types" },
              { value: "2,000+", label: "Happy Guests" },
              { value: "4.9★", label: "Average Rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  className="text-2xl font-bold text-accent"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {stat.value}
                </div>
                <div className="text-white/60 text-xs uppercase tracking-wider mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
              Accommodations
            </p>
            <h2
              className="text-foreground"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.25rem",
                fontWeight: 700,
              }}
            >
              Your Home By the Sea
            </h2>
          </div>
          <Link
            to="/rooms"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors"
          >
            View all rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rooms.slice(0, 3).map((room) => (
            <Link
              key={room.id}
              to={`/rooms/${room.id}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={room.images[0]}
                  alt={room.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 bg-white/90 rounded-full text-xs font-medium text-primary capitalize">
                    {room.type.replace("-", " ")}
                  </span>
                </div>
                {!room.available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">
                      Fully Booked
                    </span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3
                    className="font-semibold text-foreground text-base leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {room.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <StarRating rating={room.rating} />
                  <span className="text-xs text-muted-foreground">
                    ({room.reviews})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-accent font-bold text-lg">
                      ₱{room.price.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      /night
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Up to {room.capacity}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-accent transition-colors"
          >
            View all rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Activities preview */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
                Experiences
              </p>
              <h2
                className="text-foreground"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2.25rem",
                  fontWeight: 700,
                }}
              >
                Island Adventures
              </h2>
            </div>
            <Link
              to="/services"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              All activities <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.slice(0, 3).map((svc) => (
              <Link
                key={svc.id}
                to="/services"
                className="group relative rounded-2xl overflow-hidden h-64 shadow-sm hover:shadow-xl transition-all"
              >
                <img
                  src={svc.image}
                  alt={svc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <span className="text-white/70 text-xs uppercase tracking-wider">
                    {svc.category}
                  </span>
                  <h3
                    className="text-white font-semibold text-lg mt-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {svc.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-accent font-semibold text-sm">
                      ₱{svc.price.toLocaleString()}
                    </span>
                    <span className="text-white/70 text-xs">
                      {svc.duration}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
            Why Sabang Beach and Diving Resorts
          </p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#0A2540",
            }}
          >
            The Difference Is in the Details
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: Anchor,
              title: "PADI-Certified Diving",
              desc: "Expert dive masters with 15+ years guiding guests through 50+ local dive sites.",
            },
            {
              icon: Shield,
              title: "Safety First",
              desc: "International safety standards, first aid certified staff, and emergency protocols at every activity.",
            },
            {
              icon: Award,
              title: "Award-Winning Service",
              desc: "TripAdvisor Certificate of Excellence for 5 consecutive years.",
            },
            {
              icon: Waves,
              title: "Pristine Location",
              desc: "Nestled in a protected marine sanctuary with unparalleled biodiversity.",
            },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-7 h-7 text-primary" />
              </div>
              <h3
                className="font-semibold text-foreground mb-2 text-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-accent text-sm font-medium uppercase tracking-wider mb-2">
              Guest Stories
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2.25rem",
                fontWeight: 700,
              }}
            >
              What Our Guests Say
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sampleReviews.slice(0, 2).map((review) => (
              <div
                key={review.id}
                className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={review.guestAvatar}
                    alt={review.guestName}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-accent/50"
                  />
                  <div>
                    <div className="font-semibold text-white text-sm">
                      {review.guestName}
                    </div>
                    <div className="text-white/50 text-xs">
                      {review.roomName || review.serviceName}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i <= review.rating ? "fill-accent text-accent" : "text-white/30"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-white/80 text-sm leading-relaxed italic">
                  "{review.comment}"
                </p>
                <p className="text-white/40 text-xs mt-3">{review.date}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              to="/reviews"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors border border-white/20 rounded-full px-5 py-2.5 hover:bg-white/10"
            >
              Read all reviews <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Assistant teaser */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-secondary to-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 border border-border">
          <div className="flex-1">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-5">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2
              className="text-foreground mb-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.875rem",
                fontWeight: 700,
              }}
            >
              Meet Your AI Travel Assistant
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-md">
              Not sure what to book? Our AI concierge helps you find the perfect
              room and activities based on your preferences, budget, and travel
              dates — available 24/7.
            </p>
            <Link
              to="/ai-assistant"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-primary/90 transition-colors"
            >
              Chat with AI Assistant <Bot className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex-shrink-0 w-full md:w-80">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-border space-y-3">
              {[
                {
                  role: "user",
                  msg: "I want a romantic beachfront room for 3 nights in June with snorkeling.",
                },
                {
                  role: "ai",
                  msg: "I recommend the Sabang Beachfront Villa! It's right on the beach, rated 4.9★, and I can add a Snorkeling Safari to your booking. Shall I check availability?",
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact section */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-foreground mb-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            Need Help Planning Your Stay?
          </h2>
          <p className="text-muted-foreground text-sm mb-8">
            Our team is available 7 days a week to assist you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="tel:+6348555019"
              className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
            >
              <Phone className="w-4 h-4" /> +63 48 555 0192
            </a>
            <a
              href="mailto:hello@SabangBeach.ph"
              className="flex items-center gap-2 text-sm font-medium text-primary bg-white border border-border px-5 py-3 rounded-full hover:shadow-md transition-all"
            >
              <Mail className="w-4 h-4" /> hello@SabangBeach.ph
            </a>
            <Link
              to="/inquiries"
              className="flex items-center gap-2 text-sm font-medium bg-accent text-white px-5 py-3 rounded-full hover:bg-accent/90 transition-colors"
            >
              <MapPin className="w-4 h-4" /> Send a Message
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
