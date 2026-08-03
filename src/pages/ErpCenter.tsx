import {
  Fragment, useCallback, useEffect, useRef, useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ERP_FILTER_NO_MATCH,
  fetchErpChildSections,
  fetchErpDetail,
  fetchErpList,
} from '../api/yonyouErp';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import {
  Page, PageHeader, Section, Toolbar, SearchInput, Input, Table, LinkAction, Chip, DescList,
} from '../components/ui';
import { useApp } from '../context/AppContext';

const TYPES = [
  {
    key: 'arrival', label: '采购到货单', stage: '整机 SN 形成前',
    columns: [['供货供应商', '供货供应商']],
    filters: [['供货供应商', '供货供应商']],
  },
  {
    key: 'productInspection', label: '来料检验单', stage: '整机 SN 形成前',
    columns: [['物料名称', '物料名称'], ['检验数量', '检验数量'], ['检验结果', '检验结果'], ['单据状态', '单据状态']],
    filters: [['物料名称', '物料名称']],
  },
  {
    key: 'purchaseInbound', label: '采购入库单', stage: '整机 SN 形成前',
    columns: [['供应商', '供应商'], ['数量合计', '数量']],
    filters: [['供应商', '供应商'], ['物料', '物料名称']],
  },
  {
    key: 'productionOrder', label: '生产订单', stage: '整机 SN 形成前',
    columns: [['工厂', '工厂']],
    filters: [['物料', '物料名称']],
  },
  {
    key: 'materialOutbound', label: '材料出库单', stage: '整机 SN 形成前',
    columns: [['仓库', '仓库'], ['数量合计', '数量']],
    filters: [['仓库', '仓库'], ['物料', '物料名称']],
  },
  {
    key: 'productInbound', label: '产品入库单', stage: '可与单台设备建立匹配',
    columns: [['设备匹配', '设备匹配']],
    filters: [['批次号/机器人编号', '批次号']],
  },
  {
    key: 'salesOutbound', label: '销售出库单', stage: '整机 SN 形成后，设备关联口径待确认',
    columns: [['客户', '客户'], ['库存组织', '库存组织']],
    filters: [['客户', '客户'], ['库存组织', '库存组织'], ['批次号/机器人编号', '批次号']],
  },
  {
    key: 'transferOrder', label: '调拨订单', stage: '整机 SN 形成后，设备关联口径待确认',
    columns: [['调出仓库', '调出仓库'], ['调入仓库', '调入仓库'], ['数量', '数量']],
    filters: [['调出仓库', '调出仓库'], ['调入仓库', '调入仓库'], ['批次号/机器人编号', '批次号']],
  },
];

const EXPANDABLE_TYPES = new Set([
  'arrival',
  'purchaseInbound',
  'productionOrder',
  'materialOutbound',
  'productInbound',
  'salesOutbound',
  'transferOrder',
]);

function copyNo(value, setCopied) {
  navigator.clipboard?.writeText(value);
  setCopied(value);
  window.setTimeout(() => setCopied(''), 1800);
}

function tableCellValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function findProductInboundDevice(devices, documentNo, fields) {
  const detailId = String(fields?.['序列号/设备SN'] ?? '');
  const batchNo = String(fields?.['批次号/机器人编号'] ?? '');
  const inboundNo = String(documentNo ?? '');
  if (!inboundNo) return null;
  const linkedDevices = devices.filter((device) => (
    device.erpInboundStatus === '已关联'
    && (device.erpInboundLinks || []).some((link) => String(link.inboundNo ?? '') === inboundNo)
  ));
  if (detailId) {
    const byRecordId = linkedDevices.find((device) => (
      (device.erpInboundLinks || []).some((link) => String(link.recordId ?? '') === detailId)
    ));
    if (byRecordId) return byRecordId;
  }
  if (batchNo) {
    return linkedDevices.find((device) => (
      (device.erpInboundLinks || []).some((link) => String(link.batchNo ?? '') === batchNo)
      || String(device.robotNo ?? '') === batchNo
      || String(device.sn ?? '') === batchNo
    )) || null;
  }
  return linkedDevices.length === 1 ? linkedDevices[0] : null;
}

