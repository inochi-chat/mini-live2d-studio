import { state } from './state.js';
import {
  createPart,
  getSelectedPart
} from './parts.js';

(() => {
'use strict';

const $ = id => document.getElementById(id);

state.stage = $('stage');
state.ctx = state.stage.getContext('2d');
state.W = state.stage.width;
state.H = state.stage.height;

const stage = state.stage;
const ctx = state.ctx;
const W = state.W;
const H = state.H;

const sourceCanvas = state.sourceCanvas;
let sourceCtx = sourceCanvas.getContext('2d');

let originalCanvas = state.originalCanvas;
let originalCtx = originalCanvas.getContext('2d');

state.sourceCtx = sourceCtx;
state.originalCtx = originalCtx;

let baseImageData = null;
let parts = [];
let selectedId = null;
let nextId = 1;

let mode = 'normal';
let brushSize = 24;
let drawing = false;
let startPoint = null;
let freePoints = [];
let lastPointer = null;

let undoStack = [];
let redoStack = [];

let animFrame = 0;
let raf = null;
let motionTime = 0;
let lastTick = 0;

let fit = {scale:1,ox:0,oy:0};
let viewZoom = 1;
let viewPanX = 0;
let viewPanY = 0;
let artScale = 1;

let viewPointers = new Map();
let gesture = null;
let dragAction = null;

function status(message,type='info'){
 const box = $('status');
 box.replaceChildren();

 const title = document.createElement('strong');
 title.textContent = type === 'error' ? '⚠️ エラー' : '📂 読み込み状況';

 const line = document.createElement('div');
 line.textContent = message;

 box.append(title,line);
}

window.addEventListener('error',e=>{
 status((e.message || 'JavaScriptエラー') + ' / 行: ' + (e.lineno || '不明'),'error');
});

window.addEventListener('unhandledrejection',e=>{
 status('非同期エラー: ' + String(e.reason?.message || e.reason),'error');
});

const canvasURL = c => c.toDataURL('image/png');

const cloneCanvas = c => {
 const n = document.createElement('canvas');
 n.width = c.width;
 n.height = c.height;
 n.getContext('2d').drawImage(c,0,0);
 return n;
};

const imageFromURL = url => new Promise((resolve,reject)=>{
 const im = new Image();
 im.onload = () => resolve(im);
 im.onerror = () => reject(new Error('画像データを開けません'));
 im.src = url;
});

function downloadBlob(blob,name){
 if(!blob){
  status('書き出しに失敗したよ。','error');
  return;
 }

 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');

 a.href = url;
 a.download = name;

 document.body.append(a);
 a.click();
 a.remove();

 setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function saveUndo(){
 if(!sourceCanvas.width)return;

 undoStack.push(canvasURL(sourceCanvas));

 if(undoStack.length > 12){
  undoStack.shift();
 }

 redoStack = [];
}

async function restoreCanvas(url){
 const im = await imageFromURL(url);

 sourceCanvas.width = im.width;
 sourceCanvas.height = im.height;
 sourceCtx = sourceCanvas.getContext('2d');
 sourceCtx.drawImage(im,0,0);

 render();
}

function calculateFit(){
 if(!sourceCanvas.width){
  fit = {scale:1,ox:0,oy:0};
  return;
 }

 const base = Math.min(W/sourceCanvas.width,H/sourceCanvas.height)*viewZoom;
 const s = base*artScale;

 fit = {
  scale:s,
  ox:(W-sourceCanvas.width*s)/2+viewPanX,
  oy:(H-sourceCanvas.height*s)/2+viewPanY
 };
}

function updateZoomLabel(){
 $('zoomLabel').textContent = '表示 ' + Math.round(viewZoom*100) + '%';
 $('artScaleValue').textContent = Math.round(artScale*100);
}

function setViewZoom(value){
 viewZoom = Math.max(.25,Math.min(5,value));
 updateZoomLabel();
 render();
}

function resetViewOnly(){
 viewZoom = 1;
 viewPanX = 0;
 viewPanY = 0;
 updateZoomLabel();
 render();
}

function fitView(){
 viewZoom = 1;
 viewPanX = 0;
 viewPanY = 0;
 updateZoomLabel();
 render();
}

function stagePoint(e){
 const r = stage.getBoundingClientRect();

 return {
  x:(e.clientX-r.left)*W/r.width,
  y:(e.clientY-r.top)*H/r.height
 };
}

function sourcePoint(p){
 return {
  x:(p.x-fit.ox)/fit.scale,
  y:(p.y-fit.oy)/fit.scale
 };
}

/* 親子階層のワールド座標を計算 */
function getWorldTransform(p,seen=new Set()){
 if(!p || seen.has(p.id)){
  return {x:0,y:0,scale:100,rotation:0};
 }

 seen.add(p.id);

 const parent = parts.find(q=>q.id===p.parentId);

 if(!parent){
  return {
   x:p.x,
   y:p.y,
   scale:p.scale,
   rotation:p.rotation
  };
 }

 const pt = getWorldTransform(parent,seen);
 const rad = pt.rotation*Math.PI/180;

 const lx = p.x*pt.scale/100;
 const ly = p.y*pt.scale/100;

 return {
  x:pt.x+lx*Math.cos(rad)-ly*Math.sin(rad),
  y:pt.y+lx*Math.sin(rad)+ly*Math.cos(rad),
  scale:pt.scale*p.scale/100,
  rotation:pt.rotation+p.rotation
 };
}

function isChildOf(partId,targetId){
 let p = parts.find(q=>q.id===partId);
 const seen = new Set();

 while(p && p.parentId!=null && !seen.has(p.id)){
  if(p.parentId===targetId)return true;

  seen.add(p.id);
  p = parts.find(q=>q.id===p.parentId);
 }

 return false;
}

function setParent(p,parentId){
 const old = getWorldTransform(p);
 const parent = parentId ? parts.find(q=>q.id===Number(parentId)) : null;

 if(!parent){
  p.parentId = null;
  p.x = old.x;
  p.y = old.y;
  p.scale = old.scale;
  p.rotation = old.rotation;
  return;
 }

 const pt = getWorldTransform(parent);
 const dx = old.x-pt.x;
 const dy = old.y-pt.y;

 const rad = -pt.rotation*Math.PI/180;
 const scale = pt.scale/100;

 p.x = (dx*Math.cos(rad)-dy*Math.sin(rad))/scale;
 p.y = (dx*Math.sin(rad)+dy*Math.cos(rad))/scale;
 p.scale = old.scale/pt.scale*100;
 p.rotation = old.rotation-pt.rotation;
 p.parentId = parent.id;
}

function worldToLocalPosition(p,wx,wy){
 const parent = parts.find(q=>q.id===p.parentId);

 if(!parent){
  p.x = wx;
  p.y = wy;
  return;
 }

 const pt = getWorldTransform(parent);
 const dx = wx-pt.x;
 const dy = wy-pt.y;
 const rad = -pt.rotation*Math.PI/180;
 const s = pt.scale/100;

 p.x = (dx*Math.cos(rad)-dy*Math.sin(rad))/s;
 p.y = (dx*Math.sin(rad)+dy*Math.cos(rad))/s;
}

function partScreenInfo(p){
 const wt = getWorldTransform(p);
 const cx = fit.ox+wt.x*fit.scale;
 const cy = fit.oy+wt.y*fit.scale;

 return {
  wt,
  cx,
  cy,
  w:p.w*fit.scale*wt.scale/100,
  h:p.h*fit.scale*wt.scale/100,
  angle:wt.rotation*Math.PI/180
 };
}

function selectionHandles(p){
 const a = partScreenInfo(p);
 const c = Math.cos(a.angle);
 const s = Math.sin(a.angle);
 const hw = a.w/2;
 const hh = a.h/2;

 const point = (x,y)=>({
  x:a.cx+x*c-y*s,
  y:a.cy+x*s+y*c
 });

 const corners = [
  point(-hw,-hh),
  point(hw,-hh),
  point(hw,hh),
  point(-hw,hh)
 ];

 const top = point(0,-hh);

 const rotate = {
  x:top.x-Math.sin(a.angle)*28,
  y:top.y+Math.cos(a.angle)*28
 };

 return {...a,corners,rotate,point};
}

function hitSelectedHandle(p,pos){
 if(!p)return null;

 const h = selectionHandles(p);

 if(Math.hypot(pos.x-h.rotate.x,pos.y-h.rotate.y)<15){
  return 'rotate';
 }

 for(let i=0;i<h.corners.length;i++){
  if(Math.hypot(pos.x-h.corners[i].x,pos.y-h.corners[i].y)<15){
   return 'scale';
  }
 }

 return null;
}

function hitPart(pos){
 for(let i=parts.length-1;i>=0;i--){
  const p = parts[i];

  if(!p.visible)continue;

  const a = partScreenInfo(p);
  const dx = pos.x-a.cx;
  const dy = pos.y-a.cy;
  const c = Math.cos(-a.angle);
  const s = Math.sin(-a.angle);

  const lx = dx*c-dy*s;
  const ly = dx*s+dy*c;

  if(Math.abs(lx)<=a.w/2+5 && Math.abs(ly)<=a.h/2+5){
   return p;
  }
 }

 return null;
}

function drawSelection(){
 const p = selected();

 if(!p || !p.visible)return;

 const h = selectionHandles(p);

 ctx.save();
 ctx.strokeStyle = '#e8d7ff';
 ctx.fillStyle = '#8f6bc7';
 ctx.lineWidth = 2;
 ctx.setLineDash([5,3]);

 ctx.beginPath();

 h.corners.forEach((q,i)=>{
  if(i)ctx.lineTo(q.x,q.y);
  else ctx.moveTo(q.x,q.y);
 });

 ctx.closePath();
 ctx.stroke();
 ctx.setLineDash([]);

 const top = h.corners[0];
 const rightTop = h.corners[1];

 ctx.beginPath();
 ctx.moveTo((top.x+rightTop.x)/2,(top.y+rightTop.y)/2);
 ctx.lineTo(h.rotate.x,h.rotate.y);
 ctx.stroke();

 h.corners.forEach(q=>{
  ctx.beginPath();
  ctx.arc(q.x,q.y,6,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.strokeStyle = '#e8d7ff';
 });

 ctx.beginPath();
 ctx.arc(h.rotate.x,h.rotate.y,7,0,Math.PI*2);
 ctx.fill();
 ctx.strokeStyle = '#fff';
 ctx.stroke();

 ctx.restore();
}

function render(){
 ctx.clearRect(0,0,W,H);
 calculateFit();

 if(sourceCanvas.width && !$('hideBase').checked){
  ctx.drawImage(
   sourceCanvas,
   fit.ox,
   fit.oy,
   sourceCanvas.width*fit.scale,
   sourceCanvas.height*fit.scale
  );
 }

 for(const p of parts){
  if(!p.visible)continue;

  if(!p.img){
   p.img = new Image();
   p.img.onload = ()=>render();
   p.img.onerror = ()=>status('パーツ画像を表示できなかったよ。','error');
   p.img.src = p.data;
   continue;
  }

  const moving = $('animation').checked;

  const wave = moving
   ? Math.sin(motionTime*Math.max(.25,p.speed/5)+p.phase)
   : 0;

  const sway = moving && p.motion==='none'
   ? Math.sin(animFrame*p.speed/100+p.phase)*p.sway
   : 0;

  const wt = getWorldTransform(p);

  const dw = p.w*fit.scale*wt.scale/100;
  let dh = p.h*fit.scale*wt.scale/100;

  let motionX = 0;
  let motionY = 0;
  let extraRotation = 0;

  if(moving && p.motion==='blink'){
   const cycle = motionTime%3.8;
   const blink = Math.exp(-Math.pow((cycle-.12)/.075,2));
   dh *= Math.max(.08,1-.94*blink);

  }else if(moving && p.motion==='mouth'){
   dh *= .72+.62*((Math.sin(motionTime*7)+1)/2);

  }else if(moving && p.motion==='faceX'){
   extraRotation = wave*p.sway;

  }else if(moving && p.motion==='faceY'){
   motionY = wave*p.sway*.8;

  }else if(moving && p.motion==='eyeX'){
   motionX = wave*Math.max(1,p.w*.055)*p.sway/8;

  }else if(moving && p.motion==='eyeY'){
   motionY = wave*Math.max(1,p.h*.045)*p.sway/8;
  }

  const cx = fit.ox+wt.x*fit.scale+motionX*fit.scale;
  const cy = fit.oy+wt.y*fit.scale+(sway+motionY)*fit.scale;

  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate((wt.rotation+extraRotation)*Math.PI/180);
  ctx.drawImage(p.img,-dw/2,-dh/2,dw,dh);
  ctx.restore();
 }

 if(mode==='normal'){
  drawSelection();
 }

 if(mode==='rect' && startPoint && lastPointer){
  const p = stagePoint(lastPointer);

  ctx.save();
  ctx.strokeStyle = '#c5a5ff';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,4]);
  ctx.strokeRect(startPoint.x,startPoint.y,p.x-startPoint.x,p.y-startPoint.y);
  ctx.restore();
 }

 if(mode==='free' && freePoints.length){
  ctx.save();
  ctx.strokeStyle = '#c5a5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  freePoints.forEach((p,i)=>{
   if(i)ctx.lineTo(p.x,p.y);
   else ctx.moveTo(p.x,p.y);
  });

  ctx.stroke();
  ctx.restore();
 }
}

