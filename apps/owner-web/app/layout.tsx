import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FocusModality } from "@/components/focus-modality";

export const metadata: Metadata = {
  title: "Dunia Corndog — Ruang usaha",
  description:
    "Prototipe frontend operasional Dunia Corndog. Seluruh data adalah data demo.",
  other: { "page-type": "software", "site-kind": "software" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF9F6",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      data-type="software"
      data-radius="soft"
      data-buttons="solid"
      data-motion=""
    >
      <head>
        <link rel="stylesheet" href="/assets/motion/motion.css" />
        <link
          rel="preload"
          href="/fonts/HostGrotesk-Variable.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Lewati ke konten
        </a>
        <FocusModality />
        {children}
      </body>
    </html>
  );
}
