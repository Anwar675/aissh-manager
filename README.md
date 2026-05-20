# AISSH Manager

AISSH Manager là dashboard quản lý SSH connection và máy ảo cloud provider.
Ứng dụng lưu thông tin kết nối SSH trong database, còn provider API key được đọc
từ `.env` ở server để lấy danh sách instance và control start/stop.

## Luồng Tạo Máy Ảo / SSH Connection

1. Người dùng mở dialog tạo connection ở dashboard.
2. `CreateSSHDialog` gọi `GET /api/ssh/provider/instances?provider=...` khi chọn provider.
3. API route đọc API key trong `.env`, gọi provider thật như Vast AI, RunPod, Lambda Labs hoặc Azure.
4. Route trả về danh sách instance/pod/VM gồm `id`, `name`, `host`, `port`, `username`, `machineType`, `pricePerHour`.
5. Người dùng chọn instance thật theo provider ID. Form tự điền các field SSH nếu provider trả về đủ dữ liệu.
6. Khi submit, `POST /api/ssh` lưu SSH connection vào bảng `SSHRemote`.
7. Dashboard dùng `DataTable` để hiển thị, connect SSH, start, stop, edit, delete.

API key không gửi xuống browser. Browser chỉ nhận metadata cần thiết để người dùng chọn máy.

## Provider API Keys

Đặt key trong `.env`:

```env
VAST_AI_API_KEY=
RUNPOD_API_KEY=
LAMBDA_LABS_API_KEY=
TENSORDOCK_API_KEY=
AZURE_SUBSCRIPTION_ID=
AZURE_ACCESS_TOKEN=
AZURE_RESOURCE_GROUP=
```

## API Routes

`src/app/api/ssh/route.ts`

- `GET`: trả summary tổng số SSH remote, active, idle.
- `POST`: tạo SSH connection mới.
- Lưu provider, `instanceId`, `machineType`, host, port, username, auth và billing price.

`src/app/api/ssh/provider/instances/route.ts`

- `GET /api/ssh/provider/instances?provider=...`
- Dùng API key từ `.env` để gọi provider và normalize dữ liệu instance.
- Output chuẩn là `ProviderInstance`: `id`, `name`, `status`, `machineType`, `host`, `port`, `username`, `pricePerHour`, `region`.
- Với Vast AI, Direct SSH phải dùng `ssh_host` và `ssh_port`; không dùng port service khác.

`src/app/api/ssh/provider/route.ts`

- Cập nhật metadata provider cho một SSH remote đã tồn tại.
- Không lưu API key mới vào DB; key ưu tiên nằm trong `.env`.

`src/app/api/ssh/[sshId]/route.ts`

- `GET`: lấy chi tiết một SSH remote.
- `PATCH`: edit connection, provider metadata, auth, price.
- `DELETE`: xóa SSH remote.

`src/app/api/ssh/[sshId]/connect/route.ts`

- Tạo SSH session runtime bằng thông tin đã lưu.
- Mark remote active và set usage time.

`src/app/api/ssh/[sshId]/stop/route.ts`

- Disconnect SSH session local.
- Nếu remote có provider + `instanceId`, gọi provider `stopInstance()`.
- Mark remote inactive và set `usageEndedAt`.

`src/app/api/ssh/[sshId]/start/route.ts`

- Nếu remote có provider + `instanceId`, gọi provider `startInstance()`.
- Mark remote active, reset `usageEndedAt`, set `usageStartedAt`.

## Provider Services

`services/providers/base.ts`

- Định nghĩa interface chung `BaseProvider`.
- Mỗi provider phải implement `stopInstance()`.
- `startInstance()` và `getInstanceStatus()` có default throw nếu provider chưa hỗ trợ.

`services/providers/index.ts`

- Factory `createProvider(provider, instanceId, apiKey?, region?)`.
- Resolve API key từ `.env`.
- Map provider string sang class tương ứng.

`services/providers/vast-ai.ts`

- Control Vast AI instance.
- Stop/start dùng API instance state.
- Direct SSH metadata được lấy ở route instances, không hardcode port.

`services/providers/runpod.ts`

- Control RunPod pod qua GraphQL.
- `podStop` để stop, `podResume` để start.

`services/providers/lambda-labs.ts`

- Terminate Lambda Labs instance.
- Hiện chưa có start lại instance cũ vì Lambda Labs terminate là destroy lifecycle.

`services/providers/tensordock.ts`

- Control TensorDock machine bằng machine ID.
- Có stop/start endpoint.

`services/providers/azure.ts`

- Control Azure VM bằng `resourceGroup:vmName`.
- Dùng `AZURE_SUBSCRIPTION_ID`, `AZURE_ACCESS_TOKEN`, `AZURE_RESOURCE_GROUP`.

`services/providers/local.ts`

- Provider placeholder cho máy local/existing server.
- Không gọi cloud API.

## UI Files

`src/components/dashboard/ui/create.tsx`

- Dialog tạo SSH connection.
- Dùng shadcn `Select` cho provider và provider instance.
- Khi chọn provider, gọi route instances để lấy danh sách máy thật.
- Khi chọn instance, auto-fill host/port/user/price nếu provider trả về chính xác.

`src/components/dashboard/ui/data-table.tsx`

- Bảng dashboard chính.
- Hiển thị connection, provider, instance ID, machine type, status, billing.
- Chứa actions: Connect, Start, Stop, Edit, Delete.

`src/components/dashboard/ui/job-paine.tsx`

- Panel billing/usage cho remote đang xem.

`src/components/dashboard/ui/section-card.tsx`

- Hiển thị GPU metrics/cards cho remote active.

## Shared Helpers

`src/lib/vm-types.ts`

- Định nghĩa provider key, env key và type `ProviderInstance`.
- Dùng chung giữa UI và API route để giữ shape dữ liệu provider nhất quán.

`src/lib/billing.ts`

- Tính usage time, hourly price và total cost.
- Hỗ trợ display USD/VND.

`services/ssh/ssh-session-manager.ts`

- Lưu SSH session runtime theo remote ID.
- Dùng khi connect/disconnect và lấy GPU metrics.

`services/ssh/ssh.service.ts`

- Wrapper quanh `node-ssh`.
- Connect bằng password hoặc SSH key.
- Execute command qua SSH.

## Development

```bash
npm run dev
```

Sau khi đổi Prisma schema, chạy migration/generate tương ứng:

```bash
npm exec prisma generate -- --schema packages/db/prisma/schema.prisma
```
