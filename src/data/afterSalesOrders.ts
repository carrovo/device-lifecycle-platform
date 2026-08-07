export const AFTER_SALES_STATUSES = ['待分派', '待接单', '待上门', '现场处理中', '已关单', '已取消'] as const;
export type AfterSalesStatus = (typeof AFTER_SALES_STATUSES)[number];

export type AfterSalesMaterial = { id: string; name: string; purpose: string; addedBy: string; addedAt: string; note?: string };
export type AfterSalesLog = { id: string; time: string; operator: string; action: string; notes: string };
export type AfterSalesOrder = {
  id: string;
  orderNo: string;
  issueId: string;
  issueNo: string;
  // Internal lifecycle references inherited from the formal issue record.
  deviceId?: string;
  projectId?: string;
  deliveryPlanId?: string;
  sourceSubOrderId?: string;
  locationId?: string;
  batchId?: string;
  status: AfterSalesStatus;
  snapshot: { customerName: string; projectName: string; deviceIdentifier: string; symptom: string; causeLevel1: string; causeLevel2: string; causeLevel3: string; rootCause: string; longTermSolution: string; attachments: AfterSalesMaterial[]; technicalSupport?: { decision: string; note: string; handler: string; handledAt: string } };
  assignedBy?: string;
  engineer?: string;
  assignedAt?: string;
  acceptedAt?: string;
  plannedVisitAt?: string;
  actualVisitAt?: string;
  visitNote?: string;
  onsiteHandling?: string;
  actualCause?: string;
  actualSolution?: string;
  finalResult?: string;
  involvesReplacement?: boolean;
  materials: AfterSalesMaterial[];
  closedBy?: string;
  closedAt?: string;
  closeNote?: string;
  issueOutcome?: 'resolved' | 'observe';
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  logs: AfterSalesLog[];
};

export const ACTIVE_AFTER_SALES_STATUSES: AfterSalesStatus[] = ['待分派', '待接单', '待上门', '现场处理中'];

export function nextAfterSalesOrderNo(orders: AfterSalesOrder[], date = new Date()) {
  const year = date.getFullYear();
  const pattern = new RegExp(`^ASO-${year}-(\\d{3})$`);
  const next = orders.reduce((max, order) => Math.max(max, Number(order.orderNo.match(pattern)?.[1] || 0)), 0) + 1;
  return `ASO-${year}-${String(next).padStart(3, '0')}`;
}

export function activeAfterSalesOrderForIssue(orders: AfterSalesOrder[], issueId: string) {
  return orders.find((order) => order.issueId === issueId && ACTIVE_AFTER_SALES_STATUSES.includes(order.status));
}

export function createAfterSalesOrderSeeds(): AfterSalesOrder[] {
  return [];
}

export function afterSalesCloseReasons(order: AfterSalesOrder) {
  return [
    !order.engineer && '尚未分派售后工程师',
    !order.acceptedAt && '售后工程师尚未接单',
    !order.actualVisitAt && '尚未记录实际上门时间',
    !order.onsiteHandling?.trim() && '尚未填写现场处理说明',
    !order.actualSolution?.trim() && '尚未填写实际处理方案',
    !order.finalResult?.trim() && '尚未填写最终处理结果',
    !order.closeNote?.trim() && '尚未填写关单说明',
    !order.materials.some((item) => /视频|证明|处理结果/.test(`${item.name} ${item.purpose}`)) && '尚未添加正常工作视频或处理结果证明资料',
  ].filter(Boolean) as string[];
}

export function afterSalesHandlingReasons(order: AfterSalesOrder) {
  return [
    !order.onsiteHandling?.trim() && '尚未填写现场处理说明',
    !order.actualSolution?.trim() && '尚未填写实际处理方案',
    !order.finalResult?.trim() && '尚未填写最终处理结果',
  ].filter(Boolean) as string[];
}

export function afterSalesGuidance(order: AfterSalesOrder) {
  if (order.status === '待分派') return { task: '分派售后工程师', unmet: ['尚未分派售后工程师'], next: '等待工程师接单', action: 'assign', label: '分派售后工程师' };
  if (order.status === '待接单') return { task: '等待售后工程师接单', unmet: ['工程师尚未接单'], next: '安排预计上门时间', action: 'accept', label: '确认接单' };
  if (order.status === '待上门') return order.plannedVisitAt ? { task: '确认已到现场', unmet: [], next: '记录现场处理', action: 'arrive', label: '确认已到现场' } : { task: '设置预计上门时间', unmet: ['尚未设置预计上门时间'], next: '确认工程师已到现场', action: 'plan-visit', label: '设置预计上门时间' };
  if (order.status === '现场处理中') {
    const missing = afterSalesHandlingReasons(order);
    return missing.length ? { task: '记录现场处理', unmet: missing, next: '满足条件后关单', action: 'handle', label: '记录现场处理' } : { task: '完成并关单', unmet: [], next: '工单切换为只读', action: 'close', label: '完成并关单' };
  }
  return { task: order.status === '已关单' ? '查看已关单工单' : '查看已取消工单', unmet: [], next: '', action: 'none', label: '' };
}
