import { Page, PageHeader, Section, Card, Chip } from '../components/ui';

const CONFIG = {
  dashboard: {
    title: '看板中心',
    description: '面向质量、交付与售后数据分析的后续规划模块，当前版本暂不展开指标与图表。',
    directions: ['质量分析', '交付分析', '售后分析', '效率分析', '质量追溯统计'],
    note: '当前版本优先完成设备 SN 主线与关键过程数据沉淀，待数据口径稳定后再逐步建设分析能力。',
  },
  afterSales: {
    title: '售后管理',
    description: '承接问题池、售后工单、现场处理与售后换件的后续规划模块。',
    directions: ['问题池', '售后工单', '现场处理', '售后换件', '设备问题追溯'],
    note: '当前版本仅展示交付执行中的异常信息，售后相关业务暂不展开。',
  },
};

export default function PlanningPlaceholder({ type }) {
  const config = CONFIG[type] || CONFIG.dashboard;

  return (
    <Page>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={<Chip>后续规划</Chip>}
      />
      <Section title="模块定位" subtitle="当前版本为只读说明，不提供完整业务入口">
        <p className="text-[13px] leading-6 text-gray-600">{config.note}</p>
      </Section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {config.directions.map((item) => (
          <Card key={item} className="min-h-24">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-gray-700">{item}</h2>
              <Chip className="text-gray-400">规划中</Chip>
            </div>
            <p className="text-xs text-gray-400 mt-3">待后续数据口径与业务流程明确后逐步建设。</p>
          </Card>
        ))}
      </div>
    </Page>
  );
}
