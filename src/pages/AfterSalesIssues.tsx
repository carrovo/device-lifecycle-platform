import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Btn, DescList, Input, Page, PageHeader, Section, Select, SearchInput, Table, Toolbar } from '../components/ui';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import IssueRecordModal from '../components/issues/IssueRecordModal';
import { createClientId } from '../data/clientId';
import { nowText } from '../data/dateTime';
import { ACTIVE_AFTER_SALES_STATUSES, activeAfterSalesOrderForIssue, nextAfterSalesOrderNo } from '../data/afterSalesOrders';
import { ISSUE_CLOSURE_VALUES, ISSUE_RESOLUTION_STATUSES, TECHNICAL_SUPPORT_DECISIONS, nextIssueNo, type IssueRecord, type TechnicalSupportDecision } from '../data/issuePool';

const display = (value?: string) => value || '—';
const issueMaterials = (issue: IssueRecord) => issue.attachments?.length ? issue.attachments.map((item) => item.name).join('、') : '—';

type IssueListFilters = {
  query: string;
  project: string;
  status: string;
  assignee: string;
  closed: string;
};

type IssueListProps = {
  issues: IssueRecord[];
  state: { issueRecords: IssueRecord[] };
  filters: IssueListFilters;
  setFilters: Dispatch<SetStateAction<IssueListFilters>>;
  onSelect: (issue: IssueRecord) => void;
};

