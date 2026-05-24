# AISSH Manager

AISSH Manager là dashboard Next.js dùng để quản lý SSH connection, máy GPU và máy ảo cloud. Ứng dụng lưu thông tin kết nối trong PostgreSQL, đọc API key provider từ `.env` ở server, rồi gom các thao tác connect, monitor, start, stop, auto-stop, billing và training analytics vào một giao diện.

## Tính Năng Chính

- Quản lý SSH connection cho server local/existing server và cloud VM.
- Lấy danh sách instance từ Vast AI, RunPod, Lambda Labs, TensorDock và Azure.
- Kết nối SSH bằng password hoặc private key.
- Start, stop, edit, delete và bulk delete máy đã lưu.
- Hiển thị số lượng VM active, idle và unavailable trong sidebar.
- Theo dõi GPU metrics của máy đang active.
- Gửi terminal input, xem terminal logs, restart hoặc stop terminal session.
- Hẹn giờ auto-stop cho máy đang chọn hoặc toàn bộ máy active.
- Theo dõi cost cơ bản bằng hourly price, usage start/end time và total cost.
- Parse training logs thành analytics: epoch, train loss, validation loss, accuracy, learning rate, throughput, checkpoint và progress.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS và shadcn-style components
- Prisma 7 + PostgreSQL
- TanStack Query
- TanStack Table
- Recharts
- node-ssh

## Các Màn Hình Chính

- `/dashboard` - bảng quản lý VM và SSH connection.
- `/dashboard/[dasboardId]` - GPU metrics, active machine check, terminal controls và usage panel cho một máy.
- `/analytis/[idanalytics]` - training analytics dashboard dựa trên terminal output.

## Screenshots

### Virtual Machines Dashboard

![Virtual Machines Dashboard](/public/dashboard.png)

Dashboard chính để xem toàn bộ SSH remote, trạng thái active/saved, provider, machine type, processing state, pagination và các thao tác như customize columns, auto-stop, add new.

### GPU Metrics Và Terminal

![GPU Metrics and Terminal](/public/terminal.png)

Trang chi tiết máy active hiển thị VRAM, temperature, power, utilization, active job, training progress, live terminal logs và các thao tác pause, restart terminal, analytics.

### Auto Stop Scheduler

![Auto Stop Scheduler](/public/autostop.png)

Dialog hẹn giờ stop provider và disconnect SSH cho máy được chọn hoặc toàn bộ máy active.

### Training Analytics Dashboard

![Training Analytics Dashboard](/public/analytics.png)

Training analytics dashboard parse real-time terminal stream thành current epoch, current loss, best loss, validation loss, loss chart, learning rate schedule và performance metrics.

## Cấu Trúc Dự Án

```text
src/app/api
  metrics/gpu                         API lấy GPU metrics
  ssh                                 SSH summary, create, bulk delete
  ssh/[sshId]                         Chi tiết, edit, delete SSH remote
  ssh/[sshId]/connect                 Mở SSH runtime session
  ssh/[sshId]/start                   Start provider instance
  ssh/[sshId]/stop                    Stop SSH/provider instance
  ssh/[sshId]/terminal/*              Terminal input, logs, restart, stop
  ssh/auto-stop                       Lịch auto-stop
  ssh/provider                        Trạng thái cấu hình provider
  ssh/provider/instances              Lấy danh sách instance từ provider

src/components/dashboard/ui           Dashboard table, create/edit dialog, GPU cards, auto-stop, usage panel
src/components/analytics              Training analytics dashboard
services/providers                    Tích hợp cloud provider
services/ssh                          SSH session manager và auto-stop scheduler
services/monitoring                   Thu thập GPU metrics
packages/db                           Prisma schema, migrations và Prisma client wrapper
```

## Database

Ứng dụng dùng PostgreSQL thông qua Prisma.

- `SSHRemote`: lưu tên máy, host, port, username, auth type, provider metadata, trạng thái active, thông tin billing và timestamps.
- `AutoStop`: lưu lịch stop máy cho một SSH remote hoặc toàn bộ máy đang active.

## Biến Môi Trường

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Bắt buộc:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

Tuỳ chọn cho SSH key và provider:

```env
SSH_KEY_NAME=
VAST_AI_API_KEY=
RUNPOD_API_KEY=
LAMBDA_LABS_API_KEY=
TENSORDOCK_API_KEY=
AZURE_SUBSCRIPTION_ID=
AZURE_ACCESS_TOKEN=
AZURE_RESOURCE_GROUP=
```

API key provider chỉ được đọc ở server. Browser chỉ nhận metadata đã normalize để hiển thị và chọn máy.

## Setup Bằng pnpm

1. Cài dependencies.

```bash
pnpm install
```

2. Tạo và cấu hình `.env`.

```bash
cp .env.example .env
```

Sau đó điền `DATABASE_URL` và các provider key bạn muốn dùng.

3. Generate Prisma client.

```bash
pnpm exec prisma generate --schema packages/db/prisma/schema.prisma
```

4. Chạy migration cho database.

```bash
pnpm exec prisma migrate dev --schema packages/db/prisma/schema.prisma
```

5. Chạy dev server.

```bash
pnpm dev
```

Mở app tại `http://localhost:3000`.

## Scripts

```bash
pnpm dev      # Chạy Next.js dev server
pnpm build    # Build production
pnpm start    # Chạy production server
pnpm lint     # Chạy ESLint
```

## Provider Notes

- `local` dùng cho server có sẵn, không gọi cloud API.
- Vast AI, RunPod, TensorDock và Azure hỗ trợ start/stop theo khả năng API của từng provider.
- Lambda Labs stop hiện là terminate instance, nên coi như destroy lifecycle.
- Azure cần `AZURE_SUBSCRIPTION_ID`, `AZURE_ACCESS_TOKEN` và `AZURE_RESOURCE_GROUP` để list/control VM.

## Ghi Chú Development

- API dùng Next.js Route Handlers trong `src/app/api`.
- SSH runtime session được giữ trong memory tại `services/ssh/ssh-session-manager.ts`.
- GPU metrics ưu tiên lấy từ SSH session đang active; nếu chưa có session thì app connect bằng thông tin SSH đã lưu.
- Training analytics parse dữ liệu từ terminal logs và cache theo analytics page trong browser storage.
- Sau khi đổi Prisma schema, chạy lại:

```bash
pnpm exec prisma generate --schema packages/db/prisma/schema.prisma
pnpm exec prisma migrate dev --config packages/db/prisma.config.ts
```
