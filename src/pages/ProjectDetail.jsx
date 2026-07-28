import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import { isProductionComplete, productionProgressLabel } from '../data/prdV12';
import {
  Page, PageHeader, Section, DescList, Table, Btn, Input, Select, LinkAction, Chip,
} from '../components/ui';

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const TABS = [['overview', '项目概况'], ['locations', '点位与设备'], ['delivery', '交付执行'], ['logs', '操作日志']];

function TabBar({ active, onChange }) {
  return <div className="flex gap-1 border-b border-gray-200">{TABS.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={`px-3 py-2 text-[13px] border-b-2 ${active === key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>)}</div>;
}

function ProjectEditForm({ project, onClose, onSave }) {
  const [form, setForm] = useState({ name: project.name, projectType: project.projectType || '', client: project.client || '', manager: project.manager || '', notes: project.notes || '' });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-500 mb-1">项目名称</label><Input className="w-full" value={form.name} onChange={(event) => update('name', event.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">项目类型 / 业务场景</label><Input className="w-full" value={form.projectType} onChange={(event) => update('projectType', event.target.value)} /></div><div><label className="block text-xs text-gray-500 mb-1">项目负责人</label><Input className="w-full" value={form.manager} onChange={(event) => update('manager', event.target.value)} /></div></div>
      <div><label className="block text-xs text-gray-500 mb-1">客户</label><Input className="w-full" value={form.client} onChange={(event) => update('client', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-500 mb-1">备注</label><Input className="w-full" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!form.name.trim() || !form.manager.trim()} onClick={() => onSave(form)}>保存项目信息</Btn></div>
    </div>
  );
}

function LocationForm({ location, onClose, onSave }) {
  const [form, setForm] = useState({ name: location?.name || '', address: location?.address || '', owner: location?.owner || '' });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-500 mb-1">点位名称</label><Input className="w-full" value={form.name} onChange={(event) => update('name', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-500 mb-1">点位地址</label><Input className="w-full" value={form.address} onChange={(event) => update('address', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-500 mb-1">负责人</label><Input className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)} /></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!form.name.trim()} onClick={() => onSave(form)}>保存点位</Btn></div>
    </div>
  );
}

function AssignDeviceForm({ locations, state, onClose, onSave }) {
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [deviceIds, setDeviceIds] = useState([]);
  const candidates = state.devices.filter((device) => device.erpInboundNo
    && isProductionComplete(device)
    && !device.projectId);
  const toggle = (id) => setDeviceIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-500 mb-1">归属点位</label><Select className="w-full" value={locationId} onChange={(event) => setLocationId(event.target.value)}>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
      <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200 p-2 space-y-1">
        {candidates.map((device) => <label key={device.id} className="flex items-center gap-2 px-2 py-1.5 text-[13px]"><input type="checkbox" checked={deviceIds.includes(device.id)} onChange={() => toggle(device.id)} /><span className="font-mono text-xs">{device.sn}</span><span className="text-gray-400">{device.robotNo}</span></label>)}
        {!candidates.length && <p className="py-4 text-center text-xs text-gray-400">暂无完成产品入库且未绑定其他项目的设备</p>}
      </div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!locationId || !deviceIds.length} onClick={() => onSave(locationId, deviceIds)}>确认设备归属</Btn></div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const [active, setActive] = useState('overview');
  const [modal, setModal] = useState(null);
  const project = state.projects.find((item) => item.id === id);
  if (!project) return <Page><PageHeader title="项目不存在" actions={<Btn as="link" to="/projects">返回项目列表</Btn>} /></Page>;

  const locations = state.locations.filter((item) => item.projectId === project.id);
  const activeLocations = locations.filter((item) => !item.disabled);
  const devices = state.devices.filter((item) => item.projectId === project.id);
  const deliveries = state.deliveryPlans.filter((item) => item.projectId === project.id);
  const deliveryIds = new Set(deliveries.map((item) => item.id));
  const exceptions = state.deliveryExceptions.filter((item) => deliveryIds.has(item.deliveryPlanId));
  const logs = state.operationLogs.filter((item) => item.projectId === project.id).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const locPaged = usePaged(locations, 10);
  const devPaged = usePaged(devices, 10);
  const deliveryPaged = usePaged(deliveries, 10);
  const logPaged = usePaged(logs, 10);
  const editLocation = modal?.id ? locations.find((item) => item.id === modal.id) : null;
  const log = (actionType, notes) => dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}-${actionType}`, projectId: project.id, operator: state.currentUser, timestamp: nowText(), actionType, notes } });
  const saveProject = (form) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { id: project.id, ...form, updatedAt: nowText() } });
    log('编辑项目', '更新项目基础信息');
    setModal(null);
  };
  const saveLocation = (form) => {
    if (editLocation) dispatch({ type: 'UPDATE_LOCATION', payload: { id: editLocation.id, ...form, updatedAt: nowText() } });
    else dispatch({ type: 'ADD_LOCATION', payload: { id: `LOC-${Date.now()}`, projectId: project.id, ...form, disabled: false, updatedAt: nowText() } });
    log(editLocation ? '编辑点位' : '新增点位', form.name);
    setModal(null);
  };
  const disableLocation = (location) => {
    dispatch({ type: 'UPDATE_LOCATION', payload: { id: location.id, disabled: true, updatedAt: nowText() } });
    log('停用点位', location.name);
  };
  const assignDevices = (locationId, deviceIds) => {
    deviceIds.forEach((deviceId) => dispatch({ type: 'UPDATE_DEVICE', payload: { id: deviceId, projectId: project.id, locationId, preAssignedLocationId: locationId, updatedAt: nowText() } }));
    log('绑定项目设备', `绑定 ${deviceIds.length} 台设备到点位 ${locations.find((item) => item.id === locationId)?.name}`);
    setModal(null);
  };

  return (
    <Page>
      <PageHeader breadcrumb={<Link to="/projects" className="ui-link text-[13px]">‹ 返回项目列表</Link>} title={project.name} description="在项目详情中维护点位、设备归属，并查看当前项目交付执行。" actions={<Btn onClick={() => setModal({ type: 'project' })}>编辑项目</Btn>} />
      <TabBar active={active} onChange={setActive} />

      {active === 'overview' && <Section title="项目概况"><DescList cols={3} items={[
        ['项目名称', project.name], ['项目类型 / 业务场景', project.projectType || '—'], ['客户', project.client || '—'],
        ['项目负责人', project.manager || '—'], ['备注', project.notes || '—'], ['最近更新', project.updatedAt || '—'],
      ]} /></Section>}

      {active === 'locations' && <>
        <Section title={`点位（${locations.length}）`} right={<Btn size="sm" variant="primary" onClick={() => setModal({ type: 'location' })}>新增点位</Btn>} bodyClassName="p-0">
          <Table head={['点位名称', '地址', '负责人', '关联设备数', '使用情况', '最近更新', '操作']} empty="暂无点位" footer={<Pagination {...locPaged} onChange={locPaged.setPage} onPageSizeChange={locPaged.setPageSize} />}>
            {locPaged.pageItems.map((location) => {
              const relatedCount = devices.filter((item) => item.locationId === location.id).length;
              return <tr key={location.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 text-gray-800">{location.name}</td><td className="px-3 py-2 text-gray-600">{location.address || '—'}</td><td className="px-3 py-2 text-gray-600">{location.owner || '—'}</td>
                <td className="px-3 py-2">{relatedCount}</td><td className="px-3 py-2"><Chip>{location.disabled ? '已停用' : '使用中'}</Chip></td><td className="px-3 py-2 text-xs text-gray-500">{location.updatedAt || '—'}</td>
                <td className="px-3 py-2"><div className="flex gap-3"><LinkAction onClick={() => setModal({ type: 'location', id: location.id })}>编辑</LinkAction>{!location.disabled && <LinkAction onClick={() => disableLocation(location)}>停用</LinkAction>}</div></td>
              </tr>;
            })}
          </Table>
        </Section>
        <Section title={`项目设备（${devices.length}）`} right={<Btn size="sm" variant="primary" disabled={!activeLocations.length} onClick={() => setModal({ type: 'assign' })}>绑定设备</Btn>} bodyClassName="p-0">
          <Table head={['设备 SN', '机器人编号', '设备型号', '生产进度', '所属点位', 'ERP 产品入库', '操作']} empty="暂无项目设备" footer={<Pagination {...devPaged} onChange={devPaged.setPage} onPageSizeChange={devPaged.setPageSize} />}>
            {devPaged.pageItems.map((device) => <tr key={device.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2"><Link className="ui-link font-mono text-xs" to={`/devices/${device.id}`}>{device.sn}</Link></td><td className="px-3 py-2 font-mono text-xs text-gray-600">{device.robotNo}</td>
              <td className="px-3 py-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || '—'}</td><td className="px-3 py-2"><StatusBadge status={productionProgressLabel(device)} /></td>
              <td className="px-3 py-2 text-gray-600">{locations.find((item) => item.id === device.locationId)?.name || '—'}</td><td className="px-3 py-2"><Chip>{device.erpInboundNo ? '已关联' : '未关联'}</Chip></td>
              <td className="px-3 py-2"><LinkAction to={`/devices/${device.id}`}>查看设备详情</LinkAction></td>
            </tr>)}
          </Table>
        </Section>
      </>}

      {active === 'delivery' && <>
        <Section title={`交付执行（${deliveries.length}）`} bodyClassName="p-0">
          <Table head={['交付执行名称 / 编号', '点位', '关联设备', '交付结果', '异常记录', '最近更新时间', '操作']} empty="暂无交付执行" footer={<Pagination {...deliveryPaged} onChange={deliveryPaged.setPage} onPageSizeChange={deliveryPaged.setPageSize} />}>
            {deliveryPaged.pageItems.map((plan) => {
              const result = plan.deliveryResult?.result;
              const planExceptions = exceptions.filter((item) => item.deliveryPlanId === plan.id);
              const deviceSNs = (plan.boundDeviceIds || []).map((deviceId) => state.devices.find((item) => item.id === deviceId)?.sn).filter(Boolean);
              return <tr key={plan.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/delivery-plans/${plan.id}`}>{plan.title || plan.name}</Link><div className="font-mono text-[11px] text-gray-400">{plan.id}</div></td>
                <td className="px-3 py-2 text-gray-600">{locations.find((item) => item.id === plan.locationId)?.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{deviceSNs.length > 1 ? `${deviceSNs[0]} 等 ${deviceSNs.length} 台` : deviceSNs[0] || '—'}</td>
                <td className="px-3 py-2">{result ? <StatusBadge status={result} /> : <span className="text-gray-400">暂无结果</span>}</td>
                <td className="px-3 py-2">{planExceptions.length ? <LinkAction to={`/delivery-plans/${plan.id}?tab=exceptions`}>{planExceptions.length} 条</LinkAction> : <span className="text-gray-400">暂无</span>}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{plan.updatedAt || '—'}</td><td className="px-3 py-2"><LinkAction to={`/delivery-plans/${plan.id}`}>查看详情</LinkAction></td>
              </tr>;
            })}
          </Table>
        </Section>
        <Section title="交付异常" bodyClassName="p-0">
          <Table head={['来源记录标题', '来源类型', '关联设备', '异常说明', '记录人', '记录时间', '操作']} empty="暂无交付异常">
            {exceptions.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-medium text-gray-700">{item.sourceTitle || '交付记录'}</td><td className="px-3 py-2 text-gray-600">{item.sourceType || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{(item.affectedDeviceIds || []).map((deviceId) => state.devices.find((device) => device.id === deviceId)?.sn).filter(Boolean).join('、') || '当前点位'}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{item.description}</td><td className="px-3 py-2 text-gray-600">{item.recorder || '—'}</td><td className="px-3 py-2 text-xs text-gray-500">{item.recordTime || '—'}</td>
              <td className="px-3 py-2"><LinkAction to={`/delivery-plans/${item.deliveryPlanId}?tab=exceptions`}>查看交付异常</LinkAction></td>
            </tr>)}
          </Table>
        </Section>
      </>}

      {active === 'logs' && <Section title="项目操作日志" bodyClassName="p-0">
        <Table head={['操作时间', '操作人', '操作类型', '说明']} empty="暂无项目操作日志" footer={<Pagination {...logPaged} onChange={logPaged.setPage} onPageSizeChange={logPaged.setPageSize} />}>
          {logPaged.pageItems.map((item) => <tr key={item.id} className="hover:bg-[#fafafa]"><td className="px-3 py-2 text-xs text-gray-500">{item.timestamp}</td><td className="px-3 py-2 text-gray-600">{item.operator}</td><td className="px-3 py-2 text-gray-700">{item.actionType}</td><td className="px-3 py-2 text-xs text-gray-500">{item.notes || '—'}</td></tr>)}
        </Table>
      </Section>}

      <Modal size="lg" isOpen={modal?.type === 'project'} onClose={() => setModal(null)} title="编辑项目"><ProjectEditForm project={project} onClose={() => setModal(null)} onSave={saveProject} /></Modal>
      <Modal isOpen={modal?.type === 'location'} onClose={() => setModal(null)} title={editLocation ? '编辑点位' : '新增点位'}><LocationForm location={editLocation} onClose={() => setModal(null)} onSave={saveLocation} /></Modal>
      <Modal isOpen={modal?.type === 'assign'} onClose={() => setModal(null)} title="绑定项目设备"><AssignDeviceForm locations={activeLocations} state={state} onClose={() => setModal(null)} onSave={assignDevices} /></Modal>
    </Page>
  );
}
