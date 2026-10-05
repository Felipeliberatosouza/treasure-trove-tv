import { lazy, Suspense } from "react";
import { startCacheManager } from "@/lib/cacheManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
const Login = lazy(() => import("./pages/Login.tsx"));
const StudentSignup = lazy(() => import("./pages/StudentSignup.tsx"));
const TeacherSignup = lazy(() => import("./pages/TeacherSignup.tsx"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard.tsx"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse.tsx"));
const AboutUs = lazy(() => import("./pages/AboutUs.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const Revisoes = lazy(() => import("./pages/Revisoes.tsx"));
const Resumos = lazy(() => import("./pages/Resumos.tsx"));
const Simulados = lazy(() => import("./pages/Simulados.tsx"));
const TopQuestoes = lazy(() => import("./pages/TopQuestoes.tsx"));
const Colinhas = lazy(() => import("./pages/Colinhas.tsx"));
const MinhasRevisoes = lazy(() => import("./pages/MinhasRevisoes.tsx"));
const MeusResumos = lazy(() => import("./pages/MeusResumos.tsx"));
const MeusSimulados = lazy(() => import("./pages/MeusSimulados.tsx"));
const MinhasTopQuestoes = lazy(() => import("./pages/MinhasTopQuestoes.tsx"));
const MinhasColinhas = lazy(() => import("./pages/MinhasColinhas.tsx"));
const MinhasDuvidas = lazy(() => import("./pages/MinhasDuvidas.tsx"));
const MinhasAulasAgendadas = lazy(() => import("./pages/MinhasAulasAgendadas.tsx"));
const EstudarIA = lazy(() => import("./pages/EstudarIA.tsx"));
const MeusTrabalhos = lazy(() => import("./pages/MeusTrabalhos.tsx"));
const ProductPage = lazy(() => import("./pages/ProductPage.tsx"));
const TrabalhoIA = lazy(() => import("./pages/TrabalhoIA.tsx"));

const ConteudoIA = lazy(() => import("./pages/ConteudoIA.tsx"));
const ConviteIndicacao = lazy(() => import("./pages/ConviteIndicacao.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const VideoPage = lazy(() => import("./pages/VideoPage.tsx"));
const TeacherProfile = lazy(() => import("./pages/TeacherProfile.tsx"));
import CookieConsent from "./components/CookieConsent.tsx";
const EmailSecurityNotification = lazy(() => import("./pages/EmailSecurityNotification.tsx"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess.tsx"));
const PaymentCanceled = lazy(() => import("./pages/PaymentCanceled.tsx"));
const AiCredits = lazy(() => import("./pages/AiCredits.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const PreviewPlanChange = lazy(() => import("./pages/PreviewPlanChange.tsx"));
import DynamicBranding from "./components/DynamicBranding.tsx";
import InactivityGuard from "./components/InactivityGuard.tsx";
import UserBlockGuard from "./components/UserBlockGuard.tsx";
import GlobalRedirectOverlay from "./components/GlobalRedirectOverlay.tsx";
import OnboardingGuard from "./components/OnboardingGuard.tsx";
import EmailConfirmationHandler from "./components/EmailConfirmationHandler.tsx";
import ScrollToTop from "./components/ScrollToTop.tsx";
import BetaBar from "./components/beta/BetaBar.tsx";
import BetaEndedNotice from "./components/beta/BetaEndedNotice.tsx";
import SubscriptionUnavailableBanner from "./components/SubscriptionUnavailableBanner.tsx";
import GlobalContentProtection from "./components/GlobalContentProtection.tsx";
// Test-only harness route. Lazy import keeps it out of prod chunks unless
// a test/dev session navigates to /__test/checkout-retry.
const CheckoutRetryHarness = lazy(
  () => import("./pages/__test__/CheckoutRetryHarness.tsx"),
);
const ReferralEmailHarness = lazy(
  () => import("./pages/__test__/ReferralEmailHarness.tsx"),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
});

startCacheManager();

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" aria-label="Carregando" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <BetaBar />
          <BetaEndedNotice />
          <Suspense fallback={<PageFallback />}>
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
            <Route path="/revisao-ia" element={<Navigate to="/" replace />} />
            <Route path="/ia" element={<Navigate to="/" replace />} />
            <Route path="/conteudo-ia/:id" element={<ConteudoIA />} />
            <Route path="/meus-trabalhos" element={<MeusTrabalhos />} />
            {["provas", "trabalhos", "enem", "vestibulares", "oab", "concursos"].map((k) => (
              <Route key={k} path={`/${k}`} element={<ProductPage />} />
            ))}
            <Route path="/trabalho/:id" element={<TrabalhoIA />} />
            <Route path="/convite/:token" element={<ConviteIndicacao />} />
            <Route path="/estudar-ia" element={<EstudarIA />} />
            <Route path="/video/:id" element={<VideoPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-canceled" element={<PaymentCanceled />} />
            <Route path="/creditos-ia" element={<AiCredits />} />
            <Route path="/email-seguranca" element={<EmailSecurityNotification />} />
            <Route path="/preview/plan-change" element={<PreviewPlanChange />} />
            {!import.meta.env.PROD && (
              <Route
                path="/__test/checkout-retry"
                element={
                  <Suspense fallback={<div>Loading harness…</div>}>
                    <CheckoutRetryHarness />
                  </Suspense>
                }
              />
            )}
            {!import.meta.env.PROD && (
              <Route
                path="/__test/referral-email"
                element={
                  <Suspense fallback={<div>Loading harness…</div>}>
                    <ReferralEmailHarness />
                  </Suspense>
                }
              />
            )}
            <Route path="/:slug" element={<TeacherProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <DynamicBranding />
          <CookieConsent />
          <InactivityGuard />
          <GlobalRedirectOverlay />
          <OnboardingGuard />
          <EmailConfirmationHandler />
          <UserBlockGuard />
          <SubscriptionUnavailableBanner />
          <GlobalContentProtection />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
