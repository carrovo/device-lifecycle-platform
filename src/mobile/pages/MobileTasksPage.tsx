import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import { useApp } from '../../context/AppContext';
import type { AfterSalesOrder } from '../../data/afterSalesOrders';
import { subOrderTypeLabel, type DeliverySubOrder } from '../../data/deliverySubOrders';

type DeliveryTaskReferences = {
  deliveryPlans: Array<{ id: string; projectId?: string }>;
  projects: Array<{ id: string; name?: string }>;
  locations: Array<{ id: string; name?: string }>;
};

const ORDER_RANK: Record<AfterSalesOrder['status'], number> = {
  '待接单': 0,
  '待上门': 1,
  '现场处理中': 2,
  '待分派': 3,
  '已关单': 4,
  '已取消': 5,
};

function taskHint(status: AfterSalesOrder['status']) {
  if (status === '待分派') return '等待分派';
  if (status === '待接单') return '请确认接单';
  if (status === '待上门') return '请安排并确认到场';
  if (status === '现场处理中') return '请记录现场处理';
  if (status === '已关单') return '已完成';
  return '已取消';
}

function MobileFrame({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh w-full bg-[#f5f5f5] sm:mx-auto sm:max-w-[430px] sm:border-x sm:border-gray-200">{children}</main>;
}

export default function MobileTasksPage() {
  const { state } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'delivery' ? 'delivery' : 'after-sales';
  const orders = [...(state.afterSalesOrders as AfterSalesOrder[])].sort((left, right) => {
    const rank = ORDER_RANK[left.status] - ORDER_RANK[right.status];
    return rank || right.updatedAt.localeCompare(left.updatedAt);
  });
  const deliveryOrders = [...(state.deliverySubOrders as DeliverySubOrder[])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return <MobileFrame>
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 pt-5">
      <h1 className="text-xl font-semibold text-gray-900">我的任务</h1>
      <div className="mt-4 flex gap-6 text-sm font-medium">
        <button type="button" onClick={() => setParams({ tab: 'delivery' })} className={`border-b-2 pb-3 ${tab === 'delivery' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>交付任务</button>
        <button type="button" onClick={() => setParams({ tab: 'after-sales' })} className={`border-b-2 pb-3 ${tab === 'after-sales' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>售后工单</button>
      </div>
    </header>
    <div className="space-y-3 p-4 pb-8">
      {tab === 'delivery' ? deliveryOrders.length ? deliveryOrders.map((order) => <DeliveryTaskCard key={order.id} order={order} state={state} />) : <EmptyState title="暂无交付任务" description="交付子工单分派后将在此展示。" /> : orders.length ? orders.map((order) => <TaskCard key={order.id} order={order} />) : <EmptyState title="暂无售后工单" description="售后工单分派后将在此展示。" />}
    </div>
  </MobileFrame>;
}

function DeliveryTaskCard({ order, state }: { order: DeliverySubOrder; state: DeliveryTaskReferences }) {
  const plan = state.deliveryPlans.find((item) => item.id === order.deliveryPlanId);
  const project = state.projects.find((item) => item.id === plan?.projectId);
  const location = state.locations.find((item) => item.id === order.locationId);
  const unresolvedBlocks = order.blocks.filter((item) => item.status !== '已解除').length;
  const completedChecks = order.checks.filter((item) => item.status === '已完成').length;
  const completedTasks = order.executionItems.filter((item) => item.status === '已完成').length;
  const progress = order.type === 'preparation'
    ? `前置检查 ${completedChecks} / ${order.checks.length}${unresolvedBlocks ? ` · 未解除阻塞 ${unresolvedBlocks}` : ''}`
    : `现场任务 ${completedTasks} / ${order.executionItems.filter((item) => item.requirement !== 'not-applicable').length} · 设备 ${order.devices.length} 台`;
  return <Link to={`/mobile/delivery/${order.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{order.name}</p><p className="mt-1 text-xs text-gray-500">{subOrderTypeLabel(order.type)}</p></div><StatusBadge status={order.status} /></div>
    <p className="mt-3 text-xs text-gray-600">{project?.name || '—'} · {location?.name || '—'}</p>
    <p className="mt-1 text-xs text-gray-500">计划时间：{order.plannedTime?.replace('T', ' ') || '—'} · 负责人：{order.type === 'deployment' ? order.engineer || '尚未分派' : order.owner || '—'}</p>
    <p className="mt-3 border-t border-gray-100 pt-3 text-xs font-medium text-gray-700">{progress}</p>
  </Link>;
}

function TaskCard({ order }: { order: AfterSalesOrder }) {
  const readOnly = order.status === '待分派' || order.status === '已关单' || order.status === '已取消';
  return <Link to={`/mobile/after-sales/${order.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300">
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-gray-800">{order.orderNo}</p><p className="mt-1 text-xs text-gray-500">{order.snapshot.projectName || '—'}{order.snapshot.customerName ? ` · ${order.snapshot.customerName}` : ''}</p></div><StatusBadge status={order.status} /></div>
    <p className="mt-3 text-sm font-medium text-gray-800">{order.snapshot.deviceIdentifier || '未填写设备标识'}</p>
    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{order.snapshot.symptom || '未填写故障现象描述'}</p>
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs"><span className={readOnly ? 'text-gray-400' : 'font-medium text-gray-700'}>{taskHint(order.status)}</span><span className="text-gray-400">预计上门：{order.plannedVisitAt || '—'}</span></div>
  </Link>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-14 text-center"><p className="text-sm font-medium text-gray-700">{title}</p><p className="mt-2 text-xs leading-5 text-gray-400">{description}</p></div>;
}
