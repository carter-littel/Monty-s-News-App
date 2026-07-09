import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Intelligence Dashboard",
  description: "A daily view of tech signals, categories, and patterns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
