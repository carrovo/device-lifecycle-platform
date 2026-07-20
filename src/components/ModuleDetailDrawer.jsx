// 共享「模块 / 核心部件详情」抽屉。供 物料零部件 / 生产关联单机记录 / 设备详情 复用。
// 明确区分 ERP 状态（只读同步）与 平台占用状态（平台按绑定/换件/返修过程生成）。
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { DescList, Section, Table, LinkAction, EmptyState, Chip } from './ui';
import { platformOccupancyStatus } from '../utils/status';

export default function ModuleDetailDrawer({ moduleId, onClose }) {
  const { state } = useApp();
  const instances = state.moduleInstances || [];
  const mi = instances.find((m) => m.id === moduleId || m.sn === moduleId);
  if (!moduleId) return null;

  const moduleTypes = state.moduleTypes || [];
  const batches = state.materialBatches || [];
  const devices = state.devices || [];
  const replacements = state.moduleReplacements || [];
  const opLogs = state.operationLogs || [];

  const mt = mi ? moduleTypes.find((t) => t.id === mi.moduleTypeId) : null;
  const batch = mi ? batches.find((b) => b.id === mi.sourceBatchId) : null;
  const boundDevice = mi ? devices.find((d) => d.id === mi.boundDeviceId) : null;
  const platform = platformOccupancyStatus(mi);

  // 与本模块相关的换件记录：作为旧件/新件出现，或同设备同槽位，或经 replacementId / removedFromDeviceId 关联
  const relatedRepl = mi
    ? replacements.filter((r) =>
        r.removedMaterialId === mi.id ||
        r.addedMaterialId === mi.id ||
        (mi.replacementId && r.id === mi.replacementId) ||
        (mi.boundDeviceId && r.deviceId === mi.boundDeviceId && r.slotName === mi.boundSlot) ||
        (mi.removedFromDeviceId && r.deviceId === mi.removedFromDeviceId && r.slotName === (mi.slotName || mi.boundSlot)))
    : [];
  // 返修记录：旧件处置指向返修流程的换件行
  const repairRepl = relatedRepl.filter((r) => ['待返修', '返修中', '已返修'].includes(r.oldPartStatus));

  // MAT/MOD id 映射到模块 SN（仅当对应到模块实例时），否则回退原始 id
  const snOf = (id) => (id ? (instances.find((m) => m.id === id)?.sn || id) : '—');

  // 历史绑定记录：优先取 mi.bindHistory；否则由当前绑定 / 下机记录合成
  const bindHistory = (() => {
    if (Array.isArray(mi?.bindHistory) && mi.bindHistory.length) return mi.bindHistory;
    const rows = [];
    if (mi?.boundDeviceId) {
      rows.push({ deviceSn: boundDevice?.sn || mi.boundDeviceId, deviceId: mi.boundDeviceId, slot: mi.boundSlot || '—', binder: mi.binder || '—', bindTime: mi.bindTime || '—', status: '当前' });
    }
    if (mi?.removedFromDeviceId) {
      const dev = devices.find((d) => d.id === mi.removedFromDeviceId);
      rows.push({ deviceSn: dev?.sn || mi.removedFromDeviceId, deviceId: mi.removedFromDeviceId, slot: mi.slotName || mi.boundSlot || '—', binder: mi.binder || '—', bindTime: mi.bindTime || '—', status: '已下机' });
    }
    return rows;
  })();

  // 操作日志：本模块绑定/下机设备的日志，或备注中提及本模块 SN 的日志
  const moduleLogs = mi
    ? opLogs.filter((l) =>
        (mi.boundDeviceId && l.deviceId === mi.boundDeviceId) ||
        (mi.removedFromDeviceId && l.deviceId === mi.removedFromDeviceId) ||
        (mi.sn && l.notes && l.notes.includes(mi.sn)))
    : [];

  const erpItems = [
    ['ERP 入库状态', mi?.erpInboundStatus || '已入库'],
    ['ERP 检验状态', mi?.erpInspectionStatus || '检验合格'],
    ['ERP 库存状态', mi?.erpStockStatus || '合格可用'],
  ];
  const erpDocs = [
    batch?.erpPurchaseOrderNo && ['采购单', batch.erpPurchaseOrderNo],
    batch?.erpArrivalNo && ['到货单', batch.erpArrivalNo],
    batch?.erpDeliveryNo && ['生产领料单', batch.erpDeliveryNo],
  ].filter(Boolean);

  return (
    <Modal isOpen={!!moduleId} onClose={onClose} title="模块 / 核心部件详情" size="xl">
      {!mi ? (
        <EmptyState>未找到该模块实例（可能为 ERP 尚未同步）</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-gray-900">{mi.sn}</span>
            <StatusBadge status={platform} />
            <span className="text-xs text-gray-400">{mt?.category || mi.category}</span>
          </div>

          <Section title="基础信息" bodyClassName="p-4">
            <DescList cols={3} items={[
              ['模块 SN / 内部 ID', mi.sn],
              ['核心部件类型', mt?.category || mi.category || '—'],
              ['规格型号', mt?.name || mi.materialName || '—'],
              ['关联物料编码', mi.materialCode || batch?.id || '—'],
              ['物料名称', mi.materialName || (batch ? `${batch.category} ${batch.model}` : '—')],
              ['供应商', mi.supplier || batch?.supplier || '—'],
              ['批次号', mi.batchNo || batch?.batchNo || '—'],
            ]} />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="ERP 状态（只读同步）" subtitle="来自 ERP 主数据，平台不修改" bodyClassName="p-4">
              <DescList cols={1} items={erpItems} />
            </Section>
            <Section title="平台占用状态" subtitle="平台按绑定/换件/返修过程生成" bodyClassName="p-4">
              <DescList cols={1} items={[
                ['平台占用状态', <StatusBadge key="p" status={platform} />],
                ['当前绑定设备 SN', boundDevice ? <Link key="d" to={`/devices/${boundDevice.id}`} className="ui-link">{boundDevice.sn}</Link> : '—'],
                ['当前绑定槽位', mi.boundSlot || '—'],
                ['当前绑定人', mi.binder || '—'],
                ['当前绑定时间', mi.bindTime || '—'],
                ['是否发生换件', relatedRepl.length > 0 ? '是' : '否'],
                ['是否发生返修', repairRepl.length > 0 || ['旧件待返修', '已返修'].includes(platform) ? '是' : '否'],
                ['最近更新时间', mi.updatedAt || mi.bindTime || '—'],
              ]} />
            </Section>
          </div>

          <Section title="历史绑定记录" subtitle="模块在各设备/槽位的绑定过程" bodyClassName="p-0">
            <Table head={['绑定设备 SN', '槽位', '绑定人', '绑定时间', '状态']} empty="暂无历史绑定记录">
              {bindHistory.map((h, i) => {
                const sn = h.deviceSn ?? h.deviceSN ?? '—';
                const st = h.status ?? '—';
                return (
                  <tr key={i} className="hover:bg-[#fafafa]">
                    <td className="px-3 py-2 text-gray-700 text-xs">
                      {h.deviceId ? <Link to={`/devices/${h.deviceId}`} className="ui-link">{sn}</Link> : sn}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{h.slot ?? h.slotName ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{h.binder ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{h.bindTime ?? h.time ?? '—'}</td>
                    <td className="px-3 py-2"><Chip tone={st === '当前' ? 'solid' : 'neutral'}>{st}</Chip></td>
                  </tr>
                );
              })}
            </Table>
          </Section>

          <Section title="换件记录" subtitle="本模块作为旧件/新件的换件工单" bodyClassName="p-0">
            <Table head={['换件记录编号', '关联售后工单', '旧件 SN', '新件 SN', '换件时间', '操作人']} empty="暂无换件记录">
              {relatedRepl.map((r) => (
                <tr key={r.id} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 text-gray-700 text-xs">{r.id}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs"><LinkAction to="/after-sales?tab=orders">{r.workOrderId || '—'}</LinkAction></td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{snOf(r.removedMaterialId)}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{snOf(r.addedMaterialId)}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{r.timestamp || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{r.operator || '—'}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="返修记录" subtitle="旧件返修流程追溯" bodyClassName="p-0">
            <Table head={['关联换件', '旧件状态', '处置', '时间']} empty="暂无返修记录">
              {repairRepl.map((r) => (
                <tr key={r.id} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 text-gray-700 text-xs">{r.id}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.oldPartStatus} /></td>
                  <td className="px-3 py-2"><StatusBadge status={r.removedDisposition || r.oldPartStatus} /></td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{r.timestamp || '—'}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="操作日志" subtitle="本模块所在设备的生命周期操作" bodyClassName="p-0">
            <Table head={['时间', '操作人', '动作', '说明']} empty="暂无操作日志">
              {moduleLogs.map((l) => (
                <tr key={l.id} className="hover:bg-[#fafafa]">
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{l.timestamp || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{l.operator || '—'}</td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{l.actionType || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{l.notes || '—'}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="ERP 来源单据" subtitle="只读" bodyClassName="p-4">
            {erpDocs.length === 0 ? <div className="text-sm text-gray-400">暂无 ERP 来源单据</div> : (
              <div className="flex flex-wrap gap-2">
                {erpDocs.map(([type, no]) => (
                  <span key={no} className="inline-flex items-center gap-1.5">
                    <StatusBadge status={type} dot={false} />
                    <span className="text-[13px] text-gray-700">{no}</span>
                  </span>
                ))}
              </div>
            )}
          </Section>

          <div className="flex justify-end gap-2 pt-1">
            {boundDevice && <LinkAction to={`/devices/${boundDevice.id}`}>查看绑定设备</LinkAction>}
            <LinkAction to="/assets?tab=materials">前往核心部件追溯</LinkAction>
          </div>
        </div>
      )}
    </Modal>
  );
}
