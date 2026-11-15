import type { IncomingMessage, ServerResponse } from 'node:http';

export function serveRange(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  prefix?: string,
): Promise<boolean>;

export function servePublicRange(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
