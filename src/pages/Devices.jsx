import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import DeviceTypes from './DeviceTypes';
import WorkOrders from './WorkOrders';

const STATUS_CHIPS = [
  { key: '全部',      color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { key: '装配中',    color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '整机装配',  color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '功能测试中', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '老化测试中', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: '终测中',    color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: '待分配项目', color: 'bg-green-100 text-green-700 border-green-300' },
  { key: '已分配项目', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { key: '在线运营',  color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { key: '退役',     color: 'bg-gray-200 text-gray-500 border-gray-300' },
  { key: '返修中',    color: 'bg-red-100 text-red-700 border-red-300' },
  { key: '半成品检验中', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '初测中',    color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '中测中',    color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'OQT终测中', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: '生产返修中', color: 'bg-red-100 text-red-700 border-red-300' },
];

const NOW_DATE = new Date('2026-06-22');
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr.replace(' ', 'T'));
  return Math.floor((NOW_DATE - d) / 86400000);
}

const CAN_UPDATE_ALERT = ['运维工程师', '维修工程师', '厂长', '管理员'];

/* ============================ Tab 1: 全部设备 ============================ */
function AllDevicesTab({ devices, getTypeName, projects }) {
  const [filterStatus, setFilterStatus] = useState('全部');
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const s = searchParams.get('status');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setFilterStatus(s);
  }, [searchParams]);

  const total = devices.length;
  const inProgress = devices.filter((d) =>
    ['装配中', '整机装配', '功能测试中', '老化测试中', '终测中', '返修中'].includes(d.status)
  ).length;
  const online = devices.filter((d) => d.status === '在线运营').length;
  const readyToAssign = devices.filter((d) => d.status === '待分配项目').length;

  const statusCounts = STATUS_CHIPS.slice(1).reduce((acc, c) => {
    acc[c.key] = devices.filter((d) => d.status === c.key).length;
    return acc;
  }, {});

  const filtered = devices.filter((d) => {
    const matchStatus = filterStatus === '全部' || d.status === filterStatus;
    const matchSearch = !search ||
      d.sn.toLowerCase().includes(search.toLowerCase()) ||
      getTypeName(d.deviceTypeId).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '设备总数',    value: total,          color: 'border-slate-500' },
          { label: '在制/进行中', value: inProgress,     color: 'border-blue-500' },
          { label: '在线运营',      value: online,         color: 'border-emerald-500' },
          { label: '待分配项目',  value: readyToAssign,  color: 'border-emerald-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 ${color}`}>
            <div className="text-3xl font-semibold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips + search */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <button onClick={() => setFilterStatus('全部')}
          className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
            filterStatus === '全部' ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300 hover:border-slate-400'
          }`}>
          全部 <span className="ml-1">{total}</span>
        </button>
        {STATUS_CHIPS.slice(1).map((c) => (
          statusCounts[c.key] > 0 && (
            <button key={c.key} onClick={() => setFilterStatus(c.key)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                filterStatus === c.key
                  ? 'bg-slate-700 text-white border-slate-700'
                  : `${c.color} hover:brightness-95`
              }`}>
              {c.key} <span className="ml-1 font-bold">{statusCounts[c.key]}</span>
            </button>
          )
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input type="text" placeholder="搜索SN / 类型..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-44" />
          <span className="text-sm text-gray-400">共 {filtered.length} 台</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['设备SN', '整机类型', '所属项目', '当前状态', '装配人', '最近更新', '在此状态天数', '操作'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((d) => {
              const days = daysSince(d.updatedAt || d.assemblyTime);
              const isStuck = days > 2 && ['功能测试中', '老化测试中', '终测中', '装配中'].includes(d.status);
              const project = d.projectId ? projects.find((p) => p.id === d.projectId) : null;
              return (
                <tr key={d.id} className={`transition-colors hover:bg-blue-50 ${isStuck ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2 font-medium text-gray-800 font-mono text-xs">{d.sn}</td>
                  <td className="px-4 py-2 text-gray-600">{getTypeName(d.deviceTypeId)}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {project
                      ? <Link to={`/projects/${project.id}`} className="text-slate-700 hover:text-blue-600 hover:underline">{project.name}</Link>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-2 text-gray-600">{d.assembler}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{d.updatedAt}</td>
                  <td className="px-4 py-2">
                    {days > 0 ? (
                      <span className={`text-xs font-medium ${isStuck ? 'text-amber-600' : 'text-gray-500'}`}>
                        {isStuck && '⚠ '}{days}天
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">今天</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link to={`/devices/${d.id}`} className="text-slate-600 hover:text-slate-800 text-xs hover:underline">
                      查看详情
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Tab 2: 在线运营 ============================ */
function OnlineTab({ devices, projects, getTypeName }) {
  const [filterProject, setFilterProject] = useState('全部');
  const [filterOnline, setFilterOnline] = useState('全部');

  const onlineDevices = devices.filter((d) => d.status === '在线运营');
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || id;

  const filtered = onlineDevices.filter((d) => {
    const matchProj = filterProject === '全部' || d.projectId === filterProject;
    const matchOnline = filterOnline === '全部' || (filterOnline === '在线' && d.online) || (filterOnline === '离线' && !d.online);
    return matchProj && matchOnline;
  });

  const onlineCount = onlineDevices.filter((d) => d.online).length;
  const offlineCount = onlineDevices.filter((d) => !d.online).length;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 border-emerald-500">
          <div className="text-3xl font-semibold text-gray-900">{onlineDevices.length}</div>
          <div className="text-sm text-gray-500 mt-1">运营中设备总数</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 border-green-500">
          <div className="text-3xl font-semibold text-green-700">{onlineCount}</div>
          <div className="text-sm text-gray-500 mt-1">当前在线</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 border-red-400">
          <div className="text-3xl font-semibold text-red-600">{offlineCount}</div>
          <div className="text-sm text-gray-500 mt-1">当前离线</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">项目：</span>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none">
            <option value="全部">全部项目</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">状态：</span>
          {['全部', '在线', '离线'].map((opt) => (
            <button key={opt} onClick={() => setFilterOnline(opt)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                filterOnline === opt ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300 hover:border-slate-400'
              }`}>
              {opt}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-gray-400">共 {filtered.length} 台</span>
      </div>

      {/* Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <div key={d.id} className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-all hover:shadow-md ${d.online ? 'border-emerald-200' : 'border-red-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <Link to={`/devices/${d.id}`} className="font-mono text-sm font-bold text-gray-800 hover:text-slate-600 hover:underline">
                  {d.sn}
                </Link>
                <div className="text-xs text-gray-500 mt-0.5">{getTypeName(d.deviceTypeId)}</div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                d.online
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-red-100 text-red-600 border-red-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${d.online ? 'bg-emerald-500' : 'bg-red-400'}`}></span>
                {d.online ? '在线' : '离线'}
              </span>
            </div>

            <div className="text-xs text-gray-500 mb-3">
              {d.projectId
                ? <Link to={`/projects/${d.projectId}`} className="hover:text-blue-600 hover:underline">{getProjectName(d.projectId)}</Link>
                : '—'}
            </div>

            <div className="space-y-2">
              {/* Battery */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">电量</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${d.batteryPercent >= 50 ? 'bg-green-500' : d.batteryPercent >= 20 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${d.batteryPercent || 0}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right ${d.batteryPercent < 20 ? 'text-red-500' : 'text-gray-700'}`}>
                  {d.batteryPercent ?? '—'}%
                </span>
              </div>
              {/* Storage */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">存储</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${d.storagePercent <= 70 ? 'bg-blue-400' : d.storagePercent <= 85 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${d.storagePercent || 0}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right ${d.storagePercent > 85 ? 'text-red-500' : 'text-gray-700'}`}>
                  {d.storagePercent ?? '—'}%
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              最近心跳：{d.lastHeartbeat || '—'}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">暂无运营中设备</div>
        )}
      </div>
    </div>
  );
}

/* ============================ Tab 3: 健康告警 ============================ */
function AddAlertModal({ isOpen, onClose, onSave, devices }) {
  const [form, setForm] = useState({ deviceId: '', severity: '轻微', description: '', source: '人工上报' });
  const handleSubmit = (e) => {
    e.preventDefault();
    const device = devices.find((d) => d.id === form.deviceId);
    onSave({ ...form, deviceSN: device?.sn || '' });
    onClose();
    setForm({ deviceId: '', severity: '轻微', description: '', source: '人工上报' });
  };
  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增告警">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">设备 *</label>
          <select className={inp} required value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
            <option value="">-- 选择设备 --</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
            <select className={inp} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option>轻微</option>
              <option>严重</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
            <select className={inp} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option>人工上报</option>
              <option>系统自动</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">告警描述 *</label>
          <textarea rows={3} className={inp} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateStatusModal({ isOpen, onClose, onSave, alert }) {
  const nextStatusOptions = alert?.severity === '轻微'
    ? (alert.status === '待处理' ? ['处理中'] : alert.status === '处理中' ? ['已解决'] : [])
    : [];
  const [nextStatus, setNextStatus] = useState(nextStatusOptions[0] || '');
  const [notes, setNotes] = useState('');
  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  if (!alert) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="更新告警状态">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">当前状态：</span>
          <StatusBadge status={alert.status} />
          {nextStatusOptions.length > 0 && <span className="text-gray-400">→</span>}
          {nextStatusOptions.length > 0 && <StatusBadge status={nextStatus || nextStatusOptions[0]} />}
        </div>
        {nextStatusOptions.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新状态</label>
            <select className={inp} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              {nextStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {nextStatusOptions.length === 0 && (
          <p className="text-sm text-gray-500">当前状态无法通过轻微告警流程继续更新。</p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">处理备注 *</label>
          <textarea rows={3} className={inp} required value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="请填写处理说明（如操作步骤、结果等）" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button
            disabled={nextStatusOptions.length === 0 || !notes.trim()}
            onClick={() => { onSave(nextStatus || nextStatusOptions[0], notes); onClose(); }}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40">
            确认更新
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AlertDetail({ alert, state, dispatch, currentRole, currentUser }) {
  const { devices, projects, workOrders } = state;
  const navigate = useNavigate();
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const device = devices.find((d) => d.id === alert.deviceId);
  const project = projects.find((p) => p.id === alert.projectId);
  const linkedWO = alert.workOrderId ? workOrders.find((w) => w.id === alert.workOrderId) : null;

  const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

  const canUpdate = CAN_UPDATE_ALERT.includes(currentRole) && alert.severity === '轻微'
    && ['待处理', '处理中'].includes(alert.status);

  const canGenerateWO = CAN_UPDATE_ALERT.includes(currentRole) && alert.severity === '严重'
    && alert.status === '待处理' && !alert.workOrderId;

  const handleUpdateStatus = (newStatus, notes) => {
    const t = now();
    const newLog = { operator: currentUser, time: t, fromStatus: alert.status, toStatus: newStatus, notes };
    dispatch({
      type: 'UPDATE_ALERT',
      payload: { id: alert.id, status: newStatus, processLogs: [...(alert.processLogs || []), newLog] },
    });
  };

  const handleGenerateWorkOrder = () => {
    const t = now();
    const date = t.slice(0, 10).replace(/-/g, '');
    const woId = `WO-${date}-${String(Date.now()).slice(-3)}`;

    dispatch({
      type: 'ADD_WORK_ORDER',
      payload: {
        id: woId,
        deviceId: alert.deviceId,
        deviceSN: alert.deviceSN,
        projectId: alert.projectId,
        description: alert.description,
        severity: '高',
        status: '待处理',
        assignedTo: currentUser,
        createdAt: t,
        updatedAt: t,
        closedAt: null,
        repairActions: '',
        replacedModules: [],
        recheckResult: null,
        notes: `来自告警 #${alert.id}`,
        sourceAlertId: alert.id,
      },
    });

    const newLog = {
      operator: currentUser, time: t, fromStatus: alert.status, toStatus: '已生成工单',
      notes: `严重告警，已生成维修工单 ${woId}`,
    };
    dispatch({
      type: 'UPDATE_ALERT',
      payload: { id: alert.id, status: '已生成工单', workOrderId: woId, processLogs: [...(alert.processLogs || []), newLog] },
    });
    navigate(`/work-orders?highlight=${woId}`);
  };

  const severityDot = alert.severity === '严重'
    ? 'w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0'
    : 'w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0';

  return (
    <div className="px-6 py-5 space-y-5 bg-slate-50 border-b border-slate-200">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className={`${severityDot} mt-1`} />
          <div>
            <div className="text-sm font-semibold text-gray-800 mb-1">{alert.description}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
              <span>告警时间：{alert.alertTime}</span>
              <span>来源：{alert.source}</span>
              {device && <span>设备：<Link to={`/devices/${device.id}`} className="text-blue-600 hover:underline">{device.sn}</Link></span>}
              {project && <span>项目：<Link to={`/projects/${project.id}`} className="text-blue-600 hover:underline">{project.name}</Link></span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={alert.severity} />
          <StatusBadge status={alert.status} />
        </div>
      </div>

      {alert.notifiedUsers && alert.notifiedUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
          <div className="text-xs font-medium text-blue-700 mb-2">飞书通知已发送</div>
          <div className="flex flex-wrap gap-2">
            {alert.notifiedUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-2 py-0.5">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {u.name[0]}
                </div>
                <span className="text-xs text-gray-700 font-medium">{u.name}</span>
                <span className="text-xs text-gray-400">（{u.role}）</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alert.workOrderId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">关联工单：</span>
          <button
            onClick={() => navigate(`/work-orders?highlight=${alert.workOrderId}`)}
            className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs px-2 py-0.5 rounded-full hover:bg-orange-100 font-medium">
            {alert.workOrderId}
            {linkedWO && <span className="ml-1 text-gray-400">({linkedWO.status})</span>}
          </button>
        </div>
      )}

      {(canUpdate || canGenerateWO) && (
        <div className="flex gap-2 flex-wrap">
          {canUpdate && (
            <button onClick={() => setShowUpdateModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
              更新状态
            </button>
          )}
          {canGenerateWO && (
            <button onClick={handleGenerateWorkOrder}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 font-medium">
              生成维修工单
            </button>
          )}
        </div>
      )}

      {alert.processLogs && alert.processLogs.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">处理记录</div>
          <div className="space-y-2">
            {alert.processLogs.map((log, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-0.5 flex-shrink-0" />
                  {i < alert.processLogs.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2 text-gray-500 mb-0.5">
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
        </div>
      )}

      <UpdateStatusModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSave={handleUpdateStatus}
        alert={alert}
      />
    </div>
  );
}

const ALL_STATUSES = ['全部', '待处理', '处理中', '已解决', '已生成工单', '工单处理中', '已关闭'];

function AlertsTab({ state, dispatch, currentRole, getProjectName }) {
  const [filterSeverity, setFilterSeverity] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [filterProject, setFilterProject] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { alerts, devices, projects } = state;
  const currentUser = state.currentUser;
  const onlineDevices = devices.filter((d) => d.status === '在线运营');

  const canAdd = CAN_UPDATE_ALERT.includes(currentRole);

  const filtered = [...alerts]
    .filter((a) => {
      const matchSev = filterSeverity === '全部' || a.severity === filterSeverity;
      const matchSt = filterStatus === '全部' || a.status === filterStatus;
      const matchProj = !filterProject || a.projectId === filterProject;
      return matchSev && matchSt && matchProj;
    })
    .sort((a, b) => b.alertTime.localeCompare(a.alertTime));

  const handleSave = (form) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const device = devices.find((d) => d.id === form.deviceId);
    const notifiedUsers = [
      { name: '赵六', role: '运维工程师' },
      { name: form.severity === '严重' ? '陈厂长' : '刘项目', role: form.severity === '严重' ? '厂长' : '项目负责人' },
    ];
    dispatch({
      type: 'ADD_ALERT',
      payload: {
        id: `ALERT-${Date.now()}`,
        deviceId: form.deviceId,
        projectId: device?.projectId || null,
        deviceSN: form.deviceSN,
        alertTime: now,
        source: form.source,
        severity: form.severity,
        description: form.description,
        status: '待处理',
        workOrderId: null,
        notifiedUsers,
        processLogs: [],
      },
    });
  };

  const pendingCount = alerts.filter((a) => a.status === '待处理').length;
  const severeCount = alerts.filter((a) => a.severity === '严重' && a.status === '待处理').length;

  const severityDot = (sev) => sev === '严重'
    ? 'w-2 h-2 rounded-full bg-red-500 inline-block mr-1'
    : 'w-2 h-2 rounded-full bg-amber-400 inline-block mr-1';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {(severeCount > 0 || pendingCount > 0) && (
            <div className="flex gap-3 text-sm">
              {severeCount > 0 && <span className="text-red-600 font-medium">{severeCount} 条严重告警待处理</span>}
              {pendingCount > 0 && <span className="text-amber-600">{pendingCount} 条告警待处理</span>}
            </div>
          )}
        </div>
        {canAdd && (
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
            + 新增告警
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">严重程度：</span>
          {['全部', '轻微', '严重'].map((opt) => (
            <button key={opt} onClick={() => setFilterSeverity(opt)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                filterSeverity === opt ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300'
              }`}>{opt}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">状态：</span>
          {ALL_STATUSES.map((opt) => (
            <button key={opt} onClick={() => setFilterStatus(opt)}
              className={`px-2.5 py-0.5 text-xs rounded-full border font-medium transition-colors ${
                filterStatus === opt ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300'
              }`}>{opt}</button>
          ))}
        </div>
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none">
          <option value="">全部项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-400">共 {filtered.length} 条</span>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['告警时间', '设备SN', '项目', '严重程度', '来源', '描述', '状态', '关联工单', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isExpanded = expandedId === a.id;
              const isUrgent = a.severity === '严重' && a.status === '待处理';
              const cellCls = `px-4 py-2.5 border-t border-gray-100 cursor-pointer ${isUrgent ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`;
              return (
                <tr key={a.id} onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                  {isExpanded ? (
                    <td colSpan={9} className="p-0">
                      <div className={`border-t border-gray-100 cursor-pointer ${isUrgent ? 'bg-red-50' : 'bg-white'} px-4 py-2.5 flex items-center gap-3`}
                        onClick={() => setExpandedId(null)}>
                        <span className={severityDot(a.severity)} />
                        <span className="text-xs text-gray-400">{a.alertTime}</span>
                        <span className="font-mono text-xs font-medium text-gray-800">{a.deviceSN}</span>
                        <span className="flex-1 text-gray-600 text-xs truncate max-w-xs">{a.description}</span>
                        <StatusBadge status={a.severity} />
                        <StatusBadge status={a.status} />
                        <span className="text-gray-400 text-xs">▲ 收起</span>
                      </div>
                      <AlertDetail alert={a} state={state} dispatch={dispatch} currentRole={currentRole} currentUser={currentUser} />
                    </td>
                  ) : (
                    <>
                      <td className={`${cellCls} text-gray-400 text-xs whitespace-nowrap`}>{a.alertTime}</td>
                      <td className={cellCls}>
                        <Link to={`/devices/${a.deviceId}`} className="font-mono text-xs text-blue-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                          {a.deviceSN}
                        </Link>
                      </td>
                      <td className={`${cellCls} text-xs`}>
                        {a.projectId
                          ? <Link to={`/projects/${a.projectId}`} className="text-slate-700 hover:underline" onClick={(e) => e.stopPropagation()}>{getProjectName(a.projectId)}</Link>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={cellCls}><StatusBadge status={a.severity} /></td>
                      <td className={`${cellCls} text-xs text-gray-500`}>{a.source}</td>
                      <td className={`${cellCls} text-gray-700 max-w-xs`}>
                        <div className="flex items-center gap-1.5">
                          <span className={severityDot(a.severity)} />
                          <span className="truncate text-xs">{a.description}</span>
                        </div>
                      </td>
                      <td className={cellCls}><StatusBadge status={a.status} /></td>
                      <td className={`${cellCls} text-xs`}>
                        {a.workOrderId ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs px-2 py-0.5 rounded-full hover:bg-orange-100">
                            {a.workOrderId}
                          </button>
                        ) : (
                          a.severity === '轻微' && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2 py-0.5 rounded-full">
                              已飞书通知
                            </span>
                          )
                        )}
                      </td>
                      <td className={`${cellCls} text-gray-400 text-xs`}>▼ 展开</td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">暂无告警记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddAlertModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSave} devices={onlineDevices} />
      )}
    </div>
  );
}

/* ============================ Sub-tabs for device list ============================ */
const DEVICE_TABS = [
  { key: 'all', label: '全部设备' },
  { key: 'online', label: '在线运营' },
  { key: 'alerts', label: '健康告警' },
];

function DeviceListSection({ state, dispatch, currentRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get('subtab');
  const activeSubTab = DEVICE_TABS.some((t) => t.key === subtabParam) ? subtabParam : 'all';

  const { devices, deviceTypes, projects, alerts } = state;
  const getTypeName = (id) => deviceTypes.find((dt) => dt.id === id)?.name || id;
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || id;

  const pendingAlerts = alerts.filter((a) => a.status === '待处理').length;

  const setSubTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('subtab');
    else next.set('subtab', key);
    if (key !== 'all') next.delete('status');
    setSearchParams(next);
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {DEVICE_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === tab.key ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
            {tab.key === 'alerts' && pendingAlerts > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">{pendingAlerts}</span>
            )}
          </button>
        ))}
      </div>

      {activeSubTab === 'all' && <AllDevicesTab devices={devices} getTypeName={getTypeName} projects={projects} />}
      {activeSubTab === 'online' && <OnlineTab devices={devices} projects={projects} getTypeName={getTypeName} />}
      {activeSubTab === 'alerts' && (
        <AlertsTab state={state} dispatch={dispatch} currentRole={currentRole} getProjectName={getProjectName} />
      )}
    </div>
  );
}

/* ============================ Main ============================ */
const HUB_TABS = [
  { key: 'devices', label: '设备列表' },
  { key: 'types', label: '设备类型管理' },
  { key: 'workorders', label: '维修工单' },
];

export default function Devices() {
  const { state, dispatch } = useApp();
  const { currentRole } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab = HUB_TABS.some((t) => t.key === tabParam) ? tabParam : 'devices';

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'devices') next.delete('tab');
    else next.set('tab', key);
    next.delete('subtab');
    next.delete('status');
    setSearchParams(next);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">设备管理</h1>

      {/* Hub Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {HUB_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'devices' && (
        <DeviceListSection state={state} dispatch={dispatch} currentRole={currentRole} />
      )}
      {activeTab === 'types' && <DeviceTypes />}
      {activeTab === 'workorders' && <WorkOrders />}
    </div>
  );
}
