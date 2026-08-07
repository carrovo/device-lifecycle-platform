import { useState } from 'react';
import Modal from '../Modal';
import { Btn, Input, Select } from '../ui';
import { ACCEPTANCE_RESULTS, INSTALLATION_STATUSES } from '../../data/deliverySubOrders';

function Footer({ onClose, onSubmit, submitLabel, disabled = false, hint = '' }) {
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting || disabled) return;
    setSubmitting(true);
    try { await Promise.resolve(onSubmit()); } finally { setSubmitting(false); }
  };
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"><p className="text-xs text-gray-400">{hint}</p><div className="flex gap-2"><Btn disabled={submitting} onClick={onClose}>取消</Btn><Btn variant="primary" disabled={disabled || submitting} onClick={submit}>{submitting ? `${submitLabel}中…` : submitLabel}</Btn></div></div>;
}

function ContextBox({ children }) {
  return <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">{children}</div>;
}

function MaterialFields({ form, setForm, title = '资料记录（暂不上传真实文件）' }) {
  return <div className="rounded-md border border-gray-200 p-3 space-y-3"><p className="text-xs font-medium text-gray-700">{title}</p><Input className="w-full" placeholder="文件名（选填）" value={form.materialName || ''} onChange={(event) => setForm((prev) => ({ ...prev, materialName: event.target.value }))} /><Input className="w-full" placeholder="资料用途" value={form.materialPurpose || ''} onChange={(event) => setForm((prev) => ({ ...prev, materialPurpose: event.target.value }))} /><Input className="w-full" placeholder="资料备注" value={form.materialNote || ''} onChange={(event) => setForm((prev) => ({ ...prev, materialNote: event.target.value }))} /></div>;
}

export function AssignModal({ isOpen, onClose, onSave, options, subOrder }) {
  const [engineer, setEngineer] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!engineer) return setError('请选择本次任务的执行工程师。');
    onSave(engineer);
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="分派执行工程师"><div className="space-y-4"><ContextBox>操作对象：{subOrder?.name || '当前交付子工单'}<br />提交后工单进入“待接单”，由所选工程师确认接单。</ContextBox><div><label className="block text-xs text-gray-600 mb-1">执行工程师 <span className="text-red-500">*</span></label><Select className="w-full" value={engineer} onChange={(event) => { setEngineer(event.target.value); setError(''); }}><option value="">请选择</option>{options.map((item) => <option key={item}>{item}</option>)}</Select>{error && <p className="text-xs text-red-600 mt-1">{error}</p>}</div><Footer onClose={onClose} onSubmit={submit} submitLabel="确认分派" hint="任务联系人和执行工程师是不同角色。" /></div></Modal>;
}

export function RecordUpdateModal({ isOpen, onClose, onSave, title, objectLabel, submitLabel, resultHint, noteLabel = '完成说明', required = false }) {
  const [form, setForm] = useState({ note: '', materialName: '', materialPurpose: '', materialNote: '' });
  const [error, setError] = useState('');
  const submit = () => {
    if (required && !form.note.trim()) return setError(`请填写${noteLabel}。`);
    onSave({ note: form.note.trim(), material: form.materialName.trim() ? { name: form.materialName, purpose: form.materialPurpose || '现场执行资料', note: form.materialNote } : null });
  };
  return <Modal isOpen={isOpen} onClose={onClose} title={title}><div className="space-y-4"><ContextBox>操作对象：{objectLabel}<br />{resultHint}</ContextBox><div><label className="block text-xs text-gray-600 mb-1">{noteLabel} {required ? <span className="text-red-500">*</span> : <span className="text-gray-400">（选填）</span>}</label><textarea className="ui-input w-full min-h-20" placeholder="记录本次完成情况" value={form.note} onChange={(event) => { setForm((prev) => ({ ...prev, note: event.target.value })); setError(''); }} /></div><MaterialFields form={form} setForm={setForm} />{error && <p className="text-xs text-red-600">{error}</p>}<Footer onClose={onClose} onSubmit={submit} submitLabel={submitLabel} hint={resultHint} /></div></Modal>;
}

