import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { PrivateRoute } from "@/components/shared/PrivateRoute";
import { OnboardingRoute } from "@/components/shared/OnboardingRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import FunnelsPage from "@/pages/FunnelsPage";
import FunnelEditPage from "@/pages/FunnelEditPage";
import CustomFieldsPage from "@/pages/CustomFieldsPage";
import LeadsPage from "@/pages/LeadsPage";
import TasksPage from "@/pages/TasksPage";
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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Onboarding — auth required, no org */}
              <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

              {/* Protected — auth + org required */}
              <Route path="/dashboard" element={
                <PrivateRoute><MainLayout><DashboardPage /></MainLayout></PrivateRoute>
              } />
              <Route path="/leads" element={
                <PrivateRoute><MainLayout><LeadsPage /></MainLayout></PrivateRoute>
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
              <Route path="/settings/custom-fields" element={
                <PrivateRoute><MainLayout><CustomFieldsPage /></MainLayout></PrivateRoute>
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
