"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import * as React from "react";

import {
  formatDuration,
  getBillingEnd,
  getHourlyPriceLabel,
  getTotalCostLabel,
  getUsageStart,
  type BillingSource,
} from "@/lib/billing";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { LineHeader } from "./line-header";

type ActiveSSHRemote = BillingSource & {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
};

async function fetchActiveSSHRemote(sshId?: string): Promise<ActiveSSHRemote> {
  if (!sshId) {
    throw new Error("Missing SSH id");
  }

  const response = await fetch(`/api/ssh/${encodeURIComponent(sshId)}`, {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Failed to load SSH connection");
  }

  return payload.data;
}

export default function JobPanel() {
  const params = useParams<{ dasboardId?: string }>();
  const sshId = params.dasboardId;
  const [billingDate, setBillingDate] = React.useState(() => new Date());
  const { displayCurrency, toggleDisplayCurrency } = useDisplayCurrency();

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setBillingDate(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const { data: activeRemote } = useQuery({
    queryKey: ["ssh-billing", sshId],
    queryFn: () => fetchActiveSSHRemote(sshId),
    enabled: Boolean(sshId),
    refetchInterval: 30000,
    retry: false,
  });

  const billingEnd = activeRemote
    ? getBillingEnd(activeRemote, billingDate)
    : billingDate;
  const usageTime = activeRemote
    ? formatDuration(getUsageStart(activeRemote), billingEnd)
    : "Not available";

  return (
    <div className="overflow-hidden ">
      <div className="flex flex-1">
        <div className="flex-1 overflow-hidden ">
            <div >
                <LineHeader title="ACTIVE JOBS" />
            </div>
        
          {/* Job Panel */}
          <div className="overflow-hidden relative rounded-md min-h-100 m-[14px_20px] border border-[#30363d] bg-[#161b22]">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#1c2128] px-3 py-2">
              <span className="animate-pulse rounded border border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.15)] px-[7px] py-[2px] text-sm tracking-[0.05em] text-[#3fb950]">
                ● RUNNING
              </span>
                
              <span className="text-[12px] font-semibold tracking-[0.05em] text-[#e6edf3]">
                {activeRemote?.name ?? "TTS_LORA_EP5"}
              </span>

              <span className="ml-auto text-sm text-[#484f58]">
                ETA: <span className="text-[#8b949e]">2h 15m</span>
              </span>
              <button
                className="rounded border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)] px-2 py-1 text-[11px] font-semibold text-[#58a6ff] transition hover:bg-[rgba(88,166,255,0.2)]"
                type="button"
                onClick={toggleDisplayCurrency}
              >
                {displayCurrency}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 border-b border-[#30363d]">
              <div className="border-r border-[#21262d] px-3 py-2">
                <p className="mb-[3px] text-[9px] uppercase tracking-[0.08em] text-[#484f58]">
                  Epoch
                </p>

                <p className="text-[12px] font-semibold text-[#58a6ff]">
                  45{" "}
                  <span className="text-sm font-normal text-[#484f58]">
                    / 100
                  </span>
                </p>
              </div>

              <div className="border-r border-[#21262d] px-3 py-2">
                <p className="mb-[3px] text-[9px] uppercase tracking-[0.08em] text-[#484f58]">
                  Loss
                </p>

                <p className="text-[12px] font-semibold text-[#3fb950]">
                  0.234
                </p>
              </div>

              <div className="border-r border-[#21262d] px-3 py-2">
                <p className="mb-[3px] text-[9px] uppercase tracking-[0.08em] text-[#484f58]">
                  Price/hr
                </p>

                <p className="text-[12px] font-semibold text-[#8b949e]">
                  {activeRemote
                    ? getHourlyPriceLabel(activeRemote, displayCurrency)
                    : "Not set"}
                </p>
              </div>

              <div className="px-3 py-2">
                <p className="mb-[3px] text-[9px] uppercase tracking-[0.08em] text-[#484f58]">
                  Total price
                </p>

                <p className="text-[12px] font-semibold text-[#8b949e]">
                  {activeRemote
                    ? getTotalCostLabel(
                        activeRemote,
                        billingDate,
                        displayCurrency,
                      )
                    : "Not available"}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="border-b border-[#21262d] px-3 py-[10px]">
              <div className="mb-[6px] flex justify-between">
                <span className="text-sm text-[#8b949e]">
                  Training progress
                </span>

                <span className="text-sm font-semibold text-[#58a6ff]">
                  45%
                </span>
              </div>

              <div className="relative h-[6px] overflow-hidden rounded-[3px] bg-[#21262d]">
                <div className="h-full w-[45%] rounded-[3px] bg-gradient-to-r from-[#1f6feb] to-[#58a6ff] transition-all duration-500" />
              </div>

              <div className="mt-1 text-right text-sm text-[#8b949e]">
                epoch 45 / 100
              </div>
            </div>

            {/* Logs */}
            <div className="px-3 py-2">
              <div className="mb-[6px] flex items-center gap-[5px] text-sm text-[#484f58]">
                <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#3fb950]" />
                Live Logs
              </div>

              <div className="flex gap-2 py-[2px] text-sm">
                <span className="shrink-0 text-[#484f58]">[12:34:56]</span>

                <span className="text-[#c9d1d9]">
                  Step <span className="text-[#58a6ff]">4500</span>: loss=
                  <span className="text-[#3fb950]">0.234</span> lr=1e-05
                </span>
              </div>

              <div className="flex gap-2 py-[2px] text-sm">
                <span className="shrink-0 text-[#484f58]">[12:35:01]</span>

                <span className="text-[#c9d1d9]">
                  <span className="text-[#d29922]">→</span> Saving checkpoint to
                  ./ckpt/ep45/
                </span>
              </div>

              <div className="flex gap-2 py-[2px] text-sm">
                <span className="shrink-0 text-[#484f58]">[12:35:04]</span>

                <span className="text-[#c9d1d9]">
                  Checkpoint saved. Resuming training...
                </span>
              </div>

              <div className="flex gap-2 py-[2px] text-sm">
                <span className="shrink-0 text-[#484f58]">[12:35:09]</span>

                <span className="text-[#c9d1d9]">
                  Step <span className="text-[#58a6ff]">4512</span>: loss=
                  <span className="text-[#3fb950]">0.231</span>
                  <span className="ml-1 inline-block h-3 w-[6px] animate-pulse bg-[#58a6ff]" />
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="absolute bottom-0 left-0 right-0 items-center flex gap-2 border-t border-[#30363d] bg-[#1c2128] px-3 py-2">
              <button className="rounded border border-[rgba(210,153,34,0.3)] bg-[rgba(210,153,34,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#d29922] transition hover:bg-[rgba(210,153,34,0.2)]">
                ⏸ Pause
              </button>

              <button className="rounded border border-[rgba(248,81,73,0.3)] bg-[rgba(248,81,73,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#f85149] transition hover:bg-[rgba(248,81,73,0.2)]">
                ⏹ Stop
              </button>

              <button className="rounded border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#58a6ff] transition hover:bg-[rgba(88,166,255,0.2)]">
                📁 View Checkpoints
              </button>

              <span className="ml-auto text-sm text-[#484f58]">
                usage: <span className="text-[#8b949e]">{usageTime}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
