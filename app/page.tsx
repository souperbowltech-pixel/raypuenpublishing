import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { Hero } from "@/components/retail/Hero";
import { IllustrationGallery } from "@/components/retail/IllustrationGallery";
import { BookDetails } from "@/components/retail/BookDetails";
import { AboutAuthor } from "@/components/retail/AboutAuthor";
import { ShippingReturns } from "@/components/retail/ShippingReturns";

export default function RetailLandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <IllustrationGallery />
        <BookDetails />
        <AboutAuthor />
        <ShippingReturns />
      </main>
      <SiteFooter />
    </>
  );
}
