import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { erpDocs } from '../data/erpDocs';
import { TRANSFER_RECORDS } from '../data/erpPrototype';
import Modal from '../components/Modal';
import { Pagination, usePaged } from '../components/Pagination';
import {
  Page, PageHeader, Section, Toolbar, SearchInput, Input, Table, LinkAction, Chip, DescList,
} from '../components/ui';

const TYPES = [
  {
    key: 'arrival', label: '采购到货单', stage: '整机 SN 形成前',
    columns: [['供货供应商', '供货供应商'], ['物料名称', '物料名称'], ['到货数量', '到货数量']],
    filters: [['供应商', '供货供应商']],
  },
  {
    key: 'productInspection', label: '来料检验单', stage: '整机 SN 形成前',
    columns: [['物料名称', '物料名称'], ['检验数量', '检验数量'], ['检验结果', '检验结果']],
    filters: [['产品 / 物料', '物料名称']],
  },
  {
    key: 'purchaseInbound', label: '采购入库单', stage: '整机 SN 形成前',
    columns: [['供应商', '供应商'], ['物料名称', '物料名称'], ['数量', '数量']],
    filters: [['供应商', '供应商'], ['产品 / 物料', '物料名称']],
  },
  {
    key: 'productionOrder', label: '生产订单', stage: '整机 SN 形成前',
    columns: [['工厂', '工厂'], ['物料名称', '物料名称'], ['生产数量', '生产数量']],
    filters: [['产品 / 物料', '物料名称']],
  },
  {
    key: 'materialOutbound', label: '材料出库单', stage: '整机 SN 形成前',
    columns: [['仓库', '仓库'], ['物料名称', '物料名称'], ['数量', '数量']],
    filters: [['仓库', '仓库'], ['产品 / 物料', '物料名称']],
  },
  {
    key: 'productInbound', label: '产品入库单', stage: '可与单台设备建立匹配',
    columns: [['序列号', '序列号'], ['批次号', '批次号'], ['设备匹配', '_match']],
    filters: [['ERP 序列号', '序列号'], ['ERP 批次号', '批次号'], ['设备 SN', '_deviceSN']],
  },
  {
    key: 'salesOutbound', label: '销售发货单', stage: '整机 SN 形成后，设备关联口径待确认',
    columns: [['客户', '客户'], ['仓库', '仓库'], ['数量', '数量']],
    filters: [['客户', '客户'], ['仓库', '仓库']],
  },
  {
    key: 'transferOrder', label: '调拨订单', stage: '整机 SN 形成后，设备关联口径待确认',
    columns: [['调出仓库', '调出仓库'], ['调入仓库', '调入仓库'], ['数量', '数量']],
    filters: [['调出仓库', '调出仓库'], ['调入仓库', '调入仓库']],
  },
];

function copyNo(value, setCopied) {
  navigator.clipboard?.writeText(value);
  setCopied(value);
  window.setTimeout(() => setCopied(''), 1800);
}

function buildRecords(type, state) {
  if (type.key === 'transferOrder') return TRANSFER_RECORDS;
  if (type.key === 'productInbound') {
    return state.devices.filter((device) => device.erpInboundNo).map((device) => ({
      id: `${device.erpInboundNo}-${device.id}`,
      docNo: device.erpInboundNo,
      docDate: (device.inboundTime || device.updatedAt || '').slice(0, 10),
      fields: {
        单据编号: device.erpInboundNo,
        单据日期: (device.inboundTime || device.updatedAt || '').slice(0, 10),
        序列号: device.erpSerialNo || device.sn,
        批次号: device.erpBatchNo || device.robotNo,
      },
      matchedDevice: device,
    }));
  }
  return erpDocs[type.key] || [];
}

