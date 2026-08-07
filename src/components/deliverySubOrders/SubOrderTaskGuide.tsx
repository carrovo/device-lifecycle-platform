import { Btn, Stepper } from '../ui';
import { DEPLOYMENT_STEPS, deploymentStepKey, subOrderGuidance, subOrderNodeLabel, type DeliverySubOrder } from '../../data/deliverySubOrders';

export default function SubOrderTaskGuide({ subOrder, onPrimary, onBlock, onBlockProgress }: { subOrder: DeliverySubOrder; onPrimary: (guidance: any) => void; onBlock: () => void; onBlockProgress: () => void }) {
  const guidance = subOrderGuidance(subOrder);
  const blocked = subOrder.status === '阻塞';
  const readOnly = subOrder.status === '已完成';
  return <section className="border border-gray-900 bg-white rounded-lg overflow-hidden">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-gray-500">当前待办</span><span className="rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">{guidance.task}</span><span className="text-xs text-gray-500">当前节点：{subOrderNodeLabel(subOrder)}</span></div>
        <p className="text-[13px] text-gray-700">{guidance.content}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div><p className="text-gray-400 mb-1">尚未满足</p>{guidance.unmet.length ? <ul className="space-y-1 text-amber-700">{guidance.unmet.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="text-green-700">当前阶段条件已满足</p>}</div>
          <div><p className="text-gray-400 mb-1">完成后下一步</p><p className="text-gray-700">{guidance.next}</p></div>
        </div>
      </div>
      <div className="flex lg:flex-col items-end justify-end gap-2 min-w-[170px]">
        {blocked && <Btn onClick={onBlockProgress}>更新阻塞进展</Btn>}
        {!blocked && !readOnly && <Btn variant="danger" onClick={onBlock}>登记交付阻塞</Btn>}
        {guidance.action !== 'none' && <Btn variant="primary" onClick={() => onPrimary(guidance)}>{guidance.actionLabel}</Btn>}
      </div>
    </div>
    {subOrder.type === 'deployment' && <div className="border-t border-gray-100 bg-gray-50 px-4 py-3"><Stepper steps={[...DEPLOYMENT_STEPS]} current={deploymentStepKey(subOrder)} /></div>}
  </section>;
}
