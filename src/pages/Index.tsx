import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import { categories, getVideosByCategory, videos } from "@/data/courses";

const Index = () => {
  const [authOpen, setAuthOpen] = useState(false);

  const handleVideoClick = (id: string) => {
    console.log("Video clicked:", id);
    // Will navigate to video detail page later
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onLoginClick={() => setAuthOpen(true)} />
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

      <PricingSection />
      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default Index;
