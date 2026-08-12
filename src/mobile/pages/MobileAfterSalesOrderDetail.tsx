import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AttachmentList, AttachmentUpload } from '../../components/AttachmentUpload';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { CategorySelect } from '../../components/issues/IssueRecordModal';
import { useApp } from '../../context/AppContext';
import { afterSalesCloseReasons, type AfterSalesMaterial, type AfterSalesOrder } from '../../data/afterSalesOrders';
import { createClientId } from '../../data/clientId';
import { nowText } from '../../data/dateTime';
import { prototypeNavEnabled } from '../../config/prototypeFeatures';
import { ISSUE_CAUSE_LEVEL_1, ISSUE_CAUSE_LEVEL_2, ISSUE_CAUSE_LEVEL_3, type IssueRecord } from '../../data/issuePool';

const dash = (value?: string) => value || '—';
const toDateTimeInput = (value?: string) => value ? value.replace(' ', 'T').slice(0, 16) : '';

function MobileFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh w-full bg-[#f5f5f5] sm:mx-auto sm:max-w-[430px] sm:border-x sm:border-gray-200">{children}</main>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-gray-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-gray-900">{title}</h2>{action}</div>{children}</section>;
}

function DetailRows({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="divide-y divide-gray-100">{items.map(([label, value]) => <div key={label} className="grid grid-cols-[104px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">{label}</dt><dd className="min-w-0 break-words text-gray-700">{value}</dd></div>)}</dl>;
}

export default function MobileAfterSalesOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const order = state.afterSalesOrders.find((item) => item.id === id) as AfterSalesOrder | undefined;
  const issue = order ? state.issueRecords.find((item) => item.id === order.issueId) : undefined;
  const device = order?.deviceId ? state.devices.find((item) => item.id === order.deviceId) : undefined;
  const location = order?.locationId ? state.locations.find((item) => item.id === order.locationId) : undefined;
  const [notice, setNotice] = useState('');
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [visitFeedback, setVisitFeedback] = useState('');
  const [handlingFeedback, setHandlingFeedback] = useState('');

  if (!order) return <MobileFrame><div className="p-5"><button type="button" className="text-sm text-gray-500" onClick={() => navigate('/mobile/tasks')}>返回我的任务</button><div className="mt-10 rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">售后工单不存在或已不可访问。</div></div></MobileFrame>;

  const readOnly = order.status === '已关单' || order.status === '已取消';
  const updateOrder = (patch: Partial<AfterSalesOrder>, action: string, notes: string) => {
    const time = nowText();
    dispatch({ type: 'UPDATE_AFTER_SALES_ORDER', payload: { ...order, ...patch, updatedAt: time, logs: [...order.logs, { id: createClientId('ASOLOG'), time, operator: state.currentUser || '当前用户', action, notes }] } });
    return time;
  };
  const accept = () => {
    updateOrder({ status: '待上门', acceptedAt: nowText() }, '确认接单', '工单状态：待接单 → 待上门');
    setConfirmAccept(false);
  };

  return <MobileFrame>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3"><button type="button" aria-label="返回我的任务" onClick={() => navigate('/mobile/tasks')} className="grid h-9 w-9 place-items-center rounded-md text-lg text-gray-600 hover:bg-gray-100">‹</button><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-semibold text-gray-900">{order.orderNo}</p><p className="mt-0.5 text-xs text-gray-400">售后现场执行</p></div>{prototypeNavEnabled && <Link className="shrink-0 text-xs text-gray-500 underline underline-offset-2" to={`/after-sales/orders/${order.id}`}>PC端查看</Link>}<StatusBadge status={order.status} /></header>
    <div className="space-y-3 p-4 pb-28">
      {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div>}
      <Section title="工单信息"><DetailRows items={[
        ['项目', dash(order.snapshot.projectName)], ['客户', dash(order.snapshot.customerName)], ['点位', location?.name || '—'], ['设备 SN', dash(order.snapshot.deviceIdentifier)],
        ...(device?.robotNo ? [['机器人编号', device.robotNo] as [string, ReactNode]] : []), ['当前售后工程师', dash(order.engineer)],
      ]} /></Section>
      <Section title="来源问题"><DetailRows items={[
        ['问题编号', order.issueNo], ['故障现象描述', dash(order.snapshot.symptom)], ['已做排查动作', dash(order.snapshot.siteTroubleshooting)], ['临时解决方案 / 现场建议', dash(order.snapshot.temporarySolution)],
        ['技术客服建议故障分类', [order.snapshot.causeLevel1, order.snapshot.causeLevel2, order.snapshot.causeLevel3].filter(Boolean).join(' / ') || '—'],
      ]} />
        <div className="mt-3 border-t border-gray-100 pt-3"><p className="mb-2 text-xs text-gray-400">来源附件</p><AttachmentList items={order.snapshot.attachments} empty="暂无来源附件。" /></div>
      </Section>
      {order.status === '待分派' && <Section title="当前待办"><p className="text-sm text-gray-600">等待分派</p><p className="mt-1 text-xs text-gray-400">工单分派给现场工程师后即可接单。</p></Section>}
      {order.status === '待接单' && <Section title="当前待办"><p className="text-sm text-gray-700">请确认接单后安排上门。</p></Section>}
      {order.status === '待上门' && <VisitPlanForm key={order.updatedAt} order={order} feedback={visitFeedback} onSave={(plannedVisitAt, visitNote) => { const savedAt = updateOrder({ plannedVisitAt, visitNote }, '设置预计上门时间', `预计上门时间：${plannedVisitAt}`); setVisitFeedback(`上门安排已保存 · ${savedAt.slice(11)}`); }} onArrive={() => {
        if (!order.plannedVisitAt) return setNotice('请先保存预计上门时间。');
        const actualVisitAt = nowText();
        updateOrder({ status: '现场处理中', actualVisitAt }, '确认已到现场', `工单状态：待上门 → 现场处理中；实际上门时间：${actualVisitAt}`);
      }} />}
      {order.status === '现场处理中' && <>
        <HandlingForm key={order.updatedAt} order={order} issue={issue} currentUser={state.currentUser || '当前用户'} dispatch={dispatch} feedback={handlingFeedback} onSave={(patch, action, notes) => { const savedAt = updateOrder(patch, action, notes); if (action !== '补充现场资料') setHandlingFeedback(`现场处理已保存 · ${savedAt.slice(11)}`); }} />
        <CloseOrderForm key={`close-${order.updatedAt}`} order={order} currentUser={state.currentUser || '当前用户'} onClose={(patch) => updateOrder(patch, '完成并关单', '工单状态：现场处理中 → 已关单；售后现场处理已完成。')} />
      </>}
      {(readOnly || order.status === '待分派') && <ReadOnlyResult order={order} issue={issue} />}
    </div>
    {!readOnly && order.status === '待接单' && !confirmAccept && <footer className="fixed bottom-0 left-0 right-0 z-10 mx-auto w-full border-t border-gray-200 bg-white p-3 sm:max-w-[430px]"><button type="button" onClick={() => setConfirmAccept(true)} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white">确认接单</button></footer>}
    <Modal isOpen={confirmAccept} onClose={() => setConfirmAccept(false)} title="确认接单"><div className="space-y-4"><p className="text-sm text-gray-700">确认接单后，工单将进入待上门。</p><DetailRows items={[["操作人", state.currentUser || '当前用户'], ['接单时间', '由系统自动记录']]} /><div className="flex gap-2"><button type="button" className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600" onClick={() => setConfirmAccept(false)}>取消</button><button type="button" className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white" onClick={accept}>确认接单</button></div></div></Modal>
  </MobileFrame>;
}

function VisitPlanForm({ order, feedback, onSave, onArrive }: { order: AfterSalesOrder; feedback: string; onSave: (plannedVisitAt: string, visitNote: string) => void; onArrive: () => void }) {
  const [plannedVisitAt, setPlannedVisitAt] = useState(toDateTimeInput(order.plannedVisitAt));
  const [visitNote, setVisitNote] = useState(order.visitNote || '');
  return <Section title="上门安排"><div className="space-y-4"><DetailRows items={[["接单人", dash(order.engineer)], ['接单时间', dash(order.acceptedAt)]]} /><Field label="预计上门时间" required><Input type="datetime-local" value={plannedVisitAt} onChange={(event) => setPlannedVisitAt(event.target.value)} /></Field><Field label="上门说明"><Textarea value={visitNote} onChange={(event) => setVisitNote(event.target.value)} /></Field><button type="button" disabled={!plannedVisitAt} onClick={() => onSave(plannedVisitAt.replace('T', ' '), visitNote.trim())} className="min-h-11 w-full rounded-md border border-gray-300 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300">保存上门安排</button>{feedback && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{feedback}</p>}<button type="button" onClick={onArrive} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white">确认已到现场</button></div></Section>;
}

type HandlingFormProps = {
  order: AfterSalesOrder;
  issue?: IssueRecord;
  currentUser: string;
  dispatch: (action: { type: string; payload: unknown }) => void;
  feedback: string;
  onSave: (patch: Partial<AfterSalesOrder>, action: string, notes: string) => void;
};
function HandlingForm({ order, issue, currentUser, dispatch, feedback, onSave }: HandlingFormProps) {
  const [values, setValues] = useState({
    onsiteHandling: order.onsiteHandling || '', actualCause: order.actualCause || '', actualSolution: order.actualSolution || '', finalResult: order.finalResult || '',
    causeLevel1: issue?.causeLevel1 || order.snapshot.causeLevel1 || '', causeLevel2: issue?.causeLevel2 || order.snapshot.causeLevel2 || '', causeLevel3: issue?.causeLevel3 || order.snapshot.causeLevel3 || '',
    involvesReplacement: Boolean(order.involvesReplacement), replacementMaterialName: order.replacementMaterialName || '', replacementOldSn: order.replacementOldSn || order.replacementBefore || '', replacementNewSn: order.replacementNewSn || order.replacementAfter || '', replacementNote: order.replacementNote || '',
  });
  const [attachment, setAttachment] = useState('');
  const [message, setMessage] = useState('');
  const set = (key: keyof typeof values, value: string | boolean) => setValues((previous) => ({ ...previous, [key]: value }));
  const setReplacement = (involvesReplacement: boolean) => setValues((previous) => ({
    ...previous,
    involvesReplacement,
    ...(involvesReplacement ? {} : { replacementMaterialName: '', replacementOldSn: '', replacementNewSn: '', replacementNote: '' }),
  }));
  const replacementMissing = values.involvesReplacement && (!values.replacementMaterialName.trim() || !values.replacementOldSn.trim() || !values.replacementNewSn.trim());
  const save = () => {
    if (!values.onsiteHandling.trim() || !values.actualSolution.trim() || !values.finalResult.trim()) return setMessage('请填写现场处理说明、实际处理方案和最终处理结果。');
    if (replacementMissing) return setMessage('涉及换件时，请填写物料名称、旧物料 SN 和新物料 SN。');
    const classificationChanged = Boolean(issue) && (issue.causeLevel1 !== values.causeLevel1 || issue.causeLevel2 !== values.causeLevel2 || issue.causeLevel3 !== values.causeLevel3);
    const { causeLevel1, causeLevel2, causeLevel3, ...handling } = values;
    const patch: Partial<AfterSalesOrder> = handling;
    onSave(patch, classificationChanged ? '售后现场处理更新故障分类' : values.involvesReplacement ? '记录现场换件信息' : '记录现场处理', classificationChanged ? '已更新现场处理信息，并将最终故障分类同步至来源问题。' : '已更新现场处理说明、实际处理方案和最终处理结果。');
    if (classificationChanged) {
      const time = nowText();
      dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: { ...issue, causeLevel1: values.causeLevel1, causeLevel2: values.causeLevel2, causeLevel3: values.causeLevel3, activityLogs: [...(issue.activityLogs || []), { id: createClientId('ISSUELOG'), time, operator: currentUser, action: '售后现场处理更新故障分类', notes: `一级：${dash(issue.causeLevel1)} → ${dash(values.causeLevel1)}；二级：${dash(issue.causeLevel2)} → ${dash(values.causeLevel2)}；三级：${dash(issue.causeLevel3)} → ${dash(values.causeLevel3)}` }] } });
    }
  };
  const addMaterial = () => {
    if (!attachment.trim()) return;
    const material: AfterSalesMaterial = { id: createClientId('ASOMAT'), name: attachment.trim(), purpose: '现场资料', addedBy: currentUser, addedAt: nowText() };
    onSave({ materials: [...order.materials, material] }, '补充现场资料', `已添加现场资料：${material.name}`);
    setAttachment('');
  };
  return <Section title="现场处理"><div className="space-y-4"><Field label="现场处理说明" required><Textarea value={values.onsiteHandling} onChange={(event) => set('onsiteHandling', event.target.value)} /></Field><Field label="实际故障原因"><Textarea value={values.actualCause} onChange={(event) => set('actualCause', event.target.value)} /></Field><Field label="实际处理方案" required><Textarea value={values.actualSolution} onChange={(event) => set('actualSolution', event.target.value)} /></Field><Field label="最终处理结果" required><Textarea value={values.finalResult} onChange={(event) => set('finalResult', event.target.value)} /></Field>
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-700">最终故障分类</p><CategorySelect label="一级故障原因分类" value={values.causeLevel1} options={ISSUE_CAUSE_LEVEL_1} onChange={(value: string) => set('causeLevel1', value)} /><CategorySelect label="二级故障原因分类" value={values.causeLevel2} options={ISSUE_CAUSE_LEVEL_2} onChange={(value: string) => set('causeLevel2', value)} /><CategorySelect label="三级故障分类" value={values.causeLevel3} options={ISSUE_CAUSE_LEVEL_3} onChange={(value: string) => set('causeLevel3', value)} /></div>
    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={values.involvesReplacement} onChange={(event) => setReplacement(event.target.checked)} />涉及换件</label>
    {values.involvesReplacement && <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3"><Field label="物料名称" required><Input value={values.replacementMaterialName} onChange={(event) => set('replacementMaterialName', event.target.value)} /></Field><Field label="旧物料 SN" required><Input value={values.replacementOldSn} onChange={(event) => set('replacementOldSn', event.target.value)} /></Field><Field label="新物料 SN" required><Input value={values.replacementNewSn} onChange={(event) => set('replacementNewSn', event.target.value)} /></Field><Field label="换件说明"><Textarea value={values.replacementNote} onChange={(event) => set('replacementNote', event.target.value)} /></Field></div>}
    <div className="border-t border-gray-100 pt-4"><p className="mb-2 text-xs font-medium text-gray-700">现场资料 / 附件</p><AttachmentUpload value={attachment} onChange={setAttachment} label="拍照 / 添加照片、视频或文件" /><button type="button" disabled={!attachment.trim()} onClick={addMaterial} className="mt-3 min-h-10 w-full rounded-md border border-gray-300 text-sm text-gray-700 disabled:text-gray-300">添加现场资料</button><div className="mt-3"><AttachmentList items={order.materials} empty="暂无现场资料。" /></div></div>
    {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}<button type="button" onClick={save} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white">保存现场处理</button>{feedback && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{feedback}</p>}
  </div></Section>;
}

