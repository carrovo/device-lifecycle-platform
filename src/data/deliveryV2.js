import { TRANSFER_RECORDS } from './erpPrototype';

const PASS_RESULTS = new Set(['Pass', '通过', '合格', '已通过']);
const FAIL_RESULTS = new Set(['NG', '未通过', '不合格']);

export const DELIVERY_DEVICE_RESULTS = ['未确认', '通过', '未通过'];

export function batchDisplayName(batch) {
  return batch.supplement?.trim() ? `${batch.baseName} · ${batch.supplement.trim()}` : batch.baseName;
}

export function batchMetrics(batch) {
  const relations = batch.deviceRelations || [];
  const passed = relations.filter((item) => item.result === '通过').length;
  const failed = relations.filter((item) => item.result === '未通过').length;
  const unconfirmed = relations.filter((item) => item.result === '未确认').length;
  return {
    total: relations.length,
    passed,
    failed,
    unconfirmed,
    summary: failed
      ? `${failed} 台未通过${unconfirmed ? `，${unconfirmed} 台待确认` : ''}`
      : unconfirmed ? `${unconfirmed} 台待确认` : relations.length ? '全部通过' : '暂无设备',
  };
}

export function deliveryRelations(plan) {
  const byDevice = new Map();
  (plan.batches || []).forEach((batch) => {
    (batch.deviceRelations || []).forEach((relation) => {
      if (!byDevice.has(relation.deviceId)) byDevice.set(relation.deviceId, { ...relation, batch });
    });
  });
  return [...byDevice.values()];
}

export function deliveryMetrics(plan) {
  const relations = deliveryRelations(plan);
  const planned = Number(plan.plannedCount) || 0;
  const included = relations.length;
  const completed = relations.filter((item) => item.result === '通过').length;
  const failed = relations.filter((item) => item.result === '未通过').length;
  const unconfirmed = relations.filter((item) => item.result === '未确认').length;
  const unarranged = Math.max(0, planned - included);
  const remaining = Math.max(0, planned - completed);
  const isCompleted = planned > 0
    && (plan.batches || []).length > 0
    && included === planned
    && completed === planned
    && failed === 0
    && unconfirmed === 0;
  const reasons = [];
  if (unarranged) reasons.push(`尚有 ${unarranged} 台设备未纳入交付批次`);
  if (unconfirmed) reasons.push(`当前有 ${unconfirmed} 台设备尚未确认交付结果`);
  if (failed) reasons.push(`当前有 ${failed} 台设备交付结果未通过`);
  if (!isCompleted) reasons.push(`当前已完成交付 ${completed} / ${planned} 台`);
  return {
    planned,
    included,
    completed,
    failed,
    unconfirmed,
    unarranged,
    remaining,
    batchCount: (plan.batches || []).length,
    isCompleted,
    reasons: [...new Set(reasons)],
  };
}

export function relationForDevice(plan, deviceId) {
  return deliveryRelations(plan).find((item) => item.deviceId === deviceId) || null;
}

function normalizeResult(value) {
  if (PASS_RESULTS.has(value)) return '通过';
  if (FAIL_RESULTS.has(value)) return '未通过';
  return '未确认';
}

function relationFromLegacy(plan, deviceId, locationId, index) {
  const acceptance = (plan.records?.customerAccept || []).find((item) => item.deviceId === deviceId);
  const onsite = (plan.records?.siteInstall || []).find((item) => item.deviceId === deviceId);
  const source = acceptance || onsite;
  const result = normalizeResult(source?.result);
  const revisionDemo = plan.id === 'DP-005' && index === 0;
  const failureDemo = plan.id === 'DP-002' && index === 1;
  return {
    id: `DR-${plan.id}-${deviceId}`,
    deviceId,
    targetLocationId: locationId || null,
    actualLocationId: source?.locationId || locationId || null,
    result: revisionDemo ? '通过' : failureDemo ? '未通过' : result,
    actualDate: source?.time?.slice(0, 10) || '',
    resultSummary: failureDemo ? '现场调试后设备参数仍需复核' : source?.notes || (result === '通过' ? '现场交付结果通过' : ''),
    exceptionDescription: failureDemo ? '现场调试结果未通过，需重新确认设备参数' : result === '未通过' ? source?.notes || '现场交付结果未通过' : '',
    documentUrl: '',
    recorder: source?.operator || '',
    recordTime: source?.time || '',
    resultHistory: revisionDemo ? [{
      result: '未通过',
      resultSummary: '首次现场确认存在问题',
      exceptionDescription: '首次现场确认未通过，整改后复核',
      recorder: plan.owner || '交付人员',
      recordTime: '2026-04-23 10:00',
      modificationReason: '现场问题处理完成，重新确认交付结果',
      revisedAt: '2026-04-24 15:00',
    }] : [],
  };
}

