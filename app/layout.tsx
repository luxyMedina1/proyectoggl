import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "../styles/legacy.scss";
import { Providers } from "./providers";
import { AppGate } from "../components/AppGate";

const TITLE_APP = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";
const DESCRIPCION = "Compra boletos para conciertos, deportes y espectaculos.";

export const metadata: Metadata = {
  title: TITLE_APP,
  description: DESCRIPCION,
  icons: { icon: "/logo.svg" },
  openGraph: {
    type: "website",
    siteName: TITLE_APP,
    title: TITLE_APP,
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          strategy="afterInteractive"
        />
        <Providers>
          <AppGate>{children}</AppGate>
        </Providers>
      </body>
    </html>
  );
}
