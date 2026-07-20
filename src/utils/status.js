// Centralized status derivation & vocabularies.
// Goal: one place to map raw mock/device state -> the status label the UI shows,
// so project / production / delivery pages never disagree.

export const TODAY = '2026-07-01';

// Delivery / test results are stored as Pass / NG. Legacy mock used 通过 / 不通过.
export const isPass = (record) => !!record && ['Pass', '通过'].includes(record.result);
export const isNG = (record) => !!record && ['NG', '不通过', '未通过'].includes(record.result);

// ---- Project status ----------------------------------------------------------
export function projectStatus(project, productionPlans = [], deliveryPlans = []) {
  if (project.voided || project.status === '已作废') return '已作废';
  if (project.status) return project.status;
  const accepted = deliveryPlans
    .filter((p) => p.projectId === project.id)
    .reduce((sum, plan) => sum + (plan.records?.customerAccept || []).filter(isPass).length, 0);
  if (project.closedAt) return '已关闭';
  if (accepted >= (project.targetCount || 0) && project.targetCount > 0) return '已交付';
  if (productionPlans.some((plan) => plan.projectId === project.id)) return '进行中';
  return '未开始';
}

// ---- Production plan status --------------------------------------------------
// Canonical: 未开始 / 生产中 / 已完成 / 已延期 / 已作废
export function productionPlanStatus(plan, today = TODAY) {
  if (plan.status === '已作废') return '已作废';
  if (plan.status === '已完成') return '已完成';
  const raw = plan.status === '待开始'
    ? '未开始'
    : (plan.status === '进行中' || plan.status === '生产中')
      ? '生产中'
      : (plan.status || '未开始');
  if (plan.endDate && plan.endDate < today && !['已完成', '已作废', '未开始'].includes(raw)) return '已延期';
  return raw;
}

// ---- Delivery plan status ----------------------------------------------------
// Canonical: 未开始 / 交付中 / 已验收 / 已延期 / 已作废
export function deliveryPlanStatus(plan, today = TODAY) {
  if (plan.voided || plan.status === '已作废') return '已作废';
  const accepted = (plan.records?.customerAccept || []).filter(isPass).length;
  if (plan.status === '已验收' || (accepted >= (plan.targetCount || 0) && plan.targetCount > 0)) return '已验收';
  const raw = (plan.status === '进行中' || plan.status === '交付中') ? '交付中' : (plan.status || '未开始');
  if (plan.dueDate && plan.dueDate < today && !['未开始', '已验收', '已作废'].includes(raw)) return '已延期';
  return raw;
}

// ---- Device -> assembly node status -----------------------------------------
// Canonical: 未开始 / 装配中 / 待确认装配完成 / 已装配 / 装配异常
const ASSEMBLED_DONE = [
  '半成品检验中', '初测中', '中测中', 'OQT终测中', '测试通过', '测试NG', '返修中', '生产返修中',
  '功能测试中', '老化测试中', '终测中',
  '待入库', '已入库', '待分配项目', '已分配项目', '在线运营', '待交付', '可交付', '待出厂检验',
];
export function assemblyStatus(device) {
  const s = device.status;
  if (s === '装配异常') return '装配异常';
  if (s === '待确认装配完成') return '待确认装配完成';
  if (s === '装配中') return '装配中';
  if (s === '未开始') return '未开始';
  if (s === '整机装配') return device.placeholder ? '未开始' : '装配中';
  if (ASSEMBLED_DONE.includes(s)) return '已装配';
  return '未开始';
}

