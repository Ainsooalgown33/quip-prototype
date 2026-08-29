import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
const socket = io('https://quip-server-7r07.onrender.com/'); // Use YOUR exact URL
    
    let gameState = { 
      p1: {x: 250, y: 300}, p2: {x: 550, y: 300},
      scores: { p1: 0, p2: 0 }, matchState: 'countdown', matchTimer: 180, winner: null
    };
    let myRole = null;
    let isDragging = false;
    let mousePos = { x: 0, y: 0 };
    
    // Arrays to hold history for the trails
    let trails = { p1: [], p2: [] };
    
    socket.on('role', (role) => { myRole = role; });
    socket.on('gameState', (state) => { gameState = state; });
    
    const renderLoop = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 800, 600);
      
      // Draw Arena
      ctx.beginPath();
      ctx.arc(400, 300, 250, 0, 2 * Math.PI);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.stroke();

      // NEW: Manage & Draw Trails
      if (gameState.matchState !== 'gameOver') {
        trails.p1.push({ x: gameState.p1.x, y: gameState.p1.y });
        trails.p2.push({ x: gameState.p2.x, y: gameState.p2.y });
        if (trails.p1.length > 15) trails.p1.shift();
        if (trails.p2.length > 15) trails.p2.shift();
      } else {
        trails.p1 = []; trails.p2 = []; // Clear trails on game over
      }

      trails.p1.forEach((pos, i) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${i / 30})`;
        ctx.fill();
      });

      trails.p2.forEach((pos, i) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 35 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 63, 94, ${i / 30})`;
        ctx.fill();
      });
      
      // Draw Players
      ctx.beginPath(); ctx.arc(gameState.p1.x, gameState.p1.y, 25, 0, 2 * Math.PI);
      ctx.fillStyle = '#38bdf8'; ctx.fill();
      
      ctx.beginPath(); ctx.arc(gameState.p2.x, gameState.p2.y, 35, 0, 2 * Math.PI);
      ctx.fillStyle = '#f43f5e'; ctx.fill();
      
      // Draw Aim Line
      if (isDragging && myRole && gameState.matchState === 'playing') {
        const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
        ctx.beginPath();
        ctx.moveTo(myBall.x, myBall.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
      }
      
      // Draw UI elements
      ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8'; ctx.fillText(gameState.scores.p1, 300, 50);
      ctx.fillStyle = '#94a3b8'; ctx.fillText('-', 400, 50);
      ctx.fillStyle = '#f43f5e'; ctx.fillText(gameState.scores.p2, 500, 50);

      ctx.font = '16px Arial';
      ctx.fillStyle = myRole === 'p1' ? '#38bdf8' : myRole === 'p2' ? '#f43f5e' : '#94a3b8';
      ctx.fillText(myRole === 'p1' ? 'You are BLUE' : myRole === 'p2' ? 'You are RED' : 'Spectating', 400, 580);

      // NEW: Draw Countdown Timer
      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 800, 600);
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = '#facc15';
        const seconds = Math.ceil(gameState.matchTimer / 60);
        ctx.fillText(seconds > 0 ? seconds : "GO!", 400, 330);
      }

      // Draw Win Screen Overlay
      if (gameState.matchState === 'gameOver') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = 'bold 64px Arial';
        ctx.fillStyle = gameState.winner === 'p1' ? '#38bdf8' : '#f43f5e';
        ctx.fillText(gameState.winner === 'p1' ? 'BLUE WINS!' : 'RED WINS!', 400, 280);
      }
      
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
    
    // Input logic prevents dragging unless playing
    const handleMouseDown = (e) => {
      if (myRole === 'spectator' || !myRole || gameState.matchState !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      
      if (Math.hypot(clickX - myBall.x, clickY - myBall.y) < 40) {
        isDragging = true;
        mousePos = { x: clickX, y: clickY };
      }
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const rect = canvas.getBoundingClientRect();
      mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    
    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      socket.emit('applyForce', { 
        x: (myBall.x - mousePos.x) * 0.0005, 
        y: (myBall.y - mousePos.y) * 0.0005 
      });
    };
    
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      socket.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <h2>Networked Sumo Prototype</h2>
      <canvas ref={canvasRef} width={800} height={600} style={{ border: '2px solid #334155', borderRadius: '8px' }} />
    </div>
  );
};

export default PhysicsCanvas;