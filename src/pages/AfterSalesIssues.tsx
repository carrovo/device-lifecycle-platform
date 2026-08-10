import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Btn, DescList, Input, Page, PageHeader, Section, Select, SearchInput, Table, Toolbar } from '../components/ui';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import IssueRecordModal, { CategorySelect } from '../components/issues/IssueRecordModal';
import { AttachmentList } from '../components/AttachmentUpload';
import { createClientId } from '../data/clientId';
import { nowText } from '../data/dateTime';
import { ACTIVE_AFTER_SALES_STATUSES, activeAfterSalesOrderForIssue, nextAfterSalesOrderNo, type AfterSalesOrder } from '../data/afterSalesOrders';
import { ISSUE_CAUSE_LEVEL_1, ISSUE_CAUSE_LEVEL_2, ISSUE_CAUSE_LEVEL_3, ISSUE_CLOSURE_VALUES, ISSUE_RESOLUTION_STATUSES, TECHNICAL_SUPPORT_DECISIONS, nextIssueNo, technicalSupportDecisionLabel, type IssueRecord, type TechnicalSupportDecision } from '../data/issuePool';

const display = (value?: string) => value || '—';
const nonEmptyStrings = (values: Array<string | null | undefined>): string[] => values.filter((value): value is string => typeof value === 'string' && value.length > 0);

type IssueListFilters = { query: string; project: string; status: string; assignee: string; closed: string };
type TechnicalSupportInfo = Pick<IssueRecord, 'symptom' | 'siteTroubleshooting' | 'temporarySolution' | 'causeLevel1' | 'causeLevel2' | 'causeLevel3'>;
type QualityFollowUpValues = Pick<IssueRecord, 'resolutionStatus' | 'assignee' | 'rootCause' | 'longTermSolution' | 'isClosed'>;

type IssueListProps = {
  issues: IssueRecord[];
  state: { issueRecords: IssueRecord[] };
  filters: IssueListFilters;
  setFilters: Dispatch<SetStateAction<IssueListFilters>>;
  onSelect: (issue: IssueRecord) => void;
};

type IssueDetailState = {
  devices: Array<{ id: string; robotNo: string; sn: string }>;
  deliverySubOrders: Array<{ id: string; locationId: string; type: string }>;
  locations: Array<{ id: string; name?: string }>;
};

type IssueDetailProps = {
  issue: IssueRecord;
  state: IssueDetailState;
  activeOrder?: AfterSalesOrder;
  orders: AfterSalesOrder[];
  onBack: () => void;
  onTechnical: (decision?: TechnicalSupportDecision) => void;
  onQualityUpdate: () => void;
  onResearchFeedback: () => void;
};

type TechnicalSupportCardProps = {
  issue: IssueRecord;
  activeOrder?: AfterSalesOrder;
  orders: AfterSalesOrder[];
  onStart: (decision?: TechnicalSupportDecision) => void;
  onResearchFeedback: () => void;
};

type AfterSalesOrdersListProps = { orders: AfterSalesOrder[]; onView: (order: AfterSalesOrder) => void };

