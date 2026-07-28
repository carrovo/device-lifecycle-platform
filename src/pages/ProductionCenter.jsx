import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Pagination, usePaged } from '../components/Pagination';
import {
  PRODUCTION_STEPS,
  SHARED_FEISHU_TABLES,
  currentNodeResult,
  effectiveProductionHistory,
  getProductionKey,
  getRepairStatus,
  hasPendingProductionException,
  isProductionComplete,
  productionLabel,
  productionProgressLabel,
  repairStatusLabel,
} from '../data/prdV12';
import {
  Page, PageHeader, Section, Toolbar, SearchInput, Select, Input,
  Table, Chip, Stepper, Btn, LinkAction, DescList, EmptyState,
} from '../components/ui';

const TABS = [
  { key: 'archive', label: '设备建档' },
  { key: 'flow', label: '生产流转' },
];

const FLOW_TABS = [
  { key: 'inProcess', label: '在制设备' },
  { key: 'pendingInbound', label: '待产品入库' },
];

const DETAIL_TABS = [
  { key: 'history', label: '生产履历' },
  { key: 'logs', label: '操作日志' },
];

const nowText = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const modelName = (device, types) => types.find((item) => item.id === device.deviceTypeId)?.name || '—';
const nextKey = (key) => PRODUCTION_STEPS[PRODUCTION_STEPS.findIndex((item) => item.key === key) + 1]?.key || null;
const isTestNode = (key) => PRODUCTION_STEPS.find((item) => item.key === key)?.kind === 'test';
const enteredProduction = (device) => getProductionKey(device) !== 'leg'
  || isProductionComplete(device)
  || effectiveProductionHistory(device).some((record) => record.result !== '已建档');

