import { useEffect, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AttachmentList, AttachmentUpload } from '../../components/AttachmentUpload';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { useApp } from '../../context/AppContext';
import { createClientId } from '../../data/clientId';
import { nowText } from '../../data/dateTime';
import { deviceAcceptancePrerequisites, hasTaskExecutionBlock, INSTALLATION_STATUSES, type DeliverySubOrder, type ReviewMaterial } from '../../data/deliverySubOrders';
import { technicalSupportDecisionLabel, type IssueRecord } from '../../data/issuePool';
import type { AfterSalesOrder } from '../../data/afterSalesOrders';

function MobileFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh w-full bg-[#f5f5f5] sm:mx-auto sm:max-w-[430px] sm:border-x sm:border-gray-200">{children}</main>;
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-gray-900">{title}</h2>{action}</div>{children}</section>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-gray-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

function DetailRows({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="divide-y divide-gray-100">{items.map(([label, value]) => <div key={label} className="grid grid-cols-[104px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">{label}</dt><dd className="min-w-0 break-words text-gray-700">{value}</dd></div>)}</dl>;
}

type ModalState = 'installation' | 'acceptance' | null;

export default function MobileDeliveryDeviceDetail() {
  const { id, deviceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useApp();
  const subOrder = state.deliverySubOrders.find((item: DeliverySubOrder) => item.id === id) as DeliverySubOrder | undefined;
  const record = subOrder?.devices.find((item) => item.deviceId === deviceId);
  const [modal, setModal] = useState<ModalState>(null);
  const [feedback, setFeedback] = useState(searchParams.get('issueSubmitted') ? `问题已提交：${searchParams.get('issueSubmitted')}` : '');
  const [autoAcceptanceOpened, setAutoAcceptanceOpened] = useState(false);
  const pendingIssueId = searchParams.get('acceptanceIssue') || '';

  useEffect(() => {
    if (pendingIssueId && !autoAcceptanceOpened && record?.installationStatus === '已完成' && ['执行中', '待设备验收'].includes(subOrder?.status || '')) {
      setAutoAcceptanceOpened(true);
      setModal('acceptance');
    }
  }, [pendingIssueId, autoAcceptanceOpened, subOrder?.status, record?.installationStatus]);

  if (!subOrder || !record) return <MobileFrame><div className="p-5"><button type="button" className="text-sm text-gray-500" onClick={() => navigate(`/mobile/delivery/${id || ''}`)}>返回交付任务</button><div className="mt-10 rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">设备执行记录不存在或已不可访问。</div></div></MobileFrame>;

  const plan = state.deliveryPlans.find((item: { id: string }) => item.id === subOrder.deliveryPlanId);
  const project = state.projects.find((item: { id: string }) => item.id === plan?.projectId);
  const location = state.locations.find((item: { id: string }) => item.id === subOrder.locationId);
  const device = state.devices.find((item: { id: string }) => item.id === record.deviceId);
  const deviceType = state.deviceTypes.find((item: { id: string }) => item.id === device?.deviceTypeId);
  const operator = state.currentUser || subOrder.engineer || subOrder.owner || '当前用户';
  const linkedIssues = (subOrder.issueLinks || []).filter((link) => link.deviceId === record.deviceId).map((link) => state.issueRecords.find((issue: IssueRecord) => issue.id === link.issueId)).filter(Boolean) as IssueRecord[];
  const openIssues = linkedIssues.filter((issue) => issue.isClosed !== '是');
  const acceptancePrerequisites = deviceAcceptancePrerequisites(subOrder, record);
  const canAccept = acceptancePrerequisites.ready;
  const readOnly = subOrder.status === '已完成';

  const material = (name: string, purpose: string, note = ''): ReviewMaterial => ({ id: createClientId('DSOMAT'), name, purpose, uploadedBy: operator, uploadedAt: nowText(), note });
  const commit = (transform: (order: DeliverySubOrder, time: string) => DeliverySubOrder, action: string, notes: string, success: string) => {
    const time = nowText();
    const next = transform(subOrder, time);
    dispatch({ type: 'UPDATE_DELIVERY_SUB_ORDER', payload: { ...next, updatedAt: time, logs: [...(next.logs || []), { id: createClientId('DSOLOG'), operator, time, action, notes, deviceId: record.deviceId }] } });
    setModal(null);
    setFeedback(`${success} · ${time.slice(11)}`);
  };

  return <MobileFrame>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3"><button type="button" aria-label="返回交付任务" onClick={() => navigate(`/mobile/delivery/${subOrder.id}`)} className="grid h-9 w-9 place-items-center rounded-md text-lg text-gray-600 hover:bg-gray-100">‹</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{device?.sn || '设备执行'}</p><p className="mt-0.5 text-xs text-gray-400">机器人／设备部署</p></div><div className="flex flex-col items-end gap-1"><StatusBadge status={record.installationStatus || '未开始'} /><StatusBadge status={record.acceptanceResult || '未记录'} /></div></header>
    <div className="space-y-3 p-4 pb-8">
      {feedback && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{feedback}</p>}
      <Section title="设备信息"><DetailRows items={[["设备 SN", device?.sn || '—'], ['机器人编号', device?.robotNo || '—'], ['设备型号', deviceType?.name || device?.model || '—'], ['项目', project?.name || '—'], ['点位', location?.name || '—']]} /></Section>
      <Section title="安装调试" action={!readOnly && subOrder.status === '执行中' && !hasTaskExecutionBlock(subOrder) ? <button type="button" onClick={() => setModal('installation')} className="text-xs font-medium text-gray-700 underline underline-offset-2">更新安装调试</button> : undefined}><DetailRows items={[["当前状态", record.installationStatus || '未开始'], ['执行说明', record.installationNote || '—']]} />{record.materials.length > 0 && <div className="mt-3 border-t border-gray-100 pt-3"><p className="mb-2 text-xs text-gray-400">现场资料</p><AttachmentList items={record.materials} empty="暂无现场资料。" /></div>}{subOrder.status !== '执行中' && !readOnly && <p className="mt-3 text-xs text-gray-400">确认到场并进入现场执行后，才能更新安装调试。</p>}{hasTaskExecutionBlock(subOrder) && !readOnly && <p className="mt-3 text-xs text-amber-700">当前存在未解除的整单交付阻塞，暂不能更新安装调试。</p>}</Section>
      <Section title="设备验收" action={canAccept ? <button type="button" onClick={() => setModal('acceptance')} className="text-xs font-medium text-gray-700 underline underline-offset-2">{record.acceptanceResult ? '重新验收' : '开始验收'}</button> : undefined}><DetailRows items={[["当前结果", record.acceptanceResult || '未记录'], ['验收说明', record.acceptanceNote || '—']]} />{!canAccept && <p className="mt-3 text-xs leading-5 text-amber-700">{acceptancePrerequisites.reasons.join('；')}。</p>}{record.acceptanceHistory?.length ? <div className="mt-3 border-t border-gray-100 pt-3"><p className="mb-2 text-xs font-medium text-gray-600">验收历史</p><div className="space-y-2">{[...record.acceptanceHistory].reverse().map((history) => { const issue = history.issueId ? linkedIssues.find((item) => item.id === history.issueId) : undefined; return <div key={history.id} className="rounded-md bg-gray-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-700">{history.to}</span><span className="text-gray-400">{history.time}</span></div><p className="mt-1 text-gray-500">{history.note || '—'}</p>{issue && <p className="mt-1 text-gray-500">关联问题：{issue.issueNo}</p>}</div>; })}</div></div> : null}</Section>
      <Section title="现场问题" action={!readOnly ? <Link to={`/mobile/issues/new?subOrderId=${subOrder.id}&deviceId=${record.deviceId}`} className="text-xs font-medium text-gray-700 underline underline-offset-2">提交设备问题</Link> : undefined}>{linkedIssues.length ? <div className="space-y-2">{linkedIssues.map((issue) => <IssueSummary key={issue.id} issue={issue} afterSalesOrder={state.afterSalesOrders.find((order) => order.issueId === issue.id)} />)}</div> : <div><p className="text-sm text-gray-400">当前设备暂无关联问题。</p>{!readOnly && <Link to={`/mobile/issues/new?subOrderId=${subOrder.id}&deviceId=${record.deviceId}`} className="mt-3 inline-block text-xs font-medium text-gray-700 underline underline-offset-2">提交设备问题</Link>}</div>}<p className="mt-3 text-xs leading-5 text-gray-400">设备现场恢复或验收通过不会自动关闭正式问题，后续质量跟进仍在问题池中维护。</p></Section>
    </div>
    <InstallationModal isOpen={modal === 'installation'} record={record} onClose={() => setModal(null)} onSave={(installationStatus, installationNote, attachment) => commit((order) => ({ ...order, devices: order.devices.map((item) => item.id === record.id ? { ...item, installationStatus, installationNote: installationNote.trim(), materials: attachment ? [...item.materials, material(attachment, '设备安装调试资料', installationNote.trim())] : item.materials } : item) }), '保存安装调试进度', `${device?.sn || record.deviceId} 安装调试进度：${record.installationStatus} → ${installationStatus}`, '安装调试已保存')} />
    <AcceptanceModal isOpen={modal === 'acceptance'} record={record} issues={openIssues} afterSalesOrders={state.afterSalesOrders} defaultIssueId={pendingIssueId} onClose={() => setModal(null)} onCreateIssue={() => navigate(`/mobile/issues/new?subOrderId=${subOrder.id}&deviceId=${record.deviceId}&fromAcceptance=1`)} onSave={(result, note, relatedIssueId, attachment) => {
      if (result === '未通过' && (!note.trim() || !relatedIssueId)) return;
      if (result === '未通过' && !openIssues.some((issue) => issue.id === relatedIssueId)) return;
      const relatedIssue = result === '未通过' && relatedIssueId ? state.issueRecords.find((issue: IssueRecord) => issue.id === relatedIssueId) : undefined;
      const acceptanceIssueId = result === '未通过' ? relatedIssueId : '';
      commit((order, time) => ({ ...order, devices: order.devices.map((item) => item.id === record.id ? { ...item, acceptanceResult: result, acceptanceNote: note.trim(), materials: attachment ? [...item.materials, material(attachment, '设备验收资料', note.trim())] : item.materials, acceptanceHistory: [...(item.acceptanceHistory || []), { id: createClientId('DSOACC'), time, operator, from: item.acceptanceResult || '未记录', to: result, note: note.trim(), issueId: acceptanceIssueId || undefined }] } : item) }), '保存设备验收结果', `${device?.sn || record.deviceId} 验收结果：${record.acceptanceResult || '未记录'} → ${result}${relatedIssue ? `；关联问题 ${relatedIssue.issueNo}` : ''}`, '设备验收已保存');
    }} />
  </MobileFrame>;
}

function InstallationModal({ isOpen, record, onClose, onSave }: { isOpen: boolean; record: DeliverySubOrder['devices'][number]; onClose: () => void; onSave: (status: string, note: string, attachment: string) => void }) {
  const [status, setStatus] = useState(record.installationStatus || '未开始');
  const [note, setNote] = useState(record.installationNote || '');
  const [attachment, setAttachment] = useState('');
  return <Modal mobile isOpen={isOpen} onClose={onClose} title="更新安装调试"><div className="space-y-4"><Field label="安装调试状态" required><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800">{INSTALLATION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="执行说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录安装、调试和现场处理情况" /></Field><AttachmentUpload value={attachment} onChange={setAttachment} label="现场资料" /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={() => onSave(status, note, attachment)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">保存安装调试</button></div></div></Modal>;
}

function IssueSummary({ issue, afterSalesOrder }: { issue: IssueRecord; afterSalesOrder?: AfterSalesOrder }) {
  const technicalSupport = issue.technicalSupport;
  const feedbacks = technicalSupport?.researchFeedbacks || [];
  const researchFeedback = feedbacks[feedbacks.length - 1];
  const decision = technicalSupport?.decision;
  const path = decision ? technicalSupportDecisionLabel(decision) : '—';
  const currentNode = issueCurrentNode(decision, Boolean(researchFeedback), afterSalesOrder);
  const activityLogs = issue.activityLogs || [];
  const latestTime = researchFeedback?.handledAt || technicalSupport?.handledAt || activityLogs[activityLogs.length - 1]?.time || issue.reportedAt;
  return <div className="rounded-md border border-gray-200 p-3"><div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-semibold text-gray-700">{issue.issueNo}</p><span className="text-xs text-gray-400">{latestTime || '—'}</span></div><p className="mt-2 text-xs leading-5 text-gray-600">{issue.symptom || '未填写故障现象描述'}</p><div className="mt-2 space-y-1 text-xs leading-5 text-gray-600"><p><span className="text-gray-400">处理路径：</span>{path}</p><p><span className="text-gray-400">当前节点：</span>{currentNode}</p></div>{decision === '远程处理' && <div className="mt-2 space-y-1 text-xs leading-5 text-gray-500">{issue.siteTroubleshooting && <p>已做排查动作：{issue.siteTroubleshooting}</p>}{issue.temporarySolution && <p>临时解决方案：{issue.temporarySolution}</p>}</div>}{decision === '升级研发协助' && <div className="mt-2 space-y-1 text-xs leading-5 text-gray-500">{technicalSupport?.note && <p>研发协助说明：{technicalSupport.note}</p>}{researchFeedback && <p>最新研发反馈：{researchFeedback.content}</p>}</div>}{(decision === '需要现场处理，转售后工单' || afterSalesOrder) && <p className="mt-2 text-xs text-gray-500">关联售后工单：{afterSalesOrder?.orderNo || '—'}</p>}</div>;
}

function issueCurrentNode(decision: string | undefined, hasResearchFeedback: boolean, afterSalesOrder?: AfterSalesOrder) {
  if (!decision) return '待技术客服处理';
  if (decision === '远程处理') return '技术客服已远程处理';
  if (decision === '升级研发协助') return hasResearchFeedback ? '研发已反馈' : '研发协助中';
  if (decision === '需要现场处理，转售后工单') {
    const nodes: Record<AfterSalesOrder['status'], string> = {
      '待分派': '售后待分派',
      '待接单': '售后待接单',
      '待上门': '售后待上门',
      '现场处理中': '售后现场处理中',
      '已关单': '售后已关单',
      '已取消': '售后已取消',
    };
    return afterSalesOrder ? nodes[afterSalesOrder.status] : '已转售后';
  }
  return technicalSupportDecisionLabel(decision);
}

function AcceptanceModal({ isOpen, record, issues, afterSalesOrders, defaultIssueId, onClose, onCreateIssue, onSave }: { isOpen: boolean; record: DeliverySubOrder['devices'][number]; issues: IssueRecord[]; afterSalesOrders: AfterSalesOrder[]; defaultIssueId: string; onClose: () => void; onCreateIssue: () => void; onSave: (result: string, note: string, issueId: string, attachment: string) => void }) {
  const [result, setResult] = useState(record.acceptanceResult || '');
  const [note, setNote] = useState(record.acceptanceNote || '');
  const [issueId, setIssueId] = useState(defaultIssueId);
  const [attachment, setAttachment] = useState('');
  const [error, setError] = useState('');
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const passingWithOpenIssues = result === '通过' && issues.length > 0;
  const submit = () => {
    if (!result) return setError('请选择设备验收结果。');
    if (result === '未通过' && !note.trim()) return setError('未通过验收需要填写验收说明。');
    if (result === '未通过' && !issueId) return setError('未通过验收必须关联当前设备的正式问题。');
    if (passingWithOpenIssues && !note.trim()) return setError('请填写本次现场验证依据。');
    if (passingWithOpenIssues && !riskAcknowledged) return setError('请确认相关问题当前已经恢复，或不影响本次设备验收。');
    onSave(result, note, issueId, attachment);
  };
  return <Modal mobile isOpen={isOpen} onClose={onClose} title={record.acceptanceResult ? '重新验收' : '保存设备验收结果'}><div className="space-y-4"><Field label="验收结果" required><select value={result} onChange={(event) => { setResult(event.target.value); setRiskAcknowledged(false); setError(''); }} className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800"><option value="">请选择</option><option value="通过">通过</option><option value="未通过">未通过</option></select></Field>{passingWithOpenIssues && <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-medium leading-5 text-amber-900">当前设备仍有关联未闭环问题。验收通过表示你已确认相关问题当前已经恢复，或不影响本次设备验收。</p><div className="space-y-2">{issues.map((issue) => <AcceptanceRiskIssue key={issue.id} issue={issue} afterSalesOrder={afterSalesOrders.find((order) => order.issueId === issue.id)} />)}</div><label className="flex items-start gap-2 text-xs leading-5 text-amber-900"><input className="mt-0.5" type="checkbox" checked={riskAcknowledged} onChange={(event) => { setRiskAcknowledged(event.target.checked); setError(''); }} /><span>我已确认上述问题当前已经恢复，或不影响本次设备验收。</span></label></div>}<Field label={passingWithOpenIssues ? '验收说明（现场验证依据）' : '验收说明'} required={result === '未通过' || passingWithOpenIssues}><Textarea value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} placeholder={passingWithOpenIssues ? '请说明相关问题当前已经恢复，或为何不影响本次设备验收。' : undefined} /></Field>{result === '未通过' && <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3"><Field label="关联问题" required><select value={issueId} onChange={(event) => { setIssueId(event.target.value); setError(''); }} className="min-h-11 w-full rounded-md border border-amber-200 bg-white px-3 text-sm text-gray-800"><option value="">请选择当前设备待处理问题</option>{issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.issueNo} · {issue.symptom || '未填写故障现象'}</option>)}</select></Field>{!issues.length && <p className="text-xs text-amber-700">当前设备暂无可关联问题。</p>}<button type="button" onClick={onCreateIssue} className="text-xs font-medium text-gray-700 underline underline-offset-2">提交设备问题</button></div>}<AttachmentUpload value={attachment} onChange={setAttachment} label="验收资料" />{error && <p className="text-xs text-red-600">{error}</p>}<div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={submit} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">保存设备验收结果</button></div></div></Modal>;
}

function AcceptanceRiskIssue({ issue, afterSalesOrder }: { issue: IssueRecord; afterSalesOrder?: AfterSalesOrder }) {
  const decision = issue.technicalSupport?.decision;
  const currentHandling = decision ? technicalSupportDecisionLabel(decision) : afterSalesOrder ? '已转售后工单' : '待技术客服处理';
  return <div className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs"><p className="font-mono font-semibold text-gray-700">{issue.issueNo}</p><p className="mt-1 leading-5 text-gray-600">{issue.symptom || '未填写故障现象描述'}</p><p className="mt-1 text-gray-500">当前处理：{currentHandling}</p>{afterSalesOrder && <p className="mt-1 text-gray-500">关联售后工单：{afterSalesOrder.orderNo}</p>}</div>;
}
