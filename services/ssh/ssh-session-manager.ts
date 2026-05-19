import { SSHService } from "./ssh.service";

type SSHRemote = {
  host: string;
  port: number;
  username: string;
  password?: string;
  sshKeyName?: string;
  passphrase?: string;
};

const sessions = new Map<string, SSHService>();

export async function connectSSHSession(id: string, remote: SSHRemote) {
  const ssh = new SSHService(remote);

  await ssh.connect();
  disconnectSSHSession(id);
  sessions.set(id, ssh);
  return ssh;
}

export function getSSHSession(id: string) {
  const ssh = sessions.get(id);
  if (!ssh?.isConnected()) {
    sessions.delete(id);
    return null;
  }

  return ssh;
}

export function disconnectSSHSession(id: string) {
  const ssh = sessions.get(id);

  if (!ssh) {
    return false;
  }

  ssh.disconnect();
  sessions.delete(id);

  return true;
}

export function disconnectAllSSHSessions() {
  for (const [id, ssh] of sessions) {
    ssh.disconnect();
    sessions.delete(id);
  }
}
