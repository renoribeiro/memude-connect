import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ui/error-boundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./components/auth/AuthPage";
import Unauthorized from "./pages/Unauthorized";
import UserManagement from "./pages/admin/UserManagement";
import Leads from "./pages/admin/Leads";
import Corretores from "./pages/admin/Corretores";
import Empreendimentos from "./pages/admin/Empreendimentos";
import Visitas from "./pages/admin/Visitas";
import Vendas from "./pages/admin/Vendas";
import Comunicacoes from "./pages/admin/Comunicacoes";
import Relatorios from "./pages/admin/Relatorios";
import Configuracoes from "./pages/admin/Configuracoes";
import SincronizacaoWordpress from "./pages/admin/SincronizacaoWordpress";
import Analytics from "./pages/admin/Analytics";
import Monitoring from "./pages/admin/Monitoring";
import AIAgents from "./pages/admin/AIAgents";
import MeusLeads from "./pages/corretor/MeusLeads";
import MinhasVisitas from "./pages/corretor/MinhasVisitas";
import MinhasComissoes from "./pages/corretor/MinhasComissoes";
import Perfil from "./pages/corretor/Perfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />

              {/* Admin Routes */}
              <Route path="/admin/users" element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } />
              <Route path="/corretores" element={
                <ProtectedRoute requireAdmin>
                  <Corretores />
                </ProtectedRoute>
              } />
              <Route path="/empreendimentos" element={
                <ProtectedRoute requireAdmin>
                  <Empreendimentos />
                </ProtectedRoute>
              } />
              <Route path="/visitas" element={
                <ProtectedRoute>
                  <Visitas />
                </ProtectedRoute>
              } />
              <Route path="/vendas" element={
                <ProtectedRoute requireAdmin>
                  <Vendas />
                </ProtectedRoute>
              } />
              <Route path="/comunicacoes" element={
                <ProtectedRoute>
                  <Comunicacoes />
                </ProtectedRoute>
              } />
              <Route path="/relatorios" element={
                <ProtectedRoute>
                  <Relatorios />
                </ProtectedRoute>
              } />
              <Route path="/sincronizacao-wordpress" element={
                <ProtectedRoute requireAdmin>
                  <SincronizacaoWordpress />
                </ProtectedRoute>
              } />
              <Route path="/configuracoes" element={
                <ProtectedRoute requireAdmin>
                  <Configuracoes />
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute requireAdmin>
                  <Analytics />
                </ProtectedRoute>
              } />
              <Route path="/admin/monitoring" element={
                <ProtectedRoute requireAdmin>
                  <Monitoring />
                </ProtectedRoute>
              } />
              <Route path="/admin/ai-agents" element={
                <ProtectedRoute requireAdmin>
                  <AIAgents />
                </ProtectedRoute>
              } />

              {/* Corretor Routes */}
              <Route path="/meus-leads" element={
                <ProtectedRoute requireCorretor>
                  <MeusLeads />
                </ProtectedRoute>
              } />
              <Route path="/minhas-visitas" element={
                <ProtectedRoute requireCorretor>
                  <MinhasVisitas />
                </ProtectedRoute>
              } />
              <Route path="/minhas-comissoes" element={
                <ProtectedRoute requireCorretor>
                  <MinhasComissoes />
                </ProtectedRoute>
              } />
              <Route path="/perfil" element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              } />

              {/* Redirects for common typos/shortcuts */}
              <Route path="/ai-agents" element={<Navigate to="/admin/ai-agents" replace />} />
              <Route path="/ai-agentes" element={<Navigate to="/admin/ai-agents" replace />} />

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
