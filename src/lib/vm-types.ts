export const PROVIDER_ENV_KEYS = {
  local: null,
  "vast-ai": "VAST_AI_API_KEY",
  runpod: "RUNPOD_API_KEY",
  "lambda-labs": "LAMBDA_LABS_API_KEY",
  tensordock: "TENSORDOCK_API_KEY",
  azure: "AZURE_ACCESS_TOKEN",
} as const;

export type ProviderKey = keyof typeof PROVIDER_ENV_KEYS;

export type ProviderInstance = {
  id: string;
  name: string;
  status?: string | null;
  machineType?: string | null;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  pricePerHour?: number | null;
  region?: string | null;
};

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  local: "Local",
  "vast-ai": "Vast AI",
  runpod: "RunPod",
  "lambda-labs": "Lambda Labs",
  tensordock: "TensorDock",
  azure: "Azure",
};

export function isProviderKey(provider: string): provider is ProviderKey {
  return provider in PROVIDER_ENV_KEYS;
}

export function getProviderEnvKey(provider: string) {
  return isProviderKey(provider) ? PROVIDER_ENV_KEYS[provider] : null;
}

export function getVmTypeLabel(provider: string, machineType?: string | null) {
  if (machineType) {
    return machineType;
  }

  return provider === "local" ? "Custom / existing server" : "Provider instance";
}
