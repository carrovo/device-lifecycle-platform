import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, Page, PageHeader, Section, StatCard, StatGrid, Table } from '../components/ui';
import { ACTIVE_AFTER_SALES_STATUSES } from '../data/afterSalesOrders';

const TABS = [
  { key: 'delivery', label: '交付看板' },
  { key: 'quality', label: '质量看板' },
  { key: 'after-sales', label: '售后看板' },
] as const;

type DashboardTab = (typeof TABS)[number]['key'];
type DistributionItem = { label: string; count: number };

const label = (value?: string) => value || '未填写';
const isActiveDeliveryTask = (status: string) => !['已完成', '已取消'].includes(status);
const isUnresolvedBlock = (status: string) => status !== '已解除';

function distribution(rows: any[], getValue: (row: any) => string | undefined): DistributionItem[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = label(getValue(row));
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([itemLabel, count]) => ({ label: itemLabel, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function Distribution({ items, empty }: { items: DistributionItem[]; empty: string }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  const maximum = Math.max(...items.map((item) => item.count), 1);
  return <div className="space-y-3">{items.map((item) => <div key={item.label} className="grid grid-cols-[minmax(92px,180px)_1fr_28px] items-center gap-3 text-xs"><span className="truncate text-gray-600" title={item.label}>{item.label}</span><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-gray-700" style={{ width: `${(item.count / maximum) * 100}%` }} /></div><span className="text-right text-gray-500">{item.count}</span></div>)}</div>;
}

function TabBar({ active, onChange }: { active: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  return <div className="mb-5 flex gap-1 border-b border-gray-200">{TABS.map((tab) => <button key={tab.key} onClick={() => onChange(tab.key)} className={`border-b-2 px-3 py-2 text-[13px] transition-colors ${active === tab.key ? 'border-gray-900 font-medium text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{tab.label}</button>)}</div>;
}

function DeliveryDashboard({ state }: { state: any }) {
  const deployments = state.deliverySubOrders.filter((item) => item.type === 'deployment');
  const deviceRecords = deployments.flatMap((item) => item.devices.map((device) => ({ ...device, subOrder: item })));
  const activeTasks = deployments.filter((item) => isActiveDeliveryTask(item.status));
  const unresolvedBlocks = deployments.flatMap((item) => item.blocks.filter((block) => isUnresolvedBlock(block.status)).map((block) => ({ ...block, subOrder: item })));
  const projectName = (subOrder: any) => state.deliveryPlans.find((item) => item.id === subOrder.deliveryPlanId)?.projectName || state.projects.find((item) => item.id === state.deliveryPlans.find((plan) => plan.id === subOrder.deliveryPlanId)?.projectId)?.name || '—';
  const locationName = (subOrder: any) => state.locations.find((item) => item.id === subOrder.locationId)?.name || '—';
  const taskLabel = (subOrder: any) => subOrder.type === 'preparation' ? '舱体进场及水电部署' : '机器人／设备部署';
  const blocksForAllTasks = state.deliverySubOrders.flatMap((item) => item.blocks.filter((block) => isUnresolvedBlock(block.status)).map((block) => ({ ...block, subOrder: item })));

  return <div className="space-y-4">
    <StatGrid cols={4}><StatCard label="进行中交付子工单" value={activeTasks.length} /><StatCard label="待验收设备" value={deviceRecords.filter((item) => !item.acceptanceResult).length} tone="warning" /><StatCard label="验收未通过设备" value={deviceRecords.filter((item) => item.acceptanceResult === '未通过').length} tone="danger" /><StatCard label="未解决交付阻塞" value={blocksForAllTasks.length} tone={blocksForAllTasks.length ? 'warning' : 'default'} /></StatGrid>
    <div className="grid gap-4 xl:grid-cols-2"><Section title="任务状态分布"><Distribution items={distribution(state.deliverySubOrders, (item) => item.status)} empty="暂无交付子工单数据。" /></Section><Section title="设备执行情况"><div className="space-y-5"><div><p className="mb-3 text-xs font-medium text-gray-700">安装调试状态</p><Distribution items={distribution(deviceRecords, (item) => item.installationStatus)} empty="暂无设备执行记录。" /></div><div><p className="mb-3 text-xs font-medium text-gray-700">验收结果</p><Distribution items={distribution(deviceRecords, (item) => item.acceptanceResult || '未记录')} empty="暂无设备验收记录。" /></div></div></Section></div>
    <Section title="当前交付阻塞" bodyClassName="p-0"><Table head={['项目', '点位', '阻塞内容', '关联任务', '操作']} empty="暂无未解决交付阻塞。">{unresolvedBlocks.map((block) => <tr key={block.id}><td className="px-3 py-2">{projectName(block.subOrder)}</td><td className="px-3 py-2">{locationName(block.subOrder)}</td><td className="px-3 py-2 text-xs text-gray-600">{block.reason}</td><td className="px-3 py-2 text-xs">{taskLabel(block.subOrder)}</td><td className="whitespace-nowrap px-3 py-2"><Link className="ui-link text-[13px]" to={`/delivery-plans/${block.subOrder.deliveryPlanId}/sub-orders/${block.subOrder.id}`}>查看任务</Link></td></tr>)}</Table></Section>
    <Section title="当前交付任务" bodyClassName="p-0"><Table head={['项目', '点位', '子工单类型', '当前状态', '更新时间', '操作']} empty="暂无进行中的交付任务。">{activeTasks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((subOrder) => <tr key={subOrder.id}><td className="px-3 py-2">{projectName(subOrder)}</td><td className="px-3 py-2">{locationName(subOrder)}</td><td className="px-3 py-2">{taskLabel(subOrder)}</td><td className="px-3 py-2"><StatusBadge status={subOrder.status} /></td><td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{subOrder.updatedAt}</td><td className="whitespace-nowrap px-3 py-2"><Link className="ui-link text-[13px]" to={`/delivery-plans/${subOrder.deliveryPlanId}/sub-orders/${subOrder.id}`}>查看任务</Link></td></tr>)}</Table></Section>
  </div>;
}

function QualityDashboard({ state }: { state: any }) {
  const issues = state.issueRecords;
  const unclosed = issues.filter((item) => item.isClosed !== '是');
  return <div className="space-y-4">
    <StatGrid cols={4}><StatCard label="问题总数" value={issues.length} /><StatCard label="未闭环" value={unclosed.length} tone="warning" /><StatCard label="已闭环" value={issues.filter((item) => item.isClosed === '是').length} tone="success" /><StatCard label="根因分析进行中" value={issues.filter((item) => item.resolutionStatus === '根因分析进行中').length} /></StatGrid>
    <div className="grid gap-4 xl:grid-cols-2"><Section title="解决状态分布"><Distribution items={distribution(issues, (item) => item.resolutionStatus)} empty="暂无问题数据。" /></Section><Section title="一级故障原因分布"><Distribution items={distribution(issues, (item) => item.causeLevel1)} empty="问题记录产生后将在此展示故障分类分布。" /></Section></div>
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"><Section title="问题闭环情况"><Distribution items={distribution(issues, (item) => item.isClosed)} empty="暂无问题数据。" /></Section><Section title="当前未闭环问题" bodyClassName="p-0"><Table head={['问题编号', '设备', '故障现象', '一级分类', '解决状态', '处理人', '操作']} empty="暂无未闭环问题。">{unclosed.slice().sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).map((issue) => <tr key={issue.id}><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{issue.issueNo}</td><td className="px-3 py-2 font-mono text-xs">{issue.deviceIdentifier || '—'}</td><td className="max-w-[260px] px-3 py-2 text-xs text-gray-600"><span className="block truncate" title={issue.symptom}>{issue.symptom || '—'}</span></td><td className="px-3 py-2">{issue.causeLevel1 || '—'}</td><td className="px-3 py-2"><StatusBadge status={issue.resolutionStatus || '—'} /></td><td className="px-3 py-2">{issue.assignee || '—'}</td><td className="whitespace-nowrap px-3 py-2"><Link className="ui-link text-[13px]" to={`/after-sales?issue=${encodeURIComponent(issue.id)}`}>查看问题</Link></td></tr>)}</Table></Section></div>
  </div>;
}

function AfterSalesDashboard({ state }: { state: any }) {
  const orders = state.afterSalesOrders;
  const activeOrders = orders.filter((item) => ACTIVE_AFTER_SALES_STATUSES.includes(item.status));
  const issuesById = new Map(state.issueRecords.map((item) => [item.id, item]));
  const closedOrders = orders.filter((item) => item.status === '已关单');
  return <div className="space-y-4">
    <StatGrid cols={5}><StatCard label="进行中工单" value={activeOrders.length} /><StatCard label="待分派" value={orders.filter((item) => item.status === '待分派').length} /><StatCard label="待上门" value={orders.filter((item) => item.status === '待上门').length} tone="warning" /><StatCard label="现场处理中" value={orders.filter((item) => item.status === '现场处理中').length} tone="warning" /><StatCard label="已关单" value={closedOrders.length} tone="success" /></StatGrid>
    <div className="grid gap-4 xl:grid-cols-2"><Section title="工单状态分布"><Distribution items={distribution(orders, (item) => item.status)} empty="暂无售后工单数据。" /></Section><Section title="来源问题一级分类"><Distribution items={distribution(orders, (item) => issuesById.get(item.issueId)?.causeLevel1)} empty="暂无售后工单数据。" /></Section></div>
    <Section title="当前进行中售后" bodyClassName="p-0"><Table head={['售后工单', '来源问题', '设备', '售后工程师', '当前状态', '预计上门', '操作']} empty="暂无进行中的售后工单。">{activeOrders.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((order) => <tr key={order.id}><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.orderNo}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.issueNo}</td><td className="px-3 py-2 font-mono text-xs">{order.snapshot.deviceIdentifier || '—'}</td><td className="px-3 py-2">{order.engineer || '—'}</td><td className="px-3 py-2"><StatusBadge status={order.status} /></td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.plannedVisitAt || '—'}</td><td className="whitespace-nowrap px-3 py-2"><Link className="ui-link text-[13px]" to={`/after-sales/orders/${order.id}`}>查看工单</Link></td></tr>)}</Table></Section>
    <Section title="近期关单记录" bodyClassName="p-0"><Table head={['售后工单', '设备', '来源问题', '现场处理结果', '关单时间', '操作']} empty="暂无关单记录。">{closedOrders.slice().sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || '')).map((order) => <tr key={order.id}><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.orderNo}</td><td className="px-3 py-2 font-mono text-xs">{order.snapshot.deviceIdentifier || '—'}</td><td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{order.issueNo}</td><td className="px-3 py-2">{order.finalResult || '—'}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{order.closedAt || '—'}</td><td className="whitespace-nowrap px-3 py-2"><Link className="ui-link text-[13px]" to={`/after-sales/orders/${order.id}`}>查看工单</Link></td></tr>)}</Table></Section>
  </div>;
}

export default function DashboardPage() {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get('tab');
  const active: DashboardTab = TABS.some((item) => item.key === current) ? current as DashboardTab : 'delivery';
  const setActive = (tab: DashboardTab) => setSearchParams(tab === 'delivery' ? {} : { tab });

  return <Page>
    <PageHeader title="看板中心" description="查看交付、质量和售后当前记录。" />
    <TabBar active={active} onChange={setActive} />
    {active === 'delivery' && <DeliveryDashboard state={state} />}
    {active === 'quality' && <QualityDashboard state={state} />}
    {active === 'after-sales' && <AfterSalesDashboard state={state} />}
  </Page>;
}
