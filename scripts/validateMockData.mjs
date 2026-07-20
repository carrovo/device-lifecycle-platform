// Mock 数据一致性校验脚本
// 运行：node scripts/validateMockData.mjs
// 校验全平台 mock 数据的生命周期隔离与跨页面引用一致性（见任务第十三节 20 条规则）。

import {
  devices, workflowProductionPlans, productionPlans, deliveryPlans, projects,
  locations, alerts, workOrders, deliveryWorkOrders, productionWorkOrders,
  qualityIssues, moduleReplacements, materialBatches, moduleInstances, testRecords,
  operationLogs, deviceAllocations, deliveryRecords,
} from '../src/data/mockData.js';
import { deviceLifecycleStatus } from '../src/utils/status.js';

const errors = [];
const err = (type, id, current, refLocation, suggestion) =>
  errors.push({ type, id, current, refLocation, suggestion });

const deviceById = new Map(devices.map((d) => [d.id, d]));
const projectIds = new Set(projects.map((p) => p.id));
const prodPlanIds = new Set([...workflowProductionPlans, ...productionPlans].map((p) => p.id));
const deliveryPlanIds = new Set(deliveryPlans.map((p) => p.id));
const locationIds = new Set(locations.map((l) => l.id));
const batchIds = new Set(materialBatches.map((b) => b.id));
const woIds = new Set([...workOrders, ...deliveryWorkOrders].map((w) => w.id));
const life = (id) => { const d = deviceById.get(id); return d ? deviceLifecycleStatus(d) : null; };
const isProducing = (id) => life(id) === '生产中' || life(id) === '待入库';

// 汇总交付计划已绑定设备（boundDeviceIds ∪ records.*.deviceId）
const boundDeviceRefs = new Map(); // deviceId -> planId
for (const dp of deliveryPlans) {
  const ids = new Set(dp.boundDeviceIds || []);
  const r = dp.records || {};
  ['binding', 'factoryInspection', 'siteInstall', 'customerAccept'].forEach((k) =>
    (r[k] || []).forEach((rec) => rec.deviceId && ids.add(rec.deviceId)));
  ids.forEach((id) => boundDeviceRefs.set(id, dp.id));
}

// ---- 1. 所有引用的 deviceId 必须存在 ----
const deviceRefs = [];
alerts.forEach((a) => deviceRefs.push([a.deviceId, `alerts.${a.id}`]));
workOrders.forEach((w) => deviceRefs.push([w.deviceId, `workOrders.${w.id}`]));
deliveryWorkOrders.forEach((w) => deviceRefs.push([w.deviceId, `deliveryWorkOrders.${w.id}`]));
productionWorkOrders.forEach((w) => deviceRefs.push([w.deviceId, `productionWorkOrders.${w.id}`]));
qualityIssues.forEach((q) => deviceRefs.push([q.deviceId, `qualityIssues.${q.id}`]));
operationLogs.forEach((l) => l.deviceId && deviceRefs.push([l.deviceId, `operationLogs.${l.id}`]));
deviceAllocations.forEach((a) => deviceRefs.push([a.deviceId, `deviceAllocations.${a.id}`]));
deliveryRecords.forEach((d) => deviceRefs.push([d.deviceId, `deliveryRecords.${d.id}`]));
moduleReplacements.forEach((m) => deviceRefs.push([m.deviceId, `moduleReplacements.${m.id}`]));
testRecords.forEach((t) => deviceRefs.push([t.deviceId, `testRecords.${t.id}`]));
locations.forEach((l) => (l.deviceIds || []).forEach((id) => deviceRefs.push([id, `locations.${l.id}.deviceIds`])));
deliveryPlans.forEach((dp) => (dp.boundDeviceIds || []).forEach((id) => deviceRefs.push([id, `deliveryPlans.${dp.id}.boundDeviceIds`])));
for (const [id, ref] of deviceRefs) {
  if (id && !deviceById.has(id)) err('设备不存在', id, '—', ref, '引用了不存在的设备，请修正或补充设备');
}

