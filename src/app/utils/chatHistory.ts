export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  createdAt: number;
  timestamp: string;
};
export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};
export type ChatArchive = {
  version: 1;
  currentId: string;
  sessions: ChatSession[];
};

export function chatId() {
  return crypto.randomUUID();
}
export function newSession(): ChatSession {
  const now = Date.now();
  return {
    id: chatId(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}
export function emptyArchive(): ChatArchive {
  const session = newSession();
  return { version: 1, currentId: session.id, sessions: [session] };
}
export function mergeChatMessages(...groups: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of groups.flat()) {
    if (
      message &&
      typeof message.id === "string" &&
      ["user", "ai"].includes(message.role) &&
      typeof message.text === "string" &&
      Number.isFinite(message.createdAt)
    )
      byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}
export function readChatArchive(value: string | null): ChatArchive {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.version === 1 && Array.isArray(parsed.sessions)) {
        const sessions: ChatSession[] = parsed.sessions
          .filter((s: ChatSession) => s && typeof s.id === "string")
          .map((s: ChatSession) => ({
            ...s,
            title: String(s.title || "Conversation"),
            messages: mergeChatMessages(
              Array.isArray(s.messages) ? s.messages : [],
            ),
          }));
        if (sessions.length)
          return {
            version: 1,
            currentId: sessions.some((s) => s.id === parsed.currentId)
              ? parsed.currentId
              : sessions[0].id,
            sessions,
          };
      }
    } catch {
      /* Invalid local data must not crash the chatbot. */
    }
  }
  return emptyArchive();
}
