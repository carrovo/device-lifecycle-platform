import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Btn, DescList, Input, Page, PageHeader, Section, Select, Stepper, Table } from '../components/ui';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { AttachmentList, AttachmentUpload } from '../components/AttachmentUpload';
import { afterSalesCloseReasons, afterSalesGuidance, type AfterSalesOrder } from '../data/afterSalesOrders';
import { createClientId } from '../data/clientId';
import { nowText } from '../data/dateTime';
import { prototypeNavEnabled } from '../config/prototypeFeatures';
import { ISSUE_CAUSE_LEVEL_1, ISSUE_CAUSE_LEVEL_2, ISSUE_CAUSE_LEVEL_3, technicalSupportDecisionLabel } from '../data/issuePool';
import { CategorySelect } from '../components/issues/IssueRecordModal';

const STEPS = ['待分派', '待接单', '待上门', '现场处理中', '已关单'].map((label) => ({ label }));
const dash = (value?: string) => value || '—';
const dateValue = () => nowText().replace(' ', 'T');

export default function AfterSalesOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [modal, setModal] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const order = state.afterSalesOrders.find((item) => item.id === orderId) as AfterSalesOrder | undefined;
  const issue = order ? state.issueRecords.find((item) => item.id === order.issueId) : undefined;
  const engineers = useMemo(() => [...new Set([state.currentUser, ...(state.users || []).map((item) => item.name || item)].filter(Boolean))], [state.currentUser, state.users]);

  if (!order) return <Page><PageHeader title="售后工单不存在" /><Btn as="link" to="/after-sales?tab=orders">返回售后工单</Btn></Page>;
  const readOnly = order.status === '已关单' || order.status === '已取消';
  const guidance = afterSalesGuidance(order);
  const replacementMaterialName = order.replacementMaterialName || '—';
  const replacementOldSn = order.replacementOldSn || order.replacementBefore || '—';
  const replacementNewSn = order.replacementNewSn || order.replacementAfter || '—';
  const replacementItems: Array<readonly [ReactNode, ReactNode]> = order.involvesReplacement
    ? [['物料名称', replacementMaterialName], ['旧物料 SN', replacementOldSn], ['新物料 SN', replacementNewSn], ['换件说明', dash(order.replacementNote)]]
    : [];
  const update = (patch: Partial<AfterSalesOrder>, action: string, notes: string) => {
    const time = nowText();
    dispatch({ type: 'UPDATE_AFTER_SALES_ORDER', payload: { ...order, ...patch, updatedAt: time, logs: [...order.logs, { id: createClientId('ASOLOG'), time, operator: state.currentUser || '当前用户', action, notes }] } });
    setModal(null);
    setMessage('');
  };
  const primary = () => {
    if (guidance.action === 'accept') return update({ status: '待上门', acceptedAt: nowText() }, '确认接单', '工单状态：待接单 → 待上门');
    if (guidance.action === 'assign') return setModal('assign');
    if (guidance.action === 'plan-visit') return setModal('plan');
    if (guidance.action === 'arrive') return setModal('arrive');
    if (guidance.action === 'handle') return setModal('handle');
    if (guidance.action === 'close') return setModal('close');
  };

  return <Page>
    <PageHeader title={order.orderNo} description="查看售后现场处理进展和来源问题。" breadcrumb={<div className="mb-1 text-xs text-gray-400"><Link className="ui-link" to="/after-sales?tab=orders">售后工单</Link> / {order.orderNo}</div>} actions={<div className="flex gap-2">{prototypeNavEnabled && <Btn as="link" to={`/mobile/after-sales/${order.id}`}>移动端查看</Btn>}<Btn as="link" to="/after-sales?tab=orders">返回售后工单</Btn></div>} />
    {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}
    <Section title="当前待办" subtitle="按当前阶段完成一个主要操作；来源问题与售后执行状态分别维护。" right={!readOnly && guidance.action !== 'none' ? <Btn variant="primary" onClick={primary}>{guidance.label}</Btn> : <StatusBadge status={order.status} />}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"><Stepper steps={STEPS} current={order.status === '已取消' ? 0 : order.status} /><div className="space-y-2 text-[13px]"><div><span className="text-gray-400">当前待办：</span><b className="text-gray-800">{guidance.task}</b></div><div><span className="text-gray-400">尚未满足：</span>{guidance.unmet.length ? guidance.unmet.join('、') : '—'}</div><div><span className="text-gray-400">下一阶段：</span>{guidance.next || '—'}</div><div><span className="text-gray-400">当前售后工程师：</span>{dash(order.engineer)}</div></div></div>
      {!readOnly && (order.status === '待分派' || order.status === '待接单') && <div className="mt-4 border-t border-gray-100 pt-3"><Btn size="sm" variant="danger" onClick={() => setModal('cancel')}>取消工单</Btn></div>}
    </Section>
    <Section title="来源问题快照" subtitle="创建售后工单时保存，不会被后续问题编辑无痕覆盖。" right={<Btn size="sm" as="link" to={`/after-sales?issue=${order.issueId}`}>查看当前问题详情</Btn>}>
      <DescList cols={3} items={[["问题编号", <Link className="ui-link font-mono text-xs" to={`/after-sales?issue=${order.issueId}`}>{order.issueNo}</Link>], ['客户名称', dash(order.snapshot.customerName)], ['项目', dash(order.snapshot.projectName)], ['设备标识', order.deviceId ? <Link className="ui-link font-mono text-xs" to={`/devices/${order.deviceId}?tab=project`}>{dash(order.snapshot.deviceIdentifier)}</Link> : dash(order.snapshot.deviceIdentifier)], ['来源交付任务', order.sourceSubOrderId && order.deliveryPlanId ? <Link className="ui-link text-xs" to={`/delivery-plans/${order.deliveryPlanId}/sub-orders/${order.sourceSubOrderId}`}>查看来源交付任务</Link> : '—'], ['故障现象描述', dash(order.snapshot.symptom)], ['已做排查动作', dash(order.snapshot.siteTroubleshooting)], ['临时解决方案 / 现场处理建议', dash(order.snapshot.temporarySolution)], ['根因分析', dash(order.snapshot.rootCause)], ['长期问题解决方案', dash(order.snapshot.longTermSolution)], ['技术客服处理判断', technicalSupportDecisionLabel(order.snapshot.technicalSupport?.decision)], ['判断说明', dash(order.snapshot.technicalSupport?.note)], ['判断人', dash(order.snapshot.technicalSupport?.handler)], ['判断时间', dash(order.snapshot.technicalSupport?.handledAt)], ['来源资料', <AttachmentList items={order.snapshot.attachments} empty="暂无来源资料。" />]]} />
      <div className="mt-4 border-t border-gray-100 pt-3"><p className="mb-3 text-xs font-medium text-gray-700">技术客服建议故障分类</p><DescList cols={3} items={[["一级故障原因分类", dash(order.snapshot.causeLevel1)], ['二级故障原因分类', dash(order.snapshot.causeLevel2)], ['三级故障分类', dash(order.snapshot.causeLevel3)]]} /></div>
    </Section>
    <Section title="分派与上门安排">
      <DescList cols={3} items={[["分派人", dash(order.assignedBy)], ['售后工程师', dash(order.engineer)], ['分派时间', dash(order.assignedAt)], ['接单时间', dash(order.acceptedAt)], ['预计上门时间', dash(order.plannedVisitAt)], ['实际上门时间', dash(order.actualVisitAt)], ['上门说明', dash(order.visitNote)]]} />
    </Section>
    <Section title="现场处理" subtitle="现场工程师填写的实际处理事实，不覆盖来源问题快照。" right={!readOnly && order.status === '现场处理中' ? <div className="flex gap-2"><Btn size="sm" onClick={() => setModal('material')}>补充资料</Btn><Btn size="sm" onClick={() => setModal('handle')}>记录现场处理</Btn></div> : undefined}>
      <DescList cols={2} items={[["现场处理说明", dash(order.onsiteHandling)], ['实际故障原因', dash(order.actualCause)], ['实际处理方案', dash(order.actualSolution)], ['最终处理结果', dash(order.finalResult)], ['是否涉及换件', order.involvesReplacement ? '是' : '否'], ...replacementItems]} />
      <div className="mt-4 border-t border-gray-100 pt-3"><p className="mb-2 text-xs text-gray-400">现场资料（暂不上传真实文件）</p><AttachmentList items={order.materials} empty="暂无现场资料。" /></div>
    </Section>
    <Section title="关单信息"><DescList cols={3} items={[["关单人", dash(order.closedBy)], ['关单时间', dash(order.closedAt)], ['关单说明', dash(order.closeNote)], ['取消人', dash(order.cancelledBy)], ['取消时间', dash(order.cancelledAt)], ['取消原因', dash(order.cancelReason)]]} /></Section>
    <Section title={`操作日志（${order.logs.length}）`} bodyClassName="p-0"><Table head={['时间', '操作人', '操作内容', '说明']} empty="暂无售后操作日志">{order.logs.slice().reverse().map((log) => <tr key={log.id}><td className="px-3 py-2 text-xs text-gray-500">{log.time}</td><td className="px-3 py-2">{log.operator}</td><td className="px-3 py-2">{log.action}</td><td className="px-3 py-2 text-xs text-gray-600">{log.notes}</td></tr>)}</Table></Section>
    <AssignModal isOpen={modal === 'assign'} engineers={engineers} onClose={() => setModal(null)} onSave={(engineer) => update({ status: '待接单', engineer, assignedBy: state.currentUser || '当前用户', assignedAt: nowText() }, '分派售后工程师', `售后工程师：未分派 → ${engineer}；工单状态：待分派 → 待接单`)} />
    <PlanModal isOpen={modal === 'plan'} onClose={() => setModal(null)} onSave={(plannedVisitAt, visitNote) => update({ plannedVisitAt: plannedVisitAt.replace('T', ' '), visitNote }, '设置预计上门时间', `预计上门时间：— → ${plannedVisitAt.replace('T', ' ')}`)} />
    <ArriveModal isOpen={modal === 'arrive'} onClose={() => setModal(null)} onSave={(actualVisitAt, visitNote) => update({ status: '现场处理中', actualVisitAt: actualVisitAt.replace('T', ' '), visitNote: visitNote || order.visitNote }, '确认已到现场', `工单状态：待上门 → 现场处理中；实际上门时间：${actualVisitAt.replace('T', ' ')}`)} />
    <HandleModal isOpen={modal === 'handle'} order={order} onClose={() => setModal(null)} onSave={(values) => {
      const { causeLevel1, causeLevel2, causeLevel3, ...handling } = values;
      const classificationChanged = Boolean(issue) && (issue.causeLevel1 !== causeLevel1 || issue.causeLevel2 !== causeLevel2 || issue.causeLevel3 !== causeLevel3);
      update(handling, classificationChanged ? '售后现场处理更新故障分类' : handling.involvesReplacement ? '记录现场换件信息' : '记录现场处理', classificationChanged ? '已更新现场处理信息，并将最终故障分类同步至来源问题。' : handling.involvesReplacement ? `已更新现场处理信息；物料名称：${handling.replacementMaterialName}；旧物料 SN：${handling.replacementOldSn}；新物料 SN：${handling.replacementNewSn}${handling.replacementNote ? `；换件说明：${handling.replacementNote}` : ''}` : '已更新现场处理说明、实际处理方案和最终处理结果');
      if (issue && classificationChanged) {
        const time = nowText();
        dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: { ...issue, causeLevel1, causeLevel2, causeLevel3, activityLogs: [...(issue.activityLogs || []), { id: createClientId('ISSUELOG'), time, operator: state.currentUser || '当前用户', action: '售后现场处理更新故障分类', notes: `一级：${dash(issue.causeLevel1)} → ${dash(causeLevel1)}；二级：${dash(issue.causeLevel2)} → ${dash(causeLevel2)}；三级：${dash(issue.causeLevel3)} → ${dash(causeLevel3)}` }] } });
      }
    }} />
    <MaterialModal isOpen={modal === 'material'} onClose={() => setModal(null)} onSave={(material) => update({ materials: [...order.materials, material] }, '补充现场资料', `已添加现场资料：${material.name}`)} />
    <CloseModal isOpen={modal === 'close'} order={order} onClose={() => setModal(null)} onSave={(closeNote, material) => { const materials = material ? [...order.materials, material] : order.materials; const missing = afterSalesCloseReasons({ ...order, closeNote, materials }); if (missing.length) return setMessage(`暂不能关单，缺少：${missing.join('、')}。`); const closedAt = nowText(); update({ status: '已关单', closeNote, closedBy: state.currentUser || '当前用户', closedAt, materials }, '完成并关单', '工单状态：现场处理中 → 已关单；售后现场处理已完成。'); }} />
    <CancelModal isOpen={modal === 'cancel'} onClose={() => setModal(null)} onSave={(reason) => update({ status: '已取消', cancelledBy: state.currentUser || '当前用户', cancelledAt: nowText(), cancelReason: reason }, '取消售后工单', `工单状态：${order.status} → 已取消；取消原因：${reason}`)} />
  </Page>;
}

