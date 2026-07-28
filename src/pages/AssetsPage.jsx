import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import { PRODUCTION_STEPS, getProductionKey, isProductionComplete, productionProgressLabel } from '../data/prdV12';
import { Page, PageHeader, Toolbar, SearchInput, Select, Table, Chip, LinkAction, StatGrid, StatCard } from '../components/ui';

export default function AssetsPage() {
  const { state } = useApp();
  const [filters, setFilters] = useState({ query: '', status: '', projectId: '', inbound: '' });
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const activeDevices = state.devices.filter((device) => device.archiveStatus !== '已作废');
  const stats = {
    total: activeDevices.length,
    inProcess: activeDevices.filter((device) => !isProductionComplete(device)).length,
    completed: activeDevices.filter(isProductionComplete).length,
    inbound: activeDevices.filter((device) => !!device.erpInboundNo).length,
    pendingInbound: activeDevices.filter((device) => isProductionComplete(device) && !device.erpInboundNo).length,
  };

  const rows = useMemo(() => state.devices
    .filter((device) => device.archiveStatus !== '已作废')
    .map((device) => {
      const project = state.projects.find((item) => item.id === device.projectId);
      const location = state.locations.find((item) => item.id === (device.locationId || device.preAssignedLocationId));
      const model = state.deviceTypes.find((item) => item.id === device.deviceTypeId);
      return { ...device, projectName: project?.name || '—', locationName: location?.name || '—', modelName: model?.name || '—' };
    })
    .filter((device) => {
      const text = `${device.sn} ${device.robotNo}`.toLowerCase();
      return (!filters.query || text.includes(filters.query.toLowerCase()))
        && (!filters.status || (filters.status === 'complete' ? isProductionComplete(device) : !isProductionComplete(device) && getProductionKey(device) === filters.status))
        && (!filters.projectId || device.projectId === filters.projectId)
        && (!filters.inbound || (filters.inbound === 'yes' ? !!device.erpInboundNo : !device.erpInboundNo));
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')), [state, filters]);
  const paged = usePaged(rows, 10);

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
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 台设备</span>}>
        <SearchInput className="w-72" placeholder="搜索设备 SN / 机器人编号" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.status} onChange={(event) => update('status', event.target.value)}>
          <option value="">全部生产进度</option>
          {PRODUCTION_STEPS.map((step) => <option key={step.key} value={step.key}>{step.label}</option>)}
          <option value="complete">生产已完成</option>
        </Select>
        <Select value={filters.projectId} onChange={(event) => update('projectId', event.target.value)}>
          <option value="">全部项目</option>
          {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
        <Select value={filters.inbound} onChange={(event) => update('inbound', event.target.value)}>
          <option value="">ERP 产品入库不限</option>
          <option value="yes">已关联</option>
          <option value="no">未关联</option>
        </Select>
      </Toolbar>
      <Table
        head={['设备 SN', '机器人编号', '设备型号', '生产进度', 'ERP 产品入库关联', '所属项目', '所属点位', '最近更新', '操作']}
        empty="暂无符合条件的设备"
        footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}
      >
        {paged.pageItems.map((device) => (
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