// ---- 2. projectId / productionPlanId / deliveryPlanId / locationId 必须存在 ----
devices.forEach((d) => {
  if (d.projectId && !projectIds.has(d.projectId)) err('项目不存在', d.id, d.status, `devices.${d.id}.projectId=${d.projectId}`, '修正 projectId');
  if (d.productionPlanId && !prodPlanIds.has(d.productionPlanId)) err('生产计划不存在', d.id, d.status, `devices.${d.id}.productionPlanId=${d.productionPlanId}`, '修正 productionPlanId');
  if (d.deliveryPlanId && !deliveryPlanIds.has(d.deliveryPlanId)) err('交付计划不存在', d.id, d.status, `devices.${d.id}.deliveryPlanId=${d.deliveryPlanId}`, '修正 deliveryPlanId');
  if (d.locationId && !locationIds.has(d.locationId)) err('点位不存在', d.id, d.status, `devices.${d.id}.locationId=${d.locationId}`, '修正 locationId');
});
locations.forEach((l) => { if (!projectIds.has(l.projectId)) err('项目不存在', l.id, '—', `locations.${l.id}.projectId=${l.projectId}`, '修正 projectId'); });
deliveryPlans.forEach((p) => { if (!projectIds.has(p.projectId)) err('项目不存在', p.id, p.status, `deliveryPlans.${p.id}.projectId`, '修正 projectId'); });
workflowProductionPlans.forEach((p) => { if (!projectIds.has(p.projectId)) err('项目不存在', p.id, p.status, `workflowProductionPlans.${p.id}.projectId`, '修正 projectId'); });

// ---- 3. 同一生产计划下所有设备 deviceTypeId 必须等于 plan.deviceTypeId ----
workflowProductionPlans.forEach((p) => {
  devices.filter((d) => d.productionPlanId === p.id).forEach((d) => {
    if (d.deviceTypeId !== p.deviceTypeId) err('设备类型与生产计划不一致', d.id, d.deviceTypeId, `plan ${p.id} 要求 ${p.deviceTypeId}`, `将设备类型改为 ${p.deviceTypeId} 或移出该计划`);
  });
});

// ---- 4. 生产中/测试中/返修中设备不得出现在 locations / alerts / 在线运营 QI / 售后工单 / 交付计划绑定 ----
locations.forEach((l) => (l.deviceIds || []).forEach((id) => { if (isProducing(id)) err('生产中设备被点位引用', id, life(id), `locations.${l.id}`, '点位仅可引用在线运营设备'); }));
alerts.forEach((a) => { if (isProducing(a.deviceId)) err('生产中设备被告警引用', a.deviceId, life(a.deviceId), `alerts.${a.id}`, '告警仅可引用在线运营/交付后设备'); });
qualityIssues.forEach((q) => { if (q.sourceStage === '在线运营' && isProducing(q.deviceId)) err('生产中设备被在线质量问题引用', q.deviceId, life(q.deviceId), `qualityIssues.${q.id}`, '在线运营质量问题仅可引用在线运营设备'); });
workOrders.forEach((w) => { if (isProducing(w.deviceId)) err('生产中设备被售后工单引用', w.deviceId, life(w.deviceId), `workOrders.${w.id}`, '售后工单仅可引用在线运营/交付后设备'); });
deliveryPlans.forEach((dp) => (dp.boundDeviceIds || []).forEach((id) => { if (isProducing(id)) err('生产中设备被交付计划绑定', id, life(id), `deliveryPlans.${dp.id}`, '交付计划仅可绑定已入库/交付中设备'); }));

// ---- 5. 在线运营设备必须有 locationId / projectId / deliveryPlanId ----
devices.filter((d) => d.status === '在线运营').forEach((d) => {
  if (!d.locationId) err('在线运营缺少点位', d.id, d.status, `devices.${d.id}`, '补充 locationId');
  if (!d.projectId) err('在线运营缺少项目', d.id, d.status, `devices.${d.id}`, '补充 projectId');
  if (!d.deliveryPlanId) err('在线运营缺少交付计划', d.id, d.status, `devices.${d.id}`, '补充 deliveryPlanId');
});

// ---- 6. alerts 只能引用在线运营或交付后（有 deliveryPlanId）设备 ----
alerts.forEach((a) => {
  const d = deviceById.get(a.deviceId);
  if (!d) return;
  const ok = d.status === '在线运营' || !!d.deliveryPlanId;
  if (!ok) err('告警引用了未交付设备', a.deviceId, d.status, `alerts.${a.id}`, '告警设备必须为在线运营或已交付（含 deliveryPlanId）');
});

