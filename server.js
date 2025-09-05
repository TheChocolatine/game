const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// GAME STATE
const MAP_SIZE = 600;
const players = new Map();
const bullets = [];
const OBSTACLES = [
  {x:150,y:150,w:100,h:20},
  {x:400,y:300,w:20,h:100},
  {x:200,y:450,w:150,h:20}
];

function randomColor(){ return '#'+Math.floor(Math.random()*16777215).toString(16); }

wss.on('connection', ws => {
  const id = Math.random().toString(36).substr(2,9);
  players.set(id, {id, x:MAP_SIZE/2, y:MAP_SIZE/2, hp:100, color:randomColor(), score:0});

  ws.send(JSON.stringify({t:'init', id, players:Array.from(players.values()), bullets, obstacles:OBSTACLES}));

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }

    const p = players.get(id);
    if(!p) return;

    if(data.t==='update'){
      // Collision avec limites
      p.x = Math.max(0, Math.min(MAP_SIZE, data.x));
      p.y = Math.max(0, Math.min(MAP_SIZE, data.y));
      p.hp = data.hp;
    } else if(data.t==='shoot'){
      bullets.push({id, x:data.x, y:data.y, angle:data.angle, speed:6, color:data.color});
    }
  });

  ws.on('close', ()=>players.delete(id));
});

// GAME LOOP: projectiles movement & collisions
setInterval(()=>{
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.x += Math.cos(b.angle)*b.speed;
    b.y += Math.sin(b.angle)*b.speed;

    // Collision avec obstacles
    for(const o of OBSTACLES){
      if(b.x>o.x && b.x<o.x+o.w && b.y>o.y && b.y<o.y+o.h){
        bullets.splice(i,1);
        break;
      }
    }

    // Collision avec players
    for(const [pid,p] of players){
      if(pid===b.id) continue;
      if(Math.hypot(p.x-b.x,p.y-b.y)<10){
        p.hp -= 20;
        if(p.hp<=0){
          p.hp=100;
          p.x=MAP_SIZE/2;
          p.y=MAP_SIZE/2;
          players.get(b.id).score += 1;
        }
        bullets.splice(i,1);
        break;
      }
    }

    if(b.x<0||b.x>MAP_SIZE||b.y<0||b.y>MAP_SIZE) bullets.splice(i,1);
  }

  const payload = JSON.stringify({t:'state', players:Array.from(players.values()), bullets});
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(payload); });
},16);

console.log('Super 2D Multi Server running on port', PORT);
