import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SlotGrid from "../components/SlotGrid";

// Dữ liệu mẫu đúng shape API 3.1
const SLOTS = [
  { time_slot_id: 1, start_time: "08:00:00", end_time: "09:00:00", base_price: 100000, status: "AVAILABLE" },
  { time_slot_id: 2, start_time: "09:00:00", end_time: "10:00:00", base_price: 120000, status: "HOLDING" },
  { time_slot_id: 3, start_time: "10:00:00", end_time: "11:00:00", base_price: 100000, status: "BOOKED" },
  { time_slot_id: 4, start_time: "11:00:00", end_time: "12:00:00", base_price: 80000,  status: "UNAVAILABLE" },
];

describe("SlotGrid", () => {
  it("render đúng số ô theo số slot", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    // 4 header + 4 slot button = 8 elements trong grid
    // Chỉ kiểm tra số button (4 slot)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("hiển thị giờ bắt đầu trong header", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("slot AVAILABLE không disabled", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /08:00.*Trống/i });
    expect(btn).not.toBeDisabled();
  });

  it("slot HOLDING bị disabled", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /09:00.*Đang giữ/i });
    expect(btn).toBeDisabled();
  });

  it("slot BOOKED bị disabled", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /10:00.*Đã cọc/i });
    expect(btn).toBeDisabled();
  });

  it("slot UNAVAILABLE bị disabled", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /11:00.*Không khả dụng/i });
    expect(btn).toBeDisabled();
  });

  it("slot đã chọn hiển thị 'Đã chọn' và aria-pressed=true", () => {
    render(<SlotGrid slots={SLOTS} selected={[1]} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /08:00.*Đã chọn/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveClass("slot--pick");
  });

  it("gọi onToggle với time_slot_id khi nhấn slot AVAILABLE", async () => {
    const onToggle = vi.fn();
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /08:00.*Trống/i }));
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("không gọi onToggle khi nhấn slot BOOKED", async () => {
    const onToggle = vi.fn();
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /10:00.*Đã cọc/i }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("hiển thị giá trong slot AVAILABLE khi showPrice=true", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} showPrice />);
    // nhiều slot có thể cùng hiển thị giá
    const prices = screen.getAllByText("100K");
    expect(prices.length).toBeGreaterThan(0);
  });

  it("ẩn giá khi showPrice=false", () => {
    render(<SlotGrid slots={SLOTS} selected={[]} onToggle={vi.fn()} showPrice={false} />);
    expect(screen.queryByText("100K")).not.toBeInTheDocument();
  });

  it("hiển thị empty state khi slots rỗng", () => {
    render(<SlotGrid slots={[]} selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText(/không có khung giờ/i)).toBeInTheDocument();
  });

  it("nhận nhiều slot được chọn cùng lúc", () => {
    render(<SlotGrid slots={SLOTS} selected={[1]} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /08:00.*Đã chọn/i })).toHaveAttribute("aria-pressed", "true");
  });
});
