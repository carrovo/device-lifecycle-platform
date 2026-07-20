// ERP 单据中心（只读 ERP 源单据数据池）
// ERP 为单据唯一真实来源；平台只做同步 / 关联 / 跳转，绝不新增、编辑、删除、作废 ERP 单据。
// 页面结构：固定顶部（同步摘要 + 流程说明 + 页内 Tab） + 6 个内部 Tab（从 URL ?tab= 读取）。
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { erpDocs, ERP_DOC_META, erpSyncSummary, erpDocTotals } from '../data/erpDocs';
import { erpSyncLogs } from '../data/mockData';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Section, Card, SearchInput, Btn, LinkAction,
  Chip, StatCard, StatGrid, DescList, Table,
} from '../components/ui';

/* ─────────── 常量配置 ─────────── */
// 页内 Tab（与左侧二级菜单一致）。
const TABS = [
  { key: 'overview', label: '单据总览' },
  { key: 'purchase', label: '采购与入库' },
  { key: 'production', label: '生产与用料' },
  { key: 'outbound', label: '出库与交付' },
  { key: 'inspection', label: '检验与库存' },
  { key: 'synclog', label: '同步日志' },
];

const GROUP_KEYS = ['purchase', 'production', 'outbound', 'inspection'];
const GROUP_LABELS = {
  purchase: '采购与入库',
  production: '生产与用料',
  outbound: '出库与交付',
  inspection: '检验与库存',
};

// 每种单据在列表中展示的 2-3 个类型关键字段（取自 record.fields 的真实 ERP 字段名）。
// 通用列（单据编号 / 单据日期 / 单据状态）与平台关联状态、操作列由 DocTypeSection 统一补齐。
const TYPE_FIELDS = {
  purchaseOrder: ['物料名称', '采购数量', '供货供应商'],
  arrival: ['物料名称', '到货数量', '供货供应商'],
  purchaseInbound: ['物料名称', '数量', '供应商'],
  productionOrder: ['物料名称', '生产数量', '项目名称'],
  orderBom: ['母件名称', '子件名称', '数量'],
  lrpPlan: ['物料名称', '投入计划量', '客户名称'],
  materialOutbound: ['物料名称', '数量', '交易类型'],
  outboundRequest: ['物料名称', '数量', '申请部门'],
  productInbound: ['物料名称', '数量', '仓库'],
  productInspection: ['物料名称', '检验数量', '检验结果'],
  salesOutbound: ['物料名称', '客户', '数量'],
  serviceDelivery: ['项目名称', '客户', '含税结算额'],
};

// 全站统一提示文案（原型仅模拟，不写回 ERP）。
const SYNC_TOAST = '本原型仅模拟 ERP 数据同步，真实同步依赖 ERP 系统。';
const READONLY_NOTE = 'ERP 数据只读展示。平台仅建立关联关系和补充过程记录，不修改 ERP 源单据和库存主账。';
const FLOW_STEPS = ['ERP 源单据同步', '平台识别单据类型', '建立平台关联', '业务页面补充过程记录', '看板汇总分析'];

/* ─────────── 工具 ─────────── */
const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const countBy = (records, status) => records.filter((r) => r.link.status === status).length;

// 同步结果彩色文本：成功=绿 / 部分成功=橙 / 失败=红。
function SyncResultText({ result }) {
  const cls = result === '成功'
    ? 'text-green-600'
    : result === '部分成功'
      ? 'text-amber-600'
      : 'text-red-600';
  return <span className={`font-medium ${cls}`}>{result}</span>;
}

