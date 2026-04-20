import MaterialShowcase from "@/components/MaterialShowcase";
import { ClipboardList } from "lucide-react";

const Simulados = () => (
  <MaterialShowcase
    title="Simulados"
    description="Teste seus conhecimentos com simulados interativos. Responda e veja seu desempenho com gabarito completo."
    icon={ClipboardList}
    materialType="simulado"
  />
);

export default Simulados;