export default function AfterSalesIssues() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<{ type: 'create' | 'technical' | 'quality' | 'research-feedback'; decision?: TechnicalSupportDecision } | null>(null);
  const [filters, setFilters] = useState<IssueListFilters>({ query: '', project: '', status: '', assignee: '', closed: '' });
  const tab = searchParams.get('tab') || 'issues';
  const selected = state.issueRecords.find((item) => item.id === searchParams.get('issue')) as IssueRecord | undefined;
  const issues = useMemo(() => state.issueRecords.filter((item) => {
    const key = filters.query.trim().toLowerCase();
    const statusMatch = !filters.status || (filters.status === '__empty' ? !item.resolutionStatus : item.resolutionStatus === filters.status);
    const closureMatch = !filters.closed || (filters.closed === '__empty' ? !item.isClosed : item.isClosed === filters.closed);
    return (!key || `${item.issueNo} ${item.symptom} ${item.deviceIdentifier}`.toLowerCase().includes(key))
      && (!filters.project || item.projectName === filters.project) && statusMatch
      && (!filters.assignee || item.assignee === filters.assignee) && closureMatch;
  }), [state.issueRecords, filters]);
  const selectIssue = (issue: IssueRecord) => {
    const next = new URLSearchParams(searchParams);
    next.set('issue', issue.id);
    next.delete('tab');
    setSearchParams(next);
  };
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('issue');
    nextTab === 'issues' ? next.delete('tab') : next.set('tab', nextTab);
    setSearchParams(next);
  };
  const activeOrder = selected && activeAfterSalesOrderForIssue(state.afterSalesOrders, selected.id);

  const createIssue = (form: Record<string, string>) => {
    const id = createClientId('ISSUE');
    const created: IssueRecord = {
      id,
      issueNo: nextIssueNo(state.issueRecords),
      customerName: form.customerName.trim(),
      causeLevel1: form.causeLevel1.trim(),
      causeLevel2: form.causeLevel2.trim(),
      causeLevel3: form.causeLevel3.trim(),
      symptom: form.symptom.trim(),
      siteTroubleshooting: form.siteTroubleshooting.trim(),
      temporarySolution: form.temporarySolution.trim(),
      attachments: form.materialName.trim() ? [{ id: createClientId('ISSUEMAT'), name: form.materialName.trim(), purpose: form.materialPurpose.trim() || '问题资料', uploadedBy: state.currentUser || form.reporter.trim(), uploadedAt: nowText(), note: form.materialNote.trim() }] : [],
      reporter: form.reporter.trim(),
      deviceIdentifier: form.deviceIdentifier.trim(),
      reportedAt: form.reportedAt.replace('T', ' '),
      projectName: form.projectName,
      softwareVersion: form.softwareVersion.trim(),
      resolutionStatus: '',
      assignee: '',
      rootCause: '',
      longTermSolution: '',
      isClosed: '',
      deviceId: form.deviceId || undefined,
      projectId: form.projectId || state.projects.find((item) => item.name === form.projectName)?.id,
      activityLogs: [{ id: createClientId('ISSUELOG'), time: nowText(), operator: state.currentUser || form.reporter.trim(), action: '创建问题', notes: '已创建正式问题池记录。' }],
    };
    dispatch({ type: 'ADD_ISSUE_RECORD', payload: created });
    setModal(null);
    selectIssue(created);
  };

  const saveQualityFollowUp = (values: QualityFollowUpValues) => {
    if (!selected) return;
    const currentActiveOrder = activeAfterSalesOrderForIssue(state.afterSalesOrders, selected.id);
    if (values.isClosed === '是' && currentActiveOrder) throw new Error(`当前问题仍有关联售后工单 ${currentActiveOrder.orderNo} 处理中，请先完成或取消售后工单。`);
    const changes: string[] = [];
    const fields: Array<[keyof QualityFollowUpValues, string]> = [
      ['resolutionStatus', '解决状态'], ['assignee', '处理人'], ['rootCause', '根因分析'], ['longTermSolution', '长期问题解决方案'], ['isClosed', '问题是否闭环'],
    ];
    fields.forEach(([key, label]) => {
      if (selected[key] !== values[key]) changes.push(`${label}：${display(selected[key])} → ${display(values[key])}`);
    });
    dispatch({
      type: 'UPDATE_ISSUE_RECORD',
      payload: {
        ...selected,
        ...values,
        activityLogs: [...(selected.activityLogs || []), { id: createClientId('ISSUELOG'), time: nowText(), operator: state.currentUser || '当前用户', action: '更新质量跟进', notes: changes.length ? changes.join('；') : '未修改质量跟进字段。' }],
      },
    });
    setModal(null);
  };

  const saveTechnicalSupport = (decision: TechnicalSupportDecision, note: string, info: TechnicalSupportInfo) => {
    if (!selected) return;
    const relatedOrder = state.afterSalesOrders.find((item) => item.issueId === selected.id);
    const previousDecision = selected.technicalSupport?.decision || '尚未判断';
    if (relatedOrder) throw new Error(`当前问题已关联售后工单 ${relatedOrder.orderNo}，请查看已有售后工单。`);
    if (decision === '需要现场处理，转售后工单') {
      if (selected.isClosed === '是') throw new Error('当前问题已明确闭环，如需重新处理请先调整问题记录。');
      if (!info.symptom.trim()) throw new Error('请补充故障现象描述。');
      if (!selected.deviceIdentifier.trim() && !selected.deviceId) throw new Error('请补充可定位的设备标识。');
    }
    const handledAt = nowText();
    const handler = state.currentUser || '技术客服';
    const technicalSupport = {
      decision,
      note: note.trim(),
      handler,
      handledAt,
      researchFeedbacks: selected.technicalSupport?.researchFeedbacks || [],
    };
    const normalizedFields = ['symptom', 'siteTroubleshooting', 'temporarySolution', 'causeLevel1', 'causeLevel2', 'causeLevel3'] as const;
    const normalized = normalizedFields.some((key) => selected[key] !== info[key]);
    const logs = [...(selected.activityLogs || [])];
    if (normalized) logs.push({ id: createClientId('ISSUELOG'), time: handledAt, operator: handler, action: '规范问题信息', notes: '已更新故障现象描述、已做排查动作、临时解决方案或故障分类。' });
    const action = decision === '远程处理' ? '技术客服远程解决' : decision === '升级研发协助' ? '升级研发协助' : '转为售后工单';
    logs.push({ id: createClientId('ISSUELOG'), time: handledAt, operator: handler, action, notes: `处理判断：${technicalSupportDecisionLabel(previousDecision)} → ${technicalSupportDecisionLabel(decision)}${note.trim() ? `；${note.trim()}` : ''}` });
    const updatedIssue: IssueRecord = { ...selected, ...info, technicalSupport, activityLogs: logs };
    if (decision !== '需要现场处理，转售后工单') {
      dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: updatedIssue });
      setModal(null);
      return;
    }
    const id = createClientId('ASO');
    const order: AfterSalesOrder = {
      id,
      orderNo: nextAfterSalesOrderNo(state.afterSalesOrders),
      issueId: selected.id,
      issueNo: selected.issueNo,
      deviceId: selected.deviceId,
      projectId: selected.projectId,
      deliveryPlanId: selected.deliveryContext?.deliveryPlanId,
      sourceSubOrderId: selected.deliveryContext?.subOrderId,
      locationId: selected.deliveryContext?.locationId,
      batchId: selected.deliveryContext?.batchId,
      status: '待分派',
      snapshot: {
        customerName: selected.customerName,
        projectName: selected.projectName,
        deviceIdentifier: selected.deviceIdentifier,
        symptom: updatedIssue.symptom,
        siteTroubleshooting: updatedIssue.siteTroubleshooting,
        temporarySolution: updatedIssue.temporarySolution,
        causeLevel1: updatedIssue.causeLevel1,
        causeLevel2: updatedIssue.causeLevel2,
        causeLevel3: updatedIssue.causeLevel3,
        rootCause: selected.rootCause,
        longTermSolution: selected.longTermSolution,
        attachments: selected.attachments || [],
        technicalSupport,
      },
      materials: [],
      createdAt: handledAt,
      updatedAt: handledAt,
      logs: [{ id: createClientId('ASOLOG'), time: handledAt, operator: handler, action: '创建售后工单', notes: `来源问题：${selected.issueNo}；技术客服判断：${technicalSupportDecisionLabel(decision)}；工单状态：— → 待分派` }],
    };
    dispatch({ type: 'ADD_AFTER_SALES_ORDER', payload: order });
    dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: { ...updatedIssue, activityLogs: [...updatedIssue.activityLogs, { id: createClientId('ISSUELOG'), time: handledAt, operator: handler, action: '转为售后工单', notes: `问题 ${selected.issueNo} 已关联售后工单 ${order.orderNo}` }] } });
    setModal(null);
    navigate(`/after-sales/orders/${id}`);
  };

  const saveResearchFeedback = (content: string) => {
    if (!selected?.technicalSupport) return;
    const handledAt = nowText();
    const handler = state.currentUser || '技术客服';
    const researchFeedbacks = [...(selected.technicalSupport.researchFeedbacks || []), { content: content.trim(), handler, handledAt }];
    dispatch({
      type: 'UPDATE_ISSUE_RECORD',
      payload: {
        ...selected,
        technicalSupport: { ...selected.technicalSupport, researchFeedbacks },
        activityLogs: [...(selected.activityLogs || []), { id: createClientId('ISSUELOG'), time: handledAt, operator: handler, action: '记录研发反馈', notes: content.trim() }],
      },
    });
    setModal(null);
  };

  return <Page>
    <PageHeader title={selected ? selected.issueNo : tab === 'orders' ? '售后工单' : '问题池'} description={selected ? '查看问题信息、处理进展和关联记录。' : tab === 'orders' ? '查看待处理和历史售后工单。' : '统一记录交付与正常运营阶段发现的设备问题。'} actions={!selected && tab === 'issues' ? <Btn variant="primary" onClick={() => setModal({ type: 'create' })}>人工新建问题</Btn> : undefined} />
    {!selected && <div className="flex gap-1 border-b border-gray-200"><button className={`px-3 py-2 text-[13px] border-b-2 ${tab === 'issues' ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500'}`} onClick={() => setTab('issues')}>问题池</button><button className={`px-3 py-2 text-[13px] border-b-2 ${tab === 'orders' ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500'}`} onClick={() => setTab('orders')}>售后工单</button></div>}
    {selected ? <IssueDetail issue={selected} state={state} activeOrder={activeOrder} orders={state.afterSalesOrders.filter((item) => item.issueId === selected.id)} onBack={() => setTab('issues')} onTechnical={(decision) => setModal({ type: 'technical', decision })} onQualityUpdate={() => setModal({ type: 'quality' })} onResearchFeedback={() => setModal({ type: 'research-feedback' })} /> : tab === 'orders' ? <AfterSalesOrdersList orders={state.afterSalesOrders} onView={(order) => navigate(`/after-sales/orders/${order.id}`)} /> : <IssueList issues={issues} state={state} filters={filters} setFilters={setFilters} onSelect={selectIssue} />}
    <IssueRecordModal key="issue-create" isOpen={modal?.type === 'create'} onClose={() => setModal(null)} onSave={createIssue} defaults={{ reporter: state.currentUser || '', reportedAt: nowText().replace(' ', 'T') }} devices={state.devices} projects={state.projects} currentUser={state.currentUser} title="人工新建问题" submitLabel="保存问题" />
    <TechnicalSupportModal key={`technical-${selected?.id || 'none'}-${modal?.decision || 'new'}`} isOpen={modal?.type === 'technical'} issue={selected} activeOrder={activeOrder} initialDecision={modal?.decision} onClose={() => setModal(null)} onSave={saveTechnicalSupport} />
    <QualityFollowUpModal key={`quality-${selected?.id || 'none'}`} isOpen={modal?.type === 'quality'} issue={selected} onClose={() => setModal(null)} onSave={saveQualityFollowUp} />
    <ResearchFeedbackModal isOpen={modal?.type === 'research-feedback'} onClose={() => setModal(null)} onSave={saveResearchFeedback} />
  </Page>;
}

