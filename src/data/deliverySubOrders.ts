export const DELIVERY_SUB_ORDER_TYPES = [
  { value: 'preparation', label: '舱体进场及水电部署' },
  { value: 'deployment', label: '机器人／设备部署' },
] as const;

export const PREPARATION_STATUSES = ['未开始', '进行中', '阻塞', '已完成'] as const;
export const DEPLOYMENT_STATUSES = ['待分派', '待接单', '待上门', '执行中', '待设备验收', '阻塞', '已完成'] as const;
export const SUB_ORDER_FILTER_STATUSES = [...new Set([...PREPARATION_STATUSES, ...DEPLOYMENT_STATUSES])];
export const ACCEPTANCE_RESULTS = ['通过', '未通过'] as const;
export const INSTALLATION_STATUSES = ['未开始', '进行中', '已完成'] as const;

export const DEPLOYMENT_STEPS = [
  { key: 'created', label: '已创建' },
  { key: 'assignment', label: '待分派' },
  { key: 'engineer-acceptance', label: '待接单' },
  { key: 'arrival', label: '待上门' },
  { key: 'execution', label: '现场执行' },
  { key: 'device-acceptance', label: '设备验收' },
  { key: 'completed', label: '已完成' },
] as const;

export const SUB_ORDER_NODE_LABELS: Record<string, string> = {
  assignment: '分派执行工程师',
  'engineer-acceptance': '执行工程师接单',
  arrival: '工程师到场',
  'device-installation': '设备安装调试',
  'device-acceptance': '填写设备验收结果',
  'preparation-complete': '完成前置子工单',
  blocked: '阻塞处理',
  completed: '工单完成',
};

export const PREPARATION_CHECKS = [
  { key: 'cabin-shipped', label: '舱体发货确认', required: true },
  { key: 'site-entry', label: '现场进场条件确认', required: true },
  { key: 'cabin-arrival', label: '舱体到场及卸货确认', required: true },
  { key: 'utilities', label: '水电施工完成确认', required: true },
  { key: 'deployment-ready', label: '设备部署条件确认', required: true },
] as const;

export type ExecutionRequirement = 'required' | 'optional' | 'not-applicable';

const PUBLIC_EXECUTION_ITEMS = [
  { key: 'site-preparation', label: '现场准备' },
  { key: 'system-integration', label: '系统联调' },
  { key: 'business-config', label: '业务配置' },
  { key: 'workflow-test', label: '工作流程测试' },
  { key: 'software-tuning', label: '软件调参' },
  { key: 'training', label: '现场培训' },
] as const;

type SceneConfig = {
  requiresPreparation: boolean;
  description: string;
  requirements: Record<string, ExecutionRequirement>;
};

export const DELIVERY_SCENE_CONFIG: Record<string, SceneConfig> = {
  智魔方: {
    requiresPreparation: true,
    description: '先完成舱体进场及水电部署，确认现场条件后再进入机器人／设备部署。',
    requirements: { 'site-preparation': 'required', 'system-integration': 'not-applicable', 'business-config': 'optional', 'workflow-test': 'required', 'software-tuning': 'not-applicable', training: 'optional' },
  },
  机场: {
    requiresPreparation: false,
    description: '可直接进入机器人／设备部署，按现场需要完成系统联调、流程测试和培训。',
    requirements: { 'site-preparation': 'required', 'system-integration': 'required', 'business-config': 'not-applicable', 'workflow-test': 'required', 'software-tuning': 'not-applicable', training: 'optional' },
  },
  工业场景: {
    requiresPreparation: false,
    description: '可直接进入机器人／设备部署，本次现场任务按产线和现场系统情况确认。',
    requirements: { 'site-preparation': 'required', 'system-integration': 'required', 'business-config': 'not-applicable', 'workflow-test': 'required', 'software-tuning': 'not-applicable', training: 'optional' },
  },
  遥操数采: {
    requiresPreparation: false,
    description: '可直接进入机器人／设备部署，重点记录软件调参和数据采集链路测试。',
    requirements: { 'site-preparation': 'required', 'system-integration': 'not-applicable', 'business-config': 'not-applicable', 'workflow-test': 'required', 'software-tuning': 'required', training: 'not-applicable' },
  },
};

