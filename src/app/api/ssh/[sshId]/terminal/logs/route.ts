import { prisma } from "../../../../../../../packages/db/src";
import {
  connectSSHSession,
  getSSHSession,
} from "../../../../../../../services/ssh/ssh-session-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sshId: string }> },
) {
  const { sshId } = await params;

  const remote = await prisma.sSHRemote.findUnique({
    where: {
      id: sshId,
    },
  });

  if (!remote) {
    return Response.json(
      {
        success: false,
        error: "SSH connection not found",
      },
      {
        status: 404,
      },
    );
  }

  if (!remote.isActive) {
    return Response.json(
      {
        success: false,
        error: "Máy này chưa active",
      },
      {
        status: 400,
      },
    );
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribeShellOutput: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
      };

      req.signal.addEventListener("abort", () => {
        unsubscribeShellOutput?.();
        close();
      });
      

      void (async () => {
        try {
          let ssh = getSSHSession(remote.id);

          if (!ssh) {
            ssh = await connectSSHSession(remote.id, {
              host: remote.host,
              port: remote.port,
              username: remote.username,
              password: remote.password ?? undefined,
              sshKeyName: remote.privateKey ?? undefined,
              passphrase: remote.passphrase ?? undefined,
            });
          }

          const shellStream = await ssh.streamShell((type, chunk) => {
            send(type, {
              chunk,
            });
          });
          unsubscribeShellOutput = shellStream.unsubscribe;

          send("system", {
            message:
              "Interactive shell connected. Commands share cwd, env, aliases, history, and foreground process state.",
          });

          await shellStream.done;

          send("done", {
            message: "Terminal shell closed",
          });
        } catch (error) {
          send("terminal-error", {
            message:
              error instanceof Error
                ? error.message
                : "Failed to stream terminal logs",
          });
        } finally {
          unsubscribeShellOutput?.();
          close();
        }
      })();
    },
    cancel() {
      unsubscribeShellOutput?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