export default function AfterSalesIssues() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<any>(null);
  const [filters, setFilters] = useState({ query: '', project: '', status: '', assignee: '', closed: '' });
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
  const selectIssue = (issue: IssueRecord) => { const next = new URLSearchParams(searchParams); next.set('issue', issue.id); next.delete('tab'); setSearchParams(next); };
  const setTab = (nextTab: string) => { const next = new URLSearchParams(searchParams); next.delete('issue'); nextTab === 'issues' ? next.delete('tab') : next.set('tab', nextTab); setSearchParams(next); };
  const activeOrder = selected && activeAfterSalesOrderForIssue(state.afterSalesOrders, selected.id);

  const createIssue = (form: any) => {
    const id = createClientId('ISSUE');
    const created: IssueRecord = {
      id, issueNo: nextIssueNo(state.issueRecords), customerName: form.customerName.trim(), causeLevel1: form.causeLevel1.trim(), causeLevel2: form.causeLevel2.trim(), causeLevel3: form.causeLevel3.trim(), symptom: form.symptom.trim(), siteTroubleshooting: form.siteTroubleshooting.trim(), temporarySolution: form.temporarySolution.trim(),
      attachments: form.materialName.trim() ? [{ id: createClientId('ISSUEMAT'), name: form.materialName.trim(), purpose: form.materialPurpose.trim() || '问题资料', uploadedBy: state.currentUser || form.reporter.trim(), uploadedAt: nowText(), note: form.materialNote.trim() }] : [],
      reporter: form.reporter.trim(), deviceIdentifier: form.deviceIdentifier.trim(), reportedAt: form.reportedAt.replace('T', ' '), projectName: form.projectName, softwareVersion: form.softwareVersion.trim(), resolutionStatus: form.resolutionStatus || '', assignee: form.assignee.trim(), rootCause: form.rootCause.trim(), longTermSolution: form.longTermSolution.trim(), isClosed: form.isClosed || '', deviceId: form.deviceId || undefined, projectId: form.projectId || state.projects.find((item) => item.name === form.projectName)?.id,
      activityLogs: [{ id: createClientId('ISSUELOG'), time: nowText(), operator: state.currentUser || form.reporter.trim(), action: '创建问题', notes: '人工新建正式问题池记录' }],
    };
    dispatch({ type: 'ADD_ISSUE_RECORD', payload: created });
    setModal(null);
    selectIssue(created);
  };
  const updateIssue = (form: any) => {
    const existing = modal?.issue as IssueRecord | undefined;
    if (!existing) return;
    const currentActiveOrder = activeAfterSalesOrderForIssue(state.afterSalesOrders, existing.id);
    if (form.isClosed === '是' && currentActiveOrder) throw new Error(`当前问题仍有关联售后工单 ${currentActiveOrder.orderNo} 处理中，请先完成或取消售后工单。`);
    const previousStatus = existing.resolutionStatus || '—';
    const previousClosed = existing.isClosed || '—';
    const updated = {
      ...existing, customerName: form.customerName.trim(), causeLevel1: form.causeLevel1.trim(), causeLevel2: form.causeLevel2.trim(), causeLevel3: form.causeLevel3.trim(), symptom: form.symptom.trim(), siteTroubleshooting: form.siteTroubleshooting.trim(), temporarySolution: form.temporarySolution.trim(),
      attachments: form.materialName.trim() ? [...(existing.attachments || []), { id: createClientId('ISSUEMAT'), name: form.materialName.trim(), purpose: form.materialPurpose.trim() || '问题资料', uploadedBy: state.currentUser || form.reporter.trim(), uploadedAt: nowText(), note: form.materialNote.trim() }] : existing.attachments,
      reporter: form.reporter.trim(), deviceIdentifier: form.deviceIdentifier.trim(), reportedAt: form.reportedAt.replace('T', ' '), projectName: form.projectName, softwareVersion: form.softwareVersion.trim(), resolutionStatus: form.resolutionStatus || '', assignee: form.assignee.trim(), rootCause: form.rootCause.trim(), longTermSolution: form.longTermSolution.trim(), isClosed: form.isClosed || '', deviceId: form.deviceId || existing.deviceId, projectId: form.projectId || existing.projectId,
    };
    const notes = [`已更新问题台账字段`];
    if (previousStatus !== (updated.resolutionStatus || '—')) notes.push(`解决状态：${previousStatus} → ${updated.resolutionStatus || '—'}`);
    if (previousClosed !== (updated.isClosed || '—')) notes.push(`问题是否闭环：${previousClosed} → ${updated.isClosed || '—'}`);
    dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: { ...updated, activityLogs: [...(existing.activityLogs || []), { id: createClientId('ISSUELOG'), time: nowText(), operator: state.currentUser || '当前用户', action: '编辑问题', notes: notes.join('；') }] } });
    setModal(null);
  };
  const saveTechnicalSupport = (decision: TechnicalSupportDecision, note: string) => {
    if (!selected) return;
    const currentActiveOrder = activeAfterSalesOrderForIssue(state.afterSalesOrders, selected.id);
    if (decision === '转交付侧处理' && !selected.deliveryContext) throw new Error('当前问题无关联交付任务，不适用该处理判断。');
    if (decision === '需要现场处理，转售后工单') {
      if (selected.isClosed === '是') throw new Error('当前问题已明确闭环，如需重新处理请先调整问题记录。');
      if (!selected.symptom.trim()) throw new Error('请先补充故障现象描述。');
      if (!selected.deviceIdentifier.trim() && !selected.deviceId) throw new Error('请先补充可定位的设备标识。');
      if (currentActiveOrder) throw new Error(`当前已有售后工单 ${currentActiveOrder.orderNo}。`);
    }
    const handledAt = nowText();
    const technicalSupport = { decision, note: note.trim(), handler: state.currentUser || '技术客服', handledAt };
    const updatedIssue = { ...selected, technicalSupport, activityLogs: [...(selected.activityLogs || []), { id: createClientId('ISSUELOG'), time: handledAt, operator: technicalSupport.handler, action: '技术客服预处理', notes: `处理判断：${decision}${note.trim() ? `；${note.trim()}` : ''}` }] };
    if (decision !== '需要现场处理，转售后工单') {
      dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: updatedIssue });
      setModal(null);
      return;
    }
    const id = createClientId('ASO');
    const order = {
      id, orderNo: nextAfterSalesOrderNo(state.afterSalesOrders), issueId: selected.id, issueNo: selected.issueNo, deviceId: selected.deviceId, projectId: selected.projectId, deliveryPlanId: selected.deliveryContext?.deliveryPlanId, sourceSubOrderId: selected.deliveryContext?.subOrderId, locationId: selected.deliveryContext?.locationId, batchId: selected.deliveryContext?.batchId, status: '待分派' as const,
      snapshot: { customerName: selected.customerName, projectName: selected.projectName, deviceIdentifier: selected.deviceIdentifier, symptom: selected.symptom, causeLevel1: selected.causeLevel1, causeLevel2: selected.causeLevel2, causeLevel3: selected.causeLevel3, rootCause: selected.rootCause, longTermSolution: selected.longTermSolution, attachments: selected.attachments || [], technicalSupport },
      materials: [], createdAt: handledAt, updatedAt: handledAt,
      logs: [{ id: createClientId('ASOLOG'), time: handledAt, operator: technicalSupport.handler, action: '创建售后工单', notes: `来源问题：${selected.issueNo}；技术客服判断：${decision}；工单状态：— → 待分派` }],
    };
    dispatch({ type: 'ADD_AFTER_SALES_ORDER', payload: order });
    dispatch({ type: 'UPDATE_ISSUE_RECORD', payload: { ...updatedIssue, activityLogs: [...updatedIssue.activityLogs, { id: createClientId('ISSUELOG'), time: handledAt, operator: technicalSupport.handler, action: '转为售后工单', notes: `问题 ${selected.issueNo} 已关联售后工单 ${order.orderNo}` }] } });
    setModal(null);
    navigate(`/after-sales/orders/${id}`);
  };

  return <Page>
    <PageHeader title={selected ? selected.issueNo : tab === 'orders' ? '售后工单' : '问题池'} description={selected ? '问题详情完整展示飞书台账 19 个字段；技术客服判断独立记录。' : tab === 'orders' ? '售后工单仅能由技术客服预处理判断为现场处理的问题转入。' : '统一记录交付与正常运营阶段发现的设备问题。'} actions={!selected && tab === 'issues' ? <Btn variant="primary" onClick={() => setModal({ type: 'create' })}>人工新建问题</Btn> : undefined} />
    {!selected && <div className="flex gap-1 border-b border-gray-200"><button className={`px-3 py-2 text-[13px] border-b-2 ${tab === 'issues' ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500'}`} onClick={() => setTab('issues')}>问题池</button><button className={`px-3 py-2 text-[13px] border-b-2 ${tab === 'orders' ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500'}`} onClick={() => setTab('orders')}>售后工单</button></div>}
    {selected ? <IssueDetail issue={selected} state={state} activeOrder={activeOrder} orders={state.afterSalesOrders.filter((item) => item.issueId === selected.id)} onBack={() => setTab('issues')} onEdit={() => setModal({ type: 'edit', issue: selected })} onTechnical={(decision?: TechnicalSupportDecision) => setModal({ type: 'technical', decision })} /> : tab === 'orders' ? <AfterSalesOrdersList orders={state.afterSalesOrders} onView={(order: any) => navigate(`/after-sales/orders/${order.id}`)} /> : <IssueList issues={issues} state={state} filters={filters} setFilters={setFilters} onSelect={selectIssue} />}
    <IssueRecordModal key={`issue-form-${modal?.type}-${modal?.issue?.id || 'new'}`} isOpen={modal?.type === 'create' || modal?.type === 'edit'} onClose={() => setModal(null)} onSave={modal?.type === 'edit' ? updateIssue : createIssue} defaults={modal?.issue ? { ...modal.issue, reportedAt: modal.issue.reportedAt?.replace(' ', 'T'), materialName: '', materialPurpose: '问题资料', materialNote: '' } : { reporter: state.currentUser || '', reportedAt: nowText().replace(' ', 'T') }} devices={state.devices} projects={state.projects} currentUser={state.currentUser} editing={modal?.type === 'edit'} title={modal?.type === 'edit' ? '编辑问题' : '人工新建问题'} submitLabel="保存问题" />
    <TechnicalSupportModal key={`technical-form-${modal?.decision || 'new'}`} isOpen={modal?.type === 'technical'} issue={selected} activeOrder={activeOrder} initialDecision={modal?.decision} onClose={() => setModal(null)} onSave={saveTechnicalSupport} />
  </Page>;
}

