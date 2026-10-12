import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SectionCatalog from "@/components/sections/SectionCatalog";

const MinhasColinhas = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <SectionCatalog sectionKey="colinha" />;
};

export default MinhasColinhas;
