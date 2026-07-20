import { useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';
import OperationLog from '../components/OperationLog';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Section, Btn, LinkAction, Chip,
  StatCard, StatGrid, DescList, Table,
} from '../components/ui';
import { isPass, projectStatus, productionPlanStatus, deliveryPlanStatus, deviceLifecycleStatus } from '../utils/status';

// 项目详情：项目概览 / 基本信息 / 点位管理 / 设备列表 / 当前项目生产计划 /
// 当前项目交付计划 / 关联问题·售后记录 / 操作日志。分区卡片分层，复用 ../components/ui。

const PROJECT_TYPES = ['智魔方', '机场', '工业场景', '遥操数采'];
const LOC_OWNERS = ['张三', '李四', '王五', '赵六', '蔡八'];

// 弹窗内沿用的紧凑表单样式（Modal 内部，不影响主页面视觉）。
const INPUT = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500 bg-white';
const BTN_PRIMARY = 'px-3 py-1.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-800';
const BTN_GHOST = 'px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50';

function nowText() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

// 点位关联设备判定：设备是否属于某点位（用于「查看设备」按点位筛选下方设备列表，以及点位表计数）。
// 数据来自项目下真实设备列表（设备的所属点位 / 点位的设备清单），不生成额外设备、不扩展全局设备台账。
function deviceInLocation(device, loc) {
  if (!loc) return false;
  return device.locationId === loc.id
    || device.preAssignedLocationId === loc.id
    || (loc.deviceIds || []).includes(device.id);
}

// 在线判定：与下方设备列表「在线状态」列口径保持一致（在线运营阶段视为在线）。
function isDeviceOnline(device) {
  return device.status === '在线运营';
}

function erpChip(linked) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${linked ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {linked ? '已关联 ERP' : '未关联 ERP'}
    </span>
  );
}