/* ─────────── 固定顶部：同步摘要卡片（item 八） ─────────── */
function SyncSummaryCard() {
  return (
    <Card>
      <DescList
        cols={3}
        items={[
          ['最近同步时间', <span className="font-mono text-xs text-gray-700">{erpSyncSummary.lastSyncTime}</span>],
          ['同步来源', erpSyncSummary.source],
          ['同步方式', <StatusBadge status={erpSyncSummary.mode} />],
          ['本次新增条数', <span className="font-medium text-gray-900">{erpSyncSummary.added}</span>],
          ['本次更新条数', <span className="font-medium text-gray-900">{erpSyncSummary.updated}</span>],
          ['本次失联条数', <span className={`font-medium ${erpSyncSummary.lost > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{erpSyncSummary.lost}</span>],
        ]}
      />
    </Card>
  );
}

/* ─────────── 固定顶部：流程说明（item 九） ─────────── */
function FlowNote() {
  return (
    <Card className="bg-[#fafafa]">
      <div className="flex flex-wrap items-center gap-2">
        {FLOW_STEPS.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-2">
            <Chip>{s}</Chip>
            {i < FLOW_STEPS.length - 1 && <span className="text-gray-300">→</span>}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2.5">
        ERP 单据中心只展示源数据和同步状态；具体生产、交付、售后过程记录在对应业务模块中补充。
      </p>
    </Card>
  );
}

/* ─────────── 固定顶部：页内 Tab 条（Link 切换 ?tab=） ─────────── */
function TabBar({ activeTab }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#ececec] overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={`/erp-center?tab=${t.key}`}
          className={`px-3 h-9 inline-flex items-center text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            activeTab === t.key
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ─────────── Tab：单据总览 ─────────── */
function OverviewTab({ onGoGroup }) {
  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard label="ERP 源单据总数" value={erpDocTotals.total} />
        <StatCard label="已关联单据数" value={erpDocTotals.linked} tone="success" />
        <StatCard label="未关联单据数" value={erpDocTotals.unlinked} />
        <StatCard label="已失联单据数" value={erpDocTotals.lost} tone="warning" />
      </StatGrid>

      <Section
        title="按单据类型汇总"
        subtitle="覆盖 12 种 ERP 源单据类型的条数与平台关联分布（只读同步）。"
        bodyClassName="p-0"
      >
        <Table head={['单据类型', '条数', '已关联', '未关联', '已失联', '操作']} empty="暂无单据">
          {ERP_DOC_META.map((meta) => {
            const records = erpDocs[meta.key] || [];
            const lost = countBy(records, '已失联');
            return (
              <tr key={meta.key} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={meta.label} /></td>
                <td className="px-3 py-2 text-gray-800 font-medium">{records.length}</td>
                <td className="px-3 py-2 text-gray-600">{countBy(records, '已关联')}</td>
                <td className="px-3 py-2 text-gray-600">{countBy(records, '未关联')}</td>
                <td className="px-3 py-2">{lost > 0 ? <span className="text-amber-600 font-medium">{lost}</span> : <span className="text-gray-300">0</span>}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  <LinkAction onClick={() => onGoGroup(meta.group)}>查看</LinkAction>
                </td>
              </tr>
            );
          })}
        </Table>
      </Section>
    </div>
  );
}

/* ─────────── 单个单据类型分区（含 ERP 原始字段区 + 平台关联状态区 + 只读操作） ─────────── */
function DocTypeSection({ meta, onToast, onViewDetail, onGotoSyncLog }) {
  const [q, setQ] = useState('');
  const all = erpDocs[meta.key] || [];
  const query = q.trim().toLowerCase();
  const filtered = query
    ? all.filter((r) => `${r.docNo} ${Object.values(r.fields).join(' ')}`.toLowerCase().includes(query))
    : all;
  const paged = usePaged(filtered, 8);
  const typeFields = TYPE_FIELDS[meta.key] || [];

  // 表头：ERP 原始字段区 | 平台关联状态区（视觉区隔） | 操作
  const head = [
    '单据编号', '单据日期', '单据状态', ...typeFields,
    <span key="linkcol" className="text-slate-500">平台关联状态</span>,
    '操作',
  ];

  return (
    <Section
      title={
        <span className="inline-flex items-center gap-2">
          <StatusBadge status={meta.label} />
          <span className="text-xs text-gray-400 font-normal">{filtered.length} 条</span>
        </span>
      }
      bodyClassName="p-0"
      right={<SearchInput className="w-52" placeholder="搜索单据号 / 字段" value={q} onChange={(e) => setQ(e.target.value)} />}
    >
      <Table
        head={head}
        empty="暂无同步单据"
        footer={filtered.length > 8 ? <Pagination page={paged.page} total={paged.total} totalPages={paged.totalPages} onChange={paged.setPage} /> : null}
      >
        {paged.pageItems.map((r) => (
          <tr key={r.id} className="hover:bg-[#fafafa]">
            {/* ERP 原始字段区 */}
            <td className="px-3 py-2 whitespace-nowrap"><span className="font-mono text-xs text-gray-700">{r.docNo}</span></td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{fmt(r.docDate)}</td>
            <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={r.docStatus} /></td>
            {typeFields.map((f) => (
              <td key={f} className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmt(r.fields[f])}</td>
            ))}
            {/* 平台关联状态区（左侧细分隔 + 浅底，与 ERP 原始字段区区隔） */}
            <td className="px-3 py-2 whitespace-nowrap border-l border-[#eee] bg-[#fcfcfd]"><StatusBadge status={r.link.status} /></td>
            {/* 操作：仅只读动作 */}
            <td className="px-3 py-2 text-xs whitespace-nowrap">
              <div className="flex items-center gap-x-3">
                <LinkAction onClick={() => onViewDetail(r, meta)}>查看详情</LinkAction>
                <LinkAction onClick={() => onToast(`原型环境：跳转 ERP 系统查看单据 ${r.docNo}`)}>跳转 ERP</LinkAction>
                <LinkAction onClick={onGotoSyncLog}>查看同步日志</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ─────────── Tab：采购 / 生产 / 出库 / 检验（按 group 渲染各单据类型分区） ─────────── */
function GroupTab({ group, onToast, onViewDetail, onGotoSyncLog }) {
  const metas = ERP_DOC_META.filter((m) => m.group === group);
  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-500">
        「{GROUP_LABELS[group]}」下各 ERP 单据类型分区展示：左侧为 ERP 原始字段（只读同步），右侧「平台关联状态」为平台侧建立的关联，二者相互独立。平台不修改任何 ERP 源单据。
      </div>
      {metas.map((meta) => (
        <DocTypeSection
          key={meta.key}
          meta={meta}
          onToast={onToast}
          onViewDetail={onViewDetail}
          onGotoSyncLog={onGotoSyncLog}
        />
      ))}
    </div>
  );
}

/* ─────────── Tab：同步日志 ─────────── */
function SyncLogTab() {
  return (
    <Section
      title="ERP 同步日志"
      subtitle="记录每次同步的对象、结果与异常说明，全只读。"
      bodyClassName="p-0"
    >
      <Table
        head={['同步时间', '同步对象', '同步类型', '同步结果', '成功条数', '失败条数', '异常说明', '操作人·系统任务']}
        empty="暂无同步日志"
      >
        {erpSyncLogs.map((log) => (
          <tr key={log.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap font-mono">{log.time}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{log.object}</td>
            <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{log.syncType}</td>
            <td className="px-3 py-2 whitespace-nowrap"><SyncResultText result={log.result} /></td>
            <td className="px-3 py-2 text-gray-700">{log.successCount}</td>
            <td className="px-3 py-2">{log.failCount > 0 ? <span className="text-red-600 font-medium">{log.failCount}</span> : <span className="text-gray-300">0</span>}</td>
            <td className="px-3 py-2 text-gray-500 text-xs max-w-xs"><span className="block truncate" title={log.exception}>{log.exception || '—'}</span></td>
            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{log.operator}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ─────────── 详情抽屉（4 段：ERP 原始字段 / 平台关联信息 / 同步信息 / 只读说明） ─────────── */
function DrawerBlock({ title, children }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-gray-800 mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function DetailDrawer({ record, meta, onClose }) {
  const { fields, link, sync } = record;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ececec]">
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status={meta.label} />
            <span className="font-mono text-xs text-gray-500 truncate">{record.docNo}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none flex-shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* 1. ERP 原始字段 */}
          <DrawerBlock title="ERP 原始字段">
            <DescList
              cols={2}
              items={[
                ['单据编号', <span className="font-mono text-xs">{record.docNo}</span>],
                ['单据状态', <StatusBadge status={record.docStatus} />],
                ...Object.entries(fields).map(([k, v]) => [k, fmt(v)]),
              ]}
            />
          </DrawerBlock>

          {/* 2. 平台关联信息 */}
          <DrawerBlock title="平台关联信息">
            <DescList
              cols={2}
              items={[
                ['平台关联状态', <StatusBadge status={link.status} />],
                ['关联平台对象类型', fmt(link.objType)],
                ['关联平台对象编号', fmt(link.objId)],
                ['关联项目', fmt(link.project)],
                ['关联设备 SN', fmt(link.deviceSN)],
                ['最近关联时间', fmt(link.lastLinkTime)],
                ['关联人', fmt(link.linkedBy)],
              ]}
            />
          </DrawerBlock>

          {/* 3. 同步信息 */}
          <DrawerBlock title="同步信息">
            <DescList
              cols={2}
              items={[
                ['最近同步时间', <span className="font-mono text-xs">{sync.lastSyncTime}</span>],
                ['同步方式', <StatusBadge status={sync.mode} />],
                ['本次同步结果', <SyncResultText result={sync.result} />],
                ['源记录是否存在', sync.sourceExists ? '是' : '否'],
                ['失联原因', sync.lostReason || '—'],
              ]}
            />
          </DrawerBlock>

          {/* 4. 只读说明 */}
          <DrawerBlock title="只读说明">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-500 leading-relaxed">
              {READONLY_NOTE}
            </div>
          </DrawerBlock>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 主页面 ─────────── */
export default function ErpCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';
  const activeTab = TABS.some((t) => t.key === tab) ? tab : 'overview';

  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState(null); // { record, meta }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  const goTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  return (
    <Page>
      <PageHeader
        title="ERP 单据中心"
        description="ERP 正式单据的只读同步数据池。平台不新增、不编辑、不删除 ERP 单据，只建立平台关联和同步状态。"
        actions={
          <>
            <Btn variant="secondary" onClick={() => showToast(SYNC_TOAST)}>手动同步</Btn>
            <Btn variant="secondary" onClick={() => goTab('synclog')}>查看同步日志</Btn>
          </>
        }
      />

      <SyncSummaryCard />
      <FlowNote />
      <TabBar activeTab={activeTab} />

      {activeTab === 'overview' && <OverviewTab onGoGroup={goTab} />}
      {GROUP_KEYS.includes(activeTab) && (
        <GroupTab
          group={activeTab}
          onToast={showToast}
          onViewDetail={(record, meta) => setDetail({ record, meta })}
          onGotoSyncLog={() => goTab('synclog')}
        />
      )}
      {activeTab === 'synclog' && <SyncLogTab />}

      {detail && <DetailDrawer record={detail.record} meta={detail.meta} onClose={() => setDetail(null)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white text-[13px] px-4 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </Page>
  );
}
