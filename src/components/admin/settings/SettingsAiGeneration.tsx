import { useState } from "react";
import { Sparkles, FolderCog, Cpu } from "lucide-react";
import SettingsAiAvatars from "./SettingsAiAvatars";
import SettingsAiMaterials from "./SettingsAiMaterials";
import SettingsAiProviders from "./SettingsAiProviders";
import SettingsNeuralVideo from "./SettingsNeuralVideo";

type SubTab = "parametros" | "provedores" | "materiais";

/** Gestão de IA: parâmetros (avatares), IA por área/voz e materiais já gerados. */
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
        <button onClick={() => setSubTab("provedores")} className={tabClass(subTab === "provedores")}>
          <Cpu className="h-3.5 w-3.5" /> IA por área e voz
        </button>
        <button onClick={() => setSubTab("materiais")} className={tabClass(subTab === "materiais")}>
          <FolderCog className="h-3.5 w-3.5" /> Gestão de Materiais de IA
        </button>
      </div>

      {subTab === "parametros" && (
        <>
          <SettingsAiAvatars />
          <SettingsNeuralVideo />
        </>
      )}
      {subTab === "provedores" && <SettingsAiProviders />}
      {subTab === "materiais" && <SettingsAiMaterials />}
    </div>
  );
};

export default SettingsAiGeneration;
