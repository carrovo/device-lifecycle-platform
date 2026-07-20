import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

// Roles that can update alert status
const CAN_UPDATE_ALERT = ['运维工程师', '维修工程师', '厂长', '管理员'];

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
    const newLog = {
      operator: currentUser,
      time: t,
      fromStatus: alert.status,
      toStatus: newStatus,
      notes,
    };
    dispatch({
      type: 'UPDATE_ALERT',
      payload: {
        id: alert.id,
        status: newStatus,
        processLogs: [...(alert.processLogs || []), newLog],
      },
    });
  };

  const handleGenerateWorkOrder = () => {
    const t = now();
    const date = t.slice(0, 10).replace(/-/g, '');
    const woId = `WO-${date}-${String(Date.now()).slice(-3)}`;

    // Create work order
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

    // Update alert status
    const newLog = {
      operator: currentUser,
      time: t,
      fromStatus: alert.status,
      toStatus: '已生成工单',
      notes: `严重告警，已生成维修工单 ${woId}`,
    };
    dispatch({
      type: 'UPDATE_ALERT',
      payload: {
        id: alert.id,
        status: '已生成工单',
        workOrderId: woId,
        processLogs: [...(alert.processLogs || []), newLog],
      },
    });
  };

  const severityDot = alert.severity === '严重'
    ? 'w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0'
    : 'w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0';

  return (
    <div className="px-6 py-5 space-y-5 bg-slate-50 border-b border-slate-200">
      {/* Header row */}
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

      {/* Feishu notification */}
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

      {/* Linked work order */}
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

      {/* Action buttons */}
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

      {/* Process log timeline */}
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

export default function Alerts() {
  const { state, dispatch } = useApp();
  const { currentRole } = useRole();
  const [filterSeverity, setFilterSeverity] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { alerts, devices } = state;
  const currentUser = state.currentUser;

  const onlineDevices = devices.filter((d) => d.status === '在线运营');

  const filtered = [...alerts]
    .filter((a) => {
      const matchSev = filterSeverity === '全部' || a.severity === filterSeverity;
      const matchSt = filterStatus === '全部' || a.status === filterStatus;
      return matchSev && matchSt;
    })
    .sort((a, b) => b.alertTime.localeCompare(a.alertTime));

  const handleSave = (form) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const device = devices.find((d) => d.id === form.deviceId);
    // Default notify list
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

  const pendingCount = alerts.filter((a) => ['待处理'].includes(a.status)).length;
  const severeCount = alerts.filter((a) => a.severity === '严重' && a.status === '待处理').length;

  const severityDot = (sev) => sev === '严重'
    ? 'w-2 h-2 rounded-full bg-red-500 inline-block mr-1'
    : 'w-2 h-2 rounded-full bg-amber-400 inline-block mr-1';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">告警中心</h1>
          {(severeCount > 0 || pendingCount > 0) && (
            <div className="flex gap-3 mt-1 text-sm">
              {severeCount > 0 && <span className="text-red-600 font-medium">{severeCount} 条严重告警待处理</span>}
              {pendingCount > 0 && <span className="text-amber-600">{pendingCount} 条告警待处理</span>}
            </div>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
          + 新增告警
        </button>
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
        <span className="ml-auto text-sm text-gray-400">共 {filtered.length} 条</span>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['告警时间', '设备SN', '严重程度', '来源', '描述', '状态', '关联工单', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isExpanded = expandedId === a.id;
              return (
                <tr key={a.id} onClick={() => setExpandedId(isExpanded ? null : a.id)} style={{ display: 'table-row' }}>
                  {isExpanded ? (
                    <td colSpan={8} className="p-0" style={{ display: 'table-cell' }}>
                      <div className={`border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'bg-white'} px-4 py-2.5 flex items-center gap-3`}
                        onClick={() => setExpandedId(null)}>
                        <span className={severityDot(a.severity)} />
                        <span className="text-xs text-gray-400">{a.alertTime}</span>
                        <span className="font-mono text-xs font-medium text-gray-800">{a.deviceSN}</span>
                        <span className="flex-1 text-gray-600 text-xs truncate max-w-xs">{a.description}</span>
                        <StatusBadge status={a.severity} />
                        <StatusBadge status={a.status} />
                        <span className="text-gray-400 text-xs">▲ 收起</span>
                      </div>
                      <AlertDetail
                        alert={a}
                        state={state}
                        dispatch={dispatch}
                        currentRole={currentRole}
                        currentUser={currentUser}
                      />
                    </td>
                  ) : (
                    <>
                      <td className={`px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>{a.alertTime}</td>
                      <td className={`px-4 py-2.5 border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                        <Link to={`/devices/${a.deviceId}`} className="font-mono text-xs text-blue-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                          {a.deviceSN}
                        </Link>
                      </td>
                      <td className={`px-4 py-2.5 border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}><StatusBadge status={a.severity} /></td>
                      <td className={`px-4 py-2.5 text-xs text-gray-500 border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>{a.source}</td>
                      <td className={`px-4 py-2.5 text-gray-700 max-w-xs border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                        <div className="flex items-center gap-1.5">
                          <span className={severityDot(a.severity)} />
                          <span className="truncate text-xs">{a.description}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}><StatusBadge status={a.status} /></td>
                      <td className={`px-4 py-2.5 text-xs border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
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
                      <td className={`px-4 py-2.5 text-gray-400 text-xs border-t border-gray-100 cursor-pointer ${a.severity === '严重' && a.status === '待处理' ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>▼ 展开</td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无告警记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddAlertModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          devices={onlineDevices}
        />
      )}
    </div>
  );
}