function addPart(name,canvas,x,y){
 const p = createPart(nextId++,name,canvas,x,y);

 parts.push(p);
 selectedId = p.id;

 updatePartList();
 syncEditor();
 render();
}

/* パーツの前後順を変更 */
const collapsedParts = new Set();

function movePart(id,direction){
 const index = parts.findIndex(p=>p.id===id);

 if(index<0)return;

 const next = index+direction;

 if(next<0 || next>=parts.length)return;

 [parts[index],parts[next]] = [parts[next],parts[index]];

 updatePartList();
 render();
}

/* パーツ一覧の親子表示 */
function updatePartList(){
 const box = $('parts');
 box.replaceChildren();

 if(!parts.length){
  const empty = document.createElement('div');
  empty.className = 'tree-empty';
  empty.textContent = 'まだパーツがありません。';
  box.append(empty);
  return;
 }

 const childrenOf = id => parts.filter(p=>p.parentId===id);

 const roots = parts.filter(p=>
  p.parentId==null ||
  !parts.some(q=>q.id===p.parentId)
 );

 const visited = new Set();

 function createNode(p){
  if(visited.has(p.id))return null;

  visited.add(p.id);

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const children = childrenOf(p.id);
  const hasChildren = children.length>0;

  const row = document.createElement('div');

  row.className = 'tree-row' +
   (p.id===selectedId?' selected':'');

  const toggle = document.createElement('button');
  toggle.className = 'tree-toggle';

  toggle.textContent = hasChildren
   ? (collapsedParts.has(p.id)?'▶':'▼')
   : '・';

  toggle.disabled = !hasChildren;

  toggle.onclick = e=>{
   e.stopPropagation();

   if(collapsedParts.has(p.id)){
    collapsedParts.delete(p.id);
   }else{
    collapsedParts.add(p.id);
   }

   updatePartList();
  };

  const name = document.createElement('div');
  name.className = 'tree-indent';

  name.textContent = (hasChildren?'📁 ':'🧩 ')+
   (p.name||'名前なし');

  const selectPart = ()=>{
   selectedId = p.id;
   updatePartList();
   syncEditor();
   render();
  };

  name.onclick = selectPart;

  const visibility = document.createElement('button');
  visibility.textContent = p.visible?'表示':'非表示';

  visibility.onclick = e=>{
   e.stopPropagation();
   p.visible = !p.visible;
   updatePartList();
   render();
  };

  const front = document.createElement('button');
  front.textContent = '▲';
  front.title = '前面へ';

  front.onclick = e=>{
   e.stopPropagation();
   movePart(p.id,1);
  };

  const back = document.createElement('button');
  back.textContent = '▼';
  back.title = '背面へ';

  back.onclick = e=>{
   e.stopPropagation();
   movePart(p.id,-1);
  };

  row.append(toggle,name,visibility,front,back);
  row.onclick = selectPart;

  wrapper.append(row);

  if(hasChildren && !collapsedParts.has(p.id)){
   const group = document.createElement('div');
   group.className = 'tree-children';

   children.forEach(child=>{
    const childNode = createNode(child);

    if(childNode){
     group.append(childNode);
    }
   });

   wrapper.append(group);
  }

  return wrapper;
 }

 roots.forEach(p=>{
  const node = createNode(p);
  if(node)box.append(node);
 });

 // 親子関係が壊れたデータも一覧から消さない
 parts.forEach(p=>{
  if(!visited.has(p.id)){
   const node = createNode(p);
   if(node)box.append(node);
  }
 });
}

