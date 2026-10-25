# Code build trên hosting, không chỉnh sửa nếu không cần.
import os
import uvicorn

if __name__ == "__main__":
    port = int(
        os.environ.get("SERVER_PORT", os.environ.get("PORT", "26008"))
    )

    print(f"Starting API on port {port}", flush=True)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
