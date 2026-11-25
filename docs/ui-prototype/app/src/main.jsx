import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);

// Thanh trượt dưới nút đang chọn của mọi .seg: đo nút .on và đặt biến CSS cho ::before.
function placeSegs() {
  for (const seg of document.querySelectorAll(".seg")) {
    const on = seg.querySelector("button.on");
    if (!on) { seg.removeAttribute("data-ind"); continue; }
    seg.style.setProperty("--seg-x", on.offsetLeft + "px");
    seg.style.setProperty("--seg-y", on.offsetTop + "px");
    seg.style.setProperty("--seg-w", on.offsetWidth + "px");
    seg.style.setProperty("--seg-h", on.offsetHeight + "px");
    seg.setAttribute("data-ind", "");
  }
}
new MutationObserver(placeSegs).observe(document.getElementById("root"), { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("resize", placeSegs);
document.fonts?.ready.then(placeSegs);

// Bỏ lớp mờ mép phải khi lưới giờ / bảng đã cuộn hết hoặc không cần cuộn
const markEnd = (el) => el.classList.toggle("at-end", el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
document.addEventListener("scroll", (e) => e.target.matches?.(".slots-scroll, .table-wrap") && markEnd(e.target), true);
new MutationObserver(() => document.querySelectorAll(".slots-scroll, .table-wrap").forEach(markEnd)).observe(document.body, { childList: true, subtree: true });
window.addEventListener("resize", () => document.querySelectorAll(".slots-scroll, .table-wrap").forEach(markEnd));
