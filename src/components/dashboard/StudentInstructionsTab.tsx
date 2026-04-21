import { BookOpen, Video, FileText, HelpCircle, Calendar, CreditCard, Star, Download } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  usePlatformSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  type AulaParticularConfigSettings,
} from "@/hooks/usePlatformSettings";

const StudentInstructionsTab = () => {
  const { data } = usePlatformSettings("aula_particular_config");
  const cfg: AulaParticularConfigSettings = {
    ...DEFAULT_AULA_PARTICULAR_CONFIG,
    ...((data as AulaParticularConfigSettings) || {}),
  };
  const feeText =
    cfg.late_cancel_fee_type === "percentage"
      ? `${cfg.late_cancel_fee_value}% do valor da aula`
      : `R$ ${cfg.late_cancel_fee_value.toFixed(2)} (valor fixo)`;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" /> Como usar a Revisão Fácil
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Conheça todos os recursos disponíveis para você aproveitar ao máximo a plataforma.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* O que é */}
        <AccordionItem value="about" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              O que é a Revisão Fácil?
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A <strong className="text-foreground">Revisão Fácil</strong> é uma plataforma educacional que oferece:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Vídeos de Revisão de Conteúdos</strong> — aulas objetivas para você revisar matérias e se preparar para provas.</li>
              <li><strong className="text-foreground">Vídeos de Resolução de Questões de Prova</strong> — resoluções passo a passo de questões reais de provas e concursos.</li>
            </ul>
            <p>
              Além dos vídeos, você tem acesso a materiais complementares, pode tirar dúvidas com os professores e agendar aulas particulares.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Como assistir */}
        <AccordionItem value="watch" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Como assistir aos vídeos
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Navegue pela <strong className="text-foreground">página inicial</strong> ou use os filtros por área de conhecimento.</li>
              <li>Clique no vídeo que deseja assistir.</li>
              <li>Se você tiver uma <strong className="text-foreground">assinatura ativa</strong>, o acesso é imediato.</li>
              <li>Sem assinatura, você pode <strong className="text-foreground">comprar o vídeo individualmente</strong> ou ativar o <strong className="text-foreground">teste grátis</strong> (se disponível).</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* Assinatura */}
        <AccordionItem value="subscription" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Assinatura e compras avulsas
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>Você pode acessar os conteúdos de duas formas:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Assinatura mensal:</strong> acesso ilimitado a todos os vídeos e recursos incluídos no seu plano.</li>
              <li><strong className="text-foreground">Compra avulsa:</strong> adquira vídeos e recursos individualmente. Cada compra avulsa dá direito a um <strong className="text-foreground">único uso</strong>.</li>
            </ul>
            <p>
              Gerencie sua assinatura e veja seu histórico de compras na aba <strong className="text-foreground">"Assinatura e Compras"</strong>.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Materiais complementares */}
        <AccordionItem value="materials" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Materiais complementares
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>Na página de cada vídeo, logo abaixo da avaliação, você encontra os materiais de apoio disponibilizados pelo professor:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📄 Resumo</span>
                <span>— Resumo do conteúdo abordado para consulta rápida.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📝 Simulado</span>
                <span>— Exercícios para você praticar o que aprendeu.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">🏆 Top Questões</span>
                <span>— As questões de prova mais importantes sobre o tema.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📋 Colinha</span>
                <span>— Fórmulas, dicas e pontos-chave para revisão de última hora.</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Dúvidas */}
        <AccordionItem value="doubts" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Como tirar dúvidas com o professor
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Na página do vídeo, clique no ícone <strong className="text-foreground">"Dúvidas"</strong>.</li>
              <li>Um formulário será aberto para você digitar sua pergunta.</li>
              <li>Após o envio, sua dúvida passará por uma <strong className="text-foreground">aprovação do moderador</strong>.</li>
              <li>Uma vez aprovada, o professor receberá sua pergunta e responderá o mais rápido possível.</li>
              <li>Você receberá um <strong className="text-foreground">e-mail de notificação</strong> quando a resposta for publicada.</li>
            </ol>
            <p>
              Acompanhe todas as suas dúvidas e respostas na aba <strong className="text-foreground">"Minhas Dúvidas"</strong>.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Aulas particulares */}
        <AccordionItem value="private-lessons" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Aulas particulares
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4">
            <p>
              Alguns professores disponibilizam a opção de{" "}
              <strong className="text-foreground">aula particular</strong>. Quando disponível, você
              pode agendar pelo perfil do professor ou pela página do conteúdo. Acompanhe todas as
              suas aulas em{" "}
              <strong className="text-foreground">"Aula Particular: Acesse Aulas/ Atualize Agenda"</strong>{" "}
              no menu.
            </p>

            <div>
              <p className="font-semibold text-foreground mb-1">Como funciona o agendamento</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Escolha um professor que ofereça aulas particulares e selecione um horário disponível na agenda dele.</li>
                <li>Confirme o pagamento da aula. O acesso ao link da aula fica disponível na sua área de aulas agendadas.</li>
                <li>No horário marcado, entre pelo link da reunião que aparece no card da aula.</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-1">Regras importantes</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Cada aula tem duração de{" "}
                  <strong className="text-foreground">{cfg.lesson_duration_minutes} minutos</strong>.
                </li>
                <li>
                  Você pode cancelar <strong className="text-foreground">sem custo</strong> até{" "}
                  <strong className="text-foreground">{cfg.free_cancel_window_hours}h</strong> antes
                  do horário marcado.
                </li>
                <li>
                  Cancelamentos com menos de{" "}
                  <strong className="text-foreground">{cfg.free_cancel_window_hours}h</strong> de
                  antecedência geram uma{" "}
                  <strong className="text-foreground">taxa de cancelamento tardio</strong> de{" "}
                  <strong className="text-foreground">{feeText}</strong>, cobrada automaticamente no
                  seu método de pagamento.
                </li>
                <li>
                  Não comparecer à aula sem cancelar é tratado como cancelamento tardio e também
                  gera a taxa.
                </li>
                <li>
                  Reagendamentos dependem da disponibilidade do professor — abra a agenda dele para
                  escolher um novo horário.
                </li>
              </ul>
            </div>

            <p className="text-xs">
              💡 Dica: confirme com antecedência se você terá disponibilidade no horário escolhido
              para evitar a taxa de cancelamento tardio.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Avaliações */}
        <AccordionItem value="ratings" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Avalie os conteúdos
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Após assistir a um vídeo, você pode <strong className="text-foreground">avaliar o conteúdo</strong> com uma nota e deixar um comentário.
            </p>
            <p>
              Suas avaliações ajudam outros alunos a escolherem os melhores conteúdos e incentivam os professores a melhorarem cada vez mais.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default StudentInstructionsTab;
