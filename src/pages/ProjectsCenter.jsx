import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import { isProductionComplete } from '../data/prdV12';
import { deliveryErpReferences } from '../data/erpPrototype';
import {
  Page, PageHeader, Toolbar, SearchInput, Select, Input, Table, Btn, LinkAction,
} from '../components/ui';

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const PROJECT_TYPES = ['智魔方', '机场', '工业场景', '遥操数采'];
const deliveryResult = (plan) => plan.deliveryResult?.result || '';

function ProjectForm({ project, state, onClose, onSave }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    projectType: project?.projectType || PROJECT_TYPES[0],
    client: project?.client || '',
    manager: project?.manager || state.currentUser,
    notes: project?.notes || '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.name.trim() || !form.client.trim() || !form.manager.trim()) return setError('请填写项目名称、客户和项目负责人。');
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-500 mb-1">项目名称</label><Input className="w-full" value={form.name} onChange={(event) => update('name', event.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">项目类型 / 业务场景</label><Select className="w-full" value={form.projectType} onChange={(event) => update('projectType', event.target.value)}>{PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></div>
        <div><label className="block text-xs text-gray-500 mb-1">项目负责人</label><Input className="w-full" value={form.manager} onChange={(event) => update('manager', event.target.value)} /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-1">客户</label><Input className="w-full" value={form.client} onChange={(event) => update('client', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-500 mb-1">备注（选填）</label><Input className="w-full" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>保存项目</Btn></div>
    </div>
  );
}

