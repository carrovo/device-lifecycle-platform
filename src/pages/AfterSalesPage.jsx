import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Card, Toolbar, Input, Select, SearchInput,
  Btn, LinkAction, Chip, StatCard, StatGrid, DescList, EmptyState, Table,
} from '../components/ui';
import { FEISHU_USERS } from '../data/mockData';

/* ═══════════════════════════════════════════════════════════════════
   售后管理：问题池（issues） / 售后工单（orders） / 换件记录（replacements）
   平台链路：交付异常/扫码上报/系统告警 → 问题池（技术客服预处理） → 转售后工单（现场执行闭环）。
   ─ 状态词在页面做「展示态映射」，不改动 mockData 原始状态值；缺字段回退 '—'。
   ═══════════════════════════════════════════════════════════════════ */

const ISSUE_TYPES = ['使用问题', '设备质量问题'];
const WO_STATUS_LIST = ['待分派', '待接单', '待上门', '现场处理中', '已关单', '已取消'];
// 问题池只用这 6 个状态
const QI_STATUS_LIST = ['待预处理', '预处理中', '待补充信息', '远程已解决', '已转售后工单', '已关闭'];
// 来源类型
const QI_SOURCES = ['扫码上报', '系统告警', '交付异常', '手动录入', '问题平台上报'];
const ORDER_SOURCES = ['问题池转入', '交付子工单转入', '售后直接创建'];
const MOREINFO_TARGETS = ['交付工程师', '客户', '现场人员', '工程师'];
const SEVERITIES = ['高', '中', '低'];
const YN = ['是', '否'];

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const genId = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;
const TA = 'w-full border border-[#e0e0e0] rounded-md px-2.5 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#a3a3a3] focus:ring-2 focus:ring-gray-100';
const yn = (v) => (v == null ? '—' : (v ? '是' : '否'));

// 问题池状态规范化：兼容旧值（待处理→待预处理、处理中→预处理中、已远程关闭→远程已解决）。
function normalizeIssueStatus(qi) {
  const s = qi && qi.status;
  if (QI_STATUS_LIST.includes(s)) return s;
  if (qi && (qi.linkedWorkOrder || qi.linkedWorkOrderId)) return '已转售后工单';
  const map = { 待处理: '待预处理', 处理中: '预处理中', 已远程关闭: '远程已解决', 已解决: '远程已解决' };
  return map[s] || s || '待预处理';
}

// 售后工单状态展示映射：把旧状态映射为统一的 6 个新状态词。
function displayWoStatus(wo) {
  const s = wo && wo.status;
  if (WO_STATUS_LIST.includes(s)) return s;
  if (s === '待处理') return wo.assignedTo ? '待接单' : '待分派';
  if (s === '处理中' || s === '复检中') return '现场处理中';
  if (s === '已关闭') return '已关单';
  if (s === '已作废') return '已取消';
  return s || '—';
}

/* ── 时长计算（缺失回退 '—'）─────────────────────────── */
const parseTime = (s) => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};
function durationText(from, to) {
  const a = parseTime(from);
  const b = parseTime(to);
  if (!a || !b) return '—';
  let m = Math.round((b - a) / 60000);
  if (m < 0) return '—';
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return `${h} 小时${mm ? ` ${mm} 分` : ''}`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return `${d} 天${hh ? ` ${hh} 小时` : ''}`;
}

/* ── 关联数据解析（只读，缺字段回退 '—'）───────────────────────── */
const findProject = (state, id) => (state.projects || []).find((p) => p.id === id) || null;
const findDeviceOf = (state, ref) => (state.devices || []).find((d) => d.id === ref.deviceId || d.sn === ref.deviceSN) || null;
function locationOfDevice(state, device) {
  if (!device) return null;
  const locs = state.locations || [];
  const id = device.locationId || device.preAssignedLocationId;
  return (id && locs.find((l) => l.id === id)) || locs.find((l) => (l.deviceIds || []).includes(device.id)) || null;
}
const locById = (state, id) => (state.locations || []).find((l) => l.id === id) || null;
const locLabel = (loc) => (loc ? [loc.name, loc.address].filter(Boolean).join(' · ') : '—');
const materialOf = (state, id) => (state.materials || []).find((m) => m.id === id) || null;
// 来源问题编号：优先工单自带，其次从质量问题反查 linkedWorkOrderId。
const sourceIssueIdOf = (state, wo) =>
  wo.sourceIssueId || wo.sourceQualityIssueId || wo.linkedQualityIssueId ||
  ((state.qualityIssues || []).find((q) => q.linkedWorkOrderId === wo.id) || {}).id || null;
const allWorkOrders = (state) => [
  ...(state.deliveryWorkOrders || []).map((w) => ({ ...w, _kind: 'delivery' })),
  ...(state.workOrders || []).map((w) => ({ ...w, _kind: 'aftersales' })),
];
// 售后工单来源标签：问题池转入 / 交付子工单转入 / 售后直接创建。
function orderSourceLabel(state, wo) {
  if (wo.source) return wo.source;
  if (wo._kind === 'delivery') return '交付子工单转入';
  if (sourceIssueIdOf(state, wo)) return '问题池转入';
  return '售后直接创建';
}
const engineerOptions = () => FEISHU_USERS.map((u) => (
  <option key={u.id} value={u.name}>{u.name}（{u.dept}）</option>
));

/* ── 通用小部件 ─────────────────────────────────────────────── */
function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}

function ModalActions({ onClose, onConfirm, disabled, confirmLabel = '确认', variant = 'primary' }) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      <Btn variant="secondary" onClick={onClose}>取消</Btn>
      <Btn variant={variant} onClick={onConfirm} disabled={disabled}>{confirmLabel}</Btn>
    </div>
  );
}

