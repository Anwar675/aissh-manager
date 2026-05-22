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

type TerminalChannel = {
  signal?: (signalName: string) => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  write?: (chunk: string) => void;
  end?: () => void;
  stderr?: {
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
  };
};



type TerminalOutputType = "stdout" | "stderr";
type TerminalOutputListener = (type: TerminalOutputType, chunk: string) => void;

export class SSHService {
  private ssh = new NodeSSH();

  private connected = false;

  private connecting = false;

  private terminalChannel: TerminalChannel | null = null;

  private terminalPromise: Promise<void> | null = null;

  private terminalStartPromise: Promise<void> | null = null;

  private terminalOutputListeners = new Set<TerminalOutputListener>();

  constructor(private remote?: SSHRemote) {}

  isConnected() {
    return this.connected;
  }

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

  isTerminalRunning() {
    return Boolean(this.terminalChannel || this.terminalPromise);
  }

  private emitTerminalOutput(type: TerminalOutputType, chunk: string) {
    for (const listener of this.terminalOutputListeners) {
      listener(type, chunk);
    }
  }

  private subscribeTerminalOutput(listener: TerminalOutputListener) {
    this.terminalOutputListeners.add(listener);

    return () => {
      this.terminalOutputListeners.delete(listener);
    };
  }

  async streamTerminal(
    command: string,
    onOutput: (type: TerminalOutputType, chunk: string) => void,
  ) {
    if (!this.connected) {
      await this.connect();
    }

    if (this.terminalPromise) {
      throw new Error("TERMINAL_ALREADY_RUNNING");
    }

    this.terminalPromise = this.ssh
      .execCommand(command, {
        noTrim: true,
        execOptions: {
          pty: true,
        },
        onChannel: (channel) => {
          this.terminalChannel = channel;
        },
        onStdout: (chunk) => {
          onOutput("stdout", chunk.toString("utf8"));
        },
        onStderr: (chunk) => {
          onOutput("stderr", chunk.toString("utf8"));
        },
      })
      .then(() => undefined)
      .finally(() => {
        this.terminalChannel = null;
        this.terminalPromise = null;
      });

    return this.terminalPromise;
  }

  private async ensureShell() {
    if (!this.connected) {
      await this.connect();
    }

    if (this.terminalPromise) {
      return;
    }

    if (this.terminalStartPromise) {
      await this.terminalStartPromise;
      return;
    }

    this.terminalStartPromise = (async () => {
      const channel = await this.ssh.requestShell({
        term: "xterm-256color",
        cols: 120,
        rows: 32,
      });

      this.terminalChannel = channel;
      channel.on("data", (chunk: unknown) => {
        this.emitTerminalOutput(
          "stdout",
          Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk),
        );
      });
      channel.stderr.on("data", (chunk: unknown) => {
        this.emitTerminalOutput(
          "stderr",
          Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk),
        );
      });

      this.terminalPromise = new Promise<void>((resolve, reject) => {
        channel.on("close", () => resolve());
        channel.on("error", (error: unknown) => reject(error));
      }).finally(() => {
        this.terminalChannel = null;
        this.terminalPromise = null;
        this.terminalOutputListeners.clear();
      });
    })();

    try {
      await this.terminalStartPromise;
    } finally {
      this.terminalStartPromise = null;
    }
  }

  async streamShell(onOutput: TerminalOutputListener) {
    const unsubscribe = this.subscribeTerminalOutput(onOutput);

    await this.ensureShell();

    return {
      done: this.terminalPromise ?? Promise.resolve(),
      unsubscribe,
    };
  }

  writeTerminal(input: string) {
    const channel = this.terminalChannel;

    if (!channel) {
      return false;
    }

    channel.write?.(input);

    return true;
  }

  stopTerminal(options: { close?: boolean; terminate?: boolean } = {}) {
    const channel = this.terminalChannel;

    if (!channel) {
      return false;
    }

    try {
      channel.signal?.("INT");
      if (options.terminate) {
        channel.signal?.("TERM");
      }
      channel.write?.("\x03");
      if (options.close) {
        channel.end?.();
      }
    } catch (error) {
      console.warn("Failed to stop terminal channel:", error);
      return false;
    }

    return true;
  }

  closeTerminal() {
    return this.stopTerminal({ close: true, terminate: true });
  }

  disconnect() {
    this.closeTerminal();
    this.connected = false;
    this.ssh.dispose();
    console.log("🔌 SSH disconnected");
  }
}
