import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { assemblyTemplateFor } from '../utils/status';
import {
  Page, PageHeader, Section, Table, Btn, LinkAction, Chip,
  Input, Select, SearchInput, StatCard, StatGrid, DescList,
} from '../components/ui';
import {
  ROLES_LIST, ROLE_ACTION_PERMISSIONS, FEISHU_USERS,
  ROBOT_MODELS, PROJECT_TYPES, CORE_PART_TYPES,
} from '../data/mockData';

// 系统管理：5 个二级配置页（用户管理 / 角色权限 / 字典管理 / 流程模板 / 通知规则）。
// 二级菜单在左侧侧边栏，页面本身不再重复横向 tab 条，仅读 ?tab= 深链决定渲染哪个子页。
// 字典管理内部再用本地 state 切换多套字典（不写入 URL）；流程模板内含节点字段配置。
// 兼容旧 key：permissions/logs → roles；fields → workflow；faults/models/projectTypes/modules/statuses → dict。
const TODAY = new Date().toISOString().slice(0, 10);

const TABS = [
  { key: 'users', label: '用户管理' },
  { key: 'roles', label: '角色权限' },
  { key: 'dict', label: '字典管理' },
  { key: 'workflow', label: '流程模板' },
  { key: 'notifications', label: '通知规则' },
];

const TAB_DESC = {
  users: '维护飞书同步的用户、部门与角色分配，查看账号状态与最近登录。',
  roles: '维护各角色的导航可见性与操作权限，并查看审计 / 操作日志。',
  dict: '集中维护项目类型、设备类型、核心零部件、故障原因与状态等基础字典。',
  workflow: '维护生产、交付、售后等业务流程模板及其节点字段配置，供各业务模块引用。',
  notifications: '维护触发事件对应的通知对象、渠道与开关。',
};

const LEGACY_TAB = {
  permissions: 'roles', logs: 'roles',
  fields: 'workflow',
  faults: 'dict', models: 'dict', projectTypes: 'dict', modules: 'dict', statuses: 'dict',
};
const resolveTab = (raw) => {
  if (!raw) return 'users';
  const mapped = LEGACY_TAB[raw] || raw;
  return TABS.some((t) => t.key === mapped) ? mapped : 'users';
};

// 内部角色值 → 展示名（与右上角用户菜单一致）。
const roleDisplay = (r) => ({ 厂长: '工厂负责人', ERP协同角色: 'ERP 协同角色' }[r] || r);

/* ─────── 角色权限矩阵字典 ─────── */
const NAV_LABELS = {
  '/home': '首页',
  '/dashboard': '看板中心',
  '/projects': '项目中心',
  '/assets': '资产管理',
  '/after-sales': '售后管理',
  '/system': '系统管理',
};
const NAV_ROWS = Object.entries(NAV_LABELS);

const ACTION_LABELS = {
  add_material_batch: '新增来料批次',
  void_test_record: '作废测试记录',
  recheck_work_order: '工单复检',
  add_assembly: '整机装配',
  add_test_record: '新增测试记录',
  add_work_order: '新增维修工单',
  update_alert: '更新告警状态',
  add_delivery: '新增交付记录',
  update_work_order: '更新工单状态',
  add_quality_issue: '新增质量问题',
  update_quality_issue: '更新质量问题',
  add_project: '新增项目',
  add_device_allocation: '设备分配',
  void_project: '作废项目',
  manage_locations: '点位管理',
  add_production_plan: '新增生产计划',
  add_device_type: '新增整机类型',
  add_module_type: '新增模块类型',
  edit_device_type: '编辑整机类型',
  edit_module_type: '编辑模块类型',
  manage_users: '用户管理',
  manage_roles: '角色管理',
};
const ALL_ACTIONS = [...new Set(Object.values(ROLE_ACTION_PERMISSIONS).flat())];
const ACTION_ROWS = ALL_ACTIONS.map((a) => [a, ACTION_LABELS[a] || a]);