function IssueList({ issues, state, filters, setFilters, onSelect }: IssueListProps) {
  const projectOptions = [...new Set(nonEmptyStrings(state.issueRecords.map((item) => item.projectName)))];
  const assigneeOptions = [...new Set(nonEmptyStrings(state.issueRecords.map((item) => item.assignee)))];
  return <><Toolbar><SearchInput className="w-64" placeholder="问题编号 / 故障现象 / SN" value={filters.query} onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))} /><Select value={filters.project} onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}><option value="">全部项目</option>{projectOptions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">全部解决状态</option><option value="__empty">未填写</option>{ISSUE_RESOLUTION_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.assignee} onChange={(event) => setFilters((prev) => ({ ...prev, assignee: event.target.value }))}><option value="">全部处理人</option>{assigneeOptions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.closed} onChange={(event) => setFilters((prev) => ({ ...prev, closed: event.target.value }))}><option value="">全部闭环状态</option><option value="__empty">未填写</option>{ISSUE_CLOSURE_VALUES.map((item) => <option key={item}>{item}</option>)}</Select></Toolbar><Section title={`问题池（${issues.length}）`} bodyClassName="p-0"><Table tableClassName="min-w-[1260px]" head={['问题编号', '客户名称', '故障现象描述', '机器人 SN 编号 or 设备 WIFI 名称', '项目', '提报人', '提报时间', '解决状态', '处理人', '问题是否闭环', '操作']} empty="暂无问题记录">{issues.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="w-32 whitespace-nowrap px-3 py-2 font-mono text-xs"><button className="ui-link" onClick={() => onSelect(item)}>{item.issueNo}</button></td><td className="px-3 py-2">{item.customerName || '—'}</td><td className="w-[340px] px-3 py-2 text-xs leading-5 text-gray-600" title={item.symptom || ''}><span className="block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.symptom || '—'}</span></td><td className="w-44 whitespace-nowrap px-3 py-2 font-mono text-xs">{item.deviceIdentifier || '—'}</td><td className="px-3 py-2">{item.projectName || '—'}</td><td className="px-3 py-2">{item.reporter || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{item.reportedAt || '—'}</td><td className="px-3 py-2"><StatusBadge status={display(item.resolutionStatus)} /></td><td className="px-3 py-2">{item.assignee || '—'}</td><td className="px-3 py-2"><StatusBadge status={display(item.isClosed)} /></td><td className="w-24 whitespace-nowrap px-3 py-2"><button className="ui-link text-[13px]" onClick={() => onSelect(item)}>查看详情</button></td></tr>)}</Table></Section></>;
}

