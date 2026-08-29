import React, { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const socket = io('https://quip-server-7r07.onrender.com'); // Live Render URL
    
    let gameState = { 
      p1: {x: 250, y: 300}, p2: {x: 550, y: 300},
      scores: { p1: 0, p2: 0 }, matchState: 'countdown', matchTimer: 180, winner: null
    };
    let myRole = null;
    let isDragging = false;
    let mousePos = { x: 0, y: 0 };
    
    let trails = { p1: [], p2: [] };

    // --- SCREEN SHAKE & AUDIO STATE ---
    let shakeFrames = 0;
    let shakeIntensity = 0;
    let prevDist = null;
    let audioCtx = null;

    const initAudio = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    };

    const playSound = (type) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (type === 'launch') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
        gainNode.gain.setValueAtTime(0.7, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      }
    };
    
    socket.on('role', (role) => { myRole = role; });
    socket.on('gameState', (state) => { 
      gameState = state; 
      
      // INFER COLLISIONS FOR SCREEN SHAKE & SOUND
      const dist = Math.hypot(state.p1.x - state.p2.x, state.p1.y - state.p2.y);
      if (prevDist !== null && dist <= 61 && prevDist > 61) {
        shakeFrames = 12; // Shake duration
        shakeIntensity = 20; // Shake violence
        playSound('hit');
      }
      prevDist = dist;
    });

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 800; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.stroke();
      }
      for (let j = 0; j <= 600; j += 40) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(800, j); ctx.stroke();
      }
    };

    const draw3DFighter = (x, y, radius, color, isP1) => {
      // Dynamic 3D Drop Shadow (Shadow stretches away from center light source)
      ctx.shadowOffsetX = (x - 400) * 0.15;
      ctx.shadowOffsetY = (y - 300) * 0.15;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';

      // 3D Spherical Gradient
      const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius);
      gradient.addColorStop(0, color === '#38bdf8' ? 'rgba(186, 230, 253, 0.4)' : 'rgba(253, 164, 175, 0.4)');
      gradient.addColorStop(1, color === '#38bdf8' ? 'rgba(14, 165, 233, 0.8)' : 'rgba(225, 29, 72, 0.8)');

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Sharp Neon Outline
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Stickman Figure
      const s = radius / 25; 
      const dir = isP1 ? 1 : -1; 
      
      ctx.strokeStyle = '#ffffff'; 
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath(); ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x - 2 * dir * s, y + 10 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x + 10 * dir * s, y - 2 * s); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x - 8 * dir * s, y - 6 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x + 8 * dir * s, y + 18 * s); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x - 10 * dir * s, y + 20 * s); ctx.stroke();
    };
    
    const renderLoop = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 800, 600);
      
      ctx.save(); // Save context before screen shake
      
      // Apply Screen Shake
      if (shakeFrames > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
        shakeFrames--;
        shakeIntensity *= 0.85; // Decay
      }

      drawGrid();
      
      // Draw 3D Arena Floor
      const arenaGrad = ctx.createRadialGradient(400, 300, 100, 400, 300, 250);
      arenaGrad.addColorStop(0, 'rgba(30, 41, 59, 0.1)');
      arenaGrad.addColorStop(1, 'rgba(51, 65, 85, 0.4)');
      
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#0f172a';
      ctx.beginPath();
      ctx.arc(400, 300, 250, 0, 2 * Math.PI);
      ctx.fillStyle = arenaGrad;
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Trails
      if (gameState.matchState !== 'gameOver') {
        trails.p1.push({ x: gameState.p1.x, y: gameState.p1.y });
        trails.p2.push({ x: gameState.p2.x, y: gameState.p2.y });
        if (trails.p1.length > 15) trails.p1.shift();
        if (trails.p2.length > 15) trails.p2.shift();
      } else {
        trails.p1 = []; trails.p2 = [];
      }

      trails.p1.forEach((pos, i) => {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 25 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${i / 40})`; ctx.fill();
      });

      trails.p2.forEach((pos, i) => {
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 35 * (i / 15), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 63, 94, ${i / 40})`; ctx.fill();
      });
      
      // Draw 3D Fighters
      draw3DFighter(gameState.p1.x, gameState.p1.y, 25, '#38bdf8', true);
      draw3DFighter(gameState.p2.x, gameState.p2.y, 35, '#f43f5e', false);
      
      // Tension Aim Line
      if (isDragging && myRole && gameState.matchState === 'playing') {
        const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
        const dragDist = Math.hypot(myBall.x - mousePos.x, myBall.y - mousePos.y);
        const tensionColor = dragDist > 100 ? '#ef4444' : dragDist > 50 ? '#f97316' : '#38bdf8';
        
        ctx.beginPath();
        ctx.moveTo(myBall.x, myBall.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = tensionColor; 
        ctx.lineWidth = Math.min(6, 2 + (dragDist / 30));
        ctx.setLineDash([10, 10]); 
        ctx.stroke(); 
        ctx.setLineDash([]);
      }

      ctx.restore(); // Restore context so UI doesn't shake
      
      // Draw UI (Unaffected by Shake)
      ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8'; ctx.fillText(gameState.scores.p1, 300, 50);
      ctx.fillStyle = '#94a3b8'; ctx.fillText('-', 400, 50);
      ctx.fillStyle = '#f43f5e'; ctx.fillText(gameState.scores.p2, 500, 50);

      ctx.font = '16px Arial';
      ctx.fillStyle = myRole === 'p1' ? '#38bdf8' : myRole === 'p2' ? '#f43f5e' : '#94a3b8';
      ctx.fillText(myRole === 'p1' ? 'You are BLUE' : myRole === 'p2' ? 'You are RED' : 'Spectating', 400, 580);

      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = 'bold 120px Arial'; ctx.fillStyle = '#facc15';
        ctx.shadowBlur = 20; ctx.shadowColor = '#facc15';
        const seconds = Math.ceil(gameState.matchTimer / 60);
        ctx.fillText(seconds > 0 ? seconds : "FIGHT!", 400, 330);
        ctx.shadowBlur = 0;
      }

      if (gameState.matchState === 'gameOver') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = 'bold 64px Arial';
        ctx.fillStyle = gameState.winner === 'p1' ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 30; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(gameState.winner === 'p1' ? 'BLUE WINS!' : 'RED WINS!', 400, 280);
        ctx.shadowBlur = 0;
      }
      
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
    
    const handleStart = (e) => {
      initAudio(); // Required to unlock browser audio
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
      playSound('launch'); // Trigger launch sound
      
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', backgroundColor: '#020617', padding: '2rem', minHeight: '100vh' }}>
      <h2 style={{ color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>Slingshot Sumo</h2>
      <canvas ref={canvasRef} width={800} height={600} style={{ border: '2px solid #1e293b', borderRadius: '12px', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }} />
    </div>
  );
};

export default PhysicsCanvas;