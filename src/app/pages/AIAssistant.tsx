import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { rooms, services } from "../data/mockData";
import { useApp } from "../context/AppContext";
import {
  Bot,
  Send,
  User,
  Sparkles,
  Star,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface Message {
  role: "user" | "ai";
  text: string;
  suggestions?: string[];
  roomCards?: typeof rooms;
  serviceCards?: typeof services;
  timestamp: string;
}

const SUGGESTIONS_INITIAL = [
  "What rooms are available for 2 guests?",
  "Recommend a room for a honeymoon",
  "Tell me about diving activities",
  "What's included in the island hopping tour?",
  "Best room for families with kids",
  "What payment methods do you accept?",
];

export default function AIAssistant() {
  const { user } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: `Hello${user ? `, ${user.firstName}` : ""}! 👋 I\'m Cunag, your AI concierge at Coral Bay Resort. I\'m here to help you plan the perfect island escape — from choosing the right room to booking activities and answering any questions you have. How can I assist you today?`,
      suggestions: SUGGESTIONS_INITIAL,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing) return;

    const now = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text,
        timestamp: now,
      },
    ]);

    setInput("");
    setTyping(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:5001/admin-80f41/us-central1/resortAI",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI request failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            data.response || data.message || "Sorry, I couldn't answer that.",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (error) {
      console.error("AI error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Sorry, I'm having trouble connecting to my AI service right now. Please try again.",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const reset = () => {
    setMessages([
      {
        role: "ai",
        text: `Hello${user ? `, ${user.firstName}` : ""}! 👋 I'm Cunag, your AI concierge. How can I help you today?`,
        suggestions: SUGGESTIONS_INITIAL,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-foreground font-semibold"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
            >
              Cunag — AI Concierge
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Online · Powered by AI</span>
              <Sparkles className="w-3 h-3 text-accent" />
            </div>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-1.5 rounded-full hover:bg-muted"
        >
          <RefreshCw className="w-3.5 h-3.5" /> New Chat
        </button>
      </div>

      {/* Chat container */}
      <div
        className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col"
        style={{ height: "70vh", minHeight: 480 }}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "ai"
                    ? "bg-primary"
                    : "bg-muted border border-border"
                }`}
              >
                {msg.role === "ai" ? (
                  <Bot className="w-4 h-4 text-white" />
                ) : user ? (
                  <img
                    src={user.avatar}
                    alt="You"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div
                className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Room cards */}
                {msg.roomCards && msg.roomCards.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 max-w-full">
                    {msg.roomCards.map((room) => (
                      <Link
                        key={room.id}
                        to={`/rooms/${room.id}`}
                        className="flex-shrink-0 w-52 bg-white border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <img
                          src={room.images[0]}
                          alt={room.name}
                          className="w-full h-28 object-cover"
                        />
                        <div className="p-2.5">
                          <div
                            className="text-xs font-semibold text-foreground line-clamp-1"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {room.name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-[10px] text-muted-foreground">
                              {room.rating}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-accent font-bold text-xs">
                              ₱{room.price.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-primary flex items-center gap-0.5">
                              View <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Service cards */}
                {msg.serviceCards && msg.serviceCards.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1 max-w-full">
                    {msg.serviceCards.map((svc) => (
                      <Link
                        key={svc.id}
                        to="/services"
                        className="flex-shrink-0 w-44 bg-white border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <img
                          src={svc.image}
                          alt={svc.name}
                          className="w-full h-24 object-cover"
                        />
                        <div className="p-2.5">
                          <div
                            className="text-xs font-semibold text-foreground line-clamp-1"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {svc.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {svc.duration}
                          </div>
                          <div className="text-accent font-bold text-xs mt-1">
                            ₱{svc.price.toLocaleString()}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {msg.suggestions && msg.role === "ai" && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="px-2.5 py-1 bg-secondary text-primary text-[11px] font-medium rounded-full hover:bg-primary hover:text-white transition-colors border border-secondary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !typing && sendMessage(input)
              }
              placeholder="Ask Cunag anything about Coral Bay..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={typing}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Cunag is an AI assistant. For urgent matters, contact us at +63 48
            555 0192.
          </p>
        </div>
      </div>
    </div>
  );
}
