import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { deliveryMetrics } from '../data/deliveryV2';
import { createClientId } from '../data/clientId';
import { nowText } from '../data/dateTime';
import { getDeliveryPlansPage, getProjectListOptions, getProjectsPage } from '../api/projectCenter';
import {
  Page, PageHeader, Toolbar, SearchInput, Select, Input, Table, Btn, LinkAction, CompactProgress,
} from '../components/ui';


function ProjectForm({ project, state, onClose, onSave }) {
  const projectTypes = state.projectTypes || [];
  const [form, setForm] = useState({
    name: project?.name || '',
    projectType: project?.projectType || projectTypes[0] || '',
    client: project?.client || '',
    manager: project?.manager || state.currentUser,
    notes: project?.notes || '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.name.trim() || !form.client.trim() || !form.manager.trim()) {
      setError('请填写项目名称、客户和项目负责人。');
      return;
    }
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-500 mb-1">项目名称</label><Input className="w-full" value={form.name} onChange={(event) => update('name', event.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">项目类型 / 业务场景</label><Select className="w-full" value={form.projectType} onChange={(event) => update('projectType', event.target.value)}>{projectTypes.map((item) => <option key={item}>{item}</option>)}</Select></div>
        <div><label className="block text-xs text-gray-500 mb-1">项目负责人</label><Input className="w-full" value={form.manager} onChange={(event) => update('manager', event.target.value)} /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-1">客户</label><Input className="w-full" value={form.client} onChange={(event) => update('client', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-500 mb-1">备注（选填）</label><Input className="w-full" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>保存项目</Btn></div>
    </div>
  );
}

