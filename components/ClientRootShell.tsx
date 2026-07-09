"use client";

import { ChatContextProvider } from "@/components/ChatContext";
import { FloatingChat } from "@/components/FloatingChat";
import { SettingsButton } from "@/components/SettingsButton";

export function ClientRootShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatContextProvider>
      {children}
      <FloatingChat />
      <SettingsButton />
    </ChatContextProvider>
  );
}
