import { useCallback, useEffect, useState } from "react";

/** Đếm ngược theo giây. Trả về [số giây còn lại, hàm start(giây)]. */
export default function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const running = seconds > 0;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback((from) => setSeconds(from), []);
  return [seconds, start];
}
