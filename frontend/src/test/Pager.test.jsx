import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Pager from "../components/ui/Pager";

describe("Pager", () => {
  it("không render khi total <= size", () => {
    const { container } = render(
      <Pager page={0} pages={1} size={10} total={5} onPage={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("render nút trang trước và trang sau", () => {
    render(<Pager page={1} pages={5} size={10} total={50} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeInTheDocument();
  });

  it("vô hiệu nút trang trước ở trang đầu", () => {
    render(<Pager page={0} pages={3} size={10} total={30} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled();
  });

  it("vô hiệu nút trang sau ở trang cuối", () => {
    render(<Pager page={2} pages={3} size={10} total={30} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });

  it("đánh dấu aria-current='page' cho trang đang xem", () => {
    render(<Pager page={1} pages={3} size={10} total={30} onPage={vi.fn()} />);
    const current = screen.getByRole("button", { current: "page" });
    expect(current).toHaveTextContent("2"); // page 1 → hiện "2"
  });

  it("gọi onPage với trang tiếp theo khi nhấn trang sau", async () => {
    const onPage = vi.fn();
    render(<Pager page={0} pages={3} size={10} total={30} onPage={onPage} />);
    await userEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("gọi onPage với trang trước khi nhấn trang trước", async () => {
    const onPage = vi.fn();
    render(<Pager page={2} pages={3} size={10} total={30} onPage={onPage} />);
    await userEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("hiển thị đúng range (21–30 / 30)", () => {
    render(<Pager page={2} pages={3} size={10} total={30} onPage={vi.fn()} />);
    expect(screen.getByText("21–30 / 30")).toBeInTheDocument();
  });

  it("gọi onPage khi nhấn số trang", async () => {
    const onPage = vi.fn();
    render(<Pager page={0} pages={3} size={10} total={30} onPage={onPage} />);
    // nút số "3" = page index 2
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
