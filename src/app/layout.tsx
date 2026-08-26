import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteConfig();

  const siteName = config?.nombreMarca || process.env.TITLE_APP || "Taquilla Vip";
  const description =
    (config?.descripcion as string | undefined) ||
    (config?.descripcionMarca as string | undefined) ||
    "Compra boletos para conciertos, deportes y espectaculos.";
  const image = (config?.imagenCompartir as string | undefined) || (config?.logo as string | undefined);
  const baseUrl = config?.dominio || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(baseUrl),
    title: { default: siteName, template: `%s | ${siteName}` },
    description,
    icons: config?.imagenTabNavegador ? { icon: config.imagenTabNavegador as string } : undefined,
    openGraph: {
      siteName,
      title: siteName,
      description,
      type: "website",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: siteName,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { colors } = await getSiteConfig();

  const brandVars = {
    "--brand-emphasis": colors.emphasis,
    "--brand-accent-base": colors.accentBase,
    "--brand-accent-light": colors.accentLight,
    "--brand-neutral": colors.neutral,
    "--brand-darker": colors.darker,
  } as React.CSSProperties;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={brandVars}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
