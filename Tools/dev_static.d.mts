import type { IncomingMessage, ServerResponse } from 'node:http';

export function servePublicFile(req: IncomingMessage, res: ServerResponse): boolean;

export function serveMlWorker(req: IncomingMessage, res: ServerResponse): boolean;
