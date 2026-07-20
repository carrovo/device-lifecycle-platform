import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import { deviceBusinessNode } from '../utils/status';

const CATEGORIES = ['底盘', '机械臂', '电机', '末端', '全身相机', '预控'];

function ModuleTypeModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || { name: '', category: '底盘', specs: '', urdf: '', erpMaterialCode: '', active: true });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
    if (!initial) setForm({ name: '', category: '底盘', specs: '', urdf: '', active: true });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? '编辑模块类型' : '新增模块类型'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模块名称 *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">物料大类</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">规格参数</label>
          <input type="text" value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })}
            placeholder="e.g. 承重≥80kg"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URDF文件名</label>
          <input type="text" value={form.urdf} onChange={(e) => setForm({ ...form, urdf: e.target.value })}
            placeholder="e.g. module_v1.urdf"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ERP物料编码 <span className="font-normal text-gray-400">（选填）</span>
          </label>
          <input type="text" value={form.erpMaterialCode || ''} onChange={(e) => setForm({ ...form, erpMaterialCode: e.target.value })}
            placeholder="如 MAT-2026-XXX"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function DeviceTypeModal({ isOpen, onClose, onSave, moduleTypes, initial }) {
  const [form, setForm] = useState(initial || { name: '', urdf: '', slots: [] });

  const addSlot = () => {
    if (moduleTypes.length > 0) {
      setForm((prev) => ({
        ...prev,
        slots: [...prev.slots, { id: `slot-${Date.now()}-${prev.slots.length}`, slotName: '', moduleTypeId: moduleTypes[0].id, quantity: 1 }],
      }));
    }
  };

  const removeSlot = (idx) => setForm((prev) => ({ ...prev, slots: prev.slots.filter((_, i) => i !== idx) }));
  const updateSlot = (idx, key, value) => setForm((prev) => ({
    ...prev,
    slots: prev.slots.map((s, i) => i === idx ? { ...s, [key]: value } : s),
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: form.name, urdf: form.urdf, slots: form.slots });
    onClose();
    if (!initial) setForm({ name: '', urdf: '', slots: [] });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? '编辑整机类型' : '新增整机类型'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">整机名称 *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URDF文件名</label>
            <input type="text" value={form.urdf} onChange={(e) => setForm({ ...form, urdf: e.target.value })}
              placeholder="e.g. device_v1.urdf"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">槁位配置</label>
            <button type="button" onClick={addSlot}
              className="text-xs text-slate-600 hover:text-slate-800 border border-slate-300 rounded px-2 py-1">
              + 添加槁位
            </button>
          </div>
          {form.slots.length === 0 && (
            <div className="text-sm text-gray-400 py-2 border border-dashed border-gray-200 rounded text-center">
              尚未添加槁位，点击上方按钮添加
            </div>
          )}
          <div className="space-y-2">
            {form.slots.map((slot, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 rounded p-2">
                <input type="text" value={slot.slotName} onChange={(e) => updateSlot(idx, 'slotName', e.target.value)}
                  placeholder="槁位名称（如：左臂槁位）"
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none bg-white" />
                <select value={slot.moduleTypeId} onChange={(e) => updateSlot(idx, 'moduleTypeId', e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none bg-white">
                  {moduleTypes.map((mt) => (
                    <option key={mt.id} value={mt.id}>{mt.name} ({mt.category})</option>
                  ))}
                </select>
                <input type="number" min="1" value={slot.quantity}
                  onChange={(e) => updateSlot(idx, 'quantity', Number(e.target.value))}
                  className="w-14 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none bg-white" />
                <span className="text-xs text-gray-400">件</span>
                <button type="button" onClick={() => removeSlot(idx)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none w-6 text-center">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DeviceTypes() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [activeTab, setActiveTab] = useState('整机类型');
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showDeviceTypeModal, setShowDeviceTypeModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingDeviceType, setEditingDeviceType] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const deviceTypePaged = usePaged(state.deviceTypes, 10);
  const moduleTypePaged = usePaged(state.moduleTypes, 10);

  const getModuleName = (id) => state.moduleTypes.find((m) => m.id === id)?.name || id;
  const getModuleCategory = (id) => state.moduleTypes.find((m) => m.id === id)?.category || '';

  // 设备类型供应商派生：从装配 BOM 涉及的模块类型 → 按物料类别聚合供应商。
  // 设备类型是整机模板，不是库存主账；供应商仅用于说明该设备类型涉及哪些模块供应商。
  const suppliersOfCategory = (cat) => [...new Set(state.materials.filter((m) => m.category === cat).map((m) => m.supplier).filter(Boolean))];
  const modelOfCategory = (cat) => state.materials.find((m) => m.category === cat)?.model || '—';
  const deviceTypeSupplierRows = (dt) => {
    const ids = [...new Set((dt.slots || []).map((s) => s.moduleTypeId))];
    return ids.map((id) => {
      const cat = getModuleCategory(id);
      const sups = suppliersOfCategory(cat);
      return {
        moduleTypeId: id,
        moduleName: getModuleName(id),
        category: cat,
        model: modelOfCategory(cat),
        defaultSupplier: sups[0] || '—',
        altSuppliers: sups.slice(1),
        key: sups.length <= 1, // 单一供应商 → 关键（供应风险较高）
      };
    });
  };
  const deviceTypeSupplierSummary = (dt) => {
    const all = [...new Set(deviceTypeSupplierRows(dt).flatMap((r) => [r.defaultSupplier, ...r.altSuppliers]).filter((s) => s && s !== '—'))];
    return { count: all.length, main: all.slice(0, 2) };
  };

  const getAssembledDevices = (deviceTypeId) =>
    state.devices.filter((d) => d.deviceTypeId === deviceTypeId);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddModuleType = (form) => {
    dispatch({ type: 'ADD_MODULE_TYPE', payload: { id: `MT-${Date.now()}`, ...form, active: true } });
  };

  const handleEditModuleType = (form) => {
    dispatch({ type: 'UPDATE_MODULE_TYPE', payload: { id: editingModule.id, ...form } });
    setEditingModule(null);
  };

  const handleToggleActive = (mt) => {
    dispatch({ type: 'UPDATE_MODULE_TYPE', payload: { id: mt.id, active: !mt.active } });
  };

  const handleToggleDeviceTypeActive = (dt) => {
    dispatch({ type: 'UPDATE_DEVICE_TYPE', payload: { id: dt.id, active: dt.active === false } });
  };

  const handleAddDeviceType = (form) => {
    dispatch({ type: 'ADD_DEVICE_TYPE', payload: { id: `DT-${Date.now()}`, name: form.name, urdf: form.urdf, slots: form.slots } });
  };

  const handleEditDeviceType = (form) => {
    dispatch({ type: 'UPDATE_DEVICE_TYPE', payload: { id: editingDeviceType.id, ...form } });
    setEditingDeviceType(null);
  };

  const getReferencingDeviceTypes = (moduleTypeId) => {
    return state.deviceTypes.filter((dt) =>
      (dt.slots || []).some((s) => s.moduleTypeId === moduleTypeId)
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600">
        设备类型用于维护整机装配模板与涉及的模块供应商信息；模块类型库用于维护可被整机类型引用的模块主数据。这里定义模板，不占用库存。
        <span className="text-slate-400">（设备类型定义整机需要哪些模块，模块类型库定义模块主数据，实际到货批次与模块 SN 在「模块来料」管理；生产计划在来料准备中关联批次、在录入待测试设备时绑定具体模块 SN，模块库存数量只在「模块来料 / 模块库存汇总」展示。）</span>
      </div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {['整机类型', '模块类型库'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-slate-700 text-slate-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 整机类型 tab */}
      {activeTab === '整机类型' && (
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-600">整机类型列表</div>
            {canDo('add_device_type') && (
              <button onClick={() => setShowDeviceTypeModal(true)}
                className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
                + 新增整机类型
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['设备类型ID', '设备类型名称', '配置版本', 'URDF文件', '装配模板', '已关联设备数', '关联供应商', '状态', '操作'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deviceTypePaged.pageItems.map((dt) => {
                const isExpanded = expandedIds.has(dt.id);
                const slots = dt.slots || [];
                const assembledCount = getAssembledDevices(dt.id).length;
                return (
                  <>
                    <tr key={dt.id}
                      className={`transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{dt.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{dt.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{dt.version || 'V1'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{dt.urdf || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs px-2 py-0.5">{slots.length} 个装配槽位</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{assembledCount}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {(() => { const s = deviceTypeSupplierSummary(dt); return s.count > 0 ? `${s.count} 家 · ${s.main.join('、')}` : '—'; })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${dt.active !== false ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>{dt.active !== false ? '启用' : '已停用'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-x-3">
                          <button className="text-blue-600 hover:underline" onClick={() => toggleExpand(dt.id)}>{isExpanded ? '收起详情' : '查看详情'}</button>
                          {canDo('edit_device_type') && <button className="text-slate-600 hover:underline" onClick={() => setEditingDeviceType(dt)}>编辑</button>}
                          {canDo('edit_device_type') && <button className={`hover:underline ${dt.active !== false ? 'text-red-400 hover:text-red-600' : 'text-green-600'}`} onClick={() => handleToggleDeviceTypeActive(dt)}>{dt.active !== false ? '停用' : '启用'}</button>}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${dt.id}-expand`}>
                        <td colSpan={9} className="px-0 py-0 bg-slate-50 border-b border-slate-200">
                          <div className="px-12 py-4">
                            <div className="text-[11px] text-gray-400 mb-4">设备类型定义整机装配 BOM 与涉及的模块供应商。生产计划绑定设备类型后，整机装配节点按装配 BOM 绑定模块 SN。</div>

                            {/* 基础信息 */}
                            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">基础信息</div>
                            <div className="grid grid-cols-4 gap-4 text-sm bg-white border border-gray-200 rounded p-4">
                              <div><span className="text-gray-400 text-xs">设备类型ID：</span><span className="font-mono text-gray-700">{dt.id}</span></div>
                              <div><span className="text-gray-400 text-xs">设备类型名称：</span><span className="text-gray-800">{dt.name}</span></div>
                              <div><span className="text-gray-400 text-xs">配置版本：</span><span className="text-gray-700">{dt.version || 'V1'}</span></div>
                              <div><span className="text-gray-400 text-xs">URDF文件：</span><span className="font-mono text-gray-600 text-xs">{dt.urdf || '—'}</span></div>
                              <div><span className="text-gray-400 text-xs">启用状态：</span><span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">{dt.active === false ? '已停用' : '启用中'}</span></div>
                              <div className="col-span-3"><span className="text-gray-400 text-xs">备注：</span><span className="text-gray-600 text-xs">{dt.notes || '—'}</span></div>
                            </div>

                            {/* 装配 BOM 模板 */}
                            <div className="text-xs font-semibold text-gray-500 mt-5 mb-1 uppercase tracking-wide">装配 BOM 模板</div>
                            <div className="text-[11px] text-gray-400 mb-2">设备类型只定义装配模板，不占用库存；实际模块 SN 在生产计划的录入待测试设备节点绑定。</div>
                            {slots.length > 0 ? (
                              <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {['装配位置', '需要模块类型', '默认型号', '默认供应商', '数量', '是否必填', '是否允许替代模块', '备注'].map((h) => (
                                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {slots.map((slot, i) => {
                                    const sampleMat = state.materials.find((m) => m.category === getModuleCategory(slot.moduleTypeId));
                                    return (
                                    <tr key={i} className="bg-white">
                                      <td className="px-3 py-2 text-gray-800 font-medium">{slot.slotName}</td>
                                      <td className="px-3 py-2 text-gray-700">{getModuleName(slot.moduleTypeId)}<span className="ml-2 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">{getModuleCategory(slot.moduleTypeId)}</span></td>
                                      <td className="px-3 py-2 text-gray-600 text-xs">{sampleMat?.model || '来自ERP/来料'}</td>
                                      <td className="px-3 py-2 text-gray-600 text-xs">{sampleMat?.supplier || '来自ERP/来料'}</td>
                                      <td className="px-3 py-2 font-bold text-slate-700">×{slot.quantity}</td>
                                      <td className="px-3 py-2 text-xs text-gray-600">是</td>
                                      <td className="px-3 py-2 text-xs text-gray-600">{['机械臂', '电机'].includes(getModuleCategory(slot.moduleTypeId)) ? '允许（同类型）' : '否'}</td>
                                      <td className="px-3 py-2 text-xs text-gray-400">—</td>
                                    </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <div className="text-sm text-gray-400">暂无装配 BOM 模板</div>
                            )}

                            {/* 供应商信息 */}
                            <div className="text-xs font-semibold text-gray-500 mt-5 mb-1 uppercase tracking-wide">供应商信息</div>
                            <div className="text-[11px] text-gray-400 mb-2">设备类型仍是整机模板，不是库存主账；供应商字段只说明该设备类型涉及哪些模块供应商，实际到货批次 / 库存以「模块来料」与 ERP 为准。</div>
                            {(() => {
                              const supplierRows = deviceTypeSupplierRows(dt);
                              return supplierRows.length > 0 ? (
                                <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      {['模块类型', '型号', '默认供应商', '可替代供应商', '是否关键供应商'].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {supplierRows.map((r) => (
                                      <tr key={r.moduleTypeId} className="bg-white">
                                        <td className="px-3 py-2 text-gray-800 font-medium">{r.moduleName}<span className="ml-2 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">{r.category}</span></td>
                                        <td className="px-3 py-2 text-xs text-gray-600">{r.model}</td>
                                        <td className="px-3 py-2 text-xs text-gray-700">{r.defaultSupplier}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{r.altSuppliers.length ? r.altSuppliers.join('、') : '—'}</td>
                                        <td className="px-3 py-2 text-xs">{r.key ? <span className="text-red-600">关键（单一供应商）</span> : <span className="text-gray-500">一般</span>}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="text-sm text-gray-400">暂无供应商信息</div>
                              );
                            })()}

                            {/* 已关联设备 */}
                            {(() => {
                              const assembled = getAssembledDevices(dt.id);
                              const shown = assembled.slice(0, 5);
                              return (
                                <div className="mt-5">
                                  <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                                    已关联设备（{assembled.length}）
                                  </div>
                                  {assembled.length > 0 ? (
                                    <>
                                    <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">设备SN</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">装配时间</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">当前业务节点</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {shown.map((d) => (
                                          <tr key={d.id} className="bg-white">
                                            <td className="px-3 py-2 font-mono text-xs text-gray-800 font-medium">{d.sn}</td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">{d.assemblyTime || '—'}</td>
                                            <td className="px-3 py-2"><StatusBadge status={deviceBusinessNode(d)} /></td>
                                            <td className="px-3 py-2">
                                              <Link to={`/devices/${d.id}`} className="text-slate-600 hover:underline text-xs">查看详情</Link>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {assembled.length > 5 && (
                                      <div className="mt-2 text-xs text-gray-500">
                                        仅展示前 5 台，共 {assembled.length} 台，
                                        <Link to="/assets?tab=devices" className="text-blue-600 hover:underline ml-1">查看全部关联设备</Link>
                                      </div>
                                    )}
                                    </>
                                  ) : (
                                    <div className="text-sm text-gray-400">暂无已关联设备</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {state.deviceTypes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无整机类型</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination page={deviceTypePaged.page} total={deviceTypePaged.total} totalPages={deviceTypePaged.totalPages} onChange={deviceTypePaged.setPage} />
        </div>
      )}

      {/* 模块类型库 tab */}
      {activeTab === '模块类型库' && (
        <div>
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700 mb-4">
            模块类型库用于定义可被整机类型引用的模块主数据；实际到货批次和模块 SN 在「模块来料」中管理，库存数量在「模块库存汇总」中查看。此处不展示库存。
          </div>
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-600">模块类型库</div>
            {canDo('add_module_type') && (
              <button onClick={() => setShowModuleModal(true)}
                className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
                + 新增模块类型
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['模块类型ID', '模块名称', '物料大类', '规格参数', 'URDF文件', '被引用整机类型', '状态', '操作'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {moduleTypePaged.pageItems.map((mt) => {
                const isExpanded = expandedIds.has(mt.id);
                const referencedBy = getReferencingDeviceTypes(mt.id);
                return (
                  <>
                    <tr key={mt.id}
                      className={`transition-colors ${!mt.active ? 'opacity-60' : ''} ${isExpanded ? 'bg-slate-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs whitespace-nowrap">{mt.id}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{mt.name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{mt.category}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{mt.specs || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs whitespace-nowrap">{mt.urdf || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{referencedBy.length > 0 ? `${referencedBy.length} 个（${referencedBy.map((dt) => dt.name).join('、')}）` : '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${mt.active !== false ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                          {mt.active !== false ? '启用' : '已停用'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-x-3">
                          {canDo('edit_module_type') && (
                            <button onClick={() => setEditingModule(mt)} className="text-slate-600 hover:underline">编辑</button>
                          )}
                          {canDo('edit_module_type') && (
                            <button
                              onClick={() => handleToggleActive(mt)}
                              className={`hover:underline ${mt.active !== false ? 'text-red-400 hover:text-red-600' : 'text-green-600'}`}
                            >
                              {mt.active !== false ? '停用' : '启用'}
                            </button>
                          )}
                          <button onClick={() => toggleExpand(mt.id)} className="text-blue-600 hover:underline">{isExpanded ? '收起引用' : '查看引用'}</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${mt.id}-expand`}>
                        <td colSpan={8} className="px-0 py-0 bg-slate-50 border-b border-slate-200">
                          <div className="px-12 py-4 grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">规格详情</div>
                              <div className="space-y-1 text-sm">
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-16 text-xs">规格参数</span>
                                  <span className="text-gray-700">{mt.specs || '—'}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-16 text-xs">URDF文件</span>
                                  <span className="text-gray-700 font-mono text-xs">{mt.urdf || '—'}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                被引用的整机类型 ({referencedBy.length})
                              </div>
                              {referencedBy.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {referencedBy.map((dt) => (
                                    <span key={dt.id} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-full">
                                      {dt.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">暂未被任何整机类型引用</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {state.moduleTypes.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无模块类型</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination page={moduleTypePaged.page} total={moduleTypePaged.total} totalPages={moduleTypePaged.totalPages} onChange={moduleTypePaged.setPage} />
        </div>
        </div>
      )}

      {showModuleModal && (
        <ModuleTypeModal isOpen={showModuleModal} onClose={() => setShowModuleModal(false)} onSave={handleAddModuleType} />
      )}
      {editingModule && (
        <ModuleTypeModal isOpen={!!editingModule} onClose={() => setEditingModule(null)} onSave={handleEditModuleType} initial={editingModule} />
      )}
      {showDeviceTypeModal && (
        <DeviceTypeModal isOpen={showDeviceTypeModal} onClose={() => setShowDeviceTypeModal(false)} onSave={handleAddDeviceType} moduleTypes={state.moduleTypes} />
      )}
      {editingDeviceType && (
        <DeviceTypeModal isOpen={!!editingDeviceType} onClose={() => setEditingDeviceType(null)} onSave={handleEditDeviceType} moduleTypes={state.moduleTypes} initial={editingDeviceType} />
      )}
    </div>
  );
}