function IssueList({ issues, state, filters, setFilters, onSelect }: IssueListProps) {
  const projectOptions = [...new Set(state.issueRecords
    .map((item) => item.projectName)
    .filter((value): value is string => Boolean(value)))];
  const assigneeOptions = [...new Set(state.issueRecords
    .map((item) => item.assignee)
    .filter((value): value is string => Boolean(value)))];

  return <><Toolbar><SearchInput className="w-64" placeholder="问题编号 / 故障现象 / SN" value={filters.query} onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))} /><Select value={filters.project} onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}><option value="">全部项目</option>{projectOptions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">全部解决状态</option><option value="__empty">未填写</option>{ISSUE_RESOLUTION_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.assignee} onChange={(event) => setFilters((prev) => ({ ...prev, assignee: event.target.value }))}><option value="">全部处理人</option>{assigneeOptions.map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.closed} onChange={(event) => setFilters((prev) => ({ ...prev, closed: event.target.value }))}><option value="">全部闭环状态</option><option value="__empty">未填写</option>{ISSUE_CLOSURE_VALUES.map((item) => <option key={item}>{item}</option>)}</Select></Toolbar><Section title={`问题池（${issues.length}）`} bodyClassName="p-0"><Table tableClassName="min-w-[1260px]" head={['问题编号', '客户名称', '故障现象描述', '机器人 SN 编号 or 设备 WIFI 名称', '项目', '提报人', '提报时间', '解决状态', '处理人', '问题是否闭环', '操作']} empty="暂无问题记录">{issues.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="w-32 whitespace-nowrap px-3 py-2 font-mono text-xs"><button className="ui-link" onClick={() => onSelect(item)}>{item.issueNo}</button></td><td className="px-3 py-2">{item.customerName || '—'}</td><td className="w-[340px] px-3 py-2 text-xs leading-5 text-gray-600" title={item.symptom || ''}><span className="block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.symptom || '—'}</span></td><td className="w-44 whitespace-nowrap px-3 py-2 font-mono text-xs">{item.deviceIdentifier || '—'}</td><td className="px-3 py-2">{item.projectName || '—'}</td><td className="px-3 py-2">{item.reporter || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{item.reportedAt || '—'}</td><td className="px-3 py-2"><StatusBadge status={display(item.resolutionStatus)} /></td><td className="px-3 py-2">{item.assignee || '—'}</td><td className="px-3 py-2"><StatusBadge status={display(item.isClosed)} /></td><td className="w-24 whitespace-nowrap px-3 py-2"><button className="ui-link text-[13px]" onClick={() => onSelect(item)}>查看详情</button></td></tr>)}</Table></Section></>;
}

