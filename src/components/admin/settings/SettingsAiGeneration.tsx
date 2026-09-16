import { useState } from "react";
import { Sparkles, FolderCog } from "lucide-react";
import SettingsAiAvatars from "./SettingsAiAvatars";
import SettingsAiMaterials from "./SettingsAiMaterials";

type SubTab = "parametros" | "materiais";

/** Gestão de IA: parâmetros (avatares) e gestão dos materiais já gerados. */
const SettingsAiGeneration = () => {
  const [subTab, setSubTab] = useState<SubTab>("parametros");

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
      active
        ? "bg-primary text-primary-foreground font-medium"
        : "bg-secondary text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSubTab("parametros")} className={tabClass(subTab === "parametros")}>
          <Sparkles className="h-3.5 w-3.5" /> Parâmetros de IA
        </button>
        <button onClick={() => setSubTab("materiais")} className={tabClass(subTab === "materiais")}>
          <FolderCog className="h-3.5 w-3.5" /> Gestão de Materiais de IA
        </button>
      </div>

      {subTab === "parametros" ? <SettingsAiAvatars /> : <SettingsAiMaterials />}
    </div>
  );
};

export default SettingsAiGeneration;