function IssueDetail({ issue, state, activeOrder, orders, onBack, onTechnical, onQualityUpdate, onResearchFeedback }: IssueDetailProps) {
  const device = issue.deviceId ? state.devices.find((item) => item.id === issue.deviceId) : undefined;
  const deliveryOrder = issue.deliveryContext ? state.deliverySubOrders.find((item) => item.id === issue.deliveryContext.subOrderId) : undefined;
  const location = deliveryOrder ? state.locations.find((item) => item.id === deliveryOrder.locationId) : undefined;
  const deliveryLabel = deliveryOrder ? `${deliveryOrder.type === 'preparation' ? '舱体进场及水电部署' : '机器人／设备部署'} · ${location?.name || '当前交付点位'}` : '—';
  return <>
    <div className="flex items-center justify-between gap-3"><Btn onClick={onBack}>返回问题池</Btn></div>
    <TechnicalSupportCard issue={issue} activeOrder={activeOrder} orders={orders} onStart={onTechnical} onResearchFeedback={onResearchFeedback} />
    <Section title="基础信息"><DescList cols={3} items={[["问题编号", issue.issueNo], ['客户名称', display(issue.customerName)], ['项目', display(issue.projectName)], ['机器人 SN 编号 or 设备 WIFI 名称', display(issue.deviceIdentifier)], ['软件版本号', display(issue.softwareVersion)], ['提报人', display(issue.reporter)], ['提报时间', display(issue.reportedAt)]]} /></Section>
    <Section title="问题描述"><DescList cols={2} items={[["故障现象描述", display(issue.symptom)], ['已做排查动作', display(issue.siteTroubleshooting)], ['临时解决方案', display(issue.temporarySolution)], ['详情上传（图片&视频&log）', <AttachmentList items={issue.attachments || []} empty="暂无资料。" />]]} /></Section>
    <Section title="故障分类"><DescList cols={3} items={[["一级故障原因分类", display(issue.causeLevel1)], ['二级故障原因分类', display(issue.causeLevel2)], ['三级故障分类', display(issue.causeLevel3)]]} /></Section>
    <Section title="质量跟进" subtitle="维护问题的质量分析、长期措施和闭环情况。" right={<Btn size="sm" onClick={onQualityUpdate}>更新质量跟进</Btn>}><DescList cols={2} items={[["解决状态", <StatusBadge status={display(issue.resolutionStatus)} />], ['处理人', display(issue.assignee)], ['根因分析（研发/供应商）', display(issue.rootCause)], ['长期问题解决方案（跟进状态）', display(issue.longTermSolution)], ['问题是否闭环', <StatusBadge status={display(issue.isClosed)} />]]} /></Section>
    <Section title="系统关联"><DescList cols={3} items={[["关联设备", device ? <span>{device.robotNo} / {device.sn} <Link className="ui-link ml-2" to={`/devices/${device.id}`}>查看设备</Link></span> : issue.deviceId ? <Link className="ui-link font-mono text-xs" to={`/devices/${issue.deviceId}?tab=project`}>{display(issue.deviceIdentifier)} · 查看设备</Link> : display(issue.deviceIdentifier)], ['关联交付任务', deliveryOrder ? <Link className="ui-link" to={`/delivery-plans/${issue.deliveryContext?.deliveryPlanId}/sub-orders/${deliveryOrder.id}`}>{deliveryLabel} · 查看交付任务</Link> : '—'], ['关联售后工单', orders.length ? orders.map((order) => <Link key={order.id} className="ui-link mr-2 font-mono text-xs" to={`/after-sales/orders/${order.id}`}>{order.orderNo}</Link>) : '—']]} /></Section>
    <Section title={`操作日志（${issue.activityLogs?.length || 0}）`} bodyClassName="p-0"><Table head={['时间', '操作人', '操作内容', '说明']} empty="暂无问题操作日志">{(issue.activityLogs || []).slice().reverse().map((log) => <tr key={log.id}><td className="px-3 py-2 text-xs text-gray-500">{log.time}</td><td className="px-3 py-2">{log.operator}</td><td className="px-3 py-2">{log.action}</td><td className="px-3 py-2 text-xs text-gray-600">{log.notes}</td></tr>)}</Table></Section>
  </>;
}

