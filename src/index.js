const assetManifest = {};

// Simple logging utility
const log = {
  info: (...args) => {
    console.log('[INFO]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  debug: (...args) => {
    console.debug('[DEBUG]', ...args);
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 WebSocket 连接
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }
    
    // 添加 API 请求处理
    if (url.pathname.endsWith("/chat/completions") ||
        url.pathname.endsWith("/embeddings") ||
        url.pathname.endsWith("/models")) {
      return handleAPIRequest(request, env);
    }

    // 处理静态资源 (兼容Deno和Cloudflare Workers)
    if (url.pathname === '/' || url.pathname === '/index.html') {
      log.info('Serving index.html');
      // 检查是否在Cloudflare Workers环境中
      if (env && env.__STATIC_CONTENT) {
        // Cloudflare Workers环境
        return new Response(await env.__STATIC_CONTENT.get('index.html'), {
          headers: {
            'content-type': 'text/html;charset=UTF-8',
          },
        });
      } else {
        // Deno环境或其他环境
        try {
          const fullPath = `${Deno.cwd()}/src/static/index.html`;
          const file = await Deno.readFile(fullPath);
          return new Response(file, {
            headers: {
              'content-type': 'text/html;charset=UTF-8',
            },
          });
        } catch (e) {
          log.error('Error reading index.html:', e);
          return new Response('Not Found', { status: 404 });
        }
      }
    }

    // 处理其他静态资源 (兼容Deno和Cloudflare Workers)
    // 检查是否在Cloudflare Workers环境中
    if (env && env.__STATIC_CONTENT) {
      // Cloudflare Workers环境
      const asset = await env.__STATIC_CONTENT.get(url.pathname.slice(1));
      if (asset) {
        const contentType = getContentType(url.pathname);
        return new Response(asset, {
          headers: {
            'content-type': contentType,
          },
        });
      }
    } else {
      // Deno环境或其他环境
      try {
        const fullPath = `${Deno.cwd()}/src/static${url.pathname}`;
        const file = await Deno.readFile(fullPath);
        const contentType = getContentType(url.pathname);
        return new Response(file, {
          headers: {
            'content-type': `${contentType};charset=UTF-8`,
          },
        });
      } catch (e) {
        // 文件未找到，继续执行
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const types = {
    'js': 'application/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif'
  };
  return types[ext] || 'text/plain';
}

async function handleWebSocket(request, env) {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }
  
  const url = new URL(request.url);
  const pathAndQuery = url.pathname + url.search;
  const targetUrl = `wss://generativelanguage.googleapis.com${pathAndQuery}`;
  
  log.info('Target URL:', targetUrl);
  
  const [client, proxy] = new WebSocketPair();
  proxy.accept();
  
  // 用于存储在连接建立前收到的消息
  let pendingMessages = [];
  const targetWebSocket = new WebSocket(targetUrl);
 
  log.debug('Initial targetWebSocket readyState:', targetWebSocket.readyState);
 
  targetWebSocket.addEventListener("open", () => {
    log.info('Connected to target server');
    log.debug('targetWebSocket readyState after open:', targetWebSocket.readyState);
    
    // 连接建立后，发送所有待处理的消息
    log.debug(`Processing ${pendingMessages.length} pending messages`);
    for (const message of pendingMessages) {
      try {
        targetWebSocket.send(message);
        log.debug('Sent pending message');
      } catch (error) {
        log.error('Error sending pending message:', error);
      }
    }
    pendingMessages = []; // 清空待处理消息队列
  });
 
  proxy.addEventListener("message", async (event) => {
    log.debug('Received message from client');
    
    if (targetWebSocket.readyState === WebSocket.OPEN) {
      try {
        targetWebSocket.send(event.data);
        log.debug('Successfully sent message to gemini');
      } catch (error) {
        log.error('Error sending to gemini:', error);
      }
    } else {
      // 如果连接还未建立，将消息加入待处理队列
      log.debug('Connection not ready, queueing message');
      pendingMessages.push(event.data);
    }
  });
 
  targetWebSocket.addEventListener("message", (event) => {
    log.debug('Received message from gemini');
    
    try {
      if (proxy.readyState === WebSocket.OPEN) {
        proxy.send(event.data);
        log.debug('Successfully forwarded message to client');
      }
    } catch (error) {
      log.error('Error forwarding to client:', error);
    }
  });
 
  targetWebSocket.addEventListener("close", (event) => {
    log.info('Gemini connection closed:', {
      code: event.code,
      reason: event.reason || 'No reason provided',
      wasClean: event.wasClean,
      timestamp: new Date().toISOString(),
      readyState: targetWebSocket.readyState
    });
    if (proxy.readyState === WebSocket.OPEN) {
      proxy.close(event.code, event.reason);
    }
  });
 
  proxy.addEventListener("close", (event) => {
    log.info('Client connection closed:', {
      code: event.code,
      reason: event.reason || 'No reason provided',
      wasClean: event.wasClean,
      timestamp: new Date().toISOString()
    });
    if (targetWebSocket.readyState === WebSocket.OPEN) {
      targetWebSocket.close(event.code, event.reason);
    }
  });
 
  targetWebSocket.addEventListener("error", (error) => {
    log.error('Gemini WebSocket error:', {
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      readyState: targetWebSocket.readyState
    });
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

async function handleAPIRequest(request, env) {
  try {
    const worker = await import('./api_proxy/worker.mjs');
    return await worker.default.fetch(request);
  } catch (error) {
    log.error('API request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStatus = error.status || 500;
    return new Response(errorMessage, {
      status: errorStatus,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    });
  }
}