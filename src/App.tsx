import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import StudentSignup from "./pages/StudentSignup.tsx";
import TeacherSignup from "./pages/TeacherSignup.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfUse from "./pages/TermsOfUse.tsx";
import AboutUs from "./pages/AboutUs.tsx";
import Contact from "./pages/Contact.tsx";
import Revisoes from "./pages/Revisoes.tsx";
import Resumos from "./pages/Resumos.tsx";
import Simulados from "./pages/Simulados.tsx";
import TopQuestoes from "./pages/TopQuestoes.tsx";
import Colinhas from "./pages/Colinhas.tsx";
import MinhasRevisoes from "./pages/MinhasRevisoes.tsx";
import MeusResumos from "./pages/MeusResumos.tsx";
import MeusSimulados from "./pages/MeusSimulados.tsx";
import MinhasTopQuestoes from "./pages/MinhasTopQuestoes.tsx";
import MinhasColinhas from "./pages/MinhasColinhas.tsx";
import MinhasDuvidas from "./pages/MinhasDuvidas.tsx";
import MinhasAulasAgendadas from "./pages/MinhasAulasAgendadas.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import CookieConsent from "./components/CookieConsent.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup/student" element={<StudentSignup />} />
            <Route path="/signup/teacher" element={<TeacherSignup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard/student" element={<StudentDashboard />} />
            <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/termos" element={<TermsOfUse />} />
            <Route path="/sobre" element={<AboutUs />} />
            <Route path="/contato" element={<Contact />} />
            <Route path="/revisoes" element={<Revisoes />} />
            <Route path="/resumos" element={<Resumos />} />
            <Route path="/simulados" element={<Simulados />} />
            <Route path="/top-questoes" element={<TopQuestoes />} />
            <Route path="/colinhas" element={<Colinhas />} />
            <Route path="/minhas-revisoes" element={<MinhasRevisoes />} />
            <Route path="/meus-resumos" element={<MeusResumos />} />
            <Route path="/meus-simulados" element={<MeusSimulados />} />
            <Route path="/minhas-top-questoes" element={<MinhasTopQuestoes />} />
            <Route path="/minhas-colinhas" element={<MinhasColinhas />} />
            <Route path="/minhas-duvidas" element={<MinhasDuvidas />} />
            <Route path="/minhas-aulas-agendadas" element={<MinhasAulasAgendadas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
