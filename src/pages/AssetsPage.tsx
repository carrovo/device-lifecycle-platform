import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { PRODUCTION_STEPS, productionProgressLabel } from '../data/prdV12';
import { getDevicePage, getDeviceStats, getDeviceTypes } from '../api/production';
import { getLocationOptions, getProjectListOptions } from '../api/projectCenter';
import { Page, PageHeader, Toolbar, SearchInput, Select, Table, Chip, LinkAction, StatGrid, StatCard } from '../components/ui';

export default function AssetsPage() {
  const [filters, setFilters] = useState({ query: '', status: '', projectId: '', inbound: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, inProcess: 0, completed: 0, inbound: 0, pendingInbound: 0 });
  const [references, setReferences] = useState({ projects: [], locations: [], deviceTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  useEffect(() => {
    Promise.all([getDeviceStats(), getDeviceTypes(), getProjectListOptions()])
      .then(([nextStats, deviceTypes, projectReferences]) => {
        setStats({ total: 0, inProcess: 0, completed: 0, inbound: 0, pendingInbound: 0, ...nextStats });
        setReferences((prev) => ({
          ...prev,
          ...projectReferences,
          projects: Array.isArray(projectReferences?.projects) ? projectReferences.projects : [],
          deviceTypes: Array.isArray(deviceTypes) ? deviceTypes : [],
        }));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const version = ++requestVersion.current;
      setLoading(true);
      getDevicePage({ ...filters, page, size: pageSize })
        .then(async (payload) => {
          if (version !== requestVersion.current) return;
          const items = Array.isArray(payload?.items) ? payload.items : [];
          setResult((prev) => ({ ...prev, ...payload, items }));
          setError('');
          const locationIds = [...new Set(items.map((item) => item.locationId).filter(Boolean))];
          try {
            const locations = await getLocationOptions(locationIds);
            if (version === requestVersion.current) {
              setReferences((prev) => ({ ...prev, locations: Array.isArray(locations) ? locations : [] }));
            }
          } catch {
            if (version === requestVersion.current) setReferences((prev) => ({ ...prev, locations: [] }));
          }
        })
        .catch((requestError) => { if (version === requestVersion.current) setError(requestError.message); })
        .finally(() => { if (version === requestVersion.current) setLoading(false); });
    }, filters.query ? 250 : 0);
    return () => { requestVersion.current += 1; window.clearTimeout(timer); };
  }, [filters, page, pageSize]);

  const rows = useMemo(() => (Array.isArray(result.items) ? result.items : []).map((device) => {
      const project = (references.projects || []).find((item) => item.id === device.projectId);
      const location = (references.locations || []).find((item) => item.id === device.locationId);
      const model = (references.deviceTypes || []).find((item) => item.id === device.deviceTypeId);
      return { ...device, projectName: project?.name || '—', locationName: location?.name || '—', modelName: model?.name || '—' };
    }), [result.items, references]);

  return (
    <Page>
      <PageHeader
        title="设备台账"
        description="查询平台中所有有效设备档案，并从设备 SN 下钻查看聚合履历。"
        breadcrumb={<div className="text-xs text-gray-400 mb-1">设备管理 / 设备台账</div>}
      />
      <StatGrid cols={5}>
        <StatCard label="设备总数" value={stats.total} hint="有效设备档案" />
        <StatCard label="在制设备" value={stats.inProcess} hint="五个生产节点内" />
        <StatCard label="生产已完成" value={stats.completed} hint="终测完成" tone="success" />
        <StatCard label="ERP 产品入库已关联" value={stats.inbound} hint="已匹配产品入库单" tone="success" />
        <StatCard label="待产品入库" value={stats.pendingInbound} hint="等待 ERP 产品入库关联" />
      </StatGrid>
      <Toolbar right={<span className="text-xs text-gray-400">共 {result.total} 台设备</span>}>
        <SearchInput className="w-72" placeholder="搜索设备 SN / 机器人编号" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.status} onChange={(event) => update('status', event.target.value)}>
          <option value="">全部生产进度</option>
          {PRODUCTION_STEPS.map((step) => <option key={step.key} value={step.key}>{step.label}</option>)}
          <option value="complete">生产已完成</option>
        </Select>
        <Select value={filters.projectId} onChange={(event) => update('projectId', event.target.value)}>
          <option value="">全部项目</option>
          {(references.projects || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
        <Select value={filters.inbound} onChange={(event) => update('inbound', event.target.value)}>
          <option value="">ERP 产品入库不限</option>
          <option value="yes">已关联</option>
          <option value="no">未关联</option>
        </Select>
      </Toolbar>
      <Table
        head={['设备 SN', '机器人编号', '设备型号', '生产进度', 'ERP 产品入库关联', '所属项目', '所属点位', '最近更新', '操作']}
        empty={loading ? '设备数据加载中…' : error || '暂无符合条件的设备'}
        footer={<Pagination page={page} total={result.total} totalPages={result.totalPages} pageSize={pageSize} onChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
        {rows.map((device) => (
          <tr key={device.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2"><Link to={`/devices/${device.id}`} className="ui-link font-mono text-xs font-medium">{device.sn}</Link></td>
            <td className="px-3 py-2 font-mono text-xs text-gray-600">{device.robotNo}</td>
            <td className="px-3 py-2 text-gray-700">{device.modelName}</td>
            <td className="px-3 py-2"><StatusBadge status={productionProgressLabel(device)} /></td>
            <td className="px-3 py-2"><Chip>{device.erpInboundNo ? '已关联' : '未关联'}</Chip></td>
            <td className="px-3 py-2 text-gray-600">{device.projectName}</td>
            <td className="px-3 py-2 text-gray-600">{device.locationName}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{device.updatedAt || '—'}</td>
            <td className="px-3 py-2"><LinkAction to={`/devices/${device.id}`}>查看详情</LinkAction></td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-gray-400">设备管理不承担 ERP 库存、资产盘点或物料零部件台账职责。</p>
    </Page>
  );
}