function selected(){
 return getSelectedPart(parts,selectedId);
}

/* 選択中パーツを複製 */
function duplicateSelectedPart(){
 const p = selected();

 if(!p)return;

 const copy = {
  ...p,
  id:nextId++,
  name:(p.name||'パーツ')+' のコピー',
  x:p.x+20,
  y:p.y+20,
  phase:Math.random()*6.28,
  img:null
 };

 parts.push(copy);
 selectedId = copy.id;

 updatePartList();
 syncEditor();
 render();

 status('パーツを複製したよ！');
}

function syncEditor(){
 const p = selected();

 [
  'partName',
  'posX',
  'posY',
  'scale',
  'rotation',
  'sway',
  'speed',
  'motionType',
  'parentPart',
  'togglePart',
  'duplicatePart',
  'deletePart'
 ].forEach(id=>{
  $(id).disabled = !p;
 });

 const parentSelect = $('parentPart');
 parentSelect.replaceChildren();

 const none = document.createElement('option');
 none.value = '';
 none.textContent = 'なし（親パーツ）';
 parentSelect.append(none);

 parts.forEach(q=>{
  if(!p || q.id===p.id || isChildOf(q.id,p.id))return;

  const option = document.createElement('option');
  option.value = q.id;
  option.textContent = q.name||('パーツ '+q.id);

  parentSelect.append(option);
 });

 if(!p){
  $('partName').value = '';
  parentSelect.value = '';
  return;
 }

 $('partName').value = p.name;
 $('motionType').value = p.motion||'none';
 parentSelect.value = p.parentId==null?'':String(p.parentId);

 $('posX').value = Math.max(-300,Math.min(900,Math.round(p.x+300)));
 $('posY').value = Math.max(-300,Math.min(900,Math.round(p.y+300)));
 $('scale').value = Math.max(5,Math.min(800,p.scale));
 $('rotation').value = Math.max(-180,Math.min(180,p.rotation));
 $('sway').value = p.sway;
 $('speed').value = p.speed;

 updateValues();
}

