import { useSearchParams } from 'react-router-dom';
import ProductionPlan from './ProductionPlan';
import Materials from './Materials';
import Assembly from './Assembly';
import QualityTests from './QualityTests';

const TABS = [
  { key: 'plan', label: '生产计划' },
  { key: 'materials', label: '来料管理' },
  { key: 'assembly', label: '整机装配' },
  { key: 'tests', label: '质量测试' },
];

export default function ManufacturePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'plan';

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  return (
    <div>
      {/* Tab nav */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-slate-700 text-slate-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'plan' && <ProductionPlan />}
      {tab === 'materials' && <Materials />}
      {tab === 'assembly' && <Assembly />}
      {tab === 'tests' && <QualityTests />}
    </div>
  );
}
