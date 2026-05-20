export interface ProviderConfig {
  instanceId: string;
  apiKey: string;
  region?: string;
}

export interface StopInstanceResult {
  success: boolean;
  message: string;
  instanceId: string;
}

export abstract class BaseProvider {
  protected instanceId: string;
  protected apiKey: string;
  protected region?: string;

  constructor(config: ProviderConfig) {
    this.instanceId = config.instanceId;
    this.apiKey = config.apiKey;
    this.region = config.region;
  }

  abstract stopInstance(): Promise<StopInstanceResult>;

  async startInstance(): Promise<StopInstanceResult> {
    throw new Error("Start instance not implemented for this provider");
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    throw new Error("Get instance status not implemented for this provider");
  }
}
