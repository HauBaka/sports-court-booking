/**
 * Tip — giải thích ngắn sau dấu "?", hiện khi hover hoặc focus.
 * Thay thế cho đoạn ghi chú dưới tiêu đề trang.
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 *
 * @param {{ children: React.ReactNode, label?: string }} props
 */
export default function Tip({ children, label = "Giải thích" }) {
  return (
    <span className="tip">
      <button type="button" className="tip__btn" aria-label={label}>?</button>
      <span className="tip__body" role="tooltip">{children}</span>
    </span>
  );
}
