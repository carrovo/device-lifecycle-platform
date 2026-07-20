import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import Modal from '../components/Modal';

function DonutChart({ rate }) {
  const r = 18, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(rate, 100) / 100) * circ;
  const color = rate >= 90 ? '#16a34a' : rate >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={44} height={44} viewBox="0 0 44 44">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight="600" fill={color}>{rate}%</text>
    </svg>
  );
}

function EditPlanModal({ isOpen, onClose, plan, onSave }) {
  const [form, setForm] = useState({ target: plan?.target || 0, actual: plan?.actual || 0, project: plan?.project || '', bottleneck: plan?.bottleneck || '', erpProductionOrderNo: plan?.erpProductionOrderNo || '', notes: plan?.notes || '' });
  if (!plan) return null;
  const rate = form.target > 0 ? Math.round((form.actual / form.target) * 100) : 0;
  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑计划 ${plan.date}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关联项目/订单</label>
          <input type="text" className={inp} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当日产能目标</label>
            <input type="number" min="0" className={inp} value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">实际完成 <span className="text-gray-400 font-normal">（自动计算字段）</span></label>
            <input type="number" min="0" className={`${inp} bg-gray-50 text-gray-400`} readOnly value={form.actual} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">达成率</label>
          <div className={`${inp} bg-gray-50 text-gray-400`}>{rate}%</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">瓶颈环节标记</label>
          <input type="text" className={inp} value={form.bottleneck} onChange={(e) => setForm({ ...form, bottleneck: e.target.value })} placeholder="如：组装环节人手不足、零件缺货" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ERP生产订单号</label>
          <input type="text" className={inp} value={form.erpProductionOrderNo} onChange={(e) => setForm({ ...form, erpProductionOrderNo: e.target.value })} placeholder="ERP 生产订单号（选填）" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存修改</button>
        </div>
      </div>
    </Modal>
  );
}

