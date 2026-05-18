import { NodeSSH } from "node-ssh";
import fs from "fs";
import path from "path";
import os from "os";

type SSHRemote = {
  host: string;
  port: number;
  username: string;

  password?: string;
  sshKeyName?: string;
  passphrase?: string;
};

export class SSHService {
  private ssh = new NodeSSH();

  private connected = false;

  private connecting = false;

  constructor(private remote?: SSHRemote) {}

  async connect() {
    if (!this.remote) {
      throw new Error("SSH remote configuration is required");
    }

    if (this.connected) {
      return;
    }

    if (this.connecting) {
      return;
    }

    this.connecting = true;

    try {
      let privateKey: string | undefined;

      if (this.remote?.sshKeyName) {
        const keyPath = path.join(os.homedir(), ".ssh", this.remote.sshKeyName);
        console.log("🔑 Loaded SSH private key from", keyPath);
        privateKey = fs.readFileSync(keyPath, "utf8");
      }

      await this.ssh.connect({
        host: this.remote.host,

        port: this.remote.port,

        username: this.remote.username,

        password: this.remote.password,

        privateKey,

        passphrase: this.remote.passphrase,

        readyTimeout: 10000,
      });

      this.connected = true;

      console.log("✅ SSH connected");
    } catch (error) {
      this.connected = false;

      console.error("❌ SSH connection failed:", error);

      throw new Error("SSH_CONNECTION_FAILED");
    } finally {
      this.connecting = false;
    }
  }

  async exec(command: string) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.ssh.execCommand(command);

      if (result.code !== 0) {
        throw new Error(result.stderr || "SSH command failed");
      }

      return result.stdout;
    } catch (error) {
      console.error("❌ SSH exec error:", error);

      this.connected = false;

      await this.connect();

      const retry = await this.ssh.execCommand(command);

      return retry.stdout;
    }
  }

  disconnect() {
    this.connected = false;

    this.ssh.dispose();

    console.log("🔌 SSH disconnected");
  }
}
