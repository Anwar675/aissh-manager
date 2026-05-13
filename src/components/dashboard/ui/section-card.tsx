import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Progress } from "@/components/ui/progress";
import { GoDotFill } from "react-icons/go";

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>VRAM</CardDescription>
          <CardTitle className="text-2xl font-semibold text-blue-400 tabular-nums @[250px]/card:text-3xl">
            24 / <span className="text-xl text-gray-500">80GB</span>
          </CardTitle>
          <h3 className="text-gray-400">30% used</h3>
          <Progress value={30} className="bg-blue-400" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Temps</CardDescription>
          <CardTitle className="text-2xl font-semibold text-yellow-500 tabular-nums @[250px]/card:text-3xl">
            72°C
          </CardTitle>
          <div className="flex gap-2 items-center text-yellow-500">
            <GoDotFill />
            <p>Normal</p>
          </div>
          <Progress value={70} className="bg-yellow-500" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Power</CardDescription>
          <CardTitle className="text-2xl font-semibold text-red-500 tabular-nums @[250px]/card:text-3xl">
            350W
          </CardTitle>
          <div className="flex gap-2 items-center text-red-500">
            <GoDotFill />
            <p>High</p>
          </div>
          <Progress value={70} className="bg-red-500" />
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Util</CardDescription>
          <CardTitle className="text-2xl font-semibold text-green-500 tabular-nums @[250px]/card:text-3xl">
            94%
          </CardTitle>
          <div className="flex gap-2 items-center text-green-500">
            <GoDotFill />
            <p>Active</p>
          </div>
          <Progress value={90} className="bg-green-500" />
        </CardHeader>
      </Card>
    </div>
  );
}
