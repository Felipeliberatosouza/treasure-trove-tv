import { BookOpen, Video, FileText, HelpCircle, Calendar, DollarSign, ShieldCheck, AlertTriangle, GraduationCap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TeacherAulaParticularRulesTab from "@/components/dashboard/TeacherAulaParticularRulesTab";

const TeacherInstructionsTab = () => {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" /> Instruções para Professores
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Leia atentamente as orientações abaixo para utilizar a plataforma corretamente.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* Propósito */}
        <AccordionItem value="purpose" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              O que é a Revisão Fácil?
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A <strong className="text-foreground">Revisão Fácil</strong> é uma plataforma educacional focada em oferecer aos alunos conteúdos de alta qualidade em dois formatos principais:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Vídeos de Revisão de Conteúdos</strong> — aulas objetivas que ajudam os alunos a revisar matérias e se preparar para provas.</li>
              <li><strong className="text-foreground">Vídeos de Resolução de Questões de Prova</strong> — resoluções passo a passo de questões reais de provas e concursos.</li>
            </ul>
            <p>
              Como professor, seu papel é produzir e disponibilizar esses conteúdos, além de oferecer suporte pedagógico através de materiais complementares, aulas particulares e atendimento de dúvidas.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Como inserir vídeos */}
        <AccordionItem value="upload-videos" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Como inserir vídeos na plataforma
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p className="font-medium text-foreground">Passo a passo:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Acesse a aba <strong className="text-foreground">"Minhas Aulas"</strong> (para revisões) ou <strong className="text-foreground">"Resoluções de Provas"</strong> (para questões de prova).</li>
              <li>Clique no botão <strong className="text-foreground">"Novo Conteúdo"</strong>.</li>
              <li>Preencha o <strong className="text-foreground">título</strong> e a <strong className="text-foreground">descrição</strong> do vídeo.</li>
              <li>Selecione o <strong className="text-foreground">tipo de vídeo</strong>: Revisão ou Resolução de Questões de Prova.</li>
              <li>Defina o <strong className="text-foreground">preço</strong> para venda avulsa (respeitando o mínimo definido pela administração).</li>
              <li>Faça o upload da <strong className="text-foreground">capa do vídeo</strong> (thumbnail) e da <strong className="text-foreground">capa do carrossel</strong>.</li>
              <li>Faça o upload do <strong className="text-foreground">arquivo de vídeo</strong>.</li>
              <li>Selecione as <strong className="text-foreground">áreas de conhecimento</strong> relacionadas.</li>
              <li>Adicione os materiais complementares (veja abaixo).</li>
              <li>Clique em <strong className="text-foreground">"Salvar"</strong>. O vídeo será enviado para aprovação do moderador.</li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        {/* Recursos complementares */}
        <AccordionItem value="resources" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Materiais complementares disponíveis
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>Ao cadastrar um vídeo, você pode anexar os seguintes materiais complementares:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📄 Resumo</span>
                <span>— Arquivo com o resumo do conteúdo abordado no vídeo, para consulta rápida do aluno.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📝 Simulado</span>
                <span>— Exercícios ou simulados relacionados ao tema do vídeo para prática.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">🏆 Top Questões</span>
                <span>— Seleção das questões de prova mais relevantes e recorrentes sobre o tema.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-foreground min-w-[120px]">📋 Colinha</span>
                <span>— Material condensado com fórmulas, dicas e pontos-chave para revisão de última hora.</span>
              </li>
            </ul>
            <p className="text-xs italic mt-2">
              Todos os materiais são disponibilizados ao aluno na página do vídeo, logo abaixo da seção de avaliação.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Aulas particulares */}
        <AccordionItem value="private-lessons" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Como disponibilizar agenda para aulas particulares
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Ao cadastrar um vídeo, você pode incluir um <strong className="text-foreground">link de agendamento de aula particular</strong> (campo "URL Aula Particular").
            </p>
            <p>
              Este link ficará disponível para os alunos que acessarem seu conteúdo, permitindo que agendem uma aula particular diretamente com você.
            </p>
            <p>
              Recomendamos usar ferramentas como <strong className="text-foreground">Calendly</strong>, <strong className="text-foreground">Google Agenda</strong> ou qualquer plataforma de agendamento online para gerar o link.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Regras de Aula Particular */}
        <AccordionItem value="aula-particular-rules" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Regras de Aula Particular
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground pt-2">
            <TeacherAulaParticularRulesTab />
          </AccordionContent>
        </AccordionItem>

        {/* Dúvidas */}
        <AccordionItem value="doubts" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Como responder dúvidas dos alunos
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Os alunos podem enviar dúvidas diretamente na página de cada vídeo seu. O fluxo funciona assim:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>O aluno envia a dúvida na página do vídeo.</li>
              <li>A dúvida passa pela <strong className="text-foreground">aprovação do moderador</strong> da Revisão Fácil.</li>
              <li>Após aprovada, a dúvida aparece na aba <strong className="text-foreground">"Dúvidas de Alunos"</strong> do seu painel.</li>
              <li>Você deve responder dentro do <strong className="text-foreground">prazo definido pela administração</strong>.</li>
              <li>O aluno recebe notificação por e-mail quando a resposta é publicada.</li>
            </ol>
            <p className="text-xs italic mt-2">
              Acesse a aba "Dúvidas de Alunos" regularmente para não perder o prazo de resposta.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Aprovação do moderador */}
        <AccordionItem value="moderation" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Aprovação do moderador
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Todos os conteúdos publicados na Revisão Fácil passam por um processo de <strong className="text-foreground">moderação obrigatória</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Vídeos:</strong> após o envio, o vídeo fica com status "Pendente" até que o moderador analise e aprove. Somente após a aprovação o vídeo ficará visível para os alunos.</li>
              <li><strong className="text-foreground">Dúvidas:</strong> as dúvidas enviadas pelos alunos também passam por aprovação antes de serem encaminhadas ao professor, garantindo a qualidade das interações.</li>
            </ul>
            <p className="text-xs italic mt-2">
              Caso seu conteúdo não seja aprovado, você receberá uma notificação com o motivo da recusa.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Valores e recebimentos */}
        <AccordionItem value="pricing" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Valores e recebimentos
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              O valor que você receberá por cada recurso vendido será calculado da seguinte forma:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você define o <strong className="text-foreground">preço de venda</strong> do seu conteúdo ao cadastrá-lo.</li>
              <li>O preço informado deve respeitar o <strong className="text-foreground">valor mínimo</strong> definido pelo administrador da plataforma.</li>
              <li>Sobre o preço de venda será aplicado um <strong className="text-foreground">desconto percentual (%) da Revisão Fácil</strong>, correspondente à taxa da plataforma.</li>
              <li>O valor líquido (preço − taxa da plataforma) será o seu <strong className="text-foreground">recebimento por venda</strong>.</li>
            </ul>
            <p className="text-xs italic mt-2">
              Exemplo: se você definir o preço de R$ 20,00 e a taxa da plataforma for 30%, você receberá R$ 14,00 por venda.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Conduta e regras */}
        <AccordionItem value="conduct" className="rounded-lg border border-border px-4">
          <AccordionTrigger className="text-sm font-medium gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Regras de conduta e conteúdo
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <p className="font-semibold text-destructive text-sm">⚠️ Atenção — Leitura obrigatória</p>
              <p>
                É <strong className="text-foreground">estritamente proibido</strong> utilizar nos vídeos, textos, materiais complementares ou respostas a dúvidas:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Termos chulos ou palavrões</li>
                <li>Ofensas pessoais ou institucionais</li>
                <li>Termos discriminatórios, preconceituosos ou racistas</li>
                <li>Conteúdo que incite violência ou ódio</li>
                <li>Qualquer linguagem inadequada ao ambiente educacional</li>
              </ul>
              <p className="font-medium text-foreground mt-2">
                O descumprimento dessas regras resultará na <strong>não aprovação</strong> do conteúdo pelo moderador, podendo levar à suspensão ou exclusão da conta do professor.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default TeacherInstructionsTab;
