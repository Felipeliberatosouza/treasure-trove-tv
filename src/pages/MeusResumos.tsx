import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SectionCatalog from "@/components/sections/SectionCatalog";

const MeusResumos = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <SectionCatalog sectionKey="resumo" />;
};

export default MeusResumos;
