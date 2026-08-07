import { useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { Btn, EmptyState, Input, Select } from '../ui';
import { createClientId } from '../../data/clientId';
import { nowText } from '../../data/dateTime';
import { batchDisplayName, deliveryRelations } from '../../data/deliveryV2';
import {
  PREPARATION_CHECKS, availableSubOrderTypes, createExecutionItems, sceneConfigForProject, subOrderTypeLabel,
  type DeliverySubOrder, type DeliverySubOrderType, type ExecutionRequirement,
} from '../../data/deliverySubOrders';

function batchPoint(batch) {
  const relationLocations = [...new Set((batch.deviceRelations || []).map((item) => item.targetLocationId || item.actualLocationId).filter(Boolean))];
  const relationIncomplete = (batch.deviceRelations || []).some((item) => !(item.targetLocationId || item.actualLocationId));
  if (batch.locationId && !relationIncomplete && (!relationLocations.length || (relationLocations.length === 1 && relationLocations[0] === batch.locationId))) return { locationId: batch.locationId, valid: true, incomplete: false };
  if (!batch.locationId && !relationIncomplete && relationLocations.length === 1) return { locationId: relationLocations[0], valid: true, incomplete: false };
  return { locationId: batch.locationId || '', valid: false, incomplete: true };
}

const requirementOptions: Array<{ value: ExecutionRequirement; label: string }> = [
  { value: 'required', label: '必填' }, { value: 'optional', label: '选填' }, { value: 'not-applicable', label: '不适用' },
];

export default function DeliverySubOrderCreateModal({ isOpen, onClose, onCreate, onViewBatches, plan, project, state, initialType = '', initialLocationId = '', sourcePreparationId = '' }: {
  isOpen: boolean; onClose: () => void; onCreate: (subOrder: DeliverySubOrder) => void | Promise<void>; onViewBatches?: () => void; plan: any; project: any; state: any;
  initialType?: DeliverySubOrderType | ''; initialLocationId?: string; sourcePreparationId?: string;
}) {
  const typeOptions = availableSubOrderTypes(project?.projectType);
  const defaultType = initialType || (typeOptions.length === 1 ? typeOptions[0].value : '');
  const [form, setForm] = useState({
    type: defaultType, locationId: initialLocationId, batchId: '', owner: plan.owner || project?.manager || state.currentUser || '', plannedTime: '', notes: '', deviceIds: [] as string[],
    executionItems: createExecutionItems(project?.projectType),
  });
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitGuard = useRef(false);
  const relations = useMemo(() => deliveryRelations(plan), [plan]);
  const subOrders = state.deliverySubOrders.filter((item) => item.deliveryPlanId === plan.id);
  const locations = state.locations.filter((item) => item.projectId === plan.projectId && !item.disabled);
  const batchPoints = plan.batches.map((batch) => ({ batch, ...batchPoint(batch) }));
  const selectedBatch = plan.batches.find((item) => item.id === form.batchId);
  const selectedBatchPoint = selectedBatch ? batchPoint(selectedBatch) : null;
  const validBatches = batchPoints.filter((item) => item.valid && (!form.locationId || item.locationId === form.locationId || item.batch.id === form.batchId));
  const incompleteBatches = batchPoints.filter((item) => item.incomplete);
  const matchingBatches = validBatches.filter((item) => item.locationId === form.locationId);
  const allEligibleRelations = useMemo(() => relations.filter((relation) => {
    const point = batchPoint(relation.batch);
    const relationLocation = relation.targetLocationId || relation.actualLocationId;
    return form.locationId && point.valid && relationLocation && relationLocation === point.locationId && point.locationId === form.locationId && (!form.batchId || relation.batch.id === form.batchId);
  }), [relations, form.locationId, form.batchId]);
  const allCandidateRows = allEligibleRelations.map((relation) => ({ relation, device: state.devices.find((item) => item.id === relation.deviceId) })).filter((row) => row.device);
  const candidateRows = allCandidateRows.filter(({ device }) => !query || `${device.sn} ${device.robotNo}`.toLowerCase().includes(query.toLowerCase()));
  const linkedByOtherOrder = (deviceId) => subOrders.find((item) => item.type === 'deployment' && item.status !== '已完成' && item.devices.some((device) => device.deviceId === deviceId));
  const selectableRows = allCandidateRows.filter((row) => !linkedByOtherOrder(row.device.id));
  const preparation = subOrders.find((item) => item.id === sourcePreparationId) || subOrders.find((item) => item.type === 'preparation' && item.locationId === form.locationId && item.status === '已完成');
  const preparationComplete = Boolean(preparation?.status === '已完成');
  const scene = sceneConfigForProject(project?.projectType);
  const duplicate = subOrders.find((item) => item.type === form.type && item.locationId === form.locationId && item.status !== '已完成');
  const taskContact = plan.owner || project?.manager || '—';

  const update = (key, value) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: '' })); setSubmitError(''); };
  const changeType = (type) => setForm((prev) => ({ ...prev, type, batchId: '', deviceIds: [], executionItems: createExecutionItems(project?.projectType) }));
  const changeLocation = (locationId) => setForm((prev) => ({ ...prev, locationId, batchId: '', deviceIds: [] }));
  const changeBatch = (batchId) => {
    const batch = plan.batches.find((item) => item.id === batchId);
    const point = batch ? batchPoint(batch) : null;
    setForm((prev) => ({ ...prev, batchId, locationId: batch && point?.valid ? point.locationId : prev.locationId, deviceIds: [] }));
    setErrors((prev) => ({ ...prev, batchId: '', locationId: '', deviceIds: '' }));
  };
  const toggleDevice = (deviceId) => update('deviceIds', form.deviceIds.includes(deviceId) ? form.deviceIds.filter((item) => item !== deviceId) : [...form.deviceIds, deviceId]);
  const setRequirement = (key, requirement) => update('executionItems', form.executionItems.map((item) => item.key === key ? { ...item, requirement, status: requirement === 'not-applicable' ? '不适用' : '未开始' } : item));

  const validation = () => {
    const next: Record<string, string> = {};
    if (!form.type) next.type = '请先选择子工单类型。';
    if (!form.locationId) next.locationId = '请选择本次现场任务的交付点位。';
    if (form.type === 'preparation' && !form.owner) next.owner = '请选择当前跟进人。';
    if (!form.plannedTime) next.plannedTime = '请选择计划开始时间。';
    if (form.type === 'deployment' && selectedBatch && !selectedBatchPoint?.valid) next.batchId = '当前批次点位信息不完整，暂时无法用于创建子工单。';
    if (form.type === 'deployment' && scene.requiresPreparation && form.locationId && !preparationComplete) next.preparation = '当前点位的前置准备尚未完成，暂不能创建设备部署子工单。';
    if (form.type === 'deployment' && !form.deviceIds.length) {
      if (!allEligibleRelations.length && matchingBatches.length) next.deviceIds = '当前点位暂无已纳入交付批次的设备，请先在交付批次中纳入设备。';
      else if (!selectableRows.length && allCandidateRows.length) next.deviceIds = '当前点位的设备均已关联其他未完成部署子工单。';
      else next.deviceIds = '请至少选择一台已纳入交付批次的设备。';
    }
    return next;
  };
  const blockers = validation();
  const createDisabled = submitting || Object.keys(blockers).length > 0;
  const emptyMessage = !form.locationId ? '请先选择交付点位。'
    : selectedBatch && !selectedBatchPoint?.valid ? '当前批次点位信息不完整，暂时无法用于创建子工单。'
      : !allEligibleRelations.length && matchingBatches.length ? '当前点位暂无已纳入交付批次的设备，请先在交付批次中纳入设备。'
        : !allCandidateRows.length && incompleteBatches.length ? '当前交付执行存在批次点位信息不完整，暂时无法用于创建子工单。'
          : !candidateRows.length && allCandidateRows.length ? `当前筛选条件下无匹配设备，可切换点位、批次或搜索条件。`
            : '当前点位暂无可用于部署的批次设备。请先查看交付批次，确认已建立批次并纳入设备。';

  const submit = async () => {
    if (submitGuard.current) return;
    const next = validation();
    if (Object.keys(next).length) return setErrors(next);
    submitGuard.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const time = nowText();
      const type = form.type as DeliverySubOrderType;
      const location = locations.find((item) => item.id === form.locationId);
      const selectedRelations = allEligibleRelations.filter((item) => form.deviceIds.includes(item.deviceId));
      const id = createClientId('DSO', plan.id, type === 'preparation' ? 'PRE' : 'DEP');
      const subOrder: DeliverySubOrder = {
        id, name: `${location?.name || '交付点位'}${subOrderTypeLabel(type)}`, deliveryPlanId: plan.id, type, locationId: form.locationId,
        batchId: type === 'deployment' ? form.batchId || undefined : undefined, contact: taskContact, owner: type === 'preparation' ? form.owner : '', engineer: undefined,
        createdBy: state.currentUser || taskContact, plannedTime: form.plannedTime, status: type === 'preparation' ? '未开始' : '待分派', currentNode: type === 'preparation' ? PREPARATION_CHECKS[0].key : 'assignment',
        createdAt: time, updatedAt: time, notes: form.notes.trim(), sourcePreparationId: type === 'deployment' ? preparation?.id : undefined,
        checks: type === 'preparation' ? PREPARATION_CHECKS.map((item) => ({ ...item, status: '未开始', note: '', materials: [] })) : [],
        executionItems: type === 'deployment' ? form.executionItems : [],
        devices: type === 'deployment' ? selectedRelations.map((relation) => ({ id: createClientId('DSOD'), deviceId: relation.deviceId, deliveryRelationId: relation.id, batchId: relation.batch.id, installationStatus: '未开始', materials: [] })) : [],
        blocks: [], issueLinks: [], logs: [{ id: createClientId('DSOLOG'), operator: state.currentUser || taskContact, time, action: '创建子工单', notes: type === 'deployment' ? `${subOrderTypeLabel(type)}，关联 ${selectedRelations.length} 台批次设备，等待分派执行工程师` : `${subOrderTypeLabel(type)}，跟进人 ${form.owner}` }],
      };
      await Promise.resolve(onCreate(subOrder));
    } catch (error) {
      submitGuard.current = false; setSubmitting(false); setSubmitError(error instanceof Error ? error.message : '创建失败，请检查后重试。');
    }
  };

  return <Modal size="2xl" isOpen={isOpen} onClose={submitting ? () => {} : onClose} title="新建交付子工单">
    <div className="space-y-5">
      <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">按“类型 → 点位 → 批次 → 设备 → 本次现场任务 → 计划信息”的顺序创建。设备只来自当前交付执行已经纳入批次、点位关系完整的设备。</div>
      <section className="space-y-3"><h3 className="text-[13px] font-semibold text-gray-800">1. 确定现场任务</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs text-gray-600 mb-1">子工单类型 <span className="text-red-500">*</span></label><Select className="w-full" value={form.type} disabled={Boolean(initialType)} onChange={(event) => changeType(event.target.value)}><option value="">请选择</option>{typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>{errors.type && <p className="text-xs text-red-600 mt-1">{errors.type}</p>}</div><div><label className="block text-xs text-gray-600 mb-1">交付点位 <span className="text-red-500">*</span></label><Select className="w-full" value={form.locationId} disabled={Boolean(form.batchId || initialLocationId)} onChange={(event) => changeLocation(event.target.value)}><option value="">请选择</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{form.batchId && <p className="text-xs text-gray-400 mt-1">点位已由所选批次带出；清除批次后可重新选择。</p>}{errors.locationId && <p className="text-xs text-red-600 mt-1">{errors.locationId}</p>}</div></div></section>
      {form.type === 'deployment' && <section className="space-y-3 border-t border-gray-100 pt-4"><h3 className="text-[13px] font-semibold text-gray-800">2. 从当前交付执行选择设备</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs text-gray-600 mb-1">关联交付批次 <span className="text-gray-400">（选填）</span></label><Select className="w-full" value={form.batchId} onChange={(event) => changeBatch(event.target.value)}><option value="">不限定批次，显示当前点位全部批次设备</option>{validBatches.map((item) => <option key={item.batch.id} value={item.batch.id}>{batchDisplayName(item.batch)}</option>)}</Select><p className="text-xs text-gray-400 mt-1">仅显示点位关系完整的批次；选择后设备范围限定在该批次。</p>{errors.batchId && <p className="text-xs text-red-600 mt-1">{errors.batchId}</p>}</div><div><label className="block text-xs text-gray-600 mb-1">任务联系人</label><Input className="w-full bg-gray-50" value={taskContact} disabled /><p className="text-xs text-gray-400 mt-1">执行工程师在创建后通过“分派”确定。</p></div></div>{incompleteBatches.length > 0 && <p className="text-xs text-amber-700">发现 {incompleteBatches.length} 个批次的点位或批次设备关系不完整，已排除，未根据项目设备点位推测补全。</p>}{scene.requiresPreparation && form.locationId && !preparationComplete && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{errors.preparation || blockers.preparation}</p>}<div className="rounded-md border border-gray-200 p-3 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-gray-700">交付设备 <span className="text-red-500">*</span></p><p className="text-xs text-gray-400 mt-0.5">来源：当前交付执行 → 当前点位{selectedBatch ? ` → ${batchDisplayName(selectedBatch)}` : ' → 全部已关联批次'}</p></div><Input className="w-64" placeholder="搜索设备 SN / 机器人编号" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{candidateRows.length ? <div className="max-h-60 overflow-auto rounded-md border border-gray-200 divide-y divide-gray-100">{candidateRows.map(({ relation, device }) => { const linked = linkedByOtherOrder(device.id); const linkedLocation = linked ? state.locations.find((item) => item.id === linked.locationId)?.name || '当前点位' : ''; return <label key={relation.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${linked ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}><input type="checkbox" disabled={Boolean(linked)} checked={form.deviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} /><span className="font-mono">{device.sn}</span><span className="font-mono">{device.robotNo}</span><span>{state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || '—'}</span><span className="ml-auto">{linked ? `已关联部署任务：${subOrderTypeLabel(linked.type)} · ${linkedLocation}` : batchDisplayName(relation.batch)}</span></label>; })}</div> : <EmptyState className="py-6"><div className="space-y-2"><p>{emptyMessage}</p>{form.locationId && onViewBatches && <Btn size="sm" onClick={onViewBatches}>查看交付批次</Btn>}</div></EmptyState>}<div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-600">已选择 <span className="font-semibold text-gray-900">{form.deviceIds.length}</span> 台</p>{errors.deviceIds && <p className="text-xs text-red-600">{errors.deviceIds}</p>}</div></div></section>}
      {form.type === 'deployment' && <section className="space-y-3 border-t border-gray-100 pt-4"><h3 className="text-[13px] font-semibold text-gray-800">3. 确认本次现场任务</h3><p className="text-xs text-gray-500">以下内容根据项目类型推荐，请根据本次实际交付任务确认。创建后不可随意修改事项适用性；单台设备的安装调试、验收和问题在“设备执行与验收”中分别记录。</p><div className="rounded-md border border-gray-200 divide-y divide-gray-100">{form.executionItems.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 px-3 py-2"><span className="text-xs text-gray-700">{item.label}</span><Select className="w-28 text-xs" value={item.requirement} onChange={(event) => setRequirement(item.key, event.target.value as ExecutionRequirement)}>{requirementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>)}</div></section>}
      <section className="space-y-3 border-t border-gray-100 pt-4"><h3 className="text-[13px] font-semibold text-gray-800">{form.type === 'deployment' ? '4' : '2'}. 填写计划信息</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{form.type === 'preparation' && <div><label className="block text-xs text-gray-600 mb-1">当前跟进人 <span className="text-red-500">*</span></label><Select className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)}><option value="">请选择</option>{[...new Set([plan.owner, project?.manager, state.currentUser, ...plan.batches.map((item) => item.owner)].filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</Select>{errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}</div>}<div><label className="block text-xs text-gray-600 mb-1">计划开始时间 <span className="text-red-500">*</span></label><Input className="w-full" type="datetime-local" value={form.plannedTime} onInput={(event) => update('plannedTime', event.currentTarget.value)} onChange={(event) => update('plannedTime', event.target.value)} />{errors.plannedTime && <p className="text-xs text-red-600 mt-1">{errors.plannedTime}</p>}</div></div><div><label className="block text-xs text-gray-600 mb-1">任务说明 <span className="text-gray-400">（选填）</span></label><textarea className="ui-input w-full min-h-20" placeholder="补充本次现场任务范围或注意事项" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div></section>
      {duplicate && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前点位已有未完成的同类型任务“{duplicate.name}”，请确认是否需要再次创建。</p>}{submitError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</p>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"><p className="text-xs text-gray-500">{createDisabled && !submitting ? Object.values(blockers)[0] : '创建后将进入工单详情；部署工单从“待分派”开始。'}</p><div className="flex gap-2"><Btn disabled={submitting} onClick={onClose}>取消</Btn><Btn variant="primary" disabled={createDisabled} onClick={submit}>{submitting ? '创建中…' : '创建子工单'}</Btn></div></div>
    </div>
  </Modal>;
}
