import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Bot, X, Send, Sparkles, ArrowUpRight, Minimize2 } from "lucide-react";
import { rooms, services } from "../data/mockData";
import { useApp } from "../context/AppContext";

interface Msg {
  role: "user" | "ai";
  text: string;
}

function getQuickReply(q: string): string {
  const t = q.toLowerCase();
  if (t.includes("honeymoon") || t.includes("romantic"))
    return "For a romantic stay I'd recommend our Sunset Overwater Cottage — glass floor over the lagoon, private plunge pool 🌅. Want me to check availability?";
  if (t.includes("div"))
    return "Our PADI dive center runs 3 sessions daily from 6 AM. Open Water starts at ₱2,800/person 🤿. Certification required for Night Diving.";
  if (t.includes("snorkel"))
    return "Snorkeling Safari runs 4× daily and is perfect for all ages (kids 5+) at ₱1,200/person 🐠. Gear included!";
  if (t.includes("island hop"))
    return "Island Hopping departs at 7:30 AM daily — 3 islands, lunch, and snorkeling gear all included for ₱2,200 🏝️.";
  if (t.includes("family") || t.includes("kids"))
    return "Our Pearl Family Bungalow sleeps 5 with two bedrooms and a private garden. Best value for families 👨‍👩‍👧‍👦.";
  if (t.includes("price") || t.includes("cost") || t.includes("cheap"))
    return "Rooms range from ₱3,200/night (Garden Cottage) to ₱11,500/night (Overwater Cottage). Activities from ₱800. Shall I find something in your budget?";
  if (t.includes("cancel"))
    return "Free cancellation up to 48 hours before check-in. Within 48 hours, one night's charge applies.";
  if (t.includes("check") && (t.includes("in") || t.includes("out")))
    return "Check-in from 2:00 PM · Check-out by 12:00 PM noon. Early/late arrangements available on request!";
  if (t.includes("pay") || t.includes("gcash") || t.includes("card"))
    return "We accept credit/debit cards, GCash, and bank transfer — all secured with 256-bit SSL encryption 🔒.";
  if (t.includes("hello") || t.includes("hi") || t.includes("hey"))
    return "Hello there! 👋 I'm Cunag, your Sabang Beach and Diving Resort AI concierge. Ask me about rooms, diving, island hopping, or anything about the resort!";
  return "Great question! For full details and room recommendations, I can help you right here — or open the full AI Assistant for richer guidance and live cards 🌊.";
}

const CHIPS = [
  "Best room for 2?",
  "Diving packages",
  "Island hopping",
  "Check-in time",
];

export default function FloatingAI() {
  const location = useLocation();
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: `Hi${user ? ` ${user.firstName}` : ""}! 👋 I'm Cunag — ask me anything about Sabang Beach and Diving Resort.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // hide on the full AI page
  if (location.pathname === "/ai-assistant") return null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  // nudge animation after 4 seconds on first mount
  useEffect(() => {
    const t = setTimeout(() => setNudge(true), 4000);
    const t2 = setTimeout(() => setNudge(false), 7000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(
      () => {
        setTyping(false);
        setMsgs((prev) => [...prev, { role: "ai", text: getQuickReply(text) }]);
      },
      900 + Math.random() * 500,
    );
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Tooltip nudge */}
        {nudge && !open && (
          <div className="bg-white border border-border rounded-2xl shadow-xl px-4 py-3 max-w-[220px] animate-in slide-in-from-bottom-2 fade-in duration-300">
            <p className="text-xs text-foreground font-medium leading-snug">
              💬 Need help choosing a room or activity?
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Ask Cunag, your AI concierge!
            </p>
            <div className="absolute bottom-[-6px] right-6 w-3 h-3 bg-white border-r border-b border-border rotate-45" />
          </div>
        )}

        <button
          onClick={() => {
            setOpen((o) => !o);
            setNudge(false);
          }}
          aria-label="Open AI Assistant"
          className={`relative w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
            open
              ? "bg-foreground rotate-0 scale-95"
              : "bg-primary hover:scale-110 hover:shadow-primary/40"
          }`}
          style={{
            boxShadow: open ? undefined : "0 8px 32px rgba(10,61,98,0.35)",
          }}
        >
          {open ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <>
              <Bot className="w-6 h-6 text-white" />
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30 pointer-events-none" />
              {/* Sparkle dot */}
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-accent rounded-full border-2 border-white flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{
            maxHeight: "520px",
            boxShadow: "0 24px 64px rgba(10,61,98,0.18)",
          }}
        >
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-white font-semibold text-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Cunag · AI Concierge
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/70">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                Online · Sabang Beach & Diving Resort
              </div>
            </div>
            <Link
              to="/ai-assistant"
              onClick={() => setOpen(false)}
              title="Open full assistant"
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ minHeight: 0 }}
          >
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {m.role === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-muted px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Quick chips */}
          {msgs.length <= 2 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="px-2.5 py-1 bg-secondary text-primary text-[11px] font-medium rounded-full hover:bg-primary hover:text-white transition-colors border border-secondary"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !typing && send(input)}
              placeholder="Ask about rooms, diving, prices…"
              className="flex-1 px-3 py-2 rounded-xl border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={typing}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || typing}
              className="w-8 h-8 bg-accent text-white rounded-xl flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