const DEFAULT_SCENE: SceneConfig = {
  requiresPreparation: false,
  description: '当前项目可直接创建机器人／设备部署子工单，本次现场任务在创建时确认。',
  requirements: { 'site-preparation': 'required', 'system-integration': 'optional', 'business-config': 'optional', 'workflow-test': 'optional', 'software-tuning': 'optional', training: 'optional' },
};

export type DeliverySubOrderType = (typeof DELIVERY_SUB_ORDER_TYPES)[number]['value'];

export type ReviewMaterial = {
  id: string;
  name: string;
  purpose: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
};

export type SubOrderLog = {
  id: string;
  operator: string;
  time: string;
  action: string;
  notes?: string;
  deviceId?: string;
  issueId?: string;
};

export type DeliverySubOrder = {
  id: string;
  name: string;
  deliveryPlanId: string;
  type: DeliverySubOrderType;
  locationId: string;
  batchId?: string;
  contact?: string;
  owner: string;
  engineer?: string;
  assignedBy?: string;
  createdBy?: string;
  plannedTime: string;
  status: string;
  currentNode: string;
  previousStatus?: string;
  previousNode?: string;
  acceptedAt?: string;
  actualVisitTime?: string;
  startedAt?: string;
  completedAt?: string;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  sourcePreparationId?: string;
  checks: Array<{ key: string; label: string; required: boolean; status: string; completedAt?: string; note?: string; materials: ReviewMaterial[] }>;
  executionItems: Array<{ key: string; label: string; requirement: ExecutionRequirement; status: string; completedAt?: string; note?: string; materials: ReviewMaterial[] }>;
  devices: Array<{ id: string; deviceId: string; deliveryRelationId: string; batchId: string; installationStatus: string; installationNote?: string; acceptanceResult?: string; acceptanceNote?: string; acceptanceHistory?: Array<{ id: string; time: string; operator: string; from: string; to: string; note?: string; issueId?: string }>; materials: ReviewMaterial[] }>;
  blocks: Array<{ id: string; node: string; nodeLabel: string; reason: string; owner: string; pausesTask: boolean; status: string; createdAt: string; updatedAt: string; resolvedAt?: string; resolvedBy?: string; resolution?: string; progress: Array<{ id: string; content: string; operator: string; time: string }>; materials: ReviewMaterial[] }>;
  // Internal references to the one formal issue-pool record. No parallel device-problem state is kept here.
  issueLinks: Array<{ id: string; issueId: string; deviceId: string; createdAt: string }>;
  logs: SubOrderLog[];
};

const seedLog = (id: string, time: string, action: string, notes: string): SubOrderLog => ({ id, operator: '张三', time, action, notes });

export function sceneConfigForProject(projectType = '') {
  const config = DELIVERY_SCENE_CONFIG[projectType] || DEFAULT_SCENE;
  return {
    ...config,
    deploymentItems: PUBLIC_EXECUTION_ITEMS.map((item) => ({
      ...item,
      requirement: config.requirements[item.key] || 'optional',
    })),
  };
}

export function availableSubOrderTypes(projectType = '') {
  const scene = sceneConfigForProject(projectType);
  return DELIVERY_SUB_ORDER_TYPES.filter((item) => scene.requiresPreparation || item.value === 'deployment');
}

export function createExecutionItems(projectType = ''): DeliverySubOrder['executionItems'] {
  return sceneConfigForProject(projectType).deploymentItems.map((item) => ({
    ...item,
    status: item.requirement === 'not-applicable' ? '不适用' : '未开始',
    note: '',
    materials: [],
  }));
}

