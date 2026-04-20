import MaterialShowcase from "@/components/MaterialShowcase";
import { Trophy } from "lucide-react";

const TopQuestoes = () => (
  <MaterialShowcase
    title="Top Questões de Provas"
    description="As perguntas abertas mais cobradas, com respostas elaboradas pelos professores."
    icon={Trophy}
    materialType="top_questoes"
  />
);

export default TopQuestoes;
