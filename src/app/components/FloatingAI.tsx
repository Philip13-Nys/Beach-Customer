import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  Bot,
  X,
  Send,
  Sparkles,
  ArrowUpRight,
  Minimize2,
  Image as ImageIcon,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useApp } from "../context/AppContext";
import { db } from "../components/firebase";

interface Msg {
  role: "user" | "ai";
  text: string;
}

interface ResortSettings {
  resortName: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  frontDeskHours: string;
}

const DEFAULT_RESORT_NAME = "Sabang Beach and Diving Resort";

const DEFAULT_SETTINGS: ResortSettings = {
  resortName: DEFAULT_RESORT_NAME,
  description:
    "A tropical getaway offering comfortable accommodations, beautiful beaches, and memorable resort activities.",
  address: "",
  phone: "",
  email: "",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  frontDeskHours: "24/7",
};

const CHIPS = [
  "Best room for 2?",
  "What types of rooms do you have?",
  "Diving packages",
  "Island hopping",
];

const AI_ENDPOINT = "https://resort-ai-backend-kappa.vercel.app/api/resortAI";

const IMAGE_URL_REGEX =
  /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?/gi;

function cleanImageUrl(url: string) {
  return url.replace(/[),.!?;]+$/, "");
}

function renderMessageContent(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = new RegExp(IMAGE_URL_REGEX.source, "gi");

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let imageIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const rawUrl = match[0];
    const url = cleanImageUrl(rawUrl);
    const start = match.index;
    const end = start + url.length;

    if (start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>,
      );
    }

    parts.push(
      <a
        key={`image-link-${imageIndex}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-xl"
        aria-label="Open image in a new tab"
      >
        <img
          src={url}
          alt="Image shared by Cunag"
          loading="lazy"
          className="max-h-64 w-full rounded-xl border border-border object-cover transition-opacity hover:opacity-90"
          onError={(event) => {
            const image = event.currentTarget;
            image.style.display = "none";

            const parent = image.parentElement;

            if (parent) {
              parent.classList.remove("overflow-hidden");
              parent.classList.add("break-all", "text-primary", "underline");
              parent.textContent = url;
            }
          }}
        />
      </a>,
    );

    lastIndex = end;
    imageIndex++;

    regex.lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

export default function FloatingAI() {
  const location = useLocation();
  const { user } = useApp();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);

  const [resortSettings, setResortSettings] =
    useState<ResortSettings>(DEFAULT_SETTINGS);

  const [msgs, setMsgs] = useState<Msg[]>([]);

  const endRef = useRef<HTMLDivElement>(null);

  const userName = user?.firstName?.trim() || "";

  useEffect(() => {
    const settingsRef = doc(db, "publicSettings", "general");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setResortSettings(DEFAULT_SETTINGS);
          return;
        }

        const data = snapshot.data();

        setResortSettings({
          resortName:
            typeof data.resortName === "string" && data.resortName.trim()
              ? data.resortName.trim()
              : DEFAULT_RESORT_NAME,

          description:
            typeof data.description === "string"
              ? data.description
              : DEFAULT_SETTINGS.description,

          address: typeof data.address === "string" ? data.address : "",

          phone: typeof data.phone === "string" ? data.phone : "",

          email: typeof data.email === "string" ? data.email : "",

          checkInTime:
            typeof data.checkInTime === "string"
              ? data.checkInTime
              : DEFAULT_SETTINGS.checkInTime,

          checkOutTime:
            typeof data.checkOutTime === "string"
              ? data.checkOutTime
              : DEFAULT_SETTINGS.checkOutTime,

          frontDeskHours:
            typeof data.frontDeskHours === "string"
              ? data.frontDeskHours
              : DEFAULT_SETTINGS.frontDeskHours,
        });
      },
      (error) => {
        console.error(
          "Failed to load public resort settings for Cunag:",
          error,
        );
      },
    );

    return unsubscribe;
  }, []);

  const resortName = resortSettings.resortName.trim() || DEFAULT_RESORT_NAME;

  useEffect(() => {
    const greeting =
      `Hi${userName ? ` ${userName}` : ""}! 👋 ` +
      `I'm Cunag — your AI concierge at ${resortName}. ` +
      "Ask me anything about our rooms, activities, services, or resort.";

    setMsgs((previous) => {
      if (previous.length === 0) {
        return [{ role: "ai", text: greeting }];
      }

      if (previous[0]?.role === "ai") {
        return previous.map((message, index) =>
          index === 0 ? { ...message, text: greeting } : message,
        );
      }

      return [{ role: "ai", text: greeting }, ...previous];
    });
  }, [resortName, userName]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [msgs, typing]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNudge(true);
    }, 4000);

    const timer2 = window.setTimeout(() => {
      setNudge(false);
    }, 7000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timer2);
    };
  }, []);

  const send = async (text: string) => {
    const message = text.trim();

    if (!message || typing) {
      return;
    }

    setMsgs((previous) => [
      ...previous,
      {
        role: "user",
        text: message,
      },
    ]);

    setInput("");
    setTyping(true);

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,

          resortName: resortSettings.resortName,

          resortSettings: {
            resortName: resortSettings.resortName,
            description: resortSettings.description,
            address: resortSettings.address,
            phone: resortSettings.phone,
            email: resortSettings.email,
            checkInTime: resortSettings.checkInTime,
            checkOutTime: resortSettings.checkOutTime,
            frontDeskHours: resortSettings.frontDeskHours,
          },
        }),
      });

      const rawText = await response.text();

      let data: {
        response?: string;
        message?: string;
        error?: string;
        details?: string;
      };

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Cunag backend returned an invalid response (HTTP ${response.status}).`,
        );
      }

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            `AI request failed with status ${response.status}.`,
        );
      }

      const aiResponse =
        data.response ||
        data.message ||
        "I'm sorry, I wasn't able to generate a response.";

      setMsgs((previous) => [
        ...previous,
        {
          role: "ai",
          text: aiResponse,
        },
      ]);
    } catch (error) {
      console.error("Cunag AI error:", error);

      setMsgs((previous) => [
        ...previous,
        {
          role: "ai",
          text: "Sorry, I'm having trouble connecting to Cunag right now. Please try again.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  if (location.pathname === "/ai-assistant") {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {nudge && !open && (
          <div className="relative max-w-[220px] rounded-2xl border border-border bg-white px-4 py-3 shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-300">
            <p className="text-xs font-medium leading-snug text-foreground">
              💬 Need help choosing a room or activity?
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Ask Cunag, your AI concierge!
            </p>

            <div className="absolute bottom-[-6px] right-6 h-3 w-3 rotate-45 border-r border-b border-border bg-white" />
          </div>
        )}

        <button
          onClick={() => {
            setOpen((previous) => !previous);
            setNudge(false);
          }}
          aria-label="Open AI Assistant"
          className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 ${
            open
              ? "rotate-0 scale-95 bg-foreground"
              : "bg-primary hover:scale-110 hover:shadow-primary/40"
          }`}
          style={{
            boxShadow: open ? undefined : "0 8px 32px rgba(10,61,98,0.35)",
          }}
        >
          {open ? (
            <X className="h-5 w-5 text-white" />
          ) : (
            <>
              <Bot className="h-6 w-6 text-white" />

              <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border-2 border-primary opacity-30" />

              <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-accent">
                <Sparkles className="h-2 w-2 text-white" />
              </span>
            </>
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl sm:w-96 animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{
            maxHeight: "520px",
            boxShadow: "0 24px 64px rgba(10,61,98,0.18)",
          }}
        >
          <div className="flex items-center gap-3 bg-primary px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-5 w-5 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-semibold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Cunag · AI Concierge
              </div>

              <div
                className="flex items-center gap-1 text-[10px] text-white/70"
                title={resortName}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                <span className="truncate">Online · {resortName}</span>
              </div>
            </div>

            <Link
              to="/ai-assistant"
              onClick={() => setOpen(false)}
              title="Open full assistant"
              aria-label="Open full assistant"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-white" />
            </Link>

            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
              aria-label="Minimize AI assistant"
            >
              <Minimize2 className="h-3.5 w-3.5 text-white" />
            </button>
          </div>

          <div
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
            style={{ minHeight: 0 }}
          >
            {msgs.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {message.role === "ai" && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] min-w-0 whitespace-pre-line break-words rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    message.role === "user"
                      ? "rounded-tr-sm bg-primary text-white"
                      : "rounded-tl-sm bg-muted text-foreground"
                  }`}
                >
                  {renderMessageContent(message.text)}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>

                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                  {[0, 0.15, 0.3].map((delay, index) => (
                    <span
                      key={index}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{
                        animationDelay: `${delay}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {msgs.length <= 2 && !typing && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => void send(chip)}
                  className="rounded-full border border-secondary bg-secondary px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-border px-3 pt-1 pb-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !typing) {
                  void send(input);
                }
              }}
              placeholder="Ask about rooms, diving, prices…"
              className="flex-1 rounded-xl border border-border px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              disabled={typing}
            />

            <button
              onClick={() => void send(input)}
              disabled={!input.trim() || typing}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