export function createDeliverySubOrderSeeds(): DeliverySubOrder[] {
  return [];
}

export function subOrderTypeLabel(type: DeliverySubOrderType) {
  return DELIVERY_SUB_ORDER_TYPES.find((item) => item.value === type)?.label || type;
}

export function subOrderNodeLabel(subOrder: DeliverySubOrder) {
  if (subOrder.status === '阻塞') return '阻塞处理中';
  const businessNode = subOrder.type === 'preparation'
    ? subOrder.checks.find((item) => item.key === subOrder.currentNode)?.label
    : subOrder.executionItems.find((item) => item.key === subOrder.currentNode)?.label;
  return businessNode || SUB_ORDER_NODE_LABELS[subOrder.currentNode] || subOrder.currentNode || '—';
}

export function activeSubOrderBlock(subOrder: DeliverySubOrder) {
  return [...subOrder.blocks].reverse().find((item) => item.status !== '已解除');
}

export function activeTaskPausingBlocks(subOrder: DeliverySubOrder) {
  return subOrder.blocks.filter((item) => item.status !== '已解除' && item.pausesTask);
}

export function issueLinksForDevice(subOrder: DeliverySubOrder, deviceId: string) {
  return (subOrder.issueLinks || []).filter((item) => item.deviceId === deviceId);
}

export function hasTaskExecutionBlock(subOrder: DeliverySubOrder) {
  return activeTaskPausingBlocks(subOrder).length > 0;
}

export function deliverySubOrdersForPlan(subOrders: DeliverySubOrder[], deliveryPlanId: string) {
  return subOrders.filter((item) => item.deliveryPlanId === deliveryPlanId);
}

export function subOrderMetrics(subOrders: DeliverySubOrder[]) {
  return {
    total: subOrders.length,
    pending: subOrders.filter((item) => ['未开始', '待分派', '待接单', '待上门'].includes(item.status)).length,
    active: subOrders.filter((item) => ['进行中', '执行中', '待设备验收'].includes(item.status)).length,
    blocked: subOrders.filter((item) => item.status === '阻塞').length,
    completed: subOrders.filter((item) => item.status === '已完成').length,
  };
}

export function preparationReady(subOrder: DeliverySubOrder) {
  return !hasTaskExecutionBlock(subOrder) && subOrder.checks.filter((item) => item.required).every((item) => item.status === '已完成');
}

export function requiredExecutionRemaining(subOrder: DeliverySubOrder) {
  return subOrder.executionItems.filter((item) => item.requirement === 'required' && item.status !== '已完成');
}

export function installationProgress(subOrder: DeliverySubOrder) {
  return subOrder.devices.filter((item) => item.installationStatus === '已完成').length;
}

export function acceptanceProgress(subOrder: DeliverySubOrder) {
  return subOrder.devices.filter((item) => Boolean(item.acceptanceResult)).length;
}

export function canStartDeviceAcceptance(subOrder: DeliverySubOrder) {
  const reasons: string[] = [];
  if (subOrder.status !== '执行中') reasons.push('当前尚未进入现场执行阶段');
  if (hasTaskExecutionBlock(subOrder)) reasons.push('存在未解除的整单执行阻塞');
  const required = requiredExecutionRemaining(subOrder);
  if (required.length) reasons.push(`还有 ${required.length} 项必填公共事项未完成`);
  const installationMissing = subOrder.devices.filter((item) => item.installationStatus !== '已完成').length;
  if (installationMissing) reasons.push(`还有 ${installationMissing} 台设备未完成安装调试`);
  return { ready: reasons.length === 0, reasons };
}

