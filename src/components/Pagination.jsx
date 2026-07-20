import { useState } from 'react';

// 前端静态分页 hook：返回当前页数据切片与分页控制。
export function usePaged(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);
  const pageItems = items.slice((cur - 1) * pageSize, cur * pageSize);
  return { page: cur, setPage, total, totalPages, pageSize, pageItems };
}

// 统一分页页脚：共X条 / 每页N条 / 第x/N页 / 上一页 / 下一页。
export function Pagination({ page, total, totalPages, pageSize = 10, onChange }) {
  const btn = 'h-7 px-2.5 text-xs border rounded-md transition-colors';
  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 text-xs text-gray-400 border-t border-[#f0f0f0] bg-white">
      <span>共 {total} 条</span>
      <span className="text-gray-200">·</span>
      <span>每页 {pageSize} 条</span>
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
