import { Navigate } from "react-router-dom";

// Endereços antigos ou inexistentes levam direto à página inicial.
const NotFound = () => <Navigate to="/" replace />;

export default NotFound;
