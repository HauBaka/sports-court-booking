/**
 * Empty — trạng thái rỗng (empty state).
 * Hiện hình sân vẽ nét mảnh, tiêu đề và nội dung tuỳ chọn.
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 *
 * @param {{ title: string, children?: React.ReactNode }} props
 */

/** Hình sân vẽ nét mảnh với quả bóng nảy — dùng cho empty state và trang 404. */
export function CourtArt({ size = 120 }) {
  return (
    <svg
      className="court-art"
      width={size}
      height={size * 0.6}
      viewBox="0 0 200 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <rect x="10" y="10" width="180" height="100" rx="3" />
      <path d="M100 10v100M10 22h180M10 98h180M66 22v76M134 22v76M10 60h56M134 60h56" />
      <path d="M100 4v112" strokeWidth="2.4" strokeDasharray="2 3" />
      <circle className="court-art__ball" cx="146" cy="40" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Empty({ title, children }) {
  return (
    <div className="empty">
      <CourtArt size={96} />
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}
