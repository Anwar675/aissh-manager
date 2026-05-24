import { BaseProvider, ProviderConfig, StopInstanceResult } from "./base";

export class VastAIProvider extends BaseProvider {
  private readonly baseUrl = "https://console.vast.ai/api/v0";

  constructor(config: ProviderConfig) {
    super(config);
  }

  async stopInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instances/${this.instanceId}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: "stopped",
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to stop instance: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`,
        );
      }

      return {
        success: true,
        message: "Vast AI instance stopped successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Vast AI stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async startInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instances/${this.instanceId}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: "running",
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to start instance: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`,
        );
      }

      return {
        success: true,
        message: "Vast AI instance started successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Vast AI start failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instances/${this.instanceId}/`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get instance status: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const instance = data.instances ?? data;

      return {
        status: instance.actual_status || instance.status || "unknown",
      };
    } catch (error) {
      throw new Error(
        `Failed to get Vast AI instance status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async destroyInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instances/${this.instanceId}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      if (response.status === 404) {
        return {
          success: true,
          message: "Vast AI instance was already destroyed or not found",
          instanceId: this.instanceId,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to destroy instance: ${response.status} ${response.statusText}${
            errorText ? ` - ${errorText}` : ""
          }`,
        );
      }

      return {
        success: true,
        message: "Vast AI instance destroyed successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Vast AI destroy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
