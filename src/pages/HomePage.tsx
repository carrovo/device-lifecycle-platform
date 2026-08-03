import { Card, Chip, Section } from '../components/ui';

const STAGES = [
  { title: '生产制造', desc: '设备建档、生产流转、测试结果及返修 / 换件信息沉淀。', current: true },
  { title: '入库与设备履历', desc: 'ERP 产品入库关联、设备台账与单台设备详情。', current: true },
  { title: '项目交付', desc: '项目、点位、设备归属与轻量交付执行。', current: true },
  { title: '运营售后', desc: '交付异常、问题处理与售后管理。', current: false },
  { title: '质量分析与持续改进', desc: '质量追溯、数据统计与看板分析。', current: false },
];

const PLANNED = ['交付管理深化', '售后管理', '看板分析', '系统管理增强', '物料零部件追溯评估'];

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
                    <Chip className="whitespace-nowrap" tone={stage.current ? 'solid' : 'neutral'}>{stage.current ? '当前已覆盖' : '规划中'}</Chip>
                  </div>
                  <p className={`text-xs leading-5 mt-3 ${stage.current ? 'text-gray-500' : 'text-gray-400'}`}>{stage.desc}</p>
                </div>
                {index < STAGES.length - 1 && <span className="self-center px-2 text-gray-300">→</span>}
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">当前重点建设</h2>
              <Chip tone="solid">重点建设</Chip>
            </div>
            <p className="text-[13px] text-gray-600 leading-6 mt-3">
              当前版本重点打通设备 SN 主线，覆盖设备建档、生产流转、ERP 产品入库关联、设备详情、项目点位和轻量交付执行，形成基础追溯链路。
            </p>
          </Card>
          <Card className="bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">后续规划能力</h2>
              <Chip>规划中</Chip>
            </div>
            <p className="text-[13px] text-gray-500 leading-6 mt-3">
              后续将逐步补充交付管理深化、售后管理、看板分析和系统管理增强等能力。
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {PLANNED.map((item) => <Chip key={item} className="text-gray-400">{item}</Chip>)}
            </div>
          </Card>
        </div>

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
              <p className="text-xs text-gray-500 leading-5 mt-2">维护设备档案、生产关键结果、来源链接、项目点位和轻量交付执行。</p>
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
