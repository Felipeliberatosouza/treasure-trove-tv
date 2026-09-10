import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect } from "react";

const fallbackSections = [
  { title: "1. Introdução", content: "A Revisão Fácil valoriza a privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais." },
];

/** Normalize a title into a URL-safe anchor id. */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\.\s*/, "") // strip leading "12. "
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sectionId = (sec: { id?: string; title?: string }, idx: number) =>
  sec.id?.trim() || (sec.title ? slugify(sec.title) : `secao-${idx + 1}`);

const PrivacyPolicy = () => {
  const { data, loading } = usePlatformSettings("privacy_policy");
  const sections = data?.sections?.length ? data.sections : fallbackSections;

  // Smooth-scroll to hash anchor after sections render
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, sections.length]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-3xl space-y-8">
          <h1 className="font-display text-3xl font-bold text-gradient">Política de Privacidade</h1>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((sec, idx) => {
                const id = sectionId(sec, idx);
                return (
                  <section key={idx} id={id} className="space-y-2 scroll-mt-24">
                    {sec.title && <h2 className="text-xl font-semibold">{sec.title}</h2>}
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{sec.content}</p>
                  </section>
                );
              })}

              {/* Google User Data disclosure — required for Google API Services User Data Policy compliance */}
              <div className="pt-6 border-t border-border space-y-6">
                <h2 className="text-xl font-semibold">Dados de Usuário do Google</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Esta seção descreve como a Revisão Fácil acessa, utiliza, armazena, compartilha e exclui os
                  dados de usuário do Google, em conformidade com a Política de Dados de Usuário dos Serviços
                  da API do Google e os Termos de Serviço das APIs do Google.
                </p>

                <section id="dados-acessados-google" className="space-y-2 scroll-mt-24">
                  <h3 className="text-lg font-semibold">Dados acessados</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Ao utilizar o recurso "Entrar com Google", solicitamos autorização para acessar os
                    seguintes dados da sua conta Google, por meio dos escopos do OAuth 2.0:{" "}
                    <code className="text-sm">openid</code>,{" "}
                    <code className="text-sm">userinfo.email</code> e{" "}
                    <code className="text-sm">userinfo.profile</code>. Os dados acessados são: nome público
                    exibido na sua conta Google, endereço de e-mail do Google e URL da foto de perfil do
                    Google. Não acessamos, lemos ou armazenamos o conteúdo de e-mails, contatos, arquivos,
                    calendários ou qualquer outro dado do Google não listado aqui.
                  </p>
                </section>

                <section id="uso-dados-google" className="space-y-2 scroll-mt-24">
                  <h3 className="text-lg font-semibold">Uso dos dados</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Utilizamos os dados do Google exclusivamente para: criar e autenticar a sua conta na
                    Revisão Fácil; identificar você como usuário da plataforma; permitir o acesso a
                    revisões, aulas e demais conteúdos contratados; personalizar a exibição do seu nome e
                    foto de perfil dentro do app; e enviar comunicações de serviço (confirmação de
                    cadastro, recuperação de senha e avisos sobre a sua conta). Os dados do Google nunca
                    são usados para publicidade nem vendidos a terceiros.
                  </p>
                </section>

                <section id="compartilhamento-dados-google" className="space-y-2 scroll-mt-24">
                  <h3 className="text-lg font-semibold">Compartilhamento dos dados</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Os dados do Google não são compartilhados com terceiros para fins de publicidade ou
                    comercialização. Compartilhamos os dados apenas com o provedor de infraestrutura
                    necessário ao funcionamento do serviço — a plataforma de backend que hospeda a
                    autenticação e o banco de dados — estritamente para permitir a criação e o acesso à
                    conta. Poderemos ainda divulgar dados quando exigido por lei ou ordem judicial, dentro
                    dos limites legais aplicáveis.
                  </p>
                </section>

                <section id="armazenamento-dados-google" className="space-y-2 scroll-mt-24">
                  <h3 className="text-lg font-semibold">Armazenamento e proteção</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Os dados do Google são armazenados em banco de dados protegido com criptografia em
                    repouso, controle de acesso baseado em funções (RBAC) e políticas de segurança em nível
                    de linha (RLS), de modo que cada usuário só acessa os próprios dados. O acesso
                    administrativo é restrito e auditado. A transmissão ocorre sempre por conexão
                    criptografada (HTTPS/TLS). Senhas são protegidas com hash e os tokens de sessão seguem
                    o padrão JWT com expiração automática.
                  </p>
                </section>

                <section id="retencao-dados-google" className="space-y-2 scroll-mt-24">
                  <h3 className="text-lg font-semibold">Retenção e exclusão</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Reteremos os dados do Google enquanto a sua conta estiver ativa na Revisão Fácil. Você
                    pode solicitar a exclusão da sua conta e de todos os dados a ela vinculados —
                    incluindo os dados obtidos do Google — a qualquer momento, pelo canal de suporte
                    (e-mail ou WhatsApp) disponível na página de Contato, ou diretamente ao administrador
                    pelo Painel Administrativo. A exclusão é efetivada em até 30 dias, removendo
                    permanentemente nome, e-mail, foto e demais dados associados. Para revogar o acesso
                    ao Google, você também pode remover a Revisão Fácil em{" "}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      myaccount.google.com/permissions
                    </a>{" "}
                    a qualquer momento.
                  </p>
                </section>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-border">
            <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
