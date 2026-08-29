import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const socket = io('https://quip-server-7r07.onrender.com'); // Your live Render URL
    
    let gameState = { 
      p1: {x: 250, y: 300}, p2: {x: 550, y: 300},
      scores: { p1: 0, p2: 0 }, matchState: 'countdown', matchTimer: 180, winner: null
    };
    let myRole = null;
    let isDragging = false;
    let mousePos = { x: 0, y: 0 };
    
    let trails = { p1: [], p2: [] };
    
    socket.on('role', (role) => { myRole = role; });
    socket.on('gameState', (state) => { gameState = state; });

    // Helper function to draw fighting stickmen inside an aura
    const drawFighter = (x, y, radius, color, isP1) => {
      // 1. Draw the Aura (Hitbox)
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color === '#38bdf8' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Stickman
      const s = radius / 25; // Scale factor (P2 is larger)
      const dir = isP1 ? 1 : -1; // P1 faces right, P2 faces left
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Head
      ctx.beginPath();
      ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2);
      ctx.stroke();

      // Torso
      ctx.beginPath();
      ctx.moveTo(x, y - 3 * s);
      ctx.lineTo(x - 2 * dir * s, y + 10 * s); // Leaning forward slightly
      ctx.stroke();

      // Arms (Front punching, back guarding)
      ctx.beginPath();
      ctx.moveTo(x - 1 * dir * s, y);
      ctx.lineTo(x + 10 * dir * s, y - 2 * s); // Front punch
      ctx.moveTo(x - 1 * dir * s, y);
      ctx.lineTo(x - 8 * dir * s, y - 6 * s); // Back guard
      ctx.stroke();

      // Legs (Wide fighting stance)
      ctx.beginPath();
      ctx.moveTo(x - 2 * dir * s, y + 10 * s);
      ctx.lineTo(x + 8 * dir * s, y + 18 * s); // Front leg
      ctx.moveTo(x - 2 * dir * s, y + 10 * s);
      ctx.lineTo(x - 10 * dir * s, y + 20 * s); // Back leg
      ctx.stroke();
    };
    
    const renderLoop = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 800, 600);
      
      // Draw Arena
      ctx.beginPath();
      ctx.arc(400, 300, 250, 0, 2 * Math.PI);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Manage & Draw Trails
      if (gameState.matchState !== 'gameOver') {
        trails.p1.push({ x: gameState.p1.x, y: gameState.p1.y });
        trails.p2.push({ x: gameState.p2.x, y: gameState.p2.y });
        if (trails.p1.length > 15) trails.p1.shift();
        if (trails.p2.length > 15) trails.p2.shift();
      } else {
        trails.p1 = []; trails.p2 = [];
      }

      trails.p1.forEach((pos, i) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${i / 40})`;
        ctx.fill();
      });

      trails.p2.forEach((pos, i) => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 35 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 63, 94, ${i / 40})`;
        ctx.fill();
      });
      
      // Draw Fighters Instead of Plain Circles
      drawFighter(gameState.p1.x, gameState.p1.y, 25, '#38bdf8', true);
      drawFighter(gameState.p2.x, gameState.p2.y, 35, '#f43f5e', false);
      
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

      // Draw Countdown Timer
      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 800, 600);
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = '#facc15';
        const seconds = Math.ceil(gameState.matchTimer / 60);
        ctx.fillText(seconds > 0 ? seconds : "FIGHT!", 400, 330);
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
    
    // Unified Input Logic (Mouse + Touch)
    const handleStart = (e) => {
      if (myRole === 'spectator' || !myRole || gameState.matchState !== 'playing') return;
      
      const pos = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      const clickX = pos.clientX - rect.left;
      const clickY = pos.clientY - rect.top;
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      
      if (Math.hypot(clickX - myBall.x, clickY - myBall.y) < 40) {
        isDragging = true;
        mousePos = { x: clickX, y: clickY };
      }
    };
    
    const handleMove = (e) => {
      if (!isDragging) return;
      if (e.touches) e.preventDefault();
      
      const pos = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      mousePos = { x: pos.clientX - rect.left, y: pos.clientY - rect.top };
    };
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      socket.emit('applyForce', { 
        x: (myBall.x - mousePos.x) * 0.0005, 
        y: (myBall.y - mousePos.y) * 0.0005 
      });
    };
    
    canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);

    canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      socket.disconnect();
      canvas.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
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