function IssueDetail({ issue, state, activeOrder, orders, onBack, onEdit, onTechnical }: any) {
  const device = issue.deviceId ? state.devices.find((item) => item.id === issue.deviceId) : undefined;
  const deliveryOrder = issue.deliveryContext ? state.deliverySubOrders.find((item) => item.id === issue.deliveryContext.subOrderId) : undefined;
  const location = deliveryOrder ? state.locations.find((item) => item.id === deliveryOrder.locationId) : undefined;
  const deliveryLabel = deliveryOrder ? `${deliveryOrder.type === 'preparation' ? '舱体进场及水电部署' : '机器人／设备部署'} · ${location?.name || '当前交付点位'}` : '—';
  return <>
    <div className="flex items-center justify-between gap-3"><Btn onClick={onBack}>返回问题池</Btn><Btn onClick={onEdit}>编辑问题</Btn></div>
    <TechnicalSupportCard issue={issue} activeOrder={activeOrder} orders={orders} onStart={onTechnical} />
    <Section title="基础信息"><DescList cols={3} items={[["问题编号", issue.issueNo], ['客户名称', display(issue.customerName)], ['项目', display(issue.projectName)], ['机器人 SN 编号 or 设备 WIFI 名称', display(issue.deviceIdentifier)], ['软件版本号', display(issue.softwareVersion)], ['提报人', display(issue.reporter)], ['提报时间', display(issue.reportedAt)]]} /></Section>
    <Section title="问题描述"><DescList cols={2} items={[["故障现象描述", display(issue.symptom)], ['现场已做的排查动作', display(issue.siteTroubleshooting)], ['临时解决方案', display(issue.temporarySolution)], ['详情上传（图片&视频&log）', issueMaterials(issue)]]} /></Section>
    <Section title="故障分类"><DescList cols={3} items={[["一级故障原因分类", display(issue.causeLevel1)], ['二级故障原因分类', display(issue.causeLevel2)], ['三级故障分类', display(issue.causeLevel3)]]} /></Section>
    <Section title="处理跟进"><DescList cols={2} items={[["解决状态", <StatusBadge status={display(issue.resolutionStatus)} />], ['处理人', display(issue.assignee)], ['根因分析（研发/供应商）', display(issue.rootCause)], ['长期问题解决方案（跟进状态）', display(issue.longTermSolution)], ['问题是否闭环', <StatusBadge status={display(issue.isClosed)} />]]} /></Section>
    <Section title="系统关联" subtitle="仅用于导航和追溯，不属于问题池业务字段。"><DescList cols={3} items={[["关联设备", device ? <span>{device.robotNo} / {device.sn} <Link className="ui-link ml-2" to={`/devices/${device.id}`}>查看设备</Link></span> : issue.deviceId ? <Link className="ui-link font-mono text-xs" to={`/devices/${issue.deviceId}?tab=project`}>{display(issue.deviceIdentifier)} · 查看设备</Link> : display(issue.deviceIdentifier)], ['关联交付任务', deliveryOrder ? <Link className="ui-link" to={`/delivery-plans/${issue.deliveryContext.deliveryPlanId}/sub-orders/${deliveryOrder.id}`}>{deliveryLabel} · 查看交付任务</Link> : '—'], ['关联售后工单', orders.length ? orders.map((order) => <Link key={order.id} className="ui-link mr-2 font-mono text-xs" to={`/after-sales/orders/${order.id}`}>{order.orderNo}</Link>) : '—']]} /></Section>
    <Section title={`操作日志（${issue.activityLogs?.length || 0}）`} bodyClassName="p-0"><Table head={['时间', '操作人', '操作内容', '说明']} empty="暂无问题操作日志">{(issue.activityLogs || []).slice().reverse().map((log) => <tr key={log.id}><td className="px-3 py-2 text-xs text-gray-500">{log.time}</td><td className="px-3 py-2">{log.operator}</td><td className="px-3 py-2">{log.action}</td><td className="px-3 py-2 text-xs text-gray-600">{log.notes}</td></tr>)}</Table></Section>
  </>;
}

