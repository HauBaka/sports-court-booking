import { Children, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Select — ô chọn tự vẽ thay cho <select> gốc của trình duyệt.
 * Cùng API với <select>: con là <option>, onChange nhận e.target.value.
 * Danh sách xổ ra theo giao diện token, đặt fixed để không bị khung cuộn cắt.
 * Phím: ArrowUp/Down, Enter, Space, Escape, Tab, gõ chữ đầu.
 *
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 *
 * @example
 * <Select value={val} onChange={e => setVal(e.target.value)}>
 *   <option value="a">Lựa chọn A</option>
 *   <option value="b">Lựa chọn B</option>
 * </Select>
 */
export default function Select({ value, onChange, children, className = "select", style, ...rest }) {
  const opts = Children.toArray(children)
    .filter(Boolean)
    .map((o) => ({ v: String(o.props.value ?? o.props.children), l: o.props.children }));

  const [pos, setPos] = useState(null);
  const [hi, setHi] = useState(0);
  const btn = useRef(null);
  const list = useRef(null);
  const cur = opts.find((o) => o.v === String(value ?? "")) ?? opts[0];
  const open = !!pos;

  const show = () => {
    const r = btn.current.getBoundingClientRect();
    const h = Math.min(288, opts.length * 40 + 12);
    const up = window.innerHeight - r.bottom < h + 12 && r.top > h + 12;
    setPos({
      left: r.left,
      width: Math.max(r.width, 160),
      top: up ? r.top - h - 6 : r.bottom + 6,
    });
    setHi(Math.max(0, opts.indexOf(cur)));
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) =>
      !btn.current?.contains(e.target) &&
      !list.current?.contains(e.target) &&
      setPos(null);
    const off = (e) =>
      !list.current?.contains(e.target) && setPos(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[hi]?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  const pick = (o) => {
    setPos(null);
    btn.current?.focus();
    if (o && o.v !== String(value ?? "")) {
      onChange?.({ target: { value: o.v } });
    }
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      setHi((h) =>
        Math.min(opts.length - 1, Math.max(0, h + (e.key === "ArrowDown" ? 1 : -1)))
      );
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open ? pick(opts[hi]) : show();
    } else if (e.key === "Escape" || e.key === "Tab") {
      setPos(null);
    } else if (e.key.length === 1) {
      const i = opts.findIndex((o) =>
        String(o.l).toLowerCase().startsWith(e.key.toLowerCase())
      );
      if (i >= 0) open ? setHi(i) : pick(opts[i]);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={`${className} sel`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setPos(null) : show())}
        onKeyDown={handleKey}
        {...rest}
      >
        <span className="sel__val">{cur?.l}</span>
      </button>

      {open && (
        <ul
          className="sel__list"
          role="listbox"
          ref={list}
          style={{ position: "fixed", zIndex: 100, ...pos }}
        >
          {opts.map((o, i) => (
            <li
              key={o.v}
              role="option"
              aria-selected={o === cur}
              className={i === hi ? "hi" : ""}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span>{o.l}</span>
              {o === cur && <Icon name="check" size={15} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
