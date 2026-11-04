import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { collection, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { auth, customerDb } from "../components/firebase";
import { useApp } from "./AppContext";
import {
  chatId,
  emptyArchive,
  mergeChatMessages,
  newSession,
  readChatArchive,
  type ChatArchive,
  type ChatMessage,
} from "../utils/chatHistory";

type ChatContextValue = {
  messages: ChatMessage[];
  sessions: ChatArchive["sessions"];
  currentId: string;
  loading: boolean;
  busy: boolean;
  error: string;
  send: (
    text: string,
    endpoint: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  startNew: () => void;
  select: (id: string) => void;
  retrySync: () => void;
};
const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, authLoading } = useApp();
  const owner = authLoading
    ? "loading"
    : auth.currentUser?.uid || user?.id || "guest";
  const ownerRef = useRef("loading");
  const archiveRef = useRef<ChatArchive | null>(null);
  const [view, setView] = useState<{
    owner: string;
    archive: ChatArchive | null;
  }>({ owner: "loading", archive: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const requests = useRef(new Map<string, AbortController>());
  const restoreRemoteSelection = useRef(false);
  const [retry, setRetry] = useState(0);
  const storageKey = (identity: string) => `cbr_chat_v1_${identity}`;

  const commit = useCallback((next: ChatArchive, identity: string) => {
    if (ownerRef.current !== identity) return;
    archiveRef.current = next;
    setView({ owner: identity, archive: next });
    try {
      localStorage.setItem(storageKey(identity), JSON.stringify(next));
    } catch {
      setError(
        "Chat is available in this tab, but browser storage is full or unavailable.",
      );
    }
  }, []);

  const saveMessages = useCallback(
    async (identity: string, sessionId: string, messages: ChatMessage[]) => {
      if (
        identity === "guest" ||
        identity === "loading" ||
        auth.currentUser?.uid !== identity
      )
        return;
      const session = archiveRef.current?.sessions.find(
        (s) => s.id === sessionId,
      );
      if (!session) return;
      // Small batches keep large archived conversations below Firestore batch limits.
      for (let start = 0; start < Math.max(1, messages.length); start += 200) {
        if (ownerRef.current !== identity) return;
        const batch = writeBatch(customerDb);
        const parent = doc(
          customerDb,
          "Users",
          identity,
          "chatSessions",
          sessionId,
        );
        batch.set(
          parent,
          {
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          },
          { merge: true },
        );
        for (const message of messages.slice(start, start + 200)) {
          batch.set(doc(collection(parent, "messages"), message.id), message);
        }
        await batch.commit();
      }
    },
    [],
  );

  useEffect(() => {
    ownerRef.current = owner;
    setError("");
    setBusyIds([...requests.current.keys()]);
    if (owner === "loading") {
      setLoading(true);
      archiveRef.current = null;
      return;
    }
    let cached: ChatArchive;
    try {
      const saved = localStorage.getItem(storageKey(owner));
      restoreRemoteSelection.current = !saved;
      cached = readChatArchive(saved);
    } catch {
      cached = emptyArchive();
      setError(
        "Browser storage is unavailable. Keep this tab open until your chat is saved.",
      );
    }
    commit(cached, owner);
    setLoading(owner !== "guest");
    if (owner === "guest") return;
    let active = true;
    const stop = onSnapshot(
      collection(customerDb, "Users", owner, "chatSessions"),
      (snapshot) => {
        if (!active || ownerRef.current !== owner) return;
        const current = archiveRef.current!;
        const sessions = new Map(current.sessions.map((s) => [s.id, s]));
        const remote = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || "Conversation"),
            createdAt: Number(data.createdAt || 0),
            updatedAt: Number(data.updatedAt || 0),
          };
        });
        for (const data of remote) {
          const previous = sessions.get(data.id);
          sessions.set(data.id, {
            id: data.id,
            title: String(data.title || "Conversation"),
            createdAt: Number(data.createdAt || 0),
            updatedAt: Number(data.updatedAt || 0),
            messages: previous?.messages || [],
          });
        }
        const latestRemote = [...remote].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        )[0];
        const currentSession = sessions.get(current.currentId);
        const currentId =
          restoreRemoteSelection.current && !currentSession?.messages.length
            ? latestRemote?.id || current.currentId
            : current.currentId;
        restoreRemoteSelection.current = false;
        commit(
          { ...current, currentId, sessions: [...sessions.values()] },
          owner,
        );
        setLoading(false);
      },
      (err) => {
        console.error("Could not load chat conversations:", err);
        if (active && ownerRef.current === owner) {
          setLoading(false);
          setError(
            "Cloud chat history is unavailable. Your conversation is kept on this device; retry to sync.",
          );
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [owner, retry, commit]);

  useEffect(
    () => () => {
      requests.current.forEach((controller) => controller.abort());
      requests.current.clear();
    },
    [owner],
  );

  const archive = view.owner === owner ? view.archive : null;
  const currentId = archive?.currentId || "";
  useEffect(() => {
    if (owner === "loading" || owner === "guest" || !currentId) return;
    let active = true;
    let attemptedLocalSync = false;
    return (() => {
      const stop = onSnapshot(
        collection(
          customerDb,
          "Users",
          owner,
          "chatSessions",
          currentId,
          "messages",
        ),
        (snapshot) => {
          if (!active || ownerRef.current !== owner) return;
          const current = archiveRef.current!;
          const session = current.sessions.find((s) => s.id === currentId);
          if (!session) return;
          const remote = snapshot.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as ChatMessage,
          );
          const messages = mergeChatMessages(session.messages, remote);
          commit(
            {
              ...current,
              sessions: current.sessions.map((s) =>
                s.id === currentId ? { ...s, messages } : s,
              ),
            },
            owner,
          );
          if (!attemptedLocalSync) {
            attemptedLocalSync = true;
            const remoteIds = new Set(remote.map((m) => m.id));
            const missing = session.messages.filter(
              (m) => !remoteIds.has(m.id),
            );
            if (missing.length)
              void saveMessages(owner, currentId, missing).catch(() => {
                if (ownerRef.current === owner)
                  setError(
                    "Some messages are saved only on this device. Retry to sync them.",
                  );
              });
          }
        },
        (err) => {
          console.error("Could not load chat messages:", err);
          if (active && ownerRef.current === owner)
            setError(
              "Cloud messages could not be loaded. Device history remains available; retry to sync.",
            );
        },
      );
      return () => {
        active = false;
        stop();
      };
    })();
  }, [owner, currentId, retry, commit, saveMessages]);

  const append = (
    identity: string,
    sessionId: string,
    message: ChatMessage,
  ) => {
    const current = archiveRef.current;
    if (ownerRef.current !== identity || !current) return;
    commit(
      {
        ...current,
        sessions: current.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: s.messages.length ? s.title : message.text.slice(0, 70),
                updatedAt: message.createdAt,
                messages: mergeChatMessages(s.messages, [message]),
              }
            : s,
        ),
      },
      identity,
    );
    void saveMessages(identity, sessionId, [message]).catch((err) => {
      console.error("Could not save chat message:", err);
      if (ownerRef.current === identity)
        setError(
          "Messages are saved on this device. Cloud sync failed; retry to sync.",
        );
    });
  };

  const send = async (
    text: string,
    endpoint: string,
    payload: Record<string, unknown>,
  ) => {
    const identity = owner;
    const sessionId = archiveRef.current?.currentId;
    if (
      !text.trim() ||
      loading ||
      !sessionId ||
      identity === "loading" ||
      ownerRef.current !== identity ||
      requests.current.has(sessionId)
    )
      return;
    const controller = new AbortController();
    requests.current.set(sessionId, controller);
    setBusyIds([...requests.current.keys()]);
    const last =
      archiveRef.current?.sessions
        .find((s) => s.id === sessionId)
        ?.messages.at(-1)?.createdAt || 0;
    const userTime = Math.max(Date.now(), last + 1);
    const message = (
      role: "user" | "ai",
      value: string,
      createdAt: number,
    ): ChatMessage => ({
      id: chatId(),
      role,
      text: value,
      createdAt,
      timestamp: new Date(createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    append(identity, sessionId, message("user", text.trim(), userTime));
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, message: text.trim() }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data?.details ||
            data?.error ||
            `AI request failed (HTTP ${response.status}).`,
        );
      const reply =
        typeof data.response === "string"
          ? data.response
          : typeof data.message === "string"
            ? data.message
            : "I'm sorry, I couldn't generate a response.";
      if (!controller.signal.aborted)
        append(
          identity,
          sessionId,
          message("ai", reply, Math.max(Date.now(), userTime + 1)),
        );
    } catch (err) {
      if (!controller.signal.aborted)
        append(
          identity,
          sessionId,
          message(
            "ai",
            "Sorry, the AI service is unavailable right now. Please try again.",
            Math.max(Date.now(), userTime + 1),
          ),
        );
    } finally {
      if (requests.current.get(sessionId) === controller)
        requests.current.delete(sessionId);
      if (ownerRef.current === identity)
        setBusyIds([...requests.current.keys()]);
    }
  };

  const startNew = () => {
    if (
      !archiveRef.current ||
      ownerRef.current !== owner ||
      owner === "loading"
    )
      return;
    const session = newSession();
    restoreRemoteSelection.current = false;
    commit(
      {
        ...archiveRef.current,
        currentId: session.id,
        sessions: [session, ...archiveRef.current.sessions],
      },
      owner,
    );
    void saveMessages(owner, session.id, []).catch(() => {
      if (ownerRef.current === owner)
        setError(
          "New conversation is saved on this device; cloud sync is unavailable.",
        );
    });
  };
  const select = (id: string) => {
    restoreRemoteSelection.current = false;
    if (archiveRef.current?.sessions.some((s) => s.id === id))
      commit({ ...archiveRef.current, currentId: id }, owner);
  };
  const retrySync = () => {
    setError("");
    setRetry((value) => value + 1);
    for (const session of archiveRef.current?.sessions || []) {
      void saveMessages(owner, session.id, session.messages).catch(() => {
        if (ownerRef.current === owner)
          setError(
            "Cloud chat sync is still unavailable. Your device history is preserved.",
          );
      });
    }
  };
  return (
    <ChatContext.Provider
      value={{
        messages:
          archive?.sessions.find((s) => s.id === currentId)?.messages || [],
        sessions: archive?.sessions || [],
        currentId,
        loading: loading || !archive,
        busy: busyIds.includes(currentId),
        error,
        send,
        startNew,
        select,
        retrySync,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside ChatProvider");
  return value;
}
