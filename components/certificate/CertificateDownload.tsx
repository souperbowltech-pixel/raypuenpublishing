import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { CERTIFICATE_DOWNLOAD_NAME, CERTIFICATE_PDF, CERTIFICATE_PREVIEW } from "@/lib/certificate";

/**
 * puenpublishing.com/certificate: the colour certificate, free to download.
 *
 * Parents reach it from the line printed under the black and white certificate
 * on the last page of Book 1. No sign-in and no checkout: the download link is a
 * plain file in /public, so it works on any phone or computer.
 */
export function CertificateDownload() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">For Every Explorer Who Finished the Journey</span>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black font-display text-ink">
            Your Color Graduation Certificate
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-ink-soft leading-relaxed">
            Download the full color certificate for free and print it at home. Write your
            explorer&apos;s name and the date on the lines, and it is ready to frame.
          </p>

          <a
            href={CERTIFICATE_PDF}
            download={CERTIFICATE_DOWNLOAD_NAME}
            className="btn-primary mt-8 inline-block px-8 py-3.5 text-base"
          >
            Download the Certificate (PDF)
          </a>

          <div className="mx-auto mt-10 max-w-md overflow-hidden rounded-2xl border-2 border-ink/10 shadow-card">
            <Image
              src={CERTIFICATE_PREVIEW}
              alt="The Geezy Goober graduation certificate in full color"
              width={900}
              height={1165}
              className="h-auto w-full"
              priority
            />
          </div>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl bg-paper-deep p-6 text-left text-sm text-ink-soft">
            <h2 className="font-display text-lg font-bold text-ink">Printing tips</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Use US Letter paper (8.5 x 11 inches) and a color printer.</li>
              <li>Choose &quot;Actual size&quot; or &quot;Fit to page&quot; in the print window.</li>
              <li>Thick or photo paper makes the colors brighter and the certificate last longer.</li>
              <li>On an iPhone or iPad, the PDF opens on screen: tap Share, then Print or Save to Files.</li>
              <li>No printer at home? Any print shop or library can print the PDF for you.</li>
            </ul>
          </div>

          <div className="mt-12 text-xs text-ink-soft">
            <Link href="/" className="font-semibold text-spruce hover:underline">
              ← Return to Book 1 Storefront
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
