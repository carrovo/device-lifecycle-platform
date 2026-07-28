// 共享 UI 套件（Vercel / Linear 类 B 端 SaaS 控制台风格）
// 统一页面标题区 / 卡片 / 表格 / 筛选条 / 按钮 / 详情键值区的观感。
// 主色克制为近黑（#171717），边框细、圆角轻、状态用小 badge/chip 表达。
import { Link } from 'react-router-dom';
import { Children, useState } from 'react';
import { Pagination } from './Pagination';

/* ── 页面容器 + 标题区 ───────────────────────────── */
export function Page({ children, className = '' }) {
  return <div className={`p-6 space-y-5 ${className}`}>{children}</div>;
}

// 顶部区域：简洁标题 + 简短说明 + 主要操作按钮
export function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h1>
        {description && <p className="text-[13px] text-gray-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/* ── 卡片 / 分区 ─────────────────────────────────── */
export function Card({ children, className = '', padded = true }) {
  return (
    <div className={`bg-white border border-[#ececec] rounded-lg ${padded ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  );
}

// 带表头的分区卡片：标题 + 可选右侧操作 + 内容
export function Section({ title, subtitle, right, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <section className={`bg-white border border-[#ececec] rounded-lg ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-[#f0f0f0]">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-gray-800">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ── 筛选 / 工具条 ──────────────────────────────── */
export function Toolbar({ children, right, className = '' }) {
  return (
    <div className={`bg-white border border-[#ececec] rounded-lg px-3 py-2.5 flex items-center gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">{children}</div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

/* ── 表单控件 ───────────────────────────────────── */
export function Input(props) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`ui-input ${className}`} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select {...rest} className={`ui-input pr-7 cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

export function SearchInput({ className = '', ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input {...rest} className="ui-input pl-8 w-full" />
    </div>
  );
}

/* ── 按钮 ───────────────────────────────────────── */
const BTN_BASE = 'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
const BTN_SIZE = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3', lg: 'h-9 px-4' };
const BTN_VARIANT = {
  primary: 'bg-[#171717] text-white hover:bg-black border border-[#171717]',
  secondary: 'bg-white text-gray-700 border border-[#e0e0e0] hover:bg-gray-50 hover:text-gray-900',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};

export function Btn({ variant = 'secondary', size = 'md', as = 'button', to, className = '', children, ...rest }) {
  const cls = `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`;
  if (as === 'link' && to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

// 行内文字操作（表格操作列 / 详情跳转）
export function LinkAction({ to, onClick, children, className = '' }) {
  if (to) return <Link to={to} className={`ui-link text-[13px] ${className}`}>{children}</Link>;
  return <button onClick={onClick} className={`ui-link text-[13px] ${className}`}>{children}</button>;
}

/* ── 中性 chip / tag（非状态语义） ─────────────────── */
export function Chip({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-600 border-gray-200',
    solid: 'bg-gray-900 text-white border-gray-900',
    outline: 'bg-white text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
}

/* ── 指标卡（紧凑，突出数字与状态） ─────────────────── */
export function StatCard({ label, value, hint, tone = 'default' }) {
  const valTone = {
    default: 'text-gray-900',
    danger: 'text-red-600',
    warning: 'text-amber-600',
    success: 'text-green-600',
  }[tone] || 'text-gray-900';
  return (
    <div className="bg-white border border-[#ececec] rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tracking-tight ${valTone}`}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export function StatGrid({ children, cols = 4 }) {
  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5', 6: 'sm:grid-cols-3 lg:grid-cols-6' }[cols] || 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid grid-cols-1 ${colClass} gap-3`}>{children}</div>;
}

/* ── 详情键值区（不把字段堆成一整屏表单） ───────────── */
export function DescList({ items, cols = 2, className = '' }) {
  const colClass = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols] || 'sm:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 ${colClass} gap-x-8 gap-y-3 ${className}`}>
      {items.filter(Boolean).map(([label, value], i) => (
        <div key={i} className="flex flex-col gap-1 min-w-0">
          <dt className="text-xs text-gray-400">{label}</dt>
          <dd className="text-[13px] text-gray-800 break-words">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── 空态 ───────────────────────────────────────── */
export function EmptyState({ children = '暂无数据', className = '' }) {
  return <div className={`text-center text-gray-400 text-sm py-10 ${className}`}>{children}</div>;
}

/* ── 数据表格（紧凑、细分割线、浅表头） ───────────────── */
export function Table({ head, children, empty = '暂无数据', footer, className = '' }) {
  const [autoPage, setAutoPage] = useState(1);
  const [autoPageSize, setAutoPageSize] = useState(10);
  const rows = Children.toArray(children).filter(Boolean);
  const isEmpty = rows.length === 0;
  const autoTotalPages = Math.max(1, Math.ceil(rows.length / autoPageSize));
  const currentAutoPage = Math.min(autoPage, autoTotalPages);
  const displayedRows = footer ? rows : rows.slice((currentAutoPage - 1) * autoPageSize, currentAutoPage * autoPageSize);
  const autoFooter = !footer && !isEmpty
    ? (
      <Pagination
        page={currentAutoPage}
        total={rows.length}
        totalPages={autoTotalPages}
        pageSize={autoPageSize}
        onChange={setAutoPage}
        onPageSizeChange={(size) => { setAutoPageSize(size); setAutoPage(1); }}
      />
    )
    : null;
  return (
    <div className={`bg-white border border-[#ececec] rounded-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-[#fafafa] border-b border-[#ececec]">
              {head.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f2f2]">
            {isEmpty
              ? <tr><td colSpan={head.length} className="px-4 py-10 text-center text-gray-400">{empty}</td></tr>
              : displayedRows}
          </tbody>
        </table>
      </div>
      {footer || autoFooter}
    </div>
  );
}

/* ── 横向流程步骤条（stepper） ─────────────────────── */
// steps: [{ key, label }]，current = 当前步骤 key（或 index）；done 数组可选标记已完成。
export function Stepper({ steps, current, className = '' }) {
  const curIdx = typeof current === 'number' ? current : steps.findIndex((s) => (s.key || s.label) === current);
  return (
    <div className={`flex items-center overflow-x-auto ${className}`}>
      {steps.map((s, i) => {
        const state = i < curIdx ? 'done' : i === curIdx ? 'current' : 'todo';
        const circle = state === 'done'
          ? 'bg-gray-900 text-white border-gray-900'
          : state === 'current'
            ? 'bg-white text-gray-900 border-gray-900'
            : 'bg-white text-gray-400 border-gray-200';
        return (
          <div key={s.key || s.label} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1.5 min-w-[76px] px-1">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${circle}`}>
                {state === 'done' ? '✓' : i + 1}
              </div>
              <span className={`text-[11px] text-center leading-tight ${state === 'todo' ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px w-8 sm:w-10 flex-shrink-0 -mt-4 ${i < curIdx ? 'bg-gray-900' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// 表格单元格快捷类（可选使用）
export const Td = ({ children, className = '', ...rest }) => (
  <td className={`px-3 py-2 text-gray-700 align-middle ${className}`} {...rest}>{children}</td>
);
export const Tr = ({ children, className = '', ...rest }) => (
  <tr className={`hover:bg-[#fafafa] transition-colors ${className}`} {...rest}>{children}</tr>
);
