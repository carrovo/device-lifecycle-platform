import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getOperationLogFilters, getOperationLogs, getRoles, getUsers, updateUser as updateUserRequest,
} from '../api/system';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { usePaged } from '../components/usePaged';
import {
  Page, PageHeader, Section, Toolbar, SearchInput, Select, Input, Table, Chip, Btn, LinkAction, DescList,
} from '../components/ui';

const roleDisplay = (role) => ({ 厂长: '工厂负责人', ERP协同角色: 'ERP 协同角色' }[role] || role);

function UserModal({ user, roles, onClose, onSave, saving }) {
  const [role, setRole] = useState(user.role);
  return (
    <div className="space-y-5">
      <DescList cols={2} items={[
        ['用户编号', user.id], ['姓名', user.name], ['部门', user.dept || '—'], ['岗位 / 职能', user.title || '—'],
        ['当前状态', user.status || '启用'], ['最近登录', user.lastLogin || '—'],
      ]} />
      <div><label className="block text-xs text-gray-500 mb-1">平台角色</label><Select className="w-full" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item.role} value={item.role}>{item.displayName || roleDisplay(item.role)}</option>)}</Select></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={saving} onClick={() => onSave({ role })}>{saving ? '保存中…' : '保存用户角色'}</Btn></div>
    </div>
  );
}

