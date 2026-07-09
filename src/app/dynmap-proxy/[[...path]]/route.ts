import { NextRequest } from "next/server";

// Dynmap 리버스 프록시 (같은 출처 임베드용). dynmap.craftopia.work 서브도메인 대신
// /dynmap-proxy/* → 로컬 Dynmap(기본 8123) 으로 프록시한다.
// Dynmap 은 자신이 루트(/)에 있다고 가정한 상대경로(js/css/tiles/...)를 쓰므로,
// index HTML 에 <base href="/dynmap-proxy/"> 를 주입해 자산이 프록시 하위로 해석되게 한다.
const DYNMAP = (process.env.DYNMAP_INTERNAL_URL || "http://localhost:8123").replace(/\/$/, "");

// 플레이어 우클릭 → 부모(대시보드)로 postMessage. 부모의 DynmapPlayerContextMenu 가 받아
// 플롯/월드 초대·추방 메뉴를 띄운다. (A) Leaflet 플레이어 마커 contextmenu, (B) DOM 플레이어목록 폴백.
const PLAYER_CONTEXT_SCRIPT = `<script>
(function(){
  if(window.__bcPlayerCtx)return;window.__bcPlayerCtx=1;
  function post(name,x,y){if(!name)return;try{parent.postMessage({__bc:'dynmap-player-context',player:(''+name).trim(),x:x||0,y:y||0},'*');}catch(e){}}
  function hookMarkers(){try{var dm=window.dynmap;if(!dm||!dm.players)return;for(var k in dm.players){(function(p,key){
    if(!p||p.__bcHooked)return;var m=p.marker||p.our_marker||p.playerMarker;
    if(m&&typeof m.on==='function'){p.__bcHooked=1;m.on('contextmenu',function(e){var oe=e&&e.originalEvent;if(oe&&oe.preventDefault)oe.preventDefault();post(p.account||p.name||key,oe&&oe.clientX,oe&&oe.clientY);});}
  })(dm.players[k],k);}}catch(e){}}
  document.addEventListener('contextmenu',function(ev){try{var el=ev.target,name='';for(var i=0;i<6&&el&&el.getAttribute;i++){
    name=el.getAttribute('data-playername')||el.getAttribute('data-account')||el.getAttribute('rel')||'';
    if(!name){var c=el.className||'';var t=(el.textContent||'').trim();if(typeof c==='string'&&/(playerrow|dynmap-player|player-name|playerName)/.test(c)&&t&&t.length<30)name=t;}
    if(name){post(name,ev.clientX,ev.clientY);ev.preventDefault();return;}el=el.parentElement;}}catch(e){}},true);
  setInterval(hookMarkers,1500);hookMarkers();
})();
</script>`;

