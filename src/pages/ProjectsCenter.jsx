import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import OperationLog from '../components/OperationLog';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Card, Toolbar, Input, Select, SearchInput,
  Btn, LinkAction, Chip, StatCard, StatGrid, DescList, Table, EmptyState,
} from '../components/ui';
import {
  isPass, projectStatus as deriveProjectStatus,
  productionPlanStatus, deliveryPlanStatus, TODAY,
} from '../utils/status';

// 生产计划「当前卡点」派生阈值：创建早于 TODAY-45 天且未完成 → 长期未结。
const LONG_UNSETTLED_BEFORE = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - 45);
  return d.toISOString().slice(0, 10);
})();

// 生产计划「当前卡点」（平台派生，非计划唯一节点）：未结返修单 / NG → 质量测试；创建久未完成 → 长期未结；否则无明显卡点。
function planBottleneck(plan, status, devices, openRepairs) {
  if (['已完成', '已作废'].includes(status)) return '无明显卡点';
  const anyNG = devices.some((d) => ['生产返修中', '返修中', '测试NG', 'NG待返修'].includes(d.status));
  if (openRepairs > 0 || anyNG) return '质量测试';
  const longUnsettled = !!plan.createdAt && String(plan.createdAt).slice(0, 10) < LONG_UNSETTLED_BEFORE;
  return longUnsettled ? '长期未结' : '无明显卡点';
}

// 项目中心容器：项目列表 / 生产关联 / 交付执行 三个 tab（ERP 单据已迁移至 ERP 单据中心）。
// tab 由 ?tab= 决定，默认 list。视觉统一复用 ../components/ui 设计系统。

const TABS = [
  { key: 'list', label: '项目列表' },
  { key: 'production', label: '生产关联' },
  { key: 'delivery', label: '交付执行' },
];

const PROJECT_STATUSES = ['未开始', '进行中', '已交付', '已关闭', '已作废'];
const PRODUCTION_STATUSES = ['未开始', '生产中', '已完成', '已延期', '已作废'];
const PRODUCTION_NODES = ['来料准备', '整机装配', '质量测试', '整机入库'];
const DELIVERY_NODES = ['绑定设备', '出厂检验', '现场安装调试', '客户验收'];
const DELIVERY_STATUSES = ['未开始', '交付中', '已验收', '已延期', '已作废'];
const PROJECT_TYPES = ['智魔方', '机场', '工业场景', '遥操数采'];

// 项目成员角色 + 可选成员（评审版 mock：仅前端展示与弹窗配置，不做全平台数据权限拦截）。
const MEMBER_ROLES = ['项目负责人', '生产协同', '质量协同', '交付协同', '售后协同', 'ERP 协同', '只读成员'];
const MEMBER_CANDIDATES = ['张三', '李四', '王五', '赵六', '蔡八'];

// 弹窗内沿用的紧凑表单样式（Modal 内部，不影响主页面视觉）。
const INPUT = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500 bg-white';
const BTN_GHOST = 'px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50';
const BTN_PRIMARY = 'px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800';

function nowText() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

const normalizeProjectStatus = deriveProjectStatus;

// 非交互流程步骤条：用箭头连接的只读步骤，用于生产关联 / 交付执行页顶部说明业务流。
function FlowBar({ steps }) {
  return (
    <Card>
      <div className="flex items-center flex-wrap gap-y-2 text-[13px]">
        {steps.map((s, i) => (
          <span key={s} className="flex items-center">
            <span className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2.5 py-1 text-gray-700">{s}</span>
            {i < steps.length - 1 && <span className="mx-2 text-gray-300">→</span>}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ── 弹窗（保留既有交互与数据接线） ─────────────────── */
function SimpleFormModal({ isOpen, onClose, title, fields, onSubmit, submitText = '保存', size = 'lg', note }) {
  const initial = Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? '']));
  const [form, setForm] = useState(initial);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
    setForm(initial);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.key} className={field.full ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={field.rows || 3}
                  required={field.required}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className={`${INPUT} w-full`}
                />
              ) : field.options ? (
                <select
                  required={field.required}
                  disabled={field.disabled}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className={`${INPUT} w-full ${field.disabled ? 'bg-gray-50 text-gray-500' : ''}`}
                >
                  <option value="">-- 请选择 --</option>
                  {field.options.map((opt) => (
                    <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  min={field.min}
                  required={field.required}
                  readOnly={field.readOnly}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className={`${INPUT} w-full ${field.readOnly ? 'bg-gray-50 text-gray-500' : ''}`}
                />
              )}
            </div>
          ))}
        </div>
        {note && <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">{note}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">{submitText}</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ isOpen, onClose, title, text, onConfirm, danger = false }) {
  const [reason, setReason] = useState('');
  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
    onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{text}</p>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="填写原因或备注"
          className={`${INPUT} w-full`}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={handleConfirm} className={`px-4 py-2 text-sm text-white rounded ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'}`}>确认</button>
        </div>
      </div>
    </Modal>
  );
}

