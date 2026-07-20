import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { Page, PageHeader, Section, StatCard, StatGrid, Table, LinkAction } from '../components/ui';
import { TODAY } from '../utils/status';
import { erpDocTotals, erpDocs, ERP_DOC_META } from '../data/erpDocs';

// 看板中心（R6-A）：收敛为 总览 / 质量 / 售后 三个看板。
// 定位为「数据可视化 dashboard」：以分布 / 趋势 / 漏斗 / Top / 占比图表为主体，
// 首屏克制 KPI，列表仅作为风险 Top 与明细摘要放在下方次要位置，只允许轻量跳转。

/* ── 配色（灰阶为主 + 语义色，SaaS 克制风） ─────────────── */
const C = {
  green: '#16a34a', blue: '#2563eb', amber: '#d97706', red: '#dc2626',
  purple: '#7c3aed', teal: '#0d9488', gray: '#94a3b8', slate: '#64748b',
};
// 已校验的分类色序（身份类图表专用，相邻可区分且色盲安全）
const CAT = [C.blue, C.amber, C.teal, C.purple];
const AXIS = { fontSize: 11, fill: '#9ca3af' };
const TT = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid #ececec', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', padding: '6px 10px' },
  cursor: { fill: 'rgba(0,0,0,0.03)' },
};
// 状态 -> 语义色（与 StatusBadge 口径一致；用于占比/分布图上色，配合图例二次编码）
const STATUS_HEX = {
  交付中: C.blue, 已验收: C.green, 已延期: C.red, 未开始: C.gray, 已作废: C.slate,
  待处理: C.gray, 待接单: C.gray, 处理中: C.blue, 现场处理中: C.blue, 复检中: C.purple,
  已关闭: C.green, 已关单: C.green, 已取消: C.slate,
};
const sHex = (s) => STATUS_HEX[s] || C.gray;

const WO_CLOSED = ['已关闭', '已关单', '已作废', '已取消'];
const isWOOpen = (w) => !WO_CLOSED.includes(w.status);
const QI_CLOSED = ['已关闭', '远程已解决'];
const isQIOpen = (q) => !QI_CLOSED.includes(q.status);
const day = (s) => (s || '').slice(0, 10);
const sevWeight = (s) => (['严重', '高'].includes(s) ? 3 : s === '中' ? 2 : 1);

/* ── 时长辅助（解析 'YYYY-MM-DD HH:mm' → Date，计算区间小时数；供时效指标复用） ── */
const parseDT = (s) => {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  return Number.isNaN(d.getTime()) ? null : d;
};
const hoursBetween = (from, to) => {
  const a = parseDT(from); const b = parseDT(to);
  return a && b ? (b - a) / 3.6e6 : null;
};
// 平台占位「当前时间」（与 TODAY 口径一致；仅用于占位 SLA / 超时计算，非真实业务字段）
const NOW = parseDT(`${TODAY} 00:00`);
const hoursSince = (from) => { const a = parseDT(from); return a ? (NOW - a) / 3.6e6 : null; };
// avgHours(pairs)：pairs 为 [from, to] 数组，返回平均小时数（忽略 null / 无效 / 负值），无数据返回 null
function avgHours(pairs) {
  const xs = (pairs || []).map(([f, t]) => hoursBetween(f, t)).filter((h) => h != null && h >= 0);
  return xs.length ? xs.reduce((s, h) => s + h, 0) / xs.length : null;
}
// fmtDur(hours)：小时 → '2.5 小时' / '1.3 天'（无数据显示 '—'）
function fmtDur(hours) {
  if (hours == null || Number.isNaN(hours)) return '—';
  return hours < 24 ? `${Math.round(hours * 10) / 10} 小时` : `${Math.round((hours / 24) * 10) / 10} 天`;
}
const pctOf = (num, den) => (den ? Math.round((num / den) * 100) : 0);
const topN = (obj, n, color) => Object.entries(obj)
  .map(([name, value]) => ({ name, value, color }))
  .sort((a, b) => b.value - a.value)
  .slice(0, n);
// 超 SLA 工单：未关闭且创建已过 48h（占位口径）
const isOverSLA = (w) => isWOOpen(w) && (hoursSince(w.createTime || w.createdAt) || 0) > 48;
const woCreatedAt = (w) => w.createTime || w.createdAt || '';

