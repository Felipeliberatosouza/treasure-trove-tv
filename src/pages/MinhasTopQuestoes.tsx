import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SectionCatalog from "@/components/sections/SectionCatalog";

const MinhasTopQuestoes = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <SectionCatalog sectionKey="top_questoes" />;
};

export default MinhasTopQuestoes;
