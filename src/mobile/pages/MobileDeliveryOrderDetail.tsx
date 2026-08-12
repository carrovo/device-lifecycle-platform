import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AttachmentList, AttachmentUpload } from '../../components/AttachmentUpload';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { useApp } from '../../context/AppContext';
import { createClientId } from '../../data/clientId';
import { nowText } from '../../data/dateTime';
import {
  acceptanceProgress,
  deploymentCompletionReasons,
  hasTaskExecutionBlock,
  installationProgress,
  preparationReady,
  requiredExecutionRemaining,
  subOrderNodeLabel,
  subOrderTypeLabel,
  type DeliverySubOrder,
  type ReviewMaterial,
} from '../../data/deliverySubOrders';

function MobileFrame({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh w-full bg-[#f5f5f5] sm:mx-auto sm:max-w-[430px] sm:border-x sm:border-gray-200">{children}</main>;
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-gray-900">{title}</h2>{action}</div>{children}</section>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-gray-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 ${props.className || ''}`} />;
}

function DetailRows({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="divide-y divide-gray-100">{items.map(([label, value]) => <div key={label} className="grid grid-cols-[96px_1fr] gap-3 py-2.5 text-sm"><dt className="text-xs text-gray-400">{label}</dt><dd className="min-w-0 break-words text-gray-700">{value}</dd></div>)}</dl>;
}

function Feedback({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{children}</p>;
}

type ModalState =
  | { type: 'accept' }
  | { type: 'arrival' }
  | { type: 'check'; key: string }
  | { type: 'execution'; key: string }
  | { type: 'block' }
  | { type: 'block-progress'; blockId: string }
  | { type: 'block-resolve'; blockId: string }
  | { type: 'complete' }
  | null;

type DeliveryMobileReferences = {
  devices: Array<{ id: string; sn?: string; robotNo?: string; model?: string; deviceTypeId?: string }>;
  deviceTypes: Array<{ id: string; name?: string }>;
};

export default function MobileDeliveryOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const subOrder = state.deliverySubOrders.find((item: DeliverySubOrder) => item.id === id) as DeliverySubOrder | undefined;
  const [modal, setModal] = useState<ModalState>(null);
  const [feedback, setFeedback] = useState('');

  if (!subOrder) return <MobileFrame><div className="p-5"><button type="button" onClick={() => navigate('/mobile/tasks?tab=delivery')} className="text-sm text-gray-500">返回我的任务</button><div className="mt-10 rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">交付子工单不存在或已不可访问。</div></div></MobileFrame>;

  const plan = state.deliveryPlans.find((item: { id: string }) => item.id === subOrder.deliveryPlanId);
  const project = state.projects.find((item: { id: string }) => item.id === plan?.projectId);
  const location = state.locations.find((item: { id: string }) => item.id === subOrder.locationId);
  const operator = state.currentUser || subOrder.engineer || subOrder.owner || subOrder.contact || '当前用户';
  const blocked = hasTaskExecutionBlock(subOrder);
  const readOnly = subOrder.status === '已完成';
  const checked = subOrder.checks.filter((item) => item.status === '已完成').length;
  const executableItems = subOrder.executionItems.filter((item) => item.requirement !== 'not-applicable');
  const completedItems = executableItems.filter((item) => item.status === '已完成').length;
  const unresolvedBlocks = subOrder.blocks.filter((item) => item.status !== '已解除');
  const installationDone = installationProgress(subOrder);
  const accepted = acceptanceProgress(subOrder);
  const completionReasons = subOrder.type === 'preparation'
    ? [
        ...(subOrder.checks.filter((item) => item.required && item.status !== '已完成').length ? [`还有 ${subOrder.checks.filter((item) => item.required && item.status !== '已完成').length} 项前置检查未完成`] : []),
        ...(blocked ? [`当前存在 ${subOrder.blocks.filter((item) => item.status !== '已解除' && item.pausesTask).length} 个未解除交付阻塞`] : []),
      ]
    : deploymentCompletionReasons(subOrder);

  const commit = (transform: (order: DeliverySubOrder, time: string) => DeliverySubOrder, action: string, notes: string, success: string) => {
    const time = nowText();
    const next = transform(subOrder, time);
    dispatch({ type: 'UPDATE_DELIVERY_SUB_ORDER', payload: { ...next, updatedAt: time, logs: [...(next.logs || []), { id: createClientId('DSOLOG'), operator, time, action, notes }] } });
    setModal(null);
    setFeedback(`${success} · ${time.slice(11)}`);
  };

  const material = (name: string, purpose: string, note = ''): ReviewMaterial => ({ id: createClientId('DSOMAT'), name, purpose, uploadedBy: operator, uploadedAt: nowText(), note });

  const beginPreparation = () => commit((order, time) => {
    const first = order.checks.find((item) => item.status !== '已完成');
    return { ...order, status: '进行中', currentNode: first?.key || order.currentNode, startedAt: order.startedAt || time, checks: order.checks.map((item, index) => index === 0 && item.status === '未开始' ? { ...item, status: '进行中' } : item) };
  }, '开始前置准备', '工单状态：未开始 → 进行中', '前置准备已开始');

  const acceptDeployment = () => commit((order, time) => ({ ...order, status: '待上门', currentNode: 'arrival', acceptedAt: time }), '执行工程师接单', '工单状态：待接单 → 待上门', '接单成功，下一步确认已到现场');
  const confirmArrival = () => commit((order, time) => ({ ...order, status: '执行中', currentNode: requiredExecutionRemaining(order)[0]?.key || 'device-installation', actualVisitTime: time, startedAt: time }), '确认已到现场', '工单状态：待上门 → 执行中', '已确认到场');

  const completeOrder = (note: string) => commit((order, time) => ({ ...order, status: '已完成', currentNode: 'completed', completedAt: time, completionNote: note.trim() }), subOrder.type === 'preparation' ? '完成前置子工单' : '完成部署子工单', note.trim() || '完成现场任务', subOrder.type === 'preparation' ? '前置任务已完成' : '部署子工单已完成');

  const currentCheck = modal?.type === 'check' ? subOrder.checks.find((item) => item.key === modal.key) : undefined;
  const currentExecution = modal?.type === 'execution' ? subOrder.executionItems.find((item) => item.key === modal.key) : undefined;
  const selectedBlock = (modal?.type === 'block-progress' || modal?.type === 'block-resolve') ? subOrder.blocks.find((item) => item.id === modal.blockId) : undefined;

  return <MobileFrame>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3"><button type="button" aria-label="返回我的任务" onClick={() => navigate('/mobile/tasks?tab=delivery')} className="grid h-9 w-9 place-items-center rounded-md text-lg text-gray-600 hover:bg-gray-100">‹</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{subOrder.name}</p><p className="mt-0.5 text-xs text-gray-400">{subOrderTypeLabel(subOrder.type)}</p></div>{import.meta.env.DEV && <Link to={`/delivery-plans/${subOrder.deliveryPlanId}/sub-orders/${subOrder.id}`} className="shrink-0 text-xs text-gray-500 underline underline-offset-2">PC端预览</Link>}<StatusBadge status={subOrder.status} /></header>
    <div className="space-y-3 p-4 pb-28">
      {feedback && <Feedback>{feedback}</Feedback>}
      <Section title="任务信息"><DetailRows items={[["项目", project?.name || '—'], ['点位', location?.name || '—'], [subOrder.type === 'deployment' ? '执行工程师' : '当前负责人', subOrder.type === 'deployment' ? subOrder.engineer || '尚未分派' : subOrder.owner || '—'], ['计划时间', subOrder.plannedTime?.replace('T', ' ') || '—'], ['任务说明', subOrder.notes || '—']]} /></Section>
      <Section title="当前进度"><div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">当前节点</p><p className="mt-1 text-sm font-medium text-gray-800">{subOrderNodeLabel(subOrder)}</p></div><div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">未解除阻塞</p><p className="mt-1 text-sm font-medium text-gray-800">{unresolvedBlocks.length}</p></div>{subOrder.type === 'preparation' ? <div className="col-span-2 rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">前置检查</p><p className="mt-1 text-sm font-medium text-gray-800">{checked} / {subOrder.checks.length}</p></div> : <><div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">现场任务</p><p className="mt-1 text-sm font-medium text-gray-800">{completedItems} / {executableItems.length}</p></div><div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">设备安装</p><p className="mt-1 text-sm font-medium text-gray-800">{installationDone} / {subOrder.devices.length}</p></div><div className="col-span-2 rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-400">设备验收</p><p className="mt-1 text-sm font-medium text-gray-800">{accepted} / {subOrder.devices.length}</p></div></>}</div></Section>
      {subOrder.type === 'preparation'
        ? <PreparationContent subOrder={subOrder} readOnly={readOnly} blocked={blocked} feedback={feedback} onCheck={(key) => setModal({ type: 'check', key })} onBlock={() => setModal({ type: 'block' })} onProgress={(blockId) => setModal({ type: 'block-progress', blockId })} onResolve={(blockId) => setModal({ type: 'block-resolve', blockId })} />
        : <DeploymentContent subOrder={subOrder} readOnly={readOnly} blocked={blocked} state={state} onExecution={(key) => setModal({ type: 'execution', key })} onBlock={() => setModal({ type: 'block' })} onProgress={(blockId) => setModal({ type: 'block-progress', blockId })} onResolve={(blockId) => setModal({ type: 'block-resolve', blockId })} />}
      {subOrder.status === '已完成' && <Section title="完成信息"><DetailRows items={[["完成时间", subOrder.completedAt || '—'], ['完成说明', subOrder.completionNote || '—'], ['完成人', operator]]} /></Section>}
    </div>
    {!readOnly && subOrder.type === 'preparation' && subOrder.status === '未开始' && <FooterButton onClick={beginPreparation}>开始前置准备</FooterButton>}
    {!readOnly && subOrder.type === 'preparation' && subOrder.status === '进行中' && <CompletionFooter disabled={!preparationReady(subOrder)} reasons={completionReasons} label="完成前置任务" onClick={() => setModal({ type: 'complete' })} />}
    {!readOnly && subOrder.type === 'deployment' && subOrder.status === '待接单' && <FooterButton onClick={() => setModal({ type: 'accept' })}>确认接单</FooterButton>}
    {!readOnly && subOrder.type === 'deployment' && subOrder.status === '待上门' && <FooterButton onClick={() => setModal({ type: 'arrival' })}>确认已到现场</FooterButton>}
    {!readOnly && subOrder.type === 'deployment' && ['执行中', '待设备验收'].includes(subOrder.status) && <CompletionFooter disabled={completionReasons.length > 0} reasons={completionReasons} label="完成部署子工单" onClick={() => setModal({ type: 'complete' })} />}

    <ConfirmModal isOpen={modal?.type === 'accept'} title="确认接单" description="确认接单后，工单将进入待上门。" operator={operator} timeLabel="接单时间由系统自动记录" confirmLabel="确认接单" onClose={() => setModal(null)} onConfirm={acceptDeployment} />
    <ConfirmModal isOpen={modal?.type === 'arrival'} title="确认已到现场" description="确认后将开始记录现场任务执行结果。" operator={operator} timeLabel="到场时间由系统自动记录" confirmLabel="确认已到现场" onClose={() => setModal(null)} onConfirm={confirmArrival} />
    {currentCheck && <CheckModal check={currentCheck} operator={operator} onClose={() => setModal(null)} onSave={(result, note, attachment) => {
      if (result === 'complete') commit((order, time) => {
        let passedCurrent = false;
        const checks = order.checks.map((item) => {
          if (item.key === currentCheck.key) { passedCurrent = true; return { ...item, status: '已完成', completedAt: time, note: note.trim(), materials: attachment ? [...item.materials, material(attachment, '现场资料', note.trim())] : item.materials }; }
          if (passedCurrent && item.status === '未开始') { passedCurrent = false; return { ...item, status: '进行中' }; }
          return item;
        });
        return { ...order, checks, currentNode: checks.find((item) => item.status !== '已完成')?.key || 'preparation-complete' };
      }, '完成前置检查', currentCheck.label, `“${currentCheck.label}”已完成`);
      else commit((order) => ({ ...order, checks: order.checks.map((item) => item.key === currentCheck.key ? { ...item, note: note.trim(), materials: attachment ? [...item.materials, material(attachment, '现场资料', note.trim())] : item.materials } : item) }), '更新前置检查', currentCheck.label, '检查结果已保存');
    }} />}
    {currentExecution && <ExecutionModal item={currentExecution} operator={operator} onClose={() => setModal(null)} onSave={(note, attachment) => commit((order, time) => {
      const executionItems = order.executionItems.map((item) => item.key === currentExecution.key ? { ...item, status: '已完成', completedAt: time, note: note.trim(), materials: attachment ? [...item.materials, material(attachment, '现场资料', note.trim())] : item.materials } : item);
      return { ...order, executionItems, currentNode: executionItems.find((item) => item.requirement === 'required' && item.status !== '已完成')?.key || 'device-installation' };
    }, '记录公共执行结果', currentExecution.label, `“${currentExecution.label}”执行结果已保存`)} />}
    {modal?.type === 'block' && <BlockModal operator={operator} onClose={() => setModal(null)} onSave={(reason, owner, pausesTask, attachment) => commit((order, time) => {
      const enteringBlocked = pausesTask && !hasTaskExecutionBlock(order);
      const node = order.status === '阻塞' ? order.previousNode || order.currentNode : order.currentNode;
      return { ...order, previousStatus: enteringBlocked ? order.status : order.previousStatus, previousNode: enteringBlocked ? order.currentNode : order.previousNode, status: pausesTask ? '阻塞' : order.status, currentNode: pausesTask ? 'blocked' : order.currentNode, blocks: [...order.blocks, { id: createClientId('DSOBLK'), node, nodeLabel: subOrderNodeLabel(order), reason, owner, pausesTask, status: '处理中', createdAt: time, updatedAt: time, progress: [], materials: attachment ? [material(attachment, '现场资料')] : [] }] };
    }, '登记交付阻塞', reason, pausesTask ? '交付阻塞已登记，任务已暂停' : '交付阻塞已登记')} />}
    {selectedBlock && <BlockProgressModal block={selectedBlock} resolve={modal?.type === 'block-resolve'} operator={operator} onClose={() => setModal(null)} onSave={(note, attachment) => {
      const resolve = modal?.type === 'block-resolve';
      commit((order, time) => {
        const blocks = order.blocks.map((item) => item.id === selectedBlock.id ? { ...item, status: resolve ? '已解除' : item.status, updatedAt: time, resolvedAt: resolve ? time : item.resolvedAt, resolvedBy: resolve ? operator : item.resolvedBy, resolution: resolve ? note.trim() : item.resolution, progress: resolve ? item.progress : [...item.progress, { id: createClientId('DSOBP'), content: note.trim(), operator, time }], materials: attachment ? [...item.materials, material(attachment, resolve ? '解决资料' : '处理资料', note.trim())] : item.materials } : item);
        const remaining = blocks.filter((item) => item.status !== '已解除' && item.pausesTask).length;
        const restore = resolve && order.status === '阻塞' && remaining === 0;
        return { ...order, blocks, status: restore ? (order.previousStatus || (order.type === 'preparation' ? '进行中' : '执行中')) : order.status, currentNode: restore ? (order.previousNode || selectedBlock.node) : order.currentNode, previousStatus: restore ? undefined : order.previousStatus, previousNode: restore ? undefined : order.previousNode };
      }, resolve ? '标记交付阻塞已解决' : '更新阻塞处理进展', note.trim(), resolve ? '交付阻塞已解除' : '阻塞处理进展已保存');
    }} />}
    {modal?.type === 'complete' && <CompleteModal title={subOrder.type === 'preparation' ? '完成前置任务' : '完成部署子工单'} onClose={() => setModal(null)} onConfirm={completeOrder} />}
  </MobileFrame>;
}

function FooterButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <footer className="fixed bottom-0 left-0 right-0 z-10 mx-auto w-full border-t border-gray-200 bg-white p-3 sm:max-w-[430px]"><button type="button" onClick={onClick} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white">{children}</button></footer>;
}

function CompletionFooter({ disabled, reasons, label, onClick }: { disabled: boolean; reasons: string[]; label: string; onClick: () => void }) {
  return <footer className="fixed bottom-0 left-0 right-0 z-10 mx-auto w-full border-t border-gray-200 bg-white p-3 sm:max-w-[430px]">{disabled && <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">暂不能完成：{reasons.join('；')}。</p>}<button type="button" disabled={disabled} onClick={onClick} className="min-h-12 w-full rounded-md bg-gray-900 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300">{label}</button></footer>;
}

function PreparationContent({ subOrder, readOnly, blocked, feedback, onCheck, onBlock, onProgress, onResolve }: { subOrder: DeliverySubOrder; readOnly: boolean; blocked: boolean; feedback: string; onCheck: (key: string) => void; onBlock: () => void; onProgress: (id: string) => void; onResolve: (id: string) => void }) {
  return <><Section title="前置检查" action={<span className="text-xs text-gray-400">{subOrder.checks.filter((item) => item.status === '已完成').length} / {subOrder.checks.length}</span>}><div className="space-y-2">{subOrder.checks.map((check) => {
    const editable = !readOnly && !blocked && subOrder.status === '进行中' && subOrder.currentNode === check.key;
    return <button type="button" key={check.key} disabled={!editable} onClick={() => onCheck(check.key)} className="w-full rounded-md border border-gray-200 p-3 text-left disabled:cursor-default disabled:opacity-70"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-700">{check.label}</span><StatusBadge status={check.status} /></div>{check.note && <p className="mt-2 text-xs leading-5 text-gray-500">{check.note}</p>}{check.completedAt && <p className="mt-2 text-[11px] text-gray-400">完成时间：{check.completedAt}</p>}{check.materials.length > 0 && <p className="mt-2 text-[11px] text-gray-400">现场资料：{check.materials.length} 份</p>}</button>;
  })}</div>{feedback.includes('检查') && <Feedback>{feedback}</Feedback>}<p className="mt-3 text-xs leading-5 text-gray-400">检查暂未完成不会自动生成交付阻塞；仅在影响任务继续推进时单独记录阻塞。</p></Section><BlockSection subOrder={subOrder} readOnly={readOnly} onBlock={onBlock} onProgress={onProgress} onResolve={onResolve} /></>;
}

function DeploymentContent({ subOrder, readOnly, blocked, state, onExecution, onBlock, onProgress, onResolve }: { subOrder: DeliverySubOrder; readOnly: boolean; blocked: boolean; state: DeliveryMobileReferences; onExecution: (key: string) => void; onBlock: () => void; onProgress: (id: string) => void; onResolve: (id: string) => void }) {
  const executable = subOrder.status === '执行中' && !blocked && !readOnly;
  return <><Section title="现场任务" action={<span className="text-xs text-gray-400">{subOrder.executionItems.filter((item) => item.status === '已完成').length} / {subOrder.executionItems.filter((item) => item.requirement !== 'not-applicable').length}</span>}><div className="space-y-2">{subOrder.executionItems.map((item) => {
    const editable = executable && item.requirement !== 'not-applicable' && item.status !== '已完成';
    const requirement = item.requirement === 'required' ? '必填' : item.requirement === 'optional' ? '选填' : '不适用';
    return <button type="button" key={item.key} disabled={!editable} onClick={() => onExecution(item.key)} className="w-full rounded-md border border-gray-200 p-3 text-left disabled:cursor-default disabled:opacity-70"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-gray-700">{item.label}</span><div className="flex items-center gap-2"><span className="text-[11px] text-gray-400">{requirement}</span><StatusBadge status={item.status} /></div></div>{item.note && <p className="mt-2 text-xs leading-5 text-gray-500">{item.note}</p>}{item.completedAt && <p className="mt-2 text-[11px] text-gray-400">执行时间：{item.completedAt}</p>}</button>;
  })}</div>{subOrder.status === '待分派' && <p className="mt-3 text-xs text-gray-400">等待分派后由现场工程师接单执行。</p>}{subOrder.status === '待接单' && <p className="mt-3 text-xs text-gray-400">确认接单并到场后，可记录现场任务。</p>}{subOrder.status === '待上门' && <p className="mt-3 text-xs text-gray-400">确认已到现场后，可记录现场任务。</p>}</Section><Section title="设备执行总览"><div className="space-y-2">{subOrder.devices.length ? subOrder.devices.map((record) => {
    const device = state.devices.find((item) => item.id === record.deviceId);
    const type = state.deviceTypes.find((item) => item.id === device?.deviceTypeId);
    const issues = (subOrder.issueLinks || []).filter((link) => link.deviceId === record.deviceId).length;
    return <Link to={`/mobile/delivery/${subOrder.id}/device/${record.deviceId}`} key={record.id} className="block rounded-md border border-gray-200 p-3 transition-colors hover:border-gray-300"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium text-gray-700">{device?.sn || '—'}</p><p className="mt-1 text-xs text-gray-400">{device?.robotNo || '—'}{type?.name || device?.model ? ` · ${type?.name || device?.model}` : ''}</p></div><span className="text-xs text-gray-500">问题：{issues} ›</span></div><p className="mt-3 text-xs text-gray-600">安装调试：{record.installationStatus || '未开始'} · 验收：{record.acceptanceResult || '未记录'}</p></Link>;
  }) : <p className="text-sm text-gray-400">暂无关联设备。</p>}</div></Section><BlockSection subOrder={subOrder} readOnly={readOnly} onBlock={onBlock} onProgress={onProgress} onResolve={onResolve} /></>;
}

function BlockSection({ subOrder, readOnly, onBlock, onProgress, onResolve }: { subOrder: DeliverySubOrder; readOnly: boolean; onBlock: () => void; onProgress: (id: string) => void; onResolve: (id: string) => void }) {
  return <Section title="交付阻塞" action={!readOnly ? <button type="button" onClick={onBlock} className="text-xs font-medium text-gray-700 underline underline-offset-2">记录交付阻塞</button> : undefined}><div className="space-y-3">{subOrder.blocks.length ? [...subOrder.blocks].reverse().map((block) => <div key={block.id} className="rounded-md border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-gray-700">{block.reason}</p><p className="mt-1 text-xs text-gray-400">处理人：{block.owner || '—'} · {block.nodeLabel}</p></div><StatusBadge status={block.status} /></div>{block.progress.length > 0 && <p className="mt-2 text-xs text-gray-500">最新进展：{block.progress[block.progress.length - 1].content}</p>}{block.resolution && <p className="mt-2 text-xs text-gray-500">解决结果：{block.resolution}</p>}{block.materials.length > 0 && <p className="mt-2 text-[11px] text-gray-400">现场资料：{block.materials.length} 份</p>}{!readOnly && block.status !== '已解除' && <div className="mt-3 flex gap-2"><button type="button" onClick={() => onProgress(block.id)} className="min-h-9 flex-1 rounded-md border border-gray-300 text-xs text-gray-600">更新进展</button><button type="button" onClick={() => onResolve(block.id)} className="min-h-9 flex-1 rounded-md bg-gray-900 text-xs font-medium text-white">标记已解决</button></div>}</div>) : <p className="text-sm text-gray-400">暂无交付阻塞。</p>}</div><p className="mt-3 text-xs leading-5 text-gray-400">场地、水电、网络、物流或施工条件等影响任务推进的问题可记录为交付阻塞；设备与软件质量问题请通过问题池处理。</p></Section>;
}

function ConfirmModal({ isOpen, title, description, operator, timeLabel, confirmLabel, onClose, onConfirm }: { isOpen: boolean; title: string; description: string; operator: string; timeLabel: string; confirmLabel: string; onClose: () => void; onConfirm: () => void }) {
  return <Modal isOpen={isOpen} onClose={onClose} title={title}><div className="space-y-4"><p className="text-sm text-gray-700">{description}</p><DetailRows items={[["操作人", operator], ["操作时间", timeLabel]]} /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">{confirmLabel}</button></div></div></Modal>;
}

function CheckModal({ check, operator, onClose, onSave }: { check: DeliverySubOrder['checks'][number]; operator: string; onClose: () => void; onSave: (result: 'complete' | 'pending', note: string, attachment: string) => void }) {
  const [result, setResult] = useState<'complete' | 'pending'>('complete');
  const [note, setNote] = useState(check.note || '');
  const [attachment, setAttachment] = useState('');
  return <Modal isOpen onClose={onClose} title={check.label}><div className="space-y-4"><p className="text-xs text-gray-500">操作人：{operator}</p><div className="space-y-2"><p className="text-xs font-medium text-gray-700">检查结果</p><label className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" checked={result === 'complete'} onChange={() => setResult('complete')} />已确认完成</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" checked={result === 'pending'} onChange={() => setResult('pending')} />暂未完成</label></div><Field label="现场说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><AttachmentUpload value={attachment} onChange={setAttachment} label="现场资料" /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={() => onSave(result, note, attachment)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">保存检查结果</button></div></div></Modal>;
}

function ExecutionModal({ item, operator, onClose, onSave }: { item: DeliverySubOrder['executionItems'][number]; operator: string; onClose: () => void; onSave: (note: string, attachment: string) => void }) {
  const [note, setNote] = useState(item.note || '');
  const [attachment, setAttachment] = useState('');
  return <Modal isOpen onClose={onClose} title={`记录：${item.label}`}><div className="space-y-4"><p className="text-xs text-gray-500">操作人：{operator}</p><Field label="现场执行说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><AttachmentUpload value={attachment} onChange={setAttachment} label="现场资料" /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={() => onSave(note, attachment)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">保存执行结果</button></div></div></Modal>;
}

function BlockModal({ operator, onClose, onSave }: { operator: string; onClose: () => void; onSave: (reason: string, owner: string, pausesTask: boolean, attachment: string) => void }) {
  const [reason, setReason] = useState('');
  const [owner, setOwner] = useState(operator);
  const [pausesTask, setPausesTask] = useState(true);
  const [attachment, setAttachment] = useState('');
  return <Modal isOpen onClose={onClose} title="记录交付阻塞"><div className="space-y-4"><Field label="阻塞描述" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明影响交付推进的场地、水电、网络、物流或施工条件问题" /></Field><Field label="处理人"><Input value={owner} onChange={(event) => setOwner(event.target.value)} /></Field><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={pausesTask} onChange={(event) => setPausesTask(event.target.checked)} />暂停当前子工单</label><AttachmentUpload value={attachment} onChange={setAttachment} label="现场资料" /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" disabled={!reason.trim()} onClick={() => onSave(reason.trim(), owner.trim(), pausesTask, attachment)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white disabled:bg-gray-300">记录阻塞</button></div></div></Modal>;
}

function BlockProgressModal({ block, resolve, operator, onClose, onSave }: { block: DeliverySubOrder['blocks'][number]; resolve: boolean; operator: string; onClose: () => void; onSave: (note: string, attachment: string) => void }) {
  const [note, setNote] = useState('');
  const [attachment, setAttachment] = useState('');
  return <Modal isOpen onClose={onClose} title={resolve ? '解除交付阻塞' : '更新阻塞处理进展'}><div className="space-y-4"><p className="text-sm text-gray-700">{block.reason}</p><p className="text-xs text-gray-400">操作人：{operator}</p><Field label={resolve ? '解决结果' : '当前处理进展'} required><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><AttachmentUpload value={attachment} onChange={setAttachment} label={resolve ? '解决资料' : '补充资料'} /><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" disabled={!note.trim()} onClick={() => onSave(note, attachment)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white disabled:bg-gray-300">{resolve ? '标记已解决' : '保存处理进展'}</button></div></div></Modal>;
}

function CompleteModal({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState('');
  return <Modal isOpen onClose={onClose} title={title}><div className="space-y-4"><p className="text-sm text-gray-700">确认后当前子工单将进入已完成，只读保留现场记录。</p><Field label="完成说明"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-gray-300 text-sm text-gray-600">取消</button><button type="button" onClick={() => onConfirm(note)} className="min-h-11 flex-1 rounded-md bg-gray-900 text-sm font-medium text-white">{title}</button></div></div></Modal>;
}