function TechnicalSupportCard({ issue, activeOrder, orders, onStart, onResearchFeedback }: TechnicalSupportCardProps) {
  const latest = issue.technicalSupport;
  const linkedOrder = orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const feedbacks = latest?.researchFeedbacks || [];
  const readyForOnsite = latest?.decision === '需要现场处理，转售后工单' && !linkedOrder && !activeOrder && issue.isClosed !== '是' && issue.symptom && (issue.deviceIdentifier || issue.deviceId);
  const hint = latest?.decision === '远程处理'
    ? '技术客服远程处理完成，可继续进行质量跟进。'
    : latest?.decision === '升级研发协助'
      ? '该问题已升级研发协助，研发反馈将在此问题中持续记录。'
      : latest?.decision === '需要现场处理，转售后工单' && activeOrder
        ? `关联售后工单 ${activeOrder.orderNo} 当前状态：${activeOrder.status}。`
        : latest?.decision === '需要现场处理，转售后工单' && linkedOrder?.status === '已关单'
          ? '售后现场处理已完成，工单已关单。问题后续可继续进行质量跟进。'
          : latest?.decision === '转交付侧处理'
            ? '历史处理路径：转交付侧处理。来源交付任务关联仍保留供追溯。'
            : '请先规范问题信息，再确定当前处理结果。';
  return <Section title="技术客服预处理" right={<div className="flex gap-2">{linkedOrder ? <Btn as="link" to={`/after-sales/orders/${linkedOrder.id}`}>查看售后工单</Btn> : <>{readyForOnsite && <Btn variant="primary" onClick={() => onStart('需要现场处理，转售后工单')}>确认并转为售后工单</Btn>}<Btn onClick={() => onStart()}>{latest ? '重新判断' : '进行技术客服预处理'}</Btn></>}</div>}><div className="space-y-3 text-[13px]"><div><span className="text-gray-400">当前处理结果：</span>{latest ? technicalSupportDecisionLabel(latest.decision) : '尚未判断'}</div>{latest && <><div><span className="text-gray-400">处理说明：</span>{latest.note || '—'}</div><div><span className="text-gray-400">操作人：</span>{latest.handler} <span className="ml-3 text-gray-400">操作时间：</span>{latest.handledAt}</div></>}<div className="rounded-md border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-medium text-gray-700">问题信息规范 / 远程排查</p><p className="mt-1 text-xs text-gray-500">可规范故障描述、已做排查动作、临时解决方案和故障分类，再确定处理结果。</p></div>{latest?.decision === '升级研发协助' && <div className="rounded-md border border-gray-200 p-3 text-xs"><div className="flex items-center justify-between gap-3"><p className="font-medium text-gray-700">研发协同记录</p><Btn size="sm" onClick={onResearchFeedback}>记录研发反馈</Btn></div><p className="mt-2 text-gray-600">研发协助说明：{latest.note || '—'}</p>{feedbacks.length ? <div className="mt-2 space-y-1 text-gray-600">{feedbacks.map((feedback) => <p key={`${feedback.handledAt}-${feedback.content}`}>研发反馈：{feedback.content} <span className="text-gray-400">{feedback.handler} · {feedback.handledAt}</span></p>)}</div> : <p className="mt-2 text-gray-400">暂无研发反馈。</p>}</div>}<p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">{hint}</p>{latest?.decision === '转交付侧处理' && issue.deliveryContext && <Link className="ui-link text-xs" to={`/delivery-plans/${issue.deliveryContext.deliveryPlanId}/sub-orders/${issue.deliveryContext.subOrderId}`}>查看来源交付任务</Link>}{linkedOrder && <Link className="ui-link text-xs" to={`/after-sales/orders/${linkedOrder.id}`}>查看售后工单 {linkedOrder.orderNo}</Link>}</div></Section>;
}

