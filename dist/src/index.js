"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const expressPort = process.env.WEB_SOCKET_PORT || process.env.EXPRESS_PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const server = app.listen(expressPort, () => {
    console.log(`App is running at port: ${expressPort}`);
});
const wss = new ws_1.WebSocketServer({ server });
let allMessages = "";
let allSockets = [];
// Function to count users in a specific room
function countUsersInRoom(roomId) {
    return allSockets.filter(u => u.room === roomId).length;
}
// Function to broadcast user count to all users in a room
function broadcastUserCount(roomId) {
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
                allMessages += message;
                const roomSockets = allSockets.filter(u => u.room === roomId);
                roomSockets.forEach(user => {
                    if (user.socket !== socket) {
                        user.socket.send(message);
                    }
                });
            }
        }
        catch (error) {
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
async function summarize(req, res) {
    try {
        const prompt = `Summarize important things from the following conversation :\n\n${allMessages}`;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const response = await axios_1.default.post(geminiUrl, {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ]
        });
        const summary = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";
        res.json({ summary });
    }
    catch (error) {
        console.error("Error summarizing messages:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to summarize conversation." });
    }
}
app.get("/summarize", async (req, res) => {
    summarize(req, res).catch((err) => {
        console.error(err);
        res.status(500).json({ message: "Internal server error!" });
    });
});
