import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const STATUS_CHIPS = [
  { key: '全部',      color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { key: '装配中',    color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '功能测试中', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: '老化测试中', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: '终测中',    color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: '待分配项目', color: 'bg-green-100 text-green-700 border-green-300' },
  { key: '返修中',    color: 'bg-red-100 text-red-700 border-red-300' },
];

const STEP_LABELS = ['选择整机类型', '选择模组物料', '填写装配信息', '确认提交'];

function AssemblyModal({ isOpen, onClose, onSubmit, deviceTypes, moduleTypes, materials, currentUser }) {
  const [step, setStep] = useState(1);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedModules, setSelectedModules] = useState({});
  const [assembler, setAssembler] = useState(currentUser);
  const [assemblyTime, setAssemblyTime] = useState(
    new Date().toISOString().slice(0, 16).replace('T', ' ')
  );
  const [photoName, setPhotoName] = useState('');

  const selectedType = deviceTypes.find((dt) => dt.id === selectedTypeId);

  const getAllMaterialsForSlot = (moduleTypeId) => {
    const mt = moduleTypes.find((m) => m.id === moduleTypeId);
    if (!mt) return [];
    return materials.filter((mat) => mat.category === mt.category);
  };

  const canSubmit = () => {
    if (!selectedType || !assembler || !assemblyTime) return false;
    const slots = selectedType.slots || []; return slots.every((s) => selectedModules[s.moduleTypeId || s.id]);
  };

  const handleClose = () => {
    setStep(1); setSelectedTypeId(''); setSelectedModules({});
    setAssembler(currentUser); setPhotoName(''); onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;
    onSubmit({
      deviceTypeId: selectedTypeId,
      usedMaterials: (selectedType.slots || []).map((s) => ({
        materialId: selectedModules[s.moduleTypeId],
        moduleTypeId: s.moduleTypeId,
        slotId: s.id,
      })),
      assembler, assemblyTime, photoName,
    });
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="新建装配" size="lg">
      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? 'bg-slate-700 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{step > s ? '✓' : s}</div>
              <span className={`text-xs ${step === s ? 'text-slate-700 font-medium' : 'text-gray-400'}`}>{label}</span>
              {s < 4 && <span className="text-gray-300 mx-1">›</span>}
            </div>
          );
        })}
      </div>

      {/* Step 1: Choose device type */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">请选择要装配的整机类型：</p>
          {deviceTypes.map((dt) => (
            <label key={dt.id} className={`flex items-start gap-3 p-3 border-2 rounded cursor-pointer transition-colors ${
              selectedTypeId === dt.id ? 'border-slate-600 bg-slate-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="deviceType" value={dt.id} checked={selectedTypeId === dt.id}
                onChange={() => setSelectedTypeId(dt.id)} className="mt-0.5" />
              <div>
                <div className="font-medium text-gray-800">{dt.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(dt.slots || []).map((s) => {
                    const mt = moduleTypes.find((m) => m.id === s.moduleTypeId);
                    return `${s.slotName}: ${mt?.name || s.moduleTypeId} × ${s.quantity}`;
                  }).join(' / ')}
                </div>
              </div>
            </label>
          ))}
          <div className="flex justify-end pt-4">
            <button onClick={() => { if (selectedTypeId) setStep(2); }} disabled={!selectedTypeId}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select materials */}
      {step === 2 && selectedType && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">为每个模组选择物料（灰色=已占用，不可选）：</p>
          {(selectedType.slots || []).map((rm) => {
            const mt = moduleTypes.find((m) => m.id === rm.moduleTypeId);
            const allMats = getAllMaterialsForSlot(rm.moduleTypeId);
            const availCount = allMats.filter((m) => m.status === '待装配').length;
            return (
              <div key={rm.id || rm.moduleTypeId} className="border border-gray-200 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  {rm.slotName && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{rm.slotName}</span>}
                  <span className="text-sm font-medium text-gray-800">{mt?.name}</span>
                  <span className="text-xs text-gray-500">({mt?.category}) × {rm.quantity}</span>
                  {availCount === 0
                    ? <span className="text-xs text-red-500 ml-auto">无可用物料</span>
                    : <span className="text-xs text-green-600 ml-auto">{availCount} 件可用</span>}
                </div>
                {allMats.length > 0 ? (
                  <select value={selectedModules[rm.moduleTypeId] || ''}
                    onChange={(e) => setSelectedModules((p) => ({ ...p, [rm.moduleTypeId]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none">
                    <option value="">-- 请选择 --</option>
                    {allMats.map((mat) => (
                      <option key={mat.id} value={mat.id} disabled={mat.status !== '待装配'}>
                        {mat.sn} | {mat.model || '—'} | 批次:{mat.batchNo}{mat.status !== '待装配' ? ` [${mat.status}]` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-red-400">无「{mt?.category}」类物料记录</div>
                )}
              </div>
            );
          })}
          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">上一步</button>
            <button onClick={() => { if ((selectedType.slots || []).every((rm) => selectedModules[rm.moduleTypeId])) setStep(3); }}
              disabled={!(selectedType.slots || []).every((rm) => selectedModules[rm.moduleTypeId])}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Assembler info */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">装配人</label>
            <input type="text" value={assembler} onChange={(e) => setAssembler(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">装配时间</label>
            <input type="text" value={assemblyTime} onChange={(e) => setAssemblyTime(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">现场照片（文件名）</label>
            <input type="text" value={photoName} onChange={(e) => setPhotoName(e.target.value)}
              placeholder="e.g. assembly_photo.jpg"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">上一步</button>
            <button onClick={() => { if (assembler && assemblyTime) setStep(4); }}
              disabled={!assembler || !assemblyTime}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700 mb-3">装配信息确认</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">整机类型：</span><span className="font-medium">{selectedType?.name}</span></div>
              <div><span className="text-gray-500">装配人：</span><span className="font-medium">{assembler}</span></div>
              <div><span className="text-gray-500">装配时间：</span><span className="text-gray-700">{assemblyTime}</span></div>
              {photoName && <div><span className="text-gray-500">现场照片：</span><span className="text-gray-700">{photoName}</span></div>}
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">所用模组物料</div>
              {(selectedType?.slots || []).map((rm) => {
                const mt = moduleTypes.find((m) => m.id === rm.moduleTypeId);
                const mat = materials.find((m) => m.id === selectedModules[rm.moduleTypeId]);
                return (
                  <div key={rm.id || rm.moduleTypeId} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600">{mt?.name} <span className="text-gray-400">({mt?.category})</span></span>
                    <span className="font-mono text-gray-800">{mat?.sn || '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feishu placeholder */}
          <div className="border border-dashed border-blue-200 rounded-lg p-3 flex items-center justify-between bg-blue-50">
            <div>
              <div className="text-sm font-medium text-blue-700">同步到飞书</div>
              <div className="text-xs text-blue-500 mt-0.5">将装配记录同步至飞书多维表格</div>
            </div>
            <button type="button"
              onClick={() => alert('飞书同步功能待接入')}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
              立即同步
            </button>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">上一步</button>
            <button onClick={handleSubmit} disabled={!canSubmit()}
              className="px-6 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium disabled:opacity-40">
              确认提交装配
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Assembly() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('全部');
  const [search, setSearch] = useState('');

  const allDevices = state.devices.filter((d) =>
    ['装配中', '功能测试中', '老化测试中', '终测中', '待分配项目', '返修中'].includes(d.status)
  );
  const getTypeName = (id) => state.deviceTypes.find((dt) => dt.id === id)?.name || id;

  const statusCounts = STATUS_CHIPS.slice(1).reduce((acc, c) => {
    acc[c.key] = allDevices.filter((d) => d.status === c.key).length;
    return acc;
  }, {});

  const filtered = allDevices.filter((d) => {
    const matchStatus = filterStatus === '全部' || d.status === filterStatus;
    const matchSearch = !search || d.sn.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleAssembly = (form) => {
    const now = form.assemblyTime;
    const devId = `DEV-${Date.now()}`;
    const devSN = `SN-DEV-${String(state.devices.length + 1).padStart(3, '0')}`;
    dispatch({ type: 'ADD_DEVICE', payload: {
      id: devId, sn: devSN, deviceTypeId: form.deviceTypeId,
      status: '功能测试中', assembler: form.assembler, assemblyTime: now,
      photoName: form.photoName, usedMaterials: form.usedMaterials,
      createdAt: now, updatedAt: now,
    }});
    form.usedMaterials.forEach(({ materialId }) => {
      dispatch({ type: 'UPDATE_MATERIAL', payload: { id: materialId, status: '已占用' } });
    });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: {
      id: `LOG-${Date.now()}`, deviceId: devId, operator: form.assembler,
      timestamp: now, actionType: '装配', fromStatus: null, toStatus: '功能测试中',
      notes: '整机装配完成，进入功能测试',
    }});
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">整机装配</h1>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
          + 新建装配
        </button>
      </div>

      {/* Status chips */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <button onClick={() => setFilterStatus('全部')}
          className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
            filterStatus === '全部' ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300 hover:border-slate-400'
          }`}>
          全部 <span className="ml-1">{allDevices.length}</span>
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
          <input type="text" placeholder="搜索设备SN..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none w-40" />
          <span className="text-sm text-gray-400">共 {filtered.length} 台</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['设备SN', '整机类型', '当前状态', '装配人', '装配时间', '照片', '操作'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-2 font-medium text-gray-800 font-mono text-xs">{d.sn}</td>
                <td className="px-4 py-2 text-gray-600">{getTypeName(d.deviceTypeId)}</td>
                <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-2 text-gray-600">{d.assembler}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{d.assemblyTime}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">{d.photoName || '—'}</td>
                <td className="px-4 py-2">
                  <Link to={`/devices/${d.id}`} className="text-slate-600 hover:text-slate-800 text-xs hover:underline">
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无装配记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AssemblyModal
        isOpen={showModal} onClose={() => setShowModal(false)} onSubmit={handleAssembly}
        deviceTypes={state.deviceTypes} moduleTypes={state.moduleTypes}
        materials={state.materials} currentUser={state.currentUser}
      />
    </div>
  );
}
