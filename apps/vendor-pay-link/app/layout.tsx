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
  title: "Puesto — cobro QR con Pollar",
  description:
    "Cobra con QR en tu puesto, carrito o feria. Sin tienda, sin papeles. Pagos en USDC con Pollar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <PollarAppProvider>{children}</PollarAppProvider>
      </body>
    </html>
  );
}
