const Footer = () => (
  <footer className="border-t border-border px-6 py-10 md:px-12 lg:px-20">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
      <span className="font-display text-lg font-bold text-gradient">Revisão Fácil</span>
      <div className="flex gap-6 text-sm text-muted-foreground">
        <a href="/sobre" className="hover:text-foreground transition-colors">Sobre</a>
        <a href="/termos" className="hover:text-foreground transition-colors">Termos</a>
        <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
        <a href="#" className="hover:text-foreground transition-colors">Contato</a>
      </div>
      <span className="text-xs text-muted-foreground">© 2026 Revisão Fácil. Todos os direitos reservados.</span>
    </div>
  </footer>
);

export default Footer;
