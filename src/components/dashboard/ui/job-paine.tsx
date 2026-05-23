"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import * as React from "react";
import { FaChartLine } from "react-icons/fa";
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
import Link from "next/link";

type ActiveSSHRemote = BillingSource & {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  terminalRunning: boolean;
  terminalProgressPercent: number | null;
};

type TerminalLine = {
  id: number;
  time: string;
  type: "stdout" | "stderr" | "system";
  text: string;
};

type JobMetrics = {
  epochCurrent: number | null;
  epochTotal: number | null;
  stepCurrent: number | null;
  stepTotal: number | null;
  loss: string | null;
  progressPercent: number | null;
  eta: string | null;
};

const DEFAULT_TERMINAL_COMMAND = "tail -n 80 -F train.log";

type TerminalControlState = {
  mode: "text" | "escape" | "csi" | "osc" | "osc-escape" | "charset";
  alternateScreen: boolean;
  csi: string;
  specialGraphics: boolean;
};

function isCsiFinal(char: string) {
  const code = char.charCodeAt(0);

  return code >= 0x40 && code <= 0x7e;
}

function createTerminalControlState(): TerminalControlState {
  return {
    mode: "text",
    alternateScreen: false,
    csi: "",
    specialGraphics: false,
  };
}

function updateCsiState(sequence: string, state: TerminalControlState) {
  if (/^\?(?:47|1047|1049)h$/.test(sequence)) {
    state.alternateScreen = true;
    return;
  }

  if (/^\?(?:47|1047|1049)l$/.test(sequence)) {
    state.alternateScreen = false;
  }
}

function mapSpecialGraphic(char: string) {
  switch (char) {
    case "j":
      return "┘";
    case "k":
      return "┐";
    case "l":
      return "┌";
    case "m":
      return "└";
    case "n":
      return "┼";
    case "q":
      return "─";
    case "t":
      return "├";
    case "u":
      return "┤";
    case "v":
      return "┴";
    case "w":
      return "┬";
    case "x":
      return "│";
    default:
      return char;
  }
}

function stripTerminalControlCodes(
  value: string,
  state: TerminalControlState,
) {
  let output = "";

  for (const char of value) {
    switch (state.mode) {
      case "escape":
        if (char === "[") {
          state.mode = "csi";
          state.csi = "";
        } else if (char === "]") {
          state.mode = "osc";
        } else if ("()#%*+-./".includes(char)) {
          state.mode = "charset";
        } else {
          state.mode = "text";
        }
        break;

      case "csi":
        if (isCsiFinal(char)) {
          updateCsiState(`${state.csi}${char}`, state);
          state.csi = "";
          state.mode = "text";
        } else {
          state.csi += char;
        }
        break;

      case "osc":
        if (char === "\x07") {
          state.mode = "text";
        } else if (char === "\x1b") {
          state.mode = "osc-escape";
        }
        break;

      case "osc-escape":
        state.mode = char === "\\" ? "text" : "osc";
        break;

      case "charset":
        state.specialGraphics = char === "0";
        state.mode = "text";
        break;

      default:
        if (char === "\x1b") {
          state.mode = "escape";
        } else if (char === "\b") {
          output = output.slice(0, -1);
        } else if (char === "\n" || char === "\r" || char === "\t") {
          output += char;
        } else if (char >= " " && char !== "\x7f") {
          output += state.specialGraphics ? mapSpecialGraphic(char) : char;
        }
    }
  }

  return output.replace(/\[ssh_tmux\][^\n]*/g, "");
}

function createEmptyJobMetrics(): JobMetrics {
  return {
    epochCurrent: null,
    epochTotal: null,
    stepCurrent: null,
    stepTotal: null,
    loss: null,
    progressPercent: null,
    eta: null,
  };
}