/* ─────── 字典数据（原型示例，本地维护，不改 mockData） ─────── */
// 流程模板（预设 4 套，含节点表；一期为展示 + 基础信息编辑占位，非低代码编排器）。
const wfNode = (name, o = {}) => ({
  name,
  type: o.type || '操作节点',
  role: o.role || '—',
  required: o.required || '—',
  attachment: o.attachment || '无',
  skip: !!o.skip,
  terminal: !!o.terminal,
  timeout: o.timeout || '无',
});
const WORKFLOW_TYPE_OPTIONS = ['生产测试', '交付部署', '售后', '通用'];
const WORKFLOW_BUSINESS_OPTIONS = ['生产', '交付', '售后', '通用'];
const WORKFLOW_SCOPE_OPTIONS = ['全部', ...PROJECT_TYPES, '通用（机场 / 工业等）'];
const WORKFLOW_TEMPLATES = [
  {
    id: 'WF-1', name: '生产测试流程模板', type: '生产测试', projectScope: '全部', business: '生产', enabled: true, updatedAt: '2026-06-20',
    nodes: [
      wfNode('设备识别', { type: '系统节点', role: '装配工', required: 'SN / 型号' }),
      wfNode('整机装配', { role: '装配工', required: '装配批次号 / 用料清单', attachment: '装配照片' }),
      wfNode('模块绑定', { role: '装配工', required: '模块 SN' }),
      wfNode('半成品检验', { type: '测试节点', role: '质检员', required: '检验结论', timeout: '24 小时' }),
      wfNode('初测', { type: '测试节点', role: '测试员', required: '初测结论', timeout: '24 小时' }),
      wfNode('中测', { type: '测试节点', role: '测试员', required: '中测结论', timeout: '48 小时' }),
      wfNode('OQT', { type: '测试节点', role: '测试员 / 质检员', required: '终测报告', attachment: '终测报告', timeout: '48 小时' }),
      wfNode('生产返修', { role: '维修工程师', required: '返修原因', skip: true }),
      wfNode('复测', { type: '测试节点', role: '测试员', required: '复测结论', skip: true, timeout: '24 小时' }),
      wfNode('测试完成', { type: '终态节点', role: '系统', terminal: true }),
    ],
  },
  {
    id: 'WF-2', name: '智魔方交付流程模板', type: '交付部署', projectScope: '智魔方', business: '交付', enabled: true, updatedAt: '2026-06-18',
    nodes: [
      wfNode('生成交付计划', { type: '系统节点', role: '项目负责人', required: '交付计划信息' }),
      wfNode('前置准备子工单', { type: '子工单节点', role: '项目负责人', required: '准备清单' }),
      wfNode('舱体发货确认', { role: '运维工程师', required: '发货单号', attachment: '发货单', timeout: '48 小时' }),
      wfNode('现场进场条件确认', { type: '审核节点', role: '项目负责人', required: '进场确认' }),
      wfNode('舱体到场 / 卸货完成', { role: '运维工程师', required: '到场确认', attachment: '现场照片' }),
      wfNode('水电施工完成', { role: '运维工程师', required: '施工验收', attachment: '现场照片', skip: true }),
      wfNode('设备部署条件确认', { type: '审核节点', role: '运维工程师', required: '条件确认' }),
      wfNode('机器人 / 设备部署子工单', { type: '子工单节点', role: '运维工程师', required: '部署清单' }),
      wfNode('部署 / 调试 / 测试', { role: '运维工程师', required: '调试结论', attachment: '调试记录', timeout: '72 小时' }),
      wfNode('上传验收材料', { role: '项目负责人', required: '验收材料', attachment: '验收单' }),
      wfNode('验收通过 / 生成售后工单', { type: '终态节点', role: '项目负责人', required: '验收结论', terminal: true }),
    ],
  },
  {
    id: 'WF-3', name: '通用部署流程模板', type: '交付部署', projectScope: '通用（机场 / 工业等）', business: '交付', enabled: true, updatedAt: '2026-06-15',
    nodes: [
      wfNode('生成交付计划', { type: '系统节点', role: '项目负责人', required: '交付计划信息' }),
      wfNode('机器人 / 设备部署子工单', { type: '子工单节点', role: '项目负责人', required: '部署清单' }),
      wfNode('子工单分派', { type: '分派节点', role: '项目负责人 / leader', timeout: '24 小时' }),
      wfNode('工程师接单', { type: '接单节点', role: '运维工程师', timeout: '24 小时' }),
      wfNode('工程师上门', { role: '运维工程师', attachment: '现场照片', timeout: '48 小时' }),
      wfNode('部署 / 调试 / 测试', { role: '运维工程师', required: '调试结论', attachment: '调试记录', timeout: '72 小时' }),
      wfNode('上传验收材料', { role: '运维工程师', required: '验收材料', attachment: '验收单' }),
      wfNode('部署完成 / 生成售后工单', { type: '终态节点', role: '项目负责人', required: '验收结论', terminal: true }),
    ],
  },
  {
    id: 'WF-4', name: '售后处理流程模板', type: '售后', projectScope: '全部', business: '售后', enabled: true, updatedAt: '2026-06-12',
    nodes: [
      wfNode('问题进入问题池', { type: '系统节点', role: '运维工程师', required: '问题描述' }),
      wfNode('技术客服预处理', { role: '技术客服', required: '预处理结论 / 故障分类', timeout: '24 小时' }),
      wfNode('判断是否可远程关闭', { type: '条件节点', role: '技术客服' }),
      wfNode('远程关闭', { role: '技术客服', required: '关闭说明', skip: true }),
      wfNode('生成售后工单', { type: '系统节点', role: '技术客服', required: '工单信息' }),
      wfNode('leader 分派', { type: '分派节点', role: 'leader', timeout: '24 小时' }),
      wfNode('工程师接单', { type: '接单节点', role: '维修工程师', timeout: '24 小时' }),
      wfNode('工程师上门', { role: '维修工程师', attachment: '现场照片', timeout: '48 小时' }),
      wfNode('是否换件', { type: '条件节点', role: '维修工程师' }),
      wfNode('ERP 领料', { role: '维修工程师 / ERP 协同角色', required: '领料单', skip: true }),
      wfNode('记录旧件 / 新件 SN', { role: '维修工程师', required: '旧件 SN / 新件 SN', skip: true }),
      wfNode('上传现场资料', { role: '维修工程师', required: '现场资料', attachment: '现场照片' }),
      wfNode('工程师关单', { type: '终态节点', role: '维修工程师', required: '关单结论', terminal: true }),
    ],
  },
];

// 节点字段配置（原折叠进流程模板详情，供 WorkflowTab 展示各业务节点采集字段）。
const FIELD_ROWS = [
  { id: 'FLD-1', node: '整机装配', field: '装配批次号', type: '单选', required: true, enabled: true },
  { id: 'FLD-2', node: '初测', field: '初测结论', type: '单选', required: true, enabled: true },
  { id: 'FLD-3', node: 'OQT终测', field: '终测报告', type: '附件', required: true, enabled: true },
  { id: 'FLD-4', node: '出厂检验', field: '检验结论', type: '单选', required: true, enabled: true },
  { id: 'FLD-5', node: '现场安装调试', field: '点位编号', type: '文本', required: false, enabled: true },
  { id: 'FLD-6', node: '客户验收', field: '验收签字', type: '附件', required: true, enabled: true },
  { id: 'FLD-7', node: '客户验收', field: '验收备注', type: '文本', required: false, enabled: false },
];

// 故障原因字典：一级固定 6 类；二级示例为核心部件维度；三级留空（待业务补充），不预置具体原因。
// 同一套口径服务质量测试 NG、问题池预处理与售后工单分类。
const L1_OPTIONS = ['硬件', '软件', '生产', '结构', '使用', '其他'];
const L2_OPTIONS = ['机械臂', '夹爪', '灵巧手', '控制器', '网络·通信', '传感器', '其他核心部件', '待业务补充'];
const FAULT_SCOPE_OPTIONS = ['全部', '质量测试', '问题池', '售后工单'];
const FAULT_ROWS = [
  { id: 'FA-1', l1: '硬件', l2: '机械臂', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-2', l1: '硬件', l2: '夹爪', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-3', l1: '硬件', l2: '灵巧手', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-4', l1: '硬件', l2: '控制器', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-5', l1: '硬件', l2: '网络·通信', l3: '待业务补充', scope: '售后工单', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-6', l1: '硬件', l2: '传感器', l3: '待业务补充', scope: '质量测试', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-7', l1: '硬件', l2: '其他核心部件', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-8', l1: '软件', l2: '待业务补充', l3: '待业务补充', scope: '问题池', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-9', l1: '生产', l2: '待业务补充', l3: '待业务补充', scope: '质量测试', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-10', l1: '结构', l2: '待业务补充', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-11', l1: '使用', l2: '待业务补充', l3: '待业务补充', scope: '售后工单', enabled: true, updatedAt: '2026-06-20' },
  { id: 'FA-12', l1: '其他', l2: '待业务补充', l3: '待业务补充', scope: '全部', enabled: true, updatedAt: '2026-06-20' },
];

const MODEL_DESC = {
  AlphaBot1: '第一代服务机器人，适用于商场 / 展厅导览与巡检',
  AlphaBot2: '第二代服务机器人，增强导航与感知，适用于机场 / 工业等复杂场景',
};
// 型号名 → 设备类型 name 关键字（用于从 useApp() state 的 deviceTypes 派生装配模板）、展示名与适用项目类型。
const MODEL_DT_KEY = { AlphaBot1: 'AlphaBot 1', AlphaBot2: 'AlphaBot 2' };
const MODEL_SCOPE = { AlphaBot1: '全部', AlphaBot2: '机场 · 工业场景 · 遥操数采' };
// 机器人型号字典种子（保持 AlphaBot1 / AlphaBot2 两条）：name=型号键，displayName=展示名，scope=适用项目类型 / 业务场景。
const MODEL_ROWS = ROBOT_MODELS.map((m, i) => ({
  id: `RM-${i + 1}`,
  name: m,
  displayName: MODEL_DT_KEY[m] || m,
  desc: MODEL_DESC[m] || '',
  scope: MODEL_SCOPE[m] || '全部',
  enabled: true,
}));