function ProjectList() {
  const { state, dispatch } = useApp();
  const [filters, setFilters] = useState({ query: '', type: '', manager: '', updated: '', hasDevice: '', hasDelivery: '' });
  const [modal, setModal] = useState(null);
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const managers = [...new Set(state.projects.map((item) => item.manager).filter(Boolean))];
  const rows = useMemo(() => state.projects
    .map((project) => ({
      ...project,
      pointCount: state.locations.filter((item) => item.projectId === project.id).length,
      deviceCount: state.devices.filter((item) => item.projectId === project.id).length,
      deliveryCount: state.deliveryPlans.filter((item) => item.projectId === project.id).length,
    }))
    .filter((project) => {
      const text = `${project.name} ${project.client} ${project.manager}`.toLowerCase();
      return (!filters.query || text.includes(filters.query.toLowerCase()))
        && (!filters.type || project.projectType === filters.type)
        && (!filters.manager || project.manager === filters.manager)
        && (!filters.updated || (project.updatedAt || '').slice(0, 10) === filters.updated)
        && (!filters.hasDevice || (filters.hasDevice === 'yes' ? project.deviceCount > 0 : project.deviceCount === 0))
        && (!filters.hasDelivery || (filters.hasDelivery === 'yes' ? project.deliveryCount > 0 : project.deliveryCount === 0));
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')), [state.projects, state.locations, state.devices, state.deliveryPlans, filters]);
  const paged = usePaged(rows, 10);
  const editing = modal?.id ? state.projects.find((item) => item.id === modal.id) : null;
  const save = (form) => {
    const timestamp = nowText();
    if (editing) dispatch({ type: 'UPDATE_PROJECT', payload: { id: editing.id, ...form, updatedAt: timestamp } });
    else {
      const id = `PROJ-${String(Math.max(0, ...state.projects.map((item) => Number(String(item.id).replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
      dispatch({ type: 'ADD_PROJECT', payload: { id, ...form, createdAt: timestamp, updatedAt: timestamp, members: [{ name: form.manager, role: '项目负责人' }] } });
      dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, projectId: id, operator: state.currentUser, timestamp, actionType: '新建项目', module: '项目中心', notes: form.name } });
    }
    if (editing) dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, projectId: editing.id, operator: state.currentUser, timestamp, actionType: '编辑项目', module: '项目中心', notes: '更新项目基础信息' } });
    setModal(null);
  };
  return (
    <Page>
      <PageHeader title="项目列表" description="查看平台项目，并从项目详情维护点位、设备归属和交付执行。" actions={<Btn variant="primary" onClick={() => setModal({ type: 'create' })}>新建项目</Btn>} />
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 个项目</span>}>
        <SearchInput className="w-64" placeholder="搜索项目名称 / 客户 / 负责人" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.type} onChange={(event) => update('type', event.target.value)}><option value="">全部项目类型</option>{PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.manager} onChange={(event) => update('manager', event.target.value)}><option value="">全部负责人</option>{managers.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.hasDevice} onChange={(event) => update('hasDevice', event.target.value)}><option value="">设备关联不限</option><option value="yes">已关联设备</option><option value="no">未关联设备</option></Select>
        <Select value={filters.hasDelivery} onChange={(event) => update('hasDelivery', event.target.value)}><option value="">交付执行不限</option><option value="yes">存在交付执行</option><option value="no">暂无交付执行</option></Select>
        <Input type="date" value={filters.updated} onChange={(event) => update('updated', event.target.value)} />
      </Toolbar>
      <Table head={['项目名称', '项目类型 / 业务场景', '项目负责人', '点位数量', '设备数量', '最近更新时间', '操作']} empty="暂无符合条件的项目" footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((project) => (
          <tr key={project.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/projects/${project.id}`}>{project.name}</Link></td>
            <td className="px-3 py-2 text-gray-600">{project.projectType || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{project.manager || '—'}</td>
            <td className="px-3 py-2 text-gray-600">{project.pointCount}</td>
            <td className="px-3 py-2 text-gray-600">{project.deviceCount}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{project.updatedAt || '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction to={`/projects/${project.id}`}>查看详情</LinkAction><LinkAction onClick={() => setModal({ type: 'edit', id: project.id })}>编辑项目</LinkAction></div></td>
          </tr>
        ))}
      </Table>
      <Modal size="lg" isOpen={!!modal} onClose={() => setModal(null)} title={editing ? '编辑项目' : '新建项目'}><ProjectForm project={editing} state={state} onClose={() => setModal(null)} onSave={save} /></Modal>
    </Page>
  );
}

function DeliveryForm({ plan, state, onClose, onSave }) {
  const isEdit = !!plan;
  const existingReference = plan?.erpReferenceNo ? `${plan.erpReferenceType}::${plan.erpReferenceNo}` : '';
  const [form, setForm] = useState({
    title: plan?.title || plan?.name || '',
    projectId: plan?.projectId || '',
    locationId: plan?.locationId || '',
    boundDeviceIds: plan?.boundDeviceIds || [],
    owner: plan?.owner || state.currentUser,
    demandDescription: plan?.demandDescription || '',
    feishuDemandUrl: plan?.feishuDemandUrl || '',
    notes: plan?.notes || '',
    erpReference: existingReference,
  });
  const [errors, setErrors] = useState({});
  const [deviceQuery, setDeviceQuery] = useState('');
  const references = deliveryErpReferences();
  const users = state.users.filter((item) => item.status !== '停用');
  const locations = state.locations.filter((item) => item.projectId === form.projectId && !item.disabled);
  const occupied = new Set(state.deliveryPlans.filter((item) => item.id !== plan?.id).flatMap((item) => item.boundDeviceIds || []));
  const devices = state.devices.filter((device) => device.projectId === form.projectId
    && device.locationId === form.locationId
    && device.erpInboundNo
    && isProductionComplete(device)
    && (!occupied.has(device.id) || form.boundDeviceIds.includes(device.id))
    && (!deviceQuery || `${device.sn} ${device.robotNo}`.toLowerCase().includes(deviceQuery.toLowerCase())));
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const toggleDevice = (id) => update('boundDeviceIds', form.boundDeviceIds.includes(id)
    ? form.boundDeviceIds.filter((item) => item !== id)
    : [...form.boundDeviceIds, id]);
  const submit = () => {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = '请填写交付执行名称。';
    if (!form.owner) nextErrors.owner = '请选择负责人。';
    if (!isEdit && !form.projectId) nextErrors.projectId = '请选择项目。';
    if (!isEdit && !form.locationId) nextErrors.locationId = '请选择点位。';
    if (!isEdit && !form.boundDeviceIds.length) nextErrors.boundDeviceIds = '请至少选择一台设备。';
    if (form.feishuDemandUrl && !/^https?:\/\/\S+$/i.test(form.feishuDemandUrl)) nextErrors.feishuDemandUrl = '请输入有效的 http 或 https 链接。';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const [erpReferenceType = '', erpReferenceNo = ''] = form.erpReference.split('::');
    onSave({ ...form, erpReferenceType, erpReferenceNo });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800">基础信息</h3>
        <div>
          <label className="block text-xs text-gray-600 mb-1">交付执行名称 <span className="text-red-500">*</span></label>
          <Input className="w-full" value={form.title} onChange={(event) => update('title', event.target.value)} />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
        </div>
        {!isEdit && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">项目 <span className="text-red-500">*</span></label>
              <Select className="w-full" value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value, locationId: '', boundDeviceIds: [] }))}>
                <option value="">请选择项目</option>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              {errors.projectId && <p className="text-xs text-red-600 mt-1">{errors.projectId}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">点位 <span className="text-red-500">*</span></label>
              <Select className="w-full" value={form.locationId} onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value, boundDeviceIds: [] }))}>
                <option value="">请选择点位</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              {errors.locationId && <p className="text-xs text-red-600 mt-1">{errors.locationId}</p>}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-xs text-gray-600">关联设备 <span className="text-red-500">*</span></label>
              <Input className="w-48" placeholder="搜索设备 SN / 机器人编号" value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200">
              {devices.length ? <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="p-2 text-left">选择</th><th className="p-2 text-left">设备 SN</th><th className="p-2 text-left">机器人编号</th><th className="p-2 text-left">型号</th><th className="p-2 text-left">ERP 入库</th><th className="p-2 text-left">项目 / 点位</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{devices.map((device) => (
                  <tr key={device.id}>
                    <td className="p-2"><input type="checkbox" checked={form.boundDeviceIds.includes(device.id)} onChange={() => toggleDevice(device.id)} /></td>
                    <td className="p-2 font-mono">{device.sn}</td><td className="p-2 font-mono text-gray-500">{device.robotNo}</td>
                    <td className="p-2 text-gray-600">{state.deviceTypes.find((item) => item.id === device.deviceTypeId)?.name || '—'}</td>
                    <td className="p-2 text-gray-600">已关联</td>
                    <td className="p-2 text-gray-500">{state.projects.find((item) => item.id === device.projectId)?.name || '—'} / {state.locations.find((item) => item.id === device.locationId)?.name || '—'}</td>
                  </tr>
                ))}</tbody>
              </table> : <p className="text-xs text-gray-400 py-6 text-center">当前点位暂无符合生产、入库和占用条件的可选设备</p>}
            </div>
            <p className="text-xs text-gray-500 mt-2">已选择 {form.boundDeviceIds.length} 台设备</p>
            {errors.boundDeviceIds && <p className="text-xs text-red-600 mt-1">{errors.boundDeviceIds}</p>}
          </div>
        </>}
        {isEdit && <p className="text-xs text-gray-500">项目、点位和设备关系请在交付执行详情中单独调整。</p>}
        <div>
          <label className="block text-xs text-gray-600 mb-1">负责人 <span className="text-red-500">*</span></label>
          <Select className="w-full" value={form.owner} onChange={(event) => update('owner', event.target.value)}>
            <option value="">请选择负责人</option>{users.map((item) => <option key={item.id} value={item.name}>{item.name} · {item.dept}</option>)}
          </Select>
          {errors.owner && <p className="text-xs text-red-600 mt-1">{errors.owner}</p>}
        </div>
        <div><label className="block text-xs text-gray-600 mb-1">交付需求说明</label><textarea className="ui-input w-full min-h-20" value={form.demandDescription} onChange={(event) => update('demandDescription', event.target.value)} /></div>
        <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      </div>

      <div className="rounded-md border border-gray-200 p-4 space-y-4">
        <h3 className="text-[13px] font-semibold text-gray-800">可选来源引用</h3>
        <div>
          <label className="block text-xs text-gray-600 mb-1">相关飞书需求链接</label>
          <Input className="w-full" value={form.feishuDemandUrl} onChange={(event) => update('feishuDemandUrl', event.target.value)} placeholder="https://" />
          {errors.feishuDemandUrl && <p className="text-xs text-red-600 mt-1">{errors.feishuDemandUrl}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">ERP 销售发货单或调拨订单</label>
          <Select className="w-full" value={form.erpReference} onChange={(event) => update('erpReference', event.target.value)}>
            <option value="">暂不关联</option>
            {references.map((item) => <option key={`${item.type}-${item.no}`} value={`${item.type}::${item.no}`}>{item.type} · {item.no} · {item.date}{item.summary ? ` · ${item.summary}` : ''}</option>)}
          </Select>
          {!references.length && <p className="text-xs text-gray-400 mt-1">当前没有可关联的 ERP 来源单据。</p>}
          <p className="text-xs text-gray-400 mt-1">仅选择当前原型已有只读单据，具体关联方式以 ERP API 和研发联调结果为准。</p>
        </div>
      </div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{isEdit ? '保存基础信息' : '新建交付执行'}</Btn></div>
    </div>
  );
}

