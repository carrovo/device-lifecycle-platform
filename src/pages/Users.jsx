import { useState } from 'react';
import { useRole } from '../context/RoleContext';
import { FEISHU_USERS, ROLES_LIST } from '../data/mockData';

export default function Users() {
  const { canDo } = useRole();
  const [users, setUsers] = useState(FEISHU_USERS.map((u) => ({ ...u })));
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">用户管理</h1>
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['头像', '姓名', '部门', '当前角色', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
                    {u.avatar}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.dept}</td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
                    >
                      {ROLES_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{u.role}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canDo('manage_users') && (
                    editingId === u.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: editRole } : x));
                            setEditingId(null);
                          }}
                          className="text-xs text-green-600 hover:underline"
                        >保存</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">取消</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(u.id); setEditRole(u.role); }}
                        className="text-xs text-slate-600 hover:underline"
                      >编辑角色</button>
                    )
                  )}
                  {!canDo('manage_users') && <span className="text-xs text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