function TechnicalSupportModal({ isOpen, issue, activeOrder, initialDecision, onClose, onSave }: { isOpen: boolean; issue?: IssueRecord; activeOrder?: AfterSalesOrder; initialDecision?: TechnicalSupportDecision; onClose: () => void; onSave: (decision: TechnicalSupportDecision, note: string, info: TechnicalSupportInfo) => void }) {
  const [decision, setDecision] = useState<TechnicalSupportDecision | ''>(initialDecision || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<TechnicalSupportInfo>({ symptom: issue?.symptom || '', siteTroubleshooting: issue?.siteTroubleshooting || '', temporarySolution: issue?.temporarySolution || '', causeLevel1: issue?.causeLevel1 || '', causeLevel2: issue?.causeLevel2 || '', causeLevel3: issue?.causeLevel3 || '' });
  useEffect(() => {
    if (!isOpen || !issue) return;
    setDecision(initialDecision || '');
    setNote('');
    setError('');
    setForm({ symptom: issue.symptom, siteTroubleshooting: issue.siteTroubleshooting, temporarySolution: issue.temporarySolution, causeLevel1: issue.causeLevel1, causeLevel2: issue.causeLevel2, causeLevel3: issue.causeLevel3 });
  }, [isOpen, issue, initialDecision]);
  if (!issue) return null;
  const disabled = (item: TechnicalSupportDecision) => (Boolean(activeOrder) && item !== '需要现场处理，转售后工单') || (item === '需要现场处理，转售后工单' && (issue.isClosed === '是' || Boolean(activeOrder)));
  const reason = (item: TechnicalSupportDecision) => activeOrder && item !== '需要现场处理，转售后工单' ? '当前问题已存在进行中的售后工单，请先处理当前售后工单后再调整处理路径。' : item === '需要现场处理，转售后工单' && issue.isClosed === '是' ? '当前问题已明确闭环，如需重新处理请先调整问题记录。' : item === '需要现场处理，转售后工单' && activeOrder ? `当前已有售后工单 ${activeOrder.orderNo}。` : '';
  const setValue = <Key extends keyof TechnicalSupportInfo>(key: Key, value: TechnicalSupportInfo[Key]) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = () => {
    if (!decision) return setError('请选择技术客服处理结果。');
    if (!note.trim()) return setError(decision === '升级研发协助' ? '请填写研发协助说明。' : '请填写本次处理说明。');
    if (disabled(decision)) return setError(reason(decision));
    try { onSave(decision, note, form); } catch (value) { setError(value instanceof Error ? value.message : '保存技术客服预处理失败。'); }
  };
  const submitLabel = decision === '远程处理' ? '确认远程解决' : decision === '升级研发协助' ? '确认升级研发协助' : decision === '需要现场处理，转售后工单' ? '确认并转为售后工单' : '保存处理结果';
  return <Modal size="2xl" isOpen={isOpen} onClose={onClose} title="进行技术客服预处理"><div className="space-y-4"><section className="space-y-3"><div><h3 className="text-[13px] font-semibold text-gray-800">问题信息规范 / 远程排查</h3><p className="mt-1 text-xs text-gray-500">只维护当前技术客服已确认的信息，再确定后续处理结果。</p></div><label className="block space-y-1"><span className="text-xs text-gray-600">故障现象描述</span><textarea className="ui-input min-h-20 w-full" value={form.symptom} onChange={(event) => setValue('symptom', event.target.value)} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1"><span className="text-xs text-gray-600">已做排查动作</span><textarea className="ui-input min-h-20 w-full" value={form.siteTroubleshooting} onChange={(event) => setValue('siteTroubleshooting', event.target.value)} /></label><label className="block space-y-1"><span className="text-xs text-gray-600">临时解决方案</span><textarea className="ui-input min-h-20 w-full" value={form.temporarySolution} onChange={(event) => setValue('temporarySolution', event.target.value)} /></label></div><div className="grid gap-3 sm:grid-cols-3"><CategorySelect label="一级故障原因分类" value={form.causeLevel1} options={ISSUE_CAUSE_LEVEL_1} onChange={(value: string) => setValue('causeLevel1', value)} /><CategorySelect label="二级故障原因分类" value={form.causeLevel2} options={ISSUE_CAUSE_LEVEL_2} onChange={(value: string) => setValue('causeLevel2', value)} /><CategorySelect label="三级故障分类" value={form.causeLevel3} options={ISSUE_CAUSE_LEVEL_3} onChange={(value: string) => setValue('causeLevel3', value)} /></div></section><section className="space-y-2 border-t border-gray-100 pt-4"><p className="text-xs font-medium text-gray-700">当前处理结果 <span className="text-red-500">*</span></p>{TECHNICAL_SUPPORT_DECISIONS.map((item) => <label key={item} className={`flex items-start gap-2 rounded-md border p-3 text-[13px] ${disabled(item) ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'cursor-pointer border-gray-200 hover:bg-gray-50'}`}><input type="radio" name="technical-decision" disabled={disabled(item)} checked={decision === item} onChange={() => { setDecision(item); setError(''); }} /><span>{technicalSupportDecisionLabel(item)}{reason(item) && <small className="mt-1 block text-xs text-gray-400">{reason(item)}</small>}</span></label>)}</section><label className="block space-y-1"><span className="text-xs text-gray-600">{decision === '升级研发协助' ? '研发协助说明' : '本次处理说明'} <b className="text-red-500">*</b></span>{decision === '升级研发协助' && <p className="text-xs text-gray-400">请说明需要研发协助判断的问题、当前排查情况或希望研发提供的支持。</p>}<textarea className="ui-input min-h-20 w-full" value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} /></label>{error && <p className="text-xs text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!decision || !note.trim()} onClick={submit}>{submitLabel}</Btn></div></div></Modal>;
}

