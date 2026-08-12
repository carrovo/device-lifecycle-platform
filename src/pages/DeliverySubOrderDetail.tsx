import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { Btn, DescList, Page, PageHeader, Section, StatCard, StatGrid, Table } from '../components/ui';
import { createClientId } from '../data/clientId';
import { nowText } from '../data/dateTime';
import { batchDisplayName } from '../data/deliveryV2';
import { prototypeNavEnabled } from '../config/prototypeFeatures';
import {
  acceptanceProgress, activeSubOrderBlock, canStartDeviceAcceptance, deploymentCompletionReasons, deploymentReadyToComplete, deviceAcceptancePrerequisites,
  hasTaskExecutionBlock, installationProgress, preparationReady, requiredExecutionRemaining, subOrderMaterialCount, subOrderNodeLabel, subOrderTypeLabel,
  type DeliverySubOrder, type ReviewMaterial,
} from '../data/deliverySubOrders';
import { nextIssueNo } from '../data/issuePool';
import DeliverySubOrderCreateModal from '../components/deliverySubOrders/DeliverySubOrderCreateModal';
import SubOrderPreparationPanel from '../components/deliverySubOrders/SubOrderPreparationPanel';
import SubOrderDeploymentFlow from '../components/deliverySubOrders/SubOrderDeploymentFlow';
import SubOrderDevicePanel from '../components/deliverySubOrders/SubOrderDevicePanel';
import SubOrderExceptionsPanel from '../components/deliverySubOrders/SubOrderExceptionsPanel';
import SubOrderTaskGuide from '../components/deliverySubOrders/SubOrderTaskGuide';
import {
  AcceptanceModal, AssignModal, BlockModal, BlockProgressModal, CompleteOrderModal,
  InstallationModal, MaterialModal, RecordUpdateModal,
} from '../components/deliverySubOrders/SubOrderForms';
import IssueRecordModal from '../components/issues/IssueRecordModal';