export function deviceAcceptancePrerequisites(subOrder: DeliverySubOrder, record: DeliverySubOrder['devices'][number]) {
  const reasons: string[] = [];
  if (!['执行中', '待设备验收'].includes(subOrder.status)) reasons.push('当前尚未进入现场执行阶段');
  if (hasTaskExecutionBlock(subOrder)) reasons.push('存在未解除的整单执行阻塞');
  const required = requiredExecutionRemaining(subOrder);
  if (required.length) reasons.push(`还有 ${required.length} 项必填公共事项未完成`);
  if (record.installationStatus !== '已完成') reasons.push('当前设备尚未完成安装调试');
  return { ready: reasons.length === 0, reasons };
}

export function deploymentCompletionReasons(subOrder: DeliverySubOrder, _issues: Array<{ id: string; isClosed: string }> = []) {
  const reasons: string[] = [];
  if (subOrder.devices.some((item) => item.installationStatus !== '已完成')) reasons.push('仍有设备未完成安装调试');
  if (subOrder.devices.some((item) => item.acceptanceResult !== '通过')) reasons.push('所有设备验收结果均需为通过');
  if (hasTaskExecutionBlock(subOrder)) reasons.push('存在未解除的整单执行阻塞');
  return reasons;
}

export function deploymentReadyToComplete(subOrder: DeliverySubOrder, issues: Array<{ id: string; isClosed: string }> = []) {
  return deploymentCompletionReasons(subOrder, issues).length === 0;
}

export function deploymentStepKey(subOrder: DeliverySubOrder) {
  if (subOrder.status === '已完成') return 'completed';
  if (subOrder.status === '阻塞') return subOrder.previousStatus === '待分派' ? 'assignment' : subOrder.previousStatus === '待接单' ? 'engineer-acceptance' : subOrder.previousStatus === '待上门' ? 'arrival' : subOrder.previousStatus === '待设备验收' ? 'device-acceptance' : 'execution';
  return subOrder.status === '待分派' ? 'assignment' : subOrder.status === '待接单' ? 'engineer-acceptance' : subOrder.status === '待上门' ? 'arrival' : subOrder.status === '待设备验收' ? 'device-acceptance' : 'execution';
}

