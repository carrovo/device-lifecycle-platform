export const PRODUCTION_STEPS = [
  { key: 'leg', label: '立腿状态', kind: 'normal' },
  { key: 'assembly1', label: '组装一', kind: 'normal' },
  { key: 'initial', label: '初测', kind: 'test' },
  { key: 'assembly2', label: '组装二', kind: 'normal' },
  { key: 'final', label: '终测', kind: 'test' },
];

export const PRODUCTION_STEP_KEYS = PRODUCTION_STEPS.map((step) => step.key);

export const SHARED_FEISHU_TABLES = [
  {
    id: 'FS-PRODUCT-STATUS',
    name: '产品状态明细表',
    url: 'https://example.feishu.cn/base/product-status',
  },
  {
    id: 'FS-OQC-DAILY',
    name: 'OQCbot2每日检验出货记录报表',
    url: 'https://example.feishu.cn/base/oqc-daily',
  },
];

const EARLY_STATUS = {
  来料准备: 'leg',
  装配中: 'assembly1',
  模块绑定中: 'assembly1',
  初测中: 'initial',
  质量测试中: 'initial',
  半成品检验中: 'assembly2',
  中测中: 'assembly2',
  OQT中: 'final',
  OQT终测中: 'final',
  终测中: 'final',
  生产返修中: 'repair',
  NG待返修: 'repair',
  复测中: 'repair',
  已完成测试: 'complete',
  待入库: 'complete',
  待产品入库: 'complete',
};

const normalizeResult = (value) => {
  if (['通过', 'Pass', 'PASS', '合格'].includes(value)) return '通过';
  if (['未通过', 'NG', '不合格'].includes(value)) return '未通过';
  return '';
};

export function getRobotNo(device) {
  return device.robotNo || `RB-${String(device.id).replace(/\D/g, '').padStart(4, '0')}`;
}

export function getProductionKey(device) {
  if (device.productionStarted === false && !isProductionComplete(device)) return null;
  const direct = device.currentProductionNode || device.productionStatus;
  if (PRODUCTION_STEP_KEYS.includes(direct)) return direct;
  if (direct === 'repair') return PRODUCTION_STEP_KEYS.includes(device.failedNode) ? device.failedNode : 'initial';
  const mapped = EARLY_STATUS[device.status];
  if (PRODUCTION_STEP_KEYS.includes(mapped)) return mapped;
  if (mapped === 'repair') return PRODUCTION_STEP_KEYS.includes(device.failedNode) ? device.failedNode : 'initial';
  if (mapped === 'complete' || device.erpInboundNo) return 'final';
  return 'leg';
}

export function productionLabel(key) {
  return PRODUCTION_STEPS.find((step) => step.key === key)?.label || key || '—';
}

export function isProductionComplete(device) {
  if (typeof device.productionComplete === 'boolean') return device.productionComplete;
  const direct = device.productionStatus;
  return ['pendingInbound', 'inbound', 'pendingShipment'].includes(direct)
    || !!device.erpInboundNo
    || ['已完成测试', '待入库', '待产品入库', '已入库', '已分配项目', '待交付', '可交付', '现场安装调试中', '客户验收中', '在线运营', '售后中', '已停用'].includes(device.status);
}

export function hasEnteredProduction(device) {
  if (isProductionComplete(device)) return true;
  if (device.productionStarted === false) return false;
  if (device.productionStarted === true) return true;
  return effectiveProductionHistory(device).some((record) => record.result !== '已建档');
}

export function productionProgressLabel(device) {
  if (!hasEnteredProduction(device)) return '未进入生产';
  return isProductionComplete(device) ? '生产已完成' : productionLabel(getProductionKey(device));
}