// ---- 7. sourceStage=在线运营 的 qualityIssues 只能引用在线运营设备 ----
qualityIssues.forEach((q) => {
  const d = deviceById.get(q.deviceId);
  if (q.sourceStage === '在线运营' && d && d.status !== '在线运营') err('在线质量问题设备非在线运营', q.deviceId, d.status, `qualityIssues.${q.id}`, '改用在线运营设备或修改 sourceStage');
});

// ---- 8. 已入库/待交付设备必须有 ERP 入库单/检验单，检验状态=合格 ----
devices.filter((d) => d.status === '已入库').forEach((d) => {
  if (!d.erpInboundNo) err('待交付设备缺少ERP入库单', d.id, d.status, `devices.${d.id}`, '补充 erpInboundNo');
  if (!d.erpInspectionNo) err('待交付设备缺少ERP检验单', d.id, d.status, `devices.${d.id}`, '补充 erpInspectionNo');
  if (d.erpInspectionStatus !== '合格') err('待交付设备ERP检验状态非合格', d.id, d.erpInspectionStatus, `devices.${d.id}`, 'erpInspectionStatus 应为 合格');
});

// ---- 9. 交付计划绑定设备不能是生产返修中/测试中/半成品检验中 ----
const BLOCKED_BIND = new Set(['生产返修中', '半成品检验中', '初测中', '中测中', 'OQT终测中', '装配中', '整机装配', '功能测试中', '老化测试中', '终测中']);
deliveryPlans.forEach((dp) => (dp.boundDeviceIds || []).forEach((id) => {
  const d = deviceById.get(id);
  if (d && BLOCKED_BIND.has(d.status)) err('交付计划绑定了在制设备', id, d.status, `deliveryPlans.${dp.id}`, '仅绑定已入库/交付中设备');
}));

// ---- 10. locations.deviceIds 中设备必须 status=在线运营 或 已部署 ----
locations.forEach((l) => (l.deviceIds || []).forEach((id) => {
  const d = deviceById.get(id);
  if (d && !['在线运营', '已部署'].includes(d.status)) err('点位设备状态非在线运营', id, d.status, `locations.${l.id}.deviceIds`, '点位 deviceIds 仅放在线运营设备（交付中设备用 device.locationId 关联）');
}));

// ---- 11. productionWorkOrders 只能引用生产阶段设备 ----
productionWorkOrders.forEach((w) => {
  const d = deviceById.get(w.deviceId);
  if (d && life(w.deviceId) !== '生产中') err('生产工单引用非生产阶段设备', w.deviceId, d.status, `productionWorkOrders.${w.id}`, '生产工单仅可引用生产阶段设备');
});

// ---- 12. deliveryWorkOrders 只能引用交付中或在线运营设备 ----
deliveryWorkOrders.forEach((w) => {
  const l = life(w.deviceId);
  if (l && !['交付中', '在线运营'].includes(l)) err('交付工单引用非交付/在线设备', w.deviceId, l, `deliveryWorkOrders.${w.id}`, '交付工单仅可引用交付中/在线运营设备');
});

// ---- 13. moduleReplacements 只能引用存在的 workOrderId 和 deviceId ----
moduleReplacements.forEach((m) => {
  if (!woIds.has(m.workOrderId)) err('模块更换引用不存在的工单', m.id, '—', `moduleReplacements.${m.id}.workOrderId=${m.workOrderId}`, '修正 workOrderId');
  if (!deviceById.has(m.deviceId)) err('模块更换引用不存在的设备', m.id, '—', `moduleReplacements.${m.id}.deviceId=${m.deviceId}`, '修正 deviceId');
});

// ---- 14. moduleInstances.sourceBatchId 必须存在 ----
moduleInstances.forEach((mi) => { if (!batchIds.has(mi.sourceBatchId)) err('模块实例来源批次不存在', mi.id, mi.status, `moduleInstances.${mi.id}.sourceBatchId=${mi.sourceBatchId}`, '修正 sourceBatchId'); });

// ---- 15. 已装配 moduleInstance 必须绑定存在且处于装配后阶段的设备 ----
const POST_ASSEMBLY = new Set(['待交付', '交付中', '在线运营', '已作废']);
moduleInstances.filter((mi) => mi.status === '已装配').forEach((mi) => {
  if (!mi.boundDeviceId || !deviceById.has(mi.boundDeviceId)) err('已装配模块未绑定有效设备', mi.id, mi.status, `moduleInstances.${mi.id}`, '已装配模块必须绑定存在的设备');
  else if (!POST_ASSEMBLY.has(life(mi.boundDeviceId))) err('已装配模块绑定了非装配后设备', mi.id, life(mi.boundDeviceId), `moduleInstances.${mi.id}.boundDeviceId=${mi.boundDeviceId}`, '绑定装配后阶段设备');
});