function updateValues(){
 ['posX','posY','scale','rotation','sway','speed'].forEach(id=>{
  const el = $(id);
  const out = $(id+'Value');

  if(out){
   out.textContent =
    id==='posX'||id==='posY'
     ? Number(el.value)-300
     : el.value;
  }
 });
}
 
function loadImageFile(file){
 if(!file)return;

 status('画像を読み込み中…');

 const url = URL.createObjectURL(file);
 const im = new Image();

 im.onload = ()=>{
  sourceCanvas.width = im.width;
  sourceCanvas.height = im.height;
  sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.drawImage(im,0,0);

  originalCanvas = cloneCanvas(sourceCanvas);
  originalCtx = originalCanvas.getContext('2d');

  baseImageData = canvasURL(sourceCanvas);

  parts = [];
  selectedId = null;
  nextId = 1;

  undoStack = [];
  redoStack = [];

  $('hideBase').checked = false;

  viewZoom = 1;
  viewPanX = 0;
  viewPanY = 0;
  artScale = 1;

  $('artScale').value = 100;

  calculateFit();
  updateZoomLabel();
  updatePartList();
  syncEditor();
  render();

  status('画像を読み込んだよ。切り出したい部分を選んでね。');
  URL.revokeObjectURL(url);
 };

 im.onerror = ()=>{
  status('画像を読み込めなかったよ。','error');
  URL.revokeObjectURL(url);
 };

 im.src = url;
}

