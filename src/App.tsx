import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import CompaniesPage from "./pages/CompaniesPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";
import ContactsPage from "./pages/ContactsPage";
import { PrivateRoute } from "@/components/shared/PrivateRoute";
import { OnboardingRoute } from "@/components/shared/OnboardingRoute";
import { PublicRoute } from "@/components/shared/PublicRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import FunnelsPage from "@/pages/FunnelsPage";
import FunnelEditPage from "@/pages/FunnelEditPage";
import LeadsPage from "@/pages/LeadsPage";
import TasksPage from "@/pages/TasksPage";
import InboundWebhookEditPage from "@/pages/InboundWebhookEditPage";
import InboundWebhookLogsPage from "@/pages/InboundWebhookLogsPage";
import SettingsPage from "@/pages/SettingsPage";
import AutomationsPage from "@/pages/AutomationsPage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import NotFound from "@/pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />

              {/* Onboarding — auth required, no org */}
              <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

              {/* Protected — auth + org required */}
              <Route path="/dashboard" element={
                <PrivateRoute><MainLayout><DashboardPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/leads" element={
                <PrivateRoute><MainLayout><LeadsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/companies" element={
                <PrivateRoute><MainLayout><CompaniesPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/companies/:id" element={
                <PrivateRoute><MainLayout><CompanyDetailPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/contacts" element={
                <PrivateRoute><MainLayout><ContactsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/tasks" element={
                <PrivateRoute><MainLayout><TasksPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings/funnels" element={
                <PrivateRoute><MainLayout><FunnelsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings/funnels/:id" element={
                <PrivateRoute><MainLayout><FunnelEditPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings" element={
                <PrivateRoute><MainLayout><SettingsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings/automations" element={
                <PrivateRoute><MainLayout><AutomationsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings/inbound-webhooks/logs" element={
                <PrivateRoute><MainLayout><InboundWebhookLogsPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/settings/inbound-webhooks/:id" element={
                <PrivateRoute><MainLayout><InboundWebhookEditPage /></MainLayout></PrivateRoute>
              } />

              {/* Redirect root */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