const PROJECT_TYPE_DESC = {
  智魔方: '商场 / 零售场景的智能服务机器人项目',
  机场: '机场航站楼导览、巡检与服务场景',
  工业场景: '工厂 / 产线的工业作业与巡检场景',
  遥操数采: '遥操作与数据采集类项目',
};
const PROJECT_TYPE_ROWS = PROJECT_TYPES.map((t, i) => ({ id: `PT-${i + 1}`, name: t, desc: PROJECT_TYPE_DESC[t] || '', enabled: true }));

const MODULE_DESC = {
  机械臂: '执行抓取 / 操作动作的机械臂总成',
  夹爪: '末端夹持执行器',
  灵巧手: '多自由度仿人灵巧手',
  控制器: '运动控制与主控计算单元',
  其他核心部件: '电池 / 底盘 / 传感器等其他核心部件',
};
const MODULE_ROWS = CORE_PART_TYPES.map((t, i) => ({ id: `MOD-${i + 1}`, name: t, desc: MODULE_DESC[t] || '', enabled: true }));

const NOTIF_RULES = [
  { id: 'NR-1', event: '健康告警触发', target: '运维工程师 / 厂长', channel: '飞书', enabled: true },
  { id: 'NR-2', event: '严重告警生成工单', target: '维修工程师 / 厂长', channel: '飞书 / 短信', enabled: true },
  { id: 'NR-3', event: '维修工单状态变更', target: '运维工程师', channel: '飞书', enabled: true },
  { id: 'NR-4', event: '出厂检验 NG', target: '质检员 / 运维工程师', channel: '飞书', enabled: true },
  { id: 'NR-5', event: '现场安装调试 NG', target: '运维工程师', channel: '飞书', enabled: false },
  { id: 'NR-6', event: '客户验收 NG', target: '项目负责人', channel: '飞书', enabled: true },
  { id: 'NR-7', event: '交付计划延期', target: '项目负责人 / 厂长', channel: '飞书', enabled: true },
  { id: 'NR-8', event: '终测全部通过', target: '项目负责人', channel: '飞书', enabled: true },
  { id: 'NR-9', event: '模块库存不足', target: '厂长', channel: '飞书', enabled: false },
];
const TEMPLATE_PREVIEWS = [
  '【告警通知】SN-DEV-012 发现严重告警，已生成维修工单 WO-003。@赵六（运维工程师）',
  '【工单更新】WO-003 状态已变更为「现场处理中」。@赵六（运维工程师）',
  '【终测通过】SN-DEV-018 已通过 OQT 终测，可分配项目。@蔡八（项目负责人）',
];

/* ─────── 状态字典（颜色统一走 StatusBadge，本表只存枚举 / 语义 / 终态口径） ───────
   kind: 'status' → 有生命周期终态；'value' → 纯枚举取值（终态不适用，展示 —）。
   items 元组：[状态名称, 状态说明, 是否终态?, 是否启用?(缺省 true)]。 */
const STATUS_DICT = [
  { object: '生产计划', kind: 'status', items: [
    ['待排产', '生产计划已创建，等待排产', false],
    ['已排产', '已排入生产队列', false],
    ['生产中', '整机在生产 / 测试流程中', false],
    ['已完成', '生产计划全部完工，终态', true],
    ['已取消', '计划作废，终态', true],
  ] },
  { object: '生产设备', kind: 'status', items: [
    ['生产中', '整机在生产 / 测试流程中', false],
    ['待交付', '已入库并分配项目，等待交付', false],
    ['交付中', '处于出厂 / 安装 / 验收交付过程', false],
    ['在线运营', '已验收并在点位在线运营', false],
    ['售后中', '因故障进入售后处理', false],
    ['已停用', '设备停用，终态', true],
  ] },
  { object: '模块·核心部件', kind: 'status', items: [
    ['在库可用', '在库且可绑定使用', false],
    ['已绑定设备', '已绑定到整机设备', false],
    ['绑定异常', '绑定关系校验异常', false],
    ['已更换', '已从设备上更换下线，终态', true],
    ['旧件待返修', '换下旧件待返修', false],
    ['已返修', '旧件返修完成可复用', false],
  ] },
  { object: 'ERP 同步', kind: 'status', items: [
    ['已同步', '与 ERP 数据一致', false],
    ['同步中', '正在与 ERP 同步', false],
    ['同步异常', '同步失败 / 数据冲突', false],
    ['待同步', '待触发 ERP 同步', false],
    ['只读同步', '仅从 ERP 只读拉取', false],
  ] },
  { object: '交付计划', kind: 'status', items: [
    ['未开始', '交付计划尚未启动', false],
    ['交付中', '交付执行中', false],
    ['已验收', '客户验收通过，终态', true],
    ['已延期', '超出计划验收时间未完成', false],
  ] },
  { object: '交付子工单', kind: 'status', items: [
    ['未开始', '子工单尚未启动', false],
    ['待分派', '待分派处理人', false],
    ['待接单', '已分派，待工程师接单', false],
    ['待上门', '已接单，待现场上门', false],
    ['进行中', '现场执行中', false],
    ['阻塞', '现场条件不满足被阻塞', false],
    ['已完成', '子工单完成，终态', true],
  ] },
  { object: '交付异常', kind: 'status', items: [
    ['已记录', '交付子工单发现异常并记录', false],
    ['交付侧处理中', '物流/现场条件/水电等交付阻塞，交付侧处理', false],
    ['待技术客服预处理', '已提交技术客服，待预处理', false],
    ['技术客服预处理中', '技术客服预处理中', false],
    ['已远程解决', '技术客服远程解决', true],
    ['已转售后工单', '已转售后工单，终态', true],
    ['已退回交付继续处理', '退回交付侧继续处理', false],
    ['已关闭', '异常闭环，终态', true],
  ] },
  { object: '问题池', kind: 'status', items: [
    ['待预处理', '进入问题池，待技术客服预处理', false],
    ['预处理中', '技术客服预处理中', false],
    ['待补充信息', '信息不足，待补充', false],
    ['远程已解决', '技术客服远程解决并关闭，终态', true],
    ['已转售后工单', '预处理后转生成售后工单，终态', true],
    ['已关闭', '问题闭环，终态', true],
  ] },
  { object: '售后工单', kind: 'status', items: [
    ['待分派', '工单已创建，待分派处理人', false],
    ['待接单', '已分派，待工程师接单', false],
    ['待上门', '已接单，待现场上门', false],
    ['现场处理中', '工程师现场处理中', false],
    ['已关单', '问题已解决并关单，终态', true],
    ['已取消', '工单取消，终态', true],
  ] },
  { object: '换件记录', kind: 'status', items: [
    ['已换件', '新件已完成更换上线，终态', true],
    ['旧件待返修', '换下旧件待返修', false],
    ['已返修', '旧件返修完成可复用，终态', true],
  ] },
  { object: '健康告警', kind: 'status', items: [
    ['待处理', '告警已产生，待处理', false],
    ['已生成工单', '已据告警生成维修工单', false],
    ['已解决', '告警已恢复 / 处理完成，终态', true],
    ['已忽略', '人工确认忽略，终态', true],
  ] },
  { object: '机器人型号启用状态', kind: 'status', items: [
    ['启用', '型号可用于新建生产 / 交付', false],
    ['停用', '型号不可用于新建，历史数据保留', false],
  ] },
  { object: 'ERP 单据类型', kind: 'value', items: [
    ['ERP 项目单', 'ERP 项目主单据'],
    ['生产订单', 'ERP 生产订单'],
    ['ERP 工单', 'ERP 生产工单'],
    ['采购单', '物料采购单'],
    ['到货单', '供应商到货单'],
    ['入库单', '仓库入库单'],
    ['检验单', '来料 / 成品检验单'],
    ['生产领料单', '生产领料出库单'],
    ['销售出库单', '销售出库单'],
    ['出库申请单', '出库申请单'],
  ] },
  { object: '问题来源', kind: 'value', items: [
    ['扫码上报', '现场扫码上报'],
    ['手动录入', '人工手动录入'],
    ['系统告警', '健康监控系统告警触发'],
    ['问题平台上报', '外部问题平台同步上报'],
  ] },
  { object: '问题类型', kind: 'value', items: [
    ['使用问题', '使用 / 操作类问题'],
    ['设备质量问题', '设备硬件质量问题'],
  ] },
  { object: '故障原因', kind: 'value', items: [
    ['硬件', '硬件类故障'],
    ['软件', '软件类故障'],
    ['生产', '生产工艺类故障'],
    ['结构', '结构 / 机械类故障'],
    ['使用', '使用 / 操作不当'],
    ['其他', '其他未分类原因'],
  ] },
  { object: '工站测试结果', kind: 'value', items: [
    ['Pass', '工站测试通过（合格）'],
    ['NG', '工站测试不通过（不合格）'],
    ['待测试', '尚未进行工站测试'],
    ['复测中', 'NG 后返修 / 复测处理中'],
  ] },
];

