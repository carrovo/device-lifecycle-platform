// 全站统一 badge / tag 颜色映射（单一来源，勿在各页面另写一套）。
// 覆盖：状态类 / 平台占用状态 / ERP 单据类型 / 问题来源 / 问题类型 / 故障原因 / ERP 同步。
// 配色规则：绿=完成·可用；蓝=进行中；紫=测试·质量；灰=待办·中性；橙=预警·延期·待返修；
//           红=异常·NG·设备质量问题；ERP 只读同步=中性浅蓝；ERP 单据类型另有专属色。

const TONE_GROUPS = {
  success: [
    '已完成', '已完成测试', '已完成复测', '生产已完成', 'Pass', '通过', '已通过', '测试通过', '复测通过', '检验合格', '合格',
    '已入库', '已关单', '已验收', '已交付', '在线运营', '已解决', '已处理', '有效', '已齐套', '已装配',
    '可交付', '已出厂', '无明显卡点', '已换件', '已返修', '已更换设备', '在线', '有效', '已建档', '已维护验收', '已进入生产',
    // 平台占用状态
    '在库可用',
    // 问题池（技术客服预处理）
    '已远程关闭', '远程已解决',
    // 交付异常
    '已远程解决',
    // ERP 单据类型
    '入库单', '采购入库单', '产品入库单',
    // ERP 平台关联状态
    '已关联',
  ],
  info: [
    '进行中', '处理中', '生产中', '交付中', '现场处理中', '装配中', '整机装配', '模块绑定中', '模块绑定',
    '来料准备', '整机入库', '已绑定', '安装调试中', '现场安装调试中', '出厂检验中', '录入中',
    '已生成工单', '工单处理中', '已生成售后工单', '已生成问题', '已领料', '设备识别', '部分入库',
    '返修中', '组装一', '组装二', '执行信息已维护',
    // 平台占用状态
    '已绑定设备',
    // 问题池 / 交付异常（预处理进行中）
    '已转售后工单', '预处理中', '技术客服预处理中', '交付侧处理中',
    // 问题来源 / 类型
    '扫码上报', '使用问题',
    // 故障原因
    '硬件',
    // ERP 单据类型
    '采购单', '采购订单', '服务交付',
  ],
  test: [
    '质量测试', '质量测试中', '工站测试', '半成品检验中', '半成品检验', '初测中', '初测', '中测中', '中测',
    'OQT中', 'OQT终测中', 'OQT终测', 'OQT', '复测中', '复检中', '客户验收中', '待客户验收', '绑定设备', '客户验收',
    // 故障原因
    '软件',
    // 问题来源
    '问题平台上报',
    // ERP 单据类型
    '生产订单', 'ERP 工单', 'ERP工单',
  ],
  warning: [
    '预警', '长期未结', '当前卡点', '延期', '已延期', '待验收', '待复测', '待检', '特批使用',
    '老化测试中', '终测中', '轻微', '部分齐套', '待确认装配完成', '待确认出厂', '待补齐模块', '待补齐标签',
    '待返修', '库存不足', '现场条件未满足', '同步中', '待接口补齐',
    // 平台占用状态 / 换件旧件
    '旧件待返修',
    // 问题池 / 交付异常（待补充/待预处理）
    '待补充信息', '待技术客服预处理',
    // 故障原因
    '生产',
    // 系统告警来源
    '系统告警',
    // ERP 单据类型
    '检验单', '产品检验单', '在库检验单',
    // ERP 平台关联状态（历史失联，保留快照）
    '已失联',
  ],
  danger: [
    'NG', '测试NG', 'NG待返修', '不合格', '检验不合格', '复测未通过', '未通过', '验收不通过', '严重', '高',
    '生产返修中', '生产返修', '已记录异常', '阻塞', '超时', '节点超时', '同步异常', '退货换货', '装配异常', '安装异常',
    '验收异常', '缺料', '不可入库', '不可出厂', '异常', '紧急',
    // 平台占用状态
    '绑定异常',
    // 问题类型
    '设备质量问题',
  ],
  neutral: [
    '待处理', '暂无结果', '待分派', '待接单', '待上门', '未接入', '未知', '离线', '未开始', '未测试', '待测试',
    '待录入', '待关联', '未填写', '待确认', '未确认', '待绑定', '未绑定', '待交付', '待领料', '已占用', '待装配',
    '已停用', '已关闭', '已作废', '已取消', '售后中', '维修中', '待入库', '待产品入库', '待出货', '已分配项目',
    '立腿状态', '未填写', '待维护', '尚未流转', '已进入', '未进入生产', '基础识别',
    '其他', '已转售后', '中', '低',
    // ERP 平台关联状态（已同步未被引用）
    '未关联',
    // 问题池 / 交付异常（待办/退回/已记录）
    '待预处理', '已记录', '已退回交付继续处理', '退回交付继续处理', '待后续处理', '有异常记录',
    // 平台占用状态（历史/中性）
    '已更换',
    // 问题来源 / 类型 / 故障原因（中性）
    '手动录入', '使用',
    // ERP 单据类型
    'ERP 项目单', 'ERP项目单',
  ],
  teal: ['到货单', '结构'],
  indigo: ['生产领料单', '领料单'],
  orangered: ['销售出库单', '出库申请单', '出库单'],
  erp: [
    'ERP 只读同步', '只读同步', '只读', '已同步', '待同步', 'ERP 无返回', 'ERP无返回', 'ERP 待接口补齐',
    'ERP待接口补齐', '未入库',
  ],
};

const TONE_STYLE = {
  nodeLeg: { chip: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
  neutral: { chip: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  info: { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  success: { chip: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  warning: { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  danger: { chip: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  test: { chip: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  purple: { chip: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  teal: { chip: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  indigo: { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  orangered: { chip: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  erp: { chip: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const STATUS_TONE = {};
Object.entries(TONE_GROUPS).forEach(([tone, list]) => list.forEach((s) => { STATUS_TONE[s] = tone; }));
Object.assign(STATUS_TONE, {
  立腿状态: 'nodeLeg',
  组装一: 'info',
  初测: 'test',
  组装二: 'indigo',
  终测: 'teal',
  生产已完成: 'success',
  返修中: 'warning',
  待处理异常: 'warning',
});

function statusTone(status) {
  return STATUS_TONE[status] || 'neutral';
}

export default function StatusBadge({ status, size = 'sm', dot = true }) {
  const tone = TONE_STYLE[statusTone(status)] || TONE_STYLE.neutral;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[13px] px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-md font-medium whitespace-nowrap ${tone.chip} ${sizeClass}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tone.dot}`} />}
      {status}
    </span>
  );
}
