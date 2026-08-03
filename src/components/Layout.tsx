import { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import Modal from './Modal';

/* ── 单色线性图标（16px，stroke=currentColor）──────────────── */
const I = (p) => ({ width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', ...p });
const ICONS = {
  home: (p) => <svg {...I(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  dashboard: (p) => <svg {...I(p)}><path d="M4 13h6v7H4z" /><path d="M14 4h6v16h-6z" /><path d="M4 4h6v5H4z" /></svg>,
  projects: (p) => <svg {...I(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  assets: (p) => <svg {...I(p)}><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="m3 7.5 9 4.5 9-4.5" /><path d="M12 12v9" /></svg>,
  production: (p) => <svg {...I(p)}><path d="M4 20V10l8-5 8 5v10" /><path d="M8 20v-6h8v6M9 9h6" /></svg>,
  aftersales: (p) => <svg {...I(p)}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z" /></svg>,
  erp: (p) => <svg {...I(p)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M9 13h6M9 17h6" /></svg>,
  system: (p) => <svg {...I(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 2.6h.1A1.7 1.7 0 0 0 9 1.1V1a2 2 0 1 1 4 0v.2A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" /></svg>,
};

// 一级导航 + 可展开的二级菜单。二级菜单通过 ?tab= 深链到既有页面。
// R6-A：ERP 单据中心从项目中心独立；看板收口为 总览/质量/售后；生产计划→生产关联、交付计划→交付执行。
const NAV_ITEMS = [
  { label: '首页', path: '/home', icon: 'home' },
  {
    label: '看板中心', base: '/dashboard', icon: 'dashboard',
    children: [
      { label: '后续规划', to: '/dashboard', tab: null },
    ],
  },
  {
    label: 'ERP 单据中心', base: '/erp-center', icon: 'erp',
    children: [
      { label: '单据总览', to: '/erp-center?tab=overview', tab: 'overview' },
      { label: 'ERP 单据列表', to: '/erp-center?tab=list', tab: 'list' },
    ],
  },
  {
    label: '生产中心', base: '/production', icon: 'production',
    children: [
      { label: '设备建档', to: '/production?tab=archive', tab: 'archive' },
      { label: '生产流转', to: '/production?tab=flow', tab: 'flow' },
    ],
  },
  {
    label: '项目中心', base: '/projects', icon: 'projects', match: ['/projects', '/production-plans', '/delivery-plans'],
    children: [
      { label: '项目列表', to: '/projects?tab=list', tab: 'list' },
      { label: '交付执行', to: '/projects?tab=delivery', tab: 'delivery' },
    ],
  },
  {
    label: '设备管理', base: '/assets', icon: 'assets', match: ['/assets', '/devices'],
    children: [
      { label: '设备台账', to: '/assets?tab=devices', tab: 'devices' },
    ],
  },
  {
    label: '售后管理', base: '/after-sales', icon: 'aftersales',
    children: [
      { label: '后续规划', to: '/after-sales', tab: null },
    ],
  },
  {
    label: '系统管理', base: '/system', icon: 'system',
    children: [
      { label: '基础用户', to: '/system?tab=users', tab: 'users' },
      { label: '角色识别', to: '/system?tab=roles', tab: 'roles' },
      { label: '操作日志', to: '/system?tab=logs', tab: 'logs' },
    ],
  },
];

// 内部角色值 → 展示名。ERP 统一为「ERP 协同角色」。
const ROLE_DISPLAY = { '厂长': '工厂负责人', 'ERP协同角色': 'ERP 协同角色' };
const roleLabel = (r) => ROLE_DISPLAY[r] || r;

function isGroupActive(item, pathname) {
  if (item.path) return pathname === item.path || pathname.startsWith(`${item.path}/`);
  const bases = item.match || [item.base];
  return bases.some((b) => pathname === b || pathname.startsWith(`${b}/`));
}

// 右上角用户菜单（所有页面可见）：当前用户 / 部门 / 角色 + 个人信息 / 权限说明 / 退出登录。
function UserRoleMenu({ currentUser, currentRole }) {
  const navigate = useNavigate();
  const { logout } = useRole();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'profile' | 'perm' | 'logout'
  const openDialog = (d) => { setDialog(d); setOpen(false); };
  const menuItem = (label, onClick, danger = false) => (
    <button onClick={onClick} className={`w-full text-left text-[13px] px-2 py-1.5 rounded-md ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[13px] text-gray-700 border border-[#e5e5e5] rounded-lg pl-1 pr-2.5 py-1 hover:bg-gray-50 transition-colors">
        <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">{currentUser.avatar}</span>
        <span className="text-gray-800 hidden sm:inline">{currentUser.name}</span>
        <span className="text-gray-200 hidden sm:inline">｜</span>
        <span className="inline-flex items-center gap-1 text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{roleLabel(currentRole)}
        </span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 bg-white border border-[#ececec] rounded-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.2)] z-50 p-3 space-y-2">
            <div className="space-y-1.5 text-[13px] px-1">
              <div className="flex justify-between"><span className="text-gray-400 text-xs">当前用户</span><span className="text-gray-800 font-medium">{currentUser.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400 text-xs">所属部门</span><span className="text-gray-700">{currentUser.dept}</span></div>
              <div className="flex justify-between"><span className="text-gray-400 text-xs">当前角色</span><span className="text-gray-800 font-medium">{roleLabel(currentRole)}</span></div>
            </div>
            <div className="border-t border-[#f0f0f0] pt-2 space-y-0.5">
              {menuItem('个人信息', () => openDialog('profile'))}
              {menuItem('权限说明', () => openDialog('perm'))}
              {menuItem('退出登录', () => openDialog('logout'), true)}
            </div>
          </div>
        </>
      )}

      {/* 个人信息 */}
      <Modal isOpen={dialog === 'profile'} onClose={() => setDialog(null)} title="个人信息">
        <div className="space-y-2 text-[13px]">
          {[
            ['当前用户', currentUser.name],
            ['所属部门', currentUser.dept],
            ['岗位/职能', currentUser.title || '—'],
            ['当前角色', roleLabel(currentRole)],
            ['可访问项目', currentUser.projectScope || '—'],
            ['数据权限范围', currentUser.dataScope || '—'],
            ['最近登录', currentUser.lastLogin || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-50 pb-1.5"><span className="text-gray-400 text-xs">{k}</span><span className="text-gray-800">{v}</span></div>
          ))}
          <div className="flex justify-end pt-2"><button onClick={() => setDialog(null)} className="px-4 py-2 text-[13px] bg-gray-900 text-white rounded-md hover:bg-black">关闭</button></div>
        </div>
      </Modal>

      {/* 权限说明 */}
      <Modal isOpen={dialog === 'perm'} onClose={() => setDialog(null)} title="权限说明" size="sm">
        <div className="space-y-3 text-[13px] text-gray-600">
          <p>当前角色：<span className="text-gray-800 font-medium">{roleLabel(currentRole)}</span>。</p>
          <div className="flex justify-end pt-1"><button onClick={() => setDialog(null)} className="px-4 py-2 text-[13px] bg-gray-900 text-white rounded-md hover:bg-black">知道了</button></div>
        </div>
      </Modal>

      {/* 退出登录确认 */}
      <Modal isOpen={dialog === 'logout'} onClose={() => setDialog(null)} title="确认退出登录">
        <div className="space-y-4 text-[13px]">
          <p className="text-gray-600">退出后将清除当前登录凭证并返回登录页。</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDialog(null)} className="px-4 py-2 text-gray-600 border border-[#e0e0e0] rounded-md hover:bg-gray-50">取消</button>
            <button onClick={() => { logout(); navigate('/login', { replace: true }); }} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700">确认退出</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

export default function Layout({ children }) {
  const { currentRole, currentUser, canSeeNav } = useRole();
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get('tab');

  // 手动展开/收起状态；当前所在的一级菜单默认保持展开。
  const [manualOpen, setManualOpen] = useState({});
  const toggleGroup = (label) => setManualOpen((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex min-h-screen w-full bg-[#fafafa]">
      {/* Sidebar：浅色 Vercel 风控制台侧边栏 —— 平台名称 + 主导航 */}
      <aside className="w-56 bg-white border-r border-[#ececec] flex flex-col fixed top-0 left-0 h-full z-40">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[#f0f0f0]">
          <div className="w-7 h-7 rounded-md bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">质</div>
          <div className="leading-tight">
            <div className="text-gray-900 font-semibold text-[13px]">设备全生命周期</div>
            <div className="text-gray-400 text-[11px]">质量管理平台</div>
          </div>
        </div>

        <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const allowed = canSeeNav(item.path || item.base);
            if (item.path) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gray-900" />}
                      {Icon && <Icon className={isActive ? 'text-gray-700' : 'text-gray-400'} />}
                      <span>{item.label}</span>
                      {!allowed && <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">受限</span>}
                    </>
                  )}
                </NavLink>
              );
            }
            const groupActive = isGroupActive(item, location.pathname);
            const expanded = manualOpen[item.label] ?? groupActive;
            const onBase = location.pathname === item.base;
            const defaultTab = item.children[0]?.tab;
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                    groupActive ? 'text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {Icon && <Icon className={groupActive ? 'text-gray-700' : 'text-gray-400'} />}
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {!allowed && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">受限</span>}
                    <svg className={`text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                </button>
                {expanded && (
                  <div className="mt-0.5 mb-1 ml-4 pl-2 border-l border-[#f0f0f0] space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = onBase && (activeTab ? activeTab === child.tab : child.tab === defaultTab);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`block pl-2.5 pr-2 py-1.5 rounded-md text-[13px] transition-colors ${
                            childActive
                              ? 'bg-gray-100 text-gray-900 font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Content：顶部条（右上角用户 / 角色区域）+ 页面内容 */}
      <div className="flex-1 min-w-0 ml-56 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-[#ececec] flex items-center justify-end px-5 flex-shrink-0">
          <UserRoleMenu currentUser={currentUser} currentRole={currentRole} />
        </header>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
