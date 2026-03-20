import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Momentum Pomodoro",
  description: "Plan your focus blocks, customize breaks, and stay honest with unscheduled-break checkpoints."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