function cropRect(a,b){
 if(!sourceCanvas.width)return;

 const p1 = sourcePoint(a);
 const p2 = sourcePoint(b);

 const x = Math.max(0,Math.floor(Math.min(p1.x,p2.x)));
 const y = Math.max(0,Math.floor(Math.min(p1.y,p2.y)));
 const r = Math.min(sourceCanvas.width,Math.ceil(Math.max(p1.x,p2.x)));
 const bt = Math.min(sourceCanvas.height,Math.ceil(Math.max(p1.y,p2.y)));

 if(r-x<2 || bt-y<2)return;

 const c = document.createElement('canvas');
 c.width = r-x;
 c.height = bt-y;

 c.getContext('2d').drawImage(
  sourceCanvas,x,y,c.width,c.height,0,0,c.width,c.height
 );

 addPart('切り出しパーツ',c,x+c.width/2,y+c.height/2);
 status('パーツを追加したよ。');
}

function cropFree(points){
 if(points.length<3 || !sourceCanvas.width)return;

 const pts = points.map(sourcePoint);

 const minX = Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x))));
 const minY = Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y))));
 const maxX = Math.min(sourceCanvas.width,Math.ceil(Math.max(...pts.map(p=>p.x))));
 const maxY = Math.min(sourceCanvas.height,Math.ceil(Math.max(...pts.map(p=>p.y))));

 if(maxX-minX<2 || maxY-minY<2)return;

 const c = document.createElement('canvas');
 c.width = maxX-minX;
 c.height = maxY-minY;

 const cc = c.getContext('2d');

 cc.save();
 cc.beginPath();

 pts.forEach((p,i)=>{
  if(i)cc.lineTo(p.x-minX,p.y-minY);
  else cc.moveTo(p.x-minX,p.y-minY);
 });

 cc.closePath();
 cc.clip();

 cc.drawImage(sourceCanvas,minX,minY,c.width,c.height,0,0,c.width,c.height);
 cc.restore();

 addPart('自由切り抜き',c,minX+c.width/2,minY+c.height/2);
 status('自由切り抜きパーツを追加したよ。');
}

function addShape(type){
 const c = document.createElement('canvas');

 c.width = type==='circle'?180:200;
 c.height = type==='circle'?180:140;

 const cc = c.getContext('2d');
 cc.fillStyle = '#c5a5ff';

 if(type==='circle'){
  cc.beginPath();
  cc.arc(90,90,75,0,Math.PI*2);
  cc.fill();
 }else{
  cc.fillRect(10,10,180,120);
 }

 addPart(
  type==='circle'?'円パーツ':'四角パーツ',
  c,
  W/2,
  H/2
 );
}

async function importPSD(file){
 if(!file)return;

 if(!window.agPsd?.readPsd){
  status('PSD読み込みライブラリを読み込めなかったよ。ページを再読み込みしてね。','error');
  return;
 }

 status('PSDを解析中…');
 await new Promise(r=>setTimeout(r,30));

 try{
  const buffer = await file.arrayBuffer();

  const psd = window.agPsd.readPsd(buffer,{
   skipThumbnail:true
  });

  if(!psd.width || !psd.height){
   throw new Error('PSDのサイズを取得できません');
  }

  if(psd.canvas){
   sourceCanvas.width = psd.width;
   sourceCanvas.height = psd.height;
   sourceCtx = sourceCanvas.getContext('2d');
   sourceCtx.drawImage(psd.canvas,0,0);

   originalCanvas = cloneCanvas(sourceCanvas);
   originalCtx = originalCanvas.getContext('2d');

   baseImageData = canvasURL(sourceCanvas);

  }else{
   sourceCanvas.width = psd.width;
   sourceCanvas.height = psd.height;
   sourceCtx = sourceCanvas.getContext('2d');

   originalCanvas = cloneCanvas(sourceCanvas);
   originalCtx = originalCanvas.getContext('2d');

   baseImageData = null;
  }

  const added = [];

  function walk(layers,parent=''){
   (layers||[]).forEach(layer=>{
    if(layer.hidden)return;

    if(layer.children?.length){
     walk(layer.children,layer.name||parent);
     return;
    }

    const c = layer.canvas;

    if(!c || !c.width || !c.height)return;

    const left = Number.isFinite(layer.left)?layer.left:0;
    const top = Number.isFinite(layer.top)?layer.top:0;

    const name = (parent?parent+' / ':'')+
     (layer.name||'レイヤー '+(added.length+1));

    const p = {
     id:nextId++,
     name,
     data:canvasURL(c),
     x:left+c.width/2,
     y:top+c.height/2,
     w:c.width,
     h:c.height,
     scale:100,
     rotation:0,
     sway:4,
     speed:10,
     motion:'none',
     visible:true,
     phase:Math.random()*6.28,
     parentId:null
    };

    parts.push(p);
    added.push(p);
   });
  }

  parts = [];
  selectedId = null;
  nextId = 1;

  walk(psd.children||[]);

  if(!added.length){
   throw new Error('画像レイヤーが見つからなかったよ。PSDが統合画像だけの可能性もあるよ。');
  }

  $('hideBase').checked = true;

  selectedId = added[added.length-1].id;

  undoStack = [];
  redoStack = [];

  viewZoom = 1;
  viewPanX = 0;
  viewPanY = 0;
  artScale = 1;

  $('artScale').value = 100;

  calculateFit();
  updateZoomLabel();
  updatePartList();
  syncEditor();
  render();

  status(added.length+'個のレイヤーをパーツとして読み込んだよ！');

 }catch(err){
  console.error(err);
  status('PSDの読み込みに失敗：'+(err?.message||String(err)),'error');
 }
}