/* ─────── 列 / 字段配置 ─────── */
const nameDescColumns = (nameLabel) => [
  { key: 'name', label: nameLabel, render: (r) => <span className="font-medium text-gray-800">{r.name}</span> },
  { key: 'desc', label: '说明', render: (r) => <span className="text-gray-600">{r.desc || '—'}</span> },
  { key: 'enabled', label: '启用', render: (r) => <EnabledBadge on={r.enabled} /> },
];
const nameDescFields = (nameLabel) => [
  { key: 'name', label: nameLabel, type: 'text', required: true },
  { key: 'desc', label: '说明', type: 'text' },
];

const FAULT_COLUMNS = [
  { key: 'l1', label: '一级故障原因', render: (r) => <span className="font-medium text-gray-800">{r.l1}</span> },
  { key: 'l2', label: '二级故障原因', render: (r) => <span className={r.l2 && r.l2 !== '待业务补充' ? 'text-gray-700' : 'text-gray-400'}>{r.l2 || '待业务补充'}</span> },
  { key: 'l3', label: '三级故障原因', render: (r) => <span className={r.l3 && r.l3 !== '待业务补充' ? 'text-gray-700' : 'text-gray-400'}>{r.l3 || '待业务补充'}</span> },
  { key: 'scope', label: '适用场景', render: (r) => <Chip>{r.scope}</Chip> },
  { key: 'enabled', label: '是否启用', render: (r) => <EnabledBadge on={r.enabled} /> },
  { key: 'updatedAt', label: '最近更新时间', render: (r) => <span className="text-gray-500 text-xs">{r.updatedAt}</span> },
];
const FAULT_FIELDS = [
  { key: 'l1', label: '一级故障原因', type: 'select', options: L1_OPTIONS },
  { key: 'l2', label: '二级故障原因', type: 'select', options: L2_OPTIONS },
  { key: 'l3', label: '三级故障原因', type: 'text', placeholder: '留空则默认「待业务补充」，不预置具体原因' },
  { key: 'scope', label: '适用场景', type: 'select', options: FAULT_SCOPE_OPTIONS },
];

const NOTIF_COLUMNS = [
  { key: 'event', label: '触发事件', render: (r) => <span className="font-medium text-gray-800">{r.event}</span> },
  { key: 'target', label: '通知对象 / 角色', render: (r) => <span className="text-gray-600 text-xs">{r.target}</span> },
  { key: 'channel', label: '通知渠道', render: (r) => <Chip>{r.channel}</Chip> },
  { key: 'enabled', label: '启用', render: (r) => <EnabledBadge on={r.enabled} /> },
];
const NOTIF_FIELDS = [
  { key: 'event', label: '触发事件', type: 'text', required: true },
  { key: 'target', label: '通知对象 / 角色', type: 'text', required: true },
  { key: 'channel', label: '通知渠道', type: 'select', options: ['飞书', '短信', '邮件', '飞书 / 短信'] },
];

/* ═════════ 通用小组件 ═════════ */
function EnabledBadge({ on }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${on ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-300'}`} />
      {on ? '启用' : '停用'}
    </span>
  );
}