// ---- 16. 在库可用 moduleInstance 不得绑定设备 ----
moduleInstances.filter((mi) => mi.status === '在库可用').forEach((mi) => { if (mi.boundDeviceId) err('在库可用模块被绑定设备', mi.id, mi.status, `moduleInstances.${mi.id}.boundDeviceId=${mi.boundDeviceId}`, '在库可用模块 boundDeviceId 应为 null'); });

// ---- 17. 已报废/维修中 moduleInstance 不得标记为可用（不得绑定设备/不得为在库可用）----
moduleInstances.filter((mi) => ['已报废', '维修中'].includes(mi.status)).forEach((mi) => { if (mi.boundDeviceId) err('维修/报废模块被绑定设备', mi.id, mi.status, `moduleInstances.${mi.id}`, '维修中/已报废模块不得绑定设备'); });

// ---- 18 & 19. Dashboard 口径：生产中/在线运营互不重叠 ----
devices.forEach((d) => {
  const l = deviceLifecycleStatus(d);
  if (l === '生产中' && d.status === '在线运营') err('生产中包含在线运营设备', d.id, d.status, `devices.${d.id}`, '生命周期口径冲突');
  if (l === '在线运营' && d.status !== '在线运营') err('在线运营包含非在线设备', d.id, d.status, `devices.${d.id}`, '生命周期口径冲突');
});

// ---- 21. 告警 deviceSN 必须与设备一致；workOrderId 必须存在且同一设备 ----
alerts.forEach((a) => {
  const d = deviceById.get(a.deviceId);
  if (d && a.deviceSN && a.deviceSN !== d.sn) err('告警设备SN与设备不一致', a.id, a.deviceSN, `alerts.${a.id}（设备 ${d.sn}）`, '修正 deviceSN');
  if (a.workOrderId) {
    const wo = [...workOrders, ...deliveryWorkOrders].find((w) => w.id === a.workOrderId);
    if (!wo) err('告警关联工单不存在', a.id, a.status, `alerts.${a.id}.workOrderId=${a.workOrderId}`, '修正 workOrderId 或置空');
    else if (wo.deviceId !== a.deviceId) err('告警与关联工单设备不一致', a.id, a.deviceSN, `alerts.${a.id}↔${a.workOrderId}`, '工单与告警应引用同一设备');
  }
});

// ---- 22. 已装配 moduleInstance 必须能取到设备SN；在库可用/已锁定不得绑定设备 ----
moduleInstances.forEach((mi) => {
  if (mi.status === '已装配') {
    const d = deviceById.get(mi.boundDeviceId);
    if (!d || !d.sn) err('已装配模块缺少设备SN', mi.id, mi.status, `moduleInstances.${mi.id}`, '已装配模块必须绑定含 SN 的设备');
  }
  if (['在库可用', '已锁定生产计划'].includes(mi.status) && mi.boundDeviceId) err('非装配模块绑定了设备', mi.id, mi.status, `moduleInstances.${mi.id}.boundDeviceId=${mi.boundDeviceId}`, '在库可用/已锁定模块不得绑定设备');
});

// ---- 23. 已锁定 moduleInstance 必须有存在的锁定生产计划 ----
moduleInstances.filter((mi) => mi.status === '已锁定生产计划').forEach((mi) => {
  if (!mi.lockedPlanId) err('已锁定模块缺少生产计划', mi.id, mi.status, `moduleInstances.${mi.id}`, '补充 lockedPlanId');
  else if (!prodPlanIds.has(mi.lockedPlanId)) err('已锁定模块生产计划不存在', mi.id, mi.status, `moduleInstances.${mi.id}.lockedPlanId=${mi.lockedPlanId}`, '修正 lockedPlanId');
});

// ---- 24. 已装配使用的批次（items 含已占用）不得作废 ----
materialBatches.forEach((b) => {
  const used = (b.items || []).some((it) => it.status === '已占用');
  if (used && b.voided) err('已装配使用批次被作废', b.id, '已作废', `materialBatches.${b.id}`, '已装配使用批次不得作废');
});

