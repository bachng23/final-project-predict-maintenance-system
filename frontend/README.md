# Architect Hub Frontend

Next.js app duoc dung lai tu cac HTML Stitch trong repo.

## Stack

- Next.js App Router trong `app/`
- Tailwind CSS qua `tailwind.config.ts` va `app/globals.css`
- shadcn/ui setup qua `components.json`, `lib/utils.ts`, va cac primitive trong `components/ui/`

## Chay local

```bash
npm install
npm run dev
```

Mo `http://localhost:3000`.

## Ket noi Web Backend

Dashboard va trang chi tiet bearing goi truc tiep Web Backend tu browser qua bien moi truong:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Frontend dang thu cac endpoint:

```txt
GET /api/dashboard
GET /api/bearings
GET /api/bearings/:id
GET /api/bearings/:id/telemetry?range=24h
```

Neu backend chua san sang, UI tu dong hien demo fallback va badge `Demo Data`.

## Health check cho Nginx

Frontend co API route:

```txt
GET /api/health
```

Trang chinh tu dong `fetch("/api/health")` va hien badge `Nginx route OK` neu request di dung.

Nginx co the proxy ve Next.js nhu sau:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

