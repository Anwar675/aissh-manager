import { BaseProvider, ProviderConfig, StopInstanceResult } from "./base";

export class RunPodProvider extends BaseProvider {
  private readonly baseUrl = "https://api.runpod.io/graphql";

  constructor(config: ProviderConfig) {
    super(config);
  }

  async stopInstance(): Promise<StopInstanceResult> {
    try {
      const mutation = `
        mutation {
          podStop(input: {podId: "${this.instanceId}"}) {
            id
            desiredStatus
          }
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({ query: mutation }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop pod: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0].message || "Failed to stop RunPod pod");
      }

      return {
        success: true,
        message: "RunPod instance stopped successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `RunPod stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async startInstance(): Promise<StopInstanceResult> {
    try {
      const mutation = `
        mutation {
          podResume(input: {podId: "${this.instanceId}"}) {
            id
            desiredStatus
          }
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({ query: mutation }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start pod: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0].message || "Failed to start RunPod pod");
      }

      return {
        success: true,
        message: "RunPod instance started successfully",
        instanceId: this.instanceId,
      };
    } catch (error) {
      throw new Error(
        `RunPod start failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInstanceStatus(): Promise<{ status: string }> {
    try {
      const query = `
        query {
          pod(input: {podId: "${this.instanceId}"}) {
            id
            desiredStatus
          }
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get pod status: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(
          data.errors[0].message || "Failed to get RunPod status",
        );
      }

      return {
        status: data.data?.pod?.desiredStatus || "unknown",
      };
    } catch (error) {
      throw new Error(
        `Failed to get RunPod status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
