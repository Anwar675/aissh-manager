import { BaseProvider, ProviderConfig, StopInstanceResult } from "./base";

export class AzureProvider extends BaseProvider {
  private resourceGroup: string;
  private vmName: string;

  constructor(
    config: ProviderConfig & { resourceGroup?: string; vmName?: string },
  ) {
    super(config);
    // Format: resourceGroup:vmName or just vmName
    const [rg, vm] = config.instanceId.split(":");
    this.resourceGroup = config.resourceGroup || rg || "";
    this.vmName = config.vmName || vm || rg;
  }

  async stopInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `https://management.azure.com/subscriptions/${this.apiKey.split(":")[0]}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Compute/virtualMachines/${this.vmName}/powerOff`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey.split(":")[1]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok && response.status !== 202) {
        throw new Error(`Failed to stop VM: ${response.statusText}`);
      }

      return {
        success: true,
        message: "Azure VM stopped successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Azure stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async startInstance(): Promise<StopInstanceResult> {
    try {
      const response = await fetch(
        `https://management.azure.com/subscriptions/${this.apiKey.split(":")[0]}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Compute/virtualMachines/${this.vmName}/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey.split(":")[1]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok && response.status !== 202) {
        throw new Error(`Failed to start VM: ${response.statusText}`);
      }

      return {
        success: true,
        message: "Azure VM started successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `Azure start failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    try {
      const response = await fetch(
        `https://management.azure.com/subscriptions/${this.apiKey.split(":")[0]}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Compute/virtualMachines/${this.vmName}/instanceView`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey.split(":")[1]}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get VM status: ${response.statusText}`);
      }

      const data = await response.json();
      const statusMessage = data.statuses?.find((s: { code: string }) =>
        s.code.includes("PowerState"),
      );

      return {
        status: statusMessage?.displayStatus || "unknown",
      };
    } catch (error) {
      throw new Error(
        `Failed to get Azure status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
