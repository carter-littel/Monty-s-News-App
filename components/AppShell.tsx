import { ReactNode } from "react";
import { SidebarNav } from "@/components/SidebarNav";

type AppShellProps = {
  children: ReactNode;
  aside?: ReactNode;
  activePath?: string;
};

export function AppShell({ children, aside, activePath }: AppShellProps) {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <SidebarNav activePath={activePath} />
        <div className="min-w-0">{children}</div>
        {aside ? (
          <div className="hidden max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain pr-1 xl:sticky xl:top-6 xl:block xl:self-start">
            {aside}
          </div>
        ) : null}
      </div>
    </main>
  );
}
