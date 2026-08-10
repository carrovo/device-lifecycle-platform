import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge';
import { Btn, EmptyState, Section, Table } from '../ui';
import { AttachmentList } from '../AttachmentUpload';
import type { DeliverySubOrder } from '../../data/deliverySubOrders';
import { technicalSupportDecisionLabel } from '../../data/issuePool';

export default function SubOrderExceptionsPanel({ subOrder, issues, state, onBlock, onProgress, onResolve }: { subOrder: DeliverySubOrder; issues: any[]; state: any; onBlock: () => void; onProgress: (block: any) => void; onResolve: (block: any) => void }) {
  const readOnly = subOrder.status === '已完成';
  const relatedIssues = (subOrder.issueLinks || []).map((link) => ({ link, issue: issues.find((item) => item.id === link.issueId) })).filter((item) => item.issue);
  return <div className="space-y-4">
    <Section title={`交付阻塞（${subOrder.blocks.length}）`} subtitle="物流、水电、现场条件、客户或施工协调问题在当前子工单闭环，不进入问题池。" right={!readOnly ? <Btn size="sm" variant="danger" onClick={onBlock}>登记交付阻塞</Btn> : undefined} bodyClassName="p-0">
      <Table head={['发生环节', '阻塞描述', '是否暂停整单', '当前处理人', '状态', '登记 / 更新', '最新进展', '解决结果', '资料', '操作']} empty="暂无交付阻塞">
        {subOrder.blocks.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-gray-600">{item.nodeLabel}</td><td className="px-3 py-2 text-gray-700">{item.reason}</td><td className="px-3 py-2 text-xs">{item.pausesTask ? '是' : '否'}</td><td className="px-3 py-2 text-gray-600">{item.owner || '—'}</td><td className="px-3 py-2"><StatusBadge status={item.status} /></td><td className="px-3 py-2 text-xs text-gray-500">{item.createdAt}<br />{item.updatedAt}</td><td className="px-3 py-2 text-xs text-gray-600">{item.progress.at(-1)?.content || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{item.resolution || '—'}</td><td className="min-w-44 px-3 py-2"><AttachmentList items={item.materials} empty="—" /></td><td className="px-3 py-2 whitespace-nowrap">{item.status !== '已解除' && !readOnly && <div className="flex gap-3"><button className="ui-link text-[13px]" onClick={() => onProgress(item)}>更新进展</button><button className="ui-link text-[13px]" onClick={() => onResolve(item)}>标记已解决</button></div>}</td></tr>)}
      </Table>
    </Section>
    {subOrder.type === 'deployment' && <Section title={`关联问题（${relatedIssues.length}）`} subtitle="此处仅展示当前部署任务关联的正式问题池记录；问题处理和闭环均在问题池中维护。" bodyClassName="p-0">
      {relatedIssues.length ? <Table head={['问题编号', '关联设备', '故障现象描述', '技术客服判断', '解决状态', '问题是否闭环', '操作']}>
        {relatedIssues.map(({ link, issue }) => { const device = state.devices.find((item) => item.id === link.deviceId); return <tr key={link.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 font-mono text-xs"><Link className="ui-link" to={`/after-sales?issue=${encodeURIComponent(issue.id)}`}>{issue.issueNo}</Link></td><td className="px-3 py-2 font-mono text-xs">{device?.sn || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{issue.symptom || '—'}</td><td className="px-3 py-2 text-xs text-gray-600">{issue.technicalSupport ? technicalSupportDecisionLabel(issue.technicalSupport.decision) : '尚未判断'}</td><td className="px-3 py-2"><StatusBadge status={issue.resolutionStatus || '—'} /></td><td className="px-3 py-2"><StatusBadge status={issue.isClosed || '—'} /></td><td className="px-3 py-2"><Link className="ui-link whitespace-nowrap text-[13px]" to={`/after-sales?issue=${encodeURIComponent(issue.id)}`}>查看详情</Link></td></tr>; })}
      </Table> : <EmptyState>暂无关联问题。现场发现设备问题时，请在对应设备行提交。</EmptyState>}
    </Section>}
  </div>;
}
