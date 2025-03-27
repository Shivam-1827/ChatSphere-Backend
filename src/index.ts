import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

interface User {
    socket: WebSocket;
    room: string;
}

let allSockets: User[] = [];

// Function to count users in a specific room
function countUsersInRoom(roomId: string): number {
    return allSockets.filter(u => u.room === roomId).length;
}

// Function to broadcast user count to all users in a room
function broadcastUserCount(roomId: string) {
    const roomSockets = allSockets.filter(u => u.room === roomId);
    const userCount = roomSockets.length;

    roomSockets.forEach(user => {
        user.socket.send(JSON.stringify({
            type: "userCount",
            payload: { count: userCount }
        }));
    });
}

wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());

            if (parsedMessage.type === "join") {
                const roomId = parsedMessage.payload.roomId;
                console.log(`User joined room ${roomId}`);
                
                // Remove user from previous room if exists
                const existingUserIndex = allSockets.findIndex(u => u.socket === socket);
                if (existingUserIndex !== -1) {
                    allSockets.splice(existingUserIndex, 1);
                }

                allSockets.push({
                    socket,
                    room: roomId
                });

                // Broadcast updated user count
                broadcastUserCount(roomId);
            }

            if (parsedMessage.type === "chat") {
                const roomId = parsedMessage.payload.roomId;
                const message = parsedMessage.payload.message;
                
                console.log(`Chat message in room ${roomId}: ${message}`);

                const roomSockets = allSockets.filter(u => u.room === roomId);
                
                roomSockets.forEach(user => {
                    if (user.socket !== socket) {
                        user.socket.send(message);
                    }
                });
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    socket.on("close", () => {
        // Find the room of the closed socket
        const closedUser = allSockets.find(u => u.socket === socket);
        
        // Remove socket from tracking when connection closes
        const index = allSockets.findIndex(u => u.socket === socket);
        if (index !== -1) {
            const roomId = allSockets[index].room;
            allSockets.splice(index, 1);

            // Broadcast updated user count if room exists
            if (roomId) {
                broadcastUserCount(roomId);
            }
        }
    });
});

console.log("WebSocket server running on port 8080");