export function subOrderGuidance(subOrder: DeliverySubOrder) {
  if (subOrder.status === '阻塞') {
    const block = activeTaskPausingBlocks(subOrder)[0];
    const resumeLabel = block?.nodeLabel || subOrder.checks.find((item) => item.key === subOrder.previousNode)?.label || subOrder.executionItems.find((item) => item.key === subOrder.previousNode)?.label || SUB_ORDER_NODE_LABELS[subOrder.previousNode || ''] || '原执行环节';
    return { task: '处理当前交付阻塞', content: `流程暂停在“${resumeLabel}”，请先解决全部暂停任务的交付阻塞。`, unmet: [block?.reason || '存在未解除的交付阻塞'], next: `解除后恢复到“${resumeLabel}”`, action: 'resolve-block', actionLabel: '处理交付阻塞' };
  }
  if (subOrder.status === '已完成') return { task: '查看已完成工单', content: '流程、设备结果、异常、资料和日志均已切换为只读。', unmet: [], next: subOrder.type === 'preparation' ? '可创建后续机器人／设备部署子工单' : '可继续查看任务记录', action: subOrder.type === 'preparation' ? 'create-deployment' : 'none', actionLabel: subOrder.type === 'preparation' ? '创建后续设备部署子工单' : '' };
  if (subOrder.type === 'preparation') {
    if (subOrder.status === '未开始') return { task: '开始前置准备', content: '开始后按顺序完成舱体、进场、水电和设备部署条件检查。', unmet: [], next: PREPARATION_CHECKS[0].label, action: 'start-preparation', actionLabel: '开始前置准备' };
    const current = subOrder.checks.find((item) => item.key === subOrder.currentNode && item.status !== '已完成') || subOrder.checks.find((item) => item.status !== '已完成');
    if (current) return { task: `完成“${current.label}”`, content: '填写完成说明和资料后，系统进入下一项前置检查。', unmet: [`${subOrder.checks.filter((item) => item.required && item.status !== '已完成').length} 项必要检查待完成`], next: subOrder.checks.find((item) => item.status !== '已完成' && item.key !== current.key)?.label || '完成前置子工单', action: 'complete-check', actionLabel: '确认完成当前检查', targetKey: current.key };
    return { task: '完成前置子工单', content: '必要检查和设备部署条件均已确认，可结束当前前置任务。', unmet: preparationReady(subOrder) ? [] : ['存在未完成检查或未解除阻塞'], next: '创建机器人／设备部署子工单', action: 'complete-preparation', actionLabel: '确认完成前置子工单' };
  }
  if (subOrder.status === '待分派') return { task: '分派执行工程师', content: '选择本次现场任务的执行工程师；任务联系人不会自动成为执行工程师。', unmet: ['尚未分派执行工程师'], next: '等待执行工程师接单', action: 'assign', actionLabel: '分派执行工程师' };
  if (subOrder.status === '待接单') return { task: '执行工程师接单', content: `已分派给 ${subOrder.engineer || '执行工程师'}，接单后才能确认到场。`, unmet: ['执行工程师尚未接单'], next: '前往现场并确认到场', action: 'accept-task', actionLabel: '确认接单' };
  if (subOrder.status === '待上门') return { task: '确认工程师已到现场', content: '确认到场时间后进入现场执行，开始记录本次现场任务和设备安装调试。', unmet: ['尚未确认到场'], next: '完成本次现场任务和设备安装调试', action: 'confirm-arrival', actionLabel: '确认已到现场' };
  if (subOrder.status === '执行中') {
    const required = requiredExecutionRemaining(subOrder);
    if (required.length) return { task: `完成“${required[0].label}”`, content: '先完成当前任务必要的现场任务，再处理设备安装调试。', unmet: [`${required.length} 项必填现场任务待完成`], next: required.length > 1 ? required[1].label : '按设备记录安装调试', action: 'complete-execution', actionLabel: '记录当前执行结果', targetKey: required[0].key };
    const installationMissing = subOrder.devices.filter((item) => item.installationStatus !== '已完成');
    if (installationMissing.length) return { task: '按设备记录安装调试', content: '每台设备单独记录安装调试进度；发现问题时直接登记正式问题池记录。', unmet: [`${installationMissing.length} 台设备未完成安装调试`], next: '开始设备验收', action: 'record-installation', actionLabel: '记录安装调试进度' };
    return { task: '开始设备验收', content: '必要现场任务和全部设备安装调试已经完成，可以进入设备验收阶段。', unmet: [], next: '按设备填写验收结果', action: 'start-acceptance', actionLabel: '开始设备验收' };
  }
  const acceptanceMissing = subOrder.devices.filter((item) => !item.acceptanceResult);
  if (acceptanceMissing.length) return { task: '按设备填写验收结果', content: '每台设备分别记录验收结果；未通过必须关联正式问题池记录。', unmet: [`${acceptanceMissing.length} 台设备未填写验收结果`], next: '完成部署子工单', action: 'record-acceptance', actionLabel: '填写设备验收结果' };
  const completionReasons = deploymentCompletionReasons(subOrder);
  return { task: '完成部署子工单', content: '全部设备已完成安装调试、验收通过且交付阻塞已处理后，可完成工单。', unmet: completionReasons, next: '工单切换为只读', action: 'complete-deployment', actionLabel: '完成部署子工单' };
}

export function subOrderMaterialCount(subOrder: DeliverySubOrder, deliveryExceptions: any[] = []) {
  return [...subOrder.checks.flatMap((item) => item.materials), ...subOrder.executionItems.flatMap((item) => item.materials), ...subOrder.devices.flatMap((item) => item.materials), ...subOrder.blocks.flatMap((item) => item.materials), ...deliveryExceptions.flatMap((item) => item.materials || [])].length;
}
