import { useSearchParams } from 'react-router-dom';
import Projects from './Projects';
import Delivery from './Delivery';

const TABS = [
  { key: 'list', label: '项目列表' },
  { key: 'delivery', label: '交付验收' },
];

export default function ProjectsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'list';
  const activeTab = TABS.some((t) => t.key === tab) ? tab : 'list';

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  return (
    <div>
      {/* Hub Tab nav */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
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
      {activeTab === 'list' && <Projects />}
      {activeTab === 'delivery' && <Delivery />}
    </div>
  );
}
