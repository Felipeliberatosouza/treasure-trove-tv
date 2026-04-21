import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { User, CreditCard, Lock, BookOpen, Info, LifeBuoy } from "lucide-react";
import PersonalDataTab from "@/components/dashboard/PersonalDataTab";
import LoginDataTab from "@/components/dashboard/LoginDataTab";
import StudentSubscriptionTab from "@/components/dashboard/StudentSubscriptionTab";
import StudentInstructionsTab from "@/components/dashboard/StudentInstructionsTab";
import InterestAreasTab from "@/components/dashboard/InterestAreasTab";
import PastDueBillingAlert from "@/components/dashboard/PastDueBillingAlert";
import SupportTicketsTab from "@/components/dashboard/SupportTicketsTab";

const tabs = [
  { id: "personal", label: "Dados Pessoais", icon: User },
  { id: "login", label: "Dados de Login", icon: Lock },
  { id: "subscription", label: "Assinatura e Compras", icon: CreditCard },
  { id: "interests", label: "Áreas de Interesse", icon: BookOpen },
  { id: "support", label: "Atendimento", icon: LifeBuoy },
  { id: "instructions", label: "Como Usar", icon: Info },
] as const;

type TabId = (typeof tabs)[number]["id"];
const validTabIds: readonly string[] = tabs.map(t => t.id);

const StudentDashboardContent = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId = tabParam && validTabIds.includes(tabParam) ? (tabParam as TabId) : "personal";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // React to URL changes (e.g. coming from PricingSection with ?tab=subscription)
  useEffect(() => {
    if (tabParam && validTabIds.includes(tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam]);

  const handleUpdateCardClick = () => {
    setActiveTab("subscription");
    // Defer until the subscription tab mounts the PaymentMethodCard.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-payment-method-form"));
    }, 100);
  };

  return (
    <>
      <PastDueBillingAlert onUpdateCardClick={handleUpdateCardClick} />
      <div className="flex gap-6 flex-col md:flex-row">
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-56 shrink-0 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 rounded-xl border border-border bg-card p-6"
      >
        {activeTab === "personal" && <PersonalDataTab />}
        {activeTab === "login" && <LoginDataTab />}
        {activeTab === "subscription" && <StudentSubscriptionTab />}
        {activeTab === "interests" && <InterestAreasTab />}
        {activeTab === "support" && <SupportTicketsTab userRole="student" />}
        {activeTab === "instructions" && <StudentInstructionsTab />}
      </motion.div>
    </div>
    </>
  );
};

export default StudentDashboardContent;

