import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  
  const [appState, setAppState] = useState('menu'); 
  const [roomInput, setRoomInput] = useState('');
  const [lobbyUI, setLobbyUI] = useState({ state: 'lobby', role: 'unassigned', ready: 0 });
  const [cooldowns, setCooldowns] = useState({ dash: 0, shield: 0 });

  // Quip-style color palette
  const colors = {
    bg: '#f4f6f8',
    arenaRing: '#8b5cf6', // Quip Purple
    p1: '#f43f5e',        // Red/Pink
    p2: '#0ea5e9',        // Light Blue
    border: '#111827'     // Thick black lines
  };

  useEffect(() => {
    if (!socketRef.current) socketRef.current = io('https://quip-server-7r07.onrender.com'); 
    const socket = socketRef.current;
    
    const canvas = canvasRef.current;
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    
    let gameState = { p1: {x: 250, y: 300}, p2: {x: 550, y: 300}, scores: { p1: 0, p2: 0 }, health: { p1: 100, p2: 100 }, matchState: 'lobby', shields: { p1: 0, p2: 0 }};
    let renderState = { p1: {x: 250, y: 300}, p2: {x: 550, y: 300} };
    let myRole = 'unassigned';
    let isDragging = false; let mousePos = { x: 0, y: 0 };
    let shakeFrames = 0; let shakeIntensity = 0;
    
    socket.on('role', (role) => { myRole = role; setLobbyUI(prev => ({ ...prev, role: role })); });
    socket.on('gameState', (state) => { 
      gameState = state; 
      setLobbyUI(prev => ({ ...prev, state: state.matchState, ready: state.playersReady }));
      if (myRole === 'p1' || myRole === 'p2') {
        setCooldowns({ dash: Math.ceil(state.cooldowns[myRole].dash / 60), shield: Math.ceil(state.cooldowns[myRole].shield / 60) });
      }
    });

    const handleKeyDown = (e) => {
      if (myRole !== 'p1' && myRole !== 'p2') return;
      if (e.code === 'KeyQ') socket.emit('useSkill', 'dash');
      if (e.code === 'KeyE') socket.emit('useSkill', 'shield');
    };
    window.addEventListener('keydown', handleKeyDown);

    // DRAW TOON-SHADED 3D PUCK (Quip Style)
    const drawToonPuck = (x, y, radius, color, isShielded) => {
      const height = 15; // 3D depth

      // 1. Draw solid black drop shadow (offset bottom right)
      ctx.fillStyle = colors.border;
      ctx.beginPath(); ctx.arc(x + 4, y + 4, radius, 0, Math.PI * 2); ctx.fill();

      // 2. Draw Cylinder Body (Darker shade)
      ctx.fillStyle = colors.border;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - radius, y - height, radius * 2, height);
      
      ctx.fillStyle = isShielded ? '#cbd5e1' : color;
      ctx.filter = 'brightness(70%)';
      ctx.beginPath(); ctx.arc(x, y, radius - 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - radius + 3, y - height, (radius * 2) - 6, height);
      ctx.filter = 'none';

      // 3. Draw Top Cap (Main color + thick border)
      ctx.lineWidth = 4;
      ctx.strokeStyle = colors.border;
      ctx.fillStyle = isShielded ? '#f1f5f9' : color;
      ctx.beginPath(); ctx.arc(x, y - height, radius, 0, Math.PI * 2); 
      ctx.fill(); ctx.stroke();

      // 4. Draw Inner Highlight (adds domed reflection feel)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.ellipse(x - radius/3, y - height - radius/3, radius/3, radius/4, Math.PI/4, 0, Math.PI * 2); ctx.fill();
    };
    
    let animationId;
    const renderLoop = () => {
      if (!canvasRef.current) return;
      renderState.p1.x += (gameState.p1.x - renderState.p1.x) * 0.3; renderState.p1.y += (gameState.p1.y - renderState.p1.y) * 0.3;
      renderState.p2.x += (gameState.p2.x - renderState.p2.x) * 0.3; renderState.p2.y += (gameState.p2.y - renderState.p2.y) * 0.3;

      // Fill background off-white
      ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, 800, 600);
      
      ctx.save(); 
      if (shakeFrames > 0) { ctx.translate((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity); shakeFrames--; shakeIntensity *= 0.85; }

      // DRAW ARENA RING (Quip Style - Flat purple with thick black drop shadow)
      const ringX = 400; const ringY = 300; const ringR = 250;
      
      // Arena Solid Black Shadow
      ctx.beginPath(); ctx.arc(ringX + 8, ringY + 8, ringR + 10, 0, 2 * Math.PI);
      ctx.fillStyle = colors.border; ctx.fill();
      
      // Arena Purple Ring
      ctx.beginPath(); ctx.arc(ringX, ringY, ringR, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 20; ctx.strokeStyle = colors.arenaRing; ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = colors.border; ctx.stroke(); // Inner border
      ctx.beginPath(); ctx.arc(ringX, ringY, ringR + 10, 0, 2 * Math.PI); ctx.stroke(); // Outer border

      // Draw Pucks
      drawToonPuck(renderState.p1.x, renderState.p1.y, 25, colors.p1, gameState.shields?.p1 > 0);
      drawToonPuck(renderState.p2.x, renderState.p2.y, 35, colors.p2, gameState.shields?.p2 > 0);
      
      // Aim Line (Clean dashed black line)
      if (isDragging && (myRole === 'p1' || myRole === 'p2') && gameState.matchState === 'playing') {
        const myBall = myRole === 'p1' ? renderState.p1 : renderState.p2;
        ctx.beginPath(); ctx.moveTo(myBall.x, myBall.y - 15); ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = colors.border; ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
        
        // Draw target crosshair
        ctx.fillStyle = colors.border;
        ctx.beginPath(); ctx.arc(mousePos.x, mousePos.y, 6, 0, Math.PI*2); ctx.fill();
      }

      ctx.restore(); 

      // Floating Score UI inside canvas
      ctx.font = '900 36px "Montserrat", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = colors.p1; ctx.fillText(gameState.scores.p1, 300, 60);
      ctx.fillStyle = colors.border; ctx.fillText('-', 400, 60);
      ctx.fillStyle = colors.p2; ctx.fillText(gameState.scores.p2, 500, 60);

      // Countdown Overlay
      if (gameState.matchState === 'countdown') {
        ctx.fillStyle = 'rgba(244, 246, 248, 0.8)'; ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 80px "Montserrat", sans-serif'; 
        ctx.fillStyle = colors.border;
        const seconds = Math.ceil(gameState.matchTimer / 60); 
        ctx.fillText(seconds > 0 ? seconds : "FIGHT!", 400, 320);
      }

      animationId = requestAnimationFrame(renderLoop);
    };
    
    if (appState === 'inRoom') renderLoop();
    
    const handleStart = (e) => {
      if (myRole !== 'p1' && myRole !== 'p2') return; if (gameState.matchState !== 'playing') return;
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

  // REUSABLE QUIP-STYLE BUTTON COMPONENT
  const QuipButton = ({ onClick, children, primary }) => (
    <button onClick={onClick} style={{
      padding: '12px 32px', fontSize: '1.1rem', fontWeight: 'bold', fontFamily: '"Montserrat", sans-serif',
      backgroundColor: primary ? '#8b5cf6' : '#ffffff', color: primary ? '#ffffff' : '#111827',
      border: '3px solid #111827', borderRadius: '9999px', cursor: 'pointer',
      boxShadow: '4px 4px 0px #111827', transition: 'transform 0.1s', textTransform: 'uppercase'
    }}
    onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #111827'; }}
    onMouseUp={(e) => { e.currentTarget.style.transform = 'translate(0px, 0px)'; e.currentTarget.style.boxShadow = '4px 4px 0px #111827'; }}
    >
      {children}
    </button>
  );

  // --- HTML LAYOUT ---
  return (
    <div style={{ backgroundColor: '#f4f6f8', minHeight: '100vh', fontFamily: '"Montserrat", sans-serif', color: '#111827', margin: 0 }}>
      
      {/* Top Navbar mimicking Quip */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', backgroundColor: '#ffffff', borderBottom: '3px solid #111827' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-1px' }}>quip</h1>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold', color: '#4b5563' }}>
            <span style={{cursor: 'pointer'}}>Games</span>
            <span style={{cursor: 'pointer'}}>How it works</span>
            <span style={{cursor: 'pointer'}}>Responsible play</span>
          </div>
        </div>
        <QuipButton primary={true}>Play free</QuipButton>
      </nav>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem' }}>
        
        {appState === 'menu' ? (
          <div style={{ textAlign: 'center', maxWidth: '600px', marginTop: '4rem' }}>
            <h2 style={{ fontSize: '3.5rem', fontWeight: '900', margin: '0 0 1rem 0', letterSpacing: '-2px' }}>Sumo Duel 1D</h2>
            <p style={{ fontSize: '1.2rem', color: '#0ea5e9', fontWeight: 'bold', margin: '0 0 1.5rem 0' }}>Dash, brace, and parry on a single shove lane.</p>
            <p style={{ color: '#4b5563', lineHeight: '1.6', marginBottom: '3rem' }}>Enter a room code to spin up a private match. The arena strips the brawl down to one layer. With nowhere to circle and nothing to hide behind, the match becomes pure timing.</p>
            
            <input type="text" placeholder="ENTER ROOM CODE" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} maxLength={6} 
              style={{ fontSize: '1.5rem', padding: '1rem', textAlign: 'center', borderRadius: '12px', border: '3px solid #111827', backgroundColor: '#ffffff', color: '#111827', textTransform: 'uppercase', marginBottom: '2rem', width: '100%', maxWidth: '300px', boxShadow: '4px 4px 0px #111827', fontWeight: 'bold', outline: 'none' }} 
            />
            
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
              <QuipButton primary={true} onClick={() => handleJoinRoom('play')}>Play Sumo</QuipButton>
              <QuipButton onClick={() => handleJoinRoom('spectate')}>Spectate</QuipButton>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* The Game Canvas Wrapper with solid shadow */}
            <div style={{ border: '4px solid #111827', borderRadius: '24px', overflow: 'hidden', boxShadow: '8px 8px 0px #111827', backgroundColor: '#ffffff' }}>
              <canvas ref={canvasRef} width={800} height={600} />
            </div>
            
            {/* Lobby Overlay */}
            {lobbyUI.state === 'lobby' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <div style={{ backgroundColor: '#ffffff', border: '4px solid #111827', borderRadius: '16px', padding: '2rem 4rem', textAlign: 'center', boxShadow: '6px 6px 0px #111827' }}>
                  <h1 style={{ fontSize: '2rem', margin: '0 0 1rem 0' }}>Waiting for opponent.</h1>
                  <p style={{ color: '#4b5563', fontSize: '1.2rem', margin: '0 0 2rem 0' }}>Players Ready: <strong style={{ color: lobbyUI.ready === 2 ? '#10b981' : '#f59e0b' }}>{lobbyUI.ready} / 2</strong></p>
                  <QuipButton onClick={() => setAppState('menu')}>Exit Room</QuipButton>
                </div>
              </div>
            )}

            {/* In-Game Mobile HUD mimicking Quip UI */}
            {(lobbyUI.role === 'p1' || lobbyUI.role === 'p2') && lobbyUI.state === 'playing' && (
              <div style={{ position: 'absolute', bottom: '30px', width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0 40px', boxSizing: 'border-box', pointerEvents: 'none' }}>
                <button onTouchStart={() => socketRef.current.emit('useSkill', 'dash')} onMouseDown={() => socketRef.current.emit('useSkill', 'dash')} 
                  style={{ pointerEvents: 'auto', width: '90px', height: '90px', borderRadius: '50%', border: '4px solid #111827', backgroundColor: cooldowns.dash > 0 ? '#e2e8f0' : '#ffffff', color: '#111827', fontSize: '1rem', fontWeight: '900', cursor: 'pointer', boxShadow: '4px 4px 0px #111827', opacity: cooldowns.dash > 0 ? 0.5 : 1 }}>
                  {cooldowns.dash > 0 ? `${cooldowns.dash}s` : 'MOVE'}
                </button>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <button onTouchStart={() => socketRef.current.emit('useSkill', 'shield')} onMouseDown={() => socketRef.current.emit('useSkill', 'shield')} 
                    style={{ pointerEvents: 'auto', width: '90px', height: '90px', borderRadius: '50%', border: '4px solid #111827', backgroundColor: cooldowns.shield > 0 ? '#e2e8f0' : '#ffffff', color: '#111827', fontSize: '1rem', fontWeight: '900', cursor: 'pointer', boxShadow: '4px 4px 0px #111827', opacity: cooldowns.shield > 0 ? 0.5 : 1 }}>
                    {cooldowns.shield > 0 ? `${cooldowns.shield}s` : 'PLANT'}
                  </button>
                  <button style={{ pointerEvents: 'auto', width: '90px', height: '90px', borderRadius: '50%', border: '4px solid #111827', backgroundColor: '#ffffff', color: '#111827', fontSize: '1rem', fontWeight: '900', boxShadow: '4px 4px 0px #111827' }}>
                    DASH
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhysicsCanvas;