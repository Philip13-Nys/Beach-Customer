import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Bot, Send, User, Sparkles, RefreshCw } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../components/firebase";

interface Message {
  role: "user" | "ai";
  text: string;
  suggestions?: string[];
  timestamp: string;
}

interface ResortSettings {
  resortName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

const DEFAULT_SETTINGS: ResortSettings = {
  resortName: "Sabang Beach and Diving Resort",
  address: "Sabang, Puerto Galera, Oriental Mindoro, Philippines",
  phone: "09914673564",
  email: "sabangbeach@gmail.com",
  website: "https://diving-resort.web.app",
};

const SUGGESTIONS_INITIAL = [
  "What types of rooms do you have?",
  "What room is best for 2 guests?",
  "What diving activities do you offer?",
  "What services are available?",
  "What activities can I do at the resort?",
  "Tell me about the resort.",
];

const AI_API_URL = "https://resort-ai-backend.onrender.com/resortAI";

function getTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createWelcomeMessage(
  firstName: string | undefined,
  resortName: string,
): Message {
  return {
    role: "ai",
    text: `Hello${firstName ? `, ${firstName}` : ""}! 👋 I'm Cunag, your AI concierge at ${resortName}.

I can answer questions about our rooms, diving activities, services, resort facilities, and other things you would like to know about your stay.

How can I help you today?`,
    suggestions: SUGGESTIONS_INITIAL,
    timestamp: getTime(),
  };
}

export default function AIAssistant() {
  const { user } = useApp();

  const [settings, setSettings] = useState<ResortSettings>(DEFAULT_SETTINGS);

  const [messages, setMessages] = useState<Message[]>([
    createWelcomeMessage(user?.firstName, DEFAULT_SETTINGS.resortName),
  ]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const settingsRef = doc(db, "publicSettings", "general");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSettings(DEFAULT_SETTINGS);
          return;
        }

        const data = snapshot.data();

        setSettings({
          resortName:
            typeof data.resortName === "string" && data.resortName.trim()
              ? data.resortName.trim()
              : DEFAULT_SETTINGS.resortName,

          address:
            typeof data.address === "string" && data.address.trim()
              ? data.address.trim()
              : DEFAULT_SETTINGS.address,

          phone:
            typeof data.phone === "string" && data.phone.trim()
              ? data.phone.trim()
              : DEFAULT_SETTINGS.phone,

          email:
            typeof data.email === "string" && data.email.trim()
              ? data.email.trim()
              : DEFAULT_SETTINGS.email,

          website:
            typeof data.website === "string" && data.website.trim()
              ? data.website.trim()
              : typeof data.websiteUrl === "string" && data.websiteUrl.trim()
                ? data.websiteUrl.trim()
                : DEFAULT_SETTINGS.website,
        });
      },
      (error) => {
        console.error("Failed to load resort settings:", error);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    setMessages((previous) => {
      if (
        previous.length === 1 &&
        previous[0].role === "ai" &&
        previous[0].suggestions?.length
      ) {
        return [createWelcomeMessage(user?.firstName, settings.resortName)];
      }

      return previous;
    });
  }, [user?.firstName, settings.resortName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText || typing) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      text: trimmedText,
      timestamp: getTime(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setTyping(true);

    try {
      const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedText,

          settings: {
            resortName: settings.resortName,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            website: settings.website,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.details ||
            data?.error ||
            `AI request failed with status ${response.status}`,
        );
      }

      const aiText =
        typeof data?.response === "string"
          ? data.response
          : typeof data?.message === "string"
            ? data.message
            : "I'm sorry, I couldn't generate a response.";

      const aiMessage: Message = {
        role: "ai",
        text: aiText,
        timestamp: getTime(),
      };

      setMessages((previous) => [...previous, aiMessage]);
    } catch (error) {
      console.error("Cunag AI error:", error);

      let errorMessage =
        "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again in a moment.";

      if (error instanceof TypeError) {
        errorMessage =
          "I couldn't connect to the AI server. Please make sure the AI service is online.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text: errorMessage,
          timestamp: getTime(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const reset = () => {
    setMessages([createWelcomeMessage(user?.firstName, settings.resortName)]);

    setInput("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>

          <div>
            <h1
              className="text-foreground font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
              }}
            >
              Cunag — AI Concierge
            </h1>

            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Online · Powered by AI</span>
              <Sparkles className="w-3 h-3 text-accent" />
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {settings.resortName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-1.5 rounded-full hover:bg-muted"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      <div
        className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col"
        style={{
          height: "70vh",
          minHeight: 480,
        }}
      >
        <div
          className="flex-1 overflow-y-auto p-5 space-y-5"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  msg.role === "ai"
                    ? "bg-primary"
                    : "bg-muted border border-border"
                }`}
              >
                {msg.role === "ai" ? (
                  <Bot className="w-4 h-4 text-white" />
                ) : user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Your profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div
                className={`flex flex-col gap-2 max-w-[80%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line break-words ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                {msg.suggestions &&
                  msg.role === "ai" &&
                  msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => sendMessage(suggestion)}
                          disabled={typing}
                          className="px-2.5 py-1 bg-secondary text-primary text-[11px] font-medium rounded-full hover:bg-primary hover:text-white transition-colors border border-secondary disabled:opacity-50"
                        >
                          {suggestion}
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

              <div
                className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1"
                aria-label="Cunag is typing"
              >
                {[0, 0.15, 0.3].map((delay, index) => (
                  <span
                    key={index}
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{
                      animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-border p-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !typing) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask Cunag anything about the resort..."
              aria-label="Message Cunag"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={typing}
            />

            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || typing}
              aria-label="Send message"
              className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Cunag is an AI assistant. For urgent matters, please contact the
            resort directly.
          </p>

          <p className="text-[10px] text-muted-foreground text-center mt-1">
            {settings.phone} · {settings.email}
          </p>
        </div>
      </div>
    </div>
  );
}