// ---- 25. 模块实例状态词表合法（保证库存汇总可完整聚合）----
const KNOWN_MI = new Set(['在库可用', '已锁定生产计划', '已装配', '维修中', '已报废', '退货换货']);
moduleInstances.forEach((mi) => { if (!KNOWN_MI.has(mi.status)) err('模块实例状态非法', mi.id, mi.status, `moduleInstances.${mi.id}`, `状态须为 ${[...KNOWN_MI].join('/')}`); });

// ---- 20. 未关闭工单/告警/质量问题统计（一致性打印，供看板核对）----
const openWO = [...deliveryWorkOrders, ...workOrders].filter((w) => !['已关闭', '已作废'].includes(w.status)).length;
const openAlerts = alerts.filter((a) => !['已解决', '已关闭'].includes(a.status)).length;
const openQI = qualityIssues.filter((q) => q.status !== '已关闭').length;
// 设备台账健康告警数（未关闭）按 deviceId 聚合，验证与 alerts 一致
const unclosedByDevice = new Map();
alerts.filter((a) => !['已解决', '已关闭'].includes(a.status)).forEach((a) => unclosedByDevice.set(a.deviceId, (unclosedByDevice.get(a.deviceId) || 0) + 1));
const onlineDevs = devices.filter((d) => d.status === '在线运营');
const onlineWithAlert = onlineDevs.filter((d) => (unclosedByDevice.get(d.id) || 0) > 0).length;

// ============ 汇总输出 ============
const lifeCount = (s) => devices.filter((d) => deviceLifecycleStatus(d) === s).length;
console.log('==================== Mock 数据规模 ====================');
console.log(`项目 projects            : ${projects.length}`);
console.log(`点位 locations           : ${locations.length}`);
console.log(`设备 devices             : ${devices.length}`);
console.log(`生产计划 workflowPlans    : ${workflowProductionPlans.length}`);
console.log(`交付计划 deliveryPlans    : ${deliveryPlans.length}`);
console.log(`模块批次 materialBatches  : ${materialBatches.length}`);
console.log(`模块实例 moduleInstances  : ${moduleInstances.length}`);
console.log(`工站测试 testRecords      : ${testRecords.length}`);
console.log(`健康告警 alerts           : ${alerts.length}（未关闭 ${openAlerts}）`);
console.log(`在线运营设备 有未关闭告警  : ${onlineWithAlert} / ${onlineDevs.length}（其余 ${onlineDevs.length - onlineWithAlert} 台无告警）`);
console.log(`售后工单 workOrders       : ${workOrders.length}`);
console.log(`交付工单 deliveryWorkOrders: ${deliveryWorkOrders.length}`);
console.log(`生产工单 productionWO     : ${productionWorkOrders.length}`);
console.log(`工单合计(售后+交付)未关闭 : ${openWO}`);
console.log(`质量问题 qualityIssues    : ${qualityIssues.length}（未关闭 ${openQI}）`);
console.log('---------------- 设备生命周期分布 ----------------');
console.log(`生产中     : ${lifeCount('生产中')}`);
console.log(`待入库     : ${lifeCount('待入库')}`);
console.log(`待交付     : ${lifeCount('待交付')}`);
console.log(`交付中     : ${lifeCount('交付中')}`);
console.log(`在线运营   : ${lifeCount('在线运营')}`);
console.log(`已作废/归档: ${lifeCount('已作废')}`);
console.log('---------------- 模块库存汇总（moduleInstances 聚合）----------------');
['在库可用', '已锁定生产计划', '已装配', '维修中', '已报废', '退货换货'].forEach((s) =>
  console.log(`${s.padEnd(8, '　')}: ${moduleInstances.filter((m) => m.status === s).length}`));

console.log('\n==================== 一致性校验结果 ====================');
if (errors.length === 0) {
  console.log('✅ 全部通过：0 个一致性错误。');
  process.exit(0);
} else {
  console.log(`❌ 发现 ${errors.length} 个一致性错误：\n`);
  errors.forEach((e, i) => {
    console.log(`${i + 1}. [${e.type}] 记录/设备：${e.id}｜当前状态：${e.current}`);
    console.log(`   被错误引用位置：${e.refLocation}`);
    console.log(`   建议修正：${e.suggestion}`);
  });
  process.exit(1);
}
