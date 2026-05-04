import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ui/error-boundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { lazy, Suspense } from "react";

const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./components/auth/AuthPage"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const Leads = lazy(() => import("./pages/admin/Leads"));
const Corretores = lazy(() => import("./pages/admin/Corretores"));
const Empreendimentos = lazy(() => import("./pages/admin/Empreendimentos"));
const Visitas = lazy(() => import("./pages/admin/Visitas"));
const Vendas = lazy(() => import("./pages/admin/Vendas"));
const Comunicacoes = lazy(() => import("./pages/admin/Comunicacoes"));
const Relatorios = lazy(() => import("./pages/admin/Relatorios"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const SincronizacaoWordpress = lazy(() => import("./pages/admin/SincronizacaoWordpress"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Monitoring = lazy(() => import("./pages/admin/Monitoring"));
const AIAgents = lazy(() => import("./pages/admin/AIAgents"));
const CRM = lazy(() => import("./pages/admin/CRM"));
const MeusLeads = lazy(() => import("./pages/corretor/MeusLeads"));
const MinhasVisitas = lazy(() => import("./pages/corretor/MinhasVisitas"));
const MinhasComissoes = lazy(() => import("./pages/corretor/MinhasComissoes"));
const Perfil = lazy(() => import("./pages/corretor/Perfil"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="h-screen w-full flex items-center justify-center text-teal-500 font-medium">Carregando...</div>}>
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
                <Route path="/crm" element={
                  <ProtectedRoute>
                    <CRM />
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
