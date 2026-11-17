import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import WalletPage from "./WalletPage";
import { getMyTransactions, getMyWallet } from "../services/walletService";

vi.mock("../services/walletService", () => ({
  getMyWallet: vi.fn(),
  getMyTransactions: vi.fn(),
}));

const tx = (over = {}) => ({
  id: 1,
  type: "REFUND",
  amount: 64800,
  balance_after: 183800,
  related_booking_id: 105,
  created_at: "2026-11-09T03:05:00Z",
  ...over,
});

const list = (data, meta = {}) => ({
  data,
  meta: { page: 1, limit: 10, total: data.length, total_pages: 1, ...meta },
});

function setup() {
  getMyWallet.mockResolvedValue({ data: { wallet_id: 12, user_id: 12, balance: 183800 } });
  return render(<WalletPage />);
}

describe("WalletPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hiện số dư và lịch sử với tên loại tiếng Việt", async () => {
    getMyTransactions.mockResolvedValue(
      list([
        tx({ id: 1, type: "REFUND" }),
        tx({ id: 2, type: "DEPOSIT", amount: 81000, balance_after: 119000 }),
        tx({ id: 3, type: "TOPUP", related_booking_id: null }),
      ])
    );
    setup();

    expect(await screen.findByLabelText("Số dư ví")).toBeTruthy();
    expect(screen.getByLabelText("Số dư ví").textContent).toMatch(/183\.800 ₫/);
    // tên loại trong danh sách giao dịch (không tính nút lọc)
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toMatch(/Hoàn cọc/);
    expect(rows[1].textContent).toMatch(/Đặt cọc/);
    expect(rows[2].textContent).toMatch(/Nạp tiền/);
    expect(screen.queryByText("REFUND")).toBeNull();
    // có đơn thì hiện mã đơn, không có thì không hiện
    expect(rows[0].textContent).toMatch(/Đơn #105/);
    expect(rows[2].textContent).not.toMatch(/Đơn #/);
  });

  it("lần đầu gọi API trang 1, limit 10, không lọc loại", async () => {
    getMyTransactions.mockResolvedValue(list([tx()]));
    setup();
    await screen.findByRole("listitem");
    expect(getMyTransactions).toHaveBeenCalledWith({ type: "", page: 1, limit: 10 });
  });

  it("nút lọc có đủ 5 loại bằng tiếng Việt", async () => {
    getMyTransactions.mockResolvedValue(list([tx()]));
    setup();
    await screen.findByRole("listitem");
    const group = screen.getByRole("group", { name: "Lọc theo loại giao dịch" });
    const labels = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["Tất cả", "Nạp tiền", "Đặt cọc", "Hoàn cọc", "Bồi thường", "Quyết toán"]);
  });

  it("bấm nút lọc thì gọi lại với type mới và quay về trang 1", async () => {
    getMyTransactions.mockResolvedValue(list([tx()], { page: 1, total_pages: 3 }));
    setup();
    await screen.findByRole("listitem");

    // sang trang 2 trước
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() =>
      expect(getMyTransactions).toHaveBeenLastCalledWith({ type: "", page: 2, limit: 10 })
    );

    // đổi loại -> page phải về 1
    fireEvent.click(screen.getByRole("button", { name: "Đặt cọc" }));
    await waitFor(() =>
      expect(getMyTransactions).toHaveBeenLastCalledWith({ type: "DEPOSIT", page: 1, limit: 10 })
    );
  });

  it("phân trang: bấm Sau gọi trang 2, nút Trước bị khóa ở trang 1", async () => {
    getMyTransactions.mockResolvedValue(list([tx()], { page: 1, total_pages: 2 }));
    setup();
    await screen.findByRole("listitem");

    expect(screen.getByRole("button", { name: "Trước" }).disabled).toBe(true);
    expect(screen.getByText(/Trang 1 \/ 2/)).toBeTruthy();

    getMyTransactions.mockResolvedValue(list([tx({ id: 9 })], { page: 2, total_pages: 2 }));
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));

    expect(await screen.findByText(/Trang 2 \/ 2/)).toBeTruthy();
    expect(getMyTransactions).toHaveBeenLastCalledWith({ type: "", page: 2, limit: 10 });
    expect(screen.getByRole("button", { name: "Sau" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Trước" }).disabled).toBe(false);
  });

  it("nhiều hơn 3 giao dịch thì mặc định chỉ hiện 3, bấm Xem thêm mới hiện hết", async () => {
    const many = Array.from({ length: 8 }, (_, i) => tx({ id: i + 1 }));
    getMyTransactions.mockResolvedValue(list(many, { total: 8, total_pages: 1 }));
    setup();
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Xem thêm \(5\)/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();
  });

  it("nhiều trang: ẩn phân trang cho tới khi bấm Xem thêm", async () => {
    const many = Array.from({ length: 10 }, (_, i) => tx({ id: i + 1 }));
    getMyTransactions.mockResolvedValue(list(many, { total: 23, total_pages: 3 }));
    setup();
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: "Sau" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Xem thêm/ }));
    expect(screen.getByRole("button", { name: "Sau" })).toBeTruthy();
    expect(screen.getByText(/Trang 1 \/ 3/)).toBeTruthy();
  });

  it("chỉ có 1 trang thì ẩn phân trang", async () => {
    getMyTransactions.mockResolvedValue(list([tx()], { page: 1, total_pages: 1 }));
    setup();
    await screen.findByRole("listitem");
    expect(screen.queryByRole("button", { name: "Trước" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sau" })).toBeNull();
  });

  it("chưa có giao dịch thì hiện trạng thái trống", async () => {
    getMyTransactions.mockResolvedValue(list([]));
    setup();
    expect(await screen.findByText("Chưa có giao dịch nào.")).toBeTruthy();
  });

  it("báo lỗi và cho thử lại", async () => {
    getMyTransactions.mockRejectedValueOnce({ code: "NETWORK_ERROR", message: "Mất kết nối." });
    getMyTransactions.mockResolvedValueOnce(list([tx()]));
    setup();
    expect(await screen.findByText("Mất kết nối.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("listitem")).toBeTruthy();
    expect(getMyTransactions).toHaveBeenCalledTimes(2);
  });
});
