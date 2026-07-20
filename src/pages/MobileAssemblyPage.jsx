// 移动端 / H5 装配登记：工厂人员在装配现场扫码完成设备与模块绑定。
// ERP 提供物料/批次/库存/入库/检验来源数据；平台记录设备SN、槽位、模块SN、绑定人、时间、异常。
// 平台不修改 ERP 单据与库存主账。此为原型演示：扫码用下拉/手输模拟。
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { assemblyTemplateFor, deviceModuleBindings, platformOccupancyStatus } from '../utils/status';

const field = (label, value) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-[#f2f2f2] last:border-0">
    <span className="text-xs text-gray-400">{label}</span>
    <span className="text-[13px] text-gray-800 text-right">{value ?? '—'}</span>
  </div>
);

export default function MobileAssemblyPage() {
  const { state } = useApp();
  const devices = state.devices || [];
  const deviceTypes = state.deviceTypes || [];
  const moduleTypes = state.moduleTypes || [];
  const moduleInstances = state.moduleInstances || [];
  const plans = state.workflowProductionPlans || [];
  const batches = state.materialBatches || [];

  const [mode, setMode] = useState('device'); // device | module
  const [deviceId, setDeviceId] = useState('');
  const [slotName, setSlotName] = useState('');
  const [moduleSel, setModuleSel] = useState('');
  const [note, setNote] = useState('');
  const [bound, setBound] = useState({}); // 本地模拟已绑定 { 'devId:slot': moduleSN }
  const [toast, setToast] = useState('');
  const [scanModuleId, setScanModuleId] = useState('');

  const device = devices.find((d) => d.id === deviceId);
  const dt = device ? deviceTypes.find((t) => t.id === device.deviceTypeId) : null;
  const plan = device ? plans.find((p) => p.id === device.productionPlanId) : null;
  const template = assemblyTemplateFor(dt, moduleTypes);
  const bindings = device ? deviceModuleBindings(device, deviceTypes, moduleTypes, moduleInstances, state.moduleReplacements || [], batches) : [];
  const slot = template.find((s) => s.slotName === slotName);
  const localKey = (sn) => `${deviceId}:${sn}`;

  // 可选模块：在库可用、类型匹配当前槽位
  const availModules = moduleInstances.filter((mi) => platformOccupancyStatus(mi) === '在库可用' && (!slot || mi.moduleTypeId === slot.moduleTypeId));
  const selModule = moduleInstances.find((mi) => mi.id === moduleSel || mi.sn === moduleSel);
  const selBatch = selModule ? batches.find((b) => b.id === selModule.sourceBatchId) : null;

  const doBind = () => {
    if (!device || !slot || !selModule) return;
    setBound((prev) => ({ ...prev, [localKey(slot.slotName)]: selModule.sn }));
    setToast(`已登记：${device.sn} · ${slot.slotName} ← ${selModule.sn}`);
    setModuleSel(''); setNote(''); setSlotName('');
    setTimeout(() => setToast(''), 2600);
  };

  const bindStatusOf = (row) => bound[localKey(row.slotName)] ? '已绑定' : row.bindStatus;

  // 反扫：扫描模块二维码
  const scanned = moduleInstances.find((mi) => mi.id === scanModuleId || mi.sn === scanModuleId);
  const scannedPlatform = scanned ? platformOccupancyStatus(scanned) : null;
  const scannedDevice = scanned ? devices.find((d) => d.id === scanned.boundDeviceId) : null;

  return (
    <div className="w-full min-h-screen bg-[#f2f3f5] flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-sm">
        {/* 顶部 */}
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/15 flex items-center justify-center text-xs font-bold">质</div>
          <div className="text-sm font-semibold">移动端装配登记</div>
        </div>

        {/* 模式切换 */}
        <div className="flex gap-1 p-1 m-3 bg-gray-100 rounded-lg">
          {[['device', '先扫设备'], ['module', '先扫模块']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex-1 py-1.5 rounded-md text-[13px] ${mode === k ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>

        <div className="flex-1 px-3 pb-6 space-y-3 overflow-y-auto">
          {mode === 'device' ? (
            <>
              {/* 扫设备 */}
              <div className="border border-[#ececec] rounded-lg p-3">
                <div className="text-[13px] font-semibold text-gray-700 mb-2">① 扫描设备二维码</div>
                <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setSlotName(''); }} className="ui-input w-full">
                  <option value="">📷 模拟扫码 · 选择设备 SN</option>
                  {devices.filter((d) => deviceLifecycleIsProd(d)).map((d) => <option key={d.id} value={d.id}>{d.sn}</option>)}
                </select>
              </div>

              {device && (
                <>
                  {/* 设备信息区 */}
                  <div className="border border-[#ececec] rounded-lg p-3">
                    <div className="text-[13px] font-semibold text-gray-700 mb-1">设备信息</div>
                    {field('设备 SN', device.sn)}
                    {field('机器人型号', dt?.name || '—')}
                    {field('所属生产计划', plan?.name || device.productionPlanId || '—')}
                    {field('当前状态', <StatusBadge status={device.status} />)}
                    {field('装配模板', `${dt?.name || ''} 装配模板`)}
                    {field('装配进度', `${bindings.filter((b) => bindStatusOf(b) === '已绑定' || b.bindStatus === '已更换').length} / ${bindings.length}`)}
                  </div>

                  {/* 槽位选择区 */}
                  <div className="border border-[#ececec] rounded-lg p-3">
                    <div className="text-[13px] font-semibold text-gray-700 mb-2">② 选择待绑定槽位</div>
                    <div className="space-y-1.5">
                      {bindings.map((b) => {
                        const st = bindStatusOf(b);
                        const done = st === '已绑定' || b.bindStatus === '已更换';
                        return (
                          <button key={b.slotName} disabled={done}
                            onClick={() => setSlotName(b.slotName)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md border text-left ${slotName === b.slotName ? 'border-gray-900 bg-gray-50' : 'border-[#ececec]'} ${done ? 'opacity-60' : 'hover:bg-gray-50'}`}>
                            <span className="text-[13px] text-gray-800">{b.slotName}<span className="text-xs text-gray-400 ml-1.5">{b.corePartType}</span></span>
                            <StatusBadge status={st === '待绑定' ? '待绑定' : (done ? '已绑定' : st)} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 模块扫描区 */}
                  {slot && (
                    <div className="border border-[#ececec] rounded-lg p-3">
                      <div className="text-[13px] font-semibold text-gray-700 mb-2">③ 扫描模块二维码 · {slot.slotName}</div>
                      <select value={moduleSel} onChange={(e) => setModuleSel(e.target.value)} className="ui-input w-full mb-2">
                        <option value="">📷 模拟扫码 / 手动录入模块 SN</option>
                        {availModules.map((mi) => <option key={mi.id} value={mi.id}>{mi.sn}</option>)}
                      </select>
                      {selModule && (
                        <div className="bg-[#fafafa] rounded-md p-2.5 mt-1">
                          {field('模块 SN / 内部 ID', selModule.sn)}
                          {field('核心部件类型', slot.corePartType)}
                          {field('物料编码', selModule.materialCode || selBatch?.id || '—')}
                          {field('物料名称', selModule.materialName || (selBatch ? `${selBatch.category} ${selBatch.model}` : '—'))}
                          {field('批次号', selModule.batchNo || selBatch?.batchNo || '—')}
                          {field('ERP 入库状态', selModule.erpInboundStatus || '已入库')}
                          {field('ERP 检验状态', selModule.erpInspectionStatus || '检验合格')}
                          {field('ERP 库存状态', selModule.erpStockStatus || '合格可用')}
                          {field('平台占用状态', <StatusBadge status={platformOccupancyStatus(selModule)} />)}
                          <div className="mt-1 text-xs text-green-600">✓ 类型匹配、在库可用，满足可装配条件</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 提交 */}
                  {slot && selModule && (
                    <div className="border border-[#ececec] rounded-lg p-3">
                      <div className="text-[13px] font-semibold text-gray-700 mb-2">④ 提交绑定</div>
                      {field('绑定人', state.currentUser || '张三')}
                      {field('绑定时间', '扫码提交时生成')}
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="异常说明（可选）" className="ui-input w-full mt-2" style={{ height: 56, paddingTop: 6 }} />
                      <button className="mt-2 w-full h-9 rounded-md border border-dashed border-gray-300 text-gray-500 text-[13px]">＋ 上传附件（现场照片）</button>
                      <button onClick={doBind} className="mt-2 w-full h-10 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-black">确认绑定</button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* 先扫模块 */}
              <div className="border border-[#ececec] rounded-lg p-3">
                <div className="text-[13px] font-semibold text-gray-700 mb-2">扫描模块 / 核心部件二维码</div>
                <select value={scanModuleId} onChange={(e) => setScanModuleId(e.target.value)} className="ui-input w-full">
                  <option value="">📷 模拟扫码 · 选择模块 SN</option>
                  {moduleInstances.slice(0, 40).map((mi) => <option key={mi.id} value={mi.id}>{mi.sn}</option>)}
                </select>
              </div>
              {scanned && (
                <div className="border border-[#ececec] rounded-lg p-3">
                  <div className="text-[13px] font-semibold text-gray-700 mb-1">模块详情</div>
                  {field('模块 SN / 内部 ID', scanned.sn)}
                  {field('核心部件类型', (moduleTypes.find((t) => t.id === scanned.moduleTypeId)?.category) || scanned.category)}
                  {field('物料编码', scanned.materialCode || scanned.sourceBatchId || '—')}
                  {field('批次号', scanned.batchNo || '—')}
                  {field('ERP 库存状态', scanned.erpStockStatus || '合格可用')}
                  {field('平台占用状态', <StatusBadge status={scannedPlatform} />)}
                  <div className="mt-2 text-[13px]">
                    {scannedPlatform === '在库可用' && <div className="text-blue-600">请继续扫描设备二维码，或选择待绑定设备与槽位。</div>}
                    {scannedPlatform === '已绑定设备' && (
                      <div className="bg-[#fafafa] rounded-md p-2.5">
                        {field('当前绑定设备 SN', scannedDevice?.sn || '—')}
                        {field('绑定槽位', scanned.boundSlot || '—')}
                        {field('绑定时间', scanned.bindTime || '—')}
                        {field('绑定人', scanned.binder || '—')}
                      </div>
                    )}
                    {['绑定异常', '旧件待返修'].includes(scannedPlatform) && <div className="text-red-600">模块状态异常（{scanned.exceptionNote || scannedPlatform}），不允许绑定。</div>}
                  </div>
                </div>
              )}
            </>
          )}

          <p className="text-[11px] text-gray-400 leading-relaxed px-1">
            工厂人员在装配现场通过移动端扫码完成设备与模块绑定。ERP 提供物料、批次、库存、入库和检验等来源数据；平台记录设备 SN、槽位、模块 SN / 内部 ID、绑定人、绑定时间和异常说明。平台不修改 ERP 单据和库存主账。
          </p>
        </div>

        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[13px] px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
      </div>
    </div>
  );
}

// 仅列出仍在生产阶段的设备用于装配登记
function deviceLifecycleIsProd(d) {
  return !['在线运营', '已停用', '已作废', '退役', '已报废'].includes(d.status);
}
