import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Bot, X, Send, Sparkles, ArrowUpRight, Minimize2 } from "lucide-react";
import { useApp } from "../context/AppContext";

interface Msg {
  role: "user" | "ai";
  text: string;
}

const CHIPS = [
  "Best room for 2?",
  "What types of rooms do you have?",
  "Diving packages",
  "Island hopping",
];

const AI_ENDPOINT = "https://resort-ai-backend.onrender.com/resortAI";

export default function FloatingAI() {
  const location = useLocation();
  const { user } = useApp();

  const [open, setOpen] = useState(false);

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: `Hi${user ? ` ${user.firstName}` : ""}! 👋 I'm Cunag — your AI concierge at Sabang Beach and Diving Resort. Ask me anything about our rooms, activities, services, or resort.`,
    },
  ]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  // Hide floating AI on the full AI assistant page
  if (location.pathname === "/ai-assistant") {
    return null;
  }

  // Scroll to newest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  // Nudge animation
  useEffect(() => {
    const t = setTimeout(() => setNudge(true), 4000);
    const t2 = setTimeout(() => setNudge(false), 7000);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  /**
   * Send message to Firebase Cloud Function
   */
  const send = async (text: string) => {
    const message = text.trim();

    if (!message || typing) {
      return;
    }

    // Add user message immediately
    setMsgs((prev) => [
      ...prev,
      {
        role: "user",
        text: message,
      },
    ]);

    setInput("");
    setTyping(true);

    try {
      console.log("Sending message to Cunag:", message);

      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      const data = await response.json();

      console.log("Cunag response:", data);

      if (!response.ok) {
        throw new Error(
          data?.details ||
            data?.error ||
            `AI request failed with status ${response.status}`,
        );
      }

      const aiResponse =
        data?.response ||
        data?.message ||
        "I'm sorry, I wasn't able to generate a response.";

      setMsgs((prev) => [
        ...prev,
        {
          role: "ai",
          text: aiResponse,
        },
      ]);
    } catch (error) {
      console.error("Cunag AI error:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown AI connection error.";

      setMsgs((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Sorry, I'm having trouble connecting to Cunag right now. Please try again.",
        },
      ]);

      console.error("Cunag error details:", errorMessage);
    } finally {
      setTyping(false);
    }
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

              <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30 pointer-events-none" />

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
                className={`flex gap-2 ${
                  m.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {m.role === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
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
                      style={{
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Quick chips */}
          {msgs.length <= 2 && !typing && (
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !typing) {
                  send(input);
                }
              }}
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