// 项目成员配置弹窗：展示/编辑项目成员与成员角色，说明「项目成员决定项目数据操作范围」。
function MemberConfigModal({ isOpen, onClose, project, onSave }) {
  const [members, setMembers] = useState(() => (project?.members || []).map((m) => ({ ...m })));
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('生产协同');
  if (!project) return null;

  const owner = project.manager || members.find((m) => m.role === '项目负责人')?.name || '—';
  const addMember = () => {
    if (!newName || members.some((m) => m.name === newName)) return;
    setMembers([...members, { name: newName, role: newRole }]);
    setNewName('');
  };
  const removeMember = (name) => setMembers(members.filter((m) => m.name !== name));
  const changeRole = (name, role) => setMembers(members.map((m) => (m.name === name ? { ...m, role } : m)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="配置项目成员" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-gray-400 mb-1">项目名称</div><div className="text-gray-800 font-medium">{project.name}</div></div>
          <div><div className="text-xs text-gray-400 mb-1">当前项目负责人</div><div className="text-gray-800 font-medium">{owner}</div></div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">项目成员列表（{members.length} 人）</div>
          <div className="border border-gray-200 rounded divide-y divide-gray-100">
            {members.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">暂无项目成员，请在下方添加</div>}
            {members.map((mem) => (
              <div key={mem.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-7 h-7 rounded-full bg-slate-600 text-white text-xs flex items-center justify-center flex-shrink-0">{mem.name.slice(-2)}</span>
                <span className="text-sm text-gray-800 w-14">{mem.name}</span>
                <select className={`${INPUT} text-xs flex-1`} value={mem.role} onChange={(e) => changeRole(mem.name, e.target.value)}>
                  {MEMBER_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button type="button" onClick={() => removeMember(mem.name)} className="text-red-400 hover:text-red-600 text-xs">移除</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">添加成员</div>
          <div className="flex items-center gap-2">
            <select className={`${INPUT} flex-1`} value={newName} onChange={(e) => setNewName(e.target.value)}>
              <option value="">-- 选择成员 --</option>
              {MEMBER_CANDIDATES.filter((n) => !members.some((m) => m.name === n)).map((n) => <option key={n}>{n}</option>)}
            </select>
            <select className={`${INPUT} flex-1`} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {MEMBER_ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button type="button" onClick={addMember} className={BTN_GHOST}>添加</button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">
          只有项目成员可以查看或操作该项目下的生产计划、交付计划、设备、点位、质量问题和工单。管理员不受此限制。
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="button" onClick={() => { onSave(members); onClose(); }} className={BTN_PRIMARY}>保存成员配置</button>
        </div>
      </div>
    </Modal>
  );
}

// 新建项目（item 十五）：以 ERP 来源单据为入口，先选择 ERP 项目 / 生产订单 / 服务交付，
// 自动带出 ERP 同步字段（只读），再补充平台字段；不允许自由填写 ERP 无关的项目名称。
function CreateProjectModal({ isOpen, onClose, erpSources, onCreate }) {
  const [sourceValue, setSourceValue] = useState('');
  const [form, setForm] = useState({ manager: '', targetCount: 1, projectType: '', members: '', notes: '' });
  const sel = erpSources.find((s) => s.value === sourceValue) || null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const ro = `${INPUT} w-full bg-gray-50 text-gray-500`;
  const lbl = 'block text-xs text-gray-500 mb-1';

  const reset = () => { setSourceValue(''); setForm({ manager: '', targetCount: 1, projectType: '', members: '', notes: '' }); };
  const submit = (e) => {
    e.preventDefault();
    if (!sel) return;
    onCreate(sel, form);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新建项目" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={lbl}>选择 ERP 项目 / ERP 来源单据 *</label>
          <select required value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} className={`${INPUT} w-full`}>
            <option value="">-- 选择已同步的 ERP 来源单据 --</option>
            {erpSources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">项目名称、项目编码、客户、合同编号、订单编码来自 ERP，选择后自动带出，不支持在平台自由填写。</p>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-gray-800 mb-2">ERP 同步字段（只读）</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>项目名称</label><input readOnly value={sel?.name || ''} placeholder="选择来源后自动带出" className={ro} /></div>
            <div><label className={lbl}>项目编码</label><input readOnly value={sel?.code || ''} placeholder="选择来源后自动带出" className={ro} /></div>
            <div><label className={lbl}>客户</label><input readOnly value={sel?.client || ''} placeholder="选择来源后自动带出" className={ro} /></div>
            <div><label className={lbl}>合同编号</label><input readOnly value={sel?.contractNo || ''} placeholder="选择来源后自动带出" className={ro} /></div>
            <div className="col-span-2"><label className={lbl}>订单编码</label><input readOnly value={sel?.orderCode || ''} placeholder="选择来源后自动带出" className={ro} /></div>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-gray-800 mb-2">平台补充字段</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>项目负责人</label>
              <select value={form.manager} onChange={(e) => set('manager', e.target.value)} className={`${INPUT} w-full`}>
                <option value="">-- 请选择 --</option>
                {MEMBER_CANDIDATES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div><label className={lbl}>目标台数</label><input type="number" min={1} value={form.targetCount} onChange={(e) => set('targetCount', e.target.value)} className={`${INPUT} w-full`} /></div>
            <div>
              <label className={lbl}>业务场景</label>
              <select value={form.projectType} onChange={(e) => set('projectType', e.target.value)} className={`${INPUT} w-full`}>
                <option value="">-- 请选择 --</option>
                {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>项目成员（多个用逗号分隔）</label><input value={form.members} onChange={(e) => set('members', e.target.value)} placeholder="如：张三,李四" className={`${INPUT} w-full`} /></div>
            <div className="col-span-2"><label className={lbl}>备注</label><textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${INPUT} w-full`} /></div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">平台项目用于组织 ERP 来源单据和平台过程记录；项目名称、项目编码优先来自 ERP，平台仅补充负责人、目标台数、业务场景等字段。</div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className={BTN_PRIMARY}>创建项目</button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════ 项目列表 ═════════ */
function ProjectListTab() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [filters, setFilters] = useState({
    keyword: '', status: '', projectType: '', owner: '', customer: '', erpLinked: '', createdFrom: '', createdTo: '',
  });

  const productionPlans = [...(state.workflowProductionPlans || []), ...(state.productionPlans || [])];
  const deliveryPlans = state.deliveryPlans || [];
  const owners = [...new Set(state.projects.map((p) => p.manager).filter(Boolean))];
  const customers = [...new Set(state.projects.map((p) => p.client).filter(Boolean))];

  // 新建项目的 ERP 来源单据候选：ERP 项目单 / 生产订单 / 服务交付（销售出库），选择后带出 ERP 同步字段。
  const erpSources = [];
  const seenErp = new Set();
  const pushErp = (value, opt) => { if (value && !seenErp.has(value)) { seenErp.add(value); erpSources.push({ value, ...opt }); } };
  state.projects.forEach((p) => pushErp(p.erpProjectNo, {
    label: `${p.erpProjectNo} · ${p.name}（ERP 项目）`, name: p.name, code: p.erpProjectNo, client: p.client || '',
    contractNo: `HT-${p.erpProjectNo}`, orderCode: `SO-${p.erpProjectNo}`, sourceType: 'ERP 项目', erpProjectNo: p.erpProjectNo,
  }));
  (state.workflowProductionPlans || []).forEach((w) => {
    const proj = state.projects.find((p) => p.id === w.projectId);
    pushErp(w.erpProductionOrderNo, {
      label: `${w.erpProductionOrderNo} · ${w.name}（ERP 生产订单）`, name: proj?.name || w.name, code: proj?.erpProjectNo || w.erpProductionOrderNo,
      client: proj?.client || '', contractNo: proj?.erpProjectNo ? `HT-${proj.erpProjectNo}` : '', orderCode: w.erpProductionOrderNo,
      sourceType: 'ERP 生产订单', erpProjectNo: proj?.erpProjectNo || '',
    });
  });
  deliveryPlans.forEach((dp) => {
    const proj = state.projects.find((p) => p.id === dp.projectId);
    pushErp(dp.erpOutboundNo, {
      label: `${dp.erpOutboundNo} · ${dp.name}（ERP 服务交付）`, name: proj?.name || dp.name, code: proj?.erpProjectNo || dp.erpOutboundNo,
      client: proj?.client || '', contractNo: proj?.erpProjectNo ? `HT-${proj.erpProjectNo}` : '', orderCode: dp.erpOutboundNo,
      sourceType: 'ERP 服务交付', erpProjectNo: proj?.erpProjectNo || '',
    });
  });

  const rows = state.projects.map((project) => {
    const status = normalizeProjectStatus(project, productionPlans, deliveryPlans);
    // 已关联设备数：直接挂在项目上或经生产计划归属该项目的设备。
    const deviceCount = state.devices.filter((d) => {
      if (d.projectId === project.id) return true;
      const plan = productionPlans.find((p) => p.id === d.productionPlanId);
      return plan?.projectId === project.id;
    }).length;
    // 已关联 ERP 单据数：ERP 项目单 + 关联生产订单 + 关联销售出库（服务交付）单。
    const erpDocCount = (project.erpProjectNo ? 1 : 0)
      + productionPlans.filter((p) => p.projectId === project.id && p.erpProductionOrderNo).length
      + deliveryPlans.filter((p) => p.projectId === project.id && p.erpOutboundNo).length;
    const openIssues = (state.qualityIssues || []).filter((q) => q.projectId === project.id && q.status !== '已关闭').length;
    return {
      ...project,
      status,
      projectCode: project.erpProjectNo || project.id,
      deviceCount,
      erpDocCount,
      openIssues,
      erpLinked: Boolean(project.erpPurchaseOrderNo || project.erpProjectNo),
    };
  });

  const filtered = rows.filter((p) => {
    const keyword = filters.keyword.trim().toLowerCase();
    const created = (p.createdAt || '').slice(0, 10);
    return (!keyword || p.name.toLowerCase().includes(keyword) || p.id.toLowerCase().includes(keyword))
      && (!filters.status || p.status === filters.status)
      && (!filters.projectType || p.projectType === filters.projectType)
      && (!filters.owner || p.manager === filters.owner)
      && (!filters.customer || p.client === filters.customer)
      && (!filters.erpLinked || (filters.erpLinked === 'yes' ? p.erpLinked : !p.erpLinked))
      && (!filters.createdFrom || created >= filters.createdFrom)
      && (!filters.createdTo || created <= filters.createdTo);
  });
  const paged = usePaged(filtered, 10);

  const openModal = (name, project = null) => {
    setTarget(project);
    setModal(name);
  };
  const resetFilters = () => setFilters({ keyword: '', status: '', projectType: '', owner: '', customer: '', erpLinked: '', createdFrom: '', createdTo: '' });

  const writeProjectLog = (projectId, actionType, notes, fromStatus = '', toStatus = '') => {
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}-${projectId}`,
        projectId,
        operator: state.currentUser,
        timestamp: nowText(),
        actionType,
        fromStatus,
        toStatus,
        notes,
      },
    });
  };

  const actionButtons = (project) => (
    <div className="flex items-center gap-x-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <LinkAction onClick={() => navigate(`/projects/${project.id}`)}>查看详情</LinkAction>
      <LinkAction onClick={() => openModal('editProject', project)}>编辑平台补充信息</LinkAction>
      <LinkAction to="/erp-center?tab=overview">查看关联 ERP 单据</LinkAction>
      <LinkAction onClick={() => navigate(`/projects/${project.id}`)}>查看日志</LinkAction>
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="项目列表"
        description="组织 ERP 来源单据与平台补充信息，追踪设备全生命周期质量进度。"
        actions={canDo('add_project') && <Btn variant="primary" onClick={() => openModal('newProject')}>新建项目</Btn>}
      />

      <Card>
        <p className="text-[13px] text-gray-600 leading-relaxed">平台项目用于组织 ERP 来源单据和平台过程记录。项目名称、项目编码优先来自 ERP；负责人、目标台数、业务场景等为平台补充字段。</p>
      </Card>

      <Toolbar right={<><span className="text-xs text-gray-400">共 {filtered.length} 个项目</span><Btn variant="ghost" size="sm" onClick={resetFilters}>重置</Btn></>}>
        <SearchInput className="w-60" placeholder="项目名称 / 项目ID" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部状态</option>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={filters.projectType} onChange={(e) => setFilters({ ...filters, projectType: e.target.value })}>
          <option value="">全部项目类型</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}>
          <option value="">全部负责人</option>{owners.map((o) => <option key={o}>{o}</option>)}
        </Select>
        <Select value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })}>
          <option value="">全部客户</option>{customers.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filters.erpLinked} onChange={(e) => setFilters({ ...filters, erpLinked: e.target.value })}>
          <option value="">ERP 不限</option>
          <option value="yes">已关联 ERP</option>
          <option value="no">未关联 ERP</option>
        </Select>
        <Input type="date" value={filters.createdFrom} onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value })} />
        <Input type="date" value={filters.createdTo} onChange={(e) => setFilters({ ...filters, createdTo: e.target.value })} />
      </Toolbar>

      <Table
        head={['项目名称', '项目编码', 'ERP 来源单据', '客户', '项目负责人', '目标台数', '已关联 ERP 单据数', '已关联设备数', '未关闭问题数', '最近更新时间', '操作']}
        empty="暂无匹配项目"
        footer={<Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} />}
      >
        {paged.pageItems.map((project) => (
          <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="hover:bg-[#fafafa] cursor-pointer">
            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{project.name}</td>
            <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{project.projectCode}</td>
            <td className="px-3 py-2 whitespace-nowrap">{project.erpProjectNo ? <Chip>{project.erpProjectNo}</Chip> : <span className="text-gray-400">未关联</span>}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project.client || '—'}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project.manager || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{project.targetCount || 0}</td>
            <td className="px-3 py-2 text-gray-600">{project.erpDocCount}</td>
            <td className="px-3 py-2 text-gray-600">{project.deviceCount}</td>
            <td className="px-3 py-2">{project.openIssues > 0 ? <span className="text-amber-600 font-medium">{project.openIssues}</span> : <span className="text-gray-400">0</span>}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{(project.updatedAt || '').slice(0, 16) || '—'}</td>
            <td className="px-3 py-2">{actionButtons(project)}</td>
          </tr>
        ))}
      </Table>

      {modal === 'newProject' && (
        <CreateProjectModal
          isOpen
          onClose={() => setModal(null)}
          erpSources={erpSources}
          onCreate={(sel, form) => {
            const members = form.members.split(/[,，、]/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name, role: '只读成员' }));
            const project = {
              id: `PROJ-${Date.now().toString().slice(-6)}`,
              name: sel.name,
              projectCode: sel.code,
              erpProjectNo: sel.erpProjectNo || sel.code,
              erpSourceNo: sel.value,
              erpSourceType: sel.sourceType,
              contractNo: sel.contractNo,
              orderCode: sel.orderCode,
              client: sel.client,
              projectType: form.projectType,
              manager: form.manager,
              targetCount: Number(form.targetCount || 1),
              members,
              notes: form.notes,
              status: '未开始',
              createdAt: nowText(),
              updatedAt: nowText(),
            };
            dispatch({ type: 'ADD_PROJECT', payload: project });
            writeProjectLog(project.id, '新建项目', `从 ERP 来源单据 ${sel.value} 创建项目`, '', '未开始');
          }}
        />
      )}

      <SimpleFormModal
        key={`edit-${target?.id || 'none'}`}
        isOpen={modal === 'editProject'}
        onClose={() => setModal(null)}
        title="编辑平台补充信息"
        note="项目名称、ERP 项目号、客户来自 ERP，只读同步；此处仅编辑平台补充字段（项目负责人 / 目标台数 / 业务场景 / 备注）。"
        fields={[
          { key: 'name', label: '项目名称（ERP 同步）', defaultValue: target?.name || '', readOnly: true },
          { key: 'erpProjectNo', label: 'ERP 项目号（ERP 同步）', defaultValue: target?.erpProjectNo || '', readOnly: true },
          { key: 'client', label: '客户（ERP 同步）', defaultValue: target?.client || '', readOnly: true },
          { key: 'manager', label: '项目负责人（平台补充）', defaultValue: target?.manager || '', options: ['张三', '李四', '王五', '赵六', '蔡八'] },
          { key: 'targetCount', label: '目标台数（平台补充）', type: 'number', min: 1, defaultValue: target?.targetCount || 1, required: true },
          { key: 'projectType', label: '业务场景（平台补充）', options: PROJECT_TYPES, defaultValue: target?.projectType || '' },
          { key: 'notes', label: '备注（平台补充）', type: 'textarea', full: true, defaultValue: target?.notes || '' },
        ]}
        onSubmit={(form) => {
          dispatch({ type: 'UPDATE_PROJECT', payload: { id: target.id, ...form, targetCount: Number(form.targetCount || 1), updatedAt: nowText() } });
          writeProjectLog(target.id, '编辑平台补充信息', '更新项目平台补充字段');
        }}
      />

      <ConfirmModal
        isOpen={modal === 'void'}
        onClose={() => setModal(null)}
        title="作废项目"
        danger
        text={`确认作废项目「${target?.name || ''}」？作废后仍保留历史记录。`}
        onConfirm={(reason) => {
          dispatch({ type: 'UPDATE_PROJECT', payload: { id: target.id, status: '已作废', voided: true, voidReason: reason, updatedAt: nowText() } });
          writeProjectLog(target.id, '作废项目', reason || '项目作废', target.status, '已作废');
        }}
      />

      <ConfirmModal
        isOpen={modal === 'close'}
        onClose={() => setModal(null)}
        title="关闭项目"
        text={`确认关闭项目「${target?.name || ''}」？`}
        onConfirm={(reason) => {
          dispatch({ type: 'UPDATE_PROJECT', payload: { id: target.id, status: '已关闭', closeReason: reason, closedAt: nowText(), updatedAt: nowText() } });
          writeProjectLog(target.id, '关闭项目', reason || '项目关闭', target.status, '已关闭');
        }}
      />

      {modal === 'members' && (
        <MemberConfigModal
          key={`members-${target?.id || 'none'}`}
          isOpen
          onClose={() => setModal(null)}
          project={target}
          onSave={(members) => {
            dispatch({ type: 'UPDATE_PROJECT', payload: { id: target.id, members, updatedAt: nowText() } });
            writeProjectLog(target.id, '配置项目成员', `更新项目成员（${members.length} 人）`);
          }}
        />
      )}
    </Page>
  );
}

