import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CERTIFICATE_DOWNLOAD_NAME, CERTIFICATE_PDF, CERTIFICATE_PREVIEW } from "@/lib/certificate";

// next/link and next/image need the Next runtime; only the markup they produce matters here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

const { CertificateDownload } = await import("@/components/certificate/CertificateDownload");
const page = await import("@/app/certificate/page");

describe("CertificateDownload", () => {
  const html = renderToStaticMarkup(<CertificateDownload />);

  it("links straight to the PDF as a download, with no sign-in or checkout", () => {
    expect(html).toContain(`href="${CERTIFICATE_PDF}"`);
    expect(html).toContain(`download="${CERTIFICATE_DOWNLOAD_NAME}"`);
    expect(html).not.toMatch(/checkout|sign in/i);
  });

  it("shows the certificate and how to print it", () => {
    expect(html).toContain(`data-src="${CERTIFICATE_PREVIEW}"`);
    expect(html).toContain("US Letter");
  });

  it("leads back to the storefront", () => {
    expect(html).toMatch(/<a href="\/"[^>]*>← Return to Book 1 Storefront/);
  });
});

describe("/certificate route", () => {
  it("renders the download page and stays out of search results, like the other printed addresses", () => {
    expect(page.metadata.robots).toEqual({ index: false, follow: true });
    expect(renderToStaticMarkup(<page.default />)).toBe(renderToStaticMarkup(<CertificateDownload />));
  });
});
