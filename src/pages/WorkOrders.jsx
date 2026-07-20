import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FEISHU_USERS } from '../data/mockData';

// ──────────────── modals ────────────────

function AddWorkOrderModal({ isOpen, onClose, onSave, devices, currentUser }) {
  const [form, setForm] = useState({ deviceId: '', description: '', severity: '高', assignedTo: currentUser });

  const handleSubmit = (e) => {
    e.preventDefault();
    const device = devices.find((d) => d.id === form.deviceId);
    onSave({ ...form, deviceSN: device?.sn || '', projectId: device?.projectId || null });
    onClose();
    setForm({ deviceId: '', description: '', severity: '高', assignedTo: currentUser });
  };

  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增工单">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">设备 *</label>
          <select className={inputClass} required value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
            <option value="">-- 选择设备 --</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
            <select className={inputClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option>高</option><option>中</option><option>低</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">处理人</label>
            <input type="text" className={inputClass} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">故障描述 *</label>
          <textarea rows={3} className={inputClass} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function EditWorkOrderModal({ isOpen, onClose, wo, onSave }) {
  const [form, setForm] = useState({ description: wo?.description || '', severity: wo?.severity || '高', notes: wo?.notes || '' });
  if (!wo) return null;
  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑工单 ${wo.id}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">故障描述 *</label>
          <textarea rows={3} className={inp} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
          <select className={inp} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option>高</option><option>中</option><option>低</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={() => { onSave(form); onClose(); }}
            disabled={!form.description.trim()}
            className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800 disabled:opacity-40">
            保存修改
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VoidWorkOrderModal({ isOpen, onClose, wo, onSave }) {
  const [reason, setReason] = useState('');
  if (!wo) return null;
  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="作废工单">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
          工单作废后将灰显不计入统计，但仍可查看原始内容，此操作不可撤销。
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">作废原因 *</label>
          <textarea rows={3} className={inp} required value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="请填写作废原因" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={() => { onSave(reason); onClose(); }}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-40">
            确认作废
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StartProcessingModal({ isOpen, onClose, onConfirm, currentUser }) {
  const [assignee, setAssignee] = useState(currentUser);
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="开始处理">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">确认承接此工单并开始处理。</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">承接人</label>
          <select className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {FEISHU_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}（{u.dept}）</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={() => { onConfirm(assignee); onClose(); }}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">确认开始处理</button>
        </div>
      </div>
    </Modal>
  );
}

function SubmitRecheckModal({ isOpen, onClose, onConfirm }) {
  const [recheckPerson, setRecheckPerson] = useState('');
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="提交复检">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">维修操作已完成，提交复检。请指定复检人员。</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">复检人 *</label>
          <select className={inputClass} value={recheckPerson} onChange={(e) => setRecheckPerson(e.target.value)}>
            <option value="">-- 选择复检人 --</option>
            {FEISHU_USERS.map((u) => <option key={u.id} value={u.name}>{u.name}（{u.dept}）</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={() => { if (recheckPerson) { onConfirm(recheckPerson); onClose(); } }}
            disabled={!recheckPerson}
            className="px-4 py-2 text-sm text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50">
            提交复检
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddReplacementModal({ isOpen, onClose, onConfirm, device, deviceType, materials }) {
  const slots = deviceType?.slots || [];
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [disposition, setDisposition] = useState('维修中');

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  // Find current material in this slot
  const currentMaterial = selectedSlot
    ? (device.usedMaterials || [])
        .map((um) => materials.find((m) => m.id === um.materialId))
        .filter(Boolean)
        .find((m) => {
          const um = (device.usedMaterials || []).find((u) => u.materialId === m.id);
          return um?.moduleTypeId === selectedSlot.moduleTypeId;
        })
    : null;

  // Available replacement materials (same moduleType, status = '待装配')
  const availableMaterials = selectedSlot
    ? materials.filter((m) =>
        m.status === '待装配' &&
        (device.usedMaterials || []).every((um) => um.materialId !== m.id)
      )
    : [];

  // Filter by matching category of the slot's moduleType
  const [selectedNewMatId, setSelectedNewMatId] = useState('');

  const handleSlotChange = (slotId) => {
    setSelectedSlotId(slotId);
    setSelectedNewMatId('');
  };

  const handleConfirm = () => {
    if (!selectedSlot || !selectedNewMatId) return;
    const newMat = materials.find((m) => m.id === selectedNewMatId);
    onConfirm({
      slotName: selectedSlot.slotName,
      slotModuleTypeId: selectedSlot.moduleTypeId,
      removedMaterialId: currentMaterial?.id || null,
      addedMaterialId: selectedNewMatId,
      removedDisposition: disposition,
      currentMaterialSN: currentMaterial?.sn || '（未安装）',
      newMaterialSN: newMat?.sn || selectedNewMatId,
    });
    onClose();
    setSelectedSlotId('');
    setSelectedNewMatId('');
    setDisposition('维修中');
  };

  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="记录换件" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">选择槁位 *</label>
          <select className={inputClass} value={selectedSlotId} onChange={(e) => handleSlotChange(e.target.value)}>
            <option value="">-- 选择槁位 --</option>
            {slots.map((s) => <option key={s.id} value={s.id}>{s.slotName}</option>)}
          </select>
        </div>

        {selectedSlot && (
          <div className="bg-gray-50 rounded p-3 text-sm">
            <div className="text-gray-500 text-xs mb-1">当前槁位模块</div>
            <div className="font-mono text-gray-700">{currentMaterial?.sn || '（未安装）'}</div>
            {currentMaterial && <div className="text-xs text-gray-400 mt-0.5">{currentMaterial.model} · {currentMaterial.category}</div>}
          </div>
        )}

        {selectedSlot && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择替换模块 * <span className="text-gray-400 font-normal">（在库待装配）</span></label>
            <select className={inputClass} value={selectedNewMatId} onChange={(e) => setSelectedNewMatId(e.target.value)}>
              <option value="">-- 选择新模块 --</option>
              {availableMaterials.map((m) => (
                <option key={m.id} value={m.id}>{m.sn} · {m.model} · {m.category}</option>
              ))}
            </select>
            {availableMaterials.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">暂无在库待装配的模块</p>
            )}
          </div>
        )}

        {selectedSlot && currentMaterial && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">旧模块去向</label>
            <div className="flex gap-3">
              {['维修中', '已报废'].map((d) => (
                <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="disposition" value={d} checked={disposition === d} onChange={() => setDisposition(d)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">{d}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={handleConfirm}
            disabled={!selectedSlot || !selectedNewMatId}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">
            确认换件
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────── expanded work order detail ────────────────

function WorkOrderDetail({ wo, state, dispatch, currentUser, canDo }) {
  const { devices, deviceTypes, materials, moduleTypes, projects, moduleReplacements } = state;

  const [showStartModal, setShowStartModal] = useState(false);
  const [showRecheckModal, setShowRecheckModal] = useState(false);
  const [showAddReplModal, setShowAddReplModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [recheckResult, setRecheckResult] = useState('');

  const device = devices.find((d) => d.id === wo.deviceId);
  const deviceType = deviceTypes.find((dt) => dt.id === device?.deviceTypeId);
  const project = projects.find((p) => p.id === wo.projectId);
  const woReplacements = moduleReplacements.filter((mr) => mr.workOrderId === wo.id);

  const getMaterialSN = (id) => materials.find((m) => m.id === id)?.sn || id;
  const getModuleName = (id) => moduleTypes.find((m) => m.id === id)?.name || id;

  const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

  const handleStartProcessing = (assignee) => {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, status: '处理中', assignedTo: assignee, updatedAt: now() } });
  };

  const handleSubmitRecheck = (recheckPerson) => {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, status: '复检中', recheckPerson, updatedAt: now() } });
  };

  const handleRevertToProcessing = () => {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, status: '处理中', recheckResult: null, updatedAt: now() } });
    setRecheckResult('');
  };

  const handleCloseOrder = () => {
    const t = now();
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, status: '已关闭', recheckResult: '合格', closedAt: t, updatedAt: t } });
  };

  const handleEdit = (form) => {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, ...form, updatedAt: now() } });
  };

  const handleVoid = (voidReason) => {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, status: '已作废', voidReason, updatedAt: now() } });
  };

  const handleAddReplacement = ({ slotName, slotModuleTypeId, removedMaterialId, addedMaterialId, removedDisposition }) => {
    const t = now();
    const mrId = `MR-${Date.now()}`;

    // Create module replacement record
    dispatch({
      type: 'ADD_MODULE_REPLACEMENT',
      payload: {
        id: mrId, workOrderId: wo.id, deviceId: wo.deviceId,
        slotName, removedMaterialId, addedMaterialId,
        removedDisposition, operator: currentUser, timestamp: t, notes: '',
      },
    });

    // Update old material status
    if (removedMaterialId) {
      dispatch({ type: 'UPDATE_MATERIAL', payload: { id: removedMaterialId, status: removedDisposition } });
    }

    // Update new material status
    dispatch({ type: 'UPDATE_MATERIAL', payload: { id: addedMaterialId, status: '已占用' } });

    // Update device usedMaterials (swap old for new)
    if (device && removedMaterialId) {
      const updatedMaterials = (device.usedMaterials || []).map((um) =>
        um.materialId === removedMaterialId
          ? { ...um, materialId: addedMaterialId }
          : um
      );
      dispatch({ type: 'UPDATE_DEVICE', payload: { id: device.id, usedMaterials: updatedMaterials, updatedAt: t } });
    } else if (device && !removedMaterialId) {
      // If no old material, add new one
      const updatedMaterials = [...(device.usedMaterials || []), { materialId: addedMaterialId, moduleTypeId: slotModuleTypeId }];
      dispatch({ type: 'UPDATE_DEVICE', payload: { id: device.id, usedMaterials: updatedMaterials, updatedAt: t } });
    }

    // Update work order replacedModules
    const updated = [...(wo.replacedModules || []), { removedMaterialId, addedMaterialId, moduleTypeId: slotModuleTypeId }];
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { id: wo.id, replacedModules: updated, updatedAt: t } });

    // Add operation log
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: `LOG-${Date.now()}`,
        deviceId: wo.deviceId,
        operator: currentUser,
        timestamp: t,
        actionType: '模块更换',
        fromStatus: device?.status,
        toStatus: device?.status,
        notes: `${slotName} 模块更换，关联工单 ${wo.id}`,
      },
    });
  };

  return (
    <div className="px-6 py-5 space-y-5 bg-slate-50 border-b border-slate-200">
      {/* ── Status & Action row ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div><span className="text-gray-500">状态：</span><StatusBadge status={wo.status} /></div>
          <div><span className="text-gray-500">严重程度：</span><StatusBadge status={wo.severity} /></div>
          <div><span className="text-gray-500">所属项目：</span>
            {project
              ? <Link to={`/projects/${project.id}`} className="text-slate-700 hover:text-blue-600 hover:underline">{project.name}</Link>
              : <span className="text-gray-800">—</span>}
          </div>
          {wo.recheckPerson && <div><span className="text-gray-500">复检人：</span><span className="text-gray-800">{wo.recheckPerson}</span></div>}
          {wo.closedAt && <div><span className="text-gray-500">关闭时间：</span><span className="text-gray-700">{wo.closedAt}</span></div>}
        </div>

        {/* Action buttons — role + status gated */}
        <div className="flex gap-2 flex-wrap">
          {wo.status === '待处理' && canDo('update_work_order') && (
            <button onClick={() => setShowStartModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
              开始处理
            </button>
          )}
          {wo.status === '处理中' && canDo('update_work_order') && (
            <>
              <button onClick={() => setShowAddReplModal(true)}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                记录换件
              </button>
              <button onClick={() => setShowRecheckModal(true)}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
                提交复检
              </button>
            </>
          )}
          {['待处理', '处理中'].includes(wo.status) && canDo('update_work_order') && (
            <button onClick={() => setShowEditModal(true)}
              className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
              编辑
            </button>
          )}
          {wo.status !== '已关闭' && wo.status !== '已作废' && canDo('update_work_order') && (
            <button onClick={() => setShowVoidModal(true)}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
              作废工单
            </button>
          )}
        </div>
      </div>

      {/* ── Fault description + repair actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">故障描述</div>
          <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded p-3 leading-relaxed">{wo.description}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">维修措施</div>
          <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded p-3 leading-relaxed min-h-[60px]">
            {wo.repairActions || <span className="text-gray-400">暂无记录</span>}
          </div>
        </div>
      </div>
      {wo.notes && (
        <div className="text-sm"><span className="text-gray-500">备注：</span><span className="text-gray-700">{wo.notes}</span></div>
      )}

      {/* ── 换件记录 ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">换件记录</div>
          {wo.status === '处理中' && canDo('update_work_order') && (
            <button onClick={() => setShowAddReplModal(true)}
              className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-300 rounded hover:bg-indigo-100">
              + 添加换件
            </button>
          )}
        </div>
        {woReplacements.length > 0 ? (
          <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                {['槁位', '被换下模块SN（旧）', '装入模块SN（新）', '旧模块去向', '操作时间', '操作人'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {woReplacements.map((mr) => (
                <tr key={mr.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{mr.slotName}</td>
                  <td className="px-3 py-2 font-mono text-red-600">{getMaterialSN(mr.removedMaterialId)}</td>
                  <td className="px-3 py-2 font-mono text-green-700">{getMaterialSN(mr.addedMaterialId)}</td>
                  <td className="px-3 py-2"><StatusBadge status={mr.removedDisposition} size="xs" /></td>
                  <td className="px-3 py-2 text-gray-500">{mr.timestamp}</td>
                  <td className="px-3 py-2 text-gray-600">{mr.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* fall back to legacy replacedModules from work order data */
          wo.replacedModules && wo.replacedModules.length > 0 ? (
            <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  {['模块类型', '被换下模块SN', '装入模块SN'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wo.replacedModules.map((rm, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{getModuleName(rm.moduleTypeId)}</td>
                    <td className="px-3 py-2 font-mono text-red-600">{getMaterialSN(rm.removedMaterialId)}</td>
                    <td className="px-3 py-2 font-mono text-green-700">{getMaterialSN(rm.addedMaterialId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-gray-400 py-2">本工单暂无换件记录</div>
          )
        )}
      </div>

      {/* ── 附件 ── */}
      <div>
        <div className="text-sm font-semibold text-gray-700 mb-3">附件</div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">问题描述文档</label>
            <textarea
              rows={2}
              placeholder="填写附件描述或备注（选填）"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-slate-400 bg-white resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">日志文件</label>
              <input
                type="text"
                placeholder="日志文件名（如 device-log-2026.txt）"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-slate-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">现场照片</label>
              <input
                type="text"
                placeholder="图片文件名（如 site-photo.jpg）"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-slate-400 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 复检区域 (shown only in 复检中 status) ── */}
      {wo.status === '复检中' && (
        <div className="bg-purple-50 border border-purple-200 rounded p-4">
          <div className="text-sm font-semibold text-purple-800 mb-3">复检操作</div>
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-1.5">复检结果</div>
            <div className="flex gap-4">
              {['合格', '不合格'].map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`recheck-${wo.id}`} value={r}
                    checked={recheckResult === r} onChange={() => setRecheckResult(r)}
                    className="text-purple-600" />
                  <span className={`text-sm font-medium ${r === '合格' ? 'text-green-700' : 'text-red-700'}`}>{r}</span>
                </label>
              ))}
            </div>
          </div>
          {recheckResult && canDo('recheck_work_order') && (
            <div className="flex gap-2 mt-3">
              {recheckResult === '不合格' && (
                <button onClick={handleRevertToProcessing}
                  className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">
                  打回维修
                </button>
              )}
              {recheckResult === '合格' && (
                <button onClick={handleCloseOrder}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                  关闭工单
                </button>
              )}
            </div>
          )}
          {!canDo('recheck_work_order') && (
            <p className="text-xs text-gray-400 mt-2">仅质检员可操作复检</p>
          )}
        </div>
      )}

      {/* ── Closed result ── */}
      {wo.status === '已关闭' && wo.recheckResult && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">复检结果：</span>
          <StatusBadge status={wo.recheckResult} />
        </div>
      )}

      {/* ── Modals ── */}
      <StartProcessingModal isOpen={showStartModal} onClose={() => setShowStartModal(false)}
        onConfirm={handleStartProcessing} currentUser={currentUser} />
      <SubmitRecheckModal isOpen={showRecheckModal} onClose={() => setShowRecheckModal(false)}
        onConfirm={handleSubmitRecheck} />
      {device && deviceType && (
        <AddReplacementModal isOpen={showAddReplModal} onClose={() => setShowAddReplModal(false)}
          onConfirm={handleAddReplacement} device={device} deviceType={deviceType} materials={materials} />
      )}
      <EditWorkOrderModal isOpen={showEditModal} onClose={() => setShowEditModal(false)}
        wo={wo} onSave={handleEdit} />
      <VoidWorkOrderModal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)}
        wo={wo} onSave={handleVoid} />
    </div>
  );
}