/* ── 弹窗（保留既有交互与数据接线） ─────────────────── */
function ProjectFormModal({ isOpen, onClose, project, onSave }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    projectType: project?.projectType || '',
    client: project?.client || '',
    manager: project?.manager || '',
    contactPerson: project?.contactPerson || '',
    contactPhone: project?.contactPhone || '',
    targetCount: project?.targetCount || 1,
    erpProjectNo: project?.erpProjectNo || project?.erpPurchaseOrderNo || '',
    background: project?.background || '',
    notes: project?.notes || '',
  });

  if (!project) return null;

  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, targetCount: Number(form.targetCount || 1) });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑项目" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">项目名称 *</label><input className={INPUT} required value={form.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">项目类型 / 业务场景</label>
            <select className={INPUT} value={form.projectType} onChange={(e) => update('projectType', e.target.value)}>
              <option value="">-- 请选择 --</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">目标设备数 *</label><input className={INPUT} type="number" min="1" required value={form.targetCount} onChange={(e) => update('targetCount', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">客户</label><input className={INPUT} value={form.client} onChange={(e) => update('client', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">负责人</label><input className={INPUT} value={form.manager} onChange={(e) => update('manager', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">ERP 项目号</label><input className={INPUT} value={form.erpProjectNo} onChange={(e) => update('erpProjectNo', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">联系人</label><input className={INPUT} value={form.contactPerson} onChange={(e) => update('contactPerson', e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label><input className={INPUT} value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">项目背景</label><textarea className={INPUT} rows={3} value={form.background} onChange={(e) => update('background', e.target.value)} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">备注</label><textarea className={INPUT} rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>取消</button>
          <button type="submit" className={BTN_PRIMARY}>保存</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ isOpen, onClose, title, text, onConfirm, danger = false }) {
  const [reason, setReason] = useState('');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{text}</p>
        <textarea className={INPUT} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="填写原因或备注" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            onClick={() => { onConfirm(reason); setReason(''); onClose(); }}
            className={`px-3 py-1.5 text-sm text-white rounded ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'}`}
          >
            确认
          </button>
        </div>
      </div>
    </Modal>
  );
}

// 点位新增 / 编辑弹窗（点位管理归属项目详情，projectId 固定为当前项目）。
function LocationFormModal({ isOpen, onClose, initial, projectName, onSave }) {
  const [form, setForm] = useState(initial || { name: '', address: '', plannedCount: 1, owner: '', notes: '' });
  const submit = (e) => { e.preventDefault(); onSave({ ...form, plannedCount: Number(form.plannedCount || 0) }); };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? '编辑点位' : '新增点位'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">所属项目</label><input className={`${INPUT} bg-gray-50 text-gray-500`} value={projectName} readOnly /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">点位名称 *</label><input className={INPUT} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">地址 / 描述</label><input className={INPUT} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">计划设备数</label><input type="number" min="0" className={INPUT} value={form.plannedCount} onChange={(e) => setForm({ ...form, plannedCount: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
            <select className={INPUT} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
              <option value="">-- 选择负责人 --</option>{LOC_OWNERS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">备注</label><textarea rows={2} className={INPUT} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>取消</button>
          <button type="submit" className={BTN_PRIMARY}>保存</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [modal, setModal] = useState(null);
  const [locTarget, setLocTarget] = useState(null);
  const [locFilter, setLocFilter] = useState(null); // 当前按点位筛选下方设备列表的 locationId（null = 全部设备）
  const deviceListRef = useRef(null);

  const {
    projects, workflowProductionPlans = [], deliveryPlans = [],
    devices = [], deviceTypes = [], locations = [], qualityIssues = [],
    productionWorkOrders = [], deliveryWorkOrders = [], operationLogs = [],
  } = state;

  // 生产计划只取流程型计划 (WPP-*)；PLAN-* 为日产能数据，不在项目详情的生产计划列表里展示。
  const allProductionPlans = workflowProductionPlans;
  const project = projects.find((p) => p.id === id);

  const projProductionPlans = allProductionPlans.filter((p) => p.projectId === id);
  const projDeliveryPlans = deliveryPlans.filter((p) => p.projectId === id);
  const projDevices = devices.filter((d) => d.projectId === id);
  const projLocations = locations.filter((l) => l.projectId === id);
  const projIssues = qualityIssues.filter((q) => q.projectId === id);
  const projWorkOrders = [...productionWorkOrders, ...deliveryWorkOrders].filter((w) => {
    if (w.projectId === id) return true;
    return projDevices.some((d) => d.id === w.deviceId);
  });
  const projLogs = operationLogs.filter((log) => log.projectId === id || projDevices.some((d) => d.id === log.deviceId));

  // 关联问题与工单归一：区分质量问题 / 交付工单 / 生产返修记录。
  const relatedRows = [
    ...projIssues.map((q) => ({ id: q.id, kind: '质量问题', deviceSN: q.deviceSN, stage: q.sourceStage || '在线运营', desc: q.issueDesc, severity: q.severity || '中', status: q.status, target: 'quality' })),
    ...projWorkOrders.map((w) => ({ id: w.id, kind: w.type === 'production' ? '生产返修记录' : w.type === 'delivery' ? '交付工单' : '售后工单', deviceSN: w.deviceSN, stage: w.stage || w.sourceNode || w.ngStation || '—', desc: w.description, severity: w.severity || '中', status: w.status, target: w.type === 'production' ? 'none' : 'orders' })),
  ];

  // 点位筛选：下方设备列表按当前查看点位过滤；未筛选时展示项目下全部设备。
  const filterLoc = locFilter ? projLocations.find((l) => l.id === locFilter) : null;
  const visibleDevices = filterLoc ? projDevices.filter((d) => deviceInLocation(d, filterLoc)) : projDevices;

  const prodPaged = usePaged(projProductionPlans, 8);
  const delivPaged = usePaged(projDeliveryPlans, 8);
  const devPaged = usePaged(visibleDevices, 8);
  const locPaged = usePaged(projLocations, 8);
  const relatedPaged = usePaged(relatedRows, 8);
  const logPaged = usePaged(projLogs, 8);

  if (!project) {
    return <div className="p-6 text-gray-400">项目不存在</div>;
  }

  // 点位维度聚合：关联设备数 / 在线设备数 / 未关闭问题数。点位表与设备列表筛选提示条共用同一口径，保证一致。
  const statsForLocation = (loc) => {
    const locDevices = projDevices.filter((d) => deviceInLocation(d, loc));
    const ids = new Set(locDevices.map((d) => d.id));
    const sns = new Set(locDevices.map((d) => d.sn));
    const online = locDevices.filter(isDeviceOnline).length;
    const openIssues = projIssues.filter((q) => q.status !== '已关闭' && (ids.has(q.deviceId) || sns.has(q.deviceSN))).length;
    return { count: locDevices.length, online, openIssues };
  };
  const filterStats = filterLoc ? statsForLocation(filterLoc) : null;

  // 点击「查看设备」：按该点位筛选下方设备列表，并定位到设备列表区域（不弹窗、不新增路由、不跳转资产管理）。
  const viewLocationDevices = (loc) => {
    setLocFilter(loc.id);
    setTimeout(() => { deviceListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
  };

  const status = projectStatus(project, allProductionPlans, deliveryPlans);
  const erpLinked = Boolean(project.erpProjectNo || project.erpPurchaseOrderNo);
  const producedCount = devices.filter((device) => {
    const plan = projProductionPlans.find((p) => p.id === device.productionPlanId);
    return plan && ['已入库', '待分配项目', '已分配项目', '在线运营', '出厂检验中', '现场安装调试中', '客户验收中'].includes(device.status);
  }).length;
  const producedDone = project.targetCount ? Math.min(producedCount, project.targetCount) : producedCount;
  const acceptedCount = projDeliveryPlans.reduce((sum, plan) => sum + (plan.records?.customerAccept || []).filter(isPass).length, 0);
  const onlineCount = projDevices.filter((d) => d.status === '在线运营').length;
  const pendingIssues = projIssues.filter((q) => q.status !== '已关闭').length + projWorkOrders.filter((w) => !['已关闭', '已作废'].includes(w.status)).length;

  const writeLog = (actionType, notes, fromStatus = '', toStatus = '') => {
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}-${id}`,
        projectId: id,
        operator: state.currentUser,
        timestamp: nowText(),
        actionType,
        fromStatus,
        toStatus,
        notes,
      },
    });
  };

  const updateProject = (payload) => dispatch({ type: 'UPDATE_PROJECT', payload: { id, ...payload, updatedAt: nowText() } });

  const saveLocation = (form) => {
    const base = { name: form.name, address: form.address, owner: form.owner, notes: form.notes, plannedCount: Number(form.plannedCount || 0), updatedAt: nowText() };
    if (locTarget && locTarget !== 'new') {
      dispatch({ type: 'UPDATE_LOCATION', payload: { id: locTarget.id, ...base } });
      writeLog('编辑点位', `更新点位 ${form.name}`);
    } else {
      dispatch({ type: 'ADD_LOCATION', payload: { id: `LOC-${Date.now().toString().slice(-6)}`, projectId: id, deviceIds: [], deliveryPlanIds: [], ...base } });
      writeLog('新增点位', `新增点位 ${form.name}`);
    }
    setModal(null);
    setLocTarget(null);
  };
  // 停用点位（不删除数据）：仅标记为已停用，历史设备 / 交付记录 / 问题 / 日志仍保留。
  const disableLocation = (loc) => {
    dispatch({ type: 'UPDATE_LOCATION', payload: { id: loc.id, disabled: true, updatedAt: nowText() } });
    writeLog('停用点位', `停用点位 ${loc.name}`);
  };

  const canManageLoc = canDo('manage_locations');

  return (
    <Page>
      <PageHeader
        breadcrumb={<Link to="/projects" className="ui-link text-[13px]">‹ 返回项目列表</Link>}
        title={project.name}
        description={(
          <span className="inline-flex flex-wrap items-center gap-2">
            {project.projectType ? <Chip>{project.projectType}</Chip> : null}
            <StatusBadge status={status} />
            {erpChip(erpLinked)}
          </span>
        )}
        actions={(
          <>
            <Btn variant="secondary" onClick={() => setModal('edit')}>编辑平台补充信息</Btn>
            <Btn variant="secondary" as="link" to="/erp-center?tab=overview">查看关联 ERP 单据</Btn>
            <Btn variant="secondary" onClick={() => setModal('logs')}>查看日志</Btn>
          </>
        )}
      />

      {/* 项目概览 */}
      <StatGrid cols={6}>
        <StatCard label="目标设备数" value={project.targetCount ?? '—'} />
        <StatCard label="已生产入库" value={producedDone} />
        <StatCard label="已交付验收" value={acceptedCount} tone="success" />
        <StatCard label="在线运营" value={onlineCount} tone={onlineCount ? 'success' : 'default'} />
        <StatCard label="生产计划数" value={projProductionPlans.length} />
        <StatCard label="未关闭问题 / 工单" value={pendingIssues} tone={pendingIssues ? 'warning' : 'default'} />
      </StatGrid>

      {/* 基本信息 */}
      <Section title="基本信息">
        <DescList
          cols={3}
          items={[
            ['项目ID', <span className="font-mono">{project.id}</span>],
            ['项目类型 / 业务场景', project.projectType],
            ['客户', project.client],
            ['负责人', project.manager],
            ['联系人', project.contactPerson],
            ['联系电话', project.contactPhone],
            ['ERP 项目号', <span className="font-mono">{project.erpProjectNo ?? project.erpPurchaseOrderNo ?? '—'}</span>],
            ['创建时间', project.createdAt],
            ['更新时间', project.updatedAt],
            ['项目背景', project.background],
            ['备注', project.notes],
          ]}
        />
      </Section>

      {/* 点位管理 */}
      <Section
        title={`点位管理（${projLocations.length}）`}
        subtitle="该项目下的现场点位信息，支持维护点位并按点位查看关联设备，便于后续售后维护、设备流转和问题追溯。"
        right={canManageLoc && <Btn variant="primary" size="sm" onClick={() => { setLocTarget('new'); setModal('locationForm'); }}>新增点位</Btn>}
        bodyClassName="p-0"
      >
        <p className="px-4 pt-3 text-xs text-gray-500 leading-relaxed">
          点击“查看设备”后，将在下方设备列表中筛选展示该点位关联设备。
        </p>
        <Table
          head={['点位名称', '地址', '计划数', '负责人', '关联交付执行', '关联设备数', '在线设备数', '未关闭问题数', '状态', '更新时间', '操作']}
          empty="暂无点位"
          footer={<Pagination page={locPaged.page} total={locPaged.total} totalPages={locPaged.totalPages} onChange={locPaged.setPage} />}
        >
          {locPaged.pageItems.map((loc) => {
            const stats = statsForLocation(loc);
            const planned = loc.plannedCount ?? (loc.deviceIds || []).length ?? 0;
            const planLinks = (loc.deliveryPlanIds || []).map((pid) => deliveryPlans.find((dp) => dp.id === pid)).filter(Boolean);
            const active = locFilter === loc.id;
            return (
              <tr key={loc.id} className={`hover:bg-[#fafafa] ${loc.disabled ? 'opacity-60' : ''} ${active ? 'bg-blue-50/60' : ''}`}>
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{loc.name}</td>
                <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{loc.address || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{planned}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{loc.owner || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {planLinks.length
                    ? <div className="flex flex-wrap gap-x-3 gap-y-1">{planLinks.map((dp) => <Link key={dp.id} to={`/delivery-plans/${dp.id}`} className="ui-link">{dp.batchNo || dp.name}</Link>)}</div>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-gray-600">{stats.count}</td>
                <td className="px-3 py-2 text-gray-600">{stats.online}</td>
                <td className="px-3 py-2">{stats.openIssues > 0 ? <span className="text-amber-600 font-medium">{stats.openIssues}</span> : <span className="text-gray-400">0</span>}</td>
                <td className="px-3 py-2">
                  {loc.disabled
                    ? <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-500 border-gray-200">已停用</span>
                    : <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border-green-200">启用</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{loc.updatedAt || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <LinkAction onClick={() => viewLocationDevices(loc)}>查看设备</LinkAction>
                    {canManageLoc && !loc.disabled && <>
                      <LinkAction onClick={() => { setLocTarget(loc); setModal('locationForm'); }}>编辑</LinkAction>
                      <LinkAction onClick={() => { setLocTarget(loc); setModal('disableLoc'); }}>停用</LinkAction>
                    </>}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>

      {/* 设备列表（承接点位「查看设备」筛选结果） */}
      <div ref={deviceListRef} className={`scroll-mt-4 ${filterLoc ? 'rounded-xl ring-2 ring-blue-200 transition' : ''}`}>
      <Section
        title={filterLoc ? `设备列表｜当前查看点位：${filterLoc.name}` : `设备列表（${projDevices.length}）`}
        subtitle="该项目关联设备，覆盖生产、交付与在线运营各阶段。"
        bodyClassName="p-0"
      >
        {filterLoc && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="text-[13px] text-blue-800">
              已筛选出 <b>{filterStats.count}</b> 台关联设备，其中在线 <b>{filterStats.online}</b> 台，未关闭问题 <b>{filterStats.openIssues}</b> 个。
            </span>
            <Btn variant="ghost" size="sm" onClick={() => setLocFilter(null)}>查看全部设备</Btn>
          </div>
        )}
        <Table
          head={['设备SN', '机器人型号', '当前状态', '在线状态', '所属点位', '最近更新', '操作']}
          empty={filterLoc ? '该点位下暂无关联设备' : '暂无项目设备'}
          footer={<Pagination page={devPaged.page} total={devPaged.total} totalPages={devPaged.totalPages} onChange={devPaged.setPage} />}
        >
          {devPaged.pageItems.map((device) => {
            const typeName = deviceTypes.find((t) => t.id === device.deviceTypeId)?.name || device.deviceTypeId || '—';
            const loc = projLocations.find((l) => deviceInLocation(device, l)) || locations.find((l) => l.id === (device.locationId || device.preAssignedLocationId));
            const online = isDeviceOnline(device);
            const dp = deliveryPlans.find((p) => (p.boundDeviceIds || []).includes(device.id) || (p.records?.binding || []).some((b) => b.deviceId === device.id));
            return (
              <tr key={device.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap"><Link to={`/devices/${device.id}`} className="ui-link">{device.sn}</Link></td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{typeName}</td>
                <td className="px-3 py-2"><StatusBadge status={deviceLifecycleStatus(device)} /></td>
                <td className="px-3 py-2">{online ? <StatusBadge status="在线" /> : <span className="text-gray-300 text-xs">—</span>}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{loc?.name || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{device.updatedAt || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <LinkAction to={`/devices/${device.id}`}>设备详情</LinkAction>
                    {dp ? <LinkAction to={`/delivery-plans/${dp.id}`}>交付记录</LinkAction> : <span className="text-gray-300">交付记录</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>
      </div>

      {/* 当前项目生产计划 */}
      <Section title={`当前项目生产计划（${projProductionPlans.length}）`} bodyClassName="p-0">
        <Table
          head={['计划ID', '计划名称', '状态', '当前节点', '完成进度', 'ERP 生产订单号', '操作']}
          empty="暂无生产计划"
          footer={<Pagination page={prodPaged.page} total={prodPaged.total} totalPages={prodPaged.totalPages} onChange={prodPaged.setPage} />}
        >
          {prodPaged.pageItems.map((plan) => {
            const planDevices = devices.filter((d) => d.productionPlanId === plan.id);
            const done = planDevices.filter((d) => ['已入库', '待分配项目', '已分配项目', '在线运营'].includes(d.status)).length;
            return (
              <tr key={plan.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap"><Link to={`/production-plans/${plan.id}`} className="ui-link">{plan.id}</Link></td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{plan.name}</td>
                <td className="px-3 py-2"><StatusBadge status={productionPlanStatus(plan)} /></td>
                <td className="px-3 py-2"><StatusBadge status={plan.currentNode || '来料准备'} /></td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{done}/{plan.targetCount || 0}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{plan.erpProductionOrderNo || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <LinkAction to={`/production-plans/${plan.id}`}>查看详情</LinkAction>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>

      {/* 当前项目交付计划 */}
      <Section title={`当前项目交付计划（${projDeliveryPlans.length}）`} bodyClassName="p-0">
        <Table
          head={['计划ID', '交付批次', '状态', '当前阶段', '验收进度', '计划验收', '操作']}
          empty="暂无交付计划"
          footer={<Pagination page={delivPaged.page} total={delivPaged.total} totalPages={delivPaged.totalPages} onChange={delivPaged.setPage} />}
        >
          {delivPaged.pageItems.map((plan) => {
            const accepted = (plan.records?.customerAccept || []).filter(isPass).length;
            return (
              <tr key={plan.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap"><Link to={`/delivery-plans/${plan.id}`} className="ui-link">{plan.id}</Link></td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{plan.batchNo || plan.name}</td>
                <td className="px-3 py-2"><StatusBadge status={deliveryPlanStatus(plan)} /></td>
                <td className="px-3 py-2"><StatusBadge status={plan.currentNode || '绑定设备'} /></td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{accepted}/{plan.targetCount || 0}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.acceptanceDate || plan.dueDate || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <LinkAction to={`/delivery-plans/${plan.id}`}>查看详情</LinkAction>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>

      {/* 关联问题 / 售后记录 */}
      <Section title={`关联问题 / 售后记录（${relatedRows.length}）`} bodyClassName="p-0">
        <Table
          head={['编号', '类型', '关联设备SN', '来源阶段', '描述', '严重程度', '状态', '操作']}
          empty="暂无关联问题或售后记录"
          footer={<Pagination page={relatedPaged.page} total={relatedPaged.total} totalPages={relatedPaged.totalPages} onChange={relatedPaged.setPage} />}
        >
          {relatedPaged.pageItems.map((item) => (
            <tr key={item.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{item.id}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{item.kind}</td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{item.deviceSN || '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{item.stage}</td>
              <td className="px-3 py-2 text-gray-700 text-xs max-w-[220px]"><div className="truncate">{item.desc}</div></td>
              <td className="px-3 py-2"><StatusBadge status={item.severity} /></td>
              <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {item.target === 'quality'
                  ? <LinkAction to="/after-sales?tab=quality">查看详情</LinkAction>
                  : item.target === 'orders'
                    ? <LinkAction to="/after-sales?tab=orders">查看详情</LinkAction>
                    : <span className="text-gray-300">查看详情</span>}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 操作日志 */}
      <Section title="操作日志" right={<Btn variant="ghost" size="sm" onClick={() => setModal('logs')}>查看全部</Btn>} bodyClassName="p-0">
        <Table
          head={['操作类型', '操作时间', '操作人', '操作内容']}
          empty="暂无操作日志"
          footer={<Pagination page={logPaged.page} total={logPaged.total} totalPages={logPaged.totalPages} onChange={logPaged.setPage} />}
        >
          {logPaged.pageItems.map((log) => (
            <tr key={log.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{log.actionType || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{log.timestamp || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{log.operator || '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{log.notes || '—'}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 弹窗 */}
      <ProjectFormModal
        isOpen={modal === 'edit'}
        onClose={() => setModal(null)}
        project={project}
        onSave={(form) => {
          updateProject(form);
          writeLog('编辑项目', '更新项目基础信息');
        }}
      />

      {modal === 'locationForm' && (
        <LocationFormModal
          key={locTarget === 'new' ? 'loc-new' : locTarget?.id}
          isOpen
          onClose={() => { setModal(null); setLocTarget(null); }}
          projectName={project.name}
          initial={locTarget && locTarget !== 'new'
            ? { name: locTarget.name || '', address: locTarget.address || '', plannedCount: locTarget.plannedCount ?? 1, owner: locTarget.owner || '', notes: locTarget.notes || '' }
            : null}
          onSave={saveLocation}
        />
      )}

      <ConfirmModal
        isOpen={modal === 'disableLoc'}
        onClose={() => { setModal(null); setLocTarget(null); }}
        title="停用点位"
        danger
        text="停用后该点位不再作为新增设备或交付关联的可选项，历史设备、交付记录、问题和日志仍保留。确认停用吗？"
        onConfirm={() => { if (locTarget && locTarget !== 'new') disableLocation(locTarget); }}
      />

      <Modal isOpen={modal === 'logs'} onClose={() => setModal(null)} title="操作日志" size="lg">
        <OperationLog logs={projLogs} />
      </Modal>
    </Page>
  );
}
