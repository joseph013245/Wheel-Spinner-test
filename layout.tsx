import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blanket Banquet 2025 Twist",
  description: "A multiplayer twist on the Blanket Banquet 2025 game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}