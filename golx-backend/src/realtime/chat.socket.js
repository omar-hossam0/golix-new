const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { corsOrigin } = require("../config/cors");
const { authenticateAccessToken } = require("../middleware/auth.middleware");
const { redis, isRedisAvailable } = require("../infrastructure/redis");
const logger = require("../shared/logger");
const { setChatRealtime } = require("./chat.realtime");

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function readSocketToken(socket) {
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const cookies = parseCookies(socket.handshake.headers.cookie || "");
  return cookies.accessToken || null;
}

function setupChatSocket(server, chatService) {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    maxHttpBufferSize: 64 * 1024,
  });

  if (isRedisAvailable() && typeof redis.duplicate === "function") {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info("Socket.IO Redis adapter enabled");
      })
      .catch((err) => {
        logger.warn({ err }, "Socket.IO Redis adapter unavailable; realtime is local to this API instance");
        pubClient.disconnect();
        subClient.disconnect();
      });
  } else {
    logger.warn("Socket.IO Redis adapter disabled; realtime is local to this API instance");
  }

  io.use(async (socket, next) => {
    try {
      const user = await authenticateAccessToken(readSocketToken(socket));
      if (!["admin", "coach", "player", "parent"].includes(user.role)) {
        return next(new Error("Realtime is not available for this role"));
      }
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.userId}`);

    socket.on("chat:join", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId) throw new Error("conversationId is required");
        await chatService.getConversation(socket.user, conversationId);
        socket.join(`chat:${conversationId}`);
        if (typeof ack === "function") ack({ ok: true });
      } catch (err) {
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "Unable to join chat" });
        }
      }
    });

    socket.on("chat:leave", (payload) => {
      if (payload?.conversationId) {
        socket.leave(`chat:${payload.conversationId}`);
      }
    });
  });

  setChatRealtime(io);
  return io;
}

module.exports = setupChatSocket;
