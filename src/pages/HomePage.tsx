import { Card, Chip, Section } from '../components/ui';

const STAGES = [
  { title: '生产制造', desc: '设备建档、生产流转、测试结果及返修 / 换件信息沉淀。', current: true },
  { title: '入库与设备履历', desc: 'ERP 产品入库关联、设备台账及单台设备履历。', current: true },
  { title: '项目交付', desc: '项目、点位、交付批次、交付子工单及 FAE 现场执行。', current: true },
  { title: '问题与售后', desc: '现场问题提报、问题池处理、技术支持与售后工单执行。', current: true },
  { title: '质量跟进与分析', desc: '问题根因、长期解决方案、闭环跟进及质量 / 售后看板分析。', current: true },
];

export default function HomePage() {
  return (
    <div className="p-6 md:p-10 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="pt-5 md:pt-10">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">设备全生命周期质量管理平台</h1>
          <p className="text-sm text-gray-500 mt-3 max-w-3xl leading-7">
            围绕设备 SN，统一沉淀设备从生产、入库、交付到售后质量追溯的关键过程信息。
          </p>
        </div>

        <Section title="生命周期总览" subtitle="以设备 SN 为主线，按业务大阶段沉淀关键结果">
          <div className="flex items-stretch overflow-x-auto pb-2">
            {STAGES.map((stage, index) => (
              <div key={stage.title} className="flex items-stretch flex-shrink-0">
                <div className={`w-48 border rounded-lg p-4 ${stage.current ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                  <h2 className={`text-[13px] font-semibold break-keep leading-5 min-h-10 ${stage.current ? 'text-gray-800' : 'text-gray-500'}`}>{stage.title}</h2>
                  <div className="mt-2">
                    <Chip className="whitespace-nowrap" tone={stage.current ? 'solid' : 'neutral'}>当前已覆盖</Chip>
                  </div>
                  <p className={`text-xs leading-5 mt-3 ${stage.current ? 'text-gray-500' : 'text-gray-400'}`}>{stage.desc}</p>
                </div>
                {index < STAGES.length - 1 && <span className="self-center px-2 text-gray-300">→</span>}
              </div>
            ))}
          </div>
        </Section>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">平台当前范围</h2>
            <Chip tone="solid">当前已覆盖</Chip>
          </div>
          <p className="text-[13px] text-gray-600 leading-6 mt-3">
            当前平台围绕设备 SN 建立统一追溯主线，覆盖设备生产、ERP 关联、设备履历、项目交付、FAE 现场执行、问题提报、售后处理和质量跟进，形成设备从生产到交付、售后和质量追溯的统一信息链路。
          </p>
        </Card>

        <Section title="数据边界" subtitle="ERP、飞书与平台各自承接明确职责">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <h2 className="text-[13px] font-semibold text-gray-800">ERP</h2>
              <p className="text-xs text-gray-500 leading-5 mt-2">正式业务单据和库存主账来源。平台只读查看，不写入单据或库存。</p>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-gray-800">飞书</h2>
              <p className="text-xs text-gray-500 leading-5 mt-2">继续承接复杂生产明细、图片、视频、日志和附件。</p>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-gray-800">平台</h2>
              <p className="text-xs text-gray-500 leading-5 mt-2">维护设备档案、生产关键结果、来源链接、项目交付、问题、售后和质量追溯信息。</p>
            </div>
          </div>
        </Section>

        <p className="text-xs text-gray-400 border-t border-[#ececec] pt-5">
          业务数据由平台数据库与用友 ERP 接口提供；ERP 信息仅展示经过同步或实时核验的明确关联记录。
        </p>
      </div>
    </div>
  );
}
