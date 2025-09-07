
// VNL Volley Stars error logger v2
window.VNLErrorLog = (function(){
  const KEY='vnl_error_log';
  const store = JSON.parse(localStorage.getItem(KEY) || '[]');
  function add(type, message, meta){
    const e = {ts: new Date().toISOString(), type, message, meta: meta||{}};
    store.push(e);
    localStorage.setItem(KEY, JSON.stringify(store));
  }
  function all(){ return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  function clear(){ localStorage.removeItem(KEY); }
  function download(){
    const blob = new Blob([JSON.stringify(all(),null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vnl-error-log.json'; a.click();
  }
  window.addEventListener('error', ev => add('window_error', ev.message, {filename: ev.filename, lineno: ev.lineno}));
  window.addEventListener('unhandledrejection', ev => add('unhandled_promise', String(ev.reason)));
  return {add, all, clear, download};
})();