function DeliveryList() {
  const { state, dispatch } = useApp();
  const [filters, setFilters] = useState({ query: '', projectId: '', locationId: '', deviceSN: '', owner: '', result: '', exception: '', sort: 'desc' });
  const [modal, setModal] = useState(null);
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const rows = useMemo(() => state.deliveryPlans
    .map((plan) => {
      const project = state.projects.find((item) => item.id === plan.projectId);
      const location = state.locations.find((item) => item.id === plan.locationId);
      const devices = state.devices.filter((item) => (plan.boundDeviceIds || []).includes(item.id));
      const exceptionCount = state.deliveryExceptions.filter((item) => item.deliveryPlanId === plan.id).length;
      return { ...plan, projectName: project?.name || '—', locationName: location?.name || '—', devices, exceptionCount };
    })
    .filter((plan) => {
      const text = `${plan.id} ${plan.title || plan.name}`.toLowerCase();
      const result = deliveryResult(plan);
      return (!filters.query || text.includes(filters.query.toLowerCase()))
        && (!filters.projectId || plan.projectId === filters.projectId)
        && (!filters.locationId || plan.locationId === filters.locationId)
        && (!filters.deviceSN || plan.devices.some((device) => device.sn.toLowerCase().includes(filters.deviceSN.toLowerCase())))
        && (!filters.owner || plan.owner === filters.owner)
        && (!filters.result || (filters.result === 'none' ? !result : result === filters.result))
        && (!filters.exception || (filters.exception === 'yes' ? plan.exceptionCount > 0 : plan.exceptionCount === 0));
    })
    .sort((a, b) => filters.sort === 'asc'
      ? (a.updatedAt || a.createdAt || '').localeCompare(b.updatedAt || b.createdAt || '')
      : (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')), [state, filters]);
  const paged = usePaged(rows, 10);
  const editing = modal?.id ? state.deliveryPlans.find((item) => item.id === modal.id) : null;
  const availableLocations = state.locations.filter((item) => !filters.projectId || item.projectId === filters.projectId);
  const owners = [...new Set(state.deliveryPlans.map((item) => item.owner).filter(Boolean))];

  const save = (form) => {
    const timestamp = nowText();
    const { erpReference, ...payload } = form;
    if (editing) {
      const { projectId, locationId, boundDeviceIds, ...base } = payload;
      dispatch({ type: 'UPDATE_DELIVERY_PLAN', payload: {
        id: editing.id, ...base, name: base.title, updatedAt: timestamp,
        operationLogs: [...(editing.operationLogs || []), { id: `DLOG-${Date.now()}`, time: timestamp, operator: state.currentUser, action: '编辑基础信息', notes: '更新交付执行基础信息' }],
      } });
      dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, deliveryPlanId: editing.id, projectId: editing.projectId, operator: state.currentUser, timestamp, actionType: '编辑交付执行基础信息', module: '项目中心', notes: base.title } });
    } else {
      const id = `DE-${String(Math.max(0, ...state.deliveryPlans.map((item) => Number(String(item.id).replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
      dispatch({ type: 'ADD_DELIVERY_PLAN', payload: {
        id, ...payload, name: payload.title, createdBy: state.currentUser, createdAt: timestamp, updatedAt: timestamp,
        records: { binding: payload.boundDeviceIds.map((deviceId) => ({ id: `BIND-${id}-${deviceId}`, deviceId, locationId: payload.locationId, operator: state.currentUser, time: timestamp })) },
        executionRecords: [], deliveryResult: null,
        operationLogs: [{ id: `DLOG-${Date.now()}`, time: timestamp, operator: state.currentUser, action: '新建交付执行', notes: payload.title }],
      } });
      dispatch({ type: 'ADD_OPERATION_LOG', payload: { id: `LOG-${Date.now()}`, deliveryPlanId: id, projectId: payload.projectId, operator: state.currentUser, timestamp, actionType: '新建交付执行', module: '项目中心', notes: payload.title } });
      payload.boundDeviceIds.forEach((deviceId) => {
        const device = state.devices.find((item) => item.id === deviceId);
        dispatch({ type: 'UPDATE_DEVICE', payload: { id: deviceId, deliveryPlanId: id, deliveryPlanIds: [...new Set([...(device.deliveryPlanIds || []), id])], updatedAt: timestamp } });
      });
    }
    setModal(null);
  };

  return (
    <Page>
      <PageHeader title="交付执行" description="建立和维护轻量交付执行记录；ERP 发货或调拨单仅作为可选来源参考。" actions={<Btn variant="primary" onClick={() => setModal({ type: 'create' })}>新建交付执行</Btn>} />
      <p className="text-xs text-gray-400">当前暂未定义统一交付状态，页面仅展示交付执行信息、交付结果和异常记录。</p>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 条交付执行</span>}>
        <SearchInput className="w-52" placeholder="交付执行名称 / 编号" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        <Select value={filters.projectId} onChange={(event) => setFilters((prev) => ({ ...prev, projectId: event.target.value, locationId: '' }))}><option value="">全部项目</option>{state.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={filters.locationId} onChange={(event) => update('locationId', event.target.value)}><option value="">全部点位</option>{availableLocations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Input className="w-36" placeholder="设备 SN" value={filters.deviceSN} onChange={(event) => update('deviceSN', event.target.value)} />
        <Select value={filters.owner} onChange={(event) => update('owner', event.target.value)}><option value="">全部负责人</option>{owners.map((item) => <option key={item}>{item}</option>)}</Select>
        <Select value={filters.result} onChange={(event) => update('result', event.target.value)}><option value="">交付结果不限</option><option>通过</option><option>未通过</option><option value="none">暂无结果</option></Select>
        <Select value={filters.exception} onChange={(event) => update('exception', event.target.value)}><option value="">异常记录不限</option><option value="yes">存在异常记录</option><option value="no">暂无异常记录</option></Select>
        <Select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="desc">最近更新优先</option><option value="asc">较早更新优先</option></Select>
      </Toolbar>
      <Table head={['交付执行名称 / 编号', '项目', '点位', '关联设备', '交付结果', '异常记录', '负责人', '最近更新时间', '操作']} empty="暂无交付执行记录" footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}>
        {paged.pageItems.map((plan) => {
          const result = deliveryResult(plan);
          const deviceText = plan.devices.length > 1 ? `${plan.devices[0]?.sn} 等 ${plan.devices.length} 台` : plan.devices[0]?.sn || '—';
          return (
            <tr key={plan.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2"><Link className="ui-link font-medium" to={`/delivery-plans/${plan.id}`}>{plan.title || plan.name}</Link><div className="font-mono text-[11px] text-gray-400 mt-0.5">{plan.id}</div></td>
              <td className="px-3 py-2 text-gray-600">{plan.projectName}</td><td className="px-3 py-2 text-gray-600">{plan.locationName}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">{deviceText}</td>
              <td className="px-3 py-2">{result ? <StatusBadge status={result} /> : <span className="text-gray-400">暂无结果</span>}</td>
              <td className="px-3 py-2">{plan.exceptionCount ? <Link className="ui-link text-[13px]" to={`/delivery-plans/${plan.id}?tab=exceptions`}>{plan.exceptionCount} 条</Link> : <span className="text-gray-400">暂无</span>}</td>
              <td className="px-3 py-2 text-gray-600">{plan.owner || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{plan.updatedAt || '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-3"><LinkAction to={`/delivery-plans/${plan.id}`}>查看详情</LinkAction><LinkAction onClick={() => setModal({ type: 'edit', id: plan.id })}>编辑基础信息</LinkAction></div></td>
            </tr>
          );
        })}
      </Table>
      <Modal size="xl" isOpen={!!modal} onClose={() => setModal(null)} title={editing ? '编辑交付执行基础信息' : '新建交付执行'}>
        <DeliveryForm plan={editing} state={state} onClose={() => setModal(null)} onSave={save} />
      </Modal>
    </Page>
  );
}

export default function ProjectsCenter() {
  const [searchParams] = useSearchParams();
  return searchParams.get('tab') === 'delivery' ? <DeliveryList /> : <ProjectList />;
}
