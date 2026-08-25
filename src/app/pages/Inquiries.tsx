import { useEffect, useRef, useState } from "react";
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

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { customerDb } from "../components/firebase";

interface Reply {
  id: string;
  sender: "customer" | "receptionist";
  message: string;
  createdAt: Timestamp | null;
}
interface Inquiry {
  id: string;
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "in-progress" | "resolved" | "cancelled";
  createdAt: string;
  replies: Reply[];
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
    a: "Yes, we offer transfers from Francisco B. Reyes Airport (Busuanga) and San Jose Port. Please arrange at least 24 hours in advance.",
  },
  {
    q: "What diving certification do I need?",
    a: "Open Water Diving requires at least an Open Water PADI certification. Discover Scuba sessions are available for uncertified guests.",
  },
  {
    q: "What is your cancellation policy?",
    a: "Free cancellation is available up to 48 hours before check-in. Cancellations within 48 hours are subject to one night's room charge.",
  },
];

export default function Inquiries() {
  const { user } = useApp();
  const [tab, setTab] = useState<"chat" | "form" | "faq">("form");
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [formSent, setFormSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    null,
  );

  const [loadingInquiries, setLoadingInquiries] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedInquiryId) {
      return;
    }

    const repliesQuery = query(
      collection(customerDb, "Inquiries", selectedInquiryId, "replies"),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      repliesQuery,
      (snapshot) => {
        const replies: Reply[] = snapshot.docs.map((replyDoc) => {
          const data = replyDoc.data();

          return {
            id: replyDoc.id,
            sender:
              data.sender === "receptionist" ? "receptionist" : "customer",
            message: String(data.message || ""),
            createdAt: data.createdAt || null,
          };
        });

        setInquiries((current) =>
          current.map((inquiry) =>
            inquiry.id === selectedInquiryId
              ? {
                  ...inquiry,
                  replies,
                }
              : inquiry,
          ),
        );
      },
      (error) => {
        console.error("Error loading replies:", error);
      },
    );

    return () => unsubscribe();
  }, [selectedInquiryId]);

  useEffect(() => {
    if (!user) return;

    setFormData((prev) => ({
      ...prev,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
    }));
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setInquiries([]);
      setLoadingInquiries(false);
      return;
    }

    setLoadingInquiries(true);

    const inquiriesQuery = query(
      collection(customerDb, "Inquiries"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      inquiriesQuery,
      (snapshot) => {
        const loaded: Inquiry[] = snapshot.docs.map((inquiryDoc) => {
          const data = inquiryDoc.data();

          return {
            id: inquiryDoc.id,
            userId: String(data.userId || ""),
            name: String(data.name || ""),
            email: String(data.email || ""),
            subject: String(data.subject || ""),
            message: String(data.message || ""),
            status: data.status || "new",
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleString()
              : "",
            replies: [],
          };
        });

        setInquiries(loaded);

        setSelectedInquiryId((current) => {
          if (current && loaded.some((inquiry) => inquiry.id === current)) {
            return current;
          }

          return loaded.length > 0 ? loaded[0].id : null;
        });

        setLoadingInquiries(false);
      },
      (error) => {
        console.error("Error loading customer inquiries:", error);
        setLoadingInquiries(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id]);

  const selectedInquiry =
    inquiries.find((inquiry) => inquiry.id === selectedInquiryId) || null;

  useEffect(() => {
    if (tab === "chat") {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [selectedInquiry?.replies, tab]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert("Please log in before sending an inquiry.");
      return;
    }

    if (!formData.subject.trim() || !formData.message.trim()) {
      alert("Please complete the subject and message.");
      return;
    }

    try {
      setSending(true);

      const inquiryRef = await addDoc(collection(customerDb, "Inquiries"), {
        userId: user.id,

        name: formData.name.trim(),
        email: formData.email.trim(),

        subject: formData.subject,
        message: formData.message.trim(),

        status: "new",

        createdAt: serverTimestamp(),

        replies: [],
      });

      setSelectedInquiryId(inquiryRef.id);

      setFormSent(true);

      setFormData((prev) => ({
        ...prev,
        subject: "",
        message: "",
      }));

      setTab("chat");

      setTimeout(() => {
        setFormSent(false);
      }, 5000);
    } catch (error) {
      console.error("Error sending inquiry:", error);

      if (error instanceof Error) {
        alert(`Failed to send inquiry: ${error.message}`);
      } else {
        alert("Failed to send inquiry. Please check the browser console.");
      }
    } finally {
      setSending(false);
    }
  };

  const sendChat = async () => {
    if (!input.trim()) return;

    if (!selectedInquiry) {
      alert("Please send an inquiry first.");
      return;
    }

    if (!user?.id) {
      alert("Please log in first.");
      return;
    }

    try {
      setSending(true);

      const reply = {
        sender: "customer" as const,
        senderName:
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          "Customer",
        message: input.trim(),
        userId: user.id,
        createdAt: serverTimestamp(),
      };

      await addDoc(
        collection(customerDb, "Inquiries", selectedInquiry.id, "replies"),
        reply,
      );

      setInput("");
    } catch (error) {
      console.error("Error sending customer reply:", error);
      alert("Failed to send your message.");
    } finally {
      setSending(false);
    }
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
          We're here to help. Send us a message or check our FAQs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CONTACT INFORMATION */}

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
                  value: "Sabang, Puerto",
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

                <p className="text-xs">Sabang, Puerto</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}

        <div className="lg:col-span-2">
          {/* TABS */}

          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5">
            {[
              { id: "form", label: "📩 Message Us" },
              { id: "chat", label: "💬 Conversation" },
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

          {/* FORM */}

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
                    Your inquiry has been sent to our receptionist.
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
                          setFormData((f) => ({
                            ...f,
                            name: e.target.value,
                          }))
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
                          setFormData((f) => ({
                            ...f,
                            email: e.target.value,
                          }))
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
                        setFormData((f) => ({
                          ...f,
                          subject: e.target.value,
                        }))
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
                        setFormData((f) => ({
                          ...f,
                          message: e.target.value,
                        }))
                      }
                      placeholder="Tell us how we can help you..."
                      rows={5}
                      className={inputClass + " resize-none"}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />

                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* CHAT */}

          {tab === "chat" && (
            <div
              className="bg-white rounded-2xl border border-border flex flex-col"
              style={{ height: 500 }}
            >
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>

                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Resort Reception
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Your inquiry conversation
                  </div>
                </div>
              </div>

              {/* INQUIRY SELECTOR */}

              <div className="p-3 border-b border-border">
                {loadingInquiries ? (
                  <p className="text-xs text-muted-foreground">
                    Loading your inquiries...
                  </p>
                ) : inquiries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    You don't have any inquiries yet. Send us a message first.
                  </p>
                ) : (
                  <select
                    value={selectedInquiryId || ""}
                    onChange={(e) => setSelectedInquiryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-white"
                  >
                    {inquiries.map((inquiry) => (
                      <option key={inquiry.id} value={inquiry.id}>
                        {inquiry.subject} — {inquiry.status}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* MESSAGES */}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!selectedInquiry ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />

                      <p className="text-sm text-muted-foreground">
                        No conversation selected.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ORIGINAL CUSTOMER MESSAGE */}

                    <div className="flex justify-end">
                      <div className="max-w-xs">
                        <div className="bg-primary text-white px-3 py-2 rounded-2xl rounded-br-sm text-xs">
                          {selectedInquiry.message}
                        </div>

                        <div className="text-[10px] text-muted-foreground mt-0.5 text-right">
                          {selectedInquiry.createdAt}
                        </div>
                      </div>
                    </div>

                    {/* REPLIES */}

                    {selectedInquiry.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`flex ${
                          reply.sender === "customer"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {reply.sender === "receptionist" && (
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                            <MessageCircle className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}

                        <div>
                          <div
                            className={`max-w-xs px-3 py-2 rounded-2xl text-xs ${
                              reply.sender === "customer"
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {reply.message}
                          </div>

                          <div
                            className={`text-[10px] text-muted-foreground mt-0.5 ${
                              reply.sender === "customer"
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            {reply.createdAt
                              ? reply.createdAt
                                  .toDate()
                                  .toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* REPLY BOX */}

              <div className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendChat();
                    }
                  }}
                  disabled={!selectedInquiry || sending}
                  placeholder={
                    selectedInquiry
                      ? "Type a message..."
                      : "Send an inquiry first..."
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
                />

                <button
                  onClick={sendChat}
                  disabled={!input.trim() || !selectedInquiry || sending}
                  className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* FAQ */}

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
