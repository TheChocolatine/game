const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const players = new Map();
const projectiles = [];

function randomColor(){ return '#'+Math.floor(Math.random()*16777215).toString(16); }

wss.on('connection', ws => {
  const id = Math.random().toString(36).substr(2,9);
  players.set(id, {id, x:Math.random()*10-5, y:0, z:Math.random()*10-5, rotY:0, hp:100, color:randomColor(), score:0});

  ws.send(JSON.stringify({t:'init', id, players:Array.from(players.values()), projectiles}));

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }

    if(data.t==='update'){
      const p = players.get(id);
      if(p){ p.x=data.x; p.y=data.y; p.z=data.z; p.rotY=data.rotY; p.hp=data.hp; }
    } else if(data.t==='shoot'){
      projectiles.push({id, x:data.x, y:data.y+1.5, z:data.z, rotY:data.rotY, speed:10, color:data.color});
    }
  });

  ws.on('close', () => { players.delete(id); });
});

// Game loop : update projectiles and collisions
setInterval(()=>{
  for(let i=projectiles.length-1;i>=0;i--){
    const proj = projectiles[i];
    proj.x += Math.sin(proj.rotY)*proj.speed*0.016;
    proj.z += Math.cos(proj.rotY)*proj.speed*0.016;

    for(const [pid,p] of players){
      if(pid===proj.id) continue;
      const dx = p.x - proj.x, dz = p.z - proj.z;
      if(Math.hypot(dx,dz)<0.5){
        p.hp -= 20;
        if(p.hp<=0){ 
          p.hp=100; 
          p.x=Math.random()*10-5; 
          p.z=Math.random()*10-5; 
          players.get(proj.id).score+=1; 
        }
        projectiles.splice(i,1); 
        break;
      }
    }
    if(Math.abs(proj.x)>20||Math.abs(proj.z)>20) projectiles.splice(i,1);
  }

  const payload = JSON.stringify({t:'state', players:Array.from(players.values()), projectiles});
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(payload); });
},16);

console.log('FPS WebSocket server running on port', PORT);
