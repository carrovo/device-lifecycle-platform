import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge';
import { Select, Table, Toolbar } from '../ui';
import { batchDisplayName } from '../../data/deliveryV2';
import { DELIVERY_SUB_ORDER_TYPES, SUB_ORDER_FILTER_STATUSES, subOrderNodeLabel, subOrderTypeLabel, type DeliverySubOrder } from '../../data/deliverySubOrders';

export default function DeliverySubOrderList({ subOrders, plan, state, returnTo }: { subOrders: DeliverySubOrder[]; plan: any; state: any; returnTo: string }) {
  const [filters, setFilters] = useState({ type: '', locationId: '', status: '' });
  const locations = state.locations.filter((item) => item.projectId === plan.projectId);
  const rows = useMemo(() => subOrders.filter((item) => (!filters.type || item.type === filters.type) && (!filters.locationId || item.locationId === filters.locationId) && (!filters.status || item.status === filters.status)), [filters, subOrders]);
  return <div className="space-y-3">
    <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 张子工单</span>}>
      <Select value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}><option value="">全部子工单类型</option>{DELIVERY_SUB_ORDER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
      <Select value={filters.locationId} onChange={(event) => setFilters((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">全部交付点位</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">全部当前状态</option>{SUB_ORDER_FILTER_STATUSES.map((item) => <option key={item}>{item}</option>)}</Select>
    </Toolbar>
    <Table tableClassName="min-w-[1180px]" head={['子工单编号和名称', '类型', '交付点位', '设备数', '执行工程师', '当前状态', '当前节点', '计划时间', '关联批次', '更新时间', '操作']} empty="当前交付执行暂无子工单">
      {rows.map((item) => {
        const location = state.locations.find((candidate) => candidate.id === item.locationId);
        const batch = plan.batches?.find((candidate) => candidate.id === item.batchId);
        return <tr key={item.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/delivery-plans/${plan.id}/sub-orders/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}>{item.name}</Link><div className="font-mono text-[11px] text-gray-400 mt-0.5">{item.id}</div></td>
          <td className="px-3 py-2 text-gray-600">{subOrderTypeLabel(item.type)}</td><td className="px-3 py-2 text-gray-600">{location?.name || '—'}</td><td className="px-3 py-2">{item.devices.length} 台</td><td className="px-3 py-2 text-gray-600">{item.type === 'deployment' ? item.engineer || '尚未分派' : '不适用'}</td><td className="px-3 py-2"><StatusBadge status={item.status} /></td><td className="px-3 py-2 text-gray-600">{subOrderNodeLabel(item)}</td><td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.plannedTime?.replace('T', ' ') || '—'}</td><td className="px-3 py-2 text-gray-600">{batch ? batchDisplayName(batch) : '未关联'}</td><td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{item.updatedAt}</td><td className="px-3 py-2"><Link className="ui-link text-[13px]" to={`/delivery-plans/${plan.id}/sub-orders/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}>进入执行</Link></td>
        </tr>;
      })}
    </Table>
  </div>;
}
