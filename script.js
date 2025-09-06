/* VNL Volley Stars — Minimal but complete playable build
   - Canvas 2D volleyball (side view) with basic physics
   - AI opponent
   - Packs & collection with rarity weights
   - Save system (localStorage), import/export
   - Builder link to create real players (Europe + Pacific + VNL, uncapped)
*/
(() => {
  'use strict';
  const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
  const saveKey='vnl_vs_save_v4', dbKey='vnl_vs_players_v4';
  const Save = JSON.parse(localStorage.getItem(saveKey) || JSON.stringify({
    coins: 500, collection:{}, team:[], achievements:{}, settings:{sfx:true,perf:false}
  }));
  function commit(){ localStorage.setItem(saveKey, JSON.stringify(Save)); $('#coin-count').textContent = Save.coins|0; }
  $('#coin-count').textContent = Save.coins|0;

  let DB = JSON.parse(localStorage.getItem(dbKey) || 'null');
  async function maybeLoadPlayersJson(){
    try{const r=await fetch('players.json'); if(r.ok){ const arr=await r.json(); if(Array.isArray(arr)&&arr.length){ DB=arr; localStorage.setItem(dbKey, JSON.stringify(DB)); } }}catch(e){}
  }
  maybeLoadPlayersJson();

  // Packs
  const PACKS=[
    {id:'starter',name:'Starter Pack',price:100,pulls:5,weights:{Starter:.75,Pro:.22,Legend:.03}},
    {id:'pro',name:'Pro Pack',price:400,pulls:5,weights:{Starter:.5,Pro:.45,Legend:.05}},
    {id:'legend',name:'Legend Pack',price:900,pulls:5,weights:{Starter:.15,Pro:.55,Legend:.30}}
  ];
  function renderShop(){
    const d=$('#shop-packs'); d.innerHTML='';
    for(const p of PACKS){
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<h3>${p.name}</h3><p>${p.pulls} cards</p><p>${p.price} coins</p><button data-pack="${p.id}">Buy</button>`;
      d.appendChild(el);
    }
    d.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>buyPack(b.dataset.pack));
  }
  renderShop();

  function weightedChoice(w){let r=Math.random(),a=0; for(const[k,v] of Object.entries(w)){a+=v; if(r<=a) return k;} return Object.keys(w)[0];}
  function buyPack(kind){
    const p=PACKS.find(x=>x.id===kind); if(!p) return;
    if((Save.coins|0)<p.price){ alert('Not enough coins'); return; }
    Save.coins-=p.price;
    const pulled=[];
    for(let i=0;i<p.pulls;i++){
      const rar=weightedChoice(p.weights);
      const pool=DB?.filter(x=>x.rarity===rar) || [];
      const card=pool.length? pool[(Math.random()*pool.length)|0] : (DB? DB[(Math.random()*DB.length)|0] : null);
      if(card){
        if(!Save.collection[card.id]) Save.collection[card.id]={owned:true,level:1,xp:0};
        else Save.coins+=50; // dupes -> coins
        pulled.push(card);
      }
    }
    commit();
    const g=$('#pack-cards'); g.innerHTML=pulled.map(cardHTML).join('');
    show('packs');
  }

  // Collection filtering
  function cardHTML(p){
    return `<div class="card player-card"><span class="badge ${p.rarity.toLowerCase()}">${p.rarity}</span><div class="img">${p.image?`<img src="${p.image}" alt="${p.name}">`:'<div style="height:100%"></div>'}</div><div class="meta"><div><strong>${p.name}</strong></div><div>${p.country} • ${p.position}</div></div></div>`;
  }
  function renderCollection(){
    const g=$('#collection-grid'); if(!DB){g.innerHTML='<p>Run the builder first.</p>'; return;}
    const gen=$('#filter-gender').value, src=$('#filter-source').value.toLowerCase(), q=$('#search-name').value.toLowerCase();
    const owned=Object.keys(Save.collection);
    const ownedPlayers=(DB||[]).filter(p=>owned.includes(String(p.id)));
    const arr=ownedPlayers.filter(p=>(!gen||p.gender===gen)&&(!src|| (p.source||'').toLowerCase().includes(src)) && (!q|| (p.name.toLowerCase().includes(q)||p.country.toLowerCase().includes(q)) ));
    g.innerHTML=arr.map(cardHTML).join('') || '<p>No cards yet. Buy packs!</p>';
  }

  // Screens
  function show(id){ $$('.screen').forEach(s=>s.classList.remove('visible')); $('#'+id).classList.add('visible'); }
  $('#btn-collection').onclick=()=>{renderCollection(); show('collection');};
  $('#collection-back').onclick=()=>show('menu');
  $('#btn-packs').onclick=()=>show('packs');
  $('#packs-back').onclick=()=>show('menu');
  $('#btn-shop').onclick=()=>show('shop');
  $('#shop-back').onclick=()=>show('menu');
  $('#btn-settings').onclick=()=>show('settings');
  $('#settings-back').onclick=()=>show('menu');
  $('#btn-import').onclick=()=>show('settings');
  $('#btn-build').onclick=()=>{location.href='tools/build-players.html'};

  // Export / Import
  $('#btn-export').onclick=()=>{
    const blob = new Blob([JSON.stringify(Save,null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vnl-volley-stars-save.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),400);
  };
  $('#file-import').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const fr=new FileReader(); fr.onload=()=>{ try{ const s=JSON.parse(fr.result); localStorage.setItem(saveKey,JSON.stringify(s)); location.reload(); }catch(err){ alert('Invalid save file'); } };
    fr.readAsText(f);
  };

  /**************
   * Match Loop *
   **************/
  const canvas=$('#game'), ctx=canvas.getContext('2d');
  let running=false, ball, leftTeam, rightTeam, scoreL=0, scoreR=0, setNo=1, setsL=0, setsR=0, rally=true, serveLeft=true;
  const keys={};
  document.addEventListener('keydown',e=>keys[e.key]=true);
  document.addEventListener('keyup',e=>keys[e.key]=false);
  $('#btn-play').onclick=()=>{startMatch(); show('match');};

  function mkPlayer(x,left){ return {x, y:420, vx:0, vy:0, w:28, h:64, left, jump:0, cd:0}; }
  function mkTeam(left){
    // try to use owned players; else random DB subset
    const ownedIds=Object.keys(Save.collection);
    const pool=(DB||[]).filter(p=>!ownedIds.length || ownedIds.includes(String(p.id)));
    const arr=[]; for(let i=0;i<6;i++){ arr.push(mkPlayer(left? 150+i*30 : 1050-i*30, left)); }
    return arr;
  }
  function startMatch(){
    scoreL=scoreR=0; setNo=1; setsL=setsR=0; serveLeft=true;
    leftTeam=mkTeam(true); rightTeam=mkTeam(false);
    ball={x:serveLeft? 260:940, y:300, vx:0, vy:0, r:8};
    running=true; requestAnimationFrame(loop);
  }
  function physics(){
    // controls for leftmost player
    const p=leftTeam[0];
    const sp=3, jum=8;
    if(keys['ArrowLeft']) p.x-=sp;
    if(keys['ArrowRight']) p.x+=sp;
    if(keys['ArrowUp']||keys[' ']) if(p.y>=420){p.vy=-jum;}
    if(keys['z']) attemptHit(p, 6, -7);
    if(keys['x']) attemptHit(p, 4, -5);
    if(keys['c']) attemptHit(p, 5, -6);
    p.vy+=0.45; p.y+=p.vy; if(p.y>420){p.y=420; p.vy=0;}
    p.x=Math.max(30, Math.min(570-30, p.x));

    // basic AI for right team
    const ai=rightTeam[0];
    if(ball.x>600){ ai.x += Math.sign(ball.x - ai.x) * 2.2; if(ai.y>=420 && Math.random()<0.06) ai.vy=-8; }
    ai.vy+=0.45; ai.y+=ai.vy; if(ai.y>420){ai.y=420; ai.vy=0;}
    ai.x=Math.max(630, Math.min(1170-30, ai.x));

    // ball
    ball.vy+=0.35; ball.x+=ball.vx; ball.y+=ball.vy;
    // floor
    if(ball.y>430){ // ground
      if(ball.x<600) scoreR++; else scoreL++;
      rotateServe();
    }
    // walls
    if(ball.x<10){ball.x=10; ball.vx*=-0.8;} if(ball.x>1190){ball.x=1190; ball.vx*=-0.8;}
    // net collision (center)
    if(Math.abs(ball.x-600)<6 && ball.y>260){ ball.x = 600 + Math.sign(ball.x-600)*6; ball.vx*=-0.5; }
    // player collisions
    [p,ai].forEach(pl=>{
      const dx=ball.x-(pl.x), dy=ball.y-(pl.y-30), d=Math.hypot(dx,dy);
      if(d<pl.w/2+ball.r+4){ ball.vx = Math.sign(dx)* (4 + Math.random()*2); ball.vy = - (5 + Math.random()*2); }
    });
  }
  function attemptHit(pl, sx, sy){
    const dx=ball.x-pl.x, dy=ball.y-(pl.y-30), d=Math.hypot(dx,dy);
    if(d<40){ ball.vx = (pl.x<600?1:-1)* (sx + Math.random()*2); ball.vy = sy - Math.random()*2; }
  }
  function drawCourt(){
    ctx.clearRect(0,0,1200,600);
    // sky & court stripes already via CSS background; draw net & lines
    ctx.fillStyle='#ffffff'; ctx.fillRect(598,210,4,240); // net
    ctx.fillRect(0,430,1200,6); // floor
    ctx.fillRect(0,260,1200,2); // net top line
  }
  function draw(){
    drawCourt();
    // ball
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fillStyle='#ffd166'; ctx.fill();
    // players
    ctx.fillStyle='#ff4d6d'; ctx.fillRect(leftTeam[0].x-14,leftTeam[0].y-64,28,64);
    ctx.fillStyle='#00b4d8'; ctx.fillRect(rightTeam[0].x-14,rightTeam[0].y-64,28,64);
    $('#score-left').textContent = scoreL; $('#score-right').textContent = scoreR;
    $('#set-count').textContent = `Set ${setNo} / Best of 3`;
  }
  function rotateServe(){
    ball={x:serveLeft? 260:940, y:300, vx:0, vy:0, r:8}; serveLeft=!serveLeft;
    if(scoreL>=25 && scoreL-scoreR>=2){ setsL++; scoreL=scoreR=0; setNo++; }
    if(scoreR>=25 && scoreR-scoreL>=2){ setsR++; scoreL=scoreR=0; setNo++; }
    if(setsL===2 || setsR===2){ running=false; alert(setsL===2?'You win!':'You lose'); show('menu'); }
  }
  function loop(){ if(!running) return; physics(); draw(); requestAnimationFrame(loop); }
})();