function QualityFollowUpModal({ isOpen, issue, onClose, onSave }: { isOpen: boolean; issue?: IssueRecord; onClose: () => void; onSave: (values: QualityFollowUpValues) => void }) {
  const [values, setValues] = useState<QualityFollowUpValues>({ resolutionStatus: issue?.resolutionStatus || '', assignee: issue?.assignee || '', rootCause: issue?.rootCause || '', longTermSolution: issue?.longTermSolution || '', isClosed: issue?.isClosed || '' });
  useEffect(() => {
    if (!isOpen || !issue) return;
    setValues({ resolutionStatus: issue.resolutionStatus, assignee: issue.assignee, rootCause: issue.rootCause, longTermSolution: issue.longTermSolution, isClosed: issue.isClosed });
  }, [isOpen, issue]);
  if (!issue) return null;
  return <Modal isOpen={isOpen} onClose={onClose} title="更新质量跟进"><div className="space-y-4"><p className="text-xs text-gray-500">维护当前问题的质量分析、长期措施和闭环信息。</p><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1"><span className="text-xs text-gray-600">解决状态</span><Select value={values.resolutionStatus} onChange={(event) => setValues((previous) => ({ ...previous, resolutionStatus: event.target.value }))}><option value="">未填写</option>{ISSUE_RESOLUTION_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select></label><label className="block space-y-1"><span className="text-xs text-gray-600">处理人</span><Input value={values.assignee} onChange={(event) => setValues((previous) => ({ ...previous, assignee: event.target.value }))} /></label></div><label className="block space-y-1"><span className="text-xs text-gray-600">根因分析（研发/供应商）</span><textarea className="ui-input min-h-20 w-full" value={values.rootCause} onChange={(event) => setValues((previous) => ({ ...previous, rootCause: event.target.value }))} /></label><label className="block space-y-1"><span className="text-xs text-gray-600">长期问题解决方案（跟进状态）</span><textarea className="ui-input min-h-20 w-full" value={values.longTermSolution} onChange={(event) => setValues((previous) => ({ ...previous, longTermSolution: event.target.value }))} /></label><label className="block space-y-1"><span className="text-xs text-gray-600">问题是否闭环</span><Select value={values.isClosed} onChange={(event) => setValues((previous) => ({ ...previous, isClosed: event.target.value }))}><option value="">未填写</option>{ISSUE_CLOSURE_VALUES.map((item) => <option key={item}>{item}</option>)}</Select></label><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={() => onSave(values)}>保存质量跟进</Btn></div></div></Modal>;
}

