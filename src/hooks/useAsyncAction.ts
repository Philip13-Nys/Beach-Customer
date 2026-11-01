import { useRef, useState } from "react";

// A ref blocks a second click immediately, before React renders disabled buttons.
export function useAsyncAction() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);

  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (active.current) return;
    active.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      active.current = false;
      setPending(false);
    }
  };

  return { pending, run };
}
