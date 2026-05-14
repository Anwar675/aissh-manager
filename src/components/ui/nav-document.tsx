"use client"


import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,

  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { GoDotFill } from "react-icons/go"

export function NavDocuments() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        ACTIVE VM
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem >
              <div className="flex gap-2 items-center">
                <GoDotFill className="text-green-500 text-2xl" />
                12 Runs
              </div>
            </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem >
              <div className="flex gap-2 items-center">
                <GoDotFill className="text-yellow-500 text-2xl" />
                12 Runs
              </div>
            </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem >
              <div className="flex gap-2 items-center">
                <GoDotFill className="text-red-500 text-2xl" />
                12 Runs
              </div>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
