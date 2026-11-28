import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { useState } from "react";
import Select from "../components/ui/Select";

// jsdom không implement scrollIntoView và getBoundingClientRect — mock ở đây
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, bottom: 40, right: 160, width: 160, height: 40,
  }));
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
});

// Wrapper để test controlled Select
function Wrapper({ initial = "a", onChange }) {
  const [val, setVal] = useState(initial);
  return (
    <Select
      value={val}
      onChange={(e) => { setVal(e.target.value); onChange?.(e.target.value); }}
    >
      <option value="a">Alpha</option>
      <option value="b">Beta</option>
      <option value="c">Gamma</option>
    </Select>
  );
}

describe("Select", () => {
  it("hiển thị giá trị ban đầu", () => {
    render(<Wrapper />);
    expect(screen.getByRole("button")).toHaveTextContent("Alpha");
  });

  it("mở danh sách khi nhấn", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
  });

  it("chọn option và cập nhật giá trị", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button")).toHaveTextContent("Beta");
  });

  it("đóng danh sách sau khi chọn", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "Gamma" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("điều hướng bằng phím ArrowDown / ArrowUp", async () => {
    render(<Wrapper />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    // ArrowDown di chuyển highlight xuống
    await userEvent.keyboard("{ArrowDown}");
    // hi tăng lên 1 → Beta được highlight (class "hi")
    const opts = screen.getAllByRole("option");
    expect(opts[1]).toHaveClass("hi");
  });

  it("chọn bằng phím Enter", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("đóng bằng phím Escape", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("không gọi onChange khi chọn lại giá trị đang chọn", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "Alpha" })); // đã là "a"
    expect(onChange).not.toHaveBeenCalled();
  });

  it("đánh dấu aria-selected đúng option đang chọn", async () => {
    render(<Wrapper initial="b" />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
  });
});
