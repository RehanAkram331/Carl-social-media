import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Post Studio",
  description: "Upload, edit, approve & publish social media posts",
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
