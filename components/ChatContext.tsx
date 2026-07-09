"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ChatContextValue = {
  chatContext: DesktopChatContext;
  setChatContext: (context: DesktopChatContext) => void;
  openSignal: number;
  requestOpen: () => void;
};

const EMPTY_CONTEXT: DesktopChatContext = { articles: [] };

const ChatContextContext = createContext<ChatContextValue | null>(null);

export function ChatContextProvider({ children }: { children: React.ReactNode }) {
  const [chatContext, setChatContext] = useState<DesktopChatContext>(EMPTY_CONTEXT);
  const [openSignal, setOpenSignal] = useState(0);

  const requestOpen = useCallback(() => {
    setOpenSignal((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({ chatContext, setChatContext, openSignal, requestOpen }),
    [chatContext, openSignal, requestOpen],
  );

  return <ChatContextContext.Provider value={value}>{children}</ChatContextContext.Provider>;
}

function useChatContextInternal() {
  const value = useContext(ChatContextContext);
  if (!value) {
    throw new Error("useChatContext hooks must be used within a ChatContextProvider");
  }
  return value;
}

export function useSetChatContext(context: DesktopChatContext) {
  const { setChatContext } = useChatContextInternal();
  useEffect(() => {
    setChatContext(context);
  }, [context, setChatContext]);
}

export function useChatContextValue() {
  const { chatContext, openSignal } = useChatContextInternal();
  return { chatContext, openSignal };
}

export function useOpenChat() {
  const { setChatContext, requestOpen } = useChatContextInternal();
  return useCallback(
    (context?: DesktopChatContext) => {
      if (context) {
        setChatContext(context);
      }
      requestOpen();
    },
    [setChatContext, requestOpen],
  );
}
