import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ROLES_LIST } from '../data/mockData';
import Modal from '../components/Modal';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Section, Toolbar, SearchInput, Select, Input, Table, Chip, Btn, LinkAction, DescList,
} from '../components/ui';

const roleDisplay = (role) => ({ 厂长: '工厂负责人', ERP协同角色: 'ERP 协同角色' }[role] || role);
const ROLE_DESCRIPTIONS = {
  管理员: '查看当前全部模块并维护基础用户角色',
  厂长: '查看生产、项目和设备相关信息',
  项目负责人: '查看项目、点位、设备归属与交付执行',
  装配工: '维护设备建档与非测试生产节点',
  测试员: '维护初测、终测和复测关键结果',
  质检员: '查看质量结果与 ERP 来源信息',
  运维工程师: '维护轻量交付执行信息',
  维修工程师: '查看设备与生产履历',
};
const ROLE_MODULES = {
  管理员: '全部当前模块',
  厂长: '首页、ERP 单据中心、生产中心、项目中心、设备管理',
  项目负责人: '首页、项目中心、设备管理',
  装配工: '生产中心、设备管理',
  测试员: '生产中心、设备管理',
  质检员: 'ERP 单据中心、生产中心、设备管理',
  运维工程师: '项目中心、设备管理',
  维修工程师: '设备管理',
};
const logModule = (log) => log.module || (log.projectId ? '项目中心' : log.deliveryPlanId ? '项目中心' : log.deviceId ? '生产中心' : '系统管理');

function UserModal({ user, onClose, onSave }) {
  const [role, setRole] = useState(user.role);
  return (
    <div className="space-y-5">
      <DescList cols={2} items={[
        ['用户编号', user.id], ['姓名', user.name], ['部门', user.dept || '—'], ['岗位 / 职能', user.title || '—'],
        ['当前状态', user.status || '启用'], ['最近登录', user.lastLogin || '—'],
      ]} />
      <div><label className="block text-xs text-gray-500 mb-1">平台角色</label><Select className="w-full" value={role} onChange={(event) => setRole(event.target.value)}>{ROLES_LIST.map((item) => <option key={item} value={item}>{roleDisplay(item)}</option>)}</Select></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={() => onSave({ role })}>保存用户角色</Btn></div>
    </div>
  );
}

function UsersTab() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const rows = useMemo(() => state.users.filter((user) => (!query || `${user.name} ${user.dept}`.includes(query)) && (!role || user.role === role)), [state.users, query, role]);
  const paged = usePaged(rows, 10);
  const selected = state.users.find((item) => item.id === selectedId);
  const updateUser = (payload) => {
    dispatch({ type: 'UPDATE_USER', payload: { id: selected.id, ...payload } });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, operator: state.currentUser, timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), actionType: '修改用户角色', module: '系统管理', notes: `${selected.name}：${roleDisplay(payload.role)}` } });
    setSelectedId('');
  };
  const toggleUser = (user) => {
    const status = user.status === '停用' ? '启用' : '停用';
    dispatch({ type: 'UPDATE_USER', payload: { id: user.id, status } });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, operator: state.currentUser, timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), actionType: `${status}用户`, module: '系统管理', notes: user.name } });
  };
  return (
    <>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 位基础用户</span>}>
        <SearchInput className="w-64" placeholder="搜索姓名 / 部门" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select value={role} onChange={(event) => setRole(event.target.value)}><option value="">全部角色</option>{[...new Set(state.users.map((item) => item.role))].map((item) => <option key={item} value={item}>{roleDisplay(item)}</option>)}</Select>
      </Toolbar>
      <Table head={['用户编号', '姓名', '部门', '岗位 / 职能', '平台角色', '状态', '最近登录', '操作']} empty="暂无符合条件的用户" footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((user) => <tr key={user.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 font-mono text-xs text-gray-500">{user.id}</td><td className="px-3 py-2 font-medium text-gray-800">{user.name}</td><td className="px-3 py-2 text-gray-600">{user.dept}</td>
          <td className="px-3 py-2 text-gray-600">{user.title || '—'}</td><td className="px-3 py-2"><Chip>{roleDisplay(user.role)}</Chip></td><td className="px-3 py-2"><Chip>{user.status || '启用'}</Chip></td>
          <td className="px-3 py-2 text-xs text-gray-500">{user.lastLogin || '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction onClick={() => setSelectedId(user.id)}>查看 / 修改角色</LinkAction><LinkAction onClick={() => toggleUser(user)}>{user.status === '停用' ? '启用' : '停用'}</LinkAction></div></td>
        </tr>)}
      </Table>
      <Modal isOpen={!!selected} onClose={() => setSelectedId('')} title="用户详情">{selected && <UserModal user={selected} onClose={() => setSelectedId('')} onSave={updateUser} />}</Modal>
    </>
  );
}

