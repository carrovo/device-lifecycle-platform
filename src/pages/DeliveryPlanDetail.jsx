import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import { isProductionComplete, productionProgressLabel } from '../data/prdV12';
import { deliveryErpReferences } from '../data/erpPrototype';
import {
  batchDisplayName, batchMetrics, deliveryMetrics, deliveryRelations,
} from '../data/deliveryV2';
import {
  Page, PageHeader, Section, DescList, Table, Btn, Input, Select, LinkAction,
  StatGrid, StatCard, Toolbar, SearchInput, EmptyState, CompactProgress,
} from '../components/ui';

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const TABS = [
  ['overview', '执行概览'],
  ['batches', '交付批次'],
  ['devices', '关联设备'],
  ['exceptions', '交付异常'],
  ['logs', '操作日志'],
];
const TAB_KEYS = new Set(TABS.map(([key]) => key));

function TabBar({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200">
      {TABS.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} className={`px-3 py-2 text-[13px] border-b-2 ${active === key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
      ))}
    </div>
  );
}

function EditPlanForm({ plan, state, included, onClose, onSave }) {
  const [form, setForm] = useState({
    projectId: plan.projectId,
    plannedCount: String(plan.plannedCount),
    owner: plan.owner || '',
    targetDate: plan.targetDate || '',
    demandDescription: plan.demandDescription || '',
    feishuDemandUrl: plan.feishuDemandUrl || '',
    notes: plan.notes || '',
    modificationReason: '',
  });
  const [errors, setErrors] = useState({});
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const changedCount = Number(form.plannedCount) !== Number(plan.plannedCount);
  const submit = () => {
    const next = {};
    if (!Number.isInteger(Number(form.plannedCount)) || Number(form.plannedCount) <= 0) next.plannedCount = '请输入大于 0 的整数。';
    if (Number(form.plannedCount) < included) next.plannedCount = `不能小于当前已纳入批次的 ${included} 台设备。`;
    if (!form.owner) next.owner = '请选择交付负责人。';
    if (form.feishuDemandUrl && !/^https?:\/\/\S+$/i.test(form.feishuDemandUrl)) next.feishuDemandUrl = '请输入有效链接。';
    if (plan.batches.length && changedCount && !form.modificationReason.trim()) next.modificationReason = '已有批次时修改计划交付数量必须填写原因。';
    if (Object.keys(next).length) return setErrors(next);
    onSave({ ...form, plannedCount: Number(form.plannedCount) });
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-600 mb-1">所属项目</label><Select className="w-full" value={form.projectId} disabled={plan.batches.length > 0} onChange={(event) => update('projectId', event.target.value)}>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{plan.batches.length > 0 && <p className="text-xs text-gray-400 mt-1">已有交付批次，所属项目不可直接修改。</p>}</div>
        <div><label className="block text-xs text-gray-600 mb-1">计划交付数量 <span className="text-red-500">*</span></label><Input className="w-full" type="number" min={Math.max(1, included)} value={form.plannedCount} onChange={(event) => update('plannedCount', event.target.value)} />{errors.plannedCount && <p className="text-xs text-red-600 mt-1">{errors.plannedCount}</p>}</div>
        <div><label className="block text-xs text-gray-600 mb-1">交付负责人 <span className="text-red-500">*</span></label><Select className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)}><option value="">请选择负责人</option>{state.users.filter((item) => item.status !== '停用').map((item) => <option key={item.id} value={item.name}>{item.name} · {item.dept}</option>)}</Select>{errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}</div>
        <div><label className="block text-xs text-gray-600 mb-1">目标完成日期</label><Input className="w-full" type="date" value={form.targetDate} onChange={(event) => update('targetDate', event.target.value)} /></div>
      </div>
      <div><label className="block text-xs text-gray-600 mb-1">交付需求说明</label><textarea className="ui-input w-full min-h-20" value={form.demandDescription} onChange={(event) => update('demandDescription', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">相关飞书需求链接</label><Input className="w-full" value={form.feishuDemandUrl} onChange={(event) => update('feishuDemandUrl', event.target.value)} />{errors.feishuDemandUrl && <p className="text-xs text-red-600 mt-1">{errors.feishuDemandUrl}</p>}</div>
      <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      {plan.batches.length > 0 && changedCount && <div><label className="block text-xs text-gray-600 mb-1">计划数量修改原因 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-16" value={form.modificationReason} onChange={(event) => update('modificationReason', event.target.value)} />{errors.modificationReason && <p className="text-xs text-red-600 mt-1">{errors.modificationReason}</p>}</div>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>保存基础信息</Btn></div>
    </div>
  );
}

function NewBatchForm({ plan, project, state, onClose, onSave }) {
  const projectBatches = state.deliveryPlans.filter((item) => item.projectId === plan.projectId).flatMap((item) => item.batches || []);
  const historicalMax = Math.max(0, ...state.deliveryPlans
    .filter((item) => item.projectId === plan.projectId)
    .map((item) => (Number(item.nextBatchSequence) || 1) - 1));
  const sequence = Math.max(historicalMax, ...projectBatches.map((item) => Number(item.sequence) || 0)) + 1;
  const baseName = `${project.name}-Batch${sequence}`;
  const [form, setForm] = useState({
    supplement: '',
    locationId: '',
    plannedDate: '',
    owner: plan.owner || state.currentUser,
    deviceIds: [],
    erpReferenceKeys: [],
    feishuName: '',
    feishuUrl: '',
    notes: '',
  });
  const [query, setQuery] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [errors, setErrors] = useState({});
  const locations = state.locations.filter((item) => item.projectId === plan.projectId && !item.disabled);
  const existingInPlan = new Set(deliveryRelations(plan).map((item) => item.deviceId));
  const occupiedElsewhere = new Map();
  state.deliveryPlans.filter((item) => item.id !== plan.id && !deliveryMetrics(item).isCompleted).forEach((item) => {
    deliveryRelations(item).forEach((relation) => occupiedElsewhere.set(relation.deviceId, item.id));
  });
  const projectDevices = state.devices.filter((item) => item.projectId === plan.projectId);
  const remainingSlots = Math.max(0, Number(plan.plannedCount) - deliveryMetrics(plan).included);
  const allRows = projectDevices.map((device) => {
    let reason = '';
    if (!isProductionComplete(device)) reason = '生产尚未完成';
    else if (!device.erpInboundNo) reason = 'ERP 产品入库未关联';
    else if (existingInPlan.has(device.id)) reason = '已加入当前交付执行其他批次';
    else if (occupiedElsewhere.has(device.id)) reason = `已被其他未完成交付执行占用（${occupiedElsewhere.get(device.id)}）`;
    else if (form.locationId && device.locationId && device.locationId !== form.locationId) reason = '点位冲突';
    else if (form.deviceIds.length >= remainingSlots && !form.deviceIds.includes(device.id)) reason = '超过计划交付数量';
    return { device, reason };
  });
  const rows = allRows
    .filter(({ device }) => !query || `${device.sn} ${device.robotNo} ${device.model || ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(({ device }) => !selectedOnly || form.deviceIds.includes(device.id));
  const eligibleCount = allRows.filter((item) => !item.reason).length;
  const productionCount = projectDevices.filter(isProductionComplete).length;
  const inboundCount = projectDevices.filter((item) => item.erpInboundNo).length;
  const references = deliveryErpReferences();
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const toggleDevice = (id) => {
    if (!form.deviceIds.includes(id) && form.deviceIds.length >= remainingSlots) return;
    update('deviceIds', form.deviceIds.includes(id) ? form.deviceIds.filter((item) => item !== id) : [...form.deviceIds, id]);
  };
  const toggleReference = (key) => update('erpReferenceKeys', form.erpReferenceKeys.includes(key) ? form.erpReferenceKeys.filter((item) => item !== key) : [...form.erpReferenceKeys, key]);
  const submit = () => {
    const next = {};
    if (form.supplement.trim().length > 30) next.supplement = '批次补充说明不能超过 30 个字符。';
    if (!form.owner) next.owner = '请选择批次负责人。';
    if (!form.deviceIds.length) next.deviceIds = '请至少选择一台设备。';
    if (form.deviceIds.length > remainingSlots) next.deviceIds = `当前最多还可纳入 ${remainingSlots} 台设备。`;
    if ((form.feishuName && !form.feishuUrl) || (!form.feishuName && form.feishuUrl)) next.feishu = '补充链接的名称和链接需同时填写。';
    if (form.feishuUrl && !/^https?:\/\/\S+$/i.test(form.feishuUrl)) next.feishu = '请输入有效的飞书链接。';
    const displayName = form.supplement.trim() ? `${baseName} · ${form.supplement.trim()}` : baseName;
    if (plan.batches.some((item) => batchDisplayName(item) === displayName)) next.supplement = '当前交付执行下已存在相同批次展示名称。';
    if (Object.keys(next).length) return setErrors(next);
    onSave({ ...form, sequence, baseName, displayName });
  };
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800">批次信息</h3>
        <div><label className="block text-xs text-gray-600 mb-1">系统批次基础名称</label><Input className="w-full bg-gray-50" value={baseName} disabled /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-600 mb-1">批次补充说明</label><Input className="w-full" maxLength={30} placeholder="如：A 区先行批、补发批" value={form.supplement} onChange={(event) => update('supplement', event.target.value)} />{errors.supplement && <p className="text-xs text-red-600 mt-1">{errors.supplement}</p>}</div>
          <div><label className="block text-xs text-gray-600 mb-1">目标点位</label><Select className="w-full" value={form.locationId} onChange={(event) => update('locationId', event.target.value)}><option value="">暂未关联点位</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
          <div><label className="block text-xs text-gray-600 mb-1">计划交付日期</label><Input className="w-full" type="date" value={form.plannedDate} onChange={(event) => update('plannedDate', event.target.value)} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">批次负责人 <span className="text-red-500">*</span></label><Select className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)}>{state.users.filter((item) => item.status !== '停用').map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select>{errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}</div>
        </div>
      </div>
      <div className="rounded-md border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3"><h3 className="text-[13px] font-semibold text-gray-800">本批次设备 <span className="text-red-500">*</span></h3><div className="flex items-center gap-2"><label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />仅看已选择</label><SearchInput className="w-52" placeholder="搜索 SN / 机器人编号" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>当前项目生产已完成：{productionCount} 台</span><span>ERP 产品入库已关联：{inboundCount} 台</span><span>当前符合条件：{eligibleCount} 台</span></div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-gray-700"><span>已选择 {form.deviceIds.length} 台</span><span>当前最多还可选择 {Math.max(0, remainingSlots - form.deviceIds.length)} 台</span></div>
        <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">选择</th><th className="p-2 text-left">设备 SN</th><th className="p-2 text-left">机器人编号</th><th className="p-2 text-left">型号</th><th className="p-2 text-left">生产进度</th><th className="p-2 text-left">ERP 入库</th><th className="p-2 text-left">当前点位</th><th className="p-2 text-left">选择条件</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{rows.map(({ device, reason }) => (
              <tr key={device.id} className={reason ? 'text-gray-400' : ''}>
                <td className="p-2"><input type="checkbox" disabled={!!reason} checked={form.deviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} /></td>
                <td className="p-2 font-mono">{device.sn}</td><td className="p-2 font-mono">{device.robotNo}</td>
                <td className="p-2">{state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || device.model || '—'}</td>
                <td className="p-2"><StatusBadge status={productionProgressLabel(device)} /></td><td className="p-2">{device.erpInboundNo ? '已关联' : '未关联'}</td>
                <td className="p-2">{state.locations.find((item) => item.id === device.locationId)?.name || '—'}</td><td className="p-2">{reason || '可选择'}</td>
              </tr>
            ))}</tbody>
          </table>
          {!rows.length && <EmptyState className="py-6">当前项目暂无设备</EmptyState>}
        </div>
        {errors.deviceIds && <p className="text-xs text-red-600">{errors.deviceIds}</p>}
      </div>
      <div className="rounded-md border border-gray-200 p-4 space-y-3">
        <h3 className="text-[13px] font-semibold text-gray-800">ERP 来源单据（选填）</h3>
        <div className="max-h-36 overflow-y-auto divide-y divide-gray-100">{references.map((item) => {
          const key = `${item.type}::${item.no}`;
          return <label key={key} className="flex items-center gap-3 py-2 text-xs"><input type="checkbox" checked={form.erpReferenceKeys.includes(key)} onChange={() => toggleReference(key)} /><span>{item.type}</span><span className="font-mono">{item.no}</span><span className="text-gray-400">{item.date} {item.summary}</span></label>;
        })}</div>
        <p className="text-xs text-gray-400">仅从当前销售发货单和调拨订单中选择，平台不修改 ERP 单据。</p>
      </div>
      <div className="rounded-md border border-gray-200 p-4 space-y-3">
        <h3 className="text-[13px] font-semibold text-gray-800">批次相关飞书链接（选填）</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input placeholder="表格或记录名称" value={form.feishuName} onChange={(event) => update('feishuName', event.target.value)} /><Input placeholder="https://" value={form.feishuUrl} onChange={(event) => update('feishuUrl', event.target.value)} /></div>
        {errors.feishu && <p className="text-xs text-red-600">{errors.feishu}</p>}
        <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      </div>
      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-gray-100 bg-white px-1 py-3"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>新增交付批次</Btn></div>
    </div>
  );
}

