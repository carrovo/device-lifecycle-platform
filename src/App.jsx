import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { RoleProvider } from './context/RoleContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import HomePage from './pages/HomePage';
import ErpCenter from './pages/ErpCenter';
import ProductionCenter from './pages/ProductionCenter';
import ProjectsCenter from './pages/ProjectsCenter';
import ProjectDetail from './pages/ProjectDetail';
import ProductionPlanDetail from './pages/ProductionPlanDetail';
import DeliveryPlanDetail from './pages/DeliveryPlanDetail';
import AssetsPage from './pages/AssetsPage';
import DeviceDetail from './pages/DeviceDetail';
import PlanningPlaceholder from './pages/PlanningPlaceholder';
import SystemPage from './pages/SystemPage';
import MobileReportPage from './pages/MobileReportPage';
import MobileAssemblyPage from './pages/MobileAssemblyPage';

function RequireAuth({ children }) {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<PlanningPlaceholder type="dashboard" />} />
        <Route path="/erp-center" element={<ErpCenter />} />
        <Route path="/production" element={<ProductionCenter />} />
        <Route path="/projects" element={<ProjectsCenter />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/production-plans/:id" element={<ProductionPlanDetail />} />
        <Route path="/delivery-plans/:id" element={<DeliveryPlanDetail />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/after-sales" element={<PlanningPlaceholder type="afterSales" />} />
        <Route path="/system" element={<SystemPage />} />
        {/* Legacy redirects */}
        <Route path="/manufacture" element={<Navigate to="/production?tab=flow" replace />} />
        <Route path="/production-plan" element={<Navigate to="/production?tab=flow" replace />} />
        <Route path="/materials" element={<Navigate to="/assets?tab=devices" replace />} />
        <Route path="/assembly" element={<Navigate to="/production?tab=flow" replace />} />
        <Route path="/tests" element={<Navigate to="/production?tab=flow" replace />} />
        <Route path="/devices" element={<Navigate to="/assets?tab=devices" replace />} />
        <Route path="/work-orders" element={<Navigate to="/after-sales" replace />} />
        <Route path="/delivery" element={<Navigate to="/projects?tab=delivery" replace />} />
        <Route path="/erp-forms" element={<Navigate to="/erp-center" replace />} />
        <Route path="/users" element={<Navigate to="/system?tab=roles" replace />} />
        <Route path="/roles" element={<Navigate to="/system?tab=roles" replace />} />
        <Route path="/operations" element={<Navigate to="/assets?tab=devices" replace />} />
        <Route path="/alerts" element={<Navigate to="/assets?tab=devices" replace />} />
        <Route path="/device-allocation" element={<Navigate to="/projects" replace />} />
        <Route path="/retirement" element={<Navigate to="/assets?tab=devices" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/mobile/report" element={<MobileReportPage />} />
          <Route path="/mobile/assembly" element={<MobileAssemblyPage />} />
            <Route path="/*" element={<RequireAuth><AppRoutes /></RequireAuth>} />
          </Routes>
        </AppProvider>
      </RoleProvider>
    </BrowserRouter>
  );
}

export default App;