function AddPlanModal({ isOpen, onClose, onSave, existingProjects }) {
  const [form, setForm] = useState({ date: '2026-06-21', target: '', actual: '', project: '', bottleneck: '', notes: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
    setForm({ date: '2026-06-21', target: '', actual: '', project: '', bottleneck: '', notes: '' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增生产计划">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关联项目/订单 *</label>
          <input type="text" list="proj-list" value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
            placeholder="选择已有项目或输入新项目名"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500 font-medium" required />
          <datalist id="proj-list">
            {existingProjects.map((p) => <option key={p} value={p} />)}
          </datalist>
          <p className="text-xs text-gray-400 mt-1">可从下拉中选择已有项目，或直接输入新项目名</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目标数量</label>
            <input type="number" min="0" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">实际完成</label>
            <input type="number" min="0" value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm text-white bg-slate-700 rounded hover:bg-slate-800">保存</button>
        </div>
      </form>
    </Modal>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <div className="font-medium text-gray-700 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name === 'target' ? '目标' : '实际'}：</span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ProductionPlan() {
  const { state, dispatch } = useApp();
  const { canDo } = useRole();
  const [activeTab, setActiveTab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  const plans = [...state.productionPlans].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.project || '').localeCompare(b.project || '')
  );

  const chartData = Object.values(
    plans.reduce((acc, p) => {
      const key = p.date.slice(5);
      if (!acc[key]) acc[key] = { date: key, target: 0, actual: 0 };
      acc[key].target += p.target;
      acc[key].actual += p.actual;
      return acc;
    }, {})
  );

  const handleAddPlan = (form) => {
    dispatch({ type: 'ADD_PRODUCTION_PLAN', payload: {
      id: `PLAN-${Date.now()}`, date: form.date,
      target: Number(form.target), actual: Number(form.actual),
      project: form.project, notes: form.notes,
    }});
  };

  const handleDelete = (id) => {
    dispatch({ type: 'DELETE_PRODUCTION_PLAN', payload: id });
  };

  const byProject = {};
  plans.forEach((p) => {
    const proj = p.project || '未指定';
    if (!byProject[proj]) byProject[proj] = { target: 0, actual: 0, plans: [] };
    byProject[proj].target += p.target;
    byProject[proj].actual += p.actual;
    byProject[proj].plans.push(p);
  });

  const totalTarget = plans.reduce((s, p) => s + p.target, 0);
  const totalActual = plans.reduce((s, p) => s + p.actual, 0);
  const overallRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  const TODAY = '2026-06-21';
  const todayPlans = plans.filter((p) => p.date === TODAY);
  const todayTarget = todayPlans.reduce((s, p) => s + p.target, 0);
  const todayActual = todayPlans.reduce((s, p) => s + p.actual, 0);
  const todayRate = todayTarget > 0 ? Math.round((todayActual / todayTarget) * 100) : 0;

  const existingProjects = [...new Set(plans.map((p) => p.project).filter(Boolean))];

  const dateGroups = plans.reduce((acc, p) => {
    if (!acc[p.date]) acc[p.date] = [];
    acc[p.date].push(p);
    return acc;
  }, {});

  const toggleProject = (proj) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(proj) ? next.delete(proj) : next.add(proj);
      return next;
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">生产计划</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {['工厂总览', '按项目/订单'].map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === i ? 'border-slate-700 text-slate-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 0: Factory Overview — READ ONLY */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 flex items-center gap-4">
              <DonutChart rate={todayRate} />
              <div>
                <div className="text-sm text-gray-500">全厂当日达成率</div>
                <div className="text-xs text-gray-400 mt-0.5">{todayActual} / {todayTarget} 台 · {TODAY}</div>
                <div className="text-xs text-gray-400 mt-0.5">累计达成率 {overallRate}%</div>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <div className="text-3xl font-semibold text-gray-900">{todayTarget}</div>
              <div className="text-sm text-gray-500 mt-1">全厂当日目标汇总</div>
              <div className="text-xs text-gray-400 mt-1">累计 {totalTarget} 台</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
              <div className="text-3xl font-semibold text-gray-900">{todayActual}</div>
              <div className="text-sm text-gray-500 mt-1">全厂当日实际完成汇总</div>
              <div className="text-xs text-gray-400 mt-1">累计 {totalActual} 台</div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">产能趋势（目标 vs 实际，按日汇总）</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => v === 'target' ? '目标' : '实际'} iconType="line" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={2}
                  strokeDasharray="5 3" dot={false} name="target" />
                <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} name="actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Read-only table — no edit/delete/add buttons */}
          <div className="bg-white rounded shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['日期', '目标', '实际', '达成率', '关联项目', '备注'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(dateGroups).map(([date, group]) => {
                  const dayTarget = group.reduce((s, p) => s + p.target, 0);
                  const dayActual = group.reduce((s, p) => s + p.actual, 0);
                  const dayRate = dayTarget > 0 ? Math.round((dayActual / dayTarget) * 100) : 0;
                  return (
                    <>
                      {group.length > 1 && (
                        <tr key={`${date}-summary`} className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="px-4 py-1.5 text-xs font-semibold text-slate-600">{date}</td>
                          <td className="px-4 py-1.5 text-xs font-semibold text-slate-600">{dayTarget}</td>
                          <td className="px-4 py-1.5 text-xs font-semibold text-slate-600">{dayActual}</td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <DonutChart rate={dayRate} />
                              <span className="text-xs text-gray-500">当日合计</span>
                            </div>
                          </td>
                          <td className="px-4 py-1.5 text-xs text-gray-400" colSpan={2}>{group.length} 个项目</td>
                        </tr>
                      )}
                      {group.map((plan) => {
                        const rate = plan.target > 0 ? Math.round((plan.actual / plan.target) * 100) : 0;
                        return (
                          <tr key={plan.id}
                            className={`transition-colors hover:bg-blue-50 border-t border-gray-100 ${group.length > 1 ? 'bg-white' : 'border-t-2 border-slate-200'}`}>
                            <td className="px-4 py-2 font-medium text-gray-700 text-sm">
                              {group.length > 1 ? (
                                <span className="text-gray-400 pl-2 text-xs">└</span>
                              ) : date}
                            </td>
                            <td className="px-4 py-2 text-gray-700">{plan.target}</td>
                            <td className="px-4 py-2 text-gray-700">{plan.actual}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <DonutChart rate={rate} />
                                {rate < 90 && plan.actual > 0 && <span className="text-xs text-amber-600">⚠ 未达标</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-600 text-sm">{plan.project || '—'}</td>
                            <td className="px-4 py-2 text-xs text-gray-400">{plan.notes}</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 1: By Project — editable + expandable */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {canDo('add_production_plan') && (
            <div className="flex justify-end">
              <button onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800">
                + 新增计划
              </button>
            </div>
          )}
          <div className="bg-white rounded shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['', '项目/订单', '目标总量', '实际完成', '完成率'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byProject).map(([proj, data]) => {
                  const rate = data.target > 0 ? Math.round((data.actual / data.target) * 100) : 0;
                  const isExpanded = expandedProjects.has(proj);
                  return (
                    <>
                      <tr key={proj}
                        onClick={() => toggleProject(proj)}
                        className="hover:bg-blue-50 transition-colors cursor-pointer border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-400 w-8">{isExpanded ? '▼' : '▶'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{proj}</td>
                        <td className="px-4 py-3 text-gray-600">{data.target}</td>
                        <td className="px-4 py-3 text-gray-600">{data.actual}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <DonutChart rate={rate} />
                            <div>
                              <div className={`text-sm font-semibold ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                {rate}%
                              </div>
                              <div className="text-xs text-gray-400">
                                {data.target - data.actual > 0 ? `差 ${data.target - data.actual} 台` : '已完成'}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${proj}-detail`}>
                          <td colSpan={5} className="px-0 py-0 bg-slate-50 border-b border-slate-200">
                            <div className="px-8 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b border-gray-200">
                                    {['日期', '目标', '实际', '达成率', '瓶颈环节', '备注', '操作'].map((h) => (
                                      <th key={h} className="text-left py-1.5 pr-4 font-medium">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.plans.map((plan) => {
                                    const r = plan.target > 0 ? Math.round((plan.actual / plan.target) * 100) : 0;
                                    return (
                                      <tr key={plan.id} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1.5 pr-4 font-medium text-gray-700">{plan.date}</td>
                                        <td className="py-1.5 pr-4">{plan.target}</td>
                                        <td className="py-1.5 pr-4">{plan.actual}</td>
                                        <td className="py-1.5 pr-4">
                                          <span className={`font-medium ${r >= 90 ? 'text-green-600' : r >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {r}%
                                          </span>
                                        </td>
                                        <td className="py-1.5 pr-4 text-gray-400">{plan.bottleneck || '—'}</td>
                                        <td className="py-1.5 pr-4 text-gray-400">{plan.notes || '—'}</td>
                                        <td className="py-1.5">
                                          <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setEditId(plan.id); }}
                                              className="text-slate-600 hover:underline">编辑</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                                              className="text-red-400 hover:underline">删除</button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddPlanModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleAddPlan} existingProjects={existingProjects} />
      <EditPlanModal
        isOpen={!!editId}
        onClose={() => setEditId(null)}
        plan={editId ? plans.find((p) => p.id === editId) : null}
        onSave={(form) => dispatch({ type: 'UPDATE_PRODUCTION_PLAN', payload: { id: editId, ...form } })}
      />
    </div>
  );
}
