import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { RoleProvider, useRole } from "./RoleContext";

function Demo() {
  const { role, setRole } = useRole();
  return <button onClick={() => setRole("owner")}>{role ?? "none"}</button>;
}

describe("RoleContext", () => {
  afterEach(() => localStorage.clear());

  it("khong co token thi role la null", () => {
    render(<RoleProvider><Demo /></RoleProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("none");
  });

  it("co token hop le thi doc duoc role tu JWT", () => {
    // JWT payload { role: "customer" } encode base64
    const fakeToken = "h." + btoa(JSON.stringify({ role: "customer" })) + ".s";
    localStorage.setItem("access_token", fakeToken);
    render(<RoleProvider><Demo /></RoleProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("customer");
  });

  it("setRole cap nhat gia tri moi ngay lap tuc", async () => {
    render(<RoleProvider><Demo /></RoleProvider>);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(btn).toHaveTextContent("owner");
  });

  it("bao loi khi dung ngoai RoleProvider", () => {
    expect(() => render(<Demo />)).toThrow("RoleProvider");
  });
});