export function getRepairStatus(device) {
  if (device.repairStatus) return device.repairStatus;
  if (device.productionStatus === 'repair') return 'inProgress';
  const repairs = (device.productionHistory || []).filter((record) => record.recordType === 'repair' || record.repairSummary);
  if (repairs.some((record) => record.retestResult === 'Pass')) return 'retested';
  if (repairs.length) return 'inProgress';
  return 'none';
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
  }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export function currentNodeResult(device) {
  if (!hasEnteredProduction(device)) return '—';
  if (isProductionComplete(device)) return 'Pass';
  const key = getProductionKey(device);
  const step = PRODUCTION_STEPS.find((item) => item.key === key);
  const records = effectiveProductionHistory(device).filter((record) => record.node === key);
  const latest = records.at(-1);
  if (!latest || latest.result === '已建档') return step?.kind === 'test' ? '暂无结果' : '待处理';
  if (step?.kind === 'test') return ['Pass', 'NG'].includes(latest.result) ? latest.result : '暂无结果';
  if (latest.result === '存在异常' || latest.result === '已记录异常') return '已记录异常';
  return latest.result === '已完成' ? '已完成' : '待处理';
}

export function hasPendingProductionException(device) {
  if (!hasEnteredProduction(device)) return false;
  const repairStatus = getRepairStatus(device);
  if (repairStatus === 'inProgress') return true;
  const key = getProductionKey(device);
  const records = effectiveProductionHistory(device).filter((record) => record.node === key);
  const latest = records.at(-1);
  if (!latest) return false;
  if (['存在异常', '已记录异常', 'NG'].includes(latest.result)) {
    return !(latest.resolved || latest.retestResult === 'Pass');
  }
  return false;
}

function historyFor(device, testRecords) {
  const currentKey = getProductionKey(device);
  const tests = testRecords.filter((record) => record.deviceId === device.id);
  const latestByKey = {};
  tests.forEach((record) => {
    if (record.stationKey === 'init') latestByKey.initial = record;
    if (record.stationKey === 'oqt') latestByKey.final = record;
  });
  const failedTest = [...tests].reverse().find((record) => ['NG', '未通过', '不合格'].includes(record.stationResult || record.result));
  const failedNode = device.failedNode || (failedTest?.stationKey === 'oqt' ? 'final' : 'initial');
  const repairing = device.productionStatus === 'repair' || EARLY_STATUS[device.status] === 'repair';
  const currentIndex = isProductionComplete(device)
    ? PRODUCTION_STEPS.length
    : PRODUCTION_STEPS.findIndex((step) => step.key === currentKey);
  const downstream = isProductionComplete(device);
  const records = [];

  PRODUCTION_STEPS.forEach((step, index) => {
    const test = latestByKey[step.key];
    const currentFailedTest = repairing && step.key === failedNode;
    const completed = index < currentIndex || currentFailedTest;
    if (!completed && !test) return;
    const rawResult = test?.stationResult || test?.result;
    const isNg = currentFailedTest || ['NG', '未通过', '不合格'].includes(rawResult);
    records.push({
      id: `PH-${device.id}-${step.key}`,
      node: step.key,
      nodeLabel: step.label,
      result: isNg ? 'NG' : test ? 'Pass' : step.kind === 'test' ? 'Pass' : '已完成',
      confirmed: !test && step.kind !== 'test',
      summary: test?.notes || (currentFailedTest ? device.exceptionNote || '' : ''),
      operator: test?.operator || device.assembler || '生产人员',
      time: test?.testTime || device.updatedAt || device.createdAt || device.assemblyTime || '',
      ngReason: test?.ngReason || (isNg ? test?.notes || device.exceptionNote || 'NG 原因待补充' : ''),
      repairRequired: isNg,
      repairSummary: '',
      replacementSummary: '',
      retestResult: '',
    });
    if (isNg && (downstream || !repairing)) {
      records.push({
        id: `PH-${device.id}-${step.key}-repair`,
        node: step.key,
        nodeLabel: `${step.label}返修 / 复测`,
        recordType: 'repair',
        result: '返修完成',
        summary: test?.repairAction || '完成问题处理并复测',
        repairSummary: test?.repairAction || '完成问题处理并复测',
        replacementSummary: '',
        retestResult: 'Pass',
        operator: test?.operator || device.assembler || '生产人员',
        time: test?.testTime || device.updatedAt || '',
      });
    }
  });
  let previousTime = 0;
  const fallback = Date.parse(String(device.createdAt || device.assemblyTime || '').replace(' ', 'T')) || Date.now();
  return records.map((record, index) => {
    const parsed = Date.parse(String(record.time || '').replace(' ', 'T'));
    const nextTime = Math.max(Number.isNaN(parsed) ? fallback : parsed, previousTime ? previousTime + 60_000 : fallback + index * 60_000);
    previousTime = nextTime;
    return {
      ...record,
      time: new Date(nextTime).toISOString().slice(0, 16).replace('T', ' '),
    };
  });
}

