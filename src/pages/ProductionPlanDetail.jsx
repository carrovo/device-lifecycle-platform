import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import ModuleDetailDrawer from '../components/ModuleDetailDrawer';
import OperationLog from '../components/OperationLog';
import { Pagination, usePaged } from '../components/Pagination';
import { Page, PageHeader, Section, DescList, Table, StatCard, StatGrid, Chip, Btn, LinkAction, Select, EmptyState } from '../components/ui';
import { productionPlanStatus, deviceBusinessNode, planBottleneck, planDeviceDistribution, assemblyProgress, deviceModuleBindings, TODAY } from '../utils/status';

// 生产计划详情（只读追溯视图）
// 定位：平台不创建 ERP 生产订单、不维护 BOM / 入库 / 出库 / 检验。
// 本页 = ERP 工单关联（只读同步）+ 平台生产过程记录 + 质量测试追溯。
// 分区：计划基础信息 / ERP 工单·入库·检验信息 / 设备列表 / 单机生产记录 /
//       质量测试记录 / 生产返修记录 / 操作日志。

const STATION_LABEL = { semi: '半成品检验', init: '初测', mid: '中测', oqt: 'OQT终测' };
const isPassRec = (r) => r.stationResult === 'Pass' || ['合格', 'Pass', '通过'].includes(r.result);

// 轻量进度条（设备级 / 单机记录使用，不做成计划级所有设备共用一条固定进度条）
function ProgressLine({ done, total, tone = 'bg-blue-500' }) {
  const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{done}/{total || 0}</span>
    </div>
  );
}

// 「长期未结」阈值：创建早于 TODAY - 45 天且未完成。放在模块作用域，避免在渲染期做日期运算。
const LONG_UNSETTLED_BEFORE = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - 45);
  return d.toISOString().slice(0, 10);
})();