function decorateProductInboundSections(sections, devices, documentNo) {
  return (Array.isArray(sections) ? sections : []).map((section) => {
    if (section.title !== '入库明细') return section;
    const columns = Array.isArray(section.columns) ? section.columns : [];
    const rows = Array.isArray(section.rows) ? section.rows : [];
    return {
      ...section,
      columns: [...columns, '设备匹配'],
      rows: rows.map((row) => {
        const matchedDevice = findProductInboundDevice(devices, documentNo, row.fields);
        return {
          ...row,
          fields: {
            ...row.fields,
            设备匹配: matchedDevice
              ? '已匹配'
              : '未匹配',
          },
        };
      }),
    };
  });
}

function ChildTables({ sections }) {
  return (
    <div className="space-y-3 px-4 py-3">
      {(Array.isArray(sections) ? sections : []).map((section) => (
        <div key={section.title} className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
            {section.title} · {(section.rows || []).length} 条
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-[#fcfcfc]">
                  {(section.columns || []).map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(section.rows || []).map((row) => (
                  <tr key={row.id}>
                    {(section.columns || []).map((column) => (
                      <td key={column} className="px-3 py-2 text-gray-600">
                        {tableCellValue(row.fields[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [, setSearchParams] = useSearchParams();
  return (
    <Section title="当前纳入单据" subtitle="八类单据均由浏览器内 Mock 数据提供，可独立演示">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0">
        {TYPES.map((type) => {
          const description = ['arrival', 'productInspection', 'purchaseInbound', 'productionOrder', 'materialOutbound'].includes(type.key)
            ? '发生在整机 SN 形成前，不关联单台设备。'
            : type.key === 'productInbound'
              ? '可通过 ERP 产品入库单与平台设备建立匹配关系。'
              : '与设备的具体关联方式待业务和 ERP API 联调确认。';
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
  const [filters, setFilters] = useState({
    query: requestedDoc || '',
    dateFrom: '',
    dateTo: '',
    extras: {},
  });
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState('');
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [expandedDetails, setExpandedDetails] = useState({});
  const [arrivalVendors, setArrivalVendors] = useState([]);
  const [materialOutOptions, setMaterialOutOptions] = useState({
    warehouses: [],
    products: [],
  });
  const [salesOutboundOptions, setSalesOutboundOptions] = useState({
    customers: [],
    stockOrganizations: [],
  });
  const [transferOrderOptions, setTransferOrderOptions] = useState({
    outboundWarehouses: [],
    inboundWarehouses: [],
  });
  const [editableFilterInputs, setEditableFilterInputs] = useState({});
  const requestVersionRef = useRef(0);
  const suppressedAutoOpenDocRef = useRef('');

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      fetchErpList(type.key, {
        filters,
        page,
        pageSize,
        signal: controller.signal,
      })
        .then((result) => {
          if (requestVersion !== requestVersionRef.current) return;
          setRecords(result.records);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          if (type.key === 'arrival') {
            setArrivalVendors(result.filterOptions?.vendors || []);
          } else if (type.key === 'materialOutbound') {
            setMaterialOutOptions({
              warehouses: result.filterOptions?.warehouses || [],
              products: result.filterOptions?.products || [],
            });
          } else if (type.key === 'salesOutbound') {
            setSalesOutboundOptions({
              customers: result.filterOptions?.customers || [],
              stockOrganizations: result.filterOptions?.stockOrganizations || [],
            });
          } else if (type.key === 'transferOrder') {
            setTransferOrderOptions({
              outboundWarehouses: result.filterOptions?.outboundWarehouses || [],
              inboundWarehouses: result.filterOptions?.inboundWarehouses || [],
            });
          }
        })
        .catch((requestError) => {
          if (requestError.name === 'AbortError' || requestVersion !== requestVersionRef.current) return;
          setRecords([]);
          setTotal(0);
          setTotalPages(1);
          setError(requestError.message || 'ERP 单据查询失败');
        })
        .finally(() => {
          if (!controller.signal.aborted && requestVersion === requestVersionRef.current) setLoading(false);
        });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, page, pageSize, reloadToken, type.key]);

  const clearListForRequest = () => {
    requestVersionRef.current += 1;
    setLoading(true);
    setError('');
    setRecords([]);
    setTotal(0);
    setTotalPages(1);
    setExpandedRows(new Set());
    setExpandedDetails({});
  };

  const openDetail = useCallback(async (record, updateUrl = true) => {
    setDetail({ record, data: null, loading: true, error: '' });
    if (updateUrl) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('doc', record.docNo);
        return next;
      });
    }
    try {
      const data = await fetchErpDetail(type.key, record);
      setDetail({ record, data, loading: false, error: '' });
    } catch (requestError) {
      setDetail({
        record,
        data: null,
        loading: false,
        error: requestError.message || 'ERP 单据详情查询失败',
      });
    }
  }, [setSearchParams, type.key]);

  useEffect(() => {
    if (suppressedAutoOpenDocRef.current) {
      if (requestedDoc === suppressedAutoOpenDocRef.current) return;
      suppressedAutoOpenDocRef.current = '';
    }
    if (!requestedDoc || loading || detail) return;
    const matched = records.find((record) => record.docNo === requestedDoc);
    if (!matched) return;
    const timer = window.setTimeout(() => openDetail(matched, false), 0);
    return () => window.clearTimeout(timer);
  }, [detail, loading, openDetail, records, requestedDoc]);

  const updateFilter = (key, value) => {
    clearListForRequest();
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const updateExtra = (key, value) => {
    clearListForRequest();
    setPage(1);
    setFilters((prev) => ({ ...prev, extras: { ...prev.extras, [key]: value } }));
  };
  const updateEditableExtra = (field, value, options) => {
    const inputKey = `${type.key}:${field}`;
    setEditableFilterInputs((current) => ({ ...current, [inputKey]: value }));
    const normalizedValue = value.trim().toLocaleLowerCase('zh-CN');
    const exactMatch = options.find((option) => (
      option.id === value
      || option.name.toLocaleLowerCase('zh-CN') === normalizedValue
    ));
    const partialMatches = normalizedValue
      ? options.filter((option) => (
        option.name.toLocaleLowerCase('zh-CN').includes(normalizedValue)
      ))
      : [];
    const matchedOption = exactMatch || (partialMatches.length === 1 ? partialMatches[0] : null);
    updateExtra(
      field,
      !normalizedValue ? '' : matchedOption?.id || ERP_FILTER_NO_MATCH,
    );
  };
  const changeType = (key) => {
    setFilters({ query: '', dateFrom: '', dateTo: '', extras: {} });
    setEditableFilterInputs({});
    clearListForRequest();
    setDetail(null);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'list');
    next.set('type', key);
    next.delete('doc');
    setSearchParams(next);
  };
  const closeDetail = () => {
    suppressedAutoOpenDocRef.current = detail?.record?.docNo || requestedDoc || '';
    setDetail(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('doc');
      return next;
    }, { replace: true });
  };
  const toggleExpanded = async (record) => {
    if (expandedRows.has(record.id)) {
      setExpandedRows((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
      return;
    }

    setExpandedRows((current) => new Set(current).add(record.id));
    if (expandedDetails[record.id]?.loaded || expandedDetails[record.id]?.loading) return;

    const requestVersion = requestVersionRef.current;
    setExpandedDetails((current) => ({
      ...current,
      [record.id]: { loading: true, loaded: false, sections: [], error: '' },
    }));
    try {
      const sourceSections = await fetchErpChildSections(type.key, record);
      const sections = type.key === 'productInbound'
        ? decorateProductInboundSections(sourceSections, state.devices, record.docNo)
        : sourceSections;
      if (requestVersion !== requestVersionRef.current) return;
      setExpandedDetails((current) => ({
        ...current,
        [record.id]: {
          loading: false, loaded: true, sections, error: '',
        },
      }));
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) return;
      setExpandedDetails((current) => ({
        ...current,
        [record.id]: {
          loading: false,
          loaded: true,
          sections: [],
          error: requestError.message || 'ERP 单据明细查询失败',
        },
      }));
    }
  };
  const hasExpandableRows = EXPANDABLE_TYPES.has(type.key);
  const tableColumnCount = 3 + type.columns.length + (hasExpandableRows ? 1 : 0);
  const detailFieldValues = Object.fromEntries(detail?.data?.detailFields || []);
  const matchedDetailDevices = type.key === 'productInbound' && detail?.data
    ? (detail.data.childSections || [])
      .flatMap((section) => Array.isArray(section?.rows) ? section.rows : [])
      .map((row) => findProductInboundDevice(
        state.devices,
        detail.record.docNo,
        row.fields,
      ))
      .filter(Boolean)
      .filter((device, index, devices) => (
        devices.findIndex((item) => item.id === device.id) === index
      ))
    : [];

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
      <Toolbar right={(
        <>
          <LinkAction onClick={() => { clearListForRequest(); setReloadToken((value) => value + 1); }}>刷新</LinkAction>
          <span className="text-xs text-gray-400">{loading ? '正在查询…' : `共 ${total} 条只读记录`}</span>
        </>
      )}>
        <SearchInput
          className={type.key === 'salesOutbound' || type.key === 'transferOrder' ? 'w-36' : 'w-56'}
          placeholder="单据编号"
          value={filters.query}
          onChange={(event) => updateFilter('query', event.target.value)}
        />
        <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} title="单据日期起始" />
        <span className="text-xs text-gray-400">至</span>
        <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} title="单据日期结束" />
        {(type.filters || []).map(([label, field]) => {
          if (type.key === 'arrival' && field === '供货供应商') {
            const inputKey = `${type.key}:${field}`;
            return (
              <Fragment key={field}>
                <Input
                  className="w-48"
                  list="arrival-vendor-options"
                  placeholder="供货供应商"
                  value={editableFilterInputs[inputKey] || ''}
                  onChange={(event) => updateEditableExtra(field, event.target.value, arrivalVendors)}
                  aria-label="供货供应商"
                />
                <datalist id="arrival-vendor-options">
                  {arrivalVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.name} />
                  ))}
                </datalist>
              </Fragment>
            );
          }
          if (type.key === 'materialOutbound' && field === '仓库') {
            const inputKey = `${type.key}:${field}`;
            return (
              <Fragment key={field}>
                <Input
                  className="w-48"
                  list="material-warehouse-options"
                  placeholder="仓库"
                  value={editableFilterInputs[inputKey] || ''}
                  onChange={(event) => updateEditableExtra(
                    field,
                    event.target.value,
                    materialOutOptions.warehouses,
                  )}
                  aria-label="仓库"
                />
                <datalist id="material-warehouse-options">
                  {materialOutOptions.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.name} />
                  ))}
                </datalist>
              </Fragment>
            );
          }
          if (type.key === 'materialOutbound' && field === '物料名称') {
            const inputKey = `${type.key}:${field}`;
            return (
              <Fragment key={field}>
                <Input
                  className="w-48"
                  list="material-product-options"
                  placeholder="物料"
                  value={editableFilterInputs[inputKey] || ''}
                  onChange={(event) => updateEditableExtra(
                    field,
                    event.target.value,
                    materialOutOptions.products,
                  )}
                  aria-label="物料"
                />
                <datalist id="material-product-options">
                  {materialOutOptions.products.map((product) => (
                    <option key={product.id} value={product.name} />
                  ))}
                </datalist>
              </Fragment>
            );
          }
          if (
            type.key === 'salesOutbound'
            && (field === '客户' || field === '库存组织')
          ) {
            const inputKey = `${type.key}:${field}`;
            const options = field === '客户'
              ? salesOutboundOptions.customers
              : salesOutboundOptions.stockOrganizations;
            const datalistId = field === '客户'
              ? 'sales-customer-options'
              : 'sales-stock-organization-options';
            return (
              <Fragment key={field}>
                <Input
                  className="w-48"
                  list={datalistId}
                  placeholder={label}
                  value={editableFilterInputs[inputKey] || ''}
                  onChange={(event) => updateEditableExtra(
                    field,
                    event.target.value,
                    options,
                  )}
                  aria-label={label}
                />
                <datalist id={datalistId}>
                  {options.map((option) => (
                    <option key={option.id} value={option.name} />
                  ))}
                </datalist>
              </Fragment>
            );
          }
          if (
            type.key === 'transferOrder'
            && (field === '调出仓库' || field === '调入仓库')
          ) {
            const inputKey = `${type.key}:${field}`;
            const options = field === '调出仓库'
              ? transferOrderOptions.outboundWarehouses
              : transferOrderOptions.inboundWarehouses;
            const datalistId = field === '调出仓库'
              ? 'transfer-outbound-warehouse-options'
              : 'transfer-inbound-warehouse-options';
            return (
              <Fragment key={field}>
                <Input
                  className="w-48"
                  list={datalistId}
                  placeholder={label}
                  value={editableFilterInputs[inputKey] || ''}
                  onChange={(event) => updateEditableExtra(
                    field,
                    event.target.value,
                    options,
                  )}
                  aria-label={label}
                />
                <datalist id={datalistId}>
                  {options.map((option) => (
                    <option key={option.id} value={option.name} />
                  ))}
                </datalist>
              </Fragment>
            );
          }
          return <Input key={field} className="w-36" placeholder={label} value={filters.extras[field] || ''} onChange={(event) => updateExtra(field, event.target.value)} />;
        })}
      </Toolbar>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <span>{error}</span>
          <button className="ui-link ml-3" onClick={() => { clearListForRequest(); setReloadToken((value) => value + 1); }}>重新请求</button>
        </div>
      )}
      <Table
        key={`${type.key}-${page}-${pageSize}-${reloadToken}-${filters.query}-${filters.dateFrom}-${filters.dateTo}-${JSON.stringify(filters.extras)}`}
        head={[
          ...(hasExpandableRows ? ['明细'] : []),
          '单据编号',
          '单据日期',
          ...type.columns.map(([label]) => label),
          '操作',
        ]}
        empty={loading ? `正在从 ERP 获取${type.label}…` : `ERP 暂无${type.label}`}
        footer={(
          <Pagination
            page={page}
            total={total}
            totalPages={totalPages}
            pageSize={pageSize}
            onChange={(nextPage) => { clearListForRequest(); setPage(nextPage); }}
            onPageSizeChange={(size) => { clearListForRequest(); setPageSize(size); setPage(1); }}
          />
        )}
      >
        {records.map((record) => {
          const isExpanded = expandedRows.has(record.id);
          const expandedState = expandedDetails[record.id];
          const matchedDevice = type.key === 'productInbound'
            ? state.devices.find((device) => (
              device.erpInboundStatus === '已关联'
              && (device.erpInboundLinks || []).some((link) => String(link.inboundNo ?? '') === record.docNo)
            ))
            : null;
          return (
            <Fragment key={record.id}>
              <tr className="hover:bg-[#fafafa]">
                {hasExpandableRows && (
                  <td className="w-14 px-3 py-2">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? '收起明细' : '展开明细'}
                      title={isExpanded ? '收起明细' : '展开明细'}
                      onClick={() => toggleExpanded(record)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-sm text-gray-500 transition hover:bg-gray-100"
                    >
                      <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </button>
                  </td>
                )}
                <td className="px-3 py-2"><button className="ui-link font-mono text-xs" onClick={() => openDetail(record)}>{record.docNo}</button></td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{record.docDate || '—'}</td>
                {type.columns.map(([, field]) => (
                  <td key={field} className="px-3 py-2 text-gray-600">
                    {type.key === 'productInbound' && field === '设备匹配'
                      ? <Chip>{matchedDevice ? '已匹配设备' : '未匹配'}</Chip>
                      : tableCellValue(record.fields?.[field])}
                  </td>
                ))}
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <LinkAction onClick={() => openDetail(record)}>查看详情</LinkAction>
                    <LinkAction onClick={() => copyNo(record.docNo, setCopied)}>复制编号</LinkAction>
                  </div>
                </td>
              </tr>
              {hasExpandableRows && isExpanded && (
                <tr className="bg-gray-50/60">
                  <td colSpan={tableColumnCount} className="p-0">
                    {expandedState?.loading && (
                      <p className="px-4 py-5 text-center text-xs text-gray-400">正在获取单据明细…</p>
                    )}
                    {expandedState?.error && (
                      <p className="mx-4 my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {expandedState.error}
                      </p>
                    )}
                    {expandedState?.loaded && !expandedState.error && expandedState.sections.length > 0 && (
                      <ChildTables sections={expandedState.sections} />
                    )}
                    {expandedState?.loaded && !expandedState.error && expandedState.sections.length === 0 && (
                      <p className="px-4 py-5 text-center text-xs text-gray-400">暂无明细数据</p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
      {copied && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] rounded-md bg-gray-900 px-4 py-2 text-[13px] text-white">已复制：{copied}</div>}
      <Modal isOpen={!!detail} onClose={closeDetail} title={detail ? `${type.label} · ${detail.record.docNo}` : `${type.label}详情`}>
        {detail && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs text-gray-500">{detail.record.docNo}</p>
              <p className="text-xs text-gray-400 mt-1">用友 ERP 浏览器 Mock 数据</p>
            </div>
            {detail.loading && <p className="py-8 text-center text-[13px] text-gray-400">正在获取 ERP 单据详情…</p>}
            {detail.error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                {detail.error}
              </p>
            )}
            {detail.data && (
              <>
                <Section title="ERP 来源信息" bodyClassName="p-3">
                  <DescList cols={2} items={detail.data.detailFields} />
                </Section>
              </>
            )}
            {type.key === 'productInbound' && detail.data && (
              <Section title="设备匹配关系" bodyClassName="p-3">
                <DescList cols={2} items={[
                  ['匹配状态', <Chip key="match-status">{matchedDetailDevices.length ? `已匹配 ${matchedDetailDevices.length} 台设备` : '未匹配'}</Chip>],
                  ['序列号/设备SN', detailFieldValues['序列号/设备SN']],
                  ['平台设备 SN', matchedDetailDevices.map((device) => device.sn).join('、')],
                  ['批次号/机器人编号', detailFieldValues['批次号/机器人编号']],
                  ['机器人编号', matchedDetailDevices.map((device) => device.robotNo).join('、')],
                ]} />
              </Section>
            )}
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
          ? '通过浏览器内 Mock 层查询 ERP 来源单据，用于独立演示核对和设备履历关联。'
          : undefined}
        breadcrumb={<div className="text-xs text-gray-400 mb-1">ERP 单据中心 / {activeTab === 'overview' ? '单据总览' : 'ERP 单据列表'}</div>}
        actions={<Chip>ERP Mock 数据</Chip>}
      />
      {activeTab === 'overview' ? <Overview /> : <DocList />}
    </Page>
  );
}