export function MaterialModal({ isOpen, onClose, onSave, objectLabel }) {
  const [form, setForm] = useState({ name: '', purpose: '', note: '' });
  const [error, setError] = useState('');
  const submit = () => {
    if (!form.name.trim()) return setError('请填写资料文件名。');
    if (!form.purpose.trim()) return setError('请填写资料用途。');
    onSave(form);
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="添加资料记录"><div className="space-y-4"><ContextBox>资料归属：{objectLabel}<br />仅记录资料信息，当前不会上传或存储真实文件。</ContextBox><div><label className="block text-xs text-gray-600 mb-1">文件名 <span className="text-red-500">*</span></label><Input className="w-full" value={form.name} onChange={(event) => { setForm((prev) => ({ ...prev, name: event.target.value })); setError(''); }} /></div><div><label className="block text-xs text-gray-600 mb-1">资料用途 <span className="text-red-500">*</span></label><Input className="w-full" value={form.purpose} onChange={(event) => { setForm((prev) => ({ ...prev, purpose: event.target.value })); setError(''); }} /></div><div><label className="block text-xs text-gray-600 mb-1">备注 <span className="text-gray-400">（选填）</span></label><textarea className="ui-input w-full min-h-16" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} /></div>{error && <p className="text-xs text-red-600">{error}</p>}<Footer onClose={onClose} onSubmit={submit} submitLabel="添加资料记录" hint="保存后显示在当前业务记录下。" /></div></Modal>;
}

export function BlockModal({ isOpen, onClose, onSave, owner, nodeLabel, subOrder }) {
  const [form, setForm] = useState({ reason: '', owner: owner || '', pausesTask: true, materialName: '', materialPurpose: '阻塞处理资料', materialNote: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.reason.trim()) next.reason = '请填写阻塞原因。';
    if (!form.owner.trim()) next.owner = '请填写当前处理人。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="登记交付阻塞"><div className="space-y-4"><ContextBox>操作对象：{subOrder?.name || '当前交付子工单'}<br />发生环节：{nodeLabel}。交付阻塞只在当前子工单处理，不创建问题池记录。</ContextBox><div><label className="block text-xs text-gray-600 mb-1">阻塞描述 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-24" value={form.reason} onChange={(event) => { setForm((prev) => ({ ...prev, reason: event.target.value })); setErrors((prev) => ({ ...prev, reason: '' })); }} />{errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}</div><label className="flex items-start gap-2 text-xs text-gray-700"><input className="mt-0.5" type="checkbox" checked={form.pausesTask} onChange={(event) => setForm((prev) => ({ ...prev, pausesTask: event.target.checked }))} /><span>暂停整张子工单流程。未勾选时仅记录并跟进当前阻塞，不中断其他现场任务。</span></label><div><label className="block text-xs text-gray-600 mb-1">当前处理人 <span className="text-red-500">*</span></label><Input className="w-full" value={form.owner} onChange={(event) => { setForm((prev) => ({ ...prev, owner: event.target.value })); setErrors((prev) => ({ ...prev, owner: '' })); }} />{errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}</div><MaterialFields form={form} setForm={setForm} /><Footer onClose={onClose} onSubmit={submit} submitLabel={form.pausesTask ? '登记并暂停流程' : '登记交付阻塞'} hint={form.pausesTask ? '解除全部整单阻塞后恢复到原状态和节点。' : '保存后不改变当前流程状态。'} /></div></Modal>;
}

export function BlockProgressModal({ isOpen, onClose, onSave, block, resolve = false }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (!note.trim()) return setError(resolve ? '请填写阻塞解除结果。' : '请填写本次处理进展。');
    onSave({ note: note.trim() });
  };
  return <Modal isOpen={isOpen} onClose={onClose} title={resolve ? '标记交付阻塞已解决' : '更新阻塞处理进展'}><div className="space-y-4"><ContextBox>发生环节：{block?.nodeLabel}<br />阻塞描述：{block?.reason}<br />当前处理人：{block?.owner}</ContextBox><div><label className="block text-xs text-gray-600 mb-1">{resolve ? '解决结果' : '处理进展'} <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-24" value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} /></div>{error && <p className="text-xs text-red-600">{error}</p>}<Footer onClose={onClose} onSubmit={submit} submitLabel={resolve ? '标记已解决' : '保存阻塞进展'} hint={resolve ? (block?.pausesTask ? '所有整单阻塞均解除后，流程恢复到原环节。' : '仅更新当前阻塞为已解决。') : '保存后不改变当前阻塞状态。'} /></div></Modal>;
}