// 只读原始信息条（来源快照片段，编辑弹窗内提示技术客服不要覆盖来源）。
function ReadonlyNote({ items }) {
  return (
    <Card className="bg-[#fafafa] space-y-1.5">
      <div className="flex items-center gap-2"><Chip>来源只读</Chip><span className="text-xs text-gray-400">来源快照不被规范化覆盖</span></div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map(([k, v], i) => (
          <div key={i} className="flex gap-2 text-xs"><dt className="text-gray-400 flex-shrink-0">{k}</dt><dd className="text-gray-600 break-words">{v || '—'}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

// 右侧宽抽屉：分区详情 + 可执行操作台 + 操作日志。
function Drawer({ open, onClose, title, subtitle, chips, children, bodyRef }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl border-l border-[#ececec] flex flex-col">
        <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-gray-900 font-mono truncate">{title}</div>
            {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
            {chips && <div className="mt-2 flex flex-wrap items-center gap-2">{chips}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md w-7 h-7 flex items-center justify-center text-xl leading-none flex-shrink-0 transition-colors">×</button>
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

function DrawerSection({ title, children, id }) {
  return (
    <div id={id}>
      <div className="text-xs font-semibold text-gray-500 mb-2">{title}</div>
      {children}
    </div>
  );
}

/* ── 任务型分层：当前任务卡片 / 分区 tab / 角色视角 ─────────────────
   把强详情从「平铺字段」改为「顶部当前任务卡片 + 分区 tab + 角色视角」。 */

// SLA·超时占位提示：由起始时间与当前时间派生停留时长（原型占位，非真实 SLA 阈值）。
function slaHint(from, active) {
  if (!active) return null;
  const a = parseTime(from);
  if (!a) return { text: '进入时间未知（SLA 占位）', tone: 'default' };
  const over = (Date.now() - a.getTime()) > 48 * 3600 * 1000;
  const dur = durationText(from, nowText());
  return { text: `已停留 ${dur}${over ? ' · 超 48h（SLA 占位提示）' : '（SLA 占位）'}`, tone: over ? 'warning' : 'default' };
}

// 顶部当前任务卡片：醒目呈现当前状态 / 责任人 / 待处理动作 / 下一步建议 / SLA + 可执行操作。
function TaskCard({ status, ownerLabel = '当前责任人', owner, pending, nextStep, sla, actions }) {
  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">当前任务</span>
          <StatusBadge status={status} />
          <span className="text-xs text-gray-500">{ownerLabel}：<span className="text-gray-800 font-medium">{owner || '—'}</span></span>
        </div>
        {sla && <span className={`text-xs rounded-md border px-2 py-0.5 whitespace-nowrap ${sla.tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-500'}`}>SLA · {sla.text}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        <div><div className="text-xs text-gray-400">当前待处理动作</div><div className="text-[13px] text-gray-800 mt-0.5">{pending || '—'}</div></div>
        <div><div className="text-xs text-gray-400">下一步建议</div><div className="text-[13px] text-gray-800 mt-0.5">{nextStep || '—'}</div></div>
      </div>
      {actions && <div className="pt-0.5">{actions}</div>}
    </div>
  );
}

// 抽屉内分区 tab 条（信息架构分层导航）。
function DrawerTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#f0f0f0] overflow-x-auto">
      {tabs.map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${active === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{t}</button>
      ))}
    </div>
  );
}

// 角色视角轻量切换（纯 UI 分组，不接权限）：切换只改变默认定位的分区与说明。
function RoleViewTabs({ roles, active, onChange, label = '角色视角' }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="inline-flex rounded-md border border-[#e0e0e0] bg-gray-50 p-0.5">
        {roles.map((r) => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${active === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{r}</button>
        ))}
      </div>
    </div>
  );
}

// 按当前状态派生「待处理动作 / 下一步建议」（问题池 / 售后工单）。
const ISSUE_TASK = {
  待预处理: { pending: '待指派技术客服 / 开始预处理', next: '指派技术客服后开始预处理并规范化问题' },
  预处理中: { pending: '技术客服预处理、规范化中', next: '可远程解决则远程关闭，否则转售后工单' },
  待补充信息: { pending: '等待补充信息', next: '补充后回到预处理中继续处理' },
  远程已解决: { pending: '已远程解决，待确认闭环', next: '确认无误后关闭问题' },
  已转售后工单: { pending: '已转售后工单，由现场执行闭环', next: '跟进关联售后工单进度' },
  已关闭: { pending: '问题已关闭', next: '仅可查看处理记录与日志' },
};
// 问题池详情：流程信息分区 tab（用于组织信息，不表达权限）。
const ISSUE_TABS = ['当前处理', '来源信息', '技术客服预处理', '售后执行', '时间节点与日志'];
// 权限模拟角色（交付侧统一为「交付执行人员」，不拆分负责人 / 工程师为独立权限角色）。
const ISSUE_SIM_ROLES = ['交付执行人员', '技术客服', '售后 leader', '售后工程师', '管理者'];
// 各角色进入问题详情默认打开的 tab。
const ISSUE_ROLE_DEFAULT_TAB = {
  技术客服: '当前处理', 交付执行人员: '来源信息', '售后 leader': '售后执行', 售后工程师: '售后执行', 管理者: '时间节点与日志',
};
// 角色说明（顶部提示，仅 UI 模拟，不接真实登录权限系统）。
const ISSUE_ROLE_DESC = {
  技术客服: '技术客服：规范化问题、预处理与分流（远程关闭 / 转售后工单）。',
  交付执行人员: '交付执行人员：查看来源交付信息、补充现场信息、上传交付资料、查看处理与售后状态；不可编辑规范化字段与预处理结论。',
  '售后 leader': '售后 leader：查看预处理结论、分派 / 改派售后工程师、关注 SLA 与工单进度。',
  售后工程师: '售后工程师：查看预处理建议与现场处理要求，现场执行在售后工单内闭环。',
  管理者: '管理者：查看全流程时间节点、SLA、责任人与操作日志（默认只读）。',
};
// 操作标签。
const ISSUE_OP_LABEL = {
  assign: '指派技术客服', start: '开始预处理', edit: '编辑规范化', progress: '更新预处理记录',
  moreinfo: '请求补充信息', remoteclose: '远程关闭', toworkorder: '转售后工单', closeissue: '关闭问题',
  supplement: '补充信息', supplementSite: '补充现场信息', uploadSite: '上传现场资料',
  viewStatus: '查看处理状态', viewCS: '查看技术客服反馈', viewPre: '查看预处理进展',
  viewRecord: '查看处理记录', viewLog: '查看日志', viewSLA: '查看 SLA',
  viewWO: '查看售后工单', dispatchWO: '分派 / 改派工程师', viewAS: '查看售后状态摘要',
};
// 需写权限的操作（受全局 canDo('update_quality_issue') 约束）。
const ISSUE_WRITE_OPS = new Set(['assign', 'start', 'edit', 'progress', 'moreinfo', 'remoteclose', 'toworkorder', 'closeissue', 'supplement', 'supplementSite', 'uploadSite', 'dispatchWO']);
const ISSUE_PRIMARY_OPS = new Set(['start', 'toworkorder', 'closeissue', 'supplement', 'supplementSite', 'dispatchWO']);
const ISSUE_LINK_OPS = new Set(['viewWO', 'dispatchWO']);
// [问题状态][登录角色] => 可执行操作 opKey 列表（权限通过操作可见性体现）。
const ISSUE_OPS = {
  待预处理: {
    技术客服: ['assign', 'start'], 交付执行人员: ['viewStatus', 'supplementSite'],
    '售后 leader': ['viewSLA', 'viewLog'], 售后工程师: ['viewLog'], 管理者: ['viewSLA', 'viewLog'],
  },
  预处理中: {
    技术客服: ['edit', 'progress', 'moreinfo', 'remoteclose', 'toworkorder'], 交付执行人员: ['supplement', 'viewCS'],
    '售后 leader': ['viewPre'], 售后工程师: ['viewPre'], 管理者: ['viewSLA', 'viewLog'],
  },
  待补充信息: {
    技术客服: ['progress', 'remoteclose', 'toworkorder'], 交付执行人员: ['supplementSite', 'uploadSite'],
    '售后 leader': ['viewPre'], 售后工程师: ['viewPre'], 管理者: ['viewSLA', 'viewLog'],
  },
  远程已解决: {
    技术客服: ['viewRecord', 'closeissue'], 交付执行人员: ['viewRecord'],
    '售后 leader': ['viewRecord'], 售后工程师: ['viewRecord'], 管理者: ['viewSLA', 'viewLog'],
  },
  已转售后工单: {
    技术客服: ['viewWO', 'viewRecord'], 交付执行人员: ['viewAS'],
    '售后 leader': ['viewWO', 'dispatchWO'], 售后工程师: ['viewWO', 'viewAS'], 管理者: ['viewSLA', 'viewLog'],
  },
  已关闭: {
    技术客服: ['viewRecord', 'viewLog'], 交付执行人员: ['viewRecord'],
    '售后 leader': ['viewRecord'], 售后工程师: ['viewRecord'], 管理者: ['viewRecord', 'viewLog'],
  },
};
// 售后工单详情分区 tab（任务型分区，避免一屏长字段堆叠）。
const ORDER_TABS = ['当前处理', '来源与预处理', '现场执行', '换件与领料', '附件与关单', '时间节点与日志'];
const ORDER_TASK = {
  待分派: { pending: '待分派工程师', next: '分派工程师后进入待接单' },
  待接单: { pending: '工程师待接单（可改派）', next: '接单后确认上门时间' },
  待上门: { pending: '待确认上门时间', next: '确认到场后进入现场处理' },
  现场处理中: { pending: '现场处理中', next: '记录现场处理 / 发起换件 / 上传资料，完成后关单' },
  已关单: { pending: '工单已闭环', next: '如需追溯可查看资料与日志' },
  已取消: { pending: '工单已取消', next: '仅可查看日志' },
};

function TextBlock({ children }) {
  return <div className="text-[13px] text-gray-800 leading-relaxed bg-[#fafafa] border border-[#f0f0f0] rounded-md p-3">{children || '—'}</div>;
}

function LogTimeline({ logs }) {
  if (!logs || logs.length === 0) return <EmptyState>暂无操作日志</EmptyState>;
  return (
    <ol className="space-y-3">
      {logs.map((log, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
            {i < logs.length - 1 && <span className="w-px flex-1 bg-[#ececec] mt-1" />}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
              <span>{log.time}</span>
              <span className="font-medium text-gray-600">{log.operator}</span>
              {log.fromStatus && <><StatusBadge status={log.fromStatus} /><span className="text-gray-300">→</span><StatusBadge status={log.toStatus} /></>}
            </div>
            {log.notes && <div className="text-[13px] text-gray-700 mt-1">{log.notes}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// 行内操作组：按状态渲染的一批文字操作。
function ActionCell({ children }) {
  return <div className="flex items-center gap-x-2.5 whitespace-nowrap">{children}</div>;
}

/* 通用「填写原因」弹窗（取消 / 重新打开等） */
function ReasonModal({ title, label = '原因', placeholder, confirmLabel = '确认', variant = 'primary', requireConfirm = false, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [ok, setOk] = useState(!requireConfirm);
  return (
    <Modal isOpen onClose={onClose} title={title}>
      <div className="space-y-3">
        <Field label={label} required>
          <textarea rows={3} className={TA} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
        </Field>
        {requireConfirm && (
          <label className="flex items-center gap-2 text-[13px] text-gray-600">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> 我已确认此操作（二次确认）
          </label>
        )}
        <ModalActions onClose={onClose} onConfirm={() => onConfirm(reason.trim())} disabled={!reason.trim() || !ok} confirmLabel={confirmLabel} variant={variant} />
      </div>
    </Modal>
  );
}

/* ═════════════════════════ 售后工单：动作弹窗 ═════════════════════════ */
function NewOrderModal({ state, onClose, onSave }) {
  const { projects = [], devices = [] } = state;
  const [form, setForm] = useState({ projectId: '', deviceId: '', description: '', severity: '中', engineer: '' });
  const projDevices = form.projectId ? devices.filter((d) => d.projectId === form.projectId) : devices;
  const device = devices.find((d) => d.id === form.deviceId);
  const submit = () => {
    const t = nowText();
    onSave({
      id: genId('WO'), type: 'aftersales', woClass: '其他问题工单', involvesReplacement: false,
      source: '售后直接创建', projectId: form.projectId || null, deviceId: form.deviceId, deviceSN: device?.sn || '', stage: '在线运营',
      description: form.description, severity: form.severity, status: form.engineer ? '待接单' : '待分派', assignedTo: form.engineer,
      createTime: t, createdAt: t, updatedAt: t, closedAt: null, processLogs: [{ time: t, operator: '售后创建', toStatus: form.engineer ? '待接单' : '待分派', notes: '售后直接创建工单' }],
    });
    onClose();
  };
  return (
    <Modal isOpen onClose={onClose} title="新增售后工单" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="关联项目" required>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, deviceId: '' })} className="w-full">
              <option value="">-- 选择项目 --</option>
              {projects.filter((p) => !p.voided).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="设备 SN" required>
            <Select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} className="w-full">
              <option value="">-- 选择设备 --</option>
              {projDevices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
            </Select>
          </Field>
          <Field label="严重程度">
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full">
              {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="工程师">
            <Select value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} className="w-full">
              <option value="">-- 待分派 --</option>
              {engineerOptions()}
            </Select>
          </Field>
        </div>
        <Field label="故障描述" required>
          <textarea rows={3} className={TA} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述设备故障现象" />
        </Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">售后直接创建的工单默认「待分派」；分派工程师后进入「待接单」，到场后「现场处理中」，处理完成后关单。</Card>
        <ModalActions onClose={onClose} onConfirm={submit} disabled={!form.projectId || !form.deviceId || !form.description.trim()} confirmLabel="创建工单" />
      </div>
    </Modal>
  );
}

// 1 分派 / 改派工程师
function DispatchEngineerModal({ wo, reassign, onClose, onConfirm }) {
  const [leader, setLeader] = useState(wo.leader || '');
  const [engineer, setEngineer] = useState(wo.assignedTo || '');
  const [expectVisit, setExpectVisit] = useState(wo.expectVisitTime || wo.expectVisitAt || '');
  const [note, setNote] = useState('');
  return (
    <Modal isOpen onClose={onClose} title={reassign ? '改派工程师' : '分派工程师'}>
      <div className="space-y-3">
        <div className="text-[13px] text-gray-500">工单号：<span className="font-mono text-gray-700">{wo.id}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="服务 leader"><Select value={leader} onChange={(e) => setLeader(e.target.value)} className="w-full"><option value="">-- 选择 leader --</option>{engineerOptions()}</Select></Field>
          <Field label="工程师" required><Select value={engineer} onChange={(e) => setEngineer(e.target.value)} className="w-full"><option value="">-- 选择工程师 --</option>{engineerOptions()}</Select></Field>
          <Field label="预计上门时间"><Input value={expectVisit} onChange={(e) => setExpectVisit(e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
          <Field label="leader 分派时间"><Input disabled value={nowText()} className="w-full bg-gray-50 text-gray-400" /></Field>
        </div>
        <Field label="分派说明"><textarea rows={2} className={TA} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ leader, engineer, expectVisit, note })} disabled={!engineer} confirmLabel={reassign ? '确认改派' : '确认分派'} />
      </div>
    </Modal>
  );
}

// 2 确认上门时间（待上门 → 现场处理中）
function ConfirmVisitModal({ wo, onClose, onConfirm }) {
  const [expectVisit, setExpectVisit] = useState(wo.expectVisitTime || wo.expectVisitAt || '');
  const [acceptTime, setAcceptTime] = useState(wo.acceptTime || wo.acceptAt || nowText());
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="确认上门时间">
      <div className="space-y-3">
        <div className="text-[13px] text-gray-500">工程师：<span className="text-gray-700">{wo.assignedTo || '—'}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="预计上门时间"><Input value={expectVisit} onChange={(e) => setExpectVisit(e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
          <Field label="接单时间"><Input value={acceptTime} onChange={(e) => setAcceptTime(e.target.value)} className="w-full" /></Field>
          <Field label="现场联系人"><Input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full" /></Field>
          <Field label="联系电话"><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" /></Field>
        </div>
        <Field label="备注"><textarea rows={2} className={TA} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">确认到场后工单转入「现场处理中」。</Card>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ expectVisit, acceptTime, contact, phone, note })} confirmLabel="确认到场" />
      </div>
    </Modal>
  );
}

// 3 记录现场处理
function RecordOnsiteModal({ wo, currentUser, onClose, onConfirm }) {
  const [start, setStart] = useState(wo.onsiteStartTime || nowText());
  const [done, setDone] = useState(wo.onsiteDoneTime || '');
  const [record, setRecord] = useState(wo.onsiteRecord || '');
  const [fault, setFault] = useState(wo.actualFault || '');
  const [solution, setSolution] = useState(wo.actualSolution || wo.repairActions || '');
  const [needReplace, setNeedReplace] = useState(wo.needReplace ? '是' : '否');
  const [person, setPerson] = useState(wo.assignedTo || currentUser);
  return (
    <Modal isOpen onClose={onClose} title="记录现场处理" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="现场处理开始时间"><Input value={start} onChange={(e) => setStart(e.target.value)} className="w-full" /></Field>
          <Field label="现场处理完成时间"><Input value={done} onChange={(e) => setDone(e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
        </div>
        <Field label="现场处理说明" required><textarea rows={2} className={TA} value={record} onChange={(e) => setRecord(e.target.value)} placeholder="记录现场检修 / 处理过程" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="实际故障原因"><Input value={fault} onChange={(e) => setFault(e.target.value)} className="w-full" /></Field>
          <Field label="实际处理方案"><Input value={solution} onChange={(e) => setSolution(e.target.value)} className="w-full" /></Field>
          <Field label="是否需换件"><Select value={needReplace} onChange={(e) => setNeedReplace(e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="操作人"><Select value={person} onChange={(e) => setPerson(e.target.value)} className="w-full">{engineerOptions()}</Select></Field>
        </div>
        <Field label="现场照片 / log / 正常工作视频"><Input disabled placeholder="（原型占位）支持上传现场照片、log、视频" className="w-full bg-gray-50 text-gray-400" /></Field>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ start, done, record: record.trim(), fault, solution, needReplace: needReplace === '是', person })} disabled={!record.trim()} confirmLabel="保存记录" />
      </div>
    </Modal>
  );
}

// 4 发起换件（写工单换件字段与 ERP 领料信息，不改动换件记录 tab 数据）
function InitReplaceModal({ wo, onClose, onConfirm }) {
  const [form, setForm] = useState({
    coreType: wo.needReplaceModuleType || wo.needModuleType || '', oldSN: wo.oldModuleSN || '', newSN: wo.newModuleSN || '',
    newSource: wo.newPartSource || '在库可用', erpPickingNo: wo.erpPickingNo || '', erpPickingStatus: wo.erpPickingStatus || '未领料',
    applyTime: wo.erpPickApplyTime || nowText(), doneTime: wo.erpPickDoneTime || '', replaceTime: wo.newPartReplaceTime || '',
    reason: wo.replaceReason || '', note: wo.replaceNote || '',
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <Modal isOpen onClose={onClose} title="发起换件" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="核心部件类型" required><Input value={form.coreType} onChange={(e) => set('coreType', e.target.value)} className="w-full" /></Field>
          <Field label="新件来源"><Input value={form.newSource} onChange={(e) => set('newSource', e.target.value)} className="w-full" /></Field>
          <Field label="旧件 SN"><Input value={form.oldSN} onChange={(e) => set('oldSN', e.target.value)} className="w-full" /></Field>
          <Field label="新件 SN"><Input value={form.newSN} onChange={(e) => set('newSN', e.target.value)} className="w-full" /></Field>
          <Field label="ERP 领料单号 / 出库申请单号"><Input value={form.erpPickingNo} onChange={(e) => set('erpPickingNo', e.target.value)} className="w-full" /></Field>
          <Field label="ERP 领料状态"><Select value={form.erpPickingStatus} onChange={(e) => set('erpPickingStatus', e.target.value)} className="w-full">{['未领料', '已领料'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="领料申请时间"><Input value={form.applyTime} onChange={(e) => set('applyTime', e.target.value)} className="w-full" /></Field>
          <Field label="领料完成时间"><Input value={form.doneTime} onChange={(e) => set('doneTime', e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
          <Field label="新件更换时间"><Input value={form.replaceTime} onChange={(e) => set('replaceTime', e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
          <Field label="换件原因"><Input value={form.reason} onChange={(e) => set('reason', e.target.value)} className="w-full" /></Field>
        </div>
        <Field label="换件说明"><textarea rows={2} className={TA} value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
        <Field label="附件"><Input disabled placeholder="（原型占位）支持上传换件照片 / log" className="w-full bg-gray-50 text-gray-400" /></Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">换件明细最终以 ERP 领料 / 出库为准；换件记录 tab 为只读追溯视图。</Card>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm(form)} disabled={!form.coreType.trim()} confirmLabel="发起换件" />
      </div>
    </Modal>
  );
}

// 5 上传资料
function UploadDocModal({ wo, currentUser, onClose, onConfirm }) {
  const [docType, setDocType] = useState('现场照片');
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="上传资料">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="资料类型"><Select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full">{['现场照片', 'log 日志', '正常工作视频', '验收单', '其他'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="文件名" required><Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="如：onsite_DEV-515.jpg" className="w-full" /></Field>
          <Field label="关联设备 SN"><Input disabled value={wo.deviceSN || '—'} className="w-full bg-gray-50 text-gray-400" /></Field>
          <Field label="关联工单号"><Input disabled value={wo.id} className="w-full bg-gray-50 text-gray-400" /></Field>
          <Field label="上传人"><Input disabled value={currentUser} className="w-full bg-gray-50 text-gray-400" /></Field>
          <Field label="上传时间"><Input disabled value={nowText()} className="w-full bg-gray-50 text-gray-400" /></Field>
        </div>
        <Field label="备注"><textarea rows={2} className={TA} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ docType, fileName: fileName.trim(), note })} disabled={!fileName.trim()} confirmLabel="上传" />
      </div>
    </Modal>
  );
}

// 6 关单
function CloseOrderModal({ wo, currentUser, onClose, onConfirm }) {
  const [finalResult, setFinalResult] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [restored, setRestored] = useState('是');
  const [ok, setOk] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title="关单" size="lg">
      <div className="space-y-3">
        <div className="text-[13px] text-gray-500">工单号：<span className="font-mono text-gray-700">{wo.id}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="最终处理结果" required><Input value={finalResult} onChange={(e) => setFinalResult(e.target.value)} placeholder="如：故障已排除 / 已更换部件" className="w-full" /></Field>
          <Field label="是否恢复正常"><Select value={restored} onChange={(e) => setRestored(e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="关单人"><Input disabled value={currentUser} className="w-full bg-gray-50 text-gray-400" /></Field>
          <Field label="关单提交时间"><Input disabled value={nowText()} className="w-full bg-gray-50 text-gray-400" /></Field>
        </div>
        <Field label="关单说明"><textarea rows={2} className={TA} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="补充关单说明（选填）" /></Field>
        <Field label="正常工作视频 / 现场照片 / log"><Input disabled placeholder="（原型占位）关单资料" className="w-full bg-gray-50 text-gray-400" /></Field>
        <label className="flex items-center gap-2 text-[13px] text-gray-600"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> 确认问题已闭环，可以关单。</label>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ finalResult: finalResult.trim(), closeNote: closeNote.trim(), restored: restored === '是' })} disabled={!finalResult.trim() || !ok} confirmLabel="确认关单" />
      </div>
    </Modal>
  );
}

// 工单详情：宽抽屉，分区明确（来源 / 技术客服预处理 / 基础 / 调度 / 时间节点 / 故障 / 现场 / 换件 / 附件 / 关单 / 日志）。
function OrderDetailDrawer({ entry, state, dispatch, currentUser, canDo, onClose }) {
  const [modal, setModal] = useState(entry.action || null);
  const [otab, setOtab] = useState('当前处理');
  const bodyRef = useRef(null);
  // 切换分区 tab 时抽屉内容区回到顶部。
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [otab]);
  if (!entry) return null;
  const source = entry.kind === 'delivery' ? (state.deliveryWorkOrders || []) : (state.workOrders || []);
  const fresh = source.find((w) => w.id === entry.id);
  if (!fresh) return null;
  const wo = { ...fresh, _kind: entry.kind };
  const updType = entry.kind === 'delivery' ? 'UPDATE_DELIVERY_WORK_ORDER' : 'UPDATE_WORK_ORDER';
  const project = findProject(state, wo.projectId);
  const device = findDeviceOf(state, wo);
  const loc = locationOfDevice(state, device);
  const srcQI = sourceIssueIdOf(state, wo);
  const srcLabel = orderSourceLabel(state, wo);
  const dStatus = displayWoStatus(wo);
  const closed = ['已关单', '已取消'].includes(dStatus);
  const editable = canDo('update_work_order');
  const close = () => setModal(null);

  const patch = (p, note, forceTo) => {
    const t = nowText();
    const toD = forceTo ?? displayWoStatus({ ...wo, ...p });
    dispatch({ type: updType, payload: { id: wo.id, updatedAt: t, ...p, processLogs: [...(wo.processLogs || []), { time: t, operator: currentUser, fromStatus: dStatus, toStatus: toD, notes: note }] } });
    close();
  };
  const doDispatch = ({ leader, engineer, expectVisit, note }) => patch(
    { status: '待接单', assignedTo: engineer, leader, expectVisitTime: expectVisit, dispatchTime: nowText() },
    `${wo.assignedTo ? '改派' : '分派'}工程师：${engineer}${leader ? `（leader ${leader}）` : ''}${note ? `（${note}）` : ''}`, '待接单',
  );
  const doConfirmVisit = ({ expectVisit, acceptTime, contact, phone, note }) => patch(
    { status: '现场处理中', expectVisitTime: expectVisit, acceptTime, actualVisitTime: nowText(), contactName: contact, contactPhone: phone },
    `确认到场，进入现场处理${contact ? `，联系人 ${contact}` : ''}${note ? `（${note}）` : ''}`, '现场处理中',
  );
  const doOnsite = ({ start, done, record, fault, solution, needReplace, person }) => patch(
    { onsiteStartTime: start, onsiteDoneTime: done, onsiteRecord: record, actualFault: fault, actualSolution: solution, needReplace, assignedTo: person || wo.assignedTo },
    `记录现场处理：${record}${fault ? `；实际故障原因：${fault}` : ''}${solution ? `；实际方案：${solution}` : ''}`, '现场处理中',
  );
  const doReplace = (f) => patch(
    { involvesReplacement: true, needReplace: true, needReplaceModuleType: f.coreType, oldModuleSN: f.oldSN, newModuleSN: f.newSN, newPartSource: f.newSource, erpPickingNo: f.erpPickingNo, erpPickingStatus: f.erpPickingStatus, replaceInitTime: nowText(), erpPickApplyTime: f.applyTime, erpPickDoneTime: f.doneTime, newPartReplaceTime: f.replaceTime, replaceReason: f.reason, replaceNote: f.note },
    `发起换件：${f.coreType}${f.erpPickingNo ? `（领料单 ${f.erpPickingNo}）` : ''}`, '现场处理中',
  );
  const doUpload = ({ docType, fileName, note }) => patch(
    { docUploadTime: nowText(), docType, docFileName: fileName },
    `上传资料：${docType} ${fileName}${note ? `（${note}）` : ''}`, '现场处理中',
  );
  const doClose = ({ finalResult, closeNote, restored }) => patch(
    { status: '已关闭', closeSubmitTime: nowText(), closeTime: nowText(), closedAt: nowText(), closeNote, finalResult, restoredNormal: restored },
    `关单：${finalResult}${restored ? '，已恢复正常' : ''}${closeNote ? `（${closeNote}）` : ''}`, '已关单',
  );
  const doCancel = (reason) => patch({ status: '已作废', cancelTime: nowText(), closedAt: nowText(), cancelReason: reason }, `取消工单：${reason}`, '已取消');

  const otask = ORDER_TASK[dStatus] || { pending: '—', next: '—' };
  const owner = dStatus === '待分派' ? (wo.leader || '待分派') : (wo.assignedTo || wo.leader || '—');
  const sla = slaHint(wo.createTime || wo.createdAt, !closed);
  const orderActions = (
    <div className="flex flex-wrap gap-2">
      {editable && dStatus === '待分派' && <>
        <Btn variant="primary" size="sm" onClick={() => setModal('dispatch')}>分派工程师</Btn>
        <Btn variant="danger" size="sm" onClick={() => setModal('cancel')}>取消工单</Btn>
      </>}
      {editable && dStatus === '待接单' && <>
        <Btn size="sm" onClick={() => setModal('dispatch')}>改派工程师</Btn>
        <Btn variant="danger" size="sm" onClick={() => setModal('cancel')}>取消工单</Btn>
      </>}
      {editable && dStatus === '待上门' && <Btn variant="primary" size="sm" onClick={() => setModal('confirmVisit')}>确认上门时间</Btn>}
      {editable && dStatus === '现场处理中' && <>
        <Btn size="sm" onClick={() => setModal('onsite')}>记录现场处理</Btn>
        <Btn size="sm" onClick={() => setModal('replace')}>发起换件</Btn>
        <Btn size="sm" onClick={() => setModal('upload')}>上传资料</Btn>
        <Btn variant="primary" size="sm" onClick={() => setModal('close')}>关单</Btn>
      </>}
      {dStatus === '已关单' && <>
        <Btn size="sm" onClick={() => setOtab('附件与关单')}>查看资料</Btn>
        <Btn size="sm" onClick={() => setOtab('时间节点与日志')}>查看日志</Btn>
      </>}
      {dStatus === '已取消' && <Btn size="sm" onClick={() => setOtab('时间节点与日志')}>查看日志</Btn>}
      {!editable && !closed && <span className="text-[13px] text-gray-400">当前角色无工单处理权限，仅可查看。</span>}
    </div>
  );

  return (
    <Drawer open onClose={onClose} bodyRef={bodyRef} title={wo.id}
      subtitle={srcQI ? `${srcLabel} · 来源问题 ${srcQI}` : srcLabel}
      chips={<>
        <StatusBadge status={dStatus} />
        <StatusBadge status={wo.severity || '中'} />
        <Chip>{srcLabel}</Chip>
        <span className="text-xs text-gray-500">工程师：{wo.assignedTo || '待分派'}</span>
        {srcQI && <span className="text-xs text-gray-500">来源问题：{srcQI}</span>}
        <Chip>{(wo.involvesReplacement || wo.needReplace) ? '需换件' : '无换件'}</Chip>
      </>}>
      <TaskCard status={dStatus} owner={owner} pending={otask.pending} nextStep={otask.next} sla={sla} actions={orderActions} />

      <DrawerTabBar tabs={ORDER_TABS} active={otab} onChange={setOtab} />

      {otab === '当前处理' && <>
        <DrawerSection title="设备与项目">
          <DescList items={[
            ['客户名称', project?.client],
            ['项目名称', project?.name],
            ['设备 SN', wo.deviceSN],
            ['点位 / 地址', locLabel(loc)],
            ['当前状态', <StatusBadge status={dStatus} />],
            ['严重程度', <StatusBadge status={wo.severity || '中'} />],
          ]} />
        </DrawerSection>
        <DrawerSection title="调度与上门">
          <DescList items={[
            ['服务 leader', wo.leader],
            ['工程师', wo.assignedTo],
            ['预计上门时间', wo.expectVisitTime || wo.expectVisitAt],
            ['接单时间', wo.acceptTime || wo.acceptAt],
            ['实际上门时间', wo.actualVisitTime || wo.visitAt || wo.arriveTime],
            ['现场联系人 / 电话', [wo.contactName, wo.contactPhone].filter(Boolean).join(' / ') || '—'],
          ]} />
        </DrawerSection>
      </>}

      {otab === '来源与预处理' && <>
        <DrawerSection title="来源信息">
          <DescList items={[
            ['来源类型', <Chip>{srcLabel}</Chip>],
            ['来源问题编号', srcQI ? <LinkAction to={`/after-sales?tab=issues&highlight=${srcQI}`}>{srcQI}</LinkAction> : '—'],
            ['来源交付计划', wo.deliveryPlanId],
            ['来源交付子工单', wo._kind === 'delivery' ? wo.id : (wo.sourceSubOrderId || '—')],
            ['来源异常编号', wo.sourceExceptionId],
          ]} />
        </DrawerSection>
        <DrawerSection title="技术客服预处理信息（只读）">
          <DescList items={[
            ['技术客服', wo.csAgent],
            ['预处理完成时间', wo.preprocessDoneTime],
            ['一级故障原因', wo.faultL1],
            ['二级故障原因', wo.faultL2],
            ['三级故障原因', wo.faultL3],
            ['建议处理方案', wo.suggestedSolution || wo.solution],
            ['是否需上门', wo.needVisit == null ? '—' : yn(wo.needVisit)],
            ['是否需换件', wo.needReplace == null ? yn(wo.involvesReplacement) : yn(wo.needReplace)],
          ]} />
          <div className="mt-3 space-y-2">
            <div><div className="text-xs text-gray-400 mb-1">规范化故障描述</div><TextBlock>{wo.normalizedDesc || wo.description}</TextBlock></div>
            <div><div className="text-xs text-gray-400 mb-1">预处理结论</div><TextBlock>{wo.preprocessConclusion}</TextBlock></div>
          </div>
        </DrawerSection>
      </>}

      {otab === '现场执行' && (
        <DrawerSection title="现场处理（工程师现场处理信息）">
          <DescList items={[
            ['实际故障原因', wo.actualFault],
            ['实际处理方案', wo.actualSolution || wo.repairActions],
            ['是否换件', wo.needReplace == null ? '—' : yn(wo.needReplace)],
            ['现场开始 / 完成', [wo.onsiteStartTime, wo.onsiteDoneTime].filter(Boolean).join(' ~ ') || '—'],
          ]} />
          <div className="mt-3 space-y-2">
            <div><div className="text-xs text-gray-400 mb-1">现场处理说明</div><TextBlock>{wo.onsiteRecord || wo.fieldRecord}</TextBlock></div>
            <DescList items={[
              ['现场照片', wo.sitePhoto || wo.imageFile || (wo.photos && wo.photos.length ? wo.photos.join('、') : '')],
              ['log', wo.logFile || wo.log],
              ['正常工作视频', wo.workVideo],
            ]} />
          </div>
          <div className="mt-2 text-xs text-gray-400">工程师现场实测独立记录，如需修正走操作日志，不覆盖技术客服预处理信息。</div>
        </DrawerSection>
      )}

      {otab === '换件与领料' && (
        <DrawerSection title="换件与 ERP 领料">
          <DescList items={[
            ['是否需换件', yn(wo.involvesReplacement || wo.needReplace)],
            ['核心部件类型', wo.needReplaceModuleType || wo.needModuleType || wo.corePartType],
            ['旧件 SN', wo.oldModuleSN || wo.oldPartSN],
            ['新件 SN', wo.newModuleSN || wo.newPartSN],
            ['新件来源', wo.newPartSource],
            ['换件原因', wo.replaceReason],
            ['ERP 领料单号 / 出库申请单号', wo.erpPickingNo || wo.erpPickNo],
            ['ERP 领料状态', (wo.erpPickingStatus || wo.erpPickStatus) ? <StatusBadge status={wo.erpPickingStatus || wo.erpPickStatus} /> : '—'],
            ['换件记录', <LinkAction to="/after-sales?tab=replacements">前往换件记录 →</LinkAction>],
          ]} />
        </DrawerSection>
      )}

      {otab === '附件与关单' && <>
        <DrawerSection title="附件 / log / 视频（上传资料）">
          <DescList items={[
            ['资料类型', wo.docType],
            ['资料文件名', wo.docFileName],
            ['资料上传时间', wo.docUploadTime],
          ]} />
        </DrawerSection>
        <DrawerSection title="关单信息">
          <DescList items={[
            ['最终处理结果', wo.finalResult || wo.recheckResult],
            ['是否恢复正常', (wo.restoredNormal ?? wo.recovered) == null ? '—' : yn(wo.restoredNormal ?? wo.recovered)],
            ['关单说明', wo.closeNote],
            ['取消原因', wo.cancelReason || wo.voidReason],
            ['关单时间', wo.closeTime || wo.closedAt],
          ]} />
        </DrawerSection>
      </>}

      {otab === '时间节点与日志' && <>
        <DrawerSection title="售后时间节点">
          <DescList cols={3} items={[
            ['创建时间', wo.createTime || wo.createdAt],
            ['分派时间', wo.dispatchTime || wo.dispatchAt],
            ['接单时间', wo.acceptTime || wo.acceptAt],
            ['预计上门时间', wo.expectVisitTime || wo.expectVisitAt],
            ['实际上门时间', wo.actualVisitTime || wo.visitAt],
            ['现场开始时间', wo.onsiteStartTime],
            ['现场完成时间', wo.onsiteDoneTime],
            ['发起换件时间', wo.replaceInitTime],
            ['领料申请时间', wo.erpPickApplyTime],
            ['领料完成时间', wo.erpPickDoneTime],
            ['新件更换时间', wo.newPartReplaceTime],
            ['资料上传时间', wo.docUploadTime],
            ['关单提交时间', wo.closeSubmitTime],
            ['关单时间', wo.closeTime || wo.closedAt],
            ['取消时间', wo.cancelTime],
          ]} />
        </DrawerSection>
        <DrawerSection title="处理进展 / 操作日志"><LogTimeline logs={wo.processLogs} /></DrawerSection>
      </>}

      {modal === 'dispatch' && <DispatchEngineerModal wo={wo} reassign={dStatus === '待接单'} onClose={close} onConfirm={doDispatch} />}
      {modal === 'confirmVisit' && <ConfirmVisitModal wo={wo} onClose={close} onConfirm={doConfirmVisit} />}
      {modal === 'onsite' && <RecordOnsiteModal wo={wo} currentUser={currentUser} onClose={close} onConfirm={doOnsite} />}
      {modal === 'replace' && <InitReplaceModal wo={wo} onClose={close} onConfirm={doReplace} />}
      {modal === 'upload' && <UploadDocModal wo={wo} currentUser={currentUser} onClose={close} onConfirm={doUpload} />}
      {modal === 'close' && <CloseOrderModal wo={wo} currentUser={currentUser} onClose={close} onConfirm={doClose} />}
      {modal === 'cancel' && <ReasonModal title="取消工单" label="取消原因" placeholder="请填写取消原因（必填）" confirmLabel="确认取消" variant="danger" requireConfirm onClose={close} onConfirm={doCancel} />}
    </Drawer>
  );
}

/* ═════════════════════════ 售后工单 Tab ═════════════════════════ */
function OrdersTab({ state, dispatch, currentUser, canDo }) {
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fProject, setFProject] = useState('');
  const [fEngineer, setFEngineer] = useState('');
  const [fSource, setFSource] = useState('');
  const [detail, setDetail] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const openDetail = (w, action) => setDetail({ id: w.id, kind: w._kind, action });

  const orders = allWorkOrders(state);
  const engineers = [...new Set(orders.map((w) => w.assignedTo).filter(Boolean))];

  const total = orders.length;
  const nWaitAssign = orders.filter((w) => displayWoStatus(w) === '待分派').length;
  const nOnSite = orders.filter((w) => displayWoStatus(w) === '现场处理中').length;
  const nClosed = orders.filter((w) => displayWoStatus(w) === '已关单').length;

  const filtered = orders.filter((w) => {
    const q = search.trim().toLowerCase();
    return (!q || (w.id || '').toLowerCase().includes(q) || (w.deviceSN || '').toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q))
      && (!fStatus || displayWoStatus(w) === fStatus)
      && (!fProject || w.projectId === fProject)
      && (!fEngineer || w.assignedTo === fEngineer)
      && (!fSource || orderSourceLabel(state, w) === fSource);
  }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const pager = usePaged(filtered, 10);

  const handleAdd = (wo) => dispatch({ type: 'ADD_WORK_ORDER', payload: wo });

  return (
    <Page>
      <PageHeader
        breadcrumb={<div className="text-xs text-gray-400">售后管理 / 售后工单</div>}
        title="售后工单"
        description="承载现场服务执行闭环：分派、上门、现场处理、换件到关单。来源于问题池转入 / 交付子工单转入 / 售后直接创建。"
        actions={canDo('update_work_order') && <Btn variant="primary" onClick={() => setShowNew(true)}>新增工单</Btn>}
      />
      <StatGrid cols={4}>
        <StatCard label="工单总数" value={total} />
        <StatCard label="待分派" value={nWaitAssign} tone={nWaitAssign ? 'warning' : 'default'} />
        <StatCard label="现场处理中" value={nOnSite} tone={nOnSite ? 'warning' : 'default'} />
        <StatCard label="已关单" value={nClosed} tone="success" />
      </StatGrid>

      <Toolbar right={<span className="text-xs text-gray-400">共 {filtered.length} 条</span>}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索工单号 / 设备 SN / 描述" className="w-60" />
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">全部状态</option>{WO_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={fProject} onChange={(e) => setFProject(e.target.value)}><option value="">全部项目</option>{(state.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={fEngineer} onChange={(e) => setFEngineer(e.target.value)}><option value="">全部工程师</option>{engineers.map((o) => <option key={o}>{o}</option>)}</Select>
        <Select value={fSource} onChange={(e) => setFSource(e.target.value)}><option value="">全部来源</option>{ORDER_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
      </Toolbar>

      <Table
        className="text-[12px]"
        head={['售后工单号', '来源', '来源问题编号', '客户名称', '项目名称', '设备 SN', '点位 / 地址', '故障描述', '当前状态', '严重程度', '工程师', '预计上门时间', '最近更新时间', '操作']}
        empty="暂无售后工单"
        footer={<Pagination page={pager.page} total={pager.total} totalPages={pager.totalPages} onChange={pager.setPage} />}
      >
        {pager.pageItems.map((w) => {
          const project = findProject(state, w.projectId);
          const device = findDeviceOf(state, w);
          const srcQI = sourceIssueIdOf(state, w);
          const dS = displayWoStatus(w);
          return (
            <tr key={`${w._kind}-${w.id}`} className="hover:bg-[#fafafa] transition-colors align-top">
              <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{w.id}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{orderSourceLabel(state, w)}</td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{srcQI || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project?.client || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project?.name || '—'}</td>
              <td className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap">{w.deviceSN || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{locLabel(locationOfDevice(state, device))}</td>
              <td className="px-3 py-2 text-gray-600 max-w-[200px]"><div className="truncate" title={w.normalizedDesc || w.description}>{w.normalizedDesc || w.description || '—'}</div></td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={dS} /></td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={w.severity || '中'} /></td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{w.assignedTo || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{w.expectVisitTime || w.expectVisitAt || '—'}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{w.updatedAt || '—'}</td>
              <td className="px-3 py-2">
                <ActionCell>
                  <LinkAction onClick={() => openDetail(w)}>查看详情</LinkAction>
                  {canDo('update_work_order') && dS === '待分派' && <>
                    <LinkAction onClick={() => openDetail(w, 'dispatch')}>分派工程师</LinkAction>
                    <LinkAction onClick={() => openDetail(w, 'cancel')}>取消工单</LinkAction>
                  </>}
                  {canDo('update_work_order') && dS === '待接单' && <>
                    <LinkAction onClick={() => openDetail(w, 'dispatch')}>改派工程师</LinkAction>
                    <LinkAction onClick={() => openDetail(w, 'cancel')}>取消工单</LinkAction>
                  </>}
                  {canDo('update_work_order') && dS === '待上门' && <LinkAction onClick={() => openDetail(w, 'confirmVisit')}>确认上门时间</LinkAction>}
                  {canDo('update_work_order') && dS === '现场处理中' && <>
                    <LinkAction onClick={() => openDetail(w, 'onsite')}>记录现场处理</LinkAction>
                    <LinkAction onClick={() => openDetail(w, 'replace')}>发起换件</LinkAction>
                    <LinkAction onClick={() => openDetail(w, 'upload')}>上传资料</LinkAction>
                    <LinkAction onClick={() => openDetail(w, 'close')}>关单</LinkAction>
                  </>}
                </ActionCell>
              </td>
            </tr>
          );
        })}
      </Table>

      {detail && <OrderDetailDrawer entry={detail} state={state} dispatch={dispatch} currentUser={currentUser} canDo={canDo} onClose={() => setDetail(null)} />}
      {showNew && <NewOrderModal state={state} onClose={() => setShowNew(false)} onSave={handleAdd} />}
    </Page>
  );
}

/* ═════════════════════════ 问题池：录入弹窗 ═════════════════════════ */
function ManualEntryModal({ state, currentUser, onClose, onSave }) {
  const { projects = [], devices = [], locations = [] } = state;
  const [form, setForm] = useState({ projectId: '', deviceId: '', locationId: '', sourceType: '手动录入', sourceNode: '在线运营', originalDesc: '' });
  const projDevices = form.projectId ? devices.filter((d) => d.projectId === form.projectId) : [];
  const projLocations = form.projectId ? locations.filter((l) => l.projectId === form.projectId) : [];
  const submit = () => {
    const device = devices.find((d) => d.id === form.deviceId);
    const t = nowText();
    onSave({
      id: genId('QI'), deviceId: form.deviceId, deviceSN: device?.sn || '', originalDeviceSN: device?.sn || '',
      locationId: form.locationId || null, originalLocationId: form.locationId || null, projectId: form.projectId,
      sourceType: form.sourceType, source: form.sourceType, sourceNode: form.sourceNode, sourceStage: form.sourceNode,
      originalDesc: form.originalDesc, issueDesc: form.originalDesc, originalRecorder: currentUser, originalOccurTime: t,
      occurTime: t, enterPoolTime: t, reportTime: t, reporterName: currentUser, owner: '', csAgent: '',
      status: '待预处理', linkedWorkOrder: false, processLogs: [{ time: t, operator: currentUser, toStatus: '待预处理', notes: '录入问题池' }],
    });
    onClose();
  };
  return (
    <Modal isOpen onClose={onClose} title="手动录入问题" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="所属项目" required>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, deviceId: '', locationId: '' })} className="w-full">
              <option value="">-- 选择项目 --</option>
              {projects.filter((p) => !p.voided).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="设备 SN" required>
            <Select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} className="w-full" disabled={!form.projectId}>
              <option value="">-- 选择设备 --</option>
              {projDevices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
            </Select>
          </Field>
          <Field label="点位 / 地址">
            <Select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="w-full" disabled={!form.projectId}>
              <option value="">— 不选择点位 —</option>
              {projLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="来源类型">
            <Select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} className="w-full">
              {QI_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="来源节点">
            <Select value={form.sourceNode} onChange={(e) => setForm({ ...form, sourceNode: e.target.value })} className="w-full">
              {['在线运营', '出厂检验', '现场安装调试', '客户验收', '交付'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="原始异常描述" required>
          <textarea rows={3} className={TA} value={form.originalDesc} onChange={(e) => setForm({ ...form, originalDesc: e.target.value })} placeholder="请描述发现的问题（进入问题池后由技术客服规范化）" />
        </Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">录入后问题进入问题池，状态为「待预处理」，由技术客服指派、预处理并规范化。</Card>
        <ModalActions onClose={onClose} onConfirm={submit} disabled={!form.projectId || !form.deviceId || !form.originalDesc.trim()} confirmLabel="提交" />
      </div>
    </Modal>
  );
}

function ScanReportModal({ onClose }) {
  return (
    <Modal isOpen onClose={onClose} title="扫码上报问题">
      <div className="space-y-4 text-center">
        <p className="text-[13px] text-gray-600 text-left">使用飞书扫一扫扫描下方二维码，自动识别设备 SN 后填写上报，进入问题池待预处理。</p>
        <div className="flex justify-center">
          <svg width="150" height="150" viewBox="0 0 160 160" className="border border-[#ececec] rounded-lg p-2">
            <rect x="10" y="10" width="50" height="50" rx="3" fill="none" stroke="#171717" strokeWidth="5" />
            <rect x="20" y="20" width="30" height="30" rx="1" fill="#171717" />
            <rect x="100" y="10" width="50" height="50" rx="3" fill="none" stroke="#171717" strokeWidth="5" />
            <rect x="110" y="20" width="30" height="30" rx="1" fill="#171717" />
            <rect x="10" y="100" width="50" height="50" rx="3" fill="none" stroke="#171717" strokeWidth="5" />
            <rect x="20" y="110" width="30" height="30" rx="1" fill="#171717" />
            <rect x="75" y="75" width="12" height="12" fill="#171717" /><rect x="99" y="75" width="12" height="12" fill="#171717" /><rect x="123" y="75" width="12" height="12" fill="#171717" />
            <rect x="75" y="99" width="12" height="12" fill="#171717" /><rect x="111" y="99" width="12" height="12" fill="#171717" />
            <rect x="87" y="111" width="12" height="12" fill="#171717" /><rect x="123" y="123" width="12" height="12" fill="#171717" />
          </svg>
        </div>
        <p className="text-xs text-gray-400">扫码后将在飞书内打开填报页面，设备信息自动带入。</p>
        <div className="flex justify-end"><Btn variant="secondary" onClick={onClose}>关闭</Btn></div>
      </div>
    </Modal>
  );
}

/* ═════════════════════════ 问题池：预处理动作弹窗 ═════════════════════════ */
// 1 指派技术客服
function AssignCSModal({ qi, dStatus, onClose, onConfirm }) {
  const [csAgent, setCsAgent] = useState(qi.csAgent || qi.owner || '');
  const [note, setNote] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="指派技术客服">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div><span className="text-gray-400 text-xs">问题编号：</span><span className="font-mono text-gray-700">{qi.id}</span></div>
          <div><span className="text-gray-400 text-xs">当前状态：</span><StatusBadge status={dStatus} /></div>
        </div>
        <Field label="技术客服" required>
          <Select value={csAgent} onChange={(e) => setCsAgent(e.target.value)} className="w-full"><option value="">-- 选择技术客服 --</option>{engineerOptions()}</Select>
        </Field>
        <Field label="指派说明"><textarea rows={2} className={TA} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="text-xs text-gray-400">指派时间 {nowText()} · 操作人由当前登录用户记录</div>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ csAgent, note })} disabled={!csAgent} confirmLabel="确认指派" />
      </div>
    </Modal>
  );
}

// 2 编辑·规范化问题信息
function EditNormalizeModal({ qi, onClose, onConfirm }) {
  const [form, setForm] = useState({
    issueType: qi.issueType || '设备质量问题', severity: qi.severity || '中', deviceSN: qi.deviceSN || '', locationId: qi.locationId || '',
    normalizedDesc: qi.normalizedDesc || qi.issueDesc || '', faultL1: qi.faultL1 || '', faultL2: qi.faultL2 || '', faultL3: qi.faultL3 || '',
    solution: qi.solution || '', remoteSolvable: (qi.remoteSolvable ?? qi.remoteClosable) ? '是' : '否', needVisit: qi.needVisit ? '是' : '否',
    needReplace: qi.needReplace ? '是' : '否', needMoreInfo: qi.needMoreInfo ? '是' : '否', preprocessConclusion: qi.preprocessConclusion || '', csNote: qi.csNote || '',
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <Modal isOpen onClose={onClose} title="编辑 · 规范化问题信息" size="xl">
      <div className="space-y-3">
        <ReadonlyNote items={[['原始异常描述', qi.originalDesc || qi.issueDesc], ['原始设备 SN', qi.originalDeviceSN || qi.deviceSN], ['原始点位', qi.originalLocationId || qi.locationId]]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="问题类型"><Select value={form.issueType} onChange={(e) => set('issueType', e.target.value)} className="w-full">{ISSUE_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="严重程度"><Select value={form.severity} onChange={(e) => set('severity', e.target.value)} className="w-full">{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="设备 SN"><Input value={form.deviceSN} onChange={(e) => set('deviceSN', e.target.value)} className="w-full" /></Field>
          <Field label="点位 ID"><Input value={form.locationId} onChange={(e) => set('locationId', e.target.value)} className="w-full" /></Field>
        </div>
        <Field label="规范化故障描述"><textarea rows={2} className={TA} value={form.normalizedDesc} onChange={(e) => set('normalizedDesc', e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="一级故障原因"><Input value={form.faultL1} onChange={(e) => set('faultL1', e.target.value)} className="w-full" /></Field>
          <Field label="二级故障原因"><Input value={form.faultL2} onChange={(e) => set('faultL2', e.target.value)} className="w-full" /></Field>
          <Field label="三级故障原因"><Input value={form.faultL3} onChange={(e) => set('faultL3', e.target.value)} className="w-full" /></Field>
        </div>
        <Field label="处理方案"><textarea rows={2} className={TA} value={form.solution} onChange={(e) => set('solution', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="是否可远程解决"><Select value={form.remoteSolvable} onChange={(e) => set('remoteSolvable', e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="是否需上门"><Select value={form.needVisit} onChange={(e) => set('needVisit', e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="是否需换件"><Select value={form.needReplace} onChange={(e) => set('needReplace', e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="是否需补充信息"><Select value={form.needMoreInfo} onChange={(e) => set('needMoreInfo', e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
        <Field label="预处理结论"><textarea rows={2} className={TA} value={form.preprocessConclusion} onChange={(e) => set('preprocessConclusion', e.target.value)} /></Field>
        <Field label="技术客服备注"><textarea rows={2} className={TA} value={form.csNote} onChange={(e) => set('csNote', e.target.value)} /></Field>
        <Field label="附件"><Input disabled placeholder="（原型占位）支持上传附件" className="w-full bg-gray-50 text-gray-400" /></Field>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({
          issueType: form.issueType, severity: form.severity, deviceSN: form.deviceSN, locationId: form.locationId || null,
          normalizedDesc: form.normalizedDesc, faultL1: form.faultL1, faultL2: form.faultL2, faultL3: form.faultL3, solution: form.solution,
          remoteSolvable: form.remoteSolvable === '是', needVisit: form.needVisit === '是', needReplace: form.needReplace === '是',
          needMoreInfo: form.needMoreInfo === '是', preprocessConclusion: form.preprocessConclusion, csNote: form.csNote,
        })} confirmLabel="保存规范化信息" />
      </div>
    </Modal>
  );
}

// 3 更新预处理记录
function UpdatePreprocessModal({ qi, currentUser, onClose, onConfirm }) {
  const [stage, setStage] = useState('远程排查');
  const [content, setContent] = useState('');
  const [judge, setJudge] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="更新预处理记录">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="处理阶段"><Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full">{['远程排查', '远程指导', '等待反馈', '复现验证', '结论确认'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="操作人"><Input disabled value={qi.csAgent || currentUser} className="w-full bg-gray-50 text-gray-400" /></Field>
        </div>
        <Field label="处理说明" required><textarea rows={3} className={TA} value={content} onChange={(e) => setContent(e.target.value)} placeholder="填写本次预处理进展" /></Field>
        <Field label="当前判断"><Input value={judge} onChange={(e) => setJudge(e.target.value)} placeholder="如：疑似软件问题 / 需上门" className="w-full" /></Field>
        <Field label="附件"><Input disabled placeholder="（原型占位）支持上传附件" className="w-full bg-gray-50 text-gray-400" /></Field>
        <div className="text-xs text-gray-400">操作时间 {nowText()}</div>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ stage, content: content.trim(), judge })} disabled={!content.trim()} confirmLabel="保存记录" />
      </div>
    </Modal>
  );
}

// 4 请求补充信息
function RequestMoreInfoModal({ onClose, onConfirm }) {
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('交付工程师');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="请求补充信息">
      <div className="space-y-3">
        <Field label="需补充内容" required><textarea rows={3} className={TA} value={content} onChange={(e) => setContent(e.target.value)} placeholder="说明需要对方补充的信息" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="补充对象"><Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">{MOREINFO_TARGETS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="截止时间"><Input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
        </div>
        <Field label="备注"><textarea rows={2} className={TA} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">提交后问题转入「待补充信息」。</Card>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ content: content.trim(), target, deadline, note })} disabled={!content.trim()} confirmLabel="发起请求" />
      </div>
    </Modal>
  );
}

// 补充信息（待补充信息 → 预处理中）
function SupplementModal({ onClose, onConfirm }) {
  const [content, setContent] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="补充信息">
      <div className="space-y-3">
        <Field label="补充内容" required><textarea rows={3} className={TA} value={content} onChange={(e) => setContent(e.target.value)} placeholder="填写补充的信息 / 反馈" /></Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">提交后问题回到「预处理中」，由技术客服继续处理。</Card>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ content: content.trim() })} disabled={!content.trim()} confirmLabel="提交补充" />
      </div>
    </Modal>
  );
}

// 5 远程关闭（预处理中/待补充信息 → 远程已解决）
function RemoteCloseModal({ currentUser, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [result, setResult] = useState('');
  const [restored, setRestored] = useState('是');
  const [ok, setOk] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title="远程关闭">
      <div className="space-y-3">
        <Field label="关闭原因" required><textarea rows={2} className={TA} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="说明可远程解决的原因" /></Field>
        <Field label="处理结果" required><Input value={result} onChange={(e) => setResult(e.target.value)} placeholder="如：远程重启后恢复 / 推送补丁修复" className="w-full" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="是否恢复正常"><Select value={restored} onChange={(e) => setRestored(e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="关闭人"><Input disabled value={currentUser} className="w-full bg-gray-50 text-gray-400" /></Field>
        </div>
        <Field label="正常工作视频 / 附件"><Input disabled placeholder="（原型占位）支持上传视频 / 附件" className="w-full bg-gray-50 text-gray-400" /></Field>
        <label className="flex items-center gap-2 text-[13px] text-gray-600"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> 我已确认问题可远程关闭。</label>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ reason: reason.trim(), result: result.trim(), restored: restored === '是' })} disabled={!reason.trim() || !result.trim() || !ok} confirmLabel="确认远程关闭" />
      </div>
    </Modal>
  );
}

// 6 转售后工单（默认取规范化字段）
function ToWorkOrderModal({ qi, project, locationLabel, onClose, onConfirm }) {
  const [form, setForm] = useState({
    normalizedDesc: qi.normalizedDesc || qi.issueDesc || '', faultCause: [qi.faultL1, qi.faultL2, qi.faultL3].filter(Boolean).join(' / '),
    suggestedSolution: qi.solution || '', severity: qi.severity || '中', needReplace: qi.needReplace ? '是' : '否', expectVisit: '', note: '',
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <Modal isOpen onClose={onClose} title="转售后工单" size="lg">
      <div className="space-y-3">
        <ReadonlyNote items={[['来源问题编号', qi.id], ['客户', project?.client], ['项目', project?.name], ['设备 SN', qi.deviceSN], ['点位 / 地址', locationLabel]]} />
        <Field label="规范化故障描述"><textarea rows={2} className={TA} value={form.normalizedDesc} onChange={(e) => set('normalizedDesc', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="故障原因"><Input value={form.faultCause} onChange={(e) => set('faultCause', e.target.value)} className="w-full" /></Field>
          <Field label="建议处理方案"><Input value={form.suggestedSolution} onChange={(e) => set('suggestedSolution', e.target.value)} className="w-full" /></Field>
          <Field label="严重程度"><Select value={form.severity} onChange={(e) => set('severity', e.target.value)} className="w-full">{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="是否需换件"><Select value={form.needReplace} onChange={(e) => set('needReplace', e.target.value)} className="w-full">{YN.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="期望上门时间"><Input value={form.expectVisit} onChange={(e) => set('expectVisit', e.target.value)} placeholder="YYYY-MM-DD HH:mm" className="w-full" /></Field>
        </div>
        <Field label="备注"><textarea rows={2} className={TA} value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
        <Card className="bg-[#fafafa] text-xs text-gray-500">提交后默认取规范化字段生成售后工单（待分派），并回填问题的「是否转售后工单」与关联工单号。</Card>
        <ModalActions onClose={onClose} onConfirm={() => onConfirm({ ...form, needReplace: form.needReplace === '是' })} confirmLabel="生成售后工单" />
      </div>
    </Modal>
  );
}

// 问题池强详情：宽抽屉，分区（状态栏 / 操作 / 来源快照 / 规范化 / 时间节点 / 时间线 / 附件 / 工单关联）。
// 来源信息 tab：按来源类型动态展示（交付异常 / 扫码上报 / 系统告警 / 手动录入 / 问题平台上报）。
function IssueSourceInfo({ qi, project, origLocation, location, returnToDelivery }) {
  const src = qi.sourceType || qi.source || '—';
  const loc = locLabel(origLocation) !== '—' ? locLabel(origLocation) : locLabel(location);
  const known = ['交付异常', '扫码上报', '系统告警', '手动录入', '问题平台上报'];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-400">来源类型</span>{src !== '—' ? <StatusBadge status={src} /> : '—'}</div>
      {src === '交付异常' && <>
        <DescList items={[
          ['来源交付计划', qi.sourceDeliveryPlanId || qi.deliveryPlanId],
          ['来源交付子工单', qi.sourceSubOrderId],
          ['来源节点', qi.sourceNode || qi.sourceStage],
          ['项目名称', project?.name],
          ['客户名称', project?.client],
          ['设备 SN', qi.originalDeviceSN || qi.deviceSN],
          ['点位 / 地址', loc],
          ['交付负责人', qi.deliveryOwner || qi.originalRecorder],
          ['交付工程师 / 实施工程师', qi.deliveryEngineer || qi.originalRecorder || qi.reporterName],
          ['异常发生时间', qi.originalOccurTime || qi.reportTime],
          ['异常记录人', qi.originalRecorder || qi.reporterName],
          ['原始附件 / 现场照片 / 验收材料', qi.originalAttachments],
          ['是否需要交付补充信息', qi.needMoreInfo == null ? '—' : yn(qi.needMoreInfo)],
          ['是否退回交付继续处理', yn(returnToDelivery)],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">原始异常描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
      {src === '扫码上报' && <>
        <DescList items={[
          ['扫码入口', qi.scanEntry || '设备二维码'],
          ['上报人', qi.originalRecorder || qi.reporterName],
          ['上报时间', qi.originalOccurTime || qi.reportTime],
          ['设备 SN', qi.originalDeviceSN || qi.deviceSN],
          ['点位 / 地址', loc],
          ['上传附件', qi.originalAttachments],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">原始上报描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
      {src === '系统告警' && <>
        <DescList items={[
          ['告警来源', qi.alertSource || '设备健康监测'],
          ['告警 ID', qi.alertId],
          ['告警时间', qi.alertTime || qi.originalOccurTime || qi.reportTime],
          ['告警类型', qi.alertType],
          ['严重程度', <StatusBadge status={qi.severity || '中'} />],
          ['设备 SN', qi.originalDeviceSN || qi.deviceSN],
          ['是否已生成问题记录', '是'],
          ['是否已生成售后工单', yn(!!qi.linkedWorkOrderId)],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">告警描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
      {src === '手动录入' && <>
        <DescList items={[
          ['录入人', qi.originalRecorder || qi.reporterName],
          ['录入时间', qi.originalOccurTime || qi.reportTime],
          ['设备 SN', qi.originalDeviceSN || qi.deviceSN],
          ['点位 / 地址', loc],
          ['附件', qi.originalAttachments],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">原始描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
      {src === '问题平台上报' && <>
        <DescList items={[
          ['外部问题编号', qi.externalIssueNo || qi.id],
          ['上报平台', qi.reportPlatform || '客户问题平台'],
          ['上报时间', qi.originalOccurTime || qi.reportTime],
          ['上报人 / 联系人', qi.reportContact || qi.originalRecorder || qi.reporterName],
          ['设备 SN', qi.originalDeviceSN || qi.deviceSN],
          ['点位 / 地址', loc],
          ['附件', qi.originalAttachments],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">原始问题描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
      {!known.includes(src) && <>
        <DescList items={[
          ['设备 SN', qi.deviceSN],
          ['点位 / 地址', loc],
          ['记录人', qi.originalRecorder || qi.reporterName],
          ['发生时间', qi.originalOccurTime || qi.reportTime],
        ]} />
        <div><div className="text-xs text-gray-400 mb-1">原始描述</div><TextBlock>{qi.originalDesc || qi.issueDesc}</TextBlock></div>
      </>}
    </div>
  );
}

function IssueDetailDrawer({ entry, state, dispatch, currentUser, canDo, onClose }) {
  const [modal, setModal] = useState(entry.action || null);
  const [role, setRole] = useState('技术客服');
  const [tab, setTab] = useState(ISSUE_ROLE_DEFAULT_TAB['技术客服']);
  const bodyRef = useRef(null);
  // 切换登录角色或分区 tab 时，抽屉内容区回到顶部。
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [role, tab]);
  // 切换模拟登录角色：默认打开该角色关注的 tab。
  const changeRole = (r) => { setRole(r); setTab(ISSUE_ROLE_DEFAULT_TAB[r] || '当前处理'); };
  const qi = (state.qualityIssues || []).find((q) => q.id === entry.id);
  if (!qi) return null;
  const project = findProject(state, qi.projectId);
  const location = locById(state, qi.locationId);
  const origLocation = locById(state, qi.originalLocationId);
  const dStatus = normalizeIssueStatus(qi);
  const linked = !!(qi.linkedWorkOrder || qi.linkedWorkOrderId);
  const editable = canDo('update_quality_issue');
  const enterT = qi.enterPoolTime || qi.reportTime;
  const stayEnd = qi.closeTime || qi.toWorkOrderTime || qi.remoteCloseTime || nowText();
  const itask = ISSUE_TASK[dStatus] || { pending: '—', next: '—' };
  const activeIssue = ['待预处理', '预处理中', '待补充信息'].includes(dStatus);
  const sla = slaHint(enterT, activeIssue);
  const linkedWO = qi.linkedWorkOrderId ? allWorkOrders(state).find((w) => w.id === qi.linkedWorkOrderId) : null;
  const close = () => setModal(null);

  const patchQI = (p, note, forceTo) => {
    const t = nowText();
    const to = forceTo ?? p.status ?? dStatus;
    dispatch({ type: 'UPDATE_QUALITY_ISSUE', payload: { id: qi.id, ...p, processLogs: [...(qi.processLogs || []), { time: t, operator: currentUser, fromStatus: dStatus, toStatus: to, notes: note }] } });
    close();
  };
  const doAssign = ({ csAgent, note }) => patchQI({ csAgent, owner: csAgent, csAssignTime: nowText() }, `指派技术客服：${csAgent}${note ? `（${note}）` : ''}`);
  const doStart = () => patchQI({ status: '预处理中', csFirstResponseTime: qi.csFirstResponseTime || nowText() }, '开始预处理', '预处理中');
  const doEdit = (p) => patchQI(p, `编辑·规范化问题信息（问题类型 ${p.issueType} / 严重度 ${p.severity}）`);
  const doProgress = ({ stage, content, judge }) => patchQI({ handleNote: content }, `更新预处理记录[${stage}]：${content}${judge ? `；判断：${judge}` : ''}`);
  const doMoreInfo = ({ content, target, deadline, note }) => patchQI({ status: '待补充信息', needMoreInfo: true, moreInfoTarget: target, moreInfoDeadline: deadline }, `请求补充信息（对象：${target}${deadline ? `，截止 ${deadline}` : ''}）：${content}${note ? `（${note}）` : ''}`, '待补充信息');
  const doSupplement = ({ content }) => patchQI({ status: '预处理中', needMoreInfo: false }, `补充信息：${content}`, '预处理中');
  const doRemoteClose = ({ reason, result, restored }) => patchQI({ status: '远程已解决', remoteCloseTime: nowText(), preprocessDoneTime: qi.preprocessDoneTime || nowText(), closeReason: reason, preprocessConclusion: qi.preprocessConclusion || result, restoredNormal: restored }, `远程关闭：${reason}；结果：${result}`, '远程已解决');
  const doToWorkOrder = (f) => {
    if (linked) return;
    const t = nowText();
    const woId = genId('WO');
    dispatch({ type: 'ADD_WORK_ORDER', payload: {
      id: woId, type: 'aftersales', woClass: f.needReplace ? '换件工单' : '其他问题工单', involvesReplacement: f.needReplace, needReplace: f.needReplace,
      source: '问题池转入', sourceIssueId: qi.id, sourceQualityIssueId: qi.id, stage: qi.sourceNode || qi.sourceStage || '在线运营',
      projectId: qi.projectId, deviceId: qi.deviceId, deviceSN: qi.deviceSN, description: f.normalizedDesc, normalizedDesc: f.normalizedDesc,
      faultL1: qi.faultL1, faultL2: qi.faultL2, faultL3: qi.faultL3, suggestedSolution: f.suggestedSolution, severity: f.severity,
      csAgent: qi.csAgent || qi.owner, preprocessDoneTime: qi.preprocessDoneTime || t, preprocessConclusion: qi.preprocessConclusion,
      needVisit: qi.needVisit, expectVisitTime: f.expectVisit, status: '待分派', assignedTo: '',
      createTime: t, createdAt: t, updatedAt: t, closedAt: null, processLogs: [{ time: t, operator: currentUser, toStatus: '待分派', notes: `由问题池 ${qi.id} 转入` }],
    } });
    patchQI({ status: '已转售后工单', linkedWorkOrder: true, linkedWorkOrderId: woId, toWorkOrderTime: t, preprocessDoneTime: qi.preprocessDoneTime || t }, `转售后工单 ${woId}${f.note ? `（${f.note}）` : ''}`, '已转售后工单');
  };
  const doCloseIssue = (reason) => patchQI({ status: '已关闭', closeTime: nowText(), closeReason: reason }, `关闭问题${reason ? `：${reason}` : ''}`, '已关闭');

  // 责任人流转 / 状态变更（从操作日志派生）。
  const flowOwners = [...new Set((qi.processLogs || []).map((l) => l.operator).filter(Boolean))];
  const statusChanges = (qi.processLogs || []).filter((l) => l.fromStatus && l.toStatus);
  const overSla = sla?.tone === 'warning';
  // 是否退回交付继续处理：技术客服请求向交付侧补充信息时成立。
  const returnToDelivery = !!qi.needMoreInfo && ['交付执行人员', '交付工程师', '现场人员', '客户'].includes(qi.moreInfoTarget);
  const canTech = role === '技术客服' && editable;
  const linkedWoStatus = linkedWO ? displayWoStatus(linkedWO) : null;
  const currentOwner = linked
    ? (linkedWO?.assignedTo || linkedWO?.leader || '售后待分派')
    : (qi.csAgent || qi.owner || (dStatus === '待预处理' ? '待指派技术客服' : '—'));

  // 当前 (状态, 登录角色) 可执行操作；写操作受全局 canDo 约束（权限通过可见性 / 置灰体现）。
  const roleOps = ((ISSUE_OPS[dStatus] && ISSUE_OPS[dStatus][role]) || ['viewLog']).filter((k) => !ISSUE_WRITE_OPS.has(k) || editable);
  const runOp = (key) => {
    switch (key) {
      case 'assign': case 'start': case 'edit': case 'progress': case 'moreinfo': case 'remoteclose': case 'toworkorder': case 'closeissue': setModal(key); break;
      case 'supplement': case 'supplementSite': case 'uploadSite': setModal('supplement'); break;
      case 'viewStatus': setTab('当前处理'); break;
      case 'viewCS': case 'viewPre': setTab('技术客服预处理'); break;
      case 'viewAS': setTab('售后执行'); break;
      case 'viewRecord': case 'viewLog': case 'viewSLA': setTab('时间节点与日志'); break;
      default: break;
    }
  };
  const renderOp = (key) => {
    const label = ISSUE_OP_LABEL[key] || key;
    const variant = ISSUE_PRIMARY_OPS.has(key) ? 'primary' : 'secondary';
    if (ISSUE_LINK_OPS.has(key)) {
      if (!qi.linkedWorkOrderId) return null;
      return <Btn key={key} as="link" to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`} variant={variant} size="sm">{label}</Btn>;
    }
    return <Btn key={key} variant={variant} size="sm" onClick={() => runOp(key)}>{label}</Btn>;
  };
  const opBtns = roleOps.map(renderOp).filter(Boolean);
  const opButtons = <div className="flex flex-wrap gap-2">{opBtns.length ? opBtns : <span className="text-[13px] text-gray-400">当前角色对该状态仅可查看。</span>}</div>;
  const opText = roleOps.length ? roleOps.map((k) => ISSUE_OP_LABEL[k] || k).join(' / ') : '仅可查看';

  const attachmentItems = [
    ['图片 / 附件', qi.attachments || qi.originalAttachments],
    ['log', qi.logFile],
    ['正常工作视频', qi.workVideo],
  ];

  return (
    <Drawer open onClose={onClose} bodyRef={bodyRef} title={qi.id}
      subtitle={`${qi.sourceType || qi.source || '—'} · 进入问题池 ${enterT || '—'}`}
      chips={<>
        {(qi.sourceType || qi.source) && <StatusBadge status={qi.sourceType || qi.source} />}
        {qi.issueType && <StatusBadge status={qi.issueType} />}
        <StatusBadge status={dStatus} />
        <StatusBadge status={qi.severity || '中'} />
        <span className="text-xs text-gray-500">技术客服：{qi.csAgent || qi.owner || '—'}</span>
        <Chip>{linked ? '已转售后工单' : '未转工单'}</Chip>
      </>}>
      <div className="rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-3 space-y-2">
        <RoleViewTabs label="当前登录角色" roles={ISSUE_SIM_ROLES} active={role} onChange={changeRole} />
        <div className="text-xs text-gray-500">{ISSUE_ROLE_DESC[role]}</div>
        <div className="text-xs text-gray-500">当前可执行操作：<span className="text-gray-800">{opText}</span></div>
      </div>

      <DrawerTabBar tabs={ISSUE_TABS} active={tab} onChange={setTab} />

      {tab === '当前处理' && (
        <TaskCard status={dStatus} owner={currentOwner} pending={itask.pending} nextStep={itask.next} sla={sla} actions={opButtons} />
      )}

      {tab === '来源信息' && <IssueSourceInfo qi={qi} project={project} origLocation={origLocation} location={location} returnToDelivery={returnToDelivery} />}

      {tab === '技术客服预处理' && <>
        <DrawerSection title="技术客服预处理信息">
          <DescList items={[
            ['技术客服', qi.csAgent || qi.owner],
            ['技术客服指派时间', qi.csAssignTime],
            ['技术客服首次响应时间', qi.csFirstResponseTime],
            ['预处理完成时间', qi.preprocessDoneTime],
            ['问题类型', qi.issueType ? <StatusBadge status={qi.issueType} /> : '—'],
            ['严重程度', <StatusBadge status={qi.severity || '中'} />],
            ['设备 SN', qi.deviceSN],
            ['点位 / 地址', locLabel(location)],
            ['一级故障原因', qi.faultL1],
            ['二级故障原因', qi.faultL2],
            ['三级故障原因', qi.faultL3],
            ['处理方案', qi.solution],
            ['是否可远程解决', (qi.remoteSolvable ?? qi.remoteClosable) == null ? '—' : yn(qi.remoteSolvable ?? qi.remoteClosable)],
            ['是否需要上门', qi.needVisit == null ? '—' : yn(qi.needVisit)],
            ['是否需要换件', qi.needReplace == null ? '—' : yn(qi.needReplace)],
            ['是否需要补充信息', qi.needMoreInfo == null ? '—' : yn(qi.needMoreInfo)],
          ]} />
          <div className="mt-3 space-y-2">
            <div><div className="text-xs text-gray-400 mb-1">规范化故障描述</div><TextBlock>{qi.normalizedDesc || qi.issueDesc}</TextBlock></div>
            <div><div className="text-xs text-gray-400 mb-1">预处理结论</div><TextBlock>{qi.preprocessConclusion}</TextBlock></div>
            <div><div className="text-xs text-gray-400 mb-1">技术客服备注</div><TextBlock>{qi.csNote}</TextBlock></div>
          </div>
        </DrawerSection>
        <DrawerSection title="附件 / log / 正常工作视频"><DescList items={attachmentItems} /></DrawerSection>
        <div className="rounded-md border border-[#eee] bg-[#fafafa] px-3 py-2 text-xs text-gray-500">
          {role === '技术客服' ? '技术客服可编辑规范化字段与预处理结论。' : role === '交付执行人员' ? '交付执行人员只读查看技术客服反馈，可按请求补充现场信息，不可修改规范化字段与预处理结论。' : '当前角色只读查看技术客服预处理结论。'}
        </div>
        <div className="flex flex-wrap gap-2">
          {canTech && activeIssue && <>
            <Btn size="sm" onClick={() => setModal('edit')}>编辑规范化</Btn>
            <Btn size="sm" onClick={() => setModal('progress')}>更新预处理记录</Btn>
            {dStatus !== '待补充信息' && <Btn size="sm" onClick={() => setModal('moreinfo')}>请求补充信息</Btn>}
            <Btn size="sm" onClick={() => setModal('remoteclose')}>远程关闭</Btn>
            <Btn variant="primary" size="sm" onClick={() => setModal('toworkorder')}>转售后工单</Btn>
          </>}
          {role === '交付执行人员' && dStatus === '待补充信息' && <Btn variant="primary" size="sm" onClick={() => setModal('supplement')}>补充信息</Btn>}
          {(role === '售后 leader' || role === '售后工程师' || role === '技术客服') && qi.linkedWorkOrderId && <Btn as="link" to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`} size="sm">查看售后工单</Btn>}
        </div>
      </>}

      {tab === '售后执行' && <>
        {!linked
          ? <EmptyState>当前问题尚未转售后工单。如技术客服判断需要现场处理，可在「技术客服预处理」中转售后工单。</EmptyState>
          : <>
            <DrawerSection title="关联售后工单">
              <DescList items={[
                ['关联售后工单号', qi.linkedWorkOrderId ? <LinkAction to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`}>{qi.linkedWorkOrderId}</LinkAction> : '—'],
                ['售后工单状态', linkedWoStatus ? <StatusBadge status={linkedWoStatus} /> : '—'],
                ['售后 leader', linkedWO?.leader],
                ['工程师', linkedWO?.assignedTo],
                ['预计上门时间', linkedWO?.expectVisitTime || linkedWO?.expectVisitAt],
                ['实际上门时间', linkedWO?.actualVisitTime || linkedWO?.visitAt],
                ['现场处理状态', linkedWoStatus],
                ['是否换件', linkedWO ? yn(linkedWO.involvesReplacement || linkedWO.needReplace) : '—'],
                ['换件记录编号', linkedWO?.replaceRecordId],
                ['ERP 领料单号 / 出库申请单号', linkedWO?.erpPickingNo || linkedWO?.erpPickNo],
              ]} />
              <div className="mt-3"><DescList items={[
                ['现场照片', linkedWO?.sitePhoto || linkedWO?.imageFile || (linkedWO?.photos && linkedWO.photos.length ? linkedWO.photos.join('、') : '')],
                ['log', linkedWO?.logFile || linkedWO?.log],
                ['正常工作视频', linkedWO?.workVideo],
              ]} /></div>
            </DrawerSection>
            <div className="rounded-md border border-[#eee] bg-[#fafafa] px-3 py-2 text-xs text-gray-500">
              {role === '售后 leader' ? '售后 leader 可在售后工单中分派 / 改派工程师并跟踪 SLA。' : role === '售后工程师' ? '售后工程师在售后工单中接单、上门、记录现场处理、发起换件与关单。' : role === '交付执行人员' ? '交付执行人员可查看售后状态摘要。' : '现场执行在售后工单内闭环，此处为只读摘要。'}
            </div>
            <div className="flex flex-wrap gap-2">
              {qi.linkedWorkOrderId && <Btn as="link" to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`} variant="primary" size="sm">查看售后工单</Btn>}
              {role === '售后 leader' && qi.linkedWorkOrderId && <Btn as="link" to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`} size="sm">分派 / 改派工程师</Btn>}
              {role === '管理者' && <Btn size="sm" onClick={() => setTab('时间节点与日志')}>查看 SLA</Btn>}
            </div>
          </>}
      </>}

      {tab === '时间节点与日志' && <>
        <DrawerSection title="问题时间节点">
          <DescList cols={3} items={[
            ['问题发生时间', qi.occurTime || qi.originalOccurTime || qi.reportTime],
            ['进入问题池时间', enterT],
            ['技术客服指派时间', qi.csAssignTime],
            ['技术客服首次响应时间', qi.csFirstResponseTime],
            ['预处理完成时间', qi.preprocessDoneTime],
            ['转售后工单时间', qi.toWorkOrderTime],
            ['远程关闭时间', qi.remoteCloseTime],
            ['问题关闭时间', qi.closeTime],
          ]} />
        </DrawerSection>
        <DrawerSection title="SLA 指标">
          <DescList cols={2} items={[
            ['技术客服响应时长', durationText(enterT, qi.csFirstResponseTime)],
            ['技术客服预处理时长', durationText(qi.csFirstResponseTime, qi.preprocessDoneTime)],
            ['问题池停留时长', durationText(enterT, stayEnd)],
            ['是否超时', overSla ? '是（超 48h · SLA 占位）' : '否'],
            ['超时原因', overSla ? '问题池停留超阈值（原型 SLA 占位）' : '—'],
          ]} />
        </DrawerSection>
        {linked && <DrawerSection title="售后关键时间摘要">
          <DescList cols={3} items={[
            ['售后工单创建时间', linkedWO?.createTime || linkedWO?.createdAt],
            ['leader 分派时间', linkedWO?.dispatchTime || linkedWO?.dispatchAt],
            ['工程师接单时间', linkedWO?.acceptTime || linkedWO?.acceptAt],
            ['预计上门时间', linkedWO?.expectVisitTime || linkedWO?.expectVisitAt],
            ['实际上门时间', linkedWO?.actualVisitTime || linkedWO?.visitAt],
            ['现场处理开始时间', linkedWO?.onsiteStartTime],
            ['现场处理完成时间', linkedWO?.onsiteDoneTime],
            ['资料上传时间', linkedWO?.docUploadTime],
            ['关单时间', linkedWO?.closeTime || linkedWO?.closedAt],
          ]} />
        </DrawerSection>}
        <DrawerSection title="责任人流转">
          {flowOwners.length
            ? <div className="flex flex-wrap items-center gap-2">{flowOwners.map((o, i) => <span key={i} className="inline-flex items-center gap-2 text-[13px] text-gray-700">{i > 0 && <span className="text-gray-300">→</span>}<Chip>{o}</Chip></span>)}</div>
            : <EmptyState>暂无责任人流转记录</EmptyState>}
        </DrawerSection>
        <DrawerSection title="状态变更记录">
          {statusChanges.length
            ? <ol className="space-y-2">{statusChanges.map((l, i) => <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500"><span>{l.time}</span><span className="font-medium text-gray-600">{l.operator}</span><StatusBadge status={l.fromStatus} /><span className="text-gray-300">→</span><StatusBadge status={l.toStatus} /></li>)}</ol>
            : <EmptyState>暂无状态变更记录</EmptyState>}
        </DrawerSection>
        <DrawerSection title="操作日志" id="qi-logs"><LogTimeline logs={qi.processLogs} /></DrawerSection>
      </>}

      {modal === 'assign' && <AssignCSModal qi={qi} dStatus={dStatus} onClose={close} onConfirm={doAssign} />}
      {modal === 'start' && <Modal isOpen onClose={close} title="开始预处理"><div className="space-y-3"><Card className="bg-[#fafafa] text-xs text-gray-500">开始预处理后问题转入「预处理中」，并记录技术客服首次响应时间。</Card><div className="text-[13px] text-gray-600">技术客服：{qi.csAgent || qi.owner || '（未指派，将以当前用户记录）'}</div><ModalActions onClose={close} onConfirm={doStart} confirmLabel="开始预处理" /></div></Modal>}
      {modal === 'edit' && <EditNormalizeModal qi={qi} onClose={close} onConfirm={doEdit} />}
      {modal === 'progress' && <UpdatePreprocessModal qi={qi} currentUser={currentUser} onClose={close} onConfirm={doProgress} />}
      {modal === 'moreinfo' && <RequestMoreInfoModal onClose={close} onConfirm={doMoreInfo} />}
      {modal === 'supplement' && <SupplementModal onClose={close} onConfirm={doSupplement} />}
      {modal === 'remoteclose' && <RemoteCloseModal currentUser={currentUser} onClose={close} onConfirm={doRemoteClose} />}
      {modal === 'toworkorder' && <ToWorkOrderModal qi={qi} project={project} locationLabel={locLabel(location)} onClose={close} onConfirm={doToWorkOrder} />}
      {modal === 'closeissue' && <ReasonModal title="关闭问题" label="关闭原因" placeholder="请填写关闭原因（必填）" confirmLabel="确认关闭" onClose={close} onConfirm={doCloseIssue} />}
    </Drawer>
  );
}

/* ═════════════════════════ 问题池 Tab ═════════════════════════ */
function IssuesTab({ state, dispatch, currentUser, canDo }) {
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fType, setFType] = useState('');
  const [fProject, setFProject] = useState('');
  const [fSource, setFSource] = useState('');
  const [fToWO, setFToWO] = useState('');
  const [detail, setDetail] = useState(null);
  const [showScan, setShowScan] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const openDetail = (qi, action) => setDetail({ id: qi.id, action });

  const issues = state.qualityIssues || [];
  const hasWO = (qi) => !!(qi.linkedWorkOrder || qi.linkedWorkOrderId);

  const nPre = issues.filter((q) => normalizeIssueStatus(q) === '待预处理').length;
  const nProc = issues.filter((q) => normalizeIssueStatus(q) === '预处理中').length;
  const nRemote = issues.filter((q) => normalizeIssueStatus(q) === '远程已解决').length;
  const nToWO = issues.filter((q) => normalizeIssueStatus(q) === '已转售后工单').length;

  const filtered = issues.filter((qi) => {
    const q = search.trim().toLowerCase();
    return (!q || (qi.id || '').toLowerCase().includes(q) || (qi.deviceSN || '').toLowerCase().includes(q) || (qi.normalizedDesc || qi.issueDesc || '').toLowerCase().includes(q))
      && (!fStatus || normalizeIssueStatus(qi) === fStatus)
      && (!fType || qi.issueType === fType)
      && (!fProject || qi.projectId === fProject)
      && (!fSource || (qi.sourceType || qi.source) === fSource)
      && (!fToWO || (fToWO === '是' ? hasWO(qi) : !hasWO(qi)));
  }).sort((a, b) => ((b.enterPoolTime || b.reportTime || '')).localeCompare(a.enterPoolTime || a.reportTime || ''));
  const pager = usePaged(filtered, 10);

  const handleSave = (qi) => dispatch({ type: 'ADD_QUALITY_ISSUE', payload: qi });

  return (
    <Page>
      <PageHeader
        breadcrumb={<div className="text-xs text-gray-400">售后管理 / 问题池</div>}
        title="问题池"
        description="平台统一入口：交付异常 / 扫码上报 / 系统告警进入问题池，由技术客服预处理、规范化，可远程关闭或转售后工单。"
        actions={<div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={() => setShowScan(true)}>扫码上报</Btn>
          {canDo('add_quality_issue') && <Btn variant="primary" onClick={() => setShowManual(true)}>手动录入</Btn>}
        </div>}
      />
      <StatGrid cols={4}>
        <StatCard label="待预处理" value={nPre} tone={nPre ? 'warning' : 'default'} />
        <StatCard label="预处理中" value={nProc} tone={nProc ? 'warning' : 'default'} />
        <StatCard label="远程已解决" value={nRemote} tone="success" />
        <StatCard label="已转售后工单" value={nToWO} />
      </StatGrid>

      <Card className="bg-[#fafafa] text-xs text-gray-500 leading-relaxed">
        问题池是统一入口，技术客服在此预处理并规范化问题（来源快照只读，规范化字段可编辑）；需现场执行的问题转售后工单，售后工单只承载现场执行闭环。
      </Card>

      <Toolbar right={<span className="text-xs text-gray-400">共 {filtered.length} 条</span>}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索问题编号 / 设备 SN / 描述" className="w-60" />
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">全部状态</option>{QI_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={fType} onChange={(e) => setFType(e.target.value)}><option value="">全部问题类型</option>{ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select value={fProject} onChange={(e) => setFProject(e.target.value)}><option value="">全部项目</option>{(state.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={fSource} onChange={(e) => setFSource(e.target.value)}><option value="">全部来源类型</option>{QI_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={fToWO} onChange={(e) => setFToWO(e.target.value)}><option value="">是否转工单</option><option value="是">已转工单</option><option value="否">未转工单</option></Select>
      </Toolbar>

      <Table
        className="text-[12px]"
        head={['问题编号', '来源类型', '问题类型', '当前状态', '严重程度', '客户名称', '项目名称', '设备 SN', '点位 / 地址', '问题发生时间', '进入问题池时间', '技术客服', '首次响应时间', '预处理完成时间', '预处理结论', '是否转工单', '关联工单号', '操作']}
        empty="暂无问题记录"
        footer={<Pagination page={pager.page} total={pager.total} totalPages={pager.totalPages} onChange={pager.setPage} />}
      >
        {pager.pageItems.map((qi) => {
          const project = findProject(state, qi.projectId);
          const location = locById(state, qi.locationId);
          const dS = normalizeIssueStatus(qi);
          return (
            <tr key={qi.id} className="hover:bg-[#fafafa] transition-colors align-top">
              <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{qi.id}</td>
              <td className="px-3 py-2 whitespace-nowrap">{(qi.sourceType || qi.source) ? <StatusBadge status={qi.sourceType || qi.source} /> : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{qi.issueType ? <StatusBadge status={qi.issueType} /> : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={dS} /></td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={qi.severity || '中'} /></td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project?.client || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{project?.name || '—'}</td>
              <td className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap">{qi.deviceSN || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{locLabel(location)}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{qi.occurTime || qi.originalOccurTime || qi.reportTime || '—'}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{qi.enterPoolTime || qi.reportTime || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{qi.csAgent || qi.owner || '—'}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{qi.csFirstResponseTime || '—'}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{qi.preprocessDoneTime || '—'}</td>
              <td className="px-3 py-2 text-gray-600 max-w-[180px]"><div className="truncate" title={qi.preprocessConclusion}>{qi.preprocessConclusion || '—'}</div></td>
              <td className="px-3 py-2 whitespace-nowrap">{hasWO(qi) ? <span className="text-gray-700">是</span> : <span className="text-gray-400">否</span>}</td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{qi.linkedWorkOrderId || '—'}</td>
              <td className="px-3 py-2">
                <ActionCell>
                  <LinkAction onClick={() => openDetail(qi)}>查看详情</LinkAction>
                  {canDo('update_quality_issue') && dS === '待预处理' && <>
                    <LinkAction onClick={() => openDetail(qi, 'assign')}>指派技术客服</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'start')}>开始预处理</LinkAction>
                  </>}
                  {canDo('update_quality_issue') && dS === '预处理中' && <>
                    <LinkAction onClick={() => openDetail(qi, 'edit')}>编辑规范化</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'progress')}>更新记录</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'moreinfo')}>请求补充</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'remoteclose')}>远程关闭</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'toworkorder')}>转售后工单</LinkAction>
                  </>}
                  {canDo('update_quality_issue') && dS === '待补充信息' && <>
                    <LinkAction onClick={() => openDetail(qi, 'supplement')}>补充信息</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'remoteclose')}>远程关闭</LinkAction>
                    <LinkAction onClick={() => openDetail(qi, 'toworkorder')}>转售后工单</LinkAction>
                  </>}
                  {dS === '已转售后工单' && qi.linkedWorkOrderId && <LinkAction to={`/after-sales?tab=orders&highlight=${qi.linkedWorkOrderId}`}>查看售后工单</LinkAction>}
                </ActionCell>
              </td>
            </tr>
          );
        })}
      </Table>

      {detail && <IssueDetailDrawer entry={detail} state={state} dispatch={dispatch} currentUser={currentUser} canDo={canDo} onClose={() => setDetail(null)} />}
      {showScan && <ScanReportModal onClose={() => setShowScan(false)} />}
      {showManual && <ManualEntryModal state={state} currentUser={currentUser} onClose={() => setShowManual(false)} onSave={handleSave} />}
    </Page>
  );
}

/* ═════════════════════════ 换件记录 Tab ═════════════════════════ */
// 旧件状态展示映射：只用 待返修 / 返修中 / 已返修 / 已停用（报废等一律归为已停用）。
function displayOldPartStatus(raw) {
  const s = String(raw || '');
  if (!s || s === '—') return '—';
  if (s.includes('报废') || s.includes('停用')) return '已停用';
  if (s.includes('已返修')) return '已返修';
  if (s.includes('返修中') || s.includes('维修中')) return '返修中';
  return '待返修'; // 待返修 / 待评估 等待处理态
}

// 换件记录只读：源自售后工单的换件动作 + ERP 领料 / 出库申请，不做独立库存流程。
function replacementView(state, mr) {
  const wo = allWorkOrders(state).find((w) => w.id === mr.workOrderId) || null;
  const device = (state.devices || []).find((d) => d.id === mr.deviceId) || null;
  const project = findProject(state, device?.projectId || wo?.projectId);
  const removed = materialOf(state, mr.removedMaterialId);
  const added = materialOf(state, mr.addedMaterialId);
  return {
    mr, wo, device, project, removed, added,
    sourceQI: wo ? sourceIssueIdOf(state, wo) : null,
    location: locationOfDevice(state, device),
    coreType: removed?.category || added?.category || '—',
    oldSN: removed?.sn || '—',
    oldStatus: displayOldPartStatus(mr.removedDisposition || removed?.status),
    newSN: added?.sn || '—',
    newSource: added?.supplier || '—',
  };
}

// 核心部件追溯（原型占位）：只读展示旧件 / 新件模块信息，并提供前往部件台账。
function ModuleTraceModal({ title, material, fallbackSN, onClose }) {
  return (
    <Modal isOpen onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Chip>原型占位</Chip><span className="text-xs text-gray-400">核心部件追溯（只读）</span></div>
        <DescList items={[
          ['部件 SN', material?.sn || fallbackSN],
          ['核心部件类型', material?.category],
          ['型号', material?.model],
          ['批次号', material?.batchNo],
          ['来源 / 供应商', material?.supplier],
          ['当前状态', material?.status ? <StatusBadge status={material.status} /> : '—'],
        ]} />
        <div className="flex items-center justify-between pt-1">
          <LinkAction to="/assets?tab=materials">前往资产 · 核心部件追溯 →</LinkAction>
          <Btn variant="secondary" onClick={onClose}>关闭</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ERP 领料单只读详情（原型占位）：平台不写 ERP，仅展示同步字段。
function ErpPickingModal({ mr, deviceSN, onClose }) {
  return (
    <Modal isOpen onClose={onClose} title="ERP 领料单 · 只读详情">
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Chip>ERP 只读</Chip><span className="text-xs text-gray-400">由 ERP 同步，平台不可编辑</span></div>
        <DescList items={[
          ['领料单号 / 出库申请单号', mr.erpPickingNo],
          ['ERP 领料状态', mr.erpPickingStatus ? <StatusBadge status={mr.erpPickingStatus} /> : '—'],
          ['关联售后工单', mr.workOrderId],
          ['设备 SN', deviceSN],
          ['换件时间', mr.timestamp],
          ['操作人', mr.operator],
        ]} />
        <Card className="bg-[#fafafa] text-xs text-gray-500">领料 / 出库明细以 ERP 为准，此处为原型占位只读视图，不做库存增减。</Card>
        <div className="flex justify-end"><Btn variant="secondary" onClick={onClose}>关闭</Btn></div>
      </div>
    </Modal>
  );
}

// 换件记录详情跳转：能定位到对象则可点，否则灰显不可点。
function JumpLink({ enabled, to, onClick, children, hint }) {
  if (enabled) return to ? <LinkAction to={to}>{children}</LinkAction> : <LinkAction onClick={onClick}>{children}</LinkAction>;
  return <span className="text-[13px] text-gray-300 cursor-not-allowed" title={hint || '暂无可跳转对象'}>{children}</span>;
}

function ReplacementDetailDrawer({ id, state, onClose }) {
  const [modal, setModal] = useState(null);
  const mr = (state.moduleReplacements || []).find((r) => r.id === id);
  if (!mr) return null;
  const v = replacementView(state, mr);
  const logs = [{ time: mr.timestamp, operator: mr.operator, notes: mr.notes || '完成换件' }];
  const deviceSN = v.device?.sn || mr.deviceId;
  const woLink = mr.workOrderId ? `/after-sales?tab=orders&highlight=${mr.workOrderId}` : undefined;
  return (
    <Drawer open onClose={onClose} title={mr.id} subtitle="换件记录（只读）"
      chips={<>
        <Chip>{v.coreType}</Chip>
        {mr.workOrderId && <LinkAction to={woLink}>售后工单 {mr.workOrderId}</LinkAction>}
        {v.sourceQI && <span className="text-xs text-gray-500">来源问题 {v.sourceQI}</span>}
      </>}>
      <Card className="bg-[#fafafa] text-xs text-gray-500 leading-relaxed">
        换件记录为只读，源于售后工单的换件动作与 ERP 领料 / 出库申请。此处不新增或扣减库存，如需处理请前往关联售后工单。
      </Card>
      <DrawerSection title="关联跳转">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <JumpLink enabled={!!mr.workOrderId} to={woLink} hint="无关联售后工单">查看售后工单</JumpLink>
          <JumpLink enabled={!!v.device?.id} to={v.device?.id ? `/devices/${v.device.id}` : undefined} hint="无关联设备">查看设备详情</JumpLink>
          <JumpLink enabled={!!v.removed} onClick={() => setModal('old')} hint="无旧件模块信息">查看旧件模块详情</JumpLink>
          <JumpLink enabled={!!v.added} onClick={() => setModal('new')} hint="无新件模块信息">查看新件模块详情</JumpLink>
          <JumpLink enabled={!!mr.erpPickingNo} onClick={() => setModal('erp')} hint="无 ERP 领料单">查看 ERP 领料单</JumpLink>
        </div>
      </DrawerSection>
      <DrawerSection title="关联对象">
        <DescList items={[
          ['换件记录编号', <span className="font-mono">{mr.id}</span>],
          ['售后工单号', mr.workOrderId ? <LinkAction to={woLink}>{mr.workOrderId}</LinkAction> : '—'],
          ['来源问题编号', v.sourceQI || '—'],
          ['项目名称', v.project?.name],
          ['客户名称', v.project?.client],
          ['设备 SN', deviceSN],
          ['点位 / 地址', locLabel(v.location)],
        ]} />
      </DrawerSection>
      <DrawerSection title="部件与 ERP 领料">
        <DescList items={[
          ['核心部件类型', v.coreType],
          ['旧件 SN', v.oldSN],
          ['旧件状态', v.oldStatus && v.oldStatus !== '—' ? <StatusBadge status={v.oldStatus} /> : '—'],
          ['新件 SN', v.newSN],
          ['新件来源', v.newSource],
          ['ERP 领料单号 / 出库申请单号', mr.erpPickingNo],
          ['ERP 领料状态', mr.erpPickingStatus],
        ]} />
      </DrawerSection>
      <DrawerSection title="换件说明">
        <DescList items={[
          ['换件原因', mr.reason],
          ['换件说明', mr.notes],
          ['换件时间', mr.timestamp],
          ['操作人', mr.operator],
          ['现场照片 / log', mr.photo || mr.photoLog || mr.logFile],
        ]} />
      </DrawerSection>
      <DrawerSection title="操作日志"><LogTimeline logs={logs} /></DrawerSection>

      {modal === 'old' && <ModuleTraceModal title="旧件模块详情" material={v.removed} fallbackSN={v.oldSN} onClose={() => setModal(null)} />}
      {modal === 'new' && <ModuleTraceModal title="新件模块详情" material={v.added} fallbackSN={v.newSN} onClose={() => setModal(null)} />}
      {modal === 'erp' && <ErpPickingModal mr={mr} deviceSN={deviceSN} onClose={() => setModal(null)} />}
    </Drawer>
  );
}

function ReplacementsTab({ state }) {
  const [search, setSearch] = useState('');
  const [fProject, setFProject] = useState('');
  const [fCore, setFCore] = useState('');
  const [fOperator, setFOperator] = useState('');
  const [detail, setDetail] = useState(null);

  const rows = (state.moduleReplacements || []).map((mr) => replacementView(state, mr));
  const operators = [...new Set(rows.map((r) => r.mr.operator).filter(Boolean))];
  const coreTypes = [...new Set(rows.map((r) => r.coreType).filter((c) => c && c !== '—'))];

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    return (!q || (r.mr.id || '').toLowerCase().includes(q) || (r.device?.sn || '').toLowerCase().includes(q) || (r.mr.workOrderId || '').toLowerCase().includes(q))
      && (!fProject || r.project?.id === fProject)
      && (!fCore || r.coreType === fCore)
      && (!fOperator || r.mr.operator === fOperator);
  }).sort((a, b) => (b.mr.timestamp || '').localeCompare(a.mr.timestamp || ''));
  const pager = usePaged(filtered, 10);

  return (
    <Page>
      <PageHeader
        breadcrumb={<div className="text-xs text-gray-400">售后管理 / 换件记录</div>}
        title="换件记录"
        description="售后工单产生的核心部件更换记录（只读），关联售后工单与 ERP 领料 / 出库申请，用于追溯，不承载库存流程。"
      />
      <StatGrid cols={3}>
        <StatCard label="换件记录数" value={rows.length} />
        <StatCard label="涉及设备" value={new Set(rows.map((r) => r.mr.deviceId)).size} />
        <StatCard label="关联售后工单" value={new Set(rows.map((r) => r.mr.workOrderId).filter(Boolean)).size} />
      </StatGrid>

      <Card className="bg-[#fafafa] text-xs text-gray-500 leading-relaxed">
        换件记录只做只读留痕与跳转到售后工单，不提供新增 / 扣减库存等动作。ERP 领料单号 / 出库申请单号与领料状态由 ERP 同步，缺失显示「—」。
      </Card>

      <Toolbar right={<span className="text-xs text-gray-400">共 {filtered.length} 条</span>}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索记录编号 / 设备 SN / 工单号" className="w-60" />
        <Select value={fProject} onChange={(e) => setFProject(e.target.value)}><option value="">全部项目</option>{(state.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={fCore} onChange={(e) => setFCore(e.target.value)}><option value="">全部核心部件类型</option>{coreTypes.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={fOperator} onChange={(e) => setFOperator(e.target.value)}><option value="">全部操作人</option>{operators.map((o) => <option key={o}>{o}</option>)}</Select>
      </Toolbar>

      <Table
        className="text-[12px]"
        head={['换件记录编号', '售后工单号', '来源问题编号', '项目名称', '客户名称', '设备 SN', '点位 / 地址', '核心部件类型', '旧件 SN', '旧件状态', '新件 SN', '新件来源', 'ERP 领料单号 / 出库申请单号', 'ERP 领料状态', '换件原因', '换件说明', '换件时间', '操作人', '现场照片 / log', '操作日志', '操作']}
        empty="暂无换件记录"
        footer={<Pagination page={pager.page} total={pager.total} totalPages={pager.totalPages} onChange={pager.setPage} />}
      >
        {pager.pageItems.map((r) => {
          const { mr } = r;
          return (
            <tr key={mr.id} className="hover:bg-[#fafafa] transition-colors">
              <td className="px-3 py-2 font-mono whitespace-nowrap"><LinkAction onClick={() => setDetail(mr.id)}>{mr.id}</LinkAction></td>
              <td className="px-3 py-2 whitespace-nowrap">{mr.workOrderId ? <LinkAction to={`/after-sales?tab=orders&highlight=${mr.workOrderId}`}>{mr.workOrderId}</LinkAction> : '—'}</td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{r.sourceQI || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.project?.name || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.project?.client || '—'}</td>
              <td className="px-3 py-2 font-mono text-gray-800 whitespace-nowrap">{r.device?.sn || mr.deviceId || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{locLabel(r.location)}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.coreType}</td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{r.oldSN}</td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={r.oldStatus} /></td>
              <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{r.newSN}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.newSource}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{mr.erpPickingNo || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{mr.erpPickingStatus || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{mr.reason || '—'}</td>
              <td className="px-3 py-2 text-gray-600 max-w-[200px]"><div className="truncate" title={mr.notes}>{mr.notes || '—'}</div></td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{mr.timestamp || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{mr.operator || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{mr.photo || mr.photoLog || mr.logFile || '—'}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{mr.operator ? `${mr.operator} · ${mr.timestamp}` : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><LinkAction onClick={() => setDetail(mr.id)}>查看详情</LinkAction></td>
            </tr>
          );
        })}
      </Table>

      {detail && <ReplacementDetailDrawer id={detail} state={state} onClose={() => setDetail(null)} />}
    </Page>
  );
}

/* ═════════════════════════ Main ═════════════════════════ */
export default function AfterSalesPage() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab = raw === 'quality' ? 'issues' : (raw || 'issues'); // 旧 key 兼容：quality → issues
  const activeTab = ['issues', 'orders', 'replacements'].includes(tab) ? tab : 'issues';
  const shared = { state, dispatch, canDo, currentUser: state.currentUser };

  if (activeTab === 'orders') return <OrdersTab {...shared} />;
  if (activeTab === 'replacements') return <ReplacementsTab {...shared} />;
  return <IssuesTab {...shared} />;
}
