import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import {
  SHARED_FEISHU_TABLES, productionLabel, productionProgressLabel, productionTimeline,
} from '../data/prdV12';
import { batchDisplayName, relationForDevice } from '../data/deliveryV2';
import { erpReferenceUrl } from '../data/erpPrototype';
import {
  Page, PageHeader, Section, DescList, Table, Btn, LinkAction, EmptyState,
} from '../components/ui';

const TABS = [['overview', '设备概览'], ['production', '生产履历'], ['project', '项目与交付'], ['logs', '操作日志']];

function TabBar({ active, onChange }) {
  return <div className="flex gap-1 border-b border-gray-200">{TABS.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={`px-3 py-2 text-[13px] border-b-2 ${active === key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>)}</div>;
}

function FeishuTables({ device }) {
  const additional = (device.otherFeishuTables || []).filter((item) => item.name && !/^\d+$/.test(item.name.trim()) && item.url);
  return (
    <Section title="相关飞书表格">
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">常用飞书表格</h3>
          <div className="divide-y divide-gray-100">
            {SHARED_FEISHU_TABLES.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2"><span className="text-[13px] text-gray-700">{item.name}</span><a className="ui-link text-[13px]" href={item.url} target="_blank" rel="noreferrer">打开表格</a></div>)}
            <div className="flex items-center justify-between gap-3 py-2"><span className="text-[13px] text-gray-700">电子验收单</span>{device.electronicAcceptanceUrl ? <a className="ui-link text-[13px]" href={device.electronicAcceptanceUrl} target="_blank" rel="noreferrer">打开表格</a> : <span className="text-xs text-gray-400">暂无设备专属记录。</span>}</div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">其他飞书表格</h3>
          {additional.length ? <div className="divide-y divide-gray-100">
            {additional.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-2"><div><span className="text-[13px] text-gray-700">{item.name}</span>{item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}</div><a className="ui-link text-[13px]" href={item.url} target="_blank" rel="noreferrer">打开表格</a></div>)}
          </div> : <p className="text-xs text-gray-400 py-2">暂无其他飞书表格。</p>}
        </div>
      </div>
    </Section>
  );
}

export default function DeviceDetail() {
  const { id } = useParams();
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const active = TABS.some(([key]) => key === requestedTab) ? requestedTab : 'overview';
  const returnTo = searchParams.get('returnTo');
  const setActive = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };
  const device = state.devices.find((item) => item.id === id || item.sn === id);
  if (!device) return <Page><PageHeader title="设备不存在" actions={<Btn as="link" to="/assets">返回设备台账</Btn>} /></Page>;

  const type = state.deviceTypes.find((item) => item.id === device.deviceTypeId);
  const project = state.projects.find((item) => item.id === device.projectId);
  const location = state.locations.find((item) => item.id === device.locationId);
  const deliveryEntries = state.deliveryPlans
    .map((plan) => ({ plan, relation: relationForDevice(plan, device.id) }))
    .filter((item) => item.relation);
  const deliveries = deliveryEntries.map((item) => item.plan);
  const deliveryIds = new Set(deliveries.map((item) => item.id));
  const exceptions = state.deliveryExceptions.filter((item) => deliveryIds.has(item.deliveryPlanId) && (item.affectedDeviceIds || []).includes(device.id));
  const logs = [
    ...state.operationLogs.filter((item) => item.deviceId === device.id),
    ...deliveries.flatMap((plan) => (plan.operationLogs || []).map((item) => ({
      ...item, id: `${plan.id}-${item.id}-${device.id}`, timestamp: item.time, actionType: item.action,
      notes: `${plan.id}：${item.notes || ''}`, module: '项目中心',
    }))),
  ].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const actions = <>
    <Btn as="link" to={`/production?tab=flow&device=${device.id}`}>进入生产流转</Btn>
    {project && <Btn as="link" to={`/projects/${project.id}`}>查看项目详情</Btn>}
    {deliveries.length === 1 && <Btn as="link" to={`/delivery-plans/${deliveries[0].id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>查看交付执行</Btn>}
    {deliveries.length > 1 && <Btn onClick={() => setActive('project')}>查看交付执行</Btn>}
  </>;

  return (
    <Page>
      <PageHeader
        breadcrumb={returnTo
          ? <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Link className="ui-link" to={returnTo}>返回来源页面</Link><span>/</span><span>设备详情</span></div>
          : <Link to="/assets" className="ui-link text-[13px]">‹ 返回设备台账</Link>}
        title={device.sn}
        description={`${device.robotNo} · ${type?.name || '—'}`}
        actions={actions}
      />
      <div><StatusBadge status={productionProgressLabel(device)} /></div>
      <TabBar active={active} onChange={setActive} />

      {active === 'overview' && <>
        <Section title="建档信息"><DescList cols={3} items={[
          ['建档人', device.assembler || '—'], ['建档时间', device.createdAt || device.assemblyTime || '—'], ['最近更新时间', device.updatedAt || '—'], ['档案状态', device.archiveStatus || '有效'],
        ]} /></Section>
        <Section title="ERP 产品入库关联">
          {device.erpInboundNo ? <DescList cols={3} items={[
            ['产品入库单编号', device.erpInboundNo],
            ['ERP 序列号', device.erpSerialNo || device.sn], ['平台设备 SN', device.sn],
            ['ERP 批次号', device.erpBatchNo || device.robotNo], ['机器人编号', device.robotNo],
            ['匹配时间', device.inboundTime || device.updatedAt || '—'],
            ['来源信息', <Link className="ui-link" to="/erp-center?tab=list&type=productInbound">查看 ERP 单据</Link>],
          ]} /> : <p className="text-[13px] text-gray-500">当前设备尚未匹配到 ERP 产品入库记录。</p>}
        </Section>
      </>}

      {active === 'production' && <>
        <Section title="生产履历" right={<Btn size="sm" as="link" to={`/production?tab=flow&device=${device.id}`}>进入生产流转</Btn>} bodyClassName="p-0">
          <Table head={['节点名称', '节点处理结果', '备注或结果摘要', '返修 / 换件摘要', '复测结果', '操作人', '操作时间']} empty="暂无生产履历">
            {productionTimeline(device).map((record) => <tr key={record.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-700">{record.nodeLabel || productionLabel(record.node)}{record.revisions?.length ? <span className="ml-2 text-xs text-gray-400">已修订</span> : null}</td><td className="px-3 py-2"><StatusBadge status={record.result || '已完成'} /></td>
              <td className="px-3 py-2 text-xs text-gray-600">{record.ngReason || record.summary || '—'}{record.corrections?.length ? <div className="text-gray-400 mt-1">更正：{record.corrections.at(-1).note}</div> : null}</td><td className="px-3 py-2 text-xs text-gray-500">{[record.repairSummary, record.replacementSummary].filter(Boolean).join('；') || '—'}</td>
              <td className="px-3 py-2">{record.retestResult ? <StatusBadge status={record.retestResult} /> : '—'}</td><td className="px-3 py-2 text-gray-600">{record.operator || '—'}</td><td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{record.time || '—'}</td>
            </tr>)}
          </Table>
        </Section>
        <FeishuTables device={device} />
      </>}

      {active === 'project' && <>
        <Section title="项目与点位">
          {project ? <DescList cols={3} items={[
            ['项目名称', project.name], ['点位名称', location?.name || '—'], ['项目负责人', project.manager || '—'],
            ['项目详情', <Link className="ui-link" to={`/projects/${project.id}`}>查看项目详情</Link>],
          ]} /> : <p className="text-[13px] text-gray-500">当前设备尚未绑定项目和点位。</p>}
        </Section>
        <Section title="交付执行" bodyClassName="p-0">
          {deliveryEntries.length ? <Table head={['交付执行编号', '所属批次', '项目', '目标 / 实际点位', 'ERP 发货 / 调拨来源', '当前交付结果', '结果时间', '异常记录', '操作']}>
            {deliveryEntries.map(({ plan, relation }) => {
              const batch = relation.batch;
              const exceptionCount = exceptions.filter((item) => item.deliveryPlanId === plan.id).length;
              return <tr key={plan.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2"><Link className="ui-link font-mono text-xs" to={`/delivery-plans/${plan.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>{plan.id}</Link></td>
                <td className="px-3 py-2"><Link className="ui-link" to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>{batchDisplayName(batch)}</Link></td>
                <td className="px-3 py-2 text-gray-600">{state.projects.find((item) => item.id === plan.projectId) ? <Link className="ui-link" to={`/projects/${plan.projectId}?tab=delivery`}>{state.projects.find((item) => item.id === plan.projectId)?.name}</Link> : '—'}</td>
                <td className="px-3 py-2 text-gray-600">{state.locations.find((item) => item.id === relation.targetLocationId)?.name || '—'} / {state.locations.find((item) => item.id === relation.actualLocationId)?.name || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{batch.erpReferences?.length ? batch.erpReferences.map((item) => <Link key={`${item.type}-${item.no}`} className="ui-link mr-2" to={erpReferenceUrl(item, `/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}>{item.no}</Link>) : '—'}</td>
                <td className="px-3 py-2"><StatusBadge status={relation.result} /></td>
                <td className="px-3 py-2 text-xs text-gray-500">{relation.recordTime || '—'}</td>
                <td className="px-3 py-2">{exceptionCount ? <a className="ui-link" href="#device-delivery-exceptions">{exceptionCount} 条</a> : <span className="text-gray-400">暂无</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction to={`/delivery-plans/${plan.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>查看执行详情</LinkAction><LinkAction to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>查看批次详情</LinkAction></div></td>
              </tr>;
            })}
          </Table> : <EmptyState className="py-8">当前设备暂无交付执行。</EmptyState>}
        </Section>
        {deliveryEntries.length > 0 && <Section title="交付现场记录与批次资料">
          <div className="space-y-5">
            {deliveryEntries.map(({ plan, relation }) => {
              const batch = relation.batch;
              const records = (batch.siteRecords || []).filter((item) => (item.deviceIds || []).includes(device.id));
              return <div key={`${plan.id}-${batch.id}`} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between gap-3"><Link className="ui-link text-[13px] font-medium" to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>{batchDisplayName(batch)}</Link><Link className="ui-link text-[13px]" to={`/delivery-plans/${plan.id}/batches/${batch.id}?returnTo=${encodeURIComponent(`/devices/${device.id}?tab=project${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)}`}>查看详情</Link></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                  {(batch.feishuLinks || []).map((item) => <a key={item.id} className="ui-link" href={item.url} target="_blank" rel="noreferrer">打开表格</a>)}
                  {!batch.feishuLinks?.length && <span>暂无批次飞书链接</span>}
                </div>
                {records.length ? <div className="mt-2 space-y-1">{[...records].sort((a, b) => (b.time || '').localeCompare(a.time || '')).map((record) => <p key={record.id} className="text-xs text-gray-600">{record.time} · {record.content}{record.hasException ? ` · 异常：${record.exceptionDescription}` : ''}</p>)}</div> : <p className="text-xs text-gray-400 mt-2">暂无与当前设备明确关联的现场记录。</p>}
              </div>;
            })}
          </div>
        </Section>}
        <Section id="device-delivery-exceptions" title="交付异常" bodyClassName="p-0">
          {exceptions.length ? <Table head={['关联交付执行', '来源记录标题', '异常来源类型', '异常说明', '记录人', '记录时间', '操作']}>
            {exceptions.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-mono text-xs">{item.deliveryPlanId}</td><td className="px-3 py-2 font-medium text-gray-700">{item.sourceTitle || '交付记录'}</td><td className="px-3 py-2 text-gray-600">{item.sourceType || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{item.description}</td><td className="px-3 py-2 text-gray-600">{item.recorder || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{item.recordTime || '—'}</td>
              <td className="px-3 py-2"><LinkAction to={`/delivery-plans/${item.deliveryPlanId}`}>查看交付执行详情</LinkAction></td>
            </tr>)}
          </Table> : <EmptyState className="py-8">暂无交付异常。</EmptyState>}
        </Section>
      </>}

      {active === 'logs' && <Section title="操作日志" bodyClassName="p-0">
        <Table head={['操作时间', '操作人', '所属模块', '操作动作', '操作摘要']} empty="暂无设备操作日志">
          {logs.map((log) => <tr key={log.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-xs text-gray-500">{log.timestamp || '—'}</td><td className="px-3 py-2 text-gray-600">{log.operator || '—'}</td><td className="px-3 py-2 text-gray-600">{log.module || (log.actionType?.includes('生产') || log.actionType?.includes('测试') ? '生产中心' : '设备管理')}</td><td className="px-3 py-2 text-gray-700">{log.actionType || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{log.notes || '—'}</td></tr>)}
        </Table>
      </Section>}
    </Page>
  );
}
