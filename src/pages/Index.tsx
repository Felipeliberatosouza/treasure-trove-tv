import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import { categories, getVideosByCategory, videos } from "@/data/courses";

const Index = () => {
  const handleVideoClick = (id: string) => {
    console.log("Video clicked:", id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroBanner onVideoClick={handleVideoClick} />

      <div className="space-y-12 py-12">
        <VideoCarousel
          title="🔥 Mais Populares"
          videos={videos}
          onVideoClick={handleVideoClick}
        />

        {categories.map((category) => (
          <VideoCarousel
            key={category}
            title={category}
            videos={getVideosByCategory(category)}
            onVideoClick={handleVideoClick}
          />
        ))}
      </div>

      <div id="pricing">
        <PricingSection />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
