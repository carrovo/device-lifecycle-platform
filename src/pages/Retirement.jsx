import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

function RetireModal({ isOpen, onClose, onSave, devices }) {
  const [deviceId, setDeviceId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!confirmed) return;
    const device = devices.find((d) => d.id === deviceId);
    onSave({ deviceId, deviceSN: device?.sn || '', reason });
    onClose();
    setDeviceId('');
    setReason('');
    setConfirmed(false);
  };

  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="发起退役">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">选择设备 *</label>
          <select className={inputClass} required value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">-- 选择在线运营设备 --</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">退役原因 *</label>
          <textarea rows={4} className={inputClass} required value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="请详细说明退役原因..." />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
          <strong>注意：</strong>退役操作不可逆，请确认设备已完成所有交接工作后再执行。
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded" />
          <span className="text-gray-700">我已确认以上信息，同意执行退役操作</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" disabled={!confirmed || !deviceId || !reason}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
            确认退役
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Retirement() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);

  const { retirements, devices, deviceTypes, projects } = state;

  const onlineDevices = devices.filter((d) => d.status === '在线运营');
  const retiredDevices = devices.filter((d) => d.status === '退役');

  const getTypeName = (id) => deviceTypes.find((dt) => dt.id === id)?.name || id;
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || '—';
  const getDevice = (id) => devices.find((d) => d.id === id);

  const handleRetire = ({ deviceId, deviceSN, reason }) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    dispatch({
      type: 'ADD_RETIREMENT',
      payload: {
        id: `RET-${Date.now()}`,
        deviceId,
        deviceSN,
        reason,
        retiredAt: now,
        operator: state.currentUser,
      },
    });
    dispatch({
      type: 'UPDATE_DEVICE',
      payload: { id: deviceId, status: '退役', updatedAt: now },
    });
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}`,
        deviceId,
        operator: state.currentUser,
        timestamp: now,
        actionType: '退役',
        fromStatus: '在线运营',
        toStatus: '退役',
        notes: reason,
      },
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">退役管理</h1>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
          + 发起退役
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 border-gray-400">
          <div className="text-3xl font-semibold text-gray-700">{retiredDevices.length}</div>
          <div className="text-sm text-gray-500 mt-1">累计退役设备</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 border-l-4 border-emerald-500">
          <div className="text-3xl font-semibold text-gray-900">{onlineDevices.length}</div>
          <div className="text-sm text-gray-500 mt-1">当前在线运营设备（可退役）</div>
        </div>
      </div>

      {/* Retirement Records */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">退役设备列表</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['设备SN', '整机类型', '原所属项目', '退役原因', '退役时间', '操作人'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...retirements].reverse().map((r) => {
              const device = getDevice(r.deviceId);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 font-medium">{r.deviceSN}</td>
                  <td className="px-4 py-2.5 text-gray-600">{device ? getTypeName(device.deviceTypeId) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {device?.projectId
                      ? <Link to={`/projects/${device.projectId}`} className="text-slate-700 hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{getProjectName(device.projectId)}</Link>
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs">
                    <div className="truncate" title={r.reason}>{r.reason}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{r.retiredAt}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.operator}</td>
                </tr>
              );
            })}
            {retirements.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无退役记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <RetireModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleRetire}
          devices={onlineDevices}
        />
      )}
    </div>
  );
}