function brushAt(p){
 if(!sourceCanvas.width)return;

 const q = sourcePoint(p);
 const r = brushSize/2/fit.scale;

 if(!Number.isFinite(r))return;

 sourceCtx.save();
 sourceCtx.beginPath();
 sourceCtx.arc(q.x,q.y,r,0,Math.PI*2);
 sourceCtx.clip();

 if(mode==='erase'){
  sourceCtx.clearRect(q.x-r-1,q.y-r-1,r*2+2,r*2+2);
 }else{
  sourceCtx.drawImage(
   originalCanvas,
   q.x-r,q.y-r,r*2,r*2,
   q.x-r,q.y-r,r*2,r*2
  );
 }

 sourceCtx.restore();
 render();
}

/* ステージ操作 */
stage.addEventListener('pointerdown',e=>{
 const p = stagePoint(e);

 lastPointer = e;
 viewPointers.set(e.pointerId,p);

 stage.setPointerCapture(e.pointerId);

 if(mode==='normal'){
  if(viewPointers.size>=2){
   dragAction = null;

   const pts = [...viewPointers.values()];

   gesture = {
    distance:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y),
    zoom:viewZoom,
    mid:{
     x:(pts[0].x+pts[1].x)/2,
     y:(pts[0].y+pts[1].y)/2
    },
    panX:viewPanX,
    panY:viewPanY
   };

   return;
  }

  const current = selected();
  const handle = hitSelectedHandle(current,p);

  if(current && handle){
   const info = partScreenInfo(current);

   dragAction = {
    type:handle,
    id:current.id,
    start:p,
    center:{x:info.cx,y:info.cy},
    startDistance:Math.max(1,Math.hypot(p.x-info.cx,p.y-info.cy)),
    startAngle:Math.atan2(p.y-info.cy,p.x-info.cx),
    startScale:current.scale,
    startRotation:current.rotation
   };

   return;
  }

  const hit = hitPart(p);

  if(hit){
   selectedId = hit.id;

   updatePartList();
   syncEditor();

   const info = partScreenInfo(hit);

   dragAction = {
    type:'move',
    id:hit.id,
    start:p,
    startWorld:{x:info.wt.x,y:info.wt.y},
    startLocal:{x:hit.x,y:hit.y}
   };

   render();
   return;
  }

  dragAction = {
   type:'pan',
   last:p
  };

  gesture = {last:p};
  return;
 }

 if(viewPointers.size>=2)return;

 if(!sourceCanvas.width && ['rect','free','erase','restore'].includes(mode)){
  return;
 }

 if(mode==='rect'){
  startPoint = p;
  render();
  return;
 }

 if(mode==='free'){
  freePoints = [p];
  drawing = true;
  render();
  return;
 }

 if(mode==='erase' || mode==='restore'){
  saveUndo();
  drawing = true;
  brushAt(p);
 }
});

