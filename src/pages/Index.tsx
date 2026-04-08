import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import FreeTrialBanner from "@/components/FreeTrialBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import VideoDetailModal from "@/components/VideoDetailModal";
import { categories, getVideosByCategory, videos, getVideoById } from "@/data/courses";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import type { Video } from "@/data/courses";

const Index = () => {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const ratings = useVideoRatings(videos.map((v) => v.id));

  const handleVideoClick = (id: string) => {
    const video = getVideoById(id);
    if (video) {
      setSelectedVideo(video);
      setModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroBanner onVideoClick={handleVideoClick} />
      <FreeTrialBanner />

      <div className="space-y-12 py-12">
        <VideoCarousel
          title="🔥 Mais Populares"
          videos={videos}
          onVideoClick={handleVideoClick}
          ratings={ratings}
        />

        {categories.map((category) => (
          <VideoCarousel
            key={category}
            title={category}
            videos={getVideosByCategory(category)}
            onVideoClick={handleVideoClick}
            ratings={ratings}
          />
        ))}
      </div>

      <div id="pricing">
        <PricingSection />
      </div>
      <Footer />

      <VideoDetailModal
        video={selectedVideo}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default Index;
