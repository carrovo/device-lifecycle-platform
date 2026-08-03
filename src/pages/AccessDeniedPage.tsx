import { Link, useLocation } from 'react-router-dom';
import { useRole } from '../context/RoleContext';

const MODULE_NAMES = [
  ['/dashboard', '看板中心'],
  ['/erp-center', 'ERP 单据中心'],
  ['/production', '生产中心'],
  ['/projects', '项目中心'],
  ['/delivery-plans', '项目中心'],
  ['/assets', '设备管理'],
  ['/devices', '设备管理'],
  ['/after-sales', '售后管理'],
  ['/system', '系统管理'],
];

export default function AccessDeniedPage() {
  const location = useLocation();
  const { currentRole } = useRole();
  const moduleName = MODULE_NAMES.find(([path]) => location.pathname.startsWith(path))?.[1] || '该功能';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h1 className="mt-5 text-lg font-semibold text-gray-900">暂无访问权限</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          当前角色“{currentRole}”暂无权限访问{moduleName}。
          如需使用，请联系管理员在“系统管理 → 基础用户”中调整您的平台角色。
        </p>
        <Link to="/home" className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-4 text-sm text-white hover:bg-black">
          返回首页
        </Link>
      </div>
    </div>
  );
}
