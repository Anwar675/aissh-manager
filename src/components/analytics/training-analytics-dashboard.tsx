"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Gauge,
  ListChecks,
  Save,
  Target,
  Timer,
  TrendingDown,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EpochMetric = {
  epoch: number;
  trainLoss: number | null;
  validationLoss: number | null;
  learningRate: number | null;
  accuracy: number | null;
  gradientNorm: number | null;
  throughput: number | null;
  durationSeconds: number | null;
};

type ActiveTrainingRemote = {
  id: string;
  name: string;
  provider: string;
  machineType: string;
  instanceId: string | null;
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

type TerminalControlState = {
  mode: "text" | "escape" | "csi" | "osc" | "osc-escape" | "charset";
  alternateScreen: boolean;
  csi: string;
  specialGraphics: boolean;
};

type ParsedTrainingAnalytics = {
  epochData: EpochMetric[];
  currentEpoch: number | null;
  totalEpochs: number | null;
  stepCurrent: number | null;
  stepTotal: number | null;
  progressPercent: number | null;
  eta: string | null;
  latestMetric: EpochMetric | null;
  bestMetric: EpochMetric | null;
  checkpointCount: number;
};

const TRAINING_ANALYTICS_STORAGE_PREFIX = "training-analytics-dashboard";
const EPOCH_WINDOW_OPTIONS = [10, 20, 50, 70, 100, "all"] as const;

type EpochWindow = (typeof EPOCH_WINDOW_OPTIONS)[number];

async function fetchActiveTrainingRemotes(): Promise<ActiveTrainingRemote[]> {
  const response = await fetch("/api/ssh?status=active", {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? "Failed to load active machines");
  }

  return payload.data;
}

const chartConfig = {
  trainLoss: {
    label: "Train Loss",
    color: "#4f8cff",
  },
  validationLoss: {
    label: "Validation Loss",
    color: "#f5a524",
  },
  learningRate: {
    label: "Learning Rate",
    color: "#a78bfa",
  },
  accuracy: {
    label: "Accuracy",
    color: "#22c55e",
  },
  gradientNorm: {
    label: "Gradient Norm",
    color: "#ef4444",
  },
  throughput: {
    label: "Throughput",
    color: "#06b6d4",
  },
} satisfies ChartConfig;

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
      return "+";
    case "k":
      return "+";
    case "l":
      return "+";
    case "m":
      return "+";
    case "n":
      return "+";
    case "q":
      return "-";
    case "t":
      return "+";
    case "u":
      return "+";
    case "v":
      return "+";
    case "w":
      return "+";
    case "x":
      return "|";
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

function parseMetricNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function createEmptyEpochMetric(epoch: number): EpochMetric {
  return {
    epoch,
    trainLoss: null,
    validationLoss: null,
    learningRate: null,
    accuracy: null,
    gradientNorm: null,
    throughput: null,
    durationSeconds: null,
  };
}

function getTrainingAnalyticsStorageKey(trainingId: string) {
  return `${TRAINING_ANALYTICS_STORAGE_PREFIX}:${trainingId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeEpochMetric(value: unknown): EpochMetric | null {
  if (!isRecord(value)) {
    return null;
  }

  const epoch = normalizeNullableNumber(value.epoch);

  if (epoch === null) {
    return null;
  }

  return {
    epoch,
    trainLoss: normalizeNullableNumber(value.trainLoss),
    validationLoss: normalizeNullableNumber(value.validationLoss),
    learningRate: normalizeNullableNumber(value.learningRate),
    accuracy: normalizeNullableNumber(value.accuracy),
    gradientNorm: normalizeNullableNumber(value.gradientNorm),
    throughput: normalizeNullableNumber(value.throughput),
    durationSeconds: normalizeNullableNumber(value.durationSeconds),
  };
}

function getBestMetric(epochData: EpochMetric[]) {
  return epochData.reduce<EpochMetric | null>((best, metric) => {
    const metricLoss = metric.validationLoss ?? metric.trainLoss;
    const bestLoss = best?.validationLoss ?? best?.trainLoss;

    if (metricLoss === null) {
      return best;
    }

    if (bestLoss === null || bestLoss === undefined || metricLoss < bestLoss) {
      return metric;
    }

    return best;
  }, null);
}

function createEmptyParsedTrainingAnalytics(): ParsedTrainingAnalytics {
  return {
    epochData: [],
    currentEpoch: null,
    totalEpochs: null,
    stepCurrent: null,
    stepTotal: null,
    progressPercent: null,
    eta: null,
    latestMetric: null,
    bestMetric: null,
    checkpointCount: 0,
  };
}

function normalizeStoredTrainingAnalytics(
  value: unknown,
): ParsedTrainingAnalytics | null {
  if (!isRecord(value)) {
    return null;
  }

  const epochData = Array.isArray(value.epochData)
    ? value.epochData
        .map((metric) => normalizeEpochMetric(metric))
        .filter((metric): metric is EpochMetric => metric !== null)
        .sort((first, second) => first.epoch - second.epoch)
    : [];

  if (!epochData.length) {
    return null;
  }

  return {
    epochData,
    currentEpoch: normalizeNullableNumber(value.currentEpoch),
    totalEpochs: normalizeNullableNumber(value.totalEpochs),
    stepCurrent: normalizeNullableNumber(value.stepCurrent),
    stepTotal: normalizeNullableNumber(value.stepTotal),
    progressPercent: normalizeNullableNumber(value.progressPercent),
    eta: typeof value.eta === "string" ? value.eta : null,
    latestMetric:
      normalizeEpochMetric(value.latestMetric) ?? epochData.at(-1) ?? null,
    bestMetric: getBestMetric(epochData),
    checkpointCount:
      typeof value.checkpointCount === "number" &&
      Number.isFinite(value.checkpointCount)
        ? Math.max(0, Math.round(value.checkpointCount))
        : 0,
  };
}

function readStoredTrainingAnalytics(trainingId: string) {
  try {
    const raw = window.localStorage.getItem(
      getTrainingAnalyticsStorageKey(trainingId),
    );

    if (!raw) {
      return null;
    }

    return normalizeStoredTrainingAnalytics(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredTrainingAnalytics(
  trainingId: string,
  analytics: ParsedTrainingAnalytics,
) {
  try {
    window.localStorage.setItem(
      getTrainingAnalyticsStorageKey(trainingId),
      JSON.stringify(analytics),
    );
  } catch {
    // localStorage can be unavailable or full; live analytics should continue.
  }
}

function firstMetric(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = parseMetricNumber(match?.[1]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function parseEpoch(text: string) {
  const paired = text.match(
    /\b(?:epoch|ep)\s*(?:[:=#]|\[|\s)?\s*(\d+(?:\.\d+)?)\s*(?:\/|of)\s*(\d+(?:\.\d+)?)/i,
  );

  if (paired) {
    return {
      current: parseMetricNumber(paired[1]),
      total: parseMetricNumber(paired[2]),
    };
  }

  const single = text.match(/\b(?:epoch|ep)\s*(?:[:=#]|\[|\s)\s*(\d+(?:\.\d+)?)/i);

  return {
    current: parseMetricNumber(single?.[1]),
    total: null,
  };
}

function parseStep(text: string) {
  const paired = text.match(
    /\b(?:global[_ -]?step|steps?|iter(?:ation)?)\s*(?:[:=#]|\[|\s)?\s*(\d+(?:\.\d+)?)\s*(?:\/|of)\s*(\d+(?:\.\d+)?)/i,
  );

  if (paired) {
    return {
      current: parseMetricNumber(paired[1]),
      total: parseMetricNumber(paired[2]),
    };
  }

  const single = text.match(
    /\b(?:global[_ -]?step|steps?|iter(?:ation)?)\s*[:=#]\s*(\d+(?:\.\d+)?)/i,
  );

  return {
    current: parseMetricNumber(single?.[1]),
    total: null,
  };
}

function parseDurationSeconds(text: string) {
  const duration = text.match(
    /\b(?:duration|epoch[_ -]?time|time)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)\b/i,
  );

  return parseMetricNumber(duration?.[1]);
}

function parseEta(text: string) {
  const etaMatch = text.match(
    /\b(?:eta|remaining)\s*[:=]?\s*([0-9]+(?::[0-9]{2}){1,2}|(?:[0-9]+d\s*)?(?:[0-9]+h\s*)?(?:[0-9]+m\s*)?(?:[0-9]+s)?)/i,
  );
  const eta = etaMatch?.[1]?.trim();

  return eta || null;
}

function parseTrainingAnalytics(
  lines: TerminalLine[],
  fallbackProgressPercent: number | null,
): ParsedTrainingAnalytics {
  const metricsByEpoch = new Map<number, EpochMetric>();
  let activeEpoch: number | null = null;
  let currentEpoch: number | null = null;
  let totalEpochs: number | null = null;
  let stepCurrent: number | null = null;
  let stepTotal: number | null = null;
  let progressPercent: number | null = fallbackProgressPercent;
  let eta: string | null = null;
  let latestMetric: EpochMetric | null = null;
  let checkpointCount = 0;

  for (const line of lines) {
    if (line.type === "system") {
      continue;
    }

    const text = line.text;
    const epoch = parseEpoch(text);
    const step = parseStep(text);
    const lineProgress = firstMetric(text, [/\b(100|[1-9]?\d(?:\.\d+)?)%/]);
    const lineEta = parseEta(text);
    const validationLoss = firstMetric(text, [
      /\b(?:val|valid|validation|eval)[_-]?(?:loss|loss_epoch)\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
      /\b(?:val|valid|validation|eval)\s+loss\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const trainLoss = firstMetric(text, [
      /\b(?:train|training)[_-]?loss\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
      /\bloss\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const learningRate = firstMetric(text, [
      /\b(?:learning[_ -]?rate|lr)\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const rawAccuracy = firstMetric(text, [
      /\b(?:val[_ -]?)?(?:acc|accuracy)\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const accuracy =
      rawAccuracy === null
        ? null
        : rawAccuracy > 0 && rawAccuracy <= 1
          ? rawAccuracy * 100
          : rawAccuracy;
    const gradientNorm = firstMetric(text, [
      /\b(?:grad(?:ient)?[_ -]?norm|gnorm)\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const throughput = firstMetric(text, [
      /\b([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(?:it\/s|iter\/s|iters\/s|samples\/s|tok\/s|tokens\/s)\b/i,
      /\b(?:throughput|speed)\s*[:=]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i,
    ]);
    const durationSeconds = parseDurationSeconds(text);
    const hasCheckpoint = /\b(?:checkpoint|ckpt)\b/i.test(text) &&
      /\b(?:save|saved|saving|write|written)\b/i.test(text);

    if (epoch.current !== null) {
      activeEpoch = Math.max(1, Math.round(epoch.current));
      currentEpoch = activeEpoch;
    }

    if (epoch.total !== null) {
      totalEpochs = Math.max(1, Math.round(epoch.total));
    }

    if (step.current !== null) {
      stepCurrent = Math.max(0, Math.round(step.current));
    }

    if (step.total !== null) {
      stepTotal = Math.max(1, Math.round(step.total));
    }

    if (lineProgress !== null) {
      progressPercent = clampPercent(lineProgress);
    }

    if (lineEta) {
      eta = lineEta;
    }

    if (hasCheckpoint) {
      checkpointCount += 1;
    }

    const hasMetric =
      trainLoss !== null ||
      validationLoss !== null ||
      learningRate !== null ||
      accuracy !== null ||
      gradientNorm !== null ||
      throughput !== null ||
      durationSeconds !== null ||
      epoch.current !== null;

    if (activeEpoch === null || !hasMetric) {
      continue;
    }

    const metric =
      metricsByEpoch.get(activeEpoch) ?? createEmptyEpochMetric(activeEpoch);

    if (trainLoss !== null) {
      metric.trainLoss = trainLoss;
    }

    if (validationLoss !== null) {
      metric.validationLoss = validationLoss;
    }

    if (learningRate !== null) {
      metric.learningRate = learningRate;
    }

    if (accuracy !== null) {
      metric.accuracy = clampPercent(accuracy);
    }

    if (gradientNorm !== null) {
      metric.gradientNorm = gradientNorm;
    }

    if (throughput !== null) {
      metric.throughput = throughput;
    }

    if (durationSeconds !== null) {
      metric.durationSeconds = durationSeconds;
    }

    metricsByEpoch.set(activeEpoch, metric);
    latestMetric = metric;
  }

  if (progressPercent === null && currentEpoch !== null && totalEpochs) {
    progressPercent = clampPercent((currentEpoch / totalEpochs) * 100);
  }

  if (progressPercent === null && stepCurrent !== null && stepTotal) {
    progressPercent = clampPercent((stepCurrent / stepTotal) * 100);
  }

  const epochData = [...metricsByEpoch.values()].sort(
    (first, second) => first.epoch - second.epoch,
  );

  return {
    epochData,
    currentEpoch,
    totalEpochs,
    stepCurrent,
    stepTotal,
    progressPercent,
    eta,
    latestMetric,
    bestMetric: getBestMetric(epochData),
    checkpointCount,
  };
}

function formatNullableNumber(
  value: number | null | undefined,
  digits = 4,
  fallback = "Not available",
) {
  return value === null || value === undefined ? fallback : value.toFixed(digits);
}

function formatEpochValue(current: number | null, total: number | null) {
  if (current === null) {
    return "Not available";
  }

  return total === null ? String(current) : `${current} / ${total}`;
}

function formatEpochWindowLabel(epochWindow: EpochWindow) {
  return epochWindow === "all" ? "All" : `${epochWindow}`;
}

function formatEpochWindowScope(epochWindow: EpochWindow) {
  return epochWindow === "all" ? "all epochs" : `last ${epochWindow} epochs`;
}

export function TrainingAnalyticsDashboard() {
  const router = useRouter();
  const params = useParams<{ idanalytics?: string }>();
  const routeTrainingId = params.idanalytics;
  const [selectedTrainingId, setSelectedTrainingId] = React.useState<
    string | undefined
  >(routeTrainingId);
  const [terminalLines, setTerminalLines] = React.useState<TerminalLine[]>([]);
  const [terminalError, setTerminalError] = React.useState<string | null>(null);
  const [isTerminalReady, setIsTerminalReady] = React.useState(false);
  const [isTerminalStreaming, setIsTerminalStreaming] = React.useState(false);
  const [storedAnalytics, setStoredAnalytics] =
    React.useState<ParsedTrainingAnalytics | null>(null);
  const [selectedEpochWindow, setSelectedEpochWindow] =
    React.useState<EpochWindow>(10);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const lineIdRef = React.useRef(0);
  const terminalControlStateRef = React.useRef<TerminalControlState>(
    createTerminalControlState(),
  );
  const terminalLineOpenRef = React.useRef(false);
  const terminalPendingCarriageReturnRef = React.useRef(false);

  const { data: activeTrainings = [], isLoading, error } = useQuery({
    queryKey: ["active-training-remotes"],
    queryFn: fetchActiveTrainingRemotes,
    refetchInterval: 10000,
    retry: false,
  });

  const effectiveSelectedTrainingId =
    activeTrainings.find((training) => training.id === selectedTrainingId)
      ?.id ??
    activeTrainings.find((training) => training.id === routeTrainingId)?.id ??
    activeTrainings[0]?.id;
  const selectedTraining = React.useMemo(
    () =>
      activeTrainings.find(
        (training) => training.id === effectiveSelectedTrainingId,
      ),
    [activeTrainings, effectiveSelectedTrainingId],
  );
  const liveAnalytics = React.useMemo(
    () =>
      parseTrainingAnalytics(
        terminalLines,
        selectedTraining?.terminalProgressPercent ?? null,
      ),
    [selectedTraining?.terminalProgressPercent, terminalLines],
  );
  const hasLiveAnalytics = React.useMemo(
    () =>
      liveAnalytics.epochData.length > 0 ||
      liveAnalytics.currentEpoch !== null ||
      liveAnalytics.stepCurrent !== null ||
      liveAnalytics.latestMetric !== null,
    [liveAnalytics],
  );
  const analytics = React.useMemo(
    () =>
      (hasLiveAnalytics ? liveAnalytics : storedAnalytics) ??
      createEmptyParsedTrainingAnalytics(),
    [hasLiveAnalytics, liveAnalytics, storedAnalytics],
  );
  const displayedEpochData = React.useMemo(
    () =>
      selectedEpochWindow === "all"
        ? analytics.epochData
        : analytics.epochData.slice(-selectedEpochWindow),
    [analytics.epochData, selectedEpochWindow],
  );
  const epochWindowSummary = React.useMemo(() => {
    const totalEpochCount = analytics.epochData.length;
    const displayedEpochCount = displayedEpochData.length;
    const firstEpoch = displayedEpochData[0]?.epoch;
    const lastEpoch = displayedEpochData.at(-1)?.epoch;

    if (!displayedEpochCount) {
      return selectedEpochWindow === "all"
        ? "All epochs"
        : `Latest ${selectedEpochWindow} epochs`;
    }

    const rangeLabel =
      firstEpoch === lastEpoch
        ? `epoch ${lastEpoch}`
        : `epochs ${firstEpoch}-${lastEpoch}`;

    return selectedEpochWindow === "all"
      ? `All ${totalEpochCount} ${rangeLabel}`
      : `Latest ${displayedEpochCount} / ${totalEpochCount} ${rangeLabel}`;
  }, [analytics.epochData.length, displayedEpochData, selectedEpochWindow]);
  const latestMetric = React.useMemo(
    () => displayedEpochData.at(-1) ?? null,
    [displayedEpochData],
  );
  const bestMetric = React.useMemo(
    () => getBestMetric(displayedEpochData),
    [displayedEpochData],
  );
  const lossChartData = React.useMemo(
    () =>
      displayedEpochData.filter(
        (metric) =>
          metric.trainLoss !== null || metric.validationLoss !== null,
      ),
    [displayedEpochData],
  );
  const learningRateChartData = React.useMemo(
    () =>
      displayedEpochData.filter((metric) => metric.learningRate !== null),
    [displayedEpochData],
  );
  const performanceChartData = React.useMemo(
    () =>
      displayedEpochData.filter(
        (metric) =>
          metric.accuracy !== null ||
          metric.gradientNorm !== null ||
          metric.throughput !== null,
      ),
    [displayedEpochData],
  );
  const recentEpochs = React.useMemo(
    () => [...displayedEpochData].reverse(),
    [displayedEpochData],
  );
  const selectedProgress = analytics.progressPercent;
  const progressValue = selectedProgress ?? 0;
  const selectPlaceholder = isLoading
    ? "Loading active machines..."
    : "Select active training machine";
  const chartBadge = isTerminalReady ? "Live" : "Waiting";
  const hasLossChartData = lossChartData.length > 0;
  const hasLearningRateChartData = learningRateChartData.length > 0;
  const hasPerformanceChartData = performanceChartData.length > 0;

  const appendTerminalMessage = React.useCallback(
    (type: TerminalLine["type"], text: string) => {
      const messageControlState = createTerminalControlState();
      const parts = stripTerminalControlCodes(text, messageControlState)
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

        return next;
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

        return next;
      });
    },
    [],
  );

  const closeTerminalStream = React.useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsTerminalReady(false);
    setIsTerminalStreaming(false);
  }, []);

  const closeEventSource = React.useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  React.useEffect(() => {
    const stored = effectiveSelectedTrainingId
      ? readStoredTrainingAnalytics(effectiveSelectedTrainingId)
      : null;

    window.queueMicrotask(() => {
      setStoredAnalytics(stored);
    });
  }, [effectiveSelectedTrainingId]);

  React.useEffect(() => {
    if (!effectiveSelectedTrainingId || !hasLiveAnalytics) {
      return;
    }

    writeStoredTrainingAnalytics(effectiveSelectedTrainingId, liveAnalytics);
    window.queueMicrotask(() => {
      setStoredAnalytics(liveAnalytics);
    });
  }, [effectiveSelectedTrainingId, hasLiveAnalytics, liveAnalytics]);

  React.useEffect(() => {
    if (!effectiveSelectedTrainingId || !selectedTraining?.isActive) {
      closeEventSource();
      window.queueMicrotask(() => {
        setIsTerminalReady(false);
        setIsTerminalStreaming(false);
        setTerminalLines([]);
        setTerminalError(null);
      });
      return;
    }

    closeEventSource();
    terminalControlStateRef.current = createTerminalControlState();
    terminalLineOpenRef.current = false;
    terminalPendingCarriageReturnRef.current = false;
    window.queueMicrotask(() => {
      setIsTerminalReady(false);
      setIsTerminalStreaming(true);
      setTerminalLines([]);
      setTerminalError(null);
      appendTerminalMessage(
        "system",
        "Connecting analytics to terminal stream...",
      );
    });

    const source = new EventSource(
      `/api/ssh/${encodeURIComponent(effectiveSelectedTrainingId)}/terminal/logs`,
    );

    eventSourceRef.current = source;

    source.addEventListener("system", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        message?: string;
      };

      appendTerminalMessage("system", payload.message ?? "Terminal connected");
      setIsTerminalReady(true);
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
      closeTerminalStream();
    });

    source.addEventListener("done", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        message?: string;
      };

      appendTerminalMessage("system", payload.message ?? "Terminal stopped");
      closeTerminalStream();
    });

    source.onerror = () => {
      setTerminalError("Terminal stream disconnected");
      appendTerminalMessage("stderr", "Terminal stream disconnected");
      closeTerminalStream();
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [
    appendTerminalMessage,
    appendTerminalOutput,
    closeEventSource,
    closeTerminalStream,
    effectiveSelectedTrainingId,
    selectedTraining?.isActive,
  ]);

  const stats = [
    {
      label: "Current Epoch",
      value: formatEpochValue(analytics.currentEpoch, analytics.totalEpochs),
      trend:
        selectedProgress === null
          ? "Waiting for terminal metrics"
          : `${selectedProgress.toFixed(1)}% complete`,
      icon: Activity,
      tone: "text-emerald-400",
    },
    {
      label: "Current Loss",
      value: formatNullableNumber(latestMetric?.trainLoss),
      trend:
        latestMetric?.trainLoss === null || latestMetric?.trainLoss === undefined
          ? "No train loss parsed yet"
          : `Latest train loss in ${formatEpochWindowScope(selectedEpochWindow)}`,
      icon: TrendingDown,
      tone: "text-sky-400",
    },
    {
      label: "Best Loss",
      value: formatNullableNumber(
        bestMetric?.validationLoss ?? bestMetric?.trainLoss,
      ),
      trend: bestMetric
        ? `at epoch ${bestMetric.epoch} in ${formatEpochWindowScope(
            selectedEpochWindow,
          )}`
        : "No epoch data yet",
      icon: Trophy,
      tone: "text-amber-400",
    },
    {
      label: "Validation Loss",
      value: formatNullableNumber(latestMetric?.validationLoss),
      trend:
        latestMetric?.validationLoss === null ||
        latestMetric?.validationLoss === undefined
          ? "No validation metric yet"
          : bestMetric?.validationLoss &&
              latestMetric.validationLoss > bestMetric.validationLoss * 1.1
            ? "overfitting warning"
            : `Latest loss in ${formatEpochWindowScope(
                selectedEpochWindow,
              )}`,
      icon: TriangleAlert,
      tone: "text-rose-400",
    },
  ];
  const progressMetrics = [
    {
      label: "Steps completed",
      value:
        analytics.stepCurrent === null
          ? "Not available"
          : analytics.stepTotal === null
            ? String(analytics.stepCurrent)
            : `${analytics.stepCurrent.toLocaleString()} / ${analytics.stepTotal.toLocaleString()}`,
      icon: ListChecks,
    },
    {
      label: "Speed",
      value:
        latestMetric?.throughput === null || latestMetric?.throughput === undefined
          ? "Not available"
          : `${latestMetric.throughput.toFixed(2)} it/s`,
      icon: Gauge,
    },
    {
      label: "Checkpoints saved",
      value: `${analytics.checkpointCount} detected`,
      icon: Save,
    },
    {
      label: "Best epoch",
      value: bestMetric
        ? `${bestMetric.epoch} loss ${formatNullableNumber(
            bestMetric.validationLoss ?? bestMetric.trainLoss,
          )}`
        : "Not available",
      icon: Trophy,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-normal md:text-2xl">
              Training Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time metrics parsed from the selected terminal stream.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <div
                aria-label="Epoch window"
                className="flex rounded-lg border bg-background p-1"
                role="radiogroup"
              >
                {EPOCH_WINDOW_OPTIONS.map((epochWindow) => (
                  <Button
                    aria-checked={selectedEpochWindow === epochWindow}
                    className={cn(
                      "min-w-16 rounded-md px-2 tabular-nums",
                      selectedEpochWindow === epochWindow && "shadow-sm",
                    )}
                    key={epochWindow}
                    onClick={() => setSelectedEpochWindow(epochWindow)}
                    role="radio"
                    size="sm"
                    type="button"
                    variant={
                      selectedEpochWindow === epochWindow
                        ? "default"
                        : "ghost"
                    }
                  >
                    {formatEpochWindowLabel(epochWindow)}
                  </Button>
                ))}
              </div>
              <span className="px-1 text-xs text-muted-foreground">
                {epochWindowSummary}
              </span>
            </div>
            <Select
              value={effectiveSelectedTrainingId}
              onValueChange={(trainingId) => {
                setSelectedTrainingId(trainingId);
                router.push(`/analytis/${encodeURIComponent(trainingId)}`);
              }}
              disabled={!activeTrainings.length}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder={selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {activeTrainings.map((training) => (
                  <SelectItem key={training.id} value={training.id}>
                    {training.name}
                    {training.machineType ? ` - ${training.machineType}` : ""}
                    {training.instanceId ? ` (${training.instanceId})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {error instanceof Error ? (
          <Card className="rounded-lg border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              {error.message}
            </CardContent>
          </Card>
        ) : null}

        {terminalError ? (
          <Card className="rounded-lg border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">
              {terminalError}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <Card key={stat.label} className="rounded-lg">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {stat.value}
                  </CardTitle>
                  <CardAction>
                    <Icon className={cn("size-5", stat.tone)} />
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {stat.trend}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Training & Validation Loss"
            description={epochWindowSummary}
            badge={chartBadge}
            className="xl:col-span-1"
          >
            {hasLossChartData ? (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <LineChart
                  data={lossChartData}
                  margin={{ left: 4, right: 12, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="epoch" tickMargin={8} minTickGap={24} />
                  <YAxis
                    tickMargin={8}
                    width={42}
                    domain={["dataMin - 0.05", "dataMax + 0.05"]}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    dataKey="trainLoss"
                    type="monotone"
                    stroke="var(--color-trainLoss)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    dataKey="validationLoss"
                    type="monotone"
                    stroke="var(--color-validationLoss)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyChartState
                isStreaming={isTerminalStreaming}
                message="No epoch or loss metrics parsed from terminal yet."
              />
            )}
          </ChartCard>

          <ChartCard
            title="Learning Rate Schedule"
            description={epochWindowSummary}
            badge={chartBadge}
            className="xl:col-span-1"
          >
            {hasLearningRateChartData ? (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <LineChart
                  data={learningRateChartData}
                  margin={{ left: 4, right: 12, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="epoch" tickMargin={8} minTickGap={24} />
                  <YAxis
                    tickMargin={8}
                    width={62}
                    tickFormatter={(value) => Number(value).toExponential(1)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        formatter={(value) => (
                          <span className="font-mono tabular-nums">
                            {Number(value).toExponential(2)}
                          </span>
                        )}
                      />
                    }
                  />
                  <Line
                    dataKey="learningRate"
                    type="monotone"
                    stroke="var(--color-learningRate)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyChartState
                isStreaming={isTerminalStreaming}
                message="No learning rate metrics parsed from terminal yet."
              />
            )}
          </ChartCard>

          <ChartCard
            title="Epoch Performance Metrics"
            description={epochWindowSummary}
            badge={chartBadge}
            className="xl:col-span-2"
          >
            {hasPerformanceChartData ? (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <LineChart
                  data={performanceChartData}
                  margin={{ left: 4, right: 12, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="epoch" tickMargin={8} minTickGap={24} />
                  <YAxis
                    yAxisId="accuracy"
                    tickMargin={8}
                    width={42}
                    domain={[0, 100]}
                  />
                  <YAxis
                    yAxisId="metric"
                    orientation="right"
                    tickMargin={8}
                    width={42}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    yAxisId="accuracy"
                    dataKey="accuracy"
                    type="monotone"
                    stroke="var(--color-accuracy)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="metric"
                    dataKey="gradientNorm"
                    type="monotone"
                    stroke="var(--color-gradientNorm)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="metric"
                    dataKey="throughput"
                    type="monotone"
                    stroke="var(--color-throughput)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyChartState
                isStreaming={isTerminalStreaming}
                message="No performance metrics parsed from terminal yet."
              />
            )}
          </ChartCard>
        </section>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Detailed Epoch Log</CardTitle>
            <CardDescription>
              {epochWindowSummary} parsed from terminal output.
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="gap-1.5">
                <Timer className="size-3" />
                Live stream
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Epoch</TableHead>
                  <TableHead>Train Loss</TableHead>
                  <TableHead>Val Loss</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Learning Rate</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEpochs.length ? (
                  recentEpochs.map((metric) => (
                    <TableRow key={metric.epoch}>
                      <TableCell className="font-medium">{metric.epoch}</TableCell>
                      <TableCell
                        className={
                          metric.trainLoss !== null && metric.trainLoss < 0.4
                            ? "text-emerald-400"
                            : undefined
                        }
                      >
                        {formatNullableNumber(metric.trainLoss)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          metric.validationLoss !== null &&
                            metric.validationLoss < 0.3 &&
                            "text-emerald-400",
                          metric.validationLoss !== null &&
                            metric.validationLoss >= 0.3 &&
                            metric.validationLoss <= 0.6 &&
                            "text-amber-400",
                          metric.validationLoss !== null &&
                            metric.validationLoss > 0.6 &&
                            "text-rose-400",
                        )}
                      >
                        {formatNullableNumber(metric.validationLoss)}
                      </TableCell>
                      <TableCell>
                        {metric.accuracy === null
                          ? "Not available"
                          : `${metric.accuracy.toFixed(1)}%`}
                      </TableCell>
                      <TableCell>
                        {metric.learningRate === null
                          ? "Not available"
                          : metric.learningRate.toExponential(2)}
                      </TableCell>
                      <TableCell>
                        {metric.durationSeconds === null
                          ? "Not available"
                          : `${metric.durationSeconds}s`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            metric.epoch === analytics.currentEpoch
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {metric.epoch === analytics.currentEpoch
                            ? "Running"
                            : metric.epoch === bestMetric?.epoch
                              ? "Best"
                              : "Done"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Waiting for terminal lines with epoch metrics.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Training Progress</CardTitle>
            <CardDescription>
              {selectedTraining
                ? selectedProgress === null
                  ? `Waiting for progress metrics on ${selectedTraining.name}.`
                  : `${selectedProgress.toFixed(1)}% complete on ${selectedTraining.name}.`
                : "Select an active machine to monitor training progress."}
              {analytics.eta ? ` ETA ${analytics.eta}.` : ""}
            </CardDescription>
            <CardAction>
              <Target className="size-5 text-sky-400" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <Progress value={progressValue} className="bg-sky-400" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {progressMetrics.map((metric) => {
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.label}
                    className="flex items-center justify-between gap-3 border-b border-dashed pb-3 text-sm"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="size-4" />
                      {metric.label}
                    </span>
                    <span className="text-right font-medium">{metric.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChartState({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: string;
}) {
  return (
    <div className="flex h-80 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
      {isStreaming ? message : "Select an active machine to start analytics."}
    </div>
  );
}

function ChartCard({
  title,
  description,
  badge,
  className,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("rounded-lg", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Badge variant="outline">{badge}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