// 마켓 플롯(영역 마커) 우클릭/구매버튼 → 부모로 postMessage. 부모의 DynmapPlotContextMenu 가 받아 claim 한다.
// 플러그인이 마커 description(markup) 에 .bc-plot-buy[data-bcplot="<world>:<x>;<z>"] 버튼을 심어두므로,
// (A) 팝업 안 버튼 클릭(주 경로 — 렌더 방식과 무관하게 안정적), (B) [data-bcplot] 우클릭(보조)을 후킹한다.
const PLOT_CONTEXT_SCRIPT = `<script>
(function(){
  if(window.__bcPlotCtx)return;window.__bcPlotCtx=1;
  function post(token,x,y){if(!token)return;try{var s=(''+token).trim();var ci=s.indexOf(':');var world=ci>=0?s.substring(0,ci):'';var pid=ci>=0?s.substring(ci+1):s;parent.postMessage({__bc:'dynmap-plot-context',plot:pid,world:world,x:x||0,y:y||0},'*');}catch(e){}}
  // 지도 안에서는 브라우저 기본 우클릭 메뉴를 끈다(캡처 단계 — Leaflet 의 preventDefault 가 안 먹는 환경 대비).
  // 우리 플레이어/영역 핸들러는 그대로 동작(propagation 은 막지 않음) → 우클릭이 패널로 이어진다.
  document.addEventListener('contextmenu',function(ev){if(ev&&ev.preventDefault)ev.preventDefault();},true);
  // 지도(iframe) 안 좌클릭은 부모 window mousedown 에 안 잡혀 부모의 컨텍스트 메뉴가 안 닫힌다 →
  // 좌클릭 시 부모로 닫기 신호를 보내 메뉴가 닫히게 한다(메뉴 여는 건 우클릭이라 충돌 없음).
  document.addEventListener('mousedown',function(ev){if(ev&&ev.button===0){try{parent.postMessage({__bc:'dynmap-dismiss'},'*');}catch(e){}}},true);
  // (A) 팝업 안 "구매하기" 버튼 클릭 — 좌클릭으로 팝업이 열린 뒤 동작(가장 안정적인 경로)
  document.addEventListener('click',function(ev){try{var t=ev.target;var b=(t&&t.closest)?t.closest('.bc-plot-buy'):null;if(b){var tok=b.getAttribute('data-bcplot');if(tok){post(tok,ev.clientX,ev.clientY);ev.preventDefault();ev.stopPropagation();}}}catch(e){}},true);
  // (B) 열린 팝업 위에서 [data-bcplot] 우클릭(보조)
  document.addEventListener('contextmenu',function(ev){try{var el=ev.target;for(var i=0;i<6&&el;i++){if(el.getAttribute){var tok=el.getAttribute('data-bcplot');if(tok){post(tok,ev.clientX,ev.clientY);ev.preventDefault();return;}}el=el.parentElement;}}catch(e){}},true);
  // (C) 지도의 초록 폴리곤 자체를 우클릭 — Dynmap 3.x 클라이언트의 영역 마커(L.Polygon)에 Leaflet contextmenu 를 직접 건다.
  // dynmapmarkersets[set].areas[id] = { desc, our_layer(L.Polygon) }. desc 에 data-bcplot 이 있는 것만 우리 마커.
  // our_layer 가 갱신(재생성)되면 새 레이어에 다시 건다(레이어 객체에 __bcHooked 플래그).
  // 좌/우클릭 모두 영역(our_layer)에서 직접 후킹 → 어디든 클릭하면 plotId 를 부모로 보냄 + 우리 마커 수 집계.
  // 식별/ID 추출: Dynmap 이 desc 의 data-* / <button> 을 정제하므로 신뢰 불가 → 정제 안 되는 평문 label
  // "플롯 <id> · 구매 가능" 에서 뽑고, 폴백으로 마커 ID "bcmkt_<world>_<x>_<z>" 를 파싱한다.
  function hookAreas(){try{var sets=window.dynmapmarkersets;if(!sets)return;var count=0;for(var sn in sets){var set=sets[sn];if(!set||!set.areas)continue;for(var an in set.areas){(function(area,id){
    if(!area)return;
    // 평문 label "플롯 X · 구매 가능" 또는 "플롯 X · 소유 <닉>" 에서 plotId/상태/소유자 추출(desc 는 sanitize 됨).
    var lbl=(area.label||'')+'';
    var pid='', status='empty', owner='', price=0, world='';
    var lm=/플롯 (.+?) ·/.exec(lbl);
    if(lm){pid=lm[1];
      var ai=lbl.indexOf('경매 ');
      if(ai>=0){status='auction';price=parseInt(lbl.substring(ai+3),10)||0;}
      else{var oi=lbl.indexOf('소유 ');if(oi>=0){status='owned';owner=lbl.substring(oi+3).trim();}else if(lbl.indexOf('소유')>=0){status='owned';}else{var ci=lbl.indexOf('구매 가능 ');if(ci>=0){price=parseInt(lbl.substring(ci+'구매 가능 '.length),10)||0;}}}
    }
    // world(+pid 폴백)는 마커 ID "bc***_<world>_<x>_<z>" 에서 추출. world 명에 '_'(plot_300)가 있어도 마지막 두 토큰(x,z)만 떼면 나머지가 world.
    if(id&&(id.indexOf('bcmkt_')===0||id.indexOf('bcown_')===0||id.indexOf('bcauc_')===0)){var r=id.substring(6).split('_');var z=r.pop();var x=r.pop();world=r.join('_');if(!pid&&x!=null&&z!=null){pid=x+';'+z;status=id.indexOf('bcauc_')===0?'auction':(id.indexOf('bcown_')===0?'owned':'empty');}}
    if(!pid)return; // 우리(마켓) 마커 아님
    if(status==='empty')count++; // 구매 가능(빈)만 집계
    var layer=area.our_layer;if(!layer||layer.__bcHooked||typeof layer.on!=='function')return;
    layer.__bcHooked=1;
    try{layer.unbindPopup();}catch(e){} // Dynmap 기본 팝업 제거 → 부모 패널로 대체
    var st=status, ow=owner, pr=price, wd=world;
    var fire=function(e){var oe=e&&e.originalEvent;if(oe){if(oe.preventDefault)oe.preventDefault();if(oe.stopPropagation)oe.stopPropagation();}try{parent.postMessage({__bc:'dynmap-plot-context',plot:pid,world:wd,status:st,owner:ow,price:pr,x:oe?oe.clientX:0,y:oe?oe.clientY:0},'*');}catch(e2){}};
    layer.on('click',fire);layer.on('contextmenu',fire);
  })(set.areas[an],an);}}
    try{parent.postMessage({__bc:'dynmap-market-count',count:count},'*');}catch(e){}
  }catch(e){}}
  setInterval(hookAreas,1500);hookAreas();
  // 좌표 이동 헬퍼 — Dynmap 을 리로드 없이 부드럽게 팬한다(월드 전환 포함). 준비 안 됐으면 false.
  function bcPanTo(wname,x,y,z){try{var dm=window.dynmap;if(!dm||!dm.map||!dm.getProjection||!dm.getProjection())return false;var w=(dm.worlds&&wname&&dm.worlds[wname])||dm.world;var yy=(y==null?64:y);if(w&&typeof dm.panToLocation==='function'){dm.panToLocation({world:w,x:x,y:yy,z:z});}else{dm.map.panTo(dm.getProjection().fromLocationToLatLng({x:x,y:yy,z:z}));}return true;}catch(e){return false;}}
  // 부모의 dynmap-goto 요청 → 준비될 때까지 보관 후 재시도.
  var bcGoto=null;
  function bcApplyGoto(){if(bcGoto&&bcPanTo(bcGoto.world,bcGoto.x,64,bcGoto.z))bcGoto=null;}
  window.addEventListener('message',function(e){var d=e.data;if(d&&d.__bc==='dynmap-goto'&&typeof d.x==='number'&&typeof d.z==='number'){bcGoto={world:d.world||'',x:d.x,z:d.z};bcApplyGoto();}},false);
  setInterval(bcApplyGoto,800);
  // 플레이어 목록/마커 좌클릭 → 그 플레이어가 있는 월드+위치로 이동(Dynmap 기본 center-on-player 보강).
  document.addEventListener('click',function(ev){try{var el=ev.target,name='';for(var i=0;i<6&&el&&el.getAttribute;i++){name=el.getAttribute('data-playername')||el.getAttribute('data-account')||el.getAttribute('rel')||'';if(!name){var c=el.className||'';var t=(el.textContent||'').trim();if(typeof c==='string'&&/(playerrow|dynmap-player|player-name|playerName)/.test(c)&&t&&t.length<30)name=t;}if(name)break;el=el.parentElement;}if(!name)return;var dm=window.dynmap;if(!dm||!dm.players)return;for(var k in dm.players){var p=dm.players[k];if(p&&(p.account===name||p.name===name)){var loc=p.location;if(loc){var wn=(loc.world&&loc.world.name)?loc.world.name:loc.world;bcPanTo(wn,loc.x,loc.y,loc.z);}break;}}}catch(e){}},false);
})();
</script>`;

