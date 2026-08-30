import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Script from "next/script";
import { Poppins } from "next/font/google";
import "./globals.css";
import "../styles/legacy.scss";
import { Providers } from "./providers";
import { AppGate } from "../components/AppGate";
import { getSiteConfig } from "@/lib/config/getSiteConfig";

// next/font descarga Poppins en build y la sirve desde nuestro dominio: el
// navegador ya no habla con fonts.googleapis.com / fonts.gstatic.com, no se
// bloquea el render y Next genera una fuente de respaldo con metricas ajustadas
// (CLS por fuentes = 0). Se declara a nivel de modulo con argumentos literales
// porque Next lo analiza en build. Pesos = los que de verdad usa el repo.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-poppins",
});

const TITLE_APP = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";
const DESCRIPCION = "Compra boletos para conciertos, deportes y espectaculos.";
// Dominio publico del sitio. Necesario para que las URLs relativas de las
// imagenes de Open Graph se resuelvan absolutas (si no, las redes no las cargan).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

// El título y la descripción de marca vienen del backend (config:sitio). La
// imagen OG de respaldo la aporta app/opengraph-image.tsx; no se declara `images`
// aquí porque pisaría la generada.
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteConfig();
  const nombre = config?.nombreMarca?.trim() || TITLE_APP;
  const descripcion =
    (config?.descripcion as string | undefined)?.trim() ||
    (config?.descripcionMarca as string | undefined)?.trim() ||
    DESCRIPCION;
  const favicon = (config?.imagenTabNavegador as string | undefined) || "/logo.svg";

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: nombre, template: `%s | ${nombre}` },
    description: descripcion,
    icons: { icon: favicon },
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: nombre,
      title: nombre,
      description: descripcion,
      locale: "es_MX",
    },
    twitter: {
      card: "summary_large_image",
      title: nombre,
      description: descripcion,
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { config, colors } = await getSiteConfig();

  // Los colores de marca entran en el HTML inicial → se va el salto de colores
  // por defecto → marca. Mismas 5 CSS vars que ponía applyColorsToDocument().
  const brandVars = {
    "--color-emphasis": colors.emphasis,
    "--color-accent-base": colors.accentBase,
    "--color-accent-light": colors.accentLight,
    "--color-neutral": colors.neutral,
    "--color-darker": colors.darker,
  } as CSSProperties;

  return (
    <html lang="es" className={`${poppins.variable} h-full`} style={brandVars}>
      <head>
        {/* Abrir pronto la conexión (DNS + TLS) al bucket de S3: es el origen del
            LCP en las rutas de evento (imagen de promoción / portada). Ahorra
            ~1 RTT antes de la primera descarga de imagen. */}
        <link
          rel="preconnect"
          href="https://taquilla-v2-files.s3.us-east-1.amazonaws.com"
          crossOrigin=""
        />
        {/* Los SDK de login (Google / Apple) cargan `afterInteractive`; resolver
            su DNS por adelantado evita que el primer clic en "Iniciar sesión"
            pague la latencia de resolución. */}
        <link rel="dns-prefetch" href="https://accounts.google.com" />
        <link rel="dns-prefetch" href="https://appleid.cdn-apple.com" />
      </head>
      <body className="min-h-full flex flex-col antialiased font-sans">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          strategy="afterInteractive"
        />
        <Providers configInicial={config} coloresIniciales={colors}>
          <AppGate>{children}</AppGate>
        </Providers>
      </body>
    </html>
  );
}