/* ═════════ 生产计划 ═════════ */
function ProductionPlanTab() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ keyword: '', projectId: '', deviceType: '', status: '', owner: '', delayed: '' });
  const [editPlan, setEditPlan] = useState(null);
  const [linkErpOpen, setLinkErpOpen] = useState(false);
  const [linkErpNo, setLinkErpNo] = useState('');
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  // 生产计划列表只展示流程型生产计划 (WPP-*)。PLAN-* 属于日产能数据，不混入此列表。
  const plans = state.workflowProductionPlans || [];
  const projects = state.projects || [];

  const typeName = (plan) => state.deviceTypes.find((t) => t.id === plan.deviceTypeId)?.name || plan.deviceType || 'AlphaBot 1';

  const enriched = plans.map((plan) => {
    const devices = state.devices.filter((d) => d.productionPlanId === plan.id);
    const stored = devices.filter((d) => ['已入库', '待分配项目', '已分配项目', '在线运营'].includes(d.status)).length;
    const status = productionPlanStatus(plan);
    const currentNode = plan.currentNode || (status === '已完成' ? '整机入库' : PRODUCTION_NODES[Math.min(Math.floor(stored / Math.max(plan.targetCount || 1, 1) * 4), 3)]);
    const openRepairs = (state.productionWorkOrders || []).filter((w) => w.productionPlanId === plan.id && !['已关闭', '已作废', '已完成'].includes(w.status)).length;
    const project = projects.find((p) => p.id === plan.projectId);
    return {
      ...plan,
      status,
      projectName: project?.name || '—',
      deviceType: typeName(plan),
      owner: plan.owner || project?.manager || '—',
      stored: Math.min(stored, plan.targetCount || 0),
      currentNode,
      bottleneck: planBottleneck(plan, status, devices, openRepairs),
      delayed: status === '已延期',
    };
  });

  const owners = [...new Set(enriched.map((p) => p.owner).filter((o) => o && o !== '—'))];
  const deviceTypeNames = [...new Set(enriched.map((p) => p.deviceType))];
  const erpOrderNos = [...new Set(plans.map((p) => p.erpProductionOrderNo).filter(Boolean))];

  const filtered = enriched.filter((plan) => {
    const kw = filters.keyword.trim().toLowerCase();
    return (!kw || plan.id.toLowerCase().includes(kw) || plan.projectName.toLowerCase().includes(kw) || (plan.name || '').toLowerCase().includes(kw))
      && (!filters.projectId || plan.projectId === filters.projectId)
      && (!filters.deviceType || plan.deviceType === filters.deviceType)
      && (!filters.status || plan.status === filters.status)
      && (!filters.owner || plan.owner === filters.owner)
      && (!filters.delayed || (filters.delayed === 'yes' ? plan.delayed : !plan.delayed));
  });
  const paged = usePaged(filtered, 10);

  const stop = (e) => e.stopPropagation();
  // 生产计划已取消唯一当前节点，列表不再提供"进入当前节点"操作。
  const delayedCount = enriched.filter((p) => p.delayed).length;

  return (
    <Page>
      <PageHeader
        title="生产关联"
        description="平台不新建 ERP 生产订单。此处关联 ERP 生产订单并补充设备级生产过程与质量追溯记录。"
        actions={<Btn variant="primary" onClick={() => setLinkErpOpen(true)}>关联 ERP 生产订单</Btn>}
      />

      <FlowBar steps={['选择 ERP 生产订单', '查看订单 BOM / LRP', '查看材料出库 / 出库申请', '查看产品入库 / 产品检验', '补充设备 SN 与测试记录']} />

      <StatGrid cols={4}>
        <StatCard label="计划总数" value={enriched.length} />
        <StatCard label="生产中" value={enriched.filter((p) => p.status === '生产中').length} />
        <StatCard label="已完成" value={enriched.filter((p) => p.status === '已完成').length} tone="success" />
        <StatCard label="延期计划" value={delayedCount} tone={delayedCount ? 'danger' : 'default'} />
      </StatGrid>

      <Toolbar>
        <SearchInput className="w-56" placeholder="计划ID / 名称 / 项目" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
        <Select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
          <option value="">所属项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.deviceType} onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}>
          <option value="">全部设备类型</option>{deviceTypeNames.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部状态</option>{PRODUCTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}>
          <option value="">全部负责人</option>{owners.map((o) => <option key={o}>{o}</option>)}
        </Select>
        <Select value={filters.delayed} onChange={(e) => setFilters({ ...filters, delayed: e.target.value })}>
          <option value="">是否延期</option>
          <option value="yes">已延期</option>
          <option value="no">未延期</option>
        </Select>
      </Toolbar>

      <Table
        head={['生产计划ID', '计划名称', '所属项目', '设备类型', '计划数量', '已入库', '计划周期', '当前卡点', '状态', '负责人', 'ERP 生产订单号', '操作']}
        empty="暂无匹配生产计划"
        footer={<Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} />}
      >
        {paged.pageItems.map((plan) => (
          <tr key={plan.id} onClick={() => navigate(`/production-plans/${plan.id}`)} className="hover:bg-[#fafafa] cursor-pointer">
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{plan.id}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{plan.name || '—'}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{plan.projectName}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{plan.deviceType}</td>
            <td className="px-3 py-2 text-gray-600">{plan.targetCount || 0}</td>
            <td className="px-3 py-2 text-gray-600">{plan.stored}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{(plan.createdAt || '').slice(0, 10)} ~ {plan.endDate || '—'}</td>
            <td className="px-3 py-2"><StatusBadge status={plan.bottleneck} /></td>
            <td className="px-3 py-2"><StatusBadge status={plan.status} /></td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{plan.owner}</td>
            <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{plan.erpProductionOrderNo || '—'}</td>
            <td className="px-3 py-2 text-xs whitespace-nowrap" onClick={stop}>
              <div className="flex items-center gap-x-3">
                <LinkAction onClick={() => navigate(`/production-plans/${plan.id}`)}>查看详情</LinkAction>
                <LinkAction to="/erp-center?tab=production">查看 ERP 源单据</LinkAction>
                <LinkAction onClick={() => setEditPlan(plan)}>补充生产过程记录</LinkAction>
                <LinkAction onClick={() => navigate(`/projects/${plan.projectId}`)}>查看日志</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal isOpen={linkErpOpen} onClose={() => setLinkErpOpen(false)} title="关联 ERP 生产订单">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">请在 ERP 中维护生产订单，平台在此选择已同步的 ERP 生产订单建立关联。</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择已同步的 ERP 生产订单</label>
            <select value={linkErpNo} onChange={(e) => setLinkErpNo(e.target.value)} className={`${INPUT} w-full`}>
              <option value="">-- 请选择 --</option>
              {erpOrderNos.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLinkErpOpen(false)} className={BTN_GHOST}>取消</button>
            <button
              type="button"
              onClick={() => {
                if (!linkErpNo) { showToast('请先选择 ERP 生产订单'); return; }
                showToast(`已选择 ERP 生产订单 ${linkErpNo} 建立关联（原型演示）`);
                setLinkErpOpen(false);
                setLinkErpNo('');
              }}
              className={BTN_PRIMARY}
            >确认关联</button>
          </div>
        </div>
      </Modal>

      {editPlan && (
        <SimpleFormModal
          key={`edit-plan-${editPlan.id}`}
          isOpen
          onClose={() => setEditPlan(null)}
          title="补充生产过程记录"
          note="ERP 生产订单、工单、产品入库、产品检验状态来自 ERP，只读同步，不能在平台编辑。"
          fields={[
            { key: 'name', label: '生产计划名称 *', required: true, defaultValue: editPlan.name || '' },
            { key: 'projectId', label: '所属项目', options: projects.map((p) => ({ value: p.id, label: p.name })), defaultValue: editPlan.projectId || '' },
            { key: 'owner', label: '负责人', options: ['张三', '李四', '王五', '赵六'], defaultValue: editPlan.owner || '' },
            { key: 'targetCount', label: '计划数量 *', type: 'number', min: 1, required: true, defaultValue: editPlan.targetCount || 1 },
            { key: 'startDate', label: '计划开始时间', type: 'date', defaultValue: editPlan.startDate || '' },
            { key: 'endDate', label: '计划完成时间', type: 'date', defaultValue: editPlan.endDate || '' },
            { key: 'enabled', label: '是否启用', options: ['启用', '停用'], defaultValue: editPlan.enabled === false ? '停用' : '启用' },
            { key: 'erpProductionOrderNo', label: '关联 ERP 生产订单（只读引用）', options: erpOrderNos, disabled: true, defaultValue: editPlan.erpProductionOrderNo || '' },
            { key: 'notes', label: '备注', type: 'textarea', full: true, defaultValue: editPlan.notes || '' },
          ]}
          onSubmit={(form) => {
            dispatch({
              type: 'UPDATE_PRODUCTION_PLAN',
              payload: {
                id: editPlan.id,
                name: form.name,
                projectId: form.projectId,
                owner: form.owner,
                targetCount: Number(form.targetCount || 0),
                startDate: form.startDate,
                endDate: form.endDate,
                notes: form.notes,
                enabled: form.enabled !== '停用',
                erpProductionOrderNo: form.erpProductionOrderNo,
                updatedAt: nowText(),
              },
            });
            dispatch({
              type: 'ADD_OPERATION_LOG',
              payload: {
                id: `LOG-${Date.now()}-${editPlan.id}`,
                productionPlanId: editPlan.id,
                projectId: form.projectId || editPlan.projectId,
                operator: state.currentUser,
                timestamp: nowText(),
                actionType: '编辑生产计划',
                fromStatus: '',
                toStatus: '',
                notes: `更新生产计划平台字段：${form.name}`,
              },
            });
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white text-[13px] px-4 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </Page>
  );
}

/* ═════════ 交付计划：操作弹窗（仅交付 tab 使用） ═════════ */
const DELIVERY_BINDABLE_STATUSES = ['已入库', '待分配项目', '已分配项目'];
const DELIVERY_VOID_REASONS = ['客户取消', '项目变更', '重复创建', '计划信息错误', '设备无法交付', '其他'];
const DELIVERY_OWNERS = ['张三', '李四', '王五', '赵六'];

// 交付子工单状态归一：把合成状态映射到统一处理阶段（决定右侧任务区提供哪些操作）。
function normalizeSubOrderStatus(status) {
  const map = {
    未开始: '待分派',
    待分派: '待分派',
    待出厂检验: '待分派',
    待接单: '待接单',
    待上门: '待上门',
    已出厂: '待上门',
    进行中: '现场执行中',
    现场执行中: '现场执行中',
    现场处理中: '现场执行中',
    待客户验收: '现场执行中',
    存在异常: '存在异常',
    安装异常: '存在异常',
    验收异常: '存在异常',
    不可出厂: '存在异常',
    已完成: '已完成',
    已验收: '已完成',
  };
  return map[status] || '现场执行中';
}

// 各处理阶段：当前待处理动作 / 下一步建议 / 状态化操作按钮（原型占位）。
// op.to → 页面跳转；op.toast → 自定义提示；否则默认「原型环境：{label} · {子工单号}」提示。
const SUBORDER_PHASE_OPS = {
  待分派: {
    action: '待分派现场工程师',
    next: '为该子工单分派现场工程师，分派后进入接单环节',
    ops: [{ label: '分派工程师' }],
  },
  待接单: {
    action: '等待工程师接单',
    next: '工程师接单后进入上门排期；如需可改派其他工程师',
    ops: [{ label: '工程师接单' }, { label: '改派工程师' }],
  },
  待上门: {
    action: '等待工程师上门 / 到场',
    next: '工程师到场后记录上门时间，进入现场执行',
    ops: [{ label: '记录上门 / 到场' }],
  },
  现场执行中: {
    action: '现场执行中',
    next: '更新进度、上传交付资料，完成后提交完成',
    ops: [{ label: '更新进度' }, { label: '上传资料' }, { label: '记录异常' }, { label: '提交完成' }],
  },
  存在异常: {
    action: '存在交付异常，待处理',
    next: '记录异常进展，或提交技术客服预处理生成问题池记录',
    ops: [
      { label: '记录异常进展' },
      { label: '提交技术客服预处理', toast: '原型环境：提交技术客服预处理，将生成问题池记录（在交付计划详情页执行完整流程）' },
      { label: '查看关联问题', to: '/after-sales?tab=issues' },
    ],
  },
  已完成: {
    action: '子工单已完成',
    next: '可查看交付资料与操作日志',
    ops: [{ label: '查看资料' }, { label: '查看日志' }],
  },
};

// 绑定设备集合：boundDeviceIds ∪ records.binding。
function deliveryBoundIds(plan) {
  const explicit = plan.boundDeviceIds || [];
  const binding = (plan.records?.binding || []).map((r) => r.deviceId);
  return [...new Set([...explicit, ...binding].filter(Boolean))];
}

// 设备部署子工单当前状态（与交付计划详情口径一致）。
function deliveryDeployStatus(recs, deviceId) {
  const ca = (recs.customerAccept || []).find((r) => r.deviceId === deviceId);
  const si = (recs.siteInstall || []).find((r) => r.deviceId === deviceId);
  const fi = (recs.factoryInspection || []).find((r) => r.deviceId === deviceId);
  if (ca) return isPass(ca) ? '已验收' : '验收异常';
  if (si) return isPass(si) ? '待客户验收' : '安装异常';
  if (fi) return isPass(fi) ? '已出厂' : '不可出厂';
  return '待出厂检验';
}

function deviceTypeName(state, id) {
  return (state.deviceTypes || []).find((t) => t.id === id)?.name || '—';
}
function prodPlanName(state, id) {
  const plans = [...(state.workflowProductionPlans || []), ...(state.productionPlans || [])];
  return plans.find((p) => p.id === id)?.name || id || '—';
}
function inspectBadge(v) {
  return v ? <StatusBadge status={v} /> : <span className="text-gray-400">—</span>;
}

// 管理交付设备：已绑定 / 可绑定两张表，绑定/解绑更新本地集合并 dispatch UPDATE_DELIVERY_PLAN(boundDeviceIds)。
function ManageDeliveryDevicesModal({ planId, state, dispatch, onClose, onToast }) {
  const devices = state.devices || [];
  const plan = (state.deliveryPlans || []).find((p) => p.id === planId);
  const project = (state.projects || []).find((p) => p.id === plan?.projectId);
  const [boundIds, setBoundIds] = useState(() => (plan ? deliveryBoundIds(plan) : []));

  const boundDevices = boundIds.map((id) => devices.find((d) => d.id === id)).filter(Boolean);
  const otherBound = new Set();
  (state.deliveryPlans || []).forEach((p) => {
    if (p.id !== planId) deliveryBoundIds(p).forEach((id) => otherBound.add(id));
  });
  const bindable = devices.filter((d) => DELIVERY_BINDABLE_STATUSES.includes(d.status) && !boundIds.includes(d.id));

  const boundPaged = usePaged(boundDevices, 6);
  const bindablePaged = usePaged(bindable, 6);

  if (!plan) return null;

  const persist = (next, msg) => {
    setBoundIds(next);
    dispatch({ type: 'UPDATE_DELIVERY_PLAN', payload: { id: plan.id, boundDeviceIds: next, updatedAt: nowText() } });
    onToast(msg);
  };
  const bindDev = (d) => { if (!boundIds.includes(d.id)) persist([...boundIds, d.id], `已绑定设备 ${d.sn}`); };
  const unbindDev = (d) => persist(boundIds.filter((x) => x !== d.id), `已解绑设备 ${d.sn}`);

  return (
    <Modal isOpen onClose={onClose} title="管理交付设备" size="xl">
      <div className="space-y-5">
        <DescList
          cols={4}
          items={[
            ['交付计划编号', <span className="font-mono text-xs">{plan.id}</span>],
            ['所属项目', project?.name || '—'],
            ['当前已绑定设备数', `${boundDevices.length} 台`],
            ['计划交付数量', plan.targetCount != null ? `${plan.targetCount} 台` : '—'],
          ]}
        />

        <div>
          <div className="text-[13px] font-semibold text-gray-800 mb-2">已绑定设备（{boundDevices.length}）</div>
          <Table
            head={['设备SN', '机器人型号', '当前状态', '所属生产计划', '出厂检验状态', '操作']}
            empty="暂无已绑定设备"
            footer={<Pagination page={boundPaged.page} total={boundPaged.total} totalPages={boundPaged.totalPages} pageSize={6} onChange={boundPaged.setPage} />}
          >
            {boundPaged.pageItems.map((d) => (
              <tr key={d.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{d.sn}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{deviceTypeName(state, d.deviceTypeId)}</td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{prodPlanName(state, d.productionPlanId)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{inspectBadge(d.erpInspectionStatus)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <LinkAction onClick={() => unbindDev(d)}>解绑</LinkAction>
                    <LinkAction to={`/devices/${d.id}`}>查看设备详情</LinkAction>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-gray-800 mb-1">可绑定设备（{bindable.length}）</div>
          <div className="text-xs text-gray-400 mb-2">已入库 / 待分配项目 / 已分配项目 且未绑定本计划的设备。</div>
          <Table
            head={['设备SN', '机器人型号', '当前状态', '所属生产计划', '出厂检验状态', '是否已绑定其他交付计划', '操作']}
            empty="暂无可绑定设备"
            footer={<Pagination page={bindablePaged.page} total={bindablePaged.total} totalPages={bindablePaged.totalPages} pageSize={6} onChange={bindablePaged.setPage} />}
          >
            {bindablePaged.pageItems.map((d) => {
              const elsewhere = otherBound.has(d.id) || (d.deliveryPlanId && d.deliveryPlanId !== plan.id);
              return (
                <tr key={d.id} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{d.sn}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{deviceTypeName(state, d.deviceTypeId)}</td>
                  <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{prodPlanName(state, d.productionPlanId)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{inspectBadge(d.erpInspectionStatus)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{elsewhere ? <Chip tone="outline">是</Chip> : <span className="text-gray-400">否</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><LinkAction onClick={() => bindDev(d)}>绑定</LinkAction></td>
                </tr>
              );
            })}
          </Table>
        </div>

        <div className="flex justify-end"><button onClick={onClose} className={BTN_PRIMARY}>完成</button></div>
      </div>
    </Modal>
  );
}

// 管理交付子工单：由计划记录合成子工单（智魔方含前置准备，均按设备生成部署子工单），操作为原型占位轻提示。
function ManageDeliverySubOrdersModal({ planId, state, onClose, onToast }) {
  const plan = (state.deliveryPlans || []).find((p) => p.id === planId);
  const project = (state.projects || []).find((p) => p.id === plan?.projectId);
  const devices = state.devices || [];
  const recs = plan?.records || {};
  const boundDevices = (plan ? deliveryBoundIds(plan) : []).map((id) => devices.find((d) => d.id === id)).filter(Boolean);
  const isZhimofang = project?.projectType === '智魔方';
  const templateName = plan?.templateName || (isZhimofang ? '智魔方交付流程模板' : '通用部署流程模板');

  const preAdvanced = (recs.factoryInspection || []).length > 0 || ['出厂检验', '现场安装调试', '客户验收'].includes(plan?.currentNode);
  const preStarted = (recs.binding || []).length > 0;
  const preOrders = isZhimofang ? [{
    id: `PRE-${plan.id}`,
    type: '前置准备子工单',
    deviceSN: '—',
    status: preAdvanced ? '已完成' : preStarted ? '进行中' : '未开始',
    owner: plan.owner || '—',
    eta: plan.factoryDate || plan.siteInstallDate || '—',
    actual: preAdvanced ? (plan.siteInstallDate || '—') : '—',
    updated: plan.updatedAt || '—',
  }] : [];
  const deployOrders = boundDevices.map((d) => {
    const si = (recs.siteInstall || []).find((r) => r.deviceId === d.id);
    return {
      id: `DEP-${plan.id}-${d.id}`,
      type: '机器人 / 设备部署子工单',
      deviceSN: d.sn,
      status: deliveryDeployStatus(recs, d.id),
      owner: si?.operator || plan.owner || '—',
      eta: plan.siteInstallDate || '—',
      actual: si?.time || '—',
      updated: d.updatedAt || '—',
    };
  });
  const orders = [...preOrders, ...deployOrders];

  const [selectedId, setSelectedId] = useState(orders[0]?.id);

  if (!plan) return null;

  const selectedOrder = orders.find((o) => o.id === selectedId) || orders[0];
  const phase = selectedOrder ? normalizeSubOrderStatus(selectedOrder.status) : null;
  const phaseInfo = phase ? SUBORDER_PHASE_OPS[phase] : null;

  const runOp = (op) => onToast(op.toast || `原型环境：${op.label} · ${selectedOrder.id}`);

  return (
    <Modal isOpen onClose={onClose} title="管理交付子工单" size="xl">
      <div className="space-y-4">
        <DescList
          cols={4}
          items={[
            ['交付计划编号', <span className="font-mono text-xs">{plan.id}</span>],
            ['所属项目', project?.name || '—'],
            ['项目类型 · 业务场景', project?.projectType ? <Chip>{project.projectType}</Chip> : '—'],
            ['使用流程模板', templateName],
            ['当前阶段', plan.currentNode || '—'],
          ]}
        />

        {orders.length === 0 ? (
          <EmptyState>暂无交付子工单（请先在「管理设备」中绑定设备）</EmptyState>
        ) : (
          <div className="flex gap-4">
            {/* 左侧：子工单卡片列表（仅用于选择，不承载操作） */}
            <div className="w-64 flex-shrink-0 space-y-2 max-h-[52vh] overflow-y-auto pr-1">
              {orders.map((o) => {
                const active = selectedOrder && o.id === selectedOrder.id;
                const hasException = normalizeSubOrderStatus(o.status) === '存在异常';
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${active ? 'border-gray-900 bg-gray-50' : 'border-[#ececec] hover:bg-[#fafafa]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-gray-500 truncate">{o.id}</span>
                      {hasException && <span className="text-[11px] font-medium text-red-600 flex-shrink-0">异常</span>}
                    </div>
                    <div className="mt-1.5"><Chip tone="outline">{o.type}</Chip></div>
                    <div className="mt-1.5 font-mono text-[11px] text-gray-500 truncate">SN：{o.deviceSN}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={o.status} />
                      <span className="text-[11px] text-gray-400 truncate">{o.owner}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 右侧：选中子工单任务详情 + 状态化操作区 */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* 当前任务卡片 */}
              <div className="rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedOrder.status} />
                  <span className="text-xs text-gray-500">当前责任人：{selectedOrder.owner}</span>
                </div>
                <div className="text-[13px] text-gray-800">当前待处理动作：{phaseInfo?.action || '—'}</div>
                <div className="text-xs text-gray-500">下一步建议：{phaseInfo?.next || '—'}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {(phaseInfo?.ops || []).map((op) => (
                    op.to
                      ? <Btn key={op.label} as="link" to={op.to} size="sm">{op.label}</Btn>
                      : <Btn key={op.label} size="sm" onClick={() => runOp(op)}>{op.label}</Btn>
                  ))}
                </div>
              </div>

              {/* 子工单基础信息 */}
              <div>
                <div className="text-[13px] font-semibold text-gray-800 mb-2">子工单基础信息</div>
                <DescList
                  cols={2}
                  items={[
                    ['子工单编号', <span className="font-mono text-xs">{selectedOrder.id}</span>],
                    ['子工单类型', <Chip tone="outline">{selectedOrder.type}</Chip>],
                    ['关联设备 SN', <span className="font-mono text-xs">{selectedOrder.deviceSN}</span>],
                    ['所属交付计划', <span className="font-mono text-xs">{plan.id}</span>],
                    ['负责人 / 工程师', selectedOrder.owner],
                    ['预计上门时间', selectedOrder.eta],
                    ['实际上门时间', selectedOrder.actual],
                    ['最近更新时间', selectedOrder.updated],
                  ]}
                />
              </div>

              {/* 时间节点 */}
              <div>
                <div className="text-[13px] font-semibold text-gray-800 mb-2">时间节点</div>
                <DescList
                  cols={2}
                  items={[
                    ['预计上门时间', selectedOrder.eta],
                    ['实际上门时间', selectedOrder.actual],
                    ['最近更新时间', selectedOrder.updated],
                  ]}
                />
              </div>

              {/* 执行记录 / 交付资料 / 异常记录 / 关联问题（合成子工单无明细，给出清晰空态 + 跳转） */}
              <div className="space-y-3">
                <div>
                  <div className="text-[13px] font-semibold text-gray-800 mb-1">执行记录</div>
                  <div className="text-xs text-gray-400">暂无执行记录（详情见交付计划详情页对应子工单）</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-gray-800 mb-1">交付资料</div>
                  <div className="text-xs text-gray-400">暂无交付资料</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-gray-800 mb-1">异常记录</div>
                  <div className="text-xs text-gray-400">暂无交付异常</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-gray-800 mb-1">关联问题 · 售后工单</div>
                  <div className="text-xs text-gray-400">暂无关联问题池记录 / 售后工单</div>
                </div>
                <div className="pt-1">
                  <LinkAction to={`/delivery-plans/${plan.id}?node=subOrders`}>在交付计划详情中查看完整子工单 →</LinkAction>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">
          子工单由交付计划记录合成：{isZhimofang ? '智魔方含前置准备子工单，' : ''}按已绑定设备各生成一条机器人 / 设备部署子工单。左侧选择子工单，右侧按当前状态提供分派 / 接单 / 上门 / 现场执行 / 异常处理等操作，均为原型占位，完整流程请在交付计划详情页执行。
        </div>
        <div className="flex justify-end"><button onClick={onClose} className={BTN_PRIMARY}>完成</button></div>
      </div>
    </Modal>
  );
}

// 编辑交付计划：完整表单 + 只读已绑定设备列表，保存 dispatch UPDATE_DELIVERY_PLAN。
function EditDeliveryModal({ planId, state, dispatch, onClose, onToast }) {
  const plan = (state.deliveryPlans || []).find((p) => p.id === planId);
  const projects = state.projects || [];
  const devices = state.devices || [];
  const [form, setForm] = useState(() => ({
    projectId: plan?.projectId || '',
    templateName: plan?.templateName || '',
    batchNo: plan?.batchNo || '',
    owner: plan?.owner || '',
    targetCount: plan?.targetCount ?? 1,
    startDate: plan?.startDate || '',
    siteInstallDate: plan?.siteInstallDate || '',
    acceptanceDate: plan?.acceptanceDate || '',
    notes: plan?.notes || '',
  }));
  if (!plan) return null;

  const selProject = projects.find((p) => p.id === form.projectId);
  const boundDevices = deliveryBoundIds(plan).map((id) => devices.find((d) => d.id === id)).filter(Boolean);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const ownerOpts = [...new Set([...DELIVERY_OWNERS, plan.owner].filter(Boolean))];
  const ro = 'ui-input w-full bg-gray-50 text-gray-500';
  const lbl = 'block text-xs text-gray-500 mb-1';

  const submit = (e) => {
    e.preventDefault();
    dispatch({
      type: 'UPDATE_DELIVERY_PLAN',
      payload: {
        id: plan.id,
        projectId: form.projectId,
        templateName: form.templateName,
        batchNo: form.batchNo,
        owner: form.owner,
        targetCount: Number(form.targetCount || 0),
        startDate: form.startDate,
        siteInstallDate: form.siteInstallDate,
        acceptanceDate: form.acceptanceDate,
        dueDate: form.acceptanceDate || plan.dueDate,
        notes: form.notes,
        updatedAt: nowText(),
      },
    });
    onToast(`交付计划 ${plan.id} 已保存`);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="补充平台交付记录" size="xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl}>交付计划编号</label><input readOnly value={plan.id} className={ro} /></div>
          <div><label className={lbl}>当前状态</label><input readOnly value={deliveryPlanStatus(plan)} className={ro} /></div>
          <div>
            <label className={lbl}>所属项目</label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className="ui-input w-full">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className={lbl}>客户名称</label><input readOnly value={selProject?.client || '—'} className={ro} /></div>
          <div><label className={lbl}>项目类型 · 业务场景</label><input readOnly value={selProject?.projectType || '—'} className={ro} /></div>
          <div>
            <label className={lbl}>使用流程模板</label>
            <select value={form.templateName} onChange={(e) => set('templateName', e.target.value)} className="ui-input w-full">
              <option value="">-- 请选择 --</option>
              <option>智魔方交付流程模板</option>
              <option>通用部署流程模板</option>
            </select>
          </div>
          <div><label className={lbl}>交付批次</label><input value={form.batchNo} onChange={(e) => set('batchNo', e.target.value)} className="ui-input w-full" /></div>
          <div>
            <label className={lbl}>负责人</label>
            <select value={form.owner} onChange={(e) => set('owner', e.target.value)} className="ui-input w-full">
              <option value="">-- 请选择 --</option>
              {ownerOpts.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div><label className={lbl}>计划交付数量</label><input type="number" min={0} value={form.targetCount} onChange={(e) => set('targetCount', e.target.value)} className="ui-input w-full" /></div>
          <div><label className={lbl}>计划开始时间</label><input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="ui-input w-full" /></div>
          <div><label className={lbl}>计划现场安装调试时间</label><input type="date" value={form.siteInstallDate} onChange={(e) => set('siteInstallDate', e.target.value)} className="ui-input w-full" /></div>
          <div><label className={lbl}>计划客户验收时间</label><input type="date" value={form.acceptanceDate} onChange={(e) => set('acceptanceDate', e.target.value)} className="ui-input w-full" /></div>
          <div className="col-span-2"><label className={lbl}>备注</label><textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className="ui-input w-full" /></div>
        </div>

        <div>
          <div className="text-[13px] font-semibold text-gray-800 mb-2">已绑定设备（只读，{boundDevices.length}）</div>
          <Table head={['设备SN', '机器人型号', '当前状态', '所属生产计划', '出厂检验状态']} empty="暂无已绑定设备">
            {boundDevices.map((d) => (
              <tr key={d.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{d.sn}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{deviceTypeName(state, d.deviceTypeId)}</td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{prodPlanName(state, d.productionPlanId)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{inspectBadge(d.erpInspectionStatus)}</td>
              </tr>
            ))}
          </Table>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className={BTN_PRIMARY}>保存</button>
        </div>
      </form>
    </Modal>
  );
}

// 作废交付计划：确认弹窗，dispatch UPDATE_DELIVERY_PLAN(status:'已作废')。
function VoidDeliveryModal({ planId, state, dispatch, onClose, onToast }) {
  const plan = (state.deliveryPlans || []).find((p) => p.id === planId);
  const project = (state.projects || []).find((p) => p.id === plan?.projectId);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  if (!plan) return null;

  const submit = (e) => {
    e.preventDefault();
    dispatch({
      type: 'UPDATE_DELIVERY_PLAN',
      payload: {
        id: plan.id,
        status: '已作废',
        voided: true,
        voidReason: reason,
        voidNote: note,
        voidedBy: state.currentUser,
        voidedAt: nowText(),
        updatedAt: nowText(),
      },
    });
    onToast(`交付计划 ${plan.id} 已作废`);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="作废交付计划">
      <form onSubmit={submit} className="space-y-4">
        <DescList
          cols={2}
          items={[
            ['交付计划编号', <span className="font-mono text-xs">{plan.id}</span>],
            ['所属项目', project?.name || '—'],
            ['当前状态', <StatusBadge status={deliveryPlanStatus(plan)} />],
            ['操作人', state.currentUser],
            ['操作时间', nowText()],
          ]}
        />
        <div>
          <label className="block text-xs text-gray-500 mb-1">作废原因 *</label>
          <select required value={reason} onChange={(e) => setReason(e.target.value)} className="ui-input w-full">
            <option value="">-- 请选择 --</option>
            {DELIVERY_VOID_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">作废说明</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="补充作废说明（可选）" className="ui-input w-full" />
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded p-3 text-xs text-amber-700">作废后交付计划状态变为「已作废」，操作时间将在提交时生成，历史记录仍保留。</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700">确认作废</button>
        </div>
      </form>
    </Modal>
  );
}

// 操作日志：由计划记录合成时间线 + 关联 operationLogs，复用 OperationLog 组件。
function DeliveryLogsModal({ planId, state, onClose }) {
  const plan = (state.deliveryPlans || []).find((p) => p.id === planId);
  const devices = state.devices || [];
  if (!plan) return null;

  const snOf = (id) => devices.find((d) => d.id === id)?.sn || id;
  const recs = plan.records || {};
  const boundIds = deliveryBoundIds(plan);
  const synth = [{
    id: `L-${plan.id}-create`,
    timestamp: recs.binding?.[0]?.time || plan.factoryDate || plan.updatedAt || nowText(),
    actionType: '创建交付计划',
    operator: plan.owner || '系统',
    notes: `交付计划 ${plan.name || plan.id} 创建，计划交付 ${plan.targetCount || 0} 台`,
  }];
  (recs.binding || []).forEach((r) => synth.push({ id: `L-b-${r.id}`, timestamp: r.time, actionType: '绑定设备', operator: r.operator, notes: `绑定设备 ${snOf(r.deviceId)}` }));
  (recs.factoryInspection || []).forEach((r) => synth.push({ id: `L-f-${r.id}`, timestamp: r.time, actionType: '出厂检验', operator: r.operator, notes: `${r.deviceSN || snOf(r.deviceId)} 出厂检验 ${r.result}${r.notes ? ` · ${r.notes}` : ''}` }));
  (recs.siteInstall || []).forEach((r) => synth.push({ id: `L-s-${r.id}`, timestamp: r.time, actionType: '现场安装调试', operator: r.operator, notes: `${r.deviceSN || snOf(r.deviceId)} 现场安装调试 ${r.result}${r.notes ? ` · ${r.notes}` : ''}` }));
  (recs.customerAccept || []).forEach((r) => synth.push({ id: `L-c-${r.id}`, timestamp: r.time, actionType: '客户验收', operator: r.operator, notes: `${r.deviceSN || snOf(r.deviceId)} 客户验收 ${r.result}` }));
  if (plan.voided) synth.push({ id: `L-v-${plan.id}`, timestamp: plan.voidedAt || nowText(), actionType: '作废交付计划', operator: plan.voidedBy || state.currentUser, fromStatus: '交付中', toStatus: '已作废', notes: plan.voidReason || '—' });
  const real = (state.operationLogs || []).filter((l) => l.deliveryPlanId === plan.id || boundIds.includes(l.deviceId));
  const logs = [...synth, ...real];

  return (
    <Modal isOpen onClose={onClose} title="交付计划操作日志" size="lg">
      <div className="space-y-3">
        <DescList
          cols={2}
          items={[
            ['交付计划编号', <span className="font-mono text-xs">{plan.id}</span>],
            ['日志条数', `${logs.length} 条`],
          ]}
        />
        <OperationLog logs={logs} />
      </div>
    </Modal>
  );
}

/* ═════════ 交付计划 ═════════ */
function DeliveryPlanTab() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ keyword: '', projectId: '', status: '', node: '', owner: '', delayed: '' });
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [selectErpOpen, setSelectErpOpen] = useState(false);
  const [selectErpNo, setSelectErpNo] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  const openModal = (type, planId) => setModal({ type, planId });
  const projects = state.projects || [];
  const erpServiceNos = [...new Set((state.deliveryPlans || []).map((p) => p.erpOutboundNo).filter(Boolean))];

  const enriched = (state.deliveryPlans || []).map((plan) => {
    const project = projects.find((p) => p.id === plan.projectId);
    const bindingCount = plan.boundDeviceIds?.length || plan.records?.binding?.length || 0;
    const accepted = (plan.records?.customerAccept || []).filter(isPass).length;
    return {
      ...plan,
      status: deliveryPlanStatus(plan),
      projectName: project?.name || '—',
      owner: plan.owner || project?.manager || '—',
      currentNode: plan.currentNode || (accepted > 0 ? '客户验收' : (plan.records?.siteInstall || []).length > 0 ? '现场安装调试' : (plan.records?.factoryInspection || []).length > 0 ? '出厂检验' : '绑定设备'),
      bindingCount,
      accepted,
    };
  });

  const owners = [...new Set(enriched.map((p) => p.owner).filter((o) => o && o !== '—'))];

  const filtered = enriched.filter((plan) => {
    const kw = filters.keyword.trim().toLowerCase();
    return (!kw || plan.id.toLowerCase().includes(kw) || plan.projectName.toLowerCase().includes(kw))
      && (!filters.projectId || plan.projectId === filters.projectId)
      && (!filters.status || plan.status === filters.status)
      && (!filters.node || plan.currentNode === filters.node)
      && (!filters.owner || plan.owner === filters.owner)
      && (!filters.delayed || (filters.delayed === 'yes' ? plan.status === '已延期' : plan.status !== '已延期'));
  });
  const paged = usePaged(filtered, 10);

  const stop = (e) => e.stopPropagation();
  const delayedCount = enriched.filter((p) => p.status === '已延期').length;

  return (
    <Page>
      <PageHeader
        title="交付执行"
        description="平台不新建 ERP 服务交付。此处选择 ERP 服务交付并补充现场部署、设备绑定、异常与售后关联。"
        actions={<Btn variant="primary" onClick={() => setSelectErpOpen(true)}>选择 ERP 服务交付</Btn>}
      />

      <FlowBar steps={['选择 ERP 服务交付', '绑定交付设备', '记录现场执行', '上传交付资料', '记录交付异常', '提交问题池 / 关联售后工单']} />

      <StatGrid cols={4}>
        <StatCard label="计划总数" value={enriched.length} />
        <StatCard label="交付中" value={enriched.filter((p) => p.status === '交付中').length} />
        <StatCard label="已验收" value={enriched.filter((p) => p.status === '已验收').length} tone="success" />
        <StatCard label="延期计划" value={delayedCount} tone={delayedCount ? 'danger' : 'default'} />
      </StatGrid>

      <Toolbar>
        <SearchInput className="w-56" placeholder="交付计划ID / 项目名称" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
        <Select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
          <option value="">所属项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部状态</option>{DELIVERY_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={filters.node} onChange={(e) => setFilters({ ...filters, node: e.target.value })}>
          <option value="">当前阶段</option>{DELIVERY_NODES.map((n) => <option key={n}>{n}</option>)}
        </Select>
        <Select value={filters.owner} onChange={(e) => setFilters({ ...filters, owner: e.target.value })}>
          <option value="">全部负责人</option>{owners.map((o) => <option key={o}>{o}</option>)}
        </Select>
        <Select value={filters.delayed} onChange={(e) => setFilters({ ...filters, delayed: e.target.value })}>
          <option value="">是否延期</option>
          <option value="yes">已延期</option>
          <option value="no">未延期</option>
        </Select>
      </Toolbar>

      <Table
        head={['交付计划ID', '所属项目', '交付批次', '计划交付数量', '已绑定设备数', '计划出厂时间', '计划现场安装调试时间', '计划客户验收时间', '主要阶段', '状态', '负责人', '操作']}
        empty="暂无匹配交付计划"
        footer={<Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} />}
      >
        {paged.pageItems.map((plan) => (
          <tr key={plan.id} onClick={() => navigate(`/delivery-plans/${plan.id}`)} className="hover:bg-[#fafafa] cursor-pointer">
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{plan.id}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{plan.projectName}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{plan.batchNo || plan.name}</td>
            <td className="px-3 py-2 text-gray-600">{plan.targetCount}</td>
            <td className="px-3 py-2 text-gray-600">{plan.bindingCount}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.factoryDate || plan.dueDate || '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.siteInstallDate || '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.acceptanceDate || plan.dueDate || '—'}</td>
            <td className="px-3 py-2"><StatusBadge status={plan.currentNode} /></td>
            <td className="px-3 py-2"><StatusBadge status={plan.status} /></td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{plan.owner}</td>
            <td className="px-3 py-2 text-xs whitespace-nowrap" onClick={stop}>
              <div className="flex items-center gap-x-3">
                <LinkAction onClick={() => navigate(`/delivery-plans/${plan.id}`)}>查看详情</LinkAction>
                <LinkAction to="/erp-center?tab=outbound">查看 ERP 源单据</LinkAction>
                <LinkAction onClick={() => openModal('devices', plan.id)}>管理交付设备</LinkAction>
                <LinkAction onClick={() => openModal('subOrders', plan.id)}>管理子工单</LinkAction>
                <LinkAction onClick={() => openModal('edit', plan.id)}>补充平台交付记录</LinkAction>
                <LinkAction onClick={() => navigate(`/delivery-plans/${plan.id}`)}>记录交付异常</LinkAction>
                {!['已验收', '已作废'].includes(plan.status) && (
                  <LinkAction onClick={() => openModal('void', plan.id)}>作废</LinkAction>
                )}
                <LinkAction onClick={() => openModal('logs', plan.id)}>查看日志</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {modal?.type === 'devices' && <ManageDeliveryDevicesModal planId={modal.planId} state={state} dispatch={dispatch} onClose={() => setModal(null)} onToast={showToast} />}
      {modal?.type === 'subOrders' && <ManageDeliverySubOrdersModal planId={modal.planId} state={state} onClose={() => setModal(null)} onToast={showToast} />}
      {modal?.type === 'edit' && <EditDeliveryModal planId={modal.planId} state={state} dispatch={dispatch} onClose={() => setModal(null)} onToast={showToast} />}
      {modal?.type === 'void' && <VoidDeliveryModal planId={modal.planId} state={state} dispatch={dispatch} onClose={() => setModal(null)} onToast={showToast} />}
      {modal?.type === 'logs' && <DeliveryLogsModal planId={modal.planId} state={state} onClose={() => setModal(null)} />}

      {selectErpOpen && (
        <Modal isOpen onClose={() => setSelectErpOpen(false)} title="选择 ERP 服务交付">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700">请在 ERP 中维护服务交付单，平台在此选择已同步的 ERP 服务交付建立关联并补充交付执行记录。</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择已同步的 ERP 服务交付</label>
              <select value={selectErpNo} onChange={(e) => setSelectErpNo(e.target.value)} className={`${INPUT} w-full`}>
                <option value="">-- 请选择 --</option>
                {erpServiceNos.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSelectErpOpen(false)} className={BTN_GHOST}>取消</button>
              <button
                type="button"
                onClick={() => {
                  if (!selectErpNo) { showToast('请先选择 ERP 服务交付'); return; }
                  showToast(`已选择 ERP 服务交付 ${selectErpNo} 建立关联（原型演示）`);
                  setSelectErpOpen(false);
                  setSelectErpNo('');
                }}
                className={BTN_PRIMARY}
              >确认关联</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white text-[13px] px-4 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </Page>
  );
}

export default function ProjectsCenter() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'list';
  const activeTab = TABS.some((t) => t.key === tab) ? tab : 'list';

  return (
    <>
      {activeTab === 'list' && <ProjectListTab />}
      {activeTab === 'production' && <ProductionPlanTab />}
      {activeTab === 'delivery' && <DeliveryPlanTab />}
    </>
  );
}