function TechnicalSupportCard({ issue, activeOrder, orders, onStart }: any) {
  const latest = issue.technicalSupport;
  const latestOrder = orders?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const handoffHint = latest?.decision === '转交付侧处理' ? '当前待办：返回关联交付任务继续处理。' : latest?.decision === '需要现场处理，转售后工单' && activeOrder ? `关联售后工单 ${activeOrder.orderNo} 当前状态：${activeOrder.status}。` : latest?.decision === '需要现场处理，转售后工单' && latestOrder?.status === '已关单' ? latestOrder.issueOutcome === 'resolved' ? '售后现场处理已完成，来源问题已同步闭环。' : '售后现场处理已完成，当前问题继续观察。' : '技术客服判断仅记录流程动作，不会自动修改问题台账字段。';
  const readyForOnsite = latest?.decision === '需要现场处理，转售后工单' && !activeOrder && issue.isClosed !== '是' && issue.symptom && (issue.deviceIdentifier || issue.deviceId);
  return <Section title="技术客服预处理" subtitle="流程记录，不属于问题池 19 个业务字段。" right={<div className="flex gap-2">{readyForOnsite && <Btn variant="primary" onClick={() => onStart('需要现场处理，转售后工单')}>确认并转为售后工单</Btn>}<Btn onClick={() => onStart()}>{latest ? '重新判断' : '进行技术客服预处理'}</Btn></div>}><div className="space-y-2 text-[13px]"><div><span className="text-gray-400">当前处理判断：</span>{latest ? latest.decision : '尚未判断'}</div>{latest && <><div><span className="text-gray-400">判断说明：</span>{latest.note || '—'}</div><div><span className="text-gray-400">处理人：</span>{latest.handler} <span className="ml-3 text-gray-400">判断时间：</span>{latest.handledAt}</div></>}<p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">{handoffHint}</p>{activeOrder && <Link className="ui-link text-xs" to={`/after-sales/orders/${activeOrder.id}`}>查看售后工单 {activeOrder.orderNo}</Link>}</div></Section>;
}

