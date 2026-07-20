import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

function AllocateModal({ isOpen, onClose, device, projects, onSave }) {
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectId) return;
    onSave({ device, projectId, notes });
    onClose();
    setProjectId('');
    setNotes('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`分配设备：${device?.sn || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标项目 *</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required>
            <option value="">-- 选择项目 --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}（{p.client}）</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">确认分配</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DeviceAllocation() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState('待分配设备');
  const [allocateTarget, setAllocateTarget] = useState(null);
  const [searchSN, setSearchSN] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');

  const { devices, projects, deviceAllocations, deviceTypes } = state;

  const pendingDevices = devices.filter((d) => d.status === '待分配项目');
  const getTypeName = (id) => deviceTypes.find((dt) => dt.id === id)?.name || id;
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || id;
  const getDeviceSN = (id) => devices.find((d) => d.id === id)?.sn || id;

  const handleAllocate = ({ device, projectId, notes }) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    dispatch({
      type: 'ADD_DEVICE_ALLOCATION',
      payload: {
        id: `ALLOC-${Date.now()}`,
        deviceId: device.id,
        projectId,
        allocatedBy: state.currentUser,
        allocatedAt: now,
        notes,
        type: '分配',
        fromProjectId: null,
      },
    });
    dispatch({
      type: 'UPDATE_DEVICE',
      payload: { id: device.id, status: '已分配项目', projectId, updatedAt: now },
    });
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}`,
        deviceId: device.id,
        operator: state.currentUser,
        timestamp: now,
        actionType: '分配至项目',
        fromStatus: '待分配项目',
        toStatus: '已分配项目',
        notes: `分配至 ${getProjectName(projectId)}`,
      },
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">设备分配</h1>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-4">
        {['待分配设备', '分配记录'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
            {tab === '待分配设备' && <span className="ml-1.5 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">{pendingDevices.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === '待分配设备' && (
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['设备SN', '整机类型', '装配人', '完成时间', '操作'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingDevices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-800 font-medium">{d.sn}</td>
                  <td className="px-4 py-2.5 text-gray-600">{getTypeName(d.deviceTypeId)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{d.assembler}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{d.updatedAt}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setAllocateTarget(d)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                      分配
                    </button>
                  </td>
                </tr>
              ))}
              {pendingDevices.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无待分配设备</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === '分配记录' && (
        <>
          <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
            <input
              type="text" placeholder="搜索设备SN…" value={searchSN}
              onChange={(e) => setSearchSN(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500 w-48" />
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
              <option value="">全部项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
              <option value="">全部类型</option>
              <option value="分配">分配</option>
              <option value="转移">转移</option>
            </select>
            <button onClick={() => { setSearchSN(''); setFilterProject(''); setFilterType(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">重置</button>
          </div>
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['记录ID', '设备SN', '类型', '目标项目', '操作人', '分配时间', '备注'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...deviceAllocations].reverse()
                .filter((a) => {
                  const sn = getDeviceSN(a.deviceId);
                  const matchSN = !searchSN || sn.toLowerCase().includes(searchSN.toLowerCase());
                  const matchProj = !filterProject || a.projectId === filterProject;
                  const matchType = !filterType || a.type === filterType;
                  return matchSN && matchProj && matchType;
                })
                .map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{a.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-800 font-medium">{getDeviceSN(a.deviceId)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${a.type === '转移' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/projects/${a.projectId}`} className="text-slate-700 hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{getProjectName(a.projectId)}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{a.allocatedBy}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{a.allocatedAt}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{a.notes || '—'}</td>
                </tr>
              ))}
              {deviceAllocations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无分配记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {allocateTarget && (
        <AllocateModal
          isOpen={!!allocateTarget}
          onClose={() => setAllocateTarget(null)}
          device={allocateTarget}
          projects={projects}
          onSave={handleAllocate}
        />
      )}
    </div>
  );
}