// ──────────────── main page ────────────────

export default function WorkOrders() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [searchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState('全部');
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const s = searchParams.get('status');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setFilterStatus(s);
    const highlight = searchParams.get('highlight');
    if (highlight) setExpandedId(highlight);
  }, [searchParams]);

  const { workOrders, devices } = state;

  const onlineDevices = devices.filter((d) => ['在线运营', '已分配项目', '待分配项目'].includes(d.status));

  const filtered = [...workOrders]
    .filter((w) => filterStatus === '全部' || w.status === filterStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleSave = (form) => {
    const t = new Date().toISOString().slice(0, 16).replace('T', ' ');
    dispatch({
      type: 'ADD_WORK_ORDER',
      payload: {
        id: `WO-${Date.now()}`,
        deviceId: form.deviceId, deviceSN: form.deviceSN, projectId: form.projectId,
        description: form.description, severity: form.severity,
        status: '待处理', assignedTo: form.assignedTo,
        createdAt: t, updatedAt: t, closedAt: null,
        repairActions: '', replacedModules: [], recheckResult: null, notes: '',
      },
    });
  };

  const statusCounts = { '待处理': 0, '处理中': 0, '复检中': 0, '已关闭': 0, '已作废': 0 };
  workOrders.forEach((w) => { if (statusCounts[w.status] !== undefined) statusCounts[w.status]++; });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">维修工单</h1>
        {canDo('add_work_order') && (
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
            + 新增工单
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        {['全部', '待处理', '处理中', '复检中', '已关闭', '已作废'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
              filterStatus === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}>
            {s}
            {s !== '全部'
              ? <span className="ml-1 font-bold">{statusCounts[s] ?? 0}</span>
              : <span className="ml-1">{workOrders.length}</span>
            }
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">共 {filtered.length} 条</span>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['工单号', '设备SN', '故障描述', '严重程度', '状态', '处理人', '创建时间', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((wo) => {
              const isExpanded = expandedId === wo.id;
              return (
                <React.Fragment key={wo.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : wo.id)}
                    className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-blue-50 ${isExpanded ? 'bg-slate-50' : ''} ${wo.status === '已作废' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      <span className={wo.status === '已作废' ? 'line-through' : ''}>{wo.id}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-800 font-medium">{wo.deviceSN}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[200px]">
                      <div className="truncate">{wo.description}</div>
                      {wo.status === '已作废' && wo.voidReason && (
                        <div className="text-xs text-red-400 mt-0.5 truncate">作废原因：{wo.voidReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={wo.severity} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={wo.status} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{wo.assignedTo}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{wo.createdAt}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{isExpanded ? '▲ 收起' : '▼ 展开'}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <WorkOrderDetail
                          wo={wo}
                          state={state}
                          dispatch={dispatch}
                          currentUser={state.currentUser}
                          canDo={canDo}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无工单</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddWorkOrderModal
          isOpen={showModal} onClose={() => setShowModal(false)}
          onSave={handleSave} devices={onlineDevices} currentUser={state.currentUser}
        />
      )}
    </div>
  );
}
