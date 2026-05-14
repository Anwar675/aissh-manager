import { NodeSSH } from "node-ssh";
import fs from "fs";
import path from "path";
import os from "os";

export class SSHService {
  private ssh = new NodeSSH();

  private connected = false;

  private connecting = false;

  async connect() {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      return;
    }

    this.connecting = true;

    try {
      const keyPath = path.join(
        os.homedir(),
        ".ssh",
        process.env.SSH_KEY_NAME!
      );

      await this.ssh.connect({
        host: process.env.GPU_HOST!,

        port: Number(
          process.env.GPU_PORT!
        ),

        username:
          process.env
            .USERNAME!,

        privateKey:
          fs.readFileSync(
            keyPath,
            "utf8"
          ),

        passphrase:
          process.env
            .SSH_PASSPHRASE,

        readyTimeout: 10000,
      });

      this.connected = true;

      console.log(
        "✅ SSH connected"
      );
    } catch (error) {
      this.connected = false;

      console.error(
        "❌ SSH connection failed:",
        error
      );

      throw new Error(
        "SSH_CONNECTION_FAILED"
      );
    } finally {
      this.connecting = false;
    }
  }

  async exec(command: string) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result =
        await this.ssh.execCommand(
          command
        );

      if (result.code !== 0) {
        throw new Error(
          result.stderr ||
            "SSH command failed"
        );
      }

      return result.stdout;
    } catch (error) {
      console.error(
        "❌ SSH exec error:",
        error
      );

      // mất connection thì reconnect
      this.connected = false;

      await this.connect();

      const retry =
        await this.ssh.execCommand(
          command
        );

      return retry.stdout;
    }
  }

  // chỉ gọi khi shutdown app
  disconnect() {
    this.connected = false;

    this.ssh.dispose();

    console.log(
      "🔌 SSH disconnected"
    );
  }
}