// ---- Device (+ latest record) -> quality-test node status --------------------
// Canonical: 待测试 / 半成品检验中 / 初测中 / 中测中 / OQT终测中 / 测试通过 / 测试NG / 返修中
const STATION_STATUSES = ['半成品检验中', '初测中', '中测中', 'OQT终测中'];
const TEST_PASSED_DOWNSTREAM = [
  '测试通过', '待入库', '已入库', '待分配项目', '已分配项目', '在线运营', '待交付', '可交付', '待出厂检验',
];
export function qualityStatus(device, latestRecord) {
  const s = device.status;
  if (s === '生产返修中' || s === '返修中') return '返修中';
  if (s === '测试NG' || s === 'NG待返修') return s === 'NG待返修' ? 'NG待返修' : '测试NG';
  if (s === '复测中') return '复测中';
  if (s === '已完成测试') return '测试通过';
  if (s === 'OQT中') return 'OQT终测中';
  if (s === '质量测试中') return '中测中';
  if (STATION_STATUSES.includes(s)) return s;
  if (s === '功能测试中') return '初测中';
  if (s === '老化测试中') return '中测中';
  if (s === '终测中') return 'OQT终测中';
  if (TEST_PASSED_DOWNSTREAM.includes(s)) return '测试通过';
  if (latestRecord) {
    if (isNG(latestRecord)) return '测试NG';
    if (isPass(latestRecord)) return '测试通过';
  }
  return '待测试';
}

// ---- Delivery node derived statuses -----------------------------------------
export const resultLabel = (record, pendingLabel) => (record ? (isPass(record) ? 'Pass' : 'NG') : pendingLabel);

// 绑定设备节点当前状态: 待交付 / 可交付 / 待出厂检验
export function bindingDeviceStatus(device, isBound) {
  if (isBound) return '待出厂检验';
  if (['已入库', '待分配项目', '已分配项目'].includes(device.status)) return '可交付';
  return '待交付';
}

// 出厂检验节点出厂状态: 待出厂检验 / 待确认出厂 / 已出厂 / 不可出厂
export function factoryStageStatus(record) {
  if (!record) return '待出厂检验';
  return isPass(record) ? '已出厂' : '不可出厂';
}

// 现场安装调试节点当前状态: 安装调试中 / 安装异常 / 待客户验收
export function siteStageStatus(record) {
  if (!record) return '安装调试中';
  return isPass(record) ? '待客户验收' : '安装异常';
}

// 客户验收节点当前状态: 待客户验收 / 在线运营 / 验收异常
export function acceptStageStatus(record) {
  if (!record) return '待客户验收';
  return isPass(record) ? '在线运营' : '验收异常';
}

// ---- 设备资产台账：生命周期状态 & 当前业务节点 -----------------------------
// 生命周期状态只用：生产中 / 待入库 / 待交付 / 交付中 / 在线运营 / 维修中 / 已作废
export function deviceLifecycleStatus(device) {
  const s = device.status;
  // 平台不做退役/报废流程：退役 / 已报废 / 已作废 统一归为已停用
  if (['已报废', '报废', '退役', '已退役', '已作废', '已停用'].includes(s)) return '已停用';
  if (s === '售后中') return '售后中';
  if (['维修中'].includes(s)) return '维修中';
  if (s === '在线运营') return '在线运营';
  if (['已分配项目', '出厂检验中', '现场安装调试中', '客户验收中'].includes(s)) return '交付中';
  if (['已入库', '待分配项目'].includes(s)) return '待交付';
  if (s === '待入库') return '待入库';
  // 装配 / 模块绑定 / 质量测试 / 生产返修等在制环节统一归为生产中
  return '生产中';
}

