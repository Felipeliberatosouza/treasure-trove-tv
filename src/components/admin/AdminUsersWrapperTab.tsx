import { useState } from "react";
import { Users, Activity } from "lucide-react";
import AdminUsersTab from "./AdminUsersTab";
import AdminUsageHistoryTab from "./AdminUsageHistoryTab";

const sections = [
  { id: "list", label: "Lista de Usuários", icon: Users },
  { id: "usage", label: "Histórico de Uso", icon: Activity },
] as const;

type SectionId = (typeof sections)[number]["id"];

const AdminUsersWrapperTab = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("list");

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5" /> Usuários
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

      {activeSection === "list" && <AdminUsersTab />}
      {activeSection === "usage" && <AdminUsageHistoryTab />}
    </div>
  );
};

export default AdminUsersWrapperTab;