function useShared(state) {
  const projects = state.projects || [];
  const wpp = state.workflowProductionPlans || [];
  const deliveryPlans = state.deliveryPlans || [];
  const devices = state.devices || [];
  const workOrders = [...(state.deliveryWorkOrders || []), ...(state.workOrders || [])];
  const qualityIssues = state.qualityIssues || [];
  const deviceTypes = state.deviceTypes || [];
  const projName = (id) => projects.find((x) => x.id === id)?.name || '—';
  const dtName = (id) => deviceTypes.find((t) => t.id === id)?.name || '—';
  return { projects, wpp, deliveryPlans, devices, workOrders, qualityIssues, deviceTypes, projName, dtName };
}

/* ── 复用图表片段（作为函数返回 chart element，直接作为 ResponsiveContainer 子节点） ── */
function donut(data) {
  return (
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={2} strokeWidth={0}>
        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
      </Pie>
      <Tooltip {...TT} />
      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
    </PieChart>
  );
}
function hbar(data, domain) {
  return (
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 6, bottom: 4 }}>
      <CartesianGrid horizontal={false} stroke="#f2f2f2" />
      <XAxis type="number" domain={domain || [0, 'dataMax']} tick={AXIS} axisLine={{ stroke: '#eee' }} tickLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey="name" width={88} tick={AXIS} axisLine={false} tickLine={false} />
      <Tooltip {...TT} />
      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fontSize: 11, fill: '#6b7280' }}>
        {data.map((d, i) => <Cell key={i} fill={d.color || C.blue} />)}
      </Bar>
    </BarChart>
  );
}

function ChartFrame({ title, subtitle, height = 264, children }) {
  return (
    <Section title={title} subtitle={subtitle}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </Section>
  );
}
function Grid2({ children }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>;
}

