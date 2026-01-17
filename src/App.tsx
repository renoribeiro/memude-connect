import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Comunicacoes from "./pages/admin/Comunicacoes";
import Relatorios from "./pages/admin/Relatorios";
import Configuracoes from "./pages/admin/Configuracoes";
import SincronizacaoWordpress from "./pages/admin/SincronizacaoWordpress";
import Analytics from "./pages/admin/Analytics";
import Monitoring from "./pages/admin/Monitoring";
import MeusLeads from "./pages/corretor/MeusLeads";
import MinhasVisitas from "./pages/corretor/MinhasVisitas";
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
              <Route path="/perfil" element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              } />
              
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