// 角色权限矩阵：行=权限项，列=角色；管理员可勾选，其余只读展示。
function PermMatrix({ rows, perms, onToggle, editable, firstColLabel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-[#fafafa] border-b border-[#ececec]">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-[#fafafa]">{firstColLabel}</th>
            {ROLES_LIST.map((r) => (
              <th key={r} className="px-3 py-2 text-center text-xs font-medium text-gray-500 whitespace-nowrap">{roleDisplay(r)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2f2f2]">
          {rows.map(([key, label]) => (
            <tr key={key} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white">{label}</td>
              {ROLES_LIST.map((role) => {
                const has = (perms[role] || []).includes(key);
                return (
                  <td key={role} className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="checkbox"
                        checked={has}
                        onChange={(e) => onToggle(role, key, e.target.checked)}
                        className="w-3.5 h-3.5 accent-gray-900 cursor-pointer"
                      />
                    ) : has ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 字典通用 tab：Section + 紧凑表格 + 新增/编辑 Modal + 启用停用/删除（原型级 CRUD 占位）。
function DictionaryTab({ title, entity, columns, fields, initial, defaults = {}, idPrefix = 'D' }) {
  const [rows, setRows] = useState(initial);
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', id }
  const [form, setForm] = useState({});
  const seq = useRef(0);

  const openAdd = () => {
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.type === 'bool' ? false : f.type === 'select' ? (f.options?.[0] ?? '') : ''])));
    setModal({ mode: 'add' });
  };
  const openEdit = (row) => {
    setForm({ ...row });
    setModal({ mode: 'edit', id: row.id });
  };
  const close = () => setModal(null);
  const canSave = fields.every((f) => !f.required || String(form[f.key] ?? '').trim());

  const save = () => {
    if (!canSave) return;
    if (modal.mode === 'add') {
      seq.current += 1;
      setRows((r) => [{ id: `${idPrefix}-${Date.now()}-${seq.current}`, enabled: true, ...defaults, ...form }, ...r]);
    } else {
      setRows((r) => r.map((x) => (x.id === modal.id ? { ...x, ...form } : x)));
    }
    close();
  };
  const toggle = (id) => setRows((r) => r.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
  const remove = (id) => setRows((r) => r.filter((x) => x.id !== id));

  return (
    <>
      <Section title={title} right={<Btn variant="primary" size="sm" onClick={openAdd}>+ 新增{entity}</Btn>} bodyClassName="p-0">
        <Table head={[...columns.map((c) => c.label), '操作']}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-[#fafafa]">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-gray-700 align-middle whitespace-nowrap">
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <LinkAction onClick={() => openEdit(row)}>编辑</LinkAction>
                  <LinkAction onClick={() => toggle(row.id)}>{row.enabled ? '停用' : '启用'}</LinkAction>
                  <LinkAction onClick={() => remove(row.id)}>删除</LinkAction>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Modal isOpen={!!modal} onClose={close} title={`${modal?.mode === 'edit' ? '编辑' : '新增'}${entity}`}>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[13px] font-medium text-gray-700 mb-1">{f.label}{f.required && ' *'}</label>
              {f.type === 'select' ? (
                <Select className="w-full" value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              ) : f.type === 'bool' ? (
                <Select className="w-full" value={String(form[f.key] ?? false)} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value === 'true' }))}>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </Select>
              ) : (
                <Input className="w-full" value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="secondary" onClick={close}>取消</Btn>
            <Btn variant="primary" onClick={save} disabled={!canSave}>保存</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ═════════ 5. 机器人型号字典（列表 + 查看 → 装配模板 Modal，模板由 useApp() state 派生） ═════════ */
function ModelsTab() {
  const { state } = useApp();
  const [rows, setRows] = useState(MODEL_ROWS);
  const [viewId, setViewId] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', id }
  const [form, setForm] = useState({});
  const [slots, setSlots] = useState([]); // 装配模板编辑态（原型：仅存于 modal state，不回写 deviceTypes）
  const seq = useRef(0);
  const slotSeq = useRef(0);
  const setF = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const viewing = rows.find((r) => r.id === viewId) || null;
  // AlphaBot1 → name 含 'AlphaBot 1' 的 DT（DT-001 先于 AlphaBot 1S，find 命中基础款）；AlphaBot2 → 'AlphaBot 2'。
  const dtForModel = (name) => state.deviceTypes.find((t) => (t.name || '').includes(MODEL_DT_KEY[name] || name));
  const template = assemblyTemplateFor(viewing ? dtForModel(viewing.name) : null, state.moduleTypes);

  // 新建一个空装配槽位（_k 为本地稳定 key，供增删 / 排序用）。
  const newSlot = (o = {}) => {
    slotSeq.current += 1;
    return { _k: `SL-${slotSeq.current}`, slotName: '', corePartType: CORE_PART_TYPES[0], required: true, quantity: 1, needSN: true, replaceable: true, remark: '', ...o };
  };
  // 由派生装配模板映射为可编辑槽位；无模板则给一个空行供从零搭建。
  const slotsFromTemplate = (name) => {
    const tmpl = assemblyTemplateFor(dtForModel(name), state.moduleTypes);
    return tmpl.length
      ? tmpl.map((s) => newSlot({ slotName: s.slotName, corePartType: s.corePartType, required: s.required, quantity: s.quantity, needSN: s.needSN, replaceable: s.replaceable, remark: s.bindRule || '' }))
      : [newSlot()];
  };

  const openAdd = () => { setForm({ name: '', displayName: '', desc: '', scope: '全部', enabled: true }); setSlots([newSlot()]); setModal({ mode: 'add' }); };
  const openEdit = (row) => {
    setForm({ name: row.name, displayName: row.displayName || '', desc: row.desc || '', scope: row.scope || MODEL_SCOPE[row.name] || '全部', enabled: row.enabled });
    setSlots(slotsFromTemplate(row.name));
    setModal({ mode: 'edit', id: row.id });
  };
  const close = () => setModal(null);
  const canSave = !!String(form.name || '').trim();

  // 装配模板槽位操作：新增 / 删除 / 字段更新 / 上下调序。
  const addSlot = () => setSlots((s) => [...s, newSlot()]);
  const removeSlot = (k) => setSlots((s) => s.filter((x) => x._k !== k));
  const updateSlot = (k, patch) => setSlots((s) => s.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const moveSlot = (idx, dir) => setSlots((s) => {
    const j = idx + dir;
    if (j < 0 || j >= s.length) return s;
    const next = [...s];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  const save = () => {
    if (!canSave) return;
    const payload = {
      name: form.name.trim(),
      displayName: form.displayName || '',
      desc: form.desc || '',
      scope: form.scope || '全部',
      enabled: form.enabled !== false,
    };
    if (modal.mode === 'add') {
      seq.current += 1;
      setRows((r) => [{ id: `RM-${Date.now()}-${seq.current}`, ...payload }, ...r]);
    } else {
      setRows((r) => r.map((x) => (x.id === modal.id ? { ...x, ...payload } : x)));
    }
    close();
    // 原型：基础信息回写前端状态；装配模板改动随保存生效（不持久化到 deviceTypes）。
    window.alert(`型号已保存（原型：更新前端状态） · 装配模板共 ${slots.length} 个槽位`);
  };
  const toggle = (id) => setRows((r) => r.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
  const remove = (id) => setRows((r) => r.filter((x) => x.id !== id));

  return (
    <>
      <Section title="机器人型号字典" right={<Btn variant="primary" size="sm" onClick={openAdd}>+ 新增型号</Btn>} bodyClassName="p-0">
        <Table head={['型号', '说明', '启用', '操作']}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 align-middle whitespace-nowrap"><span className="font-medium text-gray-800">{row.name}</span></td>
              <td className="px-3 py-2 align-middle text-gray-600">{row.desc || '—'}</td>
              <td className="px-3 py-2 align-middle whitespace-nowrap"><EnabledBadge on={row.enabled} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <LinkAction onClick={() => setViewId(row.id)}>查看</LinkAction>
                  <LinkAction onClick={() => openEdit(row)}>编辑</LinkAction>
                  <LinkAction onClick={() => toggle(row.id)}>{row.enabled ? '停用' : '启用'}</LinkAction>
                  <LinkAction onClick={() => remove(row.id)}>删除</LinkAction>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Modal isOpen={!!viewing} onClose={() => setViewId(null)} title={viewing ? `${viewing.name} · 型号详情` : ''} size="xl">
        {viewing && (
          <div className="space-y-5">
            <div>
              <div className="text-[13px] font-semibold text-gray-700 mb-2">型号基础信息</div>
              <DescList
                cols={2}
                items={[
                  ['机器人型号', viewing.name],
                  ['型号名称', viewing.displayName || viewing.name],
                  ['适用项目类型 / 业务场景', viewing.scope || MODEL_SCOPE[viewing.name] || '全部'],
                  ['是否启用', <EnabledBadge key="e" on={viewing.enabled} />],
                  ['说明', viewing.desc || '—'],
                ]}
              />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-gray-700 mb-2">装配模板</div>
              <Table head={['排序', '槽位名称', '核心部件类型', '是否必装', '数量', '是否需要 SN / 内部ID', '是否支持换件', '备注']} empty="该型号暂无装配模板槽位">
                {template.map((s) => (
                  <tr key={s.order} className="hover:bg-[#fafafa]">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{s.order}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{s.slotName}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.corePartType}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.required ? '是' : '否'}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.quantity}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.needSN ? '是' : '否'}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.replaceable ? '是' : '否'}</td>
                    <td className="px-3 py-2 text-gray-500">{s.bindRule || '—'}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!modal} onClose={close} title={`${modal?.mode === 'edit' ? '编辑' : '新增'}机器人型号`} size="xl">
        <div className="space-y-5">
          <div>
            <div className="text-[13px] font-semibold text-gray-700 mb-2">基础信息</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">机器人型号 *</label>
                <Input className="w-full" value={form.name ?? ''} placeholder="型号键，如：AlphaBot1" onChange={setF('name')} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">型号名称</label>
                <Input className="w-full" value={form.displayName ?? ''} placeholder="展示名，如：AlphaBot 1" onChange={setF('displayName')} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">适用项目类型 / 业务场景</label>
                <Input className="w-full" value={form.scope ?? ''} placeholder="如：全部 或 机场 · 工业场景 · 遥操数采" onChange={setF('scope')} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">是否启用</label>
                <Select className="w-full" value={String(form.enabled ?? true)} onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.value === 'true' }))}>
                  <option value="true">启用</option>
                  <option value="false">停用</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 mb-1">说明</label>
                <Input className="w-full" value={form.desc ?? ''} placeholder="型号用途 / 适用场景说明" onChange={setF('desc')} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-gray-700">装配模板配置</div>
                <p className="text-xs text-gray-400 mt-0.5">定义该型号的槽位、核心部件类型与绑定规则；随「保存」一并生效（原型：仅更新前端状态，不回写设备类型）。</p>
              </div>
              <Btn variant="secondary" size="sm" onClick={addSlot}>+ 新增槽位</Btn>
            </div>
            <Table
              head={['排序', '槽位名称', '核心部件类型', '是否必装', '数量', '是否需要 SN / 内部ID', '是否支持换件', '备注', '操作']}
              empty="暂无槽位，点击「新增槽位」添加"
            >
              {slots.map((s, idx) => (
                <tr key={s._k} className="hover:bg-[#fafafa]">
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-xs w-4 text-center">{idx + 1}</span>
                      <button type="button" onClick={() => moveSlot(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-800 disabled:opacity-25 disabled:cursor-not-allowed leading-none px-0.5" title="上移">↑</button>
                      <button type="button" onClick={() => moveSlot(idx, 1)} disabled={idx === slots.length - 1} className="text-gray-400 hover:text-gray-800 disabled:opacity-25 disabled:cursor-not-allowed leading-none px-0.5" title="下移">↓</button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-middle"><Input className="w-32" value={s.slotName} placeholder="如：左臂" onChange={(e) => updateSlot(s._k, { slotName: e.target.value })} /></td>
                  <td className="px-2 py-1.5 align-middle">
                    <Select className="w-28" value={s.corePartType} onChange={(e) => updateSlot(s._k, { corePartType: e.target.value })}>
                      {[...new Set(['底盘', '机械臂', '电机', '末端', '全身相机', '预控', '传感器', ...CORE_PART_TYPES, s.corePartType].filter(Boolean))].map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Select className="w-16" value={String(s.required)} onChange={(e) => updateSlot(s._k, { required: e.target.value === 'true' })}>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-middle"><Input type="number" min="1" className="w-16" value={s.quantity} onChange={(e) => updateSlot(s._k, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                  <td className="px-2 py-1.5 align-middle">
                    <Select className="w-16" value={String(s.needSN)} onChange={(e) => updateSlot(s._k, { needSN: e.target.value === 'true' })}>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Select className="w-16" value={String(s.replaceable)} onChange={(e) => updateSlot(s._k, { replaceable: e.target.value === 'true' })}>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 align-middle"><Input className="w-36" value={s.remark} placeholder="绑定规则 / 备注" onChange={(e) => updateSlot(s._k, { remark: e.target.value })} /></td>
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap"><LinkAction onClick={() => removeSlot(s._k)}>删除</LinkAction></td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="secondary" onClick={close}>取消</Btn>
            <Btn variant="primary" onClick={save} disabled={!canSave}>保存</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ═════════ 2. 流程模板（预设模板展示 + 节点表 + 基础编辑占位） ═════════ */
function WorkflowTab() {
  const [rows, setRows] = useState(WORKFLOW_TEMPLATES);
  const [viewId, setViewId] = useState(null);
  const [edit, setEdit] = useState(null); // null | { mode: 'add' } | { mode: 'edit', id }
  const [form, setForm] = useState({});
  const seq = useRef(0);
  const viewing = rows.find((r) => r.id === viewId) || null;
  const setF = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  // 节点字段配置：优先按模板节点名匹配 FIELD_ROWS；无匹配（如交付 / 售后模板）则展示全部字段口径。
  const viewNodeNames = viewing ? viewing.nodes.map((n) => n.name) : [];
  const viewFieldRows = (() => {
    if (!viewing) return [];
    const matched = FIELD_ROWS.filter((f) => viewNodeNames.some((nm) => nm.includes(f.node) || f.node.includes(nm)));
    return matched.length ? matched : FIELD_ROWS;
  })();

  const openAdd = () => { setForm({ name: '', type: '生产测试', projectScope: '全部', business: '生产', enabled: true }); setEdit({ mode: 'add' }); };
  const openEdit = (row) => { setForm({ name: row.name, type: row.type, projectScope: row.projectScope, business: row.business, enabled: row.enabled }); setEdit({ mode: 'edit', id: row.id }); };
  const closeEdit = () => setEdit(null);
  const canSave = !!String(form.name || '').trim();
  const save = () => {
    if (!canSave) return;
    if (edit.mode === 'add') {
      seq.current += 1;
      setRows((r) => [{ id: `WF-${Date.now()}-${seq.current}`, nodes: [], updatedAt: TODAY, ...form }, ...r]);
    } else {
      setRows((r) => r.map((x) => (x.id === edit.id ? { ...x, ...form, updatedAt: TODAY } : x)));
    }
    closeEdit();
  };
  const toggle = (id) => setRows((r) => r.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));

  return (
    <Section
      title="流程模板"
      subtitle="维护生产、交付、售后等业务流程模板；模板节点、适用角色、必填项与超时规则供对应业务模块引用。"
      right={<Btn variant="primary" size="sm" onClick={openAdd}>+ 新增模板</Btn>}
      bodyClassName="p-0"
    >
      <Table head={['模板名称', '模板类型', '适用项目类型 / 业务场景', '适用业务', '节点数量', '是否启用', '最近更新时间', '操作']}>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
            <td className="px-3 py-2 whitespace-nowrap"><Chip>{row.type}</Chip></td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.projectScope}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.business}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.nodes.length}</td>
            <td className="px-3 py-2 whitespace-nowrap"><EnabledBadge on={row.enabled} /></td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{row.updatedAt}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center gap-3">
                <LinkAction onClick={() => setViewId(row.id)}>查看</LinkAction>
                <LinkAction onClick={() => openEdit(row)}>编辑</LinkAction>
                <LinkAction onClick={() => toggle(row.id)}>{row.enabled ? '停用' : '启用'}</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal isOpen={!!viewing} onClose={() => setViewId(null)} title={viewing ? `${viewing.name} · 节点配置` : ''} size="xl">
        {viewing && (
          <div className="space-y-4">
            <DescList
              cols={3}
              items={[
                ['模板类型', viewing.type],
                ['适用项目类型 / 业务场景', viewing.projectScope],
                ['适用业务', viewing.business],
                ['节点数量', `${viewing.nodes.length} 个`],
                ['是否启用', <EnabledBadge key="e" on={viewing.enabled} />],
                ['最近更新时间', viewing.updatedAt],
              ]}
            />
            <Table head={['节点顺序', '节点名称', '节点类型', '适用角色', '必填字段', '附件要求', '是否允许跳过', '是否终态', '超时规则', '下一个节点']}>
              {viewing.nodes.map((n, i) => (
                <tr key={i} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{n.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><Chip>{n.type}</Chip></td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.role}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.required}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.attachment}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.skip ? '是' : '否'}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.terminal ? '是' : '否'}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.timeout}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{n.terminal ? '—（终态）' : (viewing.nodes[i + 1]?.name ?? '—')}</td>
                </tr>
              ))}
            </Table>
            <div>
              <div className="text-[13px] font-semibold text-gray-700 mb-2">节点字段配置</div>
              <p className="text-xs text-gray-400 mb-2">该模板各业务节点采集的字段、字段类型与必填规则。</p>
              <Table head={['业务节点', '字段名', '字段类型', '是否必填', '是否启用']} empty="该模板暂无节点字段配置">
                {viewFieldRows.map((f) => (
                  <tr key={f.id} className="hover:bg-[#fafafa]">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{f.node}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{f.field}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{f.type}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.required ? <Chip>必填</Chip> : <span className="text-gray-400 text-xs">选填</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><EnabledBadge on={f.enabled} /></td>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!edit} onClose={closeEdit} title={`${edit?.mode === 'edit' ? '编辑' : '新增'}流程模板`}>
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">模板名称 *</label>
            <Input className="w-full" value={form.name ?? ''} placeholder="如：生产测试流程模板" onChange={setF('name')} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">模板类型</label>
            <Select className="w-full" value={form.type ?? ''} onChange={setF('type')}>
              {WORKFLOW_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">适用项目类型 / 业务场景</label>
            <Select className="w-full" value={form.projectScope ?? ''} onChange={setF('projectScope')}>
              {WORKFLOW_SCOPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">适用业务</label>
            <Select className="w-full" value={form.business ?? ''} onChange={setF('business')}>
              {WORKFLOW_BUSINESS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">是否启用</label>
            <Select className="w-full" value={String(form.enabled ?? true)} onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.value === 'true' }))}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </Select>
          </div>
          <p className="text-xs text-gray-400">一期支持模板基础信息维护与节点表展示；完整节点编排（增删节点、连线、超时策略）后续迭代。</p>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="secondary" onClick={closeEdit}>取消</Btn>
            <Btn variant="primary" onClick={save} disabled={!canSave}>保存</Btn>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

/* ═════════ 用户管理（飞书同步用户列表 + 查看详情） ═════════ */
// 账号：FEISHU_USERS 未内置账号字段，原型下以 feishu.<id> 派生展示。
const userAccount = (u) => u.account || `feishu.${u.id}`;

function UsersTab() {
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewId, setViewId] = useState(null);

  const isOn = (u) => (u.status || '启用') === '启用';
  const users = FEISHU_USERS.filter(
    (u) => (!q || u.name.includes(q) || (u.dept || '').includes(q)) && (!roleFilter || u.role === roleFilter),
  );
  const enabledUsers = FEISHU_USERS.filter(isOn).length;
  const deptCount = new Set(FEISHU_USERS.map((u) => u.dept)).size;
  const viewing = FEISHU_USERS.find((u) => u.id === viewId) || null;

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="用户总数" value={FEISHU_USERS.length} />
        <StatCard label="启用用户" value={enabledUsers} tone="success" />
        <StatCard label="角色数" value={ROLES_LIST.length} />
        <StatCard label="部门数" value={deptCount} />
      </StatGrid>

      <Section
        title="用户与角色"
        subtitle="用户由飞书同步，维护部门、岗位、角色与数据权限范围。"
        right={
          <div className="flex items-center gap-2">
            <SearchInput placeholder="搜索用户 / 部门" value={q} onChange={(e) => setQ(e.target.value)} className="w-40" />
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">全部角色</option>
              {ROLES_LIST.map((r) => <option key={r} value={r}>{roleDisplay(r)}</option>)}
            </Select>
            <Btn variant="primary" size="sm" disabled title="用户由飞书同步，暂不支持手动新增">+ 新增用户</Btn>
          </div>
        }
        bodyClassName="p-0"
      >
        <Table head={['用户 / 账号', '姓名', '部门', '岗位 / 职能', '角色', '最近登录', '状态', '操作']} empty="未匹配到用户">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#f0f0f0] text-gray-600 text-xs font-medium">{u.avatar || u.name.slice(0, 1)}</span>
                  <span className="font-mono text-xs text-gray-500">{userAccount(u)}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{u.name}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{u.dept}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{u.title || '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><Chip>{roleDisplay(u.role)}</Chip></td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{u.lastLogin || '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><EnabledBadge on={isOn(u)} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                <LinkAction onClick={() => setViewId(u.id)}>查看</LinkAction>
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Modal isOpen={!!viewing} onClose={() => setViewId(null)} title={viewing ? `${viewing.name} · 用户详情` : ''}>
        {viewing && (
          <DescList
            cols={2}
            items={[
              ['姓名', viewing.name],
              ['账号', userAccount(viewing)],
              ['部门', viewing.dept],
              ['岗位 / 职能', viewing.title || '—'],
              ['当前角色', roleDisplay(viewing.role)],
              ['可访问项目', viewing.projectScope || '—'],
              ['数据权限范围', viewing.dataScope || '—'],
              ['状态', <EnabledBadge key="e" on={isOn(viewing)} />],
              ['最近登录', viewing.lastLogin || '—'],
            ]}
          />
        )}
      </Modal>
    </>
  );
}

/* ═════════ 角色权限（导航 / 操作权限矩阵 + 审计日志） ═════════ */
function RolesTab() {
  const { currentRole, navPermissions, updateNavPermission, actionPermissions, updateActionPermission } = useRole();
  const { state } = useApp();
  const isAdmin = currentRole === '管理员';

  const logs = [...(state.operationLogs || [])].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 20);
  const moduleOf = (log) => (log.productionPlanId ? '生产计划' : log.deliveryPlanId ? '交付计划' : log.projectId ? '项目中心' : log.deviceId ? '资产管理' : '系统');

  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="角色数" value={ROLES_LIST.length} />
        <StatCard label="导航模块" value={NAV_ROWS.length} />
        <StatCard label="操作权限项" value={ACTION_ROWS.length} />
        <StatCard label="审计日志（近 20 条）" value={logs.length} />
      </StatGrid>

      <Section title="导航权限" subtitle={isAdmin ? '勾选各角色可见的导航模块（管理员可编辑）。' : '各角色可见的导航模块（只读）。'} bodyClassName="p-0">
        <PermMatrix rows={NAV_ROWS} perms={navPermissions} onToggle={updateNavPermission} editable={isAdmin} firstColLabel="导航模块" />
      </Section>

      <Section title="操作权限" subtitle={isAdmin ? '勾选各角色可执行的操作（管理员可编辑）。' : '各角色可执行的操作（只读）。'} bodyClassName="p-0">
        <PermMatrix rows={ACTION_ROWS} perms={actionPermissions} onToggle={updateActionPermission} editable={isAdmin} firstColLabel="操作" />
      </Section>

      <Section title="审计 / 操作日志查看" subtitle="操作留痕的审计查看能力（底层能力，非业务导航模块），支撑追溯（最近 20 条）。" bodyClassName="p-0">
        <Table head={['操作时间', '操作人', '模块', '操作类型', '操作对象', '说明']} empty="暂无操作日志">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{log.timestamp}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{log.operator}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{moduleOf(log)}</td>
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{log.actionType}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{log.projectId || log.deliveryPlanId || log.productionPlanId || log.deviceId || '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs max-w-[280px] truncate">{log.notes || '—'}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

/* ═════════ 8. 通知规则 ═════════ */
function WebhookSection() {
  const [url, setUrl] = useState('https://open.feishu.cn/open-apis/bot/v2/hook/example');
  const [saved, setSaved] = useState(false);
  return (
    <Section title="Webhook 配置" subtitle="用于将通知推送到飞书群机器人。">
      <div className="max-w-xl space-y-3">
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1">飞书 Webhook URL</label>
          <Input className="w-full" value={url} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." onChange={(e) => { setUrl(e.target.value); setSaved(false); }} />
        </div>
        <div className="flex items-center gap-3">
          <Btn variant="primary" onClick={() => setSaved(true)}>保存配置</Btn>
          {saved && <span className="text-[13px] text-green-600">配置已保存</span>}
        </div>
      </div>
    </Section>
  );
}

function NotificationsTab() {
  return (
    <>
      <DictionaryTab title="通知规则" entity="规则" idPrefix="NR" columns={NOTIF_COLUMNS} fields={NOTIF_FIELDS} initial={NOTIF_RULES} />
      <WebhookSection />
      <Section title="消息模板预览" subtitle="通知按模板渲染并 @ 相关角色 / 人员。">
        <div className="space-y-2">
          {TEMPLATE_PREVIEWS.map((msg, i) => (
            <div key={i} className="bg-[#fafafa] border border-[#f0f0f0] rounded-md p-3 text-[13px] text-gray-700">{msg}</div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ═════════ 9. 状态字典 ═════════ */
// 各业务对象的状态枚举 / 取值统一在此维护；「状态颜色」列直接用 StatusBadge 走全站统一配色。
function StatusesTab() {
  return (
    <Section
      title="状态字典"
      subtitle="集中维护各业务对象的状态枚举、语义色与终态口径，颜色统一由 StatusBadge 渲染"
      bodyClassName="p-0"
      right={<Btn size="sm" disabled title="原型占位，暂不支持新增">新增状态</Btn>}
    >
      <Table head={['对象类型', '状态名称', '状态说明', '状态颜色', '是否终态', '是否启用', '最近更新时间', '操作']}>
        {STATUS_DICT.flatMap((group) =>
          group.items.map(([name, desc, terminal, enabled = true], idx) => (
            <tr
              key={`${group.object}-${name}`}
              className={`hover:bg-[#fafafa] ${idx === 0 ? 'border-t-2 border-[#ececec]' : 'border-t border-[#f5f5f5]'}`}
            >
              <td className="px-3 py-2 whitespace-nowrap align-top">
                {idx === 0 && <span className="font-medium text-gray-800">{group.object}</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{name}</td>
              <td className="px-3 py-2 text-gray-600">{desc}</td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={name} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                {group.kind === 'value'
                  ? <span className="text-gray-300">—</span>
                  : terminal
                    ? <Chip>终态</Chip>
                    : <span className="text-gray-400 text-xs">否</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap"><EnabledBadge on={enabled} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{TODAY}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <LinkAction>编辑</LinkAction>
              </td>
            </tr>
          )),
        )}
      </Table>
    </Section>
  );
}

/* ═════════ 字典管理（内部子 tab 聚合多套字典，选择态走本地 state 不写 URL） ═════════ */
const DICT_SUBS = [
  { key: 'projectTypes', label: '项目类型 / 业务场景' },
  { key: 'models', label: '设备类型（机器人型号）' },
  { key: 'modules', label: '核心零部件类型' },
  { key: 'faults', label: '故障原因' },
  { key: 'statuses', label: '状态字典' },
];

function DictTab() {
  const [dictSub, setDictSub] = useState('projectTypes');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {DICT_SUBS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setDictSub(s.key)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
              dictSub === s.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-[#e5e5e5] hover:bg-[#fafafa]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {dictSub === 'projectTypes' && <DictionaryTab title="项目类型 / 业务场景字典" entity="类型" idPrefix="PT" columns={nameDescColumns('类型名')} fields={nameDescFields('类型名')} initial={PROJECT_TYPE_ROWS} />}
      {dictSub === 'models' && <ModelsTab />}
      {dictSub === 'modules' && <DictionaryTab title="核心零部件类型字典" entity="部件" idPrefix="MOD" columns={nameDescColumns('部件类型')} fields={nameDescFields('部件类型')} initial={MODULE_ROWS} />}
      {dictSub === 'faults' && <DictionaryTab title="故障原因字典" entity="故障原因" idPrefix="FA" columns={FAULT_COLUMNS} fields={FAULT_FIELDS} initial={FAULT_ROWS} defaults={{ updatedAt: TODAY }} />}
      {dictSub === 'statuses' && <StatusesTab />}
    </div>
  );
}

/* ═════════ 页面 ═════════ */
export default function SystemPage() {
  const [searchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const activeLabel = TABS.find((t) => t.key === activeTab)?.label || '';

  return (
    <Page>
      <PageHeader
        title="系统管理"
        description={TAB_DESC[activeTab]}
        breadcrumb={<div className="text-xs text-gray-400 mb-1">系统管理 / {activeLabel}</div>}
      />
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'dict' && <DictTab />}
      {activeTab === 'workflow' && <WorkflowTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </Page>
  );
}
