const express = require("express");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 10000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// === GAME STATE ===
const players = new Map();
const bullets = [];
const powerups = [];

// Generate random power-ups
function spawnPowerUp(){
  const types = ["heal","speed","damage"];
  powerups.push({
    id: Math.random().toString(36).substr(2,9),
    x: Math.random()*600,
    y: Math.random()*600,
    type: types[Math.floor(Math.random()*types.length)],
    ttl: 10000
  });
}

// Spawn power-up every 10s
setInterval(spawnPowerUp,10000);

function randomColor(){ return '#'+Math.floor(Math.random()*16777215).toString(16); }

wss.on("connection", ws => {
  const id = Math.random().toString(36).substr(2,9);
  players.set(id, {id, x:300, y:300, hp:100, color:randomColor(), score:0, speed:3, dmg:20, name:"Player_"+id.substr(0,4)});

  ws.send(JSON.stringify({t:"init", id, players:Array.from(players.values()), bullets, powerups}));

  ws.on("message", msg => {
    let data; 
    try{ data=JSON.parse(msg);}catch(e){return;}
    const player = players.get(id);
    if(!player) return;

    if(data.t==="update"){
      player.x=data.x; player.y=data.y; player.hp=data.hp;
    } else if(data.t==="shoot"){
      bullets.push({id, x:data.x, y:data.y, angle:data.angle, speed:5, color:player.color, dmg:player.dmg});
    }
  });

  ws.on("close", ()=>players.delete(id));
});

// === GAME LOOP ===
setInterval(()=>{
  // Update bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x+=Math.cos(b.angle)*b.speed;
    b.y+=Math.sin(b.angle)*b.speed;

    for(const [pid,p] of players){
      if(pid===b.id) continue;
      if(Math.hypot(p.x-b.x,p.y-b.y)<10){
        p.hp -= b.dmg;
        if(p.hp<=0){
          p.hp=100;
          p.x=Math.random()*600; p.y=Math.random()*600;
          players.get(b.id).score++;
        }
        bullets.splice(i,1);
        break;
      }
    }
    if(b.x<0||b.x>600||b.y<0||b.y>600) bullets.splice(i,1);
  }

  // Update powerups TTL
  for(let i=powerups.length-1;i>=0;i--){
    powerups[i].ttl-=16;
    if(powerups[i].ttl<=0) powerups.splice(i,1);
  }

  // Send state
  const state = {t:"state", players:Array.from(players.values()), bullets, powerups};
  const payload = JSON.stringify(state);
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(payload); });
},16);

// Serve static files
app.use(express.static(path.join(__dirname,"public")));

server.listen(PORT, ()=>console.log("Server running on port",PORT));
