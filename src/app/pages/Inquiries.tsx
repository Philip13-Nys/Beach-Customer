import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  Send,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ChatMsg {
  role: "user" | "support";
  text: string;
  time: string;
}

const FAQS = [
  {
    q: "What is your check-in and check-out time?",
    a: "Check-in is from 2:00 PM and check-out is until 12:00 PM noon. Early check-in and late check-out may be arranged subject to availability.",
  },
  {
    q: "Is breakfast included in the room rate?",
    a: "Breakfast is included for Sabang Beachfront Villa and Deep Diver's Suite. For other room types, breakfast may be added at ₱650 per person.",
  },
  {
    q: "Do you offer airport/port transfers?",
    a: "Yes, we offer transfers from Francisco B. Reyes Airport (Busuanga) and San Jose Port. Please arrange at least 24 hours in advance. Rates start at ₱1,200.",
  },
  {
    q: "What diving certification do I need?",
    a: "Open Water Diving requires at least an Open Water PADI certification. For Night Diving, Advanced certification is required. Discover Scuba (beginner pool sessions) available for uncertified guests.",
  },
  {
    q: "What is your cancellation policy?",
    a: "Free cancellation is available up to 48 hours before check-in. Cancellations within 48 hours are subject to one night's room charge as a penalty fee.",
  },
];

const AUTO_REPLIES: Record<string, string> = {
  default:
    "Thank you for your message! A member of our guest relations team will respond within 30 minutes during operating hours (7 AM – 10 PM). For urgent matters, please call us at +63 48 555 0192.",
  booking:
    "For booking inquiries, our team can assist you with availability, room selection, and special arrangements. We'll get back to you shortly!",
  payment:
    "For payment-related concerns, please have your booking reference ready. You can also complete payment directly through our secure online portal.",
  diving:
    "Great news for diving enthusiasts! Our PADI dive center is open daily from 6 AM. We can help you choose the best dive sites based on your certification level.",
};

export default function Inquiries() {
  const { user } = useApp();
  const [tab, setTab] = useState<"chat" | "form" | "faq">("form");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    {
      role: "support",
      text: "Hello! Welcome to Sabang Beach and Diving Resort support. How can I assist you today?",
      time: "10:00 AM",
    },
  ]);
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState({
    name: user?.firstName + " " + (user?.lastName || "") || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });
  const [formSent, setFormSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const sendChat = () => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newMsg: ChatMsg = { role: "user", text: input, time: now };
    setChatMsgs((prev) => [...prev, newMsg]);
    const userInput = input.toLowerCase();
    setInput("");

    setTimeout(() => {
      const replyKey =
        userInput.includes("book") || userInput.includes("reserv")
          ? "booking"
          : userInput.includes("pay")
            ? "payment"
            : userInput.includes("div")
              ? "diving"
              : "default";
      setChatMsgs((prev) => [
        ...prev,
        {
          role: "support",
          text: AUTO_REPLIES[replyKey],
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }, 1200);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 5000);
    setFormData((f) => ({ ...f, subject: "", message: "" }));
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "#0A2540",
          }}
        >
          Contact & Support
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          We're here to help. Reach us via chat, form, or check our FAQs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: contact info */}
        <div className="space-y-4">
          <div className="bg-primary rounded-2xl p-5 text-white">
            <h2
              className="font-semibold mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Get In Touch
            </h2>
            <div className="space-y-3">
              {[
                {
                  icon: Phone,
                  label: "Phone",
                  value: "+63 48 555 0192",
                  sub: "Mon–Sun · 7 AM – 10 PM",
                },
                {
                  icon: Mail,
                  label: "Email",
                  value: "hello@sabangresorts.ph",
                  sub: "Response within 2 hours",
                },
                {
                  icon: MapPin,
                  label: "Location",
                  value: "Busuanga, Palawan",
                  sub: "Philippines 5317",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-white/60">{item.label}</div>
                    <div className="text-sm font-medium text-white">
                      {item.value}
                    </div>
                    <div className="text-xs text-white/50">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <h3
              className="font-semibold text-foreground text-sm mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Resort Location
            </h3>
            <div className="bg-muted rounded-xl overflow-hidden h-40 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-xs">Busuanga, Palawan</p>
                <p className="text-xs text-muted-foreground">
                  Near Francisco B. Reyes Airport
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5">
            {[
              { id: "form", label: "📩 Message Us" },
              { id: "chat", label: "💬 Live Chat" },
              { id: "faq", label: "❓ FAQs" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  tab === t.id
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "form" && (
            <div className="bg-white rounded-2xl border border-border p-5">
              {formSent ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h2
                    className="font-semibold text-foreground mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Message Sent!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We'll respond to {formData.email} within 2 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Full name"
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="your@email.com"
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Subject
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, subject: e.target.value }))
                      }
                      className={inputClass}
                      required
                    >
                      <option value="">Select a topic</option>
                      <option>Booking / Reservation</option>
                      <option>Payment & Billing</option>
                      <option>Diving & Activities</option>
                      <option>Room Availability</option>
                      <option>Special Request</option>
                      <option>Complaint / Feedback</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, message: e.target.value }))
                      }
                      placeholder="Tell us how we can help you..."
                      rows={5}
                      className={inputClass + " resize-none"}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Send Message
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "chat" && (
            <div
              className="bg-white rounded-2xl border border-border flex flex-col"
              style={{ height: 420 }}
            >
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Sabang Beach Support
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />{" "}
                    Online now
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMsgs.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "support" && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                        <MessageCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`max-w-xs px-3 py-2 rounded-2xl text-xs ${
                          msg.role === "user"
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div
                        className={`text-[10px] text-muted-foreground mt-0.5 ${msg.role === "user" ? "text-right" : "text-left"}`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={sendChat}
                  disabled={!input.trim()}
                  className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {tab === "faq" && (
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground pr-4">
                      {faq.q}
                    </span>
                    {openFaq === i ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
              <div className="bg-secondary rounded-xl p-4 text-center text-sm text-muted-foreground">
                Didn't find your answer?{" "}
                <button
                  onClick={() => setTab("form")}
                  className="text-primary font-medium hover:text-accent transition-colors"
                >
                  Send us a message
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
