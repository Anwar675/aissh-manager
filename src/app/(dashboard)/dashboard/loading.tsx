import { DashboardSkeleton } from "@/components/dashboard/ui/dashboard-skeleton";
import { LineHeader } from "@/components/dashboard/ui/line-header";

export default function Loading() {
  return (
    <div className="py-4 px-2">
      <LineHeader title="VIRTUAL MACHINES" />
      <DashboardSkeleton />
    </div>
  );
}
