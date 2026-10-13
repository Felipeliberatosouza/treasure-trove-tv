import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE_URL = "https://revisaofacil.com.br";
const DEFAULT_TITLE = "Revisão Fácil - Mande bem nas suas provas!";
const DEFAULT_DESC =
  "Revisão Fácil: aulas, resumos, simulados, colinhas e questões comentadas com IA para provas, ENEM, vestibulares, OAB e concursos.";

const PAGES: Record<string, { title: string; description: string }> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  "/provas": { title: "Revisão para Provas Escolares e da Faculdade | Revisão Fácil", description: "Kit de revisão completo para sua prova em minutos: aula, resumo, simulado, colinha e questões comentadas." },
  "/trabalhos": { title: "Trabalhos Escolares em Word e Slides com IA | Revisão Fácil", description: "Gere seu trabalho escolar com documento Word nas normas ABNT e apresentação em slides prontos para entregar." },
  "/enem": { title: "Preparação para o ENEM com Simulados e Revisões | Revisão Fácil", description: "Estude para o ENEM pelas quatro áreas com simulados, provas anteriores, resumos e questões comentadas." },
  "/vestibulares": { title: "Revisão para Vestibulares | Revisão Fácil", description: "Revisões, simulados e questões comentadas dos principais vestibulares do Brasil." },
  "/oab": { title: "Revisão para o Exame da OAB 1ª e 2ª Fase | Revisão Fácil", description: "Prepare-se para o Exame da Ordem com revisões, provas anteriores comentadas e simulados." },
  "/concursos": { title: "Revisão para Concursos Públicos | Revisão Fácil", description: "Estude para concursos públicos por banca, cargo e disciplina do edital, com simulados e resumos." },
  "/revisoes": { title: "Revisões (Aulas) | Revisão Fácil", description: "Aulas de revisão com professores e Professor Virtual para estudar qualquer assunto." },
  "/resumos": { title: "Resumos para Estudar | Revisão Fácil", description: "Resumos objetivos dos assuntos que mais caem nas provas." },
  "/simulados": { title: "Simulados com Correção | Revisão Fácil", description: "Simulados com cronômetro, folha de respostas, nota e correção comentada." },
  "/top-questoes": { title: "Top Questões Comentadas | Revisão Fácil", description: "As questões que mais caem, com resolução comentada passo a passo." },
  "/colinhas": { title: "Colinhas para Revisar Rápido | Revisão Fácil", description: "Colinhas com o essencial de cada assunto para revisar antes da prova." },
  "/sobre": { title: "Sobre Nós | Revisão Fácil", description: "Conheça a Revisão Fácil, plataforma de estudos com professores e inteligência artificial." },
  "/contato": { title: "Contato | Revisão Fácil", description: "Fale com a equipe Revisão Fácil por e-mail, WhatsApp ou formulário." },
  "/termos": { title: "Termos de Uso | Revisão Fácil", description: "Termos de Uso da plataforma Revisão Fácil para alunos e professores." },
  "/privacidade": { title: "Política de Privacidade | Revisão Fácil", description: "Como a Revisão Fácil coleta, usa e protege seus dados pessoais (LGPD)." },
  "/login": { title: "Entrar | Revisão Fácil", description: "Acesse sua conta Revisão Fácil." },
  "/signup/student": { title: "Cadastro de Aluno | Revisão Fácil", description: "Crie sua conta de aluno e comece a estudar." },
  "/signup/teacher": { title: "Seja Professor | Revisão Fácil", description: "Cadastre-se como professor e publique suas aulas na Revisão Fácil." },
  "/creditos-ia": { title: "Créditos de IA | Revisão Fácil", description: "Compre Créditos de IA para gerar revisões, simulados e trabalhos." },
};

const PRIVATE_PREFIXES = ["/dashboard", "/checkout", "/reset-password", "/forgot-password", "/payment-", "/preview", "/email-seguranca", "/minhas-", "/meus-", "/convite", "/__test", "/trabalho/", "/estudar-ia"];

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Atualiza título, descrição, canonical e robots a cada troca de página. */
const RouteSeo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = PAGES[pathname];
    const isPrivate = PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
    // Páginas dinâmicas (vídeos, materiais, perfis) definem o próprio título; mantém o padrão até lá.
    const title = page?.title ?? DEFAULT_TITLE;
    const description = page?.description ?? DEFAULT_DESC;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", `${BASE_URL}${pathname}`);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "robots", isPrivate ? "noindex, nofollow" : "index, follow");

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${BASE_URL}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
  }, [pathname]);

  return null;
};

export default RouteSeo;
