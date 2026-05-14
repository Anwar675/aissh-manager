import { DataTable } from "@/components/dashboard/ui/data-table";
import { LineHeader } from "@/components/dashboard/ui/line-header";
import data from "@/lib/data.json";
const Page = () => {
  return (
    <div className="py-4 px-2">
        <LineHeader title="GPU INSTANCES" />
        <DataTable data={data} />
    </div>
  )
};

export default Page;
