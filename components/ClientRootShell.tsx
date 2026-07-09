"use client";

import { ChatContextProvider } from "@/components/ChatContext";
import { FloatingChat } from "@/components/FloatingChat";

export function ClientRootShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatContextProvider>
      {children}
      <FloatingChat />
    </ChatContextProvider>
  );
}
