import { Link } from "react-router-dom";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import defaultBg from "@/assets/teacher-banner-bg.jpg";

interface TeacherBannerSettings {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  background_image_url: string;
}

const TeacherBanner = () => {
  const { data } = usePlatformSettings("teacher_banner" as any);
  const settings = data as unknown as TeacherBannerSettings | null;

  const title = settings?.title || "Você é Professor?";
  const subtitle = settings?.subtitle || "Faça parte da Revisão Fácil! Ganhe conosco!";
  const ctaText = settings?.cta_text || "Cadastre-se como Professor";
  const ctaLink = settings?.cta_link || "/cadastro-professor";
  const bgImage = settings?.background_image_url || defaultBg;

  return (
    <section
      className="relative w-full py-16 md:py-20 overflow-hidden"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-background/60" />
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 gap-4">
        <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          {title}
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
          {subtitle}
        </p>
        <Link
          to={ctaLink}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
        >
          {ctaText}
        </Link>
      </div>
    </section>
  );
};

export default TeacherBanner;
