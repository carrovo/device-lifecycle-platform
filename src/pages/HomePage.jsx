// 首页（评审版）：产品入口 / 启动页 —— 仅展示 平台定位 + 生命周期流程 + 底部轻量说明。
// 不做核心数据 KPI / 最近动态 / 模块入口（这些统一在看板中心）。
import { erpSyncMeta } from '../data/mockData';

// 平台高层级生命周期流程（产品落地页视角）：每个节点一句话描述。
const FLOW = [
  { title: 'ERP 单据同步', desc: '同步采购、生产、出入库、检验、服务交付等 ERP 源单据。' },
  { title: '项目关联', desc: '将 ERP 项目、生产订单、服务交付等源单据关联到平台项目视图。' },
  { title: '生产过程补充', desc: '补充设备 SN、装配、测试、返修等 ERP 不覆盖的过程记录。' },
  { title: '交付执行补充', desc: '补充现场部署、资料上传、异常记录和交付过程信息。' },
  { title: '在线运营', desc: '基于设备 SN 汇总在线状态、告警和运行记录。' },
  { title: '问题池 / 售后工单', desc: '承接问题上报、技术客服预处理、现场服务和换件闭环。' },
  { title: '设备履历 / 质量追溯', desc: '沉淀设备、模块、项目、ERP 单据、问题和售后的完整链路。' },
];

export default function HomePage() {
  return (
    <div className="p-6 md:p-10 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 1. 平台标题区 */}
        <div className="text-center pt-8 md:pt-16">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">
            设备全生命周期质量管理平台
          </h1>
          <p className="text-sm text-gray-500 mt-4 max-w-3xl mx-auto leading-relaxed">
            基于 ERP 源单据、设备 SN、现场过程记录和售后闭环，实现设备从生产、交付、运营到售后的统一追溯。
          </p>
        </div>

        {/* 2. 生命周期流程展示 */}
        <div className="mt-14 md:mt-20 overflow-x-auto">
          <div className="flex items-stretch gap-2 min-w-max mx-auto w-fit pb-2">
            {FLOW.map((node, i) => (
              <div key={node.title} className="flex items-stretch">
                <div className="w-48 flex flex-col rounded-xl border border-[#ececec] bg-white px-4 py-5">
                  <div className="text-sm font-semibold text-gray-800">{node.title}</div>
                  <div className="text-[13px] text-gray-500 mt-2 leading-relaxed">{node.desc}</div>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="self-center text-gray-300 text-xl px-1.5 flex-shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. 底部轻量信息 */}
        <div className="mt-16 md:mt-24 pt-6 border-t border-[#ececec]">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
            <span>最近 ERP 同步时间：{erpSyncMeta.lastSyncTime}</span>
            <span>当前原型版本：R6-A（原型演示）</span>
            <span>数据来源说明：当前为 mock 数据，ERP 字段按真实账号字段整理。</span>
          </div>
        </div>
      </div>
    </div>
  );
}
