import { BaseProvider, ProviderConfig, StopInstanceResult } from "./base";

export class LambdaLabsProvider extends BaseProvider {
  private readonly baseUrl = "https://cloud.lambdalabs.com/api/v1";

  constructor(config: ProviderConfig) {
    super(config);
  }

  async stopInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instance-operations/terminate`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`:${this.apiKey}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instance_ids: [this.instanceId],
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to stop instance: ${response.statusText}`,
        );
      }

      return {
        success: true,
        message: "Lambda Labs instance terminated successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Lambda Labs stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/instances`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${this.apiKey}`).toString("base64")}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get instance status: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const instance = data.data?.find(
        (inst: { id: string }) => inst.id === this.instanceId,
      );

      return {
        status: instance?.status || "unknown",
      };
    } catch (error) {
      throw new Error(
        `Failed to get Lambda Labs status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