function siteRecordsForBatch(plan, deviceIds) {
  return (plan.records?.siteInstall || [])
    .filter((item) => deviceIds.includes(item.deviceId))
    .map((item, index) => ({
      id: item.id || `SITE-${plan.id}-${index + 1}`,
      content: item.notes || '现场交付过程已记录',
      deviceIds: item.deviceId ? [item.deviceId] : [],
      hasException: normalizeResult(item.result) === '未通过',
      exceptionDescription: normalizeResult(item.result) === '未通过' ? item.notes || '现场记录包含异常' : '',
      documentUrl: '',
      recorder: item.operator || plan.owner || '交付人员',
      time: item.time || plan.updatedAt || plan.createdAt || '',
    }));
}

export function normalizeDeliveryV2({
  plans,
  projects,
  locations,
  devices,
  exceptions,
}) {
  const projectById = new Map(projects.map((item) => [item.id, item]));
  const deviceById = new Map(devices.map((item) => [item.id, item]));
  const sequenceByProject = new Map();

  const deliveryPlans = plans.map((plan) => {
    if (Array.isArray(plan.batches)) return plan;
    const project = projectById.get(plan.projectId);
    const bindings = plan.records?.binding || [];
    const grouped = new Map();
    (plan.boundDeviceIds || []).forEach((deviceId) => {
      const binding = bindings.find((item) => item.deviceId === deviceId);
      const device = deviceById.get(deviceId);
      const locationId = binding?.locationId
        || binding?.preAssignedLocationId
        || device?.locationId
        || device?.preAssignedLocationId
        || null;
      const key = locationId || '__project__';
      grouped.set(key, [...(grouped.get(key) || []), deviceId]);
    });
    const batches = [...grouped.entries()].map(([key, deviceIds], batchIndex) => {
      const sequence = (sequenceByProject.get(plan.projectId) || 0) + 1;
      sequenceByProject.set(plan.projectId, sequence);
      const locationId = key === '__project__' ? null : key;
      const batchId = `BAT-${plan.id}-${String(batchIndex + 1).padStart(2, '0')}`;
      const supplement = plan.id === 'DP-001' && batchIndex === 1
        ? 'A 区先行批'
        : plan.id === 'DP-003' && batchIndex === 0 ? '补发批' : '';
      const erpReferences = [];
      if (plan.erpOutboundNo && batchIndex === 0) erpReferences.push({ type: '销售发货单', no: plan.erpOutboundNo });
      if (plan.id === 'DP-001' && batchIndex === 1 && TRANSFER_RECORDS[0]) {
        erpReferences.push({ type: '调拨订单', no: TRANSFER_RECORDS[0].docNo });
      }
      const feishuLinks = plan.id === 'DP-003' && batchIndex === 0 ? [{
        id: `BFS-${batchId}-1`,
        name: '机场试点发运外部记录',
        url: 'https://example.feishu.cn/base/airport-delivery',
        note: '原型链接示意',
      }] : [];
      return {
        id: batchId,
        sequence,
        baseName: `${project?.name || '项目'}-Batch${sequence}`,
        supplement,
        locationId,
        plannedDate: plan.siteInstallDate || '',
        owner: plan.owner || project?.manager || '',
        deviceRelations: deviceIds.map((deviceId) => relationFromLegacy(plan, deviceId, locationId, (plan.boundDeviceIds || []).indexOf(deviceId))),
        erpReferences,
        feishuLinks,
        siteRecords: siteRecordsForBatch(plan, deviceIds),
        notes: '',
        createdBy: plan.owner || '平台用户',
        createdAt: bindings.find((item) => deviceIds.includes(item.deviceId))?.time || plan.createdAt || '',
        updatedAt: plan.updatedAt || plan.actualFinishDate?.replace('—', '') || '',
        operationLogs: [],
      };
    });
    return {
      id: plan.id,
      projectId: plan.projectId,
      plannedCount: Number(plan.targetCount) || (plan.boundDeviceIds || []).length || 1,
      owner: plan.owner || project?.manager || '',
      targetDate: plan.dueDate || plan.acceptanceDate || '',
      demandDescription: plan.demandDescription || '',
      feishuDemandUrl: plan.feishuDemandUrl || '',
      notes: plan.notes || '',
      createdBy: plan.createdBy || plan.owner || '平台用户',
      createdAt: plan.createdAt || batches[0]?.createdAt || '',
      updatedAt: plan.updatedAt || plan.actualFinishDate?.replace('—', '') || '',
      nextBatchSequence: (sequenceByProject.get(plan.projectId) || 0) + 1,
      batches,
      operationLogs: plan.operationLogs || [],
    };
  });

  const batchForDevice = new Map();
  deliveryPlans.forEach((plan) => {
    (plan.batches || []).forEach((batch) => {
      (batch.deviceRelations || []).forEach((relation) => {
        batchForDevice.set(`${plan.id}:${relation.deviceId}`, batch);
      });
    });
  });

  const deliveryExceptions = (exceptions || []).map((item) => {
    const device = devices.find((candidate) => candidate.sn === item.deviceSN || candidate.id === item.deviceId);
    const plan = deliveryPlans.find((candidate) => candidate.id === item.deliveryPlanId);
    if (!plan) return null;
    const batch = device
      ? batchForDevice.get(`${plan.id}:${device.id}`)
      : plan.batches?.[0];
    if (!batch) return null;
    return {
      id: item.id,
      deliveryPlanId: plan.id,
      batchId: batch.id,
      projectId: plan.projectId,
      sourceRecordId: item.sourceRecordId || item.subOrderId || item.id,
      sourceTitle: item.sourceTitle || item.sourceNode || '现场记录',
      sourceType: item.sourceType === '设备结果' ? '设备结果' : '现场记录',
      affectedDeviceIds: item.affectedDeviceIds || (device ? [device.id] : []),
      description: item.description || item.notes || '',
      recorder: item.recorder || item.operator || plan.owner,
      recordTime: item.recordTime || item.time || '',
    };
  }).filter(Boolean);

  deliveryPlans.forEach((plan) => {
    (plan.batches || []).forEach((batch) => {
      batch.deviceRelations.forEach((relation) => {
        const historicalFailure = (relation.resultHistory || []).find((item) => item.result === '未通过');
        if (historicalFailure) {
          const sourceRecordId = `RESULT-HISTORY-${batch.id}-${relation.deviceId}`;
          if (!deliveryExceptions.some((item) => item.sourceRecordId === sourceRecordId)) {
            deliveryExceptions.push({
              id: `DEX-${sourceRecordId}`,
              deliveryPlanId: plan.id,
              batchId: batch.id,
              projectId: plan.projectId,
              sourceRecordId,
              sourceTitle: '设备交付结果（历史）',
              sourceType: '设备结果',
              affectedDeviceIds: [relation.deviceId],
              description: historicalFailure.exceptionDescription || '历史交付结果未通过',
              recorder: historicalFailure.recorder || plan.owner,
              recordTime: historicalFailure.recordTime || batch.updatedAt,
            });
          }
        }
        if (relation.result !== '未通过') return;
        const sourceRecordId = `RESULT-${batch.id}-${relation.deviceId}`;
        if (deliveryExceptions.some((item) => item.sourceRecordId === sourceRecordId)) return;
        deliveryExceptions.push({
          id: `DEX-${sourceRecordId}`,
          deliveryPlanId: plan.id,
          batchId: batch.id,
          projectId: plan.projectId,
          sourceRecordId,
          sourceTitle: '设备交付结果',
          sourceType: '设备结果',
          affectedDeviceIds: [relation.deviceId],
          description: relation.exceptionDescription || '设备交付结果未通过',
          recorder: relation.recorder || plan.owner,
          recordTime: relation.recordTime || batch.updatedAt,
        });
      });
      batch.siteRecords.forEach((record) => {
        if (!record.hasException) return;
        if (deliveryExceptions.some((item) => item.sourceRecordId === record.id)) return;
        deliveryExceptions.push({
          id: `DEX-${batch.id}-${record.id}`,
          deliveryPlanId: plan.id,
          batchId: batch.id,
          projectId: plan.projectId,
          sourceRecordId: record.id,
          sourceTitle: '现场记录',
          sourceType: '现场记录',
          affectedDeviceIds: record.deviceIds,
          description: record.exceptionDescription,
          recorder: record.recorder,
          recordTime: record.time,
        });
      });
    });
  });

  const normalizedDevices = devices.map((device) => {
    const memberships = [];
    deliveryPlans.forEach((plan) => {
      (plan.batches || []).forEach((batch) => {
        if (batch.deviceRelations.some((item) => item.deviceId === device.id)) memberships.push({ planId: plan.id, batchId: batch.id });
      });
    });
    return {
      ...device,
      deliveryPlanId: memberships[0]?.planId || null,
      deliveryPlanIds: memberships.map((item) => item.planId),
      deliveryBatchId: memberships[0]?.batchId || null,
    };
  });

  return { deliveryPlans, deliveryExceptions, devices: normalizedDevices };
}
