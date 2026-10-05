import { Craft } from "../sections/Craft";
import { ExploreBySpace } from "../sections/ExploreBySpace";
import { FeaturedPieces } from "../sections/FeaturedPieces";
import { Hero } from "../sections/Hero";
import { Reviews } from "../sections/Reviews";
import { Showroom } from "../sections/Showroom";

export function HomePage() {
  return (
    <div className="flex flex-col w-full">
      <Hero />
      <ExploreBySpace />
      <FeaturedPieces />
      <Craft />
      <Reviews />
      <Showroom />
    </div>
  );
}
