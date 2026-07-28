import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { isProductionComplete } from '../data/prdV12';
import { deliveryErpReferences } from '../data/erpPrototype';
import {
  Page, PageHeader, Section, DescList, Table, Btn, Input, Select, EmptyState,
} from '../components/ui';

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const TABS = [
  ['basic', '基础信息'],
  ['devices', '关联设备'],
  ['execution', '执行记录'],
  ['result', '交付结果'],
  ['exceptions', '交付异常'],
  ['logs', '操作日志'],
];
const TAB_KEYS = new Set(TABS.map(([key]) => key));

function TabBar({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200">
      {TABS.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-2 text-[13px] border-b-2 ${active === key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ResultChoice({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {['通过', '未通过'].map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => onChange(option)}
          className={`h-10 rounded-md border text-[13px] font-medium ${
            value === option
              ? option === '通过' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function DeviceChecks({ devices, selected, onToggle }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
      {devices.length ? devices.map((device) => (
        <label key={device.id} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
          <input type="checkbox" checked={selected.includes(device.id)} onChange={() => onToggle(device.id)} />
          <span className="font-mono text-xs">{device.sn}</span>
          <span className="font-mono text-xs text-gray-400">{device.robotNo}</span>
        </label>
      )) : <EmptyState className="py-5">暂无可选设备</EmptyState>}
    </div>
  );
}

function BasicForm({ plan, state, onClose, onSave }) {
  const references = deliveryErpReferences();
  const [form, setForm] = useState({
    title: plan.title || plan.name || '',
    owner: plan.owner || '',
    demandDescription: plan.demandDescription || '',
    feishuDemandUrl: plan.feishuDemandUrl || '',
    notes: plan.notes || '',
    erpReference: plan.erpReferenceNo ? `${plan.erpReferenceType}::${plan.erpReferenceNo}` : '',
  });
  const [errors, setErrors] = useState({});
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const submit = () => {
    const next = {};
    if (!form.title.trim()) next.title = '请填写交付执行名称。';
    if (!form.owner) next.owner = '请选择负责人。';
    if (form.feishuDemandUrl && !/^https?:\/\/\S+$/i.test(form.feishuDemandUrl)) next.feishuDemandUrl = '请输入有效的 http 或 https 链接。';
    if (Object.keys(next).length) return setErrors(next);
    const [erpReferenceType = '', erpReferenceNo = ''] = form.erpReference.split('::');
    onSave({ ...form, erpReferenceType, erpReferenceNo });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">交付执行名称 <span className="text-red-500">*</span></label>
        <Input className="w-full" value={form.title} onChange={(event) => update('title', event.target.value)} />
        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">负责人 <span className="text-red-500">*</span></label>
        <Select className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)}>
          <option value="">请选择负责人</option>
          {state.users.filter((item) => item.status !== '停用').map((item) => <option key={item.id} value={item.name}>{item.name} · {item.dept}</option>)}
        </Select>
        {errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}
      </div>
      <div><label className="block text-xs text-gray-600 mb-1">交付需求说明</label><textarea className="ui-input w-full min-h-20" value={form.demandDescription} onChange={(event) => update('demandDescription', event.target.value)} /></div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">相关飞书需求链接</label>
        <Input className="w-full" value={form.feishuDemandUrl} onChange={(event) => update('feishuDemandUrl', event.target.value)} placeholder="https://" />
        {errors.feishuDemandUrl && <p className="text-xs text-red-600 mt-1">{errors.feishuDemandUrl}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">ERP 销售发货单或调拨订单</label>
        <Select className="w-full" value={form.erpReference} onChange={(event) => update('erpReference', event.target.value)}>
          <option value="">暂不关联</option>
          {references.map((item) => <option key={`${item.type}-${item.no}`} value={`${item.type}::${item.no}`}>{item.type} · {item.no} · {item.date}</option>)}
        </Select>
        <p className="text-xs text-gray-400 mt-1">仅引用当前原型已有的 ERP 只读单据。</p>
      </div>
      <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>保存基础信息</Btn></div>
    </div>
  );
}

function AssociationForm({ plan, state, onClose, onSave }) {
  const hasBusinessRecords = (plan.executionRecords || []).length > 0 || !!plan.deliveryResult;
  const [form, setForm] = useState({
    projectId: plan.projectId,
    locationId: plan.locationId,
    boundDeviceIds: plan.boundDeviceIds || [],
    confirmed: false,
  });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const locations = state.locations.filter((item) => item.projectId === form.projectId && !item.disabled);
  const occupied = new Set(state.deliveryPlans
    .filter((item) => item.id !== plan.id)
    .flatMap((item) => item.boundDeviceIds || []));
  const candidates = state.devices.filter((device) => device.projectId === form.projectId
    && device.locationId === form.locationId
    && device.erpInboundNo
    && isProductionComplete(device)
    && (!occupied.has(device.id) || (plan.boundDeviceIds || []).includes(device.id))
    && (!query || `${device.sn} ${device.robotNo}`.toLowerCase().includes(query.toLowerCase())));
  const relationChanged = form.projectId !== plan.projectId || form.locationId !== plan.locationId;
  const toggle = (id) => setForm((prev) => ({
    ...prev,
    boundDeviceIds: prev.boundDeviceIds.includes(id)
      ? prev.boundDeviceIds.filter((item) => item !== id)
      : [...prev.boundDeviceIds, id],
  }));
  const submit = () => {
    if (!form.projectId || !form.locationId) return setError('请选择项目和点位。');
    if (!form.boundDeviceIds.length) return setError('请至少选择一台设备。');
    if (hasBusinessRecords && relationChanged && !form.confirmed) return setError('已有执行记录或交付结果，请确认本次重要关系变更。');
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">设备必须属于所选项目和点位，并已完成生产及 ERP 产品入库关联。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">项目</label>
          <Select className="w-full" value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value, locationId: '', boundDeviceIds: [] }))}>
            <option value="">请选择项目</option>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">点位</label>
          <Select className="w-full" value={form.locationId} onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value, boundDeviceIds: [] }))}>
            <option value="">请选择点位</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-gray-600">关联设备</label>
        <Input className="w-52" placeholder="搜索设备 SN / 机器人编号" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <DeviceChecks devices={candidates} selected={form.boundDeviceIds} onToggle={toggle} />
      <p className="text-xs text-gray-500">已选择 {form.boundDeviceIds.length} 台设备</p>
      {hasBusinessRecords && relationChanged && (
        <label className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600">
          <input className="mt-0.5" type="checkbox" checked={form.confirmed} onChange={(event) => setForm((prev) => ({ ...prev, confirmed: event.target.checked }))} />
          我已确认变更项目或点位，并理解已有执行记录与交付结果仍会保留。
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>确认调整关联关系</Btn></div>
    </div>
  );
}

function ExecutionForm({ record, devices, onClose, onSave }) {
  const [form, setForm] = useState({
    title: record?.title || '',
    content: record?.content || '',
    deviceIds: record?.deviceIds || [],
    hasException: record?.hasException || false,
    exceptionDescription: record?.exceptionDescription || '',
  });
  const [errors, setErrors] = useState({});
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const toggle = (id) => update('deviceIds', form.deviceIds.includes(id) ? form.deviceIds.filter((item) => item !== id) : [...form.deviceIds, id]);
  const submit = () => {
    const next = {};
    if (!form.title.trim()) next.title = '请填写记录标题。';
    if (!form.content.trim()) next.content = '请填写执行内容。';
    if (form.hasException && !form.exceptionDescription.trim()) next.exceptionDescription = '存在异常时必须填写异常说明。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">记录标题 <span className="text-red-500">*</span></label>
        <Input className="w-full" value={form.title} onChange={(event) => update('title', event.target.value)} />
        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">执行内容 <span className="text-red-500">*</span></label>
        <textarea className="ui-input w-full min-h-24" value={form.content} onChange={(event) => update('content', event.target.value)} />
        {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-2">关联设备（选填）</label>
        <DeviceChecks devices={devices} selected={form.deviceIds} onToggle={toggle} />
        <p className="text-xs text-gray-400 mt-1">未选择设备时，该记录作用于当前点位。</p>
      </div>
      <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-[13px] text-gray-700">
        <input type="checkbox" checked={form.hasException} onChange={(event) => update('hasException', event.target.checked)} />
        存在异常
      </label>
      {form.hasException && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">异常说明 <span className="text-red-500">*</span></label>
          <textarea className="ui-input w-full min-h-20" value={form.exceptionDescription} onChange={(event) => update('exceptionDescription', event.target.value)} />
          {errors.exceptionDescription && <p className="text-xs text-red-600 mt-1">{errors.exceptionDescription}</p>}
        </div>
      )}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{record ? '保存执行记录' : '新增执行记录'}</Btn></div>
    </div>
  );
}

function ExecutionRecordDetail({ record, devices, onClose, onEdit, onDelete }) {
  const related = devices.filter((device) => (record.deviceIds || []).includes(device.id));
  return (
    <div className="space-y-4">
      <DescList cols={2} items={[
        ['记录标题', record.title],
        ['关联范围', related.length ? '具体设备' : '当前点位'],
        ['关联设备', related.map((item) => item.sn).join('、') || '当前点位'],
        ['包含异常信息', record.hasException ? '是' : '否'],
        ['记录人', record.recorder || '—'],
        ['记录时间', record.time || '—'],
      ]} />
      <div><p className="text-xs text-gray-500 mb-1">执行内容</p><p className="text-[13px] text-gray-700 whitespace-pre-wrap">{record.content}</p></div>
      {record.hasException && <div><p className="text-xs text-gray-500 mb-1">异常说明</p><p className="text-[13px] text-red-700 whitespace-pre-wrap">{record.exceptionDescription}</p></div>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>关闭</Btn><Btn onClick={onDelete}>删除记录</Btn><Btn variant="primary" onClick={onEdit}>编辑记录</Btn></div>
    </div>
  );
}

function DeliveryResultForm({ current, devices, onClose, onSave }) {
  const [form, setForm] = useState({
    result: current?.result || '通过',
    summary: current?.summary || '',
    affectedDeviceIds: current?.affectedDeviceIds || [],
    exceptionDescription: current?.exceptionDescription || '',
    modificationReason: '',
  });
  const [errors, setErrors] = useState({});
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const toggle = (id) => update('affectedDeviceIds', form.affectedDeviceIds.includes(id) ? form.affectedDeviceIds.filter((item) => item !== id) : [...form.affectedDeviceIds, id]);
  const submit = () => {
    const next = {};
    if (!form.summary.trim()) next.summary = '请填写结果说明。';
    if (form.result === '未通过' && !form.exceptionDescription.trim()) next.exceptionDescription = '交付结果未通过时必须填写异常说明。';
    if (current && !form.modificationReason.trim()) next.modificationReason = '修改已有交付结果时必须填写修改原因。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-600 mb-2">交付结果</label><ResultChoice value={form.result} onChange={(value) => update('result', value)} /></div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">结果说明 <span className="text-red-500">*</span></label>
        <textarea className="ui-input w-full min-h-20" value={form.summary} onChange={(event) => update('summary', event.target.value)} />
        {errors.summary && <p className="text-xs text-red-600 mt-1">{errors.summary}</p>}
      </div>
      {form.result === '未通过' && (
        <>
          <div>
            <label className="block text-xs text-gray-600 mb-2">关联设备（选填）</label>
            <DeviceChecks devices={devices} selected={form.affectedDeviceIds} onToggle={toggle} />
            <p className="text-xs text-gray-400 mt-1">未选择设备时，异常属于当前点位或本次交付执行整体。</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">异常说明 <span className="text-red-500">*</span></label>
            <textarea className="ui-input w-full min-h-20" value={form.exceptionDescription} onChange={(event) => update('exceptionDescription', event.target.value)} />
            {errors.exceptionDescription && <p className="text-xs text-red-600 mt-1">{errors.exceptionDescription}</p>}
          </div>
        </>
      )}
      {current && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">修改原因 <span className="text-red-500">*</span></label>
          <textarea className="ui-input w-full min-h-20" value={form.modificationReason} onChange={(event) => update('modificationReason', event.target.value)} />
          {errors.modificationReason && <p className="text-xs text-red-600 mt-1">{errors.modificationReason}</p>}
        </div>
      )}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{current ? '修改交付结果' : '提交交付结果'}</Btn></div>
    </div>
  );
}

export default function DeliveryPlanDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const requestedTab = searchParams.get('tab');
  const [active, setActiveState] = useState(TAB_KEYS.has(requestedTab) ? requestedTab : 'basic');
  const [modal, setModal] = useState(null);
  const plan = state.deliveryPlans.find((item) => item.id === id);
  if (!plan) return <Page><PageHeader title="交付执行不存在" actions={<Btn as="link" to="/projects?tab=delivery">返回列表</Btn>} /></Page>;

  const project = state.projects.find((item) => item.id === plan.projectId);
  const location = state.locations.find((item) => item.id === plan.locationId);
  const devices = state.devices.filter((item) => (plan.boundDeviceIds || []).includes(item.id));
  const records = plan.executionRecords || [];
  const result = plan.deliveryResult;
  const exceptions = state.deliveryExceptions.filter((item) => item.deliveryPlanId === plan.id);
  const logs = plan.operationLogs || [];
  const viewedRecord = modal?.type === 'record-view' ? records.find((item) => item.id === modal.id) : null;
  const editedRecord = modal?.type === 'record-edit' ? records.find((item) => item.id === modal.id) : null;
  const setActive = (tab) => {
    setActiveState(tab);
    setSearchParams(tab === 'basic' ? {} : { tab });
  };
  const appendLog = (action, notes, time = nowText()) => ({ id: `DLOG-${Date.now()}-${Math.random()}`, time, operator: state.currentUser, action, notes });
  const updatePlan = (payload, action, notes, time = nowText()) => {
    const projectId = payload.projectId || plan.projectId;
    dispatch({ type: 'UPDATE_DELIVERY_PLAN', payload: { id: plan.id, ...payload, updatedAt: time, operationLogs: [...logs, appendLog(action, notes, time)] } });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}-${Math.random()}`, deliveryPlanId: plan.id, projectId, operator: state.currentUser, timestamp: time, actionType: action, module: '项目中心', notes } });
    setModal(null);
  };

  const saveAssociations = (form) => {
    const time = nowText();
    const removed = (plan.boundDeviceIds || []).filter((deviceId) => !form.boundDeviceIds.includes(deviceId));
    removed.forEach((deviceId) => {
      const device = state.devices.find((item) => item.id === deviceId);
      if (!device) return;
      const remaining = (device.deliveryPlanIds || []).filter((item) => item !== plan.id);
      dispatch({ type: 'UPDATE_DEVICE', payload: { id: deviceId, deliveryPlanId: remaining[0] || null, deliveryPlanIds: remaining, updatedAt: time } });
    });
    form.boundDeviceIds.forEach((deviceId) => {
      const device = state.devices.find((item) => item.id === deviceId);
      if (!device) return;
      dispatch({ type: 'UPDATE_DEVICE', payload: {
        id: deviceId,
        projectId: form.projectId,
        locationId: form.locationId,
        deliveryPlanId: plan.id,
        deliveryPlanIds: [...new Set([...(device.deliveryPlanIds || []), plan.id])],
        updatedAt: time,
      } });
    });
    const targetProject = state.projects.find((item) => item.id === form.projectId);
    const targetLocation = state.locations.find((item) => item.id === form.locationId);
    updatePlan({
      projectId: form.projectId,
      locationId: form.locationId,
      boundDeviceIds: form.boundDeviceIds,
      records: {
        ...plan.records,
        binding: form.boundDeviceIds.map((deviceId) => ({ id: `BIND-${plan.id}-${deviceId}`, deviceId, locationId: form.locationId, operator: state.currentUser, time })),
      },
    }, '调整关联关系', `调整为 ${targetProject?.name || '项目'} / ${targetLocation?.name || '点位'}，关联 ${form.boundDeviceIds.length} 台设备`, time);
  };

  const saveExecution = (form, recordId = null) => {
    const time = nowText();
    const existing = records.find((item) => item.id === recordId);
    const record = {
      id: existing?.id || `EXEC-${Date.now()}`,
      title: form.title.trim(),
      content: form.content.trim(),
      deviceIds: form.deviceIds,
      hasException: form.hasException,
      exceptionDescription: form.hasException ? form.exceptionDescription.trim() : '',
      recorder: existing?.recorder || state.currentUser,
      time: existing?.time || time,
      createdAt: existing?.createdAt || existing?.time || time,
      updatedAt: time,
    };
    const oldException = exceptions.find((item) => item.sourceRecordId === record.id);
    if (record.hasException) {
      const payload = {
        id: oldException?.id || `DEX-${record.id}`,
        deliveryPlanId: plan.id,
        projectId: plan.projectId,
        locationId: plan.locationId,
        sourceRecordId: record.id,
        sourceTitle: record.title,
        sourceType: '执行记录',
        affectedDeviceIds: record.deviceIds,
        description: record.exceptionDescription,
        recorder: state.currentUser,
        recordTime: time,
      };
      dispatch({ type: oldException ? 'UPDATE_DELIVERY_EXCEPTION' : 'ADD_DELIVERY_EXCEPTION', payload });
    } else if (oldException) {
      dispatch({ type: 'DELETE_DELIVERY_EXCEPTION', payload: oldException.id });
    }
    const nextRecords = existing
      ? records.map((item) => item.id === existing.id ? record : item)
      : [...records, record];
    updatePlan({ executionRecords: nextRecords }, existing ? '编辑执行记录' : '新增执行记录', record.title, time);
  };

  const deleteExecution = (record) => {
    if (!window.confirm(`确认删除执行记录“${record.title}”吗？对应异常记录也会一并移除。`)) return;
    const oldException = exceptions.find((item) => item.sourceRecordId === record.id);
    if (oldException) dispatch({ type: 'DELETE_DELIVERY_EXCEPTION', payload: oldException.id });
    updatePlan({ executionRecords: records.filter((item) => item.id !== record.id) }, '删除执行记录', record.title);
  };

  const saveResult = (form) => {
    const time = nowText();
    const sourceRecordId = `RESULT-${plan.id}`;
    const oldException = exceptions.find((item) => item.sourceRecordId === sourceRecordId);
    if (form.result === '未通过') {
      const payload = {
        id: oldException?.id || `DEX-${sourceRecordId}`,
        deliveryPlanId: plan.id,
        projectId: plan.projectId,
        locationId: plan.locationId,
        sourceRecordId,
        sourceTitle: '交付结果',
        sourceType: '交付结果',
        affectedDeviceIds: form.affectedDeviceIds,
        description: form.exceptionDescription.trim(),
        recorder: state.currentUser,
        recordTime: time,
      };
      dispatch({ type: oldException ? 'UPDATE_DELIVERY_EXCEPTION' : 'ADD_DELIVERY_EXCEPTION', payload });
    } else if (oldException) {
      dispatch({ type: 'DELETE_DELIVERY_EXCEPTION', payload: oldException.id });
    }
    const history = result ? [...(result.history || []), { ...result, revisedAt: time, modificationReason: form.modificationReason }] : [];
    updatePlan({
      deliveryResult: {
        id: sourceRecordId,
        result: form.result,
        summary: form.summary.trim(),
        affectedDeviceIds: form.result === '未通过' ? form.affectedDeviceIds : [],
        exceptionDescription: form.result === '未通过' ? form.exceptionDescription.trim() : '',
        recorder: state.currentUser,
        time,
        history,
      },
    }, result ? '修改交付结果' : '提交交付结果', result ? form.modificationReason : `${form.result}：${form.summary}`, time);
  };

  const openExceptionSource = (item) => {
    if (item.sourceType === '交付结果') {
      setActive('result');
      return;
    }
    setActive('execution');
    if (records.some((record) => record.id === item.sourceRecordId)) setModal({ type: 'record-view', id: item.sourceRecordId });
  };

  return (
    <Page>
      <PageHeader
        title={plan.title || plan.name}
        description={`${plan.id} · ${project?.name || '—'} / ${location?.name || '—'}`}
        breadcrumb={<Link to="/projects?tab=delivery" className="ui-link text-[13px]">‹ 返回交付执行列表</Link>}
        actions={<Btn onClick={() => setModal({ type: 'basic' })}>编辑基础信息</Btn>}
      />
      <p className="text-xs text-gray-400">当前暂未定义统一交付状态，页面仅展示交付执行信息、交付结果和异常记录。</p>
      <TabBar active={active} onChange={setActive} />

      {active === 'basic' && (
        <>
          <Section title="交付基础信息">
            <DescList cols={3} items={[
              ['交付执行编号', <span className="font-mono">{plan.id}</span>],
              ['交付执行名称', plan.title || plan.name],
              ['项目', project ? <Link className="ui-link" to={`/projects/${project.id}`}>{project.name}</Link> : '—'],
              ['点位', location?.name || '—'],
              ['负责人', plan.owner || '—'],
              ['创建人', plan.createdBy || '—'],
              ['创建时间', plan.createdAt || '—'],
              ['最近更新时间', plan.updatedAt || '—'],
              ['交付需求说明', plan.demandDescription || '—'],
              ['备注', plan.notes || '—'],
            ]} />
          </Section>
          <Section title="可选来源引用">
            <DescList cols={2} items={[
              ['相关飞书需求链接', plan.feishuDemandUrl ? <a className="ui-link" href={plan.feishuDemandUrl} target="_blank" rel="noreferrer">打开飞书需求链接</a> : '—'],
              ['ERP 来源', plan.erpReferenceNo ? `${plan.erpReferenceType} · ${plan.erpReferenceNo}` : '暂未关联 ERP 来源单据'],
            ]} />
          </Section>
        </>
      )}

      {active === 'devices' && (
        <Section title="关联设备" right={<Btn size="sm" onClick={() => setModal({ type: 'association' })}>调整关联关系</Btn>} bodyClassName="p-0">
          <Table head={['设备 SN', '机器人编号', '设备型号', '所属点位', '操作']} empty="暂无交付设备">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs">{device.sn}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{device.robotNo}</td>
                <td className="px-3 py-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{location?.name || '—'}</td>
                <td className="px-3 py-2"><Link className="ui-link text-[13px]" to={`/devices/${device.id}`}>查看设备详情</Link></td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {active === 'execution' && (
        <Section title="执行记录" right={<Btn size="sm" variant="primary" onClick={() => setModal({ type: 'record-create' })}>新增执行记录</Btn>} bodyClassName="p-0">
          <Table head={['记录标题', '关联范围', '关联设备', '异常信息', '记录人', '记录时间', '操作']} empty="暂无执行记录">
            {records.map((record) => {
              const related = devices.filter((device) => (record.deviceIds || []).includes(device.id));
              return (
                <tr key={record.id} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 font-medium text-gray-800">{record.title}</td>
                  <td className="px-3 py-2 text-gray-600">{related.length ? '具体设备' : '当前点位'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{related.map((item) => item.sn).join('、') || '当前点位'}</td>
                  <td className={`px-3 py-2 text-[13px] ${record.hasException ? 'text-red-600' : 'text-gray-400'}`}>{record.hasException ? '含异常信息' : '暂无'}</td>
                  <td className="px-3 py-2 text-gray-600">{record.recorder || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{record.time || '—'}</td>
                  <td className="px-3 py-2"><button className="ui-link text-[13px]" onClick={() => setModal({ type: 'record-view', id: record.id })}>查看详情</button></td>
                </tr>
              );
            })}
          </Table>
        </Section>
      )}

      {active === 'result' && (
        <Section title="交付结果" right={<Btn size="sm" variant="primary" onClick={() => setModal({ type: 'result' })}>{result ? '修改交付结果' : '提交交付结果'}</Btn>}>
          {result ? <DescList cols={3} items={[
            ['交付结果', <StatusBadge status={result.result} />],
            ['结果说明', result.summary],
            ['记录人', result.recorder],
            ['记录时间', result.time],
            result.result === '未通过' && ['异常说明', result.exceptionDescription],
            result.result === '未通过' && ['关联设备', (result.affectedDeviceIds || []).map((deviceId) => state.devices.find((item) => item.id === deviceId)?.sn).filter(Boolean).join('、') || '当前点位'],
          ]} /> : <EmptyState className="py-8">暂无交付结果</EmptyState>}
        </Section>
      )}

      {active === 'exceptions' && (
        <Section title="交付异常" bodyClassName="p-0">
          <Table head={['来源记录标题', '来源类型', '关联设备', '异常说明', '记录人', '记录时间', '操作']} empty="暂无交付异常">
            {exceptions.map((item) => (
              <tr key={item.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-medium text-gray-700">{item.sourceTitle || '交付记录'}</td>
                <td className="px-3 py-2 text-gray-600">{item.sourceType || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{(item.affectedDeviceIds || []).map((deviceId) => state.devices.find((device) => device.id === deviceId)?.sn).filter(Boolean).join('、') || '当前点位'}</td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-sm">{item.description}</td>
                <td className="px-3 py-2 text-gray-600">{item.recorder || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.recordTime || '—'}</td>
                <td className="px-3 py-2"><button className="ui-link text-[13px]" onClick={() => openExceptionSource(item)}>查看来源记录</button></td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {active === 'logs' && (
        <Section title="操作日志" bodyClassName="p-0">
          <Table head={['操作时间', '操作人', '操作动作', '操作摘要']} empty="暂无操作日志">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 text-xs text-gray-500">{log.time}</td>
                <td className="px-3 py-2 text-gray-600">{log.operator}</td>
                <td className="px-3 py-2 text-gray-700">{log.action}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{log.notes || '—'}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Modal size="lg" isOpen={modal?.type === 'basic'} onClose={() => setModal(null)} title="编辑交付基础信息">
        <BasicForm plan={plan} state={state} onClose={() => setModal(null)} onSave={(form) => updatePlan({ ...form, name: form.title }, '编辑基础信息', '更新交付执行基础信息')} />
      </Modal>
      <Modal size="xl" isOpen={modal?.type === 'association'} onClose={() => setModal(null)} title="调整关联关系">
        <AssociationForm plan={plan} state={state} onClose={() => setModal(null)} onSave={saveAssociations} />
      </Modal>
      <Modal size="lg" isOpen={modal?.type === 'record-create'} onClose={() => setModal(null)} title="新增执行记录">
        <ExecutionForm devices={devices} onClose={() => setModal(null)} onSave={saveExecution} />
      </Modal>
      <Modal size="lg" isOpen={modal?.type === 'record-edit'} onClose={() => setModal(null)} title="编辑执行记录">
        {editedRecord && <ExecutionForm record={editedRecord} devices={devices} onClose={() => setModal(null)} onSave={(form) => saveExecution(form, editedRecord.id)} />}
      </Modal>
      <Modal size="lg" isOpen={modal?.type === 'record-view'} onClose={() => setModal(null)} title="执行记录详情">
        {viewedRecord && <ExecutionRecordDetail
          record={viewedRecord}
          devices={devices}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ type: 'record-edit', id: viewedRecord.id })}
          onDelete={() => deleteExecution(viewedRecord)}
        />}
      </Modal>
      <Modal size="lg" isOpen={modal?.type === 'result'} onClose={() => setModal(null)} title={result ? '修改交付结果' : '提交交付结果'}>
        <DeliveryResultForm current={result} devices={devices} onClose={() => setModal(null)} onSave={saveResult} />
      </Modal>
    </Page>
  );
}
