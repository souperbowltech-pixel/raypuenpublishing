import type { Metadata } from "next";
import { CertificateDownload } from "@/components/certificate/CertificateDownload";

/**
 * puenpublishing.com/certificate: printed under the certificate in Book 1, so
 * this address is fixed forever. The page is static; nothing here reads the
 * database.
 */
export const metadata: Metadata = {
  title: "Graduation Certificate | The Geezy Goober Explorer Fleet",
  // A print destination, not a page anyone should reach from a search result.
  robots: { index: false, follow: true },
};

export default function CertificatePage() {
  return <CertificateDownload />;
}
