import StatusBadge from '../StatusBadge';
import { Table } from '../ui';
import { AttachmentList } from '../AttachmentUpload';
import type { DeliverySubOrder } from '../../data/deliverySubOrders';

const requirementLabel = { required: '必填', optional: '选填', 'not-applicable': '不适用' };

export default function SubOrderDeploymentFlow({ subOrder, onComplete, onMaterial }: { subOrder: DeliverySubOrder; onComplete: (key: string) => void; onMaterial: (key: string) => void }) {
  const editable = subOrder.status === '执行中';
  const readOnly = subOrder.status === '已完成';
  return <div className="space-y-3">
    <p className="text-xs text-gray-500">以下内容针对整张子工单记录一次；单台设备的安装调试、验收和问题请在“设备执行与验收”中分别记录。</p>
    <Table head={['本次现场任务', '要求', '完成状态', '完成时间', '说明', '资料', '操作']} empty="暂无本次现场任务">
      {subOrder.executionItems.map((item) => {
        const displayStatus = readOnly && item.requirement === 'optional' && item.status !== '已完成' ? '未执行（选填）' : item.requirement === 'not-applicable' ? '不适用' : item.status;
        const isCurrent = item.key === subOrder.currentNode && editable;
        return <tr key={item.key} className={isCurrent ? 'bg-amber-50/50' : 'hover:bg-[#fafafa]'}>
          <td className="px-3 py-2"><div className="font-medium text-gray-700">{item.label}</div>{isCurrent && <div className="text-[11px] text-amber-700 mt-0.5">当前现场任务</div>}</td>
          <td className="px-3 py-2 text-xs text-gray-600">{requirementLabel[item.requirement]}</td><td className="px-3 py-2"><StatusBadge status={displayStatus} /></td><td className="px-3 py-2 text-xs text-gray-500">{item.completedAt || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.note || '—'}</td><td className="min-w-44 px-3 py-2"><AttachmentList items={item.materials} empty="—" /></td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3">{editable && item.requirement !== 'not-applicable' && item.status !== '已完成' && <button className="ui-link text-[13px]" onClick={() => onComplete(item.key)}>记录当前执行结果</button>}{editable && item.requirement !== 'not-applicable' && <button className="ui-link text-[13px]" onClick={() => onMaterial(item.key)}>添加资料</button>}</div>{!editable && !readOnly && <span className="text-xs text-gray-400">当前阶段不可更新</span>}{readOnly && <span className="text-xs text-gray-400">已完成，只读</span>}</td>
        </tr>;
      })}
    </Table>
  </div>;
}
