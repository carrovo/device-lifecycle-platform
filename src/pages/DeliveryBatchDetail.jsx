import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { deliveryErpReferences, erpReferenceUrl } from '../data/erpPrototype';
import { batchDisplayName, batchMetrics } from '../data/deliveryV2';
import { productionProgressLabel } from '../data/prdV12';
import {
  Page, PageHeader, Section, DescList, Table, Btn, Input, Select, LinkAction, EmptyState,
} from '../components/ui';

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

function ResultChoice({ value, onChange }) {
  return <div className="grid grid-cols-2 gap-2">{['通过', '未通过'].map((item) => <button type="button" key={item} onClick={() => onChange(item)} className={`h-10 rounded-md border text-[13px] font-medium ${value === item ? item === '通过' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{item}</button>)}</div>;
}

function BatchEditForm({ batch, locations, users, onClose, onSave }) {
  const [form, setForm] = useState({
    supplement: batch.supplement || '',
    locationId: batch.locationId || '',
    plannedDate: batch.plannedDate || '',
    owner: batch.owner || '',
    notes: batch.notes || '',
  });
  const [error, setError] = useState('');
  const submit = () => {
    if (form.supplement.trim().length > 30) return setError('批次补充说明不能超过 30 个字符。');
    if (!form.owner) return setError('请选择批次负责人。');
    onSave(form);
  };
  return <div className="space-y-4">
    <div><label className="block text-xs text-gray-600 mb-1">系统批次基础名称</label><Input className="w-full bg-gray-50" value={batch.baseName} disabled /></div>
    <div><label className="block text-xs text-gray-600 mb-1">批次补充说明</label><Input className="w-full" maxLength={30} value={form.supplement} onChange={(event) => setForm((prev) => ({ ...prev, supplement: event.target.value }))} /></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className="block text-xs text-gray-600 mb-1">目标点位</label><Select className="w-full" value={form.locationId} disabled={batch.deviceRelations.length > 0} onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">暂未关联点位</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{batch.deviceRelations.length > 0 && <p className="text-xs text-gray-400 mt-1">批次已有设备，目标点位不可静默更换。</p>}</div>
      <div><label className="block text-xs text-gray-600 mb-1">计划交付日期</label><Input className="w-full" type="date" value={form.plannedDate} onChange={(event) => setForm((prev) => ({ ...prev, plannedDate: event.target.value }))} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">批次负责人</label><Select className="w-full" value={form.owner} onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))}>{users.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</Select></div>
    </div>
    <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
    {error && <p className="text-xs text-red-600">{error}</p>}
    <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>保存批次信息</Btn></div>
  </div>;
}

function FeishuForm({ current, onClose, onSave }) {
  const [form, setForm] = useState({ name: current?.name || '', url: current?.url || '', note: current?.note || '' });
  const [error, setError] = useState('');
  const submit = () => {
    if (!form.name.trim() || !form.url.trim()) return setError('请填写名称和飞书链接。');
    if (!/^https?:\/\/\S+$/i.test(form.url)) return setError('请输入有效的 http 或 https 链接。');
    onSave(form);
  };
  return <div className="space-y-4">
    <div><label className="block text-xs text-gray-600 mb-1">表格或记录名称 <span className="text-red-500">*</span></label><Input className="w-full" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
    <div><label className="block text-xs text-gray-600 mb-1">飞书链接 <span className="text-red-500">*</span></label><Input className="w-full" placeholder="https://" value={form.url} onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))} /></div>
    <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} /></div>
    {error && <p className="text-xs text-red-600">{error}</p>}
    <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{current ? '保存链接' : '添加链接'}</Btn></div>
  </div>;
}

function ErpReferenceForm({ current, onClose, onSave }) {
  const references = deliveryErpReferences();
  const [selected, setSelected] = useState(current.map((item) => `${item.type}::${item.no}`));
  const toggle = (key) => setSelected((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  return <div className="space-y-4">
    <p className="text-xs text-gray-500">仅可引用当前原型中的销售发货单和调拨订单；关联关系保存在平台侧。</p>
    <div className="max-h-72 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
      {references.map((item) => {
        const key = `${item.type}::${item.no}`;
        return <label key={key} className="flex items-start gap-3 px-3 py-2 text-xs"><input className="mt-0.5" type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} /><span className="min-w-20 text-gray-700">{item.type}</span><span className="font-mono">{item.no}</span><span className="text-gray-400">{item.date} {item.summary}</span></label>;
      })}
      {!references.length && <EmptyState className="py-6">当前暂无可引用的 ERP 来源单据</EmptyState>}
    </div>
    <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={() => onSave(selected, references)}>保存 ERP 来源关联</Btn></div>
  </div>;
}

function SiteRecordForm({ devices, onClose, onSave }) {
  const [form, setForm] = useState({ content: '', deviceIds: [], hasException: false, exceptionDescription: '', documentUrl: '' });
  const [errors, setErrors] = useState({});
  const toggle = (id) => setForm((prev) => ({ ...prev, deviceIds: prev.deviceIds.includes(id) ? prev.deviceIds.filter((item) => item !== id) : [...prev.deviceIds, id] }));
  const submit = () => {
    const next = {};
    if (!form.content.trim()) next.content = '请填写现场记录内容。';
    if (form.hasException && !form.exceptionDescription.trim()) next.exceptionDescription = '存在异常时必须填写异常说明。';
    if (form.documentUrl && !/^https?:\/\/\S+$/i.test(form.documentUrl)) next.documentUrl = '请输入有效链接。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return <div className="space-y-4">
    <div><label className="block text-xs text-gray-600 mb-1">记录内容 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-24" value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} />{errors.content && <p className="text-xs text-red-600 mt-1">{errors.content}</p>}</div>
    <div><label className="block text-xs text-gray-600 mb-2">关联设备（选填）</label><div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">{devices.map((device) => <label key={device.id} className="flex items-center gap-3 px-3 py-2 text-xs"><input type="checkbox" checked={form.deviceIds.includes(device.id)} onChange={() => toggle(device.id)} /><span className="font-mono">{device.sn}</span><span className="text-gray-400">{device.robotNo}</span></label>)}</div><p className="text-xs text-gray-400 mt-1">未选择设备时，该记录属于整个批次。</p></div>
    <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-[13px]"><input type="checkbox" checked={form.hasException} onChange={(event) => setForm((prev) => ({ ...prev, hasException: event.target.checked }))} />存在异常</label>
    {form.hasException && <div><label className="block text-xs text-gray-600 mb-1">异常说明 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={form.exceptionDescription} onChange={(event) => setForm((prev) => ({ ...prev, exceptionDescription: event.target.value }))} />{errors.exceptionDescription && <p className="text-xs text-red-600 mt-1">{errors.exceptionDescription}</p>}</div>}
    <div><label className="block text-xs text-gray-600 mb-1">相关资料链接</label><Input className="w-full" value={form.documentUrl} onChange={(event) => setForm((prev) => ({ ...prev, documentUrl: event.target.value }))} />{errors.documentUrl && <p className="text-xs text-red-600 mt-1">{errors.documentUrl}</p>}</div>
    <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>添加现场记录</Btn></div>
  </div>;
}

function DeviceResultForm({ batch, relations, devices, locations, onClose, onSave }) {
  const existing = relations.filter((item) => item.result !== '未确认');
  const inheritedLocations = [...new Set(relations.map((item) => item.actualLocationId || item.targetLocationId).filter(Boolean))];
  const single = relations.length === 1 ? relations[0] : null;
  const [form, setForm] = useState({
    result: single?.result && single.result !== '未确认' ? single.result : '通过',
    actualDate: single?.actualDate || new Date().toISOString().slice(0, 10),
    actualLocationId: inheritedLocations.length === 1 ? inheritedLocations[0] : '',
    resultSummary: single?.resultSummary || '',
    exceptionDescription: single?.exceptionDescription || '',
    documentUrl: single?.documentUrl || '',
    modificationReason: '',
    confirmed: false,
  });
  const [errors, setErrors] = useState({});
  const submit = () => {
    const next = {};
    if (form.result === '未通过' && !form.exceptionDescription.trim()) next.exceptionDescription = '结果未通过时必须填写异常说明。';
    if (form.documentUrl && !/^https?:\/\/\S+$/i.test(form.documentUrl)) next.documentUrl = '请输入有效链接。';
    if (existing.length && !form.modificationReason.trim()) next.modificationReason = '修改已有结果必须填写修改原因。';
    if (relations.length > 1 && !form.confirmed) next.confirmed = '请确认本次批量录入。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return <div className="space-y-4">
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"><span className="text-gray-500">所属批次</span><span className="font-medium text-gray-800">{batchDisplayName(batch)}</span><span className="text-gray-500">本次设备</span><span className="font-medium text-gray-800">{relations.length} 台</span></div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">{devices.map((item) => <span key={item.id} className="text-xs"><span className="font-mono text-gray-800">{item.sn}</span><span className="font-mono text-gray-400 ml-1.5">{item.robotNo}</span></span>)}</div>
    </div>
    <div><label className="block text-xs text-gray-600 mb-2">设备交付结果</label><ResultChoice value={form.result} onChange={(value) => setForm((prev) => ({ ...prev, result: value }))} /></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className="block text-xs text-gray-600 mb-1">实际交付日期</label><Input className="w-full" type="date" value={form.actualDate} onChange={(event) => setForm((prev) => ({ ...prev, actualDate: event.target.value }))} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">实际交付点位</label><Select className="w-full" value={form.actualLocationId} onChange={(event) => setForm((prev) => ({ ...prev, actualLocationId: event.target.value }))}><option value="">暂不填写</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
    </div>
    <div><label className="block text-xs text-gray-600 mb-1">结果说明</label><textarea className="ui-input w-full min-h-16" value={form.resultSummary} onChange={(event) => setForm((prev) => ({ ...prev, resultSummary: event.target.value }))} /></div>
    {form.result === '未通过' && <div><label className="block text-xs text-gray-600 mb-1">异常说明 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={form.exceptionDescription} onChange={(event) => setForm((prev) => ({ ...prev, exceptionDescription: event.target.value }))} />{errors.exceptionDescription && <p className="text-xs text-red-600 mt-1">{errors.exceptionDescription}</p>}</div>}
    <div><label className="block text-xs text-gray-600 mb-1">验收或现场资料链接</label><Input className="w-full" value={form.documentUrl} onChange={(event) => setForm((prev) => ({ ...prev, documentUrl: event.target.value }))} />{errors.documentUrl && <p className="text-xs text-red-600 mt-1">{errors.documentUrl}</p>}</div>
    {existing.length > 0 && <div><label className="block text-xs text-gray-600 mb-1">修改原因 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-16" value={form.modificationReason} onChange={(event) => setForm((prev) => ({ ...prev, modificationReason: event.target.value }))} />{errors.modificationReason && <p className="text-xs text-red-600 mt-1">{errors.modificationReason}</p>}</div>}
    {relations.length > 1 && <label className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600"><input className="mt-0.5" type="checkbox" checked={form.confirmed} onChange={(event) => setForm((prev) => ({ ...prev, confirmed: event.target.checked }))} />确认将本次结果应用到所选 {relations.length} 台设备；已有结果不会在未填写修改原因时被覆盖。</label>}
    {errors.confirmed && <p className="text-xs text-red-600">{errors.confirmed}</p>}
    <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{existing.length ? '保存结果修改' : '提交设备交付结果'}</Btn></div>
  </div>;
}

export default function DeliveryBatchDetail() {
  const { planId, batchId } = useParams();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState([]);
  const plan = state.deliveryPlans.find((item) => item.id === planId);
  const batch = plan?.batches?.find((item) => item.id === batchId);
  if (!plan || !batch) return <Page><PageHeader title="交付批次不存在" actions={<Btn as="link" to={`/delivery-plans/${planId || ''}`}>返回交付执行</Btn>} /></Page>;
  const project = state.projects.find((item) => item.id === plan.projectId);
  const returnTo = searchParams.get('returnTo') || `/delivery-plans/${plan.id}?tab=batches`;
  const currentBatchUrl = `/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const locations = state.locations.filter((item) => item.projectId === plan.projectId);
  const targetLocation = locations.find((item) => item.id === batch.locationId);
  const relations = batch.deviceRelations || [];
  const devices = relations.map((relation) => state.devices.find((item) => item.id === relation.deviceId)).filter(Boolean);
  const metrics = batchMetrics(batch);
  const exceptions = state.deliveryExceptions.filter((item) => item.deliveryPlanId === plan.id && item.batchId === batch.id);
  const revisionRows = relations.flatMap((relation) => (relation.resultHistory || []).map((history, index) => ({ relation, history, index })));
  const users = state.users.filter((item) => item.status !== '停用');
  const editingLink = modal?.type === 'feishu-edit' ? batch.feishuLinks.find((item) => item.id === modal.id) : null;
  const selectedRelations = relations.filter((item) => selected.includes(item.deviceId));
  const modalRelations = modal?.type === 'result-single' ? relations.filter((item) => item.deviceId === modal.deviceId) : selectedRelations;
  const modalDevices = modalRelations.map((relation) => state.devices.find((item) => item.id === relation.deviceId)).filter(Boolean);

  const updateBatch = (nextBatch, action, notes) => {
    const time = nowText();
    const updated = {
      ...nextBatch,
      updatedAt: time,
      operationLogs: [...(batch.operationLogs || []), { id: `BLOG-${Date.now()}-${Math.random()}`, time, operator: state.currentUser, action, notes }],
    };
    dispatch({ type: 'UPDATE_DELIVERY_PLAN', payload: {
      id: plan.id,
      batches: plan.batches.map((item) => item.id === batch.id ? updated : item),
      updatedAt: time,
      operationLogs: [...(plan.operationLogs || []), { id: `DLOG-${Date.now()}-${Math.random()}`, time, operator: state.currentUser, action, notes: `${batchDisplayName(batch)}：${notes}` }],
    } });
    dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}-${Math.random()}`, deliveryPlanId: plan.id, projectId: plan.projectId, operator: state.currentUser, timestamp: time, actionType: action, module: '项目中心', notes: `${batchDisplayName(batch)}：${notes}` } });
    setModal(null);
  };

  const saveBatch = (form) => updateBatch({ ...batch, ...form, supplement: form.supplement.trim() }, '编辑交付批次', '更新批次基础信息');
  const saveLink = (form) => {
    const item = { id: editingLink?.id || `BFS-${Date.now()}`, name: form.name.trim(), url: form.url.trim(), note: form.note.trim() };
    const links = editingLink ? batch.feishuLinks.map((link) => link.id === editingLink.id ? item : link) : [...batch.feishuLinks, item];
    updateBatch({ ...batch, feishuLinks: links }, editingLink ? '编辑批次飞书链接' : '添加批次飞书链接', item.name);
  };
  const deleteLink = (link) => {
    if (!window.confirm(`确认删除“${link.name}”吗？`)) return;
    updateBatch({ ...batch, feishuLinks: batch.feishuLinks.filter((item) => item.id !== link.id) }, '删除批次飞书链接', link.name);
  };
  const unlinkErp = (reference) => {
    if (!window.confirm(`确认解除 ${reference.type} ${reference.no} 的平台侧关联吗？`)) return;
    updateBatch({ ...batch, erpReferences: batch.erpReferences.filter((item) => !(item.type === reference.type && item.no === reference.no)) }, '解除 ERP 来源关联', `${reference.type} ${reference.no}`);
  };
  const saveErpReferences = (selectedKeys, sources) => {
    const references = selectedKeys.map((key) => {
      const [type, no] = key.split('::');
      const source = sources.find((item) => item.type === type && item.no === no);
      return { type, no, date: source?.date || '', summary: source?.summary || '' };
    });
    updateBatch({ ...batch, erpReferences: references }, '调整 ERP 来源关联', `关联 ${references.length} 张销售发货或调拨单据`);
  };
  const saveSiteRecord = (form) => {
    const time = nowText();
    const record = { id: `SITE-${Date.now()}`, content: form.content.trim(), deviceIds: form.deviceIds, hasException: form.hasException, exceptionDescription: form.hasException ? form.exceptionDescription.trim() : '', documentUrl: form.documentUrl.trim(), recorder: state.currentUser, time };
    if (record.hasException) dispatch({ type: 'ADD_DELIVERY_EXCEPTION', payload: { id: `DEX-${record.id}`, deliveryPlanId: plan.id, batchId: batch.id, projectId: plan.projectId, sourceRecordId: record.id, sourceTitle: record.content.slice(0, 30), sourceType: '现场记录', affectedDeviceIds: record.deviceIds, description: record.exceptionDescription, recorder: state.currentUser, recordTime: time } });
    updateBatch({ ...batch, siteRecords: [...batch.siteRecords, record] }, '添加现场记录', record.content.slice(0, 40));
  };
  const saveResults = (form) => {
    const time = nowText();
    const selectedIds = new Set(modalRelations.map((item) => item.deviceId));
    const nextRelations = relations.map((relation) => {
      if (!selectedIds.has(relation.deviceId)) return relation;
      const hadResult = relation.result !== '未确认';
      const history = hadResult ? [...(relation.resultHistory || []), {
        result: relation.result,
        actualDate: relation.actualDate,
        actualLocationId: relation.actualLocationId,
        resultSummary: relation.resultSummary,
        exceptionDescription: relation.exceptionDescription,
        documentUrl: relation.documentUrl,
        recorder: relation.recorder,
        recordTime: relation.recordTime,
        modificationReason: form.modificationReason.trim(),
        revisedAt: time,
      }] : relation.resultHistory || [];
      return { ...relation, result: form.result, actualDate: form.actualDate, actualLocationId: form.actualLocationId || relation.targetLocationId || null, resultSummary: form.resultSummary.trim(), exceptionDescription: form.result === '未通过' ? form.exceptionDescription.trim() : '', documentUrl: form.documentUrl.trim(), recorder: state.currentUser, recordTime: time, resultHistory: history };
    });
    modalRelations.forEach((relation) => {
      if (form.result !== '未通过') return;
      const sourceRecordId = `RESULT-${batch.id}-${relation.deviceId}`;
      const old = state.deliveryExceptions.find((item) => item.sourceRecordId === sourceRecordId);
      const payload = { id: old?.id || `DEX-${sourceRecordId}`, deliveryPlanId: plan.id, batchId: batch.id, projectId: plan.projectId, sourceRecordId, sourceTitle: '设备交付结果', sourceType: '设备结果', affectedDeviceIds: [relation.deviceId], description: form.exceptionDescription.trim(), recorder: state.currentUser, recordTime: time };
      dispatch({ type: old ? 'UPDATE_DELIVERY_EXCEPTION' : 'ADD_DELIVERY_EXCEPTION', payload });
    });
    updateBatch({ ...batch, deviceRelations: nextRelations }, modalRelations.some((item) => item.result !== '未确认') ? '修订设备交付结果' : '录入设备交付结果', `${modalRelations.length} 台设备：${form.result}`);
    setSelected([]);
  };
  const toggleSelected = (deviceId) => setSelected((prev) => prev.includes(deviceId) ? prev.filter((item) => item !== deviceId) : [...prev, deviceId]);

  return <Page>
    <PageHeader
      breadcrumb={<div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 mb-1"><Link className="ui-link" to={`/projects/${project?.id}?tab=delivery`}>项目详情</Link><span>/</span><Link className="ui-link" to={returnTo}>交付执行</Link><span>/</span><span>{batchDisplayName(batch)}</span></div>}
      title={batchDisplayName(batch)}
      description={`${plan.id} · ${project?.name || '—'} · ${metrics.summary}`}
      actions={<Btn onClick={() => setModal({ type: 'edit' })}>编辑批次信息</Btn>}
    />

    <Section title="批次概览">
      <DescList cols={4} items={[
        ['批次展示名称', batchDisplayName(batch)], ['系统内部批次编号', <span className="font-mono">{batch.id}</span>],
        ['所属交付执行', <Link className="ui-link font-mono" to={returnTo}>{plan.id}</Link>], ['项目', project ? <Link className="ui-link" to={`/projects/${project.id}?tab=delivery`}>{project.name}</Link> : '—'],
        ['目标点位', targetLocation?.name || '暂未关联点位'], ['设备数量', `${metrics.total} 台`], ['计划交付日期', batch.plannedDate || '—'], ['批次负责人', batch.owner || '—'],
        ['设备结果汇总', metrics.summary], ['通过 / 未通过 / 未确认', `${metrics.passed} / ${metrics.failed} / ${metrics.unconfirmed}`], ['最近更新时间', batch.updatedAt || '—'], ['备注', batch.notes || '—'],
      ]} />
    </Section>

    <Section title="关联记录">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2"><h3 className="text-xs font-medium text-gray-500">ERP 来源单据</h3><Btn size="sm" onClick={() => setModal({ type: 'erp' })}>调整 ERP 来源</Btn></div>
          {batch.erpReferences.length ? <div className="divide-y divide-gray-100">{batch.erpReferences.map((item) => <div key={`${item.type}-${item.no}`} className="flex items-center justify-between gap-3 py-2"><div><span className="text-[13px] text-gray-700">{item.type}</span><Link className="ui-link font-mono text-xs ml-2" to={erpReferenceUrl(item, currentBatchUrl)}>{item.no}</Link>{item.summary && <p className="text-xs text-gray-400 mt-0.5">{item.summary}</p>}</div><div className="flex gap-3"><Link className="ui-link text-[13px]" to={erpReferenceUrl(item, currentBatchUrl)}>查看单据</Link><button className="ui-link text-[13px]" onClick={() => unlinkErp(item)}>解除关联</button></div></div>)}</div> : <p className="text-xs text-gray-400 py-2">暂未关联 ERP 来源单据。</p>}
          <p className="text-xs text-gray-400 mt-2">关联由平台侧维护，ERP 单据保持只读。</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 mb-2"><h3 className="text-xs font-medium text-gray-500">相关飞书表格</h3><Btn size="sm" onClick={() => setModal({ type: 'feishu' })}>添加批次补充链接</Btn></div>
          <p className="text-xs text-gray-400 py-2">当前未配置交付常用飞书表格。</p>
          {batch.feishuLinks.length ? <div className="divide-y divide-gray-100">{batch.feishuLinks.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-2"><div><span className="text-[13px] text-gray-700">{item.name}</span>{item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}</div><div className="flex gap-3"><a className="ui-link text-[13px]" href={item.url} target="_blank" rel="noreferrer">打开表格</a><button className="ui-link text-[13px]" onClick={() => setModal({ type: 'feishu-edit', id: item.id })}>编辑</button><button className="ui-link text-[13px]" onClick={() => deleteLink(item)}>删除</button></div></div>)}</div> : <p className="text-xs text-gray-400 py-2">暂无当前批次补充链接。</p>}
        </div>
      </div>
    </Section>

    <Section id="batch-devices" title="本批次设备" right={<Btn size="sm" variant="primary" disabled={!selected.length} onClick={() => setModal({ type: 'result-batch' })}>批量录入结果（{selected.length}）</Btn>} bodyClassName="p-0">
      <Table head={['选择', '设备 SN', '机器人编号', '型号', '生产进度', 'ERP 产品入库', '目标点位', '实际交付点位', '当前交付结果', '历史异常', '最近结果时间', '操作']} empty="本批次暂无设备">
        {relations.map((relation) => {
          const device = state.devices.find((item) => item.id === relation.deviceId);
          const exceptionCount = exceptions.filter((item) => (item.affectedDeviceIds || []).includes(relation.deviceId)).length;
          return <tr key={relation.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2"><input type="checkbox" checked={selected.includes(relation.deviceId)} onChange={() => toggleSelected(relation.deviceId)} /></td>
            <td className="px-3 py-2"><Link className="ui-link font-mono text-xs" to={`/devices/${device?.id}?tab=project&returnTo=${encodeURIComponent(currentBatchUrl)}`}>{device?.sn || '—'}</Link></td><td className="px-3 py-2 font-mono text-xs">{device?.robotNo || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device?.deviceTypeId)?.name || '—'}</td><td className="px-3 py-2"><StatusBadge status={productionProgressLabel(device)} /></td>
            <td className="px-3 py-2">{device?.erpInboundNo ? '已关联' : '未关联'}</td><td className="px-3 py-2">{targetLocation?.name || '—'}</td>
            <td className="px-3 py-2">{locations.find((item) => item.id === relation.actualLocationId)?.name || '—'}</td><td className="px-3 py-2"><StatusBadge status={relation.result} /></td>
            <td className="px-3 py-2">{exceptionCount ? `${exceptionCount} 条` : <span className="text-gray-400">暂无</span>}</td><td className="px-3 py-2 text-xs text-gray-500">{relation.recordTime || '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap min-w-32"><div className="flex gap-3"><LinkAction to={`/devices/${device?.id}?tab=project&returnTo=${encodeURIComponent(currentBatchUrl)}`}>查看详情</LinkAction><LinkAction onClick={() => setModal({ type: 'result-single', deviceId: relation.deviceId })}>{relation.result === '未确认' ? '录入结果' : '修改结果'}</LinkAction></div></td>
          </tr>;
        })}
      </Table>
    </Section>

    {revisionRows.length > 0 && <Section title="设备结果修订记录" bodyClassName="p-0">
      <Table head={['设备 SN', '原结果', '当前结果', '原结果说明', '修改原因', '原记录人 / 时间', '修订时间']} empty="暂无结果修订">
        {revisionRows.map(({ relation, history, index }) => {
          const device = state.devices.find((item) => item.id === relation.deviceId);
          return <tr key={`${relation.id}-${index}`} className="hover:bg-[#fafafa]"><td className="px-3 py-2 font-mono text-xs">{device?.sn || '—'}</td><td className="px-3 py-2"><StatusBadge status={history.result} /></td><td className="px-3 py-2"><StatusBadge status={relation.result} /></td><td className="px-3 py-2 text-xs text-gray-600">{history.resultSummary || history.exceptionDescription || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{history.modificationReason || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{history.recorder || '—'} / {history.recordTime || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{history.revisedAt || '—'}</td></tr>;
        })}
      </Table>
    </Section>}

    <Section id="site-records" title="现场交付与结果" right={<Btn size="sm" variant="primary" onClick={() => setModal({ type: 'site' })}>添加现场记录</Btn>} bodyClassName="p-0">
      <Table head={['记录内容', '关联范围', '关联设备', '异常信息', '资料', '记录人', '记录时间']} empty="暂无现场记录">
        {batch.siteRecords.map((record) => <tr key={record.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-gray-700">{record.content}</td><td className="px-3 py-2 text-gray-600">{record.deviceIds.length ? '具体设备' : '整个批次'}</td><td className="px-3 py-2 font-mono text-xs">{record.deviceIds.map((id) => state.devices.find((item) => item.id === id)?.sn).filter(Boolean).join('、') || '—'}</td><td className="px-3 py-2 text-xs">{record.hasException ? <span className="text-red-600">{record.exceptionDescription}</span> : <span className="text-gray-400">暂无</span>}</td><td className="px-3 py-2">{record.documentUrl ? <a className="ui-link" href={record.documentUrl} target="_blank" rel="noreferrer">打开资料</a> : '—'}</td><td className="px-3 py-2">{record.recorder}</td><td className="px-3 py-2 text-xs text-gray-500">{record.time}</td></tr>)}
      </Table>
    </Section>

    <Section id="exceptions" title={`批次异常（${exceptions.length}）`} bodyClassName="p-0">
      <Table head={['来源记录', '来源类型', '关联设备', '异常说明', '记录人', '记录时间', '操作']} empty="暂无批次异常">
        {exceptions.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 font-medium text-gray-700">{item.sourceTitle}</td><td className="px-3 py-2">{item.sourceType}</td><td className="px-3 py-2 font-mono text-xs">{(item.affectedDeviceIds || []).length ? (item.affectedDeviceIds || []).map((id) => {
          const device = state.devices.find((candidate) => candidate.id === id);
          return device ? <Link key={device.id} className="ui-link mr-2" to={`/devices/${device.id}?tab=project&returnTo=${encodeURIComponent(`${currentBatchUrl}#exceptions`)}`}>{device.sn}</Link> : null;
        }) : '批次级'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.description}</td><td className="px-3 py-2">{item.recorder}</td><td className="px-3 py-2 text-xs text-gray-500">{item.recordTime}</td><td className="px-3 py-2"><a className="ui-link text-[13px]" href={item.sourceType === '设备结果' ? '#batch-devices' : '#site-records'}>查看详情</a></td></tr>)}
      </Table>
    </Section>

    <Section title="操作日志" bodyClassName="p-0">
      <Table head={['操作时间', '操作人', '操作动作', '操作摘要']} empty="暂无批次操作日志">
        {[...(batch.operationLogs || [])].sort((a, b) => (b.time || '').localeCompare(a.time || '')).map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-xs text-gray-500">{item.time}</td><td className="px-3 py-2">{item.operator}</td><td className="px-3 py-2">{item.action}</td><td className="px-3 py-2 text-xs text-gray-500">{item.notes || '—'}</td></tr>)}
      </Table>
    </Section>

    <Modal size="lg" isOpen={modal?.type === 'edit'} onClose={() => setModal(null)} title="编辑交付批次"><BatchEditForm batch={batch} locations={locations} users={users} onClose={() => setModal(null)} onSave={saveBatch} /></Modal>
    <Modal size="lg" isOpen={modal?.type === 'feishu' || modal?.type === 'feishu-edit'} onClose={() => setModal(null)} title={editingLink ? '编辑批次飞书链接' : '添加批次补充链接'}><FeishuForm current={editingLink} onClose={() => setModal(null)} onSave={saveLink} /></Modal>
    <Modal size="lg" isOpen={modal?.type === 'erp'} onClose={() => setModal(null)} title="调整 ERP 来源单据"><ErpReferenceForm current={batch.erpReferences} onClose={() => setModal(null)} onSave={saveErpReferences} /></Modal>
    <Modal size="lg" isOpen={modal?.type === 'site'} onClose={() => setModal(null)} title="添加现场记录"><SiteRecordForm devices={devices} onClose={() => setModal(null)} onSave={saveSiteRecord} /></Modal>
    <Modal size="xl" isOpen={modal?.type === 'result-single' || modal?.type === 'result-batch'} onClose={() => setModal(null)} title={modalRelations.some((item) => item.result !== '未确认') ? '修改设备交付结果' : '录入设备交付结果'}>
      {modalRelations.length ? <DeviceResultForm batch={batch} relations={modalRelations} devices={modalDevices} locations={locations} onClose={() => setModal(null)} onSave={saveResults} /> : <EmptyState>请先选择设备</EmptyState>}
    </Modal>
  </Page>;
}
