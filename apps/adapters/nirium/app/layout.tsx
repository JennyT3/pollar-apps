import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PollarAppProvider } from "@/lib/pollar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nirium x402 adapter",
  description: "Pay-per-call to Nirium's API, signed by a Pollar wallet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PollarAppProvider>{children}</PollarAppProvider>
      </body>
    </html>
  );
}
