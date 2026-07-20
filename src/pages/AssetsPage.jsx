import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Materials from './Materials';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Pagination, usePaged } from '../components/Pagination';
import { Page, PageHeader, Toolbar, Select, SearchInput, StatCard, StatGrid, Table, Btn, LinkAction } from '../components/ui';
import { deviceLifecycleStatus } from '../utils/status';

// 资产管理二级：仅「物料零部件」「设备台账」两个 tab（物料在前、设备在后，默认设备）。
// 设备类型 / 点位管理已从资产管理移除，不在此渲染。
const TABS = [
  { key: 'materials', label: '物料零部件' },
  { key: 'devices', label: '设备台账' },
];

const LIFECYCLE_STATUSES = ['生产中', '待入库', '待交付', '交付中', '在线运营', '维修中', '已作废'];
const ONLINE_STATES = ['在线', '离线', '未接入', '未知'];

// 时间戳 / ID 生成放在模块作用域，避免在组件渲染期调用不纯函数（react-hooks/purity）。
const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const genId = (prefix) => `${prefix}-${Date.now()}`;

// 在线状态四态推导：在线运营阶段看 device.online；尚未进入运营 → 未接入；其余无法判断 → 未知。
function onlineStateOf(device) {
  const lc = deviceLifecycleStatus(device);
  if (lc === '在线运营') {
    if (device.online === true) return '在线';
    if (device.online === false) return '离线';
    return '未知';
  }
  if (['生产中', '待入库', '待交付', '交付中'].includes(lc)) return '未接入';
  return '未知';
}