function parseMetricNumber(value: string) {
  const parsed = Number(value.replace(",", ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetricNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseJobMetrics(lines: TerminalLine[]) {
  const metrics = createEmptyJobMetrics();

  for (const line of lines) {
    if (line.type === "system") {
      continue;
    }

    const text = line.text;
    const epochMatch = text.match(
      /\bepoch\s*(?:[:=#]|\s)?\s*(\d+(?:\.\d+)?)\s*(?:\/|of)\s*(\d+(?:\.\d+)?)/i,
    );
    const stepMatch = text.match(
      /\bstep\s*(?:[:=#]|\s)?\s*(\d+(?:\.\d+)?)\s*(?:\/|of)\s*(\d+(?:\.\d+)?)/i,
    );
    const lossMatch = text.match(
      /\b(?:train[_-]?)?loss(?:[_-]?(?:total|avg|mean))?\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    );
    const percentMatch = text.match(/\b(100|[1-9]?\d(?:\.\d+)?)%/);
    const etaMatch = text.match(
      /\b(?:eta|remaining)\s*[:=]?\s*([0-9]+(?::[0-9]{2}){1,2}|(?:[0-9]+d\s*)?(?:[0-9]+h\s*)?(?:[0-9]+m\s*)?(?:[0-9]+s)?)/i,
    );

    if (epochMatch) {
      const current = parseMetricNumber(epochMatch[1]);
      const total = parseMetricNumber(epochMatch[2]);

      if (current !== null) {
        metrics.epochCurrent = current;
      }

      if (total !== null) {
        metrics.epochTotal = total;
      }
    }

    if (stepMatch) {
      const current = parseMetricNumber(stepMatch[1]);
      const total = parseMetricNumber(stepMatch[2]);

      if (current !== null) {
        metrics.stepCurrent = current;
      }

      if (total !== null) {
        metrics.stepTotal = total;
      }
    }

    if (lossMatch) {
      metrics.loss = lossMatch[1];
    }

    if (percentMatch) {
      const percent = parseMetricNumber(percentMatch[1]);

      if (percent !== null) {
        metrics.progressPercent = clampPercent(percent);
      }
    }

    if (etaMatch) {
      const eta = etaMatch[1]?.trim();

      if (eta) {
        metrics.eta = eta;
      }
    }
  }

  if (
    metrics.progressPercent === null &&
    metrics.epochCurrent !== null &&
    metrics.epochTotal
  ) {
    metrics.progressPercent = clampPercent(
      (metrics.epochCurrent / metrics.epochTotal) * 100,
    );
  }

  if (
    metrics.progressPercent === null &&
    metrics.stepCurrent !== null &&
    metrics.stepTotal
  ) {
    metrics.progressPercent = clampPercent(
      (metrics.stepCurrent / metrics.stepTotal) * 100,
    );
  }

  return metrics;
}

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
  const [terminalInput, setTerminalInput] = React.useState(
    DEFAULT_TERMINAL_COMMAND,
  );
  const [terminalLines, setTerminalLines] = React.useState<TerminalLine[]>([]);
  const [isTerminalRunning, setIsTerminalRunning] = React.useState(false);
  const [isTerminalReady, setIsTerminalReady] = React.useState(false);
  const [isPausingTerminal, setIsPausingTerminal] = React.useState(false);
  const [isRestartingTerminal, setIsRestartingTerminal] =
    React.useState(false);
  const [terminalError, setTerminalError] = React.useState<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const terminalViewportRef = React.useRef<HTMLDivElement | null>(null);
  const lineIdRef = React.useRef(0);
  const terminalControlStateRef = React.useRef<TerminalControlState>(
    createTerminalControlState(),
  );
  const terminalLineOpenRef = React.useRef(false);
  const terminalPendingCarriageReturnRef = React.useRef(false);
  const { displayCurrency, toggleDisplayCurrency } = useDisplayCurrency();

  const appendTerminalMessage = React.useCallback(
    (type: TerminalLine["type"], text: string) => {
      const messageControlState = createTerminalControlState();
      const parts = stripTerminalControlCodes(
        text,
        messageControlState,
      )
        .replace(/\r/g, "")
        .split("\n");

      setTerminalLines((current) => {
        const next = [...current];

        for (const part of parts) {
          if (!part.trim()) {
            continue;
          }

          next.push({
            id: lineIdRef.current++,
            time: new Date().toLocaleTimeString(),
            type,
            text: part,
          });
        }

        return next.slice(-200);
      });

      terminalLineOpenRef.current = false;
      terminalPendingCarriageReturnRef.current = false;
    },
    [],
  );

  const appendTerminalOutput = React.useCallback(
    (type: Exclude<TerminalLine["type"], "system">, text: string) => {
      const cleaned = stripTerminalControlCodes(
        text,
        terminalControlStateRef.current,
      ).replace(/\r\n/g, "\n");

      if (!cleaned) {
        return;
      }

      setTerminalLines((current) => {
        const next = [...current];

        const ensureLine = () => {
          const last = next.at(-1);

          if (!terminalLineOpenRef.current || !last || last.type !== type) {
            next.push({
              id: lineIdRef.current++,
              time: new Date().toLocaleTimeString(),
              type,
              text: "",
            });
          }

          terminalLineOpenRef.current = true;
        };

        const applyCarriageReturn = () => {
          ensureLine();
          next[next.length - 1] = {
            ...next[next.length - 1],
            text: "",
          };
        };

        for (const char of cleaned) {
          if (terminalPendingCarriageReturnRef.current) {
            terminalPendingCarriageReturnRef.current = false;

            if (char === "\n") {
              terminalLineOpenRef.current = false;
              continue;
            }

            applyCarriageReturn();
          }

          if (char === "\r") {
            terminalPendingCarriageReturnRef.current = true;
            continue;
          }

          if (char === "\n") {
            terminalLineOpenRef.current = false;
            continue;
          }

          ensureLine();
          next[next.length - 1] = {
            ...next[next.length - 1],
            text: `${next[next.length - 1].text}${char}`,
          };
        }

        return next.slice(-300);
      });
    },
    [],
  );

  const stopTerminalStream = React.useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsTerminalRunning(false);
    setIsTerminalReady(false);
  }, []);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setBillingDate(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  React.useEffect(() => {
    const viewport = terminalViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [terminalLines]);

  const { data: activeRemote, refetch: refetchActiveRemote } = useQuery({
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
  const jobMetrics = React.useMemo(
    () => parseJobMetrics(terminalLines),
    [terminalLines],
  );
  const progressPercent =
    jobMetrics.progressPercent === null
      ? null
      : Math.round(jobMetrics.progressPercent);
  const progressWidth = `${progressPercent ?? 0}%`;
  const progressLabel =
    progressPercent === null ? "Waiting for logs" : `${progressPercent}%`;
  const progressDetail =
    jobMetrics.epochCurrent !== null
      ? `epoch ${formatMetricNumber(jobMetrics.epochCurrent)}${
          jobMetrics.epochTotal !== null
            ? ` / ${formatMetricNumber(jobMetrics.epochTotal)}`
            : ""
        }`
      : jobMetrics.stepCurrent !== null
        ? `step ${formatMetricNumber(jobMetrics.stepCurrent)}${
            jobMetrics.stepTotal !== null
              ? ` / ${formatMetricNumber(jobMetrics.stepTotal)}`
              : ""
          }`
        : "Start the terminal stream to read progress";
  const epochValue =
    jobMetrics.epochCurrent === null
      ? "Not available"
      : formatMetricNumber(jobMetrics.epochCurrent);
  const epochTotalValue =
    jobMetrics.epochTotal === null
      ? null
      : formatMetricNumber(jobMetrics.epochTotal);
  const lossValue = jobMetrics.loss ?? "Not available";
  const etaValue = jobMetrics.eta ?? "Not available";
  const dashboardTerminalRunning =
    isTerminalReady || Boolean(activeRemote?.terminalRunning);
  const statusLabel = dashboardTerminalRunning
    ? "RUNNING"
    : activeRemote?.isActive
      ? "ACTIVE"
      : "IDLE";
  const statusClassName = dashboardTerminalRunning
    ? "animate-pulse border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.15)] text-[#3fb950]"
    : activeRemote?.isActive
      ? "border-[rgba(210,153,34,0.3)] bg-[rgba(210,153,34,0.12)] text-[#d29922]"
      : "border-[#30363d] bg-[#21262d] text-[#8b949e]";

  const openTerminalStream = React.useCallback(
    (openingMessage = "Opening terminal stream...") => {
      if (!sshId) {
        return;
      }

      stopTerminalStream();
      setTerminalError(null);
      setTerminalLines([]);
      setIsTerminalRunning(true);
      setIsTerminalReady(false);
      terminalControlStateRef.current = createTerminalControlState();
      terminalLineOpenRef.current = false;
      terminalPendingCarriageReturnRef.current = false;
      appendTerminalMessage("system", openingMessage);

      const source = new EventSource(
        `/api/ssh/${encodeURIComponent(sshId)}/terminal/logs`,
      );

      eventSourceRef.current = source;

      source.addEventListener("system", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };

        appendTerminalMessage("system", payload.message ?? "Terminal connected");
        setIsTerminalReady(true);
        void refetchActiveRemote();
      });

      source.addEventListener("stdout", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chunk?: string;
        };

        appendTerminalOutput("stdout", payload.chunk ?? "");
      });

      source.addEventListener("stderr", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chunk?: string;
        };

        appendTerminalOutput("stderr", payload.chunk ?? "");
      });

      source.addEventListener("terminal-error", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };
        const message = payload.message ?? "Terminal stream failed";

        setTerminalError(message);
        appendTerminalMessage("stderr", message);
        stopTerminalStream();
        void refetchActiveRemote();
      });

      source.addEventListener("done", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };

        appendTerminalMessage("system", payload.message ?? "Terminal stopped");
        stopTerminalStream();
        void refetchActiveRemote();
      });

      source.onerror = () => {
        setTerminalError("Terminal stream disconnected");
        appendTerminalMessage("stderr", "Terminal stream disconnected");
        stopTerminalStream();
        void refetchActiveRemote();
      };
    },
    [
      appendTerminalMessage,
      appendTerminalOutput,
      refetchActiveRemote,
      sshId,
      stopTerminalStream,
    ],
  );

  const handleStartTerminal = React.useCallback(() => {
    if (!sshId || isTerminalRunning) {
      return;
    }

    openTerminalStream();
  }, [isTerminalRunning, openTerminalStream, sshId]);

  const handleSendTerminalInput = React.useCallback(async () => {
    if (!sshId || !isTerminalReady || !terminalInput.trim()) {
      return;
    }

    const input = terminalInput;
    setTerminalInput("");

    try {
      const response = await fetch(
        `/api/ssh/${encodeURIComponent(sshId)}/terminal/input`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: `${input}\r`,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to write terminal input");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to write terminal input";

      setTerminalError(message);
      appendTerminalMessage("stderr", message);
      setTerminalInput(input);
    }
  }, [appendTerminalMessage, isTerminalReady, sshId, terminalInput]);

  const handlePauseTerminal = React.useCallback(async () => {
    if (!sshId || isPausingTerminal) {
      return;
    }

    setIsPausingTerminal(true);
    appendTerminalMessage("system", "Sending Ctrl+C...");

    try {
      const response = await fetch(
        `/api/ssh/${encodeURIComponent(sshId)}/terminal/stop`,
        {
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to pause terminal");
      }

      appendTerminalMessage("system", "Ctrl+C sent");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to pause terminal";

      setTerminalError(message);
      appendTerminalMessage("stderr", message);
    } finally {
      setIsPausingTerminal(false);
    }
  }, [appendTerminalMessage, isPausingTerminal, sshId]);

  const handleRestartTerminal = React.useCallback(async () => {
    if (!sshId || isRestartingTerminal) {
      return;
    }

    setIsRestartingTerminal(true);
    appendTerminalMessage("system", "Restarting terminal...");

    try {
      const response = await fetch(
        `/api/ssh/${encodeURIComponent(sshId)}/terminal/restart`,
        {
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to restart terminal");
      }

      openTerminalStream("Terminal restarted. Opening a new shell...");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restart terminal";

      setTerminalError(message);
      appendTerminalMessage("stderr", message);
    } finally {
      setIsRestartingTerminal(false);
    }
  }, [
    appendTerminalMessage,
    isRestartingTerminal,
    openTerminalStream,
    sshId,
  ]);

  return (
    <div className="overflow-hidden ">
      <div className="flex flex-1">
        <div className="flex-1 overflow-hidden ">
          <div>
            <LineHeader title="ACTIVE JOBS" />
          </div>

          {/* Job Panel */}
          <div className="overflow-hidden relative min-h-100 rounded-md border border-[#30363d] bg-[#161b22] m-[14px_20px] pb-16">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#1c2128] px-3 py-2">
              <span
                className={`rounded border px-[7px] py-[2px] text-sm tracking-[0.05em] ${statusClassName}`}
              >
                ● {statusLabel}
              </span>

              <span className="text-[12px] font-semibold tracking-[0.05em] text-[#e6edf3]">
                {activeRemote?.name ?? "No active job"}
              </span>

              <span className="ml-auto text-sm text-[#484f58]">
                ETA: <span className="text-[#8b949e]">{etaValue}</span>
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
                  {epochValue}
                  {epochTotalValue ? (
                    <span className="text-sm font-normal text-[#484f58]">
                      {" "}
                      / {epochTotalValue}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="border-r border-[#21262d] px-3 py-2">
                <p className="mb-[3px] text-[9px] uppercase tracking-[0.08em] text-[#484f58]">
                  Loss
                </p>

                <p className="text-[12px] font-semibold text-[#3fb950]">
                  {lossValue}
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
                  {progressLabel}
                </span>
              </div>

              <div className="relative h-[6px] overflow-hidden rounded-[3px] bg-[#21262d]">
                <div
                  className="h-full rounded-[3px] bg-gradient-to-r from-[#1f6feb] to-[#58a6ff] transition-all duration-500"
                  style={{ width: progressWidth }}
                />
              </div>

              <div className="mt-1 text-right text-sm text-[#8b949e]">
                {progressDetail}
              </div>
            </div>

            {/* Logs */}
            <div className="px-3 py-2">
              <div className="mb-[6px] flex flex-wrap items-center gap-2 text-sm text-[#484f58]">
                <span
                  className={`h-[6px] w-[6px] rounded-full ${
                    isTerminalReady
                      ? "animate-pulse bg-[#3fb950]"
                      : isTerminalRunning
                        ? "bg-[#d29922]"
                      : "bg-[#484f58]"
                  }`}
                />
                <span>Live Terminal Logs</span>
                {terminalError ? (
                  <span className="text-[#f85149]">{terminalError}</span>
                ) : null}
              </div>

              <div className="mb-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#0d1117] px-2 py-2 text-sm text-[#c9d1d9] outline-none transition focus:border-[#58a6ff]"
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSendTerminalInput();
                    }
                  }}
                  placeholder="cd ~/project && export DEBUG=1"
                />
                <button
                  className="rounded border border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.1)] px-3 py-2 text-sm text-[#3fb950] transition hover:bg-[rgba(63,185,80,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!sshId || isTerminalRunning}
                  onClick={handleStartTerminal}
                >
                  Start
                </button>
                <button
                  className="rounded border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)] px-3 py-2 text-sm text-[#58a6ff] transition hover:bg-[rgba(88,166,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={
                    !sshId || !isTerminalReady || !terminalInput.trim()
                  }
                  onClick={() => void handleSendTerminalInput()}
                >
                  Send
                </button>
              </div>

              <div
                className="max-h-64 overflow-y-auto rounded border border-[#21262d] bg-[#0d1117] p-2 font-mono"
                ref={terminalViewportRef}
              >
                {terminalLines.length ? (
                  terminalLines.map((line) => (
                    <div
                      className="flex gap-2 py-[2px] text-sm"
                      key={line.id}
                    >
                      {line.type === "system" ? (
                        <span className="shrink-0 text-[#484f58]">
                          [{line.time}]
                        </span>
                      ) : null}

                      <span
                        className={
                          line.type === "stderr"
                            ? "whitespace-pre-wrap break-words text-[#f85149]"
                            : line.type === "system"
                              ? "whitespace-pre-wrap break-words text-[#d29922]"
                              : "whitespace-pre-wrap break-words text-[#c9d1d9]"
                        }
                      >
                        {line.text}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm text-[#484f58]">
                    Terminal logs will appear here after Start.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="absolute bottom-0 left-0 right-0 items-center flex gap-2 border-t border-[#30363d] bg-[#1c2128] px-3 py-2">
              <button
                className="rounded border border-[rgba(210,153,34,0.3)] bg-[rgba(210,153,34,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#d29922] transition hover:bg-[rgba(210,153,34,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!isTerminalRunning || isPausingTerminal}
                onClick={handlePauseTerminal}
              >
                {isPausingTerminal ? "Pausing" : "⏸ Pause"}
              </button>

              <button
                className="rounded border border-[rgba(248,81,73,0.3)] bg-[rgba(248,81,73,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#f85149] transition hover:bg-[rgba(248,81,73,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!sshId || isRestartingTerminal}
                onClick={handleRestartTerminal}
              >
                {isRestartingTerminal ? "Restarting" : "↻ Restart Terminal"}
              </button>

              <button className="rounded  border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)] px-4 py-2 text-sm tracking-[0.04em] text-[#58a6ff] transition hover:bg-[rgba(88,166,255,0.2)]">
                <Link href={`/analytis/${sshId}`} className="flex items-center gap-2">
                 <FaChartLine /> Analytics
                </Link>
               
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
