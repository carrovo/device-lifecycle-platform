import { Link } from 'react-router-dom';
import StatusBadge from '../StatusBadge';
import { StatCard, StatGrid, Table } from '../ui';
import { acceptanceProgress, installationProgress, type DeliverySubOrder } from '../../data/deliverySubOrders';
import { batchDisplayName } from '../../data/deliveryV2';

export default function SubOrderDevicePanel({ subOrder, issues, plan, state, onInstallation, onAcceptance, onIssue }: { subOrder: DeliverySubOrder; issues: any[]; plan: any; state: any; onInstallation: (record: any) => void; onAcceptance: (record: any) => void; onIssue: (record?: any) => void }) {
  const installationDone = installationProgress(subOrder);
  const acceptanceDone = acceptanceProgress(subOrder);
  const readOnly = subOrder.status === '已完成';
  const installationEditable = subOrder.status === '执行中';
  const acceptanceEditable = subOrder.status === '待设备验收';
  const issueEditable = installationEditable || acceptanceEditable;
  const linkedIssueRows = (subOrder.issueLinks || []).flatMap((link) => issues.find((item) => item.id === link.issueId) ? [{ link, issue: issues.find((item) => item.id === link.issueId) }] : []);
  const unresolvedDeviceCount = new Set(linkedIssueRows.filter((item) => item.issue.isClosed !== '是').map((item) => item.link.deviceId)).size;
  return <div className="space-y-4">
    <StatGrid cols={4}><StatCard label="总设备数" value={subOrder.devices.length} hint="来自交付批次设备" /><StatCard label="安装调试已完成" value={`${installationDone} / ${subOrder.devices.length}`} hint="按设备记录" /><StatCard label="已填写验收结果" value={`${acceptanceDone} / ${subOrder.devices.length}`} hint="设备验收进度" tone={acceptanceDone === subOrder.devices.length ? 'success' : 'default'} /><StatCard label="存在未闭环问题的设备" value={unresolvedDeviceCount} hint="正式问题池记录" tone={unresolvedDeviceCount ? 'warning' : 'default'} /></StatGrid>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">设备验收记录用于现场任务，不会修改当前设备交付结果。设备问题直接提交至正式问题池。</p></div>
    <Table tableClassName="min-w-[1280px]" head={['机器人编号', '设备 SN', '设备型号', '所属批次', '安装调试进度', '验收结果', '关联问题', '未闭环问题', '资料', '操作']} empty="当前部署子工单未关联设备">
      {subOrder.devices.map((record) => {
        const device = state.devices.find((item) => item.id === record.deviceId);
        const batch = plan.batches.find((item) => item.id === record.batchId);
        const linkedIssues = (subOrder.issueLinks || []).filter((item) => item.deviceId === record.deviceId).map((link) => ({ link, issue: issues.find((item) => item.id === link.issueId) })).filter((item) => item.issue);
        const openIssues = linkedIssues.filter((item) => item.issue.isClosed !== '是');
        return <tr key={record.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 font-mono text-xs">{device?.robotNo || '—'}</td><td className="px-3 py-2"><Link className="ui-link font-mono text-xs" to={`/devices/${device?.id}?tab=project`}>{device?.sn || '—'}</Link></td><td className="px-3 py-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device?.deviceTypeId)?.name || '—'}</td><td className="px-3 py-2 text-gray-600">{batch ? batchDisplayName(batch) : '—'}</td><td className="px-3 py-2"><StatusBadge status={record.installationStatus} /><p className="mt-1 text-xs text-gray-500">{record.installationNote || '—'}</p></td><td className="px-3 py-2">{record.acceptanceResult ? <StatusBadge status={record.acceptanceResult} /> : <span className="text-gray-400">未记录</span>}<p className="mt-1 text-xs text-gray-500">{record.acceptanceNote || '—'}</p></td><td className="px-3 py-2 text-xs">{linkedIssues.length ? linkedIssues.map(({ link, issue }) => <div key={link.id}><Link className="ui-link font-mono" to={`/after-sales?issue=${encodeURIComponent(issue.id)}`}>{issue.issueNo}</Link></div>) : '—'}</td><td className="px-3 py-2 text-xs">{openIssues.length ? <span className="text-amber-700">{openIssues.length} 条未闭环</span> : <span className="text-gray-500">无</span>}</td><td className="px-3 py-2 text-xs text-gray-600">{record.materials.length ? record.materials.map((item) => item.name).join('、') : '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3">{installationEditable && <button className="ui-link text-[13px]" onClick={() => onInstallation(record)}>记录安装调试进度</button>}{acceptanceEditable && record.installationStatus === '已完成' && <button className="ui-link text-[13px]" onClick={() => onAcceptance(record)}>填写验收结果</button>}{issueEditable && <button className="ui-link text-[13px] text-red-600" onClick={() => onIssue(record)}>提交设备问题</button>}</div>{acceptanceEditable && record.installationStatus !== '已完成' && <span className="text-xs text-gray-400">需先完成安装调试</span>}{!installationEditable && !acceptanceEditable && !readOnly && <span className="text-xs text-gray-400">当前阶段只读</span>}{readOnly && <span className="text-xs text-gray-400">已完成，只读</span>}</td>
        </tr>;
      })}
    </Table>
  </div>;
}
