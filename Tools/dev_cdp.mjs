export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function connect(port = 9222) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  if (!target) throw new Error('no page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const handlers = [];

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    for (const h of handlers) h(msg);
  });

  await new Promise((r) => ws.addEventListener('open', r));

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return res.result?.result?.value;
  };

  return {
    send,
    evaluate,
    onEvent: (h) => handlers.push(h),
    close: () => ws.close(),
  };
}

export async function setViewport(send, width = 1600, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

export async function openPage(send, url) {
  await send('Page.enable');
  await send('Page.navigate', { url });
}

export async function screenshot(send) {
  const res = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  if (!res.result?.data) return null;
  return Buffer.from(res.result.data, 'base64');
}
