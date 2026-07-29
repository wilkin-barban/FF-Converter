import type { IpcMainInvokeEvent } from 'electron';

export function isTrustedRendererUrl(senderUrl: string): boolean {
  const isPackagedPage = senderUrl.startsWith('file://');
  const isDevelopmentPage = /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(senderUrl);
  return isPackagedPage || isDevelopmentPage;
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) {
    throw new Error('IPC request rejected: untrusted frame');
  }

  if (!isTrustedRendererUrl(frame.url)) {
    throw new Error('IPC request rejected: untrusted origin');
  }
}
