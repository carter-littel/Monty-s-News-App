"use client";

import { useEffect, useRef, useState } from "react";
import { useChatContextValue } from "@/components/ChatContext";
import { useChatSession } from "@/hooks/useChatSession";

const BUBBLE_SIZE = 40;
const PANEL_W = 380;
const PANEL_H = 520;
const GAP = 12;
const EDGE_MARGIN = 4;

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
  const { messages, input, setInput, sending, error, isDesktop, send } = useChatSession(chatContext);

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

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [open, messages, sending]);

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
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F5F3] p-4">
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
                          : "mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700"
                      }
                    >
                      {message.content}
                    </div>
                  ))
                )}
                {sending ? <div className="text-xs text-slate-400">Thinking…</div> : null}
                <div ref={messagesEndRef} />
              </div>

              {error ? (
                <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center gap-2 border-t border-slate-200 p-3">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask about today's news…"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
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