function deliveryRecordsFor(plan) {
  const records = plan.executionRecords || plan.records?.siteInstall || [];
  return records.map((record, index) => {
    const hasException = record.hasException || ['未通过', 'NG', '异常'].includes(record.result);
    const deviceIds = record.deviceIds
      || record.affectedDeviceIds
      || (record.deviceId ? [record.deviceId] : []);
    return {
      id: record.id || `EXEC-${plan.id}-${index + 1}`,
      title: record.title || `执行记录 ${index + 1}`,
      content: record.content || record.notes || record.summary || '现场执行信息已记录',
      deviceIds,
      hasException,
      exceptionDescription: hasException
        ? record.exceptionDescription || record.notes || record.summary || '执行记录包含异常信息'
        : '',
      recorder: record.recorder || record.operator || plan.owner || '交付人员',
      time: record.time || plan.updatedAt || plan.createdAt || '',
      createdAt: record.createdAt || record.time || plan.updatedAt || plan.createdAt || '',
      updatedAt: record.updatedAt || record.time || plan.updatedAt || plan.createdAt || '',
    };
  });
}

function deliveryResultFor(plan) {
  if (plan.deliveryResult) return plan.deliveryResult;
  const acceptance = (plan.records?.customerAccept || []).at(-1);
  if (!acceptance) return null;
  const result = normalizeResult(acceptance.result);
  if (!result) return null;
  return {
    id: `RESULT-${plan.id}`,
    result,
    summary: acceptance.notes || acceptance.summary || '',
    affectedDeviceIds: result === '未通过' && acceptance.deviceId ? [acceptance.deviceId] : [],
    exceptionDescription: result === '未通过' ? acceptance.notes || acceptance.summary || '现场交付结果未通过' : '',
    recorder: acceptance.operator || plan.owner || '交付人员',
    time: acceptance.time || plan.updatedAt || '',
    history: [],
  };
}