function FormModal({ isOpen, onClose, title, children }: any) { return <Modal isOpen={isOpen} onClose={onClose} title={title}><div className="space-y-4">{children}</div></Modal>; }
function Field({ label, required, children }: any) { return <label className="block space-y-1"><span className="text-xs text-gray-600">{label}{required && <b className="ml-1 text-red-500">*</b>}</span>{children}</label>; }
function Textarea(props: any) { return <textarea {...props} className="ui-input min-h-20 resize-y" />; }

function AssignModal({ isOpen, onClose, onSave, engineers }: any) { const [engineer, setEngineer] = useState(''); return <FormModal isOpen={isOpen} onClose={onClose} title="分派售后工程师"><p className="text-xs text-gray-500">分派后工单将进入“待接单”，由售后工程师确认接单。</p><Field label="售后工程师" required><Select value={engineer} onChange={(event) => setEngineer(event.target.value)}><option value="">请选择售后工程师</option>{engineers.map((item) => <option key={item}>{item}</option>)}</Select></Field><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!engineer} onClick={() => onSave(engineer)}>确认分派</Btn></div></FormModal>; }
function PlanModal({ isOpen, onClose, onSave }: any) { const [planned, setPlanned] = useState(''); const [note, setNote] = useState(''); return <FormModal isOpen={isOpen} onClose={onClose} title="设置预计上门时间"><p className="text-xs text-gray-500">保存后工单仍处于“待上门”，可在工程师到场后确认实际上门时间。</p><Field label="预计上门时间" required><Input type="datetime-local" value={planned} onChange={(event) => setPlanned(event.target.value)} /></Field><Field label="上门说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!planned} onClick={() => onSave(planned, note)}>保存上门安排</Btn></div></FormModal>; }
function ArriveModal({ isOpen, onClose, onSave }: any) { const [actual, setActual] = useState(dateValue()); const [note, setNote] = useState(''); return <FormModal isOpen={isOpen} onClose={onClose} title="确认已到现场"><p className="text-xs text-gray-500">确认后工单进入“现场处理中”，可以记录实际处理过程和资料。</p><Field label="实际上门时间" required><Input type="datetime-local" value={actual} onChange={(event) => setActual(event.target.value)} /></Field><Field label="上门说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!actual} onClick={() => onSave(actual, note)}>确认已到现场</Btn></div></FormModal>; }
function HandleModal({ isOpen, onClose, onSave, order }: any) {
  const [values, setValues] = useState({
    onsiteHandling: order?.onsiteHandling || '', actualCause: order?.actualCause || '', actualSolution: order?.actualSolution || '', finalResult: order?.finalResult || '',
    involvesReplacement: Boolean(order?.involvesReplacement), replacementMaterialName: order?.replacementMaterialName || '', replacementOldSn: order?.replacementOldSn || order?.replacementBefore || '', replacementNewSn: order?.replacementNewSn || order?.replacementAfter || '', replacementNote: order?.replacementNote || '',
    causeLevel1: order?.snapshot.causeLevel1 || '', causeLevel2: order?.snapshot.causeLevel2 || '', causeLevel3: order?.snapshot.causeLevel3 || '',
  });
  const set = (key: string, value: string | boolean) => setValues((previous) => ({ ...previous, [key]: value }));
  const setReplacement = (involvesReplacement: boolean) => setValues((previous) => ({ ...previous, involvesReplacement, ...(involvesReplacement ? {} : { replacementMaterialName: '', replacementOldSn: '', replacementNewSn: '', replacementNote: '' }) }));
  const replacementMissing = values.involvesReplacement && (!values.replacementMaterialName.trim() || !values.replacementOldSn.trim() || !values.replacementNewSn.trim());
  return <FormModal isOpen={isOpen} onClose={onClose} title="记录现场处理"><p className="text-xs text-gray-500">保存后更新本售后工单的现场处理事实；最终故障分类将同步至来源问题。</p><Field label="现场处理说明" required><Textarea value={values.onsiteHandling} onChange={(event) => set('onsiteHandling', event.target.value)} /></Field><Field label="实际故障原因"><Textarea value={values.actualCause} onChange={(event) => set('actualCause', event.target.value)} /></Field><Field label="实际处理方案" required><Textarea value={values.actualSolution} onChange={(event) => set('actualSolution', event.target.value)} /></Field><Field label="最终处理结果" required><Textarea value={values.finalResult} onChange={(event) => set('finalResult', event.target.value)} /></Field><div className="space-y-3 rounded-md border border-gray-200 p-3"><p className="text-xs font-medium text-gray-700">最终故障分类</p><div className="grid gap-3 sm:grid-cols-3"><CategorySelect label="一级故障原因分类" value={values.causeLevel1} options={ISSUE_CAUSE_LEVEL_1} onChange={(value: string) => set('causeLevel1', value)} /><CategorySelect label="二级故障原因分类" value={values.causeLevel2} options={ISSUE_CAUSE_LEVEL_2} onChange={(value: string) => set('causeLevel2', value)} /><CategorySelect label="三级故障分类" value={values.causeLevel3} options={ISSUE_CAUSE_LEVEL_3} onChange={(value: string) => set('causeLevel3', value)} /></div></div><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={values.involvesReplacement} onChange={(event) => setReplacement(event.target.checked)} />涉及换件 <span className="text-xs text-gray-400">仅记录本次现场换件事实，不修改设备身份或 ERP。</span></label>{values.involvesReplacement && <div className="space-y-3 rounded-md border border-gray-200 p-3"><Field label="物料名称" required><Input value={values.replacementMaterialName} onChange={(event) => set('replacementMaterialName', event.target.value)} /></Field><Field label="旧物料 SN" required><Input value={values.replacementOldSn} onChange={(event) => set('replacementOldSn', event.target.value)} /></Field><Field label="新物料 SN" required><Input value={values.replacementNewSn} onChange={(event) => set('replacementNewSn', event.target.value)} /></Field><Field label="换件说明"><Textarea value={values.replacementNote} onChange={(event) => set('replacementNote', event.target.value)} placeholder="例如：左机械臂更换。" /></Field></div>}<div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!values.onsiteHandling.trim() || !values.actualSolution.trim() || !values.finalResult.trim() || replacementMissing} onClick={() => onSave(values)}>保存现场处理</Btn></div></FormModal>;
}
function MaterialModal({ isOpen, onClose, onSave }: any) { const [name, setName] = useState(''); const [purpose, setPurpose] = useState('处理结果证明'); const [note, setNote] = useState(''); return <FormModal isOpen={isOpen} onClose={onClose} title="补充现场资料"><p className="text-xs text-gray-500">资料记录（暂不上传真实文件）。</p><AttachmentUpload value={name} onChange={setName} label="附件" required /><Field label="资料用途" required><Input value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field><Field label="备注"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!name.trim() || !purpose.trim()} onClick={() => onSave({ id: createClientId('ASOMAT'), name: name.trim(), purpose: purpose.trim(), addedBy: '当前用户', addedAt: nowText(), note: note.trim() })}>保存资料记录</Btn></div></FormModal>; }
function CloseModal({ isOpen, onClose, onSave, order }: any) {
  const [note, setNote] = useState('');
  const [proof, setProof] = useState('');
  const material = proof.trim() ? { id: createClientId('ASOMAT'), name: proof.trim(), purpose: '正常工作视频或处理结果证明', addedBy: '当前用户', addedAt: nowText() } : undefined;
  const missing = afterSalesCloseReasons({ ...order, closeNote: note, materials: material ? [...order.materials, material] : order.materials });
  return <FormModal isOpen={isOpen} onClose={onClose} title="完成并关单"><p className="text-xs text-gray-500">关单后工单只读，记录本次售后现场处理完成；来源问题可继续进行质量跟进。</p><Field label="关单说明" required><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><AttachmentUpload value={proof} onChange={setProof} label="正常工作视频或处理结果证明资料" required />{missing.length > 0 && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">尚未满足：{missing.join('、')}</p>}<div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={missing.length > 0} onClick={() => onSave(note, material)}>确认完成并关单</Btn></div></FormModal>;
}
function CancelModal({ isOpen, onClose, onSave }: any) { const [reason, setReason] = useState(''); return <FormModal isOpen={isOpen} onClose={onClose} title="取消售后工单"><p className="text-xs text-gray-500">取消后工单只读，不会自动关闭或闭环来源问题。</p><Field label="取消原因" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={onClose}>返回</Btn><Btn variant="danger" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>确认取消工单</Btn></div></FormModal>; }
