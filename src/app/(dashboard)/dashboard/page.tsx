import { DashboardSkeleton } from "@/components/dashboard/ui/dashboard-skeleton";
import { DataTable } from "@/components/dashboard/ui/data-table";
import { LineHeader } from "@/components/dashboard/ui/line-header";
import { prisma } from "../../../../packages/db/src";

export const dynamic = "force-dynamic";

async function getVirtualMachines() {
  try {
    const remotes = await prisma.sSHRemote.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        provider: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      data: remotes.map((remote) => ({
        ...remote,
        description: remote.description ?? "",
        provider: remote.provider ?? "local",
        status: remote.isActive ? "Active" : "Saved",
        createdAt: remote.createdAt.toISOString(),
      })),
      error: null,
    };
  } catch (error) {
    console.error("Failed to load virtual machines", error);

    return {
      data: [],
      error:
        "Không thể tải danh sách máy ảo. Kiểm tra lại Postgres hoặc DATABASE_URL rồi refresh trang.",
    };
  }
}

const Page = async () => {
  const { data, error } = await getVirtualMachines();

  if (error) {
    return (
      <div className="py-4 px-2">
        <LineHeader title="VIRTUAL MACHINES" />
        <DashboardSkeleton message={error} />
      </div>
    );
  }

  return (
    <div className="py-4 px-2">
      <LineHeader title="VIRTUAL MACHINES" />
      <DataTable data={data} />
    </div>
  );
};

export default Page;