// 레이어 컨트롤(Markers/Players/플롯) 꾸미기 + "플롯 (구매 가능/점유)" 레이어를 패널에서 빼내 별도 토글로 노출.
//  - CSS: Leaflet 레이어 패널/체크박스를 둥근 카드 + 브랜드 그린 accent 로 단장.
//  - JS: 라벨 텍스트에 '플롯' 이 들어간 행을 찾아 패널에서 숨기고(밖으로 빼냄), 사이드탭 상단(월드 목록 위)에 알약 토글을 넣는다.
//        기본 off(desired=false) — 토글 클릭 시에만 네이티브 체크박스를 켜서 마커를 표시한다(Dynmap 이 실제 레이어 토글 담당).
//        Dynmap 이 패널을 재생성해도 매 틱마다 원하는 상태로 재동기화한다. (구매가능 수 집계는 데이터 기반이라 숨김과 무관)
const LAYER_UI_SCRIPT = `<style>
.leaflet-control-layers{border-radius:12px!important;border:1px solid rgba(0,0,0,.08)!important;box-shadow:0 6px 22px rgba(0,0,0,.14)!important;background:rgba(255,255,255,.97)!important;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important;color:#374151!important;overflow:hidden}
.leaflet-control-layers-toggle{border-radius:12px!important}
.leaflet-control-layers-expanded{padding:8px 10px!important}
.leaflet-control-layers-list{margin:0!important}
.leaflet-control-layers-list label{display:flex!important;align-items:center;gap:8px;margin:1px 0!important;padding:6px 8px;border-radius:8px;font-size:12px;font-weight:600;line-height:1.1;cursor:pointer;transition:background .12s ease}
.leaflet-control-layers-list label:hover{background:#f3f4f6}
.leaflet-control-layers-list label>div{display:flex;align-items:center;gap:8px}
.leaflet-control-layers-list label span{white-space:nowrap}
.leaflet-control-layers-selector,.leaflet-control-layers input[type=checkbox]{width:15px;height:15px;margin:0 2px 0 0!important;accent-color:#10b981;cursor:pointer;flex:0 0 auto}
.leaflet-control-layers-separator{border-top:1px solid #e5e7eb!important;margin:6px 2px!important}
.bc-plot-toggle{display:flex;width:100%;box-sizing:border-box;justify-content:center;align-items:center;gap:8px;margin:0 0 8px;padding:8px 13px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;letter-spacing:-.01em;cursor:pointer;-webkit-user-select:none;user-select:none;border:1.5px solid #10b981;color:#047857;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:background .15s ease,color .15s ease,border-color .15s ease}
.bc-plot-toggle:hover{background:#f0fdf4}
.bc-plot-toggle svg{width:14px;height:14px;flex:0 0 auto}
.bc-plot-toggle .bc-dot{width:8px;height:8px;border-radius:50%;background:#cbd5e1;transition:all .15s ease}
.bc-plot-toggle.bc-on{color:#fff;background:linear-gradient(135deg,#10b981,#059669);border-color:#059669}
.bc-plot-toggle.bc-on .bc-dot{background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.3)}
</style>
<script>
(function(){
  if(window.__bcLayerUi)return;window.__bcLayerUi=1;
  var desired=false,btn=null,cb=null; // 기본 off — 사용자가 토글로 켤 때만 표시
  function findPlotRow(){
    var ls=document.querySelectorAll('.leaflet-control-layers label');
    for(var i=0;i<ls.length;i++){var t=(ls[i].textContent||'').trim();
      if(t.indexOf('플롯')>=0){var x=ls[i].querySelector('input[type=checkbox]');if(x)return{label:ls[i],input:x};}}
    return null;
  }
  function applyDesired(){try{if(cb&&cb.checked!==desired)cb.click();}catch(e){}} // Dynmap 의 실제 레이어 토글을 구동
  function syncBtn(){if(btn){if(desired)btn.classList.add('bc-on');else btn.classList.remove('bc-on');}}
  function ensureBtn(){
    if(btn)return;
    btn=document.createElement('div');btn.className='bc-plot-toggle';btn.title='구매 가능/점유 플롯 마커 표시·숨기기';
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg><span>구매·점유 플롯</span><span class="bc-dot"></span>';
    ['mousedown','dblclick','pointerdown','touchstart','wheel'].forEach(function(ev){btn.addEventListener(ev,function(e){e.stopPropagation();});});
    btn.addEventListener('click',function(e){e.stopPropagation();desired=!desired;applyDesired();syncBtn();});
    // append 는 placeBtn 이 담당(사이드탭 상단에 배치)
  }
  // 토글을 사이드탭 맨 위(월드 목록 위, 없으면 플레이어 목록 위)에 둔다 — Dynmap 재생성에도 재부착.
  function placeBtn(){
    if(!btn)return;
    var anchor=document.querySelector('.bc-worldlist')||document.querySelector('.playerlist');
    if(!anchor||!anchor.parentNode)return; // 사이드탭 준비 전 — 아직 배치 안 함
    if(btn.parentNode!==anchor.parentNode||btn.nextSibling!==anchor){anchor.parentNode.insertBefore(btn,anchor);}
  }
  function tick(){
    var row=findPlotRow();
    // 패널의 label 은 display:flex!important 라서 인라인 none 이 안 먹는다 → setProperty 로 important 부여.
    if(row){cb=row.input;row.label.style.setProperty('display','none','important');applyDesired();ensureBtn();syncBtn();}
    placeBtn();
  }
  setInterval(tick,800);tick();
})();
</script>`;