function TechnicalSupportModal({ isOpen, issue, activeOrder, initialDecision, onClose, onSave }: any) {
  const [decision, setDecision] = useState<TechnicalSupportDecision | ''>(initialDecision || '');
  const [note, setNote] = useState(initialDecision ? issue?.technicalSupport?.note || '' : '');
  const [error, setError] = useState('');
  if (!issue) return null;
  const disabled = (item: TechnicalSupportDecision) => (item === '转交付侧处理' && !issue.deliveryContext) || (item === '需要现场处理，转售后工单' && (issue.isClosed === '是' || activeOrder));
  const reason = (item: TechnicalSupportDecision) => item === '转交付侧处理' && !issue.deliveryContext ? '当前问题无关联交付任务，不适用该处理判断。' : item === '需要现场处理，转售后工单' && issue.isClosed === '是' ? '当前问题已明确闭环，如需重新处理请先调整问题记录。' : item === '需要现场处理，转售后工单' && activeOrder ? `当前已有售后工单 ${activeOrder.orderNo}。` : '';
  const submit = () => { if (!decision) return setError('请选择技术客服处理判断。'); if (!note.trim()) return setError('请填写本次判断说明。'); if (disabled(decision)) return setError(reason(decision)); try { onSave(decision, note); } catch (value) { setError(value instanceof Error ? value.message : '保存技术客服预处理失败。'); } };
  return <Modal isOpen={isOpen} onClose={onClose} title="进行技术客服预处理"><div className="space-y-4"><div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"><p>问题编号：{issue.issueNo}</p><p>客户：{display(issue.customerName)}　项目：{display(issue.projectName)}</p><p>设备标识：{display(issue.deviceIdentifier)}</p><p>故障现象：{display(issue.symptom)}</p><p>故障分类：{[issue.causeLevel1, issue.causeLevel2, issue.causeLevel3].filter(Boolean).join(' / ') || '—'}</p><p>现场排查：{display(issue.siteTroubleshooting)}　临时方案：{display(issue.temporarySolution)}</p><p>解决状态：{display(issue.resolutionStatus)}　处理人：{display(issue.assignee)}　问题是否闭环：{display(issue.isClosed)}</p></div><p className="text-xs text-gray-500">如需补充或修正故障描述、分类、根因或处理信息，请先编辑问题记录。</p><div className="space-y-2"><p className="text-xs font-medium text-gray-700">处理判断<span className="ml-1 text-red-500">*</span></p>{TECHNICAL_SUPPORT_DECISIONS.map((item) => <label key={item} className={`flex items-start gap-2 rounded-md border p-3 text-[13px] ${disabled(item) ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'cursor-pointer border-gray-200 hover:bg-gray-50'}`}><input type="radio" name="technical-decision" disabled={disabled(item)} checked={decision === item} onChange={() => { setDecision(item); setError(''); }} /><span>{item}<small className="mt-1 block text-xs text-gray-400">{reason(item)}</small></span></label>)}</div><label className="block space-y-1"><span className="text-xs text-gray-600">本次判断说明 <b className="text-red-500">*</b></span><textarea className="ui-input min-h-20 w-full" value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} /></label>{error && <p className="text-xs text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!decision || !note.trim()} onClick={submit}>{decision === '需要现场处理，转售后工单' ? '确认并转为售后工单' : '保存处理判断'}</Btn></div></div></Modal>;
}

function AfterSalesOrdersList({ orders, onView }: any) { const [filters, setFilters] = useState({ query: '', project: '', status: '', engineer: '' }); const filtered = orders.filter((order) => { const key = filters.query.toLowerCase(); return (!key || `${order.orderNo} ${order.issueNo}`.toLowerCase().includes(key)) && (!filters.project || order.snapshot.projectName === filters.project) && (!filters.status || order.status === filters.status) && (!filters.engineer || order.engineer === filters.engineer); }); return <><Toolbar><SearchInput className="w-56" placeholder="工单号 / 问题编号" value={filters.query} onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))} /><Select value={filters.project} onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}><option value="">全部项目</option>{[...new Set(orders.map((item) => item.snapshot.projectName).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">全部状态</option>{ACTIVE_AFTER_SALES_STATUSES.concat(['已关单', '已取消']).map((item) => <option key={item}>{item}</option>)}</Select><Select value={filters.engineer} onChange={(event) => setFilters((prev) => ({ ...prev, engineer: event.target.value }))}><option value="">全部售后工程师</option>{[...new Set(orders.map((item) => item.engineer).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</Select></Toolbar><Section title={`售后工单（${filtered.length}）`} bodyClassName="p-0"><Table tableClassName="min-w-[1200px]" head={['售后工单号', '来源问题编号', '客户名称', '项目', '设备标识', '故障现象描述', '当前状态', '售后工程师', '预计上门时间', '更新时间', '操作']} empty="暂无售后工单。请在问题详情完成技术客服预处理后转入。">{filtered.map((order) => <tr key={order.id}><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.orderNo}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.issueNo}</td><td className="px-3 py-2">{order.snapshot.customerName || '—'}</td><td className="px-3 py-2">{order.snapshot.projectName || '—'}</td><td className="px-3 py-2 font-mono text-xs">{order.snapshot.deviceIdentifier || '—'}</td><td className="w-[280px] px-3 py-2 text-xs text-gray-600" title={order.snapshot.symptom}><span className="block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{order.snapshot.symptom || '—'}</span></td><td className="px-3 py-2"><StatusBadge status={order.status} /></td><td className="px-3 py-2">{order.engineer || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.plannedVisitAt || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.updatedAt}</td><td className="whitespace-nowrap px-3 py-2"><button className="ui-link text-[13px]" onClick={() => onView(order)}>查看详情</button></td></tr>)}</Table></Section></>; }
