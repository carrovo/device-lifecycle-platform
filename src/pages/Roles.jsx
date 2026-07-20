import { ROLES_LIST } from '../data/mockData';
import { useRole } from '../context/RoleContext';

const ALL_ACTIONS = [
  'add_material_batch', 'add_assembly', 'add_test_record', 'void_test_record',
  'add_production_plan', 'add_project', 'add_device_allocation', 'add_delivery',
  'add_work_order', 'update_work_order', 'recheck_work_order', 'add_retirement',
  'add_device_type', 'add_module_type', 'edit_device_type', 'edit_module_type',
  'void_project', 'update_alert', 'manage_users', 'manage_roles',
];

const ACTION_LABELS = {
  'add_material_batch': '新增来料批次',
  'add_assembly': '整机装配',
  'add_test_record': '新增测试记录',
  'void_test_record': '作废测试记录',
  'add_production_plan': '新增生产计划',
  'add_project': '新增项目',
  'add_device_allocation': '设备分配',
  'add_delivery': '新增交付记录',
  'add_work_order': '新增维修工单',
  'update_work_order': '更新工单状态',
  'recheck_work_order': '工单复检',
  'add_retirement': '设备退役',
  'add_device_type': '新增整机类型',
  'add_module_type': '新增模块类型',
  'edit_device_type': '编辑整机类型',
  'edit_module_type': '编辑模块类型',
  'void_project': '作废项目',
  'update_alert': '更新告警状态',
  'manage_users': '用户管理',
  'manage_roles': '角色管理',
};

export default function Roles() {
  const { currentRole, actionPermissions, updateActionPermission, navPermissions, updateNavPermission } = useRole();
  const isAdmin = currentRole === '管理员';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-800">角色权限矩阵</h1>
        {isAdmin && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
            管理员模式 · 可编辑权限
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {isAdmin ? '点击复选框可修改各角色的操作权限' : '各角色对功能操作的权限配置（只读展示）'}
      </p>
      <div className="bg-white rounded shadow-sm overflow-x-auto">
        <table className="text-xs w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-32">操作权限</th>
              {ROLES_LIST.map((r) => (
                <th key={r} className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ALL_ACTIONS.map((action) => (
              <tr key={action} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{ACTION_LABELS[action]}</td>
                {ROLES_LIST.map((role) => {
                  const has = (actionPermissions[role] || []).includes(action);
                  return (
                    <td key={role} className="px-3 py-2 text-center">
                      {isAdmin ? (
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={(e) => updateActionPermission(role, action, e.target.checked)}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                      ) : (
                        has
                          ? <span className="text-green-600 font-bold">✓</span>
                          : <span className="text-gray-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white rounded shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">导航菜单可见性</h2>
          {isAdmin && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">管理员可编辑</span>}
        </div>
        <table className="text-xs w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-32">菜单页面</th>
              {ROLES_LIST.map((r) => (
                <th key={r} className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['/dashboard', '生产看板'],
              ['/materials', '来料检验'],
              ['/assembly', '整机装配'],
              ['/tests', '测试中心'],
              ['/devices', '设备列表'],
              ['/production-plan', '生产计划'],
              ['/device-types', '设备类型管理'],
              ['/projects', '项目列表'],
              ['/device-allocation', '设备分配'],
              ['/delivery', '交付流程'],
              ['/operations', '在线运营'],
              ['/alerts', '告警中心'],
              ['/work-orders', '维修工单'],
              ['/retirement', '退役管理'],
              ['/users', '用户管理'],
              ['/roles', '角色权限'],
            ].map(([path, label]) => (
              <tr key={path} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{label}</td>
                {ROLES_LIST.map((role) => {
                  const has = (navPermissions[role] || []).includes(path);
                  return (
                    <td key={role} className="px-3 py-2 text-center">
                      {isAdmin ? (
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={(e) => updateNavPermission(role, path, e.target.checked)}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                      ) : (
                        has
                          ? <span className="text-green-600 font-bold">✓</span>
                          : <span className="text-gray-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
