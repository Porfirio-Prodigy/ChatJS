const http = require("http");
const fs = require("fs");
const path = require("path");
const socketio = require("socket.io");

const server = http.createServer(handleRequest);
const io = socketio(server);

const rooms = {}; 
// Estrutura:
// rooms = {
//    sala1: { joao: socket, maria: socket },
//    sala2: { naruto: socket }
// }

server.listen(3000, () => {
    console.log("Akatsuki server running on port 3000...");
});

function handleRequest(req, res) {
    let filePath = req.url === "/"
        ? path.join(__dirname, "index.html")
        : path.join(__dirname, req.url);

    const ext = path.extname(filePath);
    const contentType = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css"
    }[ext] || "text/plain";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("File not found");
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
}

io.on("connection", (socket) => {

    // 🔐 Entrar em sala
    socket.on("join room", ({ nickname, roomCode }, callback) => {

        if (!nickname || !roomCode) {
            if (typeof callback === "function") {
                return callback({ success: false, message: "Dados inválidos" });
            }
            return;
        }

        if (!rooms[roomCode]) {
            rooms[roomCode] = {};
        }

        if (rooms[roomCode][nickname]) {
            if (typeof callback === "function") {
                return callback({ success: false, message: "Nickname já existe na sala" });
            }
            return;
        }

        socket.nickname = nickname;
        socket.roomCode = roomCode;

        rooms[roomCode][nickname] = socket;

        socket.join(roomCode);

        io.to(roomCode).emit("update users", Object.keys(rooms[roomCode]));

        io.to(roomCode).emit("system message", {
            date: getCurrentDate(),
            text: `${nickname} entrou na sala`
        });

        if (typeof callback === "function") {
            callback({ success: true });
        }
    });

    // 💬 Enviar mensagem (SEM callback obrigatório)
    socket.on("send message", (msg) => {

        if (!socket.nickname || !socket.roomCode) return;

        if (!msg || typeof msg !== "string") return;

        const message = {
            date: getCurrentDate(),
            from: socket.nickname,
            text: msg.trim()
        };

        io.to(socket.roomCode).emit("update message", message);
    });

    // 🚪 Desconectar
    socket.on("disconnect", () => {

        if (!socket.nickname || !socket.roomCode) return;

        const room = socket.roomCode;
        const nickname = socket.nickname;

        if (rooms[room] && rooms[room][nickname]) {
            delete rooms[room][nickname];

            io.to(room).emit("update users", Object.keys(rooms[room]));

            io.to(room).emit("system message", {
                date: getCurrentDate(),
                text: `${nickname} saiu da sala`
            });

            // remove sala vazia
            if (Object.keys(rooms[room]).length === 0) {
                delete rooms[room];
            }
        }
    });

});

function getCurrentDate() {
    return new Date().toLocaleString("pt-BR");
}