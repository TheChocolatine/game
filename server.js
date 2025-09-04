const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const players = new Map();
const bullets = [];

function randomColor(){ return '#'+Math.floor(Math.random()*16777215).toString(16); }

wss.on('connection', ws => {
  const id = Math.random().toString(36).substr(2,9);
  players.set(id, {id, x:Math.random()*500, y:Math.random()*500, hp:100, color:randomColor(), score:0});

  ws.send(JSON.stringify({t:'init', id, players:Array.from(players.values()), bullets}));

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }

    if(data.t==='update'){
      const p = players.get(id);
      if(p){ p.x=data.x; p.y=data.y; p.hp=data.hp; }
    } else if(data.t==='shoot'){
      bullets.push({id, x:data.x, y:data.y, angle:data.angle, speed:5, color:data.color});
    }
  });

  ws.on('close', () => { players.delete(id); });
});

// Game loop
setInterval(()=>{
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.x += Math.cos(b.angle)*b.speed;
    b.y += Math.sin(b.angle)*b.speed;

    for(const [pid,p] of players){
      if(pid===b.id) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if(Math.hypot(dx,dy)<10){
        p.hp -= 20;
        if(p.hp<=0){ 
          p.hp=100; 
          p.x=Math.random()*500; 
          p.y=Math.random()*500; 
          players.get(b.id).score += 1;
        }
        bullets.splice(i,1);
        break;
      }
    }
    if(b.x<0||b.x>500||b.y<0||b.y>500) bullets.splice(i,1);
  }

  const payload = JSON.stringify({t:'state', players:Array.from(players.values()), bullets});
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(payload); });
},16);

console.log('2D Multi server running on port', PORT);
