import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { Hero } from "@/components/retail/Hero";
import { IllustrationGallery } from "@/components/retail/IllustrationGallery";
import { BookDetails } from "@/components/retail/BookDetails";
import { AboutAuthor } from "@/components/retail/AboutAuthor";
import { ShippingReturns } from "@/components/retail/ShippingReturns";
import { BOOK1_VIRTUE_BADGES, VirtueMarquee } from "@/components/motion/VirtueMarquee";

export default function RetailLandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <VirtueMarquee badges={BOOK1_VIRTUE_BADGES} />
        <IllustrationGallery />
        <BookDetails />
        <AboutAuthor />
        <ShippingReturns />
      </main>
      <SiteFooter />
    </>
  );
}
