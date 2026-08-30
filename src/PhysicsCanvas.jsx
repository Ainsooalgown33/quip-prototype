import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null); 
  
  const [appState, setAppState] = useState('menu'); 
  const [roomInput, setRoomInput] = useState('');
  const [lobbyUI, setLobbyUI] = useState({ state: 'lobby', role: 'unassigned', ready: 0 });
  const [cooldowns, setCooldowns] = useState({ dash: 0, shield: 0 });
  const [showTutorial, setShowTutorial] = useState(false); // NEW: Tutorial State

  useEffect(() => {
  // 1. MOVED THIS UP: Connect to the server immediately, before checking for the canvas
  if (!socketRef.current) {
    socketRef.current = io('https://quip-server-7r07.onrender.com'); 
  }
  const socket = socketRef.current;

  // 2. Now check for the canvas. If we are on the menu, it stops here safely.
  const canvas = canvasRef.current;
  if (!canvas) return; 
  
  const ctx = canvas.getContext('2d');
    
    let gameState = { 
      p1: {x: 250, y: 300}, p2: {x: 550, y: 300},
      scores: { p1: 0, p2: 0 }, health: { p1: 100, p2: 100 }, 
      matchState: 'lobby', shields: { p1: 0, p2: 0 }
    };
    let renderState = { p1: {x: 250, y: 300}, p2: {x: 550, y: 300} };
    let prevHealth = { p1: 100, p2: 100 }; 
    let myRole = 'unassigned';
    let isDragging = false; let mousePos = { x: 0, y: 0 };
    let trails = { p1: [], p2: [] }; let particles = [];
    let shakeFrames = 0; let shakeIntensity = 0; let flashOpacity = 0; let impactFrames = 0;
    let audioCtx = null;

    const initAudio = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    };

    const playSound = (type) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
      osc.connect(gainNode); gainNode.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      if (type === 'hit') {
        osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        gainNode.gain.setValueAtTime(0.6, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'shield') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.2);
        gainNode.gain.setValueAtTime(0.5, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    };

    const spawnParticles = (x, y, color, count, speedConfig) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * speedConfig + 2;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, decay: Math.random() * 0.03 + 0.02, color, size: Math.random() * 4 + 2 });
      }
    };
    
    socket.on('role', (role) => { myRole = role; setLobbyUI(prev => ({ ...prev, role: role })); });

    socket.on('gameState', (state) => { 
      gameState = state; 
      setLobbyUI(prev => ({ ...prev, state: state.matchState, ready: state.playersReady }));
      
      if (myRole === 'p1' || myRole === 'p2') {
        setCooldowns({ 
          dash: Math.ceil(state.cooldowns[myRole].dash / 60), 
          shield: Math.ceil(state.cooldowns[myRole].shield / 60) 
        });
      }
      
      if (state.health.p1 < prevHealth.p1) {
        impactFrames = 3; shakeFrames = 15; shakeIntensity = 25; flashOpacity = 0.5; playSound('hit');
        spawnParticles(state.p1.x, state.p1.y, '#38bdf8', 30, 10);
        if (navigator.vibrate) navigator.vibrate(100); 
      }
      if (state.health.p2 < prevHealth.p2) {
        impactFrames = 3; shakeFrames = 15; shakeIntensity = 25; flashOpacity = 0.5; playSound('hit');
        spawnParticles(state.p2.x, state.p2.y, '#f43f5e', 30, 10);
        if (navigator.vibrate) navigator.vibrate(100); 
      }
      prevHealth = { ...state.health };
    });

    const handleKeyDown = (e) => {
      if (myRole !== 'p1' && myRole !== 'p2') return;
      if (e.code === 'KeyQ') socket.emit('useSkill', 'dash');
      if (e.code === 'KeyE') { socket.emit('useSkill', 'shield'); playSound('shield'); }
    };
    window.addEventListener('keydown', handleKeyDown);

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 800; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.stroke(); }
      for (let j = 0; j <= 600; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(800, j); ctx.stroke(); }
    };

    const draw3DFighter = (x, y, radius, color, isP1, isShielded) => {
      ctx.shadowOffsetX = (x - 400) * 0.2; ctx.shadowOffsetY = (y - 300) * 0.2;
      ctx.shadowBlur = isShielded ? 40 : 25; ctx.shadowColor = isShielded ? '#ffffff' : color; 
      
      const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius);
      gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.3, color); gradient.addColorStop(1, isShielded ? '#ffffff' : 'transparent');
      
      ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fillStyle = gradient; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = isShielded ? '#ffffff' : color; ctx.lineWidth = isShielded ? 6 : 2; ctx.stroke();
      
      const s = radius / 25; const dir = isP1 ? 1 : -1; 
      ctx.strokeStyle = isShielded ? '#000000' : '#ffffff'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(x, y - 8 * s, 5 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x - 2 * dir * s, y + 10 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x + 10 * dir * s, y - 2 * s); ctx.moveTo(x - 1 * dir * s, y); ctx.lineTo(x - 8 * dir * s, y - 6 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x + 8 * dir * s, y + 18 * s); ctx.moveTo(x - 2 * dir * s, y + 10 * s); ctx.lineTo(x - 10 * dir * s, y + 20 * s); ctx.stroke();
    };

    const drawHealthBar = (x, y, hp, color) => {
      const width = 60; const height = 6; const px = x - width / 2; const py = y - 50; 
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; ctx.fillRect(px, py, width, height);
      ctx.fillStyle = hp > 30 ? color : '#ef4444'; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(px, py, width * (Math.max(0, hp) / 100), height); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.strokeRect(px, py, width, height);
    };
    
    let animationId;
    const renderLoop = () => {
      if (!canvasRef.current) return;
      renderState.p1.x += (gameState.p1.x - renderState.p1.x) * 0.3; renderState.p1.y += (gameState.p1.y - renderState.p1.y) * 0.3;
      renderState.p2.x += (gameState.p2.x - renderState.p2.x) * 0.3; renderState.p2.y += (gameState.p2.y - renderState.p2.y) * 0.3;

      if (impactFrames > 0) {
        const isWhiteBg = impactFrames % 2 === 0; ctx.fillStyle = isWhiteBg ? '#ffffff' : '#000000'; ctx.fillRect(0, 0, 800, 600); 
        const fgColor = isWhiteBg ? '#000000' : '#ffffff';
        ctx.save(); ctx.translate((renderState.p1.x + renderState.p2.x) / 2, (renderState.p1.y + renderState.p2.y) / 2); ctx.fillStyle = fgColor;
        for (let i = 0; i < 20; i++) { ctx.rotate((Math.PI * 2) / 20); ctx.beginPath(); ctx.moveTo(40, -5); ctx.lineTo(1000, -10 - Math.random() * 40); ctx.lineTo(1000, 10 + Math.random() * 40); ctx.lineTo(40, 5); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = fgColor; ctx.beginPath(); ctx.arc(renderState.p1.x, renderState.p1.y, 30, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(renderState.p2.x, renderState.p2.y, 42, 0, Math.PI * 2); ctx.fill();
        impactFrames--; animationId = requestAnimationFrame(renderLoop); return;
      }

      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 800, 600);
      ctx.save(); 
      if (shakeFrames > 0) { ctx.translate((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity); shakeFrames--; shakeIntensity *= 0.85; }
      drawGrid();
      
      const arenaGrad = ctx.createRadialGradient(400, 300, 100, 400, 300, 250);
      arenaGrad.addColorStop(0, 'rgba(15, 23, 42, 0.8)'); arenaGrad.addColorStop(1, 'rgba(51, 65, 85, 0.3)');
      ctx.beginPath(); ctx.arc(400, 300, 250, 0, 2 * Math.PI); ctx.fillStyle = arenaGrad; ctx.fill(); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 8; ctx.stroke(); 

      if (gameState.matchState === 'playing') {
        ctx.beginPath(); ctx.arc(400, 300, 248, 0, 2 * Math.PI);
        ctx.strokeStyle = (gameState.health?.p1 > 0 && gameState.health?.p2 > 0) ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 4; ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter'; 
      if (gameState.matchState !== 'gameOver' && gameState.matchState !== 'lobby') {
        trails.p1.push({ x: renderState.p1.x, y: renderState.p1.y }); trails.p2.push({ x: renderState.p2.x, y: renderState.p2.y });
        if (trails.p1.length > 20) trails.p1.shift(); if (trails.p2.length > 20) trails.p2.shift();
      } else { trails.p1 = []; trails.p2 = []; }

      trails.p1.forEach((pos, i) => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 25 * (i / 20), 0, Math.PI * 2); ctx.fillStyle = `rgba(56, 189, 248, ${i / 50})`; ctx.fill(); });
      trails.p2.forEach((pos, i) => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 35 * (i / 20), 0, Math.PI * 2); ctx.fillStyle = `rgba(244, 63, 94, ${i / 50})`; ctx.fill(); });

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fill(); ctx.globalAlpha = 1.0;
        }
      }
      
      draw3DFighter(renderState.p1.x, renderState.p1.y, 25, '#38bdf8', true, gameState.shields?.p1 > 0);
      draw3DFighter(renderState.p2.x, renderState.p2.y, 35, '#f43f5e', false, gameState.shields?.p2 > 0);
      
      if (isDragging && (myRole === 'p1' || myRole === 'p2') && gameState.matchState === 'playing') {
        const myBall = myRole === 'p1' ? renderState.p1 : renderState.p2;
        const dragDist = Math.hypot(myBall.x - mousePos.x, myBall.y - mousePos.y);
        ctx.beginPath(); ctx.moveTo(myBall.x, myBall.y); ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = dragDist > 100 ? '#ef4444' : dragDist > 50 ? '#f97316' : '#facc15'; ctx.lineWidth = Math.min(8, 2 + (dragDist / 20));
        ctx.setLineDash([15, 10]); ctx.stroke(); ctx.setLineDash([]);
      }

      ctx.globalCompositeOperation = 'source-over'; ctx.restore(); 

      if (gameState.matchState === 'playing' || gameState.matchState === 'countdown') {
        drawHealthBar(renderState.p1.x, renderState.p1.y, gameState.health?.p1 ?? 100, '#38bdf8');
        drawHealthBar(renderState.p2.x, renderState.p2.y, gameState.health?.p2 ?? 100, '#f43f5e');
      }

      if (flashOpacity > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`; ctx.fillRect(0, 0, 800, 600); flashOpacity -= 0.05; }
      
      ctx.font = '900 48px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#38bdf8'; ctx.fillText(gameState.scores.p1, 280, 60);
      ctx.fillStyle = '#475569'; ctx.fillText('-', 400, 60); ctx.fillStyle = '#f43f5e'; ctx.fillText(gameState.scores.p2, 520, 60);
      
      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 140px Arial'; ctx.fillStyle = '#facc15'; ctx.shadowBlur = 40; ctx.shadowColor = '#facc15';
        const seconds = Math.ceil(gameState.matchTimer / 60); ctx.fillText(seconds > 0 ? seconds : "FIGHT!", 400, 340); ctx.shadowBlur = 0;
      }

      if (gameState.matchState === 'gameOver') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 80px Arial'; ctx.fillStyle = gameState.winner === 'p1' ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 50; ctx.shadowColor = ctx.fillStyle; ctx.fillText(gameState.winner === 'p1' ? 'BLUE WINS!' : 'RED WINS!', 400, 300); ctx.shadowBlur = 0;
      }
      
      animationId = requestAnimationFrame(renderLoop);
    };
    
    if (appState === 'inRoom') renderLoop();
    
    const handleStart = (e) => {
      initAudio(); if (myRole !== 'p1' && myRole !== 'p2') return; if (gameState.matchState !== 'playing') return;
      const pos = e.touches ? e.touches[0] : e; const rect = canvas.getBoundingClientRect();
      isDragging = true; mousePos = { x: pos.clientX - rect.left, y: pos.clientY - rect.top };
    };
    
    const handleMove = (e) => {
      if (!isDragging) return; if (e.touches) e.preventDefault();
      const pos = e.touches ? e.touches[0] : e; const rect = canvas.getBoundingClientRect();
      mousePos = { x: pos.clientX - rect.left, y: pos.clientY - rect.top };
    };
    
    const handleEnd = () => {
      if (!isDragging) return; isDragging = false; 
      const myBall = myRole === 'p1' ? renderState.p1 : renderState.p2;
      socket.emit('applyForce', { x: (myBall.x - mousePos.x) * 0.0005, y: (myBall.y - mousePos.y) * 0.0005 });
    };
    
    if (canvas) {
      canvas.addEventListener('mousedown', handleStart); window.addEventListener('mousemove', handleMove, { passive: false }); window.addEventListener('mouseup', handleEnd);
      canvas.addEventListener('touchstart', handleStart, { passive: false }); window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleEnd);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown); cancelAnimationFrame(animationId);
      if (canvas) {
        canvas.removeEventListener('mousedown', handleStart); window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEnd);
        canvas.removeEventListener('touchstart', handleStart); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd);
      }
    };
  }, [appState]);

  const handleJoinRoom = (action) => {
    if (!roomInput.trim()) return;
    socketRef.current.emit('joinRoom', { roomId: roomInput.toUpperCase(), action });
    setAppState('inRoom');
  };

  if (appState === 'menu') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', minHeight: '100vh', fontFamily: 'sans-serif', position: 'relative' }}>
        <h1 style={{ color: '#f8fafc', fontSize: '4rem', textShadow: '0 0 20px #38bdf8', marginBottom: '2rem' }}>SLINGSHOT SUMO</h1>
        <input type="text" placeholder="ENTER ROOM CODE" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} maxLength={6} style={{ fontSize: '2rem', padding: '1rem', textAlign: 'center', borderRadius: '8px', border: '2px solid #38bdf8', backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase', marginBottom: '2rem' }} />
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => handleJoinRoom('play')} style={{ padding: '1rem 3rem', fontSize: '1.5rem', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>FIGHT</button>
          <button onClick={() => handleJoinRoom('spectate')} style={{ padding: '1rem 3rem', fontSize: '1.5rem', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>SPECTATE</button>
        </div>

        <button onClick={() => setShowTutorial(true)} style={{ padding: '0.8rem 2rem', fontSize: '1.2rem', backgroundColor: 'transparent', color: '#facc15', border: '2px solid #facc15', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>HOW TO PLAY</button>

        {/* Tutorial Modal */}
        {showTutorial && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(2, 6, 23, 0.95)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: '2rem' }}>
            <div style={{ maxWidth: '600px', backgroundColor: '#0f172a', border: '2px solid #38bdf8', borderRadius: '16px', padding: '2rem', color: '#f8fafc' }}>
              <h2 style={{ fontSize: '2.5rem', textShadow: '0 0 10px #38bdf8', marginTop: 0, textAlign: 'center' }}>HOW TO SURVIVE</h2>
              
              <ul style={{ fontSize: '1.2rem', lineHeight: '1.8', listStyleType: 'none', padding: 0 }}>
                <li style={{ marginBottom: '1rem' }}><strong style={{ color: '#facc15' }}>MOVEMENT:</strong> Click/touch your fighter and drag backward, then release to launch yourself like a slingshot. The further you drag, the harder you hit.</li>
                <li style={{ marginBottom: '1rem' }}><strong style={{ color: '#ef4444' }}>THE CAGE:</strong> Direct hits don't deal damage. You only lose HP when smashed into the glowing arena wall. Deplete your opponent's HP to zero to knock them out!</li>
                <li style={{ marginBottom: '1rem' }}><strong style={{ color: '#38bdf8' }}>DASH (Q or Left Button):</strong> Instantly applies a massive burst of speed in your current direction. Use it to dodge or counter-attack.</li>
                <li><strong style={{ color: '#f43f5e' }}>SHIELD (E or Right Button):</strong> Turn into an immovable brick wall for 1.5 seconds. While active, you take ZERO damage if knocked into the wall.</li>
              </ul>

              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button onClick={() => setShowTutorial(false)} style={{ padding: '1rem 3rem', fontSize: '1.2rem', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>GOT IT</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#020617', padding: '2rem', minHeight: '100vh', margin: 0, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#f8fafc', letterSpacing: '4px', textShadow: '0 0 20px rgba(56, 189, 248, 0.5)', margin: '0 0 1rem 0' }}>ROOM: {roomInput.toUpperCase()}</h2>
      
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={800} height={600} style={{ border: '4px solid #1e293b', borderRadius: '16px', boxShadow: '0 0 60px rgba(0,0,0,1)' }} />
        
        {lobbyUI.state === 'lobby' && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(2, 6, 23, 0.85)', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <h1 style={{ color: '#f8fafc', fontSize: '3.5rem', textShadow: '0 0 20px #38bdf8' }}>WAITING FOR OPPONENT</h1>
            <p style={{ color: '#94a3b8', fontSize: '1.5rem' }}>Players Ready: <span style={{ color: lobbyUI.ready === 2 ? '#4ade80' : '#facc15' }}>{lobbyUI.ready} / 2</span></p>
          </div>
        )}

        {(lobbyUI.role === 'p1' || lobbyUI.role === 'p2') && lobbyUI.state === 'playing' && (
          <div style={{ position: 'absolute', bottom: '20px', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 40px', boxSizing: 'border-box', pointerEvents: 'none' }}>
            <button onTouchStart={() => socketRef.current.emit('useSkill', 'dash')} onMouseDown={() => socketRef.current.emit('useSkill', 'dash')} style={{ pointerEvents: 'auto', width: '80px', height: '80px', borderRadius: '50%', border: 'none', backgroundColor: cooldowns.dash > 0 ? '#334155' : '#38bdf8', color: '#fff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: cooldowns.dash > 0 ? 'none' : '0 0 20px #38bdf8' }}>
              {cooldowns.dash > 0 ? `${cooldowns.dash}s` : 'DASH (Q)'}
            </button>
            <button onTouchStart={() => socketRef.current.emit('useSkill', 'shield')} onMouseDown={() => socketRef.current.emit('useSkill', 'shield')} style={{ pointerEvents: 'auto', width: '80px', height: '80px', borderRadius: '50%', border: 'none', backgroundColor: cooldowns.shield > 0 ? '#334155' : '#f43f5e', color: '#fff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: cooldowns.shield > 0 ? 'none' : '0 0 20px #f43f5e' }}>
              {cooldowns.shield > 0 ? `${cooldowns.shield}s` : 'SHIELD (E)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhysicsCanvas;