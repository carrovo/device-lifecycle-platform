export const ISSUE_FIELD_DEFINITIONS = [
  ['issueNo', '问题编号'], ['customerName', '客户名称'], ['causeLevel1', '一级故障原因分类'],
  ['causeLevel2', '二级故障原因分类'], ['causeLevel3', '三级故障分类'], ['symptom', '故障现象描述'],
  ['siteTroubleshooting', '现场已做的排查动作'], ['temporarySolution', '临时解决方案'],
  ['attachments', '详情上传（图片&视频&log）'], ['reporter', '提报人'],
  ['deviceIdentifier', '机器人 SN 编号 or 设备 WIFI 名称'], ['reportedAt', '提报时间'],
  ['projectName', '项目'], ['softwareVersion', '软件版本号'], ['resolutionStatus', '解决状态'],
  ['assignee', '处理人'], ['rootCause', '根因分析（研发/供应商）'],
  ['longTermSolution', '长期问题解决方案（跟进状态）'], ['isClosed', '问题是否闭环'],
] as const;

export const ISSUE_RESOLUTION_STATUSES = ['根因分析进行中', '已完成', '重复', '观察导入措施是否有效', '挂起'] as const;
export const ISSUE_CLOSURE_VALUES = ['是', '否'] as const;
export const TECHNICAL_SUPPORT_DECISIONS = ['远程处理', '转交付侧处理', '需要现场处理，转售后工单'] as const;
export type TechnicalSupportDecision = (typeof TECHNICAL_SUPPORT_DECISIONS)[number];
export type TechnicalSupportRecord = { decision: TechnicalSupportDecision; note: string; handler: string; handledAt: string };

export const ISSUE_CAUSE_LEVEL_1 = ['软件', '硬件', '结构', '生产', '设计问题', '其它（极少情况填写）', '使用问题'] as const;
export const ISSUE_CAUSE_LEVEL_2 = ['硬件-机械臂', '硬件-末端执行器', '硬件-ORIN', '硬件-底盘', '硬件-DCDC模块', '硬件-电机', '软件-感知记忆', '软件-播报交互', '软件-动作规划', '软件-灵动模式', '软件-网络通讯', '软件-机械臂通讯', '其他', '生产-工艺', '软件-遥操平台', '硬件-头部屏幕'] as const;
export const ISSUE_CAUSE_LEVEL_3 = ['知行夹爪', '因时夹爪', '傲意灵巧手', '机械臂关节异常', '机械臂零度问题', '机械臂力传感器异常', '机械臂丢帧', '机械臂过温保护', '机械臂漏电异常', '机械臂末端损坏', '分线器接线', 'NX', '电机超限位', '电机异响', '急停误触发', '电机编码器电池没电', '电机零位异常', '底盘电池异常断电', '底盘初始化异常', '底盘充电桩不良', '电机控制异常', '电机编码器故障', 'NXOrin网卡异常', '电机CAN线通讯异常', '底盘控制器', '灵动动作停住', '灵动动作干涉', '无法对话', '左爪偏差', '动作限位', '强光影响', '机械臂通讯异常', '机械臂欠压'] as const;

export type IssueMaterial = { id: string; name: string; purpose: string; uploadedBy: string; uploadedAt: string; note?: string };
export type IssueActivityLog = { id: string; time: string; operator: string; action: string; notes: string };
export type IssueRecord = {
  id: string;
  issueNo: string;
  customerName: string;
  causeLevel1: string;
  causeLevel2: string;
  causeLevel3: string;
  symptom: string;
  siteTroubleshooting: string;
  temporarySolution: string;
  attachments: IssueMaterial[];
  reporter: string;
  deviceIdentifier: string;
  reportedAt: string;
  projectName: string;
  softwareVersion: string;
  resolutionStatus: string;
  assignee: string;
  rootCause: string;
  longTermSolution: string;
  isClosed: string;
  // Internal linkage only. These fields are never rendered as issue-pool business fields.
  deviceId?: string;
  projectId?: string;
  // Internal lifecycle references. They are deliberately not part of the 19 visible issue-pool fields.
  deliveryContext?: { deliveryPlanId: string; projectId?: string; locationId?: string; batchId?: string; subOrderId: string; node: string; deviceRecordId?: string };
  // Internal workflow record. It is intentionally not part of the 19 issue-pool fields.
  technicalSupport?: TechnicalSupportRecord;
  activityLogs?: IssueActivityLog[];
};

export function createIssuePoolSeeds(): IssueRecord[] {
  return [];
}

export function issueRecordsForDevice(issues: IssueRecord[], deviceId: string) {
  return issues.filter((item) => item.deviceId === deviceId);
}

export function nextIssueNo(issues: IssueRecord[], date = new Date()) {
  const year = date.getFullYear();
  const pattern = new RegExp(`^ISSUE-${year}-(\\d{3})$`);
  const next = issues.reduce((max, issue) => Math.max(max, Number(issue.issueNo.match(pattern)?.[1] || 0)), 0) + 1;
  return `ISSUE-${year}-${String(next).padStart(3, '0')}`;
}

export function issueFieldLabel(key: string) {
  return ISSUE_FIELD_DEFINITIONS.find(([field]) => field === key)?.[1] || key;
}
