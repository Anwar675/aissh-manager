import { BaseProvider } from "./base";
import type { ProviderConfig, StopInstanceResult } from "./base";
import { VastAIProvider } from "./vast-ai";
import { RunPodProvider } from "./runpod";
import { LambdaLabsProvider } from "./lambda-labs";
import { TensorDockProvider } from "./tensordock";
import { AzureProvider } from "./azure";
import { LocalProvider } from "./local";

export { BaseProvider };
export type { ProviderConfig, StopInstanceResult };

export function getProviderApiKey(provider: string, overrideApiKey?: string) {
  if (overrideApiKey) {
    return overrideApiKey;
  }

  switch (provider?.toLowerCase()) {
    case "vast-ai":
      return process.env.VAST_AI_API_KEY || "";
    case "runpod":
      return process.env.RUNPOD_API_KEY || "";
    case "lambda-labs":
      return process.env.LAMBDA_LABS_API_KEY || "";
    case "tensordock":
      return process.env.TENSORDOCK_API_KEY || "";
    case "azure":
      return process.env.AZURE_SUBSCRIPTION_ID && process.env.AZURE_ACCESS_TOKEN
        ? `${process.env.AZURE_SUBSCRIPTION_ID}:${process.env.AZURE_ACCESS_TOKEN}`
        : "";
    default:
      return "";
  }
}

export function hasProviderApiKey(
  provider: string,
  overrideApiKey?: string | null,
) {
  return Boolean(getProviderApiKey(provider, overrideApiKey ?? undefined));
}

export function createProvider(
  provider: string,
  instanceId: string,
  apiKey?: string,
  region?: string,
): BaseProvider {
  const resolvedApiKey = getProviderApiKey(provider, apiKey);
  const config = { instanceId, apiKey: resolvedApiKey, region };

  switch (provider?.toLowerCase()) {
    case "vast-ai":
      return new VastAIProvider(config);
    case "runpod":
      return new RunPodProvider(config);
    case "lambda-labs":
      return new LambdaLabsProvider(config);
    case "tensordock":
      return new TensorDockProvider(config);
    case "azure":
      return new AzureProvider(config);
    case "local":
      return new LocalProvider(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export const PROVIDERS = {
  "vast-ai": VastAIProvider,
  runpod: RunPodProvider,
  "lambda-labs": LambdaLabsProvider,
  tensordock: TensorDockProvider,
  azure: AzureProvider,
  local: LocalProvider,
};