function ResearchFeedbackModal({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (content: string) => void }) {
  const [content, setContent] = useState('');
  useEffect(() => { if (isOpen) setContent(''); }, [isOpen]);
  return <Modal isOpen={isOpen} onClose={onClose} title="记录研发反馈"><div className="space-y-4"><label className="block space-y-1"><span className="text-xs text-gray-600">研发反馈 / 分析建议 <b className="text-red-500">*</b></span><textarea className="ui-input min-h-24 w-full" value={content} onChange={(event) => setContent(event.target.value)} /></label><div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!content.trim()} onClick={() => onSave(content)}>保存反馈</Btn></div></div></Modal>;
}

function AfterSalesOrdersList({ orders, onView }: AfterSalesOrdersListProps) {
  const [filters, setFilters] = useState({ query: '', project: '', status: '', engineer: '' });
  const filtered = orders.filter((order) => {
    const key = filters.query.toLowerCase();
    return (!key || `${order.orderNo} ${order.issueNo}`.toLowerCase().includes(key)) && (!filters.project || order.snapshot.projectName === filters.project) && (!filters.status || order.status === filters.status) && (!filters.engineer || order.engineer === filters.engineer);
  });
  const projectOptions = [...new Set(nonEmptyStrings(orders.map((item) => item.snapshot.projectName)))];
  const engineerOptions = [...new Set(nonEmptyStrings(orders.map((item) => item.engineer)))];
  return <><Toolbar><SearchInput className="w-56" placeholder="工单号 / 问题编号" value={filters.query} onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))} /><Select value={filters.project} onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}><option value="">全部项目</option>{projectOptions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">全部状态</option>{ACTIVE_AFTER_SALES_STATUSES.concat(['已关单', '已取消']).map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.engineer} onChange={(event) => setFilters((prev) => ({ ...prev, engineer: event.target.value }))}><option value="">全部售后工程师</option>{engineerOptions.map((item) => <option key={item}>{item}</option>)}</Select></Toolbar><Section title={`售后工单（${filtered.length}）`} bodyClassName="p-0"><Table tableClassName="min-w-[1200px]" head={['售后工单号', '来源问题编号', '客户名称', '项目', '设备标识', '故障现象描述', '当前状态', '售后工程师', '预计上门时间', '更新时间', '操作']} empty="暂无售后工单。请在问题详情完成技术客服预处理后转入。">{filtered.map((order) => <tr key={order.id}><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.orderNo}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.issueNo}</td><td className="px-3 py-2">{order.snapshot.customerName || '—'}</td><td className="px-3 py-2">{order.snapshot.projectName || '—'}</td><td className="px-3 py-2 font-mono text-xs">{order.snapshot.deviceIdentifier || '—'}</td><td className="w-[280px] px-3 py-2 text-xs text-gray-600" title={order.snapshot.symptom}><span className="block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{order.snapshot.symptom || '—'}</span></td><td className="px-3 py-2"><StatusBadge status={order.status} /></td><td className="px-3 py-2">{order.engineer || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.plannedVisitAt || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.updatedAt}</td><td className="whitespace-nowrap px-3 py-2"><button className="ui-link text-[13px]" onClick={() => onView(order)}>查看详情</button></td></tr>)}</Table></Section></>;
}
