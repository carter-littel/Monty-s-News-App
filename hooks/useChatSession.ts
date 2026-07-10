"use client";

import { useState } from "react";

export function useChatSession(provider: ChatProvider, context: DesktopChatContext | undefined) {
  const [messages, setMessages] = useState<DesktopChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop?.chat);

  const send = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending || !window.desktop?.chat) return;

    const history = messages;
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);

    const result = await window.desktop.chat.sendMessage({
      provider,
      message: trimmed,
      history,
      context,
    });

    setSending(false);

    if (result.success && result.message) {
      setMessages((current) => [...current, result.message as DesktopChatMessage]);
    } else {
      setError(result.error ?? "Chat is unavailable");
    }
  };

  return { messages, input, setInput, sending, error, isDesktop, send };
}
