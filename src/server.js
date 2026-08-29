const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Matter = require('matter-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

// 1. Headless Physics Engine
const { Engine, Runner, Bodies, Composite, Body } = Matter;
const engine = Engine.create({ gravity: { x: 0, y: 0 } });
const world = engine.world;

// 2. Create the Arena Bodies on the Server
const player1 = Bodies.circle(250, 300, 25, { restitution: 0.9, frictionAir: 0.04 });
const player2 = Bodies.circle(550, 300, 35, { restitution: 0.9, frictionAir: 0.04, mass: 2 });
Composite.add(world, [player1, player2]);

Runner.run(Runner.create(), engine);

// 3. Socket Connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Listen for slingshot impulses from the client
  socket.on('applyForce', (force) => {
    // Hardcoded to player1 for this phase
    Body.applyForce(player1, player1.position, force);
  });
  
  socket.on('disconnect', () => console.log('Player disconnected'));
});

// 4. State Broadcast Loop (60 FPS)
setInterval(() => {
  io.emit('gameState', {
    p1: { x: player1.position.x, y: player1.position.y },
    p2: { x: player2.position.x, y: player2.position.y }
  });
}, 1000 / 60);

server.listen(4000, () => console.log('Server running on port 4000'));