export default function DeliveryPlanDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const requested = searchParams.get('tab');
  const [active, setActiveState] = useState(TAB_KEYS.has(requested) ? requested : 'overview');
  const [modal, setModal] = useState(null);
  const [deviceFilters, setDeviceFilters] = useState({ batchId: '', result: '', locationId: '', exception: '' });
  const plan = state.deliveryPlans.find((item) => item.id === id);
  if (!plan) return <Page><PageHeader title="交付执行不存在" actions={<Btn as="link" to="/projects?tab=delivery">返回列表</Btn>} /></Page>;
  const project = state.projects.find((item) => item.id === plan.projectId);
  const returnTo = searchParams.get('returnTo') || '/projects?tab=delivery';
  const planBatchReturn = `/delivery-plans/${plan.id}?tab=batches&returnTo=${encodeURIComponent(returnTo)}`;
  const planDeviceReturn = `/delivery-plans/${plan.id}?tab=devices&returnTo=${encodeURIComponent(returnTo)}`;
  const metrics = deliveryMetrics(plan);
  const relations = deliveryRelations(plan);
  const exceptions = state.deliveryExceptions.filter((item) => item.deliveryPlanId === plan.id);
  const setActive = (tab) => {
    setActiveState(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };
  const updatePlan = (payload, action, notes) => {
    const time = nowText();
    const nextLogs = [...(plan.operationLogs || []), { id: `DLOG-${Date.now()}-${Math.random()}`, time, operator: state.currentUser, action, notes }];
    dispatch({ type: 'UPDATE_DELIVERY_PLAN', payload: { id: plan.id, ...payload, updatedAt: time, operationLogs: nextLogs } });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}-${Math.random()}`, deliveryPlanId: plan.id, projectId: payload.projectId || plan.projectId, operator: state.currentUser, timestamp: time, actionType: action, module: '项目中心', notes } });
    setModal(null);
  };
  const saveBasic = (form) => {
    const { modificationReason, ...payload } = form;
    updatePlan(payload, '编辑交付执行基础信息', modificationReason || '更新负责人、目标日期或需求信息');
  };
  const saveBatch = (form) => {
    const time = nowText();
    const batchId = `BAT-${plan.id}-${String(form.sequence).padStart(2, '0')}-${Date.now()}`;
    const references = deliveryErpReferences();
    const batch = {
      id: batchId,
      sequence: form.sequence,
      baseName: form.baseName,
      supplement: form.supplement.trim(),
      locationId: form.locationId || null,
      plannedDate: form.plannedDate,
      owner: form.owner,
      deviceRelations: form.deviceIds.map((deviceId) => ({
        id: `DR-${batchId}-${deviceId}`,
        deviceId,
        targetLocationId: form.locationId || null,
        actualLocationId: null,
        result: '未确认',
        actualDate: '',
        resultSummary: '',
        exceptionDescription: '',
        documentUrl: '',
        recorder: '',
        recordTime: '',
        resultHistory: [],
      })),
      erpReferences: form.erpReferenceKeys.map((key) => {
        const [type, no] = key.split('::');
        const source = references.find((item) => item.type === type && item.no === no);
        return { type, no, date: source?.date || '', summary: source?.summary || '' };
      }),
      feishuLinks: form.feishuName ? [{ id: `BFS-${Date.now()}`, name: form.feishuName.trim(), url: form.feishuUrl.trim(), note: '' }] : [],
      siteRecords: [],
      notes: form.notes.trim(),
      createdBy: state.currentUser,
      createdAt: time,
      updatedAt: time,
      operationLogs: [{ id: `BLOG-${Date.now()}`, time, operator: state.currentUser, action: '新增交付批次', notes: `纳入 ${form.deviceIds.length} 台设备` }],
    };
    form.deviceIds.forEach((deviceId) => {
      const device = state.devices.find((item) => item.id === deviceId);
      dispatch({ type: 'UPDATE_DEVICE', payload: { id: deviceId, deliveryPlanId: plan.id, deliveryPlanIds: [...new Set([...(device?.deliveryPlanIds || []), plan.id])], deliveryBatchId: batchId, updatedAt: time } });
    });
    updatePlan({ batches: [...plan.batches, batch], nextBatchSequence: form.sequence + 1 }, '新增交付批次', `${batchDisplayName(batch)}，纳入 ${form.deviceIds.length} 台设备`);
  };
  const filteredRelations = useMemo(() => relations.filter((relation) => {
    const exceptionCount = exceptions.filter((item) => (item.affectedDeviceIds || []).includes(relation.deviceId)).length;
    const locationId = relation.actualLocationId || relation.targetLocationId;
    return (!deviceFilters.batchId || relation.batch.id === deviceFilters.batchId)
      && (!deviceFilters.result || relation.result === deviceFilters.result)
      && (!deviceFilters.locationId || locationId === deviceFilters.locationId)
      && (!deviceFilters.exception || (deviceFilters.exception === 'yes' ? exceptionCount > 0 : exceptionCount === 0));
  }), [relations, exceptions, deviceFilters]);
  const devicePaged = usePaged(filteredRelations, 10);
  const batchPaged = usePaged(plan.batches, 10);
  const logs = [...(plan.operationLogs || [])].sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  return (
    <Page>
      <PageHeader
        breadcrumb={<div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Link className="ui-link" to={returnTo}>{returnTo.startsWith('/projects/') ? '项目详情' : '交付执行列表'}</Link><span>/</span><span>交付执行</span></div>}
        title={`${project?.name || '项目'} · 交付执行`}
        description={`${plan.id} · 交付负责人 ${plan.owner || '—'} · 目标完成日期 ${plan.targetDate || '未设置'} · 当前完成 ${metrics.completed} / ${metrics.planned}`}
        actions={<><Btn onClick={() => setModal({ type: 'edit' })}>编辑基础信息</Btn><Btn variant="primary" onClick={() => setModal({ type: 'batch' })}>新增交付批次</Btn></>}
      />
      <TabBar active={active} onChange={setActive} />

      {active === 'overview' && <>
        <StatGrid cols={4}>
          <StatCard label="计划交付数量" value={metrics.planned} hint="台" />
          <StatCard label="已纳入批次数量" value={metrics.included} hint="设备去重" />
          <StatCard label="已完成交付数量" value={metrics.completed} hint="当前结果为通过" tone="success" />
          <StatCard label="剩余未完成数量" value={metrics.remaining} hint="台" />
        </StatGrid>
        <Section title={`交付完成进度：${metrics.completed} / ${metrics.planned}`}>
          <CompactProgress value={metrics.completed} total={metrics.planned} className="h-2" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs text-gray-500">
            <span>共 {metrics.batchCount} 个批次</span>
            {metrics.unconfirmed > 0 && <span>· {metrics.unconfirmed} 台待确认</span>}
            {metrics.failed > 0 && <span className="text-red-600">· {metrics.failed} 台未通过</span>}
            {metrics.unarranged > 0 && <span>· {metrics.unarranged} 台尚未安排</span>}
            {metrics.isCompleted && <StatusBadge status="已完成" />}
          </div>
        </Section>
        <Section title="执行信息">
          <DescList cols={3} items={[
            ['所属项目', project ? <Link className="ui-link" to={`/projects/${project.id}?tab=delivery`}>{project.name}</Link> : '—'],
            ['交付负责人', plan.owner || '—'],
            ['目标完成日期', plan.targetDate || '—'],
            ['交付需求说明', plan.demandDescription || '—'],
            ['相关飞书需求链接', plan.feishuDemandUrl ? <a className="ui-link" href={plan.feishuDemandUrl} target="_blank" rel="noreferrer">打开需求链接</a> : '—'],
            ['备注', plan.notes || '—'],
            ['创建人', plan.createdBy || '—'],
            ['创建时间', plan.createdAt || '—'],
            ['最近更新时间', plan.updatedAt || '—'],
          ]} />
        </Section>
        {!metrics.isCompleted && <Section title="当前未完成原因"><ul className="space-y-1 text-[13px] text-gray-600">{metrics.reasons.map((item) => <li key={item}>• {item}</li>)}</ul></Section>}
      </>}

      {active === 'batches' && <Section title={`交付批次（${plan.batches.length}）`} right={<Btn size="sm" variant="primary" onClick={() => setModal({ type: 'batch' })}>新增交付批次</Btn>} bodyClassName="p-0">
        <Table head={['批次展示名称', '目标点位', '设备数量', '设备结果汇总', '计划交付日期', '批次负责人', '最近更新时间', '操作']} empty="暂无交付批次" footer={<Pagination {...batchPaged} onChange={batchPaged.setPage} onPageSizeChange={batchPaged.setPageSize} />}>
          {batchPaged.pageItems.map((batch) => {
            const summary = batchMetrics(batch);
            return <tr key={batch.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(planBatchReturn)}`}>{batchDisplayName(batch)}</Link><div className="font-mono text-[11px] text-gray-400">{batch.id}</div></td>
              <td className="px-3 py-2 text-gray-600">{state.locations.find((item) => item.id === batch.locationId)?.name || '暂未关联点位'}</td>
              <td className="px-3 py-2">{summary.total} 台</td><td className="px-3 py-2 text-gray-600">{summary.summary}</td>
              <td className="px-3 py-2 text-gray-600">{batch.plannedDate || '—'}</td><td className="px-3 py-2 text-gray-600">{batch.owner || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{batch.updatedAt || '—'}</td><td className="px-3 py-2"><LinkAction to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(planBatchReturn)}`}>查看详情</LinkAction></td>
            </tr>;
          })}
        </Table>
      </Section>}

      {active === 'devices' && <>
        <Toolbar right={<span className="text-xs text-gray-400">共 {filteredRelations.length} 台设备</span>}>
          <Select value={deviceFilters.batchId} onChange={(event) => setDeviceFilters((prev) => ({ ...prev, batchId: event.target.value }))}><option value="">全部批次</option>{plan.batches.map((item) => <option key={item.id} value={item.id}>{batchDisplayName(item)}</option>)}</Select>
          <Select value={deviceFilters.result} onChange={(event) => setDeviceFilters((prev) => ({ ...prev, result: event.target.value }))}><option value="">全部交付结果</option><option>未确认</option><option>通过</option><option>未通过</option></Select>
          <Select value={deviceFilters.locationId} onChange={(event) => setDeviceFilters((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">全部目标点位</option>{state.locations.filter((item) => item.projectId === plan.projectId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select value={deviceFilters.exception} onChange={(event) => setDeviceFilters((prev) => ({ ...prev, exception: event.target.value }))}><option value="">异常记录不限</option><option value="yes">存在异常</option><option value="no">暂无异常</option></Select>
        </Toolbar>
        <Table head={['设备 SN', '机器人编号', '型号', '所属批次', '目标点位', '实际点位', 'ERP 来源', '当前交付结果', '异常记录', '操作']} empty="暂无关联设备" footer={<Pagination {...devicePaged} onChange={devicePaged.setPage} onPageSizeChange={devicePaged.setPageSize} />}>
          {devicePaged.pageItems.map((relation) => {
            const device = state.devices.find((item) => item.id === relation.deviceId);
            const batchExceptions = exceptions.filter((item) => (item.affectedDeviceIds || []).includes(relation.deviceId));
            return <tr key={relation.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2"><Link className="ui-link font-mono text-xs" to={`/devices/${device?.id}?tab=project&returnTo=${encodeURIComponent(planDeviceReturn)}`}>{device?.sn || '—'}</Link></td><td className="px-3 py-2 font-mono text-xs">{device?.robotNo || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device?.deviceTypeId)?.name || '—'}</td>
              <td className="px-3 py-2"><Link className="ui-link" to={`/delivery-plans/${plan.id}/batches/${relation.batch.id}?returnTo=${encodeURIComponent(planDeviceReturn)}`}>{batchDisplayName(relation.batch)}</Link></td>
              <td className="px-3 py-2 text-gray-600">{state.locations.find((item) => item.id === relation.targetLocationId)?.name || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{state.locations.find((item) => item.id === relation.actualLocationId)?.name || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{relation.batch.erpReferences?.length ? relation.batch.erpReferences.map((item) => item.no).join('、') : '—'}</td>
              <td className="px-3 py-2"><StatusBadge status={relation.result} /></td>
              <td className="px-3 py-2">{batchExceptions.length ? `${batchExceptions.length} 条` : <span className="text-gray-400">暂无</span>}</td>
              <td className="px-3 py-2"><LinkAction to={`/delivery-plans/${plan.id}/batches/${relation.batch.id}?returnTo=${encodeURIComponent(planDeviceReturn)}`}>查看详情</LinkAction></td>
            </tr>;
          })}
        </Table>
      </>}

      {active === 'exceptions' && <Section title={`交付异常（${exceptions.length}）`} bodyClassName="p-0">
        <Table head={['来源批次', '来源类型', '关联设备', '异常说明', '记录人', '记录时间', '操作']} empty="暂无交付异常">
          {exceptions.map((item) => {
            const batch = plan.batches.find((candidate) => candidate.id === item.batchId);
            const sns = (item.affectedDeviceIds || []).map((deviceId) => state.devices.find((device) => device.id === deviceId)?.sn).filter(Boolean);
            return <tr key={item.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2">{batch ? <Link className="ui-link" to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/delivery-plans/${plan.id}?tab=exceptions&returnTo=${encodeURIComponent(returnTo)}`)}#exceptions`}>{batchDisplayName(batch)}</Link> : '—'}</td><td className="px-3 py-2 text-gray-600">{item.sourceType}</td>
              <td className="px-3 py-2 font-mono text-xs">{sns.length ? (item.affectedDeviceIds || []).map((deviceId) => {
                const device = state.devices.find((candidate) => candidate.id === deviceId);
                return device ? <Link key={device.id} className="ui-link mr-2" to={`/devices/${device.id}?tab=project&returnTo=${encodeURIComponent(`/delivery-plans/${plan.id}?tab=exceptions&returnTo=${encodeURIComponent(returnTo)}`)}`}>{device.sn}</Link> : null;
              }) : '批次级'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.description}</td>
              <td className="px-3 py-2 text-gray-600">{item.recorder || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{item.recordTime || '—'}</td>
              <td className="px-3 py-2">{batch && <LinkAction to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/delivery-plans/${plan.id}?tab=exceptions&returnTo=${encodeURIComponent(returnTo)}`)}#exceptions`}>查看详情</LinkAction>}</td>
            </tr>;
          })}
        </Table>
      </Section>}

      {active === 'logs' && <Section title="操作日志" bodyClassName="p-0">
        <Table head={['操作时间', '操作人', '操作动作', '操作摘要']} empty="暂无操作日志">
          {logs.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-xs text-gray-500">{item.time || '—'}</td><td className="px-3 py-2 text-gray-600">{item.operator || '—'}</td><td className="px-3 py-2 text-gray-700">{item.action}</td><td className="px-3 py-2 text-xs text-gray-500">{item.notes || '—'}</td></tr>)}
        </Table>
      </Section>}

      <Modal size="xl" isOpen={modal?.type === 'edit'} onClose={() => setModal(null)} title="编辑交付执行基础信息"><EditPlanForm plan={plan} state={state} included={metrics.included} onClose={() => setModal(null)} onSave={saveBasic} /></Modal>
      <Modal size="2xl" isOpen={modal?.type === 'batch'} onClose={() => setModal(null)} title="新增交付批次"><NewBatchForm plan={plan} project={project} state={state} onClose={() => setModal(null)} onSave={saveBatch} /></Modal>
    </Page>
  );
}
