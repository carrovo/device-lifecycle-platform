import StatusBadge from '../StatusBadge';
import { Table } from '../ui';
import type { DeliverySubOrder } from '../../data/deliverySubOrders';

export default function SubOrderPreparationPanel({ subOrder, onComplete, onMaterial, onBlock }: { subOrder: DeliverySubOrder; onComplete: (key: string) => void; onMaterial: (key: string) => void; onBlock: (key: string) => void }) {
  const readOnly = subOrder.status === '已完成';
  const editable = subOrder.status === '进行中';
  return <div className="space-y-3">
    <p className="text-xs text-gray-500">检查项按顺序推进；只能确认当前检查项，资料和阻塞会记录在具体检查环节。</p>
    <Table head={['前置检查项', '要求', '状态', '完成时间', '说明', '资料', '操作']} empty="暂无前置检查项">
      {subOrder.checks.map((item) => {
        const isCurrent = item.key === subOrder.currentNode && item.status !== '已完成' && subOrder.status === '进行中';
        return <tr key={item.key} className={isCurrent ? 'bg-amber-50/50' : 'hover:bg-[#fafafa]'}>
          <td className="px-3 py-2"><div className="font-medium text-gray-700">{item.label}</div>{isCurrent && <div className="text-[11px] text-amber-700 mt-0.5">当前检查项</div>}</td>
          <td className="px-3 py-2 text-xs text-gray-600">{item.required ? '必填' : '选填'}</td>
          <td className="px-3 py-2"><StatusBadge status={item.status} /></td><td className="px-3 py-2 text-xs text-gray-500">{item.completedAt || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.note || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.materials.length ? item.materials.map((material) => material.name).join('、') : '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3">{isCurrent && <button className="ui-link text-[13px]" onClick={() => onComplete(item.key)}>确认完成检查</button>}{isCurrent && <button className="ui-link text-[13px] text-red-600" onClick={() => onBlock(item.key)}>登记阻塞</button>}{editable && item.status !== '未开始' && <button className="ui-link text-[13px]" onClick={() => onMaterial(item.key)}>添加资料</button>}</div>{editable && item.status === '未开始' && <span className="text-xs text-gray-400">等待前序检查</span>}{subOrder.status === '阻塞' && <span className="text-xs text-gray-400">流程阻塞中</span>}{readOnly && <span className="text-xs text-gray-400">已完成，只读</span>}</td>
        </tr>;
      })}
    </Table>
  </div>;
}