function RolesTab() {
  const { state } = useApp();
  const rows = ROLES_LIST.map((role) => ({
    role, count: state.users.filter((user) => user.role === role).length,
    description: ROLE_DESCRIPTIONS[role] || '基础业务角色识别',
    modules: ROLE_MODULES[role] || '按岗位识别基础模块',
  }));
  const paged = usePaged(rows, 10);
  return (
    <>
      <Section title="角色识别" subtitle="当前仅展示基础角色与模块访问范围" bodyClassName="p-0">
        <Table head={['角色', '识别用户数', '角色说明', '基础模块访问范围']} footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
          {paged.pageItems.map((item) => <tr key={item.role} className="hover:bg-[#fafafa]"><td className="px-3 py-2"><Chip>{roleDisplay(item.role)}</Chip></td><td className="px-3 py-2 text-gray-600">{item.count}</td><td className="px-3 py-2 text-gray-600">{item.description}</td><td className="px-3 py-2 text-xs text-gray-500">{item.modules}</td></tr>)}
        </Table>
      </Section>
      <Section title="后续规划"><p className="text-[13px] text-gray-500">完整权限矩阵、字典管理、流程模板、通知规则、字段级权限和复杂数据范围权限后续补充。</p></Section>
    </>
  );
}

function LogsTab() {
  const { state } = useApp();
  const [filters, setFilters] = useState({ query: '', operator: '', module: '', date: '' });
  const [detail, setDetail] = useState(null);
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const operators = [...new Set(state.operationLogs.map((item) => item.operator).filter(Boolean))];
  const modules = [...new Set(state.operationLogs.map(logModule))];
  const rows = useMemo(() => [...state.operationLogs]
    .filter((log) => {
      const module = logModule(log);
      return (!filters.query || `${log.operator} ${log.actionType} ${log.notes || ''}`.includes(filters.query))
        && (!filters.operator || log.operator === filters.operator)
        && (!filters.module || module === filters.module)
        && (!filters.date || (log.timestamp || '').slice(0, 10) === filters.date);
    })
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [state.operationLogs, filters]);
  const paged = usePaged(rows, 20);
  return (
    <>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 条操作记录</span>}>
        <SearchInput className="w-64" placeholder="搜索操作类型 / 说明" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.operator} onChange={(event) => update('operator', event.target.value)}><option value="">全部操作人</option>{operators.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.module} onChange={(event) => update('module', event.target.value)}><option value="">全部模块</option>{modules.map((item) => <option key={item}>{item}</option>)}</Select>
        <Input type="date" value={filters.date} onChange={(event) => update('date', event.target.value)} />
      </Toolbar>
      <Table head={['操作时间', '操作人', '所属模块', '操作动作', '对象编号', '操作摘要', '操作']} empty="暂无操作日志" footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((log) => <tr key={log.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{log.timestamp || '—'}</td><td className="px-3 py-2 text-gray-600">{log.operator || '—'}</td><td className="px-3 py-2 text-gray-600">{logModule(log)}</td>
          <td className="px-3 py-2 text-gray-700">{log.actionType || '—'}</td><td className="px-3 py-2 font-mono text-xs text-gray-500">{log.deviceId || log.projectId || log.deliveryPlanId || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{log.notes || '—'}</td>
          <td className="px-3 py-2"><LinkAction onClick={() => setDetail(log)}>查看详情</LinkAction></td>
        </tr>)}
      </Table>
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="操作日志详情">{detail && <DescList cols={2} items={[
        ['操作时间', detail.timestamp || '—'], ['操作人', detail.operator || '—'], ['所属模块', logModule(detail)], ['操作动作', detail.actionType || '—'],
        ['对象编号', detail.deviceId || detail.projectId || detail.deliveryPlanId || '—'], ['操作摘要', detail.notes || '—'],
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
