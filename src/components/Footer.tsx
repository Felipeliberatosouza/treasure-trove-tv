import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import type { ContactSettings, BrandingSettings } from "@/hooks/usePlatformSettings";

const Footer = () => {
  const { settings } = useAllPlatformSettings();
  const contact = settings.contact as ContactSettings | undefined;
  const branding = settings.branding as BrandingSettings | undefined;
  const name = branding?.platform_name || "Revisão Fácil";

  return (
    <footer className="border-t border-border px-6 py-10 md:px-12 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
        <span className="font-display text-lg font-bold text-gradient">{name}</span>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="/sobre" className="hover:text-foreground transition-colors">Sobre</a>
          <a href="/termos" className="hover:text-foreground transition-colors">Termos</a>
          <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
          <a href="/contato" className="hover:text-foreground transition-colors">Contato</a>
        </div>
        <div className="flex gap-4 text-muted-foreground">
          {contact?.instagram && (
            <a href={`https://instagram.com/${contact.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-xs">Instagram</a>
          )}
          {contact?.youtube && (
            <a href={contact.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-xs">YouTube</a>
          )}
          {contact?.facebook && (
            <a href={contact.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-xs">Facebook</a>
          )}
          {contact?.twitter && (
            <a href={`https://x.com/${contact.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors text-xs">X</a>
          )}
        </div>
        <span className="text-xs text-muted-foreground">© 2026 {name}. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
};

export default Footer;
