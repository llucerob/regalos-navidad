import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Regalos de Navidad · Municipalidad de Coinco",
    template: "%s · Municipalidad de Coinco",
  },
  description:
    "Inscripción a la entrega de Regalos de Navidad para madres en gestación, niñas y niños de la comuna de Coinco.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#003169", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
