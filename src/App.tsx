import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { RoleProvider } from './context/RoleContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import FeishuCallback from './pages/FeishuCallback';
import HomePage from './pages/HomePage';
import ErpCenter from './pages/ErpCenter';
import ProductionCenter from './pages/ProductionCenter';
import ProjectsCenter from './pages/ProjectsCenter';
import ProjectDetail from './pages/ProjectDetail';
import DeliveryPlanDetail from './pages/DeliveryPlanDetail';
import DeliveryBatchDetail from './pages/DeliveryBatchDetail';
import DeliverySubOrderDetail from './pages/DeliverySubOrderDetail';
import AssetsPage from './pages/AssetsPage';
import DeviceDetail from './pages/DeviceDetail';
import DashboardPage from './pages/DashboardPage';
import AfterSalesIssues from './pages/AfterSalesIssues';
import AfterSalesOrderDetail from './pages/AfterSalesOrderDetail';
import SystemPage from './pages/SystemPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import { useRole } from './context/RoleContext';
import PageErrorBoundary from './components/PageErrorBoundary';
import { ROUTES } from './config/routes';
import type { PropsWithChildren, ReactElement } from 'react';

function RequireAuth({ children }: PropsWithChildren): ReactElement {
  const location = useLocation();
  const { ready, isAuthenticated } = useRole();
  if (!ready) return <div className="min-h-screen grid place-items-center text-sm text-gray-500">正在验证登录状态…</div>;
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function ProtectedPage({ children }: PropsWithChildren): ReactElement {
  const location = useLocation();
  const { canAccessPath } = useRole();
  if (!canAccessPath(location.pathname)) return <AccessDeniedPage />;
  return <>{children}</>;
}

function AppRoutes() {
  const { defaultPath } = useRole();
  const location = useLocation();
  return (
    <Layout>
      <PageErrorBoundary resetKey={`${location.pathname}${location.search}`}>
       <Routes>
        <Route path="/" element={<Navigate to={defaultPath} replace />} />
        <Route path={ROUTES.home} element={<ProtectedPage><HomePage /></ProtectedPage>} />
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
        <Route path="/erp-center" element={<ProtectedPage><ErpCenter /></ProtectedPage>} />
        <Route path="/production" element={<ProtectedPage><ProductionCenter /></ProtectedPage>} />
        <Route path="/projects" element={<ProtectedPage><ProjectsCenter /></ProtectedPage>} />
        <Route path="/projects/:id" element={<ProtectedPage><ProjectDetail /></ProtectedPage>} />
        <Route path="/delivery-plans/:id" element={<ProtectedPage><DeliveryPlanDetail /></ProtectedPage>} />
        <Route path="/delivery-plans/:planId/batches/:batchId" element={<ProtectedPage><DeliveryBatchDetail /></ProtectedPage>} />
        <Route path="/delivery-plans/:planId/sub-orders/:subOrderId" element={<ProtectedPage><DeliverySubOrderDetail /></ProtectedPage>} />
        <Route path="/assets" element={<ProtectedPage><AssetsPage /></ProtectedPage>} />
        <Route path="/devices/:id" element={<ProtectedPage><DeviceDetail /></ProtectedPage>} />
        <Route path="/after-sales" element={<ProtectedPage><AfterSalesIssues /></ProtectedPage>} />
        <Route path="/after-sales/orders/:orderId" element={<ProtectedPage><AfterSalesOrderDetail /></ProtectedPage>} />
        <Route path="/system" element={<ProtectedPage><SystemPage /></ProtectedPage>} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
       </Routes>
      </PageErrorBoundary>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <AppProvider>
          <Routes>
            <Route path={ROUTES.login} element={<Login />} />
            <Route path={ROUTES.feishuCallback} element={<FeishuCallback />} />
            <Route path="/*" element={<RequireAuth><AppRoutes /></RequireAuth>} />
          </Routes>
        </AppProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}

export default App;
