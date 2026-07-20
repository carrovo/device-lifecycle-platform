import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import OperationLog from '../components/OperationLog';
import { Pagination, usePaged } from '../components/Pagination';
import { Page, PageHeader, Section, DescList, Table, StatCard, StatGrid, Chip, Btn, LinkAction, EmptyState, Stepper } from '../components/ui';
import { isPass, deliveryPlanStatus, TODAY } from '../utils/status';

// 原型占位工具（不引入外部依赖）。
const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const genId = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;

// 交付异常字段容错读取：并行任务补 state.deliveryExceptions，字段名可能有出入，逐个回退。
const EX_KEYS = {
  sourceOrder: ['subOrderId', 'sourceOrderId', 'sourceSubOrderId', 'sourceWorkOrderId', 'sourceOrder'],
  node: ['sourceNode', 'sourceStage', 'node'],
  sn: ['deviceSN', 'deviceSn', 'sn'],
  type: ['exceptionType', 'type'],
  desc: ['description', 'desc', 'exceptionDesc'],
  occurredAt: ['occurTime', 'occurredAt', 'occurredTime', 'happenedAt'],
  recordedAt: ['recordTime', 'recordedAt', 'recordedTime', 'createdAt'],
  recorder: ['recorder', 'recordedBy', 'reporterName', 'reporter', 'operator'],
  submittedAt: ['submitCSTime', 'submittedAt', 'submitTime', 'submittedToSupportAt'],
};
function exField(e, keys) {
  for (const k of keys) {
    const v = e[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

// 交付流程节点定义（含设备绑定）。智魔方多一个「前置准备」节点。
function deliveryStepDefs(isZhimofang) {
  const base = isZhimofang
    ? ['计划创建', '设备绑定', '前置准备', '设备部署', '现场安装调试', '客户验收', '交付完成']
    : ['计划创建', '设备绑定', '设备部署', '现场安装调试', '客户验收', '交付完成'];
  return base.map((s) => ({ key: s, label: s }));
}
// 当前节点推导：优先按记录 / 计划状态派生，回退 plan.currentNode。
function deliveryStepCurrent(plan, recs, planStatus, boundCount) {
  const has = (k) => (recs[k] || []).length > 0;
  if (planStatus === '已验收') return '交付完成';
  if (has('customerAccept') || plan.currentNode === '客户验收') return '客户验收';
  if (has('siteInstall') || plan.currentNode === '现场安装调试') return '现场安装调试';
  if (has('factoryInspection') || plan.currentNode === '出厂检验') return '设备部署';
  if (has('binding') || boundCount) return '设备绑定';
  return '计划创建';
}

// 交付异常处理日志时间线（processLogs：{ time, operator, fromStatus, toStatus, notes }）。
function ExProcessLogs({ logs }) {
  if (!logs || logs.length === 0) return <div className="text-xs text-gray-400">暂无处理日志</div>;
  return (
    <ol className="space-y-3">
      {logs.map((log, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
            {i < logs.length - 1 && <span className="w-px flex-1 bg-[#ececec] mt-1" />}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
              <span>{log.time ?? '—'}</span>
              {log.operator && <span className="font-medium text-gray-600">{log.operator}</span>}
              {log.fromStatus && <><StatusBadge status={log.fromStatus} /><span className="text-gray-300">→</span><StatusBadge status={log.toStatus} /></>}
            </div>
            {log.notes && <div className="text-[13px] text-gray-700 mt-1">{log.notes}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// 交付异常详情（Modal）：全字段 + 附件 + 处理日志。
function ExceptionDetail({ ex }) {
  const submittedAt = exField(ex, EX_KEYS.submittedAt);
  const submitted = ex.submittedToCS ?? ex.submittedToSupport ?? ex.submitted ?? (!!submittedAt || !!ex.linkedIssueId);
  const attList = ex.attachments || ex.files || [];
  return (
    <div className="space-y-4">
      <DescList
        cols={2}
        items={[
          ['异常编号', ex.id],
          ['当前处理状态', <StatusBadge status={ex.status} />],
          ['来源交付子工单', exField(ex, EX_KEYS.sourceOrder)],
          ['来源节点', exField(ex, EX_KEYS.node)],
          ['关联设备 SN', exField(ex, EX_KEYS.sn)],
          ['异常类型', exField(ex, EX_KEYS.type) ? <Chip tone="outline">{exField(ex, EX_KEYS.type)}</Chip> : '—'],
          ['异常发生时间', exField(ex, EX_KEYS.occurredAt)],
          ['异常记录时间', exField(ex, EX_KEYS.recordedAt)],
          ['记录人', exField(ex, EX_KEYS.recorder)],
          ['是否提交技术客服', submitted ? '是' : '否'],
          ['提交技术客服时间', submittedAt],
          ['关联问题编号', ex.linkedIssueId ? <Link to="/after-sales?tab=issues" className="ui-link font-mono text-xs">{ex.linkedIssueId}</Link> : '—'],
          ['关联售后工单号', ex.linkedWorkOrderId ? <Link to="/after-sales?tab=orders" className="ui-link font-mono text-xs">{ex.linkedWorkOrderId}</Link> : '—'],
          ['异常描述', exField(ex, EX_KEYS.desc)],
        ]}
      />
      <div>
        <div className="text-xs text-gray-400 mb-1.5">附件</div>
        {attList.length
          ? <div className="flex flex-wrap gap-2">{attList.map((a, i) => <Chip key={i} tone="outline">{typeof a === 'string' ? a : (a.name || a.file || a.fileName || '附件')}</Chip>)}</div>
          : <div className="text-xs text-gray-400">暂无附件</div>}
      </div>
      <div>
        <div className="text-xs text-gray-400 mb-1.5">处理日志</div>
        <ExProcessLogs logs={ex.processLogs || ex.logs || []} />
      </div>
    </div>
  );
}

// 交付计划详情（只读追溯视图）
// 分区：交付基础信息 / 设备列表 / 交付子工单（前置准备 + 设备部署两组）/
//       交付资料 / 附件 / 验收记录 / 关联售后工单 / 操作日志。
// 交付子工单只保留两类：前置准备（舱体进场及水电部署）、机器人 / 设备部署。
// 培训与验收合并进「设备部署子工单」的检查项 / 上传材料。
// 交付异常转售后为流程分支（非独立菜单）：子工单内只读展示生成 / 已绑定售后工单入口。

function getBoundDeviceIds(plan) {
  const explicit = plan.boundDeviceIds || [];
  const binding = (plan.records?.binding || []).map((r) => r.deviceId);
  const stages = ['factoryInspection', 'siteInstall', 'customerAccept'].flatMap((k) => (plan.records?.[k] || []).map((r) => r.deviceId));
  return [...new Set([...explicit, ...binding, ...stages].filter(Boolean))];
}

// 设备部署子工单当前状态：按各节点记录派生（已验收 / 验收异常 / 待客户验收 / 安装异常 / 已出厂 / 不可出厂 / 待出厂检验）。
function deploymentStatus(recs, deviceId) {
  const ca = (recs.customerAccept || []).find((r) => r.deviceId === deviceId);
  const si = (recs.siteInstall || []).find((r) => r.deviceId === deviceId);
  const fi = (recs.factoryInspection || []).find((r) => r.deviceId === deviceId);
  if (ca) return isPass(ca) ? '已验收' : '验收异常';
  if (si) return isPass(si) ? '待客户验收' : '安装异常';
  if (fi) return isPass(fi) ? '已出厂' : '不可出厂';
  return '待出厂检验';
}

// 设备部署子工单「可操作状态」：驱动子工单详情「当前可执行操作」，区别于业务状态（deploymentStatus）。
function deployOpStatus(recs, deviceId) {
  const ca = (recs.customerAccept || []).find((r) => r.deviceId === deviceId);
  const si = (recs.siteInstall || []).find((r) => r.deviceId === deviceId);
  const fi = (recs.factoryInspection || []).find((r) => r.deviceId === deviceId);
  const bind = (recs.binding || []).find((r) => r.deviceId === deviceId);
  const hasException = (!!si && !isPass(si)) || (!!fi && !isPass(fi)) || (!!ca && !isPass(ca));
  if (hasException) return '存在异常';
  if (ca && isPass(ca)) return '已完成';
  if (si) return '现场执行中';
  if (fi) return '待上门';
  if (bind) return '待接单';
  return '待分派';
}

// 前置准备子工单业务状态 → 可操作状态。
const PRE_OP_STATUS = { 未开始: '待分派', 进行中: '现场执行中', 已完成: '已完成' };

// 当前阶段操作区：按交付流程 stepper 阶段派生待处理事项 / 下一步动作 / 相关入口（tab key + 标签）。
const STAGE_INFO = {
  计划创建: { todo: '完善交付计划信息并绑定设备', next: '设备绑定 / 分派设备部署子工单', tabs: [['deploy', '设备部署子工单']] },
  设备绑定: { todo: '完成设备绑定与点位预分配', next: '进入设备部署，分派工程师', tabs: [['deploy', '设备部署子工单']] },
  前置准备: { todo: '完成舱体进场及水电部署', next: '进入机器人 / 设备部署', tabs: [['pre', '前置准备子工单'], ['deploy', '设备部署子工单']] },
  设备部署: { todo: '完成设备部署 / 出厂检验并安排上门', next: '现场安装调试', tabs: [['deploy', '设备部署子工单'], ['exception', '异常记录']] },
  现场安装调试: { todo: '完成现场安装并提交验收', next: '客户验收', tabs: [['deploy', '设备部署子工单'], ['site', '现场安装调试'], ['exception', '异常记录']] },
  客户验收: { todo: '组织客户验收并回收验收单', next: '交付完成', tabs: [['accept', '客户验收'], ['exception', '异常记录']] },
  交付完成: { todo: '交付已完成，归档交付资料', next: '进入在线运营 / 售后追溯', tabs: [['accept', '客户验收']] },
};

// 前置准备子工单（占位合成，一条/计划）。字段随 ERP / 现场系统接入补齐。
function buildPreOrder(plan, recs) {
  const advanced = (recs.factoryInspection || []).length > 0 || ['出厂检验', '现场安装调试', '客户验收'].includes(plan.currentNode);
  const started = (recs.binding || []).length > 0;
  const status = advanced ? '已完成' : started ? '进行中' : '未开始';
  return {
    id: `PRE-${plan.id}`,
    kind: 'pre',
    name: '舱体进场及水电部署',
    planName: plan.name || plan.id,
    owner: plan.owner,
    status,
    opStatus: PRE_OP_STATUS[status] || '待分派',
    deviceSN: '整批 / —',
    planDate: plan.factoryDate || plan.siteInstallDate,
    actualDate: advanced ? (plan.siteInstallDate || null) : null,
  };
}

// 子工单「当前可执行操作」按可操作状态区分（不同状态展示不同操作集）。
const OPS_BY_STATUS = {
  待分派: ['dispatch', 'viewDetail'],
  待接单: ['accept', 'reassign', 'viewDetail'],
  待上门: ['visit', 'viewDetail'],
  现场执行中: ['progress', 'upload', 'recordException', 'complete', 'viewDetail'],
  存在异常: ['exProgress', 'submitCS', 'viewIssue', 'viewDetail'],
  已完成: ['viewDetail', 'viewDocs', 'viewLog'],
};

// 操作元数据：form=打开原型占位表单弹窗（确认写日志 + 轻提示）；special=提交技术客服预处理；to=跳转；否则纯轻提示。
const ACTION_META = {
  dispatch: { label: '分派工程师', form: true, hint: '已分派交付工程师' },
  reassign: { label: '改派工程师', form: true, hint: '已改派交付工程师' },
  accept: { label: '工程师接单', form: true, hint: '工程师已接单' },
  visit: { label: '记录上门 · 到场', form: true, hint: '已记录上门 · 到场' },
  progress: { label: '更新部署进度', form: true, hint: '已更新部署进度' },
  upload: { label: '上传资料', form: true, hint: '已上传交付资料' },
  recordException: { label: '记录交付异常', form: true, hint: '已记录交付异常，写入「异常记录」区' },
  complete: { label: '提交完成', form: true, hint: '已提交完成，等待客户验收' },
  exProgress: { label: '记录异常进展', form: true, hint: '已记录异常进展' },
  submitCS: { label: '提交技术客服预处理', special: true },
  viewIssue: { label: '查看关联问题', to: '/after-sales?tab=issues' },
  viewDetail: { label: '查看详情', hint: '子工单详情已在下方展示' },
  viewDocs: { label: '查看资料', hint: '见下方「交付资料」区' },
  viewLog: { label: '查看日志', hint: '见下方「操作日志」区' },
};

// 子工单当前可执行操作区（顶部状态栏下方）。
function SubOrderOps({ order, onAction, onSubmitPreprocess, backType }) {
  const keys = OPS_BY_STATUS[order.opStatus] || ['viewDetail'];
  return (
    <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">当前可执行操作 · 状态 <StatusBadge status={order.opStatus} /></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {keys.map((k) => {
          const meta = ACTION_META[k];
          if (meta.to) return <LinkAction key={k} to={meta.to}>{meta.label}</LinkAction>;
          if (meta.special) return <LinkAction key={k} onClick={() => onSubmitPreprocess(order)}>{meta.label}</LinkAction>;
          return <LinkAction key={k} onClick={() => onAction(k, order, backType)}>{meta.label}</LinkAction>;
        })}
      </div>
    </div>
  );
}

// 当前任务卡片映射：按可操作状态派生「当前待处理动作 / 下一步建议」。
const TASK_CARD_INFO = {
  待分派: { pending: '待分派工程师', next: '分派工程师后进入待接单' },
  待接单: { pending: '工程师待接单（可改派）', next: '接单后记录上门/到场' },
  待上门: { pending: '待记录上门 / 到场', next: '到场后进入现场执行' },
  现场执行中: { pending: '现场部署 / 调试执行中', next: '更新进度 / 上传资料，完成后提交完成' },
  存在异常: { pending: '存在交付异常，待处理', next: '记录异常进展；设备/质量问题提交技术客服预处理' },
  已完成: { pending: '子工单已完成', next: '查看资料与日志' },
};

// 当前任务卡片（顶部状态栏下方）：责任人 + 待处理动作 + 下一步建议 + 可执行操作。
function CurrentTaskCard({ order, onAction, onSubmitPreprocess, backType }) {
  const info = TASK_CARD_INFO[order.opStatus] || { pending: '—', next: '—' };
  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-gray-500">当前任务</span>
        <StatusBadge status={order.opStatus} />
        <span className="text-xs text-gray-500">当前责任人：</span>
        <span className="text-[13px] text-gray-800">{order.engineer || order.owner || '—'}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div><div className="text-xs text-gray-400 mb-1">当前待处理动作</div><div className="text-[13px] text-gray-800">{info.pending}</div></div>
        <div><div className="text-xs text-gray-400 mb-1">下一步建议</div><div className="text-[13px] text-gray-800">{info.next}</div></div>
      </div>
      <SubOrderOps order={order} onAction={onAction} onSubmitPreprocess={onSubmitPreprocess} backType={backType} />
    </div>
  );
}

// 子工单操作原型占位表单弹窗：填写备注 → 确认写操作日志 + 轻提示。
function ActionForm({ action, order, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  const meta = ACTION_META[action] || { label: '操作' };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2.5 text-xs text-gray-500">
        原型环境占位表单：<span className="font-medium text-gray-700">{meta.label}</span> · 子工单 <span className="font-mono">{order.id}</span>
        {order.deviceSN && order.deviceSN !== '整批 / —' ? <> · 设备 <span className="font-mono">{order.deviceSN}</span></> : null}
        。确认仅写入操作日志并轻提示，不触发真实业务流转。
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">备注 / 说明（可选）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={`填写「${meta.label}」备注（原型占位）`}
          className="w-full rounded-md border border-[#e0e0e0] px-2.5 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-[#a3a3a3]"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Btn variant="secondary" onClick={onCancel}>返回子工单详情</Btn>
        <Btn variant="primary" onClick={() => onConfirm(note)}>确认（原型占位）</Btn>
      </div>
    </div>
  );
}

// 子工单顶部状态栏（编号 / 类型 / 状态 / 计划 / 设备SN / 负责人 / 是否异常）。
function SubOrderHeader({ order, typeLabel, hasException }) {
  return (
    <div className="rounded-lg border border-[#ececec] bg-white px-4 py-3">
      <DescList
        cols={4}
        items={[
          ['子工单编号', <span className="font-mono text-xs">{order.id}</span>],
          ['子工单类型', <Chip tone="outline">{typeLabel}</Chip>],
          ['当前状态', <StatusBadge status={order.opStatus} />],
          ['所属交付计划', order.planName],
          ['关联设备 SN', order.deviceSN || '—'],
          ['工程师 · 负责人', order.engineer || order.owner || '—'],
          ['是否存在异常', hasException ? <StatusBadge status="存在异常" /> : '否'],
        ]}
      />
    </div>
  );
}

function PreOrderDetail({ order, onAction, onSubmitPreprocess }) {
  return (
    <div className="space-y-5">
      <SubOrderHeader order={order} typeLabel="前置准备" hasException={false} />
      <CurrentTaskCard order={order} onAction={onAction} onSubmitPreprocess={onSubmitPreprocess} backType="pre" />
      <div><div className="text-xs font-semibold text-gray-700 mb-2">子工单基础信息</div>
        <DescList
          cols={2}
          items={[
            ['子工单名称', order.name],
            ['所属交付计划', order.planName],
            ['负责人', order.owner],
            ['当前状态', <StatusBadge status={order.status} />],
            ['计划完成时间', order.planDate],
            ['实际完成时间', order.actualDate],
          ]}
        />
      </div>
      <div><div className="text-xs font-semibold text-gray-700 mb-2">执行记录 / 时间节点</div>
        <div className="text-xs text-gray-400">暂无前置准备执行记录（舱体进场 / 水电部署明细随现场系统接入补齐）</div>
      </div>
      <div className="text-xs text-gray-400">交付资料 / 异常记录 / 操作日志：原型占位，字段随 ERP / 现场系统接入补齐。</div>
    </div>
  );
}

function DeployOrderDetail({ order, exceptions = [], logs = [], issues = [], docs = [], onAction, onSubmitPreprocess }) {
  const o = order;
  const sn = o.deviceSN;
  const did = o.device?.id;
  const acceptBadge = o.acceptResult === 'Pass' || o.acceptResult === 'NG' ? <StatusBadge status={o.acceptResult} /> : '—';
  const exList = exceptions.filter((e) => exField(e, EX_KEYS.sn) === sn);
  const logList = logs.filter((l) => l.deviceId === did);
  const issueList = issues.filter((q) => q.deviceId === did || q.deviceSN === sn);
  const docList = docs.filter((m) => m.order === o.id || m.sn === sn);
  return (
    <div className="space-y-5">
      <SubOrderHeader order={o} typeLabel="设备部署" hasException={o.exception} />

      <CurrentTaskCard order={o} onAction={onAction} onSubmitPreprocess={onSubmitPreprocess} backType="deploy" />

      <div><div className="text-xs font-semibold text-gray-700 mb-2">子工单基础信息</div>
        <DescList
          cols={2}
          items={[
            ['所属交付计划', o.planName],
            ['关联设备 SN', <Link to={`/devices/${o.device.id}`} className="ui-link font-mono text-xs">{o.deviceSN}</Link>],
            ['负责人 / 工程师', o.engineer],
            ['现场点位', o.site],
            ['验收结果', acceptBadge],
            ['交付验收单图片', o.acceptVoucher],
          ]}
        />
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">时间节点</div>
        <DescList
          cols={2}
          items={[
            ['预计上门时间', o.etaVisit],
            ['分派时间', o.dispatchTime],
            ['接单时间', o.acceptTime],
            ['上门时间', o.visitTime],
          ]}
        />
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">执行记录</div>
        {o.exceptionNote && o.exceptionNote !== '—'
          ? <DescList cols={1} items={[['异常说明', o.exceptionNote]]} />
          : <div className="text-xs text-gray-400">暂无执行记录（现场执行明细随现场系统接入补齐）</div>}
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">交付资料</div>
        {docList.length
          ? <div className="flex flex-wrap gap-2">{docList.map((m) => <Chip key={m.name} tone="outline">{m.type} · {m.file}</Chip>)}</div>
          : <div className="text-xs text-gray-400">暂无关联交付资料</div>}
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">异常记录</div>
        {exList.length
          ? (
            <ul className="space-y-2">
              {exList.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-mono text-gray-600">{e.id}</span>
                  <Chip tone="outline">{exField(e, EX_KEYS.type) ?? '—'}</Chip>
                  <StatusBadge status={e.status} />
                  <span className="text-gray-500 truncate max-w-xs">{exField(e, EX_KEYS.desc) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )
          : <div className="text-xs text-gray-400">暂无交付异常</div>}
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">关联问题 / 售后工单</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {issueList.length
            ? issueList.map((q) => <LinkAction key={q.id} to="/after-sales?tab=issues"><span className="font-mono">{q.id}</span></LinkAction>)
            : <span className="text-gray-400">暂无关联问题池记录</span>}
          <span className="text-gray-200">·</span>
          {o.wo
            ? <LinkAction to="/after-sales?tab=orders"><span className="font-mono">{o.wo.id}</span></LinkAction>
            : <span className="text-gray-400">暂无关联售后工单</span>}
        </div>
        <div className={`mt-2 rounded-lg border px-3 py-2.5 text-xs ${o.wo || o.exception ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-gray-50 border-[#eee] text-gray-500'}`}>
          {o.wo
            ? <>已关联售后工单（只读追溯）。售后工单由问题池经技术客服预处理后生成，交付子工单不直接转售后。</>
            : o.exception
              ? <>存在交付异常。交付侧阻塞（物流 / 现场条件 / 水电 / 客户未准备 / 施工未完成）在本子工单内处理；设备 / 软件 / 使用 / 质量问题请「提交技术客服预处理」生成问题池记录，由技术客服预处理后再决定是否转售后。</>
              : '暂无交付异常。'}
        </div>
      </div>

      <div><div className="text-xs font-semibold text-gray-700 mb-2">操作日志</div>
        {logList.length ? <OperationLog logs={logList} /> : <div className="text-xs text-gray-400">暂无操作日志（按设备 SN 追溯）</div>}
      </div>
    </div>
  );
}

// 交付资料预览占位：按资料类型 / 文件名判定 图片 / 视频 / 文档，展示占位块（原型不加载真实文件）。
function docPreviewKind(m) {
  const f = (m.file || '').toLowerCase();
  if (m.type.includes('视频') || f.endsWith('.mp4') || f.endsWith('.mov')) return 'video';
  if (m.type.includes('照片') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')) return 'image';
  return 'doc';
}

function DocPreview({ kind, file }) {
  const conf = {
    image: { label: '图片预览', desc: '灰底图占位', icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></> },
    video: { label: '视频预览', desc: '视频播放占位', icon: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></> },
    doc: { label: '文档 / 单据预览', desc: 'PDF / 单据占位', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8" /></> },
  }[kind] || {};
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] h-48 text-gray-400">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{conf.icon}</svg>
      <div className="text-xs text-gray-500">{conf.label} · {file}</div>
      <div className="text-[11px] text-gray-300">原型环境 · {conf.desc}，不加载真实文件</div>
    </div>
  );
}

function DocDetail({ doc }) {
  return (
    <div className="space-y-4">
      <DescList
        cols={2}
        items={[
          ['资料名称', doc.name],
          ['资料类型', <Chip tone="outline">{doc.type}</Chip>],
          ['关联子工单', <span className="font-mono text-xs">{doc.order}</span>],
          ['关联设备 SN', <span className="font-mono text-xs">{doc.sn}</span>],
          ['上传人', doc.uploader],
          ['上传时间', doc.time],
          ['文件名', <span className="font-mono text-xs">{doc.file}</span>],
          ['备注', doc.note],
        ]}
      />
      <DocPreview kind={docPreviewKind(doc)} file={doc.file} />
    </div>
  );
}

export default function DeliveryPlanDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const plan = (state.deliveryPlans || []).find((p) => p.id === id);
  const deviceTypes = state.deviceTypes || [];
  const locations = state.locations || [];
  const typeName = (tid) => deviceTypes.find((t) => t.id === tid)?.name || '—';
  const locName = (lid) => locations.find((l) => l.id === lid)?.name || '—';

  const recs = plan?.records || {};
  const project = (state.projects || []).find((p) => p.id === plan?.projectId);
  // 前置准备子工单（舱体进场及水电部署）只适用智魔方；机场 / 工业场景 / 遥操数采不展示前置准备。
  const isZhimofang = project?.projectType === '智魔方';
  const templateName = plan?.templateName || (isZhimofang ? '智魔方交付流程模板' : '通用部署流程模板');
  const boundIds = plan ? getBoundDeviceIds(plan) : [];
  const preLocMap = Object.fromEntries((recs.binding || []).map((b) => [b.deviceId, b.preAssignedLocationId]));
  const boundDevices = boundIds
    .map((did) => (state.devices || []).find((d) => d.id === did))
    .filter(Boolean)
    .map((d) => ({ ...d, preAssignedLocationId: d.preAssignedLocationId || preLocMap[d.id] || null }));

  const acceptRecs = recs.customerAccept || [];
  const afterSales = plan ? (state.deliveryWorkOrders || []).filter((w) => w.deliveryPlanId === plan.id) : [];
  const relatedWO = plan ? (state.workOrders || []).filter((w) => boundIds.includes(w.deviceId)) : [];
  const allWO = [...afterSales, ...relatedWO];
  const planLogs = plan ? (state.operationLogs || []).filter((l) => l.deliveryPlanId === plan.id || boundIds.includes(l.deviceId)) : [];
  // 交付异常记录（并行任务补 state.deliveryExceptions）与该计划关联问题池记录。
  const deliveryExceptions = plan ? (state.deliveryExceptions || []).filter((e) => e.deliveryPlanId === plan.id) : [];
  const relatedIssues = plan ? (state.qualityIssues || []).filter((q) => q.deliveryPlanId === plan.id || boundIds.includes(q.deviceId)) : [];

  const preOrders = plan && isZhimofang ? [buildPreOrder(plan, recs)] : [];
  const deployOrders = boundDevices.map((d) => {
    const fi = (recs.factoryInspection || []).find((r) => r.deviceId === d.id);
    const si = (recs.siteInstall || []).find((r) => r.deviceId === d.id);
    const ca = (recs.customerAccept || []).find((r) => r.deviceId === d.id);
    const bind = (recs.binding || []).find((r) => r.deviceId === d.id);
    const wo = afterSales.find((w) => w.deviceId === d.id);
    const exception = (!!si && !isPass(si)) || (!!fi && !isPass(fi)) || (!!ca && !isPass(ca));
    return {
      id: `DEP-${plan?.id ?? 'NA'}-${d.id}`,
      planName: plan?.name || plan?.id,
      device: d,
      deviceSN: d.sn,
      engineer: si?.operator || plan?.owner || '—',
      etaVisit: plan?.siteInstallDate || '—',
      dispatchTime: bind?.time || '—',
      acceptTime: '—',
      visitTime: si?.time || '—',
      site: locName(si?.locationId || d.locationId || d.preAssignedLocationId),
      acceptResult: ca ? (isPass(ca) ? 'Pass' : 'NG') : '—',
      acceptVoucher: ca?.voucherDesc || '—',
      exceptionNote: (si && !isPass(si) && si.notes) || (fi && !isPass(fi) && fi.notes) || (ca && !isPass(ca) && ca.notes) || wo?.description || '—',
      status: deploymentStatus(recs, d.id),
      opStatus: deployOpStatus(recs, d.id),
      kind: 'deploy',
      wo,
      exception,
    };
  });

  const siteRecs = recs.siteInstall || [];
  const devPaged = usePaged(boundDevices, 8);
  const deployPaged = usePaged(deployOrders, 8);
  const acceptPaged = usePaged(acceptRecs, 8);
  const woPaged = usePaged(allWO, 8);
  const exPaged = usePaged(deliveryExceptions, 8);
  const issuePaged = usePaged(relatedIssues, 8);
  const sitePaged = usePaged(siteRecs, 8);

  // 提交技术客服预处理：生成问题池记录并带入来源快照（原型占位 + 轻提示）。转售后只发生在问题池详情。
  const submitPreprocess = (snap) => {
    dispatch({
      type: 'ADD_QUALITY_ISSUE',
      payload: {
        id: genId('QI'),
        deviceId: snap.deviceId || null,
        deviceSN: snap.deviceSN || '—',
        projectId: plan?.projectId || null,
        issueDesc: snap.desc || '交付环节提交技术客服预处理',
        faultL1: '待业务补充', faultL2: '待业务补充', faultL3: '待业务补充',
        status: '待预处理',
        source: '交付异常',
        sourceStage: snap.node || plan?.currentNode || '交付',
        issueType: snap.type || '设备质量问题',
        severity: snap.severity || '中',
        owner: state.currentUser, reporterName: state.currentUser, reportTime: nowText(),
        linkedWorkOrder: false,
        deliveryPlanId: plan?.id || null,
        sourceDeliveryOrderId: snap.orderId || null,
        sourceDeliveryExceptionId: snap.exceptionId || null,
        processLogs: [],
      },
    });
    alert('已生成问题池记录，带入来源快照（来源交付子工单 / 来源节点 / 关联设备SN / 异常描述），等待技术客服预处理。转售后工单只发生在问题池详情、由技术客服预处理后触发。');
    setDetail(null);
  };

  // 子工单「提交技术客服预处理」：带入来源快照（沿用上版语义，不直接转售后）。
  const submitPreprocessForOrder = (o) => submitPreprocess({
    deviceId: o.device?.id,
    deviceSN: o.deviceSN,
    node: '现场安装调试',
    desc: o.exceptionNote && o.exceptionNote !== '—' ? o.exceptionNote : `设备部署子工单 ${o.id} 提交技术客服预处理`,
    orderId: o.id,
  });

  // 子工单操作弹窗确认：写操作日志 + 轻提示（原型占位）。
  const runActionLog = (actionKey, o, note) => {
    const meta = ACTION_META[actionKey] || { label: '操作', hint: '已处理' };
    dispatch({
      type: 'ADD_OPERATION_LOG',
      payload: {
        id: genId('LOG'),
        deviceId: o.device?.id || null,
        deliveryPlanId: plan?.id || null,
        operator: state.currentUser,
        timestamp: nowText(),
        actionType: meta.label,
        fromStatus: o.opStatus,
        toStatus: o.opStatus,
        notes: note?.trim() ? note.trim() : `${meta.label}（原型占位，子工单 ${o.id}）`,
      },
    });
    alert(`原型环境：${meta.hint}，已写入操作日志。`);
  };

  // 子工单操作分发：form 类打开占位表单弹窗；轻提示类直接 alert。
  const handleOpAction = (actionKey, o, backType) => {
    const meta = ACTION_META[actionKey] || {};
    if (meta.form) { setDetail({ type: 'action', action: actionKey, order: o, back: backType }); return; }
    if (meta.hint) alert(`原型环境：${meta.hint}。`);
  };

  // 相关入口锚点：切换子工单快捷入口 tab 并滚动到 tab 区。
  const goTab = (key) => {
    setActiveTab(key);
    requestAnimationFrame(() => document.getElementById('sub-order-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (!plan) {
    return (
      <Page>
        <PageHeader title="交付计划详情" actions={<Btn as="link" to="/projects?tab=delivery" variant="secondary">返回交付计划</Btn>} />
        <EmptyState>未找到交付计划 {id}</EmptyState>
      </Page>
    );
  }

  const planStatus = deliveryPlanStatus(plan);
  const deliverySteps = deliveryStepDefs(isZhimofang);
  const deliveryCurrentStep = deliveryStepCurrent(plan, recs, planStatus, boundIds.length);
  const overdue = !!plan.dueDate && plan.dueDate < TODAY && !['未开始', '已验收', '已作废'].includes(planStatus);
  const acceptedPass = acceptRecs.filter(isPass).length;
  const deployedCount = (recs.siteInstall || []).filter(isPass).length; // 现场安装调试完成（Pass）
  const openWO = allWO.filter((w) => !['已关闭', '已作废', '已完成'].includes(w.status)).length;
  const targetCount = plan.targetCount ?? 0;

  // 交付资料 / 附件（原型占位样例）：现场照片 / 设备摆放 / 流程测试视频 / 培训与交付验收单 / 施工·水电确认材料等交付过程资料。
  // 注意：非 ERP 物料 / 发货物料，正式物料出库 / 领料 / 发货属 ERP 或线下协同，不在此。
  const firstSN = boundDevices[0]?.sn || '—';
  const lastSN = boundDevices[boundDevices.length - 1]?.sn || firstSN;
  const preOrderId = preOrders[0]?.id || '—';
  const deployOrderId = deployOrders[0]?.id || '—';
  const docUploader = plan.owner || '现场工程师';
  const siteDate = plan.siteInstallDate || plan.factoryDate || null;
  const deliveryDocs = [
    // 前置准备相关资料仅智魔方项目展示（不为非智魔方项目硬造前置准备数据）。
    ...(isZhimofang ? [
      { name: '现场进场环境照片', type: '现场照片', order: preOrderId, sn: '—', uploader: docUploader, time: siteDate ? `${siteDate} 09:20` : '—', file: 'site_env.jpg', note: '舱体进场前现场环境记录' },
      { name: '施工·水电确认材料', type: '施工·水电确认材料', order: preOrderId, sn: '—', uploader: docUploader, time: siteDate ? `${siteDate} 15:00` : '—', file: 'utility_check.pdf', note: '水电施工完成确认' },
    ] : []),
    { name: '设备摆放照片', type: '设备摆放照片', order: deployOrderId, sn: firstSN, uploader: docUploader, time: siteDate ? `${siteDate} 16:30` : '—', file: `layout_${firstSN}.jpg`, note: '按点位完成设备摆放' },
    { name: '工作流程测试视频', type: '工作流程测试视频', order: deployOrderId, sn: firstSN, uploader: docUploader, time: siteDate ? `${siteDate} 17:10` : '—', file: `workflow_${firstSN}.mp4`, note: '现场全流程联调录像' },
    { name: '交付验收单', type: '交付验收单图片', order: deployOrderId, sn: lastSN, uploader: '客户', time: plan.acceptanceDate ? `${plan.acceptanceDate} 15:00` : '—', file: `accept_${lastSN}.pdf`, note: '客户签署交付验收单' },
  ];

  const woTypeLabel = (w) => w.woClass || (w.type === 'delivery' ? '交付工单' : '售后工单');

  // 子工单快捷入口 tab（智魔方显示前置准备；机场 / 工业场景 / 遥操数采不显示）。
  const subTabs = [
    { key: 'all', label: '全部子工单' },
    ...(isZhimofang ? [{ key: 'pre', label: '前置准备子工单' }] : []),
    { key: 'deploy', label: '设备部署子工单' },
    { key: 'site', label: '现场安装调试' },
    { key: 'accept', label: '客户验收' },
    { key: 'exception', label: '异常记录' },
  ];
  const stageInfo = STAGE_INFO[deliveryCurrentStep] || STAGE_INFO['计划创建'];

  const preTableEl = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[13px] font-semibold text-gray-800">前置准备子工单 · 舱体进场及水电部署</h3>
        <Chip tone="outline">前置准备</Chip>
      </div>
      <Table head={['子工单编号', '子工单名称', '负责人', '计划完成时间', '当前状态', '操作']} empty="暂无前置准备子工单">
        {preOrders.map((o) => (
          <tr key={o.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{o.id}</td>
            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{o.name}</td>
            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{o.owner ?? '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{o.planDate ?? '—'}</td>
            <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
            <td className="px-3 py-2 whitespace-nowrap"><LinkAction onClick={() => setDetail({ type: 'pre', order: o })}>查看详情</LinkAction></td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const deployTableEl = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[13px] font-semibold text-gray-800">机器人 / 设备部署子工单</h3>
        <Chip tone="outline">设备部署</Chip>
      </div>
      <Table
        head={['子工单编号', '关联设备SN', '现场点位', '上门时间', '可操作状态', '验收结果', '关联售后工单', '操作']}
        empty="暂无设备部署子工单"
        footer={<Pagination page={deployPaged.page} total={deployPaged.total} totalPages={deployPaged.totalPages} onChange={deployPaged.setPage} />}
      >
        {deployPaged.pageItems.map((o) => (
          <tr key={o.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{o.id}</td>
            <td className="px-3 py-2 whitespace-nowrap"><Link to={`/devices/${o.device.id}`} className="ui-link font-mono text-xs">{o.deviceSN}</Link></td>
            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{o.site}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{o.visitTime}</td>
            <td className="px-3 py-2"><StatusBadge status={o.opStatus} /></td>
            <td className="px-3 py-2">{o.acceptResult === 'Pass' || o.acceptResult === 'NG' ? <StatusBadge status={o.acceptResult} /> : <span className="text-gray-400">—</span>}</td>
            <td className="px-3 py-2 whitespace-nowrap text-xs">{o.wo ? <LinkAction to="/after-sales?tab=orders">{o.wo.id}</LinkAction> : <span className="text-gray-300">—</span>}</td>
            <td className="px-3 py-2 whitespace-nowrap"><LinkAction onClick={() => setDetail({ type: 'deploy', order: o })}>查看详情</LinkAction></td>
          </tr>
        ))}
      </Table>
    </div>
  );

  const subOrderNote = (
    <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2.5 text-xs text-gray-500">
      交付子工单不直接转售后工单。交付侧阻塞（物流 / 现场条件 / 水电 / 客户未准备 / 施工未完成）在子工单内处理；设备 / 软件 / 使用 / 质量问题「提交技术客服预处理」生成
      <Link to="/after-sales?tab=issues" className="ui-link mx-1">问题池记录</Link>，由技术客服预处理后再触发转
      <Link to="/after-sales?tab=orders" className="ui-link mx-1">售后工单</Link>。
    </div>
  );

  const siteTableEl = (
    <Table
      head={['设备SN', '操作人', '点位', '调试时间', '结果', '说明']}
      empty="暂无现场安装调试记录"
      footer={<Pagination page={sitePaged.page} total={sitePaged.total} totalPages={sitePaged.totalPages} onChange={sitePaged.setPage} />}
    >
      {sitePaged.pageItems.map((r) => (
        <tr key={r.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">{r.deviceSN ?? r.deviceId}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.operator ?? '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{locName(r.locationId)}</td>
          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{r.time ?? '—'}</td>
          <td className="px-3 py-2"><StatusBadge status={isPass(r) ? 'Pass' : 'NG'} /></td>
          <td className="px-3 py-2 text-xs text-gray-500 max-w-xs"><div className="truncate">{r.notes || '—'}</div></td>
        </tr>
      ))}
    </Table>
  );

  const acceptTableEl = (
    <Table
      head={['设备SN', '操作人', '点位', '验收时间', '验收结果', '验收凭证']}
      empty="暂无验收记录"
      footer={<Pagination page={acceptPaged.page} total={acceptPaged.total} totalPages={acceptPaged.totalPages} onChange={acceptPaged.setPage} />}
    >
      {acceptPaged.pageItems.map((r) => (
        <tr key={r.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">{r.deviceSN ?? r.deviceId}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.operator ?? '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{locName(r.locationId)}</td>
          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{r.time ?? '—'}</td>
          <td className="px-3 py-2"><StatusBadge status={isPass(r) ? 'Pass' : 'NG'} /></td>
          <td className="px-3 py-2 text-xs text-gray-500">{r.voucherDesc ?? '—'}</td>
        </tr>
      ))}
    </Table>
  );

  const exceptionTableEl = (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2.5 text-xs text-gray-500">
        交付侧阻塞（物流 / 现场条件 / 水电 / 客户未准备 / 施工未完成）留在交付子工单内处理；设备 / 软件 / 使用 / 质量问题提交技术客服预处理，生成问题池记录。
      </div>
      <Table
        head={['异常编号', '来源交付子工单', '来源节点', '关联设备SN', '异常类型', '异常描述', '异常发生时间', '异常记录时间', '记录人', '当前处理状态', '是否提交技术客服', '提交技术客服时间', '关联问题编号', '关联售后工单号', '操作']}
        empty="暂无交付异常记录"
        footer={<Pagination page={exPaged.page} total={exPaged.total} totalPages={exPaged.totalPages} onChange={exPaged.setPage} />}
      >
        {exPaged.pageItems.map((e) => {
          const submittedAt = exField(e, EX_KEYS.submittedAt);
          const submitted = e.submittedToCS ?? e.submittedToSupport ?? e.submitted ?? (!!submittedAt || !!e.linkedIssueId);
          const canSubmit = !submitted && !['已转售后工单', '已关闭', '已远程解决'].includes(e.status);
          return (
            <tr key={e.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-700">{e.id}</td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-600">{exField(e, EX_KEYS.sourceOrder) ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{exField(e, EX_KEYS.node) ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-600">{exField(e, EX_KEYS.sn) ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><Chip tone="outline">{exField(e, EX_KEYS.type) ?? '—'}</Chip></td>
              <td className="px-3 py-2 text-xs text-gray-600 max-w-xs"><div className="truncate">{exField(e, EX_KEYS.desc) ?? '—'}</div></td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{exField(e, EX_KEYS.occurredAt) ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{exField(e, EX_KEYS.recordedAt) ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{exField(e, EX_KEYS.recorder) ?? '—'}</td>
              <td className="px-3 py-2"><StatusBadge status={e.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{submitted ? '是' : '否'}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{submittedAt ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">{e.linkedIssueId ? <LinkAction to="/after-sales?tab=issues">{e.linkedIssueId}</LinkAction> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">{e.linkedWorkOrderId ? <LinkAction to="/after-sales?tab=orders">{e.linkedWorkOrderId}</LinkAction> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <LinkAction onClick={() => setDetail({ type: 'ex', ex: e })}>查看详情</LinkAction>
                  {canSubmit && <LinkAction onClick={() => submitPreprocess({ deviceId: e.deviceId, deviceSN: exField(e, EX_KEYS.sn), node: exField(e, EX_KEYS.node), desc: exField(e, EX_KEYS.desc), type: exField(e, EX_KEYS.type), exceptionId: e.id })}>提交技术客服预处理</LinkAction>}
                  {e.linkedIssueId && <LinkAction to="/after-sales?tab=issues">查看关联问题</LinkAction>}
                  {e.linkedWorkOrderId && <LinkAction to="/after-sales?tab=orders">查看关联售后工单</LinkAction>}
                  {e.status !== '已关闭' && <LinkAction onClick={() => alert('原型环境：关闭异常（写入状态「已关闭」）')}>关闭异常</LinkAction>}
                  <LinkAction onClick={() => setDetail({ type: 'exlog', ex: e })}>查看日志</LinkAction>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );

  return (
    <Page>
      <PageHeader
        breadcrumb={(
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <Link to="/projects?tab=delivery" className="hover:text-gray-700">交付计划</Link>
            <span>/</span>
            <span className="text-gray-600">{plan.name ?? plan.id}</span>
          </div>
        )}
        title={<span className="inline-flex items-center gap-3">{plan.name ?? plan.id}<StatusBadge status={planStatus} size="md" /></span>}
        description={`交付批次 ${plan.batchNo ?? plan.name ?? plan.id}。围绕设备 SN 记录交付全过程，交付异常转售后为流程分支，非独立菜单。`}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn size="sm" variant="secondary" onClick={() => alert('请在 ERP 中维护服务交付单，平台在此选择已同步的 ERP 服务交付建立关联并补充交付执行记录。')}>选择 ERP 服务交付</Btn>
            <Btn size="sm" as="link" to="/erp-center?tab=outbound" variant="secondary">查看 ERP 源单据</Btn>
            <Btn size="sm" variant="secondary" onClick={() => document.getElementById('platform-delivery-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>补充平台交付记录</Btn>
            <Btn size="sm" variant="secondary" onClick={() => goTab('exception')}>记录交付异常</Btn>
            <Btn size="sm" variant="secondary" onClick={() => document.getElementById('related-issues')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看关联问题</Btn>
            <Btn size="sm" variant="secondary" onClick={() => document.getElementById('related-workorders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看关联售后工单</Btn>
            <Btn size="sm" as="link" to="/projects?tab=delivery" variant="secondary">返回交付计划</Btn>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip>当前阶段 · {deliveryCurrentStep}</Chip>
        {overdue && <StatusBadge status="超期" />}
      </div>

      <StatGrid cols={4}>
        <StatCard label="交付设备数" value={boundDevices.length} hint="已关联/已绑定，非已部署或验收" />
        <StatCard label="已部署设备数" value={deployedCount} hint="现场安装调试完成（Pass）" />
        <StatCard label="验收通过设备数" value={acceptedPass} tone="success" hint="客户验收通过（Pass）" />
        <StatCard label="未结售后工单数" value={openWO} tone={openWO ? 'warning' : 'default'} hint="关联未关闭交付/售后工单" />
      </StatGrid>

      <Section
        title="ERP 服务交付信息（ERP 只读同步）"
        subtitle="以下字段来自 ERP 服务交付单，平台只读同步展示，不创建、不编辑 ERP 单据（无对应字段时显示 —）。"
        right={<Chip>ERP 只读同步</Chip>}
      >
        <DescList
          cols={3}
          items={[
            ['ERP 销售出库单号', plan.erpOutboundNo],
            ['ERP 验收单号', plan.erpAcceptanceNo],
            ['同步口径', '只读同步'],
          ]}
        />
        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-[#f2f2f2]">ERP 服务交付记录合同、客户、订单、结算等源信息；平台补充现场部署、设备绑定、异常和售后关联。</p>
      </Section>

      <div id="platform-delivery-records" className="pt-1">
        <h2 className="text-sm font-semibold text-gray-800">平台交付执行记录</h2>
        <p className="text-xs text-gray-400 mt-0.5">ERP 服务交付单之外，平台补充的交付执行记录：交付流程 / 阶段操作 / 子工单（前置准备 · 设备部署）/ 设备 / 资料 / 异常 / 关联问题 / 关联售后 / 操作日志。</p>
      </div>

      <Section
        title="交付流程进度"
        subtitle={`按项目类型（${project?.projectType || (isZhimofang ? '智魔方' : '通用')}）展示交付流程节点，含设备绑定。当前阶段：${deliveryCurrentStep}`}
      >
        <Stepper steps={deliverySteps} current={deliveryCurrentStep} />
      </Section>

      <Section title="当前阶段操作区" subtitle="按当前交付流程阶段派生当前待处理事项、下一步动作与相关入口">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3">
            <div><div className="text-xs text-gray-400 mb-1">当前阶段</div><Chip tone="solid">{deliveryCurrentStep}</Chip></div>
            <div><div className="text-xs text-gray-400 mb-1">当前负责人</div><div className="text-[13px] text-gray-800">{plan.owner || '—'}</div></div>
            <div className="lg:col-span-2"><div className="text-xs text-gray-400 mb-1">当前待处理事项</div><div className="text-[13px] text-gray-800">{stageInfo.todo}</div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <div><div className="text-xs text-gray-400 mb-1">下一步动作</div><div className="text-[13px] text-gray-800">{stageInfo.next}</div></div>
            <div>
              <div className="text-xs text-gray-400 mb-1">相关入口</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {stageInfo.tabs.filter(([k]) => k !== 'pre' || isZhimofang).map(([k, label]) => <LinkAction key={k} onClick={() => goTab(k)}>{label}</LinkAction>)}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div id="sub-order-tabs">
        <Section title="子工单快捷入口" subtitle="子工单 / 阶段 / 异常快捷入口，选中切换下方内容区（子工单入口置于详情上半部分）" bodyClassName="p-0">
          <div className="flex flex-wrap gap-1 px-3 pt-3">
            {subTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-[13px] rounded-t-md border-b-2 -mb-px transition-colors ${activeTab === t.key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >{t.label}</button>
            ))}
          </div>
          <div className="border-t border-[#f0f0f0] p-4 space-y-6">
            {activeTab === 'all' && (
              <>
                {isZhimofang && preTableEl}
                {deployTableEl}
                {subOrderNote}
              </>
            )}
            {activeTab === 'pre' && isZhimofang && preTableEl}
            {activeTab === 'deploy' && (<>{deployTableEl}{subOrderNote}</>)}
            {activeTab === 'site' && siteTableEl}
            {activeTab === 'accept' && acceptTableEl}
            {activeTab === 'exception' && exceptionTableEl}
          </div>
        </Section>
      </div>

      <Section title="交付基础信息（平台补充）" subtitle="平台补充的交付计划信息（负责人 / 计划节点 / 设备数等）；ERP 正式服务交付字段见上方「ERP 服务交付信息」。">
        <DescList
          cols={3}
          items={[
            ['交付计划编号', plan.id],
            ['交付批次', plan.batchNo],
            ['所属项目', project ? <Link to={`/projects/${project.id}`} className="ui-link">{project.name}</Link> : '—'],
            ['当前项目类型', project?.projectType ? <Chip>{project.projectType}</Chip> : '—'],
            ['使用流程模板', templateName],
            ['负责人', plan.owner],
            ['计划交付数', targetCount ? `${targetCount} 台` : '—'],
            ['交付设备数（已关联）', `${boundDevices.length} 台`],
            ['当前阶段', deliveryCurrentStep],
            ['计划出厂', plan.factoryDate],
            ['计划现场安装调试', plan.siteInstallDate],
            ['计划验收', plan.acceptanceDate ?? plan.dueDate],
            ['是否超期', overdue ? '是' : '否'],
          ]}
        />
      </Section>

      <Section title="设备列表" subtitle={`本交付计划交付设备 ${boundDevices.length} 台（已关联/已绑定）`} bodyClassName="p-0">
        <Table
          head={['设备SN', '机器人型号', '当前状态', '现场点位', '更新时间']}
          empty="暂无交付设备（未关联设备）"
          footer={<Pagination page={devPaged.page} total={devPaged.total} totalPages={devPaged.totalPages} onChange={devPaged.setPage} />}
        >
          {devPaged.pageItems.map((d) => (
            <tr key={d.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 whitespace-nowrap"><Link to={`/devices/${d.id}`} className="ui-link font-mono text-xs">{d.sn}</Link></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{typeName(d.deviceTypeId)}</td>
              <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{locName(d.locationId || d.preAssignedLocationId)}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{d.updatedAt ?? '—'}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="交付资料 / 附件" subtitle="现场照片 / 设备摆放 / 流程测试视频 / 培训与交付验收单 / 施工·水电确认材料等交付过程资料（原型占位样例，随现场系统 / 附件库接入补齐）。非 ERP 物料 / 发货物料。" bodyClassName="p-0">
        <Table head={['资料名称', '资料类型', '关联子工单', '关联设备SN', '上传人', '上传时间', '文件/图片/视频', '备注', '操作']} empty="暂无交付资料">
          {deliveryDocs.map((m) => (
            <tr key={m.name} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{m.name}</td>
              <td className="px-3 py-2 whitespace-nowrap"><Chip tone="outline">{m.type}</Chip></td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{m.order}</td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{m.sn}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{m.uploader}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{m.time}</td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{m.file}</td>
              <td className="px-3 py-2 text-xs text-gray-500 max-w-xs"><div className="truncate">{m.note}</div></td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <LinkAction onClick={() => setDetail({ type: 'doc', doc: m })}>查看</LinkAction>
                  <LinkAction onClick={() => setDetail({ type: 'doc', doc: m })}>预览</LinkAction>
                  <LinkAction onClick={() => alert(`原型环境，模拟下载 ${m.file}`)}>下载</LinkAction>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <div id="related-issues">
      <Section title="关联问题池记录" subtitle="该交付计划关联设备产生的问题池记录（qualityIssues）。设备 / 软件 / 使用 / 质量问题经技术客服预处理后决定是否转售后。" bodyClassName="p-0">
        <Table
          head={['问题编号', '关联设备SN', '问题描述', '来源节点', '问题类型', '严重程度', '状态', '关联售后工单', '操作']}
          empty="暂无关联问题池记录"
          footer={<Pagination page={issuePaged.page} total={issuePaged.total} totalPages={issuePaged.totalPages} onChange={issuePaged.setPage} />}
        >
          {issuePaged.pageItems.map((q) => (
            <tr key={q.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 whitespace-nowrap"><LinkAction to="/after-sales?tab=issues"><span className="font-mono text-xs">{q.id}</span></LinkAction></td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-600">{q.deviceSN ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600 max-w-sm"><div className="truncate">{q.issueDesc ?? '—'}</div></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{q.sourceStage ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={q.issueType ?? '—'} /></td>
              <td className="px-3 py-2"><StatusBadge status={q.severity ?? '—'} /></td>
              <td className="px-3 py-2"><StatusBadge status={q.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">{q.linkedWorkOrderId ? <LinkAction to="/after-sales?tab=orders">{q.linkedWorkOrderId}</LinkAction> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap"><LinkAction to="/after-sales?tab=issues">查看</LinkAction></td>
            </tr>
          ))}
        </Table>
      </Section>
      </div>

      <div id="related-workorders">
      <Section title="关联售后工单" subtitle="交付子工单产生的售后 / 交付工单（deliveryWorkOrders + 关联 workOrders）" bodyClassName="p-0">
        <Table
          head={['工单编号', '类型', '设备SN', '问题描述', '严重程度', '负责人', '状态', '操作']}
          empty="暂无关联售后工单"
          footer={<Pagination page={woPaged.page} total={woPaged.total} totalPages={woPaged.totalPages} onChange={woPaged.setPage} />}
        >
          {woPaged.pageItems.map((w) => (
            <tr key={w.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-700">{w.id}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600 text-xs">{woTypeLabel(w)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{w.deviceSN ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600 max-w-sm"><div className="truncate">{w.description ?? '—'}</div></td>
              <td className="px-3 py-2"><StatusBadge status={w.severity ?? '—'} /></td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{w.assignedTo || '待指派'}</td>
              <td className="px-3 py-2"><StatusBadge status={w.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap"><LinkAction to="/after-sales?tab=orders">查看</LinkAction></td>
            </tr>
          ))}
        </Table>
      </Section>
      </div>

      <Section title="操作日志" subtitle={`共 ${planLogs.length} 条`}>
        {planLogs.length ? <OperationLog logs={planLogs} /> : <EmptyState>暂无操作日志</EmptyState>}
      </Section>

      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={
          detail?.type === 'pre' ? '前置准备子工单详情'
            : detail?.type === 'doc' ? '交付资料 / 附件详情'
              : detail?.type === 'ex' ? '交付异常详情'
                : detail?.type === 'exlog' ? '交付异常处理日志'
                  : detail?.type === 'action' ? (ACTION_META[detail.action]?.label || '子工单操作')
                    : '设备部署子工单详情'
        }
        size={detail?.type === 'ex' ? 'xl' : detail?.type === 'deploy' ? 'xl' : detail?.type === 'action' ? 'md' : 'lg'}
      >
        {detail?.type === 'pre' && (
          <PreOrderDetail order={detail.order} onAction={handleOpAction} onSubmitPreprocess={submitPreprocessForOrder} />
        )}
        {detail?.type === 'deploy' && (
          <DeployOrderDetail
            order={detail.order}
            exceptions={deliveryExceptions}
            logs={planLogs}
            issues={relatedIssues}
            docs={deliveryDocs}
            onAction={handleOpAction}
            onSubmitPreprocess={submitPreprocessForOrder}
          />
        )}
        {detail?.type === 'action' && (
          <ActionForm
            action={detail.action}
            order={detail.order}
            onCancel={() => setDetail({ type: detail.back, order: detail.order })}
            onConfirm={(note) => { runActionLog(detail.action, detail.order, note); setDetail({ type: detail.back, order: detail.order }); }}
          />
        )}
        {detail?.type === 'doc' && <DocDetail doc={detail.doc} />}
        {detail?.type === 'ex' && <ExceptionDetail ex={detail.ex} />}
        {detail?.type === 'exlog' && <ExProcessLogs logs={detail.ex.processLogs || detail.ex.logs || []} />}
      </Modal>
    </Page>
  );
}
