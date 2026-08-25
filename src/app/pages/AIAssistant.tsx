import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Bot, Send, User, Sparkles, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "ai";
  text: string;
  suggestions?: string[];
  timestamp: string;
}

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

export default function AIAssistant() {
  const { user } = useApp();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: `Hello${user ? `, ${user.firstName}` : ""}! 👋 I'm Cunag, your AI concierge at Sabang Beach and Diving Resort.

I can answer questions about our rooms, diving activities, services, resort facilities, and other things you would like to know about your stay.

How can I help you today?`,
      suggestions: SUGGESTIONS_INITIAL,
      timestamp: getTime(),
    },
  ]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setTyping(true);

    try {
      console.log("Sending AI request:", trimmedText);

      const response = await fetch(AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedText,
        }),
      });

      const data = await response.json();

      console.log("AI response:", data);

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

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Cunag AI error:", error);

      let errorMessage =
        "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again in a moment.";

      if (error instanceof TypeError) {
        errorMessage =
          "I couldn't connect to the AI server. Please make sure the AI service is online.";
      }

      setMessages((prev) => [
        ...prev,
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
    setMessages([
      {
        role: "ai",
        text: `Hello${user ? `, ${user.firstName}` : ""}! 👋 I'm Cunag, your AI concierge at Sabang Beach and Diving Resort.

How can I help you today?`,
        suggestions: SUGGESTIONS_INITIAL,
        timestamp: getTime(),
      },
    ]);

    setInput("");
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
          </div>
        </div>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-1.5 rounded-full hover:bg-muted"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      {/* Chat */}
      <div
        className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col"
        style={{
          height: "70vh",
          minHeight: 480,
        }}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
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
                    alt="You"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Message */}
              <div
                className={`flex flex-col gap-2 max-w-[80%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
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

                {/* Suggestions */}
                {msg.suggestions &&
                  msg.role === "ai" &&
                  msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
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

          {/* Typing indicator */}
          {typing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>

              <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
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

        {/* Input */}
        <div className="border-t border-border p-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !typing) {
                  sendMessage(input);
                }
              }}
              placeholder="Ask Cunag anything about the resort..."
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
            Cunag is an AI assistant. For urgent matters, please contact the
            resort directly.
          </p>
        </div>
      </div>
    </div>
  );
}