stage.addEventListener('pointermove',e=>{
 if(viewPointers.has(e.pointerId)){
  viewPointers.set(e.pointerId,stagePoint(e));
 }

 if(mode==='normal' && viewPointers.size){
  const pts = [...viewPointers.values()];

  if(pts.length>=2){
   dragAction = null;

   const mid = {
    x:(pts[0].x+pts[1].x)/2,
    y:(pts[0].y+pts[1].y)/2
   };

   if(!gesture || !gesture.distance){
    gesture = {
     distance:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y),
     zoom:viewZoom,
     mid,
     panX:viewPanX,
     panY:viewPanY
    };
   }

   const dist = Math.max(
    1,
    Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)
   );

   const ratio = dist/Math.max(1,gesture.distance);

   viewZoom = Math.max(.25,Math.min(5,gesture.zoom*ratio));

   viewPanX = gesture.panX+(mid.x-gesture.mid.x);
   viewPanY = gesture.panY+(mid.y-gesture.mid.y);

   updateZoomLabel();
   render();

  }else if(dragAction){
   const p = pts[0];
   const part = parts.find(q=>q.id===dragAction.id);

   if(dragAction.type==='pan'){
    viewPanX += p.x-dragAction.last.x;
    viewPanY += p.y-dragAction.last.y;
    dragAction.last = p;
    render();

   }else if(part && dragAction.type==='move'){
    const dx = (p.x-dragAction.start.x)/fit.scale;
    const dy = (p.y-dragAction.start.y)/fit.scale;

    worldToLocalPosition(
     part,
     dragAction.startWorld.x+dx,
     dragAction.startWorld.y+dy
    );

    syncEditor();
    render();

   }else if(part && dragAction.type==='scale'){
    const distance = Math.max(
     1,
     Math.hypot(p.x-dragAction.center.x,p.y-dragAction.center.y)
    );

    part.scale = Math.max(
     5,
     Math.min(800,dragAction.startScale*distance/dragAction.startDistance)
    );

    syncEditor();
    render();

   }else if(part && dragAction.type==='rotate'){
    const angle = Math.atan2(
     p.y-dragAction.center.y,
     p.x-dragAction.center.x
    );

    let delta = (angle-dragAction.startAngle)*180/Math.PI;

    if(delta>180)delta-=360;
    if(delta<-180)delta+=360;

    part.rotation = Math.max(
     -360,
     Math.min(360,dragAction.startRotation+delta)
    );

    syncEditor();
    render();
   }
  }

  return;
 }

 if(!drawing && mode!=='rect')return;

 lastPointer = e;

 const p = stagePoint(e);

 if(mode==='free'){
  freePoints.push(p);
  render();

 }else if(mode==='erase' || mode==='restore'){
  brushAt(p);

 }else if(mode==='rect'){
  render();
 }
});

function finishPointer(e){
 viewPointers.delete(e.pointerId);

 if(mode==='normal'){
  dragAction = null;
  gesture = null;
  return;
 }

 const p = stagePoint(e);

 if(mode==='rect' && startPoint){
  cropRect(startPoint,p);
  startPoint = null;
 }

 if(mode==='free' && drawing){
  cropFree(freePoints);
  freePoints = [];
 }

 drawing = false;
 lastPointer = null;

 render();
}

stage.addEventListener('pointerup',finishPointer);
stage.addEventListener('pointercancel',finishPointer);

/* ファイル読み込み */
$('imageFile').onchange = e=>{
 loadImageFile(e.target.files[0]);
 e.target.value = '';
};

$('psdFile').onchange = e=>{
 const f = e.target.files[0];

 if(!f){
  status('ファイルが選択されていないよ。');
  return;
 }

 status('PSDを選択：'+f.name);
 importPSD(f);
 e.target.value = '';
};

/* モード切り替え */
function setModeButtons(){
 const map = {
  rect:'cropMode',
  free:'freeCropMode',
  erase:'brushErase',
  restore:'brushRestore',
  normal:'brushOff'
 };

 [
  'cropMode',
  'freeCropMode',
  'brushErase',
  'brushRestore',
  'brushOff'
 ].forEach(id=>{
  $(id).classList.toggle('active',map[mode]===id);
 });
}

$('cropMode').onclick = ()=>{
 mode = mode==='rect'?'normal':'rect';
 freePoints = [];
 startPoint = null;
 setModeButtons();

 status(
  mode==='rect'
   ? 'ステージ上をドラッグして四角く切り出してね。'
   : '通常モード'
 );
};

$('freeCropMode').onclick = ()=>{
 mode = mode==='free'?'normal':'free';
 freePoints = [];
 setModeButtons();

 status(
  mode==='free'
   ? '指で輪郭をなぞって、指を離すと切り出すよ。'
   : '通常モード'
 );
};

$('brushErase').onclick = ()=>{
 mode = 'erase';
 setModeButtons();
};

$('brushRestore').onclick = ()=>{
 mode = 'restore';
 setModeButtons();
};

$('brushOff').onclick = ()=>{
 mode = 'normal';
 setModeButtons();
};

$('brushSize').oninput = e=>{
 brushSize = +e.target.value;
 $('brushValue').textContent = brushSize;
};

/* Undo / Redo */
$('undoEdit').onclick = async()=>{
 if(!undoStack.length)return;

 redoStack.push(canvasURL(sourceCanvas));

 await restoreCanvas(undoStack.pop());

 status('ひとつ戻したよ。');
};

$('redoEdit').onclick = async()=>{
 if(!redoStack.length)return;

 undoStack.push(canvasURL(sourceCanvas));

 await restoreCanvas(redoStack.pop());

 status('やり直したよ。');
};

/* 表示設定 */
$('hideBase').onchange = render;

$('animation').onchange = ()=>{
 if($('animation').checked){
  if(!raf){
   lastTick = 0;

   const tick = now=>{
    if(lastTick){
     motionTime += Math.min(.05,(now-lastTick)/1000);
    }

    lastTick = now;
    animFrame++;

    render();

    raf = requestAnimationFrame(tick);
   };

   raf = requestAnimationFrame(tick);
  }

 }else{
  if(raf)cancelAnimationFrame(raf);

  raf = null;
  lastTick = 0;

  render();
 }
};

