import Icon from "./Icon";

/**
 * Pager — phân trang.
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 *
 * Trả về null nếu total <= size (không cần phân trang).
 *
 * @param {{
 *   page: number,       // trang hiện tại (0-indexed)
 *   pages: number,      // tổng số trang
 *   size: number,       // số item mỗi trang
 *   total: number,      // tổng số item
 *   onPage: (n: number) => void
 * }} props
 */
export default function Pager({ page, pages, size, total, onPage }) {
  if (total <= size) return null;

  // Tối đa 7 nút: đầu, cuối, quanh trang đang xem
  const nums = [
    ...new Set(
      [0, pages - 1, page - 1, page, page + 1].filter(
        (n) => n >= 0 && n < pages
      )
    ),
  ].sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label="Phân trang">
      <span className="pager__count mono">
        {page * size + 1}–{Math.min(total, page * size + size)} / {total}
      </span>

      <button
        className="pager__btn"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        aria-label="Trang trước"
      >
        <Icon name="chevL" size={16} />
      </button>

      {nums.map((n, i) => (
        <span key={n} className="row" style={{ "--gap": "4px" }}>
          {i > 0 && n - nums[i - 1] > 1 && (
            <span className="muted">…</span>
          )}
          <button
            className="pager__btn mono"
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
          >
            {n + 1}
          </button>
        </span>
      ))}

      <button
        className="pager__btn"
        disabled={page === pages - 1}
        onClick={() => onPage(page + 1)}
        aria-label="Trang sau"
      >
        <Icon name="chevR" size={16} />
      </button>
    </nav>
  );
}
