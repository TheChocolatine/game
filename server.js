const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const players = new Map();
const projectiles = [];

function randomColor(){ return '#'+Math.floor(Math.random()*16777215).toString(16); }

wss.on('connection', ws => {
  const id = Math.random().toString(36).substr(2,9);
  players.set(id, {id, x:Math.random()*800+50, y:Math.random()*500+50, angle:0, hp:100, color:randomColor(), score:0});

  ws.send(JSON.stringify({t:'init', id, players:Array.from(players.values()), projectiles}));

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }

    if(data.t==='update'){
      const p = players.get(id);
      if(p){ p.x=data.x; p.y=data.y; p.angle=data.angle; p.hp=data.hp; }
    } else if(data.t==='shoot'){
      projectiles.push({id, x:data.x, y:data.y, angle:data.angle, speed:400, color:data.color});
    }
  });

  ws.on('close', () => { players.delete(id); });
});

// Game loop : update projectiles and collisions
setInterval(()=>{
  // Move projectiles
  for(let i=projectiles.length-1; i>=0; i--){
    const proj = projectiles[i];
    proj.x += Math.cos(proj.angle)*proj.speed*0.016;
    proj.y += Math.sin(proj.angle)*proj.speed*0.016;

    // Collision avec joueurs
    for(const [pid,p] of players){
      if(pid===proj.id) continue;
      const dx = p.x - proj.x, dy = p.y - proj.y;
      if(Math.hypot(dx,dy)<18){
        p.hp -= 10;
        if(p.hp<=0){ p.hp=100; p.x=Math.random()*800+50; p.y=Math.random()*500+50; players.get(proj.id).score+=1; }
        projectiles.splice(i,1);
        break;
      }
    }

    // Remove if out of bounds
    if(proj.x<0||proj.x>900||proj.y<0||proj.y>600) projectiles.splice(i,1);
  }

  // Broadcast state
  const payload = JSON.stringify({t:'state', players:Array.from(players.values()), projectiles});
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(payload); });
},16);

console.log('INSANE WebSocket server running on port', PORT);