function ProjectList() {
  const { state, dispatch } = useApp();
  const [filters, setFilters] = useState({ query: '', type: '', manager: '', updated: '', hasDevice: '', hasDelivery: '' });
  const [modal, setModal] = useState(null);
  const [result, setResult] = useState({ items: [], page: 1, size: 10, total: 0, totalPages: 1 });
  const [options, setOptions] = useState({ managers: [] });
  const [reload, setReload] = useState(0);
  const update = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setResult((prev) => ({ ...prev, page: 1 })); };
  useEffect(() => {
    getProjectListOptions()
      .then((payload) => setOptions({ ...payload, managers: Array.isArray(payload?.managers) ? payload.managers : [] }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getProjectsPage({ ...filters, page: result.page, size: result.size })
        .then((payload) => { if (!cancelled) setResult((prev) => ({ ...prev, ...payload, items: Array.isArray(payload?.items) ? payload.items : [] })); })
        .catch(() => { if (!cancelled) setResult((prev) => ({ ...prev, items: [] })); });
    }, filters.query ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [filters, result.page, result.size, reload]);
  const rows = Array.isArray(result.items) ? result.items : [];
  const managers = options.managers || [];
  const editing = modal?.id ? rows.find((item) => item.id === modal.id) : null;
  const save = (form) => {
    const timestamp = nowText();
    let request;
    if (editing) {
      request = dispatch({ type: 'UPDATE_PROJECT', payload: { id: editing.id, ...form, updatedAt: timestamp } });
      Promise.resolve(request).then((saved) => { if (saved) dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: createClientId('LOG'), projectId: editing.id, actionType: '编辑项目', module: '项目中心', notes: '更新项目基础信息' } }); });
    } else {
      const id = createClientId('PROJ');
      request = dispatch({ type: 'ADD_PROJECT', payload: { id, ...form, updatedAt: timestamp } });
      Promise.resolve(request).then((saved) => { if (saved) dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: createClientId('LOG'), projectId: id, actionType: '新建项目', module: '项目中心', notes: form.name } }); });
    }
    setModal(null);
    Promise.resolve(request).finally(() => setReload((value) => value + 1));
  };
  return (
    <Page>
      <PageHeader title="项目列表" description="查看平台项目，并从项目详情维护点位、设备归属和交付执行。" actions={<Btn variant="primary" onClick={() => setModal({ type: 'create' })}>新建项目</Btn>} />
      <Toolbar right={<span className="text-xs text-gray-400">共 {result.total} 个项目</span>}>
        <SearchInput className="w-64" placeholder="搜索项目名称 / 客户 / 负责人" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.type} onChange={(event) => update('type', event.target.value)}><option value="">全部项目类型</option>{(state.projectTypes || []).map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.manager} onChange={(event) => update('manager', event.target.value)}><option value="">全部负责人</option>{managers.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.hasDevice} onChange={(event) => update('hasDevice', event.target.value)}><option value="">设备关联不限</option><option value="yes">已关联设备</option><option value="no">未关联设备</option></Select>
        <Select value={filters.hasDelivery} onChange={(event) => update('hasDelivery', event.target.value)}><option value="">交付执行不限</option><option value="yes">存在交付执行</option><option value="no">暂无交付执行</option></Select>
        <Input type="date" value={filters.updated} onChange={(event) => update('updated', event.target.value)} />
      </Toolbar>
      <Table head={['项目名称', '项目类型 / 业务场景', '项目负责人', '点位数量', '设备数量', '最近更新时间', '操作']} empty="暂无符合条件的项目" footer={<Pagination page={result.page} pageSize={result.size} total={result.total} totalPages={result.totalPages} onChange={(page) => setResult((prev) => ({ ...prev, page }))} onPageSizeChange={(size) => setResult((prev) => ({ ...prev, page: 1, size }))} />}>
        {rows.map((project) => (
          <tr key={project.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/projects/${project.id}`}>{project.name}</Link></td>
            <td className="px-3 py-2 text-gray-600">{project.projectType || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{project.manager || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{project.pointCount}</td>
            <td className="px-3 py-2 text-gray-600">{project.deviceCount}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{project.updatedAt || '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction to={`/projects/${project.id}`}>查看详情</LinkAction><LinkAction onClick={() => setModal({ type: 'edit', id: project.id })}>编辑项目</LinkAction></div></td>
          </tr>
        ))}
      </Table>
      <Modal size="lg" isOpen={!!modal} onClose={() => setModal(null)} title={editing ? '编辑项目' : '新建项目'}><ProjectForm project={editing} state={state} onClose={() => setModal(null)} onSave={save} /></Modal>
    </Page>
  );
}

function DeliveryForm({ state, onClose, onSave }) {
  const [form, setForm] = useState({
    projectId: '',
    plannedCount: '',
    owner: state.currentUser,
    targetDate: '',
    notes: '',
    demandDescription: '',
    feishuDemandUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.projectId) next.projectId = '请选择项目。';
    if (!Number.isInteger(Number(form.plannedCount)) || Number(form.plannedCount) <= 0) next.plannedCount = '请输入大于 0 的整数。';
    if (!form.owner.trim()) next.owner = '请输入交付负责人。';
    if (form.feishuDemandUrl && !/^https?:\/\/\S+$/i.test(form.feishuDemandUrl)) next.feishuDemandUrl = '请输入有效的 http 或 https 链接。';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    onSave({ ...form, owner: form.owner.trim(), plannedCount: Number(form.plannedCount) });
  };
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800">基础信息</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-600 mb-1">项目 <span className="text-red-500">*</span></label><Select className="w-full" value={form.projectId} onChange={(event) => update('projectId', event.target.value)}><option value="">请选择项目</option>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{errors.projectId && <p className="text-xs text-red-600 mt-1">{errors.projectId}</p>}</div>
          <div><label className="block text-xs text-gray-600 mb-1">计划交付数量 <span className="text-red-500">*</span></label><Input className="w-full" type="number" min="1" step="1" value={form.plannedCount} onChange={(event) => update('plannedCount', event.target.value)} />{errors.plannedCount && <p className="text-xs text-red-600 mt-1">{errors.plannedCount}</p>}</div>
          <div><label className="block text-xs text-gray-600 mb-1">交付负责人 <span className="text-red-500">*</span></label><Input className="w-full" placeholder="请输入交付负责人姓名" value={form.owner} onChange={(event) => update('owner', event.target.value)} />{errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}</div>
          <div><label className="block text-xs text-gray-600 mb-1">目标完成日期</label><Input className="w-full" type="date" value={form.targetDate} onChange={(event) => update('targetDate', event.target.value)} /></div>
        </div>
        <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      </div>
      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800">需求信息</h3>
        <div><label className="block text-xs text-gray-600 mb-1">交付需求说明</label><textarea className="ui-input w-full min-h-20" value={form.demandDescription} onChange={(event) => update('demandDescription', event.target.value)} /></div>
        <div><label className="block text-xs text-gray-600 mb-1">相关飞书需求链接</label><Input className="w-full" placeholder="https://" value={form.feishuDemandUrl} onChange={(event) => update('feishuDemandUrl', event.target.value)} />{errors.feishuDemandUrl && <p className="text-xs text-red-600 mt-1">{errors.feishuDemandUrl}</p>}</div>
      </div>
      <p className="text-xs text-gray-400">交付执行编号、创建人和创建时间由系统自动生成；点位、设备和外部来源在交付批次中维护。</p>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>新建交付执行</Btn></div>
    </div>
  );
}

function DeliveryList() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ query: '', projectId: '', owner: '', targetDate: '', completed: '' });
  const [open, setOpen] = useState(false);
  const [references, setReferences] = useState<{ projects: any[]; owners: any[] }>({ projects: [], owners: [] });
  const [result, setResult] = useState({ items: [], page: 1, size: 10, total: 0, totalPages: 1 });
  const update = (key, value) => { setFilters((prev) => ({ ...prev, [key]: value })); setResult((prev) => ({ ...prev, page: 1 })); };
  useEffect(() => {
    getProjectListOptions()
      .then((payload) => setReferences({
        ...payload,
        projects: Array.isArray(payload?.projects) ? payload.projects : [],
        owners: Array.isArray(payload?.owners) ? payload.owners : [],
      }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getDeliveryPlansPage({ ...filters, page: result.page, size: result.size })
        .then((payload) => { if (!cancelled) setResult((prev) => ({ ...prev, ...payload, items: Array.isArray(payload?.items) ? payload.items : [] })); })
        .catch(() => { if (!cancelled) setResult((prev) => ({ ...prev, items: [] })); });
    }, filters.query ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [filters, result.page, result.size]);
  const owners = references.owners || [];
  const projects = useMemo(() => Array.isArray(references.projects) ? references.projects : [], [references.projects]);
  const rows = useMemo(() => (Array.isArray(result.items) ? result.items : [])
    .map((plan) => ({
      ...plan,
      projectName: plan.projectName || projects.find((item) => item.id === plan.projectId)?.name || '—',
      metrics: deliveryMetrics(plan),
    })), [result.items, projects]);
  const save = (form) => {
    const timestamp = nowText();
    const id = createClientId('DE');
    const request = dispatch({
      type: 'ADD_DELIVERY_PLAN',
      payload: {
        id,
        ...form,
        createdBy: state.currentUser,
        createdAt: timestamp,
        updatedAt: timestamp,
        nextBatchSequence: 1,
        batches: [],
      },
    });
    Promise.resolve(request).then((saved) => {
      if (saved) dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: createClientId('LOG'), deliveryPlanId: id, projectId: form.projectId, actionType: '新建交付执行', module: '项目中心', notes: `计划交付 ${form.plannedCount} 台` } });
    });
    setOpen(false);
    Promise.resolve(request).then((saved) => { if (saved) navigate(`/delivery-plans/${saved.id || id}`); });
  };
  return (
    <Page>
      <PageHeader title="交付执行" description="按项目建立总体交付目标，并通过多个交付批次安排具体设备。" actions={<Btn variant="primary" onClick={() => setOpen(true)}>新建交付执行</Btn>} />
      <Toolbar right={<span className="text-xs text-gray-400">共 {result.total} 条交付执行</span>}>
        <SearchInput className="w-52" placeholder="交付执行编号" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.projectId} onChange={(event) => update('projectId', event.target.value)}><option value="">全部项目</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={filters.owner} onChange={(event) => update('owner', event.target.value)}><option value="">全部负责人</option>{owners.map((item) => <option key={item}>{item}</option>)}</Select>
        <Input type="date" value={filters.targetDate} onChange={(event) => update('targetDate', event.target.value)} />
        <Select value={filters.completed} onChange={(event) => update('completed', event.target.value)}><option value="">完成情况不限</option><option value="yes">已完成</option><option value="no">未完成</option></Select>
      </Toolbar>
      <Table tableClassName="min-w-[1180px]" head={['交付执行编号', '项目', '计划交付', '已纳入批次', '已完成交付', '完成进度', '批次数量', '交付负责人', '目标完成日期', '最近更新时间', '操作']} empty="暂无交付执行" footer={<Pagination page={result.page} pageSize={result.size} total={result.total} totalPages={result.totalPages} onChange={(page) => setResult((prev) => ({ ...prev, page }))} onPageSizeChange={(size) => setResult((prev) => ({ ...prev, page: 1, size }))} />}>
        {rows.map((plan, index) => (
          <tr key={plan.id} className={`hover:bg-[#f7f7f7] ${index % 2 ? 'bg-[#fcfcfc]' : ''}`}>
            <td className="px-3 py-2.5"><Link className="ui-link font-mono font-semibold text-gray-900" to={`/delivery-plans/${plan.id}`}>{plan.id}</Link></td>
            <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap"><Link className="ui-link" to={`/projects/${plan.projectId}?tab=delivery`}>{plan.projectName}</Link></td>
            <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">{plan.metrics.planned}</td>
            <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">{plan.metrics.included}</td>
            <td className="px-3 py-2.5 text-center text-emerald-700 font-medium tabular-nums">{plan.metrics.completed}</td>
            <td className="px-3 py-2.5 min-w-40">
              <div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-800 tabular-nums">{plan.metrics.completed} / {plan.metrics.planned}</span>{plan.metrics.isCompleted && <StatusBadge status="已完成" />}</div>
              <CompactProgress className="mt-1.5" value={plan.metrics.completed} total={plan.metrics.planned} />
              <div className="flex flex-wrap gap-x-2 mt-1 text-[11px]">{plan.metrics.unconfirmed > 0 && <span className="text-amber-700">{plan.metrics.unconfirmed} 台待确认</span>}{plan.metrics.failed > 0 && <span className="text-red-600">{plan.metrics.failed} 台未通过</span>}</div>
            </td>
            <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">{plan.metrics.batchCount}</td>
            <td className="px-3 py-2 text-gray-600">{plan.owner || '—'}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{plan.targetDate || '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.updatedAt || '—'}</td>
            <td className="px-3 py-2 min-w-20 whitespace-nowrap"><LinkAction to={`/delivery-plans/${plan.id}`}>查看详情</LinkAction></td>
          </tr>
        ))}
      </Table>
      <Modal size="xl" isOpen={open} onClose={() => setOpen(false)} title="新建交付执行"><DeliveryForm state={{ ...state, projects }} onClose={() => setOpen(false)} onSave={save} /></Modal>
    </Page>
  );
}

export default function ProjectsCenter() {
  const [searchParams] = useSearchParams();
  return searchParams.get('tab') === 'delivery' ? <DeliveryList /> : <ProjectList />;
}