// 设备台账内「全部设备 / 健康告警」子视图切换（分段控件，区别于二级下划线 Tab）。
function Segmented({ tabs, value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-gray-50 border border-[#ececec] rounded-lg p-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[13px] font-medium transition-colors ${
            value === t.key ? 'bg-white text-gray-900 border border-[#ececec] shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {t.label}
          {t.badge > 0 && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full leading-5">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ─────────── 健康告警：详情抽屉（保留原有交互与数据接线） ─────────── */
function DrawerSection({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}
function AlertDrawer({ alert, state, dispatch, currentRole, currentUser, onClose }) {
  const { devices, projects, workOrders, deviceTypes = [], locations = [], qualityIssues = [] } = state;

  const device = devices.find(d => d.id === alert.deviceId);
  const deviceType = device ? deviceTypes.find(t => t.id === device.deviceTypeId) : null;
  const project = projects.find(p => p.id === alert.projectId);
  const location = device?.locationId ? locations.find(l => l.id === device.locationId) : null;
  const linkedWO = alert.workOrderId ? workOrders.find(w => w.id === alert.workOrderId) : null;
  const linkedQI = qualityIssues.find(q => q.sourceAlertId === alert.id) || null;
  const onlineState = device ? onlineStateOf(device) : '未知';

  const now = nowStamp;
  const roleOK = ['运维工程师', '维修工程师', '厂长', '管理员'].includes(currentRole);
  const closed = ['已解决', '已关闭'].includes(alert.status);
  // 告警不等于售后工单：未关闭且未生成时可分别生成问题池记录 / 售后工单。
  const canGenerateWO = roleOK && !closed && !alert.workOrderId;
  const canGenerateQI = roleOK && !closed && !linkedQI;
  const canClose = roleOK && !closed;

  const handleGenerateWorkOrder = () => {
    const t = now();
    const woId = genId('WO');
    dispatch({ type: 'ADD_WORK_ORDER', payload: { id: woId, woClass: '其他问题工单', involvesReplacement: false, deviceId: alert.deviceId, deviceSN: alert.deviceSN, projectId: alert.projectId, description: alert.description, severity: '高', status: '待处理', assignedTo: currentUser, createdAt: t, updatedAt: t, closedAt: null, repairActions: '', replacedModules: [], recheckResult: null, notes: `来自告警 ${alert.id}`, sourceAlertId: alert.id } });
    const newLog = { operator: currentUser, time: t, fromStatus: alert.status, toStatus: '已生成工单', notes: `严重告警，已生成维修工单 ${woId}` };
    dispatch({ type: 'UPDATE_ALERT', payload: { id: alert.id, status: '已生成工单', workOrderId: woId, processLogs: [...(alert.processLogs || []), newLog] } });
    onClose();
  };
  const handleGenerateQualityIssue = () => {
    const t = now();
    const qiId = genId('QI');
    dispatch({ type: 'ADD_QUALITY_ISSUE', payload: { id: qiId, deviceId: alert.deviceId, deviceSN: alert.deviceSN, deviceName: deviceType?.name || '', locationId: device?.locationId || null, projectId: alert.projectId, issueDesc: alert.description, reporterId: state.currentUserId, reporterName: currentUser, reportTime: t, status: '待处理', source: '手动录入', sourceStage: '在线运营', issueType: '功能异常', severity: alert.severity === '严重' ? '高' : '中', owner: currentUser, linkedWorkOrder: false, sourceAlertId: alert.id, processLogs: [] } });
    dispatch({ type: 'UPDATE_ALERT', payload: { id: alert.id, processLogs: [...(alert.processLogs || []), { operator: currentUser, time: t, fromStatus: alert.status, toStatus: alert.status, notes: `已生成质量问题 ${qiId}` }] } });
    onClose();
  };
  const handleCloseAlert = () => {
    const t = now();
    dispatch({ type: 'UPDATE_ALERT', payload: { id: alert.id, status: '已关闭', processLogs: [...(alert.processLogs || []), { operator: currentUser, time: t, fromStatus: alert.status, toStatus: '已关闭', notes: '手动关闭告警' }] } });
    onClose();
  };

  const field = (label, val) => (
    <div><span className="text-gray-400 text-xs">{label}：</span><span className="text-gray-700">{val ?? '—'}</span></div>
  );

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ececec]">
          <div className="text-sm font-semibold text-gray-800">健康告警详情 · {alert.id}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <DrawerSection title="告警摘要">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {field('告警ID', alert.id)}
              {field('告警时间', alert.alertTime)}
              {field('告警类型', alert.alertType)}
              {field('来源', alert.source)}
              <div><span className="text-gray-400 text-xs">严重程度：</span><StatusBadge status={alert.severity} /></div>
              <div><span className="text-gray-400 text-xs">当前状态：</span><StatusBadge status={alert.status} /></div>
            </div>
            <div className="mt-3">
              <div className="text-gray-400 text-xs mb-1">告警描述</div>
              <div className="text-sm text-gray-800">{alert.description}</div>
            </div>
          </DrawerSection>

          <DrawerSection title="关联设备">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400 text-xs">关联设备SN：</span>{device ? <Link to={`/devices/${device.id}`} className="ui-link">{device.sn}</Link> : (alert.deviceSN || '—')}</div>
              {field('机器人型号', deviceType?.name)}
              <div><span className="text-gray-400 text-xs">所属项目：</span>{project ? <Link to={`/projects/${project.id}`} className="ui-link">{project.name}</Link> : '—'}</div>
              {field('所属点位', location?.name)}
              <div><span className="text-gray-400 text-xs">在线状态：</span><StatusBadge status={onlineState} /></div>
            </div>
          </DrawerSection>

          <DrawerSection title="关联记录">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-xs">关联问题编号：</span>
                {linkedQI
                  ? <LinkAction to="/after-sales?tab=issues">查看问题（{linkedQI.id}）</LinkAction>
                  : canGenerateQI
                    ? <Btn variant="secondary" size="sm" onClick={handleGenerateQualityIssue}>生成问题记录</Btn>
                    : <span className="text-gray-400">未生成</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-xs">关联售后工单号：</span>
                {alert.workOrderId
                  ? <LinkAction to="/after-sales?tab=orders">查看售后工单（{alert.workOrderId}{linkedWO ? ` · ${linkedWO.status}` : ''}）</LinkAction>
                  : canGenerateWO
                    ? <Btn variant="secondary" size="sm" onClick={handleGenerateWorkOrder}>生成售后工单</Btn>
                    : <span className="text-gray-400">未生成</span>}
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="飞书通知记录">
            {alert.notifiedUsers && alert.notifiedUsers.length > 0 ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between text-xs text-blue-700 mb-2">
                  <span className="font-medium">飞书通知{alert.notifyStatus || '已送达'}</span>
                  <span className="text-blue-400">{alert.notifiedAt || alert.alertTime}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.notifiedUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-2 py-0.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{u.name[0]}</div>
                      <span className="text-xs text-gray-700 font-medium">{u.name}</span>
                      <span className="text-xs text-gray-400">（{u.role}）</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </DrawerSection>

          <DrawerSection title="处理记录">
            {alert.processLogs && alert.processLogs.length > 0 ? (
              <div className="space-y-2">
                {alert.processLogs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-0.5 flex-shrink-0" />
                      {i < alert.processLogs.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="flex items-center gap-2 text-gray-500 mb-0.5 flex-wrap">
                        <span>{log.time}</span>
                        <span className="font-medium text-gray-700">{log.operator}</span>
                        <span>·</span>
                        <StatusBadge status={log.fromStatus} />
                        <span className="text-gray-400">→</span>
                        <StatusBadge status={log.toStatus} />
                      </div>
                      <div className="text-gray-700">{log.notes}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <span className="text-sm text-gray-400">暂无处理记录</span>}
          </DrawerSection>
        </div>

        <div className="border-t border-[#ececec] px-5 py-3 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {device
              ? <Btn as="link" to={`/devices/${device.id}`} variant="secondary" size="sm">查看设备详情</Btn>
              : <span className="px-2.5 h-7 inline-flex items-center text-xs text-gray-300 border border-gray-200 rounded-md cursor-not-allowed">查看设备详情</span>}
            {canGenerateQI
              ? <Btn variant="secondary" size="sm" onClick={handleGenerateQualityIssue}>生成问题记录</Btn>
              : <span className="px-2.5 h-7 inline-flex items-center text-xs text-gray-300 border border-gray-200 rounded-md cursor-not-allowed" title={linkedQI ? `已生成问题 ${linkedQI.id}` : closed ? '告警已关闭' : '无生成权限'}>生成问题记录</span>}
            {canGenerateWO
              ? <Btn variant="danger" size="sm" onClick={handleGenerateWorkOrder}>生成售后工单</Btn>
              : <span className="px-2.5 h-7 inline-flex items-center text-xs text-gray-300 border border-gray-200 rounded-md cursor-not-allowed" title={alert.workOrderId ? `已生成工单 ${alert.workOrderId}` : closed ? '告警已关闭' : '无生成权限'}>生成售后工单</span>}
            {canClose
              ? <Btn variant="secondary" size="sm" onClick={handleCloseAlert}>关闭告警</Btn>
              : <span className="px-2.5 h-7 inline-flex items-center text-xs text-gray-300 border border-gray-200 rounded-md cursor-not-allowed" title="告警已关闭">关闭告警</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

const ALERT_TYPES = ['电池异常', '温度异常', '通信中断', '传感器异常', '导航异常', '机械结构', '其他'];
const ALERT_OWNERS = ['张三', '李四', '王五', '赵六'];
function AddAlertModal({ isOpen, onClose, onSave, devices, projects = [], locations = [] }) {
  const [form, setForm] = useState({ deviceId: '', alertType: '电池异常', severity: '轻微', description: '', source: '人工上报', owner: '', notes: '' });
  const inp = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500';
  const device = devices.find(d => d.id === form.deviceId);
  const projName = device ? (projects.find(p => p.id === device.projectId)?.name || '—') : '';
  const locName = device ? (locations.find(l => l.id === device.locationId)?.name || '—') : '';
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, deviceSN: device?.sn || '', projectId: device?.projectId || null, locationId: device?.locationId || null });
    onClose();
    setForm({ deviceId: '', alertType: '电池异常', severity: '轻微', description: '', source: '人工上报', owner: '', notes: '' });
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增健康告警" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">设备SN *</label>
            <select className={inp} required value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })}>
              <option value="">-- 选择设备 --</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.sn}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">告警类型 *</label>
            <select className={inp} value={form.alertType} onChange={e => setForm({ ...form, alertType: e.target.value })}>
              {ALERT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">所属项目</label><input className={`${inp} bg-gray-50`} readOnly value={projName} placeholder="选择设备后自动带出" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">所属点位</label><input className={`${inp} bg-gray-50`} readOnly value={locName} placeholder="选择设备后自动带出" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
            <select className={inp} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              <option>轻微</option><option>严重</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
            <select className={inp} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              <option>人工上报</option><option>系统监测</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
            <select className={inp} value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}>
              <option value="">-- 待指派 --</option>
              {ALERT_OWNERS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">附件</label><input className={`${inp} bg-gray-50 text-gray-400`} disabled placeholder="（原型占位）支持上传日志 / 图片" /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">告警描述 *</label>
          <textarea rows={3} className={inp} required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={2} className={inp} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} type="button">取消</Btn>
          <Btn variant="primary" type="submit">保存</Btn>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────── 健康告警子视图 ─────────── */
function AlertsSubTab({ state, dispatch, currentRole, initialSN = '', onClearSN }) {
  const [filterSeverity, setFilterSeverity] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  // 初值来自 initialSN；从设备台账「查看告警」跳转时由父级 key 重挂载重新初始化，避免 effect 内 setState。
  const [snQuery, setSnQuery] = useState(initialSN);
  const [drawerAlertId, setDrawerAlertId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { alerts, devices, projects, locations = [] } = state;
  const currentUser = state.currentUser;
  const onlineDevices = devices.filter(d => d.status === '在线运营');
  const canAdd = ['运维工程师', '维修工程师', '厂长', '管理员'].includes(currentRole);
  const getProjectName = id => projects.find(p => p.id === id)?.name || '—';

  const snq = snQuery.trim().toLowerCase();
  const filtered = [...alerts]
    .filter(a => {
      const matchSev = filterSeverity === '全部' || a.severity === filterSeverity;
      const matchSt = filterStatus === '全部' || a.status === filterStatus;
      const matchSN = !snq || (a.deviceSN || '').toLowerCase().includes(snq);
      return matchSev && matchSt && matchSN;
    })
    .sort((a, b) => b.alertTime.localeCompare(a.alertTime));
  const clearSN = () => { setSnQuery(''); onClearSN && onClearSN(); };

  const paged = usePaged(filtered, 10);
  const isOpenAlert = (a) => !['已解决', '已关闭'].includes(a.status);
  const unclosedCount = alerts.filter(isOpenAlert).length;
  const severeCount = alerts.filter(a => a.severity === '严重' && isOpenAlert(a)).length;

  const handleSave = (form) => {
    const now = nowStamp();
    const device = devices.find(d => d.id === form.deviceId);
    const notifiedUsers = [{ name: '赵六', role: '运维工程师' }, { name: form.severity === '严重' ? '李七' : '蔡八', role: form.severity === '严重' ? '厂长' : '项目负责人' }];
    dispatch({ type: 'ADD_ALERT', payload: { id: genId('ALERT'), deviceId: form.deviceId, projectId: form.projectId ?? device?.projectId ?? null, locationId: form.locationId ?? device?.locationId ?? null, deviceSN: form.deviceSN, alertType: form.alertType, owner: form.owner, notes: form.notes, alertTime: now, source: form.source, severity: form.severity, description: form.description, status: '待处理', workOrderId: null, notifiedUsers, processLogs: [] } });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        健康告警记录设备在线运营过程中的健康异常，不等同于质量问题台账或工单中心；需处理的可生成工单，需沉淀的可生成质量问题。
      </p>
      <Toolbar right={canAdd && <Btn variant="primary" size="sm" onClick={() => setShowModal(true)}>+ 新增告警</Btn>}>
        <SearchInput placeholder="按设备 SN 筛选" value={snQuery} onChange={e => setSnQuery(e.target.value)} className="w-48" />
        <Select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="全部">全部程度</option><option value="轻微">轻微</option><option value="严重">严重</option>
        </Select>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {['全部', '待处理', '处理中', '工单处理中', '已生成工单', '已解决', '已关闭'].map(o => <option key={o} value={o}>{o === '全部' ? '全部状态' : o}</option>)}
        </Select>
        <span className="text-xs text-gray-400">
          {severeCount > 0 && <span className="text-red-600 font-medium mr-2">{severeCount} 严重未关闭</span>}
          共 {unclosedCount} 条未关闭
        </span>
      </Toolbar>

      {snq && (
        <div className="flex items-center gap-3 bg-gray-50 border border-[#ececec] rounded-lg px-4 py-2 text-[13px] text-gray-600">
          <span>仅展示设备 <span className="font-mono font-medium text-gray-800">{snQuery}</span> 的健康告警（共 {filtered.length} 条）</span>
          <button onClick={clearSN} className="ml-auto ui-link text-xs">清除筛选</button>
        </div>
      )}

      <Table
        head={['告警时间', '设备SN', '项目', '严重程度', '描述', '状态', '操作']}
        empty="暂无告警记录"
        footer={<Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} />}
      >
        {paged.pageItems.map(a => (
          <tr key={a.id} className="hover:bg-[#fafafa] cursor-pointer" onClick={() => setDrawerAlertId(a.id)}>
            <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{a.alertTime}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <Link to={`/devices/${a.deviceId}`} className="ui-link font-mono text-xs" onClick={e => e.stopPropagation()}>{a.deviceSN}</Link>
            </td>
            <td className="px-3 py-2 text-xs whitespace-nowrap">
              {a.projectId ? <Link to={`/projects/${a.projectId}`} className="ui-link" onClick={e => e.stopPropagation()}>{getProjectName(a.projectId)}</Link> : <span className="text-gray-400">—</span>}
            </td>
            <td className="px-3 py-2"><StatusBadge status={a.severity} /></td>
            <td className="px-3 py-2 text-gray-600 text-xs max-w-xs"><span className="truncate block">{a.description}</span></td>
            <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
            <td className="px-3 py-2 text-xs whitespace-nowrap"><span className="ui-link">查看详情</span></td>
          </tr>
        ))}
      </Table>

      {showModal && <AddAlertModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSave} devices={onlineDevices} projects={projects} locations={locations} />}
      {drawerAlertId && (() => {
        const a = alerts.find(x => x.id === drawerAlertId);
        return a ? <AlertDrawer alert={a} state={state} dispatch={dispatch} currentRole={currentRole} currentUser={currentUser} onClose={() => setDrawerAlertId(null)} /> : null;
      })()}
    </div>
  );
}

/* ─────────── 设备台账（全部设备） ─────────── */
function AllDevicesSubTab({ state, goAlerts }) {
  const [f, setF] = useState({ q: '', deviceType: '', project: '', projType: '', lifecycle: '', online: '' });
  const upd = (k, v) => setF(s => ({ ...s, [k]: v }));

  const { devices, deviceTypes, projects, locations = [], qualityIssues = [], alerts = [] } = state;
  const typeName = id => deviceTypes.find(t => t.id === id)?.name || id || '—';
  const projectOf = id => projects.find(p => p.id === id);
  const locName = id => (id ? (locations.find(l => l.id === id)?.name || '—') : '—');
  const openIssuesOf = id => qualityIssues.filter(q => q.deviceId === id && q.status !== '已关闭').length;
  const openAlertsOf = id => alerts.filter(a => a.deviceId === id && !['已解决', '已关闭'].includes(a.status)).length;
  const projTypes = [...new Set(projects.map(p => p.projectType).filter(Boolean))];

  const rows = devices.map(d => {
    const proj = projectOf(d.projectId);
    return {
      ...d,
      model: typeName(d.deviceTypeId),
      lifecycle: deviceLifecycleStatus(d),
      onlineState: onlineStateOf(d),
      projName: proj?.name || '—',
      client: proj?.client || '—',
      projType: proj?.projectType || '—',
      loc: locName(d.locationId),
      openIssues: openIssuesOf(d.id),
      openAlerts: openAlertsOf(d.id),
    };
  });

  const filtered = rows.filter(d => {
    const q = f.q.trim().toLowerCase();
    return (!q || d.sn.toLowerCase().includes(q) || (d.model || '').toLowerCase().includes(q))
      && (!f.deviceType || d.deviceTypeId === f.deviceType)
      && (!f.project || d.projectId === f.project)
      && (!f.projType || d.projType === f.projType)
      && (!f.lifecycle || d.lifecycle === f.lifecycle)
      && (!f.online || d.onlineState === f.online);
  }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const paged = usePaged(filtered, 10);

  const total = rows.length;
  const producing = rows.filter(d => d.lifecycle === '生产中').length;
  const online = rows.filter(d => d.onlineState === '在线').length;
  const openIssuesTotal = rows.reduce((s, d) => s + d.openIssues, 0);

  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard label="设备总数" value={total} />
        <StatCard label="生产中" value={producing} />
        <StatCard label="在线设备" value={online} tone="success" />
        <StatCard label="未关闭问题" value={openIssuesTotal} tone={openIssuesTotal ? 'warning' : 'default'} />
      </StatGrid>

      <Toolbar right={<span className="text-xs text-gray-400">共 {filtered.length} 台</span>}>
        <SearchInput placeholder="搜索设备 SN / 机器人型号" value={f.q} onChange={e => upd('q', e.target.value)} className="w-56" />
        <Select value={f.deviceType} onChange={e => upd('deviceType', e.target.value)}><option value="">全部型号</option>{deviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select value={f.project} onChange={e => upd('project', e.target.value)}><option value="">全部项目</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select value={f.projType} onChange={e => upd('projType', e.target.value)}><option value="">全部业务场景</option>{projTypes.map(t => <option key={t}>{t}</option>)}</Select>
        <Select value={f.lifecycle} onChange={e => upd('lifecycle', e.target.value)}><option value="">全部状态</option>{LIFECYCLE_STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
        <Select value={f.online} onChange={e => upd('online', e.target.value)}><option value="">全部在线状态</option>{ONLINE_STATES.map(s => <option key={s}>{s}</option>)}</Select>
      </Toolbar>

      <Table
        head={['设备 SN', '机器人型号', '所属项目', '客户名称', '项目类型/业务场景', '所属点位', '当前状态', '在线状态', '未关闭问题数', '最近更新时间', '操作']}
        footer={<Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} />}
      >
        {paged.pageItems.map(d => (
          <tr key={d.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 whitespace-nowrap"><Link to={`/devices/${d.id}`} className="ui-link font-mono text-xs font-medium">{d.sn}</Link></td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{d.model}</td>
            <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{d.projName}</td>
            <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{d.client}</td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.projType}</td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.loc}</td>
            <td className="px-3 py-2"><StatusBadge status={d.lifecycle} /></td>
            <td className="px-3 py-2"><StatusBadge status={d.onlineState} /></td>
            <td className="px-3 py-2 text-xs">{d.openIssues > 0 ? <span className="text-amber-600 font-medium">{d.openIssues}</span> : <span className="text-gray-300">0</span>}</td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.updatedAt || '—'}</td>
            <td className="px-3 py-2 text-xs whitespace-nowrap">
              <div className="flex items-center gap-3">
                <LinkAction to={`/devices/${d.id}`}>查看详情</LinkAction>
                {d.openAlerts > 0 && <LinkAction onClick={() => goAlerts && goAlerts(d.sn)}>查看告警</LinkAction>}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function DevicesTab() {
  const { state, dispatch } = useApp();
  const { currentRole } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const subtab = searchParams.get('subtab') || 'all';
  const activeSubTab = ['all', 'alerts'].includes(subtab) ? subtab : 'all';
  const alertSN = searchParams.get('alertSN') || '';
  const pendingAlerts = (state.alerts || []).filter(a => !['已解决', '已关闭'].includes(a.status)).length;

  const setSubTab = (key, sn) => {
    const next = new URLSearchParams(searchParams);
    next.set('subtab', key);
    if (sn) next.set('alertSN', sn); else next.delete('alertSN');
    setSearchParams(next);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="设备台账"
        description="按设备 SN 记录履历与在线状态；健康告警记录在线运营异常，可生成问题记录或售后工单。平台只读同步各业务模块数据。"
      />
      <Segmented
        tabs={[{ key: 'all', label: '全部设备' }, { key: 'alerts', label: '健康告警', badge: pendingAlerts }]}
        value={activeSubTab}
        onChange={(k) => setSubTab(k)}
      />
      {activeSubTab === 'all'
        ? <AllDevicesSubTab state={state} goAlerts={(sn) => setSubTab('alerts', sn)} />
        : <AlertsSubTab key={alertSN || 'all'} state={state} dispatch={dispatch} currentRole={currentRole} initialSN={alertSN} onClearSN={() => setSubTab('alerts')} />}
    </div>
  );
}

/* ─────────── Main ─────────── */
export default function AssetsPage() {
  // 二级菜单（左侧）通过 ?tab= 切换两块台账，页面内不再重复渲染横向 Tab；
  // 各块自带 PageHeader 标题/说明。
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'devices';
  const activeTab = TABS.some(t => t.key === tab) ? tab : 'devices';

  return (
    <Page>
      {activeTab === 'materials' && <Materials />}
      {activeTab === 'devices' && <DevicesTab />}
    </Page>
  );
}
