const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const config = require("./config/config")();
const routes = require("./routes/health.routes");
const socketHandler = require("./sockets/socketHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(config.publicDir));
app.use(routes);

socketHandler.registerSocketHandlers(io);

server.listen(config.port, config.host, () => {
    console.log(`Servidor de mensajería LAN escuchando en http://${config.host}:${config.port}`);
});