function Tabs({ active, onChange, type }) {
  const items = type === 'preparation'
    ? [['overview', '概览'], ['preparation', '前置检查'], ['exceptions', '交付阻塞'], ['logs', '操作日志']]
    : [['overview', '概览'], ['flow', '本次现场任务'], ['devices', '设备执行与验收'], ['exceptions', '异常与问题'], ['logs', '操作日志']];
  return <div className="flex flex-wrap gap-1 border-b border-gray-200">{items.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={`px-3 py-2 text-[13px] border-b-2 ${active === key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>)}</div>;
}

export default function DeliverySubOrderDetail() {
  const { planId, subOrderId } = useParams();
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<any>(null);
  const [notice, setNotice] = useState(searchParams.get('created') === '1' ? '子工单创建成功，已进入详情。请按“当前待办”继续处理。' : '');
  const plan = state.deliveryPlans.find((item) => item.id === planId);
  const subOrder: DeliverySubOrder | undefined = state.deliverySubOrders.find((item) => item.id === subOrderId && item.deliveryPlanId === planId);
  const project = state.projects.find((item) => item.id === plan?.projectId);
  const location = state.locations.find((item) => item.id === subOrder?.locationId);
  const batch = plan?.batches?.find((item) => item.id === subOrder?.batchId);
  const returnTo = searchParams.get('returnTo') || `/delivery-plans/${planId}?tab=sub-orders`;
  const defaultTab = 'overview';
  const active = searchParams.get('tab') || defaultTab;
  const setActive = (tab) => { const next = new URLSearchParams(searchParams); next.delete('created'); if (tab === defaultTab) next.delete('tab'); else next.set('tab', tab); setSearchParams(next); };

  if (!plan || !subOrder) return <Page><PageHeader title={state.projectCenterLoading ? '交付子工单加载中' : '交付子工单不存在'} actions={<Btn as="link" to={`/delivery-plans/${planId || ''}?tab=sub-orders`}>返回交付执行</Btn>} /></Page>;

  const time = () => nowText();
  const operator = state.currentUser || subOrder.engineer || subOrder.owner || subOrder.contact || '当前用户';
  const currentNodeLabel = subOrderNodeLabel(subOrder);
  const activeBlock = activeSubOrderBlock(subOrder);
  const sourcePreparation = subOrder.sourcePreparationId ? state.deliverySubOrders.find((item) => item.id === subOrder.sourcePreparationId) : undefined;
  const subOrderIssues = (subOrder.issueLinks || []).map((link) => state.issueRecords.find((item) => item.id === link.issueId)).filter(Boolean);
  const deviceOptions = subOrder.devices.map((record) => state.devices.find((item) => item.id === record.deviceId)).filter(Boolean);
  const deviceForRecord = (record) => {
    const device = state.devices.find((item) => item.id === record?.deviceId);
    return device ? { ...device, model: state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || device.model || '—' } : undefined;
  };
  const ownerOptions = [...new Set([plan.owner, project?.manager, state.currentUser, ...plan.batches.map((item) => item.owner), ...state.users.map((item) => item.name)].filter(Boolean))];
  const makeMaterial = (form): ReviewMaterial => ({ id: createClientId('DSOMAT'), name: form.name || form.materialName, purpose: form.purpose || form.materialPurpose || '现场资料', uploadedBy: operator, uploadedAt: time(), note: form.note || form.materialNote || '' });
  const commit = (transform, action, notes = '', successMessage = `${action}成功`, refs: { deviceId?: string; issueId?: string } = {}) => {
    const updatedAt = time();
    const next = transform({ ...subOrder });
    next.updatedAt = updatedAt;
    next.logs = [...(next.logs || []), { id: createClientId('DSOLOG'), operator, time: updatedAt, action, notes, ...refs }];
    dispatch({ type: 'UPDATE_DELIVERY_SUB_ORDER', payload: next });
    setModal(null);
    setNotice(successMessage);
  };

  const completeCheck = (key, form) => {
    if (subOrder.status !== '进行中' || subOrder.currentNode !== key || hasTaskExecutionBlock(subOrder)) return;
    const check = subOrder.checks.find((item) => item.key === key);
    commit((order) => {
      const completedAt = time();
      let passedCurrent = false;
      const checks = order.checks.map((item) => {
        if (item.key === key) { passedCurrent = true; return { ...item, status: '已完成', completedAt, note: form.note, materials: form.material ? [...item.materials, makeMaterial(form.material)] : item.materials }; }
        if (passedCurrent && item.status === '未开始') { passedCurrent = false; return { ...item, status: '进行中' }; }
        return item;
      });
      const next = checks.find((item) => item.status !== '已完成');
      return { ...order, currentNode: next?.key || 'preparation-complete', checks };
    }, '完成前置检查', check?.label || key, `“${check?.label || '前置检查'}”已完成`);
  };

  const completeExecutionItem = (key, form) => {
    if (subOrder.status !== '执行中' || hasTaskExecutionBlock(subOrder)) return;
    const target = subOrder.executionItems.find((item) => item.key === key);
    if (!target || target.requirement === 'not-applicable' || target.status === '已完成') return;
    commit((order) => {
      const executionItems = order.executionItems.map((item) => item.key === key ? { ...item, status: '已完成', completedAt: time(), note: form.note, materials: form.material ? [...item.materials, makeMaterial(form.material)] : item.materials } : item);
      const nextRequired = executionItems.find((item) => item.requirement === 'required' && item.status !== '已完成');
      return { ...order, currentNode: nextRequired?.key || 'device-installation', executionItems };
    }, '记录公共执行结果', target.label, `“${target.label}”执行结果已保存`);
  };

  const addMaterial = (target, form) => {
    if (subOrder.status === '已完成') return;
    commit((order) => {
      const material = makeMaterial(form);
      if (target.kind === 'check') return { ...order, checks: order.checks.map((item) => item.key === target.key ? { ...item, materials: [...item.materials, material] } : item) };
      return { ...order, executionItems: order.executionItems.map((item) => item.key === target.key ? { ...item, materials: [...item.materials, material] } : item) };
    }, '添加资料记录', form.name, `资料“${form.name}”已添加`);
  };

  const addBlock = (form) => {
    if (subOrder.status === '已完成') return;
    const node = modal?.node || (subOrder.status === '阻塞' ? subOrder.previousNode : subOrder.currentNode) || subOrder.currentNode;
    const nodeLabel = modal?.nodeLabel || currentNodeLabel;
    commit((order) => {
      const createdAt = time();
      const materials = form.materialName.trim() ? [makeMaterial(form)] : [];
      const enteringBlocked = form.pausesTask && !hasTaskExecutionBlock(order);
      return { ...order, previousStatus: enteringBlocked ? order.status : order.previousStatus, previousNode: enteringBlocked ? order.currentNode : order.previousNode, status: form.pausesTask ? '阻塞' : order.status, currentNode: form.pausesTask ? 'blocked' : order.currentNode, blocks: [...order.blocks, { id: createClientId('DSOBLK'), node, nodeLabel, reason: form.reason.trim(), owner: form.owner.trim(), pausesTask: form.pausesTask, status: '处理中', createdAt, updatedAt: createdAt, progress: [], materials }] };
    }, '登记交付阻塞', `${nodeLabel}：${form.reason.trim()}${form.pausesTask ? '；暂停整张子工单' : '；不暂停整张子工单'}`, form.pausesTask ? `已在“${nodeLabel}”登记阻塞，流程已暂停` : `已在“${nodeLabel}”登记交付阻塞，现场流程可继续`);
  };

  const updateBlock = (block, form, resolve = false) => {
    if (block.status === '已解除') return;
    commit((order) => {
      const blocks = order.blocks.map((item) => item.id === block.id ? { ...item, status: resolve ? '已解除' : item.status, updatedAt: time(), resolvedAt: resolve ? time() : item.resolvedAt, resolvedBy: resolve ? operator : item.resolvedBy, resolution: resolve ? form.note : item.resolution, progress: resolve ? item.progress : [...item.progress, { id: createClientId('DSOBP'), content: form.note, operator, time: time() }] } : item);
      const remainingTaskBlocks = blocks.filter((item) => item.status !== '已解除' && item.pausesTask).length;
      const restore = resolve && order.status === '阻塞' && remainingTaskBlocks === 0;
      return { ...order, status: restore ? (order.previousStatus || (order.type === 'preparation' ? '进行中' : '执行中')) : order.status, currentNode: restore ? (order.previousNode || block.node) : order.currentNode, previousStatus: restore ? undefined : order.previousStatus, previousNode: restore ? undefined : order.previousNode, blocks };
    }, resolve ? '标记交付阻塞已解决' : '更新阻塞处理进展', resolve ? `${form.note}；${block.pausesTask ? '检查其他整单阻塞后恢复流程' : '未暂停整单流程'}` : form.note, resolve ? '交付阻塞已标记解决；如无其他整单阻塞，流程已恢复到原环节' : '阻塞处理进展已保存');
  };

  const saveInstallation = (record, form) => {
    if (subOrder.status !== '执行中' || hasTaskExecutionBlock(subOrder)) return;
    const device = state.devices.find((item) => item.id === record.deviceId);
    commit((order) => ({ ...order, devices: order.devices.map((item) => item.id === record.id ? { ...item, installationStatus: form.installationStatus, installationNote: form.installationNote.trim(), materials: form.materialName.trim() ? [...item.materials, makeMaterial(form)] : item.materials } : item) }), '保存安装调试进度', `${device?.sn || record.deviceId} 安装调试进度：${record.installationStatus} → ${form.installationStatus}`, `${device?.sn || '设备'}安装调试进度已保存`, { deviceId: record.deviceId });
  };

  const saveAcceptance = (record, form) => {
    if (!deviceAcceptancePrerequisites(subOrder, record).ready) return;
    if (form.acceptanceResult === '未通过' && !form.relatedIssueId) return setNotice('未通过验收必须关联当前设备的正式问题池记录。');
    const device = state.devices.find((item) => item.id === record.deviceId);
    commit((order) => ({ ...order, devices: order.devices.map((item) => item.id === record.id ? { ...item, acceptanceResult: form.acceptanceResult, acceptanceNote: form.acceptanceNote.trim(), materials: form.materialName.trim() ? [...item.materials, makeMaterial(form)] : item.materials, acceptanceHistory: [...(item.acceptanceHistory || []), { id: createClientId('DSOACC'), time: time(), operator, from: item.acceptanceResult || '未记录', to: form.acceptanceResult, note: form.acceptanceNote.trim(), issueId: form.relatedIssueId || undefined }] } : item) }), '保存设备验收结果', `${device?.sn || record.deviceId} 验收结果：${record.acceptanceResult || '未记录'} → ${form.acceptanceResult}${form.relatedIssueId ? `；关联问题 ${state.issueRecords.find((item) => item.id === form.relatedIssueId)?.issueNo || form.relatedIssueId}` : ''}`, `${device?.sn || '设备'}验收结果已保存`, { deviceId: record.deviceId, issueId: form.relatedIssueId || undefined });
  };

  const createIssue = (form) => {
    if (!['执行中', '待设备验收'].includes(subOrder.status)) return setNotice('当前尚未进入现场执行，确认到场后才能提交设备问题。');
    const createdAt = time();
    const id = createClientId('ISSUE');
    const issueNo = nextIssueNo(state.issueRecords);
    const device = state.devices.find((item) => item.id === form.deviceId);
    const sourceRecord = subOrder.devices.find((item) => item.deviceId === form.deviceId);
    const issue = { id, issueNo, customerName: form.customerName.trim(), causeLevel1: form.causeLevel1.trim(), causeLevel2: form.causeLevel2.trim(), causeLevel3: form.causeLevel3.trim(), symptom: form.symptom.trim(), siteTroubleshooting: form.siteTroubleshooting.trim(), temporarySolution: form.temporarySolution.trim(), attachments: form.materialName.trim() ? [{ id: createClientId('ISSUEMAT'), name: form.materialName.trim(), purpose: form.materialPurpose.trim() || '问题资料', uploadedBy: operator, uploadedAt: createdAt, note: form.materialNote.trim() }] : [], reporter: form.reporter.trim(), deviceIdentifier: form.deviceIdentifier.trim(), reportedAt: form.reportedAt.replace('T', ' '), projectName: form.projectName, softwareVersion: form.softwareVersion.trim(), resolutionStatus: '', assignee: '', rootCause: '', longTermSolution: '', isClosed: '', deviceId: form.deviceId, projectId: plan.projectId, deliveryContext: { deliveryPlanId: plan.id, projectId: plan.projectId, locationId: subOrder.locationId, batchId: subOrder.batchId || sourceRecord?.batchId, subOrderId: subOrder.id, node: subOrder.currentNode, deviceRecordId: modal?.record?.id }, activityLogs: [{ id: createClientId('ISSUELOG'), time: createdAt, operator, action: '提交设备问题至问题池', notes: `关联设备 ${device?.sn || form.deviceId}` }] };
    dispatch({ type: 'ADD_ISSUE_RECORD', payload: issue });
    commit((order) => {
      return { ...order, issueLinks: [...(order.issueLinks || []), { id: createClientId('DSOISSUE'), issueId: id, deviceId: form.deviceId, createdAt }] };
    }, '提交设备问题至问题池', `创建问题 ${issueNo}，关联设备 ${device?.sn || form.deviceId}`, `已创建正式问题 ${issueNo}`, { deviceId: form.deviceId, issueId: id });
    if (modal?.type === 'issue-from-acceptance') setModal({ type: 'acceptance', record: modal.record, draft: { ...modal.acceptanceDraft, relatedIssueId: id } });
  };

  const completeOrder = (completionNote = '') => {
    if (subOrder.type === 'preparation' && !preparationReady(subOrder)) return;
    if (subOrder.type === 'deployment' && !deploymentReadyToComplete(subOrder, state.issueRecords)) return setNotice(`暂不能完成部署子工单：${deploymentCompletionReasons(subOrder, state.issueRecords).join('；')}。请先处理对应设备结果或交付阻塞。`);
    commit((order) => ({ ...order, status: '已完成', currentNode: 'completed', completedAt: time(), completionNote }), '完成交付子工单', completionNote || '完成部署任务；不修改当前设备交付结果', '工单已完成并切换为只读');
  };

  const startAcceptance = () => {
    const result = canStartDeviceAcceptance(subOrder);
    if (!result.ready) return setNotice(`暂不能开始设备验收：${result.reasons.join('；')}`);
    commit((order) => ({ ...order, status: '待设备验收', currentNode: 'device-acceptance' }), '开始设备验收', `共 ${orderDeviceCount(subOrder)} 台设备待验收`, '已进入设备验收，请按设备填写结果');
  };

  const handlePrimary = (guidance) => {
    if (guidance.action === 'start-preparation') return commit((order) => ({ ...order, status: '进行中', currentNode: order.checks.find((item) => item.status !== '已完成')?.key || order.currentNode, startedAt: time(), checks: order.checks.map((item, index) => index === 0 && item.status === '未开始' ? { ...item, status: '进行中' } : item) }), '开始前置准备', '', '前置准备已开始，请完成当前检查项');
    if (guidance.action === 'complete-check') return setModal({ type: 'check', key: guidance.targetKey });
    if (guidance.action === 'complete-preparation') return setModal({ type: 'complete-preparation' });
    if (guidance.action === 'create-deployment') return setModal({ type: 'create-deployment' });
    if (guidance.action === 'assign') return setModal({ type: 'assign' });
    if (guidance.action === 'accept-task' && subOrder.status === '待接单' && subOrder.engineer) return commit((order) => ({ ...order, status: '待上门', currentNode: 'arrival', acceptedAt: time() }), '执行工程师接单', `工单状态：待接单 → 待上门；${subOrder.engineer} 已接单`, '接单成功，下一步确认已到现场');
    if (guidance.action === 'confirm-arrival' && subOrder.status === '待上门' && subOrder.acceptedAt) return commit((order) => ({ ...order, status: '执行中', currentNode: requiredExecutionRemaining(order)[0]?.key || 'device-installation', actualVisitTime: time(), startedAt: time() }), '确认已到现场', '工单状态：待上门 → 执行中；当前节点进入现场执行', '已确认到场，请完成本次现场任务和设备安装调试');
    if (guidance.action === 'complete-execution') return setModal({ type: 'execution', key: guidance.targetKey });
    if (guidance.action === 'record-installation') return setActive('devices');
    if (guidance.action === 'start-acceptance') return startAcceptance();
    if (guidance.action === 'record-acceptance') return setActive('devices');
    if (guidance.action === 'complete-deployment') return setModal({ type: 'complete-deployment' });
    if (guidance.action === 'resolve-block') return setActive('exceptions');
  };

  const installationDone = installationProgress(subOrder);
  const acceptedCount = acceptanceProgress(subOrder);
  const materialCount = subOrderMaterialCount(subOrder, subOrderIssues);
  const completionRisks: string[] = [];
  const issueDevice = modal?.record ? deviceForRecord(modal.record) : deviceOptions[0];

  return <Page>
    <PageHeader breadcrumb={<div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Link className="ui-link" to={returnTo}>交付执行</Link><span>/</span><span>交付子工单</span></div>} title={subOrder.name} description={`${subOrderTypeLabel(subOrder.type)} · ${location?.name || '—'}`} actions={prototypeNavEnabled ? <Btn as="link" to={`/mobile/delivery/${subOrder.id}`}>移动端查看</Btn> : undefined} />
    {notice && <div className="flex items-center justify-between gap-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}
    <div className="flex flex-wrap items-center gap-2"><StatusBadge status={subOrder.status} /><span className="text-xs text-gray-500">当前节点：{currentNodeLabel}</span>{subOrder.type === 'deployment' && <span className="text-xs text-gray-500">执行工程师：{subOrder.engineer || '尚未分派'}</span>}</div>
    <SubOrderTaskGuide subOrder={subOrder} onPrimary={handlePrimary} onBlock={() => setModal({ type: 'block', node: subOrder.currentNode, nodeLabel: currentNodeLabel })} onBlockProgress={() => activeBlock && setModal({ type: 'block-progress', block: activeBlock })} />
    <Tabs active={active} onChange={setActive} type={subOrder.type} />

    {active === 'overview' && <>
      {subOrder.type === 'preparation'
        ? <StatGrid cols={4}><StatCard label="前置检查完成" value={`${subOrder.checks.filter((item) => item.status === '已完成').length} / ${subOrder.checks.length}`} hint="按顺序推进" /><StatCard label="未解除交付阻塞" value={subOrder.blocks.filter((item) => item.status !== '已解除').length} hint="当前子工单处理" tone={subOrder.blocks.some((item) => item.status !== '已解除') ? 'warning' : 'default'} /><StatCard label="资料记录" value={materialCount} hint="随检查项维护" /><StatCard label="设备部署条件" value={subOrder.checks.find((item) => item.key === 'deployment-ready')?.status || '未开始'} hint="前置完成条件" /></StatGrid>
        : <StatGrid cols={4}><StatCard label="当前状态" value={subOrder.status} hint={currentNodeLabel} /><StatCard label="关联设备" value={subOrder.devices.length} hint="交付批次设备" /><StatCard label="安装调试完成" value={`${installationDone} / ${subOrder.devices.length}`} hint="现场任务记录" /><StatCard label="设备验收进度" value={`${acceptedCount} / ${subOrder.devices.length}`} hint="不修改当前交付结果" /></StatGrid>}
      <Section title="任务信息"><DescList cols={3} items={[["所属交付执行", <Link className="ui-link font-mono text-xs" to={`/delivery-plans/${plan.id}?tab=sub-orders`}>{plan.id}</Link>], ['所属项目', project?.name || '—'], ['交付点位', location?.name || '—'], ['关联批次', batch ? batchDisplayName(batch) : '未关联'], ['任务联系人', subOrder.contact || '—'], [subOrder.type === 'preparation' ? '当前跟进人' : '执行工程师', subOrder.type === 'preparation' ? subOrder.owner || '—' : subOrder.engineer || '尚未分派'], ['创建人', subOrder.createdBy || '—'], ['计划开始时间', subOrder.plannedTime.replace('T', ' ')], ['接单时间', subOrder.acceptedAt || '—'], ['到场时间', subOrder.actualVisitTime || '—'], ['完成时间', subOrder.completedAt || '—'], ['任务说明', subOrder.notes || '—']]} /></Section>
      {sourcePreparation && <Section title="来源前置子工单" subtitle="后续部署工单与前置工单通过明确来源关系关联。"><DescList cols={3} items={[["前置任务", <Link className="ui-link text-xs" to={`/delivery-plans/${plan.id}/sub-orders/${sourcePreparation.id}?returnTo=${encodeURIComponent(`/delivery-plans/${plan.id}/sub-orders/${subOrder.id}`)}`}>{subOrderTypeLabel(sourcePreparation.type)} · {state.locations.find((item) => item.id === sourcePreparation.locationId)?.name || '当前交付点位'}</Link>], ['完成时间', sourcePreparation.completedAt || '—'], ['设备部署条件确认', sourcePreparation.checks.find((item) => item.key === 'deployment-ready')?.status || '—']]} /></Section>}
      <Section title="使用提示"><p className="text-[13px] text-gray-600">{subOrder.type === 'preparation' ? '本工单负责现场前置条件，只处理交付阻塞；不关联设备，也不会进入问题池。' : '“本次现场任务”记录整张工单一次；单台设备的安装调试、验收和问题在“设备执行与验收”中分别记录。'}</p></Section>
    </>}

    {active === 'preparation' && <Section title="前置检查" subtitle="资料随检查项维护，不单独形成附件页签。"><SubOrderPreparationPanel subOrder={subOrder} onComplete={(key) => setModal({ type: 'check', key })} onMaterial={(key) => setModal({ type: 'material', target: { kind: 'check', key } })} onBlock={(key) => setModal({ type: 'block', node: key, nodeLabel: subOrder.checks.find((item) => item.key === key)?.label })} /></Section>}
    {active === 'flow' && <Section title="本次现场任务" subtitle="必填任务完成后才能开始设备验收；设备级安装调试和验收不在此重复维护。"><SubOrderDeploymentFlow subOrder={subOrder} onComplete={(key) => setModal({ type: 'execution', key })} onMaterial={(key) => setModal({ type: 'material', target: { kind: 'execution', key } })} /></Section>}
    {active === 'devices' && <Section title="设备执行与验收" subtitle="每台设备分别记录安装调试、验收和关联问题。"><SubOrderDevicePanel subOrder={subOrder} issues={state.issueRecords} plan={plan} state={state} onInstallation={(record) => setModal({ type: 'installation', record })} onAcceptance={(record) => setModal({ type: 'acceptance', record })} onIssue={(record) => setModal({ type: 'issue', record })} /></Section>}
    {active === 'exceptions' && <SubOrderExceptionsPanel subOrder={subOrder} issues={state.issueRecords} state={state} onBlock={() => setModal({ type: 'block', node: subOrder.currentNode, nodeLabel: currentNodeLabel })} onProgress={(block) => setModal({ type: 'block-progress', block })} onResolve={(block) => setModal({ type: 'block-resolve', block })} />}
    {active === 'logs' && <Section title={`操作日志（${subOrder.logs.length}）`} bodyClassName="p-0"><Table head={['操作时间', '操作人', '操作内容', '必要说明']} empty="暂无子工单操作日志">{[...subOrder.logs].sort((a, b) => b.time.localeCompare(a.time)).map((item) => <tr key={item.id}><td className="px-3 py-2 text-xs text-gray-500">{item.time}</td><td className="px-3 py-2 text-gray-600">{item.operator}</td><td className="px-3 py-2 text-gray-700">{item.action}</td><td className="px-3 py-2 text-xs text-gray-600">{item.notes || '—'}</td></tr>)}</Table></Section>}

    <AssignModal key={`assign-${modal?.type}`} isOpen={modal?.type === 'assign'} onClose={() => setModal(null)} options={ownerOptions} subOrder={subOrder} onSave={(engineer) => subOrder.status === '待分派' && commit((order) => ({ ...order, engineer, owner: '', assignedBy: operator, status: '待接单', currentNode: 'engineer-acceptance' }), '分派执行工程师', `工单状态：待分派 → 待接单；分派给 ${engineer}`, `已分派给 ${engineer}，等待接单`)} />
    <RecordUpdateModal key={`record-${modal?.type}-${modal?.key || ''}`} isOpen={modal?.type === 'check' || modal?.type === 'execution'} onClose={() => setModal(null)} title={modal?.type === 'check' ? '确认完成前置检查' : '记录当前执行结果'} objectLabel={modal?.type === 'check' ? subOrder.checks.find((item) => item.key === modal?.key)?.label : subOrder.executionItems.find((item) => item.key === modal?.key)?.label} submitLabel={modal?.type === 'check' ? '确认完成检查' : '保存本次现场任务'} resultHint={modal?.type === 'check' ? '保存后进入下一项前置检查。' : '保存后更新本次现场任务，不会修改设备级结果。'} onSave={(form) => modal?.type === 'check' ? completeCheck(modal.key, form) : completeExecutionItem(modal.key, form)} />
    <MaterialModal key={`material-${modal?.target?.key || ''}`} isOpen={modal?.type === 'material'} onClose={() => setModal(null)} objectLabel={modal?.target?.kind === 'check' ? subOrder.checks.find((item) => item.key === modal?.target?.key)?.label : subOrder.executionItems.find((item) => item.key === modal?.target?.key)?.label} onSave={(form) => addMaterial(modal.target, form)} />
    <BlockModal key={`block-${modal?.type}-${modal?.node || ''}`} isOpen={modal?.type === 'block'} onClose={() => setModal(null)} onSave={addBlock} owner={subOrder.engineer || subOrder.owner || subOrder.contact} nodeLabel={modal?.nodeLabel || currentNodeLabel} subOrder={subOrder} />
    <BlockProgressModal key={`block-update-${modal?.type}`} isOpen={modal?.type === 'block-progress' || modal?.type === 'block-resolve'} onClose={() => setModal(null)} block={modal?.block} resolve={modal?.type === 'block-resolve'} onSave={(form) => updateBlock(modal.block, form, modal?.type === 'block-resolve')} />
    <InstallationModal key={`installation-${modal?.record?.id || ''}`} isOpen={modal?.type === 'installation'} onClose={() => setModal(null)} device={deviceForRecord(modal?.record)} record={modal?.record} onSave={(form) => saveInstallation(modal.record, form)} />
    <AcceptanceModal key={`acceptance-${modal?.record?.id || ''}-${modal?.draft?.relatedIssueId || ''}`} isOpen={modal?.type === 'acceptance'} onClose={() => setModal(null)} device={deviceForRecord(modal?.record)} record={modal?.record} draft={modal?.draft} relatedIssues={modal?.record ? (subOrder.issueLinks || []).filter((link) => link.deviceId === modal.record.deviceId).map((link) => state.issueRecords.find((item) => item.id === link.issueId)).filter((item) => item && item.isClosed !== '是') : []} onCreateIssue={(acceptanceDraft) => setModal({ type: 'issue-from-acceptance', record: modal.record, acceptanceDraft })} onSave={(form) => saveAcceptance(modal.record, form)} />
    <IssueRecordModal key={`issue-${modal?.record?.id || modal?.type}`} isOpen={modal?.type === 'issue' || modal?.type === 'issue-from-acceptance'} onClose={() => modal?.type === 'issue-from-acceptance' ? setModal({ type: 'acceptance', record: modal.record, draft: modal.acceptanceDraft }) : setModal(null)} onSave={createIssue} mode="delivery" title="提交设备问题至问题池" submitLabel="提交至问题池" defaults={{ customerName: project?.client || '', projectName: project?.name || '', projectId: plan.projectId, reporter: operator, reportedAt: time().replace(' ', 'T'), deviceId: issueDevice?.id || '', deviceIdentifier: issueDevice?.sn || issueDevice?.robotNo || '' }} devices={issueDevice ? [issueDevice] : []} projects={state.projects} currentUser={operator} />
    <CompleteOrderModal key={`complete-${modal?.type}`} isOpen={modal?.type === 'complete-preparation' || modal?.type === 'complete-deployment'} onClose={() => setModal(null)} risks={modal?.type === 'complete-deployment' ? completionRisks : []} kind={modal?.type === 'complete-preparation' ? 'preparation' : 'deployment'} onSave={completeOrder} />
    <DeliverySubOrderCreateModal key={`follow-up-${modal?.type}`} isOpen={modal?.type === 'create-deployment'} onClose={() => setModal(null)} onViewBatches={() => { setModal(null); navigate(`/delivery-plans/${plan.id}?tab=batches&returnTo=${encodeURIComponent(returnTo)}`); }} onCreate={(created) => { setModal(null); dispatch({ type: 'ADD_DELIVERY_SUB_ORDER', payload: created }); navigate(`/delivery-plans/${plan.id}/sub-orders/${created.id}?returnTo=${encodeURIComponent(`/delivery-plans/${plan.id}?tab=sub-orders`)}&created=1`); }} plan={plan} project={project} state={state} initialType="deployment" initialLocationId={subOrder.locationId} sourcePreparationId={subOrder.id} />
  </Page>;
}

function orderDeviceCount(subOrder: DeliverySubOrder) {
  return subOrder.devices.length;
}
