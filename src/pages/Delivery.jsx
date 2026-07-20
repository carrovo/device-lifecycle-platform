import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const STAGES = ['出厂检验', '现场安装调试', '客户验收'];

function AddDeliveryModal({ isOpen, onClose, onSave, stage, devices, projects }) {
  const [form, setForm] = useState({
    deviceId: '', projectId: '', result: stage === '出厂检验' ? '合格' : '通过',
    operator: '', recordTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    notes: '', address: '', erpAcceptanceNo: '', reportFileName: '', reportLink: '',
  });

  const resultOptions = stage === '出厂检验' ? ['合格', '不合格'] : ['通过', '未通过'];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, stage });
    onClose();
    setForm({ deviceId: '', projectId: '', result: resultOptions[0], operator: '', recordTime: new Date().toISOString().slice(0, 16).replace('T', ' '), notes: '', address: '', erpAcceptanceNo: '', reportFileName: '', reportLink: '' });
  };

  const f = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`新增${stage}记录`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">设备 *</label>
          <select className={inputClass} required {...f('deviceId')}>
            <option value="">-- 选择设备 --</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">所属项目</label>
          <select className={inputClass} {...f('projectId')}>
            <option value="">-- 选择项目 --</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结果 *</label>
            <select className={inputClass} required {...f('result')}>
              {resultOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
            <input type="text" className={inputClass} {...f('operator')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">记录时间</label>
          <input type="text" className={inputClass} {...f('recordTime')} />
        </div>
        {(stage === '现场安装调试' || stage === '客户验收') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">安装地址</label>
            <input type="text" className={inputClass} {...f('address')} />
          </div>
        )}
        {stage === '客户验收' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ERP验收单号</label>
              <input type="text" className={inputClass} placeholder="ERP 验收单号（选填）" {...f('erpAcceptanceNo')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">验收报告</label>
              <div className="space-y-2">
                <input type="text" className={inputClass} placeholder="报告文件名（选填）" {...f('reportFileName')} />
                <input type="text" className={inputClass} placeholder="报告链接（选填）" {...f('reportLink')} />
              </div>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={2} className={inputClass} {...f('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkSubmitModal({ isOpen, onClose, onSave, stage, selectedRecords, getDeviceSN, resultOptions }) {
  const [form, setForm] = useState({
    result: resultOptions[0],
    operator: '',
    recordTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
    setForm({ result: resultOptions[0], operator: '', recordTime: new Date().toISOString().slice(0, 16).replace('T', ' '), notes: '' });
  };

  const f = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`批量提交${stage}结果（${selectedRecords.length}台）`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">已选设备</label>
          <div className="border border-gray-200 rounded px-3 py-2 max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
            {selectedRecords.map((r) => (
              <span key={r.id} className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{getDeviceSN(r.deviceId)}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结果 *</label>
            <select className={inputClass} required {...f('result')}>
              {resultOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
            <input type="text" className={inputClass} {...f('operator')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">记录时间</label>
          <input type="text" className={inputClass} {...f('recordTime')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={2} className={inputClass} {...f('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">确认提交</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ isOpen, onClose, stage, devices, passResult, resultOptions, onImport }) {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');

  const hasAddress = stage !== '出厂检验';
  const headers = hasAddress
    ? ['整机SN', '检验结果', '操作人', '时间', '现场地址', '备注']
    : ['整机SN', '检验结果', '操作人', '时间', '备注'];

  const mockRows = [
    { sn: 'SN-DEV-007', result: passResult, operator: '张三', time: '2026-06-20 09:00', address: '', notes: '批量检验通过', status: 'ok' },
    { sn: 'SN-DEV-008', result: passResult, operator: '张三', time: '2026-06-20 09:15', address: '', notes: '', status: 'ok' },
    { sn: 'SN-DEV-999', result: passResult, operator: '张三', time: '2026-06-20 09:30', address: '', notes: '', status: 'error', errorMsg: '设备不存在' },
  ];

  const displayRows = rows || mockRows;

  const handleDownloadTemplate = () => {
    const example = hasAddress
      ? [['SN-DEV-007', passResult, '张三', '2026-06-20 09:00', '北京市朝阳区示例园区', '示例数据'],
         ['SN-DEV-008', passResult, '张三', '2026-06-20 09:15', '北京市朝阳区示例园区', '']]
      : [['SN-DEV-007', passResult, '张三', '2026-06-20 09:00', '示例数据'],
         ['SN-DEV-008', passResult, '张三', '2026-06-20 09:15', '']];
    const csv = [headers, ...example].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `导入模板_${stage}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateRow = (r) => {
    const dev = devices.find((d) => d.sn === r.sn);
    if (!dev) return { status: 'error', errorMsg: '设备不存在' };
    if (!resultOptions.includes(r.result)) return { status: 'error', errorMsg: '结果值无效' };
    return { status: 'ok' };
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = String(ev.target.result || '');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const dataLines = lines.slice(1); // drop header
      const parsed = dataLines.map((line) => {
        const cells = line.split(',').map((c) => c.trim());
        const r = hasAddress
          ? { sn: cells[0] || '', result: cells[1] || '', operator: cells[2] || '', time: cells[3] || '', address: cells[4] || '', notes: cells[5] || '' }
          : { sn: cells[0] || '', result: cells[1] || '', operator: cells[2] || '', time: cells[3] || '', address: '', notes: cells[4] || '' };
        return { ...r, ...validateRow(r) };
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const hasError = displayRows.some((r) => r.status === 'error');

  const handleClose = () => {
    setStep(1);
    setRows(null);
    setFileName('');
    onClose();
  };

  const handleSubmit = () => {
    const validRows = displayRows.filter((r) => r.status === 'ok');
    onImport(validRows);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`批量导入${stage}记录`} size="xl">
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">下载导入模板，填写完成后上传</p>
          <button onClick={handleDownloadTemplate}
            className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">
            下载导入模板
          </button>
          <div className="text-xs text-gray-400">
            模板列：{headers.join('、')}
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)}
              className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">
              下一步：上传文件
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <input type="file" accept=".csv" onChange={handleFile}
              className="text-sm text-gray-600" />
            {fileName && <span className="ml-2 text-xs text-gray-400">{fileName}</span>}
            {!rows && <p className="text-xs text-gray-400 mt-1">未选择文件，下方显示示例预览数据</p>}
          </div>

          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {[...headers, '状态'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRows.map((r, i) => (
                  <tr key={i} className={r.status === 'error' ? 'bg-red-50' : 'bg-green-50/40'}>
                    <td className="px-3 py-2 font-mono">{r.sn}</td>
                    <td className="px-3 py-2">{r.result}</td>
                    <td className="px-3 py-2">{r.operator}</td>
                    <td className="px-3 py-2">{r.time}</td>
                    {hasAddress && <td className="px-3 py-2">{r.address || '—'}</td>}
                    <td className="px-3 py-2">{r.notes || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.status === 'error'
                        ? <span className="text-red-600 font-medium">{r.errorMsg}</span>
                        : <span className="text-green-600 font-medium">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)}
              className="text-sm text-slate-600 hover:underline">返回上一步</button>
            <button onClick={handleSubmit} disabled={hasError}
              className={`px-4 py-2 text-sm text-white rounded ${hasError ? 'bg-gray-300 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}>
              提交导入
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Delivery() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [activeTab, setActiveTab] = useState('出厂检验');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchSN, setSearchSN] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterResult, setFilterResult] = useState('');

  const { deliveryRecords, devices, projects } = state;

  const allocatedDevices = devices.filter((d) =>
    ['已分配项目', '在线运营'].includes(d.status)
  );

  const getDeviceSN = (id) => devices.find((d) => d.id === id)?.sn || id;
  const getProjectName = (id) => projects.find((p) => p.id === id)?.name || id;

  const filteredRecords = [...deliveryRecords]
    .filter((r) => {
      if (r.stage !== activeTab) return false;
      const sn = getDeviceSN(r.deviceId);
      if (searchSN && !sn.toLowerCase().includes(searchSN.toLowerCase())) return false;
      if (filterProject && r.projectId !== filterProject) return false;
      if (filterResult && r.result !== filterResult) return false;
      return true;
    })
    .sort((a, b) => b.recordTime.localeCompare(a.recordTime));

  const stageResultMap = {
    '出厂检验': ['合格', '不合格'],
    '现场安装调试': ['通过', '未通过'],
    '客户验收': ['通过', '未通过'],
  };

  const handleSave = (form) => {
    dispatch({
      type: 'ADD_DELIVERY_RECORD',
      payload: {
        id: `DELIV-${Date.now()}`,
        ...form,
      },
    });
  };

  const passResult = stageResultMap[activeTab]?.[0];
  const failResult = stageResultMap[activeTab]?.[1];
  const passCount = filteredRecords.filter((r) => r.result === passResult).length;
  const failCount = filteredRecords.filter((r) => r.result === failResult).length;

  const resetSelection = () => setSelectedIds(new Set());
  const toggleSelect = (recId) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(recId) ? next.delete(recId) : next.add(recId);
    return next;
  });
  const allVisibleSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) resetSelection();
    else setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
  };

  const selectedRecords = filteredRecords.filter((r) => selectedIds.has(r.id));

  const handleBulkSubmit = (form) => {
    selectedRecords.forEach((r) => {
      dispatch({
        type: 'ADD_DELIVERY_RECORD',
        payload: {
          id: `DELIV-${Date.now()}-${r.deviceId}`,
          deviceId: r.deviceId,
          projectId: r.projectId,
          stage: activeTab,
          result: form.result,
          operator: form.operator,
          recordTime: form.recordTime,
          notes: form.notes,
          address: r.address || '',
        },
      });
    });
    resetSelection();
  };

  const handleImport = (validRows) => {
    validRows.forEach((r) => {
      const dev = devices.find((d) => d.sn === r.sn);
      dispatch({
        type: 'ADD_DELIVERY_RECORD',
        payload: {
          id: `DELIV-${Date.now()}-${dev?.id || r.sn}`,
          deviceId: dev?.id || r.sn,
          projectId: dev?.projectId || '',
          stage: activeTab,
          result: r.result,
          operator: r.operator || '',
          recordTime: r.time || '',
          notes: r.notes || '',
          address: r.address || '',
        },
      });
    });
    setImportMessage(`成功导入 ${validRows.length} 条记录`);
    setTimeout(() => setImportMessage(''), 3000);
  };

  const handleExport = () => {
    const hasAddress = activeTab !== '出厂检验';
    const headers = ['记录时间', '设备SN', '所属项目', '结果', '操作人', ...(hasAddress ? ['地址'] : []), '备注'];
    const rows = filteredRecords.map((r) => [
      r.recordTime, getDeviceSN(r.deviceId), r.projectId ? getProjectName(r.projectId) : '',
      r.result, r.operator || '', ...(hasAddress ? [r.address || ''] : []), r.notes || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `交付记录_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {importMessage && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white text-sm px-4 py-2.5 rounded shadow-lg">
          {importMessage}
        </div>
      )}
      <h1 className="text-xl font-bold text-gray-800 mb-4">交付流程</h1>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-4">
        {STAGES.map((stage) => {
          const count = deliveryRecords.filter((r) => r.stage === stage).length;
          return (
            <button key={stage} onClick={() => { setActiveTab(stage); setSearchSN(''); setFilterProject(''); setFilterResult(''); setSelectedIds(new Set()); }}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === stage ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {stage}
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded shadow-sm px-4 py-3 mb-3 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="搜索设备SN…" value={searchSN}
          onChange={(e) => { setSearchSN(e.target.value); }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500 w-44" />
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
          <option value="">全部项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-slate-500">
          <option value="">全部结果</option>
          {stageResultMap[activeTab].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => { setSearchSN(''); setFilterProject(''); setFilterResult(''); }}
          className="text-xs text-gray-400 hover:text-gray-600 underline">重置</button>
        <span className="ml-auto text-sm text-gray-400">共 {filteredRecords.length} 条</span>
      </div>

      {/* Stats + action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 font-medium">{passResult}: {passCount}</span>
          <span className="text-red-500 font-medium">{failResult}: {failCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
            批量导出
          </button>
          {canDo('add_delivery') && (
            <button onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
              批量导入
            </button>
          )}
          {canDo('add_delivery') && (
            <button onClick={() => setShowModal(true)}
              className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
              + 新增记录
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded shadow-sm px-4 py-2.5 mb-3 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">已选 {selectedIds.size} 条</span>
          {canDo('add_delivery') && (
            <button onClick={() => setShowBulkModal(true)}
              className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
              批量提交结果
            </button>
          )}
          <button onClick={resetSelection}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50">
            取消选择
          </button>
        </div>
      )}

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} disabled={filteredRecords.length === 0} />
              </th>
              {['记录时间', '设备SN', '所属项目', '结果', '操作人', activeTab !== '出厂检验' ? '地址' : '', '备注'].filter(Boolean).map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecords.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50 ${selectedIds.has(r.id) ? 'bg-slate-50' : ''}`}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{r.recordTime}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium">
                  <Link to={`/devices/${r.deviceId}`} className="text-slate-700 hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {getDeviceSN(r.deviceId)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-600">
                  {r.projectId
                    ? <Link to={`/projects/${r.projectId}`} className="text-slate-700 hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{getProjectName(r.projectId)}</Link>
                    : '—'}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={r.result} /></td>
                <td className="px-4 py-2.5 text-gray-600">{r.operator || '—'}</td>
                {activeTab !== '出厂检验' && <td className="px-4 py-2.5 text-gray-500 text-xs">{r.address || '—'}</td>}
                <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{r.notes || '—'}</td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">暂无{activeTab}记录</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddDeliveryModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          stage={activeTab}
          devices={allocatedDevices}
          projects={projects}
        />
      )}

      {showBulkModal && (
        <BulkSubmitModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          onSave={handleBulkSubmit}
          stage={activeTab}
          selectedRecords={selectedRecords}
          getDeviceSN={getDeviceSN}
          resultOptions={stageResultMap[activeTab]}
        />
      )}

      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          stage={activeTab}
          devices={devices}
          projects={projects}
          passResult={passResult}
          resultOptions={stageResultMap[activeTab]}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
