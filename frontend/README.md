# SCB Frontend

## Chạy dự án
Cần Node 22.12+ (khuyến nghị Node 24, CI dùng Node 24).

```bash
cp .env.example .env
npm ci && npm run dev
```
Mở http://localhost:5173

Dùng `npm ci` để không làm đổi `package-lock.json`. Chỉ dùng `npm install <pkg>` khi thêm thư viện mới.

## Lint, test, build
```bash
npm run lint
npm test            
npm run test:watch  
npm run build
```

## Test
Dùng Vitest + React Testing Library (jsdom). Đặt file test cạnh code, tên `*.test.jsx` / `*.test.js`. Mock API bằng `vi.mock`, không gọi backend thật.
