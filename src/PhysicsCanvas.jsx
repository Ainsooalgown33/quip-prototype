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
    let prevScores = { p1: 0, p2: 0 };
    let myRole = null;
    let isDragging = false;
    let mousePos = { x: 0, y: 0 };
    
    let trails = { p1: [], p2: [] };
    let particles = [];

    // --- SCREEN SHAKE, AUDIO, FLASH & IMPACT FRAME STATE ---
    let shakeFrames = 0;
    let shakeIntensity = 0;
    let flashOpacity = 0;
    let impactFrames = 0; // NEW: Anime Impact Frames counter
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
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        gainNode.gain.setValueAtTime(0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'explode') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    };

    const spawnParticles = (x, y, color, count, speedConfig) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * speedConfig + 2;
        particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1.0, decay: Math.random() * 0.03 + 0.02,
          color, size: Math.random() * 4 + 2
        });
      }
    };
    
    socket.on('role', (role) => { myRole = role; });
    socket.on('gameState', (state) => { 
      gameState = state; 
      
      const dist = Math.hypot(state.p1.x - state.p2.x, state.p1.y - state.p2.y);
      if (prevDist !== null && dist <= 61 && prevDist > 61) {
        impactFrames = 4; // NEW: Hijack the next 4 frames for pure anime impact
        shakeFrames = 15;
        shakeIntensity = 25;
        flashOpacity = 0.5; 
        playSound('hit');
        const midX = (state.p1.x + state.p2.x) / 2;
        const midY = (state.p1.y + state.p2.y) / 2;
        spawnParticles(midX, midY, '#facc15', 25, 8); 
      }
      prevDist = dist;

      if (state.scores.p1 > prevScores.p1) {
        playSound('explode'); spawnParticles(state.p2.x, state.p2.y, '#f43f5e', 60, 15);
        shakeFrames = 20; shakeIntensity = 35; flashOpacity = 0.8;
      }
      if (state.scores.p2 > prevScores.p2) {
        playSound('explode'); spawnParticles(state.p1.x, state.p1.y, '#38bdf8', 60, 15);
        shakeFrames = 20; shakeIntensity = 35; flashOpacity = 0.8;
      }
      prevScores = state.scores;
    });

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 800; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.stroke(); }
      for (let j = 0; j <= 600; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(800, j); ctx.stroke(); }
    };

    const draw3DFighter = (x, y, radius, color, isP1) => {
      ctx.shadowOffsetX = (x - 400) * 0.2; ctx.shadowOffsetY = (y - 300) * 0.2;
      ctx.shadowBlur = 25; ctx.shadowColor = color; 
      const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius);
      gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.3, color); gradient.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fillStyle = gradient; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      const s = radius / 25; const dir = isP1 ? 1 : -1; 
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x - 2 * dir * s, y + 10 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x + 10 * dir * s, y - 2 * s); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x - 8 * dir * s, y - 6 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x + 8 * dir * s, y + 18 * s); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x - 10 * dir * s, y + 20 * s); ctx.stroke();
    };
    
    const renderLoop = () => {
      // -----------------------------------------------------------
      // NEW: ANIME IMPACT FRAME OVERRIDE
      // -----------------------------------------------------------
      if (impactFrames > 0) {
        const isWhiteBg = impactFrames % 2 === 0;
        ctx.fillStyle = isWhiteBg ? '#ffffff' : '#000000';
        ctx.fillRect(0, 0, 800, 600); // Wipe the entire screen

        const fgColor = isWhiteBg ? '#000000' : '#ffffff';
        const midX = (gameState.p1.x + gameState.p2.x) / 2;
        const midY = (gameState.p1.y + gameState.p2.y) / 2;
        
        // Draw chaotic impact burst lines radiating from the collision point
        ctx.save();
        ctx.translate(midX, midY);
        ctx.fillStyle = fgColor;
        for (let i = 0; i < 20; i++) {
          ctx.rotate((Math.PI * 2) / 20);
          ctx.beginPath();
          ctx.moveTo(40, -5);
          ctx.lineTo(1000, -10 - Math.random() * 40);
          ctx.lineTo(1000, 10 + Math.random() * 40);
          ctx.lineTo(40, 5);
          ctx.fill();
        }
        ctx.restore();

        // Draw rough, pure black/white silhouettes of the fighters
        ctx.fillStyle = fgColor;
        ctx.beginPath(); ctx.arc(gameState.p1.x, gameState.p1.y, 30, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gameState.p2.x, gameState.p2.y, 42, 0, Math.PI * 2); ctx.fill();

        impactFrames--;
        requestAnimationFrame(renderLoop);
        return; // SKIP DRAWING EVERYTHING ELSE THIS FRAME
      }
      // -----------------------------------------------------------

      ctx.globalCompositeOperation = 'source-over'; 
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 800, 600);
      
      ctx.save(); 
      if (shakeFrames > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
        shakeFrames--; shakeIntensity *= 0.85; 
      }

      drawGrid();
      
      const arenaGrad = ctx.createRadialGradient(400, 300, 100, 400, 300, 250);
      arenaGrad.addColorStop(0, 'rgba(15, 23, 42, 0.8)'); arenaGrad.addColorStop(1, 'rgba(51, 65, 85, 0.3)');
      ctx.shadowBlur = 50; ctx.shadowColor = '#000000';
      ctx.beginPath(); ctx.arc(400, 300, 250, 0, 2 * Math.PI);
      ctx.fillStyle = arenaGrad; ctx.fill();
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 8; ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.globalCompositeOperation = 'lighter'; 

      if (gameState.matchState !== 'gameOver') {
        trails.p1.push({ x: gameState.p1.x, y: gameState.p1.y }); trails.p2.push({ x: gameState.p2.x, y: gameState.p2.y });
        if (trails.p1.length > 20) trails.p1.shift(); if (trails.p2.length > 20) trails.p2.shift();
      }

      trails.p1.forEach((pos, i) => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 25 * (i / 20), 0, Math.PI * 2); ctx.fillStyle = `rgba(56, 189, 248, ${i / 50})`; ctx.fill(); });
      trails.p2.forEach((pos, i) => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 35 * (i / 20), 0, Math.PI * 2); ctx.fillStyle = `rgba(244, 63, 94, ${i / 50})`; ctx.fill(); });

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fill(); ctx.globalAlpha = 1.0;
        }
      }
      
      draw3DFighter(gameState.p1.x, gameState.p1.y, 25, '#38bdf8', true);
      draw3DFighter(gameState.p2.x, gameState.p2.y, 35, '#f43f5e', false);
      
      if (isDragging && myRole && gameState.matchState === 'playing') {
        const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
        const dragDist = Math.hypot(myBall.x - mousePos.x, myBall.y - mousePos.y);
        const tensionColor = dragDist > 100 ? '#ef4444' : dragDist > 50 ? '#f97316' : '#facc15';
        ctx.beginPath(); ctx.moveTo(myBall.x, myBall.y); ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = tensionColor; ctx.lineWidth = Math.min(8, 2 + (dragDist / 20));
        ctx.setLineDash([15, 10]); ctx.stroke(); ctx.setLineDash([]);
      }

      ctx.globalCompositeOperation = 'source-over'; 
      ctx.restore(); 

      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`; ctx.fillRect(0, 0, 800, 600);
        flashOpacity -= 0.05; 
      }
      
      ctx.font = '900 48px Arial'; ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8'; ctx.fillText(gameState.scores.p1, 280, 60);
      ctx.fillStyle = '#475569'; ctx.fillText('-', 400, 60);
      ctx.fillStyle = '#f43f5e'; ctx.fillText(gameState.scores.p2, 520, 60);
      ctx.font = 'bold 16px Arial'; ctx.fillStyle = myRole === 'p1' ? '#38bdf8' : myRole === 'p2' ? '#f43f5e' : '#94a3b8';
      ctx.fillText(myRole === 'p1' ? 'YOU ARE BLUE' : myRole === 'p2' ? 'YOU ARE RED' : 'SPECTATING', 400, 580);

      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 140px Arial'; ctx.fillStyle = '#facc15';
        ctx.shadowBlur = 40; ctx.shadowColor = '#facc15';
        const seconds = Math.ceil(gameState.matchTimer / 60);
        ctx.fillText(seconds > 0 ? seconds : "FIGHT!", 400, 340);
        ctx.shadowBlur = 0;
      }

      if (gameState.matchState === 'gameOver') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 80px Arial'; ctx.fillStyle = gameState.winner === 'p1' ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 50; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(gameState.winner === 'p1' ? 'BLUE WINS!' : 'RED WINS!', 400, 300);
        ctx.shadowBlur = 0;
      }
      
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
    
    const handleStart = (e) => {
      initAudio(); 
      if (myRole === 'spectator' || !myRole || gameState.matchState !== 'playing') return;
      const pos = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      const clickX = pos.clientX - rect.left; const clickY = pos.clientY - rect.top;
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      if (Math.hypot(clickX - myBall.x, clickY - myBall.y) < 40) {
        isDragging = true; mousePos = { x: clickX, y: clickY };
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
      playSound('launch'); 
      const myBall = myRole === 'p1' ? gameState.p1 : gameState.p2;
      socket.emit('applyForce', { x: (myBall.x - mousePos.x) * 0.0005, y: (myBall.y - mousePos.y) * 0.0005 });
    };
    
    canvas.addEventListener('mousedown', handleStart); window.addEventListener('mousemove', handleMove, { passive: false }); window.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false }); window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleEnd);
    
    return () => {
      socket.disconnect();
      canvas.removeEventListener('mousedown', handleStart); window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', backgroundColor: '#020617', padding: '2rem', minHeight: '100vh', margin: 0, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '4px', fontSize: '2rem', textShadow: '0 0 20px rgba(56, 189, 248, 0.5)', margin: '0 0 1rem 0' }}>Slingshot Sumo</h2>
      <canvas ref={canvasRef} width={800} height={600} style={{ border: '4px solid #1e293b', borderRadius: '16px', boxShadow: '0 0 60px rgba(0,0,0,1)' }} />
    </div>
  );
};

export default PhysicsCanvas;