function SimpleTabs({ items, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`px-3 py-2 text-[13px] border-b-2 ${
            active === item.key
              ? 'border-gray-900 text-gray-900 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ResultChoice({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {['Pass', 'NG'].map((option) => {
        const selected = value === option;
        const positive = option === 'Pass';
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`h-10 rounded-md border text-[13px] font-medium ${
              selected
                ? positive
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function StandardFlow({ current }) {
  return (
    <div className="flex items-center overflow-x-auto">
      {PRODUCTION_STEPS.map((step, index) => (
        <div key={step.key} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center gap-1.5 min-w-[88px] px-1">
            <div className="w-6 h-6 rounded-full border border-gray-300 bg-white text-gray-700 flex items-center justify-center text-xs font-semibold">
              {index + 1}
            </div>
            <span className={`text-[11px] text-center whitespace-nowrap ${current === step.key ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {step.label}
            </span>
          </div>
          {index < PRODUCTION_STEPS.length - 1 && <div className="h-px w-8 sm:w-12 flex-shrink-0 -mt-4 bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

function DeviceForm({ device, correction = false, deviceTypes, devices, onClose, onSave }) {
  const [form, setForm] = useState({
    sn: device?.sn || '',
    robotNo: device?.robotNo || '',
    deviceTypeId: device?.deviceTypeId || deviceTypes[0]?.id || '',
    correctionReason: '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.sn.trim() || !form.robotNo.trim() || !form.deviceTypeId) {
      setError('请完整填写设备 SN、机器人编号和设备型号。');
      return;
    }
    if (correction && !form.correctionReason.trim()) {
      setError('更正设备型号时必须填写更正原因。');
      return;
    }
    const duplicate = devices.some((item) => item.id !== device?.id
      && (item.sn.toLowerCase() === form.sn.trim().toLowerCase()
        || item.robotNo.toLowerCase() === form.robotNo.trim().toLowerCase()));
    if (duplicate) {
      setError('设备 SN 或机器人编号已存在。');
      return;
    }
    onSave({ ...form, sn: form.sn.trim(), robotNo: form.robotNo.trim() });
  };
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">设备进入立腿状态后建档。设备 SN 是履历主识别口径，机器人编号是唯一辅助标识。</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">设备 SN <span className="text-red-500">*</span></label>
          <Input className="w-full" value={form.sn} disabled={correction} onChange={(event) => update('sn', event.target.value)} placeholder="用于识别设备完整履历" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">机器人编号 <span className="text-red-500">*</span></label>
          <Input className="w-full" value={form.robotNo} disabled={correction} onChange={(event) => update('robotNo', event.target.value)} placeholder="同一设备的唯一辅助标识" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">设备型号 <span className="text-red-500">*</span></label>
        <Select className="w-full" value={form.deviceTypeId} onChange={(event) => update('deviceTypeId', event.target.value)}>
          {deviceTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </div>
      {correction && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">更正原因 <span className="text-red-500">*</span></label>
          <textarea className="ui-input w-full min-h-20" value={form.correctionReason} onChange={(event) => update('correctionReason', event.target.value)} />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>取消</Btn>
        <Btn variant="primary" onClick={submit}>{device ? correction ? '提交设备信息更正' : '保存设备档案' : '创建设备档案'}</Btn>
      </div>
    </div>
  );
}

function ArchiveTab({ state, dispatch, setSearchParams }) {
  const [filters, setFilters] = useState({ query: '', entered: '', model: '', sort: 'desc' });
  const [modal, setModal] = useState(null);
  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const rows = useMemo(() => state.devices
    .filter((device) => {
      const text = `${device.sn} ${device.robotNo} ${modelName(device, state.deviceTypes)}`.toLowerCase();
      const entered = enteredProduction(device);
      return (!filters.query || text.includes(filters.query.toLowerCase()))
        && (!filters.entered || (filters.entered === 'yes' ? entered : !entered))
        && (!filters.model || device.deviceTypeId === filters.model);
    })
    .sort((a, b) => filters.sort === 'asc'
      ? (a.createdAt || '').localeCompare(b.createdAt || '')
      : (b.createdAt || '').localeCompare(a.createdAt || '')), [state.devices, state.deviceTypes, filters]);
  const paged = usePaged(rows, 10);
  const selected = modal?.id ? state.devices.find((item) => item.id === modal.id) : null;

  const addLog = (deviceId, actionType, notes, timestamp = nowText()) => {
    dispatch({ type: 'ADD_OPERATION_LOG', payload: {
      id: `LOG-${Date.now()}-${deviceId}`, deviceId, operator: state.currentUser, timestamp,
      actionType, module: '生产中心', notes,
    } });
  };
  const createDevice = (form) => {
    const createdAt = nowText();
    const id = `DEV-${String(Math.max(0, ...state.devices.map((item) => Number(String(item.id).replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`;
    dispatch({ type: 'ADD_DEVICE', payload: {
      id, sn: form.sn, robotNo: form.robotNo, deviceTypeId: form.deviceTypeId,
      status: '立腿状态', productionStatus: 'leg', currentProductionNode: 'leg',
      productionComplete: false, repairStatus: 'none', archiveStatus: '有效',
      assembler: state.currentUser, createdAt, updatedAt: createdAt, projectId: null, locationId: null,
      erpInboundNo: '', erpBatchNo: '', electronicAcceptanceUrl: '', otherFeishuTables: [], deliveryPlanIds: [],
      productionHistory: [{
        id: `PH-${id}-archive`, node: 'leg', nodeLabel: '立腿状态', recordType: 'node',
        result: '已建档', operator: state.currentUser, time: createdAt,
        summary: '设备进入立腿状态，建立平台设备档案',
      }],
    } });
    addLog(id, '设备建档', `建立设备档案 ${form.sn}`, createdAt);
    setModal({ type: 'created', id, sn: form.sn });
  };
  const updateDevice = (form) => {
    const timestamp = nowText();
    dispatch({ type: 'UPDATE_DEVICE', payload: {
      id: selected.id, sn: form.sn, robotNo: form.robotNo,
      deviceTypeId: form.deviceTypeId, updatedAt: timestamp,
    } });
    addLog(selected.id, '编辑设备档案', `更新设备 SN、机器人编号或设备型号`, timestamp);
    setModal(null);
  };
  const correctDevice = (form) => {
    const timestamp = nowText();
    dispatch({ type: 'UPDATE_DEVICE', payload: { id: selected.id, deviceTypeId: form.deviceTypeId, updatedAt: timestamp } });
    addLog(selected.id, '更正设备信息', `更正设备型号；原因：${form.correctionReason}`, timestamp);
    setModal(null);
  };
  const removeDevice = () => {
    dispatch({ type: 'DELETE_DEVICE', payload: selected.id });
    setModal(null);
  };
  const operationLabel = (device) => {
    if (device.erpInboundNo || device.projectId) return '查看建档信息';
    if (enteredProduction(device)) return '更正信息';
    return '编辑';
  };

  return (
    <>
      <Section title="设备建档" subtitle="设备进入立腿状态后，由人员在平台建立档案">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-gray-600">建档仅维护设备 SN、机器人编号和设备型号，不绑定项目、点位或 ERP 入库信息。</p>
          <Btn variant="primary" onClick={() => setModal({ type: 'create' })}>新建设备</Btn>
        </div>
      </Section>
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 台设备</span>}>
        <SearchInput className="w-64" placeholder="设备 SN / 机器人编号 / 型号" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
        <Select value={filters.entered} onChange={(event) => updateFilter('entered', event.target.value)}>
          <option value="">全部</option><option value="yes">已进入生产</option><option value="no">未进入生产</option>
        </Select>
        <Select value={filters.model} onChange={(event) => updateFilter('model', event.target.value)}>
          <option value="">全部设备型号</option>{state.deviceTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
          <option value="desc">最新建档</option><option value="asc">最早建档</option>
        </Select>
      </Toolbar>
      <Table
        head={['设备 SN', '机器人编号', '设备型号', '是否进入生产流转', '建档人', '建档时间', '档案状态', '操作']}
        empty="暂无设备档案"
        footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}
      >
        {paged.pageItems.map((device) => (
          <tr key={device.id} className="hover:bg-[#fafafa]">
            <td className="px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">{device.sn}</td>
            <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{device.robotNo}</td>
            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{modelName(device, state.deviceTypes)}</td>
            <td className="px-3 py-2"><StatusBadge status={enteredProduction(device) ? '已进入生产' : '未进入生产'} /></td>
            <td className="px-3 py-2 text-gray-600">{device.assembler || '—'}</td>
            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{device.createdAt || '—'}</td>
            <td className="px-3 py-2"><StatusBadge status={device.archiveStatus || '有效'} /></td>
            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center gap-3">
                <LinkAction onClick={() => setModal({
                  type: device.erpInboundNo || device.projectId ? 'view' : enteredProduction(device) ? 'correct' : 'edit',
                  id: device.id,
                })}>{operationLabel(device)}</LinkAction>
                {!enteredProduction(device) && <LinkAction className="text-red-600" onClick={() => setModal({ type: 'delete', id: device.id })}>删除</LinkAction>}
                <LinkAction onClick={() => setSearchParams({ tab: 'flow', device: device.id })}>进入生产流转</LinkAction>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal isOpen={modal?.type === 'create'} onClose={() => setModal(null)} title="新建设备档案" size="lg">
        <DeviceForm devices={state.devices} deviceTypes={state.deviceTypes} onClose={() => setModal(null)} onSave={createDevice} />
      </Modal>
      <Modal isOpen={modal?.type === 'edit'} onClose={() => setModal(null)} title="编辑设备档案" size="lg">
        {selected && <DeviceForm device={selected} devices={state.devices} deviceTypes={state.deviceTypes} onClose={() => setModal(null)} onSave={updateDevice} />}
      </Modal>
      <Modal isOpen={modal?.type === 'correct'} onClose={() => setModal(null)} title="更正设备信息" size="lg">
        {selected && <DeviceForm correction device={selected} devices={state.devices} deviceTypes={state.deviceTypes} onClose={() => setModal(null)} onSave={correctDevice} />}
      </Modal>
      <Modal isOpen={modal?.type === 'view'} onClose={() => setModal(null)} title="设备建档信息">
        {selected && <DescList cols={2} items={[
          ['设备 SN', selected.sn], ['机器人编号', selected.robotNo],
          ['设备型号', modelName(selected, state.deviceTypes)], ['建档人', selected.assembler],
          ['建档时间', selected.createdAt], ['档案状态', selected.archiveStatus || '有效'],
        ]} />}
      </Modal>
      <Modal isOpen={modal?.type === 'delete'} onClose={() => setModal(null)} title="删除错误档案">
        {selected && <div className="space-y-4">
          <p className="text-[13px] text-gray-600">该设备尚未进入生产流转，可以删除错误档案。此操作仅用于尚未产生后续记录的设备。</p>
          <div className="flex justify-end gap-2"><Btn onClick={() => setModal(null)}>取消</Btn><Btn variant="danger" onClick={removeDevice}>确认删除</Btn></div>
        </div>}
      </Modal>
      <Modal isOpen={modal?.type === 'created'} onClose={() => setModal(null)} title="设备档案已创建">
        <div className="space-y-4">
          <p className="text-[13px] text-gray-600">设备 {modal?.sn} 已完成建档，可以进入生产流转维护立腿状态。</p>
          <div className="flex justify-end gap-2"><Btn onClick={() => setModal(null)}>稍后处理</Btn><Btn variant="primary" onClick={() => setSearchParams({ tab: 'flow', device: modal.id })}>进入生产流转</Btn></div>
        </div>
      </Modal>
    </>
  );
}

function NonTestForm({ device, onSave }) {
  const currentResult = currentNodeResult(device);
  const hasRecordedException = currentResult === '已记录异常';
  const [checkedNormal, setCheckedNormal] = useState(false);
  const [exceptionNote, setExceptionNote] = useState('');
  const [handlingNote, setHandlingNote] = useState('');
  const [error, setError] = useState('');
  const recordException = () => {
    if (!exceptionNote.trim()) {
      setError('请填写当前节点异常说明。');
      return;
    }
    onSave({ action: 'exception', exceptionNote: exceptionNote.trim() });
  };
  const complete = () => {
    if (!checkedNormal) {
      setError('请先勾选“已检查，当前节点无异常”。');
      return;
    }
    if (hasRecordedException && !handlingNote.trim()) {
      setError('该节点此前已记录异常，请补充异常处理说明。');
      return;
    }
    onSave({ action: 'complete', handlingNote: handlingNote.trim() });
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-md border border-gray-200 p-4 space-y-3">
          <h3 className="text-[13px] font-medium text-gray-800">节点异常记录</h3>
          <textarea className="ui-input w-full min-h-24" value={exceptionNote} onChange={(event) => setExceptionNote(event.target.value)} placeholder="填写当前节点发现的异常" />
          <Btn onClick={recordException}>记录当前节点异常</Btn>
        </div>
        <div className="rounded-md border border-gray-200 p-4 space-y-3">
          <h3 className="text-[13px] font-medium text-gray-800">节点完成确认</h3>
          <label className="flex items-center gap-2 text-[13px] text-gray-700">
            <input type="checkbox" checked={checkedNormal} onChange={(event) => setCheckedNormal(event.target.checked)} />
            已检查，当前节点无异常
          </label>
          {hasRecordedException && <textarea className="ui-input w-full min-h-20" value={handlingNote} onChange={(event) => setHandlingNote(event.target.value)} placeholder="补充此前异常的处理说明" />}
          <Btn variant="primary" onClick={complete}>确认完成当前节点</Btn>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TestForm({ device, node, onSave }) {
  const [form, setForm] = useState({ result: 'Pass', testSummary: '', ngReason: '', repairRequired: true, notes: '' });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.testSummary.trim()) {
      setError('请填写测试关键结果。');
      return;
    }
    if (form.result === 'NG' && !form.ngReason.trim()) {
      setError('测试结果为 NG 时必须填写 NG 原因。');
      return;
    }
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-600 mb-2">测试结果 <span className="text-red-500">*</span></label><ResultChoice value={form.result} onChange={(value) => update('result', value)} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">测试关键结果 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={form.testSummary} onChange={(event) => update('testSummary', event.target.value)} /></div>
      {form.result === 'NG' && <>
        <div><label className="block text-xs text-gray-600 mb-1">NG 原因 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={form.ngReason} onChange={(event) => update('ngReason', event.target.value)} /></div>
        <label className="flex items-center gap-2 text-[13px] text-gray-700"><input type="checkbox" checked={form.repairRequired} onChange={(event) => update('repairRequired', event.target.checked)} />需要返修</label>
      </>}
      <div><label className="block text-xs text-gray-600 mb-1">结果说明</label><textarea className="ui-input w-full min-h-16" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end"><Btn variant="primary" onClick={submit}>提交{productionLabel(node)}结果</Btn></div>
    </div>
  );
}

function RepairForm({ device, onSave }) {
  const [form, setForm] = useState({
    repairSummary: '', hasReplacement: false, replacementSummary: '', retestResult: 'Pass', retestNotes: '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.repairSummary.trim()) {
      setError('请填写返修摘要。');
      return;
    }
    if (form.hasReplacement && !form.replacementSummary.trim()) {
      setError('涉及换件时必须填写换件摘要。');
      return;
    }
    onSave(form);
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-600 mb-1">返修摘要 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={form.repairSummary} onChange={(event) => update('repairSummary', event.target.value)} /></div>
      <label className="flex items-center gap-2 text-[13px] text-gray-700"><input type="checkbox" checked={form.hasReplacement} onChange={(event) => update('hasReplacement', event.target.checked)} />涉及换件</label>
      {form.hasReplacement && <div><label className="block text-xs text-gray-600 mb-1">换件摘要 <span className="text-red-500">*</span></label><Input className="w-full" value={form.replacementSummary} onChange={(event) => update('replacementSummary', event.target.value)} /></div>}
      <div><label className="block text-xs text-gray-600 mb-2">复测结果</label><ResultChoice value={form.retestResult} onChange={(value) => update('retestResult', value)} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">复测说明</label><textarea className="ui-input w-full min-h-16" value={form.retestNotes} onChange={(event) => update('retestNotes', event.target.value)} /></div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end"><Btn variant="primary" onClick={submit}>提交返修及复测结果</Btn></div>
    </div>
  );
}

function RevisionForm({ record, onClose, onSave }) {
  const [result, setResult] = useState(record.result);
  const [summary, setSummary] = useState(record.summary || '');
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <DescList cols={2} items={[
        ['原测试结果', record.result], ['原结果说明', record.summary || record.ngReason || '—'],
      ]} />
      <div><label className="block text-xs text-gray-600 mb-2">修正后测试结果</label><ResultChoice value={result} onChange={setResult} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">修正后说明</label><textarea className="ui-input w-full min-h-20" value={summary} onChange={(event) => setSummary(event.target.value)} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">修改原因 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!reason.trim()} onClick={() => onSave({ result, summary, reason })}>提交结果修订</Btn></div>
    </div>
  );
}

function CorrectionNoteForm({ onClose, onSave }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">更正说明只追加到历史记录，不改变节点原完成时间和已完成事实。</p>
      <div><label className="block text-xs text-gray-600 mb-1">更正说明 <span className="text-red-500">*</span></label><textarea className="ui-input w-full min-h-24" value={note} onChange={(event) => setNote(event.target.value)} /></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!note.trim()} onClick={() => onSave(note.trim())}>追加更正说明</Btn></div>
    </div>
  );
}

function AcceptanceLinkForm({ device, onClose, onSave, onDelete }) {
  const [url, setUrl] = useState(device.electronicAcceptanceUrl || '');
  const [error, setError] = useState('');
  const submit = () => {
    if (!/^https?:\/\/\S+$/i.test(url.trim())) {
      setError('请输入有效的 http 或 https 链接。');
      return;
    }
    onSave(url.trim());
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-600 mb-1">电子验收单链接 <span className="text-red-500">*</span></label><Input className="w-full" value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} placeholder="https://" />{error && <p className="text-xs text-red-600 mt-1">{error}</p>}</div>
      <div className="flex justify-between gap-2">
        <div>{device.electronicAcceptanceUrl && <Btn variant="danger" onClick={onDelete}>删除错误链接</Btn>}</div>
        <div className="flex gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" disabled={!url.trim()} onClick={submit}>保存电子验收单</Btn></div>
      </div>
    </div>
  );
}

function OtherFeishuForm({ record, onClose, onSave }) {
  const [form, setForm] = useState({ name: record?.name || '', url: record?.url || '', note: record?.note || '' });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('请填写表格名称和飞书链接。');
      return;
    }
    if (/^\d+$/.test(form.name.trim())) {
      setError('请填写有意义的表格名称。');
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(form.url.trim())) {
      setError('请输入有效的 http 或 https 链接。');
      return;
    }
    onSave({ ...form, name: form.name.trim(), url: form.url.trim(), note: form.note.trim() });
  };
  return (
    <div className="space-y-4">
      <div><label className="block text-xs text-gray-600 mb-1">表格名称 <span className="text-red-500">*</span></label><Input className="w-full" value={form.name} onChange={(event) => update('name', event.target.value)} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">飞书链接 <span className="text-red-500">*</span></label><Input className="w-full" value={form.url} onChange={(event) => update('url', event.target.value)} placeholder="https://" /></div>
      <div><label className="block text-xs text-gray-600 mb-1">备注</label><textarea className="ui-input w-full min-h-20" value={form.note} onChange={(event) => update('note', event.target.value)} /></div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>取消</Btn><Btn variant="primary" onClick={submit}>{record ? '保存表格信息' : '添加飞书表格'}</Btn></div>
    </div>
  );
}

function ProductionHistoryTable({ device, onRevise, onCorrect }) {
  const records = effectiveProductionHistory(device);
  const visible = [];
  PRODUCTION_STEPS.forEach((step) => {
    const nodeRecords = records.filter((record) => record.node === step.key && record.recordType !== 'repair');
    const effective = nodeRecords.at(-1);
    if (effective && effective.result !== '已建档') visible.push(effective);
    records.filter((record) => record.node === step.key && record.recordType === 'repair').forEach((record) => visible.push(record));
  });
  const canRevise = (record) => {
    const recordIndex = PRODUCTION_STEPS.findIndex((step) => step.key === record.node);
    const laterNodeStarted = records.some((item) =>
      item.recordType !== 'repair'
      && item.result !== '已建档'
      && PRODUCTION_STEPS.findIndex((step) => step.key === item.node) > recordIndex
    );
    return isTestNode(record.node)
      && !laterNodeStarted
      && !device.erpInboundNo
      && !device.projectId
      && !device.deliveryPlanIds?.length;
  };

  return (
    <Table head={['节点', '处理结果', '结果摘要', '返修 / 换件', '复测结果', '操作人', '操作时间', '操作']} empty="暂无生产履历">
      {visible.map((record) => (
        <tr key={record.id} className="hover:bg-[#fafafa]">
          <td className="px-3 py-2 text-gray-700">{record.nodeLabel || productionLabel(record.node)}{record.revisions?.length ? <Chip className="ml-2">已修订</Chip> : null}</td>
          <td className="px-3 py-2"><StatusBadge status={record.result || '已完成'} /></td>
          <td className="px-3 py-2 text-xs text-gray-600">
            {record.ngReason || record.summary || '—'}
            {record.corrections?.length ? <div className="text-gray-400 mt-1">更正：{record.corrections.at(-1).note}</div> : null}
          </td>
          <td className="px-3 py-2 text-xs text-gray-500">{[record.repairSummary, record.replacementSummary].filter(Boolean).join('；') || '—'}</td>
          <td className="px-3 py-2">{record.retestResult ? <StatusBadge status={record.retestResult} /> : '—'}</td>
          <td className="px-3 py-2 text-gray-600">{record.operator || '—'}</td>
          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{record.time || '—'}</td>
          <td className="px-3 py-2 whitespace-nowrap">
            {record.recordType === 'repair'
              ? '—'
              : isTestNode(record.node)
                ? canRevise(record) ? <LinkAction onClick={() => onRevise(record)}>修改结果</LinkAction> : <span className="text-xs text-gray-400">不可修改</span>
                : record.result === '已完成' ? <LinkAction onClick={() => onCorrect(record)}>追加更正说明</LinkAction> : '—'}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function FeishuRelations({ device, setModal }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-semibold text-gray-800">相关飞书表格</h3>
        <Btn size="sm" onClick={() => setModal({ type: 'otherFeishu' })}>添加其他飞书表格</Btn>
      </div>
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">常用飞书表格</h3>
          <div className="divide-y divide-gray-100">
            {SHARED_FEISHU_TABLES.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[13px] text-gray-700">{item.name}</span>
                <a className="ui-link text-[13px]" href={item.url} target="_blank" rel="noreferrer">打开表格</a>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-[13px] text-gray-700">电子验收单</span>
              <div className="flex items-center gap-3">
                {device.electronicAcceptanceUrl
                  ? <a className="ui-link text-[13px]" href={device.electronicAcceptanceUrl} target="_blank" rel="noreferrer">打开记录</a>
                  : <span className="text-xs text-gray-400">暂无设备专属记录。</span>}
                <LinkAction onClick={() => setModal({ type: 'acceptance' })}>{device.electronicAcceptanceUrl ? '编辑' : '新增'}</LinkAction>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">其他飞书表格</h3>
          {(device.otherFeishuTables || []).length ? (
            <div className="divide-y divide-gray-100">
              {device.otherFeishuTables.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-2">
                  <div><p className="text-[13px] text-gray-700">{item.name}</p>{item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}</div>
                  <div className="flex items-center gap-3">
                    <a className="ui-link text-[13px]" href={item.url} target="_blank" rel="noreferrer">打开表格</a>
                    <LinkAction onClick={() => setModal({ type: 'otherFeishu', record: item })}>编辑</LinkAction>
                    <LinkAction className="text-red-600" onClick={() => setModal({ type: 'deleteOtherFeishu', record: item })}>删除</LinkAction>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400 py-2">暂无其他飞书表格。</p>}
        </div>
      </div>
    </div>
  );
}

function ErpRelation({ device }) {
  return (
    <div className="border-t border-gray-200 pt-5">
      <h3 className="text-[13px] font-semibold text-gray-800 mb-3">ERP 产品入库关联信息</h3>
      {device.erpInboundNo ? (
        <DescList cols={3} items={[
          ['关联情况', '已关联'], ['产品入库单编号', device.erpInboundNo],
          ['ERP 序列号', device.erpSerialNo || device.sn], ['平台设备 SN', device.sn],
          ['ERP 批次号', device.erpBatchNo || device.robotNo], ['机器人编号', device.robotNo],
          ['匹配时间', device.inboundTime || device.updatedAt || '—'],
        ]} />
      ) : isProductionComplete(device) ? (
        <p className="text-[13px] text-gray-500 leading-6">
          当前设备已完成生产关键节点，正在等待 ERP 产品入库数据。平台将按序列号与设备 SN 进行匹配，匹配成功后更新入库关联情况。
        </p>
      ) : <p className="text-[13px] text-gray-500">当前设备尚未完成终测，暂无 ERP 产品入库关联信息。</p>}
    </div>
  );
}

function FlowDetail({ device, state, dispatch, setSearchParams }) {
  const [active, setActive] = useState('history');
  const [modal, setModal] = useState(null);
  const currentKey = getProductionKey(device);
  const repairStatus = getRepairStatus(device);
  const history = effectiveProductionHistory(device);
  const completed = isProductionComplete(device);
  const logs = state.operationLogs
    .filter((item) => item.deviceId === device.id && (item.module === '生产中心' || /(生产|测试|返修|飞书|节点|设备建档|设备信息)/.test(item.actionType || '')))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  const addLog = (actionType, notes, fromStatus = productionProgressLabel(device), toStatus = fromStatus, timestamp = nowText()) => {
    dispatch({ type: 'ADD_OPERATION_LOG', payload: {
      id: `LOG-${Date.now()}-${Math.random()}`, deviceId: device.id, operator: state.currentUser, timestamp,
      actionType, module: '生产中心', fromStatus, toStatus, notes,
    } });
  };
  const updateDevice = (payload) => dispatch({ type: 'UPDATE_DEVICE', payload: { id: device.id, ...payload } });

  const saveNonTest = (form) => {
    const timestamp = nowText();
    if (form.action === 'exception') {
      const record = {
        id: `PH-${device.id}-${Date.now()}`, node: currentKey, nodeLabel: productionLabel(currentKey),
        recordType: 'node', result: '已记录异常', summary: form.exceptionNote,
        operator: state.currentUser, time: timestamp,
      };
      updateDevice({ productionHistory: [...history, record], updatedAt: timestamp });
      addLog('记录当前节点异常', form.exceptionNote, productionLabel(currentKey), productionLabel(currentKey), timestamp);
      return;
    }
    const next = nextKey(currentKey);
    const record = {
      id: `PH-${device.id}-${Date.now()}`, node: currentKey, nodeLabel: productionLabel(currentKey),
      recordType: 'node', result: '已完成', confirmed: true,
      summary: form.handlingNote || '已检查，当前节点无异常',
      resolved: true, operator: state.currentUser, time: timestamp,
    };
    updateDevice({
      productionStatus: next || currentKey, currentProductionNode: next || currentKey,
      productionHistory: [...history, record], updatedAt: timestamp,
    });
    addLog('确认完成当前节点', record.summary, productionLabel(currentKey), productionLabel(next || currentKey), timestamp);
  };

  const saveTest = (form) => {
    const timestamp = nowText();
    const pass = form.result === 'Pass';
    const next = pass ? nextKey(currentKey) : null;
    const finishesProduction = pass && currentKey === 'final';
    const record = {
      id: `PH-${device.id}-${Date.now()}`, node: currentKey, nodeLabel: productionLabel(currentKey),
      recordType: 'node', result: form.result, summary: form.testSummary,
      ngReason: form.result === 'NG' ? form.ngReason : '', repairRequired: form.result === 'NG' && form.repairRequired,
      notes: form.notes, operator: state.currentUser, time: timestamp,
    };
    updateDevice({
      productionStatus: finishesProduction ? 'final' : next || currentKey,
      currentProductionNode: finishesProduction ? 'final' : next || currentKey,
      productionComplete: finishesProduction,
      failedNode: form.result === 'NG' ? currentKey : null,
      repairStatus: form.result === 'NG' && form.repairRequired ? 'inProgress' : 'none',
      productionHistory: [...history, record], updatedAt: timestamp,
    });
    addLog(`提交${productionLabel(currentKey)}结果`, `${form.result}；${form.testSummary}`, productionLabel(currentKey), finishesProduction ? '生产已完成' : productionLabel(next || currentKey), timestamp);
  };

  const saveRepair = (form) => {
    const timestamp = nowText();
    const failedNode = device.failedNode || currentKey;
    const pass = form.retestResult === 'Pass';
    const next = pass ? nextKey(failedNode) : failedNode;
    const finishesProduction = pass && failedNode === 'final';
    const record = {
      id: `PH-${device.id}-${Date.now()}`, node: failedNode, nodeLabel: `${productionLabel(failedNode)}返修 / 复测`,
      recordType: 'repair', result: pass ? '返修完成' : '返修中',
      repairSummary: form.repairSummary, replacementSummary: form.hasReplacement ? form.replacementSummary : '',
      retestResult: form.retestResult, summary: form.retestNotes, operator: state.currentUser, time: timestamp,
    };
    updateDevice({
      productionStatus: finishesProduction ? 'final' : next,
      currentProductionNode: finishesProduction ? 'final' : next,
      productionComplete: finishesProduction,
      repairStatus: pass ? 'retested' : 'inProgress',
      failedNode: pass ? null : failedNode,
      productionHistory: [...history, record], updatedAt: timestamp,
    });
    addLog('提交返修及复测结果', `${form.retestResult}；${form.repairSummary}`, productionLabel(failedNode), finishesProduction ? '生产已完成' : productionLabel(next), timestamp);
  };

  const reviseResult = ({ result, summary, reason }) => {
    const record = modal.record;
    const timestamp = nowText();
    const revisedHistory = history.map((item) => item.id === record.id ? {
      ...item,
      result,
      summary,
      ngReason: result === 'NG' ? summary : '',
      revisions: [...(item.revisions || []), {
        result: item.result, summary: item.summary || item.ngReason || '', reason,
        operator: state.currentUser, time: timestamp,
      }],
      operator: state.currentUser,
    } : item);
    const revisedComplete = record.node === 'final' && result === 'Pass';
    const revisedNode = result === 'Pass' ? nextKey(record.node) || record.node : record.node;
    updateDevice({
      productionHistory: revisedHistory,
      productionComplete: revisedComplete,
      productionStatus: revisedNode,
      currentProductionNode: revisedNode,
      failedNode: result === 'NG' ? record.node : null,
      repairStatus: result === 'NG' ? 'inProgress' : getRepairStatus(device) === 'inProgress' ? 'none' : getRepairStatus(device),
      updatedAt: timestamp,
    });
    addLog('测试结果修订', `${productionLabel(record.node)}：${record.result} 修订为 ${result}；原因：${reason}`, productionLabel(currentKey), productionLabel(currentKey), timestamp);
    setModal(null);
  };

  const addCorrection = (note) => {
    const timestamp = nowText();
    const record = modal.record;
    const revisedHistory = history.map((item) => item.id === record.id
      ? { ...item, corrections: [...(item.corrections || []), { note, operator: state.currentUser, time: timestamp }] }
      : item);
    updateDevice({ productionHistory: revisedHistory, updatedAt: timestamp });
    addLog('追加节点更正说明', `${productionLabel(record.node)}：${note}`, productionProgressLabel(device), productionProgressLabel(device), timestamp);
    setModal(null);
  };

  const saveAcceptance = (url) => {
    const timestamp = nowText();
    const action = device.electronicAcceptanceUrl ? '编辑飞书链接' : '新增飞书链接';
    updateDevice({ electronicAcceptanceUrl: url, updatedAt: timestamp });
    addLog(action, '电子验收单', productionProgressLabel(device), productionProgressLabel(device), timestamp);
    setModal(null);
  };
  const deleteAcceptance = () => {
    const timestamp = nowText();
    updateDevice({ electronicAcceptanceUrl: '', updatedAt: timestamp });
    addLog('删除飞书链接', '删除错误的电子验收单链接', productionProgressLabel(device), productionProgressLabel(device), timestamp);
    setModal(null);
  };
  const saveOtherFeishu = (form) => {
    const timestamp = nowText();
    const existing = modal.record;
    const records = existing
      ? (device.otherFeishuTables || []).map((item) => item.id === existing.id ? { ...item, ...form } : item)
      : [...(device.otherFeishuTables || []), { id: `FS-${device.id}-${Date.now()}`, ...form }];
    updateDevice({ otherFeishuTables: records, updatedAt: timestamp });
    addLog(existing ? '编辑飞书链接' : '新增飞书链接', form.name, productionProgressLabel(device), productionProgressLabel(device), timestamp);
    setModal(null);
  };
  const deleteOtherFeishu = () => {
    const timestamp = nowText();
    updateDevice({ otherFeishuTables: (device.otherFeishuTables || []).filter((item) => item.id !== modal.record.id), updatedAt: timestamp });
    addLog('删除飞书链接', modal.record.name, productionProgressLabel(device), productionProgressLabel(device), timestamp);
    setModal(null);
  };

  return (
    <>
      <PageHeader
        breadcrumb={<button className="ui-link text-[13px]" onClick={() => setSearchParams({ tab: 'flow' })}>‹ 返回生产流转</button>}
        title={device.sn}
        description={`${device.robotNo} · ${modelName(device, state.deviceTypes)}`}
      />
      <Section title="设备摘要">
        <DescList cols={3} items={[
          ['设备 SN', device.sn],
          ['机器人编号', device.robotNo],
          ['设备型号', modelName(device, state.deviceTypes)],
          ['当前生产节点', completed ? '生产已完成' : productionLabel(currentKey)],
          ['当前节点结果', completed ? 'Pass' : currentNodeResult(device)],
          ['返修情况', repairStatusLabel(device)],
        ]} />
      </Section>
      <Section title="标准生产节点">
        <Stepper steps={PRODUCTION_STEPS} current={currentKey} />
      </Section>

      {!completed && (
        <Section title={`当前生产操作 · ${repairStatus === 'inProgress' ? '返修及复测' : productionLabel(currentKey)}`}>
          {repairStatus === 'inProgress'
            ? <RepairForm device={device} onSave={saveRepair} />
            : isTestNode(currentKey)
              ? <TestForm device={device} node={currentKey} onSave={saveTest} />
              : <NonTestForm device={device} onSave={saveNonTest} />}
        </Section>
      )}
      {completed && !device.erpInboundNo && (
        <Section title="当前生产操作 · 生产已完成">
          <p className="text-[13px] text-gray-600 leading-6">当前设备已完成生产关键节点，正在等待 ERP 产品入库数据。平台将按序列号与设备 SN 进行匹配，匹配成功后更新入库状态。</p>
        </Section>
      )}
      {completed && device.erpInboundNo && <Section title="当前生产操作 · 生产已完成"><p className="text-[13px] text-gray-500">当前设备生产流程已完成，生产履历可在下方查看。</p></Section>}

      <Section title="关联记录">
        <div className="space-y-5">
          <FeishuRelations device={device} setModal={setModal} />
          <ErpRelation device={device} />
        </div>
      </Section>
      <SimpleTabs items={DETAIL_TABS} active={active} onChange={setActive} />
      {active === 'history' && (
        <ProductionHistoryTable
          device={device}
          onRevise={(record) => setModal({ type: 'revision', record })}
          onCorrect={(record) => setModal({ type: 'correction', record })}
        />
      )}
      {active === 'logs' && (
        <Table head={['操作时间', '操作人', '操作动作', '操作摘要']} empty="暂无生产操作日志">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{log.timestamp || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{log.operator || '—'}</td>
              <td className="px-3 py-2 text-gray-700">{log.actionType || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{log.notes || '—'}</td>
            </tr>
          ))}
        </Table>
      )}

      <Modal isOpen={modal?.type === 'revision'} onClose={() => setModal(null)} title="修订测试结果" size="lg">
        {modal?.record && <RevisionForm record={modal.record} onClose={() => setModal(null)} onSave={reviseResult} />}
      </Modal>
      <Modal isOpen={modal?.type === 'correction'} onClose={() => setModal(null)} title="追加节点更正说明">
        <CorrectionNoteForm onClose={() => setModal(null)} onSave={addCorrection} />
      </Modal>
      <Modal isOpen={modal?.type === 'acceptance'} onClose={() => setModal(null)} title="维护电子验收单" size="lg">
        <AcceptanceLinkForm device={device} onClose={() => setModal(null)} onSave={saveAcceptance} onDelete={deleteAcceptance} />
      </Modal>
      <Modal isOpen={modal?.type === 'otherFeishu'} onClose={() => setModal(null)} title={modal?.record ? '编辑其他飞书表格' : '添加其他飞书表格'} size="lg">
        <OtherFeishuForm record={modal?.record} onClose={() => setModal(null)} onSave={saveOtherFeishu} />
      </Modal>
      <Modal isOpen={modal?.type === 'deleteOtherFeishu'} onClose={() => setModal(null)} title="删除其他飞书表格">
        <div className="space-y-4">
          <p className="text-[13px] text-gray-600">确认删除“{modal?.record?.name}”吗？</p>
          <div className="flex justify-end gap-2"><Btn onClick={() => setModal(null)}>取消</Btn><Btn variant="danger" onClick={deleteOtherFeishu}>确认删除</Btn></div>
        </div>
      </Modal>
    </>
  );
}

function FlowList({ state, setSearchParams }) {
  const [workspace, setWorkspace] = useState('inProcess');
  const [filters, setFilters] = useState({ query: '', node: '', exception: '', repair: '', sort: 'desc' });
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const rows = useMemo(() => state.devices
    .filter((device) => device.archiveStatus !== '已作废')
    .filter((device) => workspace === 'pendingInbound'
      ? isProductionComplete(device) && !device.erpInboundNo
      : !isProductionComplete(device))
    .filter((device) => {
      const text = `${device.sn} ${device.robotNo} ${modelName(device, state.deviceTypes)}`.toLowerCase();
      return (!filters.query || text.includes(filters.query.toLowerCase()))
        && (workspace !== 'inProcess' || !filters.node || getProductionKey(device) === filters.node)
        && (workspace !== 'inProcess' || !filters.exception || (filters.exception === 'yes' ? hasPendingProductionException(device) : !hasPendingProductionException(device)))
        && (workspace !== 'inProcess' || !filters.repair || (filters.repair === 'yes' ? getRepairStatus(device) === 'inProgress' : getRepairStatus(device) !== 'inProgress'));
    })
    .sort((a, b) => filters.sort === 'asc'
      ? (a.updatedAt || '').localeCompare(b.updatedAt || '')
      : (b.updatedAt || '').localeCompare(a.updatedAt || '')), [state.devices, state.deviceTypes, filters, workspace]);
  const paged = usePaged(rows, 10);

  return (
    <>
      <PageHeader title="生产流转" description="围绕在制设备维护五个生产节点、测试关键结果和按需返修复测。" />
      <Section title="标准生产流程" subtitle="返修仅在初测或终测 NG 后按需产生，不进入固定流程编号">
        <StandardFlow />
      </Section>
      <SimpleTabs items={FLOW_TABS} active={workspace} onChange={(value) => {
        setWorkspace(value);
        setFilters({ query: '', node: '', exception: '', repair: '', sort: 'desc' });
      }} />
      <Toolbar right={<span className="text-xs text-gray-400">共 {rows.length} 台设备</span>}>
        <SearchInput className="w-64" placeholder="设备 SN / 机器人编号 / 型号" value={filters.query} onChange={(event) => update('query', event.target.value)} />
        {workspace === 'inProcess' ? <>
          <Select value={filters.node} onChange={(event) => update('node', event.target.value)}>
            <option value="">全部生产节点</option>{PRODUCTION_STEPS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </Select>
          <Select value={filters.exception} onChange={(event) => update('exception', event.target.value)}>
            <option value="">待处理异常不限</option><option value="yes">存在待处理异常</option><option value="no">无待处理异常</option>
          </Select>
          <Select value={filters.repair} onChange={(event) => update('repair', event.target.value)}>
            <option value="">返修情况不限</option><option value="yes">返修中</option><option value="no">非返修中</option>
          </Select>
          <Select value={filters.sort} onChange={(event) => update('sort', event.target.value)}>
            <option value="desc">最近维护优先</option><option value="asc">较早维护优先</option>
          </Select>
        </> : <Select value={filters.sort} onChange={(event) => update('sort', event.target.value)}>
          <option value="desc">终测完成时间从新到旧</option><option value="asc">终测完成时间从旧到新</option>
        </Select>}
      </Toolbar>

      {workspace === 'inProcess' ? (
        <Table
          head={['设备 SN', '机器人编号', '设备型号', '当前生产节点', '当前节点结果', '返修情况', '最近维护人', '最近维护时间', '操作']}
          empty="当前没有在制设备"
          footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}
        >
          {paged.pageItems.map((device) => {
            const latest = [...effectiveProductionHistory(device)].reverse().find((record) => record.operator);
            return (
              <tr key={device.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs text-gray-800">{device.sn}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{device.robotNo}</td>
                <td className="px-3 py-2 text-gray-700">{modelName(device, state.deviceTypes)}</td>
                <td className="px-3 py-2"><Chip>{productionLabel(getProductionKey(device))}</Chip></td>
                <td className="px-3 py-2"><StatusBadge status={currentNodeResult(device)} /></td>
                <td className="px-3 py-2">{repairStatusLabel(device) === '—' ? <span className="text-gray-400">-</span> : <StatusBadge status={repairStatusLabel(device)} />}</td>
                <td className="px-3 py-2 text-gray-600">{latest?.operator || device.assembler || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{device.updatedAt || '—'}</td>
                <td className="px-3 py-2"><LinkAction onClick={() => setSearchParams({ tab: 'flow', device: device.id })}>进入生产流转</LinkAction></td>
              </tr>
            );
          })}
        </Table>
      ) : (
        <Table
          head={['设备 SN', '机器人编号', '设备型号', '终测完成时间', 'ERP 产品入库关联', '最近更新时间', '操作']}
          empty="当前没有待产品入库设备"
          footer={<Pagination {...paged} onChange={paged.setPage} onPageSizeChange={paged.setPageSize} />}
        >
          {paged.pageItems.map((device) => {
            const finalRecord = effectiveProductionHistory(device).filter((record) => record.node === 'final' && record.result === 'Pass').at(-1);
            return (
              <tr key={device.id} className="hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-mono text-xs text-gray-800">{device.sn}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{device.robotNo}</td>
                <td className="px-3 py-2 text-gray-700">{modelName(device, state.deviceTypes)}</td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{finalRecord?.time || device.updatedAt || '—'}</td>
                <td className="px-3 py-2"><span className="text-gray-500">未关联</span></td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{device.updatedAt || '—'}</td>
                <td className="px-3 py-2"><LinkAction onClick={() => setSearchParams({ tab: 'flow', device: device.id })}>查看生产详情</LinkAction></td>
              </tr>
            );
          })}
        </Table>
      )}
      {workspace === 'pendingInbound' && <p className="text-xs text-gray-400">产品入库在 ERP 中完成，平台不提供手动入库或修改 ERP 数据的操作。</p>}
    </>
  );
}

export default function ProductionCenter() {
  const { state, dispatch } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') === 'archive' ? 'archive' : 'flow';
  const deviceId = searchParams.get('device');
  const device = state.devices.find((item) => item.id === deviceId || item.sn === deviceId);

  return (
    <Page>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSearchParams({ tab: tab.key })}
            className={`px-3 py-2 text-[13px] border-b-2 ${
              active === tab.key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active === 'archive'
        ? <ArchiveTab state={state} dispatch={dispatch} setSearchParams={setSearchParams} />
        : device
          ? <FlowDetail device={device} state={state} dispatch={dispatch} setSearchParams={setSearchParams} />
          : <FlowList state={state} setSearchParams={setSearchParams} />}
      {deviceId && !device && <EmptyState>未找到对应设备</EmptyState>}
    </Page>
  );
}
