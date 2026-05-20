import { BaseProvider, StopInstanceResult } from "./base";

export class LocalProvider extends BaseProvider {
  async stopInstance(): Promise<StopInstanceResult> {
    return {
      success: true,
      message: "Local instance stop command would be executed via SSH",
      instanceId: this.instanceId,
    };
  }
}
