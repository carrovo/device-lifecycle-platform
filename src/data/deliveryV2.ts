export function batchDisplayName(batch) {
  return batch.supplement?.trim() ? `${batch.baseName} · ${batch.supplement.trim()}` : batch.baseName;
}

export function batchMetrics(batch) {
  if (batch?.metrics) return batch.metrics;
  const relations = batch.deviceRelations || [];
  const passed = relations.filter((item) => item.result === '通过').length;
  const failed = relations.filter((item) => item.result === '未通过').length;
  const unconfirmed = relations.filter((item) => item.result === '未确认').length;
  return {
    total: relations.length, passed, failed, unconfirmed,
    summary: failed
      ? `${failed} 台未通过${unconfirmed ? `，${unconfirmed} 台待确认` : ''}`
      : unconfirmed ? `${unconfirmed} 台待确认` : relations.length ? '全部通过' : '暂无设备',
  };
}

export function deliveryRelations(plan) {
  const byDevice = new Map<any, any>();
  (plan.batches || []).forEach((batch) => {
    (batch.deviceRelations || []).forEach((relation) => {
      if (!byDevice.has(relation.deviceId)) byDevice.set(relation.deviceId, { ...relation, batch });
    });
  });
  return [...byDevice.values()];
}

export function deliveryMetrics(plan) {
  if (plan?.metrics) {
    const metrics = plan.metrics;
    const reasons = [];
    if (metrics.unarranged) reasons.push(`尚有 ${metrics.unarranged} 台设备未纳入交付批次`);
    if (metrics.unconfirmed) reasons.push(`当前有 ${metrics.unconfirmed} 台设备尚未确认交付结果`);
    if (metrics.failed) reasons.push(`当前有 ${metrics.failed} 台设备交付结果未通过`);
    if (!metrics.isCompleted) reasons.push(`当前已完成交付 ${metrics.completed} / ${metrics.planned} 台`);
    return { ...metrics, reasons };
  }
  const relations = deliveryRelations(plan);
  const planned = Number(plan.plannedCount) || 0;
  const included = relations.length;
  const completed = relations.filter((item) => item.result === '通过').length;
  const failed = relations.filter((item) => item.result === '未通过').length;
  const unconfirmed = relations.filter((item) => item.result === '未确认').length;
  const unarranged = Math.max(0, planned - included);
  const remaining = Math.max(0, planned - completed);
  const isCompleted = planned > 0 && (plan.batches || []).length > 0
    && included === planned && completed === planned && failed === 0 && unconfirmed === 0;
  const reasons = [];
  if (unarranged) reasons.push(`尚有 ${unarranged} 台设备未纳入交付批次`);
  if (unconfirmed) reasons.push(`当前有 ${unconfirmed} 台设备尚未确认交付结果`);
  if (failed) reasons.push(`当前有 ${failed} 台设备交付结果未通过`);
  if (!isCompleted) reasons.push(`当前已完成交付 ${completed} / ${planned} 台`);
  return { planned, included, completed, failed, unconfirmed, unarranged, remaining,
    batchCount: (plan.batches || []).length, isCompleted, reasons: [...new Set(reasons)] };
}

export function relationForDevice(plan, deviceId) {
  return deliveryRelations(plan).find((item) => item.deviceId === deviceId) || null;
}
