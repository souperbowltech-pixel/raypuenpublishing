import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { book1, shareImage, siteMeta } from "@/lib/book";
import { getSiteOrigin } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: `${siteMeta.name} — Children's Coloring Books`,
  description: siteMeta.description,
  openGraph: {
    type: "website",
    siteName: siteMeta.name,
    title: `${book1.title}, ${book1.tagline}`,
    description: siteMeta.description,
    images: [{ ...shareImage, alt: book1.coverImage.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${book1.title}, ${book1.tagline}`,
    description: siteMeta.description,
    images: [shareImage.url],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/puen-colophon.png", type: "image/png" }
    ],
    apple: [
      { url: "/brand/puen-colophon.png" }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks that script runs, before first paint, so motion can hold its
            starting pose without hiding anything from a browser without it. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
