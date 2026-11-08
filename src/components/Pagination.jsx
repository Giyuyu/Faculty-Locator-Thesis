import React, { useEffect } from 'react';

export const PAGE_SIZE = 10;

export function paginateItems(items, page, pageSize = PAGE_SIZE) {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

export default function Pagination({ page, pageSize = PAGE_SIZE, totalItems, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstItem = totalItems ? ((safePage - 1) * pageSize) + 1 : 0;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [onPageChange, page, safePage]);

  if (totalItems <= pageSize) return null;

  return (
    <nav className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <p className="text-xs font-medium text-slate-500">Showing {firstItem}–{lastItem} of {totalItems}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-xs font-semibold text-slate-600">Page {safePage} of {pageCount}</span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
