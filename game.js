import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

// NEXUS: Office Hustle — original, lightweight browser prototype.
const root = document.querySelector('#game-root');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eb7c9);
scene.fog = new THREE.Fog(0x9eb7c9, 13, 29);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 70);
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe7f3ff, 0x59636d, 2.0));
const sun = new THREE.DirectionalLight(0xffedcf, 2.2);
sun.position.set(-5, 10, 7); scene.add(sun);

const mat = (color, roughness=0.85) => new THREE.MeshStandardMaterial({color, roughness});
const mats = {
  floor:mat(0x8a9aa6), wall:mat(0xdce4e8), dark:mat(0x263649), desk:mat(0x9b7555),
  metal:mat(0x46566a), screen:mat(0x4fd5b0), chair:mat(0x334b65), skin:mat(0xd5a17c),
  shirt:mat(0x2d6f75), pants:mat(0x283344), white:mat(0xf1f4f6), plant:mat(0x387f62)
};
function block(name, x,y,z, sx,sy,sz, material, parent=scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), material);
  mesh.name=name; mesh.position.set(x,y,z); mesh.castShadow=false; mesh.receiveShadow=false; parent.add(mesh); return mesh;
}
// Room shell: open front keeps the office readable on small screens.
block('floor',0,-.18,0,18,.35,18,mats.floor);
block('back wall',0,2,-9,18,4,.25,mats.wall);
block('left wall',-9,2,0,.25,4,18,mats.wall);
block('right wall',9,2,0,.25,4,18,mats.wall);
for(let i=-7;i<=7;i+=3.5) {
  block('window',i,2.5,-8.84,2.5,1.8,.035,mat(0x7fb9d4));
  block('window divider',i,2.5,-8.80,.06,1.85,.06,mats.white);
}
block('back trim',0,.12,-8.7,17.5,.12,.15,mat(0x9fb2bd));

// Desks and original workstation props.
const desks=[];
for (const [x,z] of [[-3,-3],[2,-3],[5,1]]) {
  block('desk top',x,.95,z,2.15,.16,1.15,mats.desk);
  for(const dx of [-.88,.88]) block('desk leg',x+dx,.43,z,.12,.88,.12,mats.metal);
  block('monitor base',x,.11+1.03,z-.27,.48,.07,.32,mats.metal);
  const monitor=block('computer',x,1.48,z-.35,.88,.64,.12,mats.dark);
  block('screen',x,1.49,z-.278,.73,.47,.025,mats.screen);
  block('keyboard',x,1.055,z+.12,.65,.035,.22,mats.metal);
  block('chair seat',x,.55,z+1,.72,.15,.7,mats.chair);
  block('chair back',x,.98,z+1.3,.72,.72,.12,mats.chair);
  desks.push({x,z,monitor});
}
// Plants, cabinet, lights, and simple wall decoration.
for(const [x,z] of [[-7,-6],[7,-6],[-7,5],[7,5]]) {
  block('plant pot',x,.28,z,.55,.55,.55,mat(0x9b6848));
  const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(.48,0),mats.plant);
  leaves.position.set(x,.88,z); scene.add(leaves);
}
block('cabinet',-6,.75,-2,1.1,1.5,.7,mats.metal);
block('cabinet handle',-5.42,.8,-1.62,.04,.25,.04,mats.white);
block('wall sign',0,2.8,-8.65,2.5,.55,.08,mats.dark);
block('sign accent',0,2.8,-8.59,1.85,.08,.035,mats.screen);

// Low-poly player built from basic meshes.
const player=new THREE.Group(); scene.add(player);
const body=block('player body',0,1.03,0,.58,.72,.34,mats.shirt,player);
const head=new THREE.Mesh(new THREE.SphereGeometry(.23,10,8),mats.skin); head.position.y=1.57; player.add(head);
block('player hair',0,1.75,0,.4,.12,.37,mats.dark,player);
for(const x of [-.17,.17]) block('player leg',x,.43,0,.19,.55,.22,mats.pants,player);
for(const x of [-.39,.39]) block('player arm',x,1.05,0,.16,.58,.19,mats.shirt,player);
player.position.set(0,0,4.7);
let facing=0;