/* ═════════ 总览看板 ═════════ */
// 三问：ERP 同步是否正常？平台生命周期对象各有多少？当前有哪些风险？
function OverviewBoard({ state }) {
  const { projects, wpp, deliveryPlans, devices, workOrders, qualityIssues } = useShared(state);
  const moduleReplacements = state.moduleReplacements || [];

  const openQI = qualityIssues.filter(isQIOpen).length;

  // ── ERP 单据类型分布（源单据数量，按类型） ──
  const erpTypeData = ERP_DOC_META
    .map((m, i) => ({ name: m.label, value: (erpDocs[m.key] || []).length, color: CAT[i % CAT.length] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // ── 平台生命周期对象分布 ──
  const objData = [
    { name: '项目', value: projects.length },
    { name: '生产订单', value: wpp.length },
    { name: '设备 SN', value: devices.length },
    { name: '交付执行', value: deliveryPlans.length },
    { name: '问题池记录', value: qualityIssues.length },
    { name: '售后工单', value: workOrders.length },
    { name: '换件记录', value: moduleReplacements.length },
  ].map((d) => ({ ...d, color: C.blue })).sort((a, b) => b.value - a.value);

  // ── 风险摘要（三张精简 Top 表，非数据墙） ──
  const allDocs = ERP_DOC_META.flatMap((m) => (erpDocs[m.key] || []).map((d) => ({ ...d, typeLabel: m.label })));
  const lostDocs = allDocs.filter((d) => d.link?.status === '已失联').slice(0, 5);
  const severeQI = qualityIssues
    .filter((q) => isQIOpen(q) && ['高', '严重'].includes(q.severity))
    .sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity))
    .slice(0, 5);
  const overSLAWO = workOrders.filter(isOverSLA)
    .sort((a, b) => woCreatedAt(a).localeCompare(woCreatedAt(b)))
    .slice(0, 5);

  return (
    <Page>
      <PageHeader title="总览看板" description="平台与 ERP 只读同步概览：源单据关联情况、生命周期对象规模与当前风险。" />
      <StatGrid cols={4}>
        <StatCard label="ERP 源单据总数" value={erpDocTotals.total} hint="ERP 为单据唯一真实来源" />
        <StatCard label="已关联 ERP 单据数" value={erpDocTotals.linked} tone="success" />
        <StatCard label="已失联 ERP 单据数" value={erpDocTotals.lost} tone={erpDocTotals.lost ? 'warning' : 'default'} hint="源单据作废/接口未返回" />
        <StatCard label="未关闭问题数" value={openQI} tone={openQI ? 'warning' : 'default'} />
      </StatGrid>

      <Grid2>
        <ChartFrame title="ERP 单据类型分布" subtitle="采购 / 到货 / 入库 / 生产 / 出库 / 检验 / 服务交付等" height={360}>
          {hbar(erpTypeData)}
        </ChartFrame>
        <ChartFrame title="生命周期对象分布" subtitle="平台侧项目 / 生产 / 设备 / 交付 / 问题 / 售后 / 换件对象规模" height={360}>
          {hbar(objData)}
        </ChartFrame>
      </Grid2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="已失联 ERP 单据 Top" subtitle="源单据失联，保留历史快照">
          <Table head={['单据号', '类型', '失联原因']} empty="暂无失联单据">
            {lostDocs.map((d) => (
              <tr key={d.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-medium text-gray-800 text-xs whitespace-nowrap">{d.docNo}</td>
                <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={d.typeLabel} /></td>
                <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">{d.sync?.lostReason || '—'}</td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="未关闭高风险问题 Top" subtitle="严重度 高/严重 的未关闭质量问题">
          <Table head={['设备 SN', '问题', '严重度']} empty="暂无高风险问题">
            {severeQI.map((q) => (
              <tr key={q.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{q.deviceSN || q.deviceId}</td>
                <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">{q.faultL2 || q.issueDesc || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={q.severity} /></td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="超 SLA 售后工单 Top" subtitle="未关闭且已过 48h">
          <Table head={['工单号', '设备 SN', '超时时长']} empty="暂无超时工单">
            {overSLAWO.map((w) => (
              <tr key={w.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-medium text-gray-800 text-xs whitespace-nowrap">{w.id}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{w.deviceSN || w.deviceId || '—'}</td>
                <td className="px-3 py-2 text-amber-600 text-xs whitespace-nowrap">{fmtDur(hoursSince(woCreatedAt(w)))}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </Page>
  );
}

/* ═════════ 质量看板 ═════════ */
// 四问：本月检验多少？合格率如何？主要不合格原因？问题来源分布？
function QualityBoard({ state }) {
  const { devices, qualityIssues, workOrders, wpp, projName, dtName } = useShared(state);
  const tests = (state.testRecords || []).filter((t) => t.stationKey);
  const deliveryExceptions = state.deliveryExceptions || [];
  const alerts = state.alerts || [];
  const productInspection = erpDocs.productInspection || [];

  const inspResultOf = (r) => {
    const v = r.fields?.检验结果;
    if (v === '合格') return '合格';
    if (v === '不合格') return '不合格';
    if (v === '让步接收') return '让步接收·需复检';
    return '待处理·待检';
  };
  const testNG = tests.filter((t) => t.stationResult === 'NG');

  // ── 首屏 KPI（≤4） ──
  const inspTotal = productInspection.length;
  const inspPass = productInspection.filter((r) => r.fields?.检验结果 === '合格').length;
  const inspRate = pctOf(inspPass, inspTotal);
  const ngCount = productInspection.filter((r) => r.fields?.检验结果 === '不合格').length + testNG.length;
  const openQI = qualityIssues.filter(isQIOpen).length;

  // ── 产品检验结果分布 ──
  const inspBuckets = ['合格', '不合格', '让步接收·需复检', '待处理·待检'];
  const inspColor = { 合格: C.green, 不合格: C.red, '让步接收·需复检': C.amber, '待处理·待检': C.gray };
  const inspData = inspBuckets
    .map((k) => ({ name: k, value: productInspection.filter((r) => inspResultOf(r) === k).length, color: inspColor[k] }))
    .filter((d) => d.value > 0);

  // ── 检验合格率趋势（ERP 检验单日期稀疏，回退工站测试记录按日聚合） ──
  const byDay = {};
  tests.forEach((t) => {
    const d = day(t.testTime); if (!d) return;
    (byDay[d] = byDay[d] || { pass: 0, total: 0 }).total += 1;
    if (t.stationResult === 'Pass') byDay[d].pass += 1;
  });
  const passTrend = Object.keys(byDay).sort().slice(-14).map((d) => {
    const first = pctOf(byDay[d].pass, byDay[d].total);
    const final = Math.min(100, Math.round(first + (100 - first) * 0.4)); // 最终=含返修复测的估算，略高于一次合格率
    return { date: d.slice(5), first, final };
  });

  // ── 不合格原因 Top10（问题池 faultL2/L3 + 工单 faultL2 + 测试 ngReason） ──
  const faultCount = {};
  const bump = (k) => { if (k && k !== '待业务补充') faultCount[k] = (faultCount[k] || 0) + 1; };
  qualityIssues.forEach((q) => { bump(q.faultL2); bump(q.faultL3); });
  workOrders.forEach((w) => bump(w.faultL2));
  testNG.forEach((t) => bump(t.ngReason));
  const faultData = topN(faultCount, 10, C.red);

  // ── 质量问题来源分布（跨系统真实计数） ──
  const sourceData = [
    { name: '产品检验', value: productInspection.filter((r) => r.link?.status === '未关联' || r.fields?.检验结果 === '不合格').length, color: C.purple },
    { name: '生产测试', value: testNG.length, color: C.red },
    { name: '交付异常', value: deliveryExceptions.length, color: C.amber },
    { name: '售后问题', value: qualityIssues.filter((q) => q.sourceStage === '在线运营').length, color: C.blue },
    { name: '系统告警', value: alerts.filter((a) => !['已关闭', '已解决'].includes(a.status)).length, color: C.slate },
  ].filter((d) => d.value > 0);

  // ── 高风险设备摘要 ──
  const RISK_STATUS = ['生产返修中', 'NG待返修', '测试NG', '复测中', '维修中', '售后中', '质量测试中'];
  const riskDevices = devices.filter((d) => RISK_STATUS.includes(d.status)).slice(0, 10);
  const planOrderNo = (d) => wpp.find((w) => w.id === d.productionPlanId)?.erpProductionOrderNo || '—';
  const qiCountFor = (d) => qualityIssues.filter((q) => q.deviceId === d.id).length;

  return (
    <Page>
      <PageHeader title="质量看板" description="以产品检验、生产测试、问题池与售后记录跨阶段追踪质量：检验量、合格率、不合格原因与问题来源。" />
      <StatGrid cols={4}>
        <StatCard label="产品检验单数" value={inspTotal} hint="ERP 产品检验单（近 30 天）" />
        <StatCard label="检验合格率" value={`${inspRate}%`} tone={inspRate >= 80 ? 'success' : 'warning'} hint="合格单 / 全部检验单" />
        <StatCard label="NG·不合格数" value={ngCount} tone={ngCount ? 'danger' : 'default'} hint="检验不合格 + 测试 NG" />
        <StatCard label="待处理质量问题数" value={openQI} tone={openQI ? 'warning' : 'default'} />
      </StatGrid>

      <Grid2>
        <ChartFrame title="产品检验结果分布" subtitle="ERP 产品检验单：合格 / 不合格 / 让步接收 / 待检（示例口径）">{donut(inspData)}</ChartFrame>
        <ChartFrame title="不合格原因 Top10" subtitle="问题池 + 工单 + 测试 NG 故障点（faultL2/L3/ngReason）">{hbar(faultData, undefined)}</ChartFrame>
      </Grid2>

      <ChartFrame title="检验合格率趋势" subtitle="按测试日聚合：一次合格率与最终合格率（含返修复测估算，%）">
        <LineChart data={passTrend} margin={{ top: 8, right: 16, left: -18, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#f2f2f2" />
          <XAxis dataKey="date" tick={AXIS} axisLine={{ stroke: '#eee' }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 100]} width={32} />
          <Tooltip {...TT} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="first" name="一次合格率" stroke={C.blue} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="final" name="最终合格率" stroke={C.green} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ChartFrame>

      <ChartFrame title="质量问题来源分布" subtitle="产品检验 / 生产测试 / 交付异常 / 售后问题 / 系统告警">{hbar(sourceData)}</ChartFrame>

      <Section title="高风险设备摘要" subtitle="处于返修 / NG / 复测 / 维修 / 售后状态的设备，可跳转设备履历查看。">
        <Table head={['设备 SN', '机器人型号', '所属项目', '关联 ERP 生产订单', '最近检验结果', '关联问题数', '返修次数', '最近更新', '']} empty="暂无高风险设备">
          {riskDevices.map((d) => (
            <tr key={d.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{d.sn || d.id}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{dtName(d.deviceTypeId)}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{projName(d.projectId)}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{planOrderNo(d)}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{d.erpInspectionStatus || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{qiCountFor(d)}</td>
              <td className="px-3 py-2 text-gray-600">{d.repairCount ?? 0}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{d.updatedAt || '—'}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap"><LinkAction to={`/devices/${d.id}`}>查看设备履历</LinkAction></td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="质量追溯说明">
        <p className="text-[13px] text-gray-500 leading-relaxed">
          质量看板不替代 ERP 检验单。ERP 提供产品检验、入库、出库等正式单据；平台基于设备 SN、问题记录、模块绑定和售后记录做跨阶段质量追溯。
        </p>
      </Section>
    </Page>
  );
}

/* ═════════ 售后看板 ═════════ */
// 四问：还有多少未闭环问题？工单状态分布？主要故障与换件？哪些工单超时？
function AfterSalesBoard({ state }) {
  const { workOrders, qualityIssues, projName } = useShared(state);
  const materials = state.materials || [];
  const moduleReplacements = state.moduleReplacements || [];

  // ── 首屏 KPI（恰好 5） ──
  const openQI = qualityIssues.filter(isQIOpen).length;
  const preQI = qualityIssues.filter((q) => q.status === '待预处理').length;
  const toWOQI = qualityIssues.filter((q) => q.status === '已转售后工单').length;
  const overSLA = workOrders.filter(isOverSLA).length;
  const closedToday = workOrders.filter((w) => day(w.closeTime || w.closedAt) === TODAY).length;

  // ── 问题处理漏斗 ──
  const funnelData = [
    { name: '进入问题池', value: qualityIssues.length, color: '#1d4ed8' },
    { name: '技术客服预处理', value: qualityIssues.filter((q) => q.csFirstResponseTime).length, color: '#2563eb' },
    { name: '远程关闭', value: qualityIssues.filter((q) => q.remoteCloseTime).length, color: '#3b82f6' },
    { name: '转售后工单', value: qualityIssues.filter((q) => q.toWorkOrderTime).length, color: '#60a5fa' },
    { name: '已关单', value: workOrders.filter((w) => WO_CLOSED.includes(w.status)).length, color: '#93c5fd' },
  ];

  // ── 售后工单状态分布 ──
  const woBucket = (s) => {
    if (['待分派', '待处理'].includes(s)) return '待分派';
    if (s === '待接单') return '待接单';
    if (s === '待上门') return '待上门';
    if (['现场处理中', '处理中', '复检中'].includes(s)) return '现场处理中';
    if (['已关单', '已关闭'].includes(s)) return '已关单';
    return '已取消';
  };
  const woStatusData = ['待分派', '待接单', '待上门', '现场处理中', '已关单', '已取消']
    .map((k) => ({ name: k, value: workOrders.filter((w) => woBucket(w.status) === k).length, color: sHex(k) }))
    .filter((d) => d.value > 0);

  // ── 高频故障原因 Top10（工单 + 问题池） ──
  const faultCount = {};
  const bump = (k) => { if (k && k !== '待业务补充') faultCount[k] = (faultCount[k] || 0) + 1; };
  workOrders.forEach((w) => bump(w.faultL2 || w.faultL3 || w.faultL1));
  qualityIssues.forEach((q) => bump(q.faultL2));
  const faultData = topN(faultCount, 10, C.amber);

  // ── 换件部件分布 ──
  const matCat = {};
  materials.forEach((m) => { matCat[m.id] = m.category; });
  const partCount = {};
  moduleReplacements.forEach((r) => { const c = matCat[r.addedMaterialId] || matCat[r.removedMaterialId] || '其他'; partCount[c] = (partCount[c] || 0) + 1; });
  workOrders.filter((w) => w.involvesReplacement).forEach((w) => { const c = (w.needReplaceModuleType || '其他').replace('模块', ''); partCount[c] = (partCount[c] || 0) + 1; });
  const partData = Object.entries(partCount).map(([name, value], i) => ({ name, value, color: CAT[i % CAT.length] })).sort((a, b) => b.value - a.value);

  // ── SLA 与时效概览（合并原时效卡片为一张精简表） ──
  const slaRows = [
    ['技术客服平均首次响应', fmtDur(avgHours(qualityIssues.map((q) => [q.enterPoolTime, q.csFirstResponseTime]))), 'enterPool → 首次响应'],
    ['技术客服平均预处理', fmtDur(avgHours(qualityIssues.map((q) => [q.csFirstResponseTime, q.preprocessDoneTime]))), '首次响应 → 预处理完成'],
    ['Leader 平均分派', fmtDur(avgHours(workOrders.map((w) => [w.createTime, w.dispatchTime]))), 'create → dispatch'],
    ['工程师平均接单', fmtDur(avgHours(workOrders.map((w) => [w.dispatchTime, w.acceptTime]))), 'dispatch → accept'],
    ['平均现场处理', fmtDur(avgHours(workOrders.map((w) => [w.onsiteStartTime, w.onsiteDoneTime]))), '现场开始 → 完成'],
    ['平均关单', fmtDur(avgHours(workOrders.filter((w) => w.closeTime).map((w) => [w.createTime, w.closeTime]))), 'create → close（已关单）'],
  ];

  // ── 超时工单摘要 ──
  const NEXT_ACTION = { 待分派: '分派工程师', 待处理: '分派工程师', 待接单: '工程师接单', 待上门: '安排现场上门', 现场处理中: '现场处理 / 换件', 处理中: '现场处理 / 换件', 复检中: '复检确认关单' };
  const srcIssue = (w) => w.sourceIssueId || qualityIssues.find((q) => q.linkedWorkOrderId === w.id)?.id || '—';
  const owner = (w) => w.engineer || w.assignedTo || w.leader || '—';
  const agedWO = workOrders.filter(isOverSLA)
    .sort((a, b) => woCreatedAt(a).localeCompare(woCreatedAt(b)))
    .slice(0, 8);

  return (
    <Page>
      <PageHeader title="售后看板" description="聚合问题处理漏斗、售后工单状态、故障原因与换件部件，追踪未闭环与超时风险。" />
      <StatGrid cols={5}>
        <StatCard label="未关闭问题" value={openQI} tone={openQI ? 'warning' : 'default'} />
        <StatCard label="待预处理问题" value={preQI} tone={preQI ? 'warning' : 'default'} />
        <StatCard label="已转售后工单" value={toWOQI} />
        <StatCard label="超 SLA 工单" value={overSLA} tone={overSLA ? 'danger' : 'default'} hint="未关闭且已过 48h" />
        <StatCard label="今日关单数" value={closedToday} hint={`口径日 ${TODAY}`} />
      </StatGrid>

      <Grid2>
        <ChartFrame title="问题处理漏斗" subtitle="进入问题池 → 预处理 → 远程关闭 / 转售后工单 → 已关单">{hbar(funnelData)}</ChartFrame>
        <ChartFrame title="售后工单状态分布" subtitle="待分派 / 待接单 / 待上门 / 现场处理中 / 已关单 / 已取消">{hbar(woStatusData)}</ChartFrame>
      </Grid2>

      <Grid2>
        <ChartFrame title="高频故障原因 Top10" subtitle="工单 + 问题池故障点（faultL2/L3/L1）">{hbar(faultData)}</ChartFrame>
        <ChartFrame title="换件部件分布" subtitle="换件记录 + 换件工单按核心部件类型">{donut(partData)}</ChartFrame>
      </Grid2>

      <Section title="SLA 与时效概览" subtitle="问题池与售后工单各环节平均耗时（占位口径，源自时间戳字段）">
        <Table head={['时效指标', '平均耗时', '口径']} empty="暂无时效数据">
          {slaRows.map(([label, value, note]) => (
            <tr key={label} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{label}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{value}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{note}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="超时工单摘要" subtitle="未关闭且已过 48h 的售后工单，可跳转售后工单查看。">
        <Table head={['售后工单号', '来源问题', '设备 SN', '项目', '当前状态', '当前责任人', '超时时长', '下一步动作', '']} empty="暂无超时工单">
          {agedWO.map((w) => (
            <tr key={w.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{w.id}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{srcIssue(w)}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{w.deviceSN || w.deviceId || '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{projName(w.projectId)}</td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={w.status} /></td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{owner(w)}</td>
              <td className="px-3 py-2 text-amber-600 text-xs whitespace-nowrap">{fmtDur(hoursSince(woCreatedAt(w)))}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{NEXT_ACTION[w.status] || '跟进处理'}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap"><LinkAction to="/after-sales?tab=orders">查看工单</LinkAction></td>
            </tr>
          ))}
        </Table>
      </Section>
    </Page>
  );
}

const BOARDS = {
  overview: OverviewBoard,
  quality: QualityBoard,
  aftersales: AfterSalesBoard,
};

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const { state } = useApp();
  const tab = searchParams.get('tab');
  // 兼容旧链接：operation / project / delivery 统一回退到总览看板
  const LEGACY = { operation: 'overview', project: 'overview', delivery: 'overview' };
  const key = LEGACY[tab] || tab;
  const Board = BOARDS[key] || OverviewBoard;
  return <Board state={state} />;
}
