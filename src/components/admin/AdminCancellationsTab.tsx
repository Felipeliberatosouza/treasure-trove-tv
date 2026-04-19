import { useState } from "react";
import { XCircle, FileText, Receipt, RefreshCcw } from "lucide-react";
import AdminCancellationReasonsTab from "./AdminCancellationReasonsTab";
import AdminCancellationReceiptsTab from "./AdminCancellationReceiptsTab";
import AdminCommitmentRefundsTab from "./AdminCommitmentRefundsTab";

const sections = [
  { id: "reasons", label: "Motivos de Cancelamento", icon: FileText },
  { id: "receipts", label: "Recibos de Cancelamento", icon: Receipt },
  { id: "refunds", label: "Reembolso de Multa de Permanência", icon: RefreshCcw },
] as const;

type SectionId = (typeof sections)[number]["id"];

const AdminCancellationsTab = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("reasons");

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <XCircle className="h-5 w-5" /> Cancelamentos
      </h2>

      <div className="flex gap-2 flex-wrap mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSection === s.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "reasons" && <AdminCancellationReasonsTab />}
      {activeSection === "receipts" && <AdminCancellationReceiptsTab />}
      {activeSection === "refunds" && <AdminCommitmentRefundsTab />}
    </div>
  );
};

export default AdminCancellationsTab;