const $=s=>document.querySelector(s);
let money=0, seconds=120, completed=0, taskIndex=0, panelOpen=false, ended=false;
const tasks=[
 {title:'Pembaruan data inventaris',message:'Tolong cocokkan jumlah barang di daftar hari ini.',pay:35},
 {title:'Jadwal ruang rapat',message:'Ada dua rapat bertabrakan. Susun ulang jadwal ruang rapat.',pay:45},
 {title:'Laporan pelanggan',message:'Ringkas tiga masukan pelanggan menjadi laporan singkat.',pay:40},
 {title:'Pengecekan dokumen',message:'Periksa apakah dokumen proyek sudah lengkap.',pay:55},
 {title:'Rekap pengiriman',message:'Cocokkan daftar paket dengan catatan pengiriman.',pay:50}
];
const moneyEl=$('#money'), timerEl=$('#timer'), objective=$('#objective'), hint=$('#hint');
function updateMoney(){moneyEl.textContent=money;$('#panel-money').textContent=money}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),2200)}
function currentTask(){return tasks[taskIndex%tasks.length]}
function showTask(){const t=currentTask();$('#client-label').textContent=`PESAN MASUK · #${String(taskIndex+1).padStart(3,'0')}`;$('#client-title').textContent=t.title;$('#client-message').textContent=t.message;$('#task-result').textContent=''}
function setPanel(open){panelOpen=open;$('#computer-panel').classList.toggle('hidden',!open);if(open)showTask();hint.textContent=open?'Kerjakan tugas atau tutup panel.':''}
$('#close-panel').onclick=()=>setPanel(false);
$('#accept-task').onclick=()=>{
 if(ended)return;
 const t=currentTask(); money+=t.pay;completed++;taskIndex++;updateMoney();showTask();
 $('#task-result').textContent=`Tugas selesai! +${t.pay} kredit virtual.`;
 objective.textContent=`Pendapatan: ${money}/200 kredit · Tugas selesai: ${completed}`;
 if(money>=200){objective.textContent='Target pendapatan harian tercapai!';toast('Target tercapai — lanjutkan sampai shift selesai.')}
};
$('#skip-task').onclick=()=>{taskIndex++;showTask();$('#task-result').textContent='Tugas dilewati. Tidak ada perubahan saldo.'};

// Touch joystick and keyboard fallback.
const joy=$('#joystick'), stick=$('#stick');
let inputX=0,inputY=0,joyActive=false,joyCenter={x:0,y:0};
function joyStart(e){e.preventDefault();joyActive=true;const r=joy.getBoundingClientRect();joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};joyMove(e)}
function joyMove(e){if(!joyActive)return;const p=e.touches?e.touches[0]:e;let dx=p.clientX-joyCenter.x,dy=p.clientY-joyCenter.y;const max=34,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}inputX=dx/max;inputY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
function joyEnd(){joyActive=false;inputX=0;inputY=0;stick.style.transform='translate(0,0)'}
joy.addEventListener('touchstart',joyStart,{passive:false});window.addEventListener('touchmove',joyMove,{passive:false});window.addEventListener('touchend',joyEnd);window.addEventListener('touchcancel',joyEnd);
let keys={};window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key==='e'||e.key==='Enter')interact()});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function nearDesk(){let best=null,dist=Infinity;for(const d of desks){const dd=Math.hypot(player.position.x-d.x,player.position.z-(d.z+1.1));if(dd<dist){dist=dd;best=d}}return dist<1.75?best:null}
function interact(){if(ended)return;if(panelOpen){setPanel(false);return}const d=nearDesk();if(d){setPanel(true)}else toast('Dekati kursi/meja sampai tombol interaksi aktif.')}
$('#interact').onclick=interact;

const clock=new THREE.Clock();
function tick(){
 requestAnimationFrame(tick);
 const dt=Math.min(clock.getDelta(),.04);
 if(!ended){
   seconds-=dt;
   if(seconds<=0){seconds=0;ended=true;$('#end-panel').classList.remove('hidden');$('#summary').textContent=`Kamu menyelesaikan ${completed} tugas dan memperoleh ${money} kredit virtual. Target harian: 200 kredit.`}
   const mins=Math.floor(seconds/60),secs=Math.floor(seconds%60);timerEl.textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
   if(!panelOpen){
    let x=inputX,z=inputY;
    if(keys.a||keys.arrowleft)x-=1;if(keys.d||keys.arrowright)x+=1;if(keys.w||keys.arrowup)z-=1;if(keys.s||keys.arrowdown)z+=1;
    const len=Math.hypot(x,z);if(len>1){x/=len;z/=len}
    const speed=3.2;
    if(len>.08){player.position.x+=x*speed*dt;player.position.z+=z*speed*dt;facing=Math.atan2(x,z);player.rotation.y=facing}
    player.position.x=THREE.MathUtils.clamp(player.position.x,-7.8,7.8);
    player.position.z=THREE.MathUtils.clamp(player.position.z,-7.8,7.8);
   }
   const d=nearDesk();$('#interact').disabled=!d||panelOpen;$('#interact').textContent=panelOpen?'SEDANG BEKERJA':d?'GUNAKAN PC':'INTERAKSI';
   if(d&&!panelOpen)hint.textContent='Dekat komputer — tekan GUNAKAN PC';
   else if(!panelOpen)hint.textContent='Joystick untuk bergerak · WASD juga tersedia';
   // Camera follows behind player, with a little overhead angle.
   const desired=new THREE.Vector3(player.position.x,player.position.y+5.2,player.position.z+7.4);
   camera.position.lerp(desired,1-Math.pow(.001,dt));
   camera.lookAt(player.position.x,player.position.y+0.65,player.position.z-1.2);
 }
 renderer.render(scene,camera);
}
$('#restart').onclick=()=>location.reload();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5))});
updateMoney();tick();
