import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Marco.ai — Predictive Maintenance",
  description: "AI-powered predictive maintenance intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
