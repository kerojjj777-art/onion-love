import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, remove, onDisconnect, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC266DIMj81hWMk83GEmqSbBl85VY3tTcE", authDomain: "onion-love.firebaseapp.com",
  databaseURL: "https://onion-love-default-rtdb.firebaseio.com", projectId: "onion-love",
  storageBucket: "onion-love.firebasestorage.app", messagingSenderId: "431036248901",
  appId: "1:431036248901:web:533465a08cfa8410f7c42c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);         

window.GameLogic = {
    currentUser: null, currentScene: "doghouse",
    myProfile: { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0, level: 1, exp: 0, coins: 0, sweeps: 0, lastX: 640, lastY: 360, lastScene: "doghouse", currentTrackIdx: 0, inventoryOrder: [] },
    cafePlayers: {}, onlinePlayers: {}, cafeFurniture: {}, doghouseFurniture: {}, shrinePlayers: {}, shrineFurniture: {}, shrineEventData: null, unreadPMs: {}, placingFurnitureKey: null, 
    phaserGame: null, phaserLoaded: false, pendingScene: null, db: db,
    armedItemState: null, armedItemName: null, currentTargetUid: null, currentTargetSprite: null, currentTargetType: null, muteSFX: false, currentTrackIdx: 0, inventoryEditMode: false,
    shrineRitualActive: false // 新增：用於判斷神龕儀式是否啟動
};

let cafeUnsubscribe = null, shrineUnsubscribe = null, shrineEventUnsubscribe = null, profileViewingUid = null;
window.switchScene = switchScene; window.showProfileModal = showProfileModal; window.leaveCafe = leaveCafe; window.signOut = signOut; window.auth = auth;

window.openFullscreen = function(src) {
    if (!src || src.endsWith('null') || src === '') return;
    document.getElementById('fullscreen-img').src = src; document.getElementById('fullscreen-viewer').style.display = 'flex';
};
window.closeFullscreen = function() { document.getElementById('fullscreen-viewer').style.display = 'none'; };

window.updateBGMVolume = function(val) {
    let volText = document.getElementById('bgm-vol-text');
    if(volText) volText.innerText = val + '%';
    if (window.GameLogic.phaserGame) {
        let playlist = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire', 'shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success'];
        playlist.forEach(k => {
            let sndList = window.GameLogic.phaserGame.sound.getAll(k);
            sndList.forEach(snd => snd.setVolume(val / 100));
        });
    }
};

window.updateSFXVolume = function(val) {
    window.GameLogic.sfxVolume = val;
    window.GameLogic.muteSFX = (val == 0);
    let volText = document.getElementById('sfx-vol-text');
    if(volText) volText.innerText = val + '%';
    
    if (window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) {
            let loopSFXs = ['onion-sleep', 'mimi-walk', 'brooming1'];
            let actualVol = val / 100;
            loopSFXs.forEach(k => {
                let sndList = ms.sound.getAll(k);
                sndList.forEach(snd => snd.setVolume(actualVol));
            });
        }
    }
};

// 新增：強制開啟音效與恢復音量的邏輯
window.forceAudioNormal = function() {
    window.GameLogic.muteSFX = false;
    window.GameLogic.sfxVolume = 100;
    let sfxVolControl = document.getElementById('sfx-volume');
    if (sfxVolControl) { sfxVolControl.value = 100; window.updateSFXVolume(100); }
    let volControl = document.getElementById('bgm-volume');
    if (volControl && volControl.value < 50) {
        volControl.value = 100; window.updateBGMVolume(100);
    } else if (!volControl) {
        window.updateBGMVolume(100);
    }
};

window.playSFX = function(scene, key) {
    if (window.GameLogic.muteSFX) return;
    let vol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 50) / 100;
    if (vol <= 0) return;
    let snd = scene.sound.get(key);
    if (snd) { snd.setVolume(vol); snd.play(); }
    else scene.sound.add(key, { volume: vol }).play();
};

window.changeTrack = function(dir) {
    let playlist = [{ key: 'bgm', title: 'Sweet-Onion', cover: 'Sweet-Onion.png' }, { key: 'bgm-heart', title: '洋蔥心', cover: 'Onion-Heart.png' }, { key: 'bgm-inside', title: 'Inside-of-Onion', cover: 'Inside-of-Onion.png' }, { key: 'bgm-kyo', title: '귀엽다!귀엽다!Onion!', cover: 'kyo-kyo-onion.png' }, { key: 'bgm-world', title: '世界他會自己轉動', cover: "OMusic-World'll-roll.png" }, { key: 'bgm-lazy', title: 'Onion Lazy Cat', cover: 'OMusic-Onion-Lazy-Cat.png' }, { key: 'bgm-way', title: '洋蔥滾動自己路', cover: 'OMusic-Onion-go-my-way.png' }, { key: 'bgm-corazon', title: 'Onion acre Corazón', cover: 'OMusic-Onion-acre-Corazon.png' }, { key: 'bgm-fire', title: '烈艷洋蔥', cover: 'OMusic-Onion-Got-Fire.png' }];
    window.GameLogic.currentTrackIdx = ((window.GameLogic.currentTrackIdx || 0) + dir + playlist.length) % playlist.length;
    let track = playlist[window.GameLogic.currentTrackIdx];
    document.getElementById('music-cover').src = track.cover; document.getElementById('music-title').innerText = track.title;
    if (window.GameLogic.currentUser) update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { currentTrackIdx: window.GameLogic.currentTrackIdx });
    // 修正5：只要在神龕場景內，就強制阻斷切換音樂的功能
    if (window.GameLogic.phaserGame && window.GameLogic.currentScene !== 'shrine') {
        let vol = document.getElementById('bgm-volume') ? document.getElementById('bgm-volume').value / 100 : 0.5;
        ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'].forEach(k => window.GameLogic.phaserGame.sound.removeByKey(k));
        window.GameLogic.phaserGame.sound.add(track.key, { loop: true, volume: vol }).play();
    }
};
window.prevTrack = () => window.changeTrack(-1); window.nextTrack = () => window.changeTrack(1);

window.closeProfileModal = function() {
    document.getElementById('view-profile-modal').style.display = 'none';
    if (profileViewingUid && profileViewingUid !== window.GameLogic.currentUser.uid) document.getElementById('phone-modal').style.display = 'block';
};
window.openPortalModal = function() { document.getElementById('inventory-modal').style.display = 'none'; document.getElementById('portal-modal').style.display = 'block'; };

// 新增：空間傳送門點擊時的粒子噴發效果
window.popPortalParticles = function(e) {
    let x = e.clientX; let y = e.clientY;
    for(let i=0; i<12; i++) {
        let p = document.createElement('div');
        p.style.cssText = `position:fixed; width:6px; height:6px; background:#fff; border-radius:50%; left:${x}px; top:${y}px; pointer-events:none; z-index:9999; transition: all 0.4s cubic-bezier(0.1, 0.8, 0.3, 1); transform: translate(-50%, -50%); box-shadow: 0 0 8px #fff, 0 0 15px #d8bfd8;`;
        document.body.appendChild(p);
        setTimeout(() => {
            let angle = Math.random() * Math.PI * 2; let dist = Math.random() * 60 + 20;
            p.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`;
            p.style.opacity = 0;
        }, 10);
        setTimeout(() => p.remove(), 400);
    }
};

function createSystemUI() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;
    appContainer.innerHTML = `
        <style>
            .action-menu { display: none; position: absolute; background: var(--mucha-paper); border: 2px solid var(--mucha-gold); border-radius: 8px; z-index: 200; padding: 5px; box-shadow: 0 4px 8px rgba(0,0,0,0.5); flex-direction: column; }
            .action-menu button { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; color: var(--mucha-brown); padding: 8px 12px; }
            .action-menu button:hover { background: rgba(197, 160, 89, 0.2); }
            #login-screen { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mucha-paper); padding: 30px; border: 3px solid var(--mucha-gold); border-radius: 12px; z-index: 300; text-align: center; width: 80%; max-width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
            #login-screen input { padding: 10px; border: 1px solid var(--mucha-gold); border-radius: 4px; background: #fffdf5; margin-bottom: 15px; width: 85%; font-size: 16px; }
            #join-btn { background: var(--mucha-gold); color: white; border: none; padding: 12px 20px; border-radius: 4px; cursor: pointer; font-size: 16px; width: 95%; }
            .modal { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mucha-paper); padding: 20px; border: 3px solid var(--mucha-gold); border-radius: 12px; z-index: 250; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.8); width: 85%; max-width: 320px; max-height: 80vh; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; }
            .modal h3 { color: var(--mucha-green); margin-top: 0; border-bottom: 1px solid var(--mucha-gold); padding-bottom: 8px; }
            .modal-btns { display: flex; justify-content: space-around; margin-top: 15px; }
            .modal-btns button, .close-modal-btn { padding: 10px 15px; border-radius: 4px; border: none; cursor: pointer; font-family: inherit; font-size: 15px; margin: 5px;}
            .btn-primary { background: var(--mucha-gold); color: white; } .btn-secondary { background: #ccc; color: #333; } .btn-edit { background: var(--mucha-green); color: white; } .btn-danger { background: #d9534f; color: white; }
            .profile-line { display: flex; align-items: center; justify-content: space-between; margin: 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;}
            .profile-line input { width: 60%; padding: 5px; border: 1px solid var(--mucha-gold); border-radius: 4px; font-family: inherit;}
            .stats-container { display: flex; justify-content: space-between; background: rgba(197, 160, 89, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 14px;}
            #memory-feed { display: flex; flex-direction: column; gap: 15px; margin-top: 15px; text-align: left; }
            .memory-card { background: #fff; border: 1px solid var(--mucha-gold); border-radius: 8px; padding: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); position: relative;}
            .memory-card img { width: 100%; border-radius: 4px; margin-bottom: 8px; }
            .memory-card .author { font-size: 12px; color: var(--mucha-gold); font-weight: bold; margin-bottom: 4px; }
            .memory-card .text { font-size: 14px; color: var(--mucha-brown); }
            .memory-card .del-btn { position: absolute; top: 5px; right: 5px; background: #d9534f; color: white; border: none; border-radius: 4px; padding: 3px 8px; font-size: 12px; cursor: pointer;}
            #memory-upload-area { margin-top: 15px; display: flex; flex-direction: column; gap: 10px; border-top: 2px dashed var(--mucha-gold); padding-top: 15px; }
            #memory-upload-area input[type="text"] { padding: 10px; border: 1px solid var(--mucha-gold); border-radius: 4px; }
            .catalog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .catalog-item { padding: 8px 5px; border: 1px solid var(--mucha-gold); border-radius: 8px; background: #fff; cursor: pointer; font-weight: bold; display: flex; flex-direction: column; align-items: center; transition: all 0.3s; font-size: 13px; }
            .catalog-item:hover { background: rgba(197, 160, 89, 0.2); }
            .catalog-item img { width: 50px; height: 50px; margin-bottom: 5px; object-fit: contain;}
            #chat-section { display: flex; position: absolute; top: 60px; left: 10px; width: 190px; flex-direction: column; z-index: 100; pointer-events: none; }
            #chat-toggle-btn { pointer-events: auto; background: var(--mucha-gold); color: white; border: none; border-radius: 8px 8px 0 0; padding: 5px 12px; width: fit-content; cursor: pointer; font-size: 12px; font-weight: bold; box-shadow: 0 -2px 5px rgba(0,0,0,0.2);}
            #chat-content { pointer-events: auto; transition: max-height 0.3s ease-in-out; overflow: hidden; display: flex; flex-direction: column; background: rgba(0, 0, 0, 0.6); border-radius: 0 8px 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
            #chat-box { max-height: 120px; overflow-y: auto; color: #fff; padding: 10px; font-size: 13px; text-shadow: 1px 1px 2px #000; }            
            #chat-input-area { display: flex; height: 35px; border-top: 1px solid rgba(255, 255, 255, 0.2); }
            #chat-input { flex-grow: 1; padding: 5px 10px; border: none; border-radius: 0 0 0 8px; font-family: inherit; font-size: 13px; background: rgba(255, 255, 255, 0.9); outline: none; color: #333; }
            #send-btn { padding: 5px 15px; background: var(--mucha-gold); color: white; border: none; border-radius: 0 0 8px 0; font-family: inherit; font-weight: bold; cursor: pointer; transition: 0.2s;}
            .chat-collapsed #chat-content { max-height: 0px !important; border: none; box-shadow: none; }
            #top-notification-bar { position: fixed; top: 0; left: 0; width: 100%; padding: 8px 0; background: rgba(0, 0, 0, 0.6); color: #fff; text-align: center; font-size: 14px; z-index: 500; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 2px #000; letter-spacing: 1px; }
            #online-players-container { position: fixed; right: 0px; top: 220px; z-index: 150; display: flex; align-items: flex-start; }
            #online-toggle-btn { pointer-events: auto; background: var(--mucha-gold); color: white; border: none; border-radius: 8px 0 0 8px; padding: 10px 8px; cursor: pointer; font-size: 18px; box-shadow: -2px 0 5px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transition: background 0.3s;}
            #online-list-wrapper { overflow: hidden; transition: max-width 0.3s ease-in-out; max-width: 250px; }
            .online-collapsed #online-list-wrapper { max-width: 0px; }
            #online-players-list { background: rgba(0,0,0,0.6); padding: 8px 15px; border-radius: 0 0 0 8px; color: white; font-size: 13px; border: 1px solid var(--mucha-gold); border-right: none; pointer-events: none; min-width: 80px; text-shadow: 1px 1px 2px #000; white-space: nowrap; }
            @keyframes energySpark { 0% { box-shadow: inset 0 0 5px yellow, 0 0 5px white; } 50% { box-shadow: inset 0 0 15px yellow, 0 0 10px white; } 100% { box-shadow: inset 0 0 5px yellow, 0 0 5px white; } }
            .energy-bar-spark { animation: energySpark 1s infinite; }
            .sprite-waterball { width: 50px; height: 50px; background: url('shop-water-ball.png') left center; animation: play-waterball 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-onion-phone { width: 50px; height: 50px; background: url('tool-onion-phone.png') left center; animation: play-onion-phone 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-magic-gap { width: 50px; height: 50px; background: url('magic-gap.png') left center; animation: play-magic-gap 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-music-box { width: 50px; height: 50px; background: url('music-box.png') left center; animation: play-music-box 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-magic-gap-big { width: 300px; height: 300px; background: url('magic-gap-big.png') left center; animation: play-magic-gap-big 0.8s steps(8) infinite; margin: -45px auto; display: block; transform: scale(0.75); }
            @keyframes play-waterball { 100% { background-position: -400px; } } @keyframes play-onion-phone { 100% { background-position: -400px; } } @keyframes play-magic-gap { 100% { background-position: -400px; } } @keyframes play-music-box { 100% { background-position: -400px; } } @keyframes play-magic-gap-big { 100% { background-position: -2400px; } }
            @keyframes play-sleep-charger { 100% { background-position: -720px; } }
            .sprite-sleep-charger { width: 90px; height: 90px; background: url('sleep_onion_bao_charger.png') left center; animation: play-sleep-charger 0.8s steps(8) infinite; margin: 0 auto 10px auto; }
            @keyframes flash-orange { 0% { transform: translate(-50%, -50%) scale(1); text-shadow: 0 0 10px orange; opacity: 1; } 50% { transform: translate(-50%, -50%) scale(1.2); text-shadow: 0 0 30px #ffcc00, 0 0 50px orange; opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); text-shadow: 0 0 10px orange; opacity: 0; } } .flash-text { animation: flash-orange 2s ease-out forwards; }
            @keyframes shake-gold { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } } .shake-gold-text { animation: shake-gold 0.5s infinite; }
            .purple-fire-border { border: 3px solid #9400d3; animation: purpleFire 1.5s infinite alternate; }
            @keyframes purpleFire { 0% { border-color: #8a2be2; } 100% { border-color: #ff00ff; } }
            .vote-item { padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
            .vote-item:hover { background: rgba(255,255,255,0.2); } .vote-item.selected { background: rgba(138, 43, 226, 0.5); border: 1px solid #ff00ff; }
            #spam-btn:active { transform: scale(0.9); }
            #pm-chat-box { height: 250px; overflow-y: auto; background: #fffdf5; border: 1px solid var(--mucha-gold); border-radius: 4px; padding: 10px; margin-bottom: 10px; display: flex; flex-direction: column; font-size: 14px;}
            .pm-bubble-me { background: #fff; color: #3e2723; border-radius: 12px 12px 0 12px; padding: 8px 12px; display: inline-block; max-width: 80%; text-align: left; border: 1px solid var(--mucha-gold); box-shadow: 1px 1px 3px rgba(0,0,0,0.1); word-break: break-word; }
            .pm-bubble-other { background: #dcedc8; color: #3e2723; border-radius: 12px 12px 12px 0; padding: 8px 12px; display: inline-block; max-width: 80%; text-align: left; border: 1px solid #aed581; box-shadow: 1px 1px 3px rgba(0,0,0,0.1); word-break: break-word; }
            .magic-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 5px; min-height: 250px; }
            .magic-slot { border: 2px solid var(--mucha-gold); border-radius: 8px; background: rgba(255,255,255,0.5); display: flex; justify-content: center; align-items: center; cursor: pointer; position: relative; }
            .magic-slot:hover { background: rgba(197, 160, 89, 0.3); }
            .magic-qty { position: absolute; bottom: 2px; right: 5px; font-size: 12px; font-weight: bold; color: var(--mucha-brown); }
            #quick-select-menu { display: none; position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%); width: 300px; background: rgba(0, 15, 30, 0.4); border: 1px solid rgba(135,206,235,0.3); border-radius: 20px; padding: 15px 5px; z-index: 300; flex-direction: column; align-items: center; box-shadow: 0 0 20px rgba(0, 191, 255, 0.3); pointer-events: auto; touch-action: pan-x; }
            #quick-items-container { display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; gap: 15px; width: 100%; padding: 15px 10px; box-sizing: border-box; scrollbar-width: none; align-items: center; }
            #quick-items-container::-webkit-scrollbar { display: none; }
            .quick-item { flex: 0 0 60px; height: 60px; border: none; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; background: rgba(255,255,255,0.8); position: relative; transition: 0.3s; scroll-snap-align: center; box-shadow: 0 0 10px rgba(135,206,235,0.5); }
            .quick-item.staged { transform: scale(1.35); box-shadow: 0 0 20px rgba(255,255,255,1), 0 0 15px rgba(0,191,255,0.8); background: #fff; z-index: 10; }
            
            .quick-item.staged { transform: scale(1.35); box-shadow: 0 0 20px rgba(255,255,255,1), 0 0 15px rgba(0,191,255,0.8); background: #fff; z-index: 10; }
            
            /* 新增：洋蔥手機 Modal 特效 */
            #phone-modal { background: #b8860b !important; border: 4px solid #885500 !important; box-shadow: inset 0 0 30px #553300 !important; }
            .phone-contact { background: #222 !important; color: #fff !important; border: 2px solid #555 !important; border-radius: 8px; animation: screen-breathe 2.5s infinite alternate; }
            @keyframes screen-breathe { 0% { box-shadow: inset 0 0 5px #fff, 0 0 5px #fff; } 100% { box-shadow: inset 0 0 15px #aaa, 0 0 20px #fff; } }

            /* 新增：空間傳送門 Modal 特效 */
            #portal-modal { background: #1a0033 !important; border-radius: 140px / 200px !important; border: 4px solid #4b0082 !important; box-shadow: inset 0 0 50px #000, 0 0 20px #8a2be2 !important; overflow: hidden; }
            .portal-particle { position: absolute; border-radius: 50%; }
            @keyframes portal-spin { 100% { transform: rotate(360deg); } }
            @keyframes portal-btn-glow { 0% { box-shadow: 0 0 5px #fff, 0 0 10px #fff; } 50% { box-shadow: 0 0 15px #fff, 0 0 25px #00ffff; } 100% { box-shadow: 0 0 5px #fff, 0 0 10px #fff; } }
            .portal-btn-style { background: #fff !important; color: #000 !important; font-weight: bold; text-shadow: 0 0 5px #aaa, 0 0 8px #000; animation: portal-btn-glow 2.5s infinite ease-in-out; border: none !important; border-radius: 20px; transition: transform 0.2s; cursor: pointer; }
            .portal-btn-style:active { transform: scale(0.95); }
            
            /* 新增：蔥Music Modal 復古特效 */
            #settings-modal { background: #8b0000 !important; border-radius: 12px !important; border: 4px solid #ffd700 !important; box-shadow: inset 0 0 30px #4a0000, 0 0 20px rgba(255,215,0,0.6) !important; overflow: hidden; }
            .visualizer-bar { position: absolute; bottom: 0; width: 10%; background: rgba(255,215,0,0.4); border-top: 3px solid #ffd700; animation: bounce-bar 0.5s infinite alternate ease-in; z-index: 0; pointer-events: none; }
            @keyframes bounce-bar { 0% { height: 10%; } 100% { height: 75%; } }
            
            /* 新增：蔥電飽 Modal 特效 */
            #energy-modal { background: #051a05 !important; border: 2px solid #00ff00 !important; box-shadow: 0 0 20px #00ff00, inset 0 0 30px #003300 !important; color: #ccffcc; overflow: hidden; }
            .electric-border { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: conic-gradient(transparent, transparent, transparent, #00ff00); animation: electric-spin 2s linear infinite; opacity: 0.5; z-index: 0; pointer-events: none; }
            .electric-inner { position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; background: #051a05; border-radius: 8px; z-index: 0; pointer-events: none; }
            @keyframes electric-spin { 100% { transform: rotate(360deg); } }
            
            /* 新增：法寶庫存 Modal 特效 */
            #magic-modal { background: linear-gradient(180deg, #02111d 0%, #003a5e 100%) !important; border: 2px solid #0088cc !important; box-shadow: inset 0 0 30px #00aaff !important; overflow: hidden; }
            .water-drop { position: absolute; width: 3px; height: 15px; background: linear-gradient(to bottom, transparent, rgba(135,206,235,0.8)); border-radius: 50%; animation: drip linear infinite; pointer-events:none; z-index:0;}
            @keyframes drip { 0% { transform: translateY(-30px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(300px); opacity: 0; } }
        </style>

        <div id="energy-modal" class="modal" style="z-index: 260; position: relative; padding: 25px;">
            <div class="electric-border"></div><div class="electric-inner"></div>
            <div style="position: relative; z-index: 1;">
                <h3 style="color:#00ff00; margin-top:0; text-shadow: 0 0 5px #00ff00;">🔋 蔥電飽</h3>
                <div class="sprite-sleep-charger" style="filter: drop-shadow(0 0 5px #00ff00);"></div>
                <div style="margin-bottom:10px; color:#ccffcc; font-weight:bold; font-size:14px; text-shadow: 0 0 3px #00ff00;">當前體力</div>
                <div style="position:relative; width:90%; height:24px; background:#001a00; border-radius:12px; margin:0 auto; overflow:hidden; border:2px solid #00ff00; box-shadow: 0 0 10px #00ff00;">
                    <div id="energy-modal-bar" class="energy-bar-spark" style="position:absolute; top:0; left:0; width:0%; height:100%; background:linear-gradient(90deg, #00cc00, #00ff00); transition: width 0.3s; box-shadow: 0 0 10px #00ff00;"></div>
                </div>
                <div id="energy-modal-text" style="font-weight:bold; color:#00ff00; margin-top:5px; font-size:18px; text-shadow: 0 0 5px #00ff00;">0%</div>
                <hr style="border:1px dashed #00ff00; margin:20px 0; opacity: 0.5;">
                <h4 style="margin:0 0 10px 0; color:#33ff33; font-size:16px; text-shadow: 0 0 5px #00ff00;">🏦 蔥電飽銀行</h4>
                <p style="font-size:12px; color:#99ff99; margin:0 0 10px 0;">(睡覺時每分鐘賺取3馬德幣)</p>
                <div style="font-size:28px; font-weight:bold; color:#ffcc00; text-shadow:0 0 10px #ffcc00; margin-bottom:15px;">💰 <span id="energy-bank-val">0</span></div>
                <button class="btn-primary" style="width:80%; font-size:16px; padding:10px; background: #006600; border: 1px solid #00ff00; color: #fff; box-shadow: 0 0 8px #00ff00; border-radius: 8px; font-weight: bold;" onclick="window.claimEnergyBank()">領取入帳</button>
                <button class="close-modal-btn btn-secondary" style="margin-top: 15px; width: 100%; background: #003300; border: 1px solid #009900; color: #ccffcc; border-radius: 8px;" onclick="document.getElementById('energy-modal').style.display='none'">關閉</button>
            </div>
        </div>
        
        <div id="fullscreen-viewer" onclick="window.closeFullscreen()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; justify-content:center; align-items:center; cursor:pointer;">
            <img id="fullscreen-img" style="max-width:90%; max-height:90%; border:3px solid var(--mucha-gold); border-radius:12px; object-fit:contain; background:var(--mucha-paper);">
        </div>
        <div id="ingame-confirm" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--mucha-paper); border:3px solid var(--mucha-gold); padding:20px; z-index:400; border-radius:12px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
            <div style="margin-bottom:15px; color:var(--mucha-brown); font-weight:bold; font-size:16px;">確定要收起裝備嗎？</div>
            <div style="display:flex; justify-content:center; gap:10px;"><button class="btn-primary" id="ingame-confirm-yes" style="padding:8px 20px;">確定</button><button class="btn-secondary" id="ingame-confirm-no" style="padding:8px 20px;">取消</button></div>
        </div>

        <div id="summon-confirm-modal" class="modal" style="z-index:400;">
            <h3 style="color:var(--mucha-green);">召喚教友</h3><p>是否支付 500 馬德幣來召喚洋蔥？</p>
            <div class="modal-btns"><button class="btn-primary" onclick="window.confirmSummon(true)">是</button><button class="btn-secondary" onclick="window.confirmSummon(false)">否</button></div>
        </div>
        <div id="forced-summon-modal" class="modal" style="z-index:500;">
            <h3 style="color:var(--mucha-green);">來自神龕的呼喚</h3><p><strong id="summoner-name" style="color:var(--mucha-gold);"></strong> 教友召喚了大家，是否出席？</p>
            <p style="color:#d9534f; font-size:14px; font-weight:bold; margin-bottom:5px;">⏳ 倒數計時: <span id="summon-timer">60</span> 秒</p>
            <button class="btn-primary" style="width:100%; margin-top:10px; font-size: 28px; padding: 15px; font-weight: bold; background: #8a2be2; border: 2px solid #ff00ff; letter-spacing: 2px; animation: purpleFire 1s infinite alternate;" onclick="window.acceptSummon()">無法拒絕</button>
        </div>
        <div id="voting-modal" class="modal purple-fire-border" style="z-index:500; background:#1a1a1a; color:#fff; width:90%; max-width:400px; padding:15px;">
            <h3 style="color:#ba55d3; border-bottom:1px solid #ba55d3; margin-top:0;">今天要淨化誰？</h3>
            <div style="display:flex; gap:10px; text-align:left; max-height:40vh; overflow-y:auto;">
                <div style="flex:1; border-right:1px solid #555; padding-right:10px;" id="voting-targets"></div><div style="flex:1;" id="voting-talismans"></div>
            </div>
            <div id="voting-status" style="margin-top:15px; font-size:12px; color:#aaa; max-height:80px; overflow-y:auto; text-align:left; background:rgba(0,0,0,0.5); padding:5px; border-radius:4px;"></div>
            <button id="voting-confirm-btn" class="btn-primary" style="width:100%; margin-top:15px; background:#8a2be2; border-color:#ba55d3; font-size:16px; font-weight:bold;" onclick="window.submitVote()">確認</button>
        </div>
        <div id="spam-ui" style="display:none; position:absolute; top:75%; left:50%; transform:translate(-50%,-50%); z-index:400; text-align:center; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;">
            <button id="spam-btn" style="width:140px; height:140px; background:none; border:none; outline:none; cursor:pointer; touch-action:manipulation; padding:0; filter: drop-shadow(0 0 15px #ffcc00); transition: transform 0.1s; user-select: none; -webkit-user-select: none; -webkit-user-drag: none;" onclick="window.clickSpamBtn()"></button>
            
            <div id="poop-splatter-container" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:401; overflow:visible;"></div>
            <div id="poop-wipe-area" style="display:none; position:absolute; top:-30px; left:-30px; right:-30px; bottom:-30px; z-index:402; cursor:grab; touch-action:none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;" onpointerdown="window.startWiping(event)" onpointerup="window.stopWiping()" onpointerleave="window.stopWiping()" onpointermove="window.wipePoop(event)" ontouchmove="window.wipePoop(event)"></div>
        </div>
        
        <div id="top-notification-bar">系統通知：歡迎來到洋蔥愛！</div>
        <div id="action-menu" class="action-menu"><button id="view-profile-btn">洋蔥身分證</button></div>
        <div id="online-players-container"><button id="online-toggle-btn">👥</button><div id="online-list-wrapper"><div id="online-players-list"></div></div></div>
        <div id="purchase-success-msg" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); color:#ffcc00; font-size:48px; z-index:400; font-weight:bold; text-align:center; pointer-events:none; -webkit-text-stroke: 2px #d4af37;">你大撒幣！</div>
        <div id="login-screen"><h2 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">入館登記</h2><input type="email" id="user-email" placeholder="信箱 Email"><br><input type="password" id="user-pwd" placeholder="密碼"><br><button id="join-btn">推開洋蔥世界之門</button></div>

        <div id="view-profile-modal" class="modal" style="z-index: 270;">
            <h3 id="vp-title">洋蔥身分證</h3>
            <div class="stats-container"><div>等級 <strong id="vp-level" style="color:var(--mucha-green);">1</strong> (EXP: <span id="vp-exp">0</span>)</div><div>💰 <strong id="vp-coins" style="color:#d4af37;">0</strong> 馬德幣</div></div>
            <div class="profile-line"><span>🧹 掃皮王:</span> <strong id="vp-sweeps">0</strong> 次</div>
            <div class="profile-line"><span>👤 暱稱:</span><strong id="vp-name"></strong><input type="text" id="edit-name" style="display:none; width:50%;"></div>
            <div class="profile-line"><span>🎨 代表色:</span><span id="vp-color" style="display:inline-block; width:20px; height:20px; border-radius:50%; border:2px solid var(--mucha-gold);"></span><input type="color" id="edit-color" style="display:none; width:40px; height:30px; border:none; padding:0; background:none;"></div>
            <div class="profile-line"><span>🎂 生日:</span> <strong id="vp-birth"></strong><input type="text" id="edit-birth" style="display:none;"></div>
            <div class="profile-line"><span>🍛 最愛:</span> <strong id="vp-food"></strong><input type="text" id="edit-food" style="display:none;"></div>
            <div class="profile-line" style="flex-direction: column; align-items: flex-start;"><span>📜 座右銘:</span><i style="color:var(--mucha-green); font-size: 14px; margin-top:5px; width: 100%; text-align: center;">"<span id="vp-motto"></span>"</i><input type="text" id="edit-motto" style="display:none; width: 95%; margin-top:5px;"></div>
            <div class="modal-btns"><button id="start-edit-btn" class="btn-edit" style="display:none;">編輯</button><button id="save-edit-btn" class="btn-primary" style="display:none;">儲存</button><button class="close-modal-btn btn-secondary" onclick="window.closeProfileModal()">收起證件</button></div>
        </div>

        <div id="furniture-catalog-modal" class="modal"><h3 id="catalog-title">📦 家俱目錄</h3><div id="catalog-list" class="catalog-grid"></div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('furniture-catalog-modal').style.display='none'">關閉</button></div>
        <div id="fridge-modal" class="modal"><h3>❄️ 公用大冰箱</h3><p style="color:#888; font-size: 14px;">冰箱目前空空如也... 等待下次採買中</p><button class="close-modal-btn btn-primary" onclick="document.getElementById('fridge-modal').style.display='none'">關上冰箱</button></div>
        <div id="memory-modal" class="modal">
            <h3>📖 洋蔥回憶錄</h3>
            <button class="btn-primary" style="width:100%; margin-bottom:10px; font-weight:bold;" onclick="let el = document.getElementById('memory-upload-area'); el.style.display = el.style.display === 'none' ? 'flex' : 'none';">➕ 新增回憶</button>
            <div id="memory-upload-area" style="display:none; flex-direction: column; gap: 10px; border: 2px dashed var(--mucha-gold); padding: 10px; border-radius: 8px; margin-bottom: 15px; background: rgba(255,255,255,0.5);">
                <input type="file" id="memory-file" accept="image/*">
                <input type="text" id="memory-text" placeholder="寫下這張照片的回憶筆記...">
                <button class="btn-primary" id="upload-memory-btn">留存回憶</button>
            </div>
            <div id="memory-feed"></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('memory-modal').style.display='none'">闔上回憶錄</button>
        </div>

        <div id="settings-modal" class="modal" style="width: 350px; box-sizing: border-box; z-index: 260; padding: 0; position:relative;">
            <div class="visualizer-bar" style="left: 6%; animation-duration: 0.6s; animation-delay: 0.1s;"></div>
            <div class="visualizer-bar" style="left: 21%; animation-duration: 0.4s; animation-delay: 0.3s;"></div>
            <div class="visualizer-bar" style="left: 36%; animation-duration: 0.7s; animation-delay: 0.0s;"></div>
            <div class="visualizer-bar" style="left: 51%; animation-duration: 0.5s; animation-delay: 0.2s;"></div>
            <div class="visualizer-bar" style="left: 66%; animation-duration: 0.8s; animation-delay: 0.4s;"></div>
            <div class="visualizer-bar" style="left: 81%; animation-duration: 0.55s; animation-delay: 0.1s;"></div>
            
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%; padding: 25px 15px; box-sizing: border-box; position: relative; z-index: 1;">
                <h3 style="color: #ffd700; border-bottom: 2px dashed #ffd700; padding-bottom: 5px; margin-top: 0; margin-bottom: 15px; width:80%; text-shadow: 2px 2px 0px #000;">🎵 蔥Music</h3>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; width:90%;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                        <button class="btn-primary" onclick="window.prevTrack()" style="border-radius:8px; width: 40px; height: 40px; padding: 0; font-weight:bold; background:#222; border:2px solid #ffd700; color:#ffd700; box-shadow: 0 4px 8px rgba(0,0,0,0.8);">&lt;</button>
                        <img id="music-cover" onclick="window.openFullscreen(this.src)" src="Sweet-Onion.png" alt="Music Cover" style="width: 140px; height: 140px; border-radius: 8px; border: 4px solid #222; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.8); cursor: pointer;">
                        <button class="btn-primary" onclick="window.nextTrack()" style="border-radius:8px; width: 40px; height: 40px; padding: 0; font-weight:bold; background:#222; border:2px solid #ffd700; color:#ffd700; box-shadow: 0 4px 8px rgba(0,0,0,0.8);">&gt;</button>
                    </div>
                    <div id="music-title" style="font-weight: bold; color: #fff; font-size: 16px; text-shadow: 2px 2px 0px #000; margin-top: 5px; background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:4px; border:1px solid #ffd700;">Sweet-Onion</div>
                    <div style="width: 100%; margin-top: 10px; background: rgba(0,0,0,0.6); padding: 10px; border-radius: 8px; border: 1px solid #ffd700;">
                        <label style="font-size: 13px; color: #ffd700; display: flex; justify-content: space-between;"><span>音樂音量</span> <span id="bgm-vol-text">100%</span></label>
                        <input type="range" id="bgm-volume" min="0" max="100" value="100" style="width: 100%; margin-top: 5px;" oninput="window.updateBGMVolume(this.value)">
                        <label style="font-size: 13px; color: #ffd700; display: flex; justify-content: space-between; margin-top: 8px;"><span>特殊音效</span> <span id="sfx-vol-text">100%</span></label>
                        <input type="range" id="sfx-volume" min="0" max="100" value="100" style="width: 100%; margin-top: 5px;" oninput="window.updateSFXVolume(this.value)">
                    </div>
                </div>
                <button class="close-modal-btn" style="margin-top: 20px; width: 60%; border-radius: 4px; padding: 10px; background: #222; border: 2px solid #ffd700; color: #ffd700; font-weight: bold; text-shadow: 1px 1px 0px #000;" onclick="document.getElementById('settings-modal').style.display='none'">關閉播放器</button>
            </div>
        </div>

        <div id="manual-modal" class="modal" style="width: 90%; max-width: none; height: 90vh; max-height: none; top: 5%; left: 5%; transform: none; box-sizing: border-box; z-index: 260;">
            <h3 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">📖 說明書</h3>
            <div id="manual-content" style="display:flex; justify-content:center; align-items:center; height: 60vh; position: relative;"><button id="manual-prev-btn" class="btn-secondary" style="position:absolute; left:0; z-index:10; font-size:24px; padding:10px 15px;">&lt;</button><img id="manual-img-display" onclick="window.openFullscreen(this.src)" src="" alt="目前尚無說明書內容" style="max-width:80%; max-height:100%; object-fit:contain; border:1px solid var(--mucha-gold); border-radius:8px; cursor: pointer;"><button id="manual-next-btn" class="btn-secondary" style="position:absolute; right:0; z-index:10; font-size:24px; padding:10px 15px;">&gt;</button><div id="manual-page-indicator" style="position:absolute; bottom: -30px; text-align:center; width:100%; font-weight:bold; color:var(--mucha-brown);">0 / 0</div></div>
            <div id="manual-admin-area" style="display:none; margin-top: 50px; border-top:2px dashed var(--mucha-gold); padding-top:15px; text-align:center;"><input type="file" id="manual-file" accept="image/*" style="margin-bottom: 10px;"><br><button class="btn-primary" onclick="window.uploadManualPage()">上傳新頁面</button><button class="btn-danger" onclick="window.deleteManualPage()">刪除此頁</button><div style="margin-top: 10px;"><button class="btn-secondary" onclick="window.moveManualPage(-1)">前移頁面</button><button class="btn-secondary" onclick="window.moveManualPage(1)">後移頁面</button></div></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 30px; width: 100%;" onclick="document.getElementById('manual-modal').style.display='none'">關閉說明書</button>
        </div>
        
        <div id="portal-modal" class="modal" style="z-index: 260; padding: 0; width: 280px; height: 440px; box-sizing: border-box;">
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:0; pointer-events:none; animation: portal-spin 6s linear infinite; transform-origin: center;">
                <div class="portal-particle" style="top:10%; left:20%; width:6px; height:6px; background:#d8bfd8; box-shadow:0 0 8px #d8bfd8;"></div>
                <div class="portal-particle" style="top:80%; left:70%; width:4px; height:4px; background:#fff; box-shadow:0 0 8px #fff;"></div>
                <div class="portal-particle" style="top:30%; left:80%; width:8px; height:8px; background:#000; box-shadow:0 0 5px #000, 0 0 10px #8a2be2;"></div>
                <div class="portal-particle" style="top:70%; left:10%; width:5px; height:5px; background:#d8bfd8; box-shadow:0 0 8px #d8bfd8;"></div>
            </div>
            
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; width:100%; height:100%; padding: 40px 20px; box-sizing: border-box; position: relative; z-index: 1;">
                <h3 style="margin-top:0; color:#fff; border:none; text-shadow: 0 0 10px #8a2be2, 0 0 20px #8a2be2; font-size: 22px;">🌀 空間傳送門</h3>
                <div style="display:flex; flex-direction:column; gap:12px; width: 100%; padding: 0 15px; box-sizing:border-box; margin-top: 10px;">
                    <button class="portal-btn-style" style="padding:12px; font-size:16px; width:100%;" onclick="window.popPortalParticles(event); window.switchScene('doghouse'); document.getElementById('portal-modal').style.display='none';">🏠 我的狗窩</button>
                    <button class="portal-btn-style" style="padding:12px; font-size:16px; width:100%;" onclick="window.popPortalParticles(event); window.switchScene('cafe'); document.getElementById('portal-modal').style.display='none';">☕ 洋蔥大廳</button>
                    <button class="portal-btn-style" style="padding:12px; font-size:16px; width:100%;" onclick="window.popPortalParticles(event); window.switchScene('farm'); document.getElementById('portal-modal').style.display='none';">🌱 我的蔥田</button>
                    <button class="portal-btn-style" style="padding:12px; font-size:16px; width:100%;" onclick="window.popPortalParticles(event); window.switchScene('7eonion'); document.getElementById('portal-modal').style.display='none';">🏪 7-EONION</button>
                </div>
                <button class="close-modal-btn btn-secondary" style="margin-top: 25px; width: 70%; border-radius: 20px; position:relative; z-index:10;" onclick="document.getElementById('portal-modal').style.display='none'">關閉傳送門</button>
            </div>
        </div>

        <div id="game-layout-container"><div id="phaser-app"></div><div id="chat-section"><button id="chat-toggle-btn">收起對話 ▲</button><div id="chat-content"><div id="chat-box"></div><div id="chat-input-area"><input type="text" id="chat-input" placeholder="說點什麼..."><button id="send-btn">發送</button></div></div></div></div>
        
        <div id="magic-modal" class="modal" style="z-index: 260; width: 85%; max-width: 320px; position:relative;">
            <div class="water-drop" style="left: 15%; animation-duration: 2s; animation-delay: 0.1s;"></div>
            <div class="water-drop" style="left: 45%; animation-duration: 2.5s; animation-delay: 1s;"></div>
            <div class="water-drop" style="left: 75%; animation-duration: 1.8s; animation-delay: 0.5s;"></div>
            <div class="water-drop" style="left: 90%; animation-duration: 2.2s; animation-delay: 1.2s;"></div>

            <h3 style="color: #fff; margin-top: 0; border-bottom: 2px solid #00aaff; padding-bottom: 10px; position:relative; z-index:1; text-shadow: 0 0 5px #00aaff;">✨ 法寶庫存</h3>
            <div class="magic-grid" id="magic-grid-container" style="position:relative; z-index:1;"></div>
            <div id="magic-desc" style="position:relative; z-index:1; margin-top: 15px; font-size: 13px; color: #fff; text-align: left; min-height: 60px; background: rgba(0, 31, 63, 0.85); padding: 10px; border-radius: 6px; border: 1px solid #00aaff; box-shadow: 0 0 10px rgba(0,170,255,0.3); line-height: 1.4;">點擊法寶查看說明...</div>
            <button class="close-modal-btn btn-secondary" style="position:relative; z-index:1; margin-top: 15px; width: 100%;" onclick="document.getElementById('magic-modal').style.display='none'">關上法寶庫</button>
        </div>
        <div id="magic-menu-blocker" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index: 290; pointer-events: auto; touch-action: none;" onpointerdown="event.stopPropagation(); event.preventDefault(); window.closeQuickMenu();" ontouchstart="event.stopPropagation(); event.preventDefault(); window.closeQuickMenu();"></div>
        <div id="quick-select-menu" onpointerdown="event.stopPropagation()" ontouchmove="event.stopPropagation()" onwheel="event.stopPropagation()">
            <div style="font-weight: bold; color: #87ceeb; margin-bottom: 0px; font-size: 13px; text-shadow: 0 0 3px #000, 0 0 5px #000; letter-spacing: 1px;">左右滑動或點擊法寶選定</div>
            <div id="quick-items-container"></div>
        </div>

        <div id="inventory-modal" class="modal"><div id="inventory-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--mucha-gold); padding-bottom: 5px; margin-bottom: 15px;"><h3 style="margin:0; border:none; color: var(--mucha-brown);">🎒 我的給西</h3><button id="inventory-edit-btn" class="btn-edit" onclick="window.toggleInventoryEdit()" style="padding:4px 8px; font-size:12px;">編輯排序</button></div><div id="inventory-list" class="catalog-grid" style="max-height: 50vh; overflow-y: auto; padding-right: 5px;"></div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('inventory-modal').style.display='none'">關閉</button></div>
        <div id="inventory-modal" class="modal"><div id="inventory-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--mucha-gold); padding-bottom: 5px; margin-bottom: 15px;"><h3 style="margin:0; border:none; color: var(--mucha-brown);">🎒 我的給西</h3><button id="inventory-edit-btn" class="btn-edit" onclick="window.toggleInventoryEdit()" style="padding:4px 8px; font-size:12px;">編輯排序</button></div><div id="inventory-list" class="catalog-grid" style="max-height: 50vh; overflow-y: auto; padding-right: 5px;"></div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('inventory-modal').style.display='none'">關閉</button></div>
        <div id="phone-modal" class="modal"><h3 style="color: var(--mucha-green);">📱 洋蔥手機</h3><p style="font-size: 12px; color: #666; margin-top: 0;">點擊聯絡人發送私訊</p><div id="phone-contacts" class="catalog-grid" style="display: flex; flex-direction: column; gap: 5px;"></div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('phone-modal').style.display='none'">收起手機</button></div>
        <div id="pm-modal" class="modal" style="z-index: 260;"><h3 id="pm-title" style="color: var(--mucha-green);">私訊</h3><div id="pm-chat-box"></div><div style="display:flex; gap: 5px;"><input type="text" id="pm-input" style="flex-grow:1; padding:5px; border: 1px solid var(--mucha-gold); border-radius: 4px;" placeholder="輸入訊息..."><button class="btn-primary" onclick="window.sendPM()">發送</button></div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="window.closePM()">返回聯絡人</button></div>
        
        <div id="store-modal" class="modal" style="padding:0; overflow:hidden; z-index: 250;">
            <div style="background:#2a1b12; text-align:center; position:relative; border-bottom: 2px solid var(--mucha-gold); padding-top: 45px;"><div id="store-manager-bubble" style="position:absolute; top:8px; left:50%; transform:translateX(-50%); background:rgba(244, 236, 216, 0.95); color:#3e2723; padding:8px 12px; border-radius:8px; font-size:14px; border:2px solid var(--mucha-gold); font-weight:bold; white-space:nowrap; z-index:2; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">這顆臭洋蔥打什麼主意啊</div><img src="store-manager-talking.png" style="width:100%; display:block;" alt="老闆"><div id="store-current-coins" class="shake-gold-text" style="position:absolute; bottom:5px; right:85px; color:#ffcc00; text-shadow:0 0 5px #ffaa00; padding:4px 8px; font-size:14px; font-weight:bold; z-index:2;">💰 0</div><div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.8); color:var(--mucha-gold); padding:4px 8px; border-radius:4px; font-size:12px; border:1px solid var(--mucha-gold); font-weight:bold; z-index:2;">德骨拉完叻</div></div>
            <div style="padding:15px; max-height: 55vh; overflow-y: auto;">
                <h3 style="margin-top:0; border:none; color:var(--mucha-brown);">🏪 7-EONION 便利商店</h3>
                <div id="store-list" class="catalog-grid">
                    <div class="catalog-item" onclick="window.openPurchaseModal('水球', 20)"><div class="sprite-waterball"></div><span style="margin-top:5px;">水球</span><span style="color:#d4af37; font-size:12px; font-weight:bold;">20 馬德幣</span></div>
                    <div class="catalog-item" onclick="window.openPurchaseModal('煙火', 100)"><img src="shop-fireworks.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin-top:5px;">煙火</span><span style="color:#d4af37; font-size:12px; font-weight:bold;">100 馬德幣</span></div>
                    <div class="catalog-item" onclick="window.openPurchaseModal('蔥友機', 20)"><img src="playroom-onion-friend-plane.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin-top:5px;">蔥友機</span><span style="color:#d4af37; font-size:12px; font-weight:bold;">20 馬德幣</span></div>
                </div><button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('store-modal').style.display='none'; window.GameLogic.isShopping = false;">離開商店</button>
            </div>
        </div>
        <div id="purchase-modal" class="modal" style="z-index: 260;"><h3 id="purchase-title" style="color:var(--mucha-green);">購買</h3><div id="purchase-desc" style="font-size:12px; color:var(--mucha-brown); background:rgba(255,255,255,0.8); padding:8px; border-radius:4px; border:1px dashed var(--mucha-gold); margin-bottom:10px; text-align:left; line-height:1.4;"></div><div style="display:flex; justify-content:center; align-items:center; gap:20px; margin: 15px 0;"><button class="btn-secondary" style="font-size:18px; padding:5px 15px;" onclick="window.adjustPurchaseQty(-1)">-</button><span id="purchase-qty" style="font-size:24px; font-weight:bold; color:var(--mucha-brown);">1</span><button class="btn-secondary" style="font-size:18px; padding:5px 15px;" onclick="window.adjustPurchaseQty(1)">+</button></div><div style="margin-bottom:15px; font-size:16px;">總計: <strong id="purchase-total" style="color:#d4af37; font-size:18px;">20</strong> 馬德幣</div><div class="modal-btns"><button class="btn-primary" onclick="window.confirmPurchase()">結帳</button><button class="btn-secondary" onclick="document.getElementById('purchase-modal').style.display='none'">取消</button></div></div>

        <div id="leaderboard-modal" class="modal" style="z-index: 260; width: 90%; max-width: 350px;">
            <h3 style="color:var(--mucha-green); margin-top:0;">🏆 洋蔥王排行榜</h3>
            <div style="display:flex; justify-content:space-around; margin-bottom:10px;">
                <button class="btn-primary" onclick="window.renderLeaderboard(0)" style="width:45%; font-size:14px;">本週戰況</button>
                <button class="btn-secondary" onclick="window.renderLeaderboard(-1)" style="width:45%; font-size:14px;">上週結算</button>
            </div>
            <div id="leaderboard-list" style="max-height: 40vh; overflow-y: auto; text-align: left; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;"></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px; width: 100%;" onclick="document.getElementById('leaderboard-modal').style.display='none'">關閉</button>
        </div>

        <div id="invite-modal" class="modal" style="z-index: 500;">
            <h3 style="color:var(--mucha-green);">收到邀請函！</h3>
            <p><strong id="invite-sender-name" style="color:var(--mucha-gold);"></strong> 向你射出了蔥友機，想來一場友情的昇華！</p>
            <p style="color:#d9534f; font-size:14px; font-weight:bold; margin-bottom:5px;">⏳ 倒數計時: <span id="invite-timer">15</span> 秒</p>
            <div class="modal-btns">
                <button class="btn-primary" onclick="window.replyInvite('yes')">好喔</button>
                <button class="btn-secondary" onclick="window.replyInvite('no')">等等</button>
            </div>
        </div>

        <div id="rps-modal" onpointerdown="event.stopPropagation()" onwheel="event.stopPropagation()" ontouchmove="event.stopPropagation()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:9999; flex-direction:column; align-items:center; justify-content:center; color:#fff; overflow:hidden;">
            <style>
                @keyframes orbit-spin { 100% { transform: rotate(360deg); } }
                @keyframes orbit-breathe { 0%, 100% { transform: scale(0.8); } 50% { transform: scale(1.2); } }
                @keyframes particle-rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
                
                @keyframes rps-bg-countdown { 0% { background: #000; } 100% { background: #8b4500; } }
                @keyframes rps-bg-flash { 0%, 50%, 100% { background: #8b4500; } 25%, 75% { background: #fff; } }
                @keyframes rps-bg-spam { 0% { background: #8b0000; } 50% { background: #ff4500; } 100% { background: #ffcc00; } }
                
                .rps-bg-phase-count { animation: rps-bg-countdown 5s forwards !important; }
                .rps-bg-phase-flash { animation: rps-bg-flash 0.5s forwards !important; }
                .rps-bg-phase-spam { animation: rps-bg-spam 0.5s infinite alternate !important; }
                .rps-bg-phase-result { transition: background 1s; background: #000 !important; }

                .rps-orbit { position: absolute; top: 50%; left: 50%; width: 150vw; height: 150vw; transform-origin: center; animation: orbit-breathe 4s ease-in-out infinite; pointer-events: none; z-index: 0; margin-left: -75vw; margin-top: -75vw; opacity: 0.8; }
                .rps-orbit-dot { position: absolute; background: #39ff14; border-radius: 50%; box-shadow: 0 0 10px #39ff14, 0 0 20px #ffffff; animation: particle-rainbow 3s linear infinite; }
            </style>
            <div class="rps-orbit" id="rps-orbit-container">
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; animation: orbit-spin 2s linear infinite; transform-origin: center;">
                    ${Array.from({length: 200}).map(() => `<div class="rps-orbit-dot" style="top:${Math.random()*100}%; left:${Math.random()*100}%; width:${Math.random()*8+4}px; height:${Math.random()*8+4}px; animation-delay:${Math.random()*3}s;"></div>`).join('')}
                </div>
            </div>
            <div id="rps-bubble-container" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1;">
                ${Array.from({length: 50}).map(() => `<div class="rps-blue-bubble" style="position:absolute; bottom:-20px; left:${Math.random()*100}%; width:${Math.random()*10+5}px; height:${Math.random()*10+5}px; animation-duration:${Math.random()*4+3}s; animation-delay:${Math.random()*5}s;"></div>`).join('')}
            </div>
            <div id="rps-phase-bet" style="display:none; flex-direction:column; align-items:center; width:80%; z-index:10; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);">
                <h2 style="color:#ffcc00;">選擇籌碼</h2>
                <p>最多只能押雙方存款較低者的全部身家</p>
                
                <div style="display:flex; justify-content:space-between; width:100%; margin: 15px 0; background:rgba(0,0,0,0.5); padding:10px; border-radius:8px;">
                    <div style="text-align:center; width:45%;"><span id="rps-bet-name-me" style="color:var(--mucha-green); font-weight:bold; font-size:16px;">我</span><br><span id="rps-bet-status-me" style="color:#ffaa00; font-size:14px; margin-top:5px; display:inline-block;">下注中...</span></div>
                    <div style="text-align:center; width:10%; font-size:20px; font-weight:bold; color:#fff; display:flex; align-items:center; justify-content:center;">VS</div>
                    <div style="text-align:center; width:45%;"><span id="rps-bet-name-op" style="color:#d9534f; font-weight:bold; font-size:16px;">對手</span><br><span id="rps-bet-status-op" style="color:#ffaa00; font-size:14px; margin-top:5px; display:inline-block;">下注中...</span></div>
                </div>

                <div id="rps-bet-input-area" style="width:100%; text-align:center; display:flex; flex-direction:column; align-items:center;">
                    <input type="range" id="rps-bet-slider" min="0" max="100" value="0" style="width:100%; margin:10px 0;">
                    <h1 style="color:#00ff00; margin:10px 0;">💰 <span id="rps-bet-display">0</span></h1>
                    <button class="btn-primary" id="rps-bet-confirm-btn" style="margin-top:10px; font-size:20px; padding:10px 30px;" onclick="window.confirmRpsBet()">下注</button>
                </div>
                
                <p style="font-size:12px; color:#aaa; margin-top:15px; text-align:center;">(雙方確認後將取平均值扣款，平手或結束後結算)</p>
            </div>
            
            <div id="rps-phase-game" style="display:none; width:100%; height:100%; position:relative; z-index:10;">
                <div id="rps-spam-particles" style="position:absolute; top:50%; left:50%; width:0; height:0; z-index:5;"></div>
                <style>
                    .rps-choice-img { transition: 0.2s; border-radius: 50%; }
                    .rps-choice-selected { box-shadow: 0 0 20px #fff, 0 0 40px #00ffff; transform: scale(1.1); background: rgba(255,255,255,0.3); }
                    .rps-spam-burst { animation: rps-burst 0.3s ease-out; }
                    @keyframes rps-burst { 0% { box-shadow: 0 0 10px #fff; transform: scale(1.1); } 100% { box-shadow: 0 0 50px #ffcc00, 0 0 80px #d9534f; transform: scale(1); opacity: 0; } }
                    .rps-sprite-moving { animation: play-rps 0.2s steps(2) infinite !important; }
                    @keyframes play-rps { 100% { background-position: -600px center; } }
                    
                    /* 新增：猜拳跳躍與結果放大動畫 */
                    @keyframes rps-hopping { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1); } }
                    .rps-anim-hopping { animation: rps-hopping 0.4s infinite ease-in-out; }
                    .rps-anim-result-scale { transform: scale(1.25) !important; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

                    /* 手機版面位置拉高調整與大小修正 */
                    @media (max-width: 768px) {
                        /* 選項按鈕改為中央偏上 */
                        #rps-choices { top: 35% !important; bottom: auto !important; left: 50% !important; transform: translateX(-50%) !important; gap: 15px !important; z-index: 50 !important; }
                        #rps-choices img { width: 70px !important; }
                        
                        /* 修正1：統一雙方圖片大小，確保在手機上絕對對稱 */
                        #rps-opponent-img, #rps-me-img { width: 220px !important; height: 220px !important; }
                        
                        /* 修正2：提升 CSS 權重，確保連擊階段不受其他設定干擾，強制雙方鎖死在同一水平線 (top: 45%) */
                        #rps-me-container.spam-phase-pos-atk, #rps-opponent-container.spam-phase-pos-atk { left: 35% !important; right: auto !important; transform: translate(-50%, -50%) scale(0.7) !important; bottom: auto !important; top: 45% !important; }
                        #rps-me-container.spam-phase-pos-def, #rps-opponent-container.spam-phase-pos-def { left: 65% !important; right: auto !important; transform: translate(-50%, -50%) scale(0.7) !important; bottom: auto !important; top: 45% !important; }
                        
                        #rps-center-msg { font-size: 80px !important; white-space: nowrap; }
                    }
                </style>

                <div id="rps-opponent-container" style="position:absolute; top:20px; right:20px; text-align:center; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:10;">
                    <div id="rps-op-name-top" style="font-size:20px; font-weight:bold; color:#fff; text-shadow:2px 2px 0 #000; margin-bottom:5px;"></div>
                    <div id="rps-opponent-img" style="width:300px; height:300px; background: url('playroom-rps-onion-other-ready.png') no-repeat center center; background-size: contain; margin: 0 auto; position:relative;"></div>
                    <div id="rps-op-name-bot" style="font-size:20px; font-weight:bold; color:#fff; text-shadow:2px 2px 0 #000; margin-top:5px; display:none;"></div>
                    <div id="rps-opponent-status" style="font-size:24px; font-weight:bold; color:#ff4444; text-shadow:2px 2px 0 #000;">等待中</div>
                </div>
                <div id="rps-me-container" style="position:absolute; bottom:20px; left:20px; text-align:center; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);">
                    <div id="rps-me-name-top" style="font-size:20px; font-weight:bold; color:#fff; text-shadow:2px 2px 0 #000; margin-bottom:5px;"></div>
                    <div id="rps-me-img" style="width:300px; height:300px; background: url('playroom-rps-onion-me-ready.png') no-repeat center center; background-size: contain; margin: 0 auto; position:relative;"></div>
                    <div id="rps-me-name-bot" style="font-size:20px; font-weight:bold; color:#fff; text-shadow:2px 2px 0 #000; margin-top:5px; display:none;"></div>
                    <div id="rps-me-status" style="font-size:24px; font-weight:bold; color:#44ff44; text-shadow:2px 2px 0 #000;">等待中</div>
                </div>
                
                <div id="rps-center-msg" style="position:absolute; top:20%; left:50%; transform:translate(-50%, -50%); font-size:120px; font-weight:bold; color:#ffcc00; text-shadow: 6px 6px 0 #d9534f; z-index:100; white-space:nowrap; transition: top 0.5s ease;">START!</div>
                
                <div id="rps-choices" style="position:absolute; bottom:80px; left:50%; transform:translateX(-50%); display:flex; gap:20px; z-index:30;">
                    <img id="rps-choice-scissors" class="rps-choice-img" src="playroom-rps-machine-scissors.png" style="width:120px; cursor:pointer;" onpointerdown="window.selectRps('scissors'); event.stopPropagation();">
                    <img id="rps-choice-stone" class="rps-choice-img" src="playroom-rps-machine-stone.png" style="width:120px; cursor:pointer;" onpointerdown="window.selectRps('stone'); event.stopPropagation();">
                    <img id="rps-choice-paper" class="rps-choice-img" src="playroom-rps-machine-paper.png" style="width:120px; cursor:pointer;" onpointerdown="window.selectRps('paper'); event.stopPropagation();">
                </div>

                <div id="rps-spam-area" style="display:none; position:absolute; bottom:80px; left:50%; transform:translateX(-50%); text-align:center; z-index: 50;">
                    <div style="position:relative; display:inline-block;">
                        <button id="rps-spam-btn" style="font-size:48px; font-weight:bold; padding:20px 60px; border-radius:20px; background:#d9534f; color:#fff; border:4px solid #ffcc00; cursor:pointer; box-shadow:0 10px 0 #aa0000; user-select:none; -webkit-user-select:none; touch-action:manipulation; outline:none; transition: transform 0.1s; position:relative; z-index:2;" onclick="window.clickRpsSpam()">打！</button>
                    </div>
                    <div style="margin-top:10px; font-size:30px; font-weight:bold; color:#fff; text-shadow:0 0 5px #000;">剩餘時間: <span id="rps-spam-timer" style="font-size:48px;">5</span></div>
                </div>
            </div>

            <div id="rps-phase-result" style="display:none; flex-direction:column; align-items:center; z-index:20;">
                <h1 id="rps-result-title" style="font-size:60px; color:#ffcc00; margin-bottom:10px;">結算</h1>
                <div id="rps-result-desc" style="font-size:24px; margin-bottom:20px;"></div>
                <p style="color:#aaa; font-size:14px; margin-bottom:30px;">結算總金額已扣除機台維護與場地清潔費 (1000以下免稅 / 1000~5000抽8% / 5000以上抽15%豪華娛樂稅)</p>
                <button class="btn-primary" style="font-size:24px; padding:10px 40px;" onclick="window.exitPlayroom()">離開機台</button>
            </div>
        </div>

        <div id="dev-modal" class="modal" style="z-index: 260;">
            <h3 style="color:var(--mucha-green); margin-top:0;">🛠️ 洋蔥精靈 (開發者模式)</h3>
            <div class="catalog-grid" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="catalog-item" onclick="window.devSummonMimi()" style="flex-direction:row; justify-content:center; padding: 15px; font-weight:bold; background:rgba(197, 160, 89, 0.1); width:100%; box-sizing:border-box;">
                    <span>🐭 召喚米米 (測試用)</span>
                </div>
                <div class="catalog-item" onclick="window.devFillMagic()" style="flex-direction:row; justify-content:center; padding: 15px; font-weight:bold; background:rgba(197, 160, 89, 0.1); width:100%; box-sizing:border-box;">
                    <span>✨ 法寶填充 (100個)</span>
                </div>
                <div class="catalog-item" onclick="window.devAddCoins()" style="flex-direction:row; justify-content:center; padding: 15px; font-weight:bold; background:rgba(197, 160, 89, 0.1); width:100%; box-sizing:border-box;">
                    <span>💰 增加10萬馬德幣</span>
                </div>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px; width: 100%;" onclick="document.getElementById('dev-modal').style.display='none'; document.getElementById('inventory-modal').style.display='block';">返回背包</button>
        </div>
    `;
    setTimeout(() => { 
        document.querySelectorAll('.modal, .action-menu, #chat-section, #spam-ui, #quick-select-menu').forEach(el => { ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'mousedown', 'mouseup', 'click'].forEach(evt => { el.addEventListener(evt, (e) => e.stopPropagation(), { passive: false }); }); }); 
        
        let onlineToggleBtn = document.getElementById('online-toggle-btn');
        let onlineContainer = document.getElementById('online-players-container');
        if (onlineToggleBtn && onlineContainer) {
            onlineToggleBtn.innerHTML = '👥'; // 初始為群組小圖示
            onlineToggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                onlineContainer.classList.toggle('online-collapsed');
                this.innerHTML = '👥'; // 保持圖示不變，精簡美觀
            });
        }
    }, 500);
}
createSystemUI();

window.openEnergyModal = function() {
    document.getElementById('inventory-modal').style.display = 'none'; let p = window.GameLogic.myProfile;
    document.getElementById('energy-modal-bar').style.width = (p.energy || 0) + '%';
    document.getElementById('energy-modal-text').innerText = (p.energy || 0).toFixed(1) + '%';
    document.getElementById('energy-bank-val').innerText = Math.floor(p.energyBank || 0);
    document.getElementById('energy-modal').style.display = 'block';
};
window.claimEnergyBank = function() {
    let p = window.GameLogic.myProfile; let amount = Math.floor(p.energyBank || 0);
    if (amount <= 0) {
        document.getElementById('energy-modal').style.display = 'none';
        sendBubble("銀行裡還沒有馬德幣喔！去睡一覺再來吧！");
        return;
    }
    p.coins = (p.coins || 0) + amount; p.energyBank = 0;
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins, energyBank: 0 }); });
    document.getElementById('energy-bank-val').innerText = '0'; let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins;
    
    document.getElementById('energy-modal').style.display = 'none';
    sendBubble(`太棒了！成功領取 ${amount} 馬德幣！`);
    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) { let ms = window.GameLogic.phaserGame.scene.getScene('MainScene'); if(ms) window.playSFX(ms, 'sleep-onion-bao-got-money'); }
};

// ====== 排行榜與週次計算系統 ======
window.getWeekId = function(offsetWeeks = 0) {
    let d = new Date(); d.setHours(0,0,0,0); let day = d.getDay();
    let diff = d.getDate() - day + (day === 0 ? -6 : 1) + (offsetWeeks * 7);
    let monday = new Date(d.setDate(diff));
    return monday.getFullYear() + '-' + (monday.getMonth()+1).toString().padStart(2,'0') + '-' + monday.getDate().toString().padStart(2,'0');
};

window.openLeaderboardModal = function() {
    document.getElementById('leaderboard-modal').style.display = 'block';
    window.renderLeaderboard(0);
};

window.renderLeaderboard = function(offset) {
    let weekId = window.getWeekId(offset);
    document.querySelector('#leaderboard-modal h3').innerText = offset === 0 ? '🏆 本週戰況' : '🏆 上週結算';
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.get(module.ref(window.GameLogic.db, `weeklySweeps/${weekId}`)).then(snap => {
            let data = snap.val() || {};
            let sorted = Object.values(data).sort((a, b) => b.count - a.count);
            let html = '';
            if (sorted.length === 0) { html = '<div style="text-align:center; color:#888; font-weight:bold; margin-top:20px;">目前尚無紀錄</div>'; } 
            else {
                sorted.forEach((item, idx) => {
                    let medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `<span style="display:inline-block; width:20px; text-align:center;">${idx + 1}.</span>`));
                    html += `<div style="display:flex; justify-content:space-between; padding:10px 5px; border-bottom:1px solid #ccc; align-items:center;">
                        <span style="font-weight:bold; color:var(--mucha-brown);">${medal} ${item.name}</span>
                        <strong style="color:var(--mucha-green);">${item.count} 次</strong>
                    </div>`;
                });
            }
            document.getElementById('leaderboard-list').innerHTML = html;
        });
    });
};
// ===================================

window.manualPages = []; window.currentManualIndex = 0;
window.openManualModal = function() { document.getElementById('manual-modal').style.display = 'block'; window.currentManualIndex = 0; if (window.GameLogic.currentUser && (window.GameLogic.currentUser.email === 'kerojjj777@gmail.com' || window.GameLogic.currentUser.email === 'kerojjj777@hotmail.com' || window.GameLogic.currentUser.email === 'onion@gmail.com')) { document.getElementById('manual-admin-area').style.display = 'block'; } else { document.getElementById('manual-admin-area').style.display = 'none'; } window.renderManualPage(); };
window.renderManualPage = function() { const imgEl = document.getElementById('manual-img-display'); const indEl = document.getElementById('manual-page-indicator'); if (window.manualPages.length === 0) { imgEl.src = ''; imgEl.alt = '目前尚無說明書內容'; indEl.innerText = '0 / 0'; return; } if (window.currentManualIndex < 0) window.currentManualIndex = 0; if (window.currentManualIndex >= window.manualPages.length) window.currentManualIndex = window.manualPages.length - 1; let page = window.manualPages[window.currentManualIndex]; imgEl.src = page.imgBase64; indEl.innerText = `${window.currentManualIndex + 1} / ${window.manualPages.length}`; };
document.getElementById('manual-prev-btn').addEventListener('click', () => { if (window.currentManualIndex > 0) { window.currentManualIndex--; window.renderManualPage(); } });
document.getElementById('manual-next-btn').addEventListener('click', () => { if (window.currentManualIndex < window.manualPages.length - 1) { window.currentManualIndex++; window.renderManualPage(); } });

window.uploadManualPage = function() { const fileInput = document.getElementById("manual-file"); const file = fileInput.files[0]; if (!file) return alert("請選擇圖片檔案！"); const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const cvs = document.createElement('canvas'); let w = img.width, h = img.height; if (w > 1200) { h *= 1200 / w; w = 1200; } cvs.width = w; cvs.height = h; cvs.getContext('2d').drawImage(img, 0, 0, w, h); import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'manuals'), { imgBase64: cvs.toDataURL('image/jpeg', 0.8), timestamp: Date.now() }).then(() => { alert('上傳成功！'); fileInput.value = ""; }); }); }; img.src = e.target.result; }; reader.readAsDataURL(file); };
window.deleteManualPage = function() { if (window.manualPages.length === 0) return; if (confirm("確定要刪除當前顯示的說明書頁面嗎？")) { let pageKey = window.manualPages[window.currentManualIndex].key; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.remove(module.ref(window.GameLogic.db, `manuals/${pageKey}`)).then(() => { alert('已刪除！'); window.currentManualIndex = 0; }); }); } };
window.moveManualPage = function(dir) { if (window.manualPages.length < 2) return; let idx1 = window.currentManualIndex; let idx2 = idx1 + dir; if (idx2 < 0 || idx2 >= window.manualPages.length) return; let p1 = window.manualPages[idx1]; let p2 = window.manualPages[idx2]; let tempTime = p1.timestamp; p1.timestamp = p2.timestamp; p2.timestamp = tempTime; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { let updates = {}; updates[`manuals/${p1.key}/timestamp`] = p1.timestamp; updates[`manuals/${p2.key}/timestamp`] = p2.timestamp; module.update(module.ref(window.GameLogic.db), updates).then(() => { window.currentManualIndex = idx2; }); }); };

window.updateUnreadGlow = function() { if (!window.GameLogic.phaserGame) return; const uiScene = window.GameLogic.phaserGame.scene.getScene('UIScene'); if (!uiScene || !uiScene.itemBtn) return; const hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0; if (hasUnread) { if (!uiScene.itemGlowTween) { uiScene.itemGlowTween = uiScene.tweens.add({ targets: uiScene.itemBtn, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 600 }); } uiScene.itemBtn.setStrokeStyle(4, 0xff0000); } else { if (uiScene.itemGlowTween) { uiScene.itemGlowTween.stop(); uiScene.itemGlowTween = null; uiScene.itemBtn.setScale(1); } uiScene.itemBtn.setStrokeStyle(3, 0xc5a059); } };
window.updateOnlinePlayersUI = function() {
    const listEl = document.getElementById('online-players-list');
    const containerEl = document.getElementById('online-players-container');
    if (!listEl || !containerEl) return;
    containerEl.style.display = 'flex';
    
    let html = '';
    // 修正6：如果全域召喚計時大於 0，就在「誰在線上」上方顯示全服倒數通知
    if (window.GameLogic.globalSummonCountdown > 0) {
        html += `<div style="background: rgba(217, 83, 79, 0.9); color: white; font-weight: bold; padding: 6px; border-radius: 4px; margin-bottom: 8px; text-align: center; font-size: 12px; animation: purpleFire 1s infinite alternate;">🚨 儀式即將開始: ${window.GameLogic.globalSummonCountdown}秒</div>`;
    }
    
    html += '<div style="color:var(--mucha-gold); font-weight:bold; margin-bottom:5px; text-align:center; border-bottom: 1px solid var(--mucha-gold); padding-bottom: 3px;">誰在線上</div>';
    let players = window.GameLogic.onlinePlayers || {};
    let now = Date.now();
    
    for (let uid in players) {
        let p = players[uid];
        // 修正4：過濾掉沒有發送心跳，或心跳超過 20 秒未更新的幽靈人口
        if (!p.lastActive || (now - p.lastActive > 20000)) continue;
        html += `<div style="margin-top:5px; display:flex; align-items:center;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${p.color || '#fff'}; margin-right:8px; border:1px solid #000;"></span>${p.name || '匿名'}</div>`;
    }
    listEl.innerHTML = html;
};

// 新增：啟動神龕儀式的共用函式，停止背景音樂並開始詭異音效
window.startShrineRitual = function() {
    window.forceAudioNormal();
    window.GameLogic.shrineRitualActive = true;
    if (window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) {
            ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'].forEach(k => ms.sound.stopByKey(k));
            if (!ms.sound.get('shrine-wierd-people-sound')?.isPlaying) ms.sound.play('shrine-wierd-people-sound', {loop: true});
        }
    }
};

window.confirmSummon = function(isYes) {
    document.getElementById('summon-confirm-modal').style.display = 'none';
    if (!isYes) return;
    if ((window.GameLogic.myProfile.coins || 0) < 500) return alert("馬德幣不足！無法召喚。");
    window.GameLogic.myProfile.coins -= 500;
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins });
    let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
    
    update(ref(db, 'serverEvents/summonShrine'), { time: Date.now(), callerUid: window.GameLogic.currentUser.uid, callerName: window.GameLogic.myProfile.name });
    // 修正2：只有付費後，資料庫才會刻上 'summoned' 狀態，並以此作為入座後開啟票選的唯一觸發鑰匙
    set(ref(db, 'shrineEvents/current'), { state: 'summoned', startTime: Date.now() });
    sendBubble("已發出神聖的召喚...");
    window.startShrineRitual();
};

window.attemptJoinShrine = function() {
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.get(module.ref(window.GameLogic.db, 'shrineEvents/current')).then(snap => {
            let ev = snap.val();
            // 判斷是否已經有儀式在進行，且超過 60 秒或是狀態不是等待入座 (summoned)
            if (ev && ev.state && ev.state !== 'finished' && ev.state !== 'none') {
                let elapsed = Date.now() - (ev.startTime || 0);
                if (elapsed > 60000 || ev.state !== 'summoned') {
                    alert("已經正在進行儀式，請下次再來。"); return;
                }
            }
            window.switchScene('shrine'); sendBubble("神龕發出耀眼的光芒...");
        });
    });
};

window.acceptSummon = function() {
    document.getElementById('forced-summon-modal').style.display = 'none';
    if (window.summonInterval) { clearInterval(window.summonInterval); window.summonInterval = null; }
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.get(module.ref(window.GameLogic.db, 'shrineEvents/current')).then(snap => {
            let ev = snap.val();
            // 雙重驗證：如果點擊按鈕時已經超時或儀式已經開始，則拒絕進入
            if (ev && ev.state && ev.state !== 'finished' && ev.state !== 'none') {
                let elapsed = Date.now() - (ev.startTime || 0);
                if (elapsed > 60000 || ev.state !== 'summoned') {
                    alert("已經正在進行儀式，請下次再來。"); return;
                }
            }
            window.startShrineRitual(); window.switchScene('shrine');
        });
    });
};

let voteTarget = null; let voteTalisman = null;
window.selectVoteTarget = function(uid) { 
    if (voteTarget === uid) { voteTarget = null; document.getElementById('vote-tgt-' + uid)?.classList.remove('selected'); }
    else { voteTarget = uid; document.querySelectorAll('[id^="vote-tgt-"]').forEach(b => b.classList.remove('selected')); document.getElementById('vote-tgt-' + uid)?.classList.add('selected'); }
    // 修正4：即時上傳未確認的選擇供他人觀看
    update(ref(window.GameLogic.db, `shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`), { target: voteTarget || 'none', name: window.GameLogic.myProfile.name, confirmed: false });
};
window.selectVoteTalisman = function(tId) { 
    if (voteTalisman === tId) { voteTalisman = null; document.getElementById('vote-tali-' + tId)?.classList.remove('selected'); }
    else { voteTalisman = tId; document.querySelectorAll('[id^="vote-tali-"]').forEach(b => b.classList.remove('selected')); document.getElementById('vote-tali-' + tId)?.classList.add('selected'); }
    update(ref(window.GameLogic.db, `shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`), { talisman: voteTalisman || 'none', name: window.GameLogic.myProfile.name, confirmed: false });
};
window.submitVote = function() {
    if (!voteTarget || !voteTalisman) return alert("請選擇一位淨化對象與一款符咒！");
    update(ref(db, `shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`), { target: voteTarget, talisman: voteTalisman, confirmed: true, name: window.GameLogic.myProfile.name });
    document.getElementById('voting-confirm-btn').innerText = "已確認 (等待他人...)"; document.getElementById('voting-confirm-btn').disabled = true;
};
window.clickSpamBtn = function() {
    if (window.GameLogic.shrineEventData && window.GameLogic.shrineEventData.state === 'purifying') {
        let currentClicks = window.GameLogic.myPurifyClicks || 0;
        currentClicks++; window.GameLogic.myPurifyClicks = currentClicks;
        set(ref(db, `shrineEvents/current/clicks/${window.GameLogic.currentUser.uid}`), currentClicks);
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) {
            if (!window.GameLogic.muteSFX && currentClicks % 5 === 0) window.playSFX(ms, 'minimum_laser'); 
            if (ms.shootRainbowLaser) ms.shootRainbowLaser(); // 觸發彩虹激光發射
            
            if (ms.localPlayer && ms.localPlayer.isSeated) {
                ms.localPlayer.magicClickTime = Date.now();
                ms.localPlayer.sprite.play('purify-magic', true);
            }
        }
    }
};

window.isWiping = false; window.poopWipeProgress = 0;
window.startWiping = function(e) { window.isWiping = true; if (e && e.cancelable) e.preventDefault(); };
window.stopWiping = function(e) { window.isWiping = false; };
window.wipePoop = function(e) {
    // 修正：強制阻斷手機端滑動時的原生選取、拖曳與畫面平移行為
    if (e && e.cancelable && e.type.includes('touch')) e.preventDefault(); 
    if (!window.isWiping && e.type !== 'touchmove') return;
    if (e.type.includes('touch')) window.isWiping = true;
    if (!window.isWiping) return;

    window.poopWipeProgress += 1;
    let container = document.getElementById('poop-splatter-container');
    let splatters = container ? container.children : [];
    let requiredWipes = 35; // 擦拭的次數門檻
    
    // 修正3：隨機縮小或淡化某幾坨屎塊，營造「真實逐漸擦掉」的視覺回饋
    if (splatters.length > 0 && Math.random() < 0.3) {
        let target = splatters[Math.floor(Math.random() * splatters.length)];
        let currentScale = parseFloat(target.style.transform.replace(/.*scale\((.*?)\).*/, '$1')) || 1;
        let currentOp = parseFloat(target.style.opacity) || 1;
        target.style.transform = target.style.transform.replace(/scale\(.*?\)/, '') + ` scale(${currentScale * 0.7})`;
        target.style.opacity = currentOp * 0.7;
    }
    
    if (window.poopWipeProgress >= requiredWipes) {
        document.getElementById('poop-wipe-area').style.display = 'none';
        if (container) container.innerHTML = '';
        window.isWiping = false; window.poopWipeProgress = 0;
        sendBubble("呼... 終於擦掉大便了！");
    }
};

window.triggerPoopSplatter = function() {
    let wipeArea = document.getElementById('poop-wipe-area');
    let container = document.getElementById('poop-splatter-container');
    if (!wipeArea || !container || wipeArea.style.display === 'block') return; 
    
    container.innerHTML = '';
    // 產生 8~12 坨隨機大小、位置、角度的屎塊黏在符咒上
    let count = Math.floor(Math.random() * 5) + 8;
    for (let i = 0; i < count; i++) {
        let splatter = document.createElement('div');
        let size = Math.random() * 30 + 25;
        let left = Math.random() * 100 - 10; 
        let top = Math.random() * 100 - 10;
        let rot = Math.random() * 360;
        // 修正：拔除高耗能的 box-shadow，改用簡單的 border 替代
        splatter.style.cssText = `position:absolute; width:${size}px; height:${size}px; left:${left}%; top:${top}%; background:#5c4033; border-radius:40% 60% 70% 30%; transform:rotate(${rot}deg) scale(1); border:1px solid #3e2723; opacity:1; transition: transform 0.2s, opacity 0.2s; pointer-events:none;`;
        container.appendChild(splatter);
    }
    wipeArea.style.display = 'block'; window.poopWipeProgress = 0;
    sendBubble("可惡！符咒被大便黏住了！");
};

window.currentPurchaseItem = null; window.currentPurchasePrice = 0; window.currentPurchaseQty = 1;
window.useItem = function(itemName) { let inv = window.GameLogic.myProfile.inventory || {}; if (inv[itemName] && inv[itemName] > 0) { if (itemName === '水球' || itemName === '煙火') { window.GameLogic.armedItemState = 'armed'; window.GameLogic.armedItemName = itemName; document.getElementById('inventory-modal').style.display = 'none'; return; } inv[itemName] -= 1; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv }); }); alert(`你成功使用了 ${itemName}！`); window.openInventoryModal(); } };
window.stopUsingItem = function(itemName) { if (itemName === '水球' || itemName === '煙火') { window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null; } };
window.toggleInventoryEdit = function() { window.GameLogic.inventoryEditMode = !window.GameLogic.inventoryEditMode; let btn = document.getElementById('inventory-edit-btn'); if (btn) { btn.innerText = window.GameLogic.inventoryEditMode ? '完成' : '編輯排序'; btn.className = window.GameLogic.inventoryEditMode ? 'btn-primary' : 'btn-edit'; } window.openInventoryModal(); };
window.moveInvItem = function(index, dir) { let order = window.GameLogic.myProfile.inventoryOrder || []; if (index + dir >= 0 && index + dir < order.length) { let temp = order[index]; order[index] = order[index + dir]; order[index + dir] = temp; window.GameLogic.myProfile.inventoryOrder = order; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventoryOrder: order }); }); window.openInventoryModal(); } };

window.clickSysItem = function(key) { document.getElementById('inventory-modal').style.display = 'none'; if (key === 'magic_items') { window.openMagicModal(); } else if (key === 'phone') { window.openPhoneModal(); } else if (key === 'portal') { window.openPortalModal(); } else if (key === 'energy') { window.openEnergyModal(); } else if (key === 'profile') { window.showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); } else if (key === 'music') { document.getElementById('settings-modal').style.display = 'block'; } else if (key === 'manual') { window.openManualModal(); } else if (key === 'dev') { document.getElementById('dev-modal').style.display = 'block'; } else if (key === 'logout') { window.leaveCafe(); if (window.GameLogic.currentUser) { import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.remove(module.ref(window.GameLogic.db, 'onlinePlayers/' + window.GameLogic.currentUser.uid)); }); } window.signOut(window.auth); } };

window.openMagicModal = function() {
    let inv = window.GameLogic.myProfile.inventory || {};
    let container = document.getElementById('magic-grid-container');
    let html = '';
    let magics = [
        { name: '水球', icon: '<div class="sprite-waterball" style="transform: scale(0.8); transform-origin: center;"></div>', desc: '聞說水是生命的起源，洋蔥喜歡感受生命，使勁地丟吧！\n按B填充後按A擲出' },
        { name: '煙火', icon: '<img src="shop-fireworks.png" style="width:40px; height:40px; object-fit:contain;">', desc: '喜歡煙火咻蹦的美麗光彩，但也喜歡拿來朝著其他洋蔥丟～\n按B填充後按A擲出，鎖定目標與不鎖定目標會有不同的效果。' },
        { name: '蔥友機', icon: '<img src="playroom-onion-friend-plane.png" style="width:40px; height:40px; object-fit:contain;">', desc: '隨時發動好(ㄓㄢˋ)友(ㄉㄡˋ)邀請，按B捏緊再按A投射，被射中的好友會收到你的訊息。' }
    ];
    for(let i = 0; i < 16; i++) {
        if (i < magics.length) {
            let m = magics[i]; let qty = inv[m.name] || 0; let descSafe = m.desc.replace(/\n/g, '<br>');
            html += `<div class="magic-slot" onclick="document.getElementById('magic-desc').innerHTML = '<strong style=\\'color:#ffcc00; font-size:16px;\\'>${m.name}</strong><br><br>${descSafe}'">
                        ${m.icon}<div class="magic-qty">x${qty}</div>
                     </div>`;
        } else { html += `<div class="magic-slot"></div>`; }
    }
    container.innerHTML = html; document.getElementById('magic-desc').innerText = "點擊法寶查看說明..."; document.getElementById('magic-modal').style.display = 'block';
};

// 【新增】開發者一鍵測試：在交誼廳中央直接生成米米
window.devSummonMimi = function() {
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        let pUids = Object.keys(window.GameLogic.cafePlayers || {}).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid]);
        let requiredHp = Math.min(6, 2 + pUids.length);
        
        // 繞過冷卻計時器，改為從地圖左側外緣隨機高度生成
        module.set(module.ref(window.GameLogic.db, 'cafeMimi'), {
            active: true,
            x: -50,
            y: Phaser.Math.Between(200, 1800),
            state: 'walk',
            hp: requiredHp,
            playersInvolved: pUids.length,
            stolenPool: 0,
            flipX: false,
            stolenUids: null
        }).then(() => {
            document.getElementById('dev-modal').style.display = 'none';
        });
    });
};

window.devFillMagic = function() {
    let inv = window.GameLogic.myProfile.inventory || {};
    inv['水球'] = 100;
    inv['煙火'] = 100;
    inv['蔥友機'] = 100;
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv }).then(() => {
            document.getElementById('dev-modal').style.display = 'none';
        });
    });
};

window.devAddCoins = function() {
    let p = window.GameLogic.myProfile;
    p.coins = (p.coins || 0) + 100000;
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins }).then(() => {
            let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins;
            document.getElementById('dev-modal').style.display = 'none';
            alert("已成功匯入 100,000 馬德幣！");
        });
    });
};

window.openInventoryModal = function() {
    const list = document.getElementById('inventory-list'); let hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0; let dotHtml = hasUnread ? '<div style="position:absolute; top:5px; right:5px; width:12px; height:12px; background:red; border-radius:50%; box-shadow:0 0 5px red; z-index:10;"></div>' : '';
    let rawItems = {}; let isEdit = window.GameLogic.inventoryEditMode; let inv = window.GameLogic.myProfile.inventory || {}; let sysKeys = ['phone', 'portal', 'profile', 'music', 'manual', 'logout', 'dev', 'magic_items']; let keys = Object.keys(inv).filter(k => inv[k] > 0 && k !== '假人洋蔥' && !sysKeys.includes(k) && k !== '水球' && k !== '煙火' && k !== '蔥友機');
    keys.forEach(k => {
        let iconHtml = (k === '水球') ? '<div class="sprite-waterball"></div>' : (k === '煙火' ? '<img src="shop-fireworks.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;">' : '<span style="font-size:24px; margin-bottom:5px;">📦</span>');
        let isUsing = ((k === '水球' || k === '煙火') && window.GameLogic.armedItemState != null && window.GameLogic.armedItemName === k);
        let itemClass = isUsing ? 'catalog-item item-in-use' : 'catalog-item'; let btnHtml = isUsing ? `<span style="font-size:12px; color:#d9534f; font-weight:bold; margin-top:5px;">[點擊暫停]</span>` : ``; let onclickStr = isUsing ? `window.stopUsingItem('${k}')` : `window.useItem('${k}')`;
        rawItems[k] = `<div class="${itemClass}" style="width: 100%; box-sizing: border-box;" ${!isEdit ? `onclick="${onclickStr}"` : ''}>${iconHtml}<span style="margin:5px 0;">${k} x${inv[k]}</span>${!isEdit ? btnHtml : ''}</div>`;
    });
    rawItems['phone'] = `<div class="catalog-item" style="position:relative; width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'phone\')"' : ''} >${dotHtml}<div class="sprite-onion-phone"></div><span style="margin:5px 0;">洋蔥手機</span></div>`;
    rawItems['portal'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'portal\')"' : ''}><div class="sprite-magic-gap"></div><span style="margin:5px 0;">傳送門</span></div>`;
    rawItems['energy'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'energy\')"' : ''}><img src="sleep-onion-bao.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0;">蔥電飽</span></div>`;
    rawItems['profile'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'profile\')"' : ''}><img src="tools-id-card.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0;">洋蔥身分證</span></div>`;
    rawItems['music'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'music\')"' : ''}><div class="sprite-music-box"></div><span style="margin:5px 0;">蔥Music</span></div>`;
    rawItems['manual'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'manual\')"' : ''}><img src="tools-manual.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0;">說明書</span></div>`;
    rawItems['magic_items'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'magic_items\')"' : ''}><img src="tools-magic-weapon.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0; color:var(--mucha-brown); font-weight:bold;">法寶</span></div>`;
    rawItems['logout'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'logout\')"' : ''}><img src="tools-leave.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0;">登出大廳</span></div>`;if (window.GameLogic.currentUser && window.GameLogic.currentUser.email === 'onion@gmail.com') {
        rawItems['dev'] = `<div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.clickSysItem(\'dev\')"' : ''}><img src="tools-master-onion.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin:5px 0; font-weight:bold; color:var(--mucha-green);">洋蔥精靈</span></div>`;
    }
    let activeKeys = Object.keys(rawItems); let order = Array.isArray(window.GameLogic.myProfile.inventoryOrder) ? window.GameLogic.myProfile.inventoryOrder.filter(k => k && typeof k === 'string') : []; let finalOrder = order.filter(k => activeKeys.includes(k)); activeKeys.forEach(k => { if (!finalOrder.includes(k)) finalOrder.push(k); }); window.GameLogic.myProfile.inventoryOrder = finalOrder;
    let invHTML = ''; finalOrder.forEach((k, i) => { let inner = rawItems[k]; if (window.GameLogic.inventoryEditMode) { invHTML += `<div style="display:flex; flex-direction:column; align-items:center; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 8px;">${inner}<div style="display:flex; justify-content:space-around; width:100%; margin-top:5px;"><button class="btn-secondary" style="padding:2px 10px;" onclick="window.moveInvItem(${i}, -1)" ${i === 0 ? 'disabled' : ''}>◀</button><button class="btn-secondary" style="padding:2px 10px;" onclick="window.moveInvItem(${i}, 1)" ${i === finalOrder.length - 1 ? 'disabled' : ''}>▶</button></div></div>`; } else { invHTML += inner; } });
    list.style.display = 'grid'; list.style.gridTemplateColumns = '1fr 1fr'; list.style.gap = '10px'; list.style.maxHeight = '60vh'; list.style.overflowY = 'auto'; list.style.padding = '5px'; list.style.alignItems = 'start'; list.innerHTML = invHTML; document.getElementById('inventory-modal').style.display = 'block';
};

window.viewOtherProfile = function(uid) { import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.get(module.ref(window.GameLogic.db, `users/${uid}`)).then(snap => { if (snap.exists()) { document.getElementById('phone-modal').style.display = 'none'; showProfileModal(snap.val(), uid); } }); }); };
window.openPhoneModal = function() { document.getElementById('inventory-modal').style.display = 'none'; document.getElementById('phone-modal').style.display = 'block'; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.get(module.ref(window.GameLogic.db, 'users')).then(snap => { let users = snap.val() || {}; let html = ''; for (let uid in users) { if (uid === window.GameLogic.currentUser.uid) continue; let u = users[uid]; let unreadDot = (window.GameLogic.unreadPMs && window.GameLogic.unreadPMs[uid]) ? ' <span style="color:red; font-size:10px;">🔴</span>' : ''; html += `<div class="catalog-item phone-contact" style="flex-direction:row; justify-content:space-between; padding: 10px;"><span style="font-weight:bold; color: ${u.color || '#fff'}; text-shadow: 1px 1px 2px #000;">${u.name || '匿名'} (Lv.${u.level || 1})${unreadDot}</span><div><button class="btn-secondary" style="padding: 4px 12px; font-size:12px; margin-right: 5px; color:#333;" onclick="window.viewOtherProfile('${uid}')">查看</button><button class="btn-primary" style="padding: 4px 12px; font-size:12px;" onclick="window.openPM('${uid}', '${u.name || '匿名'}')">私訊</button></div></div>`; } if (html === '') html = '<div style="text-align:center; color:#fff; text-shadow: 1px 1px 2px #000;">目前沒有其他聯絡人</div>'; document.getElementById('phone-contacts').innerHTML = html; }); }); };
window.openPM = function(targetUid, targetName) { document.getElementById('phone-modal').style.display = 'none'; document.getElementById('pm-modal').style.display = 'block'; document.getElementById('pm-title').innerText = `💬 與 ${targetName} 密語`; window.currentPMUid = targetUid; let myUid = window.GameLogic.currentUser.uid; let chatId = [myUid, targetUid].sort().join('_'); import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.remove(module.ref(window.GameLogic.db, `users/${myUid}/unreadPMs/${targetUid}`)); }); import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { if (window.pmUnsubscribe) window.pmUnsubscribe(); window.pmUnsubscribe = module.onValue(module.ref(window.GameLogic.db, `privateChats/${chatId}`), snap => { let msgs = snap.val() || {}; let box = document.getElementById('pm-chat-box'); box.innerHTML = ''; Object.values(msgs).forEach(m => { if (m.uid === myUid) { box.innerHTML += `<div style="text-align:right; margin-bottom: 8px;"><div class="pm-bubble-me">${m.msg}</div></div>`; } else { box.innerHTML += `<div style="text-align:left; margin-bottom: 8px;"><div class="pm-bubble-other"><div style="font-size:11px; color:#558b2f; font-weight:bold; margin-bottom:2px;">${m.name}</div>${m.msg}</div></div>`; } }); box.scrollTop = box.scrollHeight; }); }); };
window.closePM = function() { if (window.pmUnsubscribe) { window.pmUnsubscribe(); window.pmUnsubscribe = null; } document.getElementById('pm-modal').style.display = 'none'; document.getElementById('phone-modal').style.display = 'block'; };
window.sendPM = function() { let input = document.getElementById('pm-input'); let msg = input.value.trim(); if (!msg || !window.currentPMUid) return; let myUid = window.GameLogic.currentUser.uid; let chatId = [myUid, window.currentPMUid].sort().join('_'); import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, `privateChats/${chatId}`), { uid: myUid, name: window.GameLogic.myProfile.name, msg: msg, time: Date.now() }); module.update(module.ref(window.GameLogic.db, `users/${window.currentPMUid}/unreadPMs`), { [myUid]: true }); }); input.value = ''; };

window.openPurchaseModal = function(name, price) { let currentCoins = window.GameLogic.myProfile.coins || 0; let maxQty = Math.floor(currentCoins / price); if (maxQty <= 0) { alert("馬德幣不足！快去打掃賺錢吧！"); return; } window.currentPurchaseItem = name; window.currentPurchasePrice = price; window.currentPurchaseQty = 1; document.getElementById('purchase-title').innerText = `購買 ${name}`; let desc = ""; if (name === '水球') { desc = "聽說洋蔥都躲在大廳裡面玩水球大戰，為了讓我可以賺更多錢，我在水球裡加了魔法，被擊中的對象也會噴錢，然後他們就會.....一直噴錢，一直撿錢，來找我花錢!!! 嘿嘿嘿..."; } else if (name === '煙火') { desc = "曾經聽我朋友說他的同事們很奇怪，遇到好事就要說『咻蹦～』還要搭配放煙火手勢，我都懶得講話所以做了這個神奇的煙火拿來賣，畫面漂亮((還可以攻擊別人))多麼棒～"; } else if (name === '蔥友機') { desc = "那些洋蔥好像平常太互相傷害了，是時候來點友情的昇華。"; } document.getElementById('purchase-desc').innerText = desc; document.getElementById('purchase-qty').innerText = window.currentPurchaseQty; document.getElementById('purchase-total').innerText = window.currentPurchasePrice; document.getElementById('purchase-modal').style.display = 'block'; };
window.adjustPurchaseQty = function(delta) { let maxQty = Math.floor((window.GameLogic.myProfile.coins || 0) / window.currentPurchasePrice); let newQty = window.currentPurchaseQty + delta; if (newQty >= 1 && newQty <= maxQty) { window.currentPurchaseQty = newQty; document.getElementById('purchase-qty').innerText = window.currentPurchaseQty; document.getElementById('purchase-total').innerText = window.currentPurchaseQty * window.currentPurchasePrice; } };
window.confirmPurchase = function() { let cost = window.currentPurchaseQty * window.currentPurchasePrice; if ((window.GameLogic.myProfile.coins || 0) >= cost) { window.GameLogic.myProfile.coins -= cost; window.GameLogic.myProfile.inventory = window.GameLogic.myProfile.inventory || {}; window.GameLogic.myProfile.inventory[window.currentPurchaseItem] = (window.GameLogic.myProfile.inventory[window.currentPurchaseItem] || 0) + window.currentPurchaseQty; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins, inventory: window.GameLogic.myProfile.inventory }); }); document.getElementById('purchase-modal').style.display = 'none'; if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (scene) { window.playSFX(scene, 'shop-boss-thank-you'); window.playSFX(scene, 'shop-check-buying'); } } let msgEl = document.getElementById('purchase-success-msg'); msgEl.style.display = 'block'; msgEl.classList.remove('flash-text'); void msgEl.offsetWidth; msgEl.classList.add('flash-text'); setTimeout(() => { msgEl.style.display = 'none'; }, 2000); let smBubble = document.getElementById('store-manager-bubble'); if (smBubble) { smBubble.innerText = "懂買的都是好蔥！"; setTimeout(() => { smBubble.innerText = "這顆臭洋蔥打什麼主意啊"; }, 3000); } let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins; let storeCoinsEl = document.getElementById("store-current-coins"); if (storeCoinsEl) storeCoinsEl.innerText = `💰 ${window.GameLogic.myProfile.coins}`; } };

const loginScreen = document.getElementById("login-screen"); const gameLayoutContainer = document.getElementById("game-layout-container"); const chatSection = document.getElementById("chat-section"); const actionMenu = document.getElementById("action-menu"); const viewProfileModal = document.getElementById("view-profile-modal"); const chatInput = document.getElementById("chat-input");
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(()=>{}); }
window.addEventListener('pointerdown', (e) => { 
    if (!e.target.closest('#action-menu') && e.target.tagName !== 'CANVAS') { actionMenu.style.display = 'none'; } 
    if (e.target.tagName === 'CANVAS') { 
        // 修正2：點擊背景時，不要關閉投票介面與強制召喚介面
        document.querySelectorAll('.modal:not(#voting-modal):not(#forced-summon-modal)').forEach(m => m.style.display = 'none'); 
        window.GameLogic.isShopping = false; 
    } 
});
document.getElementById('chat-toggle-btn').addEventListener('click', function() { chatSection.classList.toggle('chat-collapsed'); this.innerText = chatSection.classList.contains('chat-collapsed') ? '展開對話 ▼' : '收起對話 ▲'; if (!chatSection.classList.contains('chat-collapsed')) { const chatBox = document.getElementById("chat-box"); chatBox.scrollTop = 0; } });
document.getElementById("join-btn").addEventListener("click", () => { const email = document.getElementById("user-email").value; const pwd = document.getElementById("user-pwd").value; signInWithEmailAndPassword(auth, email, pwd).catch(error => alert("登入失敗: " + error.message)); });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.GameLogic.currentUser = user; loginScreen.style.display = "none"; gameLayoutContainer.style.display = "block";
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) {
            window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...profileSnap.val() };
            
            let localSleep = localStorage.getItem('onion_sleepStartTime');
            if (localSleep && parseInt(localSleep) > 0) {
                window.GameLogic.myProfile.sleepStartTime = parseInt(localSleep);
                window.GameLogic.myProfile.lastScene = 'doghouse';
            }

            window.GameLogic.currentTrackIdx = window.GameLogic.myProfile.currentTrackIdx || 0;
            let playlist = [ { key: 'bgm', title: 'Sweet-Onion', cover: 'Sweet-Onion.png' }, { key: 'bgm-heart', title: '洋蔥心', cover: 'Onion-Heart.png' }, { key: 'bgm-inside', title: 'Inside-of-Onion', cover: 'Inside-of-Onion.png' }, { key: 'bgm-kyo', title: '귀엽다!귀엽다!Onion!', cover: 'kyo-kyo-onion.png' }, { key: 'bgm-world', title: '世界他會自己轉動', cover: "OMusic-World'll-roll.png" }, { key: 'bgm-lazy', title: 'Onion Lazy Cat', cover: 'OMusic-Onion-Lazy-Cat.png' }, { key: 'bgm-way', title: '洋蔥滾動自己路', cover: 'OMusic-Onion-go-my-way.png' }, { key: 'bgm-corazon', title: 'Onion acre Corazón', cover: 'OMusic-Onion-acre-Corazon.png' }, { key: 'bgm-fire', title: '烈艷洋蔥', cover: 'OMusic-Onion-Got-Fire.png' } ];
            let track = playlist[window.GameLogic.currentTrackIdx];
            let coverEl = document.getElementById('music-cover'), titleEl = document.getElementById('music-title');
            if (coverEl) coverEl.src = track.cover; if (titleEl) titleEl.innerText = track.title;
        } else { set(ref(db, `users/${user.uid}`), window.GameLogic.myProfile); }

        onValue(ref(db, '.info/connected'), (snap) => {
            if (snap.val() === true && window.GameLogic.currentUser) {
                const globalPlayerRef = ref(db, `onlinePlayers/${window.GameLogic.currentUser.uid}`);
                set(globalPlayerRef, { name: window.GameLogic.myProfile.name || '匿名', color: window.GameLogic.myProfile.color || '#fff' });
                onDisconnect(globalPlayerRef).remove();
                if (window.GameLogic.currentScene === 'cafe') {
                    const cafeRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`);
                    set(cafeRef, { x: window.GameLogic.myProfile.lastX || 1024, y: window.GameLogic.myProfile.lastY || 1024, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, bubbleMsg: window.GameLogic.myProfile.bubbleMsg || "", bubbleTime: window.GameLogic.myProfile.bubbleTime || 0 });
                    onDisconnect(cafeRef).remove();
                } else if (window.GameLogic.currentScene === 'shrine') { joinShrine(); }
            }
        });
        
        onValue(ref(db, 'onlinePlayers'), (snapshot) => { window.GameLogic.onlinePlayers = snapshot.val() || {}; window.updateOnlinePlayersUI(); });
        onValue(ref(db, `users/${user.uid}/unreadPMs`), snap => { window.GameLogic.unreadPMs = snap.val() || {}; window.updateUnreadGlow(); if (document.getElementById('inventory-modal').style.display === 'block') { window.openInventoryModal(); } });
        onValue(ref(db, 'manuals'), snap => { const data = snap.val(); window.manualPages = []; if (data) { Object.keys(data).forEach(key => { window.manualPages.push({ key: key, imgBase64: data[key].imgBase64, timestamp: data[key].timestamp }); }); window.manualPages.sort((a, b) => a.timestamp - b.timestamp); } window.renderManualPage(); });
        onValue(ref(db, 'cafeFurniture'), snap => window.GameLogic.cafeFurniture = snap.val() || {});

        // 全局強制召喚監聽
        // 全局強制召喚監聽與 60 秒倒數
        onValue(ref(db, 'serverEvents/summonShrine'), snap => {
            let data = snap.val();
            // 當 data.time 被設為 0 (或超時) 時，就會跳到 else 區塊強制關閉視窗
            if (data && Date.now() - data.time < 60000) {
                if (window.lastSummonTime !== data.time) {
                    window.lastSummonTime = data.time;
                    
                    if (window.globalSummonInterval) clearInterval(window.globalSummonInterval);
                    
                    const updateCountdown = () => {
                        let remain = 60 - Math.floor((Date.now() - data.time) / 1000);
                        if (remain <= 0) {
                            window.GameLogic.globalSummonCountdown = 0;
                            clearInterval(window.globalSummonInterval);
                            document.getElementById('forced-summon-modal').style.display = 'none';
                        } else {
                            window.GameLogic.globalSummonCountdown = remain;
                            let tEl = document.getElementById('summon-timer');
                            if (tEl) tEl.innerText = remain;
                        }
                        window.updateOnlinePlayersUI();
                    };
                    
                    if (data.callerUid !== window.GameLogic.currentUser.uid && window.GameLogic.currentScene !== 'shrine') {
                        document.getElementById('summoner-name').innerText = data.callerName || '某某';
                        document.getElementById('forced-summon-modal').style.display = 'block';
                    }
                    
                    updateCountdown();
                    window.globalSummonInterval = setInterval(updateCountdown, 1000);
                }
            } else {
                // 修正：當收到終止訊號(time:0)時，不僅數值歸零，還要強制關閉全服的倒數視窗與計時器
                window.GameLogic.globalSummonCountdown = 0;
                if (window.globalSummonInterval) { clearInterval(window.globalSummonInterval); window.globalSummonInterval = null; }
                let modal = document.getElementById('forced-summon-modal');
                if (modal) modal.style.display = 'none';
                window.updateOnlinePlayersUI();
            }
        });

        if (!window.GameLogic.phaserGame) { window.GameLogic.pendingScene = window.GameLogic.myProfile.lastScene || "doghouse"; initPhaser(); } else { switchScene(window.GameLogic.myProfile.lastScene || "doghouse"); }
        listenToChat(); listenToMemories();
    } else {
        window.GameLogic.currentUser = null; loginScreen.style.display = "block"; gameLayoutContainer.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe(); if (shrineUnsubscribe) shrineUnsubscribe(); if (shrineEventUnsubscribe) shrineEventUnsubscribe(); window.updateOnlinePlayersUI();
    }
});

function joinShrine() {
    const playerRef = ref(db, `shrinePlayers/${window.GameLogic.currentUser.uid}`);
    // 【修正 BUG 2】補上 level 屬性，讓其他玩家能看見真實等級
    set(playerRef, { x: window.GameLogic.myProfile.lastX || 640, y: window.GameLogic.myProfile.lastY || 360, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, isSeated: false });
    onDisconnect(playerRef).remove();
    shrineUnsubscribe = onValue(ref(db, 'shrinePlayers'), (snapshot) => { window.GameLogic.shrinePlayers = snapshot.val() || {}; checkShrineVotingTrigger(); });
    shrineEventUnsubscribe = onValue(ref(db, 'shrineEvents/current'), snap => {
        let eventData = snap.val(); window.GameLogic.shrineEventData = eventData;
        let votingModal = document.getElementById('voting-modal'); let spamUI = document.getElementById('spam-ui');
        if (!eventData || eventData.state === 'finished') { votingModal.style.display = 'none'; spamUI.style.display = 'none'; window.GameLogic.myPurifyClicks = 0; return; }

        if (eventData.state === 'voting') {
            votingModal.style.display = 'block';
            
            // 🌟 新增：重繪前先記憶目前的滾動條位置，避免重新渲染時把選項彈回最頂端
            let scrollArea = document.getElementById('voting-targets') ? document.getElementById('voting-targets').parentElement : null;
            let currentScroll = scrollArea ? scrollArea.scrollTop : 0;
            let statusBox = document.getElementById('voting-status');
            let statusScroll = statusBox ? statusBox.scrollTop : 0;

            let tHtml = ''; let seatedPlayers = window.GameLogic.shrinePlayers || {};
            let onlineGlobal = window.GameLogic.onlinePlayers || {}; 
            for (let uid in seatedPlayers) { 
                if (!seatedPlayers[uid].isSeated || !onlineGlobal[uid]) continue; 
                let isSel = (voteTarget === uid) ? 'selected' : ''; 
                tHtml += `<div id="vote-tgt-${uid}" class="vote-item ${isSel}" onclick="window.selectVoteTarget('${uid}')">👤 ${seatedPlayers[uid].name}</div>`; 
            }
            tHtml += `<div id="vote-tgt-any" class="vote-item ${(voteTarget === 'any') ? 'selected' : ''}" onclick="window.selectVoteTarget('any')">🎲 都可以</div>`;
            document.getElementById('voting-targets').innerHTML = tHtml;

            let talismans = [ {id: 'charm-1', img: 'shrine-chinese-charm-01.png', name: '符咒一'}, {id: 'charm-2', img: 'shrine-chinese-charm-02.png', name: '符咒二'}, {id: 'charm-3', img: 'shrine-chinese-charm-03.png', name: '符咒三'}, {id: 'charm-4', img: 'shrine-chinese-charm-04.png', name: '符咒四'}, {id: 'charm-5', img: 'shrine-chinese-charm-05.png', name: '符咒五'} ];
            let taliHtml = '';
            talismans.forEach(t => { let isSel = (voteTalisman === t.id) ? 'selected' : ''; taliHtml += `<div id="vote-tali-${t.id}" class="vote-item ${isSel}" onclick="window.selectVoteTalisman('${t.id}')" style="display:flex; align-items:center; gap:10px;"><img src="${t.img}" style="width:40px; height:40px; object-fit:contain;"><span>${t.name}</span></div>`; });
            document.getElementById('voting-talismans').innerHTML = taliHtml;

            let sHtml = '<div style="font-weight:bold; color:#ba55d3; margin-bottom:5px; text-align:center;">--- 大家正在猶豫什麼 ---</div>'; 
            let votes = eventData.votes || {};
            for (let uid in votes) {
                if (!onlineGlobal[uid]) continue;
                let v = votes[uid]; 
                let tName = v.target === 'any' ? '都可以' : (seatedPlayers[v.target] ? seatedPlayers[v.target].name : '...');
                let taliObj = talismans.find(x => x.id === v.talisman);
                let tIcon = taliObj ? `<img src="${taliObj.img}" style="width:20px; vertical-align:middle;">` : '...';
                let statusColor = v.confirmed ? '#00ff00' : '#aaa';
                let statusText = v.confirmed ? '✅已確認' : '🤔選擇中';
                sHtml += `<div style="color:${statusColor}; font-size:13px; margin-bottom:4px;">${v.name}: [${tName}] + ${tIcon} (${statusText})</div>`;
            }
            document.getElementById('voting-status').innerHTML = sHtml;

            let myVote = votes[window.GameLogic.currentUser.uid]; let btn = document.getElementById('voting-confirm-btn');
            if (myVote && myVote.confirmed) { btn.innerText = "已確認 (等待他人...)"; btn.disabled = true; } else { btn.innerText = "確認"; btn.disabled = false; }
            
            // 🌟 新增：重新渲染完成後，瞬間將滾動條拉回原本的位置
            if (scrollArea) scrollArea.scrollTop = currentScroll;
            if (statusBox) statusBox.scrollTop = statusScroll;

        } else { votingModal.style.display = 'none'; }

        if (eventData.state === 'purifying') {
            spamUI.style.display = 'block';
            let myVote = eventData.votes && eventData.votes[window.GameLogic.currentUser.uid];
            if (myVote && myVote.talisman) {
                let talismans = [ {id: 'charm-1', img: 'shrine-chinese-charm-01.png'}, {id: 'charm-2', img: 'shrine-chinese-charm-02.png'}, {id: 'charm-3', img: 'shrine-chinese-charm-03.png'}, {id: 'charm-4', img: 'shrine-chinese-charm-04.png'}, {id: 'charm-5', img: 'shrine-chinese-charm-05.png'} ];
                let taliObj = talismans.find(x => x.id === myVote.talisman);
                if (taliObj) { 
                    let sBtn = document.getElementById('spam-btn'); 
                    // 修正：拔除圖片預設行為，並移除高耗能的 drop-shadow 濾鏡
                    sBtn.innerHTML = `<img src="${taliObj.img}" style="width:100%; height:100%; object-fit:contain; pointer-events:none; user-select:none; -webkit-user-select:none; -webkit-user-drag:none;">`;
                }
            }
        } else { 
            spamUI.style.display = 'none'; 
            let wipeArea = document.getElementById('poop-wipe-area');
            let container = document.getElementById('poop-splatter-container');
            if (wipeArea) wipeArea.style.display = 'none'; 
            if (container) container.innerHTML = '';
        }
    });
}

function leaveShrine() { 
    if (window.GameLogic.currentUser) {
        let players = window.GameLogic.shrinePlayers || {};
        let now = Date.now();
        // 篩選出真正在線且在神龕內的人
        let validUids = Object.keys(players).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid] && (now - (window.GameLogic.onlinePlayers[uid].lastActive || 0) < 20000));
        
        // 修正3：當所有人（或最後一個有效在線玩家）離開神龕時，立刻清空地上沒被撿完的神龕法器金幣
        if (validUids.length <= 1) {
            if (window.GameLogic.shrineEventData && window.GameLogic.shrineEventData.state !== 'finished') {
                update(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'finished' });
            }
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                module.get(module.ref(window.GameLogic.db, 'droppedCoins')).then(snap => {
                    let coins = snap.val() || {};
                    let updates = {};
                    Object.keys(coins).forEach(k => {
                        if (k.startsWith('shrine_coin_')) updates[`droppedCoins/${k}`] = null;
                    });
                    if (Object.keys(updates).length > 0) module.update(module.ref(window.GameLogic.db), updates);
                });
            });
        }
        set(ref(db, `shrinePlayers/${window.GameLogic.currentUser.uid}`), null); 
    }
    if (shrineUnsubscribe) { shrineUnsubscribe(); shrineUnsubscribe = null; } 
    if (shrineEventUnsubscribe) { shrineEventUnsubscribe(); shrineEventUnsubscribe = null; } 
    document.getElementById('voting-modal').style.display = 'none'; document.getElementById('spam-ui').style.display = 'none';
}

function checkShrineVotingTrigger() { 
    if (window.GameLogic.currentScene !== 'shrine') return; 
    let players = window.GameLogic.shrinePlayers || {}; 
    let validUids = Object.keys(players).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid]);
    if (validUids.length === 0) return; 
    
    let isHost = validUids.sort()[0] === window.GameLogic.currentUser.uid;
    let seatedCount = validUids.filter(uid => players[uid].isSeated).length;
    let currentState = window.GameLogic.shrineEventData ? window.GameLogic.shrineEventData.state : 'none';
    
    let allSeated = seatedCount > 0 && seatedCount === validUids.length; 
    if (allSeated) { 
        if (isHost && currentState === 'summoned') { 
            set(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'voting', startTime: Date.now() }); 
            // 修正：儀式正式進入投票階段！立刻將全服的召喚倒數歸零，瞬間關閉外面的 60 秒通知
            update(ref(window.GameLogic.db, 'serverEvents/summonShrine'), { time: 0 });
        } 
    } 
}

function switchScene(sceneName, extraData = null) {
    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (scene) window.playSFX(scene, 'jump04'); }
    if (sceneName !== 'shrine') window.GameLogic.shrineRitualActive = false;
    
    if (sceneName !== 'doghouse') {
        if (window.GameLogic.myProfile && window.GameLogic.myProfile.sleepStartTime > 0) {
            window.GameLogic.myProfile.sleepStartTime = 0; localStorage.removeItem('onion_sleepStartTime');
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { sleepStartTime: 0 }));
        }
        if (window.GameLogic.phaserGame) { let ms = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (ms && ms.sound && ms.sound.get('onion-sleep')) ms.sound.stopByKey('onion-sleep'); }
    }

    const doSwitch = () => {
        window.GameLogic.currentScene = sceneName; window.GameLogic.placingFurnitureKey = null; 
        
        // 離開原本的房間
        leaveCafe(); leaveShrine(); leavePlayroom();

        if (sceneName === "cafe") joinCafe(); 
        else if (sceneName === "shrine") joinShrine(); 
        else if (sceneName === "playroom") joinPlayroom(extraData.roomId);

        window.updateOnlinePlayersUI();
        if (window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) { 
            const game = window.GameLogic.phaserGame; 
            game.scene.stop('MainScene'); game.scene.start('MainScene'); game.scene.bringToTop('UIScene'); 
        }
    };

    if (window.GameLogic.currentUser && window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) {
        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (scene && scene.localPlayer) {
            let newMapW = (sceneName === 'cafe') ? 2048 : 1280;
            let newMapH = (sceneName === 'cafe') ? 2048 : 720;
            let entranceX = newMapW / 2 + 100; let entranceY = newMapH / 2;
            
            // 只有一般場景需要記錄位置，副本不覆蓋最後重生點
            if (sceneName !== 'playroom') {
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(db, `users/${window.GameLogic.currentUser.uid}`), { lastScene: sceneName, lastX: entranceX, lastY: entranceY }));
                window.GameLogic.myProfile.lastScene = sceneName; window.GameLogic.myProfile.lastX = entranceX; window.GameLogic.myProfile.lastY = entranceY;
            }
            
            let cam = scene.cameras.main; 
            let topBlack = scene.add.rectangle(cam.width/2, 0, cam.width, cam.height/2, 0x000000).setOrigin(0.5, 0).setDepth(9999).setScrollFactor(0);
            let botBlack = scene.add.rectangle(cam.width/2, cam.height, cam.width, cam.height/2, 0x000000).setOrigin(0.5, 1).setDepth(9999).setScrollFactor(0);
            topBlack.scaleY = 0; botBlack.scaleY = 0;
            let whiteLine = scene.add.rectangle(cam.width/2, cam.height/2, cam.width, 4, 0xffffff).setDepth(10000).setScrollFactor(0).setAlpha(0);
            
            scene.tweens.add({ targets: [topBlack, botBlack], scaleY: 1, duration: 200, ease: 'Cubic.easeIn', onComplete: () => {
                whiteLine.setAlpha(1);
                scene.tweens.add({ targets: whiteLine, scaleX: 0, duration: 150, ease: 'Power2', onComplete: () => { doSwitch(); } });
            }});
            return; 
        }
    }
    doSwitch();
}

let playroomUnsubscribe = null;
function joinPlayroom(roomId) {
    window.GameLogic.currentRoomId = roomId;
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        const playerRef = module.ref(db, `playroomPlayers/${roomId}/${window.GameLogic.currentUser.uid}`);
        let startX = 640 + (Math.random() * 100 - 50); // 稍微錯開出生點避免疊加卡死
        module.set(playerRef, { x: startX, y: 450, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1 });
        module.onDisconnect(playerRef).remove();
        module.onDisconnect(module.ref(db, `playroomGames/${roomId}/p_${window.GameLogic.currentUser.uid}`)).remove();

        playroomUnsubscribe = module.onValue(module.ref(db, `playroomPlayers/${roomId}`), (snapshot) => { 
            window.GameLogic.playroomPlayers = snapshot.val() || {}; 
            
            // 偵測對方離線邏輯
            let players = window.GameLogic.playroomPlayers;
            let uids = Object.keys(players);
            let modal = document.getElementById('rps-modal');
            if (window.GameLogic.currentRoomId && modal && modal.style.display === 'flex') {
                if (uids.length < 2 && uids.includes(window.GameLogic.currentUser.uid)) {
                    window.handleRpsDisconnect(roomId);
                }
            }
        });
        window.syncRpsState(roomId); 
    });
}
function leavePlayroom() {
    if (window.GameLogic.currentRoomId && window.GameLogic.currentUser) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.set(module.ref(db, `playroomPlayers/${window.GameLogic.currentRoomId}/${window.GameLogic.currentUser.uid}`), null);
            // 離開時防呆：強迫清理正在進行的 RPS
            window.cancelRpsGame(window.GameLogic.currentRoomId);
        });
    }
    if (playroomUnsubscribe) { playroomUnsubscribe(); playroomUnsubscribe = null; }
    window.GameLogic.currentRoomId = null;
    window.GameLogic.playroomPlayers = {};
    if (window.rpsUnsubscribe) { window.rpsUnsubscribe(); window.rpsUnsubscribe = null; }
}
function joinCafe() { const playerRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`); set(playerRef, { x: window.GameLogic.myProfile.lastX || 1024, y: window.GameLogic.myProfile.lastY || 1024, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, bubbleMsg: window.GameLogic.myProfile.bubbleMsg, bubbleTime: window.GameLogic.myProfile.bubbleTime }); onDisconnect(playerRef).remove(); cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => { window.GameLogic.cafePlayers = snapshot.val() || {}; }); }
function leaveCafe() { if (window.GameLogic.currentUser) set(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), null); if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; } }

function gainRewards(coins, exp) {
    let p = window.GameLogic.myProfile; p.coins = (p.coins || 0) + coins; p.exp = (p.exp || 0) + exp; p.sweeps = (p.sweeps || 0) + 1;
    let requiredExp = p.level * 100; let leveledUp = false;
    if (p.exp >= requiredExp) { p.level++; p.exp -= requiredExp; leveledUp = true; }
    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins, exp: p.exp, level: p.level, sweeps: p.sweeps });
    
    let weekId = window.getWeekId(0);
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        let sweepRef = module.ref(window.GameLogic.db, `weeklySweeps/${weekId}/${window.GameLogic.currentUser.uid}`);
        module.get(sweepRef).then(snap => {
            let currentCount = snap.exists() ? snap.val().count : 0;
            module.update(sweepRef, { name: p.name, count: currentCount + 1 });
        });
    });

    if (exp > 0 && window.GameLogic.phaserGame) {
        let uiScene = window.GameLogic.phaserGame.scene.getScene('UIScene');
        if (uiScene && uiScene.playExpGainEffect) uiScene.playExpGainEffect();
    }
    return leveledUp;
}

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        let w = this.cameras.main.width, h = this.cameras.main.height;
        let progressBox = this.add.graphics().fillStyle(0x3e2723, 0.8).fillRoundedRect(w/2 - 160, h/2 - 25, 320, 50, 8).lineStyle(2, 0xc5a059, 1).strokeRoundedRect(w/2 - 160, h/2 - 25, 320, 50, 8);
        let progressBar = this.add.graphics();
        let pt = this.make.text({ x: w/2, y: h/2, text: '0%', style: { font: 'bold 18px Georgia', fill: '#ffffff' } }).setOrigin(0.5, 0.5);
        this.load.on('progress', val => { pt.setText(parseInt(val * 100) + '%'); progressBar.clear().fillStyle(0xc5a059, 1).fillRoundedRect(w/2 - 150, h/2 - 15, 300 * val, 30, 6); });
        this.load.on('complete', () => { progressBar.destroy(); progressBox.destroy(); pt.destroy(); });

        this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/gh/rexrainbow/phaser3-rex-notes@master/dist/rexvirtualjoystickplugin.min.js', true);
        this.load.image('bgCafe', 'cafe-bg.jpg'); this.load.image('bgDoghouse', 'doghouse-bg.jpg'); this.load.image('bgFarm', 'farm-bg.jpg'); this.load.image('bgShrine', 'shrine-bg.jpg'); 
        this.load.image('fridge', 'fridge.png'); this.load.image('memory', 'memory.png'); this.load.image('shrine', 'shrine.png'); this.load.image('doghouse-bed', 'doghouse-bed.png'); 
        this.load.spritesheet('onion-skin', 'onion-skin-sprite.png', { frameWidth: 50, frameHeight: 50 }); this.load.spritesheet('onion-skin-old', 'onion-skin-old-sprite.png', { frameWidth: 65, frameHeight: 65 });
        this.load.image('onion', 'onion-sprite.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-down', 'onion-down.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-up', 'onion-up.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-walk', 'onion-right.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-idle', 'onion-idle.png', { frameWidth: 75, frameHeight: 75 });
        
        this.load.audio('bgm', 'Sweet-Onion.mp3'); this.load.audio('bgm-heart', 'Onion-Heart.mp3'); this.load.audio('bgm-inside', 'Inside-of-Onion.mp3'); this.load.audio('bgm-kyo', 'kyo-kyo-onion.mp3'); this.load.audio('bgm-world', "OMusic-World'll-roll.mp3"); this.load.audio('bgm-lazy', 'OMusic-Onion-Lazy-Cat.mp3'); this.load.audio('bgm-way', 'OMusic-Onion-go-my-way.mp3'); this.load.audio('bgm-corazon', 'OMusic-Onion-acre-Corazon.mp3'); this.load.audio('bgm-fire', 'OMusic-Onion-Got-Fire.mp3');
        this.load.audio('jump04', 'jump04.mp3'); this.load.audio('launcher1', 'launcher1.mp3'); this.load.audio('bomb', 'bomb.mp3'); this.load.audio('fireworks-in-the-sky', 'fireworks-in-the-sky.mp3'); this.load.audio('shop-boss-thank-you', 'shop-boss-thank-you.mp3'); this.load.audio('shop-check-buying', 'shop-check-buying.mp3');

        // 載入米米專屬音效
        this.load.audio('mimi-laugh', 'mimi-laugh.mp3');
        this.load.audio('mimi-thief-stealing', 'mimi-thief-stealing.mp3');
        this.load.audio('mimi-thief-get-down', 'mimi-thief-get-down.mp3');
        this.load.audio('mimi-jab-onion-hurt', 'mimi-jab-onion-hurt.mp3');
        this.load.audio('mimi-walk', 'mimi-walk.mp3');
      
        // 神龕專用音樂
        this.load.audio('shrine-wierd-people-sound', 'shrine-wierd-people-sound.mp3');
        this.load.audio('shrine-selection', 'shrine-selection.mp3');
        this.load.audio('shrine-purify-fight', 'shrine-purify-fight.mp3');
        this.load.audio('shrine-purify-success-win', 'shrine-purify-success-win.mp3');
        this.load.audio('shrine-purify-success', 'shrine-purify-success.mp3');

        // 新增：猜拳連擊按鈕音效與倒數、結算音效
        this.load.audio('playroom-figjt-buttom', 'playroom-figjt-buttom-sound.mp3');
        this.load.audio('playroom-figjt-buttom-sound-2', 'playroom-figjt-buttom-sound-2.mp3');
        this.load.audio('playroom-count-down', 'playroom-count-down.mp3');
        this.load.audio('playroom-count-down-times-up', 'playroom-count-down-times-up.mp3');
        this.load.audio('playroom-figjt-winner', 'playroom-figjt-winner.mp3');
        this.load.audio('playroom-figjt-loser', 'playroom-figjt-loser.mp3');
      
        this.load.audio('onion-sleep', 'onion-sleep.mp3');
        this.load.audio('sleep-wakeup', 'sleep-wakeup-rooster-call.mp3');
        this.load.spritesheet('onion-clean', 'onion-clean.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-sleep', 'onion-sleeping.png', { frameWidth: 75, frameHeight: 75 });
        // 新增：載入蔥電飽充電器精靈圖
        this.load.spritesheet('sleep-charger', 'sleep_onion_bao_charger.png', { frameWidth: 90, frameHeight: 90 });
        this.load.image('bg7Eonion', '7eonion-bg.jpg'); this.load.image('storeManager', 'store-manager.png'); this.load.spritesheet('onion-throw', 'onion-throw.png', { frameWidth: 90, frameHeight: 75 }); this.load.spritesheet('water-ball-blast', 'water-ball-blast.png', { frameWidth: 50, frameHeight: 50 }); this.load.spritesheet('onion-wet', 'onion-wet.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('made-coin', 'made-coin.png', { frameWidth: 50, frameHeight: 50 }); this.load.image('dummy', 'dummy.png'); this.load.spritesheet('dummy-wet', 'dummy-wet.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('dummy-got-shot', 'dummy-got-shot.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('fireworks', 'shop-fireworks.png'); this.load.spritesheet('onion-fireworks', 'onion-fireworks.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-got-shot', 'onion-got-shot.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('mimi-thief-walk', 'mimi-thief-walk.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('fireworks-shoot', 'fireworks-shoot.png', { frameWidth: 50, frameHeight: 50 });
        this.load.spritesheet('mimi-thief-stealing', 'mimi-thief-stealing.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('mimi-laugh', 'mimi-laugh.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('mimi-thief-get-down', 'mimi-thief-get-down.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('plane', 'playroom-onion-friend-plane.png');
        this.load.image('bgPlayroom', 'playroom-bg.jpg');
        this.load.image('rps-machine', 'playroom-rps-machine.png');
        this.load.image('rps-me-ready', 'playroom-rps-onion-me-ready.png');
        this.load.image('rps-other-ready', 'playroom-rps-onion-other-ready.png');
        this.load.image('rps-me-scissors', 'playroom-rps-onion-me-scissors.png');
        this.load.image('rps-me-stone', 'playroom-rps-onion-me-stone.png');
        this.load.image('rps-me-paper', 'playroom-rps-onion-me-paper.png');
        this.load.image('rps-other-scissors', 'playroom-rps-onion-other-scissors.png');
        this.load.image('rps-other-stone', 'playroom-rps-onion-other-stone.png');
        this.load.image('rps-other-paper', 'playroom-rps-onion-other-paper.png');
        this.load.image('rps-win-hit', 'playroom-rps-onion-win-hit.png');
        this.load.image('rps-lose-defense', 'playroom-rps-onion-lose-defense.png');
        this.load.image('rps-win-hit-moving', 'playroom-rps-onion-win-hit-moving.png');
        this.load.image('rps-lose-defense-moving', 'playroom-rps-onion-lose-defense-moving.png');
        this.load.image('status-bg', 'character-status-bg.png');
        
        // 神龕符咒與法器資源
        this.load.image('charm-1', 'shrine-chinese-charm-01.png'); this.load.image('charm-2', 'shrine-chinese-charm-02.png'); this.load.image('charm-3', 'shrine-chinese-charm-03.png'); this.load.image('charm-4', 'shrine-chinese-charm-04.png'); this.load.image('charm-5', 'shrine-chinese-charm-05.png');
        this.load.image('shrine-altar', 'shrine-altar.png'); this.load.image('shrine-seat', 'shrine-no-poo-poo-seat.png'); this.load.image('poo-boss', 'shrine-poo-boss.png');
        this.load.spritesheet('onion-seat-shrine', 'onion-seat-shrine.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-got-purify', 'onion-got-purify.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-doing-purify', 'onion-doing-purify-magic.png', { frameWidth: 75, frameHeight: 75 });
        
        this.load.audio('minimum_laser', 'minimum_laser.mp3'); this.load.audio('powerdown07', 'powerdown07.mp3'); this.load.audio('coin03', 'coin03.mp3'); this.load.audio('brooming1', 'brooming1.mp3'); this.load.audio('chorus_of_angels1', 'chorus_of_angels1.mp3');
        
        this.load.audio('sleep-onion-bao-charge', 'sleep-onion-bao-charge.mp3');
        this.load.audio('sleep-onion-bao-got-money', 'sleep-onion-bao-got-money.mp3');
        this.load.image('hall-screen-in-list', 'hall-screen-in-list.png');
        this.load.image('hall-screen', 'hall-screen.png'); // 改為靜態圖

        // 在記憶體中畫一個簡單的白色發光點紋理給粒子使用
        let grd = this.make.graphics({x: 0, y: 0, add: false});
        grd.fillStyle(0xffffff, 1); grd.fillCircle(4, 4, 4); // 畫一個半徑 4 的圓
        grd.generateTexture('particle_flare', 8, 8); // 生成名為 'particle_flare' 的紋理
    }
   create() {
        // 修正2：經驗條改為橘紅漸層
        let expGr = this.make.graphics({ x:0, y:0, add:false }); expGr.fillStyle(0xff5722, 1); expGr.fillRect(0, 0, 64, 16); expGr.fillStyle(0xff8a65, 0.6); for(let i = -16; i < 64; i += 16) { expGr.beginPath(); expGr.moveTo(i, 0); expGr.lineTo(i+8, 0); expGr.lineTo(i+16, 16); expGr.lineTo(i+8, 16); expGr.closePath(); expGr.fillPath(); } expGr.generateTexture('exp-liquid', 64, 16);
        let fwGr = this.make.graphics({ x:0, y:0, add:false }); fwGr.fillStyle(0xffffff, 1); fwGr.fillCircle(4, 4, 4); fwGr.generateTexture('fw-particle', 8, 8);
        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('onion-down'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('onion-up'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('onion-walk', { start: 0, end: 5 }), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('onion-idle'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'skin-anim', frames: this.anims.generateFrameNumbers('onion-skin', { start: 0, end: 3 }), frameRate: 5, repeat: -1 }); this.anims.create({ key: 'skin-old-anim', frames: this.anims.generateFrameNumbers('onion-skin-old', { start: 0, end: 5 }), frameRate: 5, repeat: -1 }); this.anims.create({ key: 'clean', frames: this.anims.generateFrameNumbers('onion-clean'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'throw', frames: this.anims.generateFrameNumbers('onion-throw'), frameRate: 10, repeat: 0 }); this.anims.create({ key: 'wb-blast', frames: this.anims.generateFrameNumbers('water-ball-blast'), frameRate: 15, repeat: -1 }); this.anims.create({ key: 'wet', frames: this.anims.generateFrameNumbers('onion-wet'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'coin-anim', frames: this.anims.generateFrameNumbers('made-coin'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'dummy-fw-hit', frames: this.anims.generateFrameNumbers('dummy-got-shot'), frameRate: 10, repeat: -1 }); this.anims.create({ key: 'sleep', frames: this.anims.generateFrameNumbers('onion-sleep'), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fw-throw', frames: this.anims.generateFrameNumbers('onion-fireworks'), frameRate: 8, repeat: 2 }); this.anims.create({ key: 'fw-hit', frames: this.anims.generateFrameNumbers('onion-got-shot'), frameRate: 10, repeat: -1 }); 
        this.anims.create({ key: 'fw-shoot', frames: this.anims.generateFrameNumbers('fireworks-shoot'), frameRate: 15, repeat: -1 });
        this.anims.create({ key: 'mimi-walk', frames: this.anims.generateFrameNumbers('mimi-thief-walk'), frameRate: 15, repeat: -1 });
        this.anims.create({ key: 'mimi-steal', frames: this.anims.generateFrameNumbers('mimi-thief-stealing'), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'mimi-laugh', frames: this.anims.generateFrameNumbers('mimi-laugh'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mimi-down', frames: this.anims.generateFrameNumbers('mimi-thief-get-down'), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'seat-idle', frames: this.anims.generateFrameNumbers('onion-seat-shrine'), frameRate: 5, repeat: -1 }); this.anims.create({ key: 'purify-target', frames: this.anims.generateFrameNumbers('onion-got-purify'), frameRate: 8, repeat: -1 }); this.anims.create({ key: 'purify-magic', frames: this.anims.generateFrameNumbers('onion-doing-purify'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'charger-anim', frames: this.anims.generateFrameNumbers('sleep-charger'), frameRate: 8, repeat: -1 });

        this.scene.launch('UIScene'); this.scene.bringToTop('UIScene'); 
        window.GameLogic.phaserLoaded = true;
        if (window.GameLogic.pendingScene) { window.switchScene(window.GameLogic.pendingScene); window.GameLogic.pendingScene = null; }
    }
}

class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }
    create() {
        this.statusContainer = this.add.container(0, 0).setDepth(-2); this.statusBg = this.add.image(0, 0, 'status-bg').setOrigin(0, 1); this.portrait = this.add.sprite(0, 0, 'onion', 0);
        this.nameLevelText = this.add.text(0, 0, '初心者 Lv.1', { fontSize: '14px', color: '#3e2723', fontStyle: 'bold', fontFamily: 'Georgia' }).setOrigin(0.5);
        this.expBarBg = this.add.graphics(); this.expLiquid = this.add.tileSprite(0, 0, 100, 16, 'exp-liquid').setOrigin(0, 0.5); 
        // 修正8：白字深紅邊緣
        this.expText = this.add.text(0, 0, '0/100', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial, sans-serif' }).setOrigin(0.5).setShadow(0, 0, '#8b0000', 4, true, true);
        
        // 新增：體力條 (蔥電飽)
        this.energyBg = this.add.graphics(); this.energyLiquid = this.add.graphics();
        // 修正7：新增 % 數文字，並設定深綠色閃爍(用透明度閃爍替代)
        this.energyText = this.add.text(0, 0, '0%', { fontSize: '10px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial, sans-serif' }).setOrigin(0.5).setShadow(0, 0, '#004d00', 4, true, true);
        this.tweens.add({ targets: this.energyText, alpha: 0.6, yoyo: true, repeat: -1, duration: 800 });
        this.energyZone = this.add.zone(0, 0, 20, 60).setInteractive();
        this.energyZone.on('pointerdown', () => {
            window.GameLogic.energyActive = !window.GameLogic.energyActive;
            let isActive = window.GameLogic.energyActive;
            let ms = this.scene.manager.getScene('MainScene');
            if (ms && ms.localPlayer) sendBubble(isActive ? "⚡ 蔥電飽已啟動！" : "💤 蔥電飽已關機");
            if (isActive) {
                if (!this.energyEmitter) {
                    this.energyEmitter = this.add.particles(0, 0, 'fw-particle', {
                        y: { min: -10, max: 30 }, x: { min: -5, max: 5 }, speedY: { min: -15, max: -30 }, scale: { start: 0.8, end: 0 }, tint: [0x8bc34a, 0xadff2f], blendMode: 'NORMAL', lifespan: 1200, frequency: 300
                    });
                    this.statusContainer.add(this.energyEmitter);
                }
                this.energyEmitter.setPosition(this.energyZone.x, this.energyZone.y - 15);
                this.energyEmitter.start();
            } else { if (this.energyEmitter) this.energyEmitter.stop(); }
        });
        this.statusText = this.add.text(0, 0, '沒怎樣', { fontSize: '15px', color: '#3e2723', fontStyle: 'bold', fontFamily: 'Georgia' }).setOrigin(0.5);
        this.equipText = this.add.text(0, 0, '沒東西', { fontSize: '15px', color: '#3e2723', fontStyle: 'bold', fontFamily: 'Georgia' }).setOrigin(0.5).setInteractive();
        this.statusToggleBtn = this.add.text(0, 0, '🧅', { fontSize: '24px' }).setOrigin(0, 0.5).setInteractive(); this.isStatusCollapsed = false;
        this.equipBlinkTween = null; this.statusBlinkTween = null;

        this.equipText.on('pointerdown', () => { if (window.GameLogic.armedItemState === 'armed' || window.GameLogic.armedItemState === 'ready') { const confModal = document.getElementById('ingame-confirm'); confModal.style.display = 'block'; document.getElementById('ingame-confirm-yes').onclick = () => { confModal.style.display = 'none'; window.stopUsingItem(window.GameLogic.armedItemName || '水球'); }; document.getElementById('ingame-confirm-no').onclick = () => { confModal.style.display = 'none'; }; } });
        this.statusToggleBtn.on('pointerdown', () => { this.isStatusCollapsed = !this.isStatusCollapsed; const gameSize = this.scale.gameSize; const bgW = this.statusBg.displayWidth; const targetX = this.isStatusCollapsed ? 20 - bgW + 10 : 20; this.tweens.add({ targets: this.statusContainer, x: targetX, duration: 300, ease: 'Power2' }); });
        // 修正4：確實將體力條的元件加入狀態容器中
        this.statusContainer.add([ this.statusBg, this.portrait, this.nameLevelText, this.energyBg, this.energyLiquid, this.energyZone, this.energyText, this.expBarBg, this.expLiquid, this.expText, this.statusText, this.equipText, this.statusToggleBtn ]);
        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, { radius: 40, base: this.add.circle(0, 0, 40, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059), thumb: this.add.circle(0, 0, 20, 0xc5a059, 0.8) });
        this.btnA = this.add.circle(0, 0, 30, 0xd9534f).setStrokeStyle(3, 0xffffff).setInteractive(); this.txtA = this.add.text(0, 0, 'A', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.btnB = this.add.circle(0, 0, 30, 0x0077cc).setStrokeStyle(3, 0xffffff).setInteractive(); this.txtB = this.add.text(0, 0, 'B', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.furnBtn = this.add.circle(0, 0, 30, 0x8b5a2b).setStrokeStyle(3, 0xc5a059).setInteractive(); this.furnText = this.add.text(0, 0, '家俱', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.itemBtn = this.add.circle(0, 0, 30, 0x607d8b).setStrokeStyle(3, 0xc5a059).setInteractive(); this.itemText = this.add.text(0, 0, '給西', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        this.itemBtn.on('pointerdown', () => { window.openInventoryModal(); });
        this.furnBtn.on('pointerdown', () => { if (this.furnText.text === '農具') return alert("農具選單尚未開放！"); openFurnitureCatalog(); });
        this.aPressTime = 0;
        this.btnA.on('pointerdown', () => { this.btnA.setFillStyle(0xb52b27); this.aPressTime = Date.now(); });
        this.btnA.on('pointerup', () => { this.btnA.setFillStyle(0xd9534f); let duration = Date.now() - this.aPressTime; const mainScene = this.scene.manager.getScene('MainScene'); if(mainScene) { if (window.GameLogic.placingFurnitureKey) mainScene.events.emit('action_A_place'); else if (duration > 500) mainScene.events.emit('action_A_long'); else mainScene.events.emit('action_A_short'); } });
        
        // 建立法寶選單的華麗粒子背景 (修正偏移與外框範圍)
        this.magicMenuEmitter = this.add.particles(0, 0, 'particle_flare', {
            speed: { min: 10, max: 40 }, angle: { min: 0, max: 360 }, scale: { start: 0.8, end: 0 },
            tint: [0x00ccff, 0xffffff, 0x00ffff], blendMode: 'ADD', lifespan: { min: 600, max: 1200 }, quantity: 8,
            emitZone: { type: 'edge', source: new Phaser.Geom.Rectangle(-160, -55, 320, 110), quantity: 30 }
        }).setDepth(500).stop();

        this.btnB.on('pointerdown', () => { 
            this.btnB.setFillStyle(0x005599); 
            this.bLongPressTriggered = false;
            this.bLongPressTimer = this.time.delayedCall(300, () => {
                this.bLongPressTriggered = true;
                const mainScene = this.scene.manager.getScene('MainScene');
                if (mainScene) mainScene.events.emit('action_B_long');
            });
        });
        this.btnB.on('pointerup', () => { 
            this.btnB.setFillStyle(0x0077cc);
            if (this.bLongPressTimer) this.bLongPressTimer.remove();
            if (!this.bLongPressTriggered) {
                const mainScene = this.scene.manager.getScene('MainScene');
                if (mainScene) mainScene.events.emit('action_B');
            }
        });
        this.btnB.on('pointerout', () => { 
            this.btnB.setFillStyle(0x0077cc);
            if (this.bLongPressTimer) this.bLongPressTimer.remove();
        });
        
        this.scale.on('resize', this.resizeUI, this); this.resizeUI(this.scale.gameSize); window.updateUnreadGlow();
    }
    update() {
        this.expLiquid.tilePositionX -= 0.5;
        if (window.GameLogic.myProfile) {
            let p = window.GameLogic.myProfile; this.nameLevelText.setText(`${p.name || '匿名'} Lv.${p.level || 1}`);
            let currentExp = p.exp || 0; let reqExp = (p.level || 1) * 100; this.expText.setText(`${currentExp}/${reqExp}`);
            let ratio = Phaser.Math.Clamp(currentExp / reqExp, 0, 1); let baseW = this.expBarWidth || 100; this.expLiquid.setSize(baseW * ratio, 16);
            // 繪製垂直體力條
            let eVal = p.energy || 0; let ratioE = Phaser.Math.Clamp(eVal / 100, 0, 1); let curH = this.energyBarH * ratioE;
            this.energyLiquid.clear().fillStyle(0x8bc34a, 1).fillRoundedRect(this.energyBarX - this.energyBarW/2, this.energyBarY + this.energyBarH/2 - curH, this.energyBarW, curH, 4);
            if (window.GameLogic.energyActive && ratioE > 0) { this.energyLiquid.fillStyle(0xffff00, 0.5).fillRoundedRect(this.energyBarX - this.energyBarW/2, this.energyBarY + this.energyBarH/2 - curH, this.energyBarW, curH, 4); }
            if (this.energyText) this.energyText.setText(Math.floor(eVal) + '%');
        }
        if (window.GameLogic.armedItemState) { this.equipText.setText(window.GameLogic.armedItemName || '水球'); if (!this.equipBlinkTween) { this.equipText.setColor('#ffffff'); this.equipText.setShadow(0, 0, '#00aaff', 8, true, true); this.equipBlinkTween = this.tweens.add({ targets: this.equipText, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 }); } } else { this.equipText.setText('沒東西'); if (this.equipBlinkTween) { this.equipBlinkTween.stop(); this.equipBlinkTween = null; this.equipText.setAlpha(1); this.equipText.setColor('#3e2723'); this.equipText.setShadow(0, 0, '#000', 0, false, false); } }
        let ms = this.scene.manager.getScene('MainScene'); let currentStatus = '沒怎樣'; let isStatusActive = false;
        if (ms && ms.localPlayer) { if (ms.localPlayer.isSleeping) { currentStatus = '補眠中'; isStatusActive = true; } else if (ms.localPlayer.isStunned) { currentStatus = '遭受打擊'; isStatusActive = true; } else if (ms.localPlayer.isSweeping) { currentStatus = '打掃中'; isStatusActive = true; } else if (ms.localPlayer.isThrowing) { currentStatus = '攻擊中'; isStatusActive = true; } else if (ms.localPlayer.isSeated) { currentStatus = '入席中'; isStatusActive = true; } }
        this.statusText.setText(currentStatus);
        if (isStatusActive) { if (!this.statusBlinkTween) { this.statusText.setColor('#ff0000'); this.statusText.setShadow(0, 0, '#ffffff', 8, true, true); this.statusBlinkTween = this.tweens.add({ targets: this.statusText, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 }); } } else { if (this.statusBlinkTween) { this.statusBlinkTween.stop(); this.statusBlinkTween = null; this.statusText.setAlpha(1); this.statusText.setColor('#3e2723'); this.statusText.setShadow(0, 0, '#000', 0, false, false); } }
    }
    resizeUI(gameSize) {
        if (!this.joyStick) return; const isPortrait = gameSize.height > gameSize.width; const bottomOffset = isPortrait ? 120 : 20; const joystickX = 90; const joystickY = gameSize.height - 90 - (isPortrait ? 80 : 0);
        this.joyStick.setPosition(joystickX, joystickY); if (this.joyStick.base) this.joyStick.base.setDepth(10); if (this.joyStick.thumb) this.joyStick.thumb.setDepth(10);
        const targetWidth = Math.min(gameSize.width * 0.45, 320); const scaleRatio = targetWidth / this.statusBg.width; this.statusBg.setScale(scaleRatio); 
        // 修正3：手機版頭像縮小
        this.portrait.setScale(isPortrait ? 0.8 : 1);
        const bgW = this.statusBg.displayWidth; const bgH = this.statusBg.displayHeight; const statusX = 20; const statusY = joystickY - 60; const targetX = this.isStatusCollapsed ? statusX - bgW + 10 : statusX;
        this.statusContainer.setPosition(targetX, statusY); this.portrait.setPosition(bgW * 0.5, -bgH * 0.62); this.nameLevelText.setPosition(bgW * 0.5, -bgH * 0.16); this.nameLevelText.setFontSize(`${Math.max(14, 18 * scaleRatio)}px`);
        
        // 蔥電飽能量條位置 (修正7：再拉長計量條並向下對齊，並配置文字)
        let enW = 8; let enH = 110 * scaleRatio; let enX = bgW * 0.22; let enY = -bgH * 0.50;
        this.energyBg.clear().fillStyle(0x3e2723, 0.8).fillRoundedRect(enX - enW/2, enY - enH/2, enW, enH, 4).lineStyle(2, 0xc5a059).strokeRoundedRect(enX - enW/2, enY - enH/2, enW, enH, 4);
        this.energyZone.setPosition(enX, enY).setSize(enW * 4, enH * 1.5);
        this.energyBarH = enH; this.energyBarW = enW; this.energyBarX = enX; this.energyBarY = enY;
        this.energyText.setPosition(enX, enY + enH/2 + 10).setFontSize(`${Math.max(9, 12 * scaleRatio)}px`);
        let expY = -bgH * 0.12 + 4; let expW = bgW * 0.50; let expH = 22 * scaleRatio; this.expBarWidth = expW;
        this.expBarBg.clear().fillStyle(0x3e2723, 0.8).fillRoundedRect(bgW * 0.5 - expW / 2, expY - expH / 2, expW, expH, 4); this.expLiquid.setPosition(bgW * 0.5 - expW / 2, expY).setScale(1, expH / 16); this.expText.setPosition(bgW * 0.5, expY).setFontSize(`${Math.max(10, 13 * scaleRatio)}px`);
        this.statusText.setPosition(bgW * 0.32, -bgH * 0.30).setFontSize(`${Math.max(16, 20 * scaleRatio)}px`); this.equipText.setPosition(bgW * 0.75, -bgH * 0.30).setFontSize(`${Math.max(16, 20 * scaleRatio)}px`); this.statusToggleBtn.setPosition(bgW, -bgH * 0.30);
        let clusterX = gameSize.width - 90; let clusterY = gameSize.height - bottomOffset - 70; let d = 45; 
        this.itemBtn.setPosition(clusterX, clusterY - d); this.itemText.setPosition(this.itemBtn.x, this.itemBtn.y); this.btnA.setPosition(clusterX + d, clusterY); this.txtA.setPosition(this.btnA.x, this.btnA.y); this.btnB.setPosition(clusterX, clusterY + d); this.txtB.setPosition(this.btnB.x, this.btnB.y); this.furnBtn.setPosition(clusterX - d, clusterY); this.furnText.setPosition(this.furnBtn.x, this.furnBtn.y);
        if (this.magicMenuEmitter) this.magicMenuEmitter.setPosition(gameSize.width / 2, gameSize.height - 185);
    }

    playExpGainEffect() {
        this.tweens.add({ targets: [this.expBarBg, this.expLiquid], alpha: 0.5, yoyo: true, repeat: 2, duration: 150 });
        let emitter = this.add.particles(0, 0, 'fw-particle', {
            x: { min: -this.expBarWidth/2, max: this.expBarWidth/2 }, y: 0,
            speed: { min: 20, max: 50 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 },
            tint: 0x81c784, lifespan: 600, blendMode: 'ADD', quantity: 10
        });
        this.statusContainer.add(emitter);
        emitter.setPosition(this.expLiquid.x + this.expBarWidth/2, this.expLiquid.y);
        emitter.explode();
        this.time.delayedCall(1000, () => { emitter.destroy(); });
    }

    // 修正：重塑帶有充電器精靈圖的綠色系睡眠結算面板
    showSleepSummary(timeStr, energyGained, coinsGained) {
        let camW = this.cameras.main.width; let camH = this.cameras.main.height;
        let panel = this.add.container(camW/2, -300).setDepth(1000).setScrollFactor(0);
        
        let bg = this.add.graphics().fillStyle(0x1b5e20, 0.95).fillRoundedRect(-160, -140, 320, 270, 16).lineStyle(4, 0x8bc34a).strokeRoundedRect(-160, -140, 320, 270, 16);
        let img = this.add.sprite(0, -75, 'sleep-charger').setScale(0.9);
        img.play('charger-anim');
        
        let title = this.add.text(0, -15, '⏰ 睡飽啦！', { fontSize: '24px', color: '#b2ff59', fontStyle: 'bold', fontFamily: 'Georgia' }).setOrigin(0.5);
        let t1 = this.add.text(0, 20, `你從 ${timeStr} 睡覺`, { fontSize: '15px', color: '#e8f5e9', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5);
        let t2 = this.add.text(0, 50, `🔋 蔥電飽充了 +${energyGained}%`, { fontSize: '18px', color: '#b2ff59', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5);
        let t3 = this.add.text(0, 80, `💰 銀行存入 +${coinsGained} 馬德幣`, { fontSize: '18px', color: '#ffcc00', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5);
        
        let btnBg = this.add.graphics().fillStyle(0x388e3c, 1).fillRoundedRect(-50, 105, 100, 35, 8);
        let btnTxt = this.add.text(0, 122, '確定', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        let btnZone = this.add.zone(0, 122, 100, 35).setInteractive();
        
        panel.add([bg, img, title, t1, t2, t3, btnBg, btnTxt, btnZone]);
        
        this.tweens.add({ targets: panel, y: camH/2, duration: 600, ease: 'Bounce.easeOut' });
        
        btnZone.once('pointerdown', () => {
            btnBg.clear().fillStyle(0x2e7d32, 1).fillRoundedRect(-50, 105, 100, 35, 8); 
            this.tweens.add({ targets: panel, y: -300, duration: 400, ease: 'Back.easeIn', onComplete: () => panel.destroy() });
        });
        
        // 綠色電流噴發粒子
        let emitter = this.add.particles(camW/2, camH/2 - 75, 'fw-particle', {
            speed: { min: 40, max: 120 }, scale: { start: 1, end: 0 },
            tint: [0x8bc34a, 0x00ff00], blendMode: 'ADD', lifespan: 800, quantity: 25
        }).setDepth(1001).setScrollFactor(0);
        emitter.explode();
        this.time.delayedCall(1000, () => emitter.destroy());
    }
}
class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    create() {
        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        
        // 修正：徹底重構音樂切換邏輯，神龕擁有絕對獨立的背景音樂，不再與儀式狀態綁定
        let allBgms = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'];
        let shrineBgms = ['shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success'];
        
        let volControl = document.getElementById('bgm-volume');
        let vol = volControl ? volControl.value / 100 : 0.5;
        this.currentRitualState = null;

        if (this.sceneName === 'shrine') {
            allBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });
            
            let evData = window.GameLogic.shrineEventData;
            let evState = evData ? evData.state : 'none';
            if (evState !== 'voting' && evState !== 'countdown' && evState !== 'purifying' && evState !== 'success') {
                shrineBgms.forEach(k => { if (k !== 'shrine-wierd-people-sound' && this.sound.getAll(k)) { this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); } });
                let sSnd = this.sound.get('shrine-wierd-people-sound');
                if (!sSnd || !sSnd.isPlaying) {
                    this.sound.removeByKey('shrine-wierd-people-sound');
                    this.sound.add('shrine-wierd-people-sound', { loop: true, volume: vol }).play();
                }
            }
        } else {
            shrineBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });

            let currentTrackKey = allBgms[window.GameLogic.currentTrackIdx] || 'bgm';
            allBgms.forEach(k => { if (k !== currentTrackKey && this.sound.getAll(k)) { this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); } });
            
            let currentSnd = this.sound.get(currentTrackKey);
            if (!currentSnd || !currentSnd.isPlaying) {
                this.sound.removeByKey(currentTrackKey);
                if (this.cache.audio.exists(currentTrackKey)) {
                    this.sound.add(currentTrackKey, { loop: true, volume: vol }).play();
                } else {
                    console.warn("[系統保護] 音樂檔 " + currentTrackKey + " 尚未載入或遺失，已跳過播放以防止遊戲崩潰。");
                }
            }
        }
        
        this.cameras.main.setBackgroundColor('#1a1008');
        let cam = this.cameras.main;
        let topBlack = this.add.rectangle(cam.width/2, 0, cam.width, cam.height/2, 0x000000).setOrigin(0.5, 0).setDepth(9999).setScrollFactor(0);
        let botBlack = this.add.rectangle(cam.width/2, cam.height, cam.width, cam.height/2, 0x000000).setOrigin(0.5, 1).setDepth(9999).setScrollFactor(0);
        let whiteLine = this.add.rectangle(cam.width/2, cam.height/2, cam.width, 4, 0xffffff).setDepth(10000).setScrollFactor(0);
        whiteLine.scaleX = 0;
        
        this.tweens.add({ targets: whiteLine, scaleX: 1, duration: 150, ease: 'Power2', onComplete: () => {
            whiteLine.setAlpha(0);
            this.tweens.add({ targets: [topBlack, botBlack], scaleY: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: () => { topBlack.destroy(); botBlack.destroy(); whiteLine.destroy(); } });
        }});

        const mapW = this.isCafe ? 2048 : 1280; const mapH = this.isCafe ? 2048 : 720;
        this.physics.world.setBounds(0, 0, mapW, mapH); this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.trashes = [];
        
        if (this.isCafe) {
            this.leaderboardListener = onValue(ref(window.GameLogic.db, `weeklySweeps/${window.getWeekId(0)}`), (snap) => {
                let data = snap.val() || {}; let sorted = Object.values(data).sort((a, b) => b.count - a.count);
                window.GameLogic.currentTop3 = sorted.slice(0, 3);
                if (window.GameLogic.currentScoreboard) {
                    let f = window.GameLogic.currentScoreboard;
                    f.top1Text.setText('1. ' + (sorted[0] ? `${sorted[0].name} (${sorted[0].count})` : '---'));
                    f.top2Text.setText('2. ' + (sorted[1] ? `${sorted[1].name} (${sorted[1].count})` : '---'));
                    f.top3Text.setText('3. ' + (sorted[2] ? `${sorted[2].name} (${sorted[2].count})` : '---'));
                }
            });
            this.add.tileSprite(0, 0, mapW, mapH, 'bgCafe').setOrigin(0, 0); this.time.addEvent({ delay: 2000, callback: this.spawnTrash, callbackScope: this, loop: true });
            const mapSize = 120; const marginX = 20; const marginY = 60;
            this.minimap = this.cameras.add(this.cameras.main.width - mapSize - marginX, marginY, mapSize, mapSize).setZoom(mapSize / 2048).setName('minimap'); this.minimap.setBackgroundColor('rgba(26, 16, 8, 0.7)'); this.minimap.centerOn(1024, 1024);
            this.scale.on('resize', (gameSize) => { if (this.minimap) this.minimap.setPosition(gameSize.width - mapSize - marginX, marginY); });
            this.trashListener = onValue(ref(window.GameLogic.db, 'cafeTrashes'), (snap) => { let data = snap.val() || {}; for (let key in data) { if (!this.trashes.find(t => t.key === key)) { let tData = data[key]; let isOld = tData.type === 'old'; let spriteKey = isOld ? 'onion-skin-old' : 'onion-skin'; let animKey = isOld ? 'skin-old-anim' : 'skin-anim'; let skin = this.physics.add.sprite(tData.x, tData.y, spriteKey).setDepth(4); skin.play(animKey); skin.type = isOld ? 'onion-skin-old' : 'onion-skin'; skin.key = key; this.trashes.push(skin); } } this.trashes = this.trashes.filter(t => { if (!data[t.key]) { t.destroy(); if (this.closestTrash === t) { this.closestTrash = null; if (this.localPlayer && this.localPlayer.isSweeping) { this.localPlayer.isSweeping = false; this.qteContainer.setVisible(false); if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1'); } } return false; } return true; }); });
       } else if (this.sceneName === "doghouse") {
            this.add.image(mapW/2, mapH/2, 'bgDoghouse').setDisplaySize(mapW, mapH); 
            this.doghouseFurnListener = onValue(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}/doghouseFurniture`), (snap) => { 
                window.GameLogic.doghouseFurniture = snap.val() || {}; 
            });
        } else if (this.sceneName === "farm") {
            this.add.image(mapW/2, mapH/2, 'bgFarm').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "shrine") {
            this.add.image(mapW/2, mapH/2, 'bgShrine').setDisplaySize(mapW, mapH); this.shrineFurnListener = onValue(ref(window.GameLogic.db, 'shrineFurniture'), (snap) => { window.GameLogic.shrineFurniture = snap.val() || {}; });
            this.purifyBarBg = this.add.graphics().setDepth(200).setVisible(false); this.purifyBar = this.add.graphics().setDepth(201).setVisible(false);
            this.countdownText = this.add.text(mapW/2, mapH/2, '', { fontSize: '72px', fontStyle: 'bold', color: '#fff', stroke: '#8a2be2', strokeThickness: 8 }).setOrigin(0.5).setDepth(300).setVisible(false);
        } else if (this.sceneName === "7eonion") {
            this.add.image(mapW/2, mapH/2, 'bg7Eonion').setDisplaySize(mapW, mapH); this.storeManager = this.physics.add.staticSprite(mapW/2, mapH/2, 'storeManager').setDepth(5); let imgW = this.storeManager.width; let imgH = this.storeManager.height; this.storeManager.body.setSize(120, 120); this.storeManager.body.setOffset((imgW - 120) / 2, (imgH - 120) / 2); 
            this.smBubbleBg = this.add.graphics().setDepth(6); this.smBubbleText = this.add.text(mapW/2, mapH/2 - 90, '好想離職......', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(7);
            const smPhrases = ["好想離職......", "這裡怎麼還沒倒......", "洋蔥好臭啊......"]; let phraseIdx = 0; const updateSMBubble = () => { this.smBubbleText.setText(smPhrases[phraseIdx]); const bounds = this.smBubbleText.getBounds(); const boxWidth = bounds.width + 16, boxHeight = bounds.height + 12; const boxX = this.smBubbleText.x - boxWidth / 2, boxY = this.smBubbleText.y - boxHeight / 2; this.smBubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8).strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8); phraseIdx = (phraseIdx + 1) % smPhrases.length; }; updateSMBubble(); this.time.addEvent({ delay: 4000, callback: updateSMBubble, callbackScope: this, loop: true });
        } else if (this.sceneName === "playroom") {
            this.add.image(mapW/2, mapH/2, 'bgPlayroom').setDisplaySize(mapW, mapH);
            this.rpsMachine = this.physics.add.staticSprite(mapW/2, mapH/2, 'rps-machine').setDepth(5);
        }

        const uiScene = this.scene.manager.getScene('UIScene');
        if (uiScene && uiScene.furnText) {
            let t = '家俱';
            if (this.sceneName === 'farm') t = '農具';
            else if (this.sceneName === 'shrine') t = '法器';
            else if (this.sceneName === 'playroom') t = '玩具';
            uiScene.furnText.setText(t);
        }

        this.otherPlayers = {}; this.furnitureSprites = {}; this.dummySprites = {}; this.coinSprites = {};
        
        if (this.isCafe || this.sceneName === "7eonion" || this.sceneName === "shrine") { 
            this.coinsListener = onValue(ref(window.GameLogic.db, 'droppedCoins'), (snap) => { 
                let data = snap.val() || {}; 
                for (let key in data) { 
                    // 修正2：如果金幣是神龕發出的，且當前不在神龕場景，則直接過濾不渲染，解決商店殘留問題
                    if (key.startsWith('shrine_coin_') && this.sceneName !== 'shrine') continue;
                    
                    if (!this.coinSprites[key]) { 
                        let cData = data[key]; 
                        let coinSprite = this.physics.add.sprite(cData.x, cData.y, 'made-coin').setDepth(8); 
                        coinSprite.play('coin-anim', true); 
                        coinSprite.amount = cData.amount || 5; 
                        this.coinSprites[key] = coinSprite; 
                    } 
                } 
                for (let key in this.coinSprites) { if (!data[key]) { this.coinSprites[key].destroy(); delete this.coinSprites[key]; } } 
            });
            this.dummiesListener = onValue(ref(window.GameLogic.db, 'cafeDummies'), (snap) => { let data = snap.val() || {}; for (let key in data) { if (!this.dummySprites[key]) { let dData = data[key]; let dummySprite = this.physics.add.sprite(dData.x, dData.y, 'dummy').setDepth(8); this.dummySprites[key] = dummySprite; } } for (let key in this.dummySprites) { if (!data[key]) { this.dummySprites[key].destroy(); delete this.dummySprites[key]; } } });
          this.mimiListener = onValue(ref(window.GameLogic.db, 'cafeMimi'), (snap) => {
                let data = snap.val(); window.GameLogic.cafeMimiData = data;
                if (data && data.active) {
                   if (!this.mimiSprite) {
                        this.mimiSprite = this.physics.add.sprite(data.x, data.y, 'mimi-thief-walk').setDepth(11);
                        this.mimiNameBg = this.add.graphics().setDepth(12);
                        this.mimiNameText = this.add.text(0, 0, '鼠偷米米', { fontSize: '12px', color: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
                        this.mimiHpText = this.add.text(0, 0, '', { fontSize: '14px', color: '#ff0000', fontStyle: 'bold', stroke: '#fff', strokeThickness: 2 }).setOrigin(0.5).setDepth(12);
                        window.playSFX(this, 'mimi-laugh');
                        
                        // 【新增】只要他還在場上，就自動無限循環走路音效
                        let mVol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 100) / 100;
                        if (this.sound.get('mimi-walk')) this.sound.play('mimi-walk', {loop: true, volume: mVol});
                        else this.sound.add('mimi-walk', {loop: true, volume: mVol}).play();
                    }
                    if (Math.abs(this.mimiSprite.x - data.x) > 50) { this.mimiSprite.x = data.x; this.mimiSprite.y = data.y; }
                    else { this.mimiSprite.x = Phaser.Math.Linear(this.mimiSprite.x, data.x, 0.3); this.mimiSprite.y = Phaser.Math.Linear(this.mimiSprite.y, data.y, 0.3); }
                    this.mimiSprite.setFlipX(data.flipX);

                    if (data.state === 'stealing' && data.stealingFrom === window.GameLogic.currentUser.uid && !this.localPlayer.isMimiRobbed) {
                        this.localPlayer.isMimiRobbed = true; this.localPlayer.isStunned = true; this.localPlayer.isInvincible = true; this.localPlayer.sprite.play('fw-hit', true);
                        
                        window.playSFX(this, 'mimi-thief-stealing');
                        window.playSFX(this, 'mimi-jab-onion-hurt'); // 角色被痛扁的音效

                        let p = window.GameLogic.myProfile; let amt = Math.min(Phaser.Math.Between(20, 100), p.coins || 0); p.coins -= amt;
                        let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins;
                        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                            module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins });
                            module.update(module.ref(window.GameLogic.db, 'cafeMimi'), { stolenPool: (data.stolenPool || 0) + amt });
                            module.update(module.ref(window.GameLogic.db, `cafeMimi/stolenUids`), { [window.GameLogic.currentUser.uid]: true });
                        });
                        
                        // 修正：延長玩家被打劫後的閃爍與僵直時間為 3 秒
                        sendBubble(`被老鼠偷走了 ${amt} 元！`); 
                        this.time.delayedCall(3000, () => { this.localPlayer.isStunned = false; this.localPlayer.isInvincible = false; });
                    }
                    if (data.state !== 'stealing' && this.localPlayer.isMimiRobbed) this.localPlayer.isMimiRobbed = false;

                    if (data.state === 'laughing' && !this.mimiLaughed) { this.mimiLaughed = true; window.playSFX(this, 'mimi-laugh'); }
                    if (data.state !== 'laughing') this.mimiLaughed = false;
                    
                    if (data.state !== 'down' && this.mimiSprite.isBlinking) {
                        this.mimiSprite.isBlinking = false;
                        this.tweens.killTweensOf(this.mimiSprite);
                        this.mimiSprite.setAlpha(1);
                    }

                    if (data.state === 'stealing') this.mimiSprite.play('mimi-steal', true);
                    else if (data.state === 'laughing') this.mimiSprite.play('mimi-laugh', true);
                    else if (data.state === 'down') { 
                        if (this.mimiSprite.anims.currentAnim?.key !== 'mimi-down') {
                            this.mimiSprite.play('mimi-down', true);
                        }
                        if (!this.mimiSprite.isBlinking) {
                            this.mimiSprite.isBlinking = true;
                            // 閃爍維持三秒後才會因為 active 變 false 被清除
                            this.tweens.add({ targets: this.mimiSprite, alpha: 0.2, yoyo: true, repeat: -1, duration: 150 });
                        }
                        if (this.sound.get('mimi-walk')) this.sound.stopByKey('mimi-walk'); 
                    }
                    else this.mimiSprite.play('mimi-walk', true);

                    let nmY = this.mimiSprite.y - 40; this.mimiNameText.setPosition(this.mimiSprite.x, nmY);
                    this.mimiNameBg.clear().fillStyle(0x000, 0.6).fillRoundedRect(this.mimiSprite.x - 30, nmY - 10, 60, 20, 4);
                    this.mimiHpText.setPosition(this.mimiSprite.x, nmY - 20).setText(data.hp > 0 ? `HP: ${data.hp}` : '');
                } else {
                    if (this.mimiSprite) { 
                        this.mimiSprite.destroy(); this.mimiNameText.destroy(); this.mimiNameBg.destroy(); this.mimiHpText.destroy(); this.mimiSprite = null; 
                        // 徹底斷開走路音效
                        if (this.sound.get('mimi-walk')) this.sound.stopByKey('mimi-walk');
                    }
                }
            });
        }

        // 修正：尊重 Firebase 或本地保險中最後儲存的座標，不再強制鎖定於地圖正中央
        let startX = window.GameLogic.myProfile.lastX || (mapW / 2 + 100); 
        let startY = window.GameLogic.myProfile.lastY || (mapH / 2);
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true); this.localPlayer.isSweeping = false; this.localPlayer.isSleeping = false; this.localPlayer.isSeated = false;
        
        // 修正2：判斷剛登入睡覺時，強制鎖定睡覺狀態並隱藏，避免被 Update 迴圈抓去房間中央移動
        let isInitSleeping = this.sceneName === 'doghouse' && window.GameLogic.myProfile.sleepStartTime && window.GameLogic.myProfile.sleepStartTime > 0;
        if (isInitSleeping) {
            this.localPlayer.isSleeping = true;
            this.localPlayer.sprite.setAlpha(0);
        } else {
            this.tweens.add({ targets: this.localPlayer.sprite, alpha: 0, yoyo: true, repeat: 5, duration: 100, onComplete: () => { this.localPlayer.sprite.setAlpha(1); } });
        }
        if (this.sceneName === "7eonion" && this.storeManager) this.physics.add.collider(this.localPlayer.sprite, this.storeManager);
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        this.smartPromptBg = this.add.graphics().setDepth(100).setVisible(false); this.smartPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#4a5d4e' }).setOrigin(0.5).setDepth(101).setVisible(false);
        this.waterPromptBg = this.add.graphics().setDepth(100).setVisible(false); this.waterPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(101).setVisible(false);
        this.lockOnTarget = this.add.text(0, 0, '🎯', { fontSize: '28px' }).setOrigin(0.5).setDepth(150).setVisible(false); this.tweens.add({ targets: this.lockOnTarget, scaleX: 1.2, scaleY: 1.2, yoyo: true, repeat: -1, duration: 400 });
        if (this.minimap) this.minimap.ignore([this.smartPromptBg, this.smartPromptText, this.waterPromptBg, this.waterPromptText, this.lockOnTarget]);

        this.cursors = this.input.keyboard.createCursorKeys(); this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.spaceKey.on('down', (e) => { if (!e.repeat && document.activeElement.tagName !== 'INPUT') this.spacePressTime = Date.now(); });
        this.spaceKey.on('up', () => { if (document.activeElement.tagName === 'INPUT') return; let duration = Date.now() - this.spacePressTime; if (window.GameLogic.placingFurnitureKey) this.events.emit('action_A_place'); else if (duration > 500) this.events.emit('action_A_long'); else this.events.emit('action_A_short'); });
        
        this.shiftKey.on('down', (e) => { 
            if (!e.repeat && document.activeElement.tagName !== 'INPUT') {
                this.shiftLongPressTriggered = false;
                this.shiftLongPressTimer = this.time.delayedCall(300, () => {
                    this.shiftLongPressTriggered = true;
                    this.events.emit('action_B_long');
                });
            }
        });
        this.shiftKey.on('up', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            if (this.shiftLongPressTimer) this.shiftLongPressTimer.remove();
            if (!this.shiftLongPressTriggered) this.events.emit('action_B');
        });

        this.qteContainer = this.add.container(0, 0).setVisible(false).setDepth(300); const qteBg = this.add.graphics().fillStyle(0x3e2723, 0.8).fillRoundedRect(-52, -10, 104, 20, 10).lineStyle(2, 0xc5a059).strokeRoundedRect(-52, -10, 104, 20, 10); this.qteBar = this.add.graphics(); const qteLabel = this.add.text(0, -25, '打掃進度', { fontSize: '14px', color: '#c5a059', fontStyle: 'bold' }).setOrigin(0.5); this.qteContainer.add([qteBg, this.qteBar, qteLabel]); if (this.minimap) this.minimap.ignore([qteBg, this.qteBar, qteLabel, this.qteContainer]);

        this.sleepTopBg = this.add.graphics().setDepth(150).setVisible(false); this.sleepTopText = this.add.text(0, 0, '按A起床', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} }).setOrigin(0.5).setDepth(151).setVisible(false); this.sleepBotBg = this.add.graphics().setDepth(150).setVisible(false); this.sleepBotText = this.add.text(0, 0, 'zzZ', { fontSize: '16px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#3e2723' }).setOrigin(0.5).setDepth(151).setVisible(false); this.sleepZzzArray = ['zzZ', 'Zzz', 'zZz']; this.sleepZzzIdx = 0; this.time.addEvent({ delay: 1000, callback: () => { if (this.localPlayer && this.localPlayer.isSleeping) { this.sleepZzzIdx = (this.sleepZzzIdx + 1) % 3; this.sleepBotText.setText(this.sleepZzzArray[this.sleepZzzIdx]); let bounds = this.sleepBotText.getBounds(); let w = bounds.width + 16, h = bounds.height + 12; let x = this.sleepBotText.x - w/2, y = this.sleepBotText.y - h/2; this.sleepBotBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(x, y, w, h, 8).strokeRoundedRect(x, y, w, h, 8); } }, loop: true });

        // 修正1：在註冊按鈕事件前，強制清除舊的監聽器，徹底解決場景切換導致「按一下變按兩下」的疊加 BUG
        this.events.off('action_A_place');
        this.events.off('action_A_short');
        this.events.off('action_A_long');
        this.events.off('action_B');

        this.events.on('action_A_place', () => { let key = window.GameLogic.placingFurnitureKey; if(key && this.furnitureSprites[key]) { let f = this.furnitureSprites[key]; f.sprite.setVelocity(0, 0); let path = this.isCafe ? `cafeFurniture/${key}` : (this.sceneName === 'doghouse' ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${key}` : `shrineFurniture/${key}`); update(ref(window.GameLogic.db, path), { locked: true, x: f.sprite.x, y: f.sprite.y, ownerUid: window.GameLogic.currentUser.uid }); window.GameLogic.placingFurnitureKey = null; this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08); } });

        this.events.on('action_A_short', () => {
            if (this.localPlayer.isSleeping) { 
                this.localPlayer.isSleeping = false; this.sleepTopBg.setVisible(false); this.sleepTopText.setVisible(false); this.sleepBotBg.setVisible(false); this.sleepBotText.setVisible(false); this.localPlayer.sprite.play('idle'); 
                if (this.sound.get('onion-sleep')) this.sound.stopByKey('onion-sleep');
                window.playSFX(this, 'sleep-wakeup');
                
                let p = window.GameLogic.myProfile;
                if (p.sleepStartTime && p.sleepStartTime > 0) {
                    let elapsedMs = Date.now() - p.sleepStartTime;
                    let hours = elapsedMs / (1000 * 60 * 60);
                    // 修正1：將結算門檻降到 10 秒防刷即可，不必等到一分鐘
                    if (elapsedMs > 10000) {
                        let addEnergy = Math.min(100, hours * 25);
                        let addMoney = Math.min(1000 - (p.energyBank || 0), hours * 180);
                        if(addMoney < 0) addMoney = 0;
                        
                        p.energy = Math.min(100, (p.energy || 0) + addEnergy);
                        p.energyBank = (p.energyBank || 0) + addMoney;
                        
                        let pad = (n) => n.toString().padStart(2, '0');
                        let sD = new Date(p.sleepStartTime); let eD = new Date();
                        let timeStr = `${pad(sD.getHours())}:${pad(sD.getMinutes())} ~ ${pad(eD.getHours())}:${pad(eD.getMinutes())}`;
                        
                        let uiScene = this.scene.manager.getScene('UIScene');
                        if (uiScene && uiScene.showSleepSummary) {
                            uiScene.showSleepSummary(timeStr, addEnergy.toFixed(1), Math.floor(addMoney));
                        }
                        
                        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { energy: p.energy, energyBank: p.energyBank, sleepStartTime: 0 });
                   } else {
                        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { sleepStartTime: 0 });
                    }
                    p.sleepStartTime = 0;
                    localStorage.removeItem('onion_sleepStartTime');
                }
                return;
            }
            if (this.localPlayer.isSeated) return;
            if (this.sceneName === 'shrine') { for (let key in this.furnitureSprites) { if (key === 'altar') { let f = this.furnitureSprites[key]; if (f.sprite.isLocked && Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y) < 150) { document.getElementById('summon-confirm-modal').style.display = 'block'; return; } } } }
            if (this.sceneName === 'doghouse') { for (let key in this.furnitureSprites) { if (key.includes('bed')) { let f = this.furnitureSprites[key]; if (f.sprite.isLocked && Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y) < 90) { 
                this.localPlayer.isSleeping = true; this.localPlayer.sprite.setPosition(f.sprite.x, f.sprite.y); this.localPlayer.sprite.play('sleep', true); 
                this.sleepTopText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 100); this.sleepBotText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 65); this.sleepBotBg.setVisible(true); 
                let bounds = this.sleepBotText.getBounds(); let w = bounds.width + 16, h = bounds.height + 12; let x = this.sleepBotText.x - w/2, y = this.sleepBotText.y - h/2; 
                this.sleepBotBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(x, y, w, h, 8).strokeRoundedRect(x, y, w, h, 8); 
                let vol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 100) / 100; 
                if (vol > 0) { if (this.sound.get('onion-sleep')) this.sound.play('onion-sleep', {loop: true, volume: vol}); else this.sound.add('onion-sleep', {loop: true, volume: vol}).play(); } 
                window.GameLogic.myProfile.sleepStartTime = Date.now(); 
                localStorage.setItem('onion_sleepStartTime', window.GameLogic.myProfile.sleepStartTime);
                
                // 視覺等待防呆：繪製綠色提示框與精靈圖
                let cam = this.cameras.main;
                let guardContainer = this.add.container(cam.scrollX + cam.width/2, cam.scrollY + cam.height/2).setDepth(1000);
                let gBg = this.add.graphics().fillStyle(0x1b5e20, 0.95).fillRoundedRect(-120, -80, 240, 160, 16).lineStyle(4, 0x8bc34a).strokeRoundedRect(-120, -80, 240, 160, 16);
                let gImg = this.add.sprite(0, -20, 'sleep-charger').setScale(0.8);
                gImg.play('charger-anim');
                let gText = this.add.text(0, 45, '蔥電飽連結中...', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5);
                guardContainer.add([gBg, gImg, gText]);
                
                // 動畫：連結中閃爍
                let gTween = this.tweens.add({ targets: gImg, alpha: 0.4, yoyo: true, repeat: -1, duration: 400 });

                // 修正：躺床時同步記錄床的精準座標，確保下次登入就在床上
                window.GameLogic.myProfile.lastX = f.sprite.x;
                window.GameLogic.myProfile.lastY = f.sprite.y;

                // 強制等待 Firebase 回傳存檔成功的 Promise 訊號，並儲存精準座標
                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
                    sleepStartTime: window.GameLogic.myProfile.sleepStartTime,
                    lastX: f.sprite.x,
                    lastY: f.sprite.y
                }).then(() => {
                    gText.setText('蔥電飽已接上 zzZ').setColor('#b2ff59');
                    gTween.stop(); gImg.setAlpha(1);
                    window.playSFX(this, 'sleep-onion-bao-charge');
                    
                    // 電流噴發粒子
                    let emitter = this.add.particles(cam.scrollX + cam.width/2, cam.scrollY + cam.height/2 - 20, 'fw-particle', {
                        speed: { min: 50, max: 150 }, scale: { start: 1, end: 0 },
                        tint: [0x8bc34a, 0x00ff00], blendMode: 'ADD', lifespan: 800, quantity: 30
                    }).setDepth(1001);
                    emitter.explode();
                    
                    this.time.delayedCall(1500, () => {
                        guardContainer.destroy(); emitter.destroy();
                        sendBubble("開始掛機充電囉..."); 
                    });
                });
                return; 
            } } } }

           if (window.GameLogic.armedItemState === 'ready') {
                let itemName = window.GameLogic.armedItemName || '水球';
                let inv = window.GameLogic.myProfile.inventory || {};
                
                if (window.GameLogic.energyActive) {
                    let currentEnergy = window.GameLogic.myProfile.energy || 0;
                    if (currentEnergy >= 5) {
                        window.GameLogic.myProfile.energy = currentEnergy - 5;
                        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { energy: window.GameLogic.myProfile.energy });
                    } else {
                        sendBubble("體力不足以遠距施放，鎖定解除！");
                        window.GameLogic.energyActive = false;
                    }
                }

                inv[itemName] = Math.max(0, (inv[itemName] || 0) - 1);
                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv });
                if (inv[itemName] > 0) { window.GameLogic.armedItemState = 'ready'; } else { window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null; sendBubble("法寶已耗盡！"); }
                
                let targetUid = window.GameLogic.currentTargetUid;
                let targetSprite = window.GameLogic.currentTargetSprite;
                let targetType = window.GameLogic.currentTargetType;
                if (itemName === '蔥友機') {
                    if (targetType === 'player' && targetUid) {
                        if (window.GameLogic.activeInvite) { sendBubble("你已經有一個邀請在進行中了！"); return; }
                        if (window.GameLogic.planeCooldowns && window.GameLogic.planeCooldowns[targetUid] && Date.now() - window.GameLogic.planeCooldowns[targetUid] < 60000) {
                            sendBubble("對方剛拒絕或超時，請稍等一分鐘再邀請！"); return;
                        }
                    }
                    
                    window.playSFX(this, 'launcher1');
                    this.localPlayer.sprite.play('throw', true);
                    this.localPlayer.isThrowing = true;
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    
                    // 新增11：向全服發送投擲動畫訊號
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `serverEvents/planeThrows/${window.GameLogic.currentUser.uid}`), { time: Date.now(), targetUid: targetUid, scene: this.sceneName }); });
                    
                    if (targetUid && targetSprite) {
                        let plane = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'plane').setDepth(15);
                        this.tweens.add({
                            targets: plane, x: targetSprite.x, y: targetSprite.y, duration: 400, onComplete: () => {
                                plane.destroy();
                                if (targetType === 'player') {
                                    window.GameLogic.activeInvite = true;
                                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(window.GameLogic.db, `serverEvents/planeHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid, attackerName: window.GameLogic.myProfile.name }));
                                    sendBubble("蔥友機發射！等待對方回應...");
                                    
                                    // 15 秒超時判斷
                                    window.GameLogic.inviteTimeout = setTimeout(() => { 
                                        if (window.GameLogic.activeInvite) { 
                                            window.GameLogic.activeInvite = false; 
                                            window.GameLogic.planeCooldowns = window.GameLogic.planeCooldowns || {}; 
                                            window.GameLogic.planeCooldowns[targetUid] = Date.now(); 
                                            sendBubble("對方無回應..."); 
                                        } 
                                    }, 16000);
                                } else if (targetType === 'mimi') {
                                    this.handleMimiHit(targetSprite.x, targetSprite.y);
                                }
                            }
                        });
                    } else {
                        sendBubble("紙飛機往空無一人的地方飛去了...");
                    }
                    return; // 結束蔥友機邏輯
                }
                if (targetSprite) { this.localPlayer.sprite.setFlipX(targetSprite.x < this.localPlayer.sprite.x); }
                
                if (itemName === '煙火') {
                    window.playSFX(this, 'launcher1');
                    this.localPlayer.sprite.play('fw-throw', true);
                    this.localPlayer.isThrowing = true;
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    update(ref(window.GameLogic.db, `serverEvents/fireworkThrows/${window.GameLogic.currentUser.uid}`), { time: Date.now(), scene: this.sceneName });
                    
                    if (targetUid && targetSprite) {
                        let fw = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'fireworks-shoot').setDepth(15);
                        fw.play('fw-shoot', true);
                        this.tweens.add({
                            targets: fw, x: targetSprite.x, y: targetSprite.y, duration: 300, onComplete: () => {
                                fw.destroy();
                                this.createMiniExplosion(targetSprite.x, targetSprite.y);
                                if (targetType === 'player') {
                                    update(ref(window.GameLogic.db, `serverEvents/fireworksHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                } else if (targetType === 'dummy') {
                                    update(ref(window.GameLogic.db, `serverEvents/fireworksDummyHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                    for (let i = 0; i < 3; i++) {
                                        let cx = targetSprite.x + Phaser.Math.Between(-40, 40); let cy = targetSprite.y + Phaser.Math.Between(-40, 40) + 20;
                                        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: 15 }); });
                                    }
                                } else if (targetType === 'mimi') {
                                    this.handleMimiHit(targetSprite.x, targetSprite.y);
                                }
                            }
                        });
                    } else {
                        update(ref(window.GameLogic.db, 'serverEvents/globalFireworks'), { time: Date.now(), scene: this.sceneName, initiator: window.GameLogic.currentUser.uid });
                        sendBubble("施放了全頻煙火！");
                    }
                } else {
                    // 水球邏輯
                    window.playSFX(this, 'minimum_laser');
                    this.localPlayer.sprite.play('throw', true);
                    this.localPlayer.isThrowing = true;
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    
                    if (targetUid && targetSprite) {
                        let wb = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'water-ball-blast').setDepth(15);
                        wb.setFrame(0);
                        this.tweens.add({
                            targets: wb, x: targetSprite.x, y: targetSprite.y, duration: 200, onComplete: () => {
                                window.playSFX(this, 'powerdown07');
                                wb.play('wb-blast', true);
                                this.time.delayedCall(300, () => { wb.destroy(); });
                                if (targetType === 'player') {
                                    update(ref(window.GameLogic.db, `serverEvents/waterHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                } else if (targetType === 'dummy') {
                                    update(ref(window.GameLogic.db, `serverEvents/dummyHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                    for (let i = 0; i < 3; i++) {
                                        let cx = targetSprite.x + Phaser.Math.Between(-40, 40); let cy = targetSprite.y + Phaser.Math.Between(-40, 40) + 20;
                                        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: 5 }); });
                                    }
                                } else if (targetType === 'mimi') {
                                    this.handleMimiHit(targetSprite.x, targetSprite.y);
                                }
                            }
                        });
                    } else {
                        sendBubble("把水球砸向了空地...");
                    }
                }
                return; 
            }

            if (this.localPlayer.isSweeping) { let vol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 100) / 100; if (!window.GameLogic.muteSFX && !this.sound.get('brooming1')?.isPlaying && vol > 0) { if (this.sound.get('brooming1')) this.sound.play('brooming1', {volume: vol}); else this.sound.add('brooming1', {volume: vol}).play(); } this.qteProgress += (100 / this.qteTotalClicks); if (this.qteProgress >= 100) { this.qteProgress = 100; this.finishSweeping(true); } return; }
            if (this.sceneName === '7eonion' && this.storeManager) { 
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, this.storeManager.x, this.storeManager.y); 
                if (dist < 150) { 
                    window.GameLogic.isShopping = true; let storeCoinsEl = document.getElementById('store-current-coins'); if (storeCoinsEl) storeCoinsEl.innerText = `💰 ${window.GameLogic.myProfile.coins || 0}`; document.getElementById('store-modal').style.display = 'block'; return; 
                } 
            }
            if (this.sceneName === 'playroom' && this.rpsMachine) { 
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, this.rpsMachine.x, this.rpsMachine.y); 
                if (dist < 150) { 
                    window.openRpsBetting(window.GameLogic.currentRoomId);
                    return; 
                } 
            }
            if(!this.isCafe) return sendBubble("對著空氣揮舞了雙手!"); let interacted = false; for (const key in this.furnitureSprites) { let f = this.furnitureSprites[key]; if (!f.sprite.isLocked) continue; let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y); if (dist < 90) { if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block'; if (key.startsWith('memory')) document.getElementById('memory-modal').style.display = 'block'; if (key.includes('scoreboard')) { window.openLeaderboardModal(); interacted = true; break; } if (key === 'shrine') { window.attemptJoinShrine(); interacted = true; break; } } } if(!interacted) sendBubble("使用了 A 技能!");
        });

        window.closeQuickMenu = () => {
            document.getElementById('quick-select-menu').style.display = 'none';
            let blocker = document.getElementById('magic-menu-blocker');
            if (blocker) blocker.style.display = 'none';
            let uiScene = window.GameLogic.phaserGame.scene.getScene('UIScene');
            if (uiScene && uiScene.magicMenuEmitter) uiScene.magicMenuEmitter.stop();
        };

        window.selectQuickMagic = (name) => {
            window.closeQuickMenu();
            window.GameLogic.stagedMagicItem = name;
            if (!name || name === 'none') {
                window.GameLogic.armedItemState = null;
                window.GameLogic.armedItemName = null;
                sendBubble('已收起法寶');
            } else {
                let inv = window.GameLogic.myProfile.inventory || {};
                if (inv[name] > 0) {
                    window.GameLogic.armedItemState = 'ready'; // 直接裝填為發射狀態
                    window.GameLogic.armedItemName = name;
                    sendBubble(`已裝填法寶：${name}`);
                } else {
                    sendBubble("法寶庫存不足！");
                    window.GameLogic.armedItemState = null;
                    window.GameLogic.armedItemName = null;
                }
            }
        };

        this.events.off('action_B_long');
        this.events.on('action_B_long', () => {
            let menu = document.getElementById('quick-select-menu');
            let blocker = document.getElementById('magic-menu-blocker');
            let uiScene = this.scene.manager.getScene('UIScene');
            let inv = window.GameLogic.myProfile.inventory || {};
            let container = document.getElementById('quick-items-container');
            
            let magics = [
                { name: 'none', icon: '<span style="font-size:24px; pointer-events:none;">❌</span>', qty: '' },
                { name: '水球', icon: '<div class="sprite-waterball" style="transform: scale(0.8); transform-origin: center; pointer-events:none;"></div>', qty: inv['水球'] || 0 },
                { name: '煙火', icon: '<img src="shop-fireworks.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['煙火'] || 0 },
                { name: '蔥友機', icon: '<img src="playroom-onion-friend-plane.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['蔥友機'] || 0 }
            ];
            
            let html = `<div style="flex: 0 0 calc(50% - 30px);"></div>`;
            magics.forEach((m) => {
                let qtyHtml = m.name !== 'none' ? `<div style="position:absolute; bottom:-5px; right:0px; font-size:13px; font-weight:bold; color:#005599; text-shadow:0 0 4px #fff, 0 0 4px #fff;">x${m.qty}</div>` : '';
                html += `<div class="quick-item" data-magic="${m.name}" onclick="window.selectQuickMagic('${m.name}')">
                            ${m.icon}${qtyHtml}
                         </div>`;
            });
            html += `<div style="flex: 0 0 calc(50% - 30px);"></div>`;
            container.innerHTML = html; 
            
            window.GameLogic.stagedMagicItem = 'none';
            
            container.onscroll = () => {
                let centerPoint = container.scrollLeft + container.offsetWidth / 2;
                let items = container.querySelectorAll('.quick-item');
                let closest = null; let minDiff = Infinity;
                items.forEach(el => {
                    let elCenter = el.offsetLeft + el.offsetWidth / 2;
                    let diff = Math.abs(elCenter - centerPoint);
                    if (diff < minDiff) { minDiff = diff; closest = el; }
                    el.classList.remove('staged');
                });
                if (closest) {
                    closest.classList.add('staged');
                    window.GameLogic.stagedMagicItem = closest.getAttribute('data-magic');
                }
            };
            
            menu.style.display = 'flex';
            if (blocker) blocker.style.display = 'block';
            if (uiScene && uiScene.magicMenuEmitter) uiScene.magicMenuEmitter.start();
            
            setTimeout(() => { 
                let sel = window.GameLogic.armedItemName || 'none';
                let targetEl = container.querySelector(`[data-magic="${sel}"]`);
                if (targetEl) {
                    container.scrollTo({ left: targetEl.offsetLeft - container.offsetWidth/2 + targetEl.offsetWidth/2 });
                } else {
                    container.scrollLeft = 0; 
                }
                container.dispatchEvent(new Event('scroll')); 
            }, 50);
        });

        this.events.on('action_B', () => {
            let menu = document.getElementById('quick-select-menu');
            if (menu && menu.style.display === 'flex') {
                window.selectQuickMagic(window.GameLogic.stagedMagicItem);
                return; 
            }
            
            // 開關切換邏輯：如果有配戴法寶，單按B變成裝備與卸下的切換鍵
            if (window.GameLogic.armedItemName) {
                if (window.GameLogic.armedItemState === 'ready') {
                    window.GameLogic.armedItemState = null;
                    sendBubble(`已卸下${window.GameLogic.armedItemName}，進入待機`);
                } else {
                    let inv = window.GameLogic.myProfile.inventory || {};
                    if (inv[window.GameLogic.armedItemName] > 0) {
                        window.GameLogic.armedItemState = 'ready';
                        sendBubble(`已裝填法寶：${window.GameLogic.armedItemName}`);
                    } else {
                        sendBubble("法寶庫存不足！");
                        window.GameLogic.armedItemState = null;
                        window.GameLogic.armedItemName = null;
                    }
                }
                return;
            }

            if (this.localPlayer.isSleeping) return;
            
            if (this.sceneName === 'shrine') { 
                if (this.localPlayer.isSeated) { 
                    this.localPlayer.isSeated = false; this.localPlayer.sprite.play('idle'); 
                    update(ref(window.GameLogic.db, `shrinePlayers/${window.GameLogic.currentUser.uid}`), { isSeated: false }); 
                    return; 
                } else { 
                    // 修正2：尋找「距離最近」的坐墊，解決重疊或多個坐墊時被錯誤吸走的問題
                    let closestSeat = null; let minSeatDist = 150;
                    for (let key in this.furnitureSprites) { 
                        if (key.startsWith('seat_')) { 
                            let f = this.furnitureSprites[key]; 
                            if (f.sprite.isLocked) {
                                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                                if (dist < minSeatDist) { minSeatDist = dist; closestSeat = f; }
                            }
                        } 
                    }
                    if (closestSeat) {
                        this.localPlayer.isSeated = true; this.localPlayer.sprite.setVelocity(0, 0); 
                        this.localPlayer.sprite.setPosition(closestSeat.sprite.x, closestSeat.sprite.y - 15); 
                        this.localPlayer.sprite.play('seat-idle', true); 
                        update(ref(window.GameLogic.db, `shrinePlayers/${window.GameLogic.currentUser.uid}`), { isSeated: true, x: closestSeat.sprite.x, y: closestSeat.sprite.y - 15 }); 
                        return; 
                    }
                } 
            }
            
            if (!this.localPlayer.isSweeping && this.closestTrash) { this.localPlayer.isSweeping = true; this.qteProgress = 0; this.qteTotalClicks = Phaser.Math.Between(5, 10); this.qteContainer.setVisible(true); } else if (!this.localPlayer.isSweeping) { sendBubble("使用了 B 技能!"); }
        });

        this.placePrompt = this.add.text(0, 0, '洋蔥精靈: 按A確定擺放', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} }).setOrigin(0.5).setDepth(20).setVisible(false); if (this.minimap) this.minimap.ignore(this.placePrompt);
      
        this.hitListener = onValue(ref(window.GameLogic.db, `serverEvents/waterHits/${window.GameLogic.currentUser.uid}`), (snap) => { let data = snap.val(); if (data && data.time && (Date.now() - data.time < 2000)) { if (this.localPlayer.isInvincible) return; this.localPlayer.isInvincible = true; this.localPlayer.isStunned = true; this.localPlayer.sprite.play('wet', true); let p = window.GameLogic.myProfile; let loss = Math.min(p.coins || 0, 15); p.coins -= loss; update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins }); let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins; let amounts = [12, 12, 11]; for (let i = 0; i < 3; i++) { let cx = this.localPlayer.sprite.x + Phaser.Math.Between(-40, 40); let cy = this.localPlayer.sprite.y + Phaser.Math.Between(-40, 40) + 20; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: amounts[i] }); }); } this.time.delayedCall(500, () => { this.localPlayer.isStunned = false; }); this.time.delayedCall(1500, () => { this.localPlayer.isInvincible = false; }); remove(ref(window.GameLogic.db, `serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)); } });
        this.fwHitListener = onValue(ref(window.GameLogic.db, `serverEvents/fireworksHits/${window.GameLogic.currentUser.uid}`), (snap) => { let data = snap.val(); if (data && data.time && (Date.now() - data.time < 2000)) { if (this.localPlayer.isInvincible) return; window.playSFX(this, 'bomb'); this.localPlayer.isInvincible = true; this.localPlayer.isStunned = true; this.localPlayer.sprite.play('fw-hit', true); let p = window.GameLogic.myProfile; let loss = Math.min(p.coins || 0, 100); p.coins -= loss; update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins }); let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins; if (loss > 0) { let amounts = [Math.floor(loss * 0.4), Math.floor(loss * 0.3), loss - Math.floor(loss * 0.4) - Math.floor(loss * 0.3)]; for (let i = 0; i < 3; i++) { if(amounts[i] <= 0) continue; let cx = this.localPlayer.sprite.x + Phaser.Math.Between(-50, 50); let cy = this.localPlayer.sprite.y + Phaser.Math.Between(-50, 50) + 20; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: amounts[i] }); }); } } this.time.delayedCall(500, () => { this.localPlayer.isStunned = false; }); this.time.delayedCall(1500, () => { this.localPlayer.isInvincible = false; }); remove(ref(window.GameLogic.db, `serverEvents/fireworksHits/${window.GameLogic.currentUser.uid}`)); } });
        this.fwPlayersHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/fireworksHits'), (snap) => { let hits = snap.val() || {}; for (let uid in hits) { if (uid === window.GameLogic.currentUser.uid) continue; let data = hits[uid]; if (data && data.time && (Date.now() - data.time < 2000)) { if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { let opSprite = this.otherPlayers[uid].sprite; if (!opSprite.isStunned) { window.playSFX(this, 'bomb'); opSprite.isStunned = true; opSprite.play('fw-hit', true); this.time.delayedCall(1500, () => { if (opSprite && opSprite.active) opSprite.isStunned = false; }); } } } } });
        this.fwDummyHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/fireworksDummyHits'), (snap) => { let hits = snap.val() || {}; for (let key in hits) { let data = hits[key]; if (data && data.time && (Date.now() - data.time < 2000) && this.furnitureSprites[key]) { let dummy = this.furnitureSprites[key].sprite; if (dummy && !dummy.isStunned) { window.playSFX(this, 'bomb'); dummy.isStunned = true; dummy.play('dummy-fw-hit', true); this.time.delayedCall(1500, () => { if (dummy && dummy.active) { dummy.isStunned = false; dummy.anims.stop(); dummy.setTexture('dummy'); } }); } } } });
        this.globalFwListener = onValue(ref(window.GameLogic.db, 'serverEvents/globalFireworks'), (snap) => { let data = snap.val(); if (data && data.time && (Date.now() - data.time < 3000) && data.scene === this.sceneName) { if (this.lastGlobalFwTime !== data.time) { this.lastGlobalFwTime = data.time; this.playGlobalFireworks(); } } });
        this.fwThrowsListener = onValue(ref(window.GameLogic.db, 'serverEvents/fireworkThrows'), (snap) => { let throws = snap.val() || {}; for (let uid in throws) { if (uid === window.GameLogic.currentUser.uid) continue; let data = throws[uid]; if (data && data.time && (Date.now() - data.time < 1000) && data.scene === this.sceneName) { if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { let opSprite = this.otherPlayers[uid].sprite; opSprite.play('fw-throw', true); opSprite.isThrowing = true; this.time.delayedCall(300, () => { if (opSprite && opSprite.active) opSprite.isThrowing = false; }); } } } });
        this.playersHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/waterHits'), (snap) => { let hits = snap.val() || {}; for (let uid in hits) { if (uid === window.GameLogic.currentUser.uid) continue; let data = hits[uid]; if (data && data.time && (Date.now() - data.time < 2000)) { if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { let opSprite = this.otherPlayers[uid].sprite; if (!opSprite.isStunned) { opSprite.isStunned = true; opSprite.play('wet', true); this.time.delayedCall(1500, () => { if (opSprite && opSprite.active) opSprite.isStunned = false; }); } } } } });
        this.dummyHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/dummyHits'), (snap) => { let hits = snap.val() || {}; for (let key in hits) { let data = hits[key]; if (data && data.time && (Date.now() - data.time < 2000) && this.furnitureSprites[key]) { let dummy = this.furnitureSprites[key].sprite; if (dummy && !dummy.isStunned) { dummy.isStunned = true; dummy.play('dummy-fw-hit', true); this.time.delayedCall(1500, () => { if (dummy && dummy.active) { dummy.isStunned = false; dummy.anims.stop(); dummy.setTexture('dummy'); } }); } } } });
        
        // 新增11：全服接收他人發射蔥友機的動畫
        this.planeThrowsListener = onValue(ref(window.GameLogic.db, 'serverEvents/planeThrows'), (snap) => { 
            let throws = snap.val() || {}; 
            for (let uid in throws) { 
                if (uid === window.GameLogic.currentUser.uid) continue; 
                let data = throws[uid]; 
                if (data && data.time && (Date.now() - data.time < 1000) && data.scene === this.sceneName) { 
                    if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { 
                        let opSprite = this.otherPlayers[uid].sprite; 
                        opSprite.play('throw', true); 
                        window.playSFX(this, 'launcher1'); 
                        let targetX = opSprite.x + (opSprite.flipX ? -200 : 200);
                        let targetY = opSprite.y;
                        if (data.targetUid && this.otherPlayers[data.targetUid]) {
                            targetX = this.otherPlayers[data.targetUid].sprite.x;
                            targetY = this.otherPlayers[data.targetUid].sprite.y;
                        } else if (data.targetUid === window.GameLogic.currentUser.uid) {
                            targetX = this.localPlayer.sprite.x;
                            targetY = this.localPlayer.sprite.y;
                        }
                        let plane = this.physics.add.sprite(opSprite.x, opSprite.y, 'plane').setDepth(15);
                        this.tweens.add({ targets: plane, x: targetX, y: targetY, duration: 400, onComplete: () => plane.destroy() });
                    } 
                } 
            } 
        });

        // 接收邀請
        this.planeHitsListener = onValue(ref(window.GameLogic.db, `serverEvents/planeHits/${window.GameLogic.currentUser.uid}`), (snap) => {
            let data = snap.val(); 
            if (data && data.time && (Date.now() - data.time < 5000)) { 
                let modal = document.getElementById('invite-modal');
                if (modal.style.display !== 'block') {
                    document.getElementById('invite-sender-name').innerText = data.attackerName || '某人';
                    window.currentInviteAttacker = data.attacker;
                    modal.style.display = 'block';
                    
                    let remain = 15;
                    document.getElementById('invite-timer').innerText = remain;
                    window.inviteTimerInterval = setInterval(() => {
                        remain--;
                        document.getElementById('invite-timer').innerText = remain;
                        if (remain <= 0) {
                            clearInterval(window.inviteTimerInterval);
                            window.replyInvite('no');
                        }
                    }, 1000);
                }
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.remove(module.ref(window.GameLogic.db, `serverEvents/planeHits/${window.GameLogic.currentUser.uid}`))); 
            } 
        });

        // 接收對方的回覆
        this.inviteRepliesListener = onValue(ref(window.GameLogic.db, `serverEvents/inviteReplies/${window.GameLogic.currentUser.uid}`), (snap) => {
            let data = snap.val();
            if (data && data.time && (Date.now() - data.time < 5000) && window.GameLogic.activeInvite) {
                window.GameLogic.activeInvite = false;
                if (window.GameLogic.inviteTimeout) clearTimeout(window.GameLogic.inviteTimeout);

                if (data.reply === 'yes') {
                    sendBubble("對方接受了你的友情昇華！");
                    window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null;
                    let roomId = `playroom_${window.GameLogic.currentUser.uid}_${data.replierUid}`;
                    window.switchScene('playroom', { roomId: roomId });
                } else {
                    sendBubble("對方殘酷地拒絕了你。");
                    window.GameLogic.planeCooldowns = window.GameLogic.planeCooldowns || {};
                    window.GameLogic.planeCooldowns[data.replierUid] = Date.now();
                }
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.remove(module.ref(window.GameLogic.db, `serverEvents/inviteReplies/${window.GameLogic.currentUser.uid}`))); 
            }
        });

        // 建立蔥電飽專屬綠色往上飄特效 (優化效能並確保隨身顯示)
        this.playerEnergyEmitter = this.add.particles(0, 0, 'fw-particle', {
            speedY: { min: -10, max: -25 }, x: { min: -25, max: 25 },
            scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
            tint: [0x8bc34a, 0xadff2f, 0xffcc00], blendMode: 'NORMAL',
            lifespan: 1200, frequency: 400
        }).setDepth(15);
        this.playerEnergyEmitter.stop();
        this.playerEnergyEmitter.isEnergyEmitting = false; // 自製旗標防呆，避免頻繁呼叫 start 導致卡頓

        this.events.on('shutdown', () => {
            if (this.leaderboardListener) this.leaderboardListener(); 
            if (this.trashListener) this.trashListener();
            if (this.coinsListener) this.coinsListener(); 
            if (this.dummiesListener) this.dummiesListener(); 
            if (this.planeHitsListener) this.planeHitsListener();
            if (this.inviteRepliesListener) this.inviteRepliesListener();
            if (this.planeThrowsListener) this.planeThrowsListener(); // 新增：離開場景時註銷
            
            // 【修正1 & 2】：離開場景時，徹底註銷米米監聽器並強制切斷走路音效
            if (this.mimiListener) this.mimiListener(); 
            if (this.sound && this.sound.get('mimi-walk')) this.sound.stopByKey('mimi-walk');
            
            if (this.hitListener) this.hitListener(); 
            if (this.fwHitListener) this.fwHitListener(); 
            if (this.fwPlayersHitListener) this.fwPlayersHitListener(); 
            if (this.fwDummyHitListener) this.fwDummyHitListener(); 
            if (this.globalFwListener) this.globalFwListener(); 
            if (this.playersHitListener) this.playersHitListener(); 
            if (this.dummyHitListener) this.dummyHitListener(); 
            if (this.fwThrowsListener) this.fwThrowsListener(); 
        });
    }

    createMiniExplosion(x, y) {
        let allColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800]; let mixColors = [Phaser.Utils.Array.GetRandom(allColors), Phaser.Utils.Array.GetRandom(allColors), Phaser.Utils.Array.GetRandom(allColors)];
        let particles = this.add.particles(x, y, 'fw-particle', { speed: { min: 100, max: 250 }, angle: { min: 0, max: 360 }, scale: { start: 1.5, end: 0 }, blendMode: 'ADD', tint: mixColors, lifespan: { min: 1000, max: 2000 }, gravityY: 100, quantity: 60 });
        particles.setDepth(200); particles.explode(); this.time.delayedCall(2000, () => particles.destroy());
    }
    playGlobalFireworks() {
        window.playSFX(this, 'fireworks-in-the-sky'); let cam = this.cameras.main; let colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8800];
        for (let i = 0; i < 7; i++) { this.time.delayedCall(i * 500, () => { let x = cam.scrollX + Phaser.Math.Between(100, cam.width - 100); let y = cam.scrollY + Phaser.Math.Between(100, cam.height - 100); let mixColors = [Phaser.Utils.Array.GetRandom(colors), Phaser.Utils.Array.GetRandom(colors), Phaser.Utils.Array.GetRandom(colors)]; let emitter = this.add.particles(x, y, 'fw-particle', { speed: { min: 200, max: 450 }, angle: { min: 0, max: 360 }, scale: { start: 2, end: 0 }, blendMode: 'ADD', tint: mixColors, lifespan: { min: 1500, max: 3000 }, gravityY: 150, quantity: 100 }); emitter.setDepth(200); emitter.explode(); let flash = this.add.circle(x, y, 150, mixColors[0], 0.5).setDepth(199).setBlendMode('ADD'); this.tweens.add({ targets: flash, alpha: 0, scale: 2.5, duration: 600, onComplete: () => flash.destroy() }); this.time.delayedCall(3000, () => emitter.destroy()); }); }
    }
    spawnTrash() {
        if (!this.isCafe) return; let playerCount = Object.keys(window.GameLogic.cafePlayers || {}).length || 1; let limits = [10, 12, 15, 17, 20]; let maxTrash = limits[Math.min(playerCount - 1, 4)]; let spawnChance = 0.3 + (playerCount * 0.1); let currentTrashCount = this.trashes.length;
        if (Math.random() < spawnChance && currentTrashCount < maxTrash) { let tx = Phaser.Math.Between(150, 1898); let ty = Phaser.Math.Between(150, 1898); let isOld = Math.random() < 0.05; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'cafeTrashes'), { x: tx, y: ty, type: isOld ? 'old' : 'normal' }); }); }
    }
    updateQTEBar(progress) { this.qteBar.clear(); let width = Math.min(100, (progress / 100) * 100); this.qteBar.fillStyle(0xd9534f, 1); this.qteBar.fillRoundedRect(-50, -8, width, 16, 8); }
    createPlayerEntity(x, y, pData, isLocal = false) { let entity = { sprite: this.physics.add.sprite(x, y, 'onion').setCollideWorldBounds(true).setDepth(10) }; if (!isLocal) { entity.sprite.setInteractive(); entity.sprite.on('pointerdown', (pointer) => { const actionMenu = document.getElementById("action-menu"); actionMenu.style.display = "flex"; actionMenu.style.left = pointer.event.pageX + "px"; actionMenu.style.top = pointer.event.pageY + "px"; actionMenu.dataset.uid = pData.uid; }); } 
        // 修正1：使用 Container 取代直接繪製，解決每幀重繪造成的掉幀問題
        entity.nameContainer = this.add.container(x, y).setDepth(12); entity.nameBg = this.add.graphics(); entity.nameText = this.add.text(0, 0, pData.name || '匿名', { fontSize: '13px', fontFamily: 'Georgia', color: pData.color || '#fff', fontStyle: 'bold' }).setOrigin(0.5); entity.nameContainer.add([entity.nameBg, entity.nameText]);
        entity.bubbleContainer = this.add.container(x, y).setDepth(14).setVisible(false); entity.bubbleBg = this.add.graphics(); entity.bubbleText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', wordWrap: { width: 160, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5); entity.bubbleContainer.add([entity.bubbleBg, entity.bubbleText]);
        entity.lastNameData = ""; entity.lastBubbleData = ""; if (this.minimap) this.minimap.ignore([entity.nameContainer, entity.bubbleContainer]); return entity; 
    }
    updatePlayerEntity(entity, pData) { let sx = entity.sprite.x; let sy = entity.sprite.y; let displayName = `${pData.name || '匿名'} Lv.${pData.level || 1}`; let nameHash = displayName + (pData.color || ''); 
        if (entity.lastNameData !== nameHash) { entity.lastNameData = nameHash; entity.nameText.setText(displayName); if(pData.color) entity.nameText.setColor(pData.color); const nameBounds = entity.nameText.getBounds(); const bgWidth = nameBounds.width + 16; entity.nameBg.clear().fillStyle(0x000000, 0.6).fillRoundedRect(-bgWidth / 2, -10, bgWidth, 20, 4); }
        entity.nameContainer.setPosition(sx, sy - 45);
        if (pData.bubbleMsg && (Date.now() - pData.bubbleTime < 10000)) { entity.bubbleContainer.setVisible(true); 
            if (entity.lastBubbleData !== pData.bubbleMsg) { entity.lastBubbleData = pData.bubbleMsg; entity.bubbleText.setText(pData.bubbleMsg); const bounds = entity.bubbleText.getBounds(); const boxWidth = bounds.width + 20, boxHeight = bounds.height + 16; entity.bubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8).strokeRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8); }
            const bounds = entity.bubbleText.getBounds(); entity.bubbleContainer.setPosition(sx, sy - 65 - (bounds.height + 16) / 2);
        } else { entity.bubbleContainer.setVisible(false); } 
    }
    createFurniture(key, data) { 
        let imgKey = key.includes('scoreboard') ? 'hall-screen' : (key.includes('fridge') ? 'fridge' : (key.includes('shrine') ? 'shrine' : (key.includes('dummy') ? 'dummy' : (key.includes('bed') ? 'doghouse-bed' : (key === 'altar' ? 'shrine-altar' : (key.startsWith('seat_') ? 'shrine-seat' : 'memory')))))); 
        let f = { sprite: this.physics.add.sprite(data.x, data.y, imgKey).setDepth(5).setCollideWorldBounds(true) }; 
        f.sprite.isLocked = data.locked; 
        if (imgKey === 'dummy') { 
            f.bubbleContainer = this.add.container(data.x, data.y).setDepth(14).setVisible(false); f.bubbleBg = this.add.graphics(); f.bubbleText = this.add.text(0, 0, '', { fontSize: '12px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', wordWrap: { width: 100, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5); f.bubbleContainer.add([f.bubbleBg, f.bubbleText]); f.lastBubbleData = ""; if (this.minimap) this.minimap.ignore(f.bubbleContainer); f.dummyMsgs = ["我在這幹嘛？", "怎麼有洋蔥？", "該不會要打我吧......"]; f.msgIndex = 0; f.lastMsgTime = 0; f.isHit = false; 
        } 
        if (imgKey === 'hall-screen') {
            f.sprite.setOrigin(0.5, 0.5); // 靜態圖不需播放動畫

            // ====== [新增] 邊框粒子特效邏輯 ======
            const borderW = 300; const borderH = 300; // 看板尺寸
            const hw = borderW / 2; const hh = borderH / 2;
            
            // 定義粒子沿著矩形邊框跑動的邊界 (相對於實體中心)
            // 分別是：上、右、下、左 四條線段
            f.particleZones = [
                { source: new Phaser.Geom.Line(-hw, -hh, hw, -hh), type: 'edge', quantity: 20 }, // Top
                { source: new Phaser.Geom.Line(hw, -hh, hw, hh), type: 'edge', quantity: 20 },   // Right
                { source: new Phaser.Geom.Line(hw, hh, -hw, hh), type: 'edge', quantity: 20 },   // Bottom
                { source: new Phaser.Geom.Line(-hw, hh, -hw, -hh), type: 'edge', quantity: 20 }  // Left
            ];

            // 建立粒子發射器，深度設在家具之下 (5)
            f.particleEmitter = this.add.particles(data.x, data.y, 'particle_flare', {
                lifespan: { min: 800, max: 1500 }, // 粒子存活時間
                speed: { min: 10, max: 40 },       // 些微的擴散速度
                scale: { start: 0.6, end: 0, ease: 'Sine.easeIn' }, // 逐漸變小消失
                blendMode: 'ADD',                   // 屬性：相加，更閃亮
                alpha: { start: 1, end: 0 },       // 逐漸透明
                emitZone: f.particleZones,          // 指定發射區域為上面的邊框線段
                // 顏色：白、藍、紫、粉 (使用更亮麗的色調)
                color: [0xffffff, 0x00ccff, 0x9933ff, 0xff66cc],
                colorEase: 'quad.out',
                frequency: 50, // 發射頻率
                // 不規律跳動：增加隨知的 Y 軸重力與 X 軸隨機震動
                gravityY: -20,
                x: { min: -5, max: 5 },
            }).setDepth(4.5); // 深度設在實體 (5) 和文字 (6) 之下

            if (this.minimap) this.minimap.ignore(f.particleEmitter);
            // =====================================

            f.textContainer = this.add.container(data.x, data.y).setDepth(6);
            f.titleText = this.add.text(0, -60, '本週掃地王', { fontSize: '18px', fontStyle: 'bold', color: '#ffcc00', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
            f.top1Text = this.add.text(0, -20, '1. ---', { fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
            f.top2Text = this.add.text(0, 10, '2. ---', { fontSize: '14px', color: '#ccc', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
            f.top3Text = this.add.text(0, 40, '3. ---', { fontSize: '14px', color: '#cd7f32', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
            f.textContainer.add([f.titleText, f.top1Text, f.top2Text, f.top3Text]);
            if (this.minimap) this.minimap.ignore(f.textContainer);
            window.GameLogic.currentScoreboard = f;
            if (window.GameLogic.currentTop3) {
                let sorted = window.GameLogic.currentTop3;
                f.top1Text.setText('1. ' + (sorted[0] ? `${sorted[0].name} (${sorted[0].count})` : '---'));
                f.top2Text.setText('2. ' + (sorted[1] ? `${sorted[1].name} (${sorted[1].count})` : '---'));
                f.top3Text.setText('3. ' + (sorted[2] ? `${sorted[2].name} (${sorted[2].count})` : '---'));
            }
        }
        return f; 
    }
    finishSweeping(success) { 
        this.localPlayer.isSweeping = false; this.qteContainer.setVisible(false); 
        if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1'); 
        if (success && this.closestTrash) { 
            let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y - 40; 
            let trashKey = this.closestTrash.key; let isOld = this.closestTrash.type === 'onion-skin-old'; 
            
            // 修正9：體力滿電啟動時，扣除 2% 體力，經驗 x2，金錢 x3
            let expGain = 10; let totalCoins = isOld ? Phaser.Math.Between(50, 60) : Phaser.Math.Between(10, 18);
            if (window.GameLogic.energyActive && (window.GameLogic.myProfile.energy || 0) >= 2) {
                window.GameLogic.myProfile.energy -= 2;
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { energy: window.GameLogic.myProfile.energy }); });
                expGain *= 2; totalCoins *= 3;
            }

            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.remove(module.ref(window.GameLogic.db, 'cafeTrashes/' + trashKey)); }); 
            this.closestTrash = null; let leveledUp = gainRewards(0, expGain); 
            if (leveledUp) { window.playSFX(this, 'chorus_of_angels1'); } 
            
            let coinAmounts = [Math.floor(totalCoins/3), Math.floor(totalCoins/3), totalCoins - 2*Math.floor(totalCoins/3)];
            // 補回遺失的噴發金幣邏輯與閉合括號
            for (let i = 0; i < 3; i++) { 
                let cx = px + Phaser.Math.Between(-40, 40); 
                let cy = py + Phaser.Math.Between(-40, 40) + 20; 
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: coinAmounts[i] }); }); 
            } 
        } 
    }

    startPurifyEffects() {
        if (this.purifyEffectsActive) return; this.purifyEffectsActive = true; 
        
        let camW = this.cameras.main.width; let camH = this.cameras.main.height;
        
        // 修正：將下雨特效改為「細長、快速」的雨絲效果，增加儀式的緊湊感
        this.rainEmitter = this.add.particles(0, 0, 'fw-particle', { 
            x: { min: 0, max: this.physics.world.bounds.width }, 
            y: -50, 
            speedY: { min: 800, max: 1200 }, 
            speedX: { min: -20, max: 20 }, 
            scaleX: { start: 0.1, end: 0.2 }, 
            scaleY: { start: 3, end: 6 }, 
            alpha: 0.4, 
            tint: 0xaaaaee, 
            lifespan: 1000, 
            quantity: 20 
        }).setDepth(190);
        
        // 大型集氣條外框閃爍 (座標與進度條統一使用 camW, camH)
        this.purifyBarBg.clear().fillStyle(0x3e2723, 0.8).fillRoundedRect(camW/2 - 200, camH * 0.75 - 100, 400, 40, 20).lineStyle(5, 0xff0000).strokeRoundedRect(camW/2 - 200, camH * 0.75 - 100, 400, 40, 20).setVisible(true).setScrollFactor(0); 
        this.purifyBar.setVisible(true).setScrollFactor(0);
        if (!this.purifyBarTween) { this.purifyBarTween = this.tweens.add({ targets: this.purifyBarBg, alpha: 0.6, scaleX: 1.02, scaleY: 1.05, yoyo: true, repeat: -1, duration: 150 }); }
        
        // 集氣條專屬火焰特效
        this.barFireEmitter = this.add.particles(0, 0, 'fw-particle', {
            x: { min: camW/2 - 190, max: camW/2 + 190 },
            y: camH * 0.75 - 75,
            speedY: { min: -40, max: -100 },
            scale: { start: 1.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xff4500, 0xff8c00, 0xffd700],
            blendMode: 'ADD',
            lifespan: 600,
            quantity: 4
        }).setDepth(202).setScrollFactor(0);
    }

    stopPurifyEffects(success) {
        if (!this.purifyEffectsActive) return; this.purifyEffectsActive = false; 

        if (this.rainEmitter) this.rainEmitter.destroy(); 
        if (this.barFireEmitter) this.barFireEmitter.destroy(); 

        this.purifyBarBg.setVisible(false); this.purifyBar.setVisible(false);
        if (this.purifyBarTween) { this.purifyBarTween.stop(); this.purifyBarTween = null; this.purifyBarBg.setScale(1).setAlpha(1); }
        if (success) { let rays = this.add.graphics().setDepth(195); rays.fillStyle(0xffffff, 0.3); for (let i=0; i<10; i++) { rays.fillTriangle( this.localPlayer.sprite.x, this.localPlayer.sprite.y, this.localPlayer.sprite.x - 500 + Math.random()*1000, this.localPlayer.sprite.y - 800, this.localPlayer.sprite.x - 500 + Math.random()*1000, this.localPlayer.sprite.y - 800 ); } this.tweens.add({ targets: rays, alpha: 0, duration: 3000, onComplete: () => rays.destroy() }); }
    }

    // 新增：向屎王發射彩虹雷射
    shootRainbowLaser() {
        if (!this.pooBoss || !this.localPlayer || !this.localPlayer.sprite) return;
        let startX = this.localPlayer.sprite.x; let startY = this.localPlayer.sprite.y - 20;
        let endX = this.pooBoss.x; let endY = this.pooBoss.y + 30;
        let colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x8b00ff];
        let color = Phaser.Utils.Array.GetRandom(colors);
        let laser = this.add.graphics().setDepth(205);
        laser.lineStyle(6, color, 1); laser.beginPath(); laser.moveTo(startX, startY); laser.lineTo(endX, endY); laser.strokePath();
        this.tweens.add({ targets: laser, alpha: 0, duration: 250, onComplete: () => laser.destroy() });
    }

    processShrineEventLogic(time, delta) {
        if (this.sceneName !== 'shrine') return;
        let eventData = window.GameLogic.shrineEventData; let evState = eventData ? eventData.state : 'none';

        // 修正5：正確利用原生陣列清除音樂，根除音樂被帶出神龕的 Bug
        if (evState !== this.currentRitualState) {
            this.currentRitualState = evState;
            let trackKeys = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire', 'shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success'];
            trackKeys.forEach(k => {
                if (this.sound.getAll(k)) { this.sound.getAll(k).forEach(s => s.stop()); }
            });
            
            let volControl = document.getElementById('bgm-volume'); let vol = volControl ? volControl.value / 100 : 0.5;

            if (evState === 'voting' || evState === 'countdown') {
                this.sound.play('shrine-selection', {loop: true, volume: vol});
            } else if (evState === 'purifying') {
                this.sound.play('shrine-purify-fight', {loop: true, volume: vol});
            } else if (evState === 'success') {
                let winSnd = this.sound.add('shrine-purify-success-win', {volume: vol}); winSnd.play();
                winSnd.once('complete', () => { if (this.currentRitualState === 'success') { this.sound.play('shrine-purify-success', {loop: true, volume: vol}); } });
            } else {
                this.sound.play('shrine-wierd-people-sound', {loop: true, volume: vol});
            }
        }

        let pUids = Object.keys(window.GameLogic.shrinePlayers || {});
        let isHost = pUids.length > 0 && pUids.sort()[0] === window.GameLogic.currentUser.uid;

        if (!eventData || eventData.state === 'finished') {
            if (this.pooBoss) { if(this.pooBoss.bubbleContainer) this.pooBoss.bubbleContainer.destroy(); this.pooBoss.destroy(); this.pooBoss = null; }
            if (this.countdownText) this.countdownText.setVisible(false); this.stopPurifyEffects(false); 
            // 修正4：立即恢復正常鏡頭，不要奇怪的縮放漸變
            if (this.cameras.main.zoom !== 1) {
                this.cameras.main.setZoom(1);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
            }
            return;
        }

        let cx = this.cameras.main.scrollX + this.cameras.main.width/2; let cy = this.cameras.main.scrollY + this.cameras.main.height/2;

        if (evState === 'voting') {
            if (isHost) {
                let votes = eventData.votes || {}; let seatedCount = pUids.filter(u => window.GameLogic.shrinePlayers[u].isSeated).length;
                let allConfirmed = true; let voteCount = 0;
                for (let k in votes) { voteCount++; if (!votes[k].confirmed) allConfirmed = false; }
                
                if (voteCount >= seatedCount && seatedCount > 0 && allConfirmed) {
                    if (!this.pendingStateChange || Date.now() - this.pendingStateChange > 2000) {
                        this.pendingStateChange = Date.now();
                        let counts = {}; Object.values(votes).forEach(v => counts[v.target] = (counts[v.target] || 0) + 1);
                        let maxV = 0, winners = [];
                        for (let uid in counts) { if (counts[uid] > maxV) { maxV = counts[uid]; winners = [uid]; } else if (counts[uid] === maxV) { winners.push(uid); } }
                        let finalWinner = winners[Math.floor(Math.random() * winners.length)];
                        if (finalWinner === 'any') { let seatedUids = pUids.filter(u => window.GameLogic.shrinePlayers[u].isSeated); finalWinner = seatedUids[Math.floor(Math.random() * seatedUids.length)]; }
                        update(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'countdown', targetUid: finalWinner, startTime: Date.now() });
                    }
                }
            }
        } 
        else if (evState === 'countdown') {
            let elapsed = Date.now() - (eventData.startTime || Date.now()); let remain = 3 - Math.floor(elapsed / 1000);
            this.countdownText.setPosition(cx, cy).setVisible(true);
            if (remain > 0) { this.countdownText.setText(remain); } else {
                this.countdownText.setText("淨化開始"); this.countdownText.setFontSize('96px');
                if (!this.countdownTween) { this.countdownTween = this.tweens.add({ targets: this.countdownText, scale: 1.5, alpha: 0, duration: 1000 }); }
                if (isHost && elapsed > 4000) {
                    if (!this.pendingStateChange || Date.now() - this.pendingStateChange > 2000) {
                        this.pendingStateChange = Date.now();
                        update(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'purifying', decay: 0, startTime: Date.now() });
                    }
                }
            }
        } 
        else if (evState === 'purifying') {
            this.countdownText.setVisible(false); if (this.countdownTween) { this.countdownTween.stop(); this.countdownTween = null; this.countdownText.setScale(1).setAlpha(1); }
            this.startPurifyEffects();
            let clicks = eventData.clicks || {}; let totalClicks = Object.values(clicks).reduce((a, b) => a + b, 0); let currentDecay = eventData.decay || 0;
            if (isHost) {
                if (!this.lastDecaySync || Date.now() - this.lastDecaySync > 500) {
                    this.lastDecaySync = Date.now(); currentDecay += 4; 
                    update(ref(window.GameLogic.db, 'shrineEvents/current'), { decay: currentDecay, lastDecayTime: Date.now() });
                }
            }
            let progressVal = (totalClicks * 5) - currentDecay; if (progressVal < 0) progressVal = 0;
            let targetProgress = pUids.length * 150; let ratio = Phaser.Math.Clamp(progressVal / targetProgress, 0, 1);
            let camW = this.cameras.main.width; let camH = this.cameras.main.height;
            this.purifyBar.clear().fillStyle(0xff4500, 1).fillRoundedRect(camW/2 - 196, camH * 0.75 - 96, 392 * ratio, 32, 16);
            
            if (isHost && ratio >= 1) {
                if (!this.pendingStateChange || Date.now() - this.pendingStateChange > 2000) {
                    this.pendingStateChange = Date.now();
                    update(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'success', endTime: Date.now() });
                }
            }

            if (!this.pooBoss && this.furnitureSprites['altar']) {
                let ax = this.furnitureSprites['altar'].sprite.x; let ay = this.furnitureSprites['altar'].sprite.y;
                this.pooBoss = this.physics.add.sprite(ax, ay - 100, 'poo-boss').setDepth(25);
                this.pooBoss.bubbleContainer = this.add.container(ax, ay - 100).setDepth(26); this.pooBoss.bubbleBg = this.add.graphics(); this.pooBoss.bubbleText = this.add.text(0, 0, '哇哈哈哈呷賽呷到飽！', { fontSize: '14px', fontFamily: 'Georgia', color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: {width: 150} }).setOrigin(0.5); this.pooBoss.bubbleContainer.add([this.pooBoss.bubbleBg, this.pooBoss.bubbleText]); this.pooBoss.lastBubbleData = "";
                this.pooBoss.quotes = ["哇哈哈哈呷賽呷到飽！", "屎到臨頭還在吃！", "吃我的黃金大狂風啦！", "你的腦袋被本王侵佔啦！", "好香好香～再來一坨！", "愛吃屎的孩子都沒本王壞！", "看我的終極噴射括約肌！", "人生就是一場呷賽的過程！", "這坨屎就賞給你當宵夜！", "屎王駕到，通通閃開！", "滿城盡帶黃金屎！", "你身上有濃濃的屎味～", "我知道你愛本王,瞧你吃得起勁！", "把你的靈魂跟大便揉成一團！", "遇到本王算你好屎運！", "別掙扎了，乖乖呷賽吧！", "這點符咒也想超渡本屎王？", "再不點快點，我就讓你再拉20年！"];
                this.pooBoss.lastQuoteTime = 0;
            }
            
            if (this.pooBoss && this.furnitureSprites['altar']) {
                // 修正4：鏡頭改為追蹤屎王，讓大家看清楚 Boss 的模樣
                this.cameras.main.startFollow(this.pooBoss, true, 0.05, 0.05);
                if (this.cameras.main.zoom !== 0.85) this.cameras.main.zoomTo(0.85, 1000, 'Sine.easeInOut', true);

                let targetSprite = (eventData.targetUid === window.GameLogic.currentUser.uid) ? this.localPlayer.sprite : (this.otherPlayers[eventData.targetUid] ? this.otherPlayers[eventData.targetUid].sprite : this.furnitureSprites['altar'].sprite);
                let ax = targetSprite.x; let ay = targetSprite.y;
                this.pooBoss.x = ax + Math.cos(time * 0.0015) * 120; this.pooBoss.y = ay - 40 + Math.sin(time * 0.002) * 80; 
                if (time - this.pooBoss.lastQuoteTime > 2500) { 
                    this.pooBoss.lastQuoteTime = time; 
                    this.pooBoss.bubbleText.setText(Phaser.Utils.Array.GetRandom(this.pooBoss.quotes)); 
                }
                
                // 修正1：調整為每 1.8 秒有 55% 的機率噴屎，節奏更平均
                if (!this.pooBoss.lastPoopTime) this.pooBoss.lastPoopTime = time;
                if (time - this.pooBoss.lastPoopTime > 1800) {
                    this.pooBoss.lastPoopTime = time;
                    if (Math.random() < 0.55) {
                        let camW = this.cameras.main.width;
                        let camH = this.cameras.main.height;
                        for (let i = 0; i < 15; i++) {
                            let poopDrop = this.add.circle(this.pooBoss.x, this.pooBoss.y + 20, Phaser.Math.Between(5, 12), 0x5c4033).setDepth(210);
                            this.tweens.add({
                                targets: poopDrop,
                                x: camW / 2 + Phaser.Math.Between(-80, 80),
                                y: camH * 0.8 + Phaser.Math.Between(-50, 50),
                                scale: Phaser.Math.FloatBetween(1.5, 3),
                                duration: Phaser.Math.Between(400, 700),
                                ease: 'Cubic.easeIn',
                                onComplete: () => {
                                    poopDrop.destroy();
                                    // 落地瞬間，呼叫 DOM 產生零碎的黏附屎塊，並啟動擦拭屏障擋住符咒
                                    if (i === 14) { if (window.triggerPoopSplatter) window.triggerPoopSplatter(); }
                                }
                            });
                        }
                    }
                }
                if (this.pooBoss.lastBubbleData !== this.pooBoss.bubbleText.text) { this.pooBoss.lastBubbleData = this.pooBoss.bubbleText.text; let bBounds = this.pooBoss.bubbleText.getBounds(); let bW = bBounds.width + 16, bH = bBounds.height + 12; this.pooBoss.bubbleBg.clear().fillStyle(0x3e2723, 0.9).lineStyle(2, 0xffcc00, 1).fillRoundedRect(-bW/2, -bH/2, bW, bH, 8).strokeRoundedRect(-bW/2, -bH/2, bW, bH, 8); }
                let bBounds = this.pooBoss.bubbleText.getBounds(); let bH = bBounds.height + 12; this.pooBoss.bubbleContainer.setPosition(this.pooBoss.x, this.pooBoss.y - 60 - bH/2);
            }
        } 
        else if (evState === 'success') {
            this.stopPurifyEffects(true); let tUid = eventData.targetUid;
            if (this.pooBoss) { this.pooBoss.bubbleText.setText("我還會再回來的..!!!!"); this.tweens.add({ targets: this.pooBoss, y: this.pooBoss.y - 300, alpha: 0, duration: 2000 }); if(this.pooBoss.bubbleContainer) this.pooBoss.bubbleContainer.destroy(); this.pooBoss = null; }
            if (!this.successTextShown) {
                this.successTextShown = true;
                // 修正4：儀式成功瞬間，鏡頭立即恢復追蹤玩家並取消縮放
                this.cameras.main.setZoom(1);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                let st = this.add.text(cx, cy, "淨化成功！", { fontSize: '80px', fontStyle: 'bold', color: '#ffcc00', stroke: '#fff', strokeThickness: 10 }).setOrigin(0.5).setDepth(300);
                this.tweens.add({ targets: st, scale: 1.2, yoyo: true, repeat: 3, duration: 500, onComplete: () => st.destroy() });
                let targetSprite = (tUid === window.GameLogic.currentUser.uid) ? this.localPlayer.sprite : (this.otherPlayers[tUid] ? this.otherPlayers[tUid].sprite : null);
                if (targetSprite) {
                    this.tweens.add({
                        targets: targetSprite, scale: 3, y: targetSprite.y - 300, alpha: 0, duration: 1500, ease: 'Power2',
                        onComplete: () => {
                            this.createMiniExplosion(targetSprite.x, targetSprite.y); targetSprite.setScale(1).setAlpha(1).setY(targetSprite.y + 300);
                            let coinEmitter = this.add.particles(0, -50, 'made-coin', { x: { min: 0, max: this.cameras.main.width }, speedY: { min: 400, max: 800 }, bounce: 0.5, lifespan: 3000, quantity: 15, maxParticles: 800 }).setDepth(290).setScrollFactor(0);
                            this.time.addEvent({ delay: 150, repeat: 20, callback: () => window.playSFX(this, 'coin03') });
                            
                            if (isHost && !this.coinsDropped) {
                                this.coinsDropped = true;
                                let participantCount = pUids.filter(u => window.GameLogic.shrinePlayers[u].isSeated).length || 1; 
                                
                                // 修正4：單人與多人獎勵差異化，單人只掉5枚，共600元
                                let totalCoins = 100;
                                let coinValue = 25;
                                if (participantCount === 1) {
                                    totalCoins = 5;
                                    coinValue = 120; // 5 * 120 = 600
                                } else {
                                    let totalValue = participantCount >= 5 ? 10000 : participantCount * 2500; 
                                    coinValue = Math.floor(totalValue / 100);
                                }
                                
                                let mapW = this.physics.world.bounds.width;
                                let mapH = this.physics.world.bounds.height;
                                
                                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                                    let dropUpdates = {};
                                    let altar = this.furnitureSprites['altar'] ? this.furnitureSprites['altar'].sprite : {x: cx, y: cy};
                                    for (let i = 0; i < totalCoins; i++) {
                                        // 修正1：縮小隨機半徑並加入嚴格 Clamp 邊界防禦，絕不讓金幣貼在畫面最頂端或死角
                                        let rx = Phaser.Math.Clamp(altar.x + Phaser.Math.Between(-250, 250), 100, mapW - 100);
                                        let ry = Phaser.Math.Clamp(altar.y + Phaser.Math.Between(-150, 150), 120, mapH - 120);
                                        let key = 'shrine_coin_' + Date.now() + '_' + i;
                                        dropUpdates[`droppedCoins/${key}`] = { x: rx, y: ry, amount: coinValue };
                                    }
                                    module.update(module.ref(window.GameLogic.db), dropUpdates);
                                });
                            }
                            
                            let rewardText = this.add.text(cx, cy + 100, `滿地金幣快去撿！`, { fontSize: '48px', color: '#ffcc00', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(300).setScrollFactor(0); 
                            this.tweens.add({ targets: rewardText, y: cy, alpha: 0, duration: 4000, onComplete: () => rewardText.destroy() });
                        }
                    });
                }
                this.time.delayedCall(8000, () => {
                    this.successTextShown = false; this.coinsDropped = false;
                    if (isHost) update(ref(window.GameLogic.db, 'shrineEvents/current'), { state: 'finished' });
                    if (this.localPlayer.isSeated) { this.localPlayer.isSeated = false; update(ref(window.GameLogic.db, `shrinePlayers/${window.GameLogic.currentUser.uid}`), { isSeated: false }); }
                });
            }
        }
    }

    handleMimiHit(x, y) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.get(module.ref(window.GameLogic.db, 'cafeMimi/hp')).then(snap => {
                let chp = snap.val() || 0;
                if (chp > 0) {
                    let newHp = chp - 1; 
                    // 這裡修正了重複包裝 module.ref 的錯誤
                    module.update(module.ref(window.GameLogic.db, 'cafeMimi'), { hp: newHp });
                    
                    // 老鼠被水球或煙火砸中時，立刻播放一次受擊/尖叫聲
                    window.playSFX(this, 'mimi-thief-stealing');

                    if (newHp <= 0) {
                        module.update(module.ref(window.GameLogic.db, 'cafeMimi'), { state: 'down' });
                        
                        window.playSFX(this, 'mimi-thief-get-down');
                        
                        // 修正10：強制立刻播放倒下動畫，避免等待網路同步的延遲或錯失
                        if (this.mimiSprite) {
                            this.mimiSprite.play('mimi-down', true);
                            this.mimiSprite.setAlpha(0.6);
                        }

                        let mData = window.GameLogic.cafeMimiData || {}; 
                        let baseCoins = 300 * (mData.playersInvolved || 1); 
                        let totalValue = baseCoins + (mData.stolenPool || 0); 
                        let coinValue = Math.floor(totalValue / 10);
                        let dropUpdates = {};
                        for(let i=0; i<10; i++) { 
                            // 修正：強行限制噴濺的錢幣座標在安全範圍 [100, 1948] 內，保證一定撿得到
                            let cx = Phaser.Math.Clamp(x + Phaser.Math.Between(-80, 80), 100, 1948);
                            let cy = Phaser.Math.Clamp(y + Phaser.Math.Between(-80, 80) + 20, 100, 1948);
                            dropUpdates[`droppedCoins/mimi_coin_${Date.now()}_${i}`] = { x: cx, y: cy, amount: coinValue }; 
                        }
                        dropUpdates['serverEvents/mimiNextSpawn'] = Date.now() + Phaser.Math.Between(600000, 900000);
                        module.update(module.ref(window.GameLogic.db), dropUpdates);
                        sendBubble("打倒鼠偷米米啦！掉出滿地金幣！");
                    }
                }
            });
        });
    }

    update(time, delta) {
        if (!window.GameLogic.currentUser) return;
        let vx = 0; let vy = 0; let speed = 180; const uiScene = this.scene.manager.getScene('UIScene'); let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y;
        let evData = window.GameLogic.shrineEventData; let isPurifying = (this.sceneName === 'shrine' && evData && evData.state === 'purifying');

        this.processShrineEventLogic(time, delta);

      if (this.isCafe) {
            let pUids = Object.keys(window.GameLogic.cafePlayers || {}).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid]);
            let isHost = pUids.length > 0 && pUids.sort()[0] === window.GameLogic.currentUser.uid;
            
            if (isHost) {
                if (!this.mimiCheckTime || time - this.mimiCheckTime > 3000) {
                    this.mimiCheckTime = time;
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                        module.get(module.ref(window.GameLogic.db, 'serverEvents/mimiNextSpawn')).then(snap => {
                            let nextSpawn = snap.val(); let now = Date.now();
                            if (!nextSpawn || now > nextSpawn) {
                                let mimiData = window.GameLogic.cafeMimiData;
                                if (!mimiData || (!mimiData.active && mimiData.state !== 'down')) {
                                    let requiredHp = Math.min(6, 2 + pUids.length);
                                    module.update(module.ref(window.GameLogic.db, 'cafeMimi'), { active: true, x: -50, y: Phaser.Math.Between(200, 1800), state: 'walk', hp: requiredHp, playersInvolved: pUids.length, stolenPool: 0, flipX: false, stolenUids: null });
                                }
                            }
                        });
                    });
                }
                
                let mData = window.GameLogic.cafeMimiData;
                if (mData && mData.active) {
                    let targetX = mData.x, targetY = mData.y;
                    
                    if (mData.state === 'walk' && mData.hp > 0) {
                        let targetUid = null; let minDist = 9999; let stolenUids = mData.stolenUids || {};
                        let stolenCount = Object.keys(stolenUids).length;
                        
                        let walkSpeed = (stolenCount === 0) ? 200 : 350; // 修正3：整體降速
                        
                        pUids.forEach(uid => { if (!stolenUids[uid]) { let op = this.otherPlayers[uid] ? this.otherPlayers[uid].sprite : (uid === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null); if (op) { let d = Phaser.Math.Distance.Between(mData.x, mData.y, op.x, op.y); if (d < minDist) { minDist = d; targetUid = uid; targetX = op.x; targetY = op.y; } } } });
                        if (targetUid) {
                            if (minDist > 35) { 
                                let angle = Phaser.Math.Angle.Between(mData.x, mData.y, targetX, targetY); 
                                targetX = mData.x + Math.cos(angle) * (delta / 1000) * walkSpeed; 
                                targetY = mData.y + Math.sin(angle) * (delta / 1000) * walkSpeed; 
                                update(ref(window.GameLogic.db, 'cafeMimi'), { x: targetX, y: targetY, flipX: (targetX > mData.x) }); 
                            } else {
                                update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'stealing', stealingFrom: targetUid }); 
                            }
                        } else {
                            // 當逃避時，讓米米傾向於往中央跑
                            let sumX = 0, sumY = 0; pUids.forEach(u => { let op = this.otherPlayers[u] ? this.otherPlayers[u].sprite : (u === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null); if (op) { sumX += op.x; sumY += op.y; } });
                            let cX = sumX / pUids.length; let cY = sumY / pUids.length;
                            
                            let angleAway = Phaser.Math.Angle.Between(cX, cY, mData.x, mData.y);
                            let angleToCenter = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024);
                            
                            let safeX = Phaser.Math.Clamp(cX + Math.cos(angleAway) * 200, 100, 1948); let safeY = Phaser.Math.Clamp(cY + Math.sin(angleAway) * 200, 100, 1948);
                            let distToSafe = Phaser.Math.Distance.Between(mData.x, mData.y, safeX, safeY);
                            if (distToSafe > 20) { 
                                // 修正3：取靠近中心與遠離玩家的折衷角度，讓牠不要一直卡在邊緣
                                let angle = Phaser.Math.Angle.Between(mData.x, mData.y, safeX, safeY); 
                                let centerWeight = Phaser.Math.Distance.Between(mData.x, mData.y, 1024, 1024) / 1000;
                                angle = Phaser.Math.Angle.RotateTo(angle, angleToCenter, centerWeight * 0.5);
                                
                                targetX = mData.x + Math.cos(angle) * (delta / 1000) * 150; 
                                targetY = mData.y + Math.sin(angle) * (delta / 1000) * 150; 
                                update(ref(window.GameLogic.db, 'cafeMimi'), { x: targetX, y: targetY, flipX: (targetX > mData.x) }); 
                            } else { 
                                update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'laughing', laughTime: Date.now() }); 
                            }
                        }
                    } else if (mData.state === 'stealing' && mData.hp > 0) {
                        if (mData.stolenUids && mData.stolenUids[mData.stealingFrom]) {
                            update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'walk' });
                        }
                    } else if (mData.state === 'laughing' && mData.hp > 0) {
                        if (Date.now() - mData.laughTime > 3000) {
                            let unrobbedExist = pUids.some(uid => !(mData.stolenUids && mData.stolenUids[uid]));
                            if (unrobbedExist) update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'walk' });
                            else update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'chase', randomAngle: Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024) });
                        }
                    } else if (mData.state === 'chase' && mData.hp > 0) {
                        let unrobbedExist = pUids.some(uid => !(mData.stolenUids && mData.stolenUids[uid]));
                        if (unrobbedExist) {
                            update(ref(window.GameLogic.db, 'cafeMimi'), { state: 'walk' });
                        } else {
                            let minDistToPlayer = 9999; let nearestP = null;
                            pUids.forEach(uid => {
                                let op = this.otherPlayers[uid] ? this.otherPlayers[uid].sprite : (uid === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null);
                                if (op) { let d = Phaser.Math.Distance.Between(mData.x, mData.y, op.x, op.y); if (d < minDistToPlayer) { minDistToPlayer = d; nearestP = op; } }
                            });
                            
                            let angle = mData.randomAngle || 0;
                            let boostSpeed = mData.speedBoost || 200; // 降低衝刺基礎速度
                            
                            if (nearestP && minDistToPlayer < 400) {
                                angle = Phaser.Math.Angle.Between(nearestP.x, nearestP.y, mData.x, mData.y);
                                angle += Phaser.Math.FloatBetween(-0.3, 0.3); 
                            } else {
                                // 如果附近沒有人，引導牠往地圖中央跑
                                let angleToCenter = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024);
                                angle = Phaser.Math.Angle.RotateTo(angle, angleToCenter, 0.1);
                                if (Math.random() < 0.05) angle += Phaser.Math.FloatBetween(-0.5, 0.5); 
                            }
                            
                            targetX = mData.x + Math.cos(angle) * (delta / 1000) * boostSpeed; 
                            targetY = mData.y + Math.sin(angle) * (delta / 1000) * boostSpeed;
                            
                            if (targetX < 50 || targetX > 1998 || targetY < 50 || targetY > 1998) { 
                                targetX = Phaser.Math.Clamp(targetX, 50, 1998); 
                                targetY = Phaser.Math.Clamp(targetY, 50, 1998); 
                                // 反彈時也給一個向中心的傾向
                                angle = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024) + Phaser.Math.FloatBetween(-0.5, 0.5);
                                boostSpeed = 500; // 降低邊緣大反彈極限速度
                            } else {
                                boostSpeed = 200;
                            }
                            update(ref(window.GameLogic.db, 'cafeMimi'), { x: targetX, y: targetY, flipX: (targetX > mData.x), randomAngle: angle, speedBoost: boostSpeed });
                        }
                    } else if (mData.state === 'down') {
                        if (!mData.downTime) update(ref(window.GameLogic.db, 'cafeMimi'), { downTime: Date.now() });
                        else if (Date.now() - mData.downTime > 3000) update(ref(window.GameLogic.db, 'cafeMimi'), { active: false, state: 'none' });
                    }
                }
            } else {
                // 如果房間內已無人，清除米米
                if (pUids.length === 0 && window.GameLogic.cafeMimiData && window.GameLogic.cafeMimiData.active) {
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(window.GameLogic.db, 'cafeMimi'), { active: false }));
                }
            }
        }

        // 修正2：確保進入狗窩後，等到家具完全載入並產生實體後，再把睡覺的玩家放到床上
        if (this.sceneName === 'doghouse' && window.GameLogic.myProfile.sleepStartTime > 0 && !this.sleepInitDone && this.localPlayer) {
            for (let key in this.furnitureSprites) {
                if (key.includes('bed') && this.furnitureSprites[key].sprite.isLocked) {
                    this.sleepInitDone = true;
                    let f = this.furnitureSprites[key];
                    this.localPlayer.isSleeping = true;
                    this.localPlayer.sprite.setPosition(f.sprite.x, f.sprite.y);
                    this.localPlayer.sprite.play('sleep', true);
                    this.localPlayer.sprite.setAlpha(1);
                    this.sleepTopText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 100);
                    this.sleepBotText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 65);
                    this.sleepBotBg.setVisible(true);
                    let bounds = this.sleepBotText.getBounds(); let w = bounds.width + 16, h = bounds.height + 12;
                    let bx = this.sleepBotText.x - w/2, by = this.sleepBotText.y - h/2;
                    this.sleepBotBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(bx, by, w, h, 8).strokeRoundedRect(bx, by, w, h, 8);
                    break;
                }
            }
        }

        // 修正4：心跳機制更新，每 5 秒上傳一次當前時間戳，用於徹底過濾斷線與幽靈人口
        if (!this.lastHeartbeatSync || time - this.lastHeartbeatSync > 5000) {
            this.lastHeartbeatSync = time;
            update(ref(window.GameLogic.db, `onlinePlayers/${window.GameLogic.currentUser.uid}`), {
                lastActive: Date.now(),
                name: window.GameLogic.myProfile.name || '匿名',
                color: window.GameLogic.myProfile.color || '#fff'
            });
        }

        if (this.localPlayer.isSweeping) {
            this.localPlayer.sprite.setVelocity(0, 0); this.localPlayer.sprite.play('clean', true); 
            this.qteProgress -= (delta * 0.02); if (this.qteProgress < 0) this.qteProgress = 0; this.updateQTEBar(this.qteProgress);
            if (this.closestTrash) this.qteContainer.setPosition(this.closestTrash.x, this.closestTrash.y + 40);
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
        } else if (this.localPlayer.isSleeping) {
            this.localPlayer.sprite.setVelocity(0, 0); this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
            // 修正2：將睡覺動畫放在 update 迴圈中強制維持，確保狀態不會被其他網路事件覆蓋而卡死
            this.localPlayer.sprite.play('sleep', true);
        } else if (this.localPlayer.isStunned || this.localPlayer.isThrowing) {
            this.localPlayer.sprite.setVelocity(0, 0); this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
        } else if (this.localPlayer.isSeated) {
            this.localPlayer.sprite.setVelocity(0, 0); this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
            if (isPurifying) {
                if (evData.targetUid === window.GameLogic.currentUser.uid) {
                    if (this.furnitureSprites['altar']) this.localPlayer.sprite.setPosition(this.furnitureSprites['altar'].sprite.x, this.furnitureSprites['altar'].sprite.y + 40);
                    this.localPlayer.sprite.play('purify-target', true);
                    if (this.localPlayer.lastBubbleState !== 'purify-target') { sendBubble("痾...我不敢再吃屎了...!!"); this.localPlayer.lastBubbleState = 'purify-target'; }
                } else { 
                    // 修正1：根據點擊時間判斷是否播放施法動作，如果超過 300 毫秒沒按鈕，就回到入席發呆
                    if (this.localPlayer.magicClickTime && Date.now() - this.localPlayer.magicClickTime < 300) {
                        this.localPlayer.sprite.play('purify-magic', true);
                    } else {
                        this.localPlayer.sprite.play('seat-idle', true);
                    }
                    if (this.localPlayer.lastBubbleState !== 'purify-magic') { sendBubble("退！退！退！"); this.localPlayer.lastBubbleState = 'purify-magic'; }
                }
            } else { 
                this.localPlayer.sprite.play('seat-idle', true); 
                this.localPlayer.lastBubbleState = 'idle';
            }
        } else {
            if (uiScene && uiScene.joyStick && uiScene.joyStick.force > 0) {
                vx = Math.cos(uiScene.joyStick.angle * Math.PI / 180) * speed; vy = Math.sin(uiScene.joyStick.angle * Math.PI / 180) * speed;
            } else {
                if (document.activeElement.tagName !== 'INPUT') { if (this.cursors.left.isDown) vx = -speed; else if (this.cursors.right.isDown) vx = speed; if (this.cursors.up.isDown) vy = -speed; else if (this.cursors.down.isDown) vy = speed; }
                if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; } 
            }
            let isPlacing = window.GameLogic.placingFurnitureKey !== null && (this.isCafe || this.sceneName === 'doghouse' || this.sceneName === 'shrine');

            if (isPlacing) {
                this.localPlayer.sprite.setVelocity(0, 0).play('idle', true); let f = this.furnitureSprites[window.GameLogic.placingFurnitureKey];
                if (f && f.sprite && f.sprite.active) {
                    f.sprite.setVelocity(vx, vy); this.cameras.main.startFollow(f.sprite, true, 0.1, 0.1); this.placePrompt.setPosition(f.sprite.x, f.sprite.y - 80).setVisible(true);
                    if (vx !== 0 || vy !== 0) { if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) { let path = this.isCafe ? `cafeFurniture/${window.GameLogic.placingFurnitureKey}` : (this.sceneName === 'doghouse' ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${window.GameLogic.placingFurnitureKey}` : `shrineFurniture/${window.GameLogic.placingFurnitureKey}`); update(ref(window.GameLogic.db, path), { x: f.sprite.x, y: f.sprite.y }); this.lastSyncTime = Date.now(); } }
                }
            } else {
                this.placePrompt.setVisible(false); this.localPlayer.sprite.setVelocity(vx, vy); 
                // 修正：如果不在淨化中，才跟隨自己，避免與儀式強制鎖定的鏡頭搶奪
                if (!isPurifying) {
                    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                }
                let absX = Math.abs(vx); let absY = Math.abs(vy); if (absX < 1) vx = 0; if (absY < 1) vy = 0;
                if (vx === 0 && vy === 0) { this.localPlayer.sprite.play('idle', true); } else if (absX >= absY) { this.localPlayer.sprite.setFlipX(vx < 0); this.localPlayer.sprite.play('walk', true); } else { if (vy < 0) { this.localPlayer.sprite.play('walk-up', true); } else { this.localPlayer.sprite.play('walk-down', true); } }
                if ((this.isCafe || this.sceneName === 'shrine' || this.sceneName === 'playroom') && (vx !== 0 || vy !== 0)) { if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) { let path = this.isCafe ? `cafePlayers/${window.GameLogic.currentUser.uid}` : (this.sceneName === 'shrine' ? `shrinePlayers/${window.GameLogic.currentUser.uid}` : `playroomPlayers/${window.GameLogic.currentRoomId}/${window.GameLogic.currentUser.uid}`); update(ref(window.GameLogic.db, path), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y }); this.lastSyncTime = Date.now(); } }
            }

            let minDist = 90; let promptTarget = null; let promptMsg = ""; this.closestTrash = null;
            for (let key in this.furnitureSprites) {
                let f = this.furnitureSprites[key]; if (!f.sprite.isLocked) continue; let d = Phaser.Math.Distance.Between(px, py, f.sprite.x, f.sprite.y);
                if (this.sceneName === 'shrine') {
                    if (key === 'altar' && d < 150) { minDist = d; promptTarget = f.sprite; promptMsg = "按A召喚教友"; }
                    if (key.startsWith('seat_') && d < 150) { minDist = d; promptTarget = f.sprite; promptMsg = "按B入席"; }
                } else {
                    if (d < minDist) { minDist = d; promptTarget = f.sprite; if (key.includes('fridge')) promptMsg = "按A打開冰箱"; else if (key.includes('shrine')) promptMsg = "按A參拜神龕"; else if (key.includes('dummy')) promptMsg = "假人洋蔥 (裝飾中)"; else if (key.includes('bed')) promptMsg = "按A歐歐睏"; else if (key.includes('scoreboard')) promptMsg = "按A查看洋蔥王排行榜"; else promptMsg = "按A打開回憶錄"; }
                }
            }
            for (let t of this.trashes) { if (!t.active) continue; let d = Phaser.Math.Distance.Between(px, py, t.x, t.y); if (d < minDist) { minDist = d; promptTarget = t; promptMsg = "按B使出掃地"; this.closestTrash = t; } }
            if (this.sceneName === '7eonion' && this.storeManager && !window.GameLogic.isShopping) { let d = Phaser.Math.Distance.Between(px, py, this.storeManager.x, this.storeManager.y); if (d < 150) { minDist = d; promptTarget = this.storeManager; promptMsg = "按A對話購物"; } }
            if (this.sceneName === 'playroom' && this.rpsMachine) { 
                let d = Phaser.Math.Distance.Between(px, py, this.rpsMachine.x, this.rpsMachine.y); 
                if (d < 150) { minDist = d; promptTarget = this.rpsMachine; promptMsg = "按A進行拳頭PK"; } 
            }
            if (promptTarget && !isPlacing) {
                this.smartPromptText.setText(promptMsg).setVisible(true); const pBounds = this.smartPromptText.getBounds(); const pWidth = pBounds.width + 16, pHeight = pBounds.height + 8, ptX = promptTarget.x, ptY = promptTarget.y - 60; 
                this.smartPromptBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).strokeRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).setVisible(true); this.smartPromptText.setPosition(ptX, ptY);
            } else { this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false); }

            if (window.GameLogic.armedItemState) {
                let itemName = window.GameLogic.armedItemName || '水球'; let msg = "按A施放" + itemName; let lockOnDist = (window.GameLogic.energyActive && (window.GameLogic.myProfile.energy || 0) > 0) ? 350 : 150; let lockTargetUid = null; let lockTargetSprite = null; let isDummy = false;
                let isMimi = false;
                for (let uid in this.otherPlayers) { let op = this.otherPlayers[uid].sprite; let d = Phaser.Math.Distance.Between(px, py, op.x, op.y); if (d < lockOnDist) { lockOnDist = d; lockTargetUid = uid; lockTargetSprite = op; isDummy = false; isMimi = false; } }
                for (let key in this.furnitureSprites) { if (key.includes('dummy')) { let fDummy = this.furnitureSprites[key].sprite; let d = Phaser.Math.Distance.Between(px, py, fDummy.x, fDummy.y); if (d < lockOnDist) { lockOnDist = d; lockTargetUid = key; lockTargetSprite = fDummy; isDummy = true; isMimi = false; } } }
                if (this.mimiSprite && window.GameLogic.cafeMimiData && window.GameLogic.cafeMimiData.hp > 0) {
                  // 【新增】時不時發出竄逃或等待的怪笑聲 (每 5 ~ 9 秒隨機觸發一次)
                    if (!this.nextMimiRandomSfxTime || time > this.nextMimiRandomSfxTime) {
                        this.nextMimiRandomSfxTime = time + Phaser.Math.Between(5000, 9000);
                        let currentState = window.GameLogic.cafeMimiData.state;
                        // 改為只有逃亡與原地竊笑時，會發出反覆的笑聲
                        if (currentState === 'chase' || currentState === 'laughing') {
                            window.playSFX(this, 'mimi-laugh');
                        }
                    }
                    let d = Phaser.Math.Distance.Between(px, py, this.mimiSprite.x, this.mimiSprite.y);
                    if (d < lockOnDist) { lockOnDist = d; lockTargetUid = 'mimi'; lockTargetSprite = this.mimiSprite; isDummy = false; isMimi = true; }
                }
                if (itemName === '煙火' && window.GameLogic.armedItemState === 'ready' && !lockTargetSprite) { msg = "按A施放全頻煙火"; }
                this.waterPromptText.setText(msg).setVisible(true); const wpBounds = this.waterPromptText.getBounds(); const wpWidth = wpBounds.width + 20, wpHeight = wpBounds.height + 10; const wptX = px, wptY = py + 45; 
                this.waterPromptBg.clear().fillStyle(0x0077cc, 0.8).lineStyle(2, 0xffffff, 1).fillRoundedRect(wptX - wpWidth/2, wptY - wpHeight/2, wpWidth, wpHeight, 6).strokeRoundedRect(wptX - wpWidth/2, wptY - wpHeight/2, wpWidth, wpHeight, 6).setVisible(true); this.waterPromptText.setPosition(wptX, wptY);
                if (lockTargetSprite) { this.lockOnTarget.setPosition(lockTargetSprite.x, lockTargetSprite.y - 40).setVisible(true); window.GameLogic.currentTargetSprite = lockTargetSprite; window.GameLogic.currentTargetUid = lockTargetUid; window.GameLogic.currentTargetType = isMimi ? 'mimi' : (isDummy ? 'dummy' : 'player'); } else { this.lockOnTarget.setVisible(false); window.GameLogic.currentTargetSprite = null; window.GameLogic.currentTargetUid = null; }
            } else { if (this.waterPromptBg) { this.waterPromptBg.setVisible(false); this.waterPromptText.setVisible(false); this.lockOnTarget.setVisible(false); } }
        }
        
        if (this.localPlayer.isInvincible) { this.localPlayer.sprite.setAlpha((Math.floor(time / 100) % 2 === 0) ? 0.5 : 1); } else { 
            // 修正2：保護初次登入時的隱身狀態，直到真正躺到床上才解除，避免閃現房間中央
            if (!(this.sceneName === 'doghouse' && window.GameLogic.myProfile.sleepStartTime > 0 && !this.sleepInitDone)) {
                this.localPlayer.sprite.setAlpha(1); 
            }
        }
        
        let mw = this.physics.world.bounds.width; let mh = this.physics.world.bounds.height;
        for (let key in this.coinSprites) { 
            let coin = this.coinSprites[key]; 
            // 防呆：強制將噴太遠的金幣拉回安全範圍
            if (coin.x < 60 || coin.x > mw - 60 || coin.y < 60 || coin.y > mh - 60) {
                let tgtX = Phaser.Math.Clamp(coin.x, 80, mw - 80);
                let tgtY = Phaser.Math.Clamp(coin.y, 80, mh - 80);
                coin.x = Phaser.Math.Linear(coin.x, tgtX, 0.1);
                coin.y = Phaser.Math.Linear(coin.y, tgtY, 0.1);
            }
            let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, coin.x, coin.y); if (dist < 30) { window.playSFX(this, 'coin03'); let coinAmount = coin.amount; import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { let coinRef = module.ref(window.GameLogic.db, `droppedCoins/${key}`); module.get(coinRef).then((coinSnap) => { if (coinSnap.exists()) { module.remove(coinRef).then(() => { let p = window.GameLogic.myProfile; p.coins = (p.coins || 0) + coinAmount; module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins }); let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins; let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y - 40; let pickupText = this.add.text(px, py, `+${coinAmount} 💰`, { fontSize: '16px', color: '#d4af37', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200); this.tweens.add({ targets: pickupText, y: py - 40, alpha: 0, duration: 1000, onComplete: () => pickupText.destroy() }); }); } }); }); } 
        }
        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        if (window.GameLogic.energyActive && this.localPlayer.sprite.active) {
            this.playerEnergyEmitter.setPosition(this.localPlayer.sprite.x, this.localPlayer.sprite.y + 35);
            if (!this.playerEnergyEmitter.isEnergyEmitting) {
                this.playerEnergyEmitter.start();
                this.playerEnergyEmitter.isEnergyEmitting = true;
            }
        } else {
            if (this.playerEnergyEmitter.isEnergyEmitting) {
                this.playerEnergyEmitter.stop();
                this.playerEnergyEmitter.isEnergyEmitting = false;
            }
        }

        const furnData = this.isCafe ? window.GameLogic.cafeFurniture : (this.sceneName === 'doghouse' ? (window.GameLogic.doghouseFurniture || {}) : (this.sceneName === 'shrine' ? window.GameLogic.shrineFurniture : {}));
        for (let key in furnData) {
            let fd = furnData[key];
            if (!this.furnitureSprites[key]) this.furnitureSprites[key] = this.createFurniture(key, fd);
            let f = this.furnitureSprites[key];
            f.sprite.isLocked = fd.locked;
            if(window.GameLogic.placingFurnitureKey !== key) {
                f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3);
                f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3);
            }
            if (f.textContainer) f.textContainer.setPosition(f.sprite.x, f.sprite.y);
            if (f.particleEmitter) f.particleEmitter.setPosition(f.sprite.x, f.sprite.y); // [新增] 粒子跟隨實體
            f.sprite.setAlpha(!fd.locked ? 0.6 : 1);
        }
        for (let key in this.furnitureSprites) {
            if (!furnData[key]) {
                if (window.GameLogic.placingFurnitureKey === key) { window.GameLogic.placingFurnitureKey = null; this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08); }
                if (this.furnitureSprites[key].particleEmitter) this.furnitureSprites[key].particleEmitter.destroy(); // [新增] 銷毀粒子
                if (this.furnitureSprites[key].textContainer) this.furnitureSprites[key].textContainer.destroy();
                if (this.furnitureSprites[key].bubbleContainer) this.furnitureSprites[key].bubbleContainer.destroy();
                this.furnitureSprites[key].sprite.destroy();
                delete this.furnitureSprites[key];
            }
        }

        if (this.isCafe || this.sceneName === 'shrine' || this.sceneName === 'playroom') {
            const playersData = this.isCafe ? window.GameLogic.cafePlayers : (this.sceneName === 'shrine' ? window.GameLogic.shrinePlayers : window.GameLogic.playroomPlayers);
            const globalOnline = window.GameLogic.onlinePlayers || {}; 
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue; if (!globalOnline[uid]) continue; 
                let pd = playersData[uid]; pd.uid = uid; if (!this.otherPlayers[uid]) this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                let op = this.otherPlayers[uid]; let oldX = op.sprite.x; let oldY = op.sprite.y; op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2); op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2); let diffX = op.sprite.x - oldX; let diffY = op.sprite.y - oldY; let absX = Math.abs(diffX); let absY = Math.abs(diffY);
                if (op.sprite.isStunned || op.sprite.isThrowing) { } else if (pd.isSeated) {
                    if (isPurifying) {
                        if (evData.targetUid === uid) {
                            op.sprite.play('purify-target', true);
                            if (this.furnitureSprites['altar']) { op.sprite.x = this.furnitureSprites['altar'].sprite.x; op.sprite.y = this.furnitureSprites['altar'].sprite.y + 40; }
                        } else { 
                            // 修正：透過 Firebase 的點擊次數差值，判斷其他玩家是否正在狂點
                            let pClicks = evData.clicks ? (evData.clicks[uid] || 0) : 0;
                            if (op.lastClicks !== pClicks) { op.lastClicks = pClicks; op.magicClickTime = Date.now(); }
                            
                            if (op.magicClickTime && Date.now() - op.magicClickTime < 300) {
                                op.sprite.play('purify-magic', true);
                            } else {
                                op.sprite.play('seat-idle', true);
                            }
                        }
                    } else { op.sprite.play('seat-idle', true); }
                } else if (absX < 0.5 && absY < 0.5) { op.sprite.play('idle', true); } else if (absX >= absY) { op.sprite.setFlipX(diffX < 0); op.sprite.play('walk', true); } else { if (diffY < 0) { op.sprite.play('walk-up', true); } else { op.sprite.play('walk-down', true); } }
                this.updatePlayerEntity(op, pd);
            }
            for (let uid in this.otherPlayers) { if (!playersData[uid] || !globalOnline[uid]) { this.otherPlayers[uid].sprite.destroy(); this.otherPlayers[uid].nameContainer.destroy(); this.otherPlayers[uid].bubbleContainer.destroy(); delete this.otherPlayers[uid]; } }
        }
    }
}

function initPhaser() { const config = { type: Phaser.AUTO, parent: 'phaser-app', width: '100%', height: '100%', backgroundColor: '#1a1008', scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, scene: [ BootScene, MainScene, UIScene ] }; window.GameLogic.phaserGame = new Phaser.Game(config); }

function openFurnitureCatalog() {
    const modal = document.getElementById('furniture-catalog-modal'); const list = document.getElementById('catalog-list'); const title = document.getElementById('catalog-title'); list.innerHTML = "";
    let items = [];
    if (window.GameLogic.currentScene === "cafe") { title.innerText = "📦 大廳家俱目錄"; items = [ { key: 'scoreboard', name: '🏆 戰況看板', img: 'hall-screen-in-list.png' }, { key: 'fridge', name: '🧊 公用大冰箱', img: 'fridge.png' }, { key: 'memory', name: '📖 洋蔥回憶錄', img: 'memory.png' }, { key: 'shrine', name: '⛩️ 洋蔥神龕', img: 'shrine.png' }, { key: 'dummy', name: '🧍 假人洋蔥', img: 'dummy.png' } ]; }
    else if (window.GameLogic.currentScene === "doghouse") { title.innerText = "🏠 房間家具擺設"; items = [ { key: 'bed', name: '🛏️ 狗窩床鋪', img: 'doghouse-bed.png' } ]; }
    else if (window.GameLogic.currentScene === "shrine") { 
        title.innerText = "☯️ 神龕法器目錄"; 
        items = [ 
            { key: 'altar', name: '🌀 呼蔥祭壇', img: 'shrine-altar.png', unique: true }, 
            { key: 'seat', name: '🧎 禁屎坐墊', img: 'shrine-no-poo-poo-seat.png', infinite: true },
            { key: 'clear_seats', name: '🧹 回收所有坐墊', isAction: true } // 修正：補回一鍵回收選項
        ]; 
    }

    items.forEach(item => {
        let div = document.createElement('div'); div.className = 'catalog-item'; 
        div.innerHTML = item.isAction ? `<span style="font-size:24px; margin-bottom:5px;">${item.name.split(' ')[0]}</span><span>${item.name.split(' ')[1]}</span>` : `<img src="${item.img}"><span>${item.name}</span>`;
        div.onclick = () => {
            if (item.isAction) {
                if (item.key === 'clear_seats') {
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                        let seats = Object.keys(window.GameLogic.shrineFurniture || {}).filter(k => k.startsWith('seat_'));
                        let updates = {}; seats.forEach(s => updates[`shrineFurniture/${s}`] = null);
                        module.update(module.ref(window.GameLogic.db), updates).then(() => { 
                            sendBubble("已回收所有禁屎坐墊！"); 
                            modal.style.display = 'none'; 
                        });
                    });
                }
                return;
            }
            
            modal.style.display = 'none'; let isCafe = window.GameLogic.currentScene === "cafe"; let isDoghouse = window.GameLogic.currentScene === "doghouse"; let isShrine = window.GameLogic.currentScene === "shrine";
            let targetDict = isCafe ? window.GameLogic.cafeFurniture : (isDoghouse ? window.GameLogic.doghouseFurniture : window.GameLogic.shrineFurniture);
            let pathPrefix = isCafe ? 'cafeFurniture/' : (isDoghouse ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/` : 'shrineFurniture/');
            
            let itemKey = item.key;
            if (item.infinite) { 
                if (item.key === 'seat') {
                    let seatCount = Object.keys(targetDict || {}).filter(k => k.startsWith('seat_')).length;
                    if (seatCount >= 6) {
                        alert("禁屎坐墊最多只能放置6個！");
                        return;
                    }
                }
                itemKey = item.key + '_' + Date.now(); 
            }

            let fData = targetDict && targetDict[itemKey];
            if (fData && fData.locked && !item.infinite) {
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.remove(module.ref(window.GameLogic.db, pathPrefix + itemKey)); });
                window.GameLogic.placingFurnitureKey = null; if(window.GameLogic.phaserGame) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if(scene && scene.localPlayer) { scene.cameras.main.startFollow(scene.localPlayer.sprite, true, 0.08, 0.08); } }
                sendBubble("傢俱收起來了!");
            } else {
                let pX = 1024, pY = 1024; if(window.GameLogic.phaserGame) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if(scene && scene.localPlayer) { pX = scene.localPlayer.sprite.x; pY = scene.localPlayer.sprite.y - 80; } }
                let newData = { x: pX, y: pY, locked: false, ownerUid: window.GameLogic.currentUser.uid };
                if (isDoghouse) { window.GameLogic.doghouseFurniture = window.GameLogic.doghouseFurniture || {}; window.GameLogic.doghouseFurniture[itemKey] = newData; }
                else if (isCafe) window.GameLogic.cafeFurniture[itemKey] = newData;
                // 修正：為神龕加入 || {} 的防護機制，避免資料庫為空時引發 null 取值報錯卡死
                else if (isShrine) { window.GameLogic.shrineFurniture = window.GameLogic.shrineFurniture || {}; window.GameLogic.shrineFurniture[itemKey] = newData; }
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => { module.update(module.ref(window.GameLogic.db, pathPrefix + itemKey), newData); });
                window.GameLogic.placingFurnitureKey = itemKey;
            }
        }; list.appendChild(div);
    }); modal.style.display = 'block';
}

document.getElementById("view-profile-btn").addEventListener("click", async () => { actionMenu.style.display = "none"; const targetUid = actionMenu.dataset.uid; if (targetUid === window.GameLogic.currentUser.uid) showProfileModal(window.GameLogic.myProfile, targetUid); else { const snap = await get(ref(db, `users/${targetUid}`)); if (snap.exists()) showProfileModal(snap.val(), targetUid); } });
function showProfileModal(p, uid) { profileViewingUid = uid; document.getElementById("vp-level").innerText = p.level || 1; document.getElementById("vp-exp").innerText = p.exp || 0; document.getElementById("vp-coins").innerText = p.coins || 0; document.getElementById("vp-sweeps").innerText = p.sweeps || 0; document.getElementById("vp-name").innerText = p.name || '匿名'; document.getElementById("vp-color").style.backgroundColor = p.color || '#c5a059'; document.getElementById("vp-birth").innerText = p.birth || '未知'; document.getElementById("vp-food").innerText = p.food || '無'; document.getElementById("vp-motto").innerText = p.motto || '無'; ['name', 'color', 'birth', 'food', 'motto'].forEach(k => { document.getElementById(`vp-${k}`).style.display = k === 'color' ? 'inline-block' : 'inline'; document.getElementById(`edit-${k}`).style.display = 'none'; }); const isMe = uid === window.GameLogic.currentUser.uid; document.getElementById("start-edit-btn").style.display = isMe ? "inline-block" : "none"; document.getElementById("save-edit-btn").style.display = "none"; viewProfileModal.style.display = "block"; }
document.getElementById("start-edit-btn").addEventListener("click", () => { document.getElementById("start-edit-btn").style.display = "none"; document.getElementById("save-edit-btn").style.display = "inline-block"; ['name', 'color', 'birth', 'food', 'motto'].forEach(k => { let t = document.getElementById(`vp-${k}`); let i = document.getElementById(`edit-${k}`); if (k === 'color') { i.value = window.GameLogic.myProfile.color || '#c5a059'; } else if (k === 'name') { i.value = window.GameLogic.myProfile.name || '匿名'; } else { i.value = t.innerText === '未知' || t.innerText === '無' ? '' : t.innerText; } t.style.display = 'none'; i.style.display = 'inline-block'; }); });
document.getElementById("save-edit-btn").addEventListener("click", () => { let newData = { name: document.getElementById("edit-name").value.trim() || '匿名', color: document.getElementById("edit-color").value || '#c5a059', birth: document.getElementById("edit-birth").value.trim() || '未知', food: document.getElementById("edit-food").value.trim() || '無', motto: document.getElementById("edit-motto").value.trim() || '無' }; update(ref(db, `users/${window.GameLogic.currentUser.uid}`), newData).then(() => { window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...newData }; if (window.GameLogic.currentScene === "cafe") { update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { name: newData.name, color: newData.color }); } update(ref(db, `onlinePlayers/${window.GameLogic.currentUser.uid}`), { name: newData.name, color: newData.color }); showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); }); });

document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { if (e.key === "Enter") { if (document.activeElement === chatInput) sendChat(); else if (document.activeElement === document.getElementById("pm-input")) window.sendPM(); } });
function sendBubble(msg) { if (window.GameLogic.currentUser) { window.GameLogic.myProfile.bubbleMsg = msg; window.GameLogic.myProfile.bubbleTime = Date.now(); if (window.GameLogic.currentScene === "cafe") update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { bubbleMsg: msg, bubbleTime: window.GameLogic.myProfile.bubbleTime }); } }
function sendChat() { const msg = chatInput.value.trim(); if (msg !== "" && window.GameLogic.currentUser) { const now = new Date(); push(ref(db, 'chats'), { name: window.GameLogic.myProfile.name, msg: msg, date: now.toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}), time: now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute:'2-digit' }) }); sendBubble(msg); chatInput.value = ""; } }
function listenToChat() { onValue(ref(db, 'chats'), (snapshot) => { const chatBox = document.getElementById("chat-box"); chatBox.innerHTML = ""; const chats = snapshot.val(); if (chats) { let lastMsg = ""; let html = ""; let chatArray = Object.values(chats); if (chatArray.length > 0) { let latest = chatArray[chatArray.length - 1]; lastMsg = `${latest.name}：${latest.msg}`; } chatArray.reverse().forEach(c => { html += `<div style="margin-bottom: 4px;"><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg} <span style="font-size:10px; color:#bbb; margin-left:8px;">${c.date||''} ${c.time||''}</span></div>`; }); chatBox.innerHTML = html; const topBar = document.getElementById("top-notification-bar"); if (topBar && lastMsg) { topBar.innerText = `💬 最新發言｜ ${lastMsg}`; } requestAnimationFrame(() => { setTimeout(() => { chatBox.scrollTop = 0; }, 10); }); } }); }

document.getElementById("upload-memory-btn").onclick = () => { const fileInput = document.getElementById("memory-file"); const textInput = document.getElementById("memory-text"); const file = fileInput.files[0]; const text = textInput.value.trim(); if (!file && !text) return alert("請上傳圖片或填寫文字！"); if (file) { const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const cvs = document.createElement('canvas'); let w = img.width, h = img.height; if (w > 300) { h *= 300 / w; w = 300; } cvs.width = w; cvs.height = h; cvs.getContext('2d').drawImage(img, 0, 0, w, h); saveMemoryToDB(cvs.toDataURL('image/jpeg', 0.7), text); }; img.src = e.target.result; }; reader.readAsDataURL(file); } else saveMemoryToDB("", text); fileInput.value = ""; textInput.value = ""; };
function saveMemoryToDB(imgBase64, text) { push(ref(db, 'memories'), { uid: window.GameLogic.currentUser.uid, author: window.GameLogic.myProfile.name, img: imgBase64, text: text, time: new Date().toLocaleDateString('zh-TW') }); }
window.deleteMemory = async function(key) { 
    const snap = await get(ref(db, `memories/${key}`)); 
    if (snap.exists()) { 
        let m = snap.val(); 
        let isMine = (m.uid === window.GameLogic.currentUser.uid) || (m.author === window.GameLogic.myProfile.name); 
        if (isMine) { 
            if (confirm("確定要刪除這條回憶嗎？")) remove(ref(db, `memories/${key}`)); 
        } else { 
            alert("您沒有權限刪除這篇回憶喔！"); 
        } 
    } 
};

function listenToMemories() { 
    onValue(ref(db, 'memories'), snap => { 
        const feed = document.getElementById("memory-feed"); 
        feed.innerHTML = ""; 
        const data = snap.val(); 
        if (data) { 
            Object.keys(data).reverse().forEach(key => { 
                let m = data[key]; 
                let isMine = (m.uid === window.GameLogic.currentUser.uid) || (m.author === window.GameLogic.myProfile.name); 
                let delBtnHtml = isMine ? `<button class="del-btn" onclick="window.deleteMemory('${key}')">刪除</button>` : ''; 
                feed.innerHTML += `<div class="memory-card">${delBtnHtml}<div class="author">${m.author} - ${m.time}</div>${m.img ? `<img src="${m.img}" alt="回憶照片" style="cursor: pointer;" onclick="window.openFullscreen(this.src)">` : ''}${m.text ? `<div class="text">${m.text}</div>` : ''}</div>`; 
            }); 
        } 
    }); 
}
// ==================== 蔥友機與拳頭PK機 全域遊戲邏輯 ====================

window.replyInvite = function(replyType) {
    let modal = document.getElementById('invite-modal');
    modal.style.display = 'none';
    if (window.inviteTimerInterval) clearInterval(window.inviteTimerInterval);
    
    let attacker = window.currentInviteAttacker;
    if (attacker) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.update(module.ref(window.GameLogic.db, `serverEvents/inviteReplies/${attacker}`), { reply: replyType, replierUid: window.GameLogic.currentUser.uid, time: Date.now() });
            
            if (replyType === 'yes') {
                window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null;
                let roomId = `playroom_${attacker}_${window.GameLogic.currentUser.uid}`;
                
                // 修正2：進入 Playroom 前，強迫清空舊有房間狀態，確保一切從頭開始
                module.set(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'none' });
                
                window.switchScene('playroom', { roomId: roomId });
            }
        });
    }
};

// 修正2：補上遺失的重置與斷線處理函式，確保隨時可將機台清空
window.cancelRpsGame = function(roomId) {
    let id = roomId || window.GameLogic.currentRoomId;
    if (!id) return;
    
    document.getElementById('rps-modal').style.display = 'none';
    let waitPhase = document.getElementById('rps-phase-waiting');
    if (waitPhase) waitPhase.style.display = 'none';
    let summaryEl = document.getElementById('rps-phase-summary');
    if (summaryEl) summaryEl.style.display = 'none';
    
    // 清除結算音效鎖與落金粉粒子
    window.calcResultSoundPlayed = false;
    let dust = document.getElementById('rps-dust-container');
    if (dust) dust.innerHTML = '';
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `playroomGames/${id}`), { state: 'none' });
        if (window.GameLogic.currentUser) {
            module.update(module.ref(window.GameLogic.db, `playroomGames/${id}/p_${window.GameLogic.currentUser.uid}`), { machineReady: null, betReady: null });
        }
    });
};

window.handleRpsDisconnect = function(roomId) {
    if (window.rpsPhase === 'calc_result') {
        window.switchScene('cafe');
        return;
    }
    alert("對方已離線或離開交誼廳，機台連線中斷！");
    window.cancelRpsGame(roomId);
    window.switchScene('cafe');
};

window.exitPlayroom = function() {
    document.getElementById('rps-modal').style.display = 'none';
    window.cancelRpsGame(); // 離開時連帶重置
    window.switchScene('cafe');
};

window.openRpsBetting = function(roomId) {
    if (!roomId) return;
    let players = Object.keys(window.GameLogic.playroomPlayers || {});
    if (players.length < 2) return alert("等對方進來再開始喔！");
    
    // 修正1：按下A只改變自己的機台準備狀態，不強制所有人進入下注
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}/p_${window.GameLogic.currentUser.uid}`), { machineReady: true });
    });
};

window.confirmRpsBet = function() {
    let betVal = parseInt(document.getElementById('rps-bet-slider').value) || 0;
    document.getElementById('rps-bet-input-area').style.display = 'none';
    document.getElementById('rps-bet-status-me').innerText = "✅已下注";
    document.getElementById('rps-bet-status-me').style.color = "#00ff00";
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`), { betReady: true, betValue: betVal });
    });
};

window.selectRps = function(choice) {
    if (window.rpsPhase !== 'rps_countdown') return;
    
    // 加上發光選取特效
    document.querySelectorAll('.rps-choice-img').forEach(el => el.classList.remove('rps-choice-selected'));
    document.getElementById('rps-choice-' + choice).classList.add('rps-choice-selected');

    document.getElementById('rps-me-img').style.backgroundImage = `url('playroom-rps-onion-me-${choice}.png')`;
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`), { rpsChoice: choice });
    });
};

window.clickRpsSpam = function() {
    if (window.rpsPhase !== 'spamming') return;
    let now = Date.now();
    if (!window.rpsLastClickTimes) window.rpsLastClickTimes = [];
    window.rpsLastClickTimes = window.rpsLastClickTimes.filter(t => now - t < 1000);
    if (window.rpsLastClickTimes.length >= 15) return; 
    
    // 修正7：新增按鈕打擊音效 (同時播放兩種)
    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) {
            window.playSFX(ms, 'playroom-figjt-buttom');
            window.playSFX(ms, 'playroom-figjt-buttom-sound-2');
        }
    }
    
    window.rpsLastClickTimes.push(now);
    window.rpsMySpamCount++;
    
    // 按鈕點擊縮放動畫
    let btn = document.getElementById('rps-spam-btn');
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 50);
    
    // Tweens 按鈕微光特效
    let burst = document.createElement('div');
    burst.className = 'rps-spam-burst';
    burst.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; border-radius:20px; z-index:1; pointer-events:none;';
    btn.parentElement.appendChild(burst);
    setTimeout(() => burst.remove(), 300);

    // 畫面中央底圖迸發類似煙火的噴發特效 (修正9：擴大為滿版 3 顆大煙火)
    let pContainer = document.getElementById('rps-spam-particles');
    if (pContainer) {
        let colors = ['#ff0000', '#ff8c00', '#ffff00', '#8a2be2', '#ffffff'];
        for(let i = 0; i < 3; i++) {
            let dot = document.createElement('div');
            let color = colors[Math.floor(Math.random() * colors.length)];
            let size = Math.random() * 20 + 30; // 巨大粒子
            dot.style.cssText = `position:absolute; top:50%; left:50%; width:${size}px; height:${size}px; background:${color}; border-radius:50%; box-shadow:0 0 30px ${color}, 0 0 50px #fff; pointer-events:none; mix-blend-mode: screen;`;
            pContainer.appendChild(dot);
            let angle = Math.random() * Math.PI * 2;
            let dist = Math.random() * 400 + 200; // 擴散近乎全螢幕
            let tx = Math.cos(angle) * dist;
            let ty = Math.sin(angle) * dist;
            dot.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(3)`, opacity: 0 }
            ], { duration: 600 + Math.random() * 400, easing: 'ease-out' }).onfinish = () => dot.remove();
        }
    }

    // 定義全域播放精靈圖動畫的幫助函式 (僅需定義一次，放這也行)
    if (!window.triggerRpsAnim) {
        window.triggerRpsAnim = function(elementId, isAttacker) {
            let div = document.getElementById(elementId);
            if (!div) return;
            div.style.backgroundImage = isAttacker ? "url('playroom-rps-onion-win-hit-moving.png')" : "url('playroom-rps-onion-lose-defense-moving.png')";
            div.style.backgroundSize = '200% 100%';
            div.style.backgroundPosition = 'left center';
            div.classList.add('rps-sprite-moving');
            
            if (div.animTimeout) clearTimeout(div.animTimeout);
            div.animTimeout = setTimeout(() => {
                div.classList.remove('rps-sprite-moving');
                div.style.backgroundSize = 'contain';
                div.style.backgroundPosition = 'center center';
                div.style.backgroundImage = isAttacker ? "url('playroom-rps-onion-win-hit.png')" : "url('playroom-rps-onion-lose-defense.png')";
            }, 150);
        };
    }
    
    // 人物連擊精靈圖切換 (自己)
    window.triggerRpsAnim('rps-me-img', window.rpsMyRole === 'attacker');
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.update(module.ref(window.GameLogic.db, `playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`), { spamCount: window.rpsMySpamCount });
    });
};

window.syncRpsState = function(roomId) {
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        if (window.rpsUnsubscribe) window.rpsUnsubscribe();
        window.rpsUnsubscribe = module.onValue(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), snap => {
            let data = snap.val(); if (!data) return;
            let state = data.state;
            window.rpsPhase = state;
            let myUid = window.GameLogic.currentUser.uid;
            let uids = Object.keys(data).filter(k => k.startsWith('p_')).map(k => k.replace('p_', ''));
            let otherUid = uids.find(u => u !== myUid);
            
            let myData = data[`p_${myUid}`] || {};
            let otherData = data[`p_${otherUid}`] || {};

          // 處理雙方暱稱顯示
            let pList = window.GameLogic.playroomPlayers || {};
            let myName = pList[myUid] ? pList[myUid].name : '我';
            let opName = pList[otherUid] ? pList[otherUid].name : '對手';
            document.getElementById('rps-me-name-top').innerText = myName;
            document.getElementById('rps-me-name-bot').innerText = myName;
            document.getElementById('rps-op-name-top').innerText = opName;
            document.getElementById('rps-op-name-bot').innerText = opName;

            // 定義爆發特效函數
            if (!window.triggerRpsWinExplosion) {
                window.triggerRpsWinExplosion = function(containerId) {
                    let container = document.getElementById(containerId);
                    if (!container) return;
                    for(let i=0; i<30; i++) {
                        let p = document.createElement('div');
                        let size = Math.random() * 15 + 10;
                        let colors = ['#ffcc00', '#ffffff', '#ff4500', '#00ffff'];
                        let color = colors[Math.floor(Math.random() * colors.length)];
                        p.style.cssText = `position:absolute; top:50%; left:50%; width:${size}px; height:${size}px; background:${color}; border-radius:50%; box-shadow:0 0 20px ${color}; pointer-events:none; mix-blend-mode:screen; transform:translate(-50%, -50%);`;
                        container.appendChild(p);
                        let angle = Math.random() * Math.PI * 2;
                        let dist = Math.random() * 200 + 100;
                        p.animate([
                            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                            { transform: `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`, opacity: 0 }
                        ], { duration: 600 + Math.random()*400, easing: 'ease-out' }).onfinish = () => p.remove();
                    }
                };
            }

            // --- 修正1：動態插入等待機台畫面 ---
            let waitPhase = document.getElementById('rps-phase-waiting');
            if (!waitPhase) {
                waitPhase = document.createElement('div');
                waitPhase.id = 'rps-phase-waiting';
                waitPhase.style.cssText = 'display:none; flex-direction:column; align-items:center; z-index:10; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:100%; text-align:center;';
                waitPhase.innerHTML = '<h2 style="color:#00ffff;">機台連線中...</h2><p style="margin-bottom: 20px;">等待另一位玩家也對機台按下 A 鍵確認加入</p><button class="btn-secondary" style="padding:10px 30px; font-size:18px;" onclick="window.cancelRpsGame()">取消連線</button>';
                document.getElementById('rps-modal').appendChild(waitPhase);
            }

            // 判斷是否雙方都按了 A，進入等待或由主機端觸發正式下注
            if (!state || state === 'none') {
                if (myData.machineReady) {
                    if (otherData.machineReady) {
                        if (uids.sort()[0] === myUid) {
                            module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'betting' });
                            module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}/p_${myUid}`), { betReady: false, betValue: 0, machineReady: null });
                            module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}/p_${otherUid}`), { betReady: false, betValue: 0, machineReady: null });
                        }
                    } else {
                        // 只有我按了 A，顯示等待畫面
                        document.getElementById('rps-modal').style.display = 'flex';
                        document.getElementById('rps-modal').classList.remove('rps-gaming-bg');
                        document.getElementById('rps-phase-bet').style.display = 'none';
                        document.getElementById('rps-phase-game').style.display = 'none';
                        document.getElementById('rps-phase-result').style.display = 'none';
                        waitPhase.style.display = 'flex';
                    }
                } else {
                        let modal = document.getElementById('rps-modal');
                        if (modal.style.display === 'flex') {
                            window.switchScene('cafe'); // 斷線或提早關閉遊戲，拉落單者回大廳
                        }
                        modal.style.display = 'none';
                        waitPhase.style.display = 'none';
                    }
                return; 
            }
            
            waitPhase.style.display = 'none'; // 進入正式階段後隱藏等待畫面

            if (state === 'betting') {
                // 清除所有背景動畫 class
                document.getElementById('rps-modal').className = '';
                
                // 判斷是否為剛進入下注畫面，用於決定是否將拉條歸零
                let isFirstLoad = document.getElementById('rps-phase-bet').style.display !== 'flex';
                
                let modal = document.getElementById('rps-modal');
                modal.style.display = 'flex';
                document.getElementById('rps-phase-bet').style.display = 'flex';
                document.getElementById('rps-phase-game').style.display = 'none';
                document.getElementById('rps-phase-result').style.display = 'none';
                
                // 動態更新雙方暱稱與狀態
                let pList = window.GameLogic.playroomPlayers || {};
                document.getElementById('rps-bet-name-me').innerText = pList[myUid] ? pList[myUid].name : '我';
                document.getElementById('rps-bet-name-op').innerText = pList[otherUid] ? pList[otherUid].name : '對手';
                
                // 同步更新戰鬥畫面的暱稱
                if (document.getElementById('rps-me-name')) document.getElementById('rps-me-name').innerText = pList[myUid] ? pList[myUid].name : '我';
                if (document.getElementById('rps-opponent-name')) document.getElementById('rps-opponent-name').innerText = pList[otherUid] ? pList[otherUid].name : '對手';
                
                let meStatusEl = document.getElementById('rps-bet-status-me');
                let opStatusEl = document.getElementById('rps-bet-status-op');
                let inputArea = document.getElementById('rps-bet-input-area');
                
                if (myData.betReady) {
                    meStatusEl.innerText = "✅已下注"; meStatusEl.style.color = "#00ff00";
                    if (inputArea) inputArea.style.display = 'none'; // 自己下注後隱藏拉條
                } else {
                    meStatusEl.innerText = "下注中..."; meStatusEl.style.color = "#ffaa00";
                    if (inputArea) inputArea.style.display = 'flex'; // 顯示拉條與按鈕
                }
                
                if (otherData.betReady) {
                    opStatusEl.innerText = "✅已下注"; opStatusEl.style.color = "#00ff00";
                } else {
                    opStatusEl.innerText = "下注中..."; opStatusEl.style.color = "#ffaa00";
                }

                // 只有自己還沒確認時，才需要重新讀取拉條並綁定事件
                if (!myData.betReady) {
                    module.get(module.ref(window.GameLogic.db, `users`)).then(uSnap => {
                        let uDB = uSnap.val() || {};
                        let p1Coins = (uDB[uids[0]] && uDB[uids[0]].coins) ? uDB[uids[0]].coins : 0;
                        let p2Coins = (uDB[uids[1]] && uDB[uids[1]].coins) ? uDB[uids[1]].coins : 0;
                        
                        let maxBet = Math.max(0, Math.min(p1Coins, p2Coins, 10000));
                        if (isNaN(maxBet)) maxBet = 0;
                        
                        let slider = document.getElementById('rps-bet-slider');
                        slider.max = maxBet; 
                        
                        // 修正：只有首次開啟時才將數值歸零，避免對方下注觸發狀態同步時把自己的拉條歸零
                        if (isFirstLoad) {
                            slider.value = 0;
                            document.getElementById('rps-bet-display').innerText = 0;
                        }
                        
                        slider.oninput = function() { document.getElementById('rps-bet-display').innerText = this.value; };
                        slider.onchange = function() { document.getElementById('rps-bet-display').innerText = this.value; };
                    });
                }
                
                if (myData.betReady && otherData.betReady && uids.sort()[0] === myUid) {
                    let avgBet = Math.round((myData.betValue + otherData.betValue) / 2);
                    module.get(module.ref(window.GameLogic.db, `users`)).then(uSnap => {
                        let uDB = uSnap.val();
                        let p1C = (uDB[myUid]?.coins || 0) - avgBet;
                        let p2C = (uDB[otherUid]?.coins || 0) - avgBet;
                        
                        let maxBet = Math.max(0, Math.min(uDB[myUid]?.coins || 0, uDB[otherUid]?.coins || 0, 10000));
                        let ratio = maxBet > 0 ? (avgBet / maxBet) : 0;
                        let mult = 1;
                        if (ratio > 2/3) mult = 2;
                        else if (ratio > 1/3) mult = 1.5;

                        module.update(module.ref(window.GameLogic.db, `users/${myUid}`), { coins: Math.max(0, p1C) });
                        module.update(module.ref(window.GameLogic.db, `users/${otherUid}`), { coins: Math.max(0, p2C) });
                        
                        module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { 
                            state: 'bet_summary', 
                            agreedBet: avgBet, 
                            bonusMult: mult,
                            summaryStartTime: Date.now()
                        });
                    });
                }
            }
            else if (state === 'bet_summary') {
                document.getElementById('rps-phase-bet').style.display = 'none';
                document.getElementById('rps-phase-game').style.display = 'none';
                document.getElementById('rps-phase-result').style.display = 'none';
                
                let summaryEl = document.getElementById('rps-phase-summary');
                if (!summaryEl) {
                    summaryEl = document.createElement('div');
                    summaryEl.id = 'rps-phase-summary';
                    summaryEl.style.cssText = 'display:flex; flex-direction:column; align-items:center; z-index:10; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:80%; max-width:400px; text-align:center; background:rgba(0,0,0,0.85); border:3px solid #ffcc00; padding:25px; border-radius:15px; box-shadow: 0 0 30px #ffcc00;';
                    document.getElementById('rps-modal').appendChild(summaryEl);
                }
                summaryEl.style.display = 'flex';
                
                let totalBet = (data.agreedBet || 0) * 2;
                let mult = data.bonusMult || 1;
                let multText = mult === 2 ? '2.0倍 (激進下注！)' : (mult === 1.5 ? '1.5倍 (勇敢下注)' : '無加成 (保守下注)');
                let multColor = mult === 2 ? '#ff00ff' : (mult === 1.5 ? '#00ffff' : '#aaa');
                let finalPool = Math.round(totalBet * mult);
                
                summaryEl.innerHTML = `
                    <h2 style="color:#ffcc00; margin-top:0; border-bottom:1px solid #ffcc00; padding-bottom:10px;">結算下注</h2>
                    <p style="font-size:18px; color:#fff; margin:10px 0;">雙方平均確認下注: <span style="color:#ffcc00;">${data.agreedBet}</span></p>
                    <p style="font-size:18px; color:#fff; margin:10px 0;">系統獎勵: <span style="color:${multColor}; font-weight:bold;">${multText}</span></p>
                    <hr style="width:100%; border:1px dashed #777; margin:15px 0;">
                    <h1 style="color:#ff4500; font-size:36px; margin:0; text-shadow:0 0 10px #ff0000;">總獎金池: ${finalPool}</h1>
                `;
                
                if (uids.sort()[0] === myUid && !data.summaryProcessed) {
                    module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { summaryProcessed: true });
                    setTimeout(() => {
                        module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { 
                            state: 'rps_countdown', 
                            rpsStartTime: Date.now(),
                            roundCount: 1,
                            [`p_${myUid}/roundWins`]: 0,
                            [`p_${otherUid}/roundWins`]: 0,
                            [`p_${myUid}/rpsChoice`]: null,
                            [`p_${otherUid}/rpsChoice`]: null
                        });
                    }, 3000);
                }
            }
            else if (state === 'rps_countdown') {
                let summaryEl = document.getElementById('rps-phase-summary');
                if (summaryEl) summaryEl.style.display = 'none';
                
                // 進入猜拳倒數，套用漸變底色 (5秒黑變深橘)
                document.getElementById('rps-modal').className = 'rps-bg-phase-count';
                
                // 顯示上方名字，隱藏下方名字
                document.getElementById('rps-me-name-top').style.display = 'block';
                document.getElementById('rps-me-name-bot').style.display = 'none';
                document.getElementById('rps-op-name-top').style.display = 'block';
                document.getElementById('rps-op-name-bot').style.display = 'none';

                document.getElementById('rps-phase-bet').style.display = 'none';
                document.getElementById('rps-phase-game').style.display = 'block';
                document.getElementById('rps-choices').style.display = 'flex';
                document.getElementById('rps-spam-area').style.display = 'none';
                
                document.getElementById('rps-me-img').style.backgroundImage = "url('playroom-rps-onion-me-ready.png')";
                document.getElementById('rps-opponent-img').style.backgroundImage = "url('playroom-rps-onion-other-ready.png')";
                
                // 套用左右(上下)雀躍跳動的動畫
                document.getElementById('rps-me-img').className = "rps-anim-hopping";
                document.getElementById('rps-opponent-img').className = "rps-anim-hopping";
                
                document.querySelectorAll('.rps-choice-img').forEach(el => el.classList.remove('rps-choice-selected'));
                // 依據資料庫中已選擇的選項，重新補回發亮特效，防止被 onValue 重置
                if (myData.rpsChoice) {
                    let selBtn = document.getElementById(`rps-choice-${myData.rpsChoice}`);
                    if (selBtn) selBtn.classList.add('rps-choice-selected');
                }
                
                let meC = document.getElementById('rps-me-container');
                let opC = document.getElementById('rps-opponent-container');
                meC.className = ""; opC.className = ""; // 拔除連擊階段的鎖定 class
                meC.style.top = 'auto'; meC.style.right = 'auto'; meC.style.transform = 'none';
                // 使用 cssText 以確保 CSS 媒體查詢不會被絕對寫死的值綁架
                meC.style.cssText = "position:absolute; bottom:20px; left:20px; text-align:center; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:20;";
                opC.style.cssText = "position:absolute; top:20px; right:20px; text-align:center; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:10;";
                
                // 猜拳階段：暱稱顯示在圖片上方
                if(document.getElementById('rps-me-name')) { document.getElementById('rps-me-name').style.top = '-30px'; document.getElementById('rps-me-name').style.bottom = 'auto'; }
                if(document.getElementById('rps-opponent-name')) { document.getElementById('rps-opponent-name').style.top = '-30px'; document.getElementById('rps-opponent-name').style.bottom = 'auto'; }
                
                let rpsMsg = document.getElementById('rps-center-msg');
                rpsMsg.style.top = '20%';
                rpsMsg.style.opacity = '1';
                rpsMsg.getAnimations().forEach(a => a.cancel()); // 確保移除之前的殘留動畫
                
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                window.rpsInterval = setInterval(() => {
                    let elapsed = Date.now() - data.rpsStartTime;
                    let remain = 5 - Math.floor(elapsed / 1000);
                    if (remain > 0) {
                        let textArr = [1, 2, 3, 4, 5];
                        let newText = textArr[remain-1] || remain;
                        if (rpsMsg.innerText != newText) {
                            rpsMsg.innerText = newText;
                            // 漸變大且淡出特效 (放大兩倍)
                            rpsMsg.animate([
                                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                                { transform: 'translate(-50%, -50%) scale(3)', opacity: 0 }
                            ], { duration: 900, easing: 'ease-out' });
                            
                            // 播放倒數音效
                            if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
                                let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
                                if (remain >= 2 && remain <= 5) window.playSFX(ms, 'playroom-count-down');
                                else if (remain === 1) window.playSFX(ms, 'playroom-count-down-times-up');
                            }
                        }
                    } else {
                        if (rpsMsg.innerText !== "出拳！") {
                            rpsMsg.innerText = "出拳！";
                            rpsMsg.animate([
                                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                                { transform: 'translate(-50%, -50%) scale(3)', opacity: 0 }
                            ], { duration: 900, easing: 'ease-out' });
                        }
                        clearInterval(window.rpsInterval);
                        if (uids.sort()[0] === myUid) module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'rps_result' });
                    }
                }, 100);
            }
            else if (state === 'rps_result') {
                document.getElementById('rps-choices').style.display = 'none';
                let mC = myData.rpsChoice || 'stone';
                let oC = otherData.rpsChoice || 'stone';
                
                document.getElementById('rps-me-img').style.backgroundImage = `url('playroom-rps-onion-me-${mC}.png')`;
                document.getElementById('rps-opponent-img').style.backgroundImage = `url('playroom-rps-onion-other-${oC}.png')`;
                
                // 移除跳躍動畫，套用定格放大
                document.getElementById('rps-me-img').className = "rps-anim-result-scale";
                document.getElementById('rps-opponent-img').className = "rps-anim-result-scale";
                
                // 讓雙方角色容器斜向中央靠攏，模擬對戰衝突感
                let meC = document.getElementById('rps-me-container');
                let opC = document.getElementById('rps-opponent-container');
                meC.style.transform = "translate(15vw, -15vh)";
                opC.style.transform = "translate(-15vw, 15vh)";
                
                let result = 'tie';
                if ((mC === 'scissors' && oC === 'paper') || (mC === 'stone' && oC === 'scissors') || (mC === 'paper' && oC === 'stone')) result = 'win';
                else if (mC !== oC) result = 'lose';

                document.getElementById('rps-me-status').innerText = result === 'win' ? '贏！' : (result === 'lose' ? '輸！' : '平手');
                document.getElementById('rps-opponent-status').innerText = result === 'lose' ? '贏！' : (result === 'win' ? '輸！' : '平手');
                if (!data.explosionPlayed) {
                    if (result === 'win') window.triggerRpsWinExplosion('rps-me-img');
                    else if (result === 'lose') window.triggerRpsWinExplosion('rps-opponent-img');
                    
                    if (uids.sort()[0] === myUid) {
                         import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { explosionPlayed: true }));
                    }
                }
                // 猜拳結果判定當下：勝利方產生大量橘紅氣泡特效
                if (result !== 'tie') {
                    let winnerEl = result === 'win' ? document.getElementById('rps-me-container') : document.getElementById('rps-opponent-container');
                    let pContainer = document.getElementById('rps-spam-particles');
                    if (pContainer && winnerEl) {
                        let rect = winnerEl.getBoundingClientRect();
                        let cx = rect.left + rect.width / 2;
                        let cy = rect.top + rect.height / 2;
                        for (let i = 0; i < 40; i++) {
                            let dot = document.createElement('div');
                            let color = Math.random() > 0.5 ? '#ff4500' : '#ff0000'; // 橘紅相間
                            let size = Math.random() * 15 + 10;
                            dot.style.cssText = `position:fixed; top:${cy}px; left:${cx}px; width:${size}px; height:${size}px; background:${color}; border-radius:50%; box-shadow:0 0 15px ${color}; pointer-events:none; z-index:999; mix-blend-mode: screen;`;
                            pContainer.appendChild(dot);
                            let angle = Math.random() * Math.PI * 2;
                            let dist = Math.random() * 300 + 100;
                            let tx = Math.cos(angle) * dist;
                            let ty = Math.sin(angle) * dist;
                            dot.animate([
                                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
                            ], { duration: 600 + Math.random() * 400, easing: 'ease-out' }).onfinish = () => dot.remove();
                        }
                    }
                }
                
                if (uids.sort()[0] === myUid) {
                    if (!window.rpsStateTimeout) {
                        window.rpsStateTimeout = setTimeout(() => {
                            if (result === 'tie') {
                                module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'rps_countdown', rpsStartTime: Date.now(), [`p_${myUid}/rpsChoice`]: null, [`p_${otherUid}/rpsChoice`]: null });
                            } else {
                                module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'spam_countdown', winnerUid: result === 'win' ? myUid : otherUid, spamStartTime: Date.now(), [`p_${myUid}/spamCount`]: 0, [`p_${otherUid}/spamCount`]: 0 });
                            }
                            window.rpsStateTimeout = null;
                        }, 2000);
                    }
                }
            }
            else if (state === 'spam_countdown') {
                window.rpsMySpamCount = 0;
                window.rpsOtherSpamCount = 0;
                
                document.getElementById('rps-me-status').innerText = "";
                document.getElementById('rps-opponent-status').innerText = "";
                
                let isWinner = data.winnerUid === myUid;
                window.rpsMyRole = isWinner ? 'attacker' : 'defender';
                
                // 移除結果放大特效，恢復原始狀態
                document.getElementById('rps-me-img').className = "";
                document.getElementById('rps-opponent-img').className = "";
                
                document.getElementById('rps-me-img').style.backgroundImage = isWinner ? "url('playroom-rps-onion-win-hit.png')" : "url('playroom-rps-onion-lose-defense.png')";
                document.getElementById('rps-opponent-img').style.backgroundImage = !isWinner ? "url('playroom-rps-onion-win-hit.png')" : "url('playroom-rps-onion-lose-defense.png')";
                
                // 背景閃爍兩下白光，準備進入連擊
                document.getElementById('rps-modal').className = 'rps-bg-phase-flash';

                // 隱藏上方名字，顯示下方名字
                document.getElementById('rps-me-name-top').style.display = 'none';
                document.getElementById('rps-me-name-bot').style.display = 'block';
                document.getElementById('rps-op-name-top').style.display = 'none';
                document.getElementById('rps-op-name-bot').style.display = 'block';

                let meC = document.getElementById('rps-me-container');
                let opC = document.getElementById('rps-opponent-container');
                meC.className = ""; opC.className = ""; // 確保清理乾淨
                meC.style.cssText = "position:absolute; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:20;";
                opC.style.cssText = "position:absolute; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:10;";
                
                // 連擊階段：暱稱顯示在圖片下方
                if(document.getElementById('rps-me-name')) { document.getElementById('rps-me-name').style.bottom = '-30px'; document.getElementById('rps-me-name').style.top = 'auto'; }
                if(document.getElementById('rps-opponent-name')) { document.getElementById('rps-opponent-name').style.bottom = '-30px'; document.getElementById('rps-opponent-name').style.top = 'auto'; }
                
                // 攻擊方必定在左(35%)，防守方必定在右(65%)，網頁版也向中間靠攏增加打架感
                if (isWinner) {
                    meC.classList.add("spam-phase-pos-atk");
                    opC.classList.add("spam-phase-pos-def");
                    meC.style.left = '35%'; meC.style.top = '45%'; meC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                    opC.style.left = '65%'; opC.style.top = '45%'; opC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                } else {
                    meC.classList.add("spam-phase-pos-def");
                    opC.classList.add("spam-phase-pos-atk");
                    meC.style.left = '65%'; meC.style.top = '45%'; meC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                    opC.style.left = '35%'; opC.style.top = '45%'; opC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                }
                
                let rpsMsg = document.getElementById('rps-center-msg');
                rpsMsg.style.top = '45%';
                rpsMsg.style.opacity = '1';
                rpsMsg.getAnimations().forEach(a => a.cancel()); // 確保移除之前的殘留動畫
                
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                window.rpsInterval = setInterval(() => {
                    let elapsed = Date.now() - data.spamStartTime;
                    let remain = 3 - Math.floor(elapsed / 1000);
                    let tEl = document.getElementById('rps-spam-timer');
                    
                    if (remain > 0) {
                        if (rpsMsg.innerText != remain) {
                            rpsMsg.innerText = remain;
                            if (tEl) tEl.innerText = remain; // 確保連擊計時器也被同步設定
                            // 修正：對中央的大字體做漸變放大與淡出
                            rpsMsg.animate([ { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(3)', opacity: 0 } ], { duration: 900, easing: 'ease-out' });
                            
                            // 播放倒數音效
                            if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
                                let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
                                if (remain >= 2 && remain <= 5) window.playSFX(ms, 'playroom-count-down');
                                else if (remain === 1) window.playSFX(ms, 'playroom-count-down-times-up');
                            }
                        }
                    } else {
                        if (rpsMsg.innerText !== "GO!") {
                            rpsMsg.innerText = "GO!";
                            let anim = rpsMsg.animate([ { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 } ], { duration: 900, easing: 'ease-out' });
                            anim.onfinish = () => { rpsMsg.style.opacity = '0'; }; // 動畫結束後徹底隱藏 GO!
                        }
                        clearInterval(window.rpsInterval);
                        if (uids.sort()[0] === myUid) module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'spamming', spamPlayTime: Date.now() });
                    }
                }, 100);
            }
            else if (state === 'rps_result') {
                document.getElementById('rps-choices').style.display = 'none';
                let mC = myData.rpsChoice || 'stone';
                let oC = otherData.rpsChoice || 'stone';
                
                document.getElementById('rps-me-img').style.backgroundImage = `url('playroom-rps-onion-me-${mC}.png')`;
                document.getElementById('rps-opponent-img').style.backgroundImage = `url('playroom-rps-onion-other-${oC}.png')`;
                
                let result = 'tie';
                if ((mC === 'scissors' && oC === 'paper') || (mC === 'stone' && oC === 'scissors') || (mC === 'paper' && oC === 'stone')) result = 'win';
                else if (mC !== oC) result = 'lose';

                document.getElementById('rps-me-status').innerText = result === 'win' ? '贏！' : (result === 'lose' ? '輸！' : '平手');
                document.getElementById('rps-opponent-status').innerText = result === 'lose' ? '贏！' : (result === 'win' ? '輸！' : '平手');
                if (!data.explosionPlayed) {
                    if (result === 'win') window.triggerRpsWinExplosion('rps-me-img');
                    else if (result === 'lose') window.triggerRpsWinExplosion('rps-opponent-img');
                    
                    if (uids.sort()[0] === myUid) {
                         import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { explosionPlayed: true }));
                    }
                }
                // 猜拳結果判定當下：勝利方產生大量橘紅氣泡特效
                if (result !== 'tie') {
                    let winnerEl = result === 'win' ? document.getElementById('rps-me-container') : document.getElementById('rps-opponent-container');
                    let pContainer = document.getElementById('rps-spam-particles');
                    if (pContainer && winnerEl) {
                        let rect = winnerEl.getBoundingClientRect();
                        let cx = rect.left + rect.width / 2;
                        let cy = rect.top + rect.height / 2;
                        for (let i = 0; i < 40; i++) {
                            let dot = document.createElement('div');
                            let color = Math.random() > 0.5 ? '#ff4500' : '#ff0000'; // 橘紅相間
                            let size = Math.random() * 15 + 10;
                            dot.style.cssText = `position:fixed; top:${cy}px; left:${cx}px; width:${size}px; height:${size}px; background:${color}; border-radius:50%; box-shadow:0 0 15px ${color}; pointer-events:none; z-index:999; mix-blend-mode: screen;`;
                            pContainer.appendChild(dot);
                            let angle = Math.random() * Math.PI * 2;
                            let dist = Math.random() * 300 + 100;
                            let tx = Math.cos(angle) * dist;
                            let ty = Math.sin(angle) * dist;
                            dot.animate([
                                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
                            ], { duration: 600 + Math.random() * 400, easing: 'ease-out' }).onfinish = () => dot.remove();
                        }
                    }
                }
                
                if (uids.sort()[0] === myUid) {
                    if (!window.rpsStateTimeout) {
                        window.rpsStateTimeout = setTimeout(() => {
                            if (result === 'tie') {
                                module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'rps_countdown', rpsStartTime: Date.now(), [`p_${myUid}/rpsChoice`]: null, [`p_${otherUid}/rpsChoice`]: null });
                            } else {
                                module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'spam_countdown', winnerUid: result === 'win' ? myUid : otherUid, spamStartTime: Date.now(), [`p_${myUid}/spamCount`]: 0, [`p_${otherUid}/spamCount`]: 0 });
                            }
                            window.rpsStateTimeout = null;
                        }, 2000);
                    }
                }
            }
            else if (state === 'spam_countdown') {
                window.rpsMySpamCount = 0;
                window.rpsOtherSpamCount = 0;
                
                document.getElementById('rps-me-status').innerText = "";
                document.getElementById('rps-opponent-status').innerText = "";
                
                let isWinner = data.winnerUid === myUid;
                window.rpsMyRole = isWinner ? 'attacker' : 'defender';
                
                document.getElementById('rps-me-img').style.backgroundImage = isWinner ? "url('playroom-rps-onion-win-hit.png')" : "url('playroom-rps-onion-lose-defense.png')";
                document.getElementById('rps-opponent-img').style.backgroundImage = !isWinner ? "url('playroom-rps-onion-win-hit.png')" : "url('playroom-rps-onion-lose-defense.png')";
                
                // 背景閃爍兩下白光，準備進入連擊
                document.getElementById('rps-modal').className = 'rps-bg-phase-flash';

                // 隱藏上方名字，顯示下方名字
                document.getElementById('rps-me-name-top').style.display = 'none';
                document.getElementById('rps-me-name-bot').style.display = 'block';
                document.getElementById('rps-op-name-top').style.display = 'none';
                document.getElementById('rps-op-name-bot').style.display = 'block';

                let meC = document.getElementById('rps-me-container');
                let opC = document.getElementById('rps-opponent-container');
                meC.style.cssText = "position:absolute; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:20;";
                opC.style.cssText = "position:absolute; transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); z-index:10;";
                
                // 連擊階段：暱稱顯示在圖片下方
                if(document.getElementById('rps-me-name')) { document.getElementById('rps-me-name').style.bottom = '-30px'; document.getElementById('rps-me-name').style.top = 'auto'; }
                if(document.getElementById('rps-opponent-name')) { document.getElementById('rps-opponent-name').style.bottom = '-30px'; document.getElementById('rps-opponent-name').style.top = 'auto'; }
                
                // 攻擊方必定在左(30%)，防守方必定在右(70%)，確保畫面對稱且縮小防跑版
                if (isWinner) {
                    meC.className = "spam-phase-pos-atk";
                    opC.className = "spam-phase-pos-def";
                    meC.style.left = '30%'; meC.style.top = '45%'; meC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                    opC.style.left = '70%'; opC.style.top = '45%'; opC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                } else {
                    meC.className = "spam-phase-pos-def";
                    opC.className = "spam-phase-pos-atk";
                    meC.style.left = '70%'; meC.style.top = '45%'; meC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                    opC.style.left = '30%'; opC.style.top = '45%'; opC.style.transform = 'translate(-50%, -50%) scale(0.85)';
                }
                
                let rpsMsg = document.getElementById('rps-center-msg');
                rpsMsg.style.top = '45%';
                rpsMsg.style.opacity = '1';
                
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                window.rpsInterval = setInterval(() => {
                    let elapsed = Date.now() - data.spamStartTime;
                    let remain = 3 - Math.floor(elapsed / 1000);
                    let tEl = document.getElementById('rps-spam-timer');
                    
                    if (remain > 0) {
                        if (rpsMsg.innerText != remain) {
                            rpsMsg.innerText = remain;
                            if (tEl) tEl.innerText = remain; // 確保連擊計時器也被同步設定
                            // 修正：對中央的大字體做漸變放大與淡出
                            rpsMsg.animate([ { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(3)', opacity: 0 } ], { duration: 900, easing: 'ease-out' });
                            
                            // 播放倒數音效
                            if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
                                let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
                                if (remain >= 2 && remain <= 5) window.playSFX(ms, 'playroom-count-down');
                                else if (remain === 1) window.playSFX(ms, 'playroom-count-down-times-up');
                            }
                        }
                    } else {
                        if (rpsMsg.innerText !== "GO!") {
                            rpsMsg.innerText = "GO!";
                            rpsMsg.animate([ { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 } ], { duration: 900, easing: 'ease-out' });
                        }
                        clearInterval(window.rpsInterval);
                        if (uids.sort()[0] === myUid) module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'spamming', spamPlayTime: Date.now() });
                    }
                }, 100);
            }
            else if (state === 'spamming') {
              // 連擊階段背景變換紅橘黃
                document.getElementById('rps-modal').className = 'rps-bg-phase-spam';
                
                // 確保 GO 文字消失不阻擋視線
                document.getElementById('rps-center-msg').style.opacity = '0';
                
                // 顯示連擊區域與按鈕，並根據攻守方切換文字與顏色
                let spamArea = document.getElementById('rps-spam-area');
                let spamBtn = document.getElementById('rps-spam-btn');
                spamArea.style.display = 'block';
                
                let isWinner = data.winnerUid === myUid;
                if (isWinner) {
                    spamBtn.innerText = "打！";
                    spamBtn.style.background = "#d9534f";
                    spamBtn.style.boxShadow = "0 10px 0 #aa0000";
                } else {
                    spamBtn.innerText = "擋！";
                    spamBtn.style.background = "#0077cc";
                    spamBtn.style.boxShadow = "0 10px 0 #0044aa";
                }

                if (window.rpsInterval) clearInterval(window.rpsInterval);
                window.rpsInterval = setInterval(() => {
                    let elapsed = Date.now() - data.spamPlayTime;
                    let remain = 5 - Math.floor(elapsed / 1000);
                    
                    let currentOtherSpam = otherData.spamCount || 0;
                    if (currentOtherSpam > (window.rpsOtherSpamCount || 0)) {
                        window.rpsOtherSpamCount = currentOtherSpam;
                        let isWinnerAnim = data.winnerUid === myUid;
                        if (window.triggerRpsAnim) window.triggerRpsAnim('rps-opponent-img', !isWinnerAnim);
                    }

                    if (remain > 0) {
                        document.getElementById('rps-spam-timer').innerText = remain;
                    } else {
                        document.getElementById('rps-spam-area').style.display = 'none';
                        clearInterval(window.rpsInterval);
                        if (uids.sort()[0] === myUid) module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { state: 'round_result' });
                    }
                }, 100);
            }
            else if (state === 'round_result') {
              // 結算當下恢復黑色背景
                document.getElementById('rps-modal').className = 'rps-bg-phase-result';
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                document.getElementById('rps-spam-area').style.display = 'none';
                
                let isWinner = data.winnerUid === myUid;
                let mySpams = myData.spamCount || 0;
                let otherSpams = otherData.spamCount || 0;
                
                let winSpam = isWinner ? Math.round(mySpams * 1.1) : Math.round(otherSpams * 1.1);
                let loseSpam = isWinner ? Math.round(otherSpams * 0.9) : Math.round(mySpams * 0.9);
                
                let attackSuccess = winSpam > loseSpam;
                let tieSpam = winSpam === loseSpam;
                
                let roundWinnerUid = null;
                if (!tieSpam) roundWinnerUid = attackSuccess ? data.winnerUid : (data.winnerUid === myUid ? otherUid : myUid);
                
                let rMsg = document.getElementById('rps-center-msg');
                rMsg.getAnimations().forEach(a => a.cancel()); // 移除任何進行中的淡出動畫，確保字能顯示
                rMsg.style.opacity = '1';
                if (tieSpam) {
                    rMsg.innerText = "平局！";
                } else if (roundWinnerUid === myUid) {
                    rMsg.innerText = "本回合勝！";
                } else {
                    rMsg.innerText = "本回合敗！";
                }
                rMsg.animate([
                    { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
                    { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
                    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
                ], { duration: 500, fill: 'forwards' });

                // 由 Host 判定三回合的結算，確認是否分出勝負
                if (uids.sort()[0] === myUid && !data.roundProcessed) {
                    let myCurrentWins = myData.roundWins || 0;
                    let otherCurrentWins = otherData.roundWins || 0;
                    if (roundWinnerUid === myUid) myCurrentWins++;
                    else if (roundWinnerUid === otherUid) otherCurrentWins++;

                    let currentRoundCount = data.roundCount || 1;
                    
                    let updates = { roundProcessed: true };
                    updates[`p_${myUid}/roundWins`] = myCurrentWins;
                    updates[`p_${otherUid}/roundWins`] = otherCurrentWins;
                    
                    setTimeout(() => {
                        if (myCurrentWins >= 2 || otherCurrentWins >= 2 || currentRoundCount >= 3) {
                            updates.state = 'calc_result';
                        } else {
                            updates.state = 'rps_countdown';
                            updates.rpsStartTime = Date.now();
                            updates.roundCount = currentRoundCount + 1;
                            updates.roundProcessed = null;
                            updates[`p_${myUid}/rpsChoice`] = null;
                            updates[`p_${otherUid}/rpsChoice`] = null;
                        }
                        module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), updates);
                    }, 3000);
                    
                    module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { roundProcessed: true });
                }
            }
            else if (state === 'calc_result') {
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                document.getElementById('rps-phase-game').style.display = 'none';
                document.getElementById('rps-phase-result').style.display = 'flex';
                
                let myWins = myData.roundWins || 0;
                let otherWins = otherData.roundWins || 0;
                let totalPool = Math.round((data.agreedBet || 0) * 2 * (data.bonusMult || 1));
                
                let taxRate = 0;
                if (totalPool >= 5000) taxRate = 0.15;
                else if (totalPool >= 1000) taxRate = 0.08;
                else taxRate = 0.03; 
                
                let finalPool = Math.round(totalPool * (1 - taxRate));
                
                let iWinMoney = false; let tieMoney = false;
                if (myWins === otherWins) tieMoney = true;
                else if (myWins > otherWins) iWinMoney = true;
                
                let getAmt = tieMoney ? Math.round(finalPool/2) : (iWinMoney ? finalPool : 0);
                
                let tDesc = "";
                tDesc += `原始獎金池: ${totalPool} (扣稅 ${Math.round(taxRate*100)}% 後剩 ${finalPool})<br><br>`;
                tDesc += `三戰兩勝最終比分 - 你 [ ${myWins} : ${otherWins} ] 對手<br><br>`;
                if (tieMoney) tDesc += `平局收場！雙方拿回 ${getAmt} 馬德幣`;
                else tDesc += iWinMoney ? `🎉 最終勝利！贏得了 ${getAmt} 馬德幣！` : `😭 最終敗北... 失去所有押注。`;
                
                document.getElementById('rps-result-desc').innerHTML = tDesc;
                
                // 播放結算音效與撒滿金粉特效
                if (!window.calcResultSoundPlayed) {
                    window.calcResultSoundPlayed = true;
                    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
                        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
                        if (iWinMoney) window.playSFX(ms, 'playroom-figjt-winner');
                        else if (!tieMoney) window.playSFX(ms, 'playroom-figjt-loser');
                    }
                    
                    // 從上而下撒大量閃爍金粉的粒子特效
                    let rpsModal = document.getElementById('rps-modal');
                    let dustContainer = document.getElementById('rps-dust-container');
                    if(!dustContainer) {
                        dustContainer = document.createElement('div');
                        dustContainer.id = 'rps-dust-container';
                        dustContainer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:5; overflow:hidden;';
                        rpsModal.appendChild(dustContainer);
                    }
                    dustContainer.innerHTML = ''; 
                    for(let i=0; i<100; i++) {
                        let p = document.createElement('div');
                        let size = Math.random() * 8 + 4;
                        p.style.cssText = `position:absolute; top:-30px; left:${Math.random()*100}%; width:${size}px; height:${size}px; background:#ffd700; border-radius:50%; box-shadow:0 0 15px #ffcc00, 0 0 25px #ffffff; opacity:0;`;
                        dustContainer.appendChild(p);
                        let duration = Math.random()*2500 + 2000;
                        let delay = Math.random()*1500;
                        p.animate([
                            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                            { transform: `translateY(${window.innerHeight + 100}px) rotate(360deg)`, opacity: 0 }
                        ], { duration: duration, delay: delay, iterations: Infinity });
                    }
                }
                
                if (uids.sort()[0] === myUid && !data.moneyDistributed) {
                    module.get(module.ref(window.GameLogic.db, `users`)).then(uSnap => {
                        let uDB = uSnap.val();
                        let p1C = uDB[myUid]?.coins || 0;
                        let p2C = uDB[otherUid]?.coins || 0;
                        
                        if (tieMoney) { p1C += getAmt; p2C += getAmt; }
                        else if (iWinMoney) { p1C += getAmt; }
                        else { p2C += getAmt; }
                        
                        module.update(module.ref(window.GameLogic.db, `users/${myUid}`), { coins: p1C });
                        module.update(module.ref(window.GameLogic.db, `users/${otherUid}`), { coins: p2C });
                        module.update(module.ref(window.GameLogic.db, `playroomGames/${roomId}`), { moneyDistributed: true });
                    });
                }
            }
        });
    });
};
