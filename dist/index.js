"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const port = process.env.WEB_SOCKET_PORT || 8080;
const expressPort = process.env.EXPRESS_PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const wss = new ws_1.WebSocketServer({ port: port });
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
console.log("WebSocket server running on port 8080");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
function summarize(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const prompt = `Summarize important things from the following conversation :\n\n${allMessages}`;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
            const response = yield axios_1.default.post(geminiUrl, {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            });
            const summary = ((_e = (_d = (_c = (_b = (_a = response.data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "No summary generated.";
            res.json({ summary });
        }
        catch (error) {
            console.error("Error summarizing messages:", ((_f = error.response) === null || _f === void 0 ? void 0 : _f.data) || error.message);
            res.status(500).json({ error: "Failed to summarize conversation." });
        }
    });
}
app.get("/summarize", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    summarize(req, res).catch((err) => {
        console.error(err);
        res.status(500).json({ message: "Internal server error!" });
    });
}));
app.listen(expressPort, () => {
    console.log(`App is running at port : ${expressPort}`);
});
