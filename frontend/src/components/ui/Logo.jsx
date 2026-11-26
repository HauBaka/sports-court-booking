import { Link } from "react-router-dom";

/**
 * Logo — logo SCB có mark hình sân.
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 */
export default function Logo({ to = "/" }) {
  if (!to) return (
    <span className="logo">
      <span className="logo__mark" />
      SCB
    </span>
  );
  return (
    <Link className="logo" to={to}>
      <span className="logo__mark" />
      SCB
    </Link>
  );
}
