import { BaseProvider, ProviderConfig, StopInstanceResult } from "./base";

export class TensorDockProvider extends BaseProvider {
  private readonly baseUrl = "https://api.tensordock.com/api/v0";

  constructor(config: ProviderConfig) {
    super(config);
  }

  async stopInstance(): Promise<StopInstanceResult> {
    try {
      // TensorDock uses machine_id format
      const machineId = this.instanceId.split(":")[0];

      const response = await fetch(`${this.baseUrl}/machine/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_id: machineId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || `Failed to stop machine: ${response.statusText}`,
        );
      }

      return {
        success: true,
        message: "TensorDock machine stopped successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `TensorDock stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async startInstance(): Promise<StopInstanceResult> {
    try {
      const machineId = this.instanceId.split(":")[0];

      const response = await fetch(`${this.baseUrl}/machine/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_id: machineId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || `Failed to start machine: ${response.statusText}`,
        );
      }

      return {
        success: true,
        message: "TensorDock machine started successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `TensorDock start failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    try {
      const machineId = this.instanceId.split(":")[0];

      const response = await fetch(`${this.baseUrl}/machine/info`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_id: machineId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get machine status: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: data.status || "unknown",
      };
    } catch (error) {
      throw new Error(
        `Failed to get TensorDock status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
