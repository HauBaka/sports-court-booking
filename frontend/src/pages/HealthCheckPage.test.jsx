import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HealthCheckPage from "./HealthCheckPage";
import { checkHealth } from "../services/healthService";

vi.mock("../services/healthService");

describe("HealthCheckPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("hiện thành công khi backend trả về", async () => {
    checkHealth.mockResolvedValue({ status: "ok" });
    render(<HealthCheckPage />);
    expect(await screen.findByText(/kết nối backend thành công/i)).toBeInTheDocument();
  });

  it("hiện lỗi khi backend không gọi được", async () => {
    checkHealth.mockRejectedValue({ message: "boom" });
    render(<HealthCheckPage />);
    expect(await screen.findByText(/không gọi được backend: boom/i)).toBeInTheDocument();
  });
});
