import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SectionCatalog from "@/components/sections/SectionCatalog";

const MinhasRevisoes = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <SectionCatalog sectionKey="revisoes" />;
};

export default MinhasRevisoes;