// 当前业务节点：整机装配 / 半成品检验 / 初测 / 中测 / OQT终测 / 整机入库 /
//               出厂检验 / 现场安装调试 / 客户验收 / 在线运营
const DEVICE_NODE_MAP = {
  装配中: '整机装配', 整机装配: '整机装配', 待确认装配完成: '整机装配', 已装配: '整机装配',
  模块绑定中: '模块绑定', 模块绑定: '模块绑定',
  半成品检验中: '半成品检验', 初测中: '初测', 中测中: '中测', OQT终测中: 'OQT终测',
  OQT中: 'OQT终测', 质量测试中: '中测', 复测中: 'OQT终测', NG待返修: 'OQT终测', 已完成测试: '整机入库',
  功能测试中: '初测', 老化测试中: '中测', 终测中: 'OQT终测', 生产返修中: 'OQT终测',
  待入库: '整机入库', 已入库: '整机入库', 待分配项目: '整机入库',
  已分配项目: '出厂检验', 出厂检验中: '出厂检验',
  现场安装调试中: '现场安装调试', 客户验收中: '客户验收', 在线运营: '在线运营',
  售后中: '在线运营', 已停用: '已停用',
};
export function deviceBusinessNode(device) {
  if (['退役', '已退役', '已作废', '已报废', '报废', '已停用'].includes(device.status)) return '已停用';
  return DEVICE_NODE_MAP[device.status] || '整机装配';
}

// ---- 装配模板 & 模块绑定（由设备类型 + 模块类型派生，供生产计划/设备详情/型号字典复用）----
// 装配模板 = 某机器人型号（设备类型）的槽位定义 + 核心部件类型/是否必装/数量/是否需SN/是否支持换件/排序。
export function assemblyTemplateFor(deviceType, moduleTypes = []) {
  return (deviceType?.slots || []).map((sl, i) => {
    const mt = moduleTypes.find((m) => m.id === sl.moduleTypeId);
    return {
      order: i + 1,
      slotName: sl.slotName,
      moduleTypeId: sl.moduleTypeId,
      moduleTypeName: mt?.name || '—',
      corePartType: mt?.category || '—',
      required: true,
      quantity: sl.quantity || 1,
      needSN: true,
      replaceable: true,
      bindRule: '按型号槽位一对一绑定',
    };
  });
}

// 模块 / 核心部件「平台占用状态」（区别于 ERP 状态）。仅保留：
// 在库可用 / 已绑定设备 / 绑定异常 / 已更换 / 旧件待返修 / 已返修
const PLATFORM_STATUS_MAP = {
  在库可用: '在库可用', 已锁定生产计划: '在库可用', 已装配: '已绑定设备', 已绑定设备: '已绑定设备',
  绑定异常: '绑定异常', 已更换: '已更换', 旧件待返修: '旧件待返修', 维修中: '旧件待返修',
  已返修: '已返修', 已报废: '已返修', 退货换货: '绑定异常',
};
export function platformOccupancyStatus(mi) {
  if (!mi) return '在库可用';
  if (mi.platformStatus) return mi.platformStatus;
  return PLATFORM_STATUS_MAP[mi.status] || '在库可用';
}

// 某设备的模块绑定明细：基于其型号装配模板 + 已绑定模块实例 + 换件记录，逐槽位给出绑定状态与
// 平台占用状态 + ERP/物料信息（供生产计划单机记录、设备详情、台账复用）。
// 绑定状态：待绑定 / 已绑定 / 异常 / 已更换
export function deviceModuleBindings(device, deviceTypes = [], moduleTypes = [], moduleInstances = [], moduleReplacements = [], materialBatches = []) {
  if (!device) return [];
  const dt = deviceTypes.find((t) => t.id === device.deviceTypeId);
  const template = assemblyTemplateFor(dt, moduleTypes);
  const bound = moduleInstances.filter((mi) => mi.boundDeviceId === device.id);
  const replacedSlots = new Set(moduleReplacements.filter((r) => r.deviceId === device.id).map((r) => r.slotName));
  const used = new Set();
  return template.map((slot) => {
    const inst = bound.find((mi) => (mi.boundSlot ? mi.boundSlot === slot.slotName : mi.moduleTypeId === slot.moduleTypeId) && !used.has(mi.id));
    if (inst) used.add(inst.id);
    const platform = inst ? platformOccupancyStatus(inst) : '在库可用';
    let bindStatus;
    if (replacedSlots.has(slot.slotName)) bindStatus = '已更换';
    else if (inst && platform === '绑定异常') bindStatus = '异常';
    else if (inst) bindStatus = '已绑定';
    else bindStatus = '待绑定';
    const batch = inst ? materialBatches.find((b) => b.id === inst.sourceBatchId) : null;
    return {
      slotName: slot.slotName,
      corePartType: slot.corePartType,
      moduleTypeName: slot.moduleTypeName,
      moduleSN: inst?.sn || '—',
      moduleId: inst?.id || null,
      moduleInstance: inst || null,
      platformStatus: bindStatus === '待绑定' ? '—' : platform,
      materialCode: inst?.materialCode || (batch ? batch.id : '—'),
      materialName: inst?.materialName || (batch ? `${batch.category} ${batch.model}` : '—'),
      batchNo: inst?.batchNo || batch?.batchNo || '—',
      erpStockStatus: inst?.erpStockStatus || (batch ? '合格可用' : '—'),
      bindStatus,
      bindTime: inst?.bindTime || (inst || bindStatus === '已更换' ? (device.assemblyTime || '—') : '—'),
      operator: inst?.binder || (inst || bindStatus === '已更换' ? (device.assembler || '—') : '—'),
      exception: bindStatus === '异常' ? (inst?.exceptionNote || '绑定异常') : (bindStatus === '待绑定' ? '未绑定' : ''),
    };
  });
}

