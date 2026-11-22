import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NcPortalPage } from "@/components/neighborhood/NcPortalPage";
import { NC_PORTALS, ncPortal } from "@/lib/nc-portals";

export const dynamicParams = false;
export function generateStaticParams() { return NC_PORTALS.map(({ slug }) => ({ slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const portal = ncPortal(params.slug);
  return { title: portal ? `${portal.title} | The Neighborhood Chronicles` : "Page not found",
    robots: { index: false, follow: true }, openGraph: { images: ["/neighborhood/og.jpg"] } };
}
export default function NcPrintedPage({ params }: { params: { slug: string } }) {
  const portal = ncPortal(params.slug);
  if (!portal) notFound();
  return <NcPortalPage portal={portal} />;
}