export function InstallationModal({ isOpen, onClose, onSave, device, record }) {
  const [form, setForm] = useState({ installationStatus: record?.installationStatus || '未开始', installationNote: record?.installationNote || '', materialName: '', materialPurpose: '设备安装调试资料', materialNote: '' });
  return <Modal isOpen={isOpen} onClose={onClose} title="记录设备安装调试进度"><div className="space-y-4"><ContextBox>机器人编号：{device?.robotNo || '—'}<br />设备 SN：{device?.sn || '—'}<br />设备型号：{device?.model || '设备档案型号'}</ContextBox><div><label className="block text-xs text-gray-600 mb-1">安装调试进度 <span className="text-red-500">*</span></label><Select className="w-full" value={form.installationStatus} onChange={(event) => setForm((prev) => ({ ...prev, installationStatus: event.target.value }))}>{INSTALLATION_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select></div><div><label className="block text-xs text-gray-600 mb-1">处理说明 <span className="text-gray-400">（选填）</span></label><textarea className="ui-input w-full min-h-20" placeholder="记录安装、调试和现场处理情况" value={form.installationNote} onChange={(event) => setForm((prev) => ({ ...prev, installationNote: event.target.value }))} /></div><MaterialFields form={form} setForm={setForm} /><Footer onClose={onClose} onSubmit={() => onSave(form)} submitLabel="保存安装调试进度" hint="仅更新该设备，不会推进整张工单。" /></div></Modal>;
}

export function AcceptanceModal({ isOpen, onClose, onSave, device, record, relatedIssues = [], draft, onCreateIssue }) {
  const [form, setForm] = useState({ acceptanceResult: record?.acceptanceResult || '', acceptanceNote: record?.acceptanceNote || '', materialName: '', materialPurpose: '设备验收资料', materialNote: '', relatedIssueId: '', ...draft });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const openIssues = relatedIssues.filter((item) => item.isClosed !== '是');
  const cannotPass = false;
  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.acceptanceResult) next.result = '请选择该设备的验收结果。';
    if (form.acceptanceResult === '未通过' && !form.acceptanceNote.trim()) next.note = '未通过结果需要填写验收说明。';
    if (form.acceptanceResult === '未通过' && !form.relatedIssueId) next.issue = '未通过验收必须关联正式问题池记录。';
    if (Object.keys(next).length) return setErrors(next);
    onSave(form);
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="保存设备验收结果"><div className="space-y-4"><ContextBox>机器人编号：{device?.robotNo || '—'}<br />设备 SN：{device?.sn || '—'}<br />安装调试进度：{record?.installationStatus}<br />保存后只更新该设备的现场验收记录，不修改当前交付结果。</ContextBox><div><label className="block text-xs text-gray-600 mb-1">验收结果 <span className="text-red-500">*</span></label><Select className="w-full" value={form.acceptanceResult} onChange={(event) => { setForm((prev) => ({ ...prev, acceptanceResult: event.target.value })); setErrors({}); }}><option value="">请选择</option>{ACCEPTANCE_RESULTS.map((item) => <option key={item}>{item}</option>)}</Select>{errors.result && <p className="text-xs text-red-600 mt-1">{errors.result}</p>}</div><div><label className="block text-xs text-gray-600 mb-1">验收说明 {form.acceptanceResult === '未通过' ? <span className="text-red-500">*</span> : <span className="text-gray-400">（选填）</span>}</label><textarea className="ui-input w-full min-h-20" value={form.acceptanceNote} onChange={(event) => { setForm((prev) => ({ ...prev, acceptanceNote: event.target.value })); setErrors((prev) => ({ ...prev, note: '' })); }} />{errors.note && <p className="text-xs text-red-600 mt-1">{errors.note}</p>}</div>{form.acceptanceResult === '未通过' && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2"><p className="text-xs font-medium text-amber-800">关联问题记录 <span className="text-red-500">*</span></p><Select className="w-full" value={form.relatedIssueId} onChange={(event) => { setForm((prev) => ({ ...prev, relatedIssueId: event.target.value })); setErrors((prev) => ({ ...prev, issue: '' })); }}><option value="">请选择当前设备待处理问题</option>{openIssues.map((issue) => <option key={issue.id} value={issue.id}>{issue.issueNo} · {issue.symptom || '未填写故障现象'} · {issue.resolutionStatus || '未填写'} / {issue.isClosed || '未填写'}</option>)}</Select>{!openIssues.length && <p className="text-xs text-amber-700">当前暂无可关联的待处理问题，可提交新的设备问题。</p>}<button type="button" className="ui-link text-[13px]" onClick={() => onCreateIssue(form)}>提交新的设备问题</button>{errors.issue && <p className="text-xs text-red-600">{errors.issue}</p>}</div>}<MaterialFields form={form} setForm={setForm} /><Footer onClose={onClose} onSubmit={submit} disabled={cannotPass} submitLabel="保存设备验收结果" hint="未通过结果需关联正式问题池记录；不修改当前交付结果。" /></div></Modal>;
}

export function CompleteOrderModal({ isOpen, onClose, onSave, risks, kind = 'deployment' }) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const risky = risks.length > 0;
  const submit = () => {
    if (risky) return setError('当前仍存在未满足的完成条件，请先处理后再完成。');
    if (!confirmed) return setError('请确认已核对设备结果和未关闭异常。');
    onSave(note.trim());
  };
  return <Modal isOpen={isOpen} onClose={onClose} title={kind === 'deployment' ? '完成部署子工单' : '确认完成前置子工单'}><div className="space-y-4"><ContextBox>完成后工单切换为只读，当前不支持重新打开；{kind === 'deployment' ? '不会修改既有交付数量、通过率或设备交付结果。' : '后续可从本工单创建机器人／设备部署子工单。'}</ContextBox>{risky && <div className="rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">暂不能完成</p><ul className="mt-2 space-y-1 text-xs text-amber-700">{risks.map((item) => <li key={item}>• {item}</li>)}</ul></div>}<div><label className="block text-xs text-gray-600 mb-1">完成说明 <span className="text-gray-400">（选填）</span></label><textarea className="ui-input w-full min-h-20" placeholder={kind === 'deployment' ? '补充本次部署完成情况' : '补充前置条件确认情况'} value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} /></div><label className="flex items-start gap-2 text-xs text-gray-600"><input className="mt-0.5" type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setError(''); }} /><span>{kind === 'deployment' ? '我已核对所有设备已完成安装调试、验收通过，且交付阻塞已处理。' : '我已核对全部必要前置检查和设备部署条件。'}</span></label>{error && <p className="text-xs text-red-600">{error}</p>}<Footer onClose={onClose} onSubmit={submit} disabled={risky} submitLabel={kind === 'deployment' ? '完成部署子工单' : '确认完成前置子工单'} hint="这是阶段结束操作，需要再次确认。" /></div></Modal>;
}
