import type { Metadata } from "next";
import { Old_Standard_TT, Cutive_Mono } from "next/font/google";
import "./globals.css";

const oldStandard = Old_Standard_TT({
  variable: "--font-old-standard",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const cutiveMono = Cutive_Mono({
  variable: "--font-cutive",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Manav",
  description: "Welcome, stranger.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${oldStandard.variable} ${cutiveMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