export function normalizePrdState({ devices, testRecords, deliveryPlans, locations, deliveryExceptions }) {
  const validLocationIds = new Set(locations.map((location) => location.id));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const deviceById = new Map(devices.map((device) => [device.id, { ...device }]));

  const normalizedPlans = deliveryPlans
    .filter((plan) => (plan.boundDeviceIds || []).length > 0)
    .flatMap((plan) => {
      const bindings = plan.records?.binding || [];
      const fallbackLocationId = locations.find((location) => location.projectId === plan.projectId && !location.disabled)?.id || null;
      const groups = new Map();
      (plan.boundDeviceIds || []).forEach((deviceId) => {
        const device = deviceById.get(deviceId);
        const binding = bindings.find((item) => item.deviceId === deviceId);
        const locationId = [binding?.locationId, binding?.preAssignedLocationId, device?.locationId, device?.preAssignedLocationId]
          .find((candidate) => validLocationIds.has(candidate) && locationById.get(candidate)?.projectId === plan.projectId)
          || fallbackLocationId;
        if (!locationId) return;
        groups.set(locationId, [...(groups.get(locationId) || []), deviceId]);
      });

      return [...groups.entries()].map(([locationId, boundDeviceIds], index) => {
        const split = groups.size > 1;
        const displayName = (plan.title || plan.name || plan.id).replaceAll('交付计划', '交付执行');
        const recordGroups = Object.fromEntries(Object.entries(plan.records || {}).map(([key, records]) => [
          key,
          (records || []).filter((record) => !record.deviceId || boundDeviceIds.includes(record.deviceId)),
        ]));
        const scopedPlan = { ...plan, records: recordGroups };
        return {
          ...plan,
          id: split ? `${plan.id}-${String(index + 1).padStart(2, '0')}` : plan.id,
          sourcePlanId: plan.id,
          name: split ? `${displayName} · ${locations.find((item) => item.id === locationId)?.name || '点位'}` : displayName,
          title: split ? `${displayName} · ${locations.find((item) => item.id === locationId)?.name || '点位'}` : displayName,
          locationId,
          boundDeviceIds,
          records: recordGroups,
          demandDescription: plan.demandDescription || '',
          feishuDemandUrl: plan.feishuDemandUrl
            || (/^https?:\/\//i.test(plan.sourceReference || '') ? plan.sourceReference : ''),
          createdBy: plan.createdBy || plan.creator || plan.owner || '平台用户',
      erpReferenceType: plan.erpReferenceType || (plan.erpOutboundNo ? '销售发货单' : ''),
      erpReferenceNo: plan.erpReferenceNo || plan.erpOutboundNo || '',
          executionRecords: deliveryRecordsFor(scopedPlan).filter((record) => !record.deviceIds?.length || record.deviceIds.some((deviceId) => boundDeviceIds.includes(deviceId))),
          deliveryResult: deliveryResultFor(scopedPlan),
          operationLogs: plan.operationLogs || [],
        };
      });
    });

  const planByDevice = new Map();
  normalizedPlans.forEach((plan) => {
    (plan.boundDeviceIds || []).forEach((deviceId) => {
      const current = planByDevice.get(deviceId) || [];
      planByDevice.set(deviceId, [...current, plan]);
    });
  });

  const normalizedDevices = devices.map((raw) => {
    const deliveries = planByDevice.get(raw.id) || [];
    const delivery = deliveries[0];
    const assignedLocationId = delivery?.locationId || null;
    const originalProductionKey = getProductionKey(raw);
    const enteredDelivery = deliveries.length > 0;
    const legacyProductionStatus = raw.productionStatus;
    const legacyRepairing = legacyProductionStatus === 'repair' || EARLY_STATUS[raw.status] === 'repair';
    const productionComplete = enteredDelivery || isProductionComplete(raw);
    const explicitlyNotStarted = raw.productionStarted === false && !productionComplete;
    const productionStatus = explicitlyNotStarted
      ? null
      : legacyRepairing
      ? (raw.failedNode || originalProductionKey)
      : productionComplete ? 'final' : originalProductionKey;
    const early = !productionComplete;
    const robotNo = getRobotNo(raw);
    const rawLocationId = raw.locationId || raw.preAssignedLocationId || null;
    const hasValidProject = !!raw.projectId;
    const hasValidProjectLocation = !rawLocationId || locationById.get(rawLocationId)?.projectId === raw.projectId;
    const latestFailedTest = [...testRecords].reverse().find((record) => record.deviceId === raw.id && ['NG', '未通过', '不合格'].includes(record.stationResult || record.result));
    const device = {
      ...raw,
      robotNo,
      productionStatus,
      currentProductionNode: productionStatus,
      productionComplete,
      repairStatus: legacyRepairing ? 'inProgress' : raw.repairStatus || 'none',
      failedNode: legacyRepairing ? raw.failedNode || (latestFailedTest?.stationKey === 'oqt' ? 'final' : 'initial') : raw.failedNode || null,
      projectId: enteredDelivery ? delivery.projectId : (!early && hasValidProject ? raw.projectId : null),
      locationId: enteredDelivery ? assignedLocationId : (!early && hasValidProject && hasValidProjectLocation ? rawLocationId : null),
      preAssignedLocationId: enteredDelivery ? assignedLocationId : (!early && hasValidProject && hasValidProjectLocation ? rawLocationId : null),
      deliveryPlanId: enteredDelivery ? delivery.id : (early ? null : raw.deliveryPlanId || null),
      deliveryPlanIds: deliveries.map((item) => item.id),
      erpBatchNo: raw.erpInboundNo ? robotNo : '',
      electronicAcceptanceUrl: raw.electronicAcceptanceUrl || raw.feishuRecordUrl || '',
      otherFeishuTables: (raw.otherFeishuTables || []).filter((item) => item?.name && !/^\d+$/.test(item.name.trim()) && item?.url),
      archiveStatus: raw.archiveStatus || '有效',
    };
    device.productionHistory = (Array.isArray(raw.productionHistory) ? raw.productionHistory : historyFor({ ...device, productionStatus: legacyProductionStatus }, testRecords))
      .filter((record) => PRODUCTION_STEP_KEYS.includes(record.node))
      .map((record) => ({
        ...record,
        recordType: record.recordType || (record.repairSummary ? 'repair' : 'node'),
      }));
    device.productionStarted = raw.productionStarted === false && !productionComplete
      ? false
      : raw.productionStarted === true
        || productionComplete
        || (PRODUCTION_STEP_KEYS.includes(productionStatus) && raw.status !== '未进入生产')
        || device.productionHistory.some((record) => record.result !== '已建档');
    if (!device.productionStarted) {
      device.productionStatus = null;
      device.currentProductionNode = null;
      device.productionStartedAt = '';
    } else {
      device.productionStartedAt = raw.productionStartedAt
        || device.productionHistory.find((record) => record.result !== '已建档')?.time
        || raw.createdAt
        || '';
    }
    if (device.productionHistory.some((record) => record.recordType === 'repair' && record.retestResult === 'Pass')) {
      device.repairStatus = 'retested';
    }
    return device;
  });

  const normalizedExceptions = deliveryExceptions
    .map((item) => {
      const device = normalizedDevices.find((candidate) => candidate.sn === item.deviceSN || candidate.id === item.deviceId);
      const plan = normalizedPlans.find((candidate) =>
        (candidate.sourcePlanId === item.deliveryPlanId || candidate.id === item.deliveryPlanId)
        && (!device || candidate.boundDeviceIds.includes(device.id))
      );
      if (!plan) return null;
      const sourceRecordId = item.sourceRecordId || item.subOrderId || item.id;
      const sourceRecord = plan.executionRecords.find((record) => record.id === sourceRecordId);
      const sourceType = ({
        客户验收: '交付结果',
        现场安装调试: '执行记录',
        现场执行: '执行记录',
        部署: '执行记录',
        调试: '执行记录',
      })[item.sourceType || item.sourceNode] || item.sourceType || item.sourceNode || '执行记录';
      return {
        id: item.id,
        deliveryPlanId: plan.id,
        projectId: plan.projectId,
        locationId: device?.locationId || plan.locationId,
        sourceRecordId,
        sourceTitle: item.sourceTitle || sourceRecord?.title || (sourceType === '交付结果' ? '交付结果' : '执行记录'),
        sourceType,
        affectedDeviceIds: item.affectedDeviceIds || (device ? [device.id] : []),
        description: item.description || item.notes || '',
        recorder: item.recorder || item.operator || plan.owner || '交付人员',
        recordTime: item.recordTime || item.time || plan.updatedAt || '',
      };
    })
    .filter(Boolean);

  normalizedPlans.forEach((plan) => {
    plan.executionRecords.forEach((record) => {
      if (!record.hasException) return;
      const exists = normalizedExceptions.some((item) => item.deliveryPlanId === plan.id && item.sourceRecordId === record.id);
      if (!exists) normalizedExceptions.push({
        id: `DEX-${plan.id}-${record.id}`,
        deliveryPlanId: plan.id,
        projectId: plan.projectId,
        locationId: plan.locationId,
        sourceRecordId: record.id,
        sourceTitle: record.title,
        sourceType: '执行记录',
        affectedDeviceIds: record.deviceIds || [],
        description: record.exceptionDescription,
        recorder: record.recorder,
        recordTime: record.time,
      });
    });
    if (plan.deliveryResult?.result === '未通过') {
      const sourceRecordId = `RESULT-${plan.id}`;
      const exists = normalizedExceptions.some((item) => item.deliveryPlanId === plan.id && item.sourceRecordId === sourceRecordId);
      if (!exists) normalizedExceptions.push({
        id: `DEX-${sourceRecordId}`,
        deliveryPlanId: plan.id,
        projectId: plan.projectId,
        locationId: plan.locationId,
        sourceRecordId,
        sourceTitle: '交付结果',
        sourceType: '交付结果',
        affectedDeviceIds: plan.deliveryResult.affectedDeviceIds || [],
        description: plan.deliveryResult.exceptionDescription,
        recorder: plan.deliveryResult.recorder,
        recordTime: plan.deliveryResult.time,
      });
    }
  });

  return {
    devices: normalizedDevices,
    deliveryPlans: normalizedPlans,
    deliveryExceptions: normalizedExceptions,
  };
}