function Overview() {
  const [, setSearchParams] = useSearchParams();
  return (
    <Section title="当前纳入单据" subtitle="八类单据均为 ERP 只读来源">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0">
        {TYPES.map((type) => {
          const description = ['arrival', 'productInspection', 'purchaseInbound', 'productionOrder', 'materialOutbound'].includes(type.key)
            ? '发生在整机 SN 形成前，不关联单台设备。'
            : type.key === 'productInbound'
              ? '可通过 ERP 序列号与平台设备 SN 进行匹配。'
              : '与设备的具体关联方式待 ERP API 和研发联调确认。';
          return (
            <div key={type.key} className="flex items-center justify-between gap-4 border-b border-gray-100 py-4">
              <div className="min-w-0">
                <h3 className="text-[13px] font-medium text-gray-800">{type.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-5">{description}</p>
              </div>
              <LinkAction onClick={() => setSearchParams({ tab: 'list', type: type.key })}>进入列表</LinkAction>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DocList() {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('type');
  const requestedDoc = searchParams.get('doc');
  const returnTo = searchParams.get('returnTo');
  const type = TYPES.find((item) => item.key === requestedType) || TYPES[0];
  const [filters, setFilters] = useState({ query: '', dateFrom: '', dateTo: '', extras: {} });
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState('');
  const records = useMemo(() => buildRecords(type, state).filter((record) => {
    const docDate = record.docDate || record.fields?.单据日期 || '';
    const queryMatched = !filters.query || String(record.docNo || '').toLowerCase().includes(filters.query.toLowerCase());
    const dateMatched = (!filters.dateFrom || docDate >= filters.dateFrom) && (!filters.dateTo || docDate <= filters.dateTo);
    const extrasMatched = (type.filters || []).every(([, field]) => {
      const expected = filters.extras[field];
      if (!expected) return true;
      const actual = field === '_deviceSN' ? record.matchedDevice?.sn : record.fields?.[field];
      return String(actual || '').toLowerCase().includes(expected.toLowerCase());
    });
    return queryMatched && dateMatched && extrasMatched;
  }), [type, state, filters]);
  useEffect(() => {
    if (!requestedDoc) return;
    const matched = buildRecords(type, state).find((record) => record.docNo === requestedDoc);
    setDetail(matched || {
      id: `reference-${requestedDoc}`,
      docNo: requestedDoc,
      docDate: '',
      fields: { 单据编号: requestedDoc },
      missingSource: true,
    });
  }, [requestedDoc, type, state]);
  const paged = usePaged(records, 10);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const updateExtra = (key, value) => setFilters((prev) => ({ ...prev, extras: { ...prev.extras, [key]: value } }));
  const changeType = (key) => {
    setFilters({ query: '', dateFrom: '', dateTo: '', extras: {} });
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'list');
    next.set('type', key);
    next.delete('doc');
    setSearchParams(next);
  };
  const closeDetail = () => {
    setDetail(null);
    const next = new URLSearchParams(searchParams);
    next.delete('doc');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 border-b border-[#ececec] pb-3">
        {TYPES.map((item) => (
          <button
            key={item.key}
            onClick={() => changeType(item.key)}
            className={`px-3 py-1.5 rounded-md text-[13px] border ${item.key === type.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >{item.label}</button>
        ))}
      </div>
      <Section title={type.label} subtitle={type.stage}>
        <p className="text-xs text-gray-400">当前展示字段仅用于原型结构示意，最终字段范围及数据口径以 ERP API 实际返回结果和研发联调确认为准。</p>
      </Section>
      <Toolbar right={<span className="text-xs text-gray-400">共 {records.length} 条只读记录</span>}>
        <SearchInput className="w-56" placeholder={`${type.label}编号关键词`} value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
        <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} title="单据日期起始" />
        <span className="text-xs text-gray-400">至</span>
        <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} title="单据日期结束" />
        {(type.filters || []).map(([label, field]) => (
          <Input key={field} className="w-36" placeholder={label} value={filters.extras[field] || ''} onChange={(event) => updateExtra(field, event.target.value)} />
        ))}
      </Toolbar>
      <p className="text-xs text-gray-400 -mt-2 mb-3">具体可查询字段及筛选方式以 ERP API 实际能力和研发联调结果为准。</p>
      <Table
        head={['单据编号', '单据日期', ...type.columns.map(([label]) => label), '操作']}
        empty={`暂无${type.label}`}
        footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}
      >
        {paged.pageItems.map((record) => (
          <tr key={record.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2"><button className="ui-link font-mono text-xs" onClick={() => { setDetail(record); const next = new URLSearchParams(searchParams); next.set('doc', record.docNo); setSearchParams(next); }}>{record.docNo}</button></td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{record.docDate || record.fields?.单据日期 || '—'}</td>
            {type.columns.map(([label, field]) => (
              <td key={field} className="px-3 py-2 text-gray-600">
                {field === '_match'
                  ? <Chip>{record.matchedDevice ? '已匹配设备' : '未匹配'}</Chip>
                  : record.fields?.[field] ?? '—'}
              </td>
            ))}
            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center gap-3">
                <LinkAction onClick={() => { setDetail(record); const next = new URLSearchParams(searchParams); next.set('doc', record.docNo); setSearchParams(next); }}>查看详情</LinkAction>
                <LinkAction onClick={() => copyNo(record.docNo, setCopied)}>复制编号</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {copied && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-gray-900 px-4 py-2 text-[13px] text-white">已复制：{copied}</div>}
      <Modal isOpen={!!detail} onClose={closeDetail} title={detail ? `${type.label} · ${detail.docNo}` : `${type.label}详情`}>
        {detail && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs text-gray-500">{detail.docNo}</p>
              <p className="text-xs text-gray-400 mt-1">ERP 只读来源</p>
            </div>
            {detail.missingSource && (
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500">
                当前原型仅保留该来源单据编号，ERP mock 列表中暂无对应详情字段。
              </p>
            )}
            {!detail.missingSource && (
              <Section title="ERP 来源信息" bodyClassName="p-3">
                <DescList cols={2} items={Object.entries(detail.fields || {}).filter(([key, value]) =>
                  !key.includes('状态')
                  && !['单据编号', '单据日期'].includes(key)
                  && value !== undefined
                  && value !== null
                  && value !== ''
                  && String(value) !== String(detail.docNo)
                  && String(value) !== String(detail.docDate || detail.fields?.单据日期 || '')
                )} />
              </Section>
            )}
            {type.key === 'productInbound' && detail.matchedDevice && (
              <Section title="设备匹配关系" bodyClassName="p-3">
                <DescList cols={2} items={[
                  ['ERP 序列号', detail.fields.序列号],
                  ['平台设备 SN', detail.matchedDevice.sn],
                  ['ERP 批次号', detail.fields.批次号],
                  ['机器人编号', detail.matchedDevice.robotNo],
                ]} />
              </Section>
            )}
            {['salesOutbound', 'transferOrder'].includes(type.key) && <p className="text-xs text-gray-400">该单据与单台设备的关联口径待后续业务和 ERP API 联调确认。</p>}
            <p className="text-xs text-gray-400">只读信息，不支持编辑、审核或库存修改。</p>
            <div className="flex justify-end gap-2">
              {returnTo && <Link className="ui-link text-[13px] self-center mr-auto" to={returnTo}>返回来源页面</Link>}
              <button className="h-8 px-3 rounded-md border border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50" onClick={closeDetail}>关闭</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ErpCenter() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'list' ? 'list' : 'overview';
  return (
    <Page>
      <PageHeader
        title={activeTab === 'overview' ? '单据总览' : 'ERP 单据列表'}
        description={activeTab === 'overview'
          ? '只读展示 ERP 来源单据，用于查询、核对和设备履历关联；具体字段范围及查询能力以 ERP API 实际返回结果和研发联调确认为准。'
          : '只读查询 ERP 来源单据，当前筛选与字段仅用于原型结构示意。'}
        breadcrumb={<div className="text-xs text-gray-400 mb-1">ERP 单据中心 / {activeTab === 'overview' ? '单据总览' : 'ERP 单据列表'}</div>}
        actions={<Chip>ERP 只读</Chip>}
      />
      {activeTab === 'overview' ? <Overview /> : <DocList />}
    </Page>
  );
}