function UsersTab() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await getUsers({ query, role });
        setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, role]);
  useEffect(() => {
    getRoles().then((payload) => setRoles(Array.isArray(payload) ? payload : [])).catch((requestError) => setError(requestError.message));
  }, []);
  const paged = usePaged(rows, 10);
  const selected = rows.find((item) => item.id === selectedId);
  const updateUser = async (payload) => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateUserRequest(selected.id, payload);
      setRows((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedId('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleUser = async (user) => {
    const status = user.status === '停用' ? '启用' : '停用';
    setError('');
    try {
      const updated = await updateUserRequest(user.id, { status });
      setRows((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 位基础用户</span>}>
        <SearchInput className="w-64" placeholder="搜索姓名 / 部门" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select value={role} onChange={(event) => setRole(event.target.value)}><option value="">全部角色</option>{roles.map((item) => <option key={item.role} value={item.role}>{item.displayName || roleDisplay(item.role)}</option>)}</Select>
      </Toolbar>
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      <Table head={['用户编号', '登录账号', '姓名', '部门', '岗位 / 职能', '平台角色', '状态', '最近登录', '操作']} empty={loading ? '正在加载用户数据…' : '暂无符合条件的用户'} footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((user) => <tr key={user.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 font-mono text-xs text-gray-500">{user.id}</td><td className="px-3 py-2 font-mono text-xs text-gray-600">{user.username}</td><td className="px-3 py-2 font-medium text-gray-800">{user.name}</td><td className="px-3 py-2 text-gray-600">{user.dept}</td>
          <td className="px-3 py-2 text-gray-600">{user.title || '—'}</td><td className="px-3 py-2"><Chip>{roleDisplay(user.role)}</Chip></td><td className="px-3 py-2"><Chip>{user.status || '启用'}</Chip></td>
          <td className="px-3 py-2 text-xs text-gray-500">{user.lastLogin || '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction onClick={() => setSelectedId(user.id)}>查看 / 修改角色</LinkAction><LinkAction onClick={() => toggleUser(user)}>{user.status === '停用' ? '启用' : '停用'}</LinkAction></div></td>
        </tr>)}
      </Table>
      <Modal isOpen={!!selected} onClose={() => setSelectedId('')} title="用户详情">{selected && <UserModal user={selected} roles={roles} saving={saving} onClose={() => setSelectedId('')} onSave={updateUser} />}</Modal>
    </>
  );
}

function RolesTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getRoles()
      .then((payload) => setRows(Array.isArray(payload) ? payload : []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);
  const paged = usePaged(rows, 10);
  return (
    <>
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      <Section title="角色识别" subtitle="当前仅展示基础角色与模块访问范围" bodyClassName="p-0">
        <Table head={['角色', '识别用户数', '角色说明', '基础模块访问范围']} empty={loading ? '正在读取角色数据…' : '暂无角色数据'} footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
          {paged.pageItems.map((item) => <tr key={item.role} className="hover:bg-[#fafafa]"><td className="px-3 py-2"><Chip>{item.displayName || roleDisplay(item.role)}</Chip></td><td className="px-3 py-2 text-gray-600">{item.count}</td><td className="px-3 py-2 text-gray-600">{item.description}</td><td className="px-3 py-2 text-xs text-gray-500">{item.modules}</td></tr>)}
        </Table>
      </Section>
    </>
  );
}

function LogsTab() {
  const [filters, setFilters] = useState({ query: '', operator: '', module: '', date: '' });
  const [rows, setRows] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ operators: [], modules: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  useEffect(() => {
    getOperationLogFilters().then((payload) => setFilterOptions({
      operators: Array.isArray(payload?.operators) ? payload.operators : [],
      modules: Array.isArray(payload?.modules) ? payload.modules : [],
    })).catch((requestError) => setError(requestError.message));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await getOperationLogs(filters);
        setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters]);
  const paged = usePaged(rows, 20);
  return (
    <>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 条操作记录</span>}>
        <SearchInput className="w-64" placeholder="搜索操作类型 / 说明" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.operator} onChange={(event) => update('operator', event.target.value)}><option value="">全部操作人</option>{filterOptions.operators.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.module} onChange={(event) => update('module', event.target.value)}><option value="">全部模块</option>{filterOptions.modules.map((item) => <option key={item}>{item}</option>)}</Select>
        <Input type="date" value={filters.date} onChange={(event) => update('date', event.target.value)} />
      </Toolbar>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      <Table head={['操作时间', '操作人', '所属模块', '操作动作', '对象编号', '操作摘要', '操作']} empty={loading ? '正在读取操作日志…' : '暂无操作日志'} footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((log) => <tr key={log.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{log.timestamp || '—'}</td><td className="px-3 py-2 text-gray-600">{log.operator || '—'}</td><td className="px-3 py-2 text-gray-600">{log.module || '—'}</td>
          <td className="px-3 py-2 text-gray-700">{log.actionType || '—'}</td><td className="px-3 py-2 font-mono text-xs text-gray-500">{log.objectId || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{log.notes || '—'}</td>
          <td className="px-3 py-2"><LinkAction onClick={() => setDetail(log)}>查看详情</LinkAction></td>
        </tr>)}
      </Table>
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="操作日志详情">{detail && <DescList cols={2} items={[
        ['操作时间', detail.timestamp || '—'], ['操作人', detail.operator || '—'], ['所属模块', detail.module || '—'], ['操作动作', detail.actionType || '—'],
        ['对象类型', detail.objectType || '—'], ['对象编号', detail.objectId || '—'], ['操作摘要', detail.notes || '—'],
        detail.fromStatus && ['原记录', detail.fromStatus], detail.toStatus && ['更新后', detail.toStatus],
      ]} />}</Modal>
    </>
  );
}

export default function SystemPage() {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const active = ['users', 'roles', 'logs'].includes(requested) ? requested : 'users';
  const config = {
    users: ['基础用户', '查看基础用户，并由管理员维护平台角色和启停状态。'],
    roles: ['角色识别', '查看角色说明和基础模块访问范围。'],
    logs: ['操作日志', '查询设备、生产、项目和交付等关键操作记录。'],
  }[active];
  return (
    <Page>
      <PageHeader title={config[0]} description={config[1]} breadcrumb={<div className="text-xs text-gray-400 mb-1">系统管理 / {config[0]}</div>} />
      {active === 'users' && <UsersTab />}
      {active === 'roles' && <RolesTab />}
      {active === 'logs' && <LogsTab />}
    </Page>
  );
}
