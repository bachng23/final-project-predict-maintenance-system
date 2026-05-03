import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import Script from "next/script";

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
  title: "Architect Hub",
  description: "Predictive maintenance monitoring frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable} font-body`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var theme = localStorage.getItem("architect-hub-theme") || "dark";
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.dataset.theme = theme;
              } catch (e) {}
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
