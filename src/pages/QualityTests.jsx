import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';

const STATIONS = [
  { key: 'semi', label: '半成品检验', deviceStatus: '半成品检验中', testType: '功能测试', nextStatus: '初测中' },
  { key: 'init', label: '初测', deviceStatus: '初测中', testType: '功能测试', nextStatus: '中测中' },
  { key: 'mid', label: '中测', deviceStatus: '中测中', testType: '老化测试', nextStatus: 'OQT终测中' },
  { key: 'oqt', label: 'OQT终测', deviceStatus: 'OQT终测中', testType: '终测', nextStatus: '待分配项目' },
];

function StationBadge({ result }) {
  return result === 'Pass'
    ? <span className="bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full text-xs font-medium">✓ Pass</span>
    : <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-full text-xs font-medium">✗ NG</span>;
}

function NGModal({ isOpen, onClose, onConfirm }) {
  const [form, setForm] = useState({
    ngReason: '',
    repairPerson: '',
    repairAction: '',
    estimatedCompletion: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.ngReason.trim()) return;
    onConfirm(form);
    onClose();
    setForm({ ngReason: '', repairPerson: '', repairAction: '', estimatedCompletion: '' });
  };

  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="记录NG原因及返修信息">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NG原因 *</label>
          <textarea
            rows={3}
            className={inp}
            required
            value={form.ngReason}
            onChange={(e) => setForm({ ...form, ngReason: e.target.value })}
            placeholder="请填写NG原因..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">返修人</label>
            <input
              type="text"
              className={inp}
              value={form.repairPerson}
              onChange={(e) => setForm({ ...form, repairPerson: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">预计完成时间</label>
            <input
              type="date"
              className={inp}
              value={form.estimatedCompletion}
              onChange={(e) => setForm({ ...form, estimatedCompletion: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">返修措施</label>
          <textarea
            rows={2}
            className={inp}
            value={form.repairAction}
            onChange={(e) => setForm({ ...form, repairAction: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700">确认NG</button>
        </div>
      </form>
    </Modal>
  );
}

function AddRecordModal({ isOpen, onClose, station, devices, currentUser, onSave }) {
  const [form, setForm] = useState({
    deviceId: '',
    stationResult: 'Pass',
    operator: currentUser || '',
    testTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    reportFile: '',
    reportLink: '',
    logFile: '',
    notes: '',
  });

  const [showNGModal, setShowNGModal] = useState(false);

  if (!station) return null;

  const handleResultChange = (result) => {
    setForm({ ...form, stationResult: result });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.deviceId) return;
    if (form.stationResult === 'NG') {
      setShowNGModal(true);
    } else {
      onSave({ ...form, ngData: null });
      onClose();
      setForm({ deviceId: '', stationResult: 'Pass', operator: currentUser || '', testTime: new Date().toISOString().slice(0, 16).replace('T', ' '), reportFile: '', reportLink: '', logFile: '', notes: '' });
    }
  };

  const handleNGConfirm = (ngData) => {
    onSave({ ...form, ngData });
    onClose();
    setForm({ deviceId: '', stationResult: 'Pass', operator: currentUser || '', testTime: new Date().toISOString().slice(0, 16).replace('T', ' '), reportFile: '', reportLink: '', logFile: '', notes: '' });
  };

  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`新增${station.label}记录`} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">整机 *</label>
            <select className={inp} required value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
              <option value="">-- 选择设备 --</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
            </select>
            {devices.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">当前工站无待测设备</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">工站结果 *</label>
            <div className="flex gap-4">
              {['Pass', 'NG'].map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="stationResult"
                    value={r}
                    checked={form.stationResult === r}
                    onChange={() => handleResultChange(r)}
                    className="text-blue-600"
                  />
                  <span className={`text-sm font-medium ${r === 'Pass' ? 'text-green-700' : 'text-red-700'}`}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关联测试类型</label>
              <input type="text" className={`${inp} bg-gray-50 text-gray-500`} readOnly value={station.testType} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">测试员</label>
              <input type="text" className={inp} value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">测试时间</label>
            <input type="text" className={inp} value={form.testTime} onChange={(e) => setForm({ ...form, testTime: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报告文件名</label>
              <input type="text" className={inp} value={form.reportFile} onChange={(e) => setForm({ ...form, reportFile: e.target.value })} placeholder="如: report.pdf" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报告链接</label>
              <input type="text" className={inp} value={form.reportLink} onChange={(e) => setForm({ ...form, reportLink: e.target.value })} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日志文件名</label>
            <input type="text" className={inp} value={form.logFile} onChange={(e) => setForm({ ...form, logFile: e.target.value })} placeholder="如: log.txt" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">
              {form.stationResult === 'NG' ? '记录NG...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      <NGModal isOpen={showNGModal} onClose={() => setShowNGModal(false)} onConfirm={handleNGConfirm} />
    </>
  );
}

export default function QualityTests() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [activeStation, setActiveStation] = useState('semi');
  const [showModal, setShowModal] = useState(false);

  const { testRecords, devices } = state;
  const currentUser = state.currentUser;

  const station = STATIONS.find((s) => s.key === activeStation);

  // Devices in current station status
  const stationDevices = devices.filter((d) => d.status === station?.deviceStatus);

  // Records for current station
  const stationRecords = testRecords
    .filter((r) => r.stationKey === activeStation)
    .sort((a, b) => (b.testTime || '').localeCompare(a.testTime || ''));

  // Station summary counts
  const getStationSummary = (key) => {
    const records = testRecords.filter((r) => r.stationKey === key);
    const passCount = records.filter((r) => r.stationResult === 'Pass').length;
    const total = records.length;
    const rate = total > 0 ? Math.round((passCount / total) * 100) : 0;
    return { passCount, total, rate };
  };

  const getDeviceSN = (id) => devices.find((d) => d.id === id)?.sn || id;

  const handleSave = (form) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const id = `TEST-${Date.now()}`;
    const st = STATIONS.find((s) => s.key === activeStation);
    if (!st) return;

    const isPass = form.stationResult === 'Pass';
    const device = devices.find((d) => d.id === form.deviceId);
    const newStatus = isPass ? st.nextStatus : '生产返修中';

    // Add test record
    dispatch({
      type: 'ADD_TEST_RECORD',
      payload: {
        id,
        deviceId: form.deviceId,
        stationKey: activeStation,
        stationResult: form.stationResult,
        testType: st.testType,
        result: isPass ? '合格' : '不合格',
        operator: form.operator,
        testTime: form.testTime || now,
        reportFile: form.reportFile || '',
        reportLink: form.reportLink || '',
        logFile: form.logFile || '',
        notes: form.notes || '',
        status: '有效',
        ...(form.ngData || {}),
      },
    });

    // Update device status
    dispatch({
      type: 'UPDATE_DEVICE',
      payload: { id: form.deviceId, status: newStatus, updatedAt: now },
    });

    // Add operation log
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}`,
        deviceId: form.deviceId,
        operator: form.operator || currentUser,
        timestamp: now,
        actionType: `${st.label}-${form.stationResult}`,
        fromStatus: device?.status,
        toStatus: newStatus,
        notes: `${st.label} ${form.stationResult}，设备状态更新为 ${newStatus}`,
      },
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">质量测试</h1>
        {canDo('add_test_record') && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
          >
            + 新增记录
          </button>
        )}
      </div>

      {/* Station summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATIONS.map((s) => {
          const { passCount, total, rate } = getStationSummary(s.key);
          const inStation = devices.filter((d) => d.status === s.deviceStatus).length;
          return (
            <div
              key={s.key}
              onClick={() => setActiveStation(s.key)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                activeStation === s.key ? 'border-slate-700 ring-1 ring-slate-700' : 'border-gray-200'
              }`}
            >
              <div className="text-sm font-semibold text-gray-800 mb-1">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{inStation}</div>
              <div className="text-xs text-gray-500">待测设备</div>
              {total > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    直通率 <span className={`font-semibold ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                  </div>
                  <div className="text-xs text-gray-400">Pass {passCount}/{total}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Station tab nav */}
      <div className="border-b border-gray-200 bg-white mb-4">
        <div className="flex gap-0 px-0">
          {STATIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveStation(s.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeStation === s.key
                  ? 'border-slate-700 text-slate-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {stationRecords.length > 0 && activeStation === s.key ? stationRecords.length : testRecords.filter((r) => r.stationKey === s.key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Records table */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['整机SN', '工站结果', '测试员', '时间', '关联测试类型', '报告', '备注'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stationRecords.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link to={`/devices/${r.deviceId}`} className="font-mono text-xs text-blue-600 hover:underline font-medium">
                    {getDeviceSN(r.deviceId)}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  {r.stationResult && <StationBadge result={r.stationResult} />}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{r.operator}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{r.testTime}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{r.testType}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {r.reportFile && <div>{r.reportFile}</div>}
                  {r.reportLink && (
                    <a href={r.reportLink} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">链接</a>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs">
                  <div className="truncate">{r.notes || '—'}</div>
                  {r.ngReason && (
                    <div className="text-red-500 text-xs mt-0.5 truncate">NG: {r.ngReason}</div>
                  )}
                </td>
              </tr>
            ))}
            {stationRecords.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无{station?.label}记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AddRecordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        station={station}
        devices={stationDevices}
        currentUser={currentUser}
        onSave={handleSave}
      />
    </div>
  );
}
