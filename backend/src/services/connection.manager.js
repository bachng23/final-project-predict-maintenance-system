class ConnectionManager {
  constructor() {
    this.connections = new Map(); // userId -> Set of socketIds
    this.sockets = new Map(); // socketId -> userId
  }

  addConnection(userId, socketId) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socketId);
    this.sockets.set(socketId, userId);
  }

  removeConnection(socketId) {
    const userId = this.sockets.get(socketId);
    if (userId) {
      const userSockets = this.connections.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.connections.delete(userId);
        }
      }
      this.sockets.delete(socketId);
    }
    return userId;
  }

  getOnlineUsers() {
    return Array.from(this.connections.keys());
  }

  isUserOnline(userId) {
    return this.connections.has(userId);
  }

  getUserSockets(userId) {
    return Array.from(this.connections.get(userId) || []);
  }
}

module.exports = new ConnectionManager();