function CloseOrderForm({ order, currentUser, onClose }: { order: AfterSalesOrder; currentUser: string; onClose: (patch: Partial<AfterSalesOrder>) => void }) {
  const [closeNote, setCloseNote] = useState(order.closeNote || '');
  const [proof, setProof] = useState('');
  const proofMaterial = proof.trim() ? { id: createClientId('ASOMAT'), name: proof.trim(), purpose: '正常工作视频或处理结果证明', addedBy: currentUser, addedAt: nowText() } : undefined;
  const materials = proofMaterial ? [...order.materials, proofMaterial] : order.materials;
  const missing = afterSalesCloseReasons({ ...order, closeNote, materials });
  return <Section title="完成处理并关单"><div className="space-y-4"><p className="text-xs leading-5 text-gray-500">关单只结束本次现场服务，不会修改来源问题的质量跟进字段。</p><Field label="关单说明" required><Textarea value={closeNote} onChange={(event) => setCloseNote(event.target.value)} /></Field><AttachmentUpload value={proof} onChange={setProof} label="正常工作视频或处理结果证明资料" required />{missing.length > 0 && <div className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">暂不能关单：{missing.join('、')}。</div>}<button type="button" disabled={missing.length > 0} onClick={() => onClose({ status: '已关单', closeNote: closeNote.trim(), closedBy: currentUser, closedAt: nowText(), materials })} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300">完成处理并关单</button></div></Section>;
}

function ReadOnlyResult({ order, issue }: { order: AfterSalesOrder; issue?: IssueRecord }) {
  const replacementItems: Array<[string, ReactNode]> = order.involvesReplacement ? [['物料名称', order.replacementMaterialName || '—'], ['旧物料 SN', order.replacementOldSn || order.replacementBefore || '—'], ['新物料 SN', order.replacementNewSn || order.replacementAfter || '—'], ['换件说明', dash(order.replacementNote)]] : [];
  return <><Section title="现场处理结果"><DetailRows items={[
    ['接单人 / 时间', `${dash(order.engineer)} / ${dash(order.acceptedAt)}`], ['实际上门时间', dash(order.actualVisitAt)], ['现场处理说明', dash(order.onsiteHandling)], ['实际故障原因', dash(order.actualCause)], ['实际处理方案', dash(order.actualSolution)], ['最终处理结果', dash(order.finalResult)], ['最终故障分类', [issue?.causeLevel1, issue?.causeLevel2, issue?.causeLevel3].filter(Boolean).join(' / ') || '—'], ['是否涉及换件', order.involvesReplacement ? '是' : '否'], ...replacementItems,
  ]} /><div className="mt-3 border-t border-gray-100 pt-3"><p className="mb-2 text-xs text-gray-400">现场资料</p><AttachmentList items={order.materials} empty="暂无现场资料。" /></div></Section>
  {order.status === '已关单' && <Section title="关单信息"><DetailRows items={[["关单人", dash(order.closedBy)], ['关单时间', dash(order.closedAt)], ['关单说明', dash(order.closeNote)]]} /></Section>}
  {order.status === '已取消' && <Section title="取消信息"><DetailRows items={[["取消人", dash(order.cancelledBy)], ['取消时间', dash(order.cancelledAt)], ['取消原因', dash(order.cancelReason)]]} /></Section>}</>;
}
