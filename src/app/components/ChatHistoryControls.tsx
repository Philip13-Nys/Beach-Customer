import { useState } from "react";
import {
  Check,
  ChevronDown,
  CloudOff,
  History,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useChat } from "../context/ChatContext";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function ChatHistoryControls({
  showNew = false,
}: {
  showNew?: boolean;
}) {
  const chat = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const storageUnavailable =
    /browser storage|storage is full|keep this tab|available in this tab/i.test(
      chat.error,
    );

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-white px-3 py-2 text-xs">
      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={chat.loading}
            aria-label="Open conversation history"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
          >
            <History aria-hidden="true" className="h-3.5 w-3.5" />
            History
            <ChevronDown aria-hidden="true" className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-2"
        >
          <p className="px-2 py-2 text-xs font-semibold text-foreground">
            Your conversations
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {chat.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                aria-pressed={session.id === chat.currentId}
                onClick={() => {
                  chat.select(session.id);
                  setHistoryOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                  session.id === chat.currentId
                    ? "bg-secondary font-medium text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                {session.id === chat.currentId && (
                  <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            ))}
          </div>
          <p className="px-2 pt-3 pb-1 text-[11px] leading-relaxed text-muted-foreground">
            Starting a new chat keeps your previous conversations here.
          </p>
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-1">
        {chat.loading ? (
          <span
            role="status"
            className="px-2 text-[11px] text-muted-foreground"
          >
            Loading…
          </span>
        ) : chat.error ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={
                  storageUnavailable
                    ? "Chat storage warning"
                    : "Cloud sync paused: view details"
                }
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-amber-700 transition-colors hover:bg-amber-50"
              >
                <CloudOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span role="status" className="hidden min-[360px]:inline">
                  {storageUnavailable ? "Storage issue" : "Sync paused"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={16}
              className="w-[min(19rem,calc(100vw-2rem))] rounded-2xl p-4"
            >
              <p className="text-sm font-medium text-foreground">
                {storageUnavailable
                  ? "Chat storage unavailable"
                  : "Cloud sync is paused"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {chat.error}
              </p>
              <button
                type="button"
                onClick={chat.retrySync}
                disabled={chat.loading}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-primary hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Retry
                sync
              </button>
            </PopoverContent>
          </Popover>
        ) : null}
        {showNew && (
          <button
            type="button"
            disabled={chat.loading}
            onClick={chat.startNew}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 font-medium text-primary transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>
    </div>
  );
}