// "플롯 월드만" 담은 커스텀 월드 리스트를 플레이어 패널(.playerlist) 바로 위(사이드탭 상단)에 끼워 넣는다.
//  - dynmap.worlds 에서 plotworld / plot_* 만 추려 버튼으로 표시, 클릭 시 해당 월드로 이동(goToWorld→selectMap 폴백).
//  - 현재 보고 있는 월드는 강조. Dynmap 이 패널을 재생성하면 매 틱마다 플레이어 목록 바로 위로 재부착한다.
//  - 플레이어 패널(.playerlist)은 30vh 로 캡(월드 목록 + 플레이어 목록이 한 사이드탭에 같이 들어가게).
const WORLD_LIST_SCRIPT = `<style>
.playerlist{max-height:30vh!important;overflow-y:auto!important}
.bc-worldlist{margin:2px 0 8px;padding:8px 9px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.97);box-shadow:0 4px 16px rgba(0,0,0,.10);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.bc-worldlist .bc-wl-title{font-size:11px;font-weight:800;letter-spacing:.02em;color:#047857;margin:0 2px 6px;text-transform:uppercase}
.bc-worldlist .bc-wl-items{display:flex;flex-direction:column;gap:4px}
.bc-worldlist button{display:flex;align-items:center;gap:7px;width:100%;text-align:left;padding:7px 9px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;font-size:12px;font-weight:700;line-height:1.1;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.bc-worldlist button:hover{background:#f0fdf4;border-color:#10b981}
.bc-worldlist button.bc-wl-active{background:linear-gradient(135deg,#10b981,#059669);border-color:#059669;color:#fff;box-shadow:0 2px 8px rgba(16,185,129,.35)}
.bc-worldlist button:before{content:"";width:8px;height:8px;border-radius:50%;background:#cbd5e1;flex:0 0 auto}
.bc-worldlist button.bc-wl-active:before{background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.3)}
.bc-worldlist .bc-wl-empty{font-size:11px;color:#9ca3af;padding:4px 2px}
</style>
<script>
(function(){
  if(window.__bcWorldList)return;window.__bcWorldList=1;
  function isPlotWorld(n){return n==='plotworld'||/^plot_/.test(n);}
  function worldTitle(n){if(n==='plotworld')return '기본 플롯 · 100';var m=/^plot_(\\d+)$/.exec(n);if(m)return m[1]+'×'+m[1]+' 플롯';return n;}
  function gotoWorld(n){try{var dm=window.dynmap;if(!dm)return;
    if(typeof dm.goToWorld==='function'){dm.goToWorld(n);return;}
    var w=dm.worlds&&dm.worlds[n];if(w&&w.maps){for(var k in w.maps){if(typeof dm.selectMap==='function'){dm.selectMap(w.maps[k]);return;}}}}catch(e){}}
  var panel=null;
  function ensure(){
    var pl=document.querySelector('.playerlist');
    if(!pl||!pl.parentNode)return false; // Dynmap 플레이어 패널 준비 전
    if(!panel){
      panel=document.createElement('div');panel.className='bc-worldlist';
      var t=document.createElement('div');t.className='bc-wl-title';t.textContent='플롯 월드';panel.appendChild(t);
      panel.__list=document.createElement('div');panel.__list.className='bc-wl-items';panel.appendChild(panel.__list);
    }
    // 항상 플레이어 목록 바로 위(상단)에 위치 — Dynmap 이 패널을 재생성해도 재부착.
    if(panel.parentNode!==pl.parentNode||panel.nextSibling!==pl){pl.parentNode.insertBefore(panel,pl);}
    return true;
  }
  function refresh(){
    if(!panel)return;var dm=window.dynmap;if(!dm||!dm.worlds)return;
    var cur=dm.world&&dm.world.name;
    var names=[];for(var n in dm.worlds){if(isPlotWorld(n))names.push(n);}
    names.sort(function(a,b){function sz(x){return x==='plotworld'?100:parseInt((x.split('_')[1]||'0'),10);}return sz(a)-sz(b);});
    var sig=names.join(',')+'|'+cur;
    if(panel.__sig===sig)return;panel.__sig=sig;
    panel.__list.innerHTML='';
    if(!names.length){var em=document.createElement('div');em.className='bc-wl-empty';em.textContent='플롯 월드 없음';panel.__list.appendChild(em);return;}
    names.forEach(function(nm){
      var b=document.createElement('button');b.textContent=worldTitle(nm);
      if(nm===cur)b.className='bc-wl-active';
      ['mousedown','dblclick','pointerdown'].forEach(function(ev){b.addEventListener(ev,function(e){e.stopPropagation();});});
      b.addEventListener('click',function(e){e.stopPropagation();gotoWorld(nm);});
      panel.__list.appendChild(b);
    });
  }
  function tick(){if(ensure())refresh();}
  setInterval(tick,1000);tick();
})();
</script>`;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const sub = path && path.length ? path.join("/") : "";
  const target = `${DYNMAP}/${sub}${req.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store", redirect: "follow" });
  } catch (e) {
    return new Response("Dynmap upstream unreachable: " + (e instanceof Error ? e.message : String(e)), {
      status: 502,
    });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers();
  headers.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);
  // 같은 출처 임베드 허용 (전역 X-Frame-Options: DENY 를 덮음 — next.config 에서 이 경로는 제외됨)
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Content-Security-Policy", "frame-ancestors 'self'");

  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    let inject = "";
    if (!/<base\s/i.test(html)) inject += `<base href="/dynmap-proxy/">`;
    if (!/__bcPlayerCtx/.test(html)) inject += PLAYER_CONTEXT_SCRIPT;
    if (!/__bcPlotCtx/.test(html)) inject += PLOT_CONTEXT_SCRIPT;
    if (!/__bcLayerUi/.test(html)) inject += LAYER_UI_SCRIPT;
    if (!/__bcWorldList/.test(html)) inject += WORLD_LIST_SCRIPT;
    if (inject) html = html.replace(/<head([^>]*)>/i, `<head$1>${inject}`);
    headers.set("cache-control", "no-store"); // 주입 HTML 캐시 금지(stale 방지)
    return new Response(html, { status: upstream.status, headers });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers });
}
