import { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ModuleDetailDrawer from '../components/ModuleDetailDrawer';
import { Pagination, usePaged } from '../components/Pagination';
import { PageHeader, Section, Toolbar, Select, SearchInput, StatCard, StatGrid, Table, LinkAction, DescList, Chip } from '../components/ui';
import { platformOccupancyStatus } from '../utils/status';

// 物料零部件：两个只读台账区块。
//  区块1 物料信息       —— 供应商来料物料条目，入库 / 库存 / 同步时间以 ERP 为准（平台只读同步）。
//  区块2 核心部件追溯   —— SN 级核心部件（moduleInstances），追踪批次来源、装配绑定、换件与返修。
// 平台不新增 / 编辑 / 删除 ERP 正式单据，本页为只读台账视图。

export default function Materials() {
  const { state } = useApp();
  const materials = state.materials || [];
  const batches = state.materialBatches || [];
  const moduleTypes = state.moduleTypes || [];
  const devices = state.devices || [];
  const deviceTypes = state.deviceTypes || [];
  const replacements = state.moduleReplacements || [];
  const moduleInstances = state.moduleInstances || [];

  // 两区块各自独立的模糊搜索 + 下拉筛选状态。
  const [matQ, setMatQ] = useState('');
  const [matCategory, setMatCategory] = useState('');
  const [matSupplier, setMatSupplier] = useState('');
  const [matInbound, setMatInbound] = useState('');
  const [matStock, setMatStock] = useState('');
  const [matBatch, setMatBatch] = useState('');

  const [partQ, setPartQ] = useState('');
  const [partType, setPartType] = useState('');
  const [partPlatform, setPartPlatform] = useState('');
  const [partBound, setPartBound] = useState('');
  const [partReplaced, setPartReplaced] = useState('');
  const [partRepaired, setPartRepaired] = useState('');
  const [partSupplier, setPartSupplier] = useState('');
  const [partBatch, setPartBatch] = useState('');
  // 抽屉 / 只读 ERP 来源弹窗
  const [drawerModuleId, setDrawerModuleId] = useState(null);
  const [erpModule, setErpModule] = useState(null);

  const batchOf = (id) => batches.find((b) => b.id === id);
  const typeName = (id) => moduleTypes.find((m) => m.id === id)?.name || id || '—';
  const deviceOf = (id) => devices.find((d) => d.id === id);
  // 关联物料编码：核心部件按批次的分类+型号回关到物料条目（原型近似映射），缺失回退 '—'。
  const materialCodeOf = (batch) => (batch ? (materials.find((m) => m.model === batch.model && m.category === batch.category)?.id || '—') : '—');
  const slotNameOf = (device, moduleTypeId) => {
    if (!device) return '—';
    const dt = deviceTypes.find((t) => t.id === device.deviceTypeId);
    return dt?.slots?.find((s) => s.moduleTypeId === moduleTypeId)?.slotName || '—';
  };
  // 下拉选项动态去重（剔除空值与 '—' 占位）；是否类筛选用 全部/是/否。
  const uniq = (arr) => [...new Set(arr.filter((v) => v && v !== '—'))];
  const yesNoMatch = (v, actual) => v === '' || (v === '是' ? !!actual : !actual);

  // ERP 库存显示字段的轻量默认值（无 mock 来源时的安全兜底，不修改 mockData）。
  const INV_ORG = '智元制造库存组织';
  const WHOLE_MODULE_CATS = ['底盘', '机械臂']; // 整机级模块按「台」，其余零部件按「件」
  const unitOf = (cat) => (WHOLE_MODULE_CATS.includes(cat) ? '台' : '件');

  // 概览
  const boundCount = moduleInstances.filter((m) => m.boundDeviceId).length;
  const repairingCount = moduleInstances.filter((m) => /维修|返修/.test(m.status || '')).length;

  /* ── 区块1：物料信息 ── */
  const materialRowsAll = materials.map((m) => ({
    ...m,
    name: `${m.category} ${m.model}`.trim(),
    erpInbound: m.erpInboundStatus ?? '已入库',
    erpStock: m.erpStockStatus ?? (m.inspectionResult === '不合格' ? '不合格' : '合格可用'),
    syncAt: m.updatedAt ?? m.inspectionTime ?? '—',
  }));
  const matCategoryOpts = uniq(materialRowsAll.map((m) => m.category));
  const matSupplierOpts = uniq(materialRowsAll.map((m) => m.supplier));
  const matInboundOpts = uniq(materialRowsAll.map((m) => m.erpInbound));
  const matStockOpts = uniq(materialRowsAll.map((m) => m.erpStock));
  const matBatchOpts = uniq(materialRowsAll.map((m) => m.batchNo));
  const matKw = matQ.trim().toLowerCase();
  const materialRows = materialRowsAll.filter((m) => (!matCategory || m.category === matCategory)
    && (!matSupplier || m.supplier === matSupplier)
    && (!matInbound || m.erpInbound === matInbound)
    && (!matStock || m.erpStock === matStock)
    && (!matBatch || m.batchNo === matBatch)
    && (!matKw || m.id.toLowerCase().includes(matKw) || (m.name || '').toLowerCase().includes(matKw) || (m.model || '').toLowerCase().includes(matKw) || (m.batchNo || '').toLowerCase().includes(matKw)));
  const matPaged = usePaged(materialRows, 8);

  /* ── 区块2：核心部件追溯（ERP 状态 + 平台占用状态 双状态）── */
  const partRowsAll = moduleInstances.map((mi) => {
    const batch = batchOf(mi.sourceBatchId);
    const device = mi.boundDeviceId ? deviceOf(mi.boundDeviceId) : null;
    // 平台占用状态（区别于 ERP 状态）：在库可用/已绑定设备/绑定异常/已更换/旧件待返修/已返修
    const platform = platformOccupancyStatus(mi);
    // 是否换件：换件记录含该模块（作为旧件/新件）或其所在设备发生过换件，或平台已更换
    const replaced = platform === '已更换'
      || replacements.some((r) => r.removedMaterialId === mi.id || r.addedMaterialId === mi.id || (mi.boundDeviceId && r.deviceId === mi.boundDeviceId));
    // 是否返修：平台占用状态处于旧件待返修 / 已返修
    const repaired = ['旧件待返修', '已返修'].includes(platform);
    return {
      ...mi,
      partType: typeName(mi.moduleTypeId),
      materialCode: materialCodeOf(batch),
      name: batch ? `${mi.category} ${batch.model || ''}`.trim() : (mi.category || '—'),
      model: batch?.model || '—',
      supplierName: batch?.supplier || '—',
      batchNo: batch?.batchNo || '—',
      // ERP 库存显示字段：库存组织 / 库存单位 / 主计量 / 生产日期 / 有效期至 无 mock 来源，轻量兜底（不写入 mockData）
      invOrg: INV_ORG,
      warehouse: batch?.warehouse || '原料库',
      unit: unitOf(mi.category),
      qty: 1,
      // 来源 ERP 单据：批次采购订单号优先，回退到货单号
      erpDocNo: batch?.erpPurchaseOrderNo || batch?.erpArrivalNo || '—',
      prodDate: '—',
      expiryDate: '—',
      // ERP 三状态（模块实例缺失时按 ERP 主数据默认回退，与 ModuleDetailDrawer 一致）
      erpInbound: mi.erpInboundStatus ?? '已入库',
      erpInspection: mi.erpInspectionStatus ?? '检验合格',
      erpStock: mi.erpStockStatus ?? '合格可用',
      platform,
      bound: !!mi.boundDeviceId,
      device,
      slot: mi.boundSlot || slotNameOf(device, mi.moduleTypeId),
      binder: mi.binder || device?.assembler || '—',
      bindTime: mi.bindTime || device?.assemblyTime || '—',
      replaced,
      repaired,
      syncAt: mi.updatedAt ?? batch?.inspectionTime ?? '—',
    };
  });
  const partTypeOpts = uniq(partRowsAll.map((p) => p.partType));
  const partPlatformOpts = uniq(partRowsAll.map((p) => p.platform));
  const partSupplierOpts = uniq(partRowsAll.map((p) => p.supplierName));
  const partBatchOpts = uniq(partRowsAll.map((p) => p.batchNo));
  const partKw = partQ.trim().toLowerCase();
  const partRows = partRowsAll.filter((p) => (!partType || p.partType === partType)
    && (!partPlatform || p.platform === partPlatform)
    && yesNoMatch(partBound, p.bound)
    && yesNoMatch(partReplaced, p.replaced)
    && yesNoMatch(partRepaired, p.repaired)
    && (!partSupplier || p.supplierName === partSupplier)
    && (!partBatch || p.batchNo === partBatch)
    && (!partKw || (p.sn || '').toLowerCase().includes(partKw) || (p.id || '').toLowerCase().includes(partKw) || (p.device?.sn || '').toLowerCase().includes(partKw) || (p.materialCode || '').toLowerCase().includes(partKw) || (p.name || '').toLowerCase().includes(partKw)));
  const partPaged = usePaged(partRows, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="物料零部件"
        description="物料信息与核心部件 SN 级追溯。物料编码 / 批次 / 库存 / 入库等字段只读同步自 ERP，本页为只读视图。"
      />

      <StatGrid cols={4}>
        <StatCard label="物料条目" value={materials.length} />
        <StatCard label="核心部件总数" value={moduleInstances.length} />
        <StatCard label="已绑定设备" value={boundCount} tone="success" />
        <StatCard label="维修中部件" value={repairingCount} tone={repairingCount ? 'warning' : 'default'} />
      </StatGrid>

      {/* 区块1 物料信息 */}
      <div className="space-y-3">
        <Toolbar right={<span className="text-xs text-gray-400">共 {materialRows.length} 条 · 只读同步自 ERP</span>}>
          <SearchInput placeholder="搜索物料编码 / 名称 / 型号 / 批次号" value={matQ} onChange={(e) => setMatQ(e.target.value)} className="w-60" />
          <Select value={matCategory} onChange={(e) => setMatCategory(e.target.value)}><option value="">全部分类</option>{matCategoryOpts.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={matSupplier} onChange={(e) => setMatSupplier(e.target.value)}><option value="">全部供应商</option>{matSupplierOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={matInbound} onChange={(e) => setMatInbound(e.target.value)}><option value="">全部入库状态</option>{matInboundOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={matStock} onChange={(e) => setMatStock(e.target.value)}><option value="">全部库存状态</option>{matStockOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={matBatch} onChange={(e) => setMatBatch(e.target.value)}><option value="">全部批次号</option>{matBatchOpts.map((s) => <option key={s}>{s}</option>)}</Select>
        </Toolbar>
        <Section title="物料信息" subtitle={`共 ${materialRows.length} 条 · 物料编码 / 名称 / 规格 / 分类 / 供应商 / 批次 / 入库 / 库存 / 同步时间均为 ERP 只读同步字段`} bodyClassName="p-0">
        <Table
          head={['物料编码', '物料名称', '规格型号', '物料分类', '供应商', '批次号', 'ERP 入库状态', 'ERP 库存状态', '最近同步时间']}
          empty="暂无物料"
          footer={<Pagination page={matPaged.page} total={matPaged.total} totalPages={matPaged.totalPages} onChange={matPaged.setPage} />}
        >
          {matPaged.pageItems.map((m) => (
            <tr key={m.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-mono text-xs text-gray-800 font-medium whitespace-nowrap">{m.id}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{m.name}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{m.model || '—'}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{m.category}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{m.supplier || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{m.batchNo || '—'}</td>
              <td className="px-3 py-2"><StatusBadge status={m.erpInbound} /></td>
              <td className="px-3 py-2 text-xs"><span className={m.erpStock === '不合格' ? 'text-red-600 font-medium' : 'text-gray-600'}>{m.erpStock}</span></td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{m.syncAt}</td>
            </tr>
          ))}
        </Table>
        </Section>
      </div>

      {/* 区块2 核心部件追溯：ERP 状态 + 平台占用状态 双状态 */}
      <div className="space-y-3">
        <div className="bg-white border border-[#ececec] rounded-lg px-4 py-3 text-xs text-gray-500 leading-relaxed">
          ERP 提供正式物料、库存、入库、检验、领料 / 出库主数据；平台记录模块实例在设备装配、换件、返修过程中的占用与绑定关系。平台不直接修改 ERP 库存主账。
        </div>
        <Toolbar right={<span className="text-xs text-gray-400">共 {partRows.length} 个核心部件</span>}>
          <SearchInput placeholder="搜索模块 SN / 内部 ID / 绑定设备 SN / 物料编码 / 名称" value={partQ} onChange={(e) => setPartQ(e.target.value)} className="w-72" />
          <Select value={partType} onChange={(e) => setPartType(e.target.value)}><option value="">全部核心部件类型</option>{partTypeOpts.map((t) => <option key={t}>{t}</option>)}</Select>
          <Select value={partPlatform} onChange={(e) => setPartPlatform(e.target.value)}><option value="">全部平台占用状态</option>{partPlatformOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={partSupplier} onChange={(e) => setPartSupplier(e.target.value)}><option value="">全部供应商</option>{partSupplierOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={partBatch} onChange={(e) => setPartBatch(e.target.value)}><option value="">全部批次号</option>{partBatchOpts.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select value={partBound} onChange={(e) => setPartBound(e.target.value)}><option value="">是否绑定设备</option><option value="是">已绑定</option><option value="否">未绑定</option></Select>
          <Select value={partReplaced} onChange={(e) => setPartReplaced(e.target.value)}><option value="">是否发生换件</option><option value="是">是</option><option value="否">否</option></Select>
          <Select value={partRepaired} onChange={(e) => setPartRepaired(e.target.value)}><option value="">是否发生返修</option><option value="是">是</option><option value="否">否</option></Select>
        </Toolbar>
        <Section title="核心部件追溯" subtitle={`共 ${partRows.length} 个核心部件 · 以下为核心零部件 SN 级追溯：物料编码 / 批次 / 库存等为 ERP 同步字段；模块 SN、平台占用状态、绑定关系为平台补充字段`} bodyClassName="p-0">
        <Table
          head={['物料编码', '物料名称', '批次号', '库存组织', '仓库', '库存单位', '数量', '主计量', '生产日期', '有效期至', '来源 ERP 单据', '平台占用状态', '绑定设备 SN', '绑定槽位', <span key="mod" className="inline-flex items-center gap-1">模块 SN / 内部 ID<Chip tone="outline">平台补充</Chip></span>, '最近更新时间', '操作']}
          empty="暂无核心部件"
          footer={<Pagination page={partPaged.page} total={partPaged.total} totalPages={partPaged.totalPages} onChange={partPaged.setPage} />}
        >
          {partPaged.pageItems.map((p) => (
            <tr key={p.id} className="hover:bg-[#fafafa]">
              <td className="px-3 py-2 font-mono text-xs text-gray-800 font-medium whitespace-nowrap">{p.materialCode}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{p.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{p.batchNo}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{p.invOrg}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{p.warehouse}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{p.unit}</td>
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{p.qty}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{p.unit}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{p.prodDate}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{p.expiryDate}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{p.erpDocNo}</td>
              <td className="px-3 py-2"><StatusBadge status={p.platform} /></td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">{p.device ? <LinkAction to={`/devices/${p.device.id}`}>{p.device.sn}</LinkAction> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{p.slot}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="font-mono text-xs text-gray-800 font-medium">{p.sn}</div>
                <div className="text-[11px] text-gray-400 font-mono">{p.id}</div>
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{p.syncAt}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <LinkAction onClick={() => setDrawerModuleId(p.id)}>查看模块详情</LinkAction>
                  {p.device && <LinkAction to={`/devices/${p.device.id}`}>查看绑定设备</LinkAction>}
                  <LinkAction onClick={() => setErpModule(p)}>查看 ERP 来源</LinkAction>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        </Section>
      </div>

      <ModuleDetailDrawer moduleId={drawerModuleId} onClose={() => setDrawerModuleId(null)} />

      <Modal isOpen={!!erpModule} onClose={() => setErpModule(null)} title="ERP 来源（只读）" size="lg">
        {erpModule && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status="ERP 只读同步" />
              <span className="text-xs text-gray-400">仅只读展示 ERP 主数据，平台不修改 ERP 库存主账</span>
            </div>
            <DescList cols={2} items={[
              ['模块 SN / 内部 ID', `${erpModule.sn} / ${erpModule.id}`],
              ['核心部件类型', erpModule.partType],
              ['关联物料编码', erpModule.materialCode],
              ['物料名称', erpModule.name],
              ['规格型号', erpModule.model],
              ['供应商', erpModule.supplierName],
              ['批次号', erpModule.batchNo],
              ['库存组织', erpModule.invOrg],
              ['仓库', erpModule.warehouse],
              ['库存单位', erpModule.unit],
              ['来源 ERP 单据', erpModule.erpDocNo],
              ['ERP 入库状态', <StatusBadge key="i" status={erpModule.erpInbound} />],
              ['ERP 检验状态', <StatusBadge key="q" status={erpModule.erpInspection} />],
              ['ERP 库存状态', <StatusBadge key="s" status={erpModule.erpStock} />],
            ]} />
            <p className="text-xs text-gray-400">以上为 ERP 主数据只读同步，如需变更请在 ERP 系统内操作。</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