$('zoomIn').onclick = ()=>setViewZoom(viewZoom*1.2);
$('zoomOut').onclick = ()=>setViewZoom(viewZoom/1.2);
$('fitView').onclick = fitView;
$('resetView').onclick = resetViewOnly;

$('artScale').oninput = e=>{
 artScale = +e.target.value/100;
 updateZoomLabel();
 render();
};

/* パーツ追加 */
$('addCircle').onclick = ()=>addShape('circle');
$('addRect').onclick = ()=>addShape('rect');

/* パーツ名 */
$('partName').oninput = e=>{
 const p = selected();

 if(p){
  p.name = e.target.value;

  updatePartList();

  const current = $('parentPart').value;

  syncEditor();

  $('parentPart').value = current;
 }
};

/* 動きの種類 */
$('motionType').onchange = e=>{
 const p = selected();

 if(p){
  p.motion = e.target.value;
  render();

  status(
   p.name+'の動きを設定したよ。アニメーションをONにして確認してね。'
  );
 }
};

/* 親パーツ */
$('parentPart').onchange = e=>{
 const p = selected();

 if(!p)return;

 setParent(p,e.target.value);

 syncEditor();
 updatePartList();
 render();

 status('親パーツを設定したよ。');
};

/* パーツ数値調整 */
['posX','posY','scale','rotation','sway','speed'].forEach(id=>{
 $(id).oninput = e=>{
  const p = selected();

  if(!p)return;

  const v = +e.target.value;

  if(id==='posX'){
   p.x = v-300;
  }else if(id==='posY'){
   p.y = v-300;
  }else{
   p[id] = v;
  }

  updateValues();
  render();
 };
});

/* 表示切り替え */
$('togglePart').onclick = ()=>{
 const p = selected();

 if(p){
  p.visible = !p.visible;
  updatePartList();
  render();
 }
};

/* 複製ボタン */
$('duplicatePart').onclick = duplicateSelectedPart;

/* 削除ボタン */
$('deletePart').onclick = ()=>{
 const p = selected();

 if(!p)return;

 const removedId = p.id;

 parts.forEach(child=>{
  if(child.parentId===removedId){
   const wt = getWorldTransform(child);

   child.x = wt.x;
   child.y = wt.y;
   child.scale = wt.scale;
   child.rotation = wt.rotation;
   child.parentId = null;
  }
 });

 parts = parts.filter(q=>q.id!==removedId);

 selectedId = parts.length
  ? parts[parts.length-1].id
  : null;

 updatePartList();
 syncEditor();
 render();

 status('パーツを削除したよ。子パーツはその場に残したよ。');
};

/* JSON保存 */
$('saveProject').onclick = ()=>{
 try{
  const data = {
   version:8,
   base:baseImageData,
   parts:parts.map(({img,...p})=>p),
   nextId,
   artScale
  };

  downloadBlob(
   new Blob([JSON.stringify(data)],{type:'application/json'}),
   'mini-live2d-project.json'
  );

  status('プロジェクトを保存したよ。');

 }catch(e){
  status('保存できなかったよ：'+e.message,'error');
 }
};

/* JSON読み込み */
$('loadProject').onchange = async e=>{
 const f = e.target.files[0];

 if(!f)return;

 try{
  const data = JSON.parse(await f.text());

  parts = (data.parts||[]).map(p=>({
   ...p,
   motion:p.motion||'none',
   parentId:p.parentId??null,
   img:null
  }));

  nextId = data.nextId ||
   Math.max(0,...parts.map(p=>p.id))+1;

  artScale = data.artScale||1;

  $('artScale').value = Math.round(artScale*100);

  viewZoom = 1;
  viewPanX = 0;
  viewPanY = 0;

  updateZoomLabel();

  selectedId = parts.length
   ? parts[parts.length-1].id
   : null;

  baseImageData = data.base||null;

  if(data.base){
   const im = await imageFromURL(data.base);

   sourceCanvas.width = im.width;
   sourceCanvas.height = im.height;

   sourceCtx = sourceCanvas.getContext('2d');
   sourceCtx.drawImage(im,0,0);

   originalCanvas = cloneCanvas(sourceCanvas);
   originalCtx = originalCanvas.getContext('2d');

  }else{
   sourceCanvas.width = 0;
   sourceCanvas.height = 0;
  }

  collapsedParts.clear();

  updatePartList();
  syncEditor();
  render();

  status('プロジェクトを読み込んだよ。');

 }catch(err){
  status(
   'JSONを読み込めなかったよ：'+(err.message||String(err)),
   'error'
  );
 }

 e.target.value = '';
};

/* PNG書き出し */
$('downloadImage').onclick = ()=>{
 const out = document.createElement('canvas');

 out.width = W;
 out.height = H;

 const oc = out.getContext('2d');

 oc.drawImage(stage,0,0);

 out.toBlob(b=>{
  downloadBlob(b,'mini-live2d.png');
 });
};

/* 初期化 */
calculateFit();
updateZoomLabel();
render();
updatePartList();
syncEditor();

status('準備完了。画像またはPSDを読み込んでね。通常モードで指1本移動・2本指ズームができるよ。');

})();
