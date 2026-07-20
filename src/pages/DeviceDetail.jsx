import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Page, PageHeader, Section, DescList, Table, Btn, LinkAction, EmptyState } from '../components/ui';
import { deviceLifecycleStatus, deviceBusinessNode, deviceModuleBindings, assemblyProgress } from '../utils/status';
import ModuleDetailDrawer from '../components/ModuleDetailDrawer';

const STATION_LABELS = { semi: '半成品检验', init: '初测', mid: '中测', oqt: 'OQT终测' };

// 模块作用域时间戳，避免组件渲染期调用不纯函数（react-hooks/purity）。
const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

// 在线状态四态推导（与设备台账口径一致）。
function onlineStateOf(device) {
  const lc = deviceLifecycleStatus(device);
  if (lc === '在线运营') {
    if (device.online === true) return '在线';
    if (device.online === false) return '离线';
    return '未知';
  }
  if (['生产中', '待入库', '待交付', '交付中'].includes(lc)) return '未接入';
  return '未知';
}

// 占位二维码：由 SN 派生的确定性图案 + 三个定位角，纯展示用。
function QrPlaceholder({ seed = '' }) {
  const n = 21;
  const s = seed || 'SN';
  const isFinder = (r, c) => {
    const inBox = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    const ring = (br, bc) => inBox(br, bc) && !(r > br && r < br + 6 && c > bc && c < bc + 6 && !(r > br + 1 && r < br + 5 && c > bc + 1 && c < bc + 5));
    return ring(0, 0) || ring(0, n - 7) || ring(n - 7, 0);
  };
  const rects = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const finderZone = (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
      if (finderZone) {
        if (isFinder(r, c)) rects.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
      } else {
        const v = (s.charCodeAt((r * n + c) % s.length) + r * 7 + c * 13) % 5;
        if (v < 2) rects.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="w-44 h-44 text-gray-900" fill="currentColor" shapeRendering="crispEdges">
      {rects}
    </svg>
  );
}

function VoidTestRecordInline({ record, onVoid }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="ui-link text-red-500">作废</button>;
  return (
    <div className="flex items-center gap-2">
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="作废原因" className="ui-input w-36 h-7 text-xs" />
      <Btn size="sm" variant="danger" onClick={() => { if (reason.trim()) { onVoid(record, reason.trim()); setOpen(false); setReason(''); } }}>确认</Btn>
      <Btn size="sm" variant="ghost" onClick={() => { setOpen(false); setReason(''); }}>取消</Btn>
    </div>
  );
}

export default function DeviceDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [showQR, setShowQR] = useState(false);
  const [moduleDrawerId, setModuleDrawerId] = useState(null);

  const device = state.devices.find((d) => d.id === id);

  if (!device) {
    return (
      <Page>
        <PageHeader title="设备不存在" description="未找到该设备，可能已被移除。" actions={<Btn as="link" to="/assets?tab=devices" variant="secondary">返回设备台账</Btn>} />
        <EmptyState>设备不存在</EmptyState>
      </Page>
    );
  }

  const deviceType = state.deviceTypes.find((dt) => dt.id === device.deviceTypeId);
  const project = device.projectId ? state.projects.find((p) => p.id === device.projectId) : null;
  const location = device.locationId ? (state.locations || []).find((l) => l.id === device.locationId) : null;
  const plan = device.productionPlanId ? (state.workflowProductionPlans || []).find((p) => p.id === device.productionPlanId) : null;
  const deliveryPlan = device.deliveryPlanId ? (state.deliveryPlans || []).find((p) => p.id === device.deliveryPlanId) : null;

  const testRecords = state.testRecords.filter((t) => t.deviceId === id).sort((a, b) => (b.testTime || '').localeCompare(a.testTime || ''));
  const operationLogs = state.operationLogs.filter((l) => l.deviceId === id).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const deliveries = state.deliveryRecords.filter((d) => d.deviceId === id).sort((a, b) => (b.recordTime || '').localeCompare(a.recordTime || ''));
  const workOrders = state.workOrders.filter((w) => w.deviceId === id);
  const productionWorkOrders = (state.productionWorkOrders || []).filter((w) => w.deviceId === id);
  const replacements = state.moduleReplacements.filter((mr) => mr.deviceId === id);
  const qualityIssues = (state.qualityIssues || []).filter((q) => q.deviceId === id);
  const alerts = (state.alerts || []).filter((a) => a.deviceId === id);

  const lifecycle = deviceLifecycleStatus(device);
  const online = onlineStateOf(device);

  const getMaterial = (materialId) => state.materials.find((m) => m.id === materialId);
  const getMaterialSN = (materialId) => getMaterial(materialId)?.sn || materialId || '—';

  const handleVoidTestRecord = (record, reason) => {
    const now = nowStamp();
    dispatch({ type: 'UPDATE_TEST_RECORD', payload: { id: record.id, voided: true, voidReason: reason, voidedAt: now } });
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: { id: `LOG-${record.id}-void`, deviceId: id, operator: state.currentUser, timestamp: now, actionType: '作废测试记录', fromStatus: device.status, toStatus: device.status, notes: `作废测试记录 ${record.id}，原因：${reason}` },
    });
  };

  // 问题与售后：质量问题 + 售后工单 + 健康告警合并时间线
  const issueRows = [
    ...qualityIssues.map((q) => ({ kind: '质量问题', id: q.id, summary: q.issueDesc, stage: q.sourceStage, severity: q.severity, status: q.status, owner: q.owner || q.reporterName, time: q.reportTime, to: '/after-sales?tab=quality' })),
    ...workOrders.map((w) => ({ kind: '售后工单', id: w.id, summary: w.description, stage: w.woClass, severity: w.severity, status: w.status, owner: w.assignedTo || '待指派', time: w.createdAt, to: '/after-sales?tab=orders' })),
    ...alerts.map((a) => ({ kind: '健康告警', id: a.id, summary: a.description, stage: a.alertType, severity: a.severity, status: a.status, owner: a.owner || '—', time: a.alertTime, to: null })),
  ].sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  // 模块 / 核心部件：基于机器人型号装配模板逐槽位绑定情况
  const bindings = deviceModuleBindings(device, state.deviceTypes, state.moduleTypes, state.moduleInstances, state.moduleReplacements, state.materialBatches);
  const progress = assemblyProgress(device, state.deviceTypes, state.moduleTypes, state.moduleInstances, state.moduleReplacements);

  // 生产过程记录：装配 → 模块绑定 → 各测试工站 → 生产返修 → 复测 → 测试完成 的节点时间线
  const testByStation = (key) => testRecords.find((t) => t.stationKey === key && !t.voided);
  const recBadge = (rec) => (rec ? (rec.result === '合格' ? '合格' : '不合格') : '未开始');
  const TEST_DONE_STATES = ['已完成测试', '测试通过', '待入库', '已入库', '待分配项目', '已分配项目', '在线运营', '待交付', '可交付', '待出厂检验', '出厂检验中', '现场安装调试中', '客户验收中', '售后中', '维修中'];
  const semiRec = testByStation('semi');
  const initRec = testByStation('init');
  const midRec = testByStation('mid');
  const oqtRec = testByStation('oqt');
  const latestPWO = [...productionWorkOrders].sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))[0];
  const retestLog = operationLogs.find((l) => (l.actionType || '').includes('复测') || (l.notes || '').includes('复测'));
  const allStationsPass = [semiRec, initRec, midRec, oqtRec].every((r) => r && r.result === '合格');
  const testDone = allStationsPass || TEST_DONE_STATES.includes(device.status);
  const processTimeline = [
    { label: '装配开始', status: device.assemblyTime ? '已完成' : '未开始', time: device.assemblyTime || '—', operator: device.assembler || '—', hit: !!device.assemblyTime, note: '整机装配启动' },
    { label: '模块绑定', status: progress.total ? (progress.bound === progress.total ? '已完成' : progress.bound > 0 ? '模块绑定中' : '待绑定') : '待绑定', time: progress.bound > 0 ? (device.assemblyTime || '—') : '—', operator: progress.bound > 0 ? (device.assembler || '—') : '—', hit: progress.bound > 0, note: `模块绑定进度 ${progress.bound}/${progress.total}` },
    { label: '半成品检验', status: recBadge(semiRec), time: semiRec?.testTime || '—', operator: semiRec?.operator || '—', hit: !!semiRec, note: semiRec?.notes || '' },
    { label: '初测', status: recBadge(initRec), time: initRec?.testTime || '—', operator: initRec?.operator || '—', hit: !!initRec, note: initRec?.notes || '' },
    { label: '中测', status: recBadge(midRec), time: midRec?.testTime || '—', operator: midRec?.operator || '—', hit: !!midRec, note: midRec?.notes || '' },
    { label: 'OQT终测', status: recBadge(oqtRec), time: oqtRec?.testTime || '—', operator: oqtRec?.operator || '—', hit: !!oqtRec, note: oqtRec?.notes || '' },
    { label: '生产返修', status: latestPWO ? latestPWO.status : '未开始', time: latestPWO ? (latestPWO.updatedAt || latestPWO.createdAt || '—') : '—', operator: latestPWO ? (latestPWO.assignedTo || '待指派') : '—', hit: !!latestPWO, note: latestPWO ? `工单 ${latestPWO.id}${latestPWO.ngStation ? ` · ${STATION_LABELS[latestPWO.ngStation] || latestPWO.ngStation}` : ''}` : '' },
    { label: '复测', status: (device.status === '复测中' || retestLog) ? '复测中' : '未开始', time: retestLog?.timestamp || (device.status === '复测中' ? (device.updatedAt || '—') : '—'), operator: retestLog?.operator || '—', hit: !!(device.status === '复测中' || retestLog), note: '' },
    { label: '测试完成', status: testDone ? '测试通过' : '未完成', time: testDone ? (device.inboundTime || oqtRec?.testTime || '—') : '—', operator: testDone ? (oqtRec?.operator || device.assembler || '—') : '—', hit: testDone, note: '' },
  ];

  return (
    <Page>
      <PageHeader
        breadcrumb={
          <div className="text-xs text-gray-400 mb-1">
            <Link to="/assets?tab=devices" className="ui-link">设备台账</Link>
            <span className="mx-1">/</span>
            <span className="text-gray-500">{device.sn}</span>
          </div>
        }
        title={device.sn}
        description={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>{deviceType?.name || device.deviceTypeId}</span>
            {project && <><span className="text-gray-300">·</span><span>{project.name}</span></>}
            <StatusBadge status={lifecycle} />
            <StatusBadge status={online} />
          </span>
        }
        actions={<Btn as="link" to="/assets?tab=devices" variant="secondary">返回设备台账</Btn>}
      />

      {/* 基础信息 */}
      <Section title="基础信息">
        <DescList
          cols={4}
          items={[
            ['设备 SN', device.sn],
            ['机器人型号', deviceType?.name || device.deviceTypeId],
            ['所属项目', project ? <Link to={`/projects/${project.id}`} className="ui-link">{project.name}</Link> : '—'],
            ['客户名称', project?.client ?? '—'],
            ['项目类型 / 业务场景', project?.projectType ?? '—'],
            ['所属点位', location?.name ?? '—'],
            ['当前状态', <StatusBadge key="lc" status={lifecycle} />],
            ['在线状态', <StatusBadge key="on" status={online} />],
            ['当前业务节点', <StatusBadge key="node" status={deviceBusinessNode(device)} />],
            ['装配人', device.assembler ?? '—'],
            ['装配时间', device.assemblyTime ?? '—'],
            ['创建时间', device.createdAt ?? '—'],
            ['最近更新', device.updatedAt ?? '—'],
            ['设备别名', device.alias ?? '—'],
            ['网络标识', device.networkId ?? '—'],
          ]}
        />
      </Section>

      {/* 二维码入口 */}
      <Section title="二维码入口" right={<Btn size="sm" variant="secondary" onClick={() => setShowQR(true)}>查看二维码</Btn>}>
        <DescList
          cols={4}
          items={[
            ['二维码状态', device.qrStatus ?? '已生成'],
            ['二维码标识', device.qrCodeId ?? `QR-${device.sn}`],
            ['生成时间', device.qrGeneratedAt ?? device.createdAt ?? '—'],
            ['最近扫码时间', device.qrLastScanAt ?? '—'],
          ]}
        />
        <p className="text-xs text-gray-400 mt-3">扫码可进入移动端上报页登记质量问题；二维码标识用于设备识别，不承载敏感信息。</p>
      </Section>

      {/* 模块 / 核心部件 */}
      <Section
        title="模块 / 核心部件"
        subtitle={`基于该设备所属机器人型号装配模板生成的槽位绑定情况 · 装配进度 ${progress.bound}/${progress.total}（${progress.rate}%）`}
        bodyClassName="p-0"
      >
        <Table head={['槽位名称', '应绑定部件类型', '模块 SN / 内部 ID', '物料编码', '物料名称', '批次号', 'ERP 库存状态', '平台占用状态', '绑定状态', '绑定时间', '绑定人', '异常说明', '操作']} empty="该型号暂无装配模板槽位">
          {bindings.map((b, i) => (
            <tr key={i} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{b.slotName}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{b.moduleTypeName}{b.corePartType && b.corePartType !== '—' && <span className="ml-2 bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">{b.corePartType}</span>}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{b.moduleSN}{b.moduleId ? ` · ${b.moduleId}` : ''}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{b.materialCode}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{b.materialName}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{b.batchNo}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{b.erpStockStatus}</td>
              <td className="px-3 py-2">{b.platformStatus && b.platformStatus !== '—' ? <StatusBadge status={b.platformStatus} /> : <span className="text-gray-300 text-xs">—</span>}</td>
              <td className="px-3 py-2"><StatusBadge status={b.bindStatus} /></td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{b.bindTime}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{b.operator}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{b.exception || '—'}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{b.moduleId ? <LinkAction onClick={() => setModuleDrawerId(b.moduleId)}>查看模块详情</LinkAction> : <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 生产过程记录（过程节点时间线，区别于模块绑定表） */}
      <Section title="生产过程记录" subtitle="该设备从整机装配到测试完成的过程节点时间线（由操作日志 / 测试记录映射，未命中显示未开始 / —）">
        <div>
          {processTimeline.map((n, i) => (
            <div key={n.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${n.hit ? 'bg-slate-700' : 'bg-white border border-gray-300'}`} />
                {i < processTimeline.length - 1 && <span className="w-px flex-1 bg-[#ececec] my-1" />}
              </div>
              <div className="pb-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-gray-800">{n.label}</span>
                  <StatusBadge status={n.status} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {n.time}{n.operator && n.operator !== '—' ? ` · ${n.operator}` : ''}{n.note ? ` · ${n.note}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 装配记录 */}
      <Section title="装配记录" subtitle="整机装配的生产计划、模板与绑定进度信息">
        <DescList
          cols={4}
          items={[
            ['生产计划编号', device.productionPlanId ? (plan ? <Link to={`/production-plans/${plan.id}`} className="ui-link">{device.productionPlanId}</Link> : device.productionPlanId) : '—'],
            ['装配开始时间', device.assemblyStartTime || device.assemblyTime || '—'],
            ['装配完成时间', device.assemblyTime ?? '—'],
            ['装配人', device.assembler ?? '—'],
            ['装配模板', deviceType ? `${deviceType.name} 装配模板` : '—'],
            ['模块绑定进度', `${progress.bound}/${progress.total}`],
            ['异常说明', device.assemblyException || device.exceptionNote || '—'],
            ['附件', device.photoName ?? '—'],
            ['操作日志入口', <a key="oplog" href="#device-oplog" className="ui-link text-[13px]">查看操作日志（{operationLogs.length}）</a>],
          ]}
        />
      </Section>

      {/* 质量测试记录 */}
      <Section title="质量测试记录" subtitle={`共 ${testRecords.length} 条`} bodyClassName="p-0">
        <Table head={['测试工站', '结果', '测试员', '测试时间', '报告文件', '备注', '操作']} empty="暂无测试记录">
          {testRecords.map((t) => (
            <tr key={t.id} className={`hover:bg-[#fafafa] ${t.voided ? 'opacity-60' : ''}`}>
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{STATION_LABELS[t.stationKey] || t.testType || '—'}</td>
              <td className="px-3 py-2">{t.voided ? <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">已作废</span> : <StatusBadge status={t.result === '合格' ? '合格' : '不合格'} />}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{t.operator}</td>
              <td className={`px-3 py-2 text-xs whitespace-nowrap ${t.voided ? 'line-through text-gray-400' : 'text-gray-500'}`}>{t.testTime}</td>
              <td className="px-3 py-2 text-gray-400 text-xs font-mono">{t.reportFile || '—'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{t.notes || '—'}</td>
              <td className="px-3 py-2 text-xs">
                {t.voided
                  ? <span className="text-gray-400 text-xs">已作废 · {t.voidedAt}</span>
                  : canDo('void_test_record')
                    ? <VoidTestRecordInline record={t} onVoid={handleVoidTestRecord} />
                    : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 交付记录 */}
      <Section title="交付记录" subtitle={deliveryPlan ? `交付计划 ${deliveryPlan.batchNo || deliveryPlan.name}` : undefined} bodyClassName="p-0">
        <Table head={['阶段', '结果', '地点', '操作人', '时间', '备注']} empty="暂无交付记录">
          {deliveries.map((d) => (
            <tr key={d.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{d.stage}</td>
              <td className="px-3 py-2"><StatusBadge status={d.result} /></td>
              <td className="px-3 py-2 text-gray-500 text-xs">{d.address || '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{d.operator || '—'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{d.recordTime}</td>
              <td className="px-3 py-2 text-gray-400 text-xs max-w-xs"><span className="truncate block">{d.notes || '—'}</span></td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 问题与售后 */}
      <Section title="问题与售后" subtitle="设备关联的质量问题、售后工单与健康告警" bodyClassName="p-0">
        <Table head={['类型', '编号', '摘要', '阶段 / 分类', '严重程度', '状态', '负责人', '时间', '入口']} empty="暂无问题与售后记录">
          {issueRows.map((r) => (
            <tr key={`${r.kind}-${r.id}`} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{r.kind}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{r.id}</td>
              <td className="px-3 py-2 text-gray-600 text-xs max-w-xs"><span className="truncate block">{r.summary}</span></td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.stage || '—'}</td>
              <td className="px-3 py-2"><StatusBadge status={r.severity} /></td>
              <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.owner}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{r.time}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{r.to ? <LinkAction to={r.to}>查看</LinkAction> : <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 换件记录 */}
      <Section title="换件记录" subtitle={`共 ${replacements.length} 条`} bodyClassName="p-0">
        <Table head={['槽位', '原模块 SN', '新模块 SN', '原件处置', '关联工单', '操作人', '时间', '备注']} empty="暂无换件记录">
          {replacements.map((mr) => (
            <tr key={mr.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{mr.slotName || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{getMaterialSN(mr.removedMaterialId)}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">{getMaterialSN(mr.addedMaterialId)}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{mr.removedDisposition || '—'}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{mr.workOrderId ? <LinkAction to="/after-sales?tab=orders">{mr.workOrderId}</LinkAction> : '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{mr.operator || '—'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{mr.timestamp}</td>
              <td className="px-3 py-2 text-gray-400 text-xs max-w-xs"><span className="truncate block">{mr.notes || '—'}</span></td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* ERP 关联信息 */}
      <Section title="ERP 关联信息" subtitle="只读同步自 ERP">
        <DescList
          cols={4}
          items={[
            ['ERP 项目号', project?.erpProjectNo ?? '—'],
            ['产成品入库单号', device.erpStorageOrderNo ?? '—'],
            ['入库单号', device.erpInboundNo ?? '—'],
            ['检验单号', device.erpInspectionNo ?? '—'],
            ['检验状态', device.erpInspectionStatus ?? '—'],
            ['库存状态', device.erpStockStatus ?? '—'],
            ['ERP 序列号', device.erpSerialNo ?? '—'],
            ['仓库', device.warehouse ?? '—'],
            ['入库时间', device.inboundTime ?? '—'],
          ]}
        />
      </Section>

      {/* 操作日志 */}
      <div id="device-oplog" className="scroll-mt-4">
      <Section title="操作日志" subtitle={`共 ${operationLogs.length} 条 · 从新到旧`} bodyClassName="p-0">
        <Table head={['时间', '操作人', '动作', '状态变化', '说明']} empty="暂无操作日志">
          {operationLogs.map((log) => (
            <tr key={log.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{log.timestamp}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{log.operator}</td>
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{log.actionType}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {log.fromStatus && log.toStatus
                  ? <span className="inline-flex items-center gap-1.5 text-gray-500"><StatusBadge status={log.fromStatus} /><span className="text-gray-300">→</span><StatusBadge status={log.toStatus} /></span>
                  : '—'}
              </td>
              <td className="px-3 py-2 text-gray-500 text-xs max-w-md"><span className="truncate block">{log.notes || '—'}</span></td>
            </tr>
          ))}
        </Table>
      </Section>
      </div>

      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="设备二维码" size="sm">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="p-4 bg-white border border-[#ececec] rounded-lg"><QrPlaceholder seed={device.sn} /></div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-800 font-mono">{device.sn}</div>
            <div className="text-xs text-gray-400 mt-0.5">二维码标识：{device.qrCodeId ?? `QR-${device.sn}`}</div>
          </div>
          <p className="text-xs text-gray-400 text-center">（原型占位二维码）扫码进入移动端上报页登记该设备的质量问题。</p>
        </div>
      </Modal>

      <ModuleDetailDrawer moduleId={moduleDrawerId} onClose={() => setModuleDrawerId(null)} />
    </Page>
  );
}
