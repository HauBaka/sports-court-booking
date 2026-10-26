import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RoleProvider, useRole } from "./RoleContext";

function Demo() {
  const { role, setRole } = useRole();
  return <button onClick={() => setRole("owner")}>{role}</button>;
}

describe("RoleContext", () => {
  it("mặc định là customer và đổi được role", async () => {
    render(
      <RoleProvider>
        <Demo />
      </RoleProvider>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("customer");
    await userEvent.click(btn);
    expect(btn).toHaveTextContent("owner");
  });

  it("báo lỗi khi dùng ngoài RoleProvider", () => {
    expect(() => render(<Demo />)).toThrow("RoleProvider");
  });
});
