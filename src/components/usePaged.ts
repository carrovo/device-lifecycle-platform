import { useState } from 'react';

export function usePaged(items, initialPageSize = 10) {
  const safeItems = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const total = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);
  const pageItems = safeItems.slice((cur - 1) * pageSize, cur * pageSize);
  const setPageSize = (next) => {
    setPageSizeState(Number(next));
    setPage(1);
  };
  return { page: cur, setPage, total, totalPages, pageSize, setPageSize, pageItems };
}
