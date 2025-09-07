
(function(){
  const out = document.getElementById('out');
  const append = (msg, cls='') => { const t = document.createElement('div'); t.className=cls; t.textContent = msg; out.appendChild(t); };
  const set = (msg) => { out.textContent = ''; append(msg); };

  let DB = null;

  document.getElementById('btn-load').onclick = async () => {
    try{
      const r = await fetch('players.json'); if(!r.ok) throw new Error('players.json not found');
      DB = await r.json();
      set(`✅ Loaded players.json — count=${DB.length}`);
      const lib = DB.filter(p=>p.position==='L').length;
      append(`Liberos: ${lib}`, lib>=200?'ok':(lib>0?'warn':'err'));
      const posCounts = DB.reduce((m,p)=> (m[p.position]=(m[p.position]||0)+1, m), {});
      append(`Positions: `+JSON.stringify(posCounts));
      const rar = DB.reduce((m,p)=> (m[p.rarity]=(m[p.rarity]||0)+1, m), {});
      append(`Rarities: `+JSON.stringify(rar));
    }catch(e){ set('❌ '+e.message); VNLErrorLog?.add('debug_load_error', e.message); }
  };

  document.getElementById('btn-validate').onclick = () => {
    if(!DB){ set('❌ Load players.json first'); return; }
    let errs = 0;
    DB.forEach((p,i)=>{
      if(!p.id||!p.name||!p.country) { errs++; VNLErrorLog?.add('bad_player', 'missing fields', {i,p}); }
      if(!p.stats || typeof p.stats.attack!=='number') { errs++; }
      if(!['OH','MB','OP','S','L'].includes(p.position)) { errs++; }
    });
    set(errs? `⚠️ Validation finished with ${errs} issues — download the log for details.` : '✅ Validation passed. No issues.');
  };

  document.getElementById('btn-imgcheck').onclick = async () => {
    if(!DB){ set('❌ Load players.json first'); return; }
    set('Checking image URLs (HEAD requests)...');
    let missing=0, bad=0;
    for(const p of DB.slice(0,1000)){ // limit to 1000
      try{
        const r = await fetch(p.image, {method:'HEAD'});
        if(!r.ok){ bad++; VNLErrorLog?.add('image_bad_status', r.status, {id:p.id,url:p.image}); }
      }catch(e){ bad++; VNLErrorLog?.add('image_fetch_error', e.message, {id:p.id,url:p.image}); }
      if(!p.image) { missing++; VNLErrorLog?.add('image_missing', 'no image', {id:p.id}); }
    }
    append(`Image check done — missing=${missing}, bad=${bad}`, (missing+bad) ? 'warn':'ok');
  };

  document.getElementById('btn-log-download').onclick = () => VNLErrorLog?.download();
  document.getElementById('btn-log-clear').onclick = () => { VNLErrorLog?.clear(); set('✅ Error log cleared.'); };
})();