export default function ProductionPlanDetail() {
  const { id } = useParams();
  const { state } = useApp();

  const plans = [...(state.workflowProductionPlans || []), ...(state.productionPlans || [])];
  const plan = plans.find((p) => p.id === id);

  const deviceTypes = state.deviceTypes || [];
  const moduleTypes = state.moduleTypes || [];
  const moduleInstances = state.moduleInstances || [];
  const moduleReplacements = state.moduleReplacements || [];
  const typeName = (tid) => deviceTypes.find((t) => t.id === tid)?.name || '—';

  const planDevices = plan ? (state.devices || []).filter((d) => d.productionPlanId === plan.id) : [];
  const planDeviceIds = new Set(planDevices.map((d) => d.id));
  const testRecords = plan ? (state.testRecords || []).filter((r) => planDeviceIds.has(r.deviceId) && r.stationKey) : [];
  const repairs = plan ? (state.productionWorkOrders || []).filter((w) => w.productionPlanId === plan.id || planDeviceIds.has(w.deviceId)) : [];
  const planLogs = plan ? (state.operationLogs || []).filter((l) => l.productionPlanId === plan.id || planDeviceIds.has(l.deviceId)) : [];
  const testSorted = [...testRecords].sort((a, b) => String(b.testTime || '').localeCompare(String(a.testTime || '')));

  const devPaged = usePaged(planDevices, 8);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [moduleDrawerId, setModuleDrawerId] = useState(null);

  if (!plan) {
    return (
      <Page>
        <PageHeader title="生产计划详情" actions={<Btn as="link" to="/projects?tab=production" variant="secondary">返回生产计划</Btn>} />
        <EmptyState>未找到生产计划 {id}</EmptyState>
      </Page>
    );
  }

  const project = (state.projects || []).find((p) => p.id === plan.projectId);
  const planStatus = productionPlanStatus(plan);
  const isDone = ['已完成', '已作废'].includes(planStatus);
  const overdue = !!plan.endDate && plan.endDate < TODAY && !isDone && planStatus !== '未开始';
  const longUnsettled = !isDone && !!plan.createdAt && String(plan.createdAt).slice(0, 10) < LONG_UNSETTLED_BEFORE;
  const targetCount = plan.targetCount ?? plan.target ?? 0;

  const stationPassed = (deviceId, key) => {
    const recs = testRecords
      .filter((r) => r.deviceId === deviceId && r.stationKey === key)
      .sort((a, b) => String(a.testTime || '').localeCompare(String(b.testTime || '')));
    const last = recs.at(-1);
    return !!last && isPassRec(last);
  };
  const passedAll = planDevices.filter((d) => ['semi', 'init', 'mid', 'oqt'].every((k) => stationPassed(d.id, k))).length;
  const repairing = planDevices.filter((d) => ['生产返修中', '返修中'].includes(d.status)).length;

  // 每台设备最近一次工站测试 & 返修次数（用于设备列表进度快照）
  const latestTest = {};
  testSorted.forEach((r) => { if (!(r.deviceId in latestTest)) latestTest[r.deviceId] = r; });
  const repairCount = {};
  repairs.forEach((w) => { if (w.deviceId) repairCount[w.deviceId] = (repairCount[w.deviceId] || 0) + 1; });

  // 设备状态分布（平台派生：按设备当前状态分组计数）
  const { dist } = planDeviceDistribution(plan, state.devices || []);
  const distEntries = Object.entries(dist).sort((a, b) => b[1] - a[1]);

  // 已完成测试设备数（进度概览分子；全工站通过或已进入下游测试完成态）
  const TEST_DONE = ['已完成测试', '待入库', '已入库', '待分配项目', '已分配项目', '现场安装调试中', '客户验收中', '在线运营', '售后中', '已停用', '已报废', '退役', '待交付', '可交付'];
  const completedTest = planDevices.filter((d) => TEST_DONE.includes(d.status) || ['semi', 'init', 'mid', 'oqt'].every((k) => stationPassed(d.id, k))).length;

  // 当前卡点（平台派生，非单一节点）：由设备状态分布 + ERP + 超时派生
  const bottleneck = planBottleneck(plan, state.devices || [], state.productionWorkOrders || [], TODAY);

  // ERP 同步状态（只读同步，非平台强工站）
  const erpSync = (plan.erpInboundNo || plan.erpStockStatus || plan.erpInspectionNo) ? '已同步' : '待同步';

  // 单机生产记录：按设备查看（默认第一台，通过顶部下拉切换）
  const selectedDevice = planDevices.find((d) => d.id === selectedDeviceId) || planDevices[0];

  const cycle = `${String(plan.createdAt || '').slice(0, 10) || '—'} ~ ${plan.endDate ?? '—'}`;

  return (
    <Page>
      <PageHeader
        breadcrumb={(
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <Link to="/projects?tab=production" className="hover:text-gray-700">生产计划</Link>
            <span>/</span>
            <span className="text-gray-600">{plan.name ?? plan.id}</span>
          </div>
        )}
        title={<span className="inline-flex items-center gap-3">{plan.name ?? plan.id}<StatusBadge status={planStatus} size="md" /></span>}
        description="生产计划仅关联 ERP 工单并记录平台生产过程与质量测试追溯，不创建 ERP 生产订单，也不维护 BOM / 入库 / 出库 / 检验。"
        actions={(
          <>
            <Btn variant="secondary" onClick={() => alert('请在 ERP 中维护生产订单，平台在此关联已同步的 ERP 生产订单。')}>关联 ERP 生产订单</Btn>
            <Btn as="link" to="/erp-center?tab=production" variant="secondary">查看 ERP 源单据</Btn>
            <Btn variant="secondary" onClick={() => document.getElementById('single-device-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>补充生产过程记录</Btn>
            <Btn as="link" to="/projects?tab=production" variant="secondary">返回生产计划</Btn>
          </>
        )}
      />

      <Section
        title="ERP 生产订单信息（ERP 只读同步）"
        subtitle="以下字段均来自 ERP 生产订单，平台只读同步展示，不创建、不编辑 ERP 单据（枚举以后以 ERP API 为准）。"
        right={<Chip>ERP 只读同步</Chip>}
      >
        <DescList
          cols={4}
          items={[
            ['生产订单号', plan.erpProductionOrderNo],
            ['项目名称', project ? <Link to={`/projects/${project.id}`} className="ui-link">{project.name}</Link> : '—'],
            ['项目编码', project?.erpProjectNo || project?.id || '—'],
            ['ERP 产品入库单号', plan.erpInboundNo],
            ['ERP 产品检验单号', plan.erpInspectionNo],
            ['ERP 库存状态', plan.erpStockStatus],
            ['入库仓库', plan.warehouse],
            ['ERP 同步状态', <StatusBadge status={erpSync} />],
          ]}
        />
        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-[#f2f2f2]">ERP 负责生产订单、BOM、出库、入库、检验等正式单据；平台只补充设备级生产过程和质量追溯记录。</p>
      </Section>

      <Section
        title="关联 ERP 单据"
        subtitle="该生产订单在 ERP 中的关联源单据，均为 ERP 只读来源，平台不创建、不编辑。"
      >
        <div className="flex flex-wrap gap-2">
          <Btn as="link" to="/erp-center?tab=production" variant="secondary">订单 BOM</Btn>
          <Btn as="link" to="/erp-center?tab=production" variant="secondary">LRP 计划</Btn>
          <Btn as="link" to="/erp-center?tab=production" variant="secondary">材料出库单</Btn>
          <Btn as="link" to="/erp-center?tab=production" variant="secondary">出库申请单</Btn>
          <Btn as="link" to="/erp-center?tab=inspection" variant="secondary">产品入库单</Btn>
          <Btn as="link" to="/erp-center?tab=inspection" variant="secondary">产品检验单</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-[#f2f2f2]">以上为该生产订单在 ERP 中的关联源单据，点击前往 ERP 单据中心查看。</p>
      </Section>

      <div className="pt-1">
        <h2 className="text-sm font-semibold text-gray-800">平台补充生产记录</h2>
        <p className="text-xs text-gray-400 mt-0.5">ERP 正式单据之外，平台补充的设备级生产过程与质量追溯记录：进度快照 / 计划信息 / 设备列表 / 单机生产记录（装配 · 测试 · 返修 · 附件 · 日志）。</p>
      </div>

      <Section title="生产计划进度概览" subtitle="平台派生的计划进度快照（左：测试完成进度 · 中：设备状态分布 · 右：卡点与超期）">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="text-xs text-gray-400">已完成测试 / 计划数量</div>
            <ProgressLine done={completedTest} total={targetCount || planDevices.length} tone="bg-green-500" />
            <div className="text-xs text-gray-500">已完成测试 {completedTest} / {targetCount || planDevices.length} 台</div>
          </div>
          <div className="space-y-2 lg:border-l lg:border-[#f2f2f2] lg:pl-6">
            <div className="text-xs text-gray-400">设备状态分布</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {distEntries.length === 0
                ? <span className="text-sm text-gray-400">该生产计划暂无设备</span>
                : distEntries.map(([st, n]) => (
                  <span key={st} className="inline-flex items-center gap-1">
                    <StatusBadge status={st} />
                    <span className="text-xs text-gray-500">{n}</span>
                  </span>
                ))}
            </div>
          </div>
          <div className="space-y-2 text-[13px] lg:border-l lg:border-[#f2f2f2] lg:pl-6">
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-24 flex-shrink-0">当前卡点</span><StatusBadge status={bottleneck} /></div>
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-24 flex-shrink-0">是否长期未结</span>{longUnsettled ? <StatusBadge status="长期未结" /> : <span className="text-gray-500">否</span>}</div>
            <div className="flex items-center gap-2"><span className="text-xs text-gray-400 w-24 flex-shrink-0">是否超期</span>{overdue ? <StatusBadge status="超期" /> : <span className="text-gray-500">否</span>}</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-[#f2f2f2]">该状态为平台派生状态，基于设备进度与 ERP 同步信息计算，非 ERP 字段，不代表所有设备统一节点。</p>
      </Section>

      <StatGrid cols={5}>
        <StatCard label="计划数量" value={targetCount || '—'} />
        <StatCard label="已关联设备数" value={planDevices.length} />
        <StatCard label="全工站通过数" value={passedAll} tone="success" />
        <StatCard label="返修中设备数" value={repairing} tone={repairing ? 'warning' : 'default'} />
        <StatCard label="当前卡点" value={<StatusBadge status={bottleneck} size="md" />} />
      </StatGrid>

      <Section title="计划基础信息">
        <DescList
          cols={3}
          items={[
            ['计划编号', plan.id],
            ['计划名称', plan.name],
            ['所属项目', project ? <Link to={`/projects/${project.id}`} className="ui-link">{project.name}</Link> : '—'],
            ['机器人型号', typeName(plan.deviceTypeId)],
            ['计划数量', targetCount ? `${targetCount} 台` : '—'],
            ['已录入设备', `${planDevices.length} 台`],
            ['负责人', plan.owner],
            ['当前卡点', bottleneck],
            ['计划周期', cycle],
            ['更新时间', plan.updatedAt],
            ['备注', plan.notes],
          ]}
        />
      </Section>

      <Section title="设备列表" subtitle={`进度快照 · 该生产计划下设备 ${planDevices.length} 台（每台设备当前状态）`} bodyClassName="p-0">
        <Table
          head={['设备SN', '机器人型号', '当前状态', '当前工站', '最近测试结果', '是否返修', '返修次数', '装配进度', '最近更新时间', '操作']}
          empty="该生产计划暂无设备"
          footer={<Pagination page={devPaged.page} total={devPaged.total} totalPages={devPaged.totalPages} onChange={devPaged.setPage} />}
        >
          {devPaged.pageItems.map((d) => {
            const lt = latestTest[d.id];
            const rc = repairCount[d.id] || 0;
            const repaired = rc > 0 || ['生产返修中', '返修中'].includes(d.status);
            const ap = assemblyProgress(d, deviceTypes, moduleTypes, moduleInstances, moduleReplacements);
            return (
              <tr key={d.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 whitespace-nowrap"><Link to={`/devices/${d.id}`} className="ui-link font-mono text-xs">{d.sn}</Link></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{typeName(d.deviceTypeId)}</td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{deviceBusinessNode(d)}</td>
                <td className="px-3 py-2">{lt ? <StatusBadge status={isPassRec(lt) ? 'Pass' : 'NG'} /> : <span className="text-xs text-gray-400">未测试</span>}</td>
                <td className="px-3 py-2">{repaired ? <span className="text-xs font-medium text-red-600">是</span> : <span className="text-xs text-gray-400">否</span>}</td>
                <td className="px-3 py-2 text-gray-600">{rc}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{ap.rate}% <span className="text-xs text-gray-400">({ap.bound}/{ap.total})</span></td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{d.updatedAt ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <LinkAction to={`/devices/${d.id}`}>查看设备详情</LinkAction>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <div id="single-device-records">
      <Section
        title={`单机生产记录${selectedDevice ? `：${selectedDevice.sn}` : ''}`}
        subtitle="选择生产计划下的某台设备，查看其装配、模块绑定、工站测试、返修与日志记录"
      >
        {!selectedDevice ? <EmptyState>该生产计划暂无设备</EmptyState> : (() => {
          const dt = deviceTypes.find((t) => t.id === selectedDevice.deviceTypeId);
          const progress = assemblyProgress(selectedDevice, deviceTypes, moduleTypes, moduleInstances, moduleReplacements);
          // 逐槽位绑定明细（传第 6 参 materialBatches，补全物料编码/名称/批次/ERP 库存状态）
          const bindingRows = deviceModuleBindings(selectedDevice, deviceTypes, moduleTypes, moduleInstances, moduleReplacements, state.materialBatches || []);
          const lastBindTime = bindingRows
            .map((r) => r.bindTime).filter((t) => t && t !== '—').sort().at(-1) || '—';
          const lt = latestTest[selectedDevice.id];
          const rc = repairCount[selectedDevice.id] || 0;
          const repaired = rc > 0 || ['生产返修中', '返修中'].includes(selectedDevice.status);
          const devTests = [...testRecords.filter((r) => r.deviceId === selectedDevice.id)]
            .sort((a, b) => String(a.testTime || '').localeCompare(String(b.testTime || '')));
          const devRepairs = repairs.filter((w) => w.deviceId === selectedDevice.id);
          const devLogs = (state.operationLogs || []).filter((l) => l.deviceId === selectedDevice.id);
          const ngReasonFor = (station) => devTests.filter((r) => r.stationKey === station && !isPassRec(r)).at(-1)?.ngReason || '—';
          const stationSeen = {};
          return (
            <div className="space-y-5">
              {/* 设备选择器 + 摘要 */}
              <div className="bg-[#fafafa] border border-[#ececec] rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-500">当前查看设备</span>
                  <Select className="w-52" value={selectedDevice.id} onChange={(e) => setSelectedDeviceId(e.target.value)}>
                    {planDevices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
                  </Select>
                  <Link to={`/devices/${selectedDevice.id}`} className="ui-link text-[13px]">查看设备详情</Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-[13px] text-gray-600">
                  <span>机器人型号：{typeName(selectedDevice.deviceTypeId)}</span>
                  <span className="inline-flex items-center gap-1.5">当前状态：<StatusBadge status={selectedDevice.status} /></span>
                  <span className="inline-flex items-center gap-1.5">当前工站：<StatusBadge status={deviceBusinessNode(selectedDevice)} /></span>
                  <span className="inline-flex items-center gap-1.5">最近测试结果：{lt ? <StatusBadge status={isPassRec(lt) ? 'Pass' : 'NG'} /> : <span className="text-gray-400">未测试</span>}</span>
                  <span>是否返修：{repaired ? <span className="text-red-600 font-medium">是（{rc}）</span> : '否'}</span>
                  <span>装配进度：{progress.rate}%（{progress.bound}/{progress.total}）</span>
                </div>
              </div>

              {/* 设备基础状态 */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">设备基础状态</div>
                <DescList
                  cols={4}
                  items={[
                    ['设备SN', <Link to={`/devices/${selectedDevice.id}`} className="ui-link font-mono text-xs">{selectedDevice.sn}</Link>],
                    ['机器人型号', typeName(selectedDevice.deviceTypeId)],
                    ['当前状态', <StatusBadge status={selectedDevice.status} />],
                    ['当前工站', <StatusBadge status={deviceBusinessNode(selectedDevice)} />],
                    ['装配人', selectedDevice.assembler ?? '—'],
                    ['装配开始时间', selectedDevice.assemblyStartTime ?? selectedDevice.createdAt ?? '—'],
                    ['装配完成时间', selectedDevice.assemblyTime ?? '—'],
                    ['最近更新时间', selectedDevice.updatedAt ?? '—'],
                  ]}
                />
              </div>

              {/* 装配与模块绑定 */}
              <div className="pt-3 border-t border-[#f2f2f2]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-medium text-gray-500">装配与模块绑定</div>
                  <Btn size="sm" variant="secondary" onClick={() => window.open('/mobile/assembly')}>查看移动端扫码入口 / 模拟扫码登记</Btn>
                </div>
                <p className="text-xs text-gray-400 mb-3">装配绑定由工厂人员通过移动端扫码完成，PC 端用于查看绑定进度、异常和追溯记录。</p>
                <DescList
                  cols={4}
                  items={[
                    ['当前查看设备 SN', <span className="font-mono text-xs">{selectedDevice.sn}</span>],
                    ['装配模板', `${dt?.name || selectedDevice.deviceTypeId} 装配模板`],
                    ['应绑定模块数', progress.total],
                    ['已绑定模块数', progress.bound],
                    ['绑定完成率', `${progress.rate}%`],
                    ['异常槽位数', progress.exception ? <span className="text-red-600 font-medium">{progress.exception}</span> : 0],
                    ['最近绑定时间', lastBindTime],
                  ]}
                />
                <div className="mt-3">
                  <Table
                    head={['槽位名称', '应绑定部件类型', '物料编码', '物料名称', '批次号', 'ERP 库存状态', '平台占用状态', '模块 SN / 内部 ID', '绑定状态', '绑定人', '绑定时间', '异常说明', '操作']}
                    empty="暂无模块绑定明细"
                  >
                    {bindingRows.map((row, i) => (
                      <tr key={i} className="hover:bg-[#fafafa]">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">{row.slotName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.corePartType}{row.moduleTypeName && row.moduleTypeName !== '—' && <span className="ml-2 text-xs text-gray-400">{row.moduleTypeName}</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{row.materialCode}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.materialName}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{row.batchNo}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{row.erpStockStatus}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.platformStatus && row.platformStatus !== '—' ? <StatusBadge status={row.platformStatus} /> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{row.moduleSN}{row.moduleId && <span className="text-gray-400"> · {row.moduleId}</span>}</td>
                        <td className="px-3 py-2"><StatusBadge status={row.bindStatus} /></td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">{row.operator}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{row.bindTime}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{row.exception || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.moduleId ? <LinkAction onClick={() => setModuleDrawerId(row.moduleId)}>查看模块详情</LinkAction> : <span className="text-gray-300 text-xs">—</span>}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>

              {/* 工站测试进度 */}
              <div className="pt-3 border-t border-[#f2f2f2]">
                <div className="text-xs font-medium text-gray-500 mb-2">工站测试进度</div>
                <Table head={['工站', '测试内容', '测试结果', '测试时间', '测试人', '故障代码', '是否复测', '复测结果']} empty="暂无工站测试记录">
                  {devTests.map((r) => {
                    const pass = isPassRec(r);
                    const seen = stationSeen[r.stationKey] || 0;
                    stationSeen[r.stationKey] = seen + 1;
                    let recheck = '—';
                    if (!pass) { const wo = devRepairs.find((w) => w.ngStation === r.stationKey); recheck = wo?.recheckResult || wo?.status || '—'; }
                    return (
                      <tr key={r.id} className="hover:bg-[#fafafa]">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{STATION_LABEL[r.stationKey] ?? r.stationKey ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.testType ?? '—'}</td>
                        <td className="px-3 py-2"><StatusBadge status={pass ? 'Pass' : 'NG'} /></td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{r.testTime ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.operator ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{r.ngReason ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{seen > 0 ? '是' : '否'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{recheck === '—' ? <span className="text-gray-300">—</span> : <StatusBadge status={recheck} />}</td>
                      </tr>
                    );
                  })}
                </Table>
              </div>

              {/* 生产返修记录 */}
              <div className="pt-3 border-t border-[#f2f2f2]">
                <div className="text-xs font-medium text-gray-500 mb-2">生产返修记录</div>
                <Table head={['返修记录编号', '来源工站', '故障代码', '返修说明', '返修人', '返修开始', '返修完成', '复测结果']} empty="暂无生产返修记录">
                  {devRepairs.map((w) => {
                    const done = ['已关闭', '已完成'].includes(w.status);
                    const recheck = w.recheckResult || (done ? '通过' : '');
                    return (
                      <tr key={w.id} className="hover:bg-[#fafafa]">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">{w.id}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{STATION_LABEL[w.ngStation] ?? w.ngStation ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{ngReasonFor(w.ngStation)}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-xs"><div className="truncate">{w.repairActions || '—'}</div></td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{w.assignedTo || '待指派'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{w.createdAt ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{done ? (w.updatedAt ?? '—') : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{recheck ? <StatusBadge status={recheck} /> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </Table>
              </div>

              {/* 附件 / 操作日志 */}
              <div className="pt-3 border-t border-[#f2f2f2]">
                <div className="text-xs font-medium text-gray-500 mb-2">附件 / 操作日志（{devLogs.length} 条）</div>
                {devLogs.length ? <OperationLog logs={devLogs} /> : <EmptyState>暂无操作日志</EmptyState>}
              </div>
            </div>
          );
        })()}
      </Section>
      </div>

      <Section title="操作日志" subtitle={`共 ${planLogs.length} 条`}>
        {planLogs.length ? <OperationLog logs={planLogs} /> : <EmptyState>暂无操作日志</EmptyState>}
      </Section>

      {moduleDrawerId && <ModuleDetailDrawer moduleId={moduleDrawerId} onClose={() => setModuleDrawerId(null)} />}
    </Page>
  );
}
