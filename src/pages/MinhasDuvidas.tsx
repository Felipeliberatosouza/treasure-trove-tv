import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const MinhasDuvidas = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard/student" replace />;
};

export default MinhasDuvidas;
