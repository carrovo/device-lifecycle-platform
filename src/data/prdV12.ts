export let PRODUCTION_STEPS: Array<{ key: string; label: string; kind: string }> = [];
let PRODUCTION_STEP_KEYS: string[] = [];

export function configureProductionSteps(nodes) {
  PRODUCTION_STEPS = Array.isArray(nodes)
    ? nodes.filter((item) => item?.key && item?.label).map((item) => ({
      key: String(item.key), label: String(item.label), kind: item.kind === 'test' ? 'test' : 'normal',
    })) : [];
  PRODUCTION_STEP_KEYS = PRODUCTION_STEPS.map((step) => step.key);
}

const EARLY_STATUS = {
  装配中: 'assembly1', 初测中: 'initial', 半成品检验中: 'assembly2', 中测中: 'assembly2',
  OQT终测中: 'final', 终测中: 'final', 生产返修中: 'repair', 待入库: 'complete', 待产品入库: 'complete',
};

export function getProductionKey(device) {
  const direct = device.currentProductionNode || device.productionStatus;
  if (PRODUCTION_STEP_KEYS.includes(direct)) return direct;
  if (direct === 'repair') return PRODUCTION_STEP_KEYS.includes(device.failedNode) ? device.failedNode : PRODUCTION_STEP_KEYS[0];
  const mapped = EARLY_STATUS[device.status];
  if (PRODUCTION_STEP_KEYS.includes(mapped)) return mapped;
  if (mapped === 'repair') return PRODUCTION_STEP_KEYS.includes(device.failedNode) ? device.failedNode : PRODUCTION_STEP_KEYS[0];
  if (mapped === 'complete' || device.erpInboundNo) return PRODUCTION_STEP_KEYS.at(-1);
  return PRODUCTION_STEP_KEYS[0] || '';
}

export function productionLabel(key) {
  return PRODUCTION_STEPS.find((step) => step.key === key)?.label || key || '未配置生产节点';
}

export function isProductionComplete(device) {
  if (typeof device.productionComplete === 'boolean') return device.productionComplete;
  return ['pendingInbound', 'inbound', 'pendingShipment'].includes(device.productionStatus)
    || !!device.erpInboundNo
    || ['待入库', '待产品入库', '已入库', '已分配项目', '待交付', '可交付', '现场安装调试中', '客户验收中', '在线运营', '售后中', '已停用'].includes(device.status);
}

export function productionProgressLabel(device) {
  return isProductionComplete(device) ? '生产已完成' : productionLabel(getProductionKey(device));
}

export function getRepairStatus(device) {
  if (device.repairStatus) return device.repairStatus;
  if (device.productionStatus === 'repair') return 'inProgress';
  const repairs = (device.productionHistory || []).filter((record) => record.recordType === 'repair' || record.repairSummary);
  if (repairs.some((record) => record.retestResult === 'Pass')) return 'retested';
  if (repairs.length) return 'inProgress';
  return null;
}

export function repairStatusLabel(device) {
  return ({ inProgress: '返修中', retested: '已完成复测' })[getRepairStatus(device)] || '—';
}

export function effectiveProductionHistory(device) {
  return (device.productionHistory || []).filter((record) => PRODUCTION_STEP_KEYS.includes(record.node));
}

export function productionTimeline(device) {
  const records = effectiveProductionHistory(device);
  return PRODUCTION_STEPS.flatMap((step) => {
    const nodeRecords = records.filter((record) => record.node === step.key && record.recordType !== 'repair');
    const effective = nodeRecords.at(-1);
    const repairs = records.filter((record) => record.node === step.key && record.recordType === 'repair');
    return [...(effective && effective.result !== '已建档' ? [effective] : []), ...repairs];
  });
}

export function currentNodeResult(device) {
  if (isProductionComplete(device)) return 'Pass';
  const key = getProductionKey(device);
  const step = PRODUCTION_STEPS.find((item) => item.key === key);
  const latest = effectiveProductionHistory(device).filter((record) => record.node === key).at(-1);
  if (!latest || latest.result === '已建档') return step?.kind === 'test' ? '暂无结果' : '待处理';
  if (step?.kind === 'test') return ['Pass', 'NG'].includes(latest.result) ? latest.result : '暂无结果';
  if (latest.result === '存在异常' || latest.result === '已记录异常') return '已记录异常';
  return latest.result === '已完成' ? '已完成' : '待处理';
}

export function hasPendingProductionException(device) {
  if (getRepairStatus(device) === 'inProgress') return true;
  const key = getProductionKey(device);
  const latest = effectiveProductionHistory(device).filter((record) => record.node === key).at(-1);
  if (!latest) return false;
  return ['存在异常', '已记录异常', 'NG'].includes(latest.result)
    && !(latest.resolved || latest.retestResult === 'Pass');
}
