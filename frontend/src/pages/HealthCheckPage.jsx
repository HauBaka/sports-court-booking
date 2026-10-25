import { useCallback, useEffect, useState } from "react";
import { checkHealth } from "../services/healthService";

export default function HealthCheckPage() {
  const [status, setStatus] = useState("loading"); 
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await checkHealth();
      setData(result);
      setStatus("ok");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div>
      <h1>Healthcheck</h1>
      <p>
        API: <code>{import.meta.env.VITE_API_URL}</code>
      </p>

      {status === "loading" && <p>Đang kiểm tra...</p>}
      {status === "ok" && (
        <>
          <p className="ok">Kết nối backend thành công</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </>
      )}
      {status === "error" && (
        <p className="fail">Không gọi được backend: {error}</p>
      )}

      <button onClick={run}>Kiểm tra lại</button>
    </div>
  );
}