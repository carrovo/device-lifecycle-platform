import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Operations() {
  const { state } = useApp();
  const [filterProject, setFilterProject] = useState('全部');
  const [filterOnline, setFilterOnline] = useState('全部');

  const { devices, projects, deviceTypes } = state;

  const onlineDevices = devices.filter((d) => d.status === '在线运营');

  const getTypeName = (id) => deviceTypes.find((dt) => dt.id === id)?.name || id;
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || id;

  const filtered = onlineDevices.filter((d) => {
    const matchProj = filterProject === '全部' || d.projectId === filterProject;
    const matchOnline = filterOnline === '全部' || (filterOnline === '在线' && d.online) || (filterOnline === '离线' && !d.online);
    return matchProj && matchOnline;
  });

  const onlineCount = onlineDevices.filter((d) => d.online).length;
  const offlineCount = onlineDevices.filter((d) => !d.online).length;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">在线运营</h1>

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
