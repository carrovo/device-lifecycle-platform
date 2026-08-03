// 统一分页页脚：共X条 / 每页N条 / 第x/N页 / 上一页 / 下一页。
interface PaginationProps {
  page: number;
  total: number;
  totalPages: number;
  pageSize?: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({ page, total, totalPages, pageSize = 10, onChange, onPageSizeChange }: PaginationProps) {
  const btn = 'h-7 px-2.5 text-xs border rounded-md transition-colors';
  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 text-xs text-gray-400 border-t border-[#f0f0f0] bg-white">
      <span>共 {total} 条</span>
      <span className="text-gray-200">·</span>
      <label className="inline-flex items-center gap-1">
        <span>每页</span>
        <select
          className="h-7 rounded-md border border-[#e0e0e0] bg-white px-1.5 text-xs text-gray-600"
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          disabled={!onPageSizeChange}
          aria-label="每页条数"
        >
          {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span>条</span>
      </label>
      <span className="text-gray-200">·</span>
      <span>第 {page} / {totalPages} 页</span>
      <button
        className={`${btn} ${page <= 1 ? 'border-[#f0f0f0] text-gray-300 cursor-not-allowed' : 'border-[#e0e0e0] text-gray-600 hover:bg-gray-50'}`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >上一页</button>
      <button
        className={`${btn} ${page >= totalPages ? 'border-[#f0f0f0] text-gray-300 cursor-not-allowed' : 'border-[#e0e0e0] text-gray-600 hover:bg-gray-50'}`}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >下一页</button>
    </div>
  );
}
