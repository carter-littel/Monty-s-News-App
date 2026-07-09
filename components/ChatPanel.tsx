"use client";

import { useState } from "react";

type ChatPanelProps = {
  context?: DesktopChatContext;
};

export function ChatPanel({ context }: ChatPanelProps) {
  const [messages, setMessages] = useState<DesktopChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesktop = typeof window !== "undefined" && Boolean(window.desktop?.chat);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !window.desktop?.chat) return;

    const history = messages;
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);

    const result = await window.desktop.chat.sendMessage({
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

  if (!isDesktop) {
    return (
      <section className="surface-card p-4 text-sm text-slate-500">
        Chat requires the desktop app.
      </section>
    );
  }

  return (
    <section className="surface-card flex h-[560px] flex-col gap-3 p-4">
      <div>
        <p className="section-kicker">Ask About This View</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Chat</h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-slate-500">
            Ask about the stories currently on screen — e.g. &ldquo;summarize the top
            story&rdquo; or &ldquo;what changed this week in AI infra?&rdquo;
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-slate-900 px-3 py-2 text-sm leading-6 text-white"
                  : "mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
              }
            >
              {message.content}
            </div>
          ))
        )}
        {sending ? <div className="text-xs text-slate-400">Thinking…</div> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask about today's news…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !input.trim()}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}