// 装配进度汇总：应绑定 / 已绑定 / 完成率 / 异常槽位数
export function assemblyProgress(device, deviceTypes = [], moduleTypes = [], moduleInstances = [], moduleReplacements = []) {
  const rows = deviceModuleBindings(device, deviceTypes, moduleTypes, moduleInstances, moduleReplacements);
  const total = rows.length;
  const bound = rows.filter((r) => ['已绑定', '已更换'].includes(r.bindStatus)).length;
  const exception = rows.filter((r) => r.bindStatus === '异常').length;
  return { total, bound, exception, rate: total ? Math.round((bound / total) * 100) : 0, rows };
}

// ---- 生产计划派生状态（计划无唯一当前节点，由设备状态分布 + ERP + 超时派生）----
export function planDeviceDistribution(plan, devices = []) {
  const devs = devices.filter((d) => d.productionPlanId === plan.id);
  const dist = {};
  devs.forEach((d) => { dist[d.status] = (dist[d.status] || 0) + 1; });
  return { total: devs.length, dist };
}

// 返回派生的「当前卡点」：质量返修 / 长期未结 / 计划超期 / 待 ERP 入库·检验同步 / 主要阶段 / 多阶段并行 / 无明显卡点
export function planBottleneck(plan, devices = [], productionWorkOrders = [], today = TODAY) {
  const devs = devices.filter((d) => d.productionPlanId === plan.id);
  if (plan.status === '已完成') return '无明显卡点';
  const hasRepair = devs.some((d) => ['生产返修中', 'NG待返修', '复测中', '测试NG'].includes(d.status))
    || productionWorkOrders.some((w) => w.productionPlanId === plan.id && !['已关闭', '已取消', '已作废'].includes(w.status));
  if (hasRepair) return '质量返修';
  const overdue = plan.endDate && plan.endDate < today;
  if (overdue) return '计划超期';
  const longPending = (plan.createdAt || '').slice(0, 10) && (plan.createdAt || '').slice(0, 10) < '2026-05-15';
  if (longPending) return '长期未结';
  const DONE = ['已完成测试', '待入库', '已入库', '待分配项目', '已分配项目', '在线运营'];
  const allTested = devs.length > 0 && devs.every((d) => DONE.includes(d.status));
  if (allTested && !plan.erpInboundNo && !plan.erpStockStatus) return '待 ERP 入库 / 检验同步';
  const stages = new Set(devs.map((d) => d.status));
  if (stages.size >= 3) return '多阶段并行';
  if (stages.size === 1 && devs.length) return `主要阶段 · ${devs[0].status}`;
  return '无明显卡点';
}
