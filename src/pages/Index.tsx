import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import FreeTrialBanner from "@/components/FreeTrialBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { videos } from "@/data/courses";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useHomepageAreas } from "@/hooks/useCourseAreas";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { Video } from "@/data/courses";

const Index = () => {
  const navigate = useNavigate();
  const ratings = useVideoRatings(videos.map((v) => v.id));
  const { data: trialSettings } = usePlatformSettings("free_trial");
  const showTrialBadge = trialSettings?.enabled ?? false;
  const { areas } = useHomepageAreas();
  const [areaLessons, setAreaLessons] = useState<Record<string, Video[]>>({});

  useEffect(() => {
    if (areas.length === 0) return;
    const fetchAreaLessons = async () => {
      const result: Record<string, Video[]> = {};
      for (const area of areas) {
        const { data } = await supabase
          .from("lessons")
          .select("*")
          .eq("published", true)
          .eq("admin_approved", true)
          .contains("areas", [area.name])
          .limit(20);

        if (data && data.length > 0) {
          result[area.name] = data.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description || "",
            thumbnail: l.thumbnail_url || "/placeholder.svg",
            duration: "",
            category: (l.areas as string[] || [])[0] || "",
            instructor: "",
            lessons: 1,
            level: "Iniciante" as const,
            videoUrl: l.video_url || undefined,
          }));
        }
      }
      setAreaLessons(result);
    };
    fetchAreaLessons();
  }, [areas]);

  const handleVideoClick = (id: string) => {
    navigate(`/video/${id}`);
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
          showTrialBadge={showTrialBadge}
        />

        {areas.map((area) =>
          areaLessons[area.name] && areaLessons[area.name].length > 0 ? (
            <VideoCarousel
              key={area.id}
              title={`📚 ${area.name}`}
              videos={areaLessons[area.name]}
              onVideoClick={handleVideoClick}
              showTrialBadge={showTrialBadge}
            />
          ) : null
        )}
      </div>

      <div id="pricing">
        <PricingSection />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
