import MaterialShowcase from "@/components/MaterialShowcase";
import { FileText } from "lucide-react";

const Resumos = () => (
  <MaterialShowcase
    title="Resumos"
    description="Resumos objetivos para agilizar seus estudos."
    icon={FileText}
    materialType="resumo"
  />
);

export default Resumos;
