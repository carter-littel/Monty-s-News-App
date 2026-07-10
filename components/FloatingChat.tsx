"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChatContextValue } from "@/components/ChatContext";
import { useChatSession } from "@/hooks/useChatSession";
import { enabledProviders as enabledProvidersFrom } from "@/lib/chatProviders";

const BUBBLE_SIZE = 40;
const PANEL_W = 380;
const PANEL_H = 520;
const GAP = 12;
const EDGE_MARGIN = 4;

const PROVIDER_LABELS: Record<ChatProvider, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openai: "ChatGPT",
};

type Position = { right: number; bottom: number };

function clampPosition(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  return {
    right: Math.max(EDGE_MARGIN, Math.min(window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN, pos.right)),
    bottom: Math.max(EDGE_MARGIN, Math.min(window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN, pos.bottom)),
  };
}

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ right: 20, bottom: 20 });
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, right: 20, bottom: 20 });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mountedOpenSignalRef = useRef<number | null>(null);

  const { chatContext, openSignal } = useChatContextValue();

  const claudeSession = useChatSession("claude", chatContext);
  const geminiSession = useChatSession("gemini", chatContext);
  const openaiSession = useChatSession("openai", chatContext);
  const sessions = useMemo(
    () => ({ claude: claudeSession, gemini: geminiSession, openai: openaiSession }),
    [claudeSession, geminiSession, openaiSession],
  );

  const isDesktop = claudeSession.isDesktop;

  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [activeProvider, setActiveProvider] = useState<ChatProvider>("gemini");

  useEffect(() => {
    let mounted = true;

    if (!window.desktop) {
      return () => {
        mounted = false;
      };
    }

    void window.desktop.data.getPreferences().then((next) => {
      if (mounted) setPreferences(next);
    });
    const removeListener = window.desktop.preferences.onChanged((next) => {
      if (mounted) setPreferences(next);
    });

    return () => {
      mounted = false;
      removeListener?.();
    };
  }, []);

  const enabledProviders = useMemo(() => enabledProvidersFrom(preferences), [preferences]);

  useEffect(() => {
    if (enabledProviders.length === 0) return;
    if (!enabledProviders.includes(activeProvider)) {
      setActiveProvider(enabledProviders[0]);
    }
  }, [enabledProviders, activeProvider]);

  useEffect(() => {
    if (mountedOpenSignalRef.current === null) {
      mountedOpenSignalRef.current = openSignal;
      return;
    }
    if (openSignal !== mountedOpenSignalRef.current) {
      mountedOpenSignalRef.current = openSignal;
      setOpen(true);
    }
  }, [openSignal]);

  const activeSession = sessions[activeProvider];

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [open, activeSession.messages, activeSession.sending]);

  function startDrag(event: React.MouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging.current = true;
    dragMoved.current = false;
    dragStart.current = { mouseX: event.clientX, mouseY: event.clientY, right: pos.right, bottom: pos.bottom };

    function onMove(moveEvent: MouseEvent) {
      const dx = moveEvent.clientX - dragStart.current.mouseX;
      const dy = moveEvent.clientY - dragStart.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }
      setPos(
        clampPosition({
          right: dragStart.current.right - dx,
          bottom: dragStart.current.bottom - dy,
        }),
      );
    }

    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleBubbleClick() {
    if (dragMoved.current) return;
    setOpen((current) => !current);
  }

  return (
    <>
      {open ? (
        <section
          style={{
            position: "fixed",
            right: pos.right,
            bottom: pos.bottom + BUBBLE_SIZE + GAP,
            width: PANEL_W,
            height: PANEL_H,
            zIndex: 1000,
          }}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div
            onMouseDown={startDrag}
            className="flex cursor-grab items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 active:cursor-grabbing"
          >
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate-500">
                AI
              </p>
              <p className="text-sm font-semibold text-slate-900">Assistant</p>
            </div>
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {!isDesktop ? (
            <div className="flex-1 p-4 text-sm text-slate-500">Chat requires the desktop app.</div>
          ) : enabledProviders.length === 0 ? (
            <div className="flex-1 p-4 text-sm text-slate-500">
              No AI providers enabled.{" "}
              <Link href="/settings" className="font-medium text-slate-900 underline">
                Turn one on in Settings
              </Link>
              .
            </div>
          ) : (
            <>
              <div className="flex gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
                {enabledProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setActiveProvider(provider)}
                    className={
                      provider === activeProvider
                        ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    }
                  >
                    {PROVIDER_LABELS[provider]}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F5F3] p-4">
                {activeSession.messages.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-500">
                    Ask about the stories currently on screen — e.g. &ldquo;summarize the top
                    story&rdquo; or &ldquo;what changed this week in AI infra?&rdquo;
                  </p>
                ) : (
                  activeSession.messages.map((message, index) => (
                    <div
                      key={index}
                      className={
                        message.role === "user"
                          ? "ml-auto max-w-[85%] rounded-2xl bg-slate-900 px-3 py-2 text-sm leading-6 text-white"
                          : "mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
                      }
                    >
                      {message.content}
                    </div>
                  ))
                )}
                {activeSession.sending ? <div className="text-xs text-slate-400">Thinking…</div> : null}
                <div ref={messagesEndRef} />
              </div>

              {activeSession.error ? (
                <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {activeSession.error}
                </div>
              ) : null}

              <div className="flex items-center gap-2 border-t border-slate-200 p-3">
                <input
                  type="text"
                  value={activeSession.input}
                  onChange={(event) => activeSession.setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void activeSession.send();
                    }
                  }}
                  placeholder={`Ask ${PROVIDER_LABELS[activeProvider]} about today's news…`}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void activeSession.send()}
                  disabled={activeSession.sending || !activeSession.input.trim()}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <div
        onMouseDown={startDrag}
        onClick={handleBubbleClick}
        role="button"
        tabIndex={0}
        aria-label="Toggle AI assistant"
        style={{
          position: "fixed",
          right: pos.right,
          bottom: pos.bottom,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          zIndex: 1000,
        }}
        className="flex cursor-grab select-none items-center justify-center rounded-full border border-slate-700 bg-[#0B0F1A] text-white shadow-lg transition hover:brightness-110 active:cursor-grabbing"
      >
        <span className="text-[11px] font-mono font-bold">AI</span>
      </div>
    </>
  );
}
