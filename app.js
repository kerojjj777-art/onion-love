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

// ====== 入口房間設定：良之友天地公開，洋蔥五告派團體白名單 ======
const DEFAULT_SERVER_ROOM = "ryoFriends";

const SERVER_ROOMS = {
    onionGang: {
        name: "洋蔥五告派團體",
        access: "whitelist"
    },
    ryoFriends: {
        name: "良之友天地",
        access: "public"
    }
};

const ONION_GANG_WHITELIST = {
    "GkVVzRWAlzenkAUan95q7QfznVb2": true, // onion@gmail.com
    "Qp7eNdE9xJNd8u8U2Tm4NLHTeGW2": true, // doraemon0224pa@gmail.com
    "19yrd3VO1BfcrDWuTudVywoVxbX2": true, // k786zx@gmail.com
    "OhBtu72GvgRa3zHUny2vS8SPTDB2": true, // dorababy1016@gmail.com
    "LeuuapizXVOstM0ppfZ4RR53DvH2": true, // anna626845@gmail.com
    "8vpv8neN7dRFVgQ0YA07Xy5Aj4C3": true  // kerojjj777@gmail.com
};
const SERVER_ROOM_STORAGE_KEY = "onion_last_server_room";

window.getSafeServerRoomId = function(roomId) {
    return SERVER_ROOMS[roomId] ? roomId : DEFAULT_SERVER_ROOM;
};

window.getRememberedServerRoom = function() {
    try {
        const rememberedRoom = localStorage.getItem(SERVER_ROOM_STORAGE_KEY);
        return window.getSafeServerRoomId(rememberedRoom);
    } catch (err) {
        console.warn("讀取入口房間記憶失敗：", err);
        return DEFAULT_SERVER_ROOM;
    }
};

window.rememberServerRoom = function(roomId) {
    const safeRoomId = window.getSafeServerRoomId(roomId);
    try {
        localStorage.setItem(SERVER_ROOM_STORAGE_KEY, safeRoomId);
    } catch (err) {
        console.warn("寫入入口房間記憶失敗：", err);
    }
    return safeRoomId;
};

window.syncLoginRoomSelect = function(roomId = null) {
    const safeRoomId = window.getSafeServerRoomId(
        roomId ||
        (window.GameLogic && window.GameLogic.selectedServerRoom) ||
        window.getRememberedServerRoom()
    );

    if (window.GameLogic) {
        window.GameLogic.selectedServerRoom = safeRoomId;
        window.GameLogic.currentServerRoom = safeRoomId;
    }

    const roomSelect = document.getElementById("server-room-select");
    if (roomSelect) roomSelect.value = safeRoomId;

    return safeRoomId;
};

const initialServerRoom = window.getRememberedServerRoom();
// ====== 入口房間設定結束 ======

window.GameLogic = {
    currentUser: null, currentScene: "doghouse",
    myProfile: { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0, level: 1, exp: 0, coins: 0, sweeps: 0, lastX: 640, lastY: 360, lastScene: "doghouse", currentTrackIdx: 0, inventoryOrder: [], princeBond: 0, princePetCountToday: 0, princeLastPetDate: "", princeRewardsClaimed: {}, princeFeedCountToday: 0, princeLastFeedDate: "" },
    cafePlayers: {}, onlinePlayers: {}, cafeFurniture: {}, doghouseFurniture: {}, shrinePlayers: {}, shrineFurniture: {}, shrineEventData: null, unreadPMs: {}, placingFurnitureKey: null, 
    phaserGame: null, phaserLoaded: false, pendingScene: null, db: db,
    armedItemState: null, armedItemName: null, currentTargetUid: null, currentTargetSprite: null, currentTargetType: null, muteSFX: false, currentTrackIdx: 0, inventoryEditMode: false, moonBunBuffUntil: 0, moonBunSweepPressCount: 0, moonBunBuffEndNotified: false,
    selectedServerRoom: initialServerRoom, currentServerRoom: initialServerRoom, serverRooms: SERVER_ROOMS, authGuardSigningOut: false
};

let cafeUnsubscribe = null, onlinePlayersUnsubscribe = null, connectedUnsubscribe = null, chatUnsubscribe = null, memoryUnsubscribe = null, cafeFurnitureUnsubscribe = null, summonUnsubscribe = null, shrineUnsubscribe = null, shrineEventUnsubscribe = null, profileViewingUid = null;
window.switchScene = switchScene; window.showProfileModal = showProfileModal; window.leaveCafe = leaveCafe; window.signOut = signOut; window.auth = auth;

// ====== 入口房間共用工具 ======
window.getCurrentServerRoomId = function() {
    const roomId = window.GameLogic.currentServerRoom || DEFAULT_SERVER_ROOM;
    return SERVER_ROOMS[roomId] ? roomId : DEFAULT_SERVER_ROOM;
};

window.getCurrentServerRoomName = function() {
    const roomId = window.getCurrentServerRoomId();
    return SERVER_ROOMS[roomId] ? SERVER_ROOMS[roomId].name : SERVER_ROOMS[DEFAULT_SERVER_ROOM].name;
};

window.getServerRoomPath = function(path) {
    const roomId = window.getCurrentServerRoomId();
    return `serverRooms/${roomId}/${path}`;
};

window.canEnterServerRoom = function(uid, roomId) {
    const safeRoomId = SERVER_ROOMS[roomId] ? roomId : DEFAULT_SERVER_ROOM;
    const room = SERVER_ROOMS[safeRoomId];

    if (!room) return false;
    if (room.access === "public") return true;
    if (safeRoomId === "onionGang") return !!ONION_GANG_WHITELIST[uid];

    return false;
};

window.cleanupCurrentServerPresence = async function(uid) {
    if (!uid) return;

    const jobs = [];

    Object.keys(SERVER_ROOMS).forEach(roomId => {
        jobs.push(remove(ref(db, `serverRooms/${roomId}/onlinePlayers/${uid}`)));
        jobs.push(remove(ref(db, `serverRooms/${roomId}/cafePlayers/${uid}`)));
    });

    // 清掉舊版全域在線殘留，只清自己的 uid，不刪整個節點。
    jobs.push(remove(ref(db, `onlinePlayers/${uid}`)));
    jobs.push(remove(ref(db, `cafePlayers/${uid}`)));

    await Promise.allSettled(jobs);
};

window.updateCurrentRoomLabel = function() {
    const roomName = window.getCurrentServerRoomName();
    const topBar = document.getElementById('top-notification-bar');
    if (topBar && window.GameLogic.currentUser) {
        topBar.innerText = `系統通知：目前房間：${roomName}`;
    }
};
// ====== 入口房間共用工具結束 ======

window.openFullscreen = function(src) {
    if (!src || src.endsWith('null') || src === '') return;
    document.getElementById('fullscreen-img').src = src; document.getElementById('fullscreen-viewer').style.display = 'flex';
};
window.closeFullscreen = function() { document.getElementById('fullscreen-viewer').style.display = 'none'; };

window.updateBGMVolume = function(val) {
    let volText = document.getElementById('bgm-vol-text');
    if(volText) volText.innerText = val + '%';
    if (window.GameLogic.phaserGame) {
        let playlist = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire', 'shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success', 'solo-rocket-cruise-bgm', 'solo-rocket-rabbit-shop-bgm'];
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
    // 直接調用原生 play，讓 Phaser 幫你處理音效疊加與資源回收，解決連續金幣音效被截斷的問題
    scene.sound.play(key, { volume: vol });
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
            body.login-bg-active::before { content: ""; position: fixed; inset: 0; background-image: url('cover_pc_2880x1864.png'); background-size: cover; background-position: center; background-repeat: no-repeat; z-index: 0; pointer-events: none; }
            @media (max-width: 768px), (orientation: portrait) { body.login-bg-active::before { background-image: url('cover_phone_1080x1920.png'); } }
            body.login-bg-active #app-container { position: relative; z-index: 1; }
            #login-screen { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(244, 236, 216, 0.9); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); padding: 30px; border: 3px solid var(--mucha-gold); border-radius: 12px; z-index: 300; text-align: center; width: 80%; max-width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
            #login-screen input, #login-screen select { padding: 10px; border: 1px solid var(--mucha-gold); border-radius: 4px; background: #fffdf5; margin-bottom: 15px; width: 85%; font-size: 16px; box-sizing: border-box; font-family: inherit; color: var(--mucha-brown); }
            .login-room-label { display:block; width:85%; margin: 0 auto 6px auto; text-align:left; color:var(--mucha-brown); font-size:13px; font-weight:bold; }
            #join-btn { background: var(--mucha-gold); color: white; border: none; padding: 12px 20px; border-radius: 4px; cursor: pointer; font-size: 16px; width: 95%; }
            .modal { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mucha-paper); padding: 20px; border: 3px solid var(--mucha-gold); border-radius: 12px; z-index: 250; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.8); width: 85%; max-width: 320px; max-height: 80vh; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; }
            .modal h3 { color: var(--mucha-green); margin-top: 0; border-bottom: 1px solid var(--mucha-gold); padding-bottom: 8px; }
            .modal-btns { display: flex; justify-content: space-around; margin-top: 15px; }
            .modal-btns button, .close-modal-btn { padding: 10px 15px; border-radius: 4px; border: none; cursor: pointer; font-family: inherit; font-size: 15px; margin: 5px;}
            .btn-primary { background: var(--mucha-gold); color: white; } .btn-secondary { background: #ccc; color: #333; } .btn-edit { background: var(--mucha-green); color: white; } .btn-danger { background: #d9534f; color: white; }
            .profile-line { display: flex; align-items: center; justify-content: space-between; margin: 10px 0; border-bottom: 1px dashed #ccc; padding-bottom: 5px;}
            .prince-bond-card { margin: 12px 0; padding: 10px; border-radius: 12px; background: rgba(255, 182, 193, 0.35); border: 2px solid rgba(255, 128, 171, 0.85); box-shadow: 0 0 10px rgba(255, 128, 171, 0.45); display: flex; align-items: center; gap: 10px; text-align: left; }
            .prince-heart-icon { position: relative; font-size: 24px; filter: drop-shadow(0 0 6px rgba(255, 105, 180, 0.9)); }
            .prince-heart-icon::after { content: "💗"; position: absolute; left: 0; top: 0; opacity: 0.45; animation: prince-heart-wave 1.4s infinite ease-out; }
            @keyframes prince-heart-wave { 0% { transform: scale(1); opacity: 0.45; } 100% { transform: scale(1.9); opacity: 0; } }
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
            #quick-items-container { display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; gap: 15px; width: 100%; padding: 15px 10px; box-sizing: border-box; scrollbar-width: none; align-items: center; cursor: grab; -webkit-overflow-scrolling: touch; }
#quick-items-container.dragging { cursor: grabbing; scroll-snap-type: none; }
            #quick-items-container::-webkit-scrollbar { display: none; }
            .quick-item { flex: 0 0 60px; height: 60px; border: none; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; background: rgba(255,255,255,0.8); position: relative; transition: 0.3s; scroll-snap-align: center; box-shadow: 0 0 10px rgba(135,206,235,0.5); }
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
            #magic-modal { background: linear-gradient(180deg, #02111d 0%, #003a5e 100%) !important; border: 2px solid #0088cc !important; box-shadow: inset 0 0 30px #00aaff !important; overflow-y: auto !important; overflow-x: hidden !important; max-height: 82vh !important; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
            .water-drop { position: absolute; width: 3px; height: 15px; background: linear-gradient(to bottom, transparent, rgba(135,206,235,0.8)); border-radius: 50%; animation: drip linear infinite; pointer-events:none; z-index:0;}
            @keyframes drip { 0% { transform: translateY(-30px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(300px); opacity: 0; } }

            /* 派對 UI 特效 */
            .party-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding: 10px; width: 100%; box-sizing: border-box; }
            @media (max-width: 768px) { .party-grid { grid-template-columns: repeat(2, 1fr); } }
            .party-slot { background: rgba(0,0,0,0.6); border: 2px solid #ffcc00; border-radius: 8px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; color: #fff; text-shadow: 1px 1px 2px #000; transition: 0.3s; }
            .party-slot-host { position: absolute; top: -10px; left: -10px; background: #d9534f; color: #fff; padding: 2px 8px; border-radius: 8px; font-size: 12px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
            .party-slot.ready { border-color: #00ff00; box-shadow: inset 0 0 15px #00ff00; }
            .party-slot img { width: 50px; height: 50px; margin-bottom: 5px; border-radius: 50%; border: 2px solid var(--mucha-gold); }
            #party-red-flash { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: red; z-index: 900; pointer-events: none; opacity: 0; transition: opacity 0.2s; display: none; }
            @keyframes party-flow { 0% { transform: translate(0, 0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(150px, 150px); opacity: 0; } }
            .party-flow-particle { position:absolute; width:4px; height:4px; background:#00ffff; box-shadow:0 0 8px #00ffff; border-radius:50%; pointer-events:none; animation: party-flow 4s linear infinite; }
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
        <div id="login-screen">
            <h2 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">入館登記</h2>
            <label class="login-room-label" for="server-room-select">選擇入口房間</label>
            <select id="server-room-select">
                <option value="onionGang">洋蔥五告派團體</option>
                <option value="ryoFriends">良之友天地</option>
            </select><br>
            <input type="email" id="user-email" placeholder="信箱 Email"><br>
            <input type="password" id="user-pwd" placeholder="密碼"><br>
            <button id="join-btn">推開洋蔥世界之門</button>
        </div>

        <div id="view-profile-modal" class="modal" style="z-index: 270;">
            <h3 id="vp-title">洋蔥身分證</h3>
            <div class="stats-container"><div>等級 <strong id="vp-level" style="color:var(--mucha-green);">1</strong> (EXP: <span id="vp-exp">0</span>)</div><div>💰 <strong id="vp-coins" style="color:#d4af37;">0</strong> 馬德幣</div></div>
            <div class="profile-line"><span>🧹 掃皮王:</span> <strong id="vp-sweeps">0</strong> 次</div>
            <div class="profile-line"><span>👤 暱稱:</span><strong id="vp-name"></strong><input type="text" id="edit-name" style="display:none; width:50%;"></div>
            <div class="profile-line"><span>🎨 代表色:</span><span id="vp-color" style="display:inline-block; width:20px; height:20px; border-radius:50%; border:2px solid var(--mucha-gold);"></span><input type="color" id="edit-color" style="display:none; width:40px; height:30px; border:none; padding:0; background:none;"></div>
            <div class="profile-line"><span>🎂 生日:</span> <strong id="vp-birth"></strong><input type="text" id="edit-birth" style="display:none;"></div>
            <div class="profile-line"><span>🍛 最愛:</span> <strong id="vp-food"></strong><input type="text" id="edit-food" style="display:none;"></div>
            <div class="profile-line" style="flex-direction: column; align-items: flex-start;"><span>📜 座右銘:</span><i style="color:var(--mucha-green); font-size: 14px; margin-top:5px; width: 100%; text-align: center;">"<span id="vp-motto"></span>"</i><input type="text" id="edit-motto" style="display:none; width: 95%; margin-top:5px;"></div>
              <div id="vp-prince-bond-card" class="prince-bond-card">
                <div class="prince-heart-icon">💗</div>
                <div>
                    <div style="font-size:13px; font-weight:bold; color:#ad1457;">王子麵羈絆</div>
                    <div id="vp-prince-bond-desc" style="font-size:14px; color:#5d4037; font-weight:bold; margin-top:3px;">王子麵把你當空氣</div>
                    <div id="vp-prince-bond-score" style="font-size:11px; color:#8d6e63; margin-top:2px;">0 分</div>
                    <div id="vp-prince-bond-effect" style="font-size:11px; color:#ad1457; margin-top:4px; line-height:1.35;">效果：無</div>
                </div>
            </div>
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

        <div id="party-select-modal" class="modal" style="z-index: 270; width: 300px;">
            <h3 style="color:var(--mucha-green);">選擇派對遊戲</h3>
            <div style="display:flex; flex-direction:column; gap:10px; margin: 15px 0;">
                <div class="catalog-item" style="border-color:#00aaff; background:rgba(0,170,255,0.1);" onclick="window.PartyLogic.selectedGame = '水球礁谷'; document.querySelectorAll('#party-select-modal .catalog-item').forEach(e=>e.style.background='rgba(0,170,255,0.1)'); this.style.background='rgba(0,170,255,0.4)';">
                    <span style="font-size:24px;">🌊</span><span style="font-weight:bold; margin-top:5px; color:#005599;">水球礁谷</span>
                </div>
            </div>
            <div class="modal-btns">
                <button class="btn-primary" onclick="window.createPartyRoom()">確定開趴</button>
                <button class="btn-secondary" onclick="document.getElementById('party-select-modal').style.display='none'">取消</button>
            </div>
        </div>

        <div id="party-invite-modal" class="modal" style="z-index: 500;">
            <h3 style="color:var(--mucha-green);">收到派對邀請函！</h3>
            <p><strong id="party-inviter-name" style="color:var(--mucha-gold);"></strong> 吹響喇叭，邀請你參加派對！</p>
            <div class="modal-btns">
                <button class="btn-primary" style="background:#d9534f; border: 2px solid #ffcc00;" onclick="window.replyPartyInvite('yes')">派對!!</button>
                <button class="btn-secondary" onclick="window.replyPartyInvite('no')">我現在沒感覺</button>
            </div>
        </div>

        <div id="party-minimized-list" style="display:none; position:fixed; right:10px; top:160px; z-index:150; flex-direction:column; align-items:flex-end;">
            <button class="btn-primary" style="border-radius:20px; padding:8px 15px; font-weight:bold; box-shadow:0 4px 8px rgba(0,0,0,0.5); animation: shake-gold 2s infinite;" onclick="let el = document.getElementById('party-active-rooms'); el.style.display = el.style.display === 'none' ? 'block' : 'none';">🎉 派對招募中</button>
            <div id="party-active-rooms" style="display:none; background:rgba(0,0,0,0.8); border:2px solid #ffcc00; border-radius:8px; padding:10px; margin-top:5px; max-height:200px; overflow-y:auto; min-width:180px;"></div>
        </div>

        <div id="party-waiting-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0, 15, 45, 0.9); z-index:260; flex-direction:column; align-items:center; overflow-y:auto; overflow-x:hidden;">
            <h1 style="color:#ffcc00; text-shadow:0 0 10px #ff0000; margin:20px 0;">🎉 派對準備中</h1>
            <p style="color:#ccc; margin-bottom:10px;">請在框格內隨意走動等待，準備好就按下按鈕！</p>
            <div id="party-wait-grid" class="party-grid"></div>
            <div style="display:flex; gap:20px; margin: 20px 0;">
                <button id="party-ready-btn" class="btn-primary" style="font-size:24px; padding:10px 40px; border-radius:25px;" onclick="window.togglePartyReady()">準備好了</button>
                <button id="party-start-btn" class="btn-primary" style="display:none; background:#8a2be2; font-size:24px; padding:10px 40px; border-radius:25px;" onclick="window.startPartyGame()">開始派對</button>
                <button class="btn-secondary" style="font-size:18px; padding:10px 30px; border-radius:25px;" onclick="window.leavePartyroom()">我先出去</button>
            </div>
        </div>

        <div id="party-result-modal" class="modal" style="z-index: 500; width: 90%; max-width: 500px;">
            <h2 style="color:#ffcc00; border-bottom:2px solid #ffcc00; padding-bottom:10px; margin-top:0;">🏆 派對結算</h2>
            <div id="party-result-list" style="max-height: 40vh; overflow-y: auto; text-align: left; background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px;"></div>
            <button class="btn-primary" style="width:100%; margin-top:15px; font-size:18px; padding:10px;" onclick="window.leavePartyroom()">離開派對房間</button>
        </div>
        <div id="party-red-flash"></div>

        <div id="game-layout-container"><div id="phaser-app"></div><div id="chat-section"><button id="chat-toggle-btn">收起對話 ▲</button><div id="chat-content"><div id="chat-box"></div><div id="chat-input-area"><input type="text" id="chat-input" placeholder="說點什麼..."><button id="send-btn">發送</button></div></div></div></div>
        
        <div id="magic-modal" class="modal" style="z-index: 260; width: 85%; max-width: 340px; max-height:82vh; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; touch-action:pan-y; position:relative;">
            <div class="water-drop" style="left: 15%; animation-duration: 2s; animation-delay: 0.1s;"></div>
            <div class="water-drop" style="left: 45%; animation-duration: 2.5s; animation-delay: 1s;"></div>
            <div class="water-drop" style="left: 75%; animation-duration: 1.8s; animation-delay: 0.5s;"></div>
            <div class="water-drop" style="left: 90%; animation-duration: 2.2s; animation-delay: 1.2s;"></div>

            <h3 style="color: #fff; margin-top: 0; border-bottom: 2px solid #00aaff; padding-bottom: 10px; position:relative; z-index:1; text-shadow: 0 0 5px #00aaff;">✨ 法寶庫存</h3>
            <div class="magic-grid" id="magic-grid-container" style="position:relative; z-index:1;"></div>
            <div id="magic-desc" style="position:relative; z-index:1; margin-top: 15px; font-size: 13px; color: #fff; text-align: left; min-height: 60px; max-height: 170px; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; touch-action:pan-y; background: rgba(0, 31, 63, 0.85); padding: 10px; border-radius: 6px; border: 1px solid #00aaff; box-shadow: 0 0 10px rgba(0,170,255,0.3); line-height: 1.45;">點擊法寶查看說明...</div>
            <button class="close-modal-btn btn-secondary" style="position:relative; z-index:1; margin-top: 15px; width: 100%;" onclick="document.getElementById('magic-modal').style.display='none'">關上法寶庫</button>
        </div>
        <div id="magic-menu-blocker" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index: 290; pointer-events: auto; touch-action: none;" onpointerdown="event.stopPropagation(); event.preventDefault(); window.closeQuickMenu();" ontouchstart="event.stopPropagation(); event.preventDefault(); window.closeQuickMenu();"></div>
        <div id="quick-select-menu" onpointerdown="event.stopPropagation()" ontouchmove="event.stopPropagation()" onwheel="event.stopPropagation()">
            <div style="font-weight: bold; color: #87ceeb; margin-bottom: 0px; font-size: 13px; text-shadow: 0 0 3px #000, 0 0 5px #000; letter-spacing: 1px;">左右滑動或點擊法寶選定</div>
            <div id="quick-items-container"></div>
        </div>
        <div id="prince-cat-menu" onpointerdown="event.stopPropagation()" ontouchmove="event.stopPropagation()" onwheel="event.stopPropagation()" style="display:none; position:absolute; bottom:145px; left:50%; transform:translateX(-50%); z-index:305; pointer-events:auto; align-items:center; justify-content:center;">
            <div onclick="window.selectPrinceCatInteraction && window.selectPrinceCatInteraction('pet')" style="width:82px; height:82px; border-radius:50%; background:rgba(255,240,245,0.96); border:3px solid #ff80ab; box-shadow:0 0 18px rgba(255,128,171,0.9); color:#ad1457; font-weight:bold; display:flex; align-items:center; justify-content:center; cursor:pointer; user-select:none;">
                摸摸
            </div>
        </div>

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
                    <div class="catalog-item" onclick="window.openPurchaseModal('派對喇叭', 150)"><img src="tools-onion-party-trumpet.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;"><span style="margin-top:5px;">派對喇叭</span><span style="color:#d4af37; font-size:12px; font-weight:bold;">150 馬德幣</span></div>
                    <div class="catalog-item" onclick="window.openPurchaseModal('喵罐頭', 5000)">
                  <img src="shop-pet-cat-can.png" style="width:50px; height:50px; object-fit:contain; margin-bottom:5px;">
                <span style="margin-top:5px;">喵罐頭</span>
                <span style="color:#d4af37; font-size:12px; font-weight:bold;">5000 馬德幣</span>
            </div>
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
                        #rps-choices { top: 52% !important; bottom: auto !important; left: 50% !important; transform: translateX(-50%) !important; gap: 15px !important; z-index: 50 !important; }
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
        document.querySelectorAll('.modal, .action-menu, #chat-section, #spam-ui, #quick-select-menu, #prince-cat-menu').forEach(el => { ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'mousedown', 'mouseup', 'click'].forEach(evt => { el.addEventListener(evt, (e) => e.stopPropagation(), { passive: false }); }); }); 
        
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
window.syncLoginRoomSelect(window.getRememberedServerRoom());

document.body.classList.add('login-bg-active');

window.getPrinceLocalDateKey = function() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

window.getPrinceBondDesc = function(bond) {
    const val = Number(bond || 0);
    if (val >= 150) return "王子麵覺得你很好笑";
    if (val >= 100) return "王子麵承認你是可疑洋蔥";
    if (val >= 60) return "王子麵開始記得你的毛味";
    if (val >= 30) return "王子麵偶爾聞到你的臭味";
    return "王子麵把你當空氣";
};

window.getPrinceBondEffect = function(bond) {
    const val = Number(bond || 0);
    if (val >= 150) return "效果：掃洋蔥皮時，10% 機率獲得王子麵叼來的 10 馬德幣";
    if (val >= 100) return "效果：掃洋蔥皮時，8% 機率獲得王子麵叼來的 10 馬德幣";
    if (val >= 60) return "效果：掃洋蔥皮時，4% 機率獲得王子麵叼來的 10 馬德幣";
    if (val >= 30) return "效果：掃洋蔥皮時，1% 機率獲得王子麵叼來的 10 馬德幣";
    return "效果：無";
};

window.getPrinceSweepBonusRate = function(bond) {
    const val = Number(bond || 0);
    if (val >= 150) return 0.10;
    if (val >= 100) return 0.08;
    if (val >= 60) return 0.04;
    if (val >= 30) return 0.01;
    return 0;
};

window.getPrinceBondStageIndex = function(bond) {
    const val = Number(bond || 0);
    if (val >= 150) return 4;
    if (val >= 100) return 3;
    if (val >= 60) return 2;
    if (val >= 30) return 1;
    return 0;
};

window.normalizePrinceCatProfileFields = function() {
    const p = window.GameLogic.myProfile || {};
    const today = window.getPrinceLocalDateKey();

    p.princeBond = Number(p.princeBond || 0);
    p.princeRewardsClaimed = p.princeRewardsClaimed || {};

    if (p.princeLastPetDate !== today) {
        p.princePetCountToday = 0;
        p.princeLastPetDate = today;
    } else {
        p.princePetCountToday = Number(p.princePetCountToday || 0);
    }

    if (p.princeLastFeedDate !== today) {
        p.princeFeedCountToday = 0;
        p.princeLastFeedDate = today;
    } else {
        p.princeFeedCountToday = Number(p.princeFeedCountToday || 0);
    }

    window.GameLogic.myProfile = p;
    return p;
};

window.getPrinceCatRewardList = function() {
    const bond = Number(
        window.GameLogic.myProfile && window.GameLogic.myProfile.princeBond
            ? window.GameLogic.myProfile.princeBond
            : 0
    );

    return [
        {
            id: 'firstPet',
            target: 0,
            achieved: bond > 0,
            name: '我愛上了王子麵',
            medal: 'ranking-medal-cat-wzm-no0.png',
            lockedText: '尚未與王子麵建立第一次互動',
            recordText: '第一次成功摸摸王子麵'
        },
        {
            id: 'bond30',
            target: 30,
            achieved: bond >= 30,
            name: '王子麵喜歡我的香味！',
            medal: 'ranking-medal-cat-wzm-no1.png',
            recordText: '王子麵羈絆達 30'
        },
        {
            id: 'bond60',
            target: 60,
            achieved: bond >= 60,
            name: '王子麵迷上我的毛！',
            medal: 'ranking-medal-cat-wzm-no2.png',
            recordText: '王子麵羈絆達 60'
        },
        {
            id: 'bond100',
            target: 100,
            achieved: bond >= 100,
            name: '王子麵喜歡洋蔥！',
            medal: 'ranking-medal-cat-wzm-no3.png',
            recordText: '王子麵羈絆達 100'
        },
        {
            id: 'bond150',
            target: 150,
            achieved: bond >= 150,
            name: '王子麵總是看著我！',
            medal: 'ranking-medal-cat-wzm-no4.png',
            recordText: '王子麵羈絆達 150'
        }
    ];
};

window.openPrinceCatRewardDetail = function() {
    document.getElementById('reward-detail-modal').style.display = 'block';

    const title = document.querySelector('#reward-detail-modal h3');
    if (title) title.innerText = "王子麵與你";

    const ruleBox = document.querySelector('#reward-detail-modal h3 + div');
    if (ruleBox) {
        ruleBox.innerHTML = `<strong>【派獎規則】</strong><br>與王子麵互動並提升羈絆，可依階段領取專屬勳章。<br>每項獎勵每位玩家只能領取一次，沒有領取期限。`;
    }

    const rankEl = document.getElementById('reward-my-rank');
    if (rankEl) {
        const bond = Number(
            window.GameLogic.myProfile && window.GameLogic.myProfile.princeBond
                ? window.GameLogic.myProfile.princeBond
                : 0
        );
        rankEl.innerText = `目前王子麵羈絆：${bond.toFixed(1)}`;
    }

    window.renderPrinceCatRewardDetail();
};

window.renderPrinceCatRewardDetail = function() {
    const grid = document.getElementById('reward-items-grid');
    if (!grid) return;

    const p = window.GameLogic.myProfile || {};
    const bond = Number(p.princeBond || 0);
    const claimed = p.princeRewardsClaimed || {};
    const rewards = window.getPrinceCatRewardList();

    let html = '';

    rewards.forEach(r => {
        const isClaimed = !!claimed[r.id];
        const canClaim = r.achieved && !isClaimed;
        const itemClass = isClaimed ? 'claimed' : '';

        let statusHtml = '';
        if (isClaimed) {
            statusHtml = `<div class="reward-claimed-text">已領取</div>`;
        } else if (canClaim) {
            statusHtml = `<button class="btn-primary reward-neon-btn" style="padding:6px 12px; font-size:14px;" onclick="window.claimPrinceCatReward('${r.id}')">可領取</button>`;
        } else {
            const lockText = r.target > 0
                ? `尚未達成：王子麵羈絆 ${bond.toFixed(1)} / ${r.target}`
                : r.lockedText;
            statusHtml = `<div style="color:#777; font-size:12px; font-weight:bold; text-align:right;">${lockText}</div>`;
        }

        html += `
            <div class="reward-item ${itemClass}" id="rew-item-prince-${r.id}">
                <div style="display:flex; align-items:center;">
                    <img src="${r.medal}" style="width:40px; height:40px; margin-right:5px; object-fit:contain;">
                </div>
                <div style="flex:1; margin-left:10px; color:#333; font-weight:bold; font-size:13px; text-align:left;">${r.name} 勳章</div>
                ${statusHtml}
            </div>
        `;
    });

    grid.innerHTML = html;
};

window.claimPrinceCatReward = async function(rewardId) {
    if (!window.GameLogic.currentUser) return;

    const uid = window.GameLogic.currentUser.uid;
    const p = window.GameLogic.myProfile || {};
    p.princeRewardsClaimed = p.princeRewardsClaimed || {};

    const reward = window.getPrinceCatRewardList().find(r => r.id === rewardId);
    if (!reward) return;

    if (!reward.achieved) {
        alert("尚未達成此王子麵獎勵。");
        return;
    }

    if (p.princeRewardsClaimed[rewardId]) return;

    p.princeRewardsClaimed[rewardId] = true;

    const medals = Array.isArray(p.medals) ? p.medals : [];
    medals.push({
        id: `prince_cat_${rewardId}_${Date.now()}`,
        date: new Date().toLocaleDateString('zh-TW'),
        eventName: '王子麵與你',
        name: reward.name,
        icon: reward.medal,
        recordText: reward.recordText
    });

    p.medals = medals;
    window.GameLogic.myProfile = p;

    const updates = {};
    updates[`users/${uid}/princeRewardsClaimed/${rewardId}`] = true;
    updates[`users/${uid}/medals`] = medals;

    await update(ref(window.GameLogic.db), updates);

    const item = document.getElementById(`rew-item-prince-${rewardId}`);
    if (item) item.classList.add('claimed');

    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
        const ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) window.playSFX(ms, 'reward-get-sounds');
    }

    const overlay = document.getElementById('reward-congrats-overlay');
    if (overlay) {
        document.getElementById('congrats-text').innerText = `恭喜獲得 ${reward.name}！`;
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.display = 'none'; }, 2000);
    }

    window.renderPrinceCatRewardDetail();
};

// 向下相容第一版舊按鈕名稱
window.claimPrinceCatFirstReward = function() {
    window.claimPrinceCatReward('firstPet');
};

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
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins, energyBank: 0 }).catch(err => console.warn('Firebase 領取蔥電飽存款失敗:', err));
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
    get(ref(window.GameLogic.db, window.getServerRoomPath(`weeklySweeps/${weekId}`))).then(snap => {
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
};
// ===================================

window.manualPages = []; window.currentManualIndex = 0;
window.openManualModal = function() { document.getElementById('manual-modal').style.display = 'block'; window.currentManualIndex = 0; if (window.GameLogic.currentUser && (window.GameLogic.currentUser.email === 'kerojjj777@gmail.com' || window.GameLogic.currentUser.email === 'kerojjj777@hotmail.com' || window.GameLogic.currentUser.email === 'onion@gmail.com')) { document.getElementById('manual-admin-area').style.display = 'block'; } else { document.getElementById('manual-admin-area').style.display = 'none'; } window.renderManualPage(); };
window.renderManualPage = function() { const imgEl = document.getElementById('manual-img-display'); const indEl = document.getElementById('manual-page-indicator'); if (window.manualPages.length === 0) { imgEl.src = ''; imgEl.alt = '目前尚無說明書內容'; indEl.innerText = '0 / 0'; return; } if (window.currentManualIndex < 0) window.currentManualIndex = 0; if (window.currentManualIndex >= window.manualPages.length) window.currentManualIndex = window.manualPages.length - 1; let page = window.manualPages[window.currentManualIndex]; imgEl.src = page.imgBase64; indEl.innerText = `${window.currentManualIndex + 1} / ${window.manualPages.length}`; };
document.getElementById('manual-prev-btn').addEventListener('click', () => { if (window.currentManualIndex > 0) { window.currentManualIndex--; window.renderManualPage(); } });
document.getElementById('manual-next-btn').addEventListener('click', () => { if (window.currentManualIndex < window.manualPages.length - 1) { window.currentManualIndex++; window.renderManualPage(); } });

window.uploadManualPage = function() { const fileInput = document.getElementById("manual-file"); const file = fileInput.files[0]; if (!file) return alert("請選擇圖片檔案！"); const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const cvs = document.createElement('canvas'); let w = img.width, h = img.height; if (w > 1200) { h *= 1200 / w; w = 1200; } cvs.width = w; cvs.height = h; cvs.getContext('2d').drawImage(img, 0, 0, w, h); push(ref(window.GameLogic.db, 'manuals'), { imgBase64: cvs.toDataURL('image/jpeg', 0.8), timestamp: Date.now() }).then(() => { alert('上傳成功！'); fileInput.value = ""; }); }; img.src = e.target.result; }; reader.readAsDataURL(file); };
window.deleteManualPage = function() { if (window.manualPages.length === 0) return; if (confirm("確定要刪除當前顯示的說明書頁面嗎？")) { let pageKey = window.manualPages[window.currentManualIndex].key; remove(ref(window.GameLogic.db, `manuals/${pageKey}`)).then(() => { alert('已刪除！'); window.currentManualIndex = 0; }); } };
window.moveManualPage = function(dir) { if (window.manualPages.length < 2) return; let idx1 = window.currentManualIndex; let idx2 = idx1 + dir; if (idx2 < 0 || idx2 >= window.manualPages.length) return; let p1 = window.manualPages[idx1]; let p2 = window.manualPages[idx2]; let tempTime = p1.timestamp; p1.timestamp = p2.timestamp; p2.timestamp = tempTime; let updates = {}; updates[`manuals/${p1.key}/timestamp`] = p1.timestamp; updates[`manuals/${p2.key}/timestamp`] = p2.timestamp; update(ref(window.GameLogic.db), updates).then(() => { window.currentManualIndex = idx2; }); };

window.updateUnreadGlow = function() { if (!window.GameLogic.phaserGame) return; const uiScene = window.GameLogic.phaserGame.scene.getScene('UIScene'); if (!uiScene || !uiScene.itemBtn) return; const hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0; if (hasUnread) { if (!uiScene.itemGlowTween) { uiScene.itemGlowTween = uiScene.tweens.add({ targets: uiScene.itemBtn, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 600 }); } uiScene.itemBtn.setStrokeStyle(4, 0xff0000); } else { if (uiScene.itemGlowTween) { uiScene.itemGlowTween.stop(); uiScene.itemGlowTween = null; uiScene.itemBtn.setScale(1); } uiScene.itemBtn.setStrokeStyle(3, 0xc5a059); } };
window.updateOnlinePlayersUI = function() {
    const listEl = document.getElementById('online-players-list');
    const containerEl = document.getElementById('online-players-container');
    if (!listEl || !containerEl) return;
    containerEl.style.display = 'flex';
    
    let html = '';
    if (window.GameLogic.globalSummonCountdown > 0) {
        html += `<div style="background: rgba(217, 83, 79, 0.9); color: white; font-weight: bold; padding: 6px; border-radius: 4px; margin-bottom: 8px; text-align: center; font-size: 12px; animation: purpleFire 1s infinite alternate;">🚨 儀式即將開始: ${window.GameLogic.globalSummonCountdown}秒</div>`;
    }
    
    html += `<div style="color:var(--mucha-gold); font-weight:bold; margin-bottom:5px; text-align:center; border-bottom: 1px solid var(--mucha-gold); padding-bottom: 3px;">誰在線上<br><span style="font-size:11px; color:#fff;">目前房間：${window.getCurrentServerRoomName()}</span></div>`;

    let now = Date.now();
    let players = Object.assign({}, window.GameLogic.onlinePlayers || {});
    const currentUid = window.GameLogic.currentUser && window.GameLogic.currentUser.uid
        ? window.GameLogic.currentUser.uid
        : null;

    let roomPlayers = {};
    if (window.GameLogic.currentScene === 'cafe') roomPlayers = window.GameLogic.cafePlayers || {};
    else if (window.GameLogic.currentScene === 'shrine') roomPlayers = window.GameLogic.shrinePlayers || {};
    else if (window.GameLogic.currentScene === 'playroom') roomPlayers = window.GameLogic.playroomPlayers || {};
    else if (window.GameLogic.currentScene === 'partyroom' && window.PartyLogic) roomPlayers = window.PartyLogic.players || {};

    for (let uid in roomPlayers) {
        let rp = roomPlayers[uid];
        if (!players[uid]) {
            players[uid] = {
                name: rp.name || '匿名',
                color: rp.color || '#fff',
                lastActive: now,
                roomFallback: true
            };
        } else {
            players[uid].name = players[uid].name || rp.name || '匿名';
            players[uid].color = players[uid].color || rp.color || '#fff';
        }
    }

    for (let uid in players) {
        let p = players[uid];
        if (!p.roomFallback && p.lastActive && (now - p.lastActive > 30000)) continue;
        if (!p.lastActive && uid !== currentUid && !roomPlayers[uid]) continue;
        html += `<div style="margin-top:5px; display:flex; align-items:center;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${p.color || '#fff'}; margin-right:8px; border:1px solid #000;"></span>${p.name || '匿名'}</div>`;
    }

    listEl.innerHTML = html;
};

// 新增：啟動神龕儀式的共用函式，停止背景音樂並開始詭異音效
window.startShrineRitual = function() {
    window.forceAudioNormal();
    if (window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) {
            ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'].forEach(k => ms.sound.stopByKey(k));
            const shrineSound = ms.sound.get('shrine-wierd-people-sound');
            if (!shrineSound || !shrineSound.isPlaying) {
                ms.sound.play('shrine-wierd-people-sound', { loop: true });
            }
        }
    }
};

window.confirmSummon = function(isYes) {
    document.getElementById('summon-confirm-modal').style.display = 'none';
    if (!isYes) return;
    if ((window.GameLogic.myProfile.coins || 0) < 500) return alert("馬德幣不足！無法召喚。");
    window.GameLogic.myProfile.coins -= 500;
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins }).catch(err => console.warn('Firebase 扣除召喚費失敗:', err));
    let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
    
    update(ref(db, window.getServerRoomPath('serverEvents/summonShrine')), { time: Date.now(), callerUid: window.GameLogic.currentUser.uid, callerName: window.GameLogic.myProfile.name });
    // 修正2：只有付費後，資料庫才會刻上 'summoned' 狀態，並以此作為入座後開啟票選的唯一觸發鑰匙
    set(ref(db, window.getServerRoomPath('shrineEvents/current')), { state: 'summoned', startTime: Date.now() });
    sendBubble("已發出神聖的召喚...");
    window.startShrineRitual();
};
window.attemptJoinShrine = function() {
    get(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current'))).then(snap => {
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
};

window.acceptSummon = function() {
    document.getElementById('forced-summon-modal').style.display = 'none';
    // 修正死碼：變數參照錯誤，原本的全域計時器為 globalSummonInterval
    if (window.globalSummonInterval) { clearInterval(window.globalSummonInterval); window.globalSummonInterval = null; }
    
    get(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current'))).then(snap => {
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
};

let voteTarget = null; let voteTalisman = null;
window.selectVoteTarget = function(uid) { 
    if (voteTarget === uid) {
        voteTarget = null;
        const targetEl = document.getElementById('vote-tgt-' + uid);
        if (targetEl) targetEl.classList.remove('selected');
    } else {
        voteTarget = uid;
        document.querySelectorAll('[id^="vote-tgt-"]').forEach(b => b.classList.remove('selected'));
        const targetEl = document.getElementById('vote-tgt-' + uid);
        if (targetEl) targetEl.classList.add('selected');
    }

    // 修正4：即時上傳未確認的選擇供他人觀看
    update(ref(window.GameLogic.db, window.getServerRoomPath(`shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`)), {
        target: voteTarget || 'none',
        name: window.GameLogic.myProfile.name,
        confirmed: false
    });
};

window.selectVoteTalisman = function(tId) { 
    if (voteTalisman === tId) {
        voteTalisman = null;
        const taliEl = document.getElementById('vote-tali-' + tId);
        if (taliEl) taliEl.classList.remove('selected');
    } else {
        voteTalisman = tId;
        document.querySelectorAll('[id^="vote-tali-"]').forEach(b => b.classList.remove('selected'));
        const taliEl = document.getElementById('vote-tali-' + tId);
        if (taliEl) taliEl.classList.add('selected');
    }

    update(ref(window.GameLogic.db, window.getServerRoomPath(`shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`)), {
        talisman: voteTalisman || 'none',
        name: window.GameLogic.myProfile.name,
        confirmed: false
    });
};
window.submitVote = function() {
    if (!voteTarget || !voteTalisman) return alert("請選擇一位淨化對象與一款符咒！");
    update(ref(db, window.getServerRoomPath(`shrineEvents/current/votes/${window.GameLogic.currentUser.uid}`)), { target: voteTarget, talisman: voteTalisman, confirmed: true, name: window.GameLogic.myProfile.name });
    document.getElementById('voting-confirm-btn').innerText = "已確認 (等待他人...)"; document.getElementById('voting-confirm-btn').disabled = true;
};
window.clickSpamBtn = function() {
    if (window.GameLogic.shrineEventData && window.GameLogic.shrineEventData.state === 'purifying') {
        let currentClicks = window.GameLogic.myPurifyClicks || 0;
        currentClicks++; window.GameLogic.myPurifyClicks = currentClicks;
        set(ref(db, window.getServerRoomPath(`shrineEvents/current/clicks/${window.GameLogic.currentUser.uid}`)), currentClicks);
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

// 補丁 6-2：月球商品共用工具與使用入口
window.isMoonBunBuffActive = function() {
    return Date.now() < Number(window.GameLogic.moonBunBuffUntil || 0);
};

window.formatMoonBunBuffTime = function(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

window.getMainSceneSafe = function() {
    if (!window.GameLogic.phaserGame) return null;
    try {
        return window.GameLogic.phaserGame.scene.getScene('MainScene');
    } catch (err) {
        return null;
    }
};

window.playOptionalSFX = function(key) {
    const ms = window.getMainSceneSafe();
    if (!ms || window.GameLogic.muteSFX) return;
    if (!ms.cache || !ms.cache.audio || !ms.cache.audio.exists(key)) return;
    window.playSFX(ms, key);
};

window.consumeMoonInventoryItem = function(itemName) {
    if (!window.GameLogic.currentUser) return false;
    const p = window.GameLogic.myProfile || {};
    const inv = p.inventory || {};
    if (!inv[itemName] || inv[itemName] <= 0) {
        sendBubble(`${itemName}庫存不足！`);
        return false;
    }

    inv[itemName] = Math.max(0, Number(inv[itemName] || 0) - 1);
    p.inventory = inv;
    window.GameLogic.myProfile = p;

    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv })
        .catch(err => console.warn(`[月球商品] 扣除 ${itemName} 庫存失敗：`, err));

    return true;
};

window.useMoonShard = function() {
    sendBubble("月光碎片是玉兔兌換用的代幣，現在還不能使用。");
};

window.useMoonBun = function() {
    if (window.GameLogic.currentScene !== 'cafe') {
        sendBubble("月光饅頭要在洋蔥大廳吃才有感覺。");
        return;
    }

    if (window.isMoonBunBuffActive()) {
        sendBubble("月光饅頭的效果還在喔，不要貪吃。");
        return;
    }

    if (!window.consumeMoonInventoryItem('月光饅頭')) return;

    window.GameLogic.moonBunBuffUntil = Date.now() + 4 * 60 * 1000;
    window.GameLogic.moonBunSweepPressCount = 0;
    window.GameLogic.moonBunBuffEndNotified = false;

    window.playOptionalSFX('moon-bun-use');

    const ms = window.getMainSceneSafe();
    if (ms) {
        if (ms.showMoonBunUseFx) ms.showMoonBunUseFx();
        if (ms.createOrUpdateMoonBunBuffUi) ms.createOrUpdateMoonBunBuffUi();
    }

    const magicModal = document.getElementById('magic-modal');
    if (magicModal) magicModal.style.display = 'none';

    sendBubble("月光饅頭生效！接下來 4 分鐘，掃洋蔥皮只要按兩下 A。");
};

window.useMoonStaff = function() {
    if (!window.consumeMoonInventoryItem('月光法杖')) return false;

    const ms = window.getMainSceneSafe();
    const actionTime = Date.now();
    let fxX = null;
    let fxY = null;
    if (ms && ms.localPlayer && ms.localPlayer.sprite) {
        fxX = ms.localPlayer.sprite.x;
        fxY = ms.localPlayer.sprite.y;
    }

    if (ms && ms.playMoonStaffBlessing) {
        ms.lastMoonStaffBlessingTime = actionTime;
        ms.playMoonStaffBlessing({
            casterUid: window.GameLogic.currentUser ? window.GameLogic.currentUser.uid : 'local',
            eventTime: actionTime,
            x: fxX,
            y: fxY,
            isLocal: true
        });
    }

    // 沿用既有 serverEvents 架構：同一張地圖中的玩家都會收到並播放，不新增複雜同步資料格式。
    if (window.GameLogic.currentUser) {
        update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/moonStaffBlessings/${window.GameLogic.currentUser.uid}`)), {
            time: actionTime,
            scene: window.GameLogic.currentScene || 'cafe',
            casterName: window.GameLogic.myProfile ? (window.GameLogic.myProfile.name || '匿名') : '匿名',
            x: fxX,
            y: fxY
        }).catch(err => console.warn('[月光法杖] 全域祝福事件寫入失敗：', err));
    }

    const magicModal = document.getElementById('magic-modal');
    if (magicModal) magicModal.style.display = 'none';

    sendBubble("月月有福，月來月美！");
    return true;
};

window.useMoonItem = function(itemName) {
    if (itemName === '月光饅頭') return window.useMoonBun();
    if (itemName === '月光法杖') return window.useMoonStaff();
    if (itemName === '月光碎片') return window.useMoonShard();
};

// 修正死碼與邏輯漏洞：將「蔥友機」加入裝備判斷，避免被當成普通消耗品吃掉。同步移除耗能的動態 import。
window.useItem = function(itemName) {
    let inv = window.GameLogic.myProfile.inventory || {};

    if (itemName === '月光碎片') {
        window.useMoonShard();
        return;
    }

    if (itemName === '月光法杖' || itemName === '月光饅頭') {
        if (inv[itemName] && inv[itemName] > 0) {
            window.GameLogic.armedItemState = 'ready';
            window.GameLogic.armedItemName = itemName;
            const inventoryModal = document.getElementById('inventory-modal');
            const magicModal = document.getElementById('magic-modal');
            if (inventoryModal) inventoryModal.style.display = 'none';
            if (magicModal) magicModal.style.display = 'none';
            sendBubble(itemName === '月光法杖' ? '已裝填月光法杖，按A施放月光祝福。' : '已裝填月光饅頭，按A吃下。');
        } else {
            sendBubble(`${itemName}庫存不足！`);
            window.GameLogic.armedItemState = null;
            window.GameLogic.armedItemName = null;
        }
        return;
    }

    if (inv[itemName] && inv[itemName] > 0) {
        if (itemName === '水球' || itemName === '煙火' || itemName === '蔥友機' || itemName === '喵罐頭') {
            window.GameLogic.armedItemState = 'ready';
            window.GameLogic.armedItemName = itemName;
            document.getElementById('inventory-modal').style.display = 'none';

            if (itemName === '喵罐頭') {
                sendBubble("已拿出喵罐頭，靠近王子麵按A餵食。");
            }

            return;
        }

        inv[itemName] -= 1;
        update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv })
            .catch(err => console.warn('Firebase 扣除法寶庫存失敗:', err));

        alert(`你成功使用了 ${itemName}！`);
        window.openInventoryModal();
    }
};
// 修正死碼邏輯：改為泛用解除機制，確保後續新增的法寶(如蔥友機)也能被正常點擊卸下
window.stopUsingItem = function(itemName) { 
    window.GameLogic.armedItemState = null; 
    window.GameLogic.armedItemName = null; 
};
window.toggleInventoryEdit = function() { window.GameLogic.inventoryEditMode = !window.GameLogic.inventoryEditMode; let btn = document.getElementById('inventory-edit-btn'); if (btn) { btn.innerText = window.GameLogic.inventoryEditMode ? '完成' : '編輯排序'; btn.className = window.GameLogic.inventoryEditMode ? 'btn-primary' : 'btn-edit'; } window.openInventoryModal(); };
window.moveInvItem = function(index, dir) { let order = window.GameLogic.myProfile.inventoryOrder || []; if (index + dir >= 0 && index + dir < order.length) { let temp = order[index]; order[index] = order[index + dir]; order[index + dir] = temp; window.GameLogic.myProfile.inventoryOrder = order; update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventoryOrder: order }); window.openInventoryModal(); } };

window.clickSysItem = function(key) { document.getElementById('inventory-modal').style.display = 'none'; if (key === 'magic_items') { window.openMagicModal(); } else if (key === 'phone') { window.openPhoneModal(); } else if (key === 'portal') { window.openPortalModal(); } else if (key === 'energy') { window.openEnergyModal(); } else if (key === 'profile') { window.showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); } else if (key === 'music') { document.getElementById('settings-modal').style.display = 'block'; } else if (key === 'manual') { window.openManualModal(); } else if (key === 'dev') { document.getElementById('dev-modal').style.display = 'block'; } else if (key === 'logout') { window.leaveCafe(); if (window.GameLogic.currentUser) { window.cleanupCurrentServerPresence(window.GameLogic.currentUser.uid); } window.signOut(window.auth); } };

window.openMagicModal = function() {
    let inv = window.GameLogic.myProfile.inventory || {};
    let container = document.getElementById('magic-grid-container');
    let html = '';
    let magics = [
        { name: '水球', icon: '<div class="sprite-waterball" style="transform: scale(0.8); transform-origin: center;"></div>', desc: '聞說水是生命的起源，洋蔥喜歡感受生命，使勁地丟吧！\n按B填充後按A擲出' },
        { name: '煙火', icon: '<img src="shop-fireworks.png" style="width:40px; height:40px; object-fit:contain;">', desc: '喜歡煙火咻蹦的美麗光彩，但也喜歡拿來朝著其他洋蔥丟～\n按B填充後按A擲出，鎖定目標與不鎖定目標會有不同的效果。' },
        { name: '蔥友機', icon: '<img src="playroom-onion-friend-plane.png" style="width:40px; height:40px; object-fit:contain;">', desc: '隨時發動好(ㄓㄢˋ)友(ㄉㄡˋ)邀請，按B捏緊再按A投射，被射中的好友會收到你的訊息。' },
        { name: '派對喇叭', icon: '<img src="tools-onion-party-trumpet.png" style="width:40px; height:40px; object-fit:contain;">', desc: '據說是埋在深山裡的洋蔥蔘淬煉製成的器具，吹奏他會自動調頻與洋蔥人們的腦波連結，「是時候開戰了」。按B緊握按A向全宇宙的洋蔥人發起械鬥號召。' },
        { name: '喵罐頭', icon: '<img src="shop-pet-cat-can.png" style="width:40px; height:40px; object-fit:contain;">', desc: '這世界上只有喵星人能撫慰洋蔥人的心。按B打開罐罐，靠近王子麵後按A餵食。每日前三次餵食可提升王子麵羈絆，之後王子麵會表示：夠了。' },
        { name: '月光碎片', icon: '<img src="solo-rocket-item-moon-shard.png" style="width:40px; height:40px; object-fit:contain;">', desc: '月亮掉下來的一小角。這是之後兌換物品用的代幣，目前只能收藏與累積。\n不會出現在長按B法寶選單，也不能在場景中使用。', action: 'token' },
        { name: '月光法杖', icon: '<img src="solo-rocket-item-moon-staff.png" style="width:40px; height:40px; object-fit:contain;">', desc: '月球限定的小魔杖。選定後等同按B裝填，接著按A施放。可在目前所在地圖全域播放月光祝福動畫。', action: 'use' },
        { name: '月光饅頭', icon: '<img src="solo-rocket-item-moon-bun.png" style="width:40px; height:40px; object-fit:contain;">', desc: '玉兔手作的月球饅頭。選定後等同按B裝填，接著按A吃下。只能在洋蔥大廳生效，4 分鐘內掃洋蔥皮只需按兩下 A，效果期間不可疊加。', action: 'use' }
    ];

    const showMagicDesc = (m) => {
        let descSafe = m.desc.replace(/\n/g, '<br>');
        let qty = inv[m.name] || 0;
        let btnHtml = '';

        if (m.action === 'use') {
            const disabled = qty <= 0 ? 'disabled' : '';
            const opacity = qty <= 0 ? 'opacity:0.45;' : '';
            btnHtml = `<br><br><button class="btn-primary" ${disabled} style="padding:8px 14px; border-radius:8px; font-weight:bold; ${opacity}" onclick="event.stopPropagation(); window.useItem('${m.name}')">裝填 ${m.name}</button>`;
        } else if (m.action === 'token') {
            btnHtml = `<br><br><button class="btn-secondary" style="padding:8px 14px; border-radius:8px; font-weight:bold;" onclick="event.stopPropagation(); window.useMoonItem('${m.name}')">查看用途</button>`;
        }

        const descEl = document.getElementById('magic-desc');
        if (descEl) {
            descEl.innerHTML = `<strong style="color:#ffcc00; font-size:16px;">${m.name}</strong><br><span style="color:#b3e5ff;">持有：x${qty}</span><br><br>${descSafe}${btnHtml}`;
        }
    };

    window.showMagicItemDesc = (idx) => {
        const m = magics[idx];
        if (m) showMagicDesc(m);
    };

    for(let i = 0; i < 16; i++) {
        if (i < magics.length) {
            let m = magics[i];
            let qty = inv[m.name] || 0;
            html += `<div class="magic-slot" onclick="window.showMagicItemDesc(${i})">
                        ${m.icon}<div class="magic-qty">x${qty}</div>
                     </div>`;
        } else {
            html += `<div class="magic-slot"></div>`;
        }
    }

    container.innerHTML = html;
    document.getElementById('magic-desc').innerText = "點擊法寶查看說明...";
    document.getElementById('magic-modal').style.display = 'block';
};
// 【新增】開發者一鍵測試：在交誼廳中央直接生成米米
window.devSummonMimi = function() {
    if (window.GameLogic.currentScene !== 'cafe') {
        sendBubble("請先到洋蔥大廳再召喚米米！");
        document.getElementById('dev-modal').style.display = 'none';
        return;
    }

    let pUids = Object.keys(window.GameLogic.cafePlayers || {}).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid]);
    let requiredHp = Math.min(6, 2 + Math.max(1, pUids.length));

    let scene = window.GameLogic.phaserGame ? window.GameLogic.phaserGame.scene.getScene('MainScene') : null;
    let playerSprite = scene && scene.localPlayer ? scene.localPlayer.sprite : null;
    let spawnX = playerSprite ? Phaser.Math.Clamp(playerSprite.x - 260, 100, 1948) : 1024;
    let spawnY = playerSprite ? Phaser.Math.Clamp(playerSprite.y, 100, 1948) : 1024;
    
    set(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), {
        active: true,
        x: spawnX,
        y: spawnY,
        state: 'walk',
        hp: requiredHp,
        playersInvolved: Math.max(1, pUids.length),
        stolenPool: 0,
        flipX: true,
        stolenUids: null
    }).then(() => {
        document.getElementById('dev-modal').style.display = 'none';
    });
};

window.devFillMagic = function() {
    let inv = window.GameLogic.myProfile.inventory || {};
    inv['水球'] = 100;
    inv['煙火'] = 100;
    inv['蔥友機'] = 100;
    inv['派對喇叭'] = 100;
    
    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv }).then(() => {
        document.getElementById('dev-modal').style.display = 'none';
    });
};

window.devAddCoins = function() {
    let p = window.GameLogic.myProfile;
    p.coins = (p.coins || 0) + 100000;

    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
        coins: p.coins 
    }).then(() => {
        let coinsEl = document.getElementById("vp-coins"); 
        if (coinsEl) coinsEl.innerText = p.coins;

        document.getElementById('dev-modal').style.display = 'none';
        alert("已成功匯入 100,000 馬德幣！");
    });
};

window.openInventoryModal = function() {
    const list = document.getElementById('inventory-list'); let hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0; let dotHtml = hasUnread ? '<div style="position:absolute; top:5px; right:5px; width:12px; height:12px; background:red; border-radius:50%; box-shadow:0 0 5px red; z-index:10;"></div>' : '';
    let rawItems = {}; let isEdit = window.GameLogic.inventoryEditMode; let inv = window.GameLogic.myProfile.inventory || {}; let sysKeys = ['phone', 'portal', 'profile', 'music', 'manual', 'logout', 'dev', 'magic_items']; let magicOnlyKeys = ['水球', '煙火', '蔥友機', '派對喇叭', '喵罐頭', '月光碎片', '月光法杖', '月光饅頭']; let keys = Object.keys(inv).filter(k => inv[k] > 0 && k !== '假人洋蔥' && !sysKeys.includes(k) && !magicOnlyKeys.includes(k));
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

window.viewOtherProfile = function(uid) { get(ref(window.GameLogic.db, `users/${uid}`)).then(snap => { if (snap.exists()) { document.getElementById('phone-modal').style.display = 'none'; showProfileModal(snap.val(), uid); } }); };
window.openPhoneModal = function() { document.getElementById('inventory-modal').style.display = 'none'; document.getElementById('phone-modal').style.display = 'block'; get(ref(window.GameLogic.db, 'users')).then(snap => { let users = snap.val() || {}; let html = ''; for (let uid in users) { if (uid === window.GameLogic.currentUser.uid) continue; let u = users[uid]; let unreadDot = (window.GameLogic.unreadPMs && window.GameLogic.unreadPMs[uid]) ? ' <span style="color:red; font-size:10px;">🔴</span>' : ''; html += `<div class="catalog-item phone-contact" style="flex-direction:row; justify-content:space-between; padding: 10px;"><span style="font-weight:bold; color: ${u.color || '#fff'}; text-shadow: 1px 1px 2px #000;">${u.name || '匿名'} (Lv.${u.level || 1})${unreadDot}</span><div><button class="btn-secondary" style="padding: 4px 12px; font-size:12px; margin-right: 5px; color:#333;" onclick="window.viewOtherProfile('${uid}')">查看</button><button class="btn-primary" style="padding: 4px 12px; font-size:12px;" onclick="window.openPM('${uid}', '${u.name || '匿名'}')">私訊</button></div></div>`; } if (html === '') html = '<div style="text-align:center; color:#fff; text-shadow: 1px 1px 2px #000;">目前沒有其他聯絡人</div>'; document.getElementById('phone-contacts').innerHTML = html; }); };
window.openPM = function(targetUid, targetName) { 
    document.getElementById('phone-modal').style.display = 'none'; 
    document.getElementById('pm-modal').style.display = 'block'; 
    document.getElementById('pm-title').innerText = `💬 與 ${targetName} 密語`; 
    window.currentPMUid = targetUid; 
    let myUid = window.GameLogic.currentUser.uid; 
    let chatId = [myUid, targetUid].sort().join('_'); 
    
    // 系統健康修正：移除雙重動態 import，直接使用頂部已載入的 remove, onValue 與 ref
    remove(ref(window.GameLogic.db, `users/${myUid}/unreadPMs/${targetUid}`)); 
    
    if (window.pmUnsubscribe) window.pmUnsubscribe(); 
    window.pmUnsubscribe = onValue(ref(window.GameLogic.db, `privateChats/${chatId}`), snap => { 
        let msgs = snap.val() || {}; 
        let box = document.getElementById('pm-chat-box'); 
        box.innerHTML = ''; 
        Object.values(msgs).forEach(m => { 
            if (m.uid === myUid) { 
                box.innerHTML += `<div style="text-align:right; margin-bottom: 8px;"><div class="pm-bubble-me">${m.msg}</div></div>`; 
            } else { 
                box.innerHTML += `<div style="text-align:left; margin-bottom: 8px;"><div class="pm-bubble-other"><div style="font-size:11px; color:#558b2f; font-weight:bold; margin-bottom:2px;">${m.name}</div>${m.msg}</div></div>`; 
            } 
        }); 
        box.scrollTop = box.scrollHeight; 
    }); 
};
window.closePM = function() { if (window.pmUnsubscribe) { window.pmUnsubscribe(); window.pmUnsubscribe = null; } document.getElementById('pm-modal').style.display = 'none'; document.getElementById('phone-modal').style.display = 'block'; };
window.sendPM = function() { 
    let input = document.getElementById('pm-input'); let msg = input.value.trim(); if (!msg || !window.currentPMUid) return; 
    let myUid = window.GameLogic.currentUser.uid; let chatId = [myUid, window.currentPMUid].sort().join('_'); 
    push(ref(db, `privateChats/${chatId}`), { uid: myUid, name: window.GameLogic.myProfile.name, msg: msg, time: Date.now() }); 
    update(ref(db, `users/${window.currentPMUid}/unreadPMs`), { [myUid]: true }); 
    input.value = ''; 
};

window.openPurchaseModal = function(name, price) {
    let currentCoins = window.GameLogic.myProfile.coins || 0;
    let maxQty = Math.floor(currentCoins / price);

    if (maxQty <= 0) {
        alert("馬德幣不足！快去打掃賺錢吧！");
        return;
    }

    window.currentPurchaseItem = name;
    window.currentPurchasePrice = price;
    window.currentPurchaseQty = 1;

    document.getElementById('purchase-title').innerText = `購買 ${name}`;

    let desc = "";
    if (name === '水球') {
        desc = "聽說洋蔥都躲在大廳裡面玩水球大戰，為了讓我可以賺更多錢，我在水球裡加了魔法，被擊中的對象也會噴錢，然後他們就會.....一直噴錢，一直撿錢，來找我花錢!!! 嘿嘿嘿...";
    } else if (name === '煙火') {
        desc = "曾經聽我朋友說他的同事們很奇怪，遇到好事就要說『咻蹦～』還要搭配放煙火手勢，我都懶得講話所以做了這個神奇的煙火拿來賣，畫面漂亮((還可以攻擊別人))多麼棒～";
    } else if (name === '蔥友機') {
        desc = "那些洋蔥好像平常太互相傷害了，是時候來點友情的昇華。";
    } else if (name === '派對喇叭') {
        desc = "上次有一顆洋蔥跑來跟我說：『可不可以不要再賣紙飛機了』，我以為他是被射怕了，殊不知他請我搞一個更大的！戰意的號角隨時響起，讓洋蔥開拓新戰場的絕妙好商品來嘍！";
    } else if (name === '喵罐頭') {
        desc = "沒聽過洋蔥還會養小動物的。\n\n這世界上只有喵星人能撫慰洋蔥人的心。按 B 打開罐罐，靠近王子麵後按 A 餵食。每日前三次餵食可提升王子麵羈絆，之後王子麵會表示：夠了。";
    }

    document.getElementById('purchase-desc').innerText = desc;
    document.getElementById('purchase-qty').innerText = window.currentPurchaseQty;
    document.getElementById('purchase-total').innerText = window.currentPurchasePrice;
    document.getElementById('purchase-modal').style.display = 'block';
};
window.adjustPurchaseQty = function(delta) { let maxQty = Math.floor((window.GameLogic.myProfile.coins || 0) / window.currentPurchasePrice); let newQty = window.currentPurchaseQty + delta; if (newQty >= 1 && newQty <= maxQty) { window.currentPurchaseQty = newQty; document.getElementById('purchase-qty').innerText = window.currentPurchaseQty; document.getElementById('purchase-total').innerText = window.currentPurchaseQty * window.currentPurchasePrice; } };
window.confirmPurchase = function() { let cost = window.currentPurchaseQty * window.currentPurchasePrice; if ((window.GameLogic.myProfile.coins || 0) >= cost) { window.GameLogic.myProfile.coins -= cost; window.GameLogic.myProfile.inventory = window.GameLogic.myProfile.inventory || {}; window.GameLogic.myProfile.inventory[window.currentPurchaseItem] = (window.GameLogic.myProfile.inventory[window.currentPurchaseItem] || 0) + window.currentPurchaseQty; update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins, inventory: window.GameLogic.myProfile.inventory }).catch(err => console.warn('Firebase 購買道具扣款失敗:', err)); document.getElementById('purchase-modal').style.display = 'none'; if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (scene) { window.playSFX(scene, 'shop-boss-thank-you'); window.playSFX(scene, 'shop-check-buying'); } } let msgEl = document.getElementById('purchase-success-msg'); msgEl.style.display = 'block'; msgEl.classList.remove('flash-text'); void msgEl.offsetWidth; msgEl.classList.add('flash-text'); setTimeout(() => { msgEl.style.display = 'none'; }, 2000); let smBubble = document.getElementById('store-manager-bubble'); if (smBubble) { smBubble.innerText = "懂買的都是好蔥！"; setTimeout(() => { smBubble.innerText = "這顆臭洋蔥打什麼主意啊"; }, 3000); } let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins; let storeCoinsEl = document.getElementById("store-current-coins"); if (storeCoinsEl) storeCoinsEl.innerText = `💰 ${window.GameLogic.myProfile.coins}`; } };

const loginScreen = document.getElementById("login-screen"); const gameLayoutContainer = document.getElementById("game-layout-container"); const chatSection = document.getElementById("chat-section"); const actionMenu = document.getElementById("action-menu"); const viewProfileModal = document.getElementById("view-profile-modal"); const chatInput = document.getElementById("chat-input");
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(()=>{}); }
window.addEventListener('pointerdown', (e) => { 
    if (!e.target.closest('#action-menu') && e.target.tagName !== 'CANVAS') { actionMenu.style.display = 'none'; } 
    if (e.target.tagName === 'CANVAS') { 
        // 修正2：點擊背景時，不要關閉投票介面與強制召喚介面
        document.querySelectorAll('.modal:not(#voting-modal):not(#forced-summon-modal)').forEach(m => m.style.display = 'none'); 
        window.GameLogic.isShopping = false; 
        // 【修正】確保點擊背景關閉介面時，同步觸發大粉蔥的完整清理與狀態復原
        if (typeof window.closeRewardModal === 'function' && window.GameLogic.activeGiftBox) {
            window.closeRewardModal();
        }
    } 
});
document.getElementById('chat-toggle-btn').addEventListener('click', function() { chatSection.classList.toggle('chat-collapsed'); this.innerText = chatSection.classList.contains('chat-collapsed') ? '展開對話 ▼' : '收起對話 ▲'; if (!chatSection.classList.contains('chat-collapsed')) { const chatBox = document.getElementById("chat-box"); chatBox.scrollTop = 0; } });
document.getElementById("join-btn").addEventListener("click", () => {
    const roomSelect = document.getElementById("server-room-select");
    const selectedRoom = window.rememberServerRoom(
        roomSelect && SERVER_ROOMS[roomSelect.value] ? roomSelect.value : DEFAULT_SERVER_ROOM
    );

    window.GameLogic.selectedServerRoom = selectedRoom;
    window.GameLogic.currentServerRoom = selectedRoom;
    window.syncLoginRoomSelect(selectedRoom);

    const email = document.getElementById("user-email").value;
    const pwd = document.getElementById("user-pwd").value;

    signInWithEmailAndPassword(auth, email, pwd)
        .catch(error => alert("登入失敗: " + error.message));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const requestedRoom = window.getRememberedServerRoom();

        window.GameLogic.selectedServerRoom = requestedRoom;
        window.GameLogic.currentServerRoom = requestedRoom;
        window.syncLoginRoomSelect(requestedRoom);

        if (!window.canEnterServerRoom(user.uid, requestedRoom)) {
            window.GameLogic.authGuardSigningOut = true;
            await window.cleanupCurrentServerPresence(user.uid);

            alert("此房間僅限洋蔥五告派團體成員進入，請改選良之友天地。");

            const fallbackRoom = window.rememberServerRoom(DEFAULT_SERVER_ROOM);

            window.GameLogic.currentUser = null;
            window.GameLogic.selectedServerRoom = fallbackRoom;
            window.GameLogic.currentServerRoom = fallbackRoom;
            window.GameLogic.onlinePlayers = {};
            window.GameLogic.cafePlayers = {};

            window.syncLoginRoomSelect(fallbackRoom);

            loginScreen.style.display = "block";
            gameLayoutContainer.style.display = "none";
            document.body.classList.add('login-bg-active');

            await signOut(auth);
            window.GameLogic.authGuardSigningOut = false;
            return;
        }

        window.rememberServerRoom(requestedRoom);

        window.GameLogic.currentUser = user;
        loginScreen.style.display = "none";
        gameLayoutContainer.style.display = "block";
        document.body.classList.remove('login-bg-active');
        window.updateCurrentRoomLabel();

        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) {
            window.GameLogic.myProfile = Object.assign({}, window.GameLogic.myProfile, profileSnap.val());

        window.normalizePrinceCatProfileFields();
            update(ref(db, `users/${user.uid}`), {
                princeBond: window.GameLogic.myProfile.princeBond || 0,
                princePetCountToday: window.GameLogic.myProfile.princePetCountToday || 0,
                princeLastPetDate: window.GameLogic.myProfile.princeLastPetDate || window.getPrinceLocalDateKey(),
                princeRewardsClaimed: window.GameLogic.myProfile.princeRewardsClaimed || {},
                princeFeedCountToday: window.GameLogic.myProfile.princeFeedCountToday || 0,
                princeLastFeedDate: window.GameLogic.myProfile.princeLastFeedDate || window.getPrinceLocalDateKey()
            }).catch(err => console.warn('Firebase 補齊王子麵欄位失敗:', err));
            
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

        setTimeout(() => {
        if (window.checkPendingWeeklyRewardNotice) window.checkPendingWeeklyRewardNotice();
        }, 0);

        if (connectedUnsubscribe) { connectedUnsubscribe(); connectedUnsubscribe = null; }
        connectedUnsubscribe = onValue(ref(db, '.info/connected'), (snap) => {
            if (snap.val() === true && window.GameLogic.currentUser) {
                const globalPlayerRef = ref(db, window.getServerRoomPath(`onlinePlayers/${window.GameLogic.currentUser.uid}`));
                set(globalPlayerRef, {
                     name: window.GameLogic.myProfile.name || '匿名',
                     color: window.GameLogic.myProfile.color || '#fff',
                     lastActive: Date.now()
                 });
                onDisconnect(globalPlayerRef).remove();

                if (window.GameLogic.currentScene === 'cafe') {
                    const cafeRef = ref(db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`));
                    set(cafeRef, { x: window.GameLogic.myProfile.lastX || 1024, y: window.GameLogic.myProfile.lastY || 1024, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, bubbleMsg: window.GameLogic.myProfile.bubbleMsg || "", bubbleTime: window.GameLogic.myProfile.bubbleTime || 0 });
                    onDisconnect(cafeRef).remove();
                } else if (window.GameLogic.currentScene === 'shrine') { joinShrine(); }
            }
        });
        
        if (onlinePlayersUnsubscribe) { onlinePlayersUnsubscribe(); onlinePlayersUnsubscribe = null; }
        onlinePlayersUnsubscribe = onValue(ref(db, window.getServerRoomPath('onlinePlayers')), (snapshot) => {
            window.GameLogic.onlinePlayers = snapshot.val() || {};
            window.updateOnlinePlayersUI();
        });
        onValue(ref(db, `users/${user.uid}/unreadPMs`), snap => { window.GameLogic.unreadPMs = snap.val() || {}; window.updateUnreadGlow(); if (document.getElementById('inventory-modal').style.display === 'block') { window.openInventoryModal(); } });
        onValue(ref(db, 'manuals'), snap => { const data = snap.val(); window.manualPages = []; if (data) { Object.keys(data).forEach(key => { window.manualPages.push({ key: key, imgBase64: data[key].imgBase64, timestamp: data[key].timestamp }); }); window.manualPages.sort((a, b) => a.timestamp - b.timestamp); } window.renderManualPage(); });
        if (cafeFurnitureUnsubscribe) { cafeFurnitureUnsubscribe(); cafeFurnitureUnsubscribe = null; }
        cafeFurnitureUnsubscribe = onValue(ref(db, window.getServerRoomPath('cafeFurniture')), snap => {
            window.GameLogic.cafeFurniture = snap.val() || {};
        });

        // 房間內神龕強制召喚監聽與 60 秒倒數
        if (summonUnsubscribe) { summonUnsubscribe(); summonUnsubscribe = null; }
        summonUnsubscribe = onValue(ref(db, window.getServerRoomPath('serverEvents/summonShrine')), snap => {
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

        setTimeout(() => {
            if (window.startPartyInviteListener) window.startPartyInviteListener();
        }, 0);

        if (!window.GameLogic.phaserGame) { window.GameLogic.pendingScene = window.GameLogic.myProfile.lastScene || "doghouse"; initPhaser(); } else { switchScene(window.GameLogic.myProfile.lastScene || "doghouse"); }
        listenToChat(); listenToMemories();
    } else {
        window.GameLogic.currentUser = null;
        window.GameLogic.onlinePlayers = {};
        window.GameLogic.cafePlayers = {};
        loginScreen.style.display = "block";
        gameLayoutContainer.style.display = "none";
        document.body.classList.add('login-bg-active');

        if (connectedUnsubscribe) { connectedUnsubscribe(); connectedUnsubscribe = null; }
        if (onlinePlayersUnsubscribe) { onlinePlayersUnsubscribe(); onlinePlayersUnsubscribe = null; }
        if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
        if (memoryUnsubscribe) { memoryUnsubscribe(); memoryUnsubscribe = null; }
        if (cafeFurnitureUnsubscribe) { cafeFurnitureUnsubscribe(); cafeFurnitureUnsubscribe = null; }
        if (summonUnsubscribe) { summonUnsubscribe(); summonUnsubscribe = null; }
        if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
        if (shrineUnsubscribe) { shrineUnsubscribe(); shrineUnsubscribe = null; }
        if (shrineEventUnsubscribe) { shrineEventUnsubscribe(); shrineEventUnsubscribe = null; }
        if (partyInvitesUnsubscribe) { partyInvitesUnsubscribe(); partyInvitesUnsubscribe = null; }

        window.GameLogic.partyInvitesData = {};
        if (window.PartyLogic) {
            window.PartyLogic.pendingInviteId = null;
            window.PartyLogic.lastInviteTime = 0;
            window.PartyLogic.seenInviteKeys = {};
        }

window.updateOnlinePlayersUI();
    }
});

function joinShrine() {
    const playerRef = ref(db, window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`));
    // 【修正 BUG 2】補上 level 屬性，讓其他玩家能看見真實等級
    set(playerRef, { x: window.GameLogic.myProfile.lastX || 640, y: window.GameLogic.myProfile.lastY || 360, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, isSeated: false });
    onDisconnect(playerRef).remove();
    shrineUnsubscribe = onValue(ref(db, window.getServerRoomPath('shrinePlayers')), (snapshot) => { window.GameLogic.shrinePlayers = snapshot.val() || {}; checkShrineVotingTrigger(); });
    shrineEventUnsubscribe = onValue(ref(db, window.getServerRoomPath('shrineEvents/current')), snap => {
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
        let validUids = Object.keys(players).filter(uid =>
            window.GameLogic.onlinePlayers &&
            window.GameLogic.onlinePlayers[uid] &&
            (now - (window.GameLogic.onlinePlayers[uid].lastActive || 0) < 20000)
        );
        
        // 當所有人（或最後一個有效在線玩家）離開神龕時，結束本房間神龕事件，並清空本房間神龕金幣
        if (validUids.length <= 1) {
            if (window.GameLogic.shrineEventData && window.GameLogic.shrineEventData.state !== 'finished') {
                update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'finished' });
            }

            get(ref(window.GameLogic.db, window.getServerRoomPath('droppedCoins'))).then(snap => {
                let coins = snap.val() || {};
                let updates = {};

                Object.keys(coins).forEach(k => {
                    const coinData = coins[k] || {};
                    if (k.startsWith('shrine_coin_') || coinData.scene === 'shrine') {
                        updates[window.getServerRoomPath(`droppedCoins/${k}`)] = null;
                    }
                });

                if (Object.keys(updates).length > 0) update(ref(window.GameLogic.db), updates);
            });
        }

        set(ref(window.GameLogic.db, window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`)), null); 
    }

    if (shrineUnsubscribe) { shrineUnsubscribe(); shrineUnsubscribe = null; } 
    if (shrineEventUnsubscribe) { shrineEventUnsubscribe(); shrineEventUnsubscribe = null; } 

    document.getElementById('voting-modal').style.display = 'none';
    document.getElementById('spam-ui').style.display = 'none';
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
            set(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'voting', startTime: Date.now() }); 
            // 修正：儀式正式進入投票階段！立刻將全服的召喚倒數歸零，瞬間關閉外面的 60 秒通知
            update(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/summonShrine')), { time: 0 });
        } 
    } 
}

// 新增：全域 UI 大掃除函式，防止場景切換時的 DOM 殘留與 Memory Leak
window.clearAllModals = function() {
    // 1. 關閉所有共用 Modal 類別
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    // Phaser overlay 不是 DOM modal，需要另外清理
    if (window.GameLogic.phaserGame) {
        const ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms && ms.closeSoloChickenMenu) ms.closeSoloChickenMenu();
        if (ms && ms.clearSoloRocketCruise && (ms.soloRocketCruiseActive || ms.soloRocketContainer || ms.soloRocketResultContainer)) {
            ms.clearSoloRocketCruise(true);
        }
    }
    
    // 2. 關閉特定獨立或脫離文件流的 UI
    const standaloneUIs = [
        'spam-ui', 'party-red-flash', 'rps-modal', 'party-waiting-modal', 
        'action-menu', 'quick-select-menu', 'prince-cat-menu', 'magic-menu-blocker', 
        'ingame-confirm', 'purchase-success-msg', 'fullscreen-viewer'
    ];
    standaloneUIs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
};

function switchScene(sceneName, extraData = null) {
    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (scene) window.playSFX(scene, 'jump04'); }
    
    // 切換場景時，強制清空所有浮動視窗與特效 UI
    window.clearAllModals();

    if (sceneName !== 'doghouse') {
    if (window.GameLogic.myProfile && window.GameLogic.myProfile.sleepStartTime > 0) {
        window.GameLogic.myProfile.sleepStartTime = 0; 
        localStorage.removeItem('onion_sleepStartTime');
        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { sleepStartTime: 0 });
    }
        if (window.GameLogic.phaserGame) { let ms = window.GameLogic.phaserGame.scene.getScene('MainScene'); if (ms && ms.sound && ms.sound.get('onion-sleep')) ms.sound.stopByKey('onion-sleep'); }
    }

    const doSwitch = () => {
        window.GameLogic.currentScene = sceneName; window.GameLogic.placingFurnitureKey = null; 
        
        // 離開原本的房間
        leaveCafe(); leaveShrine(); leavePlayroom();
        if (sceneName !== "partyroom") {
            window.leavePartyroom(true);
        } else if (window.PartyLogic && window.PartyLogic.roomId && extraData && extraData.roomId && window.PartyLogic.roomId !== extraData.roomId) {
            window.leavePartyroom(true);
        }

        if (sceneName === "cafe") joinCafe(); 
        else if (sceneName === "shrine") joinShrine(); 
        else if (sceneName === "playroom") joinPlayroom(extraData.roomId);
        else if (sceneName === "partyroom") window.joinPartyroom(extraData.roomId);

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
            if (sceneName !== 'playroom' && sceneName !== 'partyroom') {
                update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { lastScene: sceneName, lastX: entranceX, lastY: entranceY });
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

    const playerRef = ref(db, window.getServerRoomPath(`playroomPlayers/${roomId}/${window.GameLogic.currentUser.uid}`));
    let startX = 640 + (Math.random() * 100 - 50); // 稍微錯開出生點避免疊加卡死
    set(playerRef, { x: startX, y: 450, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1 });
    onDisconnect(playerRef).remove();
    onDisconnect(ref(db, window.getServerRoomPath(`playroomGames/${roomId}/p_${window.GameLogic.currentUser.uid}`))).remove();

    playroomUnsubscribe = onValue(ref(db, window.getServerRoomPath(`playroomPlayers/${roomId}`)), (snapshot) => {
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
}
function leavePlayroom() {
    if (window.GameLogic.currentRoomId && window.GameLogic.currentUser) {
        // 修正死碼：直接呼叫全域已引入的 set 與 ref，避免非同步落差導致 currentRoomId 遺失
        set(ref(db, window.getServerRoomPath(`playroomPlayers/${window.GameLogic.currentRoomId}/${window.GameLogic.currentUser.uid}`)), null);
        // 離開時防呆：強迫清理正在進行的 RPS
        window.cancelRpsGame(window.GameLogic.currentRoomId);
    }
    if (playroomUnsubscribe) { playroomUnsubscribe(); playroomUnsubscribe = null; }
    window.GameLogic.currentRoomId = null;
    window.GameLogic.playroomPlayers = {};
    if (window.rpsUnsubscribe) { window.rpsUnsubscribe(); window.rpsUnsubscribe = null; }
}
function joinCafe() {
    const playerRef = ref(db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`));
    set(playerRef, {
        x: window.GameLogic.myProfile.lastX || 1024,
        y: window.GameLogic.myProfile.lastY || 1024,
        name: window.GameLogic.myProfile.name,
        color: window.GameLogic.myProfile.color,
        level: window.GameLogic.myProfile.level || 1,
        bubbleMsg: window.GameLogic.myProfile.bubbleMsg,
        bubbleTime: window.GameLogic.myProfile.bubbleTime
    });
    onDisconnect(playerRef).remove();

    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
    cafeUnsubscribe = onValue(ref(db, window.getServerRoomPath('cafePlayers')), (snapshot) => {
        window.GameLogic.cafePlayers = snapshot.val() || {};
        window.updateOnlinePlayersUI();
    });
}
function leaveCafe() {
    if (window.GameLogic.currentUser) {
        set(ref(db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), null);
    }
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

function gainRewards(coins, exp) {
    let p = window.GameLogic.myProfile; p.coins = (p.coins || 0) + coins; p.exp = (p.exp || 0) + exp; p.sweeps = (p.sweeps || 0) + 1; 
    p.level = p.level || 1; // 補上防呆，確保缺少等級資料時預設為 1，避免計算出 NaN
    let requiredExp = p.level * 100; let leveledUp = false;
    if (p.exp >= requiredExp) { p.level++; p.exp -= requiredExp; leveledUp = true; }
    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins, exp: p.exp, level: p.level, sweeps: p.sweeps }).catch(err => console.warn('Firebase 更新玩家獎勵失敗:', err));
    
    let weekId = window.getWeekId(0);
    let sweepRef = ref(window.GameLogic.db, window.getServerRoomPath(`weeklySweeps/${weekId}/${window.GameLogic.currentUser.uid}`));
    get(sweepRef).then(snap => {
        let currentCount = snap.exists() ? snap.val().count : 0;
        update(sweepRef, { name: p.name, count: currentCount + 1 });
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

        // Loading 背景 fallback：即使封面圖缺檔，也不讓畫面黑掉。
        this.add.rectangle(w / 2, h / 2, w, h, 0x1f140d).setDepth(-30);

        const loadingCoverKey = (window.innerWidth <= 768 || window.innerHeight > window.innerWidth)
            ? 'loading-cover-phone'
            : 'loading-cover-pc';

        const showLoadingCover = (key) => {
            if (!this.textures.exists(key) || this.loadingCoverImage) return;

            const cover = this.add.image(w / 2, h / 2, key).setDepth(-20);
            const source = cover.texture.getSourceImage();
            const imgW = source && source.width ? source.width : w;
            const imgH = source && source.height ? source.height : h;
            const scale = Math.max(w / imgW, h / imgH);

            cover.setScale(scale);
            this.loadingCoverImage = cover;
        };

        this.load.once(`filecomplete-image-${loadingCoverKey}`, () => {
            showLoadingCover(loadingCoverKey);
        });

        this.load.image('loading-cover-pc', 'cover_pc_2880x1864.png');
        this.load.image('loading-cover-phone', 'cover_phone_1080x1920.png');

        let progressBox = this.add.graphics().fillStyle(0x3e2723, 0.8).fillRoundedRect(w/2 - 160, h/2 - 25, 320, 50, 8).lineStyle(2, 0xc5a059, 1).strokeRoundedRect(w/2 - 160, h/2 - 25, 320, 50, 8);
        progressBox.setDepth(10);

        let progressBar = this.add.graphics();
        progressBar.setDepth(11);

        let pt = this.make.text({ x: w/2, y: h/2, text: '0%', style: { font: 'bold 18px Georgia', fill: '#ffffff' } }).setOrigin(0.5, 0.5);
        pt.setDepth(12);

        this.load.on('progress', val => {
            pt.setText(parseInt(val * 100) + '%');
            progressBar.clear().fillStyle(0xc5a059, 1).fillRoundedRect(w/2 - 150, h/2 - 15, 300 * val, 30, 6);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            pt.destroy();
        });

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
        this.load.audio('tools-onion-party-trumpet', 'tools-onion-party-trumpet.mp3');
      
        // 神龕專用音樂
        this.load.audio('shrine-wierd-people-sound', 'shrine-wierd-people-sound.mp3');
        this.load.audio('shrine-selection', 'shrine-selection.mp3');
        this.load.audio('shrine-purify-fight', 'shrine-purify-fight.mp3');
        this.load.audio('shrine-purify-success-win', 'shrine-purify-success-win.mp3');
        this.load.audio('shrine-purify-success', 'shrine-purify-success.mp3');
        // 領獎與勳章資源
        this.load.image('gift-box-stay', 'gift-box-stay.png');
        this.load.image('gift-box-open', 'gift-box-open.png');
        this.load.image('ranking-medal-cleanking-no1.png', 'ranking-medal-cleanking-no1.png');
        this.load.image('ranking-medal-cleanking-no2.png', 'ranking-medal-cleanking-no2.png');
        this.load.image('ranking-medal-cleanking-no3.png', 'ranking-medal-cleanking-no3.png');
        this.load.image('ranking-medal-cleanking-500ps.png', 'ranking-medal-cleanking-500ps.png');
        this.load.image('ranking-medal-cleanking-1000ps.png', 'ranking-medal-cleanking-1000ps.png');
        this.load.spritesheet('onion-show-off', 'onion-show-off.png', { frameWidth: 75, frameHeight: 75 });
        this.load.audio('reward-open-box', 'reward-open-box.mp3');
        this.load.audio('reward-get-sounds', 'reward-get-sounds.mp3');
        this.load.audio('onion-show-off-reward', 'onion-show-off-reward.mp3');

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
        this.load.spritesheet('prince-cat-walk-right-sheet', 'pet-cat-wzm-walk-right.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-walk-left-sheet', 'pet-cat-wzm-walk-left.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-stand-sheet', 'pet-cat-wzm-stand.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-lick-sheet', 'pet-cat-wzm-lick.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-sleep-sheet', 'pet-cat-wzm-sleep.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-touched-sheet', 'pet-cat-wzm-touched.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-eating-sheet', 'pet-cat-wzm-eatting.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('prince-cat-yummy-sheet', 'pet-cat-wzm-yummy.png', { frameWidth: 100, frameHeight: 100 });
        // 第二版餵食卡死修復：開罐素材先以 image 載入，create() 再檢查尺寸後安全切 sprite sheet
        this.load.image('pet-cat-can-open-source', 'tools-pet-cat-can-open.png');
        this.load.image('onion-feeding', 'onion-feeding.png');
        this.load.image('prince-cat-walk-made-coin', 'pet-cat-wzm-walk-with-made-coin.png');
        this.load.image('prince-cat-support-10coin', 'pet-cat-wzm-support-10coin.png');
        this.load.image('ranking-medal-cat-wzm-no1.png', 'ranking-medal-cat-wzm-no1.png');
        this.load.image('ranking-medal-cat-wzm-no2.png', 'ranking-medal-cat-wzm-no2.png');
        this.load.image('ranking-medal-cat-wzm-no3.png', 'ranking-medal-cat-wzm-no3.png');
        this.load.image('ranking-medal-cat-wzm-no4.png', 'ranking-medal-cat-wzm-no4.png');
        this.load.audio('cat-can-open-sfx', 'tools-cat-can-open.mp3');
        this.load.audio('prince-cat-eating-sfx', 'pet-cat-wzm-eating.mp3');
        this.load.audio('prince-cat-full-sfx', 'pet-cat-wzm-full.mp3');
        this.load.audio('prince-cat-bring-coin-sfx', 'pet-cat-wzm-bring-coin.mp3');
        this.load.audio('prince-cat-friendship-up-sfx', 'pet-cat-wzm-friendship-up.mp3');
        this.load.spritesheet('onion-petting-sheet', 'onion-petting.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('prince-cat-love', 'pet-cat-wzm-love.png'); // 王子麵摸摸愛心特效，showPrinceCatLoveEffect() 使用此 key
        this.load.image('ranking-medal-cat-wzm-no0.png', 'ranking-medal-cat-wzm-no0.png');
        this.load.audio('prince-cat-normal-meow', 'pet-cat-wzm-normal-meow.mp3');
        this.load.audio('prince-cat-got-touched', 'pet-cat-wzm-got-touched.mp3');
        this.load.audio('prince-cat-feel-good', 'pet-cat-wzm-feel-good.mp3');
        this.load.image('bg7Eonion', '7eonion-bg.jpg'); this.load.image('storeManager', 'store-manager.png'); this.load.spritesheet('onion-throw', 'onion-throw.png', { frameWidth: 90, frameHeight: 75 }); this.load.spritesheet('water-ball-blast', 'water-ball-blast.png', { frameWidth: 50, frameHeight: 50 }); this.load.spritesheet('onion-wet', 'onion-wet.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('made-coin', 'made-coin.png', { frameWidth: 50, frameHeight: 50 }); this.load.image('dummy', 'dummy.png'); this.load.spritesheet('dummy-got-shot', 'dummy-got-shot.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('fireworks', 'shop-fireworks.png'); this.load.spritesheet('onion-fireworks', 'onion-fireworks.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('onion-got-shot', 'onion-got-shot.png', { frameWidth: 75, frameHeight: 75 }); this.load.spritesheet('mimi-thief-walk', 'mimi-thief-walk.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('fireworks-shoot', 'fireworks-shoot.png', { frameWidth: 50, frameHeight: 50 });
        this.load.spritesheet('mimi-thief-stealing', 'mimi-thief-stealing.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('mimi-laugh', 'mimi-laugh.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('mimi-thief-get-down', 'mimi-thief-get-down.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('plane', 'playroom-onion-friend-plane.png');
        this.load.image('trumpet', 'tools-onion-party-trumpet.png');
        this.load.spritesheet('onion-trumpet', 'onion-party-trumpet.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('bgPartyroom', 'partyroom-under-water-reef-valley-bg.jpg');
        this.load.image('party-stone', 'partyroom-under-water-reef-valley-stone.png');
        this.load.image('party-shot-number', 'partyroom-under-water-reef-valley-got-shot-number.png');
        this.load.image('party-attack-number', 'partyroom-under-water-reef-valley-attack-number.png');
        this.load.audio('bgm-party', 'partyroom-under-water-reef-valley-bgm.mp3');
        this.load.audio('party-start', 'partyroom-start-ready-go.mp3');
        this.load.audio('party-finish', 'partyroom-finish.mp3');
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
        // 獨樂雞與火箭巡航素材。火箭素材若缺失，後續會用 fallback，避免黑屏。
        this.load.image('solochicken', 'me_play_cock.png');
        this.load.image('solo-rocket-bg', 'solo-rocket-bg.png');
        this.load.image('rocket-onion-player', 'rocket-onion-player.png');
        this.load.image('solo-rocket-moon-rabbit', 'solo-rocket-moon-rabbit.png');
        this.load.image('solo-rocket-monster-chicken', 'solo-rocket-monster-chicken.png');
        this.load.image('solo-rocket-heart-life-container', 'solo-rocket-heart-life-container.png');
        this.load.image('solo-rocket-space-rock', 'solo-rocket-space-rock.png');
        this.load.audio('solo-rocket-cruise-bgm', 'solo-rocket-cruise-bgm.mp3');
        this.load.audio('solo-rocket-landing', 'solo-rocket-landing.mp3');
        this.load.audio('solo-rocket-typing', 'solo-rocket-typing.mp3');
        this.load.audio('solo-rocket-radio_beep', 'solo-rocket-radio_beep.mp3');
        this.load.audio('solo-rocket-monster-chicken-die', 'solo-rocket-monster-chicken-die.mp3');
        this.load.audio('solo-rocket-bang', 'solo-rocket-bang.mp3');
        this.load.audio('solo-rocket-turn', 'solo-rocket-turn.mp3');
        this.load.image('solo-rocket-monster-boss-chicken', 'solo-rocket-monster-boss-chicken.png');
        this.load.audio('solo-rocket-bang-on-boss', 'solo-rocket-bang-on-boss.mp3');
        this.load.audio('solo-rocket-monster-boss-chicken-die', 'solo-rocket-monster-boss-chicken-die.mp3');
        this.load.audio('solo-rocket-turn-cd-recharge', 'solo-rocket-turn-cd-recharge.mp3');
        this.load.audio('solo-rocket-big-attack', 'solo-rocket-big-attack.mp3');
        // 補丁 6-1：玉兔伴手禮店 placeholder 素材。缺檔時商店會使用 Phaser fallback，不讓副本黑頻。
        this.load.image('solo-rocket-rabbit-shop-bg', 'solo-rocket-rabbit-shop-bg.png');
        this.load.image('solo-rocket-rabbit-shopkeeper', 'solo-rocket-rabbit-shopkeeper.png');
        this.load.image('solo-rocket-item-moon-shard', 'solo-rocket-item-moon-shard.png');
        this.load.image('solo-rocket-item-moon-staff', 'solo-rocket-item-moon-staff.png');
        this.load.image('solo-rocket-item-moon-bun', 'solo-rocket-item-moon-bun.png');
        this.load.image('solo-rocket-rabbit-shop-sign', 'solo-rocket-rabbit-shop-sign.png');
        this.load.audio('solo-rocket-rabbit-shop-bgm', 'solo-rocket-rabbit-shop-bgm.mp3');
        this.load.audio('solo-rocket-rabbit-shop-finish', 'solo-rocket-rabbit-shop-finish.mp3');
        this.load.audio('solo-rocket-rabbit-shop-buy', 'solo-rocket-rabbit-shop-buy.mp3');
        // 補丁 6-2：月球商品使用效果音效。若檔案不存在，播放前會檢查 cache，不讓遊戲黑頻。
        this.load.audio('moon-bun-use', 'onion-take-a-bite.mp3');
        this.load.audio('moon-staff-use', 'moon-staff-use.mp3');
        // 補丁 6-2 後續：月光法杖五隻跳舞兔子。80px 橫排 spritesheet；缺圖時 playMoonStaffBlessing() 會自動用文字兔子 fallback。
        this.load.spritesheet('moon-staff-dance-rabbit', 'solo-rocket-item-moon-staff-dance-rabbits.png', { frameWidth: 80, frameHeight: 80 });

        // 在記憶體中畫一個簡單的白色發光點紋理給粒子使用
        let grd = this.make.graphics({x: 0, y: 0, add: false});
        grd.fillStyle(0xffffff, 1); grd.fillCircle(4, 4, 4); // 畫一個半徑 4 的圓
        grd.generateTexture('particle_flare', 8, 8); // 生成名為 'particle_flare' 的紋理
        // 火箭巡航階段4 fallback：小怪獸素材缺失時，改用程式繪製的安全圖，不讓副本黑屏。
        let monsterFallbackGr = this.make.graphics({ x: 0, y: 0, add: false });
        monsterFallbackGr.fillStyle(0xb388ff, 1).fillCircle(32, 32, 22);
        monsterFallbackGr.fillStyle(0xe6ccff, 1).fillCircle(22, 25, 7);
        monsterFallbackGr.fillCircle(42, 25, 7);
        monsterFallbackGr.fillStyle(0x111111, 1).fillCircle(22, 25, 2.5);
        monsterFallbackGr.fillCircle(42, 25, 2.5);
        monsterFallbackGr.lineStyle(3, 0x111111, 1).strokeCircle(32, 38, 8);
        monsterFallbackGr.lineStyle(4, 0x7e57c2, 1).lineBetween(16, 20, 6, 10).lineBetween(48, 20, 58, 10);
        monsterFallbackGr.generateTexture('solo-rocket-monster-fallback', 64, 64);
        monsterFallbackGr.destroy();
        // 火箭巡航階段5 fallback：隕石素材缺失時，改用程式繪製的安全圖，不讓副本黑屏。
        let asteroidFallbackGr = this.make.graphics({ x: 0, y: 0, add: false });
        asteroidFallbackGr.fillStyle(0xb0bec5, 1).fillCircle(32, 32, 25);
        asteroidFallbackGr.fillStyle(0x78909c, 1).fillCircle(22, 25, 8);
        asteroidFallbackGr.fillStyle(0x607d8b, 1).fillCircle(43, 36, 7);
        asteroidFallbackGr.fillStyle(0xeceff1, 0.8).fillCircle(26, 18, 4);
        asteroidFallbackGr.lineStyle(3, 0xffffff, 0.35).strokeCircle(32, 32, 25);
        asteroidFallbackGr.generateTexture('solo-rocket-space-rock-fallback', 64, 64);
        asteroidFallbackGr.destroy();
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
        this.anims.create({ key: 'show-off', frames: this.anims.generateFrameNumbers('onion-show-off'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'trumpet-play', frames: this.anims.generateFrameNumbers('onion-trumpet'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'seat-idle', frames: this.anims.generateFrameNumbers('onion-seat-shrine'), frameRate: 5, repeat: -1 }); this.anims.create({ key: 'purify-target', frames: this.anims.generateFrameNumbers('onion-got-purify'), frameRate: 8, repeat: -1 }); this.anims.create({ key: 'purify-magic', frames: this.anims.generateFrameNumbers('onion-doing-purify'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'charger-anim', frames: this.anims.generateFrameNumbers('sleep-charger'), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'prince-cat-walk-right', frames: this.anims.generateFrameNumbers('prince-cat-walk-right-sheet', { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
        this.anims.create({ key: 'prince-cat-walk-left', frames: this.anims.generateFrameNumbers('prince-cat-walk-left-sheet', { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
        this.anims.create({ key: 'prince-cat-stand', frames: this.anims.generateFrameNumbers('prince-cat-stand-sheet', { start: 0, end: 5 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'prince-cat-lick', frames: this.anims.generateFrameNumbers('prince-cat-lick-sheet', { start: 0, end: 5 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'prince-cat-sleep', frames: this.anims.generateFrameNumbers('prince-cat-sleep-sheet', { start: 0, end: 5 }), frameRate: 3, repeat: -1 });
        this.anims.create({ key: 'prince-cat-touched', frames: this.anims.generateFrameNumbers('prince-cat-touched-sheet', { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
        this.anims.create({ key: 'prince-cat-eating', frames: this.anims.generateFrameNumbers('prince-cat-eating-sheet', { start: 0, end: 5 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'prince-cat-yummy', frames: this.anims.generateFrameNumbers('prince-cat-yummy-sheet', { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
        // 王子麵第二版餵食補丁緊急修正：
        // BootScene 不呼叫 MainScene method，改用 inline 防呆建立開罐動畫，避免啟動黑屏。
        try {
            const sourceKey = 'pet-cat-can-open-source';
            const sheetKey = 'pet-cat-can-open-sheet';
            const animKey = 'pet-cat-can-open';

            if (!this.textures.exists(sourceKey)) {
                console.warn('[王子麵餵食] 找不到 tools-pet-cat-can-open.png，略過開罐動畫建立。');
            } else {
                const sourceTexture = this.textures.get(sourceKey);
                const sourceImage =
                    sourceTexture && sourceTexture.getSourceImage
                        ? sourceTexture.getSourceImage()
                        : (
                            sourceTexture &&
                            sourceTexture.source &&
                            sourceTexture.source[0] &&
                            sourceTexture.source[0].image
                                ? sourceTexture.source[0].image
                                : null
                        );

                const sourceWidth =
                    sourceImage && sourceImage.width
                        ? sourceImage.width
                        : (
                            sourceTexture &&
                            sourceTexture.source &&
                            sourceTexture.source[0] &&
                            sourceTexture.source[0].width
                                ? sourceTexture.source[0].width
                                : 0
                        );

                const sourceHeight =
                    sourceImage && sourceImage.height
                        ? sourceImage.height
                        : (
                            sourceTexture &&
                            sourceTexture.source &&
                            sourceTexture.source[0] &&
                            sourceTexture.source[0].height
                                ? sourceTexture.source[0].height
                                : 0
                        );

                if (sourceWidth < 600 || sourceHeight < 100) {
                    console.warn(`[王子麵餵食] tools-pet-cat-can-open.png 尺寸不正確：${sourceWidth}×${sourceHeight}。需要至少 600×100，6 格橫排，每格 100×100。已略過開罐動畫，不中斷 BootScene。`);
                } else {
                    if (!this.textures.exists(sheetKey)) {
                        this.textures.addSpriteSheet(sheetKey, sourceImage, {
                            frameWidth: 100,
                            frameHeight: 100,
                            startFrame: 0,
                            endFrame: 5
                        });
                    }

                    const sheetTexture = this.textures.get(sheetKey);
                    const hasFrame0 = !!(
                        sheetTexture &&
                        (
                            (sheetTexture.has && (sheetTexture.has(0) || sheetTexture.has('0'))) ||
                            (sheetTexture.frames && (sheetTexture.frames[0] || sheetTexture.frames['0']))
                        )
                    );

                    if (!hasFrame0) {
                        console.warn('[王子麵餵食] pet-cat-can-open-sheet 沒有 frame 0，略過開罐動畫建立，不中斷 BootScene。');
                    } else if (!this.anims.exists(animKey)) {
                        this.anims.create({
                            key: animKey,
                            frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: 5 }),
                            frameRate: 8,
                            repeat: 0
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[王子麵餵食] 建立開罐動畫失敗，已略過，不中斷 BootScene：', err);
        }
        this.anims.create({ key: 'onion-petting', frames: this.anims.generateFrameNumbers('onion-petting-sheet', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });

        this.scene.launch('UIScene'); this.scene.bringToTop('UIScene'); 
        window.GameLogic.phaserLoaded = true;
        if (window.GameLogic.pendingScene) { window.switchScene(window.GameLogic.pendingScene); window.GameLogic.pendingScene = null; }
    }
}

class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }
    create() {
        // 手機 PWA 雙點觸控：保留搖桿 pointer，同時允許右手按發射/旋轉。
        try { this.input.addPointer(2); } catch (_) {}

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
        this.statusToggleBtn.on('pointerdown', () => { this.isStatusCollapsed = !this.isStatusCollapsed; const bgW = this.statusBg.displayWidth; const targetX = this.isStatusCollapsed ? 20 - bgW + 10 : 20; this.tweens.add({ targets: this.statusContainer, x: targetX, duration: 300, ease: 'Power2' }); });
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

        if (window.GameLogic.soloRocketCruiseActive) {
            [this.furnBtn, this.furnText, this.itemBtn, this.itemText, this.btnA, this.txtA, this.btnB, this.txtB, this.statusContainer].forEach(obj => {
                if (obj && obj.setVisible) obj.setVisible(false);
            });
            if (this.partyDash) this.partyDash.setVisible(false);
            if (this.joyStick) {
                if (this.joyStick.base && this.joyStick.base.setVisible) {
                    this.joyStick.base.setVisible(true);
                }
                if (this.joyStick.thumb && this.joyStick.thumb.setVisible) {
                    this.joyStick.thumb.setVisible(true);
                }
            }
            return;
        }
        
        if (window.GameLogic.currentScene === 'partyroom') {
            this.furnBtn.setVisible(false); this.furnText.setVisible(false);
            this.itemBtn.setVisible(false); this.itemText.setVisible(false);
            this.statusContainer.setVisible(false);
            
            if (!this.partyDash) {
                this.partyDash = this.add.container(20, this.cameras.main.height - 100).setDepth(200).setScrollFactor(0);
                let dashBg = this.add.graphics().fillStyle(0x000, 0.6).lineStyle(2, 0x00ffff).fillRoundedRect(0, 0, 140, 60, 8).strokeRoundedRect(0, 0, 140, 60, 8);
                this.partyDashText = this.add.text(70, 30, '', { fontSize: '18px', color: '#00ffff', fontStyle: 'bold' }).setOrigin(0.5);
                this.partyDash.add([dashBg, this.partyDashText]);
                this.resizeUI(this.scale.gameSize); // 強制在建立儀表板的瞬間刷新佈局，對齊搖桿上方
            }
            this.partyDash.setVisible(true);
            
            let ammo = window.PartyLogic.ammo || 0;
            let timeTxt = "等待中";
            if (window.PartyLogic.state === 'gaming') {
                let elapsed = Date.now() - (window.PartyLogic.gameData.gamingStartTime || 0);
                timeTxt = Math.max(0, 60 - Math.floor(elapsed / 1000)) + "s";
            }
            this.partyDashText.setText(`x${ammo} | ⏱️${timeTxt}`);
        } else {
            this.furnBtn.setVisible(true); this.furnText.setVisible(true);
            this.itemBtn.setVisible(true); this.itemText.setVisible(true);
            this.statusContainer.setVisible(true);
            if (this.partyDash) this.partyDash.setVisible(false);
        }

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
        if (!this.joyStick) return;

        const isPortrait = gameSize.height > gameSize.width;
        const mainScene = this.scene.manager.getScene('MainScene');
        const isSoloRocketPlaying = !!(mainScene && mainScene.soloRocketCruiseActive && !mainScene.soloRocketCruiseFinished);
        const portraitLift = isSoloRocketPlaying ? 135 : 80;
        const bottomOffset = isPortrait ? 120 : 20;
        const joystickX = 90;
        const joystickY = gameSize.height - 90 - (isPortrait ? portraitLift : 0);

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
        let clusterX = gameSize.width - 90; let clusterY = gameSize.height - bottomOffset - 70; let d = 55; 
        // 修正1：為 A 鍵與給西按鈕補上定位點，呈現正菱形排列，互不重疊
        this.btnA.setPosition(clusterX + d, clusterY); this.txtA.setPosition(this.btnA.x, this.btnA.y);
        this.btnB.setPosition(clusterX, clusterY + d); this.txtB.setPosition(this.btnB.x, this.btnB.y);
        this.itemBtn.setPosition(clusterX, clusterY - d); this.itemText.setPosition(this.itemBtn.x, this.itemBtn.y);
        this.furnBtn.setPosition(clusterX - d, clusterY); this.furnText.setPosition(this.furnBtn.x, this.furnBtn.y);
        
        if (this.magicMenuEmitter) {
    const quickMenu = document.getElementById('quick-select-menu');
    if (quickMenu && quickMenu.style.display === 'flex') {
        const rect = quickMenu.getBoundingClientRect();
        this.magicMenuEmitter.setPosition(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
        this.magicMenuEmitter.setPosition(gameSize.width / 2, gameSize.height - 185);
    }
}
        // 修正4：派對儀表板再往上移，設定為搖桿 Y 軸上方 220px 避免重疊
        if (this.partyDash) this.partyDash.setPosition(20, joystickY - 220);
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
        // 手機 PWA 雙點觸控：MainScene 的副本按鈕也需要額外 pointer。
        try { this.input.addPointer(2); } catch (_) {}

        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        this.mimiWalkSFX = null;
        this.handleVisibilityMimiWalk = null;
        this.lastPrinceCatState = null;
        this.lastPrinceCatStateStartTime = null;
        this.lastPrinceCatWalkStopMeowKey = null;
        this.lastPrinceCatPettingEffectKey = null;
        // 獨樂雞 Phaser overlay 狀態初始化
        this.soloChickenMenuOpen = false;
        this.soloChickenMenuContainer = null;
        this.soloChickenMenuTimer = null;
        this.soloChickenMenuTweens = null;
        this.soloChickenMenuRipples = null;
        this.soloChickenMenuRippleCount = 0;
        this.soloChickenMenuBlocker = null;

        // 階段2：獨樂雞火箭巡航最小副本狀態初始化
        this.soloRocketCruiseActive = false;
        this.soloRocketCruiseFinished = false;
        this.soloRocketPaymentPending = false;
        this.soloRocketContainer = null;
        this.soloRocketUiContainer = null;
        this.soloRocketResultContainer = null;
        this.soloRocketPlayer = null;
        this.soloRocketBg = null;
        this.soloRocketStars = [];
        this.soloRocketTimer = null;
        this.soloRocketCountdownText = null;
        this.soloRocketLifeText = null;
        this.soloRocketLifeUi = null;
        this.soloRocketLifeValue = 100;
        this.soloRocketLifeBreathTween = null;
        this.soloRocketLifePulseTween = null;
        this.soloRocketLifeFloatTween = null;
        this.soloRocketLifeHealFxObjects = [];
        this.soloRocketThrusterFx = null;
        this.soloRocketStartTime = 0;
        this.soloRocketDurationMs = 157000;
        this.soloRocketReturnPosition = null;
        this.soloRocketPrevUiState = null;
        this.soloRocketBgm = null;
        this.soloRocketSafeRect = null;
        this.soloRocketWasd = null;
        this.soloRocketDomUiIds = ['chat-section', 'online-players-container', 'top-notification-bar', 'action-menu', 'quick-select-menu', 'prince-cat-menu', 'magic-menu-blocker', 'party-minimized-list'];

        // 階段3：教學介面、開場演出、結尾演出與輸入鎖定狀態
        this.soloRocketGameplayStarted = false;
        this.soloRocketTutorialActive = false;
        this.soloRocketIntroActive = false;
        this.soloRocketEndingActive = false;
        this.soloRocketInputLocked = false;
        this.soloRocketTutorialContainer = null;
        this.soloRocketMoonRabbitContainer = null;
        this.soloRocketWhiteFade = null;
        this.soloRocketIntroTweens = [];
        this.soloRocketIntroTimers = [];
        this.soloRocketIntroFxObjects = [];
        this.soloRocketIntroShakeTween = null;
        this.soloRocketEndingRushStarted = false;
        this.soloRocketEndingFadeStarted = false;

        // 階段4：小怪獸、光束、發射冷卻與本場計分暫存狀態
        this.soloRocketMonsters = [];
        this.soloRocketBeams = [];
        this.soloRocketMonsterBullets = [];
        this.soloRocketMonsterSpawnTimer = null;
        this.soloRocketMonsterStartTimer = null;
        this.soloRocketMonsterStopTimer = null;
        this.soloRocketMonsterSpawnActive = false;
        this.soloRocketMonsterSpawnStopped = false;
        this.soloRocketMonsterSpawnedCount = 0;
        this.soloRocketMaxMonsters = 120;
        this.soloRocketLastFireAt = 0;
        this.soloRocketLastSpinAt = 0;
        this.soloRocketFireCooldownMs = 320;
        this.soloRocketSpinCooldownMs = 3000;
        this.soloRocketStage4FxObjects = [];
        this.soloRocketStage4ClearedForEnding = false;

        // 階段6：魔王、追蹤導彈、玉兔通訊與終場閉環狀態
        this.soloRocketBoss = null;
        this.soloRocketBossHpBar = null;
        this.soloRocketBossHpFill = null;
        this.soloRocketBossHpText = null;
        this.soloRocketBossFloatTween = null;
        this.soloRocketBossHp = 160;
        this.soloRocketBossMaxHp = 160;
        this.soloRocketBossSpawned = false;
        this.soloRocketBossKilled = false;
        this.soloRocketBossPunished = false;
        this.soloRocketBossEntering = false;
        this.soloRocketBossMissiles = [];
        this.soloRocketBossMissileTimer = null;
        this.soloRocketBossLastMissileAt = 0;
        this.soloRocketBossMissileIntervalMs = 5000;
        this.soloRocketBossWarning1Shown = false;
        this.soloRocketBossWarning1Closed = false;
        this.soloRocketBossWarning2Shown = false;
        this.soloRocketBossWarning2Closed = false;
        this.soloRocketRabbitComms = null;
        this.soloRocketRabbitTypingTimer = null;
        this.soloRocketRabbitTypingIndex = 0;
        this.soloRocketFinalEscapeStarted = false;
        this.soloRocketBigAttackCharge = 0;
        this.soloRocketBigAttackReady = false;
        this.soloRocketBigAttackButtonState = null;
        this.soloRocketBigAttackGlow = null;
        this.soloRocketBigAttackGlowTween = null;
        this.soloRocketBigAttackObjects = [];
        this.soloRocketBigAttackReadyNotified = false;

        // 階段5：隕石、旋轉防禦與冷卻 UI
        this.soloRocketAsteroids = [];
        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidSpawnStopped = false;
        this.soloRocketAsteroidNextSpawnAt = 0;
        this.soloRocketAsteroidExtraBudget = 0;
        this.soloRocketAsteroidExtraNextAt = 0;
        this.soloRocketSpinActive = false;
        this.soloRocketSpinShield = null;
        this.soloRocketSpinShieldTween = null;
        this.soloRocketSpinButtonState = null;
        this.soloRocketSpinCooldownFill = null;
        this.soloRocketSpinCooldownText = null;
        this.soloRocketSpinCooldownMaskShape = null;
        this.soloRocketSpinCooldownMaxHeight = 0;
        this.soloRocketSpinCooldownBaseY = 0;
        this.soloRocketStats = {
            monsterKills: 0,
            monsterHits: 0,
            asteroidsDodged: 0,
            spinDodges: 0,
            bossKilled: false,
            bossPunished: false
        };

        window.GameLogic.soloRocketCruiseActive = false;
        
        // 修正：徹底重構音樂切換邏輯，神龕擁有絕對獨立的背景音樂，不再與儀式狀態綁定
        let allBgms = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'];
        let shrineBgms = ['shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success'];
        
        let volControl = document.getElementById('bgm-volume');
        let vol = volControl ? volControl.value / 100 : 0.5;
        this.currentRitualState = null;

        if (this.sceneName === 'shrine') {
            allBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });
            if (this.sound.getAll('bgm-party')) this.sound.getAll('bgm-party').forEach(s => s.stop());
            
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
        } else if (this.sceneName === 'partyroom') {
            allBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });
            shrineBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });
            
            let currentSnd = this.sound.get('bgm-party');
            if (!currentSnd || !currentSnd.isPlaying) {
                this.sound.removeByKey('bgm-party');
                this.sound.add('bgm-party', { loop: true, volume: vol }).play();
            }
        } else {
            shrineBgms.forEach(k => { if (this.sound.getAll(k)) this.sound.getAll(k).forEach(s => s.stop()); this.sound.removeByKey(k); });
            if (this.sound.getAll('bgm-party')) this.sound.getAll('bgm-party').forEach(s => s.stop());

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

        const mapW = this.isCafe ? 2048 : (this.sceneName === 'partyroom' ? 1920 : 1280); 
        const mapH = this.isCafe ? 2048 : (this.sceneName === 'partyroom' ? 1080 : 720);
        this.physics.world.setBounds(0, 0, mapW, mapH);
        
        // 修正：動態計算鏡頭邊界。當螢幕解析度大於地圖尺寸時，自動推算偏移量讓地圖完美置中，解決電腦版靠左上的裁切感
        this.updateCameraBounds = (gameSize) => {
            let vw = gameSize ? gameSize.width : this.scale.gameSize.width;
            let vh = gameSize ? gameSize.height : this.scale.gameSize.height;
            let bw = Math.max(mapW, vw);
            let bh = Math.max(mapH, vh);
            this.cameras.main.setBounds((mapW - bw) / 2, (mapH - bh) / 2, bw, bh);
        };
        this.updateCameraBounds();
        this.scale.on('resize', this.updateCameraBounds, this);
        
        this.trashes = [];
        
        if (this.isCafe) {
            this.leaderboardListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`weeklySweeps/${window.getWeekId(0)}`)), (snap) => {
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
            this.trashListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('cafeTrashes')), (snap) => { let data = snap.val() || {}; for (let key in data) { if (!this.trashes.find(t => t.key === key)) { let tData = data[key]; let isOld = tData.type === 'old'; let spriteKey = isOld ? 'onion-skin-old' : 'onion-skin'; let animKey = isOld ? 'skin-old-anim' : 'skin-anim'; let skin = this.physics.add.sprite(tData.x, tData.y, spriteKey).setDepth(4); skin.play(animKey); skin.type = isOld ? 'onion-skin-old' : 'onion-skin'; skin.key = key; this.trashes.push(skin); } } this.trashes = this.trashes.filter(t => { if (!data[t.key]) { t.destroy(); if (this.closestTrash === t) { 
    this.closestTrash = null; 

    if (this.localPlayer && this.localPlayer.isSweeping) { 
        this.localPlayer.isSweeping = false; 
        window.GameLogic.moonBunSweepPressCount = 0;
        this.qteContainer.setVisible(false); 
        if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1'); 

        if (this.isCafe && window.GameLogic.currentUser) {
            update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), {
                isSweeping: false,
                x: this.localPlayer.sprite.x,
                y: this.localPlayer.sprite.y
            });
        }
    } 
} return false; } return true; }); });
       } else if (this.sceneName === "doghouse") {
            this.add.image(mapW/2, mapH/2, 'bgDoghouse').setDisplaySize(mapW, mapH); 
            this.doghouseFurnListener = onValue(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}/doghouseFurniture`), (snap) => { 
                window.GameLogic.doghouseFurniture = snap.val() || {}; 
            });
        } else if (this.sceneName === "farm") {
            this.add.image(mapW/2, mapH/2, 'bgFarm').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "shrine") {
            this.add.image(mapW/2, mapH/2, 'bgShrine').setDisplaySize(mapW, mapH); this.shrineFurnListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('shrineFurniture')), (snap) => { window.GameLogic.shrineFurniture = snap.val() || {}; });
            this.purifyBarBg = this.add.graphics().setDepth(200).setVisible(false); this.purifyBar = this.add.graphics().setDepth(201).setVisible(false);
            this.countdownText = this.add.text(mapW/2, mapH/2, '', { fontSize: '72px', fontStyle: 'bold', color: '#fff', stroke: '#8a2be2', strokeThickness: 8 }).setOrigin(0.5).setDepth(300).setVisible(false);
        } else if (this.sceneName === "7eonion") {
            this.add.image(mapW/2, mapH/2, 'bg7Eonion').setDisplaySize(mapW, mapH); this.storeManager = this.physics.add.staticSprite(mapW/2, mapH/2, 'storeManager').setDepth(5); let imgW = this.storeManager.width; let imgH = this.storeManager.height; this.storeManager.body.setSize(120, 120); this.storeManager.body.setOffset((imgW - 120) / 2, (imgH - 120) / 2); 
            this.smBubbleBg = this.add.graphics().setDepth(6); this.smBubbleText = this.add.text(mapW/2, mapH/2 - 90, '好想離職......', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(7);
            const smPhrases = ["好想離職......", "這裡怎麼還沒倒......", "洋蔥好臭啊......"]; let phraseIdx = 0; const updateSMBubble = () => { this.smBubbleText.setText(smPhrases[phraseIdx]); const bounds = this.smBubbleText.getBounds(); const boxWidth = bounds.width + 16, boxHeight = bounds.height + 12; const boxX = this.smBubbleText.x - boxWidth / 2, boxY = this.smBubbleText.y - boxHeight / 2; this.smBubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8).strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8); phraseIdx = (phraseIdx + 1) % smPhrases.length; }; updateSMBubble(); this.time.addEvent({ delay: 4000, callback: updateSMBubble, callbackScope: this, loop: true });
        } else if (this.sceneName === "playroom") {
            this.add.image(mapW/2, mapH/2, 'bgPlayroom').setDisplaySize(mapW, mapH);
            this.rpsMachine = this.physics.add.staticSprite(mapW/2, mapH/2, 'rps-machine').setDepth(5);
        } else if (this.sceneName === "partyroom") {
            this.add.image(mapW/2, mapH/2, 'bgPartyroom').setDisplaySize(mapW, mapH);
            this.partyStonesGroup = this.physics.add.staticGroup();
            this.partyStonesListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/stones`)), snap => {
                let stones = snap.val();
                if (stones) {
                    this.partyStonesGroup.clear(true, true);
                    stones.forEach(st => {
                        let stone = this.partyStonesGroup.create(st.x, st.y, 'party-stone').setDepth(5);
                        stone.body.setCircle(37); // Ensure accurate collision for 75x75 obstacle
                    });
                }
            });
            let rFlash = document.getElementById('party-red-flash');
            if (rFlash) rFlash.style.display = 'block';
            this.partyAnnounceText = this.add.text(mapW/2, mapH/2, '', {fontSize:'100px', fontStyle:'bold', color:'#fff', stroke:'#f00', strokeThickness:10}).setOrigin(0.5).setDepth(1000).setScrollFactor(0).setVisible(false);
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
        
                if (this.isCafe || this.sceneName === "shrine") { 
            this.coinsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('droppedCoins')), (snap) => { 
                let data = snap.val() || {}; 
                for (let key in data) { 
                    let cData = data[key] || {};
                    let coinScene = cData.scene || (key.startsWith('shrine_coin_') ? 'shrine' : 'cafe');
                    if (coinScene !== this.sceneName) continue;
                    
                    if (!this.coinSprites[key]) { 
                        let coinSprite = this.physics.add.sprite(cData.x, cData.y - 24, 'made-coin').setDepth(8).setAlpha(0.75); 
                        coinSprite.play('coin-anim', true); 
                        coinSprite.amount = cData.amount || 5; 
                        this.coinSprites[key] = coinSprite; 
                        this.tweens.add({ targets: coinSprite, y: cData.y, alpha: 1, duration: 450, ease: 'Bounce.easeOut' });
                    } 
                } 
                for (let key in this.coinSprites) {
                    let cData = data[key] || {};
                    let coinScene = cData.scene || (key.startsWith('shrine_coin_') ? 'shrine' : 'cafe');
                    if (!data[key] || coinScene !== this.sceneName) {
                        this.coinSprites[key].destroy();
                        delete this.coinSprites[key];
                    }
                } 
            });
            this.dummiesListener = onValue(ref(window.GameLogic.db, 'cafeDummies'), (snap) => { let data = snap.val() || {}; for (let key in data) { if (!this.dummySprites[key]) { let dData = data[key]; let dummySprite = this.physics.add.sprite(dData.x, dData.y, 'dummy').setDepth(8); this.dummySprites[key] = dummySprite; } } for (let key in this.dummySprites) { if (!data[key]) { this.dummySprites[key].destroy(); delete this.dummySprites[key]; } } });
          this.mimiListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), (snap) => {
                let data = snap.val();
                window.GameLogic.cafeMimiData = data;

                if (data && data.active) {
                    if (this.soloRocketCruiseActive || window.GameLogic.soloRocketCruiseActive) {
                        this.stopMimiWalkSFX(false);
                        if (this.mimiSprite) {
                            try { this.mimiSprite.destroy(); } catch (_) {}
                            try { if (this.mimiNameText) this.mimiNameText.destroy(); } catch (_) {}
                            try { if (this.mimiNameBg) this.mimiNameBg.destroy(); } catch (_) {}
                            try { if (this.mimiHpText) this.mimiHpText.destroy(); } catch (_) {}
                            this.mimiSprite = null;
                            this.mimiNameText = null;
                            this.mimiNameBg = null;
                            this.mimiHpText = null;
                        }
                        return;
                    }

                    if (this.sceneName !== 'cafe') {
                        this.stopMimiWalkSFX(false);
                        return;
                    }
                    if (!this.localPlayer || !this.localPlayer.sprite) {
                        this.stopMimiWalkSFX(false);
                        return;
                    }

                    if (!this.mimiSprite) {
                        this.mimiSprite = this.physics.add.sprite(data.x, data.y, 'mimi-thief-walk').setDepth(11);
                        this.mimiNameBg = this.add.graphics().setDepth(12);
                        this.mimiNameText = this.add.text(0, 0, '鼠偷米米', { fontSize: '12px', color: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
                        this.mimiHpText = this.add.text(0, 0, '', { fontSize: '14px', color: '#ff0000', fontStyle: 'bold', stroke: '#fff', strokeThickness: 2 }).setOrigin(0.5).setDepth(12);
                        window.playSFX(this, 'mimi-laugh');
                    }

                    if (data.state !== 'down') {
                        this.startMimiWalkSFX();
                    } else {
                        this.stopMimiWalkSFX(false);
                    }

                    if (!this.localPlayer.isThrowing) {
                        if (Math.abs(this.mimiSprite.x - data.x) > 50 || Math.abs(this.mimiSprite.y - data.y) > 50) {
                            this.mimiSprite.x = data.x;
                            this.mimiSprite.y = data.y;
                        } else {
                            this.mimiSprite.x = Phaser.Math.Linear(this.mimiSprite.x, data.x, 0.3);
                            this.mimiSprite.y = Phaser.Math.Linear(this.mimiSprite.y, data.y, 0.3);
                        }
                    }

                    this.mimiSprite.setFlipX(data.flipX);

                    if (data.state === 'stealing' && data.stealingFrom === window.GameLogic.currentUser.uid && !this.localPlayer.isMimiRobbed) {
                        this.localPlayer.isMimiRobbed = true; this.localPlayer.isStunned = true; this.localPlayer.isInvincible = true; this.localPlayer.sprite.play('fw-hit', true);
                        
                        window.playSFX(this, 'mimi-thief-stealing');
                        window.playSFX(this, 'mimi-jab-onion-hurt');

                        let p = window.GameLogic.myProfile; let amt = Math.min(Phaser.Math.Between(20, 100), p.coins || 0); p.coins -= amt;
                        let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins;
                        
                        let updates = {};
                        updates[`users/${window.GameLogic.currentUser.uid}/coins`] = p.coins;
                        updates[window.getServerRoomPath('cafeMimi/stolenPool')] = (data.stolenPool || 0) + amt;
                        updates[window.getServerRoomPath(`cafeMimi/stolenUids/${window.GameLogic.currentUser.uid}`)] = true;
                        update(ref(window.GameLogic.db), updates);
                        
                        sendBubble(`被老鼠偷走了 ${amt} 元！`); 
                        this.time.delayedCall(2000, () => { this.localPlayer.isInvincible = false; });
                        this.time.delayedCall(3000, () => { this.localPlayer.isStunned = false; });
                    }

                    if (data.state !== 'stealing' && this.localPlayer.isMimiRobbed) this.localPlayer.isMimiRobbed = false;

                    if (data.state === 'laughing' && !this.mimiLaughed) { this.mimiLaughed = true; window.playSFX(this, 'mimi-laugh'); }
                    if (data.state !== 'laughing') this.mimiLaughed = false;
                    
                    if (data.state !== 'down' && this.mimiSprite.isBlinking) {
                        this.mimiSprite.isBlinking = false;
                        this.mimiLastDownAnimToken = null;
                        this.tweens.killTweensOf(this.mimiSprite);
                        this.mimiSprite.setAlpha(1);
                    }

                    if (data.state === 'stealing') this.mimiSprite.play('mimi-steal', true);
                    else if (data.state === 'laughing') this.mimiSprite.play('mimi-laugh', true);
                    else if (data.state === 'down') { 
                        let downToken = data.downTime || data.time || 0;

                        if (this.mimiLastDownAnimToken !== downToken) {
                            this.mimiLastDownAnimToken = downToken;
                            this.tweens.killTweensOf(this.mimiSprite);
                            this.mimiSprite.isBlinking = false;
                            this.mimiSprite.setAlpha(1);
                            this.mimiSprite.play('mimi-down', true);
                        }

                        if (!this.mimiSprite.isBlinking) {
                            this.mimiSprite.isBlinking = true;
                            this.tweens.add({
                                targets: this.mimiSprite,
                                alpha: 0.2,
                                yoyo: true,
                                repeat: -1,
                                duration: 150
                            });
                        }
                        this.stopMimiWalkSFX(false);
                    }
                    else this.mimiSprite.play('mimi-walk', true);
                    let nmY = this.mimiSprite.y - 40;
                    this.mimiNameText.setPosition(this.mimiSprite.x, nmY);
                    this.mimiNameBg.clear().fillStyle(0x000, 0.6).fillRoundedRect(this.mimiSprite.x - 30, nmY - 10, 60, 20, 4);
                    this.mimiHpText.setPosition(this.mimiSprite.x, nmY - 20).setText(data.hp > 0 ? `HP: ${data.hp}` : '');
                } else {
                    if (this.mimiSprite) { 
                        this.mimiSprite.destroy();
                        this.mimiNameText.destroy();
                        this.mimiNameBg.destroy();
                        this.mimiHpText.destroy();
                        this.mimiSprite = null; 
                        this.stopMimiWalkSFX(false);
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
        if (this.sceneName === "partyroom" && this.partyStonesGroup) this.physics.add.collider(this.localPlayer.sprite, this.partyStonesGroup);
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        // 修正：重置文字緩存變數，避免 Phaser 重新啟動場景時因為變數殘留，導致判定相同而不更新 UI，進而使法寶提示字消失
        this.lastPromptMsg = null; this.lastPromptDrawX = null; this.lastPromptDrawY = null; this.lastPromptDrawMsg = null;
        this.lastWaterPromptMsg = null; this.lastWaterDrawX = null; this.lastWaterDrawY = null; this.lastWaterDrawMsg = null;

        this.smartPromptBg = this.add.graphics().setDepth(100).setVisible(false); this.smartPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#4a5d4e' }).setOrigin(0.5).setDepth(101).setVisible(false);
        this.waterPromptBg = this.add.graphics().setDepth(100).setVisible(false); this.waterPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(101).setVisible(false);
        this.lockOnTarget = this.add.text(0, 0, '🎯', { fontSize: '28px' }).setOrigin(0.5).setDepth(150).setVisible(false); this.tweens.add({ targets: this.lockOnTarget, scaleX: 1.2, scaleY: 1.2, yoyo: true, repeat: -1, duration: 400 });
        if (this.minimap) this.minimap.ignore([this.smartPromptBg, this.smartPromptText, this.waterPromptBg, this.waterPromptText, this.lockOnTarget]);
        this.initPrinceCatSync();

        this.cursors = this.input.keyboard.createCursorKeys(); this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT); this.altKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT); this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey.on('down', (e) => {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            // 火箭巡航中，Space 不再走大廳 A 鍵流程，改為直接發射光束。
            if (this.soloRocketCruiseActive && !this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                if (!e.repeat && this.fireSoloRocketBeam) this.fireSoloRocketBeam();
                return;
            }

            if (!e.repeat) this.spacePressTime = Date.now();
        });

        this.spaceKey.on('up', (e) => {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            // 火箭巡航中避免 Space keyup 觸發原本 A 鍵短按/長按事件。
            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                return;
            }

            let duration = Date.now() - this.spacePressTime;
            if (window.GameLogic.placingFurnitureKey) this.events.emit('action_A_place');
            else if (duration > 500) this.events.emit('action_A_long');
            else this.events.emit('action_A_short');
        });
        
        this.altKey.on('down', (e) => {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            // 火箭巡航中，Alt / Option 專用於旋轉防禦；Shift 不再觸發火箭旋轉。
            if (this.soloRocketCruiseActive && !this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                if (!e.repeat && this.spinSoloRocketPlayer) this.spinSoloRocketPlayer();
            }
        });

        this.altKey.on('up', (e) => {
            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
            }
        });

        this.enterKey.on('down', (e) => {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            // 火箭巡航中，Enter 專用於放大絕，不污染大廳或其他小遊戲。
            if (this.soloRocketCruiseActive && !this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                if (!e.repeat && this.castSoloRocketBigAttack) this.castSoloRocketBigAttack();
            }
        });

        this.shiftKey.on('down', (e) => { 
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                return;
            }

            if (!e.repeat) {
                this.shiftLongPressTriggered = false;
                this.shiftLongPressTimer = this.time.delayedCall(300, () => {
                    this.shiftLongPressTriggered = true;
                    this.events.emit('action_B_long');
                });
            }
        });
        this.shiftKey.on('up', (e) => {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) {
                if (e && e.preventDefault) e.preventDefault();
                return;
            }

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

        this.events.on('action_A_place', () => { let key = window.GameLogic.placingFurnitureKey; if(key && this.furnitureSprites[key]) { let f = this.furnitureSprites[key]; f.sprite.setVelocity(0, 0); let path = this.isCafe ? window.getServerRoomPath(`cafeFurniture/${key}`) : (this.sceneName === 'doghouse' ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${key}` : window.getServerRoomPath(`shrineFurniture/${key}`)); update(ref(window.GameLogic.db, path), { locked: true, x: f.sprite.x, y: f.sprite.y, ownerUid: window.GameLogic.currentUser.uid }); window.GameLogic.placingFurnitureKey = null; this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08); } });

this.events.on('action_A_short', () => {
    if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

    // 獨樂雞 Phaser 選單開啟時，A 鍵改為關閉選單，避免玩家以為畫面卡死
    if (this.soloChickenMenuOpen || this.soloChickenMenuContainer) {
        this.closeSoloChickenMenu();
        return;
    }
            // 修正：檢查是否手持派對喇叭，若是，觸發喇叭廣播流程
    if (window.GameLogic.armedItemState === 'ready' && window.GameLogic.armedItemName === '派對喇叭') {
        document.getElementById('party-select-modal').style.display = 'block';
        return;
    }
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
                let isPartyMode = this.sceneName === 'partyroom' && itemName === '水球';
                
                if (itemName === '喵罐頭') {
                this.startPrinceCatFeeding();
                   return;
                }
                
                if (itemName === '派對喇叭') {
                    // 全服廣播喇叭播放，修正移除無效的 import 確保能正常觸發
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/trumpetPlay/${window.GameLogic.currentUser.uid}`)), { time: Date.now(), scene: this.sceneName });
                    return;
                }

                if (itemName === '月光法杖' || itemName === '月光饅頭') {
                    const beforeQty = Number(inv[itemName] || 0);
                    if (itemName === '月光法杖') window.useMoonStaff();
                    else window.useMoonBun();

                    const latestInv = window.GameLogic.myProfile.inventory || {};
                    const afterQty = Number(latestInv[itemName] || 0);
                    if (afterQty > 0 || (afterQty === beforeQty && beforeQty > 0)) {
                        window.GameLogic.armedItemState = 'ready';
                        window.GameLogic.armedItemName = itemName;
                    } else {
                        window.GameLogic.armedItemState = null;
                        window.GameLogic.armedItemName = null;
                    }
                    return;
                }

                if (window.GameLogic.energyActive && !isPartyMode) {
                    let currentEnergy = window.GameLogic.myProfile.energy || 0;
                    if (currentEnergy >= 5) {
                        window.GameLogic.myProfile.energy = currentEnergy - 5;
                        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { energy: window.GameLogic.myProfile.energy }).catch(err => console.warn('Firebase 施放法寶扣除體力失敗:', err));
                    } else {
                        sendBubble("體力不足以遠距施放，鎖定解除！");
                        window.GameLogic.energyActive = false;
                    }
                }

                let targetUid = window.GameLogic.currentTargetUid;
                let targetSprite = window.GameLogic.currentTargetSprite;
                let targetType = window.GameLogic.currentTargetType;

                if (isPartyMode) {
                    let partyThrowNow = Date.now();
                    if (this.lastPartyWaterThrowTime && partyThrowNow - this.lastPartyWaterThrowTime < 180) {
                        return;
                    }
                    this.lastPartyWaterThrowTime = partyThrowNow;

                    if (!window.PartyLogic.roomId || window.PartyLogic.state !== 'gaming') {
                        sendBubble("派對還沒開始，先不要丟水球！");
                        return;
                    }
                    if (targetUid && !(window.PartyLogic.players || {})[targetUid]) {
                        sendBubble("目標已離開派對，鎖定解除！");
                        window.GameLogic.currentTargetUid = null;
                        window.GameLogic.currentTargetSprite = null;
                        window.GameLogic.currentTargetType = null;
                        return;
                    }
                }

                if (!isPartyMode) inv[itemName] = Math.max(0, (inv[itemName] || 0) - 1);
                if (!isPartyMode) update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv }).catch(err => console.warn('Firebase 施放法寶扣除庫存失敗:', err));
                
                if (isPartyMode) {
                    if (window.PartyLogic.ammo > 0) { window.GameLogic.armedItemState = 'ready'; window.PartyLogic.ammo--; } 
                    else { window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null; sendBubble("水球已耗盡！"); return; }
                } else {
                    if (inv[itemName] > 0) { window.GameLogic.armedItemState = 'ready'; } else { window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null; sendBubble("法寶已耗盡！"); }
                }
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
                    this.localPlayer.isStunned = false; // 解除受傷硬直，強制完成反擊動作
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    
                    // 新增11：向全服發送投擲動畫訊號 (修正 targetUid 為空會報錯的問題)
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/planeThrows/${window.GameLogic.currentUser.uid}`)), { time: Date.now(), targetUid: targetUid || 'none', scene: this.sceneName });
                    
                    if (targetUid && targetSprite) {
                        let plane = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'plane').setDepth(15);
                        this.tweens.add({
                            targets: plane, x: targetSprite.x, y: targetSprite.y, duration: 400, onComplete: () => {
                                plane.destroy();
                                if (targetType === 'player') {
                                    window.GameLogic.activeInvite = true;
                                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/planeHits/${targetUid}`)), { time: Date.now(), attacker: window.GameLogic.currentUser.uid, attackerName: window.GameLogic.myProfile.name });
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
                    this.localPlayer.isStunned = false; // 解除受傷硬直，強制完成反擊動作
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/fireworkThrows/${window.GameLogic.currentUser.uid}`)), { time: Date.now(), targetUid: targetUid || 'none', scene: this.sceneName });
                    
                    if (targetUid && targetSprite) {
                        let fw = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'fireworks-shoot').setDepth(15);
                        fw.play('fw-shoot', true);
                        this.tweens.add({
                            targets: fw, x: targetSprite.x, y: targetSprite.y, duration: 300, onComplete: () => {
                                fw.destroy();
                                this.createMiniExplosion(targetSprite.x, targetSprite.y);
                                if (targetType === 'player') {
                                update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/fireworksHits/${targetUid}`)), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                            } else if (targetType === 'dummy') {
                                update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/fireworksDummyHits/${targetUid}`)), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                for (let i = 0; i < 3; i++) {
                                    let cx = targetSprite.x + Phaser.Math.Between(-40, 40); let cy = targetSprite.y + Phaser.Math.Between(-40, 40) + 20;
                                    push(ref(db, window.getServerRoomPath('droppedCoins')), { x: cx, y: cy, amount: 15, scene: this.sceneName });
                                }
                            } else if (targetType === 'mimi') {
                                this.handleMimiHit(targetSprite.x, targetSprite.y);
                            }
                            }
                        });
                    } else {
                        update(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/globalFireworks')), { time: Date.now(), scene: this.sceneName, initiator: window.GameLogic.currentUser.uid });
                        sendBubble("施放了全頻煙火！");
                    }
                } else {
                    // 水球邏輯
                    window.playSFX(this, 'minimum_laser');
                    this.localPlayer.sprite.play('throw', true);
                    this.localPlayer.isThrowing = true;
                    this.localPlayer.isStunned = false; // 解除受傷硬直，強制完成反擊動作
                    this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });
                    const waterActionTime = Date.now();

                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterThrows/${window.GameLogic.currentUser.uid}`)), {
                        time: waterActionTime,
                        targetUid: targetUid || 'none',
                        scene: this.sceneName
                    });

                    if (this.sceneName === 'partyroom' && window.PartyLogic && window.PartyLogic.roomId) {
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${window.GameLogic.currentUser.uid}`)), {
                            action: 'throwWater',
                            actionTime: waterActionTime,
                            targetUid: targetUid || 'none'
                        });
                    } else if (this.sceneName === 'cafe') {
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), {
                            action: 'throwWater',
                            actionTime: waterActionTime,
                            targetUid: targetUid || 'none'
                        });
                    }
                    
                    if (targetUid && targetSprite) {
                        let wb = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'water-ball-blast').setDepth(15);
                        wb.play('wb-blast', true); // 飛行中立刻播放水球動畫
                        
                        let hitStone = false;
                        this.tweens.add({
                            targets: wb, x: targetSprite.x, y: targetSprite.y, duration: 300,
                            onUpdate: () => {
                                if (this.sceneName === 'partyroom' && !hitStone && wb.active) {
                                    this.physics.overlap(wb, this.partyStonesGroup, () => {
                                        hitStone = true;
                                        this.tweens.killTweensOf(wb);
                                        wb.destroy();
                                    });
                                }
                            },
                            onComplete: () => {
                                if (hitStone || !wb.active) return;
                                window.playSFX(this, 'powerdown07');
                                this.time.delayedCall(150, () => { if (wb && wb.active) wb.destroy(); });
                                if (targetType === 'player') {
                                    if (this.sceneName === 'partyroom') {
                                        const hitActionTime = Date.now();

                                        update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/hits/${targetUid}`)), {
                                            time: hitActionTime,
                                            attacker: window.GameLogic.currentUser.uid
                                        });

                                        update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${targetUid}`)), {
                                            action: 'hitWater',
                                            actionTime: hitActionTime,
                                            targetUid: window.GameLogic.currentUser.uid
                                        });
                                    } else {
                                        update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterHits/${targetUid}`)), {
                                            time: Date.now(),
                                            attacker: window.GameLogic.currentUser.uid,
                                            scene: this.sceneName
                                        });
                                    }
                                } else if (targetType === 'dummy') {
                                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/dummyHits/${targetUid}`)), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                    for (let i = 0; i < 3; i++) {
                                        let cx = targetSprite.x + Phaser.Math.Between(-40, 40); let cy = targetSprite.y + Phaser.Math.Between(-40, 40) + 20;
                                        push(ref(db, window.getServerRoomPath('droppedCoins')), { x: cx, y: cy, amount: 5, scene: this.sceneName });
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

            if (this.localPlayer.isSweeping) {
                let vol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 100) / 100;
                const broomingSound = this.sound.get('brooming1');

                if (!window.GameLogic.muteSFX && (!broomingSound || !broomingSound.isPlaying) && vol > 0) {
                    if (broomingSound) this.sound.play('brooming1', { volume: vol });
                    else this.sound.add('brooming1', { volume: vol }).play();
                }

                const moonBunActive = this.isCafe && this.isMoonBunBuffActive && this.isMoonBunBuffActive();
                if (moonBunActive) {
                    window.GameLogic.moonBunSweepPressCount = Math.min(2, Number(window.GameLogic.moonBunSweepPressCount || 0) + 1);
                    this.qteTotalClicks = 2;
                    this.qteProgress = Math.min(100, window.GameLogic.moonBunSweepPressCount * 50);
                    this.updateQTEBar(this.qteProgress);
                    if (this.showMoonBunSweepBoostFx) this.showMoonBunSweepBoostFx(this.closestTrash, window.GameLogic.moonBunSweepPressCount);

                    if (window.GameLogic.moonBunSweepPressCount >= 2) {
                        this.qteProgress = 100;
                        this.updateQTEBar(this.qteProgress);
                        window.GameLogic.moonBunSweepPressCount = 0;
                        this.finishSweeping(true);
                    }
                    return;
                }

                this.qteProgress += (100 / this.qteTotalClicks);
                if (this.qteProgress >= 100) {
                    this.qteProgress = 100;
                    this.finishSweeping(true);
                }
                return;
            }
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
            if (this.isCafe && this.princeCatSprite) {
                let catDist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, this.princeCatSprite.x, this.princeCatSprite.y);
                if (catDist < 170) {
                    this.openPrinceCatMenu();
                    return;
                }
            }
            if (!this.isCafe) return sendBubble("對著空氣揮舞了雙手!");

            let interacted = false;

            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                if (!f.sprite.isLocked) continue;

                let dist = Phaser.Math.Distance.Between(
                    this.localPlayer.sprite.x,
                    this.localPlayer.sprite.y,
                    f.sprite.x,
                    f.sprite.y
                );

                if (dist < 120) {
                    if (key.includes('solochicken')) {
                        this.openSoloChickenMenu();
                        interacted = true;
                        break;
                    }

                    if (key.includes('giftbox')) {
                        window.GameLogic.activeGiftBox = f;
                        f.sprite.setTexture('gift-box-open');
                        window.playSFX(this, 'reward-open-box');

                        if (!f.glow) {
                            f.glow = this.add.pointlight(f.sprite.x, f.sprite.y, 0xffd700, 180, 0.6).setDepth(4);
                            this.tweens.add({
                                targets: f.glow,
                                radius: 220,
                                yoyo: true,
                                repeat: -1,
                                duration: 800
                            });
                        }

                        f.glow.setVisible(true);
                        window.openRewardModal(f);
                        interacted = true;
                        break;
                    }

                    if (key === 'fridge') {
                        document.getElementById('fridge-modal').style.display = 'block';
                        interacted = true;
                        break;
                    }

                    if (key.startsWith('memory')) {
                        document.getElementById('memory-modal').style.display = 'block';
                        interacted = true;
                        break;
                    }

                    if (key.includes('scoreboard')) {
                        window.openLeaderboardModal();
                        interacted = true;
                        break;
                    }

                    if (key === 'shrine') {
                        window.attemptJoinShrine();
                        interacted = true;
                        break;
                    }
                }
            }

            if (!interacted) sendBubble("使用了 A 技能!");
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
                    window.GameLogic.armedItemState = 'ready'; // 直接裝填為待施放狀態，按 A 才真正施放／消耗
                    window.GameLogic.armedItemName = name;
                    let msg = `已裝填法寶：${name}`;
                    if (name === '喵罐頭') msg = '已拿出喵罐頭，靠近王子麵按A餵食。';
                    else if (name === '月光法杖') msg = '已裝填月光法杖，按A施放月光祝福。';
                    else if (name === '月光饅頭') msg = '已裝填月光饅頭，按A吃下。';
                    sendBubble(msg);
                } else {
                    sendBubble("法寶庫存不足！");
                    window.GameLogic.armedItemState = null;
                    window.GameLogic.armedItemName = null;
                }
            }
        };

        this.events.off('action_B_long');
this.events.on('action_B_long', () => {
            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

            if (this.soloChickenMenuOpen || this.soloChickenMenuContainer) {
                this.closeSoloChickenMenu();
                return;
            }

            if (this.sceneName === 'partyroom') return; // 禁用長按B
            let menu = document.getElementById('quick-select-menu');
            let blocker = document.getElementById('magic-menu-blocker');
            let uiScene = this.scene.manager.getScene('UIScene');
            let inv = window.GameLogic.myProfile.inventory || {};
            let container = document.getElementById('quick-items-container');
            
            let magics = [
                { name: 'none', icon: '<span style="font-size:24px; pointer-events:none;">❌</span>', qty: '' },
                { name: '水球', icon: '<div class="sprite-waterball" style="transform: scale(0.8); transform-origin: center; pointer-events:none;"></div>', qty: inv['水球'] || 0 },
                { name: '煙火', icon: '<img src="shop-fireworks.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['煙火'] || 0 },
                { name: '蔥友機', icon: '<img src="playroom-onion-friend-plane.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['蔥友機'] || 0 },
                { name: '派對喇叭', icon: '<img src="tools-onion-party-trumpet.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['派對喇叭'] || 0 },
                { name: '喵罐頭', icon: '<img src="shop-pet-cat-can.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['喵罐頭'] || 0 },
                { name: '月光法杖', icon: '<img src="solo-rocket-item-moon-staff.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['月光法杖'] || 0 },
                { name: '月光饅頭', icon: '<img src="solo-rocket-item-moon-bun.png" style="width:40px; height:40px; object-fit:contain; pointer-events:none;">', qty: inv['月光饅頭'] || 0 }
            ];
            
            let html = `<div style="flex: 0 0 calc(50% - 30px);"></div>`;
            magics.forEach((m) => {
                let qtyHtml = m.name !== 'none' ? `<div style="position:absolute; bottom:-5px; right:0px; font-size:13px; font-weight:bold; color:#005599; text-shadow:0 0 4px #fff, 0 0 4px #fff;">x${m.qty}</div>` : '';
                html += `<div class="quick-item" data-magic="${m.name}">
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

// 桌機支援滑鼠滾輪左右捲動
container.onwheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.scrollLeft += (Math.abs(e.deltaX) > Math.abs(e.deltaY)) ? e.deltaX : e.deltaY;
};

// 桌機支援滑鼠按住左右拖曳；單純點擊任一可見法寶時，直接等同按B裝填
if (!container._quickDragClickGuard) {
    container._quickDragClickGuard = (e) => {
        if (container._quickDragMoved || container._quickDirectSelected) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    container.addEventListener('click', container._quickDragClickGuard, true);
}

let quickDragActive = false;
let quickDragStartX = 0;
let quickDragStartScroll = 0;

container.onpointerdown = (e) => {
    if (e.pointerType !== 'mouse') return;
    quickDragActive = true;
    container._quickDragMoved = false;
    container._quickDirectSelected = false;
    quickDragStartX = e.clientX;
    quickDragStartScroll = container.scrollLeft;
    container.classList.add('dragging');
    try { container.setPointerCapture(e.pointerId); } catch (_) {}
    e.stopPropagation();
};

container.onpointermove = (e) => {
    if (!quickDragActive) return;
    let dx = e.clientX - quickDragStartX;
    if (Math.abs(dx) > 5) container._quickDragMoved = true;
    container.scrollLeft = quickDragStartScroll - dx;
    e.preventDefault();
    e.stopPropagation();
};

container.onpointerup = (e) => {
    const wasDragging = container._quickDragMoved;
    const hitEl = document.elementFromPoint(e.clientX, e.clientY);
    const clickedItem = hitEl && hitEl.closest ? hitEl.closest('.quick-item') : null;

    quickDragActive = false;
    container.classList.remove('dragging');
    try { container.releasePointerCapture(e.pointerId); } catch (_) {}

    if (!wasDragging && clickedItem && container.contains(clickedItem)) {
        e.preventDefault();
        e.stopPropagation();
        container._quickDirectSelected = true;
        window.selectQuickMagic(clickedItem.getAttribute('data-magic'));
        container._quickDragMoved = false;
        setTimeout(() => { container._quickDirectSelected = false; }, 0);
        return;
    }

    setTimeout(() => { 
        container._quickDragMoved = false;
        container._quickDirectSelected = false;
    }, 0);
};

container.onpointerleave = () => {
    quickDragActive = false;
    container.classList.remove('dragging');
    setTimeout(() => { 
        container._quickDragMoved = false;
        container._quickDirectSelected = false;
    }, 0);
};

menu.onclick = (e) => {
    if (container._quickDirectSelected) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    const clickedItem = e.target.closest ? e.target.closest('.quick-item') : null;
    if (clickedItem) return;
    e.preventDefault();
    e.stopPropagation();
    window.selectQuickMagic(window.GameLogic.stagedMagicItem || 'none');
};

menu.style.display = 'flex';
if (blocker) blocker.style.display = 'block';

if (uiScene && uiScene.magicMenuEmitter) {
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        uiScene.magicMenuEmitter.setPosition(rect.left + rect.width / 2, rect.top + rect.height / 2);
        uiScene.magicMenuEmitter.start();
    });
}
            
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
            if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

            if (this.soloChickenMenuOpen || this.soloChickenMenuContainer) {
                this.closeSoloChickenMenu();
                return;
            }

            let menu = document.getElementById('quick-select-menu');
            if (menu && menu.style.display === 'flex') {
                window.selectQuickMagic(window.GameLogic.stagedMagicItem || 'none');
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
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`)), { isSeated: false }); 
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
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`)), { isSeated: true, x: closestSeat.sprite.x, y: closestSeat.sprite.y - 15 }); 
                        return; 
                    }
                } 
            }
            
            if (!this.localPlayer.isSweeping && this.closestTrash) { 
    this.localPlayer.isSweeping = true; 
    this.qteProgress = 0; 
    window.GameLogic.moonBunSweepPressCount = 0;
    this.qteTotalClicks = (this.isCafe && this.isMoonBunBuffActive && this.isMoonBunBuffActive()) ? 2 : Phaser.Math.Between(5, 10); 
    this.qteContainer.setVisible(true); 

    if (this.isCafe && window.GameLogic.currentUser) {
        update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), {
            isSweeping: true,
            x: this.localPlayer.sprite.x,
            y: this.localPlayer.sprite.y
        });
    }
} else if (!this.localPlayer.isSweeping) { 
    sendBubble("使用了 B 技能!"); 
}
        });

        this.placePrompt = this.add.text(0, 0, '洋蔥精靈: 按A確定擺放', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} }).setOrigin(0.5).setDepth(20).setVisible(false); if (this.minimap) this.minimap.ignore(this.placePrompt);
      
        this.trumpetListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/trumpetPlay')), (snap) => {
            let events = snap.val() || {};
            for (let uid in events) {
                let data = events[uid];
                if (data && data.time && (Date.now() - data.time < 3000)) {
                    let pEntity = (uid === window.GameLogic.currentUser.uid) ? this.localPlayer : this.otherPlayers[uid];
                    if (pEntity && (!pEntity.lastTrumpetTime || pEntity.lastTrumpetTime !== data.time)) {
                        pEntity.lastTrumpetTime = data.time;
                        window.playSFX(this, 'tools-onion-party-trumpet');
                        pEntity.sprite.play('trumpet-play', true);
                        pEntity.isThrowing = true;
                        if (pEntity.sprite) pEntity.sprite.isThrowing = true; // 修正2：同步設定 sprite 屬性，避免 update 迴圈覆蓋動畫
                        
                        // 播放兩次循環動畫後解除 (約 1500ms)
                        this.time.delayedCall(1500, () => {
                           if (pEntity) pEntity.isThrowing = false;
                           if (pEntity && pEntity.sprite) pEntity.sprite.isThrowing = false;
                        });
                    }
                }
            }
        });
        
        const activePartyRoomId = window.PartyLogic && window.PartyLogic.roomId ? window.PartyLogic.roomId : '';
        this.partyAllHitsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${activePartyRoomId}/hits`)), (snap) => {
            let hits = snap.val() || {};
            this.partySeenHitTimes = this.partySeenHitTimes || {};

            for (let uid in hits) {
                if (uid === window.GameLogic.currentUser.uid) continue;

                let d = hits[uid];
                if (d && d.time && (Date.now() - d.time < 2000)) {
                    if (this.partySeenHitTimes[uid] === d.time) continue;
                    this.partySeenHitTimes[uid] = d.time;

                    if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) {
                        let opSprite = this.otherPlayers[uid].sprite;
                        if (!opSprite.isStunned) {
                            opSprite.isStunned = true;
                            opSprite.play('fw-hit', true);
                            this.time.delayedCall(1000, () => {
                                if (opSprite && opSprite.active) opSprite.isStunned = false;
                            });
                        }
                    }
                }
            }
        });

        this.hitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)), (snap) => {
            let data = snap.val();
            if (data && data.time && (Date.now() - data.time < 2000)) {
                if (data.scene && data.scene !== this.sceneName) {
                    remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)));
                    return;
                }

                if (this.localPlayer.isInvincible) {
                    remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)));
                    return;
                }

                this.localPlayer.isInvincible = true;
                this.localPlayer.isStunned = true;
                this.localPlayer.sprite.play('wet', true);

                let p = window.GameLogic.myProfile;
                let loss = Math.min(p.coins || 0, 15);
                p.coins -= loss;

                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins });
                let coinsEl = document.getElementById("vp-coins");
                if (coinsEl) coinsEl.innerText = p.coins;

                if (loss > 0) {
                    let baseAmount = Math.floor(loss / 3);
                    let amounts = [baseAmount, baseAmount, loss - baseAmount * 2];

                    for (let i = 0; i < amounts.length; i++) {
                        if (amounts[i] <= 0) continue;
                        let angle = (Math.PI * 2 / amounts.length) * i + Phaser.Math.FloatBetween(-0.25, 0.25);
                        let dist = Phaser.Math.Between(85, 135);
                        let cx = Phaser.Math.Clamp(this.localPlayer.sprite.x + Math.cos(angle) * dist, 80, this.physics.world.bounds.width - 80);
                        let cy = Phaser.Math.Clamp(this.localPlayer.sprite.y + Math.sin(angle) * dist + 20, 80, this.physics.world.bounds.height - 80);
                        push(ref(window.GameLogic.db, window.getServerRoomPath('droppedCoins')), { x: cx, y: cy, amount: amounts[i], scene: this.sceneName });
                    }
                }

                this.time.delayedCall(500, () => { this.localPlayer.isStunned = false; });
                this.time.delayedCall(1500, () => { this.localPlayer.isInvincible = false; });
                remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)));
            }
        });
      
      this.partyHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${activePartyRoomId}/hits/${window.GameLogic.currentUser.uid}`)), (snap) => {
            let data = snap.val();
            if (data && data.time && (Date.now() - data.time < 2000)) {
                if (!window.PartyLogic || !window.PartyLogic.roomId) return;

                let hitPath = window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/hits/${window.GameLogic.currentUser.uid}`);

                if (this.lastPartyHitTime === data.time) {
                    remove(ref(window.GameLogic.db, hitPath));
                    return;
                }

                if (this.localPlayer.isInvincible) {
                    remove(ref(window.GameLogic.db, hitPath));
                    return;
                }

                this.lastPartyHitTime = data.time;
                this.localPlayer.isStunned = true;
                this.localPlayer.isInvincible = true;
                this.localPlayer.sprite.play('fw-hit', true);
                
                get(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${window.GameLogic.currentUser.uid}/gotHitCount`))).then(s => {
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${window.GameLogic.currentUser.uid}`)), {
                        gotHitCount: (s.val() || 0) + 1
                    });
                });

                get(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${data.attacker}/hitCount`))).then(s => {
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${data.attacker}`)), {
                        hitCount: (s.val() || 0) + 1
                    });
                });

                remove(ref(window.GameLogic.db, hitPath));
                
                this.time.delayedCall(1000, () => {
                    if (this.localPlayer) this.localPlayer.isStunned = false;
                });

                this.time.delayedCall(1500, () => {
                    if (this.localPlayer) this.localPlayer.isInvincible = false;
                });
            }
      });
        this.fwHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/fireworksHits/${window.GameLogic.currentUser.uid}`)), (snap) => { let data = snap.val(); if (data && data.time && (Date.now() - data.time < 2000)) { if (this.localPlayer.isInvincible) return; window.playSFX(this, 'bomb'); this.localPlayer.isInvincible = true; this.localPlayer.isStunned = true; this.localPlayer.sprite.play('fw-hit', true); let p = window.GameLogic.myProfile; let loss = Math.min(p.coins || 0, 100); p.coins -= loss; update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins }).catch(err => console.warn('Firebase 被擊中扣款失敗:', err)); let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = p.coins; if (loss > 0) { let amounts = [Math.floor(loss * 0.4), Math.floor(loss * 0.3), loss - Math.floor(loss * 0.4) - Math.floor(loss * 0.3)]; for (let i = 0; i < 3; i++) { if(amounts[i] <= 0) continue; let angle = (Math.PI * 2 / 3) * i + Phaser.Math.FloatBetween(-0.25, 0.25); let dist = Phaser.Math.Between(100, 160); let cx = Phaser.Math.Clamp(this.localPlayer.sprite.x + Math.cos(angle) * dist, 80, this.physics.world.bounds.width - 80); let cy = Phaser.Math.Clamp(this.localPlayer.sprite.y + Math.sin(angle) * dist + 20, 80, this.physics.world.bounds.height - 80); push(ref(window.GameLogic.db, window.getServerRoomPath('droppedCoins')), { x: cx, y: cy, amount: amounts[i], scene: this.sceneName }); } } this.time.delayedCall(500, () => { this.localPlayer.isStunned = false; }); this.time.delayedCall(1500, () => { this.localPlayer.isInvincible = false; }); remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/fireworksHits/${window.GameLogic.currentUser.uid}`))); } });
        this.fwPlayersHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/fireworksHits')), (snap) => { let hits = snap.val() || {}; for (let uid in hits) { if (uid === window.GameLogic.currentUser.uid) continue; let data = hits[uid]; if (data && data.time && (Date.now() - data.time < 2000)) { if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { let opSprite = this.otherPlayers[uid].sprite; if (!opSprite.isStunned) { window.playSFX(this, 'bomb'); opSprite.isStunned = true; opSprite.play('fw-hit', true); this.time.delayedCall(1500, () => { if (opSprite && opSprite.active) opSprite.isStunned = false; }); } } } } });
        this.fwDummyHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/fireworksDummyHits')), (snap) => { let hits = snap.val() || {}; for (let key in hits) { let data = hits[key]; if (data && data.time && (Date.now() - data.time < 2000) && this.furnitureSprites[key]) { let dummy = this.furnitureSprites[key].sprite; if (dummy && !dummy.isStunned) { window.playSFX(this, 'bomb'); dummy.isStunned = true; dummy.play('dummy-fw-hit', true); this.time.delayedCall(1500, () => { if (dummy && dummy.active) { dummy.isStunned = false; dummy.anims.stop(); dummy.setTexture('dummy'); } }); } } } });
        this.globalFwListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/globalFireworks')), (snap) => { let data = snap.val(); if (data && data.time && (Date.now() - data.time < 3000) && data.scene === this.sceneName) { if (this.lastGlobalFwTime !== data.time) { this.lastGlobalFwTime = data.time; this.playGlobalFireworks(); } } });

        // 補丁 6-2 後續：月光法杖全域祝福，同一張地圖中的玩家都會播放特效與音效。
                    this.moonStaffBlessingListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/moonStaffBlessings')), (snap) => {
            const events = snap.val() || {};
            this.moonStaffRemoteTimes = this.moonStaffRemoteTimes || {};

            const playRemoteBlessing = (uid, data, retry = 0) => {
                if (!data || !data.time || Date.now() - data.time >= 20000 || data.scene !== this.sceneName) return;
                if (this.moonStaffRemoteTimes[uid] === data.time) return;

                let targetX = Number(data.x || 0);
                let targetY = Number(data.y || 0);
                const op = this.otherPlayers && this.otherPlayers[uid] ? this.otherPlayers[uid] : null;
                if (op && op.sprite && op.sprite.active) {
                    targetX = op.sprite.x;
                    targetY = op.sprite.y;
                } else if ((!targetX || !targetY) && retry < 5) {
                    this.time.delayedCall(120, () => playRemoteBlessing(uid, data, retry + 1));
                    return;
                } else if (!targetX || !targetY) {
                    const cam = this.cameras.main;
                    targetX = cam.scrollX + cam.width / 2;
                    targetY = cam.scrollY + cam.height / 2;
                }

                this.moonStaffRemoteTimes[uid] = data.time;
                this.playMoonStaffBlessing({ casterUid: uid, eventTime: data.time, x: targetX, y: targetY, isRemote: true });
            };

            for (let uid in events) {
                if (window.GameLogic.currentUser && uid === window.GameLogic.currentUser.uid) continue;
                playRemoteBlessing(uid, events[uid]);
            }
        });

        this.fwThrowsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/fireworkThrows')), (snap) => {
            let throws = snap.val() || {};
            for (let uid in throws) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let data = throws[uid];
                if (data && data.time && (Date.now() - data.time < 3000) && data.scene === this.sceneName) {
                    if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite && (!this.otherPlayers[uid].lastFwTime || this.otherPlayers[uid].lastFwTime !== data.time)) {
                        this.otherPlayers[uid].lastFwTime = data.time;
                        let opSprite = this.otherPlayers[uid].sprite;
                        opSprite.play('fw-throw', true);
                        opSprite.isThrowing = true;
                        this.time.delayedCall(300, () => { if (opSprite && opSprite.active) opSprite.isThrowing = false; });
                        
                        if (data.targetUid && data.targetUid !== 'none') {
                            let targetX = opSprite.x + (opSprite.flipX ? -200 : 200); let targetY = opSprite.y;
                            if (this.otherPlayers[data.targetUid]) { targetX = this.otherPlayers[data.targetUid].sprite.x; targetY = this.otherPlayers[data.targetUid].sprite.y; } 
                            else if (data.targetUid === window.GameLogic.currentUser.uid) { targetX = this.localPlayer.sprite.x; targetY = this.localPlayer.sprite.y; }
                            let fw = this.physics.add.sprite(opSprite.x, opSprite.y, 'fireworks-shoot').setDepth(15).setDisplaySize(30, 30);
                            fw.play('fw-shoot', true);
                            this.tweens.add({ targets: fw, x: targetX, y: targetY, duration: 300, onComplete: () => fw.destroy() });
                        }
                    }
                }
            }
        });
        
        this.waterThrowsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/waterThrows')), (snap) => {
            let throws = snap.val() || {};

            const playRemoteWaterThrow = (uid, data, retry = 0) => {
                if (!data || !data.time || Date.now() - data.time >= 3000 || data.scene !== this.sceneName) return;

                let op = this.otherPlayers[uid];
                if (!op || !op.sprite) {
                    if (retry < 5) {
                        this.time.delayedCall(120, () => playRemoteWaterThrow(uid, data, retry + 1));
                    }
                    return;
                }

                if (op.lastWaterTime === data.time) return;
                op.lastWaterTime = data.time;

                let opSprite = op.sprite;
                opSprite.play('throw', true);
                opSprite.isThrowing = true;
                window.playSFX(this, 'minimum_laser');

                this.time.delayedCall(300, () => {
                    if (opSprite && opSprite.active) opSprite.isThrowing = false;
                });

                if (data.targetUid && data.targetUid !== 'none') {
                    let targetX = opSprite.x + (opSprite.flipX ? -200 : 200);
                    let targetY = opSprite.y;

                    if (this.otherPlayers[data.targetUid]) {
                        targetX = this.otherPlayers[data.targetUid].sprite.x;
                        targetY = this.otherPlayers[data.targetUid].sprite.y;
                    } else if (data.targetUid === window.GameLogic.currentUser.uid) {
                        targetX = this.localPlayer.sprite.x;
                        targetY = this.localPlayer.sprite.y;
                    }

                    let wb = this.physics.add.sprite(opSprite.x, opSprite.y, 'water-ball-blast').setDepth(15).setDisplaySize(30, 30);
                    wb.play('wb-blast', true);
                    this.tweens.add({
                        targets: wb,
                        x: targetX,
                        y: targetY,
                        duration: 300,
                        onComplete: () => wb.destroy()
                    });
                }
            };

            for (let uid in throws) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                playRemoteWaterThrow(uid, throws[uid]);
            }
        });

        this.playersHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/waterHits')), (snap) => { let hits = snap.val() || {}; for (let uid in hits) { if (uid === window.GameLogic.currentUser.uid) continue; let data = hits[uid]; if (data && data.time && (Date.now() - data.time < 2000)) { if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) { let opSprite = this.otherPlayers[uid].sprite; if (!opSprite.isStunned) { opSprite.isStunned = true; opSprite.play('wet', true); this.time.delayedCall(1500, () => { if (opSprite && opSprite.active) opSprite.isStunned = false; }); } } } } });
        this.dummyHitListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/dummyHits')), (snap) => { let hits = snap.val() || {}; for (let key in hits) { let data = hits[key]; if (data && data.time && (Date.now() - data.time < 2000) && this.furnitureSprites[key]) { let dummy = this.furnitureSprites[key].sprite; if (dummy && !dummy.isStunned) { dummy.isStunned = true; dummy.play('dummy-fw-hit', true); this.time.delayedCall(1500, () => { if (dummy && dummy.active) { dummy.isStunned = false; dummy.anims.stop(); dummy.setTexture('dummy'); } }); } } } });
        
        // 新增11：全服接收他人發射蔥友機的動畫
        this.planeThrowsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/planeThrows')), (snap) => { 
            let throws = snap.val() || {}; 
            for (let uid in throws) { 
                if (uid === window.GameLogic.currentUser.uid) continue; 
                let data = throws[uid]; 
                // 修正2：放大容錯時間至 3000ms 解決兩台電腦間的時差導致接收不到動畫，並加上 lastPlaneTime 標記避免重複播放
                if (data && data.time && (Date.now() - data.time < 3000) && data.scene === this.sceneName) { 
                    if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite && (!this.otherPlayers[uid].lastPlaneTime || this.otherPlayers[uid].lastPlaneTime !== data.time)) { 
                        this.otherPlayers[uid].lastPlaneTime = data.time;
                        let opSprite = this.otherPlayers[uid].sprite; 
                        opSprite.play('throw', true); 
                        window.playSFX(this, 'launcher1'); 
                        let targetX = opSprite.x + (opSprite.flipX ? -200 : 200);
                        let targetY = opSprite.y;
                        if (data.targetUid && data.targetUid !== 'none' && this.otherPlayers[data.targetUid]) {
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
        this.planeHitsListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/planeHits/${window.GameLogic.currentUser.uid}`)), (snap) => {
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
                remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/planeHits/${window.GameLogic.currentUser.uid}`))); 
            } 
        });

        // 接收對方的回覆
        this.inviteRepliesListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/inviteReplies/${window.GameLogic.currentUser.uid}`)), (snap) => {
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
                remove(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/inviteReplies/${window.GameLogic.currentUser.uid}`))); 
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

        this.handleVisibilityMimiWalk = () => {
            if (document.hidden) {
                this.stopMimiWalkSFX(false);
                return;
            }

            let data = window.GameLogic.cafeMimiData;
            if (this.sceneName === 'cafe' && data && data.active && data.state !== 'down') {
                if ((!this.mimiSprite || !this.mimiSprite.active) && this.localPlayer && this.localPlayer.sprite && typeof data.x === 'number' && typeof data.y === 'number') {
                    this.mimiSprite = this.physics.add.sprite(data.x, data.y, 'mimi-thief-walk').setDepth(11);
                    this.mimiNameBg = this.add.graphics().setDepth(12);
                    this.mimiNameText = this.add.text(0, 0, '鼠偷米米', {
                        fontSize: '12px',
                        color: '#ffcc00',
                        fontStyle: 'bold'
                    }).setOrigin(0.5).setDepth(12);
                    this.mimiHpText = this.add.text(0, 0, '', {
                        fontSize: '14px',
                        color: '#ff0000',
                        fontStyle: 'bold',
                        stroke: '#fff',
                        strokeThickness: 2
                    }).setOrigin(0.5).setDepth(12);

                    this.mimiSprite.setFlipX(data.flipX);
                    this.mimiSprite.play('mimi-walk', true);

                    let nmY = this.mimiSprite.y - 40;
                    this.mimiNameText.setPosition(this.mimiSprite.x, nmY);
                    this.mimiNameBg.clear().fillStyle(0x000, 0.6).fillRoundedRect(this.mimiSprite.x - 30, nmY - 10, 60, 20, 4);
                    this.mimiHpText.setPosition(this.mimiSprite.x, nmY - 20).setText(data.hp > 0 ? `HP: ${data.hp}` : '');
                }

                if (this.mimiSprite && this.mimiSprite.active) {
                    this.startMimiWalkSFX();
                } else {
                    this.stopMimiWalkSFX(false);
                }
                return;
            }

            this.stopMimiWalkSFX(false);
        };
        document.addEventListener('visibilitychange', this.handleVisibilityMimiWalk);

        this.events.once('shutdown', () => {
            if (this.clearMoonBunBuffFx) this.clearMoonBunBuffFx(false);
            if (this.clearMoonStaffBlessing) this.clearMoonStaffBlessing();
            this.closeSoloChickenMenu();
            this.scale.off('resize', this.updateCameraBounds, this); // 確保離開場景時註銷視窗尺寸監聽，防止記憶體溢出卡頓
            if (this.leaderboardListener) this.leaderboardListener(); 
            if (this.trashListener) this.trashListener();
            if (this.coinsListener) this.coinsListener();
            if (this.dummiesListener) this.dummiesListener(); 
            if (this.planeHitsListener) this.planeHitsListener();
            if (this.inviteRepliesListener) this.inviteRepliesListener();
            if (this.planeThrowsListener) this.planeThrowsListener(); // 新增：離開場景時註銷
            
            // 修復：清理忘記註銷的家俱監聽器 (解決記憶體流失死碼)
            if (this.doghouseFurnListener) this.doghouseFurnListener();
            if (this.shrineFurnListener) this.shrineFurnListener();
            
            // 【v1.3 修正】：離開場景時，徹底註銷米米監聽器並強制切斷走路音效
            if (this.mimiListener) { this.mimiListener(); this.mimiListener = null; }
            if (this.handleVisibilityMimiWalk) {
                document.removeEventListener('visibilitychange', this.handleVisibilityMimiWalk);
                this.handleVisibilityMimiWalk = null;
            }
            this.stopMimiWalkSFX(true);
            
            if (this.trumpetListener) this.trumpetListener();
            if (this.partyAllHitsListener) this.partyAllHitsListener();
            if (this.hitListener) this.hitListener(); 
            if (this.partyHitListener) this.partyHitListener();
            if (this.partyStonesListener) this.partyStonesListener();
            if (this.fwHitListener) this.fwHitListener(); 
            if (this.fwPlayersHitListener) this.fwPlayersHitListener();
            if (this.fwDummyHitListener) this.fwDummyHitListener(); 
            if (this.globalFwListener) this.globalFwListener(); 
            if (this.moonStaffBlessingListener) { this.moonStaffBlessingListener(); this.moonStaffBlessingListener = null; }
            if (this.playersHitListener) this.playersHitListener(); 
            if (this.dummyHitListener) this.dummyHitListener(); 
            if (this.fwThrowsListener) this.fwThrowsListener();
            if (this.waterThrowsListener) this.waterThrowsListener();
            if (this.princeCatListener) { this.princeCatListener(); this.princeCatListener = null; }
            // 修正：徹底清除精靈與實體指標，防止 Phaser 重新啟動場景時讀取到已銷毀的舊物件導致 Crash
            this.mimiSprite = null;
            this.princeCatSprite = null;

            const princeMenu = document.getElementById('prince-cat-menu');            
            if (princeMenu) princeMenu.style.display = 'none';
            if (window.GameLogic.princeCatMenuTimeout) {
                clearTimeout(window.GameLogic.princeCatMenuTimeout);
                window.GameLogic.princeCatMenuTimeout = null;
            }
        });

        this.events.once('destroy', () => {
            try {
                if (this.clearMoonBunBuffFx) this.clearMoonBunBuffFx(false);
                if (this.clearMoonStaffBlessing) this.clearMoonStaffBlessing();
                if (this.clearSoloRocketCruise) this.clearSoloRocketCruise(true);
            } catch (err) {
                console.warn('[火箭巡航] destroy 階段清理失敗，已略過：', err);
            }

            try {
                this.closeSoloChickenMenu();
            } catch (err) {
                console.warn('[獨樂雞選單] destroy 階段清理失敗，已略過：', err);
                this.soloChickenMenuOpen = false;
                this.soloChickenMenuContainer = null;
                this.soloChickenMenuTimer = null;
                this.soloChickenMenuTweens = null;
                this.soloChickenMenuRipples = null;
                this.soloChickenMenuBlocker = null;
                this.soloChickenMenuRippleCount = 0;
            }

            if (this.handleVisibilityMimiWalk) {
                document.removeEventListener('visibilitychange', this.handleVisibilityMimiWalk);
                this.handleVisibilityMimiWalk = null;
            }

            this.stopMimiWalkSFX(true);
        });
    }

    createMiniExplosion(x, y) {
        let allColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800]; let mixColors = [Phaser.Utils.Array.GetRandom(allColors), Phaser.Utils.Array.GetRandom(allColors), Phaser.Utils.Array.GetRandom(allColors)];
        let particles = this.add.particles(x, y, 'fw-particle', { speed: { min: 100, max: 250 }, angle: { min: 0, max: 360 }, scale: { start: 1.5, end: 0 }, blendMode: 'ADD', tint: mixColors, lifespan: { min: 1000, max: 2000 }, gravityY: 100, quantity: 60 });
        particles.setDepth(200); particles.explode(); this.time.delayedCall(2000, () => particles.destroy());
    }

    // 補丁 6-2：月光饅頭 buff 與月光法杖祝福動畫
    isMoonBunBuffActive() {
        return window.isMoonBunBuffActive && window.isMoonBunBuffActive();
    }

    createOrUpdateMoonBunBuffUi() {
        if (!this.isCafe || !this.isMoonBunBuffActive()) {
            this.clearMoonBunBuffFx(false);
            return;
        }

        if (!this.moonBunBuffUi) {
            const bg = this.add.graphics();
            bg.fillStyle(0x3b2a0a, 0.78).fillRoundedRect(0, 0, 238, 34, 12);
            bg.lineStyle(2, 0xffe082, 0.95).strokeRoundedRect(0, 0, 238, 34, 12);

            let icon;
            if (this.textures.exists('solo-rocket-item-moon-bun')) {
                icon = this.add.image(19, 17, 'solo-rocket-item-moon-bun').setDisplaySize(24, 24);
            } else {
                icon = this.add.text(19, 17, '☾', { fontSize: '20px', color: '#ffe082' }).setOrigin(0.5);
            }

            this.moonBunBuffUiText = this.add.text(38, 17, '', {
                fontSize: '13px',
                fontFamily: 'Georgia',
                fontStyle: 'bold',
                color: '#fff7c2'
            }).setOrigin(0, 0.5);

            this.moonBunBuffUi = this.add.container(14, 112, [bg, icon, this.moonBunBuffUiText])
                .setScrollFactor(0)
                .setDepth(1200);

            if (this.minimap) this.minimap.ignore(this.moonBunBuffUi);
        }

        const remain = Number(window.GameLogic.moonBunBuffUntil || 0) - Date.now();
        const timeText = window.formatMoonBunBuffTime ? window.formatMoonBunBuffTime(remain) : '';
        if (this.moonBunBuffUiText) {
            this.moonBunBuffUiText.setText(`月光饅頭｜掃地2下A｜${timeText}`);
        }

        if (this.moonBunBuffUi) {
            const shouldBlink = remain <= 10000;
            this.moonBunBuffUi.setAlpha(shouldBlink ? 0.72 + Math.sin(Date.now() / 110) * 0.22 : 1);
        }
    }

    updateMoonBunBuffUi() {
        if (!window.GameLogic.moonBunBuffUntil) {
            this.clearMoonBunBuffFx(false);
            return;
        }

        if (!this.isMoonBunBuffActive()) {
            if (!window.GameLogic.moonBunBuffEndNotified) {
                window.GameLogic.moonBunBuffEndNotified = true;
                window.GameLogic.moonBunBuffUntil = 0;
                window.GameLogic.moonBunSweepPressCount = 0;
                sendBubble("月光饅頭的力量消退了，手又開始痠了。");
            }
            this.clearMoonBunBuffFx(false);
            return;
        }

        if (this.isCafe) this.createOrUpdateMoonBunBuffUi();
        else this.clearMoonBunBuffFx(false);
    }

    clearMoonBunBuffFx(clearTimer = false) {
        if (this.moonBunBuffUi) {
            this.moonBunBuffUi.destroy(true);
            this.moonBunBuffUi = null;
            this.moonBunBuffUiText = null;
        }

        if (this.moonBunBuffEmitter) {
            this.moonBunBuffEmitter.destroy();
            this.moonBunBuffEmitter = null;
        }

        if (clearTimer) {
            window.GameLogic.moonBunBuffUntil = 0;
            window.GameLogic.moonBunSweepPressCount = 0;
            window.GameLogic.moonBunBuffEndNotified = false;
        }
    }

    showMoonBunUseFx() {
        if (!this.localPlayer || !this.localPlayer.sprite) return;
        const x = this.localPlayer.sprite.x;
        const y = this.localPlayer.sprite.y - 18;

        const flash = this.add.circle(x, y, 28, 0xfff1a8, 0.55).setDepth(220).setBlendMode('ADD');
        this.tweens.add({
            targets: flash,
            scale: 2.2,
            alpha: 0,
            duration: 650,
            ease: 'Sine.easeOut',
            onComplete: () => flash.destroy()
        });

        const p = this.add.particles(x, y, 'fw-particle', {
            speed: { min: 40, max: 140 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.1, end: 0 },
            tint: [0xfff59d, 0xffe082, 0xffffff],
            blendMode: 'ADD',
            lifespan: 750,
            quantity: 28
        }).setDepth(221);
        p.explode();
        this.time.delayedCall(900, () => { if (p) p.destroy(); });
    }

    showMoonBunSweepBoostFx(target, step = 1) {
        const x = target && target.active ? target.x : (this.localPlayer ? this.localPlayer.sprite.x : 0);
        const y = target && target.active ? target.y : (this.localPlayer ? this.localPlayer.sprite.y : 0);

        const label = this.add.text(x, y - 38, step >= 2 ? '滿！' : '50%', {
            fontSize: step >= 2 ? '22px' : '18px',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            color: '#fff4a3',
            stroke: '#5d3b00',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(360);

        this.tweens.add({
            targets: label,
            y: label.y - 26,
            alpha: 0,
            scale: 1.22,
            duration: 520,
            onComplete: () => label.destroy()
        });

        const p = this.add.particles(x, y, 'fw-particle', {
            speed: { min: 35, max: 115 },
            angle: { min: 0, max: 360 },
            scale: { start: step >= 2 ? 1.15 : 0.8, end: 0 },
            tint: [0xfff59d, 0xffca28, 0xffffff],
            blendMode: 'ADD',
            lifespan: 520,
            quantity: step >= 2 ? 24 : 12
        }).setDepth(350);
        p.explode();
        this.time.delayedCall(650, () => { if (p) p.destroy(); });
    }

    playMoonStaffBlessing(options = {}) {
        this.clearMoonStaffBlessing();

        const cam = this.cameras.main;
        const cx = cam.scrollX + cam.width / 2;
        const cy = cam.scrollY + cam.height / 2;

        let targetX = Number(options.x || 0);
        let targetY = Number(options.y || 0);
        let casterSprite = null;
        if (options.casterUid && this.otherPlayers && this.otherPlayers[options.casterUid] && this.otherPlayers[options.casterUid].sprite) {
            casterSprite = this.otherPlayers[options.casterUid].sprite;
        } else if (this.localPlayer && this.localPlayer.sprite) {
            casterSprite = this.localPlayer.sprite;
        }

        if ((!targetX || !targetY) && casterSprite) {
            targetX = casterSprite.x;
            targetY = casterSprite.y;
        }
        if (!targetX || !targetY) {
            targetX = cx;
            targetY = cy;
        }

        if (!window.GameLogic.muteSFX && this.cache && this.cache.audio && this.cache.audio.exists('moon-staff-use')) {
            window.playSFX(this, 'moon-staff-use');
        }

        const layer = this.add.container(0, 0).setDepth(980);
        this.moonStaffBlessingLayer = layer;
        this.moonStaffBlessingTweens = [];
        this.moonStaffBlessingTimers = [];
        this.moonStaffBlessingLooseObjects = [];
        this.moonStaffBlessingEmitters = [];
        this.moonStaffBlessingEvents = [];

        const moon = this.add.circle(cx, cy - 145, 93, 0xfff4b5, 0.94)
            .setBlendMode('ADD')
            .setStrokeStyle(7, 0xffffff, 0.82);
        const moonGlow = this.add.circle(cx, cy - 145, 138, 0xffe082, 0.18)
            .setBlendMode('ADD');

        const title = this.add.text(cx, cy - 16, '月月有福，月來月美', {
            fontSize: '30px',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            color: '#fff7c2',
            stroke: '#4a2e00',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);

        const cloudColors = [0xffffff, 0xb39ddb, 0x90caf9];
        const clouds = [];
        for (let i = 0; i < 3; i++) {
            const baseX = cx + [-118, 0, 118][i];
            const baseY = cy - 66 + (i % 2) * 16;
            const c = this.add.container(baseX, baseY).setAlpha(0.86);
            const puffs = [
                this.add.ellipse(0, 0, 64, 28, cloudColors[i % cloudColors.length], 0.8),
                this.add.ellipse(-28, 4, 48, 22, cloudColors[(i + 1) % cloudColors.length], 0.72),
                this.add.ellipse(28, 5, 52, 23, cloudColors[(i + 2) % cloudColors.length], 0.72)
            ];
            puffs.forEach(p => p.setBlendMode('ADD'));
            c.add(puffs);
            clouds.push(c);
        }

        layer.add([moonGlow, moon, title, ...clouds]);

        this.moonStaffBlessingTweens.push(this.tweens.add({
            targets: [moon, moonGlow],
            angle: 360,
            duration: 17000,
            ease: 'Linear'
        }));

        this.moonStaffBlessingTweens.push(this.tweens.add({
            targets: moonGlow,
            scale: 1.18,
            alpha: 0.34,
            duration: 1300,
            yoyo: true,
            repeat: 10,
            ease: 'Sine.easeInOut'
        }));

        clouds.forEach((cloud, idx) => {
            this.moonStaffBlessingTweens.push(this.tweens.add({
                targets: cloud,
                x: cloud.x + (idx === 1 ? 28 : (idx === 0 ? 36 : -36)),
                y: cloud.y + (idx === 1 ? -8 : 8),
                alpha: 0.62,
                duration: 1450 + idx * 260,
                yoyo: true,
                repeat: 5,
                ease: 'Sine.easeInOut'
            }));

            cloud.list.forEach((puff, pIdx) => {
                this.moonStaffBlessingTweens.push(this.tweens.add({
                    targets: puff,
                    fillColor: cloudColors[(idx + pIdx + 1) % cloudColors.length],
                    duration: 760 + pIdx * 180,
                    yoyo: true,
                    repeat: 12
                }));
            });
        });

        // 五隻兔子：改用 80px spritesheet；以施放玩家目前位置為中心持續移動。
        const rabbitContainers = [];
        const rabbitRadius = 96;
        const rabbitAnimKey = 'moon-staff-dance-rabbit-hop';

        const getMoonStaffCasterCenter = () => {
            if (casterSprite && casterSprite.active) {
                targetX = casterSprite.x;
                targetY = casterSprite.y;
            }
            return { x: targetX, y: targetY };
        };

        const hasRabbitSheet = this.textures.exists('moon-staff-dance-rabbit');
        if (hasRabbitSheet && !this.anims.exists(rabbitAnimKey)) {
            try {
                this.anims.create({
                    key: rabbitAnimKey,
                    frames: this.anims.generateFrameNumbers('moon-staff-dance-rabbit'),
                    frameRate: 8,
                    repeat: -1
                });
            } catch (err) {
                console.warn('[月光法杖] 建立跳舞兔子 spritesheet 動畫失敗，將顯示第一格：', err);
            }
        }

        for (let i = 0; i < 5; i++) {
            const center = getMoonStaffCasterCenter();
            const startDeg = -90 + i * 72;
            const angle = Phaser.Math.DegToRad(startDeg);
            const rc = this.add.container(
                center.x + Math.cos(angle) * rabbitRadius,
                center.y + Math.sin(angle) * rabbitRadius - 10
            ).setDepth(988).setAlpha(0.95);

            rc.orbitDeg = startDeg;

            let rabbit;
            if (hasRabbitSheet) {
                rabbit = this.add.sprite(0, 0, 'moon-staff-dance-rabbit').setDisplaySize(80, 80);
                if (this.anims.exists(rabbitAnimKey)) rabbit.play(rabbitAnimKey);
            } else {
                rabbit = this.add.text(0, 0, '🐇', { fontSize: '46px' }).setOrigin(0.5);
            }

            rabbit.setOrigin(0.5);
            rc.add(rabbit);
            rabbitContainers.push(rc);
            this.moonStaffBlessingLooseObjects.push(rc);

            // 額外保留「原地跳兩下」的視覺感；spritesheet 本身也會持續播放。
            this.moonStaffBlessingTweens.push(this.tweens.add({
                targets: rabbit,
                y: -14,
                duration: 210,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeOut',
                delay: i * 70
            }));
        }

        const updateMoonStaffRabbitPositions = () => {
            const center = getMoonStaffCasterCenter();
            rabbitContainers.forEach((rc) => {
                if (!rc || !rc.active) return;
                const angle = Phaser.Math.DegToRad(rc.orbitDeg || 0);
                rc.setPosition(
                    center.x + Math.cos(angle) * rabbitRadius,
                    center.y + Math.sin(angle) * rabbitRadius - 10
                );
            });
        };

        this.moonStaffRabbitFollowEvent = this.time.addEvent({
            delay: 50,
            loop: true,
            callback: updateMoonStaffRabbitPositions
        });
        this.moonStaffBlessingEvents.push(this.moonStaffRabbitFollowEvent);

        this.moonStaffRabbitMoveEvent = this.time.addEvent({
            delay: 920,
            repeat: 15,
            callback: () => {
                rabbitContainers.forEach((rc) => {
                    if (!rc || !rc.active) return;
                    this.moonStaffBlessingTweens.push(this.tweens.add({
                        targets: rc,
                        orbitDeg: Number(rc.orbitDeg || 0) + 72,
                        duration: 420,
                        ease: 'Sine.easeInOut'
                    }));
                });
            }
        });
        this.moonStaffBlessingEvents.push(this.moonStaffRabbitMoveEvent);
        updateMoonStaffRabbitPositions();

        // 角色全身：爆竹式大面積金光噴灑。
        this.moonStaffBlessingEmitter = this.add.particles(targetX, targetY - 18, 'fw-particle', {
            speed: { min: 120, max: 440 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.55, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xffffff, 0xfff59d, 0xffd54f, 0xff9800, 0xff7043],
            blendMode: 'ADD',
            lifespan: { min: 650, max: 1450 },
            quantity: 12,
            frequency: 42
        }).setDepth(989);
        if (casterSprite && casterSprite.active) this.moonStaffBlessingEmitter.startFollow(casterSprite, 0, -18);
        this.moonStaffBlessingEmitters.push(this.moonStaffBlessingEmitter);

        // 月球持續散發旋轉顆粒。
        this.moonStaffMoonEmitter = this.add.particles(cx, cy - 145, 'fw-particle', {
            speed: { min: 18, max: 86 },
            angle: { min: 0, max: 360 },
            rotate: { start: 0, end: 360 },
            scale: { start: 1.15, end: 0 },
            alpha: { start: 0.86, end: 0 },
            tint: [0xffffff, 0xfff4b5, 0xffe082, 0xb39ddb, 0x90caf9],
            blendMode: 'ADD',
            lifespan: { min: 1200, max: 2400 },
            quantity: 4,
            frequency: 80,
            emitZone: {
                type: 'edge',
                source: new Phaser.Geom.Circle(0, 0, 105),
                quantity: 64
            }
        }).setDepth(982);
        this.moonStaffBlessingEmitters.push(this.moonStaffMoonEmitter);

        // 全域大量紅、橘、黃、白光球：閃爍、漸大、淡出。
        this.moonStaffOrbEvent = this.time.addEvent({
            delay: 135,
            repeat: 112,
            callback: () => {
                const orbCount = Phaser.Math.Between(3, 6);
                for (let i = 0; i < orbCount; i++) {
                    const color = Phaser.Utils.Array.GetRandom([0xff1744, 0xff7043, 0xffb300, 0xfff176, 0xffffff]);
                    const orb = this.add.circle(
                        cam.scrollX + Phaser.Math.Between(18, cam.width - 18),
                        cam.scrollY + Phaser.Math.Between(24, cam.height - 24),
                        Phaser.Math.Between(7, 18),
                        color,
                        Phaser.Math.FloatBetween(0.18, 0.5)
                    ).setBlendMode('ADD').setDepth(976);

                    this.moonStaffBlessingLooseObjects.push(orb);
                    this.moonStaffBlessingTweens.push(this.tweens.add({
                        targets: orb,
                        scale: Phaser.Math.FloatBetween(2.2, 5.2),
                        alpha: 0,
                        duration: Phaser.Math.Between(620, 1180),
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            if (orb && orb.active) orb.destroy();
                        }
                    }));
                }
            }
        });
        this.moonStaffBlessingEvents.push(this.moonStaffOrbEvent);

        // 週期性光環，保留祝福感但不阻擋玩家視線。
        this.moonStaffRingEvent = this.time.addEvent({
            delay: 650,
            repeat: 22,
            callback: () => {
                const ringX = casterSprite && casterSprite.active ? casterSprite.x : targetX;
                const ringY = casterSprite && casterSprite.active ? casterSprite.y + 8 : targetY + 8;
                const ring = this.add.circle(ringX, ringY, 24)
                    .setStrokeStyle(5, 0xfff59d, 0.76)
                    .setDepth(978)
                    .setBlendMode('ADD');

                this.moonStaffBlessingLooseObjects.push(ring);
                this.moonStaffBlessingTweens.push(this.tweens.add({
                    targets: ring,
                    scale: 4.2,
                    alpha: 0,
                    duration: 950,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (ring && ring.active) ring.destroy();
                    }
                }));
            }
        });
        this.moonStaffBlessingEvents.push(this.moonStaffRingEvent);

        const fadeTimer = this.time.delayedCall(15000, () => {
            this.fadeOutMoonStaffBlessing();
        });
        const endTimer = this.time.delayedCall(17000, () => {
            this.clearMoonStaffBlessing();
        });
        this.moonStaffBlessingTimers.push(fadeTimer, endTimer);
    }

    fadeOutMoonStaffBlessing() {
        if (Array.isArray(this.moonStaffBlessingEvents)) {
            this.moonStaffBlessingEvents.forEach(ev => {
                if (ev && ev.remove) ev.remove(false);
            });
            this.moonStaffBlessingEvents = [];
        }

        if (Array.isArray(this.moonStaffBlessingEmitters)) {
            this.moonStaffBlessingEmitters.forEach(em => {
                if (em && em.stop) em.stop();
            });
        }

        if (this.moonStaffBlessingLayer) {
            this.moonStaffBlessingTweens = this.moonStaffBlessingTweens || [];
            this.moonStaffBlessingTweens.push(this.tweens.add({
                targets: this.moonStaffBlessingLayer,
                alpha: 0,
                scale: 1.06,
                duration: 1900,
                ease: 'Sine.easeOut'
            }));
        }

        if (Array.isArray(this.moonStaffBlessingLooseObjects)) {
            this.moonStaffBlessingLooseObjects.forEach(obj => {
                if (obj && obj.active) {
                    this.moonStaffBlessingTweens.push(this.tweens.add({
                        targets: obj,
                        alpha: 0,
                        scaleX: (obj.scaleX || 1) * 1.18,
                        scaleY: (obj.scaleY || 1) * 1.18,
                        duration: 1800,
                        ease: 'Sine.easeOut'
                    }));
                }
            });
        }
    }

    clearMoonStaffBlessing() {
        if (this.moonStaffRingEvent) {
            this.moonStaffRingEvent.remove(false);
            this.moonStaffRingEvent = null;
        }

        if (this.moonStaffOrbEvent) {
            this.moonStaffOrbEvent.remove(false);
            this.moonStaffOrbEvent = null;
        }

        if (this.moonStaffRabbitMoveEvent) {
            this.moonStaffRabbitMoveEvent.remove(false);
            this.moonStaffRabbitMoveEvent = null;
        }

        if (this.moonStaffRabbitFollowEvent) {
            this.moonStaffRabbitFollowEvent.remove(false);
            this.moonStaffRabbitFollowEvent = null;
        }

        if (Array.isArray(this.moonStaffBlessingEvents)) {
            this.moonStaffBlessingEvents.forEach(ev => {
                if (ev && ev.remove) ev.remove(false);
            });
            this.moonStaffBlessingEvents = null;
        }

        if (Array.isArray(this.moonStaffBlessingTimers)) {
            this.moonStaffBlessingTimers.forEach(timer => {
                if (timer && timer.remove) timer.remove(false);
            });
            this.moonStaffBlessingTimers = null;
        }

        if (Array.isArray(this.moonStaffBlessingTweens)) {
            this.moonStaffBlessingTweens.forEach(tween => {
                if (tween && tween.stop) tween.stop();
            });
            this.moonStaffBlessingTweens = null;
        }

        if (Array.isArray(this.moonStaffBlessingEmitters)) {
            this.moonStaffBlessingEmitters.forEach(em => {
                if (em && em.destroy) em.destroy();
            });
            this.moonStaffBlessingEmitters = null;
        }

        if (this.moonStaffBlessingEmitter) {
            this.moonStaffBlessingEmitter.destroy();
            this.moonStaffBlessingEmitter = null;
        }

        if (this.moonStaffMoonEmitter) {
            this.moonStaffMoonEmitter.destroy();
            this.moonStaffMoonEmitter = null;
        }

        if (Array.isArray(this.moonStaffBlessingLooseObjects)) {
            this.moonStaffBlessingLooseObjects.forEach(obj => {
                if (obj && obj.active && obj.destroy) obj.destroy();
            });
            this.moonStaffBlessingLooseObjects = null;
        }

        if (this.moonStaffBlessingLayer) {
            this.moonStaffBlessingLayer.destroy(true);
            this.moonStaffBlessingLayer = null;
        }
    }

    openSoloChickenMenu() {
        if (!this.localPlayer || !this.localPlayer.sprite) return;

        // 防止重複開啟造成疊加
        if (this.soloChickenMenuOpen || this.soloChickenMenuContainer || this.soloChickenMenuBlocker) {
            this.closeSoloChickenMenu();
        }

        const cam = this.cameras.main;
        const sw = cam.width;
        const sh = cam.height;
        const cx = sw / 2;
        const cy = sh / 2;

        this.soloChickenMenuOpen = true;
        this.soloChickenMenuTimer = null;
        this.soloChickenRippleTimer = null;
        this.soloChickenMenuTweens = [];
        this.soloChickenMenuRipples = [];
        this.soloChickenMenuRippleCount = 0;
        this.soloChickenMenuBlocker = null;

        this.localPlayer.sprite.setVelocity(0, 0);
        this.localPlayer.sprite.play('idle', true);

        const panelW = Math.min(460, sw - 44);
        const panelH = Math.min(330, sh - 44);
        const left = cx - panelW / 2;
        const top = cy - panelH / 2;

        // 獨樂雞選單點擊安全區：避免全螢幕 blocker 吃掉按鈕事件
        const rocketBtnHit = { x: cx, y: cy + 24, w: panelW - 120, h: 54 };
        const closeBtnHit = { x: cx, y: cy + 92, w: panelW - 120, h: 44 };
        const closeIconHit = { x: left + panelW - 34, y: top + 32, w: 48, h: 48 };

        const isPointInHitRect = (px, py, rect) => {
            return px >= rect.x - rect.w / 2 &&
                   px <= rect.x + rect.w / 2 &&
                   py >= rect.y - rect.h / 2 &&
                   py <= rect.y + rect.h / 2;
        };

        // 背景遮罩獨立放在 container 外，避免全螢幕遮罩壓住面板按鈕。
        const blocker = this.add.rectangle(cx, cy, sw, sh, 0x000000, 0.72)
            .setDepth(9490)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        blocker.on('pointerdown', (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();

            const px = pointer ? pointer.x : null;
            const py = pointer ? pointer.y : null;

            if (px !== null && py !== null) {
                // 若 Phaser 把按鈕點擊誤送到 blocker，這裡直接補救觸發火箭巡航
                if (isPointInHitRect(px, py, rocketBtnHit)) {
                    this.confirmStartSoloRocketCruise();
                    return;
                }

                // 點到關閉按鈕或右上角 X，才關閉
                if (isPointInHitRect(px, py, closeBtnHit) || isPointInHitRect(px, py, closeIconHit)) {
                    this.closeSoloChickenMenu();
                    return;
                }

                // 點在面板內其他地方，不關閉、不穿透
                if (px >= left && px <= left + panelW && py >= top && py <= top + panelH) {
                    return;
                }
            }

            // 只有點到面板外背景才關閉
            this.closeSoloChickenMenu();
        });

        this.soloChickenMenuBlocker = blocker;

        const container = this.add.container(0, 0)
            .setDepth(9500)
            .setScrollFactor(0)
            .setAlpha(0);

        this.soloChickenMenuContainer = container;

        const panel = this.add.graphics();
        panel.fillStyle(0x050008, 0.96);
        panel.fillRoundedRect(left, top, panelW, panelH, 18);
        panel.lineStyle(6, 0x8a2be2, 1);
        panel.strokeRoundedRect(left, top, panelW, panelH, 18);
        panel.lineStyle(2, 0xff00ff, 0.95);
        panel.strokeRoundedRect(left + 8, top + 8, panelW - 16, panelH - 16, 14);
        panel.lineStyle(1, 0xffffff, 0.08);
        for (let y = top + 22; y < top + panelH - 22; y += 10) {
            panel.lineBetween(left + 18, y, left + panelW - 18, y);
        }

        // 面板本體吃掉點擊，避免點面板空白處關閉；按鈕另外處理。
        const panelBlocker = this.add.zone(cx, cy, panelW, panelH)
            .setInteractive();

        panelBlocker.on('pointerdown', (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
        });

        const title = this.add.text(cx, top + 48, '獨樂雞', {
            fontSize: '32px',
            fontFamily: 'Georgia, Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#8a2be2',
            strokeThickness: 5
        }).setOrigin(0.5);

        const subtitle = this.add.text(cx, top + 86, '單人小遊戲入口', {
            fontSize: '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#e8d7ff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const hint = this.add.text(cx, top + panelH - 34, 'A / B / 點背景 / 點右上角都可關閉', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.82);

        container.add([panel, panelBlocker, title, subtitle, hint]);

        const makeButton = (x, y, w, h, label, onClick) => {
            const bg = this.add.rectangle(x, y, w, h, 0xffffff, 1)
                .setStrokeStyle(3, 0xeeeeff, 1)
                .setInteractive({ useHandCursor: true });

            const txt = this.add.text(x, y, label, {
                fontSize: '20px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#000000'
            }).setOrigin(0.5);

            const fireClick = (pointer, localX, localY, event) => {
                if (event && event.stopPropagation) event.stopPropagation();
                if (typeof onClick === 'function') onClick();
            };

            bg.on('pointerover', () => bg.setFillStyle(0xe9ddff, 1));
            bg.on('pointerout', () => bg.setFillStyle(0xffffff, 1));
            bg.on('pointerdown', fireClick);

            // 文字本身也吃點擊，避免點到字時沒有反應。
            txt.setInteractive({ useHandCursor: true });
            txt.on('pointerdown', fireClick);

            container.add([bg, txt]);
        };

        makeButton(cx, cy + 24, panelW - 120, 54, '火箭巡航', () => {
            this.confirmStartSoloRocketCruise();
        });

        makeButton(cx, cy + 92, panelW - 120, 44, '關閉', () => {
            this.closeSoloChickenMenu();
        });

        const closeX = left + panelW - 34;
        const closeY = top + 32;

        const closeBg = this.add.circle(closeX, closeY, 16, 0xffffff, 1)
            .setInteractive({ useHandCursor: true });

        const closeTxt = this.add.text(closeX, closeY - 1, '×', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const closeClick = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            this.closeSoloChickenMenu();
        };

        closeBg.on('pointerdown', closeClick);
        closeTxt.on('pointerdown', closeClick);

        container.add([closeBg, closeTxt]);

        const spawnRipple = () => {
            if (!this.soloChickenMenuOpen || !this.soloChickenMenuContainer || !this.soloChickenMenuContainer.active) return;
            if (!Array.isArray(this.soloChickenMenuRipples)) return;

            const colorList = [0xff00ff, 0x00ffff, 0xffff00, 0x39ff14, 0xff8800, 0x8a2be2, 0xffffff];
            const color = Phaser.Utils.Array.GetRandom(colorList);
            const rx = Phaser.Math.Between(left + 64, left + panelW - 64);
            const ry = Phaser.Math.Between(top + panelH - 112, top + panelH - 64);

            const ripple = this.add.graphics({ x: rx, y: ry });
            ripple.lineStyle(2, color, 0.9);
            ripple.strokeCircle(0, 0, 7);
            ripple.lineStyle(1, 0xffffff, 0.55);
            ripple.strokeCircle(0, 0, 13);

            for (let i = 0; i < 10; i++) {
                const a = (Math.PI * 2 / 10) * i;
                const px = Math.cos(a) * 17;
                const py = Math.sin(a) * 17;
                ripple.fillStyle(Phaser.Utils.Array.GetRandom(colorList), 0.85);
                ripple.fillRect(px - 2, py - 2, 4, 4);
            }

            if (ripple.setBlendMode) ripple.setBlendMode(Phaser.BlendModes.ADD);
            ripple.setAlpha(0.95);
            container.add(ripple);
            this.soloChickenMenuRipples.push(ripple);

            const tw = this.tweens.add({
                targets: ripple,
                scaleX: { from: 0.45, to: 2.4 },
                scaleY: { from: 0.45, to: 2.4 },
                alpha: { from: 0.95, to: 0 },
                duration: 850,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    if (Array.isArray(this.soloChickenMenuRipples)) {
                        this.soloChickenMenuRipples = this.soloChickenMenuRipples.filter(r => r !== ripple);
                    }
                    if (ripple && ripple.destroy) ripple.destroy();
                }
            });

            ripple.__soloTween = tw;
            if (Array.isArray(this.soloChickenMenuTweens)) this.soloChickenMenuTweens.push(tw);
        };

        spawnRipple();

        this.soloChickenRippleTimer = this.time.addEvent({
            delay: 520,
            loop: true,
            callback: spawnRipple
        });

        const openTween = this.tweens.add({
            targets: container,
            alpha: { from: 0, to: 1 },
            duration: 120,
            ease: 'Sine.easeOut'
        });

        this.soloChickenMenuTweens.push(openTween);

        // 保險：如果玩家真的沒關，30 秒後自動解除，避免永久卡住。
        this.soloChickenMenuTimer = this.time.delayedCall(30000, () => {
            if (this.soloChickenMenuOpen || this.soloChickenMenuContainer || this.soloChickenMenuBlocker) {
                this.closeSoloChickenMenu();
            }
        });
    }

    closeSoloChickenMenu() {
        const timer = this.soloChickenMenuTimer;
        const rippleTimer = this.soloChickenRippleTimer;
        const tweens = Array.isArray(this.soloChickenMenuTweens) ? this.soloChickenMenuTweens.slice() : [];
        const ripples = Array.isArray(this.soloChickenMenuRipples) ? this.soloChickenMenuRipples.slice() : [];
        const container = this.soloChickenMenuContainer;
        const blocker = this.soloChickenMenuBlocker;

        // 重要：先解除旗標，避免 update() 因殘留物件而永久 return，造成玩家卡死。
        this.soloChickenMenuOpen = false;
        this.soloChickenMenuTimer = null;
        this.soloChickenRippleTimer = null;
        this.soloChickenMenuTweens = null;
        this.soloChickenMenuRipples = null;
        this.soloChickenMenuContainer = null;
        this.soloChickenMenuBlocker = null;
        this.soloChickenMenuRippleCount = 0;

        try {
            if (timer && timer.remove) timer.remove(false);
            if (rippleTimer && rippleTimer.remove) rippleTimer.remove(false);
        } catch (err) {
            console.warn('[獨樂雞選單] Timer 清理失敗，已略過：', err);
        }

        tweens.forEach(tw => {
            try {
                if (!tw) return;
                // 不手動 remove，避免 Phaser tween manager 已清掉時重複 remove 報錯
                if (tw.stop) tw.stop();
            } catch (err) {
                console.warn('[獨樂雞選單] Tween 清理失敗，已略過：', err);
            }
        });

        ripples.forEach(r => {
            try {
                if (!r) return;

                // Ripple 的 tween 只停止，不重複 remove
                if (r.__soloTween && r.__soloTween.stop) r.__soloTween.stop();
                r.__soloTween = null;

                // 若 ripple 還掛在 container 上，交給 container.destroy(true) 統一清理
                // 若 container 已不存在，才嘗試單獨銷毀
                if (!container && r.scene && r.active && r.destroy) {
                    r.destroy();
                }
            } catch (err) {
                console.warn('[獨樂雞選單] Ripple 清理失敗，已略過：', err);
            }
        });

        try {
            if (this.closeSoloRocketPaymentConfirm) this.closeSoloRocketPaymentConfirm();
        } catch (err) {
            console.warn('[火箭巡航] 支付確認面板清理失敗，已略過：', err);
        }

        // 修正：soloChickenMenuBlocker 是獨立於 container 外的透明遮罩，
        // 若沒有銷毀，後續火箭巡航完成畫面的「返回大廳」點擊會被吃掉。
        try {
            if (blocker && blocker.destroy) {
                blocker.destroy();
            }
        } catch (err) {
            console.warn('[獨樂雞選單] Blocker 清理失敗，已略過：', err);
        }

        try {
            if (container && this.tweens) {
                this.tweens.killTweensOf(container);
                if (container.list) {
                    container.list.forEach(child => {
                        if (child) this.tweens.killTweensOf(child);
                    });
                }
            }

            if (container && container.destroy) {
                container.destroy(true);
            }
        } catch (err) {
            console.warn('[獨樂雞選單] Container 清理失敗，已略過：', err);
        }

        try {
            const sprite = this.localPlayer && this.localPlayer.sprite;
            if (sprite && sprite.active) {
                if (sprite.body) sprite.setVelocity(0, 0);
                if (this.anims && this.anims.exists('idle')) sprite.play('idle', true);
            }
        } catch (err) {
            console.warn('[獨樂雞選單] 玩家狀態復原失敗，已略過：', err);
        }
    }

    confirmStartSoloRocketCruise() {
        if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished || this.soloRocketPaymentPending) return;

        // 防止 blocker 與按鈕事件同時觸發，造成 confirm / 扣款流程重複
        const now = Date.now();
        if (this.soloRocketConfirmLockUntil && now < this.soloRocketConfirmLockUntil) return;
        this.soloRocketConfirmLockUntil = now + 500;

        const cost = 100;

        if (!window.GameLogic.currentUser) {
            this.openSoloRocketPaymentConfirm(cost, {
                mode: 'notice',
                title: '尚未登入',
                body: '請先登入後再遊玩火箭巡航。'
            });
            return;
        }

        const localCoins = Number(
            window.GameLogic.myProfile && window.GameLogic.myProfile.coins
                ? window.GameLogic.myProfile.coins
                : 0
        );
        if (!Number.isFinite(localCoins) || localCoins < cost) {
            this.openSoloRocketPaymentConfirm(cost, {
                mode: 'notice',
                title: '馬德幣不足',
                body: `火箭巡航需要 ${cost} 馬德幣。\n你目前持有 ${Number.isFinite(localCoins) ? localCoins : 0} 馬德幣。`
            });
            return;
        }

        this.openSoloRocketPaymentConfirm(cost);
    }

    async requestSoloRocketPayment(cost = 100) {
        if (this.soloRocketPaymentPending) return;
        this.soloRocketPaymentPending = true;

        const uid = window.GameLogic.currentUser && window.GameLogic.currentUser.uid
            ? window.GameLogic.currentUser.uid
            : null;
        if (!uid) {
            this.soloRocketPaymentPending = false;
            this.openSoloRocketPaymentConfirm(cost, {
                mode: 'notice',
                title: '登入資料異常',
                body: '找不到登入資料，無法進入火箭巡航。'
            });
            return;
        }

        try {
            const coinSnap = await get(ref(window.GameLogic.db, `users/${uid}/coins`));
            const latestCoinsRaw = coinSnap.val();
            const latestCoins = Number(latestCoinsRaw || 0);

            if (!Number.isFinite(latestCoins)) {
                console.warn('[火箭巡航] coins 資料異常：', latestCoinsRaw);
                this.openSoloRocketPaymentConfirm(cost, {
                    mode: 'notice',
                    title: '馬德幣資料異常',
                    body: '目前無法確認你的馬德幣資料，請稍後再試。'
                });
                return;
            }

            if (latestCoins < cost) {
                window.GameLogic.myProfile.coins = latestCoins;
                this.syncSoloRocketCoinUi(latestCoins);
                this.openSoloRocketPaymentConfirm(cost, {
                    mode: 'notice',
                    title: '馬德幣不足',
                    body: `火箭巡航需要 ${cost} 馬德幣。\n你目前持有 ${latestCoins} 馬德幣。`
                });
                return;
            }

            const newCoins = latestCoins - cost;
            await update(ref(window.GameLogic.db, `users/${uid}`), { coins: newCoins });

            window.GameLogic.myProfile.coins = newCoins;
            this.syncSoloRocketCoinUi(newCoins);
            console.log('[火箭巡航] 已支付 100 馬德幣，啟動副本。');

            this.closeSoloChickenMenu();
            this.startSoloRocketCruise();
        } catch (err) {
            console.warn('[火箭巡航] 扣款失敗，已阻擋進入副本：', err);
            this.openSoloRocketPaymentConfirm(cost, {
                mode: 'notice',
                title: '扣款失敗',
                body: '扣款失敗，請稍後再試。'
            });
        } finally {
            this.soloRocketPaymentPending = false;
        }
    }

    syncSoloRocketCoinUi(coins) {
        const val = Number(coins || 0);
        const coinsEl = document.getElementById('vp-coins');
        if (coinsEl) coinsEl.innerText = val;
        const storeCoinsEl = document.getElementById('store-current-coins');
        if (storeCoinsEl) storeCoinsEl.innerText = `💰 ${val}`;
    }

    closeSoloRocketPaymentConfirm() {
        const container = this.soloRocketPaymentConfirmContainer;
        const blocker = this.soloRocketPaymentConfirmBlocker;

        this.soloRocketPaymentConfirmContainer = null;
        this.soloRocketPaymentConfirmBlocker = null;

        try {
            if (container && container.destroy) container.destroy(true);
        } catch (err) {
            console.warn('[火箭巡航] 支付確認面板清理失敗，已略過：', err);
        }

        try {
            if (blocker && blocker.destroy) blocker.destroy();
        } catch (err) {
            console.warn('[火箭巡航] 支付確認遮罩清理失敗，已略過：', err);
        }
    }

    openSoloRocketPaymentConfirm(cost = 100, options = {}) {
        this.closeSoloRocketPaymentConfirm();

        const cam = this.cameras.main;
        const isNotice = options.mode === 'notice';
        const localCoinsRaw = Number(
            window.GameLogic.myProfile && window.GameLogic.myProfile.coins
                ? window.GameLogic.myProfile.coins
                : 0
        );
        const localCoins = Number.isFinite(localCoinsRaw) ? localCoinsRaw : 0;
        const afterCoins = Math.max(0, localCoins - cost);

        const cx = cam.width / 2;
        const cy = cam.height / 2;
        const panelW = Math.min(360, Math.max(280, cam.width - 40));
        const panelH = isNotice ? 220 : 270;
        const px = cx - panelW / 2;
        const py = cy - panelH / 2;

        // 補強：即使 Phaser 把點擊先送到全螢幕 blocker，也能用座標判斷按鈕是否被點到。
        const isPointInHitRect = (pointX, pointY, rect) => {
            return pointX >= rect.x - rect.w / 2 &&
                   pointX <= rect.x + rect.w / 2 &&
                   pointY >= rect.y - rect.h / 2 &&
                   pointY <= rect.y + rect.h / 2;
        };

        const noticeBtnHit = {
            x: cx,
            y: py + panelH - 44,
            w: 170,
            h: 62
        };

        const cancelBtnHit = {
            x: cx - 82,
            y: py + panelH - 48,
            w: 152,
            h: 62
        };

        const payBtnHit = {
            x: cx + 82,
            y: py + panelH - 48,
            w: 152,
            h: 62
        };

        const safeClosePaymentConfirm = () => {
            this.closeSoloRocketPaymentConfirm();
        };

        const safePayAndStartRocket = () => {
            this.closeSoloRocketPaymentConfirm();
            this.requestSoloRocketPayment(cost);
        };

        // 遮罩獨立放在面板下方，阻擋背後選單點擊，但不蓋住確認按鈕。
        const blocker = this.add.rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.74)
            .setDepth(9888)
            .setScrollFactor(0)
            .setInteractive();

        blocker.on('pointerdown', (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();

            const pointX = pointer ? pointer.x : null;
            const pointY = pointer ? pointer.y : null;
            if (pointX === null || pointY === null) return;

            // 通知模式：點「知道了」
            if (isNotice && isPointInHitRect(pointX, pointY, noticeBtnHit)) {
                safeClosePaymentConfirm();
                return;
            }

            // 確認模式：點「取消」
            if (!isNotice && isPointInHitRect(pointX, pointY, cancelBtnHit)) {
                safeClosePaymentConfirm();
                return;
            }

            // 確認模式：點「支付啟動」
            if (!isNotice && isPointInHitRect(pointX, pointY, payBtnHit)) {
                safePayAndStartRocket();
                return;
            }

            // 點在面板內其他地方：不關閉、不穿透
            if (pointX >= px && pointX <= px + panelW && pointY >= py && pointY <= py + panelH) {
                return;
            }

            // 點到面板外：關閉支付確認面板
            safeClosePaymentConfirm();
        });

        const container = this.add.container(0, 0)
            .setDepth(9890)
            .setScrollFactor(0);

        this.soloRocketPaymentConfirmBlocker = blocker;
        this.soloRocketPaymentConfirmContainer = container;

        const panel = this.add.graphics();
        panel.fillStyle(0x050008, 0.98);
        panel.fillRoundedRect(px, py, panelW, panelH, 18);
        panel.lineStyle(5, 0x8a2be2, 1);
        panel.strokeRoundedRect(px, py, panelW, panelH, 18);
        panel.lineStyle(2, 0xff00ff, 0.85);
        panel.strokeRoundedRect(px + 8, py + 8, panelW - 16, panelH - 16, 14);

        const title = this.add.text(cx, py + 42, options.title || '啟動火箭巡航', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#8a2be2',
            strokeThickness: 5
        }).setOrigin(0.5);

        const bodyText = options.body || `是否支付 ${cost} 馬德幣進入火箭巡航？`;
        const body = this.add.text(cx, py + 92, bodyText, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: panelW - 48 }
        }).setOrigin(0.5);

        const coinInfo = this.add.text(cx, py + 142, isNotice ? '' : `目前持有：${localCoins}　支付後：${afterCoins}`, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // 先把面板與文字放進容器底層；後面建立的按鈕才會顯示在面板上方。
        container.add([panel, title, body, coinInfo]);

        const makeConfirmBtn = (x, y, w, h, label, fillColor, callback) => {
            const btnBg = this.add.rectangle(x, y, w, h, fillColor, 1)
                .setStrokeStyle(3, 0xffffff, 0.9)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(x, y, label, {
                fontSize: '17px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: fillColor === 0xffffff ? '#000000' : '#ffffff',
                stroke: fillColor === 0xffffff ? '#ffffff' : '#000000',
                strokeThickness: fillColor === 0xffffff ? 0 : 3
            }).setOrigin(0.5);

            const hit = this.add.zone(x, y, w + 18, h + 18)
                .setInteractive({ useHandCursor: true });

            const handler = (pointer, localX, localY, event) => {
                if (event && event.stopPropagation) event.stopPropagation();
                callback();
            };

            btnBg.on('pointerdown', handler);
            btnText.setInteractive({ useHandCursor: true }).on('pointerdown', handler);
            hit.on('pointerdown', handler);

            container.add([btnBg, btnText, hit]);
        };

        if (isNotice) {
            makeConfirmBtn(cx, py + panelH - 44, 150, 42, '知道了', 0xffffff, () => {
                safeClosePaymentConfirm();
            });
        } else {
            makeConfirmBtn(cx - 82, py + panelH - 48, 132, 42, '取消', 0x444444, () => {
                safeClosePaymentConfirm();
            });

            makeConfirmBtn(cx + 82, py + panelH - 48, 132, 42, '支付啟動', 0xffffff, () => {
                safePayAndStartRocket();
            });
        }

        // 按鈕已在 makeConfirmBtn() 中加入 container，且建立順序在 panel 之後，
        // 因此會自然顯示在面板上方。這裡不要再把 panel 加回最上層。
    }

    getSoloRocketSafeRect() {
        const cam = this.cameras.main;
        let safeH = cam.height;
        let safeW = safeH * 9 / 16;

        if (safeW > cam.width) {
            safeW = cam.width;
            safeH = safeW * 16 / 9;
        }

        safeW = Math.max(260, Math.min(safeW, cam.width));
        safeH = Math.max(460, Math.min(safeH, cam.height));

        const x = (cam.width - safeW) / 2;

        // 手機直式畫面不要完全置中，稍微往上貼近，避免整體遊戲框偏下。
        const isNarrowScreen = cam.width <= 768;
        const freeY = Math.max(0, cam.height - safeH);
        const y = isNarrowScreen ? Math.max(8, freeY * 0.18) : freeY / 2;

        return {
            x,
            y,
            w: safeW,
            h: safeH,
            centerX: x + safeW / 2,
            centerY: y + safeH / 2
        };
    }

    hideSoloRocketLobbyUi() {
        if (!this.soloRocketPrevUiState) this.soloRocketPrevUiState = { dom: {}, phaser: {}, cameras: {} };

        this.soloRocketDomUiIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!(id in this.soloRocketPrevUiState.dom)) this.soloRocketPrevUiState.dom[id] = el.style.display;
            el.style.display = 'none';
        });

        const uiScene = this.scene.manager.getScene('UIScene');
        if (!uiScene) return;

        const hideKeys = ['statusContainer', 'btnA', 'txtA', 'btnB', 'txtB', 'furnBtn', 'furnText', 'itemBtn', 'itemText', 'partyDash'];
        hideKeys.forEach(key => {
            const obj = uiScene[key];
            if (!obj || !obj.setVisible) return;
            if (!(key in this.soloRocketPrevUiState.phaser)) this.soloRocketPrevUiState.phaser[key] = obj.visible;
            obj.setVisible(false);
        });

        // 火箭巡航是獨立副本畫面，暫時撤除大廳右上小地圖。
        if (this.minimap) {
            if (!this.soloRocketPrevUiState.cameras) this.soloRocketPrevUiState.cameras = {};
            if (!('minimap' in this.soloRocketPrevUiState.cameras)) {
                this.soloRocketPrevUiState.cameras.minimap = this.minimap.visible;
            }

            if (this.minimap.setVisible) this.minimap.setVisible(false);
            else this.minimap.visible = false;
        }

        if (uiScene.joyStick) {
            if (uiScene.joyStick.base && uiScene.joyStick.base.setVisible) {
                uiScene.joyStick.base.setVisible(true);
            }
            if (uiScene.joyStick.thumb && uiScene.joyStick.thumb.setVisible) {
                uiScene.joyStick.thumb.setVisible(true);
            }
        }
    }

    restoreSoloRocketLobbyUi() {
        const prev = this.soloRocketPrevUiState || { dom: {}, phaser: {} };

        Object.keys(prev.dom || {}).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = prev.dom[id];
        });

        const uiScene = this.scene.manager.getScene('UIScene');
        if (uiScene) {
            Object.keys(prev.phaser || {}).forEach(key => {
                const obj = uiScene[key];
                if (obj && obj.setVisible) obj.setVisible(!!prev.phaser[key]);
            });
            if (uiScene.btnA && uiScene.btnA.setVisible) uiScene.btnA.setVisible(true);
            if (uiScene.txtA && uiScene.txtA.setVisible) uiScene.txtA.setVisible(true);
            if (uiScene.btnB && uiScene.btnB.setVisible) uiScene.btnB.setVisible(true);
            if (uiScene.txtB && uiScene.txtB.setVisible) uiScene.txtB.setVisible(true);
            if (uiScene.furnBtn && uiScene.furnBtn.setVisible) uiScene.furnBtn.setVisible(true);
            if (uiScene.furnText && uiScene.furnText.setVisible) uiScene.furnText.setVisible(true);
            if (uiScene.itemBtn && uiScene.itemBtn.setVisible) uiScene.itemBtn.setVisible(true);
            if (uiScene.itemText && uiScene.itemText.setVisible) uiScene.itemText.setVisible(true);
            if (uiScene.statusContainer && uiScene.statusContainer.setVisible) uiScene.statusContainer.setVisible(true);
        }

        if (this.minimap && prev.cameras && ('minimap' in prev.cameras)) {
            if (this.minimap.setVisible) this.minimap.setVisible(!!prev.cameras.minimap);
            else this.minimap.visible = !!prev.cameras.minimap;
        }

        this.soloRocketPrevUiState = null;
    }

    stopLobbyBgmForSoloRocket() {
        const bgms = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire', 'bgm-party', 'shrine-wierd-people-sound', 'shrine-selection', 'shrine-purify-fight', 'shrine-purify-success-win', 'shrine-purify-success'];
        bgms.forEach(key => {
            try { this.sound.getAll(key).forEach(snd => snd.stop()); } catch (_) {}
        });
    }

    playSoloRocketBgm() {
        try {
            this.sound.getAll('solo-rocket-cruise-bgm').forEach(snd => {
                snd.stop();
                if (snd.destroy) snd.destroy();
            });

            if (!this.cache.audio.exists('solo-rocket-cruise-bgm')) {
                console.warn('[火箭巡航] 找不到 solo-rocket-cruise-bgm.mp3，已略過音樂播放。');
                return;
            }

            const volControl = document.getElementById('bgm-volume');
            const vol = volControl ? Number(volControl.value || 100) / 100 : 0.8;
            this.soloRocketBgm = this.sound.add('solo-rocket-cruise-bgm', { loop: false, volume: vol });
            this.soloRocketBgm.play();
        } catch (err) {
            console.warn('[火箭巡航] BGM 播放失敗，timer 仍會繼續：', err);
        }
    }

    stopSoloRocketBgm() {
        try {
            if (this.soloRocketBgm) {
                this.soloRocketBgm.stop();
                if (this.soloRocketBgm.destroy) this.soloRocketBgm.destroy();
            }
            this.sound.getAll('solo-rocket-cruise-bgm').forEach(snd => {
                snd.stop();
                if (snd.destroy) snd.destroy();
            });
        } catch (err) {
            console.warn('[火箭巡航] 停止 BGM 失敗，已略過：', err);
        }
        this.soloRocketBgm = null;
    }

    playSoloRocketIntroSfx(key) {
        try {
            if (window.GameLogic.muteSFX) return;

            if (!this.cache.audio.exists(key)) {
                console.warn(`[火箭巡航] 找不到 ${key}.mp3，已略過音效。`);
                return;
            }

            const sfxControl = document.getElementById('sfx-volume');
            const vol = sfxControl
                ? Number(sfxControl.value || 100) / 100
                : (window.GameLogic.sfxVolume !== undefined ? Number(window.GameLogic.sfxVolume || 100) / 100 : 1);

            if (!Number.isFinite(vol) || vol <= 0) return;

            this.sound.play(key, { volume: vol });
        } catch (err) {
            console.warn(`[火箭巡航] 播放 ${key} 失敗，已略過：`, err);
        }
    }
  
  
    resumeLobbyBgmAfterSoloRocket() {
        if (this.sceneName === 'shrine' || this.sceneName === 'partyroom') return;

        const bgms = ['bgm', 'bgm-heart', 'bgm-inside', 'bgm-kyo', 'bgm-world', 'bgm-lazy', 'bgm-way', 'bgm-corazon', 'bgm-fire'];
        const trackKey = bgms[window.GameLogic.currentTrackIdx || 0] || 'bgm';
        const volControl = document.getElementById('bgm-volume');
        const vol = volControl ? Number(volControl.value || 100) / 100 : 0.8;

        try {
            bgms.forEach(key => {
                if (key !== trackKey) this.sound.getAll(key).forEach(snd => snd.stop());
            });

            if (!this.cache.audio.exists(trackKey)) {
                console.warn('[火箭巡航] 返回大廳時找不到原本蔥Music：', trackKey);
                return;
            }

            let current = this.sound.get(trackKey);
            if (!current || !current.isPlaying) {
                this.sound.removeByKey(trackKey);
                this.sound.add(trackKey, { loop: true, volume: vol }).play();
            } else {
                current.setVolume(vol);
            }
        } catch (err) {
            console.warn('[火箭巡航] 恢復大廳音樂失敗，已略過：', err);
        }
    }

    startSoloRocketCruise() {
        if (this.soloRocketCruiseActive || !this.localPlayer || !this.localPlayer.sprite) return;

        try {
            this.soloRocketCruiseActive = true;
            this.soloRocketCruiseFinished = false;
            this.soloRocketGameplayStarted = false;
            this.soloRocketTutorialActive = true;
            this.soloRocketIntroActive = false;
            this.soloRocketEndingActive = false;
            this.soloRocketInputLocked = true;
            this.soloRocketEndingRushStarted = false;
            this.soloRocketEndingFadeStarted = false;
            window.GameLogic.soloRocketCruiseActive = true;

            // 注意：正式倒數與火箭 BGM 不能在這裡開始。
            // 這裡只建立副本畫面與教學面板，按「開始遊戲」後才設定 startTime、播放 BGM。
            this.soloRocketStartTime = 0;
            this.soloRocketDurationMs = 157000;
            this.soloRocketLifeValue = 100;
            this.soloRocketMaxMonsters = 120;
            this.resetSoloRocketStage4State();
            this.soloRocketRunSummary = null;
            this.soloRocketMoonBudget = 0;
            this.soloRocketMoonBudgetLeft = 0;
            this.soloRocketMoonShopPurchases = {};
            this.soloRocketMoonShardBoughtThisRun = false;
            this.soloRocketMoonShopFinalized = false;
            this.soloRocketMoonShopFinalizing = false;
            this.soloRocketMoonFinalResult = null;
            this.soloRocketReturnPosition = {
                x: this.localPlayer.sprite.x,
                y: this.localPlayer.sprite.y
            };

            window.GameLogic.placingFurnitureKey = null;
            window.GameLogic.armedItemState = null;
            window.GameLogic.armedItemName = null;

            this.hideSoloRocketLobbyUi();
            this.stopLobbyBgmForSoloRocket();

            this.localPlayer.sprite.setVelocity(0, 0);
            this.localPlayer.sprite.setVisible(false);
            if (this.localPlayer.sprite.body) this.localPlayer.sprite.body.enable = false;
            if (this.localPlayer.nameContainer) this.localPlayer.nameContainer.setVisible(false);
            if (this.localPlayer.bubbleContainer) this.localPlayer.bubbleContainer.setVisible(false);
            if (this.localPlayer.partyScoreContainer) this.localPlayer.partyScoreContainer.setVisible(false);
            if (this.localPlayer.localAura) this.localPlayer.localAura.setVisible(false);

            this.createSoloRocketCruiseLayer();
            this.showSoloRocketTutorial();
        } catch (err) {
            console.warn('[火箭巡航] 啟動教學畫面失敗，已清理回大廳：', err);
            alert('火箭巡航啟動失敗，已返回大廳。');
            this.clearSoloRocketCruise(false);
        }
    }

    showSoloRocketTutorial() {
        this.clearSoloRocketTutorial();

        const cam = this.cameras.main;
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const panelW = Math.min(rect.w - 28, 430);
        const panelH = Math.min(rect.h - 30, 500);
        const px = rect.centerX - panelW / 2;
        const py = rect.centerY - panelH / 2;

        const container = this.add.container(0, 0)
            .setDepth(9900)
            .setScrollFactor(0);

        this.soloRocketTutorialContainer = container;
        this.soloRocketTutorialStartPending = false;

        const fullBlocker = this.add.zone(cam.width / 2, cam.height / 2, cam.width, cam.height)
            .setInteractive();

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.78).fillRoundedRect(px, py, panelW, panelH, 18);
        panel.lineStyle(5, 0x8a2be2, 1).strokeRoundedRect(px, py, panelW, panelH, 18);
        panel.lineStyle(2, 0xff00ff, 0.85).strokeRoundedRect(px + 8, py + 8, panelW - 16, panelH - 16, 14);

        const title = this.add.text(rect.centerX, py + 42, '火箭巡航教學', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#8a2be2',
            strokeThickness: 5
        }).setOrigin(0.5);

        const body = this.add.text(rect.centerX, py + 78,
            '『我的一小滴淚，是洋蔥的汪洋』\n' +
            '曾經登上月球的宇宙洋蔥如是說\n\n' +
            '搖桿或鍵盤方向鍵控制方向\n' +
            '「發射」(空白鍵) 擊殺宇宙雞雞\n' +
            '「旋轉」(ALT鍵) 可掃開一切[冷卻3秒]\n' +
            '「放大絕」(Enter) 發射打中10次東西才會出現\n\n' +
            '勇敢飛向月球吧!!!\n' +
            '找到玉兔星人好好國民外交一番\n' +
            'GOOD LUCK ! 🍀',
            {
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 7,
                wordWrap: { width: panelW - 30 }
            }
        ).setOrigin(0.5, 0);

        const btnY = py + panelH - 56;
        const btnW = 180;
        const btnH = 46;
        const hitW = btnW + 42;
        const hitH = btnH + 30;

        const btnBg = this.add.rectangle(rect.centerX, btnY, btnW, btnH, 0xffffff, 1)
            .setStrokeStyle(3, 0xeeeeff, 1)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(rect.centerX, btnY, '開始遊戲', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const startHit = this.add.zone(rect.centerX, btnY, hitW, hitH)
            .setInteractive({ useHandCursor: true });

        const isPointInStart = (pointer) => {
            if (!pointer) return false;
            const pxNow = Number(pointer.x);
            const pyNow = Number(pointer.y);
            if (!Number.isFinite(pxNow) || !Number.isFinite(pyNow)) return false;

            return pxNow >= rect.centerX - hitW / 2 &&
                   pxNow <= rect.centerX + hitW / 2 &&
                   pyNow >= btnY - hitH / 2 &&
                   pyNow <= btnY + hitH / 2;
        };

        const start = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (this.soloRocketGameplayStarted || this.soloRocketTutorialStartPending) return;

            this.soloRocketTutorialStartPending = true;

            this.tweens.add({
                targets: [btnBg, btnText],
                scaleX: 0.94,
                scaleY: 0.94,
                yoyo: true,
                duration: 80,
                onComplete: () => {
                    this.startSoloRocketGameplay();
                }
            });

            // 防呆：若某些裝置沒有正常跑完 tween，也不要卡在教學畫面。
            this.time.delayedCall(180, () => {
                if (!this.soloRocketGameplayStarted && this.soloRocketTutorialStartPending) {
                    this.startSoloRocketGameplay();
                }
            });
        };

        const tryStartFromPointer = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (isPointInStart(pointer)) start(pointer, localX, localY, event);
        };

        fullBlocker.on('pointerdown', tryStartFromPointer);
        fullBlocker.on('pointerup', tryStartFromPointer);

        btnBg.on('pointerdown', start);
        btnBg.on('pointerup', start);
        btnText.on('pointerdown', start);
        btnText.on('pointerup', start);
        startHit.on('pointerdown', start);
        startHit.on('pointerup', start);

        // 關鍵修正：避免 fullBlocker 在部分裝置上攔截按鈕事件後，按鈕沒有收到 pointer。
        this.soloRocketTutorialPointerHandler = tryStartFromPointer;
        this.input.on('pointerdown', this.soloRocketTutorialPointerHandler);
        this.input.on('pointerup', this.soloRocketTutorialPointerHandler);

        container.add([fullBlocker, panel, title, body, btnBg, btnText, startHit]);
    }

    clearSoloRocketTutorial() {
        try {
            if (this.soloRocketTutorialPointerHandler && this.input) {
                this.input.off('pointerdown', this.soloRocketTutorialPointerHandler);
                this.input.off('pointerup', this.soloRocketTutorialPointerHandler);
            }
        } catch (err) {
            console.warn('[火箭巡航] 教學點擊監聽清理失敗，已略過：', err);
        }

        try {
            if (this.soloRocketTutorialContainer) this.soloRocketTutorialContainer.destroy(true);
        } catch (err) {
            console.warn('[火箭巡航] 教學介面清理失敗，已略過：', err);
        }

        this.soloRocketTutorialPointerHandler = null;
        this.soloRocketTutorialStartPending = false;
        this.soloRocketTutorialContainer = null;
    }

    startSoloRocketGameplay() {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished || this.soloRocketGameplayStarted) return;

        this.clearSoloRocketTutorial();

        this.soloRocketGameplayStarted = true;
        this.soloRocketTutorialActive = false;
        this.soloRocketIntroActive = true;
        this.soloRocketInputLocked = true;
        this.soloRocketEndingActive = false;
        this.soloRocketEndingRushStarted = false;
        this.soloRocketEndingFadeStarted = false;
        this.soloRocketStartTime = Date.now();

        this.stopLobbyBgmForSoloRocket();
        this.playSoloRocketBgm();

        if (this.soloRocketCountdownText) this.soloRocketCountdownText.setText('剩餘 2:37');

        if (this.soloRocketTimer) this.soloRocketTimer.remove(false);
        this.soloRocketTimer = this.time.delayedCall(this.soloRocketDurationMs, () => {
            this.finishSoloRocketCruise();
        });

        this.soloRocketMonsterStartTimer = this.time.delayedCall(12000, () => {
            this.soloRocketMonsterStartTimer = null;
            if (this.soloRocketCruiseActive && !this.soloRocketCruiseFinished) {
                this.startSoloRocketMonsterSpawning();
            }
        });

        this.soloRocketMonsterStopTimer = this.time.delayedCall(152000, () => {
            this.soloRocketMonsterStopTimer = null;
            this.stopSoloRocketMonsterSpawning();
        });

        this.startSoloRocketIntroTimeline();
    }

    clearSoloRocketIntroFx() {
        try {
            if (this.soloRocketIntroShakeTween) {
                if (this.soloRocketIntroShakeTween.stop) this.soloRocketIntroShakeTween.stop();
                if (this.soloRocketIntroShakeTween.remove) this.soloRocketIntroShakeTween.remove();
            }
        } catch (_) {}
        this.soloRocketIntroShakeTween = null;

        try {
            if (this.soloRocketPlayer && this.tweens) {
                this.tweens.killTweensOf(this.soloRocketPlayer);
            }
        } catch (_) {}

        try {
            (this.soloRocketIntroTweens || []).forEach(tw => {
                if (!tw) return;
                if (tw.stop) tw.stop();
                if (tw.remove) tw.remove();
            });
        } catch (_) {}

        try {
            (this.soloRocketIntroTimers || []).forEach(timer => {
                if (timer && timer.remove) timer.remove(false);
            });
        } catch (_) {}

        try {
            (this.soloRocketIntroFxObjects || []).forEach(obj => {
                if (obj && obj.destroy) obj.destroy();
            });
        } catch (_) {}

        try {
            if (this.soloRocketMoonRabbitContainer) this.soloRocketMoonRabbitContainer.destroy(true);
        } catch (err) {
            console.warn('[火箭巡航] 玉兔通訊清理失敗，已略過：', err);
        }

        this.soloRocketIntroTweens = [];
        this.soloRocketIntroTimers = [];
        this.soloRocketIntroFxObjects = [];
        this.soloRocketMoonRabbitContainer = null;
    }

    startSoloRocketIntroTimeline() {
        this.clearSoloRocketIntroFx();

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const rocket = this.soloRocketPlayer;
        if (!rocket) {
            this.soloRocketInputLocked = false;
            this.soloRocketIntroActive = false;
            return;
        }

        const finalX = rect.centerX;
        const finalY = rect.y + rect.h * 0.72;
        const topX = rect.centerX;
        const topY = rect.y + rect.h * 0.32;

        const finalScaleX = rocket.scaleX || 1;
        const finalScaleY = rocket.scaleY || 1;
        const baseW = Math.max(rocket.displayWidth || this.soloRocketPlayerRadius * 2 || 60, 40);
        const introScale = Phaser.Math.Clamp(Math.max(rect.w, rect.h) / baseW * 0.78, 4.2, 10);

        rocket.setPosition(rect.centerX, rect.centerY - rect.h * 0.06);
        rocket.setScale(finalScaleX * introScale, finalScaleY * introScale);
        rocket.setAngle(0);
        rocket.setAlpha(1);

        const landingSfxTimer = this.time.delayedCall(1000, () => {
            this.playSoloRocketIntroSfx('solo-rocket-landing');
        });

        const landingTween = this.tweens.add({
            targets: rocket,
            x: topX,
            y: topY,
            scaleX: finalScaleX * 1.08,
            scaleY: finalScaleY * 1.08,
            duration: 1900,
            ease: 'Cubic.easeOut'
        });

        const circleDriver = { t: 0 };
        const circleTween = this.tweens.add({
            targets: circleDriver,
            t: 1,
            delay: 1900,
            duration: 1800,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                const ang = circleDriver.t * Math.PI * 2 - Math.PI / 2;
                const rx = Math.min(rect.w * 0.18, 72);
                const ry = Math.min(rect.h * 0.09, 54);
                rocket.x = topX + Math.cos(ang) * rx;
                rocket.y = topY + Math.sin(ang) * ry;
                rocket.angle = Math.sin(ang) * 10;
            },
            onComplete: () => {
                rocket.setAngle(0);
            }
        });

        const settleTween = this.tweens.add({
            targets: rocket,
            x: finalX,
            y: finalY,
            scaleX: finalScaleX,
            scaleY: finalScaleY,
            angle: 0,
            delay: 3700,
            duration: 1300,
            ease: 'Cubic.easeInOut'
        });

        this.soloRocketIntroTweens.push(landingTween, circleTween, settleTween);
        this.soloRocketIntroTimers.push(landingSfxTimer);

        const powerFxTimer = this.time.delayedCall(6000, () => {
            if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished || !rocket.active) return;

            this.playSoloRocketIntroSfx('solo-rocket-radio_beep');
            this.showSoloRocketMoonRabbitComms();

            rocket.setPosition(finalX, finalY);
            rocket.setScale(finalScaleX, finalScaleY);

            const shakeTween = this.tweens.add({
                targets: rocket,
                x: { from: finalX - 3, to: finalX + 3 },
                y: { from: finalY - 2, to: finalY + 2 },
                angle: { from: -1.4, to: 1.4 },
                yoyo: true,
                repeat: -1,
                duration: 55,
                ease: 'Sine.easeInOut'
            });

            this.soloRocketIntroShakeTween = shakeTween;
            this.soloRocketIntroTweens.push(shakeTween);

            const emitYellowRing = () => {
                if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

                const ring = this.add.circle(finalX, finalY, Math.min(rect.w, rect.h) * 0.065, 0xffff00, 0)
                    .setStrokeStyle(3, 0xffee55, 0.95)
                    .setDepth(9755)
                    .setScrollFactor(0);

                this.soloRocketIntroFxObjects = this.soloRocketIntroFxObjects || [];
                this.soloRocketIntroFxObjects.push(ring);

                const ringTween = this.tweens.add({
                    targets: ring,
                    scale: 3.6,
                    alpha: 0,
                    duration: 950,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        try {
                            ring.destroy();
                            this.soloRocketIntroFxObjects = (this.soloRocketIntroFxObjects || []).filter(obj => obj !== ring);
                        } catch (_) {}
                    }
                });

                this.soloRocketIntroTweens.push(ringTween);
            };

            emitYellowRing();

            const ringTimer = this.time.addEvent({
                delay: 430,
                repeat: 10,
                callback: emitYellowRing
            });

            this.soloRocketIntroTimers.push(ringTimer);
        });

        const unlockTimer = this.time.delayedCall(11000, () => {
            this.playSoloRocketIntroSfx('solo-rocket-radio_beep');

            // 關鍵修正：
            // 第 11 秒一到，先強制停止火箭震動並解除操作鎖。
            // 不再把「恢復操控」依賴後面的 GLITCH 消失動畫或 190ms 延遲 timer。
            try {
                if (this.soloRocketIntroShakeTween) {
                    if (this.soloRocketIntroShakeTween.stop) this.soloRocketIntroShakeTween.stop();
                    if (this.soloRocketIntroShakeTween.remove) this.soloRocketIntroShakeTween.remove();
                }
            } catch (_) {}
            this.soloRocketIntroShakeTween = null;

            try {
                if (this.tweens && rocket) this.tweens.killTweensOf(rocket);
            } catch (_) {}

            if (this.soloRocketCruiseActive && !this.soloRocketCruiseFinished) {
                this.soloRocketIntroActive = false;
                this.soloRocketInputLocked = false;

                if (rocket && rocket.active) {
                    rocket.setPosition(finalX, finalY);
                    rocket.setScale(finalScaleX, finalScaleY);
                    rocket.setAngle(0);
                    rocket.setAlpha(1);
                }
            }

            const comms = this.soloRocketMoonRabbitContainer;
            if (comms && comms.active) {
                try {
                    this.tweens.killTweensOf(comms);
                    if (comms.list) {
                        comms.list.forEach(child => {
                            if (child) this.tweens.killTweensOf(child);
                        });
                    }

                    for (let i = 0; i < 8; i++) {
                        const bar = this.add.rectangle(
                            rect.x + Phaser.Math.Between(24, Math.floor(rect.w - 24)),
                            rect.y + Phaser.Math.Between(70, Math.floor(rect.h * 0.48)),
                            Phaser.Math.Between(28, 110),
                            Phaser.Math.Between(3, 9),
                            [0xffffff, 0x00ffff, 0xff00ff, 0xffff00][i % 4],
                            0.88
                        ).setDepth(9765).setScrollFactor(0);

                        this.soloRocketIntroFxObjects.push(bar);

                        this.tweens.add({
                            targets: bar,
                            x: bar.x + Phaser.Math.Between(-42, 42),
                            alpha: 0,
                            duration: Phaser.Math.Between(80, 150),
                            ease: 'Stepped',
                            onComplete: () => {
                                try { bar.destroy(); } catch (_) {}
                            }
                        });
                    }

                    this.tweens.add({
                        targets: comms,
                        x: { from: -10, to: 10 },
                        y: { from: 5, to: -5 },
                        alpha: { from: 1, to: 0.25 },
                        scaleX: { from: 1.03, to: 0.96 },
                        scaleY: { from: 0.96, to: 1.04 },
                        yoyo: true,
                        repeat: 4,
                        duration: 26,
                        ease: 'Stepped',
                        onComplete: () => {
                            try {
                                if (comms && comms.active) comms.setVisible(false);
                            } catch (_) {}
                        }
                    });
                } catch (_) {}
            }

            const finishUnlock = this.time.delayedCall(190, () => {
                // 這裡只負責清除玉兔通訊、黃光圈、雜訊條等視覺殘留。
                // 操控解鎖已在第 11 秒當下完成，避免被清理 timer 影響。
                this.clearSoloRocketIntroFx();

                if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

                this.soloRocketIntroActive = false;
                this.soloRocketInputLocked = false;

                if (rocket && rocket.active) {
                    rocket.setPosition(finalX, finalY);
                    rocket.setScale(finalScaleX, finalScaleY);
                    rocket.setAngle(0);
                    rocket.setAlpha(1);
                }
            });

            this.soloRocketIntroTimers.push(finishUnlock);
        });

        this.soloRocketIntroTimers.push(powerFxTimer, unlockTimer);
    }
    showSoloRocketMoonRabbitComms() {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        try {
            if (this.soloRocketMoonRabbitContainer) this.soloRocketMoonRabbitContainer.destroy(true);
        } catch (_) {}

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const container = this.add.container(0, 0)
            .setDepth(9760)
            .setScrollFactor(0);

        this.soloRocketMoonRabbitContainer = container;

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');

        const msg =
            `月球管制收到：${yyyy}/${mm}/${dd} ${hh}:${mi}\n` +
            `洋蔥火箭正在靠近月球。\n` +
            `請穩定航道，期待相見！`;

        const rabbitSize = Math.min(96, rect.w * 0.24);
        const rabbitX = rect.x + rect.w - rabbitSize * 0.62;
        const rabbitY = rect.y + rect.h * 0.36;

        let rabbit;
        if (this.textures.exists('solo-rocket-moon-rabbit')) {
            rabbit = this.add.image(rabbitX, rabbitY, 'solo-rocket-moon-rabbit')
                .setDisplaySize(rabbitSize, rabbitSize)
                .setAlpha(0);
        } else {
            rabbit = this.add.text(rabbitX, rabbitY, '🐰', {
                fontSize: `${Math.round(rabbitSize * 0.68)}px`
            }).setOrigin(0.5).setAlpha(0);
        }

        const bubbleW = Math.min(rect.w - 44, 328);
        const bubbleH = 150;
        const bubbleX = rect.x + 18;
        const bubbleY = Math.max(rect.y + 78, rabbitY - bubbleH / 2);

        const bubble = this.add.graphics().setAlpha(0);
        bubble.fillStyle(0xffffff, 0.92).fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 14);
        bubble.lineStyle(3, 0x8a2be2, 1).strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 14);
        bubble.fillStyle(0xffffff, 0.92).fillTriangle(
            bubbleX + bubbleW,
            bubbleY + bubbleH * 0.56,
            bubbleX + bubbleW + 18,
            bubbleY + bubbleH * 0.66,
            bubbleX + bubbleW,
            bubbleY + bubbleH * 0.76
        );

        const txt = this.add.text(bubbleX + 15, bubbleY + 15, '', {
            fontSize: '17px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#111111',
            lineSpacing: 10,
            wordWrap: { width: bubbleW - 30, useAdvancedWrap: true }
        }).setAlpha(0);

        container.add([bubble, txt, rabbit]);
        container.setAlpha(1);
        container.setScale(1, 1);

        const noiseBars = [];
        const glitchColors = [0xffffff, 0x00ffff, 0xff00ff, 0xffff00];

        for (let i = 0; i < 14; i++) {
            const bar = this.add.rectangle(
                rect.x + Phaser.Math.Between(18, Math.floor(rect.w - 18)),
                rect.y + Phaser.Math.Between(68, Math.floor(rect.h * 0.48)),
                Phaser.Math.Between(24, 130),
                Phaser.Math.Between(3, 10),
                glitchColors[i % glitchColors.length],
                0
            ).setScrollFactor(0);

            noiseBars.push(bar);
            container.add(bar);
        }

        const glitchState = { tick: 0 };
        const appearGlitch = this.time.addEvent({
            delay: 42,
            repeat: 7,
            callback: () => {
                glitchState.tick += 1;

                container.setX(Phaser.Math.Between(-10, 10));
                container.setY(Phaser.Math.Between(-5, 5));
                container.setScale(
                    Phaser.Math.FloatBetween(0.96, 1.04),
                    Phaser.Math.FloatBetween(0.96, 1.04)
                );

                const flashAlpha = glitchState.tick % 2 === 0 ? 1 : 0.18;
                bubble.setAlpha(flashAlpha);
                rabbit.setAlpha(flashAlpha);
                txt.setAlpha(0);

                noiseBars.forEach(bar => {
                    bar.setPosition(
                        rect.x + Phaser.Math.Between(18, Math.floor(rect.w - 18)),
                        rect.y + Phaser.Math.Between(68, Math.floor(rect.h * 0.48))
                    );
                    bar.setSize(Phaser.Math.Between(24, 130), Phaser.Math.Between(3, 10));
                    bar.setAlpha(Phaser.Math.FloatBetween(0.35, 0.95));
                });
            },
            callbackScope: this
        });

        const appearDone = this.time.delayedCall(390, () => {
            if (!container || !container.active) return;

            container.setX(0);
            container.setY(0);
            container.setScale(1, 1);
            bubble.setAlpha(1);
            rabbit.setAlpha(1);
            txt.setAlpha(1);

            noiseBars.forEach(bar => {
                try { bar.destroy(); } catch (_) {}
            });

            const chars = Array.from(msg);
            let idx = 0;
            const typeDelay = Math.max(24, Math.floor(3900 / Math.max(chars.length, 1)));

            const typeTimer = this.time.addEvent({
                delay: typeDelay,
                repeat: chars.length - 1,
                callback: () => {
                    if (!txt || !txt.active) return;
                    idx += 1;
                    txt.setText(chars.slice(0, idx).join(''));
                }
            });

            const typingSfx1 = this.time.delayedCall(120, () => {
                this.playSoloRocketIntroSfx('solo-rocket-typing');
            });

            const typingSfx2 = this.time.delayedCall(2450, () => {
                this.playSoloRocketIntroSfx('solo-rocket-typing');
            });

            this.soloRocketIntroTimers.push(typeTimer, typingSfx1, typingSfx2);
        });

        this.soloRocketIntroTimers.push(appearGlitch, appearDone);

        const rabbitFloatTween = this.tweens.add({
            targets: rabbit,
            y: rabbitY - 7,
            yoyo: true,
            repeat: -1,
            duration: 650,
            ease: 'Sine.easeInOut'
        });

        this.soloRocketIntroTweens.push(rabbitFloatTween);
    }

    showSoloRocketStage6RabbitComms(message) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        this.hideSoloRocketStage6RabbitComms(true);

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const container = this.add.container(0, 0)
            .setDepth(9766)
            .setScrollFactor(0);

        this.soloRocketRabbitComms = container;

        const safeMessage = String(message || '');
        const rabbitSize = Math.min(82, rect.w * 0.20);
        const rabbitX = rect.x + rect.w - rabbitSize * 0.68;
        const rabbitY = rect.y + rect.h * 0.26;

        let rabbit;
        if (this.textures.exists('solo-rocket-moon-rabbit')) {
            rabbit = this.add.image(rabbitX, rabbitY, 'solo-rocket-moon-rabbit')
                .setDisplaySize(rabbitSize, rabbitSize);
        } else {
            rabbit = this.add.text(rabbitX, rabbitY, '🐰', {
                fontSize: `${Math.round(rabbitSize * 0.68)}px`
            }).setOrigin(0.5);
        }

        const bubbleW = Math.min(rect.w - rabbitSize - 42, 310);
        const bubbleH = 142;
        const bubbleX = rect.x + 16;
        const bubbleY = Math.max(rect.y + 44, rabbitY - bubbleH / 2 + 4);

        const bubble = this.add.graphics();
        bubble.fillStyle(0xffffff, 0.95).fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 14);
        bubble.lineStyle(4, 0x8a2be2, 1).strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 14);
        bubble.lineStyle(2, 0x00ffff, 0.55).strokeRoundedRect(bubbleX + 6, bubbleY + 6, bubbleW - 12, bubbleH - 12, 10);
        bubble.fillStyle(0xffffff, 0.95).fillTriangle(
            bubbleX + bubbleW,
            bubbleY + bubbleH * 0.43,
            bubbleX + bubbleW + 18,
            bubbleY + bubbleH * 0.52,
            bubbleX + bubbleW,
            bubbleY + bubbleH * 0.61
        );

        const label = this.add.text(bubbleX + 15, bubbleY + 10, '月球管制緊急通訊', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#6a00a8'
        });

        const txt = this.add.text(bubbleX + 15, bubbleY + 40, '', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#111111',
            lineSpacing: 12,
            wordWrap: { width: bubbleW - 30, useAdvancedWrap: true }
        });

        const noiseBars = [];
        const glitchColors = [0xffffff, 0x00ffff, 0xff00ff, 0xffff00];
        for (let i = 0; i < 12; i++) {
            const bar = this.add.rectangle(
                rect.x + Phaser.Math.Between(18, Math.floor(rect.w - 18)),
                rect.y + Phaser.Math.Between(40, Math.floor(rect.h * 0.45)),
                Phaser.Math.Between(26, 132),
                Phaser.Math.Between(3, 9),
                glitchColors[i % glitchColors.length],
                0
            ).setScrollFactor(0).setDepth(9767);
            noiseBars.push(bar);
        }

        container.add([bubble, label, txt, rabbit]);

        noiseBars.forEach(function(bar) {
            container.add(bar);
        });

        container.setAlpha(0);
        container.setScale(0.98);

        this.playSoloRocketIntroSfx('solo-rocket-radio_beep');

        this.tweens.add({
            targets: container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 180,
            ease: 'Cubic.easeOut'
        });

        const glitchState = { tick: 0 };
        const glitchTimer = this.time.addEvent({
            delay: 46,
            repeat: 8,
            callback: () => {
                if (!container || !container.active) return;
                glitchState.tick += 1;
                container.setX(Phaser.Math.Between(-8, 8));
                container.setY(Phaser.Math.Between(-4, 4));
                const flashAlpha = glitchState.tick % 2 === 0 ? 1 : 0.24;
                bubble.setAlpha(flashAlpha);
                label.setAlpha(flashAlpha);
                rabbit.setAlpha(flashAlpha);
                noiseBars.forEach(bar => {
                    bar.setPosition(
                        rect.x + Phaser.Math.Between(18, Math.floor(rect.w - 18)),
                        rect.y + Phaser.Math.Between(40, Math.floor(rect.h * 0.45))
                    );
                    bar.setSize(Phaser.Math.Between(26, 132), Phaser.Math.Between(3, 9));
                    bar.setAlpha(Phaser.Math.FloatBetween(0.38, 0.92));
                });
            },
            callbackScope: this
        });

        const cleanupGlitchTimer = this.time.delayedCall(560, () => {
            if (!container || !container.active) return;
            container.setX(0);
            container.setY(0);
            bubble.setAlpha(1);
            label.setAlpha(1);
            rabbit.setAlpha(1);
            noiseBars.forEach(bar => {
                try { bar.setAlpha(0); } catch (_) {}
            });
        });

        container.__soloRocketFxTimers = [glitchTimer, cleanupGlitchTimer];
        container.__soloRocketNoiseBars = noiseBars;

        const floatTween = this.tweens.add({
            targets: rabbit,
            y: rabbitY - 7,
            yoyo: true,
            repeat: -1,
            duration: 680,
            ease: 'Sine.easeInOut'
        });
        container.__soloRocketFxTweens = [floatTween];

        const displayChars = Array.from(safeMessage);
        let idx = 0;
        const typeDelay = 30;

        if (this.soloRocketRabbitTypingTimer) {
            try { this.soloRocketRabbitTypingTimer.remove(false); } catch (_) {}
            this.soloRocketRabbitTypingTimer = null;
        }

        this.soloRocketRabbitTypingTimer = this.time.addEvent({
            delay: typeDelay,
            repeat: Math.max(0, displayChars.length - 1),
            callback: () => {
                if (!txt || !txt.active) return;
                idx += 1;
                txt.setText(displayChars.slice(0, idx).join(''));
                this.soloRocketRabbitTypingIndex = idx;
                if (idx === 1 || idx % 18 === 0) {
                    this.playSoloRocketIntroSfx('solo-rocket-typing');
                }
            },
            callbackScope: this
        });

        const finishTypingTimer = this.time.delayedCall(1800, () => {
            if (txt && txt.active) txt.setText(safeMessage);
        });
        container.__soloRocketFxTimers.push(finishTypingTimer);
    }

    hideSoloRocketStage6RabbitComms(silent = false) {
        const container = this.soloRocketRabbitComms;
        this.soloRocketRabbitComms = null;
        this.soloRocketRabbitTypingIndex = 0;

        try {
            if (this.soloRocketRabbitTypingTimer) this.soloRocketRabbitTypingTimer.remove(false);
        } catch (_) {}
        this.soloRocketRabbitTypingTimer = null;

        if (!container) return;

        try {
            (container.__soloRocketFxTimers || []).forEach(timer => {
                if (timer && timer.remove) timer.remove(false);
            });
        } catch (_) {}

        try {
            (container.__soloRocketFxTweens || []).forEach(tween => {
                if (!tween) return;
                if (tween.stop) tween.stop();
                if (tween.remove) tween.remove();
            });
        } catch (_) {}

        if (!silent) this.playSoloRocketIntroSfx('solo-rocket-radio_beep');

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const bars = [];
        const glitchColors = [0xffffff, 0x00ffff, 0xff00ff, 0x8a2be2];
        for (let i = 0; i < 16; i++) {
            const bar = this.add.rectangle(
                rect.x + Phaser.Math.Between(8, Math.floor(rect.w - 8)),
                rect.y + Phaser.Math.Between(36, Math.floor(rect.h * 0.48)),
                Phaser.Math.Between(36, 180),
                Phaser.Math.Between(3, 11),
                glitchColors[i % glitchColors.length],
                Phaser.Math.FloatBetween(0.45, 0.95)
            ).setDepth(9768).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
            bars.push(bar);
        }

        try {
            this.tweens.killTweensOf(container);
            let ticks = 0;
            const glitchTimer = this.time.addEvent({
                delay: 38,
                repeat: 7,
                callback: () => {
                    ticks += 1;
                    if (container && container.active) {
                        container.setX(Phaser.Math.Between(-16, 16));
                        container.setY(Phaser.Math.Between(-7, 7));
                        container.setAlpha(ticks % 2 === 0 ? 0.92 : 0.22);
                    }
                    bars.forEach(bar => {
                        if (!bar || !bar.active) return;
                        bar.setPosition(
                            rect.x + Phaser.Math.Between(8, Math.floor(rect.w - 8)),
                            rect.y + Phaser.Math.Between(36, Math.floor(rect.h * 0.48))
                        );
                        bar.setSize(Phaser.Math.Between(36, 180), Phaser.Math.Between(3, 11));
                        bar.setAlpha(Phaser.Math.FloatBetween(0.35, 0.95));
                    });
                },
                callbackScope: this
            });

            this.time.delayedCall(360, () => {
                try { if (glitchTimer && glitchTimer.remove) glitchTimer.remove(false); } catch (_) {}
                bars.forEach(bar => { try { if (bar && bar.destroy) bar.destroy(); } catch (_) {} });
                try { if (container && container.destroy) container.destroy(true); } catch (_) {}
            });
        } catch (_) {
            bars.forEach(bar => { try { if (bar && bar.destroy) bar.destroy(); } catch (_) {} });
            try { if (container && container.destroy) container.destroy(true); } catch (_) {}
        }
    }

    pauseSoloRocketStage6FirstWarningSpawns() {
        if (this.__soloRocketStage6Pause1Applied) return;
        this.__soloRocketStage6Pause1Applied = true;

        try {
            if (this.soloRocketMonsterSpawnTimer) this.soloRocketMonsterSpawnTimer.remove(false);
        } catch (_) {}
        this.soloRocketMonsterSpawnTimer = null;
        this.soloRocketMonsterSpawnActive = false;

        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidNextSpawnAt = 64000;
    }

    resumeSoloRocketStage6FirstWarningSpawns() {
        if (!this.__soloRocketStage6Pause1Applied || this.__soloRocketStage6Pause1Released) return;
        this.__soloRocketStage6Pause1Released = true;

        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        this.soloRocketAsteroidSpawnActive = true;
        if (!this.soloRocketAsteroidNextSpawnAt || this.soloRocketAsteroidNextSpawnAt < 64000) {
            this.soloRocketAsteroidNextSpawnAt = 64000;
        }

        if (!this.soloRocketMonsterSpawnStopped && (this.soloRocketMonsterSpawnedCount || 0) < (this.soloRocketMaxMonsters || 120)) {
            this.soloRocketMonsterSpawnActive = false;
            this.startSoloRocketMonsterSpawning();
        }
    }

    updateSoloRocketStage6WarningTimeline(elapsed) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        if (elapsed >= 55000 && elapsed < 64000) {
            this.pauseSoloRocketStage6FirstWarningSpawns();
        }

        if (elapsed >= 56000 && !this.soloRocketBossWarning1Shown) {
            this.soloRocketBossWarning1Shown = true;
            this.showSoloRocketStage6RabbitComms('呼叫！呼叫！洋蔥！\n隕石大量發生！請小心！........!!!');
        }

        if (elapsed >= 63000 && !this.soloRocketBossWarning1Closed) {
            this.soloRocketBossWarning1Closed = true;
            this.hideSoloRocketStage6RabbitComms(false);
        }

        if (elapsed >= 64000) {
            this.resumeSoloRocketStage6FirstWarningSpawns();
        }

        if (elapsed >= 117000 && !this.soloRocketBossWarning2Shown) {
            this.soloRocketBossWarning2Shown = true;
            this.showSoloRocketStage6RabbitComms('洋蔥小心！\n古代銀河巨雞魔出沒!!!! 注意安全!!!!');
        }

        if (elapsed >= 122000 && !this.soloRocketBossWarning2Closed) {
            this.soloRocketBossWarning2Closed = true;
            this.hideSoloRocketStage6RabbitComms(false);
        }
    }

    beginSoloRocketEndingSequence() {
        if (this.soloRocketEndingRushStarted || !this.soloRocketPlayer) return;

        this.soloRocketEndingRushStarted = true;
        this.soloRocketInputLocked = true;
        this.soloRocketEndingActive = true;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const rocket = this.soloRocketPlayer;

        this.triggerSoloRocketBossPunishmentIfNeeded(rect, rocket);

        this.tweens.add({
            targets: rocket,
            x: rect.centerX,
            y: rect.y - 90,
            angle: 0,
            duration: 1850,
            ease: 'Cubic.easeIn'
        });

        if (!this.soloRocketWhiteFade) {
            this.soloRocketWhiteFade = this.add.rectangle(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                this.cameras.main.width,
                this.cameras.main.height,
                0xffffff,
                0
            ).setDepth(9770).setScrollFactor(0);
        }

        if (!this.soloRocketEndingFadeStarted) {
            this.soloRocketEndingFadeStarted = true;
            this.tweens.add({
                targets: this.soloRocketWhiteFade,
                alpha: 1,
                duration: 1900,
                ease: 'Sine.easeIn'
            });
        }
    }

    resetSoloRocketStage4State() {
        this.clearSoloRocketStage4Objects(true);
        if (this.clearSoloRocketStage6Objects) this.clearSoloRocketStage6Objects(true);
        this.soloRocketMonsterSpawnedCount = 0;
        this.soloRocketMonsterSpawnActive = false;
        this.soloRocketMonsterSpawnStopped = false;
        this.soloRocketMaxMonsters = 120;
        this.soloRocketMonsterBullets = [];
        this.soloRocketAsteroids = [];
        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidSpawnStopped = false;
        this.soloRocketAsteroidNextSpawnAt = 12000;
        this.soloRocketAsteroidExtraBudget = 50;
        this.soloRocketAsteroidExtraNextAt = 64000;
        this.soloRocketLastFireAt = 0;
        this.soloRocketLastSpinAt = 0;
        this.soloRocketSpinCooldownMs = 3000;
        this.soloRocketSpinActive = false;
        this.__soloRocketSpinInvincibleUntil = 0;
        this.__soloRocketSpinWasCooling = false;
        this.soloRocketStage4ClearedForEnding = false;
        this.soloRocketBigAttackCharge = 0;
        this.soloRocketBigAttackReady = false;
        this.soloRocketBigAttackReadyNotified = false;
        this.soloRocketBigAttackObjects = [];
        this.soloRocketStats = {
            monsterKills: 0,
            monsterHits: 0,
            asteroidsDodged: 0,
            spinDodges: 0,
            bossKilled: false,
            bossPunished: false
        };
        // 補丁 6-1：玉兔伴手禮店與月球旅費暫存狀態，只存在於本趟火箭巡航。
        this.soloRocketRunSummary = null;
        this.soloRocketMoonBudget = 0;
        this.soloRocketMoonBudgetLeft = 0;
        this.soloRocketMoonShopPurchases = {};
        this.soloRocketMoonShardBoughtThisRun = false;
        this.soloRocketMoonShopFinalized = false;
        this.soloRocketMoonShopFinalizing = false;
        this.soloRocketMoonFinalResult = null;
        this.soloRocketRabbitShopContainer = null;
        this.soloRocketRabbitShopBudgetText = null;
        this.soloRocketRabbitShopMessage = null;
        this.soloRocketRabbitShopBgm = null;
        this.__soloRocketStage6Pause1Applied = false;
        this.__soloRocketStage6Pause1Released = false;
    }

    clearSoloRocketStage6Objects(resetFlags = false) {
        const scene = this;
        const removeTimer = function(timer) {
            try {
                if (timer && timer.remove) timer.remove(false);
            } catch (_) {}
        };
        const destroyObj = function(obj, destroyChildren) {
            try {
                if (!obj) return;
                if (scene.tweens) scene.tweens.killTweensOf(obj);
                if (obj.destroy) {
                    if (destroyChildren) obj.destroy(true);
                    else obj.destroy();
                }
            } catch (_) {}
        };

        removeTimer(this.soloRocketRabbitTypingTimer);
        removeTimer(this.soloRocketBossMissileTimer);
        this.soloRocketRabbitTypingTimer = null;
        this.soloRocketBossMissileTimer = null;

        try {
            if (this.soloRocketBossFloatTween && this.soloRocketBossFloatTween.stop) this.soloRocketBossFloatTween.stop();
        } catch (_) {}
        this.soloRocketBossFloatTween = null;

        try {
            if (this.soloRocketBoss && this.tweens) this.tweens.killTweensOf(this.soloRocketBoss);
        } catch (_) {}
        destroyObj(this.soloRocketBoss, false);
        this.soloRocketBoss = null;

        destroyObj(this.soloRocketBossHpBar, true);
        this.soloRocketBossHpBar = null;
        this.soloRocketBossHpFill = null;
        this.soloRocketBossHpText = null;

        (this.soloRocketBossMissiles || []).slice().forEach(function(missile) {
            try {
                if (missile && missile.__trailEmitter && missile.__trailEmitter.destroy) missile.__trailEmitter.destroy();
            } catch (_) {}
            try {
                if (missile && missile.__trailParticles && missile.__trailParticles.destroy) missile.__trailParticles.destroy();
            } catch (_) {}
            try {
                if (missile && missile.__spinTween && missile.__spinTween.remove) missile.__spinTween.remove();
            } catch (_) {}
            try {
                if (missile && missile.__glowTween && missile.__glowTween.remove) missile.__glowTween.remove();
            } catch (_) {}
            try {
                if (missile && missile.__fxObjects && missile.__fxObjects.forEach) {
                    missile.__fxObjects.forEach(function(fx) { destroyObj(fx, true); });
                }
            } catch (_) {}
            destroyObj(missile, true);
        });

        this.soloRocketBossMissiles = [];

        try {
            if (this.soloRocketBigAttackGlowTween && this.soloRocketBigAttackGlowTween.stop) this.soloRocketBigAttackGlowTween.stop();
        } catch (_) {}
        this.soloRocketBigAttackGlowTween = null;

        (this.soloRocketBigAttackObjects || []).slice().forEach(obj => destroyObj(obj, false));
        this.soloRocketBigAttackObjects = [];

        destroyObj(this.soloRocketBigAttackGlow, false);
        this.soloRocketBigAttackGlow = null;
        if (this.soloRocketBigAttackButtonState) {
            try {
                ['btn', 'txt', 'hit'].forEach(k => {
                    const item = this.soloRocketBigAttackButtonState[k];
                    if (item && item.destroy) item.destroy();
                });
            } catch (_) {}
        }
        this.soloRocketBigAttackButtonState = null;

        destroyObj(this.soloRocketRabbitComms, true);
        this.soloRocketRabbitComms = null;
        this.soloRocketRabbitTypingIndex = 0;

        this.soloRocketBossEntering = false;
        this.soloRocketBossLastMissileAt = 0;

        if (resetFlags) {
            this.soloRocketBossHp = 160;
            this.soloRocketBossMaxHp = 160;
            this.soloRocketBossSpawned = false;
            this.soloRocketBossKilled = false;
            this.soloRocketBossPunished = false;
            this.soloRocketBossWarning1Shown = false;
            this.soloRocketBossWarning1Closed = false;
            this.soloRocketBossWarning2Shown = false;
            this.soloRocketBossWarning2Closed = false;
            this.soloRocketFinalEscapeStarted = false;
            this.__soloRocketStage6Pause1Applied = false;
            this.__soloRocketStage6Pause1Released = false;
            this.soloRocketBigAttackCharge = 0;
            this.soloRocketBigAttackReady = false;
            this.soloRocketBigAttackReadyNotified = false;
            this.soloRocketBigAttackObjects = [];
        }
    }

    setSoloRocketBigAttackButtonVisible(visible) {
        const state = this.soloRocketBigAttackButtonState;
        if (!state) return;

        const show = !!visible;
        ['btn', 'txt', 'hit'].forEach(k => {
            try {
                if (state[k] && state[k].setVisible) state[k].setVisible(show);
                if (state[k] && state[k].setAlpha) state[k].setAlpha(show ? (k === 'btn' ? 0.68 : 1) : 0);
            } catch (_) {}
        });

        if (this.soloRocketBigAttackGlow) {
            try {
                this.soloRocketBigAttackGlow.setVisible(show);
                this.soloRocketBigAttackGlow.setAlpha(show ? 0.75 : 0);
            } catch (_) {}
        }

        try {
            if (this.soloRocketBigAttackGlowTween && this.soloRocketBigAttackGlowTween.stop) this.soloRocketBigAttackGlowTween.stop();
        } catch (_) {}
        this.soloRocketBigAttackGlowTween = null;

        if (show && this.soloRocketBigAttackGlow) {
            this.soloRocketBigAttackGlow.setScale(0.82);
            this.soloRocketBigAttackGlowTween = this.tweens.add({
                targets: this.soloRocketBigAttackGlow,
                scaleX: 1.38,
                scaleY: 1.38,
                alpha: { from: 0.82, to: 0.18 },
                yoyo: true,
                repeat: -1,
                duration: 620,
                ease: 'Sine.easeInOut'
            });
        }
    }

    recordSoloRocketBigAttackHit() {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
        if (this.soloRocketBigAttackReady) return;

        this.soloRocketBigAttackCharge = Math.min(10, (this.soloRocketBigAttackCharge || 0) + 1);

        if (this.soloRocketBigAttackCharge >= 10) {
            this.soloRocketBigAttackReady = true;
            this.setSoloRocketBigAttackButtonVisible(true);

            if (!this.soloRocketBigAttackReadyNotified) {
                this.soloRocketBigAttackReadyNotified = true;
                this.playSoloRocketIntroSfx('solo-rocket-turn-cd-recharge');
            }
        }
    }

    castSoloRocketBigAttack() {
        if (!this.canUseSoloRocketAction() || !this.soloRocketPlayer || !this.soloRocketContainer) return;
        if (!this.soloRocketBigAttackReady) return;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const rocket = this.soloRocketPlayer;
        const startX = Phaser.Math.Clamp(rocket.x, rect.x + 42, rect.x + rect.w - 42);
        const startY = Phaser.Math.Clamp(rocket.y - 56, rect.y + 60, rect.y + rect.h - 80);

        this.soloRocketBigAttackReady = false;
        this.soloRocketBigAttackReadyNotified = false;
        this.soloRocketBigAttackCharge = 0;
        this.setSoloRocketBigAttackButtonVisible(false);
        this.playSoloRocketIntroSfx('solo-rocket-big-attack');

        this.soloRocketBigAttackObjects = this.soloRocketBigAttackObjects || [];

        const count = 10;
        for (let i = 0; i < count; i++) {
            const t = count <= 1 ? 0.5 : i / (count - 1);
            const arcX = (t - 0.5) * 170;
            const arcY = -Math.sin(t * Math.PI) * 34;
            const p = this.add.circle(
                startX + arcX,
                startY + arcY,
                12,
                i % 2 === 0 ? 0xffee33 : 0xffff88,
                0.88
            )
                .setStrokeStyle(3, 0xffffff, 0.92)
                .setDepth(9648)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            const core = this.add.circle(p.x, p.y, 5, 0xffffff, 0.95)
                .setDepth(9649)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            p.__soloRocketBigAttack = true;
            p.__core = core;
            p.__damage = 3;
            p.__vy = -620;
            p.__age = i * 0.08;
            p.__radius = 15;
            p.__bossHit = false;
            p.__killedIds = new Set();

            this.soloRocketContainer.add([p, core]);
            this.soloRocketBigAttackObjects.push(p, core);
        }
    }

    destroySoloRocketBigAttackParticle(particle) {
        if (!particle) return;
        const core = particle.__core;
        this.soloRocketBigAttackObjects = (this.soloRocketBigAttackObjects || []).filter(obj => obj !== particle && obj !== core);
        try { if (core && core.destroy) core.destroy(); } catch (_) {}
        try { if (particle.destroy) particle.destroy(); } catch (_) {}
    }

    updateSoloRocketBigAttacks(dt) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();

        (this.soloRocketBigAttackObjects || []).slice().forEach(obj => {
            if (!obj || !obj.active || !obj.__soloRocketBigAttack) return;

            obj.__age = (obj.__age || 0) + dt;
            obj.y += (obj.__vy || -620) * dt;
            obj.alpha = 0.55 + Math.abs(Math.sin(obj.__age * 16)) * 0.42;
            obj.setScale(1 + Math.sin(obj.__age * 13) * 0.16);

            if (obj.__core && obj.__core.active) {
                obj.__core.x = obj.x;
                obj.__core.y = obj.y;
                obj.__core.alpha = 0.55 + Math.abs(Math.cos(obj.__age * 18)) * 0.44;
                obj.__core.setScale(1 + Math.cos(obj.__age * 14) * 0.24);
            }

            this.checkSoloRocketBigAttackParticleHits(obj);

            if (obj.y < rect.y - 96) {
                this.destroySoloRocketBigAttackParticle(obj);
            }
        });
    }

    checkSoloRocketBigAttackParticleHits(particle) {
        if (!particle || !particle.active) return;
        const hitRadius = particle.__radius || 15;

        (this.soloRocketMonsters || []).slice().forEach(monster => {
            if (!monster || !monster.active || monster.__soloRocketDead || monster.__soloRocketSpawnPending || monster.__soloRocketCanBeHit === false) return;
            if (particle.__killedIds && particle.__killedIds.has(monster)) return;

            const dist = Phaser.Math.Distance.Between(particle.x, particle.y, monster.x, monster.y);
            const monsterRadius = monster.__soloRocketRadius || Math.max(monster.displayWidth || 40, monster.displayHeight || 40) * 0.35;
            if (dist <= hitRadius + monsterRadius) {
                if (particle.__killedIds) particle.__killedIds.add(monster);
                monster.__soloRocketHp = 0;
                this.handleSoloRocketMonsterKilled(monster);
            }
        });

        (this.soloRocketAsteroids || []).slice().forEach(asteroid => {
            if (!asteroid || !asteroid.active || asteroid.__soloRocketBigCleared) return;
            const dist = Phaser.Math.Distance.Between(particle.x, particle.y, asteroid.x, asteroid.y);
            const asteroidRadius = asteroid.__soloRocketRadius || Math.max(asteroid.displayWidth || 42, asteroid.displayHeight || 42) * 0.42;
            if (dist <= hitRadius + asteroidRadius) {
                asteroid.__soloRocketBigCleared = true;
                asteroid.__soloRocketCounted = true;
                this.showSoloRocketAsteroidBlockedFx(asteroid.x, asteroid.y);
                this.showSoloRocketMonsterExplosion(asteroid.x, asteroid.y, 'kill');
                this.destroySoloRocketAsteroid(asteroid);
            }
        });

        const boss = this.soloRocketBoss;
        if (boss && boss.active && !this.soloRocketBossKilled && !this.soloRocketBossEntering && !particle.__bossHit) {
            const bossRadius = boss.__soloRocketRadius || Math.max(boss.displayWidth || 120, boss.displayHeight || 120) * 0.40;
            const dist = Phaser.Math.Distance.Between(particle.x, particle.y, boss.x, boss.y);
            if (dist <= hitRadius + bossRadius) {
                particle.__bossHit = true;
                this.soloRocketBossHp = Math.max(0, (this.soloRocketBossHp || 0) - (particle.__damage || 3));
                this.playSoloRocketBossHitSfx();
                this.showSoloRocketBossHitFx(particle.x, particle.y);
                this.updateSoloRocketBossHpUi();

                if (this.soloRocketBossHp <= 0) {
                    this.handleSoloRocketBossKilled();
                }
            }
        }
    }

    updateSoloRocketBossTimeline(elapsed) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
        if (elapsed >= 126000 && !this.soloRocketBossSpawned && !this.soloRocketBossKilled) {
            this.spawnSoloRocketBoss();
        }
    }

    spawnSoloRocketBoss() {
        if (!this.soloRocketContainer || !this.soloRocketPlayer) return;
        if (this.soloRocketBossSpawned || this.soloRocketBossKilled) return;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        this.soloRocketBossSpawned = true;
        this.soloRocketBossEntering = true;
        this.soloRocketBossMaxHp = 160;
        this.soloRocketBossHp = this.soloRocketBossMaxHp;

        try {
            if (this.soloRocketMonsterSpawnTimer) this.soloRocketMonsterSpawnTimer.remove(false);
        } catch (_) {}
        this.soloRocketMonsterSpawnTimer = null;
        this.soloRocketMonsterSpawnActive = false;
        this.soloRocketAsteroidSpawnActive = false;

        const bossSize = Math.min(142, rect.w * 0.34);
        const key = this.textures.exists('solo-rocket-monster-boss-chicken')
            ? 'solo-rocket-monster-boss-chicken'
            : 'solo-rocket-monster-chicken';

        const boss = this.add.image(rect.centerX, rect.y - bossSize, key)
            .setDisplaySize(bossSize, bossSize)
            .setDepth(9628)
            .setScrollFactor(0);

        boss.__soloRocketBoss = true;
        boss.__soloRocketRadius = bossSize * 0.40;
        boss.__baseY = rect.y + bossSize * 0.62;
        boss.__soloRocketMoveStartedAt = 0;

        this.soloRocketBoss = boss;
        this.soloRocketContainer.add(boss);
        this.createSoloRocketBossHpUi();
        this.updateSoloRocketBossHpUi();

        const warning = this.add.text(rect.centerX, rect.y + 52, '巨雞魔王 出現！', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ff3333',
            stroke: '#ffffff',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(9764).setScrollFactor(0).setAlpha(0);
        this.soloRocketContainer.add(warning);
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        this.soloRocketStage4FxObjects.push(warning);

        this.tweens.add({
            targets: warning,
            alpha: 1,
            scaleX: 1.12,
            scaleY: 1.12,
            yoyo: true,
            repeat: 3,
            duration: 140,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.tweens.add({
                    targets: warning,
                    alpha: 0,
                    duration: 260,
                    onComplete: () => {
                        try { warning.destroy(); } catch (_) {}
                        this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== warning);
                    }
                });
            }
        });

        this.tweens.add({
            targets: boss,
            y: boss.__baseY,
            duration: 1050,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.soloRocketBossEntering = false;
                boss.__soloRocketMoveStartedAt = Date.now();
                this.soloRocketBossFloatTween = this.tweens.add({
                    targets: boss,
                    y: boss.__baseY + 8,
                    yoyo: true,
                    repeat: -1,
                    duration: 760,
                    ease: 'Sine.easeInOut'
                });
            }
        });
    }

    createSoloRocketBossHpUi() {
        if (this.soloRocketBossHpBar) {
            try { this.soloRocketBossHpBar.destroy(true); } catch (_) {}
        }
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const barW = Math.min(rect.w - 72, 300);
        const barH = 14;
        const x = rect.centerX;
        const y = rect.y + 34;
        const c = this.add.container(0, 0).setDepth(9762).setScrollFactor(0);
        const label = this.add.text(x, y - 18, '巨雞魔王', {
            fontSize: '15px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#8a0000',
            strokeThickness: 4
        }).setOrigin(0.5);
        const bg = this.add.rectangle(x, y, barW, barH, 0x220000, 0.85)
            .setStrokeStyle(3, 0xffffff, 0.95);
        const fill = this.add.rectangle(x - barW / 2 + 2, y, barW - 4, barH - 5, 0xff2233, 1)
            .setOrigin(0, 0.5);
        c.add([label, bg, fill]);
        this.soloRocketBossHpBar = c;
        this.soloRocketBossHpFill = fill;
        this.soloRocketBossHpText = label;
        if (this.soloRocketContainer) this.soloRocketContainer.add(c);
    }

    updateSoloRocketBossHpUi() {
        if (!this.soloRocketBossHpFill) return;
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const barW = Math.min(rect.w - 72, 300) - 4;
        const maxHp = this.soloRocketBossMaxHp || 160;
        const hpRate = Phaser.Math.Clamp((this.soloRocketBossHp || 0) / Math.max(1, maxHp), 0, 1);
        this.soloRocketBossHpFill.displayWidth = Math.max(1, barW * hpRate);
        if (this.soloRocketBossHpText) {
            this.soloRocketBossHpText.setText(`巨雞魔王  ${Math.max(0, Math.ceil(this.soloRocketBossHp || 0))}/${maxHp}`);
        }
    }

    playSoloRocketBossHitSfx() {
        try {
            if (!window.GameLogic.muteSFX && this.cache.audio.exists('solo-rocket-bang-on-boss')) {
                window.playSFX(this, 'solo-rocket-bang-on-boss');
            }
        } catch (_) {}
    }

    playSoloRocketBossDieSfx() {
        try {
            if (!window.GameLogic.muteSFX && this.cache.audio.exists('solo-rocket-monster-boss-chicken-die')) {
                window.playSFX(this, 'solo-rocket-monster-boss-chicken-die');
            }
        } catch (_) {}
    }

    showSoloRocketBossHitFx(x, y) {
        if (!this.soloRocketContainer) return;
        const boss = this.soloRocketBoss;
        if (boss && boss.active) {
            try { boss.setTint(0xffffff); } catch (_) {}
            this.time.delayedCall(70, () => {
                try { if (boss && boss.active) boss.setTint(0xff7777); } catch (_) {}
            });
            this.time.delayedCall(140, () => {
                try { if (boss && boss.active) boss.clearTint(); } catch (_) {}
            });
        }
        this.showSoloRocketMonsterExplosion(x, y, 'hitPlayer');
    }

    checkSoloRocketBeamBossHits() {
        const boss = this.soloRocketBoss;
        if (!boss || !boss.active || this.soloRocketBossKilled || this.soloRocketBossEntering) return;

        let bossBounds;
        try { bossBounds = boss.getBounds(); } catch (_) { return; }

        const beams = (this.soloRocketBeams || []).slice();
        for (const beam of beams) {
            if (!beam || !beam.active || beam.__soloRocketUsed) continue;
            let beamBounds;
            try { beamBounds = beam.getBounds(); } catch (_) { continue; }
            if (!Phaser.Geom.Intersects.RectangleToRectangle(beamBounds, bossBounds)) continue;

            beam.__soloRocketUsed = true;
            const hitX = beam.x || boss.x;
            const hitY = beam.y || boss.y;
            const damage = beam.__soloRocketDamage || 2;
            this.destroySoloRocketBeam(beam);
            this.soloRocketBossHp = Math.max(0, (this.soloRocketBossHp || 0) - damage);
            this.recordSoloRocketBigAttackHit();
            this.playSoloRocketBossHitSfx();
            this.showSoloRocketBossHitFx(hitX, hitY);
            this.updateSoloRocketBossHpUi();

            if (this.soloRocketBossHp <= 0) {
                this.handleSoloRocketBossKilled();
                return;
            }
        }
    }

    handleSoloRocketBossKilled() {
        if (this.soloRocketBossKilled) return;
        const boss = this.soloRocketBoss;
        const x = boss && boss.active ? boss.x : (this.soloRocketSafeRect ? this.soloRocketSafeRect.centerX : 0);
        const y = boss && boss.active ? boss.y : 0;

        this.soloRocketBossKilled = true;
        this.soloRocketStats = this.soloRocketStats || {};
        this.soloRocketStats.bossKilled = true;
        this.playSoloRocketBossDieSfx();

        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 120, () => this.showSoloRocketMonsterExplosion(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), 'kill'));
        }

        (this.soloRocketBossMissiles || []).slice().forEach(m => this.destroySoloRocketBossMissile(m, true));
        this.soloRocketBossMissiles = [];

        if (this.soloRocketBossHpBar) {
            try { this.soloRocketBossHpBar.destroy(true); } catch (_) {}
            this.soloRocketBossHpBar = null;
            this.soloRocketBossHpFill = null;
            this.soloRocketBossHpText = null;
        }

        if (boss && boss.active) {
            try { if (this.soloRocketBossFloatTween && this.soloRocketBossFloatTween.stop) this.soloRocketBossFloatTween.stop(); } catch (_) {}
            this.tweens.add({
                targets: boss,
                alpha: 0,
                scaleX: 1.45,
                scaleY: 1.45,
                angle: boss.angle + 35,
                duration: 520,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    try { if (boss.destroy) boss.destroy(); } catch (_) {}
                    if (this.soloRocketBoss === boss) this.soloRocketBoss = null;
                }
            });
        }
    }

    spawnSoloRocketBossMissile() {
        const boss = this.soloRocketBoss;
        if (!boss || !boss.active || this.soloRocketBossKilled || this.soloRocketBossEntering || !this.soloRocketPlayer) return;

        this.soloRocketBossMissiles = this.soloRocketBossMissiles || [];
        if (this.soloRocketBossMissiles.length >= 6) return;

        const offsets = [-18, 18];
        offsets.forEach((offsetX, index) => {
            if ((this.soloRocketBossMissiles || []).length >= 6) return;

            const startX = boss.x + offsetX;
            const startY = boss.y + 34 + index * 4;

            const missile = this.add.circle(startX, startY, 11, 0xff3311, 0.95)
                .setStrokeStyle(3, 0xffdd66, 0.9)
                .setDepth(9632)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);
            const core = this.add.circle(startX, startY, 5, 0xffffff, 0.95)
                .setDepth(9633)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);
            const tail1 = this.add.circle(startX, startY, 8, 0xff7722, 0.35)
                .setDepth(9631)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);
            const tail2 = this.add.circle(startX, startY, 5, 0xff0000, 0.25)
                .setDepth(9630)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            const aimOffset = index === 0 ? -34 : 34;
            const dx = (this.soloRocketPlayer.x + aimOffset) - startX;
            const dy = (this.soloRocketPlayer.y || boss.y) - startY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            missile.__vx = dx / len * 135;
            missile.__vy = dy / len * 135;
            missile.__age = index * 0.18;
            missile.__radius = 9;
            missile.__blinkSeed = Math.random() * Math.PI * 2;
            missile.__fxObjects = [core, tail1, tail2];

            this.soloRocketContainer.add([tail2, tail1, missile, core]);
            this.soloRocketBossMissiles.push(missile);
        });
    }

    destroySoloRocketBossMissile(missile, blocked = false) {
        if (!missile) return;
        this.soloRocketBossMissiles = (this.soloRocketBossMissiles || []).filter(m => m !== missile);
        const x = missile.x;
        const y = missile.y;
        try {
            (missile.__fxObjects || []).forEach(fx => { try { if (fx && fx.destroy) fx.destroy(); } catch (_) {} });
        } catch (_) {}
        try { if (missile.destroy) missile.destroy(); } catch (_) {}
        if (blocked) this.showSoloRocketAsteroidBlockedFx(x, y);
        else this.showSoloRocketMonsterExplosion(x, y, 'hitPlayer');
    }

    updateSoloRocketBossMissiles(dt) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const player = this.soloRocketPlayer;
        const isSpinning = this.soloRocketSpinActive || Date.now() < (this.__soloRocketSpinInvincibleUntil || 0);

        (this.soloRocketBossMissiles || []).slice().forEach(missile => {
            if (!missile || !missile.active) {
                this.destroySoloRocketBossMissile(missile, false);
                return;
            }

            missile.__age = (missile.__age || 0) + dt;

            if (player && player.active) {
                let dx = player.x - missile.x;
                let dy = player.y - missile.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                dx /= len;
                dy /= len;
                const speed = 150;
                missile.__vx = Phaser.Math.Linear(missile.__vx || 0, dx * speed, 0.026);
                missile.__vy = Phaser.Math.Linear(missile.__vy || 0, dy * speed, 0.026);
            }

            missile.x += (missile.__vx || 0) * dt;
            missile.y += (missile.__vy || 0) * dt;
            missile.angle += 560 * dt;

            const blink = 0.45 + Math.abs(Math.sin((missile.__age + (missile.__blinkSeed || 0)) * 13)) * 0.50;
            missile.setAlpha(blink);
            missile.setScale(1 + Math.sin((missile.__age || 0) * 15) * 0.13);

            const fx = missile.__fxObjects || [];
            if (fx[0]) {
                fx[0].x = missile.x;
                fx[0].y = missile.y;
                fx[0].angle = missile.angle;
                fx[0].setAlpha(0.45 + Math.abs(Math.cos((missile.__age || 0) * 16)) * 0.50);
                fx[0].setScale(1 + Math.cos((missile.__age || 0) * 14) * 0.20);
            }
            if (fx[1]) {
                fx[1].x = missile.x - (missile.__vx || 0) * 0.045;
                fx[1].y = missile.y - (missile.__vy || 0) * 0.045;
                fx[1].setAlpha(0.18 + Math.abs(Math.sin((missile.__age || 0) * 12)) * 0.38);
                fx[1].setScale(1 + Math.sin(missile.__age * 18) * 0.18);
            }
            if (fx[2]) {
                fx[2].x = missile.x - (missile.__vx || 0) * 0.080;
                fx[2].y = missile.y - (missile.__vy || 0) * 0.080;
                fx[2].setAlpha(0.12 + Math.abs(Math.cos((missile.__age || 0) * 10)) * 0.28);
                fx[2].setScale(1 + Math.cos(missile.__age * 15) * 0.18);
            }

            const out = missile.x < rect.x - 80 || missile.x > rect.x + rect.w + 80 || missile.y < rect.y - 120 || missile.y > rect.y + rect.h + 120 || missile.__age > 9;
            if (out) {
                this.destroySoloRocketBossMissile(missile, false);
                return;
            }

            if (player && player.active) {
                const dist = Phaser.Math.Distance.Between(missile.x, missile.y, player.x, player.y);
                const hitDist = (missile.__radius || 9) + Math.max(14, (this.soloRocketPlayerRadius || 28) * 0.55);
                if (dist <= hitDist) {
                    if (isSpinning) {
                        this.destroySoloRocketBossMissile(missile, true);
                        this.soloRocketStats = this.soloRocketStats || {};
                        this.soloRocketStats.spinDodges = (this.soloRocketStats.spinDodges || 0) + 1;
                        return;
                    }

                    this.destroySoloRocketBossMissile(missile, false);
                    this.showSoloRocketPlayerHitFeedback();
                    this.soloRocketStats = this.soloRocketStats || {};
                    this.soloRocketStats.monsterHits = (this.soloRocketStats.monsterHits || 0) + 1;
                    this.setSoloRocketLifeValue((this.soloRocketLifeValue || 0) - 12);
                    if ((this.soloRocketLifeValue || 0) <= 0) {
                        this.setSoloRocketLifeValue(0);
                        this.finishSoloRocketCruise();
                    }
                }
            }
        });
    }

    updateSoloRocketBoss(dt, elapsed) {
        const boss = this.soloRocketBoss;
        if (!boss || !boss.active || this.soloRocketBossKilled) return;

        if (!this.soloRocketBossEntering) {
            const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
            const leftBound = rect.x + boss.displayWidth * 0.55;
            const rightBound = rect.x + rect.w - boss.displayWidth * 0.55;
            const centerX = (leftBound + rightBound) / 2;
            const amplitude = Math.max(0, (rightBound - leftBound) / 2);
            const startedAt = boss.__soloRocketMoveStartedAt || Date.now();
            const t = (Date.now() - startedAt) / 1000;

            boss.x = Phaser.Math.Clamp(
                centerX + Math.sin(t * 1.08) * amplitude,
                leftBound,
                rightBound
            );
        }

        if (!this.soloRocketBossEntering && elapsed < 152000) {
            const now = Date.now();
            if (now - (this.soloRocketBossLastMissileAt || 0) >= (this.soloRocketBossMissileIntervalMs || 5000)) {
                this.soloRocketBossLastMissileAt = now;
                this.spawnSoloRocketBossMissile();
            }
        }

        this.checkSoloRocketBeamBossHits();
        this.updateSoloRocketBossHpUi();
    }

    triggerSoloRocketBossPunishmentIfNeeded(rect, rocket) {
        if (this.soloRocketBossKilled || this.soloRocketBossPunished || !rocket) return;
        if (!this.soloRocketBossSpawned) return;

        this.soloRocketBossPunished = true;
        this.soloRocketStats = this.soloRocketStats || {};
        this.soloRocketStats.bossPunished = true;
        this.setSoloRocketLifeValue(Math.max(0, (this.soloRocketLifeValue || 0) - 25));
        this.showSoloRocketPlayerHitFeedback();

        const boss = this.soloRocketBoss;
        if (boss && boss.active) {
            try { if (this.soloRocketBossFloatTween && this.soloRocketBossFloatTween.stop) this.soloRocketBossFloatTween.stop(); } catch (_) {}
            this.tweens.add({
                targets: boss,
                x: rect.centerX,
                y: rocket.y + 34,
                scaleX: boss.scaleX * 1.16,
                scaleY: boss.scaleY * 1.16,
                alpha: 0.72,
                duration: 650,
                ease: 'Cubic.easeIn'
            });
        }

        const warning = this.add.text(rect.centerX, rect.centerY - 32, '魔王追擊！', {
            fontSize: '30px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ff2233',
            stroke: '#ffffff',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(9769).setScrollFactor(0);
        this.soloRocketContainer.add(warning);
        this.tweens.add({
            targets: warning,
            alpha: 0,
            scaleX: 1.55,
            scaleY: 1.55,
            duration: 740,
            ease: 'Cubic.easeOut',
            onComplete: () => { try { warning.destroy(); } catch (_) {} }
        });
    }
  
    clearSoloRocketStage4Objects(resetStats = false) {
        const removeTimer = (timer) => {
            try {
                if (timer && timer.remove) timer.remove(false);
            } catch (_) {}
        };

        removeTimer(this.soloRocketMonsterSpawnTimer);
        removeTimer(this.soloRocketMonsterStartTimer);
        removeTimer(this.soloRocketMonsterStopTimer);

        this.soloRocketMonsterSpawnTimer = null;
        this.soloRocketMonsterStartTimer = null;
        this.soloRocketMonsterStopTimer = null;
        this.soloRocketMonsterSpawnActive = false;
        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidSpawnStopped = true;

        const destroyObj = (obj) => {
            try {
                if (!obj) return;
                if (this.tweens) this.tweens.killTweensOf(obj);
                if (obj.destroy) obj.destroy();
            } catch (_) {}
        };

        (this.soloRocketMonsters || []).forEach(monster => {
            try {
                if (monster && monster.__soloRocketSpawnTimer && monster.__soloRocketSpawnTimer.remove) {
                    monster.__soloRocketSpawnTimer.remove(false);
                }
            } catch (_) {}
            destroyObj(monster);
        });

        (this.soloRocketMonsterBullets || []).slice().forEach(bullet => {
            try {
                if (this.destroySoloRocketMonsterBullet) this.destroySoloRocketMonsterBullet(bullet);
                else destroyObj(bullet);
            } catch (_) {
                destroyObj(bullet);
            }
        });

        (this.soloRocketBeams || []).slice().forEach(beam => {
            try {
                if (this.destroySoloRocketBeam) this.destroySoloRocketBeam(beam);
                else destroyObj(beam);
            } catch (_) {
                destroyObj(beam);
            }
        });

        (this.soloRocketAsteroids || []).slice().forEach(asteroid => {
            try {
                if (this.destroySoloRocketAsteroid) this.destroySoloRocketAsteroid(asteroid);
                else destroyObj(asteroid);
            } catch (_) {
                destroyObj(asteroid);
            }
        });

        try {
            if (this.destroySoloRocketSpinShield) this.destroySoloRocketSpinShield();
        } catch (_) {}

        (this.soloRocketStage4FxObjects || []).forEach(destroyObj);

        this.soloRocketMonsters = [];
        this.soloRocketBeams = [];
        this.soloRocketMonsterBullets = [];
        this.soloRocketAsteroids = [];
        this.soloRocketStage4FxObjects = [];
        this.soloRocketLastFireAt = 0;
        this.soloRocketLastSpinAt = 0;
        this.soloRocketSpinActive = false;
        this.__soloRocketSpinInvincibleUntil = 0;
        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidNextSpawnAt = 12000;
        try {
            if (this.soloRocketPlayer && this.soloRocketPlayer.clearTint) this.soloRocketPlayer.clearTint();
        } catch (_) {}

        if (resetStats) {
            this.soloRocketMonsterSpawnedCount = 0;
            this.soloRocketMonsterSpawnStopped = false;
            this.soloRocketStage4ClearedForEnding = false;
            this.soloRocketStats = {
                monsterKills: 0,
                monsterHits: 0,
                asteroidsDodged: 0,
                spinDodges: 0,
                bossKilled: false,
                bossPunished: false
            };
        } else {
            this.soloRocketMonsterSpawnStopped = true;
        }
    }

    startSoloRocketMonsterSpawning() {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
        if (!this.soloRocketGameplayStarted || this.soloRocketTutorialActive || this.soloRocketIntroActive) return;
        if (this.soloRocketMonsterSpawnActive || this.soloRocketMonsterSpawnStopped) return;
        if ((this.soloRocketMonsterSpawnedCount || 0) >= (this.soloRocketMaxMonsters || 50)) return;

        this.soloRocketMonsterSpawnActive = true;
        this.scheduleSoloRocketMonsterSpawn(Phaser.Math.Between(250, 800));
    }

    stopSoloRocketMonsterSpawning() {
        this.soloRocketMonsterSpawnActive = false;
        this.soloRocketMonsterSpawnStopped = true;
        try {
            if (this.soloRocketMonsterSpawnTimer) this.soloRocketMonsterSpawnTimer.remove(false);
        } catch (_) {}
        this.soloRocketMonsterSpawnTimer = null;
    }

    scheduleSoloRocketMonsterSpawn(delayMs = null) {
        if (!this.soloRocketMonsterSpawnActive || this.soloRocketCruiseFinished) return;
        if (this.soloRocketMonsterSpawnTimer) return;

        const elapsed = Date.now() - (this.soloRocketStartTime || Date.now());
        if (elapsed >= 152000 || (this.soloRocketMonsterSpawnedCount || 0) >= (this.soloRocketMaxMonsters || 50)) {
            this.stopSoloRocketMonsterSpawning();
            return;
        }

        const nextDelay = Number.isFinite(delayMs) ? delayMs : Phaser.Math.Between(1200, 2500);
        this.soloRocketMonsterSpawnTimer = this.time.delayedCall(nextDelay, () => {
            this.soloRocketMonsterSpawnTimer = null;

            if (!this.soloRocketMonsterSpawnActive || !this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;
            const nowElapsed = Date.now() - (this.soloRocketStartTime || Date.now());
            if (nowElapsed >= 152000) {
                this.stopSoloRocketMonsterSpawning();
                return;
            }

            this.spawnSoloRocketMonster();
            this.scheduleSoloRocketMonsterSpawn();
        });
    }

    spawnSoloRocketMonster() {
        if (!this.soloRocketContainer || !this.soloRocketPlayer) return;
        if ((this.soloRocketMonsterSpawnedCount || 0) >= (this.soloRocketMaxMonsters || 120)) {
            this.stopSoloRocketMonsterSpawning();
            return;
        }

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const size = Phaser.Math.Between(38, 52);
        const spawnFromTop = Math.random() < 0.72;
        const spawnX = Phaser.Math.Between(Math.floor(rect.x + size), Math.floor(rect.x + rect.w - size));
        const spawnY = spawnFromTop
            ? rect.y - size
            : Phaser.Math.Between(Math.floor(rect.y + 26), Math.floor(rect.y + rect.h * 0.38));

        const targetX = this.soloRocketPlayer.x || rect.centerX;
        const targetY = this.soloRocketPlayer.y || (rect.y + rect.h * 0.72);
        let dx = targetX - spawnX;
        let dy = targetY - spawnY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;

        const key = this.textures.exists('solo-rocket-monster-chicken')
            ? 'solo-rocket-monster-chicken'
            : 'solo-rocket-monster-fallback';

        const monster = this.add.image(spawnX, spawnY, key)
            .setDisplaySize(size, size)
            .setDepth(9612)
            .setScrollFactor(0);

        const vx = dx * Phaser.Math.Between(75, 125);
        const vy = dy * Phaser.Math.Between(75, 125);

        monster.__soloRocketHp = 1;
        monster.__soloRocketVx = spawnFromTop ? vx : 0;
        monster.__soloRocketVy = spawnFromTop ? vy : 0;
        monster.__soloRocketReadyVx = vx;
        monster.__soloRocketReadyVy = vy;
        monster.__soloRocketTargetY = targetY;
        monster.__soloRocketRadius = size * 0.42;
        monster.__soloRocketDead = false;
        monster.__soloRocketSpawnPending = !spawnFromTop;
        monster.__soloRocketCanBeHit = spawnFromTop;
        monster.__soloRocketFloatPhase = Math.random() * Math.PI * 2;
        monster.__soloRocketFloatOffset = 0;
        monster.__soloRocketNextShotAt = Date.now() + Phaser.Math.Between(900, 1800);

        if (!spawnFromTop) {
            const warpMs = 1300;
            monster.setAlpha(0);
            this.showSoloRocketMonsterWarpIn(spawnX, spawnY, size, warpMs);
            monster.__soloRocketSpawnTimer = this.time.delayedCall(warpMs, () => {
                if (!monster || !monster.active || monster.__soloRocketDead) return;
                monster.__soloRocketSpawnPending = false;
                monster.__soloRocketCanBeHit = true;
                monster.__soloRocketVx = monster.__soloRocketReadyVx || vx;
                monster.__soloRocketVy = monster.__soloRocketReadyVy || vy;
                monster.__soloRocketNextShotAt = Date.now() + Phaser.Math.Between(650, 1300);
                this.tweens.add({
                    targets: monster,
                    alpha: 1,
                    scaleX: { from: monster.scaleX * 0.62, to: monster.scaleX },
                    scaleY: { from: monster.scaleY * 0.62, to: monster.scaleY },
                    duration: 220,
                    ease: 'Back.easeOut'
                });
            });
        }

        this.soloRocketContainer.add(monster);
        this.soloRocketMonsters = this.soloRocketMonsters || [];
        this.soloRocketMonsters.push(monster);
        this.soloRocketMonsterSpawnedCount = (this.soloRocketMonsterSpawnedCount || 0) + 1;
    }

    showSoloRocketMonsterWarpIn(x, y, size = 48, durationMs = 1300) {
        if (!this.soloRocketContainer) return;

        const warpMs = Phaser.Math.Clamp(Number(durationMs) || 1300, 500, 2500);
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        const fxList = [];

        const core = this.add.circle(x, y, Math.max(8, size * 0.18), 0x09000f, 0.88)
            .setStrokeStyle(2, 0xd9b3ff, 0.95)
            .setDepth(9611)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);
        fxList.push(core);

        for (let i = 0; i < 3; i++) {
            const ring = this.add.circle(x, y, Math.max(10, size * 0.26 + i * 8), 0x000000, 0)
                .setStrokeStyle(3, [0x7b2cff, 0xd9b3ff, 0xffffff][i], 0.75)
                .setDepth(9610 + i)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);
            fxList.push(ring);

            const ringDelay = i * 130;
            this.tweens.add({
                targets: ring,
                scale: 2.4 + i * 0.55,
                angle: 180 + i * 90,
                alpha: 0,
                duration: Math.max(260, warpMs - ringDelay),
                delay: ringDelay,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    try { ring.destroy(); } catch (_) {}
                    this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== ring);
                }
            });
        }

        if (this.textures.exists('particle_flare')) {
            const tintList = [0x7b2cff, 0xffffff, 0xd9b3ff, 0x16001f];

            for (let i = 0; i < 28; i++) {
                const ang = (Math.PI * 2 / 28) * i + Phaser.Math.FloatBetween(-0.16, 0.16);
                const dist = Phaser.Math.Between(Math.floor(size * 0.70), Math.floor(size * 1.55));
                const p = this.add.image(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, 'particle_flare')
                    .setTint(tintList[i % tintList.length])
                    .setAlpha(i % 4 === 3 ? 0.62 : 0.92)
                    .setScale(Phaser.Math.FloatBetween(0.55, 1.22))
                    .setDepth(9614)
                    .setScrollFactor(0);

                if (i % 4 !== 3) {
                    p.setBlendMode(Phaser.BlendModes.ADD);
                }

                fxList.push(p);

                this.tweens.add({
                    targets: p,
                    x: x + Phaser.Math.Between(-3, 3),
                    y: y + Phaser.Math.Between(-3, 3),
                    angle: Phaser.Math.Between(-360, 360),
                    alpha: 0,
                    scaleX: 0.08,
                    scaleY: 0.08,
                    duration: Phaser.Math.Between(460, 900),
                    delay: Phaser.Math.Between(0, 120),
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        try { p.destroy(); } catch (_) {}
                        this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== p);
                    }
                });
            }
        }

        this.soloRocketContainer.add(fxList);
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        fxList.forEach(obj => this.soloRocketStage4FxObjects.push(obj));

        this.tweens.add({
            targets: core,
            scaleX: { from: 1.35, to: 0.45 },
            scaleY: { from: 1.35, to: 0.45 },
            angle: -720,
            alpha: { from: 0.96, to: 0 },
            duration: warpMs,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                try { core.destroy(); } catch (_) {}
                this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== core);
            }
        });
    }

    canUseSoloRocketAction() {
        return !!(
            this.soloRocketCruiseActive &&
            this.soloRocketGameplayStarted &&
            !this.soloRocketCruiseFinished &&
            !this.soloRocketInputLocked &&
            !this.soloRocketTutorialActive &&
            !this.soloRocketIntroActive &&
            !this.soloRocketEndingActive
        );
    }

    resetSoloRocketPlayerFacingUp(resetScale = true) {
        const rocket = this.soloRocketPlayer;
        if (!rocket || !rocket.active) return;

        try {
            rocket.setAngle(0);
            if (resetScale && rocket.setScale) {
                const sx = Number.isFinite(Number(rocket.__soloRocketNormalScaleX))
                    ? Number(rocket.__soloRocketNormalScaleX)
                    : (rocket.scaleX || 1);
                const sy = Number.isFinite(Number(rocket.__soloRocketNormalScaleY))
                    ? Number(rocket.__soloRocketNormalScaleY)
                    : (rocket.scaleY || 1);
                rocket.setScale(sx, sy);
            }
        } catch (_) {}
    }

    destroySoloRocketSpinShield() {
        try {
            if (this.soloRocketSpinShieldTween) {
                if (this.soloRocketSpinShieldTween.stop) this.soloRocketSpinShieldTween.stop();
                if (this.soloRocketSpinShieldTween.remove) this.soloRocketSpinShieldTween.remove();
            }
        } catch (_) {}
        this.soloRocketSpinShieldTween = null;

        try {
            if (this.soloRocketSpinShield && this.soloRocketSpinShield.destroy) {
                this.soloRocketSpinShield.destroy(true);
            }
        } catch (_) {}

        this.soloRocketSpinShield = null;
    }

    showSoloRocketSpinShieldFx() {
        const rocket = this.soloRocketPlayer;
        if (!rocket || !rocket.active || !this.soloRocketContainer) return;

        this.destroySoloRocketSpinShield();

        const radius = Math.max(46, (this.soloRocketPlayerRadius || 28) * 1.95);
        const shield = this.add.container(rocket.x, rocket.y).setDepth(9625).setScrollFactor(0);

        const outer = this.add.circle(0, 0, radius, 0x00ccff, 0.18)
            .setStrokeStyle(5, 0x99eeff, 0.98)
            .setBlendMode(Phaser.BlendModes.ADD);

        const inner = this.add.circle(0, 0, radius * 0.62, 0x66ddff, 0.15)
            .setStrokeStyle(2, 0xffffff, 0.85)
            .setBlendMode(Phaser.BlendModes.ADD);

        shield.add([outer, inner]);
        this.soloRocketContainer.add(shield);
        this.soloRocketSpinShield = shield;
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        this.soloRocketStage4FxObjects.push(shield);

        this.soloRocketSpinShieldTween = this.tweens.add({
            targets: shield,
            scaleX: { from: 0.72, to: 1.46 },
            scaleY: { from: 0.72, to: 1.46 },
            alpha: { from: 1, to: 0 },
            angle: 270,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                try { this.destroySoloRocketSpinShield(); } catch (_) {}
                this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== shield);
            }
        });
    }

    updateSoloRocketSpinShieldPosition() {
        if (!this.soloRocketSpinShield || !this.soloRocketPlayer || !this.soloRocketPlayer.active) return;
        try {
            this.soloRocketSpinShield.setPosition(this.soloRocketPlayer.x, this.soloRocketPlayer.y);
        } catch (_) {}
    }

    showSoloRocketSpinReadyFx() {
        const state = this.soloRocketSpinButtonState;
        if (!state || !state.btn || !this.soloRocketUiContainer) return;

        const ring = this.add.circle(state.x, state.y, state.radius || 34, 0x0033ff, 0)
            .setStrokeStyle(4, 0x66ccff, 0.95)
            .setDepth(9720)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.soloRocketUiContainer.add(ring);

        try {
            state.btn.setStrokeStyle(4, 0x99eeff, 1);
        } catch (_) {}

        this.tweens.add({
            targets: ring,
            scale: 2.15,
            alpha: 0,
            duration: 420,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                try { ring.destroy(); } catch (_) {}
                try {
                    if (state.btn && state.btn.active) state.btn.setStrokeStyle(3, 0xffffff, 0.9);
                } catch (_) {}
            }
        });
    }

    updateSoloRocketSpinCooldownUi() {
        const state = this.soloRocketSpinButtonState;
        const fill = this.soloRocketSpinCooldownFill;
        const cdText = this.soloRocketSpinCooldownText;
        if (!state || !state.btn || !state.txt || !fill || !cdText) return;

        const cooldown = this.soloRocketSpinCooldownMs || 3000;
        const elapsed = Date.now() - (this.soloRocketLastSpinAt || 0);
        const remaining = Math.max(0, cooldown - elapsed);
        const maxH = this.soloRocketSpinCooldownMaxHeight || 62;
        const baseY = this.soloRocketSpinCooldownBaseY || fill.y;

        if (remaining > 0) {
            const progress = Phaser.Math.Clamp(1 - remaining / cooldown, 0, 1);
            const nextHeight = Math.max(2, maxH * progress);

            this.__soloRocketSpinWasCooling = true;

            fill.setVisible(true);
            fill.y = baseY;
            fill.height = nextHeight;
            fill.displayHeight = nextHeight;

            cdText.setVisible(true);
            cdText.setText(String(Math.ceil(remaining / 1000)) + '秒');

            state.btn.setAlpha(0.36);
            state.txt.setAlpha(0.82);
            state.txt.setText('冷卻');
            return;
        }

        if (this.__soloRocketSpinWasCooling) {
            this.__soloRocketSpinWasCooling = false;
            this.showSoloRocketSpinReadyFx();
            this.playSoloRocketIntroSfx('solo-rocket-turn-cd-recharge');
        }

        fill.setVisible(false);
        fill.height = 0.01;
        fill.displayHeight = 0.01;
        cdText.setVisible(false);
        cdText.setText('');

        state.btn.setAlpha(0.62);
        state.txt.setAlpha(1);
        state.txt.setText('旋轉');
    }


    fireSoloRocketBeam() {
        if (!this.canUseSoloRocketAction() || !this.soloRocketPlayer || !this.soloRocketContainer) return;

        const now = Date.now();
        const cooldown = this.soloRocketFireCooldownMs || 320;
        if (now - (this.soloRocketLastFireAt || 0) < cooldown) return;
        this.soloRocketLastFireAt = now;

        try {
            if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }
        } catch (_) {}

        try {
            if (!window.GameLogic.muteSFX && this.cache.audio.exists('minimum_laser')) {
                window.playSFX(this, 'minimum_laser');
            }
        } catch (_) {}

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const startX = Phaser.Math.Clamp(this.soloRocketPlayer.x || rect.centerX, rect.x + 10, rect.x + rect.w - 10);
        const startY = (this.soloRocketPlayer.y || rect.centerY) - Math.max(30, this.soloRocketPlayerRadius || 28);

        // 主碰撞光束：保留 rectangle，讓 getBounds() 穩定可用。
        const beam = this.add.rectangle(startX, startY, 10, 68, 0xdfffff, 1)
            .setStrokeStyle(2, 0xffffff, 0.95)
            .setDepth(9616)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        // 視覺光暈：跟著主光束移動，但不參與碰撞。
        const glow = this.add.rectangle(startX, startY, 28, 86, 0x33eaff, 0.22)
            .setDepth(9615)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        const head = this.add.circle(startX, startY - 42, 8, 0xffffff, 0.98)
            .setDepth(9617)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        glow.__soloRocketOffsetY = 0;
        head.__soloRocketOffsetY = -42;

        beam.__soloRocketVy = -860;
        beam.__soloRocketDamage = 2;
        beam.__soloRocketUsed = false;
        beam.__soloRocketFx = [glow, head];

        this.soloRocketContainer.add([glow, beam, head]);

        // 發射口短暫噴發粒子，數量少，避免效能負擔。
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        if (this.textures.exists('particle_flare')) {
            for (let i = 0; i < 7; i++) {
                const p = this.add.image(
                    startX + Phaser.Math.Between(-12, 12),
                    startY + Phaser.Math.Between(14, 26),
                    'particle_flare'
                )
                    .setTint([0x8ffcff, 0xffffff, 0x4deeff][i % 3])
                    .setAlpha(0.92)
                    .setScale(Phaser.Math.FloatBetween(0.65, 1.25))
                    .setDepth(9618)
                    .setScrollFactor(0)
                    .setBlendMode(Phaser.BlendModes.ADD);

                this.soloRocketContainer.add(p);
                this.soloRocketStage4FxObjects.push(p);

                this.tweens.add({
                    targets: p,
                    x: p.x + Phaser.Math.Between(-24, 24),
                    y: p.y + Phaser.Math.Between(10, 34),
                    alpha: 0,
                    scaleX: 0.08,
                    scaleY: 0.08,
                    duration: Phaser.Math.Between(140, 240),
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        try { p.destroy(); } catch (_) {}
                        this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== p);
                    }
                });
            }
        }

        this.soloRocketBeams = this.soloRocketBeams || [];
        this.soloRocketBeams.push(beam);
    }

    spinSoloRocketPlayer() {
        if (!this.canUseSoloRocketAction() || !this.soloRocketPlayer) return;

        const now = Date.now();
        const cooldown = this.soloRocketSpinCooldownMs || 3000;
        if (now - (this.soloRocketLastSpinAt || 0) < cooldown) {
            this.updateSoloRocketSpinCooldownUi();
            return;
        }

        this.soloRocketLastSpinAt = now;
        this.soloRocketSpinActive = true;
        this.__soloRocketSpinInvincibleUntil = now + 700;
        this.updateSoloRocketSpinCooldownUi();

        const rocket = this.soloRocketPlayer;

        if (this.tweens) this.tweens.killTweensOf(rocket);
        this.resetSoloRocketPlayerFacingUp(true);

        const baseScaleX = Number.isFinite(Number(rocket.__soloRocketNormalScaleX))
            ? Number(rocket.__soloRocketNormalScaleX)
            : (rocket.scaleX || 1);
        const baseScaleY = Number.isFinite(Number(rocket.__soloRocketNormalScaleY))
            ? Number(rocket.__soloRocketNormalScaleY)
            : (rocket.scaleY || 1);

        this.showSoloRocketSpinShieldFx();

        try {
            if (!window.GameLogic.muteSFX && this.cache.audio.exists('solo-rocket-turn')) {
                window.playSFX(this, 'solo-rocket-turn');
            }
        } catch (_) {}

        this.tweens.add({
            targets: rocket,
            angle: 720,
            scaleX: baseScaleX * 1.10,
            scaleY: baseScaleY * 1.10,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                try {
                    if (rocket && rocket.active) {
                        rocket.setAngle(0);
                        rocket.setScale(baseScaleX, baseScaleY);
                    }
                } catch (_) {}
            }
        });

        this.time.delayedCall(720, () => {
            this.soloRocketSpinActive = false;
            this.resetSoloRocketPlayerFacingUp(true);
            this.destroySoloRocketSpinShield();
        });
    }
  
    destroySoloRocketBeam(beam) {
        if (!beam) return;
        this.soloRocketBeams = (this.soloRocketBeams || []).filter(b => b !== beam);

        try {
            if (Array.isArray(beam.__soloRocketFx)) {
                beam.__soloRocketFx.forEach(fx => {
                    try { if (fx && fx.destroy) fx.destroy(); } catch (_) {}
                });
            }
        } catch (_) {}

        try { if (beam.destroy) beam.destroy(); } catch (_) {}
    }

    destroySoloRocketMonster(monster) {
        if (!monster) return;
        this.soloRocketMonsters = (this.soloRocketMonsters || []).filter(m => m !== monster);
        monster.__soloRocketDead = true;
        try {
            if (monster.__soloRocketSpawnTimer && monster.__soloRocketSpawnTimer.remove) {
                monster.__soloRocketSpawnTimer.remove(false);
            }
        } catch (_) {}
        try { if (monster.destroy) monster.destroy(); } catch (_) {}
    }

    playSoloRocketMonsterDieSfx() {
        try {
            if (!window.GameLogic.muteSFX && this.cache.audio.exists('solo-rocket-monster-chicken-die')) {
                window.playSFX(this, 'solo-rocket-monster-chicken-die');
            }
        } catch (_) {}
    }

    destroySoloRocketMonsterBullet(bullet) {
        if (!bullet) return;
        this.soloRocketMonsterBullets = (this.soloRocketMonsterBullets || []).filter(b => b !== bullet);
        try {
            const glow = bullet.__soloRocketGlow;
            if (glow && glow.destroy) glow.destroy();
        } catch (_) {}
        try { if (bullet.destroy) bullet.destroy(); } catch (_) {}
    }

    destroySoloRocketAsteroid(asteroid) {
        if (!asteroid) return;
        this.soloRocketAsteroids = (this.soloRocketAsteroids || []).filter(a => a !== asteroid);
        try { if (asteroid.destroy) asteroid.destroy(); } catch (_) {}
    }

    getSoloRocketAsteroidKey() {
        if (this.textures.exists('solo-rocket-space-rock')) return 'solo-rocket-space-rock';
        return 'solo-rocket-space-rock-fallback';
    }

    spawnSoloRocketAsteroid(x, y, size, vx, vy, spin) {
        if (!this.soloRocketContainer) return null;

        const key = this.getSoloRocketAsteroidKey();
        if (!this.textures.exists(key)) return null;

        const asteroid = this.add.image(x, y, key)
            .setDisplaySize(size, size)
            .setDepth(9613)
            .setScrollFactor(0);

        asteroid.__soloRocketVx = vx || 0;
        asteroid.__soloRocketVy = vy || 140;
        asteroid.__soloRocketSpin = spin || 120;
        asteroid.__soloRocketRadius = size * 0.43;
        asteroid.__soloRocketHitPlayer = false;
        asteroid.__soloRocketCounted = false;
        asteroid.__soloRocketSpinBlocked = false;

        this.soloRocketContainer.add(asteroid);
        this.soloRocketAsteroids = this.soloRocketAsteroids || [];
        this.soloRocketAsteroids.push(asteroid);

        return asteroid;
    }

    spawnSoloRocketAsteroidScatter(elapsed) {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const lateGame = elapsed >= 64000;
        const relaxGame = elapsed >= 126000;
        const count = lateGame && !relaxGame && Math.random() < 0.35 ? 2 : 1;

        for (let i = 0; i < count; i++) {
            const size = Phaser.Math.Between(34, lateGame ? 56 : 48);
            const x = Phaser.Math.Between(Math.floor(rect.x + size), Math.floor(rect.x + rect.w - size));
            const y = rect.y - size - i * 46;
            const vx = Phaser.Math.Between(-18, 18);
            const vy = relaxGame
                ? Phaser.Math.Between(115, 165)
                : (lateGame ? Phaser.Math.Between(145, 215) : Phaser.Math.Between(95, 150));
            const spin = Phaser.Math.Between(70, 180) * (Math.random() < 0.5 ? -1 : 1);
            this.spawnSoloRocketAsteroid(x, y, size, vx, vy, spin);
        }
    }

    spawnSoloRocketAsteroidRow(elapsed) {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const size = Phaser.Math.Clamp(Math.floor(rect.w / 10.4), 32, 44);
        const spacing = Math.max(size * 1.10, 38);
        const gapSlots = Phaser.Math.Between(4, 5);
        const gapWidth = spacing * gapSlots;
        const minGapCenter = rect.x + gapWidth / 2 + 24;
        const maxGapCenter = rect.x + rect.w - gapWidth / 2 - 24;
        let gapCenter = rect.centerX;
        if (maxGapCenter > minGapCenter) {
            gapCenter = Phaser.Math.Between(Math.floor(minGapCenter), Math.floor(maxGapCenter));
        }
        const y = rect.y - size - 10;
        const relaxGame = elapsed >= 126000;
        const vy = relaxGame ? Phaser.Math.Between(120, 165) : Phaser.Math.Between(150, 215);

        for (let x = rect.x + spacing / 2; x < rect.x + rect.w; x += spacing) {
            if (Math.abs(x - gapCenter) < gapWidth / 2) continue;

            const drift = Phaser.Math.Between(-8, 8);
            const spin = Phaser.Math.Between(95, 210) * (Math.random() < 0.5 ? -1 : 1);
            this.spawnSoloRocketAsteroid(x, y + Phaser.Math.Between(-8, 8), size, drift, vy, spin);
        }
    }

    updateSoloRocketAsteroids(dt, elapsed) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const generationPaused = elapsed >= 55000 && elapsed < 64000;

        if (generationPaused) {
            this.soloRocketAsteroidSpawnActive = false;
            if (!this.soloRocketAsteroidNextSpawnAt || this.soloRocketAsteroidNextSpawnAt < 64000) {
                this.soloRocketAsteroidNextSpawnAt = 64000;
            }
        }

        if (!generationPaused && elapsed >= 12000 && elapsed < 152000 && !this.soloRocketAsteroidSpawnStopped) {
            this.soloRocketAsteroidSpawnActive = true;
            if (!this.soloRocketAsteroidNextSpawnAt || this.soloRocketAsteroidNextSpawnAt < 12000) {
                this.soloRocketAsteroidNextSpawnAt = 12000;
            }

            if (elapsed >= this.soloRocketAsteroidNextSpawnAt) {
                if (elapsed >= 64000 && Math.random() < (elapsed >= 126000 ? 0.68 : 0.90)) {
                    this.spawnSoloRocketAsteroidRow(elapsed);
                } else {
                    this.spawnSoloRocketAsteroidScatter(elapsed);
                }

                const nextGap = elapsed >= 126000
                    ? Phaser.Math.Between(3000, 4600)
                    : (elapsed >= 64000 ? Phaser.Math.Between(1750, 2600) : Phaser.Math.Between(1400, 2400));

                this.soloRocketAsteroidNextSpawnAt = elapsed + nextGap;
            }

            if (elapsed >= 64000 &&
                elapsed < 152000 &&
                !this.soloRocketBossSpawned &&
                (this.soloRocketAsteroidExtraBudget || 0) > 0) {

                if (!this.soloRocketAsteroidExtraNextAt || this.soloRocketAsteroidExtraNextAt < 64000) {
                    this.soloRocketAsteroidExtraNextAt = elapsed + Phaser.Math.Between(900, 1500);
                }

                if (elapsed >= this.soloRocketAsteroidExtraNextAt) {
                    const beforeCount = (this.soloRocketAsteroids || []).length;
                    const batch = Math.min(
                        this.soloRocketAsteroidExtraBudget || 0,
                        elapsed >= 126000 ? Phaser.Math.Between(1, 2) : Phaser.Math.Between(1, 3)
                    );

                    for (let i = 0; i < batch; i++) {
                        this.spawnSoloRocketAsteroidScatter(elapsed);
                    }

                    const afterCount = (this.soloRocketAsteroids || []).length;
                    const spawned = Math.max(1, afterCount - beforeCount);
                    this.soloRocketAsteroidExtraBudget = Math.max(0, (this.soloRocketAsteroidExtraBudget || 0) - spawned);
                    this.soloRocketAsteroidExtraNextAt = elapsed + Phaser.Math.Between(850, 1650);
                }
            }

        } else if (elapsed >= 152000) {
            this.soloRocketAsteroidSpawnActive = false;
            this.soloRocketAsteroidSpawnStopped = true;
        }

        const asteroids = (this.soloRocketAsteroids || []).slice();
        asteroids.forEach(asteroid => {
            if (!asteroid || !asteroid.active) {
                this.destroySoloRocketAsteroid(asteroid);
                return;
            }

            asteroid.x += (asteroid.__soloRocketVx || 0) * dt;
            asteroid.y += (asteroid.__soloRocketVy || 130) * dt;
            asteroid.angle += (asteroid.__soloRocketSpin || 120) * dt;

            if (asteroid.y > rect.y + rect.h + 78) {
                if (!asteroid.__soloRocketCounted && !asteroid.__soloRocketHitPlayer) {
                    this.soloRocketStats = this.soloRocketStats || {};
                    this.soloRocketStats.asteroidsDodged = (this.soloRocketStats.asteroidsDodged || 0) + 1;
                    asteroid.__soloRocketCounted = true;
                }
                this.destroySoloRocketAsteroid(asteroid);
            }
        });

        this.checkSoloRocketAsteroidPlayerHits();
    }

    checkSoloRocketAsteroidPlayerHits() {
        if (!this.soloRocketPlayer || !this.soloRocketPlayer.active) return;

        let playerBounds;
        try { playerBounds = this.soloRocketPlayer.getBounds(); } catch (_) { return; }

        const asteroids = (this.soloRocketAsteroids || []).slice();
        for (const asteroid of asteroids) {
            if (!asteroid || !asteroid.active || asteroid.__soloRocketHitPlayer) continue;

            let asteroidBounds;
            try { asteroidBounds = asteroid.getBounds(); } catch (_) { continue; }

            if (!Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, asteroidBounds)) continue;

            const hitX = asteroid.x;
            const hitY = asteroid.y;
            const isSpinning = this.soloRocketSpinActive || Date.now() < (this.__soloRocketSpinInvincibleUntil || 0);

            if (isSpinning) {
                if (!asteroid.__soloRocketSpinBlocked) {
                    asteroid.__soloRocketSpinBlocked = true;
                    asteroid.__soloRocketCounted = true;
                    this.soloRocketStats = this.soloRocketStats || {};
                    this.soloRocketStats.spinDodges = (this.soloRocketStats.spinDodges || 0) + 1;
                    this.soloRocketStats.asteroidsDodged = (this.soloRocketStats.asteroidsDodged || 0) + 1;
                    this.showSoloRocketAsteroidBlockedFx(hitX, hitY);
                }

                this.destroySoloRocketAsteroid(asteroid);
                continue;
            }

            asteroid.__soloRocketHitPlayer = true;
            this.showSoloRocketPlayerHitFeedback();
            this.showSoloRocketMonsterExplosion(hitX, hitY, 'hitPlayer');
            this.destroySoloRocketAsteroid(asteroid);

            this.setSoloRocketLifeValue((this.soloRocketLifeValue || 0) - 5);

            if ((this.soloRocketLifeValue || 0) <= 0) {
                this.setSoloRocketLifeValue(0);
                this.finishSoloRocketCruise();
                return;
            }
        }
    }

    showSoloRocketAsteroidBlockedFx(x, y) {
        if (!this.soloRocketContainer) return;

        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];

        const ring = this.add.circle(x, y, 12, 0x00ccff, 0)
            .setStrokeStyle(5, 0x99eeff, 0.96)
            .setDepth(9627)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.soloRocketContainer.add(ring);
        this.soloRocketStage4FxObjects.push(ring);

        this.tweens.add({
            targets: ring,
            scale: 3.1,
            alpha: 0,
            duration: 340,
            ease: 'Sine.easeOut',
            onComplete: () => {
                try { ring.destroy(); } catch (_) {}
                this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== ring);
            }
        });

        if (!this.textures.exists('particle_flare')) return;

        for (let i = 0; i < 12; i++) {
            const p = this.add.image(x, y, 'particle_flare')
                .setTint(i % 2 === 0 ? 0x99eeff : 0xffffff)
                .setAlpha(0.95)
                .setScale(Phaser.Math.FloatBetween(0.75, 1.35))
                .setDepth(9628)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            const angle = Math.random() * Math.PI * 2;
            const dist = Phaser.Math.Between(24, 68);

            this.soloRocketContainer.add(p);
            this.soloRocketStage4FxObjects.push(p);

            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.05,
                scaleY: 0.05,
                duration: Phaser.Math.Between(210, 380),
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    try { p.destroy(); } catch (_) {}
                    this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== p);
                }
            });
        }
    }


    fireSoloRocketMonsterBulletBurst(monster) {
        if (!monster || !monster.active || monster.__soloRocketDead || monster.__soloRocketSpawnPending || !this.soloRocketContainer) return;

        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 145, () => {
                if (!monster || !monster.active || monster.__soloRocketDead || monster.__soloRocketSpawnPending || !this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

                const bullet = this.add.ellipse(
                    monster.x + Phaser.Math.Between(-5, 5),
                    monster.y + Phaser.Math.Between(14, 20),
                    8,
                    22,
                    i % 2 === 0 ? 0xd9b3ff : 0xffffff,
                    0.95
                )
                    .setStrokeStyle(2, 0x7b2cff, 0.9)
                    .setDepth(9614)
                    .setScrollFactor(0)
                    .setBlendMode(Phaser.BlendModes.ADD);

                bullet.__soloRocketVy = Phaser.Math.Between(245, 315);
                bullet.__soloRocketDamage = 3;
                bullet.__soloRocketRadius = 11;
                bullet.__soloRocketSpin = Phaser.Math.Between(360, 620) * (Math.random() < 0.5 ? -1 : 1);

                const glow = this.add.ellipse(bullet.x, bullet.y, 16, 34, 0x7b2cff, 0.22)
                    .setDepth(9613)
                    .setScrollFactor(0)
                    .setBlendMode(Phaser.BlendModes.ADD);
                bullet.__soloRocketGlow = glow;

                this.soloRocketContainer.add([glow, bullet]);
                this.soloRocketMonsterBullets = this.soloRocketMonsterBullets || [];
                this.soloRocketMonsterBullets.push(bullet);
            });
        }
    }

    updateSoloRocketStage4(dt) {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const beams = (this.soloRocketBeams || []).slice();
        const monsters = (this.soloRocketMonsters || []).slice();
        const bullets = (this.soloRocketMonsterBullets || []).slice();
        const now = Date.now();

        beams.forEach(beam => {
            if (!beam || !beam.active) {
                this.destroySoloRocketBeam(beam);
                return;
            }
            beam.y += (beam.__soloRocketVy || -720) * dt;

            if (Array.isArray(beam.__soloRocketFx)) {
                beam.__soloRocketFx.forEach(fx => {
                    if (!fx || !fx.active) return;
                    fx.x = beam.x;
                    fx.y = beam.y + (fx.__soloRocketOffsetY || 0);
                });
            }

            if (beam.y < rect.y - 90) this.destroySoloRocketBeam(beam);
        });

        monsters.forEach(monster => {
            if (!monster || !monster.active || monster.__soloRocketDead) {
                this.destroySoloRocketMonster(monster);
                return;
            }

            if (monster.__soloRocketSpawnPending) return;

            monster.x += (monster.__soloRocketVx || 0) * dt;
            monster.y += (monster.__soloRocketVy || 90) * dt;

            // 小怪獸本體微微上下震顫：用「本次 offset - 上次 offset」避免位移越飄越遠。
            monster.__soloRocketFloatPhase = (monster.__soloRocketFloatPhase || 0) + dt * 8.5;
            const nextOffset = Math.sin(monster.__soloRocketFloatPhase) * 1.55;
            monster.y += nextOffset - (monster.__soloRocketFloatOffset || 0);
            monster.__soloRocketFloatOffset = nextOffset;

            if (now >= (monster.__soloRocketNextShotAt || 0)) {
                this.fireSoloRocketMonsterBulletBurst(monster);
                monster.__soloRocketNextShotAt = now + Phaser.Math.Between(1650, 2850);
            }

            const passedPlayerLine = (monster.__soloRocketVy || 0) > 0 && monster.y > (monster.__soloRocketTargetY || rect.centerY) + 150;
            const outOfBounds =
                monster.y > rect.y + rect.h + 90 ||
                monster.x < rect.x - 90 ||
                monster.x > rect.x + rect.w + 90;

            if (passedPlayerLine || outOfBounds) {
                this.destroySoloRocketMonster(monster);
            }
        });

        bullets.forEach(bullet => {
            if (!bullet || !bullet.active) {
                this.destroySoloRocketMonsterBullet(bullet);
                return;
            }

            bullet.y += (bullet.__soloRocketVy || 260) * dt;
            bullet.angle += (bullet.__soloRocketSpin || 420) * dt;

            const glow = bullet.__soloRocketGlow;
            if (glow && glow.active) {
                glow.x = bullet.x;
                glow.y = bullet.y;
                glow.angle = bullet.angle;
            }

            if (bullet.y > rect.y + rect.h + 44) {
                this.destroySoloRocketMonsterBullet(bullet);
            }
        });

        this.checkSoloRocketBeamMonsterHits();
        this.checkSoloRocketBeamBossHits();
        this.checkSoloRocketMonsterPlayerHits();
        this.checkSoloRocketMonsterBulletPlayerHits();
    }
  
    showSoloRocketMonsterExplosion(x, y, mode = 'kill') {
        if (!this.soloRocketContainer) return;

        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];

        const isHitPlayer = mode === 'hitPlayer';
        const colors = isHitPlayer
            ? [0xff3355, 0xffaa33, 0xffffff, 0x9b1bff]
            : [0xffffff, 0xffdd55, 0xff8844, 0x66ffff];

        const ringColor = isHitPlayer ? 0xff3355 : 0xffdd55;

        const ring = this.add.circle(x, y, 10, ringColor, 0)
            .setStrokeStyle(4, ringColor, 0.9)
            .setDepth(9620)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.soloRocketContainer.add(ring);
        this.soloRocketStage4FxObjects.push(ring);

        this.tweens.add({
            targets: ring,
            scale: isHitPlayer ? 3.2 : 2.6,
            alpha: 0,
            duration: 300,
            ease: 'Sine.easeOut',
            onComplete: () => {
                try { ring.destroy(); } catch (_) {}
                this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== ring);
            }
        });

        if (!this.textures.exists('particle_flare')) return;

        const count = isHitPlayer ? 18 : 14;
        for (let i = 0; i < count; i++) {
            const p = this.add.image(x, y, 'particle_flare')
                .setTint(colors[i % colors.length])
                .setAlpha(0.95)
                .setScale(Phaser.Math.FloatBetween(0.85, 1.65))
                .setDepth(9621)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            const angle = Math.random() * Math.PI * 2;
            const dist = Phaser.Math.Between(isHitPlayer ? 28 : 22, isHitPlayer ? 78 : 60);

            this.soloRocketContainer.add(p);
            this.soloRocketStage4FxObjects.push(p);

            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.05,
                scaleY: 0.05,
                duration: Phaser.Math.Between(220, 420),
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    try { p.destroy(); } catch (_) {}
                    this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== p);
                }
            });
        }
    }

    showSoloRocketPlayerHitFeedback() {
        const rocket = this.soloRocketPlayer;
        if (!rocket || !rocket.active || !this.soloRocketContainer) return;

        try {
            const now = Date.now();
            if (!window.GameLogic.muteSFX && now - (this.__soloRocketLastBangAt || 0) > 120 && this.cache.audio.exists('solo-rocket-bang')) {
                this.__soloRocketLastBangAt = now;
                window.playSFX(this, 'solo-rocket-bang');
            }
        } catch (_) {}

        if (this.tweens) this.tweens.killTweensOf(rocket);
        this.resetSoloRocketPlayerFacingUp(true);

        const baseX = rocket.x;
        const baseY = rocket.y;
        const auraSize = Math.max(42, (this.soloRocketPlayerRadius || 28) * 2.2);

        try {
            if (rocket.setTint) rocket.setTint(0xff7a7a);
        } catch (_) {}

        // 狀態下降感：紅紫色短暫漸層感光暈。
        const auraOuter = this.add.circle(baseX, baseY, auraSize * 0.65, 0xff2244, 0.20)
            .setDepth(9622)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        const auraInner = this.add.circle(baseX, baseY, auraSize * 0.38, 0x7b2cff, 0.24)
            .setDepth(9623)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.soloRocketContainer.add([auraOuter, auraInner]);
        this.soloRocketStage4FxObjects = this.soloRocketStage4FxObjects || [];
        this.soloRocketStage4FxObjects.push(auraOuter, auraInner);

        this.tweens.add({
            targets: [auraOuter, auraInner],
            scaleX: 2.2,
            scaleY: 1.65,
            alpha: 0,
            duration: 360,
            ease: 'Sine.easeOut',
            onComplete: () => {
                [auraOuter, auraInner].forEach(obj => {
                    try { if (obj && obj.destroy) obj.destroy(); } catch (_) {}
                });
                this.soloRocketStage4FxObjects = (this.soloRocketStage4FxObjects || []).filter(obj => obj !== auraOuter && obj !== auraInner);
            }
        });

        // 火箭短暫震動。受擊前先停止舊 tween，結束後一律回到正面朝上。
        this.tweens.add({
            targets: rocket,
            x: { from: baseX - 5, to: baseX + 5 },
            y: { from: baseY - 3, to: baseY + 3 },
            angle: { from: -2.2, to: 2.2 },
            yoyo: true,
            repeat: 4,
            duration: 34,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                try {
                    if (rocket && rocket.active) {
                        rocket.setPosition(baseX, baseY);
                        this.resetSoloRocketPlayerFacingUp(true);
                        if (rocket.clearTint) rocket.clearTint();
                    }
                } catch (_) {}
            }
        });

        this.time.delayedCall(220, () => {
            try {
                if (rocket && rocket.active) {
                    this.resetSoloRocketPlayerFacingUp(true);
                    if (rocket.clearTint) rocket.clearTint();
                }
            } catch (_) {}
        });
    }
  
    checkSoloRocketBeamMonsterHits() {
        const beams = (this.soloRocketBeams || []).slice();
        const monsters = (this.soloRocketMonsters || []).slice();

        beams.forEach(beam => {
            if (!beam || !beam.active || beam.__soloRocketUsed) return;

            let beamBounds;
            try { beamBounds = beam.getBounds(); } catch (_) { return; }

            for (const monster of monsters) {
                if (!monster || !monster.active || monster.__soloRocketDead || monster.__soloRocketSpawnPending || monster.__soloRocketCanBeHit === false) continue;

                let monsterBounds;
                try { monsterBounds = monster.getBounds(); } catch (_) { continue; }

                if (Phaser.Geom.Intersects.RectangleToRectangle(beamBounds, monsterBounds)) {
                    beam.__soloRocketUsed = true;
                    monster.__soloRocketHp = (monster.__soloRocketHp || 1) - (beam.__soloRocketDamage || 2);
                    this.destroySoloRocketBeam(beam);

                    this.recordSoloRocketBigAttackHit();

                    if (monster.__soloRocketHp <= 0) {
                        this.handleSoloRocketMonsterKilled(monster);
                    }
                    break;
                }
            }
        });
    }

    handleSoloRocketMonsterKilled(monster) {
        const x = monster ? monster.x : 0;
        const y = monster ? monster.y : 0;

        this.showSoloRocketMonsterExplosion(x, y, 'kill');
        this.playSoloRocketMonsterDieSfx();
        this.destroySoloRocketMonster(monster);

        this.soloRocketStats = this.soloRocketStats || {};
        this.soloRocketStats.monsterKills = (this.soloRocketStats.monsterKills || 0) + 1;

        const oldLife = Number(this.soloRocketLifeValue || 0);
        this.setSoloRocketLifeValue(oldLife + 5);

        if (Number(this.soloRocketLifeValue || 0) > oldLife && this.showSoloRocketLifeHealFx) {
            this.showSoloRocketLifeHealFx();
        }
    }

    checkSoloRocketMonsterPlayerHits() {
        if (!this.soloRocketPlayer || !this.soloRocketPlayer.active) return;

        let playerBounds;
        try { playerBounds = this.soloRocketPlayer.getBounds(); } catch (_) { return; }

        const monsters = (this.soloRocketMonsters || []).slice();
        for (const monster of monsters) {
            if (!monster || !monster.active || monster.__soloRocketDead || monster.__soloRocketSpawnPending || monster.__soloRocketCanBeHit === false) continue;

            let monsterBounds;
            try { monsterBounds = monster.getBounds(); } catch (_) { continue; }

            if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, monsterBounds)) {
                const hitX = monster.x;
                const hitY = monster.y;
                const isSpinning = this.soloRocketSpinActive || Date.now() < (this.__soloRocketSpinInvincibleUntil || 0);

                if (isSpinning) {
                    monster.__soloRocketSpinBlocked = true;

                    this.showSoloRocketAsteroidBlockedFx(hitX, hitY);
                    this.showSoloRocketMonsterExplosion(hitX, hitY, 'kill');
                    this.playSoloRocketMonsterDieSfx();
                    this.destroySoloRocketMonster(monster);

                    this.soloRocketStats = this.soloRocketStats || {};
                    this.soloRocketStats.spinDodges = (this.soloRocketStats.spinDodges || 0) + 1;
                    this.soloRocketStats.monsterKills = (this.soloRocketStats.monsterKills || 0) + 1;

                    continue;
                }

                this.showSoloRocketMonsterExplosion(hitX, hitY, 'hitPlayer');
                this.playSoloRocketMonsterDieSfx();
                this.showSoloRocketPlayerHitFeedback();
                this.destroySoloRocketMonster(monster);

                this.soloRocketStats = this.soloRocketStats || {};
                this.soloRocketStats.monsterHits = (this.soloRocketStats.monsterHits || 0) + 1;
                this.setSoloRocketLifeValue((this.soloRocketLifeValue || 0) - 10);

                if ((this.soloRocketLifeValue || 0) <= 0) {
                    this.setSoloRocketLifeValue(0);
                    this.finishSoloRocketCruise();
                    return;
                }
            }
        }
    }

    checkSoloRocketMonsterBulletPlayerHits() {
        if (!this.soloRocketPlayer || !this.soloRocketPlayer.active) return;
        const isSpinning = this.soloRocketSpinActive || Date.now() < (this.__soloRocketSpinInvincibleUntil || 0);

        let playerBounds;
        try { playerBounds = this.soloRocketPlayer.getBounds(); } catch (_) { return; }

        const bullets = (this.soloRocketMonsterBullets || []).slice();
        for (const bullet of bullets) {
            if (!bullet || !bullet.active) continue;

            let bulletBounds;
            try { bulletBounds = bullet.getBounds(); } catch (_) { continue; }

            if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, bulletBounds)) {
                const hitX = bullet.x;
                const hitY = bullet.y;

                if (isSpinning) {
                    this.destroySoloRocketMonsterBullet(bullet);
                    this.showSoloRocketAsteroidBlockedFx(hitX, hitY);

                    this.soloRocketStats = this.soloRocketStats || {};
                    this.soloRocketStats.spinDodges = (this.soloRocketStats.spinDodges || 0) + 1;

                    continue;
                }

                this.destroySoloRocketMonsterBullet(bullet);

                this.showSoloRocketPlayerHitFeedback();
                this.showSoloRocketMonsterExplosion(hitX, hitY, 'hitPlayer');

                this.soloRocketStats = this.soloRocketStats || {};
                this.soloRocketStats.monsterHits = (this.soloRocketStats.monsterHits || 0) + 1;
                this.setSoloRocketLifeValue((this.soloRocketLifeValue || 0) - 3);

                if ((this.soloRocketLifeValue || 0) <= 0) {
                    this.setSoloRocketLifeValue(0);
                    this.finishSoloRocketCruise();
                    return;
                }
            }
        }
    }
  
    createSoloRocketCruiseLayer() {
        const cam = this.cameras.main;
        const rect = this.getSoloRocketSafeRect();
        this.soloRocketSafeRect = rect;
        this.soloRocketStars = [];

        const container = this.add.container(0, 0).setDepth(9600).setScrollFactor(0);
        this.soloRocketContainer = container;

        const base = this.add.graphics();
        base.fillStyle(0x000000, 1).fillRect(0, 0, cam.width, cam.height);
        base.fillStyle(0x02020d, 1).fillRect(rect.x, rect.y, rect.w, rect.h);
        container.add(base);

        if (this.textures.exists('solo-rocket-bg')) {
            const bg = this.add.tileSprite(rect.centerX, rect.centerY, rect.w, rect.h, 'solo-rocket-bg');
            const src = this.textures.get('solo-rocket-bg').getSourceImage();
            const texW = Math.max(1, src && src.width ? src.width : 1080);
            const bgScale = rect.w / texW;
            bg.setTileScale(bgScale, bgScale);
            bg.setDepth(9601);
            container.add(bg);
            this.soloRocketBg = bg;
        } else {
            console.warn('[火箭巡航] 找不到 solo-rocket-bg.png，改用黑底星空 fallback。');
            for (let i = 0; i < 90; i++) {
                const star = this.add.circle(
                    Phaser.Math.Between(rect.x + 8, rect.x + rect.w - 8),
                    Phaser.Math.Between(rect.y + 8, rect.y + rect.h - 8),
                    Phaser.Math.FloatBetween(0.8, 2.2),
                    0xffffff,
                    Phaser.Math.FloatBetween(0.35, 0.95)
                );
                star.__speed = Phaser.Math.Between(35, 130);
                container.add(star);
                this.soloRocketStars.push(star);
            }
        }

        const decor = this.add.graphics();
        decor.lineStyle(3, 0x8a2be2, 1).strokeRect(rect.x, rect.y, rect.w, rect.h);
        decor.lineStyle(1, 0xffffff, 0.25).strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
        decor.fillStyle(0x7b2cff, 0.10);
        decor.fillRect(0, 0, Math.max(0, rect.x), cam.height);
        decor.fillRect(rect.x + rect.w, 0, Math.max(0, cam.width - rect.x - rect.w), cam.height);
        container.add(decor);

        for (let i = 0; i < 80; i++) {
            const onLeft = Math.random() < 0.5;
            const sideW = onLeft ? rect.x : (cam.width - rect.x - rect.w);
            if (sideW <= 8) continue;

            const sx = onLeft
                ? Phaser.Math.Between(6, Math.max(8, rect.x - 8))
                : Phaser.Math.Between(rect.x + rect.w + 8, Math.max(rect.x + rect.w + 12, cam.width - 6));

            const sy = Phaser.Math.Between(-20, cam.height);
            const sideStar = this.add.image(sx, sy, 'particle_flare')
                .setTint(0xffffff)
                .setAlpha(Phaser.Math.FloatBetween(0.25, 0.85))
                .setScale(Phaser.Math.FloatBetween(0.75, 1.8))
                .setBlendMode(Phaser.BlendModes.ADD);

            sideStar.__speed = Phaser.Math.Between(30, 95);
            sideStar.__sideStar = true;

            this.tweens.add({
                targets: sideStar,
                alpha: { from: 0.18, to: 1 },
                scaleX: { from: sideStar.scaleX * 0.75, to: sideStar.scaleX * 1.35 },
                scaleY: { from: sideStar.scaleY * 0.75, to: sideStar.scaleY * 1.35 },
                duration: Phaser.Math.Between(450, 1200),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            container.add(sideStar);
            this.soloRocketStars.push(sideStar);
        }

        if (this.textures.exists('rocket-onion-player')) {
            const rocket = this.add.image(rect.centerX, rect.y + rect.h * 0.72, 'rocket-onion-player');
            const rocketSize = Math.min(60, rect.w * 0.18);
            rocket.setDisplaySize(rocketSize, rocketSize);
            rocket.setDepth(9610);
            container.add(rocket);
            this.soloRocketPlayer = rocket;
            this.soloRocketPlayerRadius = Math.max(18, rocketSize * 0.36);
        } else {
            console.warn('[火箭巡航] 找不到 rocket-onion-player.png，改用簡易火箭 fallback。');
            const rocketContainer = this.add.container(rect.centerX, rect.y + rect.h * 0.72).setDepth(9610);
            const rocketG = this.add.graphics();
            rocketG.fillStyle(0xf5f5ff, 1).fillRoundedRect(-20, -46, 40, 76, 18);
            rocketG.fillStyle(0xff4444, 1).fillTriangle(0, -72, -22, -38, 22, -38);
            rocketG.fillStyle(0x66ccff, 1).fillCircle(0, -18, 10);
            rocketG.fillStyle(0x8a2be2, 1).fillTriangle(-20, 12, -44, 44, -14, 34);
            rocketG.fillTriangle(20, 12, 44, 44, 14, 34);
            rocketContainer.add(rocketG);
            rocketContainer.setScale(0.68);
            container.add(rocketContainer);
            this.soloRocketPlayer = rocketContainer;
            this.soloRocketPlayerRadius = 28;
        }

        if (this.soloRocketPlayer) {
            this.soloRocketPlayer.__soloRocketNormalScaleX = this.soloRocketPlayer.scaleX || 1;
            this.soloRocketPlayer.__soloRocketNormalScaleY = this.soloRocketPlayer.scaleY || 1;
            this.resetSoloRocketPlayerFacingUp(true);
        }

        if (this.textures.exists('particle_flare') && this.soloRocketPlayer) {
            this.soloRocketThrusterFx = this.add.particles(0, 0, 'particle_flare', {
                lifespan: { min: 260, max: 420 },
                frequency: 26,
                quantity: 3,
                scale: { start: 0.95, end: 0.06 },
                alpha: { start: 0.95, end: 0 },
                tint: [0xff3b1f, 0xff7a00, 0xffdd33],
                blendMode: 'ADD',
                angle: { min: 84, max: 96 },
                speedY: { min: 170, max: 260 },
                speedX: { min: -35, max: 35 },
                rotate: { min: 0, max: 180 },
                emitting: true
            });
            this.soloRocketThrusterFx.setDepth(9609).setScrollFactor(0);
            this.soloRocketThrusterFx.startFollow(
                this.soloRocketPlayer,
                0,
                Math.max(18, this.soloRocketPlayerRadius || 28)
            );
        }

        const ui = this.add.container(0, 0).setDepth(9700).setScrollFactor(0);
        this.soloRocketUiContainer = ui;

        const timerText = this.add.text(rect.x + rect.w - 14, rect.y + 14, '剩餘 2:37', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(1, 0);
        this.soloRocketCountdownText = timerText;

        const drawHeartMaskPath = (graphics, cx, cy, size) => {
            // 只作為液體遮罩使用：真正的生命容器外觀改由 PNG 呈現。
            const pts = [
                [0.00, 0.34],
                [-0.10, 0.26],
                [-0.22, 0.15],
                [-0.35, 0.02],
                [-0.46, -0.12],
                [-0.50, -0.28],
                [-0.44, -0.42],
                [-0.31, -0.50],
                [-0.17, -0.48],
                [-0.07, -0.38],
                [0.00, -0.25],
                [0.07, -0.38],
                [0.17, -0.48],
                [0.31, -0.50],
                [0.44, -0.42],
                [0.50, -0.28],
                [0.46, -0.12],
                [0.35, 0.02],
                [0.22, 0.15],
                [0.10, 0.26]
            ];

            graphics.beginPath();
            graphics.moveTo(cx + pts[0][0] * size, cy + pts[0][1] * size);
            for (let i = 1; i < pts.length; i++) {
                graphics.lineTo(cx + pts[i][0] * size, cy + pts[i][1] * size);
            }
            graphics.closePath();
        };

        const heartCx = rect.x + rect.w - 56;
        const heartCy = rect.y + 98;
        const heartSize = 58;
        const heartDisplaySize = heartSize * 1.62;
        const heartMaskSize = heartDisplaySize * 0.98;
        const lifeUi = this.add.container(0, 0);

        const fillBaseY = heartCy + heartMaskSize * 0.52;
        const fillMaxHeight = heartMaskSize * 1.05;

        const fillRect = this.add.rectangle(
            heartCx,
            fillBaseY,
            heartMaskSize * 1.34,
            fillMaxHeight,
            0x39ff14,
            0.98
        ).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);

        const liquidGlow = this.add.rectangle(
            heartCx,
            fillBaseY,
            heartMaskSize * 1.50,
            fillMaxHeight,
            0xa6ff66,
            0.40
        ).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);

        const frontLiquid = this.add.rectangle(
            heartCx,
            fillBaseY,
            heartMaskSize * 1.26,
            fillMaxHeight,
            0x39ff14,
            0.34
        ).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);

        const waterSurface = this.add.ellipse(
            heartCx,
            fillBaseY - fillMaxHeight,
            heartMaskSize * 1.16,
            10,
            0xeaffff,
            0.88
        ).setBlendMode(Phaser.BlendModes.ADD);

        const waterBubbles = [];
        for (let i = 0; i < 6; i++) {
            const bubbleDot = this.add.circle(
                heartCx + Phaser.Math.Between(-22, 22),
                heartCy + Phaser.Math.Between(-22, 24),
                Phaser.Math.FloatBetween(1.7, 3.4),
                0xffffff,
                0.36
            ).setBlendMode(Phaser.BlendModes.ADD);

            waterBubbles.push(bubbleDot);

            this.tweens.add({
                targets: bubbleDot,
                y: bubbleDot.y - Phaser.Math.Between(8, 18),
                alpha: { from: 0.18, to: 0.64 },
                yoyo: true,
                repeat: -1,
                duration: Phaser.Math.Between(700, 1200),
                ease: 'Sine.easeInOut'
            });
        }

        const heartMaskShape = this.add.graphics();
        heartMaskShape.fillStyle(0xffffff, 1);
        drawHeartMaskPath(heartMaskShape, heartCx, heartCy, heartMaskSize);
        heartMaskShape.fillPath();
        heartMaskShape.setVisible(false);

        const heartMask = heartMaskShape.createGeometryMask();
        fillRect.setMask(heartMask);
        liquidGlow.setMask(heartMask);
        frontLiquid.setMask(heartMask);
        waterSurface.setMask(heartMask);
        waterBubbles.forEach(function(b) {
            b.setMask(heartMask);
        });

        let heartGlow = null;
        let heartFrame = null;

        if (this.textures.exists('solo-rocket-heart-life-container')) {
            heartGlow = this.add.image(heartCx, heartCy, 'solo-rocket-heart-life-container')
                .setDisplaySize(heartDisplaySize * 1.08, heartDisplaySize * 1.08)
                .setTint(0xffffff)
                .setAlpha(0.32)
                .setBlendMode(Phaser.BlendModes.ADD);

            heartFrame = this.add.image(heartCx, heartCy, 'solo-rocket-heart-life-container')
                .setDisplaySize(heartDisplaySize, heartDisplaySize)
                .setAlpha(1);
        } else {
            console.warn('[火箭巡航] 找不到 solo-rocket-heart-life-container.png，生命容器暫用安全 fallback。');

            heartGlow = this.add.graphics();
            heartGlow.fillStyle(0xffffff, 0.12);
            drawHeartMaskPath(heartGlow, heartCx, heartCy, heartSize + 8);
            heartGlow.fillPath();

            heartFrame = this.add.graphics();
            heartFrame.lineStyle(3, 0x39ff14, 0.95);
            drawHeartMaskPath(heartFrame, heartCx, heartCy, heartSize);
            heartFrame.strokePath();
        }

        const heartPulse = this.add.container(heartCx, heartCy).setAlpha(0.34);

        if (this.textures.exists('solo-rocket-heart-life-container')) {
            const pulseImg = this.add.image(0, 0, 'solo-rocket-heart-life-container')
                .setDisplaySize(heartDisplaySize * 1.16, heartDisplaySize * 1.16)
                .setTint(0x39ff14)
                .setAlpha(1)
                .setBlendMode(Phaser.BlendModes.ADD);
            heartPulse.add(pulseImg);
        } else {
            const pulseShape = this.add.graphics();
            pulseShape.lineStyle(4, 0x39ff14, 0.9);
            drawHeartMaskPath(pulseShape, 0, 0, heartMaskSize + 6);
            pulseShape.strokePath();
            pulseShape.setBlendMode(Phaser.BlendModes.ADD);
            heartPulse.add(pulseShape);
        }
      
        const lifeText = this.add.text(heartCx, heartCy + 6, '100%', {
            fontSize: '17px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#0b5d22',
            strokeThickness: 5
        }).setOrigin(0.5);

        lifeUi.add([heartPulse, heartGlow, fillRect, liquidGlow, waterSurface]);
        waterBubbles.forEach(bubble => lifeUi.add(bubble));
        lifeUi.add([heartMaskShape, heartFrame, frontLiquid, lifeText]);
        ui.add([timerText, lifeUi]);

        this.soloRocketLifeText = lifeText;
        this.soloRocketLifeUi = {
            container: lifeUi,
            heartPulse,
            heartGlow,
            heartFrame,
            fillRect,
            liquidGlow,
            frontLiquid,
            waterSurface,
            waterBubbles,
            text: lifeText,
            fillBaseY,
            fillMaxHeight
        };

        this.soloRocketLifeBreathTween = this.tweens.add({
            targets: heartGlow,
            alpha: { from: 0.18, to: 0.56 },
            scaleX: { from: 0.98, to: 1.08 },
            scaleY: { from: 0.98, to: 1.08 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.soloRocketLifePulseTween = this.tweens.add({
            targets: heartPulse,
            alpha: { from: 0.36, to: 0 },
            scaleX: { from: 0.92, to: 1.34 },
            scaleY: { from: 0.92, to: 1.34 },
            duration: 920,
            repeat: -1,
            ease: 'Cubic.easeOut'
        });

        this.setSoloRocketLifeValue(
            this.soloRocketLifeValue !== null && this.soloRocketLifeValue !== undefined
                ? this.soloRocketLifeValue
                : 100
        );
        this.startSoloRocketLifeFloatTween();

        const makeRocketButton = (x, y, radius, color, label, actionName) => {
            const btn = this.add.circle(x, y, radius, color, 0.62)
                .setStrokeStyle(3, 0xffffff, 0.9)
                .setScrollFactor(0);

            const txt = this.add.text(x, y, label, {
                fontSize: '17px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0);

            // 透明 Hit Zone：比圓形略大，專門負責接收 pointerdown。
            // 避免玩家點到文字邊緣、透明區或手機觸控偏移時沒有反應。
            const hit = this.add.zone(x, y, radius * 2.12, radius * 2.12)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });

            const click = (pointer, localX, localY, event) => {
                if (event && event.stopPropagation) event.stopPropagation();

                btn.setFillStyle(0xffffff, 0.86);
                this.tweens.add({
                    targets: [btn, txt],
                    scaleX: 0.88,
                    scaleY: 0.88,
                    yoyo: true,
                    duration: 80,
                    onComplete: () => {
                        btn.setFillStyle(color, 0.62);
                        btn.setScale(1);
                        txt.setScale(1);
                    }
                });

                if (this.soloRocketInputLocked || this.soloRocketTutorialActive || this.soloRocketIntroActive || this.soloRocketEndingActive) {
                    console.log(`[火箭巡航] ${actionName} 目前鎖定中`);
                    return;
                }

                if (actionName === 'fire') {
                    this.fireSoloRocketBeam();
                    return;
                }

                if (actionName === 'spin') {
                    this.spinSoloRocketPlayer();
                    return;
                }

                if (actionName === 'big') {
                    this.castSoloRocketBigAttack();
                    return;
                }

                console.log(`[火箭巡航] ${actionName} 尚未開放`);
                if (typeof sendBubble === 'function') sendBubble(`${label}功能尚未開放`);
            };

            hit.on('pointerdown', click);
            hit.on('pointerup', (pointer, localX, localY, event) => {
                if (event && event.stopPropagation) event.stopPropagation();
            });

            ui.add([btn, txt, hit]);
            return { btn, txt, hit, x, y, radius, color, label, actionName };
        };

        const rightPanelW = Math.max(0, cam.width - (rect.x + rect.w));
        const useRightPanel = rightPanelW >= 116;
        const btnX = useRightPanel
            ? Math.min(cam.width - 58, rect.x + rect.w + 66)
            : rect.x + rect.w - 58;
        const spinBtnY = rect.y + rect.h - 142;
        const fireBtnY = rect.y + rect.h - 62;
        const bigBtnY = Math.max(rect.y + 106, spinBtnY - 82);
        const spinBtnRadius = 34;

        this.soloRocketFireButtonState = makeRocketButton(btnX, fireBtnY, 34, 0xd9534f, '發射', 'fire');
        this.soloRocketSpinButtonState = makeRocketButton(btnX, spinBtnY, spinBtnRadius, 0x0077cc, '旋轉', 'spin');
        this.soloRocketBigAttackButtonState = makeRocketButton(btnX, bigBtnY, 35, 0xffdd33, '放大絕', 'big');

        const bigGlow = this.add.circle(btnX, bigBtnY, 45, 0xffff66, 0)
            .setStrokeStyle(5, 0xffff66, 0.85)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false);
        ui.add(bigGlow);
        this.soloRocketBigAttackGlow = bigGlow;
        this.setSoloRocketBigAttackButtonVisible(false);

        const spinFillMaskShape = this.add.circle(btnX, spinBtnY, spinBtnRadius - 2, 0xffffff, 1)
            .setScrollFactor(0)
            .setVisible(false);

        const spinFillMask = spinFillMaskShape.createGeometryMask();

        const spinFill = this.add.rectangle(
            btnX,
            spinBtnY + spinBtnRadius - 2,
            (spinBtnRadius - 2) * 2,
            0.01,
            0x66ccff,
            0.45
        )
            .setOrigin(0.5, 1)
            .setScrollFactor(0)
            .setVisible(false)
            .setBlendMode(Phaser.BlendModes.ADD);

        spinFill.setMask(spinFillMask);

        const spinCdText = this.add.text(btnX, spinBtnY + 3, '', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#003344',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setVisible(false);

        ui.add([spinFillMaskShape, spinFill, spinCdText]);

        this.soloRocketSpinCooldownMaskShape = spinFillMaskShape;
        this.soloRocketSpinCooldownFill = spinFill;
        this.soloRocketSpinCooldownText = spinCdText;
        this.soloRocketSpinCooldownMaxHeight = (spinBtnRadius - 2) * 2;
        this.soloRocketSpinCooldownBaseY = spinBtnY + spinBtnRadius - 2;
        this.updateSoloRocketSpinCooldownUi();

        // life UI 已在上方改為愛心容器，這裡不再加入舊版 lifeBg / lifeText
    }

    startSoloRocketLifeFloatTween() {
        const ui = this.soloRocketLifeUi;
        if (!ui || !ui.container || !ui.container.active) return;

        try {
            if (this.soloRocketLifeFloatTween && this.soloRocketLifeFloatTween.stop) this.soloRocketLifeFloatTween.stop();
            this.tweens.killTweensOf(ui.container);
        } catch (_) {}

        ui.container.setPosition(0, 0);
        ui.container.setAngle(0);

        this.soloRocketLifeFloatTween = this.tweens.add({
            targets: ui.container,
            x: { from: -2.5, to: 2.5 },
            y: { from: 0, to: -1.5 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
  
    setSoloRocketLifeValue(nextValue = 100) {
        const previous = Number.isFinite(Number(this.soloRocketLifeValue)) ? Number(this.soloRocketLifeValue) : 100;
        const raw = Number(nextValue);
        const next = Phaser.Math.Clamp(Number.isFinite(raw) ? raw : 0, 0, 100);
        const isDamage = next < previous;

        this.soloRocketLifeValue = next;

        const ui = this.soloRocketLifeUi;
        if (!ui || !ui.fillRect || !ui.text) return;

        const ratio = Phaser.Math.Clamp(this.soloRocketLifeValue / 100, 0, 1);
        const nextHeight = Math.max(0.01, ui.fillMaxHeight * ratio);
        const nextSurfaceY = ui.fillBaseY - nextHeight;

        try {
            this.tweens.killTweensOf(ui.fillRect);
            if (ui.liquidGlow) this.tweens.killTweensOf(ui.liquidGlow);
            if (ui.frontLiquid) this.tweens.killTweensOf(ui.frontLiquid);
            if (ui.waterSurface) this.tweens.killTweensOf(ui.waterSurface);
        } catch (_) {}

        this.tweens.add({
            targets: ui.fillRect,
            height: nextHeight,
            y: ui.fillBaseY,
            duration: isDamage ? 260 : 180,
            ease: isDamage ? 'Cubic.easeOut' : 'Sine.easeOut'
        });

        if (ui.liquidGlow) {
            this.tweens.add({
                targets: ui.liquidGlow,
                height: nextHeight,
                y: ui.fillBaseY,
                alpha: ratio > 0.08 ? 0.34 : 0,
                duration: isDamage ? 260 : 180,
                ease: isDamage ? 'Cubic.easeOut' : 'Sine.easeOut'
            });
        }

        if (ui.frontLiquid) {
            this.tweens.add({
                targets: ui.frontLiquid,
                height: nextHeight,
                y: ui.fillBaseY,
                alpha: ratio > 0.08 ? 0.34 : 0,
                duration: isDamage ? 260 : 180,
                ease: isDamage ? 'Cubic.easeOut' : 'Sine.easeOut'
            });
        }

        if (ui.waterSurface) {
            this.tweens.add({
                targets: ui.waterSurface,
                y: nextSurfaceY,
                scaleX: isDamage ? { from: 1.28, to: 1 } : 1,
                duration: isDamage ? 260 : 180,
                ease: 'Cubic.easeOut'
            });
        }

        if (Array.isArray(ui.waterBubbles)) {
            ui.waterBubbles.forEach((b, index) => {
                if (!b || !b.active) return;
                const minY = nextSurfaceY + 10;
                const maxY = ui.fillBaseY - 10;
                b.setVisible(ratio > 0.12);
                this.tweens.add({
                    targets: b,
                    y: Phaser.Math.Clamp(b.y, minY, Math.max(minY, maxY)) - Phaser.Math.Between(2, 8),
                    alpha: ratio > 0.12 ? Phaser.Math.FloatBetween(0.18, 0.52) : 0,
                    yoyo: true,
                    repeat: 1,
                    duration: 180 + index * 20,
                    ease: 'Sine.easeInOut'
                });
            });
        }

        ui.text.setText(`${Math.round(this.soloRocketLifeValue)}%`);

        if (isDamage) {
            this.showSoloRocketLifeHitShake();
        }
    }

    showSoloRocketLifeHealFx() {
        const ui = this.soloRocketLifeUi;
        if (!ui || !ui.text || !this.soloRocketUiContainer) return;

        this.soloRocketLifeHealFxObjects = this.soloRocketLifeHealFxObjects || [];

        const baseX = ui.text.x;
        const baseY = ui.text.y - 10;

        for (let i = 0; i < 16; i++) {
            const x = baseX + Phaser.Math.Between(-34, 34);
            const y = baseY + Phaser.Math.Between(14, 46);
            const h = Phaser.Math.Between(22, 48);
            const color = (i % 2 === 0) ? 0x39ff14 : 0xffffff;

            const p = this.add.rectangle(x, y, Phaser.Math.FloatBetween(4, 7), h, color, 0.94)
                .setOrigin(0.5, 1)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            this.soloRocketUiContainer.add(p);
            this.soloRocketLifeHealFxObjects.push(p);

            this.tweens.add({
                targets: p,
                y: y - Phaser.Math.Between(58, 104),
                alpha: 0,
                scaleX: 0.7,
                scaleY: 1.85,
                duration: Phaser.Math.Between(520, 860),
                ease: 'Cubic.easeOut',
                onComplete: function() {
                    this.soloRocketLifeHealFxObjects = (this.soloRocketLifeHealFxObjects || []).filter(function(obj) {
                        return obj !== p;
                    });
                    try { p.destroy(); } catch (_) {}
                },
                callbackScope: this
            });
        }

        if (ui.container && this.tweens) {
            try {
                if (this.soloRocketLifeFloatTween && this.soloRocketLifeFloatTween.stop) {
                    this.soloRocketLifeFloatTween.stop();
                }
                this.tweens.killTweensOf(ui.container);
                ui.container.setPosition(0, 0);
                ui.container.setScale(1);
            } catch (_) {}

            this.tweens.add({
                targets: ui.container,
                x: 0,
                y: -7,
                yoyo: true,
                duration: 115,
                ease: 'Sine.easeOut',
                onComplete: function() {
                    if (ui.container && ui.container.active) {
                        ui.container.setPosition(0, 0);
                        ui.container.setScale(1);
                    }
                    if (this.startSoloRocketLifeFloatTween) {
                        this.startSoloRocketLifeFloatTween();
                    }
                },
                callbackScope: this
            });
        }

        if (ui.heartGlow && this.tweens) {
            this.tweens.add({
                targets: ui.heartGlow,
                alpha: 1,
                scaleX: 1.28,
                scaleY: 1.28,
                yoyo: true,
                duration: 135,
                ease: 'Sine.easeOut'
            });
        }
    }
  
    showSoloRocketLifeHitShake() {
        const ui = this.soloRocketLifeUi;
        if (!ui || !ui.container || !ui.text) return;

        try {
            if (this.soloRocketLifeFloatTween && this.soloRocketLifeFloatTween.stop) this.soloRocketLifeFloatTween.stop();
            this.tweens.killTweensOf(ui.container);
            this.tweens.killTweensOf(ui.text);
            if (ui.heartFrame) this.tweens.killTweensOf(ui.heartFrame);
            if (ui.heartGlow) this.tweens.killTweensOf(ui.heartGlow);
            if (ui.frontLiquid) this.tweens.killTweensOf(ui.frontLiquid);
        } catch (_) {}

        ui.container.setPosition(0, 0);
        ui.container.setAngle(0);
        ui.text.setColor('#ffffff');
        ui.text.setStroke('#ffffff', 6);

        try {
            if (ui.heartFrame && ui.heartFrame.setTint) ui.heartFrame.setTint(0xffffff);
            if (ui.heartGlow && ui.heartGlow.setTint) ui.heartGlow.setTint(0xffffff);
            if (ui.frontLiquid && ui.frontLiquid.setFillStyle) ui.frontLiquid.setFillStyle(0xffffff, 0.42);
        } catch (_) {}

        const gx = ui.text.x;
        const gy = ui.text.y;
        const glitchA = this.add.rectangle(gx - 3, gy - 12, 82, 5, 0xffffff, 0.92)
            .setDepth(9710)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        const glitchB = this.add.rectangle(gx + 6, gy + 9, 70, 4, 0xffffff, 0.78)
            .setDepth(9710)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        const glitchC = this.add.rectangle(gx - 10, gy + 1, 44, 3, 0x39ff14, 0.72)
            .setDepth(9711)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        if (this.soloRocketUiContainer) {
            this.soloRocketUiContainer.add(glitchA);
            this.soloRocketUiContainer.add(glitchB);
            this.soloRocketUiContainer.add(glitchC);
        }

        this.tweens.add({
            targets: ui.container,
            x: { from: -8, to: 8 },
            y: { from: -3, to: 3 },
            angle: { from: -3, to: 3 },
            duration: 45,
            yoyo: true,
            repeat: 5,
            ease: 'Stepped',
            onComplete: () => {
                try {
                    if (ui.container && ui.container.active) {
                        ui.container.setPosition(0, 0);
                        ui.container.setAngle(0);
                    }
                    this.startSoloRocketLifeFloatTween();
                } catch (_) {}
            }
        });

        this.tweens.add({
            targets: [glitchA, glitchB, glitchC],
            x: '+=10',
            alpha: 0,
            duration: 95,
            yoyo: true,
            repeat: 2,
            ease: 'Stepped',
            onComplete: () => {
                try { glitchA.destroy(); } catch (_) {}
                try { glitchB.destroy(); } catch (_) {}
                try { glitchC.destroy(); } catch (_) {}
            }
        });

        const flashTargets = [];
        flashTargets.push(ui.text);
        if (ui.heartFrame) flashTargets.push(ui.heartFrame);
        if (ui.heartGlow) flashTargets.push(ui.heartGlow);

        this.tweens.add({
            targets: flashTargets,
            alpha: { from: 0.20, to: 1 },
            duration: 55,
            yoyo: true,
            repeat: 4,
            ease: 'Stepped',
            onComplete: () => {
                try {
                    if (ui.text && ui.text.active) {
                        ui.text.setAlpha(1);
                        ui.text.setStroke('#0b5d22', 5);
                    }
                    if (ui.heartFrame && ui.heartFrame.active) {
                        ui.heartFrame.setAlpha(1);
                        if (ui.heartFrame.clearTint) ui.heartFrame.clearTint();
                    }
                    if (ui.heartGlow && ui.heartGlow.active) {
                        ui.heartGlow.setAlpha(0.32);
                        if (ui.heartGlow.clearTint) ui.heartGlow.clearTint();
                    }
                    if (ui.frontLiquid && ui.frontLiquid.active && ui.frontLiquid.setFillStyle) {
                        ui.frontLiquid.setFillStyle(0x39ff14, 0.34);
                    }
                } catch (_) {}
            }
        });
    }

    updateSoloRocketCruise(time, delta) {
        if (!this.soloRocketCruiseActive) return;

        this.hideSoloRocketLobbyUi();

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const dt = Math.min(delta || 16, 50) / 1000;

        if (this.soloRocketBg && typeof this.soloRocketBg.tilePositionY === 'number') {
            this.soloRocketBg.tilePositionY -= 140 * dt / Math.max(0.1, this.soloRocketBg.tileScaleY || 1);
        }

        if (Array.isArray(this.soloRocketStars)) {
            this.soloRocketStars.forEach(star => {
                if (!star || !star.active) return;
                star.y += (star.__speed || 60) * dt;
                if (star.y > this.cameras.main.height + 10) {
                    star.y = -10;
                    if (star.__sideStar) {
                        star.alpha = Phaser.Math.FloatBetween(0.25, 0.9);
                    }
                }
            });
        }

        // 教學介面顯示期間：只保留背景流動，不開始倒數、不接受輸入。
        if (!this.soloRocketGameplayStarted || this.soloRocketTutorialActive) {
            if (this.soloRocketCountdownText) this.soloRocketCountdownText.setText('剩餘 2:37');
            return;
        }

        const elapsed = Date.now() - (this.soloRocketStartTime || Date.now());

        this.updateSoloRocketStage6WarningTimeline(elapsed);
        this.updateSoloRocketBossTimeline(elapsed);

        if (!this.soloRocketCruiseFinished && elapsed >= 152000) {
            this.stopSoloRocketMonsterSpawning();
        }

        if (!this.soloRocketCruiseFinished && elapsed >= 154000) {
            this.soloRocketInputLocked = true;
            this.soloRocketEndingActive = true;

            if (!this.soloRocketStage4ClearedForEnding) {
                this.soloRocketStage4ClearedForEnding = true;
                this.clearSoloRocketStage4Objects(false);
            }
        }

        if (!this.soloRocketCruiseFinished && elapsed >= 155000) {
            this.beginSoloRocketEndingSequence();
        }

        const canControlRocket =
            !this.soloRocketCruiseFinished &&
            !this.soloRocketInputLocked &&
            !this.soloRocketIntroActive &&
            !this.soloRocketEndingActive;

        if (canControlRocket && this.soloRocketPlayer) {
            const uiScene = this.scene.manager.getScene('UIScene');
            let ix = 0;
            let iy = 0;
            let usingJoystick = false;

            if (uiScene && uiScene.joyStick && uiScene.joyStick.force > 3) {
                usingJoystick = true;
                const forceRate = Phaser.Math.Clamp(uiScene.joyStick.force / 40, 0, 1);
                ix = Math.cos(uiScene.joyStick.angle * Math.PI / 180) * forceRate;
                iy = Math.sin(uiScene.joyStick.angle * Math.PI / 180) * forceRate;
            } else if (document.activeElement.tagName !== 'INPUT') {
                if (!this.soloRocketWasd) this.soloRocketWasd = this.input.keyboard.addKeys('W,A,S,D');
                if (this.cursors.left.isDown || this.soloRocketWasd.A.isDown) ix -= 1;
                if (this.cursors.right.isDown || this.soloRocketWasd.D.isDown) ix += 1;
                if (this.cursors.up.isDown || this.soloRocketWasd.W.isDown) iy -= 1;
                if (this.cursors.down.isDown || this.soloRocketWasd.S.isDown) iy += 1;
            }

            if (ix !== 0 || iy !== 0) {
                const len = Math.sqrt(ix * ix + iy * iy) || 1;
                if (len > 1) {
                    ix /= len;
                    iy /= len;
                }
            }

            const speed = usingJoystick ? 225 : 270;
            const pad = this.soloRocketPlayerRadius || 28;
            this.soloRocketPlayer.x = Phaser.Math.Clamp(this.soloRocketPlayer.x + ix * speed * dt, rect.x + pad, rect.x + rect.w - pad);
            this.soloRocketPlayer.y = Phaser.Math.Clamp(this.soloRocketPlayer.y + iy * speed * dt, rect.y + pad, rect.y + rect.h - pad);
        }

        this.updateSoloRocketStage4(dt);
        this.updateSoloRocketSpinShieldPosition();
        this.updateSoloRocketAsteroids(dt, elapsed);
        this.updateSoloRocketBoss(dt, elapsed);
        this.updateSoloRocketBossMissiles(dt);
        this.updateSoloRocketBigAttacks(dt);
        this.updateSoloRocketSpinCooldownUi();
        if (this.soloRocketCruiseFinished) return;

        if (this.soloRocketCountdownText) {
            const remainSec = Math.max(0, Math.ceil((this.soloRocketDurationMs - elapsed) / 1000));
            const m = Math.floor(remainSec / 60);
            const s = String(remainSec % 60).padStart(2, '0');
            this.soloRocketCountdownText.setText(`剩餘 ${m}:${s}`);

            if (!this.soloRocketCruiseFinished && elapsed >= this.soloRocketDurationMs) {
                this.finishSoloRocketCruise();
            }
        }
    }

    finishSoloRocketCruise() {
        if (!this.soloRocketCruiseActive || this.soloRocketCruiseFinished) return;

        this.soloRocketCruiseFinished = true;
        this.soloRocketInputLocked = true;
        this.soloRocketTutorialActive = false;
        this.soloRocketIntroActive = false;
        this.soloRocketEndingActive = false;

        if (this.soloRocketTimer) {
            this.soloRocketTimer.remove(false);
            this.soloRocketTimer = null;
        }

        this.clearSoloRocketTutorial();
        this.clearSoloRocketIntroFx();
        this.clearSoloRocketStage4Objects(false);
        this.clearSoloRocketStage6Objects(false);
        this.stopSoloRocketBgm();

        this.destroySoloRocketResultOverlay();

        const summary = this.calculateSoloRocketMoonSummary();
        this.soloRocketRunSummary = summary;
        this.soloRocketMoonBudget = summary.moonBudget;
        this.soloRocketMoonBudgetLeft = summary.moonBudget;
        this.soloRocketMoonShopPurchases = {};
        this.soloRocketMoonShardBoughtThisRun = false;
        this.soloRocketMoonShopFinalized = false;
        this.soloRocketMoonShopFinalizing = false;
        this.soloRocketMoonFinalResult = null;

        this.showSoloRocketPreShopResult(summary);
    }

    destroySoloRocketResultOverlay() {
        try {
            if (this.soloRocketResultClickCatcher) this.soloRocketResultClickCatcher.destroy();
        } catch (_) {}
        try {
            if (this.soloRocketResultContainer) this.soloRocketResultContainer.destroy(true);
        } catch (_) {}

        this.soloRocketResultClickCatcher = null;
        this.soloRocketResultContainer = null;
    }

    calculateSoloRocketMoonSummary() {
        const stats = this.soloRocketStats || {};
        const life = Math.max(0, Math.round(
            this.soloRocketLifeValue !== null && this.soloRocketLifeValue !== undefined
                ? this.soloRocketLifeValue
                : 0
        ));

        const monsterKills = Number(stats.monsterKills || 0);
        const asteroidsDodged = Number(stats.asteroidsDodged || 0);
        const spinDodges = Number(stats.spinDodges || 0);
        const bossKilled = !!(stats.bossKilled || this.soloRocketBossKilled);
        const bossPunished = !!(stats.bossPunished || this.soloRocketBossPunished);
        const lifeZero = life <= 0;

        const score = Math.max(0,
            life * 10 +
            monsterKills * 20 +
            asteroidsDodged * 5 +
            spinDodges * 30 +
            (bossKilled ? 1000 : 0) -
            (bossPunished ? 300 : 0)
        );

        let moonBudget =
            80 +
            monsterKills +
            spinDodges * 2 +
            Math.floor(asteroidsDodged / 2) +
            (bossKilled ? 120 : 0) +
            (!bossPunished ? 50 : 0) +
            Math.floor(Math.min(80, life * 0.8));

        const budgetCap = lifeZero ? 80 : 400;
        moonBudget = Phaser.Math.Clamp(Math.floor(moonBudget), 0, budgetCap);

        return {
            score,
            life,
            monsterKills,
            asteroidsDodged,
            spinDodges,
            bossKilled,
            bossPunished,
            moonBudget,
            budgetCap,
            lifeZero
        };
    }

    showSoloRocketPreShopResult(summary) {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        this.destroySoloRocketResultOverlay();

        const result = this.add.container(0, 0).setDepth(9800).setScrollFactor(0);
        this.soloRocketResultContainer = result;

        const panelW = Math.min(rect.w - 34, 400);
        const panelH = 382;
        const px = rect.centerX - panelW / 2;
        const py = rect.centerY - panelH / 2;

        let didEnterShop = false;
        const enterShop = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (didEnterShop) return;
            didEnterShop = true;
            this.openSoloRocketRabbitShop();
        };

        const shopBtnHit = { x: rect.centerX, y: py + panelH - 58, w: 270, h: 84 };

        const clickCatcher = this.add.zone(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height
        )
            .setDepth(9905)
            .setScrollFactor(0)
            .setInteractive();

        this.soloRocketResultClickCatcher = clickCatcher;

        const handleClick = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (!pointer) return;

            const inShopBtn =
                pointer.x >= shopBtnHit.x - shopBtnHit.w / 2 &&
                pointer.x <= shopBtnHit.x + shopBtnHit.w / 2 &&
                pointer.y >= shopBtnHit.y - shopBtnHit.h / 2 &&
                pointer.y <= shopBtnHit.y + shopBtnHit.h / 2;

            if (inShopBtn) enterShop(pointer, localX, localY, event);
        };

        clickCatcher.on('pointerdown', handleClick);
        clickCatcher.on('pointerup', handleClick);

        const bg = this.add.graphics();
        bg.fillStyle(0x050008, 0.96).fillRoundedRect(px, py, panelW, panelH, 18);
        bg.lineStyle(4, 0xffd36a, 1).strokeRoundedRect(px, py, panelW, panelH, 18);
        bg.lineStyle(2, 0x8a2be2, 0.9).strokeRoundedRect(px + 8, py + 8, panelW - 16, panelH - 16, 14);

        const titleText = summary.bossKilled ? '魔王擊破！' : '抵達月球邊境';
        const title = this.add.text(rect.centerX, py + 42, titleText, {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#fff8d6',
            stroke: '#8a2be2',
            strokeThickness: 5
        }).setOrigin(0.5);

        const resultText = [
            `本趟分數：${summary.score}`,
            `月球旅費：${summary.moonBudget} 馬德幣`,
            `剩餘生命：${summary.life}%`,
            `擊殺小怪獸：${summary.monsterKills}`,
            `躲過/清除隕石：${summary.asteroidsDodged}`,
            `成功旋轉抵消：${summary.spinDodges}`,
            `魔王狀態：${summary.bossKilled ? '魔王擊破' : '未擊破'}`
        ].join('\n');

        const body = this.add.text(rect.centerX, py + 88, resultText, {
            fontSize: '17px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#eaffff',
            stroke: '#000000',
            strokeThickness: 4,
            lineSpacing: 8,
            align: 'left'
        }).setOrigin(0.5, 0);

        const btnBg = this.add.rectangle(rect.centerX, shopBtnHit.y, 228, 48, 0xffffff, 1)
            .setStrokeStyle(3, 0xffd36a, 1)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(rect.centerX, shopBtnHit.y, '前往玉兔伴手禮店', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const btnHit = this.add.zone(shopBtnHit.x, shopBtnHit.y, shopBtnHit.w, shopBtnHit.h)
            .setInteractive({ useHandCursor: true });

        [btnBg, btnText, btnHit].forEach(obj => {
            obj.on('pointerdown', enterShop);
            obj.on('pointerup', enterShop);
        });

        result.add([bg, title, body, btnBg, btnText, btnHit]);
    }
    getSoloRocketMoonShopItems() {
        return [
            {
                name: '月光碎片',
                price: 150,
                limitOne: true,
                key: 'solo-rocket-item-moon-shard',
                fallback: '🌙',
                desc: '月亮掉下來的一小角。據說集滿 100 個，可以再找玉兔兌換神秘東西。'
            },
            {
                name: '月光法杖',
                price: 50,
                limitOne: false,
                key: 'solo-rocket-item-moon-staff',
                fallback: '🪄',
                desc: '揮舞後可在大廳播放月光祝福動畫。本次先只入庫，不啟用效果。'
            },
            {
                name: '月光饅頭',
                price: 100,
                limitOne: false,
                key: 'solo-rocket-item-moon-bun',
                fallback: '🥮',
                desc: '玉兔手作的月球饅頭。本次先只入庫，不啟用掃地增益。'
            }
        ];
    }

    openSoloRocketRabbitShop() {
        this.destroySoloRocketResultOverlay();
        this.stopSoloRocketBgm();
        this.renderSoloRocketRabbitShop();

        if (this.playSoloRocketRabbitShopBgm) {
            this.playSoloRocketRabbitShopBgm();
        }

        if (this.time && this.time.delayedCall) {
            this.time.delayedCall(160, function() {
                if (this.soloRocketRabbitShopContainer && this.playSoloRocketRabbitShopBgm) {
                    this.playSoloRocketRabbitShopBgm();
                }
            }, [], this);
        }
    }

    playSoloRocketRabbitShopBgm() {
        try {
            if (!this.cache.audio.exists('solo-rocket-rabbit-shop-bgm')) {
                console.warn('[玉兔伴手禮店] 找不到 solo-rocket-rabbit-shop-bgm.mp3，請確認檔案已上傳且檔名大小寫完全一致。');
                if (this.soloRocketRabbitShopMessage) {
                    this.soloRocketRabbitShopMessage.setText('玉兔：我找不到商店音樂檔，請確認 solo-rocket-rabbit-shop-bgm.mp3 有上傳。');
                }
                return;
            }

            this.stopSoloRocketBgm();

            if (this.stopLobbyBgmForSoloRocket) {
                this.stopLobbyBgmForSoloRocket();
            }

            const volControl = document.getElementById('bgm-volume');
            let vol = volControl ? Number(volControl.value || 100) / 100 : 0.8;
            if (!Number.isFinite(vol)) vol = 0.8;
            vol = Phaser.Math.Clamp(vol, 0.05, 1);

            const playNow = function() {
                try {
                    if (!this.soloRocketRabbitShopContainer) return;

                    const current = this.soloRocketRabbitShopBgm;
                    if (current && current.isPlaying) {
                        current.setVolume(vol);
                        return;
                    }

                    this.sound.getAll('solo-rocket-rabbit-shop-bgm').forEach(function(snd) {
                        try {
                            snd.stop();
                            if (snd.destroy) snd.destroy();
                        } catch (_) {}
                    });

                    this.soloRocketRabbitShopBgm = this.sound.add('solo-rocket-rabbit-shop-bgm', {
                        loop: true,
                        volume: vol
                    });

                    this.soloRocketRabbitShopBgm.play();

                    if (this.time && this.time.delayedCall) {
                        this.time.delayedCall(280, function() {
                            if (
                                this.soloRocketRabbitShopContainer &&
                                this.soloRocketRabbitShopBgm &&
                                !this.soloRocketRabbitShopBgm.isPlaying
                            ) {
                                try {
                                    this.soloRocketRabbitShopBgm.play();
                                } catch (err) {
                                    console.warn('[玉兔伴手禮店] BGM 第二次播放仍失敗：', err);
                                }
                            }
                        }, [], this);
                    }
                } catch (err) {
                    console.warn('[玉兔伴手禮店] BGM 實際播放失敗，已略過：', err);
                }
            };

            if (this.sound && this.sound.context && this.sound.context.state === 'suspended' && this.sound.context.resume) {
                this.sound.context.resume().then(function() {
                    playNow.call(this);
                }.bind(this)).catch(function(err) {
                    console.warn('[玉兔伴手禮店] 音訊環境喚醒失敗，改為直接嘗試播放：', err);
                    playNow.call(this);
                }.bind(this));
                playNow.call(this);
                return;
            }

            if (this.sound && this.sound.locked) {
                this.sound.once('unlocked', function() {
                    playNow.call(this);
                }, this);

                if (this.sound.unlock) {
                    try { this.sound.unlock(); } catch (_) {}
                }

                playNow.call(this);
                return;
            }

            playNow.call(this);
        } catch (err) {
            console.warn('[玉兔伴手禮店] BGM 播放失敗，已略過：', err);
        }
    }

    stopSoloRocketRabbitShopBgm() {
        try {
            if (this.soloRocketRabbitShopBgm) {
                try { this.soloRocketRabbitShopBgm.stop(); } catch (_) {}
                try {
                    if (this.soloRocketRabbitShopBgm.destroy) {
                        this.soloRocketRabbitShopBgm.destroy();
                    }
                } catch (_) {}
            }

            if (this.sound) {
                try {
                    this.sound.getAll('solo-rocket-rabbit-shop-bgm').forEach(function(snd) {
                        try { snd.stop(); } catch (_) {}
                        try {
                            if (snd.destroy) snd.destroy();
                        } catch (_) {}
                    });
                } catch (_) {}

                try {
                    if (this.sound.stopByKey) {
                        this.sound.stopByKey('solo-rocket-rabbit-shop-bgm');
                    }
                } catch (_) {}

                try {
                    if (this.sound.removeByKey) {
                        this.sound.removeByKey('solo-rocket-rabbit-shop-bgm');
                    }
                } catch (_) {}
            }
        } catch (err) {
            console.warn('[玉兔伴手禮店] 停止 BGM 失敗，已略過：', err);
        }

        this.soloRocketRabbitShopBgm = null;
    }

    startSoloRocketRabbitShopMeteors() {
        if (!this.soloRocketRabbitShopContainer || !this.soloRocketRabbitShopMeteorLayer) return;

        try {
            if (this.soloRocketRabbitShopMeteorTimer && this.soloRocketRabbitShopMeteorTimer.remove) {
                this.soloRocketRabbitShopMeteorTimer.remove(false);
            }
        } catch (_) {}
        this.soloRocketRabbitShopMeteorTimer = null;

        try {
            (this.soloRocketRabbitShopMeteorObjects || []).forEach(function(obj) {
                try {
                    if (obj && obj.destroy) obj.destroy();
                } catch (_) {}
            });
        } catch (_) {}
        this.soloRocketRabbitShopMeteorObjects = [];

        for (let i = 0; i < 4; i++) {
            this.time.delayedCall(i * 160, function() {
                if (this.soloRocketRabbitShopContainer && this.soloRocketRabbitShopMeteorLayer) {
                    this.spawnSoloRocketRabbitShopMeteor();
                }
            }, [], this);
        }

        const scheduleNext = function() {
            if (!this.soloRocketRabbitShopContainer || !this.soloRocketRabbitShopMeteorLayer) return;

            const delay = Phaser.Math.Between(460, 780);
            this.soloRocketRabbitShopMeteorTimer = this.time.delayedCall(delay, function() {
                if (this.soloRocketRabbitShopContainer && this.soloRocketRabbitShopMeteorLayer) {
                    this.spawnSoloRocketRabbitShopMeteor();
                    scheduleNext.call(this);
                }
            }, [], this);
        };

        scheduleNext.call(this);
    }

    spawnSoloRocketRabbitShopMeteor() {
        const layer = this.soloRocketRabbitShopMeteorLayer;
        if (!layer || !this.soloRocketRabbitShopContainer) return;

        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const startX = Phaser.Math.Between(Math.floor(rect.x + 42), Math.floor(rect.x + rect.w - 42));
        const startY = Phaser.Math.Between(Math.floor(rect.y + 72), Math.floor(rect.y + rect.h * 0.35));
        const landX = Phaser.Math.Clamp(startX + Phaser.Math.Between(-54, 54), rect.x + 28, rect.x + rect.w - 28);
        const landY = Phaser.Math.Between(Math.floor(rect.y + rect.h * 0.54), Math.floor(rect.y + rect.h - 118));

        const trail = this.add.graphics().setScrollFactor(0);
        trail.setBlendMode(Phaser.BlendModes.ADD);

        const head = this.add.circle(startX, startY, 5, 0xfff2a8, 1)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        const halo = this.add.circle(startX, startY, 11, 0xffd36a, 0.22)
            .setScrollFactor(0)
            .setBlendMode(Phaser.BlendModes.ADD);

        layer.add([trail, halo, head]);

        this.soloRocketRabbitShopMeteorObjects = this.soloRocketRabbitShopMeteorObjects || [];
        this.soloRocketRabbitShopMeteorObjects.push(trail);
        this.soloRocketRabbitShopMeteorObjects.push(halo);
        this.soloRocketRabbitShopMeteorObjects.push(head);

        const motion = { t: 0 };

        this.tweens.add({
            targets: motion,
            t: 1,
            duration: Phaser.Math.Between(360, 560),
            ease: 'Cubic.easeIn',
            onUpdate: function() {
                if (!this.soloRocketRabbitShopContainer || !layer || !head || !head.active) return;

                const t = motion.t;
                const x = startX + (landX - startX) * t;
                const y = startY + (landY - startY) * t;

                head.setPosition(x, y);
                halo.setPosition(x, y);

                trail.clear();

                const tailT = Math.max(0, t - 0.28);
                const tailX = startX + (landX - startX) * tailT;
                const tailY = startY + (landY - startY) * tailT;

                trail.lineStyle(4, 0xffd36a, 0.82);
                trail.lineBetween(tailX, tailY, x, y);

                trail.lineStyle(2, 0xffffff, 0.78);
                trail.lineBetween(tailX + 2, tailY + 1, x, y);
            },
            onComplete: function() {
                if (!this.soloRocketRabbitShopContainer || !layer) {
                    try { trail.destroy(); } catch (_) {}
                    try { halo.destroy(); } catch (_) {}
                    try { head.destroy(); } catch (_) {}
                    return;
                }

                trail.clear();

                trail.lineStyle(4, 0xffd36a, 0.72);
                trail.lineBetween(startX + (landX - startX) * 0.74, startY + (landY - startY) * 0.74, landX, landY);
                trail.lineStyle(2, 0xffffff, 0.74);
                trail.lineBetween(startX + (landX - startX) * 0.82, startY + (landY - startY) * 0.82, landX, landY);

                head.setPosition(landX, landY);
                halo.setPosition(landX, landY);

                this.tweens.add({
                    targets: trail,
                    alpha: 0,
                    duration: 140,
                    ease: 'Sine.easeOut',
                    onComplete: function() {
                        this.soloRocketRabbitShopMeteorObjects = (this.soloRocketRabbitShopMeteorObjects || []).filter(function(obj) {
                            return obj !== trail;
                        });
                        try { trail.destroy(); } catch (_) {}
                    },
                    callbackScope: this
                });

                this.tweens.add({
                    targets: [head, halo],
                    y: landY - 10,
                    scaleX: 1.18,
                    scaleY: 1.18,
                    duration: 80,
                    yoyo: true,
                    ease: 'Sine.easeOut',
                    onComplete: function() {
                        this.spawnSoloRocketRabbitShopSparkles(landX, landY, layer);

                        this.tweens.add({
                            targets: [head, halo],
                            alpha: 0,
                            scaleX: 0.25,
                            scaleY: 0.25,
                            duration: 180,
                            ease: 'Cubic.easeOut',
                            onComplete: function() {
                                this.soloRocketRabbitShopMeteorObjects = (this.soloRocketRabbitShopMeteorObjects || []).filter(function(obj) {
                                    return obj !== head && obj !== halo;
                                });
                                try { head.destroy(); } catch (_) {}
                                try { halo.destroy(); } catch (_) {}
                            },
                            callbackScope: this
                        });
                    },
                    callbackScope: this
                });
            },
            callbackScope: this
        });
    }
    spawnSoloRocketRabbitShopSparkles(x, y, layer) {
        if (!layer) return;

        this.soloRocketRabbitShopMeteorObjects = this.soloRocketRabbitShopMeteorObjects || [];
        const count = Phaser.Math.Between(4, 8);

        for (let i = 0; i < count; i++) {
            const p = this.add.circle(x, y, Phaser.Math.FloatBetween(3.2, 6.2), 0xfff2a8, 0.98)
                .setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD);

            layer.add(p);
            this.soloRocketRabbitShopMeteorObjects.push(p);

            const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
            const dist = Phaser.Math.Between(18, 42);

            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: Phaser.Math.Between(260, 430),
                ease: 'Cubic.easeOut',
                onComplete: function() {
                    this.soloRocketRabbitShopMeteorObjects = (this.soloRocketRabbitShopMeteorObjects || []).filter(function(obj) {
                        return obj !== p;
                    });
                    try { p.destroy(); } catch (_) {}
                },
                callbackScope: this
            });
        }
    }

    stopSoloRocketRabbitShopMeteors() {
        try {
            if (this.soloRocketRabbitShopMeteorTimer && this.soloRocketRabbitShopMeteorTimer.remove) {
                this.soloRocketRabbitShopMeteorTimer.remove(false);
            }
        } catch (_) {}

        this.soloRocketRabbitShopMeteorTimer = null;

        try {
            (this.soloRocketRabbitShopMeteorObjects || []).forEach(function(obj) {
                try {
                    if (obj && obj.destroy) obj.destroy();
                } catch (_) {}
            });
        } catch (_) {}

        this.soloRocketRabbitShopMeteorObjects = [];

        try {
            if (this.soloRocketRabbitShopMeteorLayer && this.soloRocketRabbitShopMeteorLayer.destroy) {
                this.soloRocketRabbitShopMeteorLayer.destroy(true);
            }
        } catch (_) {}

        this.soloRocketRabbitShopMeteorLayer = null;
    }
    clearSoloRocketRabbitSpeechBubble() {
        try {
            if (this.soloRocketRabbitShopSpeechTimer && this.soloRocketRabbitShopSpeechTimer.remove) {
                this.soloRocketRabbitShopSpeechTimer.remove(false);
            }
        } catch (_) {}

        this.soloRocketRabbitShopSpeechTimer = null;

        try {
            if (this.soloRocketRabbitShopSpeechBubble && this.soloRocketRabbitShopSpeechBubble.destroy) {
                this.soloRocketRabbitShopSpeechBubble.destroy(true);
            }
        } catch (_) {}

        this.soloRocketRabbitShopSpeechBubble = null;
        this.soloRocketRabbitShopSpeechText = null;
        this.soloRocketRabbitShopMessage = null;
    }

    createSoloRocketRabbitSpeechBubble(text) {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const shop = this.soloRocketRabbitShopContainer;
        if (!shop) return;

        this.clearSoloRocketRabbitSpeechBubble();

        const bubbleW = Math.min(rect.w - 32, 370);
        const bubbleH = 76;
        const bubbleX = rect.centerX;
        const bubbleY = Phaser.Math.Clamp(
            rect.y + rect.h * 0.22,
            rect.y + 96,
            rect.y + rect.h - 330
        );
        const bubbleLeft = bubbleX - bubbleW / 2;
        const bubbleTop = bubbleY - bubbleH / 2;

        const bubble = this.add.container(0, 0).setScrollFactor(0);
        const bg = this.add.graphics();
        bg.fillStyle(0x12001f, 0.72);
        bg.fillRoundedRect(bubbleLeft, bubbleTop, bubbleW, bubbleH, 15);
        bg.lineStyle(2, 0xffd36a, 0.92);
        bg.strokeRoundedRect(bubbleLeft, bubbleTop, bubbleW, bubbleH, 15);

        const triX = Phaser.Math.Clamp(
            bubbleX + bubbleW * 0.26,
            bubbleLeft + 40,
            bubbleLeft + bubbleW - 40
        );
        bg.fillStyle(0x12001f, 0.72);
        bg.fillTriangle(triX, bubbleTop + bubbleH, triX + 20, bubbleTop + bubbleH, triX + 8, bubbleTop + bubbleH + 18);
        bg.lineStyle(2, 0xffd36a, 0.7);
        bg.lineBetween(triX, bubbleTop + bubbleH, triX + 8, bubbleTop + bubbleH + 18);
        bg.lineBetween(triX + 20, bubbleTop + bubbleH, triX + 8, bubbleTop + bubbleH + 18);

        const txt = this.add.text(bubbleLeft + 16, bubbleTop + 14, '', {
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#fff8d6',
            stroke: '#000000',
            strokeThickness: 3,
            lineSpacing: 3,
            wordWrap: { width: bubbleW - 32 }
        }).setOrigin(0, 0);

        bubble.add([bg, txt]);
        shop.add(bubble);

        this.soloRocketRabbitShopSpeechBubble = bubble;
        this.soloRocketRabbitShopSpeechText = txt;
        this.soloRocketRabbitShopMessage = txt;

        this.typeSoloRocketRabbitSpeech(text || '', 26);
    }

    typeSoloRocketRabbitSpeech(fullText, speed) {
        const txt = this.soloRocketRabbitShopSpeechText;
        if (!txt || !txt.active) return;

        try {
            if (this.soloRocketRabbitShopSpeechTimer && this.soloRocketRabbitShopSpeechTimer.remove) {
                this.soloRocketRabbitShopSpeechTimer.remove(false);
            }
        } catch (_) {}

        const safeText = String(fullText || '');
        const chars = safeText.split('');
        let idx = 0;

        txt.setText('');

        if (chars.length === 0) {
            this.soloRocketRabbitShopSpeechTimer = null;
            return;
        }

        this.soloRocketRabbitShopSpeechTimer = this.time.addEvent({
            delay: Math.max(12, Number(speed || 26)),
            repeat: chars.length - 1,
            callback: function() {
                idx += 1;
                if (txt && txt.active) {
                    txt.setText(chars.slice(0, idx).join(''));
                }
            },
            callbackScope: this
        });
    }
    clearSoloRocketRabbitShopUi() {
        try {
            if (this.soloRocketRabbitShopInputHandler) {
                this.input.off('pointerdown', this.soloRocketRabbitShopInputHandler, this);
            }
        } catch (_) {}

        if (this.clearSoloRocketRabbitSpeechBubble) this.clearSoloRocketRabbitSpeechBubble();
        if (this.stopSoloRocketRabbitShopMeteors) this.stopSoloRocketRabbitShopMeteors();

        try {
            if (this.soloRocketRabbitShopContainer) this.soloRocketRabbitShopContainer.destroy(true);
        } catch (_) {}
        this.soloRocketRabbitShopContainer = null;
        this.soloRocketRabbitShopBudgetText = null;
        this.soloRocketRabbitShopMessage = null;
        this.soloRocketRabbitShopKeeperObj = null;
        this.soloRocketRabbitShopHitAreas = null;
        this.soloRocketRabbitShopInputHandler = null;
        this.soloRocketSelectedMoonShopItemName = null;
    }
  
    renderSoloRocketRabbitShop() {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        const selectedItem = this.getSoloRocketShopItemByName(this.soloRocketSelectedMoonShopItemName);

        this.clearSoloRocketRabbitShopUi();
        this.soloRocketSelectedMoonShopItemName = selectedItem ? selectedItem.name : null;

        const shop = this.add.container(0, 0).setDepth(9820).setScrollFactor(0);
        this.soloRocketRabbitShopContainer = shop;

        const fullBg = this.add.graphics();
        fullBg.fillStyle(0x000000, 1).fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        let bgObj = null;
        if (this.textures.exists('solo-rocket-rabbit-shop-bg')) {
            bgObj = this.add.image(rect.centerX, rect.centerY, 'solo-rocket-rabbit-shop-bg');
            const src = this.textures.get('solo-rocket-rabbit-shop-bg').getSourceImage();
            const texW = Math.max(1, src && src.width ? src.width : 1080);
            const texH = Math.max(1, src && src.height ? src.height : 1920);
            bgObj.setScale(Math.max(rect.w / texW, rect.h / texH));
            bgObj.setAlpha(0.96);
        }

        const fallbackBg = this.add.graphics();
        fallbackBg.fillGradientStyle(0x160020, 0x160020, 0x02020d, 0x02020d, bgObj ? 0.42 : 1);
        fallbackBg.fillRect(rect.x, rect.y, rect.w, rect.h);
        fallbackBg.fillStyle(0xffd36a, 0.14).fillCircle(rect.x + rect.w * 0.82, rect.y + rect.h * 0.14, 58);

        this.soloRocketRabbitShopBudgetText = this.add.text(rect.centerX, rect.y + 34,
            `月球旅費剩餘：${this.soloRocketMoonBudgetLeft || 0}`, {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#ffeb8a',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const subtitle = this.add.text(rect.centerX, rect.y + 62,
            '點選伴手禮查看資訊，沒花完的旅費會匯回馬德幣帳戶。', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: rect.w - 28 }
        }).setOrigin(0.5);

        const rabbitSize = Math.min(300, rect.w * 0.74, rect.h * 0.34);
        const rabbitX = rect.x + rect.w - rabbitSize * 0.48;
        const rabbitY = rect.y + rect.h - rabbitSize * 0.45 - 28;

        let rabbitObj = null;
        if (this.textures.exists('solo-rocket-rabbit-shopkeeper')) {
            rabbitObj = this.add.image(rabbitX, rabbitY, 'solo-rocket-rabbit-shopkeeper')
                .setDisplaySize(rabbitSize, rabbitSize)
                .setAlpha(0.98);
        } else {
            rabbitObj = this.add.text(rabbitX, rabbitY, '🐰', {
                fontSize: `${Math.round(rabbitSize * 0.62)}px`,
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(0.5);
        }
        this.soloRocketRabbitShopKeeperObj = rabbitObj;
        if (rabbitObj) {
            rabbitObj.__soloRocketShopBaseX = rabbitObj.x;
            rabbitObj.__soloRocketShopBaseY = rabbitObj.y;
            rabbitObj.__soloRocketShopBaseScaleX = rabbitObj.scaleX;
            rabbitObj.__soloRocketShopBaseScaleY = rabbitObj.scaleY;
        }

        const meteorLayer = this.add.container(0, 0).setScrollFactor(0);
        meteorLayer.setDepth(1);
        this.soloRocketRabbitShopMeteorLayer = meteorLayer;
        const items = this.getSoloRocketMoonShopItems();
        const iconSize = Math.min(82, rect.w * 0.21);
        const productGap = Math.min(iconSize + 42, rect.w * 0.30);
        const productStartX = rect.centerX - productGap;
        const productY = Phaser.Math.Clamp(
            rect.y + rect.h * 0.36,
            rect.y + 138,
            rect.y + rect.h - 330
        );

        const objects = [fullBg, fallbackBg];
        if (bgObj) objects.push(bgObj);
        objects.push(meteorLayer, this.soloRocketRabbitShopBudgetText, subtitle, rabbitObj);

        this.soloRocketRabbitShopHitAreas = {
            products: [],
            buy: null,
            leave: null,
            screen: { x: rect.centerX, y: rect.centerY, w: rect.w, h: rect.h }
        };

        items.forEach((item, idx) => {
            const x = Phaser.Math.Clamp(
                productStartX + idx * productGap,
                rect.x + iconSize * 0.62,
                rect.x + rect.w - iconSize * 0.62
            );
            const y = productY;
            const qty = (this.soloRocketMoonShopPurchases && this.soloRocketMoonShopPurchases[item.name]) || 0;
            const isSelected = selectedItem && selectedItem.name === item.name;

            const glow = this.add.graphics();
            glow.fillStyle(isSelected ? 0xfff0a8 : 0x000000, isSelected ? 0.34 : 0.28)
                .fillRoundedRect(x - iconSize / 2 - 9, y - iconSize / 2 - 9, iconSize + 18, iconSize + 18, 18);
            glow.lineStyle(isSelected ? 4 : 2, isSelected ? 0xffd36a : 0xffffff, isSelected ? 1 : 0.42)
                .strokeRoundedRect(x - iconSize / 2 - 9, y - iconSize / 2 - 9, iconSize + 18, iconSize + 18, 18);

            let icon = null;
            if (this.textures.exists(item.key)) {
                icon = this.add.image(x, y, item.key).setDisplaySize(iconSize, iconSize);
            } else {
                icon = this.add.text(x, y, item.fallback, {
                    fontSize: `${Math.round(iconSize * 0.52)}px`,
                    fontFamily: 'Arial, sans-serif'
                }).setOrigin(0.5);
            }

            const qtyText = this.add.text(x + iconSize * 0.38, y + iconSize * 0.32, `×${qty}`, {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#fff8d6',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            objects.push(glow, icon, qtyText);
            this.soloRocketRabbitShopHitAreas.products.push({
                name: item.name,
                x: x,
                y: y,
                w: iconSize + 34,
                h: iconSize + 34
            });
        });

        const panelW = Math.min(rect.w - 28, 396);
        const panelH = selectedItem ? 176 : 104;
        let panelMinY = productY + iconSize * 0.70 + panelH / 2 + 18;
        let panelMaxY = rect.y + rect.h - 118 - panelH / 2;
        if (panelMaxY < panelMinY) panelMaxY = panelMinY;

        const panelX = rect.centerX;
        const panelY = Phaser.Math.Clamp(rect.y + rect.h * 0.56, panelMinY, panelMaxY);
        const panelLeft = panelX - panelW / 2;
        const panelTop = panelY - panelH / 2;

        const infoBg = this.add.graphics();
        infoBg.fillStyle(0x000000, 0.5).fillRoundedRect(panelLeft, panelTop, panelW, panelH, 16);
        infoBg.lineStyle(2, 0xffd36a, selectedItem ? 0.85 : 0.45).strokeRoundedRect(panelLeft, panelTop, panelW, panelH, 16);
        objects.push(infoBg);

        if (selectedItem) {
            const qty = (this.soloRocketMoonShopPurchases && this.soloRocketMoonShopPurchases[selectedItem.name]) || 0;
            const alreadyLimited = !!(selectedItem.limitOne && qty >= 1);
            const canAfford = (this.soloRocketMoonBudgetLeft || 0) >= selectedItem.price;
            const canBuy = canAfford && !alreadyLimited && !this.soloRocketMoonShopFinalizing && !this.soloRocketMoonShopFinalized;
            const buttonLabel = alreadyLimited ? '本趟已購買' : (canAfford ? '購買' : '旅費不足');

            const infoTitle = this.add.text(panelLeft + 18, panelTop + 16, `${selectedItem.name}　${selectedItem.price} 旅費`, {
                fontSize: '18px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#fff8d6',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0, 0);

            const infoQty = this.add.text(panelLeft + 18, panelTop + 45, `本趟購買：${qty}`, {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#b7f7ff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0, 0);

            const infoDesc = this.add.text(panelLeft + 18, panelTop + 70, selectedItem.desc, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                wordWrap: { width: panelW - 36 }
            }).setOrigin(0, 0);

            const buyX = panelX;
            const buyY = panelTop + panelH - 27;
            const buyBg = this.add.rectangle(buyX, buyY, 132, 36, canBuy ? 0xffffff : 0x555555, 1)
                .setStrokeStyle(2, canBuy ? 0xffd36a : 0x999999, 1);

            const buyText = this.add.text(buyX, buyY, buttonLabel, {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: canBuy ? '#000000' : '#dddddd'
            }).setOrigin(0.5);

            this.soloRocketRabbitShopHitAreas.buy = { x: buyX, y: buyY, w: 178, h: 62, itemName: selectedItem.name };
            objects.push(infoTitle, infoQty, infoDesc, buyBg, buyText);
        } else {
            const hint = this.add.text(panelX, panelY,
                '點選上方三個月球伴手禮，商品資訊與購買按鈕會出現在這裡。', {
                fontSize: '15px',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center',
                wordWrap: { width: panelW - 36 }
            }).setOrigin(0.5);
            objects.push(hint);
        }

        const leaveX = rect.centerX;
        const leaveY = rect.y + rect.h - 38;
        const leaveBg = this.add.rectangle(leaveX, leaveY, 230, 42, 0xffffff, 1)
            .setStrokeStyle(3, 0xffd36a, 1);

        const leaveText = this.add.text(leaveX, leaveY, '離開月球，帶錢回家', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5);

        this.soloRocketRabbitShopHitAreas.leave = { x: leaveX, y: leaveY, w: 270, h: 66 };

        objects.push(leaveBg, leaveText);
        shop.add(objects);

        const defaultSpeech = this.soloRocketSelectedMoonShopItemName
            ? '玉兔：看好了就按購買，別亂花旅費喔。'
            : '玉兔：遠道而來的洋蔥，看看月球限定伴手禮吧。';
        if (this.createSoloRocketRabbitSpeechBubble) {
            this.createSoloRocketRabbitSpeechBubble(defaultSpeech);
        }

        if (this.startSoloRocketRabbitShopMeteors) {
            this.startSoloRocketRabbitShopMeteors();
        }

        this.soloRocketRabbitShopInputHandler = this.handleSoloRocketRabbitShopPointer;
        this.input.on('pointerdown', this.soloRocketRabbitShopInputHandler, this);
    }
    getSoloRocketShopItemByName(itemName) {
        if (!itemName) return null;
        return this.getSoloRocketMoonShopItems().find(it => it.name === itemName) || null;
    }

    isSoloRocketPointerInHitArea(pointer, area) {
        if (!pointer || !area) return false;
        return pointer.x >= area.x - area.w / 2 &&
            pointer.x <= area.x + area.w / 2 &&
            pointer.y >= area.y - area.h / 2 &&
            pointer.y <= area.y + area.h / 2;
    }

    handleSoloRocketRabbitShopPointer(pointer) {
        if (!this.soloRocketRabbitShopContainer || !this.soloRocketRabbitShopHitAreas) return;

        const hit = this.soloRocketRabbitShopHitAreas;

        if (
            this.playSoloRocketRabbitShopBgm &&
            (!this.soloRocketRabbitShopBgm || !this.soloRocketRabbitShopBgm.isPlaying)
        ) {
            this.playSoloRocketRabbitShopBgm();
        }

        if (hit.buy && this.isSoloRocketPointerInHitArea(pointer, hit.buy)) {
            this.buySoloRocketMoonItem(hit.buy.itemName);
            return;
        }

        if (hit.leave && this.isSoloRocketPointerInHitArea(pointer, hit.leave)) {
            if (this.typeSoloRocketRabbitSpeech) {
                this.typeSoloRocketRabbitSpeech('玉兔：正在把剩下的旅費匯回你家，請等我一下。', 18);
            } else if (this.soloRocketRabbitShopMessage) {
                this.soloRocketRabbitShopMessage.setText('玉兔：正在把剩下的旅費匯回你家，請等我一下。');
            }
            this.finalizeSoloRocketMoonShop();
            return;
        }

        const product = (hit.products || []).find(area => this.isSoloRocketPointerInHitArea(pointer, area));
        if (product) {
            this.selectSoloRocketMoonItem(product.name);
        }
    }

    selectSoloRocketMoonItem(itemName) {
        if (this.soloRocketMoonShopFinalizing || this.soloRocketMoonShopFinalized) return;
        const item = this.getSoloRocketShopItemByName(itemName);
        if (!item) return;
        this.soloRocketSelectedMoonShopItemName = item.name;
        this.renderSoloRocketRabbitShop();
        if (this.typeSoloRocketRabbitSpeech) {
            this.typeSoloRocketRabbitSpeech('玉兔：這項商品不錯吧？想買就按購買。', 24);
        } else if (this.soloRocketRabbitShopMessage) {
            this.soloRocketRabbitShopMessage.setText('玉兔：這項商品不錯吧？想買就按購買。');
        }
        this.bounceSoloRocketRabbitShopkeeper();
    }

    bounceSoloRocketRabbitShopkeeper() {
        const rabbit = this.soloRocketRabbitShopKeeperObj;
        if (!rabbit || !rabbit.active || !this.tweens) return;

        const baseX = Number.isFinite(Number(rabbit.__soloRocketShopBaseX)) ? Number(rabbit.__soloRocketShopBaseX) : rabbit.x;
        const baseY = Number.isFinite(Number(rabbit.__soloRocketShopBaseY)) ? Number(rabbit.__soloRocketShopBaseY) : rabbit.y;
        const baseScaleX = Number.isFinite(Number(rabbit.__soloRocketShopBaseScaleX)) ? Number(rabbit.__soloRocketShopBaseScaleX) : rabbit.scaleX;
        const baseScaleY = Number.isFinite(Number(rabbit.__soloRocketShopBaseScaleY)) ? Number(rabbit.__soloRocketShopBaseScaleY) : rabbit.scaleY;

        this.tweens.killTweensOf(rabbit);
        rabbit.setPosition(baseX, baseY);
        rabbit.setScale(baseScaleX, baseScaleY);

        this.tweens.add({
            targets: rabbit,
            y: baseY - 12,
            scaleX: baseScaleX * 1.035,
            scaleY: baseScaleY * 1.035,
            duration: 95,
            yoyo: true,
            ease: 'Sine.easeOut',
            onComplete: function() {
                rabbit.setPosition(baseX, baseY);
                rabbit.setScale(baseScaleX, baseScaleY);
            }
        });
    }
    buySoloRocketMoonItem(itemName) {
        if (this.soloRocketMoonShopFinalizing || this.soloRocketMoonShopFinalized) return;

        const item = this.getSoloRocketShopItemByName(itemName);
        if (!item) return;

        this.soloRocketSelectedMoonShopItemName = item.name;
        this.soloRocketMoonShopPurchases = this.soloRocketMoonShopPurchases || {};
        const currentQty = Number(this.soloRocketMoonShopPurchases[item.name] || 0);

        if (item.limitOne && currentQty >= 1) {
            this.renderSoloRocketRabbitShop();
            if (this.typeSoloRocketRabbitSpeech) {
                this.typeSoloRocketRabbitSpeech('玉兔：月光碎片本趟只能帶一片喔。', 24);
            } else if (this.soloRocketRabbitShopMessage) {
                this.soloRocketRabbitShopMessage.setText('玉兔：月光碎片本趟只能帶一片喔。');
            }
            this.bounceSoloRocketRabbitShopkeeper();
            return;
        }

        if ((this.soloRocketMoonBudgetLeft || 0) < item.price) {
            this.renderSoloRocketRabbitShop();
            if (this.typeSoloRocketRabbitSpeech) {
                this.typeSoloRocketRabbitSpeech('玉兔：你的月球旅費不夠喔，先不要裝闊。', 24);
            } else if (this.soloRocketRabbitShopMessage) {
                this.soloRocketRabbitShopMessage.setText('玉兔：你的月球旅費不夠喔，先不要裝闊。');
            }
            this.bounceSoloRocketRabbitShopkeeper();
            return;
        }

        this.soloRocketMoonBudgetLeft = Math.max(0, (this.soloRocketMoonBudgetLeft || 0) - item.price);
        this.soloRocketMoonShopPurchases[item.name] = currentQty + 1;
        if (item.name === '月光碎片') this.soloRocketMoonShardBoughtThisRun = true;

        const lines = {
            '月光碎片': '玉兔：收好，這是月亮掉下來的一小角。',
            '月光法杖': '玉兔：揮一下，全宇宙都知道你來過月球。',
            '月光饅頭': '玉兔：吃了不會變聰明，但掃地會變得比較輕鬆。'
        };

        try {
            if (this.cache.audio.exists('shop-check-buying')) this.sound.play('shop-check-buying');
        } catch (_) {}

        try {
            if (this.cache.audio.exists('solo-rocket-rabbit-shop-buy')) {
                this.sound.play('solo-rocket-rabbit-shop-buy');
            } else {
                console.warn('[玉兔伴手禮店] 找不到 solo-rocket-rabbit-shop-buy.mp3，已略過購買音效。');
            }
        } catch (err) {
            console.warn('[玉兔伴手禮店] 購買音效播放失敗，已略過：', err);
        }

        this.renderSoloRocketRabbitShop();

        if (this.typeSoloRocketRabbitSpeech) {
            this.typeSoloRocketRabbitSpeech(lines[item.name] || '玉兔：謝謝惠顧。', 24);
        } else if (this.soloRocketRabbitShopMessage) {
            this.soloRocketRabbitShopMessage.setText(lines[item.name] || '玉兔：謝謝惠顧。');
        }
        this.bounceSoloRocketRabbitShopkeeper();
    }
  
    finalizeSoloRocketMoonShop() {
        if (this.soloRocketMoonShopFinalized || this.soloRocketMoonShopFinalizing) return;
        if (!window.GameLogic.currentUser) {
            if (this.soloRocketRabbitShopMessage) this.soloRocketRabbitShopMessage.setText('玉兔：找不到玩家資料，請先不要離開月球。');
            return;
        }

        this.soloRocketMoonShopFinalizing = true;

        const purchases = Object.assign({}, this.soloRocketMoonShopPurchases || {});
        const originalBudget = Number(this.soloRocketMoonBudget || 0);
        const leftBudget = Math.max(0, Number(this.soloRocketMoonBudgetLeft || 0));
        const spent = Math.max(0, originalBudget - leftBudget);
        const profile = window.GameLogic.myProfile || {};
        const nextInventory = Object.assign({}, profile.inventory || {});

        Object.keys(purchases).forEach(function(name) {
            const qty = Math.max(0, Number(purchases[name] || 0));
            if (qty > 0) nextInventory[name] = Number(nextInventory[name] || 0) + qty;
        });

        const nextCoins = Number(profile.coins || 0) + leftBudget;

        profile.coins = nextCoins;
        profile.inventory = nextInventory;
        window.GameLogic.myProfile = profile;

        const coinsEl = document.getElementById("vp-coins");
        if (coinsEl) coinsEl.innerText = nextCoins;

        this.soloRocketMoonShopFinalized = true;
        this.soloRocketMoonFinalResult = {
            summary: this.soloRocketRunSummary || this.calculateSoloRocketMoonSummary(),
            originalBudget: originalBudget,
            spent: spent,
            deposit: leftBudget,
            purchases: purchases
        };

        try {
            update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), {
                coins: nextCoins,
                inventory: nextInventory
            }).catch(function(err) {
                console.warn('[玉兔伴手禮店] 最終結算寫入失敗，但已先返回大廳：', err);
            });
        } catch (err) {
            console.warn('[玉兔伴手禮店] 最終結算送出失敗，但已先返回大廳：', err);
        }

        try {
            if (this.cache.audio.exists('solo-rocket-rabbit-shop-finish')) this.sound.play('solo-rocket-rabbit-shop-finish');
        } catch (_) {}

        const closeShopAndReturn = function() {
            if (this.stopSoloRocketRabbitShopBgm) this.stopSoloRocketRabbitShopBgm();
            if (this.destroySoloRocketResultOverlay) this.destroySoloRocketResultOverlay();
            if (this.clearSoloRocketRabbitShopUi) this.clearSoloRocketRabbitShopUi();

            if (this.clearSoloRocketCruise) {
                this.clearSoloRocketCruise(false);
            } else if (this.returnFromSoloRocketCruise) {
                this.returnFromSoloRocketCruise();
            }
        };

        closeShopAndReturn.call(this);

        if (this.time && this.time.delayedCall) {
            this.time.delayedCall(80, function() {
                if (this.soloRocketRabbitShopContainer || this.soloRocketContainer || this.soloRocketResultContainer) {
                    closeShopAndReturn.call(this);
                }
            }, [], this);
        }
    }
    showSoloRocketMoonFinalResult() {
        const rect = this.soloRocketSafeRect || this.getSoloRocketSafeRect();
        this.destroySoloRocketResultOverlay();

        const data = this.soloRocketMoonFinalResult || {
            summary: this.soloRocketRunSummary || this.calculateSoloRocketMoonSummary(),
            originalBudget: this.soloRocketMoonBudget || 0,
            spent: Math.max(0, (this.soloRocketMoonBudget || 0) - (this.soloRocketMoonBudgetLeft || 0)),
            deposit: this.soloRocketMoonBudgetLeft || 0,
            purchases: this.soloRocketMoonShopPurchases || {}
        };

        const result = this.add.container(0, 0).setDepth(9840).setScrollFactor(0);
        this.soloRocketResultContainer = result;

        const panelW = Math.min(rect.w - 34, 410);
        const maxPanelH = Math.max(360, rect.h - 36);
        const panelH = Math.min(520, maxPanelH);
        const px = rect.centerX - panelW / 2;
        const py = rect.y + Math.max(18, (rect.h - panelH) / 2);
        const btnY = py + panelH - 46;
        const returnBtnHit = { x: rect.centerX, y: btnY, w: 260, h: 86 };

        let didReturn = false;
        const goHome = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (didReturn) return;
            didReturn = true;
            this.returnFromSoloRocketCruise();
        };

        const clickCatcher = this.add.zone(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height
        )
            .setDepth(9835)
            .setScrollFactor(0)
            .setInteractive();

        this.soloRocketResultClickCatcher = clickCatcher;

        const handleResultClick = (pointer, localX, localY, event) => {
            if (event && event.stopPropagation) event.stopPropagation();
            if (!pointer) return;
            const inReturnBtn =
                pointer.x >= returnBtnHit.x - returnBtnHit.w / 2 &&
                pointer.x <= returnBtnHit.x + returnBtnHit.w / 2 &&
                pointer.y >= returnBtnHit.y - returnBtnHit.h / 2 &&
                pointer.y <= returnBtnHit.y + returnBtnHit.h / 2;
            if (inReturnBtn) goHome(pointer, localX, localY, event);
        };

        clickCatcher.on('pointerdown', handleResultClick);
        clickCatcher.on('pointerup', handleResultClick);

        const bg = this.add.graphics();
        bg.fillStyle(0x050008, 0.97).fillRoundedRect(px, py, panelW, panelH, 18);
        bg.lineStyle(4, 0xffd36a, 1).strokeRoundedRect(px, py, panelW, panelH, 18);
        bg.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(px + 8, py + 8, panelW - 16, panelH - 16, 14);

        const title = this.add.text(rect.centerX, py + 42, '月球返航結算', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#fff8d6',
            stroke: '#8a2be2',
            strokeThickness: 5
        }).setOrigin(0.5);

        const purchaseLines = Object.keys(data.purchases || {})
            .filter(name => Number(data.purchases[name] || 0) > 0)
            .map(name => `${name} × ${Number(data.purchases[name] || 0)}`);

        const bodyLines = [
            `本趟分數：${data.summary.score}`,
            `原始月球旅費：${data.originalBudget}`,
            `玉兔伴手禮花費：${data.spent}`,
            `匯入馬德幣：${data.deposit}`,
            '',
            '購買商品：',
            purchaseLines.length ? purchaseLines.join('\n') : '本趟沒有購買伴手禮，月球旅費全數匯入。'
        ];

        const body = this.add.text(rect.centerX, py + 84, bodyLines.join('\n'), {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#eaffff',
            stroke: '#000000',
            strokeThickness: 4,
            lineSpacing: 6,
            align: 'left',
            wordWrap: { width: panelW - 42 }
        }).setOrigin(0.5, 0);

        const btnBg = this.add.rectangle(rect.centerX, btnY, 190, 52, 0xffffff, 1)
            .setStrokeStyle(3, 0xffd36a, 1)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(rect.centerX, btnY, '返回洋蔥大廳', {
            fontSize: '18px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const returnHit = this.add.zone(rect.centerX, btnY, 280, 96)
            .setInteractive({ useHandCursor: true });

        [btnBg, btnText, returnHit].forEach(obj => {
            obj.on('pointerdown', goHome);
            obj.on('pointerup', goHome);
        });

        result.add([bg, title, body, btnBg, btnText, returnHit]);
    }
  
    returnFromSoloRocketCruise() {
        if (this.destroySoloRocketResultOverlay) this.destroySoloRocketResultOverlay();
        if (this.clearSoloRocketRabbitShopUi) this.clearSoloRocketRabbitShopUi();
        this.clearSoloRocketCruise(false);
        console.log('[火箭巡航] 已返回洋蔥大廳。');
    }

    clearSoloRocketCruise(skipMusicResume = false) {
        try {
            if (this.soloRocketTimer) this.soloRocketTimer.remove(false);
        } catch (_) {}
        this.soloRocketTimer = null;

        this.stopSoloRocketBgm();
        if (this.stopSoloRocketRabbitShopBgm) this.stopSoloRocketRabbitShopBgm();
        if (this.clearSoloRocketRabbitShopUi) this.clearSoloRocketRabbitShopUi();

        this.clearSoloRocketTutorial();
        this.clearSoloRocketIntroFx();
        this.clearSoloRocketStage4Objects(true);
        if (this.clearSoloRocketStage6Objects) this.clearSoloRocketStage6Objects(true);

        const safeDestroySoloRocketObject = (obj, destroyChildren = false) => {
            try {
                if (!obj) return;
                if (this.tweens) this.tweens.killTweensOf(obj);
                if (obj.destroy) obj.destroy(destroyChildren);
            } catch (err) {
                console.warn('[火箭巡航] 單一物件清理失敗，已略過：', err);
            }
        };

        try {
            if (this.soloRocketLifeBreathTween) this.soloRocketLifeBreathTween.remove();
        } catch (_) {}

        try {
            if (this.soloRocketLifePulseTween) this.soloRocketLifePulseTween.remove();
        } catch (_) {}

        try {
            if (this.soloRocketLifeFloatTween) this.soloRocketLifeFloatTween.remove();
        } catch (_) {}
        try {
            (this.soloRocketLifeHealFxObjects || []).forEach(function(obj) {
                try {
                    if (obj && obj.destroy) obj.destroy();
                } catch (_) {}
            });
        } catch (_) {}
        this.soloRocketLifeHealFxObjects = [];

        safeDestroySoloRocketObject(this.soloRocketThrusterFx);
        safeDestroySoloRocketObject(this.soloRocketWhiteFade);
        safeDestroySoloRocketObject(this.soloRocketResultClickCatcher);
        safeDestroySoloRocketObject(this.soloRocketResultContainer, true);
        safeDestroySoloRocketObject(this.soloRocketRabbitShopContainer, true);
        safeDestroySoloRocketObject(this.soloRocketUiContainer, true);
        safeDestroySoloRocketObject(this.soloRocketContainer, true);

        this.soloRocketContainer = null;
        this.soloRocketUiContainer = null;
        this.soloRocketResultContainer = null;
        this.soloRocketResultClickCatcher = null;
        this.soloRocketRabbitShopContainer = null;
        this.soloRocketRabbitShopBudgetText = null;
        this.soloRocketRabbitShopMessage = null;
        this.soloRocketRabbitShopKeeperObj = null;
        this.soloRocketRabbitShopHitAreas = null;
        this.soloRocketRabbitShopInputHandler = null;
        this.soloRocketSelectedMoonShopItemName = null;
        this.soloRocketPlayer = null;
        this.soloRocketBg = null;
        this.soloRocketStars = [];
        this.soloRocketCountdownText = null;
        this.soloRocketLifeText = null;
        this.soloRocketLifeUi = null;
        this.soloRocketLifeBreathTween = null;
        this.soloRocketLifePulseTween = null;
        this.soloRocketLifeFloatTween = null;
        this.soloRocketLifeHealFxObjects = [];
        this.soloRocketThrusterFx = null;
        this.soloRocketWhiteFade = null;
        this.soloRocketSafeRect = null;
        this.soloRocketWasd = null;
        this.soloRocketRunSummary = null;
        this.soloRocketMoonBudget = 0;
        this.soloRocketMoonBudgetLeft = 0;
        this.soloRocketMoonShopPurchases = {};
        this.soloRocketMoonShardBoughtThisRun = false;
        this.soloRocketMoonShopFinalized = false;
        this.soloRocketMoonShopFinalizing = false;
        this.soloRocketMoonFinalResult = null;
        this.soloRocketFireButtonState = null;
        this.soloRocketSpinButtonState = null;
        this.soloRocketSpinCooldownFill = null;
        this.soloRocketSpinCooldownText = null;
        this.soloRocketSpinCooldownMaskShape = null;
        this.soloRocketSpinCooldownMaxHeight = 0;
        this.soloRocketSpinCooldownBaseY = 0;
        this.soloRocketSpinActive = false;
        this.__soloRocketSpinInvincibleUntil = 0;
        this.soloRocketAsteroids = [];
        this.soloRocketAsteroidSpawnActive = false;
        this.soloRocketAsteroidSpawnStopped = true;
        this.soloRocketAsteroidNextSpawnAt = 0;
        this.soloRocketAsteroidExtraBudget = 0;
        this.soloRocketAsteroidExtraNextAt = 0;
        this.soloRocketStartTime = 0;
        this.soloRocketGameplayStarted = false;
        this.soloRocketTutorialActive = false;
        this.soloRocketIntroActive = false;
        this.soloRocketEndingActive = false;
        this.soloRocketInputLocked = false;
        this.soloRocketEndingRushStarted = false;
        this.soloRocketEndingFadeStarted = false;
        this.soloRocketFinalEscapeStarted = false;
        this.soloRocketBossEntering = false;
        this.soloRocketBossSpawned = false;
        this.soloRocketBossKilled = false;
        this.soloRocketBossPunished = false;
        this.soloRocketBossWarning1Shown = false;
        this.soloRocketBossWarning1Closed = false;
        this.soloRocketBossWarning2Shown = false;
        this.soloRocketBossWarning2Closed = false;
        this.soloRocketCruiseActive = false;
        this.soloRocketCruiseFinished = false;
        window.GameLogic.soloRocketCruiseActive = false;

        const sprite = this.localPlayer && this.localPlayer.sprite
            ? this.localPlayer.sprite
            : null;
        if (sprite && sprite.active) {
            if (sprite.body) sprite.body.enable = true;
            sprite.setVisible(true);
            sprite.setVelocity(0, 0);
            if (this.soloRocketReturnPosition) {
                sprite.setPosition(this.soloRocketReturnPosition.x, this.soloRocketReturnPosition.y);
            }
            if (this.anims.exists('idle')) sprite.play('idle', true);
            this.cameras.main.startFollow(sprite, true, 0.08, 0.08);
        }

        if (this.localPlayer && this.localPlayer.nameContainer) this.localPlayer.nameContainer.setVisible(true);
        if (this.localPlayer && this.localPlayer.bubbleContainer) this.localPlayer.bubbleContainer.setVisible(false);
        if (this.localPlayer && this.localPlayer.partyScoreContainer) this.localPlayer.partyScoreContainer.setVisible(false);
        this.soloRocketReturnPosition = null;

        this.restoreSoloRocketLobbyUi();
        if (!skipMusicResume) this.resumeLobbyBgmAfterSoloRocket();
    }
  
    getCurrentPlayerPathForAction() {
        if (!window.GameLogic.currentUser) return null;
        const uid = window.GameLogic.currentUser.uid;
        if (this.isCafe) return window.getServerRoomPath(`cafePlayers/${uid}`);
        if (this.sceneName === 'shrine') return window.getServerRoomPath(`shrinePlayers/${uid}`);
        if (this.sceneName === 'playroom' && window.GameLogic.currentRoomId) return window.getServerRoomPath(`playroomPlayers/${window.GameLogic.currentRoomId}/${uid}`);
        if (this.sceneName === 'partyroom' && window.PartyLogic && window.PartyLogic.roomId) return window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${uid}`);
        return null;
    }

    clearShowOffFx(entity) {
    if (!entity) return;
    if (entity.showOffFloatTween) { entity.showOffFloatTween.stop(); entity.showOffFloatTween = null; }
    if (entity.showOffRainbowTween) { entity.showOffRainbowTween.stop(); entity.showOffRainbowTween = null; }
    if (entity.showOffContainer) { entity.showOffContainer.destroy(true); entity.showOffContainer = null; }
    if (entity.showOffEmitter) { entity.showOffEmitter.destroy(); entity.showOffEmitter = null; }
    if (entity === this.localPlayer) {
        this.showOffContainer = null;
        this.showOffEmitter = null;
    }
}

    renderShowOffFx(entity, medalIcon, titleText = '', recordText = '', dateText = '') {
if (!entity || !entity.sprite) return;
this.clearShowOffFx(entity);

entity.showOffContainer = this.add.container(entity.sprite.x + 80, entity.sprite.y - 40).setDepth(200);

let rainbowRing = this.add.graphics();
const rainbowColors = [0xff0033, 0xff9900, 0xffff00, 0x33ff00, 0x00ccff, 0x3366ff, 0xcc33ff];
rainbowColors.forEach((c, i) => {
    rainbowRing.lineStyle(5, c, 0.45);
    rainbowRing.strokeCircle(0, 0, 62 + i * 3);
});
rainbowRing.setBlendMode('ADD');

let medal = this.add.image(0, 0, medalIcon).setDisplaySize(120, 120);
let titleLabel = this.add.text(0, 72, titleText || '', {
        fontSize: '13px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: 180, useAdvancedWrap: true }
    }).setOrigin(0.5);

    let showItems = [rainbowRing, medal, titleLabel];

if (dateText) {
    let dateLabel = this.add.text(0, 94, `派發日期：${dateText}`, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: 180, useAdvancedWrap: true }
    }).setOrigin(0.5);
    showItems.push(dateLabel);
}

if (recordText) {
    let recordLabel = this.add.text(0, dateText ? 118 : 102, recordText, {
            fontSize: '12px',
            color: '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: 180, useAdvancedWrap: true }
        }).setOrigin(0.5);
        showItems.push(recordLabel);
    }

    entity.showOffContainer.add(showItems);

    entity.showOffFloatTween = this.tweens.add({
    targets: entity.showOffContainer,
    y: entity.showOffContainer.y - 15,
    yoyo: true,
    repeat: -1,
    duration: 1000,
    ease: 'Sine.easeInOut'
});

entity.showOffRainbowTween = this.tweens.add({
    targets: rainbowRing,
    rotation: Math.PI * 2,
    alpha: { from: 0.65, to: 1 },
    scale: { from: 0.92, to: 1.08 },
    yoyo: true,
    repeat: -1,
    duration: 1200,
    ease: 'Sine.easeInOut'
});

    entity.showOffEmitter = this.add.particles(0, 0, 'fw-particle', {
        x: { min: -80, max: 80 },
        y: { min: -80, max: 80 },
        speed: { min: 15, max: 45 },
        scale: { start: 1.3, end: 0 },
        tint: [0xff0033, 0xff9900, 0xffff00, 0x33ff00, 0x00ccff, 0x3366ff, 0xcc33ff],
        blendMode: 'ADD',
        lifespan: 900,
        frequency: 80
    }).setDepth(199);

    entity.showOffEmitter.startFollow(entity.showOffContainer);
}

    startShowOff(medalIcon, dateStr, medalTitle = '', recordText = '') {
    if (!this.localPlayer || !this.localPlayer.sprite) return;

    const actionTime = Date.now();
    const titleText = medalTitle || dateStr || '';

    this.localPlayer.isShowingOff = true;
    this.localPlayer.sprite.setVelocity(0, 0);
    this.localPlayer.sprite.play('show-off', true);
    window.playSFX(this, 'onion-show-off-reward');

    this.renderShowOffFx(this.localPlayer, medalIcon, titleText, recordText, dateStr || '');
    this.showOffContainer = this.localPlayer.showOffContainer;
    this.showOffEmitter = this.localPlayer.showOffEmitter;

    const playerPath = this.getCurrentPlayerPathForAction();
    if (playerPath) {
        update(ref(window.GameLogic.db, playerPath), {
            action: 'showOff',
            actionTime: actionTime,
            medalIcon: medalIcon,
            medalDate: dateStr || '',
            medalTitle: titleText,
            medalRecord: recordText || ''
        });
    }
}
    playGlobalFireworks() {
        window.playSFX(this, 'fireworks-in-the-sky'); let cam = this.cameras.main; let colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8800];
        for (let i = 0; i < 7; i++) { this.time.delayedCall(i * 500, () => { let x = cam.scrollX + Phaser.Math.Between(100, cam.width - 100); let y = cam.scrollY + Phaser.Math.Between(100, cam.height - 100); let mixColors = [Phaser.Utils.Array.GetRandom(colors), Phaser.Utils.Array.GetRandom(colors), Phaser.Utils.Array.GetRandom(colors)]; let emitter = this.add.particles(x, y, 'fw-particle', { speed: { min: 200, max: 450 }, angle: { min: 0, max: 360 }, scale: { start: 2, end: 0 }, blendMode: 'ADD', tint: mixColors, lifespan: { min: 1500, max: 3000 }, gravityY: 150, quantity: 100 }); emitter.setDepth(200); emitter.explode(); let flash = this.add.circle(x, y, 150, mixColors[0], 0.5).setDepth(199).setBlendMode('ADD'); this.tweens.add({ targets: flash, alpha: 0, scale: 2.5, duration: 600, onComplete: () => flash.destroy() }); this.time.delayedCall(3000, () => emitter.destroy()); }); }
    }
    spawnTrash() {
        if (!this.isCafe) return; let playerCount = Object.keys(window.GameLogic.cafePlayers || {}).length || 1; let limits = [10, 12, 15, 17, 20]; let maxTrash = limits[Math.min(playerCount - 1, 4)]; let spawnChance = 0.3 + (playerCount * 0.1); let currentTrashCount = this.trashes.length;
        if (Math.random() < spawnChance && currentTrashCount < maxTrash) { 
    let tx = Phaser.Math.Between(150, 1898); 
    let ty = Phaser.Math.Between(150, 1898); 
    let isOld = Math.random() < 0.05; 
        push(ref(window.GameLogic.db, window.getServerRoomPath('cafeTrashes')), {
        x: tx, 
        y: ty, 
        type: isOld ? 'old' : 'normal' 
    }); 
}
    }
    updateQTEBar(progress) { this.qteBar.clear(); let width = Math.min(100, (progress / 100) * 100); this.qteBar.fillStyle(0xd9534f, 1); this.qteBar.fillRoundedRect(-50, -8, width, 16, 8); }

    startMimiWalkSFX() {
        if (this.sceneName === 'cafe' && (!this.mimiSprite || !this.mimiSprite.active)) {
            this.stopMimiWalkSFX(false);
            return;
        }

        if (!this.sound || !this.cache || !this.cache.audio.exists('mimi-walk')) {
            console.warn('找不到 mimi-walk 音效，已跳過播放。');
            return;
        }

        if (window.GameLogic.muteSFX) {
            this.stopMimiWalkSFX(false);
            return;
        }

        const vol = (window.GameLogic.sfxVolume !== undefined ? window.GameLogic.sfxVolume : 100) / 100;

        if (vol <= 0) {
            this.stopMimiWalkSFX(false);
            return;
        }

        const allMimiWalkSounds = this.sound.getAll('mimi-walk') || [];

        if (!this.mimiWalkSFX) {
            this.mimiWalkSFX = allMimiWalkSounds.find(snd => snd && !snd.isPlaying) || allMimiWalkSounds[0] || null;
        }

        if (!this.mimiWalkSFX) {
            this.mimiWalkSFX = this.sound.add('mimi-walk', { loop: true, volume: vol });
        }

        allMimiWalkSounds.forEach(snd => {
            if (snd && snd !== this.mimiWalkSFX) {
                snd.stop();
                if (snd.destroy) snd.destroy();
            }
        });

        this.mimiWalkSFX.setLoop(true);
        this.mimiWalkSFX.setVolume(vol);

        if (!this.mimiWalkSFX.isPlaying) {
            this.mimiWalkSFX.play();
        }
    }

    stopMimiWalkSFX(destroyInstance = false) {
        if (this.mimiWalkSFX) {
            this.mimiWalkSFX.stop();
            if (destroyInstance && this.mimiWalkSFX.destroy) {
                this.mimiWalkSFX.destroy();
            }
            if (destroyInstance) this.mimiWalkSFX = null;
        }

        if (this.sound) {
            const allMimiWalkSounds = this.sound.getAll('mimi-walk') || [];
            allMimiWalkSounds.forEach(snd => {
                if (snd && snd !== this.mimiWalkSFX) {
                    snd.stop();
                    if (destroyInstance && snd.destroy) snd.destroy();
                }
            });
        }
    }

    initPrinceCatSync() {
        if (!this.isCafe || this.princeCatListener) return;

        this.princeCatSprite = this.physics.add.sprite(1024, 1024, 'prince-cat-stand-sheet').setDepth(9).setScale(1.35);
        this.princeCatSprite.setCollideWorldBounds(true);
        if (this.princeCatSprite.body) this.princeCatSprite.body.setAllowGravity(false);

        this.princeCatNameBg = this.add.graphics().setDepth(12);
        this.princeCatNameText = this.add.text(0, 0, '王子麵', { fontSize: '14px', color: '#ffcc00', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(13);

        if (this.minimap) this.minimap.ignore([this.princeCatNameBg, this.princeCatNameText]);

        window.selectPrinceCatInteraction = (type) => {
        if (type === 'pet') this.startPrinceCatPetting();
        if (type === 'feed') this.startPrinceCatFeeding();
     };

        this.princeCatListener = onValue(ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat')), (snap) => {
            const data = snap.val();

            if (!data) {
                window.GameLogic.princeCatData = null;

                if (this.isPrinceCatHost()) {
                    set(ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat')), {
                        x: 1024,
                        y: 1024,
                        targetX: 1200,
                        targetY: 1024,
                        state: 'idle',
                        direction: 'right',
                        stateStartTime: Date.now(),
                        stateUntil: Date.now() + 3000,
                        interactingUid: null,
                        lockedUntil: 0
                    });
                }
                return;
            }

            window.GameLogic.princeCatData = data;
        });
    }

    isPrinceCatHost() {
        if (!this.isCafe || !window.GameLogic.currentUser) return false;
        const players = window.GameLogic.cafePlayers || {};
        const online = window.GameLogic.onlinePlayers || {};
        const validUids = Object.keys(players).filter(uid => online[uid]).sort();
        return validUids.length > 0 && validUids[0] === window.GameLogic.currentUser.uid;
    }

    choosePrinceCatNextState(now, forceState = null) {
        const data = window.GameLogic.princeCatData || {};
        const rawX = Number(data.x);
        const rawY = Number(data.y);
        const x = Phaser.Math.Clamp(Number.isFinite(rawX) ? rawX : (this.princeCatSprite.x || 1024), 160, 1888);
        const y = Phaser.Math.Clamp(Number.isFinite(rawY) ? rawY : (this.princeCatSprite.y || 1024), 160, 1888);
        const direction = data.direction || 'right';

        const makeIdle = (minMs = 3000, maxMs = 7000) => ({
            x, y,
            targetX: x,
            targetY: y,
            state: 'idle',
            direction,
            stateStartTime: now,
            stateUntil: now + Phaser.Math.Between(minMs, maxMs),
            interactingUid: null,
            lockedUntil: 0
        });

        if (forceState === 'idle') return makeIdle(2000, 5000);

        const roll = Math.random();

        if (roll < 0.50) {
            let targetX = x;
            let targetY = y;
            let walkDist = 0;

            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Phaser.Math.Between(220, 520);
                const candidateX = Phaser.Math.Clamp(x + Math.cos(angle) * dist, 180, 1868);
                const candidateY = Phaser.Math.Clamp(y + Math.sin(angle) * dist, 180, 1868);
                const candidateDist = Phaser.Math.Distance.Between(x, y, candidateX, candidateY);

                if (candidateDist >= 180) {
                    targetX = candidateX;
                    targetY = candidateY;
                    walkDist = candidateDist;
                    break;
                }
            }

            if (walkDist < 180) {
                const centerAngle = Phaser.Math.Angle.Between(x, y, 1024, 1024);
                targetX = Phaser.Math.Clamp(x + Math.cos(centerAngle) * 260, 180, 1868);
                targetY = Phaser.Math.Clamp(y + Math.sin(centerAngle) * 260, 180, 1868);
                walkDist = Phaser.Math.Distance.Between(x, y, targetX, targetY);
            }

            const walkSpeed = 24;
            const walkDuration = Phaser.Math.Clamp(Math.ceil((walkDist / walkSpeed) * 1000) + Phaser.Math.Between(1500, 3500), 9000, 26000);

            return {
                x, y,
                targetX,
                targetY,
                state: 'walk',
                direction: targetX < x ? 'left' : 'right',
                stateStartTime: now,
                stateUntil: now + walkDuration,
                interactingUid: null,
                lockedUntil: 0
            };
        }

        if (roll < 0.80) return makeIdle(3000, 7000);

        if (roll < 0.92) {
            return {
                x, y,
                targetX: x,
                targetY: y,
                state: 'lick',
                direction,
                stateStartTime: now,
                stateUntil: now + Phaser.Math.Between(5000, 10000),
                interactingUid: null,
                lockedUntil: 0
            };
        }

        return {
            x, y,
            targetX: x,
            targetY: y,
            state: 'sleep',
            direction,
            stateStartTime: now,
            stateUntil: now + Phaser.Math.Between(10000, 60000),
            interactingUid: null,
            lockedUntil: 0
        };
    }

    updatePrinceCatAutonomy(time, delta) {
        if (!this.isCafe || !this.princeCatSprite || !this.isPrinceCatHost()) return;

        const now = Date.now();
        let data = window.GameLogic.princeCatData;

        if (!data) return;
        if (data.interactingUid && data.lockedUntil && now < data.lockedUntil) return;
        if (data.state === 'petting' && data.lockedUntil && now < data.lockedUntil) return;

        let nextData = Object.assign({}, data);

        const currentX = Number.isFinite(Number(nextData.x)) ? Number(nextData.x) : 1024;
        const currentY = Number.isFinite(Number(nextData.y)) ? Number(nextData.y) : 1024;
        const targetX = Number.isFinite(Number(nextData.targetX)) ? Number(nextData.targetX) : currentX;
        const targetY = Number.isFinite(Number(nextData.targetY)) ? Number(nextData.targetY) : currentY;
        const isWalking = nextData.state === 'walk';
        const reachedTarget = isWalking && Phaser.Math.Distance.Between(currentX, currentY, targetX, targetY) < 12;
        const stateExpired = !nextData.stateUntil || now > nextData.stateUntil;

        if (isWalking && reachedTarget) {
            nextData = Object.assign({}, nextData, {
                x: targetX,
                y: targetY,
                targetX,
                targetY,
                state: 'idle',
                stateStartTime: now,
                stateUntil: now + Phaser.Math.Between(2000, 5000),
                interactingUid: null,
                lockedUntil: 0
            });
        } else if (stateExpired) {
            nextData = this.choosePrinceCatNextState(now);
        }

        if (nextData.state === 'walk') {
            const speed = 24;
            const dx = (nextData.targetX || nextData.x) - nextData.x;
            const dy = (nextData.targetY || nextData.y) - nextData.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            nextData.x = Phaser.Math.Clamp(nextData.x + (dx / dist) * speed * (delta / 1000), 150, 1898);
            nextData.y = Phaser.Math.Clamp(nextData.y + (dy / dist) * speed * (delta / 1000), 150, 1898);
            nextData.direction = dx < 0 ? 'left' : 'right';
        }

        window.GameLogic.princeCatData = nextData;

        if (!this.princeCatLastSync || time - this.princeCatLastSync > 500) {
            this.princeCatLastSync = time;
            update(ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat')), nextData).catch(err => console.warn('Firebase 同步王子麵狀態失敗:', err));
        }
    }

    updatePrinceCatVisual() {
        if (!this.isCafe || !this.princeCatSprite) return;

        const data = window.GameLogic.princeCatData;
        if (!data) return;

        const dataX = Number.isFinite(Number(data.x)) ? Number(data.x) : this.princeCatSprite.x;
        const dataY = Number.isFinite(Number(data.y)) ? Number(data.y) : this.princeCatSprite.y;

        if (Math.abs(this.princeCatSprite.x - dataX) > 120 || Math.abs(this.princeCatSprite.y - dataY) > 120) {
            this.princeCatSprite.setPosition(dataX, dataY);
        } else {
            this.princeCatSprite.x = Phaser.Math.Linear(this.princeCatSprite.x, dataX, 0.25);
            this.princeCatSprite.y = Phaser.Math.Linear(this.princeCatSprite.y, dataY, 0.25);
        }

        let animKey = 'prince-cat-stand';
        if (data.state === 'walk') animKey = data.direction === 'left' ? 'prince-cat-walk-left' : 'prince-cat-walk-right';
        else if (data.state === 'lick') animKey = 'prince-cat-lick';
        else if (data.state === 'sleep') animKey = 'prince-cat-sleep';
        else if (data.state === 'petting') animKey = 'prince-cat-touched';
        else if (data.state === 'feeding') animKey = 'prince-cat-eating';
        else if (data.state === 'yummy') animKey = 'prince-cat-yummy';

        if (!this.anims.exists(animKey)) {
            console.warn(`王子麵動畫不存在：${animKey}，fallback 到 prince-cat-stand`);
            animKey = 'prince-cat-stand';
        }

        const princeCurrentAnim = this.princeCatSprite && this.princeCatSprite.anims
            ? this.princeCatSprite.anims.currentAnim
            : null;

        if (this.anims.exists(animKey) && (!princeCurrentAnim || princeCurrentAnim.key !== animKey || !this.princeCatSprite.anims.isPlaying)) {
            this.princeCatSprite.play(animKey, true);
        }

        const nameY = this.princeCatSprite.y - 72;
        this.princeCatNameText.setPosition(this.princeCatSprite.x, nameY);
        this.princeCatNameBg.clear().fillStyle(0x000000, 0.6).fillRoundedRect(this.princeCatSprite.x - 34, nameY - 12, 68, 24, 6);

        const currentPrinceCatState = data.state || 'idle';
        const currentPrinceCatStateStartTime = data.stateStartTime || 0;
        const walkStopMeowKey = `${currentPrinceCatState}_${currentPrinceCatStateStartTime}`;

        if (
            this.lastPrinceCatState === 'walk' &&
            currentPrinceCatState !== 'walk' &&
            this.lastPrinceCatWalkStopMeowKey !== walkStopMeowKey
        ) {
            this.lastPrinceCatWalkStopMeowKey = walkStopMeowKey;
            this.playPrinceCatSFX('prince-cat-normal-meow');
        }

            this.lastPrinceCatState = currentPrinceCatState;
            this.lastPrinceCatStateStartTime = currentPrinceCatStateStartTime;

        if (data.state === 'petting') {
            const pettingEffectKey = `${data.interactingUid || 'unknown'}_${data.stateStartTime || 0}`;
            this.playPrinceCatPettingSFXOnce(pettingEffectKey);
        }

        if (data.state === 'feeding') {
            const feedingEffectKey = `${data.interactingUid || 'unknown'}_${data.stateStartTime || 0}`;
            this.playPrinceCatFeedingSFXOnce(feedingEffectKey);
        }

        if (data.state === 'yummy') {
            const yummyEffectKey = `${data.interactingUid || 'unknown'}_${data.stateStartTime || 0}`;
            this.playPrinceCatYummySFXOnce(yummyEffectKey);
        }
    }

    playPrinceCatSFX(key) {
        if (!this.cache || !this.cache.audio.exists(key)) {
            console.warn(`找不到王子麵音效：${key}，已跳過播放。`);
            return;
        }

        try {
            window.playSFX(this, key);
        } catch (err) {
            console.warn(`播放王子麵音效失敗：${key}`, err);
        }
    }

    playPrinceCatPettingSFXOnce(pettingEffectKey) {
        if (!pettingEffectKey) return;
        if (this.lastPrinceCatPettingEffectKey === pettingEffectKey) return;

        this.lastPrinceCatPettingEffectKey = pettingEffectKey;
        this.showPrinceCatLoveEffect();

        [
            'prince-cat-normal-meow',
            'prince-cat-got-touched',
            'prince-cat-feel-good'
        ].forEach(key => this.playPrinceCatSFX(key));
    }

    showPrinceCatLoveEffect() {
        if (!this.princeCatSprite) return;

        const loveTextureKey = 'prince-cat-love';
        let useLoveTexture = false;

        if (this.textures && this.textures.exists(loveTextureKey)) {
            const loveTexture = this.textures.get(loveTextureKey);
            const sourceImage = loveTexture && loveTexture.getSourceImage ? loveTexture.getSourceImage() : null;
            const sourceWidth = sourceImage && sourceImage.width ? sourceImage.width : 0;
            const sourceHeight = sourceImage && sourceImage.height ? sourceImage.height : 0;
            const looksLikeSpriteSheet = sourceWidth >= 300 && sourceWidth > sourceHeight * 2;

            useLoveTexture = sourceWidth > 0 && sourceHeight > 0 && !looksLikeSpriteSheet;

            if (!useLoveTexture) {
                console.warn('prince-cat-love 疑似不是單張愛心圖，改用 💗 fallback。', { sourceWidth, sourceHeight });
            }
        } else {
            console.warn('找不到 prince-cat-love / pet-cat-wzm-love.png，改用 💗 fallback。');
        }

        for (let i = 0; i < 4; i++) {
            const heartX = this.princeCatSprite.x + Phaser.Math.Between(-35, 35);
            const heartY = this.princeCatSprite.y - 55 + Phaser.Math.Between(-12, 12);
            const heart = useLoveTexture
                ? this.add.image(heartX, heartY, loveTextureKey).setScale(0.55).setOrigin(0.5)
                : this.add.text(heartX, heartY, '💗', {
                    fontSize: '26px',
                    fontFamily: 'Arial, sans-serif',
                    stroke: '#ffffff',
                    strokeThickness: 3
                }).setOrigin(0.5);

            heart.setDepth(80);

            this.tweens.add({
                targets: heart,
                y: heart.y - Phaser.Math.Between(45, 85),
                x: heart.x + Phaser.Math.Between(-24, 24),
                alpha: 0,
                scale: useLoveTexture ? 0.95 : 1.35,
                duration: 1200,
                ease: 'Cubic.easeOut',
                onComplete: () => heart.destroy()
            });
        }
    }
    async openPrinceCatMenu() {
        if (!this.isCafe || !this.princeCatSprite || !window.GameLogic.currentUser) return;

        const uid = window.GameLogic.currentUser.uid;
        const now = Date.now();
        const catRef = ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat'));
        const snap = await get(catRef);
        const data = snap.val() || {};

        if (data.interactingUid && data.interactingUid !== uid && data.lockedUntil && now < data.lockedUntil) {
            sendPrinceCatBubble("王子麵正在理別人");
            return;
        }

        await update(catRef, {
            x: data.x || this.princeCatSprite.x,
            y: data.y || this.princeCatSprite.y,
            state: 'idle',
            interactingUid: uid,
            stateStartTime: now,
            stateUntil: now + 60000,
            lockedUntil: now + 60000
        });

        const menu = document.getElementById('prince-cat-menu');
        if (menu) menu.style.display = 'flex';

        if (window.GameLogic.princeCatMenuTimeout) clearTimeout(window.GameLogic.princeCatMenuTimeout);
        window.GameLogic.princeCatMenuTimeout = setTimeout(() => {
            this.closePrinceCatMenu(true);
        }, 60000);
    }

    async closePrinceCatMenu(restoreCat = true) {
        const menu = document.getElementById('prince-cat-menu');
        if (menu) menu.style.display = 'none';

        if (window.GameLogic.princeCatMenuTimeout) {
            clearTimeout(window.GameLogic.princeCatMenuTimeout);
            window.GameLogic.princeCatMenuTimeout = null;
        }

        if (!restoreCat || !window.GameLogic.currentUser) return;

        const uid = window.GameLogic.currentUser.uid;
        const catRef = ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat'));
        const snap = await get(catRef);
        const data = snap.val() || {};

        if (data.interactingUid === uid && data.state !== 'petting') {
            const closeNow = Date.now();
            update(catRef, {
                interactingUid: null,
                lockedUntil: 0,
                state: 'idle',
                stateStartTime: closeNow,
                stateUntil: closeNow + 1000
            }).catch(err => console.warn('Firebase 關閉王子麵選單失敗:', err));
        }
    }

  playPrinceCatFeedingSFXOnce(feedingEffectKey) {
    if (!feedingEffectKey) return;
    if (this.lastPrinceCatFeedingEffectKey === feedingEffectKey) return;

    this.lastPrinceCatFeedingEffectKey = feedingEffectKey;
    this.playPrinceCatSFX('cat-can-open-sfx');
    this.playPrinceCatSFX('prince-cat-eating-sfx');
}

playPrinceCatYummySFXOnce(yummyEffectKey) {
    if (!yummyEffectKey) return;
    if (this.lastPrinceCatYummyEffectKey === yummyEffectKey) return;

    this.lastPrinceCatYummyEffectKey = yummyEffectKey;
    this.playPrinceCatSFX('prince-cat-full-sfx');
}

playPrinceCatFriendshipUpIfNeeded(oldBond, newBond) {
    const oldStage = window.getPrinceBondStageIndex ? window.getPrinceBondStageIndex(oldBond) : 0;
    const newStage = window.getPrinceBondStageIndex ? window.getPrinceBondStageIndex(newBond) : 0;

    if (newStage > oldStage) {
        this.playPrinceCatSFX('prince-cat-friendship-up-sfx');
        sendPrinceCatBubble("王子麵羈絆升階了！");
    }
}

createSafeCatCanOpenAnim() {
    const sourceKey = 'pet-cat-can-open-source';
    const sheetKey = 'pet-cat-can-open-sheet';
    const animKey = 'pet-cat-can-open';

    if (!this.textures.exists(sourceKey)) {
        console.warn('[王子麵餵食] 找不到 tools-pet-cat-can-open.png，略過開罐動畫。');
        return;
    }

    const sourceTexture = this.textures.get(sourceKey);
    const sourceImage =
        sourceTexture && sourceTexture.getSourceImage
            ? sourceTexture.getSourceImage()
            : (
                sourceTexture &&
                sourceTexture.source &&
                sourceTexture.source[0] &&
                sourceTexture.source[0].image
                    ? sourceTexture.source[0].image
                    : null
            );

    const sourceWidth =
        sourceImage && sourceImage.width
            ? sourceImage.width
            : (
                sourceTexture &&
                sourceTexture.source &&
                sourceTexture.source[0] &&
                sourceTexture.source[0].width
                    ? sourceTexture.source[0].width
                    : 0
            );

    const sourceHeight =
        sourceImage && sourceImage.height
            ? sourceImage.height
            : (
                sourceTexture &&
                sourceTexture.source &&
                sourceTexture.source[0] &&
                sourceTexture.source[0].height
                    ? sourceTexture.source[0].height
                    : 0
            );

    if (sourceWidth < 600 || sourceHeight < 100) {
        console.warn(`[王子麵餵食] tools-pet-cat-can-open.png 尺寸不正確：${sourceWidth}×${sourceHeight}。需要 600×100，6 格橫排，每格 100×100。已略過開罐動畫。`);
        return;
    }

    try {
        if (!this.textures.exists(sheetKey)) {
            this.textures.addSpriteSheet(sheetKey, sourceImage, {
                frameWidth: 100,
                frameHeight: 100,
                startFrame: 0,
                endFrame: 5
            });
        }

        const sheetTexture = this.textures.get(sheetKey);
        const hasFrame0 = !!(sheetTexture && sheetTexture.frames && sheetTexture.frames['0']);

        if (!hasFrame0) {
            console.warn('[王子麵餵食] pet-cat-can-open-sheet 沒有 frame 0，略過開罐動畫建立。');
            return;
        }

        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: 5 }),
                frameRate: 8,
                repeat: 0
            });
        }
    } catch (err) {
        console.warn('[王子麵餵食] 建立開罐動畫失敗，已略過，不影響餵食流程：', err);
    }
}
  
showCatCanOpenEffect(x, y) {
    try {
        const sheetKey = 'pet-cat-can-open-sheet';
        const animKey = 'pet-cat-can-open';
        const sheetTexture = this.textures.exists(sheetKey) ? this.textures.get(sheetKey) : null;
        const hasFrame0 = !!(sheetTexture && sheetTexture.frames && sheetTexture.frames['0']);

        if (!hasFrame0 || !this.anims.exists(animKey)) {
            const popText = this.add.text(x, y, '啪！', {
                fontSize: '22px',
                color: '#ffcc00',
                stroke: '#5d4037',
                strokeThickness: 4,
                fontFamily: 'serif'
            }).setOrigin(0.5).setDepth(95);

            this.tweens.add({
                targets: popText,
                y: y - 24,
                alpha: 0,
                scale: 1.25,
                duration: 650,
                ease: 'Cubic.easeOut',
                onComplete: () => popText.destroy()
            });

            return;
        }

        const can = this.add.sprite(x, y, sheetKey, 0).setDepth(90).setScale(1);
        can.play(animKey);

        this.tweens.add({
            targets: can,
            y: y - 18,
            alpha: 0,
            duration: 900,
            delay: 600,
            ease: 'Cubic.easeOut',
            onComplete: () => can.destroy()
        });
    } catch (err) {
        console.warn('[王子麵餵食] 開罐特效失敗，已略過，不中斷餵食流程：', err);
    }
}

finishPrinceCatFeeding(uid, catRef, feedingToken = null) {
    uid = uid || (
        window.GameLogic.currentUser && window.GameLogic.currentUser.uid
            ? window.GameLogic.currentUser.uid
            : null
    );
    if (!uid) return;

    const sprite = this.localPlayer && this.localPlayer.sprite
        ? this.localPlayer.sprite
        : null;

    if (sprite) {
        const sameToken = !feedingToken || !sprite.princeCatFeedingToken || sprite.princeCatFeedingToken === feedingToken;

        if (sameToken) {
            sprite.isFeedingPrinceCat = false;
            sprite.princeCatFeedingToken = null;
            sprite.princeCatFeedingRestoreAt = 0;
            sprite.setVelocity(0, 0);

            if (this.textures.exists('onion')) {
                sprite.setTexture('onion');
            }

            if (this.anims.exists('idle')) {
                sprite.play('idle', true);
            }
        }
    }

    update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${uid}`)), {
        action: null,
        actionTime: null
    }).catch(err => console.warn('[王子麵餵食] 清除玩家餵食 action 失敗：', err));

    const safeCatRef = catRef || ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat'));

    get(safeCatRef).then(latestSnap => {
        const latest = latestSnap.val() || {};

        if (latest.interactingUid && latest.interactingUid !== uid) {
            return;
        }

        const restoreNow = Date.now();
        const catX = Number.isFinite(latest.x)
            ? latest.x
            : (this.princeCatSprite && this.princeCatSprite.x ? this.princeCatSprite.x : 1024);

        const catY = Number.isFinite(latest.y)
            ? latest.y
            : (this.princeCatSprite && this.princeCatSprite.y ? this.princeCatSprite.y : 1024);

        update(safeCatRef, {
            interactingUid: null,
            lockedUntil: 0,
            state: 'idle',
            targetX: catX,
            targetY: catY,
            stateStartTime: restoreNow,
            stateUntil: restoreNow + Phaser.Math.Between(2000, 5000)
        }).catch(err => console.warn('[王子麵餵食] 恢復王子麵 idle 失敗：', err));
    }).catch(err => console.warn('[王子麵餵食] 讀取王子麵狀態失敗：', err));
}
  
async startPrinceCatFeeding() {
    if (!this.isCafe || !this.princeCatSprite || !window.GameLogic.currentUser) {
        sendBubble("王子麵不在這裡。");
        return;
    }

    const uid = window.GameLogic.currentUser.uid;
    const inv = window.GameLogic.myProfile.inventory || {};
    let catRef = null;
    let feedingToken = null;
    let feedingStarted = false;

    try {
        if ((inv['喵罐頭'] || 0) <= 0) {
            sendBubble("沒有喵罐頭可以餵食。");
            window.GameLogic.armedItemState = null;
            window.GameLogic.armedItemName = null;
            return;
        }

        const dist = Phaser.Math.Distance.Between(
            this.localPlayer.sprite.x,
            this.localPlayer.sprite.y,
            this.princeCatSprite.x,
            this.princeCatSprite.y
        );

        if (dist >= 170) {
            sendBubble("要靠近王子麵才能餵食喵罐頭。");
            return;
        }

        const p = window.normalizePrinceCatProfileFields();
        if ((p.princeFeedCountToday || 0) >= 3) {
            sendPrinceCatBubble("王子麵舔舔嘴，似乎已經吃飽了。\n今日餵食已達上限。");
            return;
        }

        const now = Date.now();
        const feedRestoreMs = 4300;
        const lockUntil = now + feedRestoreMs;
        feedingToken = `feed-${uid}-${now}`;
        catRef = ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat'));

        const snap = await get(catRef);
        const data = snap.val() || {};

        if (data.interactingUid && data.interactingUid !== uid && data.lockedUntil && now < data.lockedUntil) {
            sendPrinceCatBubble("王子麵正在理別人");
            return;
        }

        await update(catRef, {
            x: data.x || this.princeCatSprite.x,
            y: data.y || this.princeCatSprite.y,
            targetX: data.x || this.princeCatSprite.x,
            targetY: data.y || this.princeCatSprite.y,
            state: 'feeding',
            interactingUid: uid,
            direction: data.direction || 'right',
            stateStartTime: now,
            stateUntil: lockUntil,
            lockedUntil: lockUntil
        });

        feedingStarted = true;

        this.localPlayer.sprite.isFeedingPrinceCat = true;
        this.localPlayer.sprite.princeCatFeedingToken = feedingToken;
        this.localPlayer.sprite.princeCatFeedingRestoreAt = now + feedRestoreMs + 700;
        this.localPlayer.sprite.setVelocity(0, 0);

        if (this.textures.exists('onion-feeding')) {
            this.localPlayer.sprite.setTexture('onion-feeding');
        }

        update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${uid}`)), {
            action: 'feedPrinceCat',
            actionTime: now,
            x: this.localPlayer.sprite.x,
            y: this.localPlayer.sprite.y
        }).catch(err => console.warn('[王子麵餵食] 同步玩家餵食 action 失敗：', err));

        // 重要：保底恢復必須在任何特效、音效、動畫播放之前先註冊，避免特效錯誤導致角色永久蹲住。
        this.time.delayedCall(feedRestoreMs, () => {
            this.finishPrinceCatFeeding(uid, catRef, feedingToken);
        });

        const oldQty = inv['喵罐頭'] || 0;
        inv['喵罐頭'] = Math.max(0, oldQty - 1);
        window.GameLogic.myProfile.inventory = inv;

        update(ref(window.GameLogic.db, `users/${uid}`), {
            inventory: inv
        }).catch(err => console.warn('Firebase 扣除喵罐頭失敗:', err));

        window.GameLogic.armedItemState = null;
        window.GameLogic.armedItemName = null;

        try {
            this.applyPrinceFeedBondGain();
        } catch (err) {
            console.warn('[王子麵餵食] 羈絆增加流程失敗，但不影響保底恢復：', err);
        }

        const canX = (this.localPlayer.sprite.x + this.princeCatSprite.x) / 2;
        const canY = (this.localPlayer.sprite.y + this.princeCatSprite.y) / 2 - 20;

        try {
            this.showCatCanOpenEffect(canX, canY);
        } catch (err) {
            console.warn('[王子麵餵食] 開罐特效失敗，已略過：', err);
        }

        this.time.delayedCall(2800, () => {
            get(catRef).then(latestSnap => {
                const latest = latestSnap.val() || {};
                if (latest.interactingUid === uid) {
                    const yummyNow = Date.now();
                    update(catRef, {
                        state: 'yummy',
                        stateStartTime: yummyNow,
                        stateUntil: lockUntil,
                        lockedUntil: lockUntil
                    }).catch(err => console.warn('[王子麵餵食] 切換 yummy 狀態失敗：', err));
                }
            }).catch(err => console.warn('[王子麵餵食] 讀取 yummy 前狀態失敗：', err));
        });

    } catch (err) {
        console.warn('[王子麵餵食] 餵食流程發生錯誤，執行保底恢復：', err);

        if (feedingStarted) {
            this.finishPrinceCatFeeding(uid, catRef, feedingToken);
        }
    }
}

applyPrinceFeedBondGain() {
    const p = window.normalizePrinceCatProfileFields();
    const today = window.getPrinceLocalDateKey();

    if (p.princeLastFeedDate !== today) {
        p.princeLastFeedDate = today;
        p.princeFeedCountToday = 0;
    }

    if ((p.princeFeedCountToday || 0) >= 3) {
        sendPrinceCatBubble("王子麵舔舔嘴，似乎已經吃飽了。\n今日餵食已達上限。");
        return false;
    }

    const oldBond = Number(p.princeBond || 0);

    p.princeFeedCountToday = (p.princeFeedCountToday || 0) + 1;
    p.princeBond = Math.round((oldBond + 0.3) * 10) / 10;

    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), {
        princeBond: p.princeBond,
        princeFeedCountToday: p.princeFeedCountToday,
        princeLastFeedDate: p.princeLastFeedDate
    }).catch(err => console.warn('Firebase 更新王子麵餵食羈絆失敗:', err));

    sendPrinceCatBubble(`王子麵開心地吃掉了罐罐！\n王子麵羈絆增加了！\n今日餵食：${p.princeFeedCountToday} / 3`);
    this.playPrinceCatFriendshipUpIfNeeded(oldBond, p.princeBond);

    return true;
}

showPrinceCatSupportCoinEffect(x, y) {
    let fx;

    if (this.textures.exists('prince-cat-support-10coin')) {
        fx = this.add.image(x, y - 55, 'prince-cat-support-10coin').setDepth(130).setScale(1);
    } else {
        fx = this.add.text(x, y - 55, '+10', {
            fontSize: '24px',
            color: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#3e2723',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(130);
    }

    const msg = this.add.text(x, y - 95, '王子麵叼來了 10 馬德幣！', {
        fontSize: '16px',
        color: '#ffcc00',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(131);

    this.tweens.add({
        targets: [fx, msg],
        y: '-=45',
        alpha: 0,
        duration: 1400,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            if (fx && fx.destroy) fx.destroy();
            msg.destroy();
        }
    });

    this.playPrinceCatSFX('prince-cat-bring-coin-sfx');
}

tryPrinceCatSweepBonus(x, y) {
    if (!window.GameLogic.currentUser) return false;

    const p = window.GameLogic.myProfile || {};
    const rate = window.getPrinceSweepBonusRate ? window.getPrinceSweepBonusRate(p.princeBond || 0) : 0;

    if (!rate) return false;
    if (Math.random() >= rate) return false;

    p.coins = (p.coins || 0) + 10;
    window.GameLogic.myProfile = p;

    update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), {
        coins: p.coins
    }).catch(err => console.warn('Firebase 更新王子麵掃皮加成失敗:', err));

    const coinsEl = document.getElementById("vp-coins");
    if (coinsEl) coinsEl.innerText = p.coins;

    this.showPrinceCatSupportCoinEffect(x, y);
    return true;
}

    async startPrinceCatPetting() {
        if (!this.isCafe || !this.princeCatSprite || !window.GameLogic.currentUser) return;

        const menu = document.getElementById('prince-cat-menu');
        if (menu) menu.style.display = 'none';

        if (window.GameLogic.princeCatMenuTimeout) {
            clearTimeout(window.GameLogic.princeCatMenuTimeout);
            window.GameLogic.princeCatMenuTimeout = null;
        }

        const uid = window.GameLogic.currentUser.uid;
        const now = Date.now();
        const lockUntil = now + 3500;
        const pettingEffectKey = `${uid}_${now}`;
        const catRef = ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat'));
        const snap = await get(catRef);
        const data = snap.val() || {};

        if (data.interactingUid && data.interactingUid !== uid && data.lockedUntil && now < data.lockedUntil) {
            sendPrinceCatBubble("王子麵正在理別人");
            return;
        }

        this.princePettingLockUntil = lockUntil;
        this.localPlayer.sprite.isPettingPrinceCat = true;
        this.localPlayer.sprite.setVelocity(0, 0);
        this.localPlayer.sprite.play('onion-petting', true);

        await update(catRef, {
            x: data.x || this.princeCatSprite.x,
            y: data.y || this.princeCatSprite.y,
            targetX: data.x || this.princeCatSprite.x,
            targetY: data.y || this.princeCatSprite.y,
            state: 'petting',
            interactingUid: uid,
            direction: data.direction || 'right',
            stateStartTime: now,
            stateUntil: lockUntil,
            lockedUntil: lockUntil
        });

        update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${uid}`)), {
            action: 'petPrinceCat',
            actionTime: now,
            x: this.localPlayer.sprite.x,
            y: this.localPlayer.sprite.y
        });

        this.playPrinceCatPettingSFXOnce(pettingEffectKey);
        this.applyPrinceBondGain();

        this.time.delayedCall(3500, () => {
            if (this.localPlayer && this.localPlayer.sprite) {
                this.localPlayer.sprite.isPettingPrinceCat = false;
                this.localPlayer.sprite.setVelocity(0, 0);
                this.localPlayer.sprite.play('idle', true);
            }
            this.princePettingLockUntil = 0;

            update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${uid}`)), {
                action: null,
                actionTime: null
            });

            get(catRef).then(latestSnap => {
                const latest = latestSnap.val() || {};
                if (latest.interactingUid === uid) {
                    const restoreNow = Date.now();
                    update(catRef, {
                        interactingUid: null,
                        lockedUntil: 0,
                        state: 'idle',
                        targetX: latest.x || this.princeCatSprite.x,
                        targetY: latest.y || this.princeCatSprite.y,
                        stateStartTime: restoreNow,
                        stateUntil: restoreNow + Phaser.Math.Between(2000, 5000)
                    });
                }
            });
        });
    }

    applyPrinceBondGain() {
        const p = window.normalizePrinceCatProfileFields();
        const today = window.getPrinceLocalDateKey();

        if (p.princeLastPetDate !== today) {
            p.princeLastPetDate = today;
            p.princePetCountToday = 0;
        }

        if ((p.princePetCountToday || 0) < 3) {
            p.princePetCountToday = (p.princePetCountToday || 0) + 1;
            const oldBond = Number(p.princeBond || 0);
            p.princeBond = Math.round(((oldBond + 0.1) * 10)) / 10;
          
            update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), {
                princeBond: p.princeBond,
                princePetCountToday: p.princePetCountToday,
                princeLastPetDate: p.princeLastPetDate
            }).catch(err => console.warn('Firebase 更新王子麵羈絆失敗:', err));

            sendPrinceCatBubble(`與王子麵的羈絆增加了！\n今日摸摸：${p.princePetCountToday} / 3`);
            this.playPrinceCatFriendshipUpIfNeeded(oldBond, p.princeBond);
        } else {
            sendPrinceCatBubble("王子麵把頭轉開了。\n今日摸摸已達上限。");
        }
    }
  
    createPlayerEntity(x, y, pData, isLocal = false) { let entity = { sprite: this.physics.add.sprite(x, y, 'onion').setCollideWorldBounds(true).setDepth(10) }; if (!isLocal) { entity.sprite.setInteractive(); entity.sprite.on('pointerdown', (pointer) => { const actionMenu = document.getElementById("action-menu"); actionMenu.style.display = "flex"; actionMenu.style.left = pointer.event.pageX + "px"; actionMenu.style.top = pointer.event.pageY + "px"; actionMenu.dataset.uid = pData.uid; }); } 
        // 修正1：使用 Container 取代直接繪製，解決每幀重繪造成的掉幀問題
        entity.nameContainer = this.add.container(x, y).setDepth(12); entity.nameBg = this.add.graphics(); entity.nameText = this.add.text(0, 0, pData.name || '匿名', { fontSize: '13px', fontFamily: 'Georgia', color: pData.color || '#fff', fontStyle: 'bold' }).setOrigin(0.5); entity.nameContainer.add([entity.nameBg, entity.nameText]);
        entity.bubbleContainer = this.add.container(x, y).setDepth(14).setVisible(false); entity.bubbleBg = this.add.graphics(); entity.bubbleText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', wordWrap: { width: 160, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5); entity.bubbleContainer.add([entity.bubbleBg, entity.bubbleText]);
        
        entity.partyScoreContainer = this.add.container(x, y).setDepth(13).setVisible(false);
        let partyBgH = this.add.image(-25, 0, 'party-shot-number').setScale(1);
        let partyBgA = this.add.image(25, 0, 'party-attack-number').setScale(1);
        entity.partyShotText = this.add.text(-25, 0, '0', {fontSize:'14px', color:'#000', fontStyle:'bold'}).setOrigin(0.5);
        entity.partyAttackText = this.add.text(25, 0, '0', {fontSize:'14px', color:'#000', fontStyle:'bold'}).setOrigin(0.5);
        if (pData.uid === window.GameLogic.currentUser.uid || isLocal) { 
            let meBg = this.add.graphics().fillStyle(0xd9534f, 1).fillRoundedRect(-18, -32, 36, 18, 4); 
            let meTxt = this.add.text(0, -23, '這我', {fontSize:'12px', color:'#fff', fontStyle:'bold'}).setOrigin(0.5); 
            entity.partyScoreContainer.add([meBg, meTxt]); 
            
            // 修正4：新增派對專用底部紅色呼吸光環，方便己方在戰鬥中辨識位置
            entity.localAura = this.add.circle(x, y, 45, 0xff0000, 0.4).setDepth(9).setVisible(false);
            this.tweens.add({ targets: entity.localAura, scale: 1.3, alpha: 0.1, yoyo: true, repeat: -1, duration: 800 });
        }
        entity.partyScoreContainer.add([partyBgH, partyBgA, entity.partyShotText, entity.partyAttackText]);

        entity.lastNameData = ""; entity.lastBubbleData = ""; if (this.minimap) this.minimap.ignore([entity.nameContainer, entity.bubbleContainer, entity.partyScoreContainer]); return entity; 
    }
    updatePlayerEntity(entity, pData) { let sx = entity.sprite.x; let sy = entity.sprite.y; let currentUid = pData.uid || window.GameLogic.currentUser.uid; let displayName = `${pData.name || '匿名'} Lv.${pData.level || 1}`; let nameHash = displayName + (pData.color || ''); 
        if (entity.lastNameData !== nameHash) { entity.lastNameData = nameHash; entity.nameText.setText(displayName); if(pData.color) entity.nameText.setColor(pData.color); const nameBounds = entity.nameText.getBounds(); const bgWidth = nameBounds.width + 16; entity.nameBg.clear().fillStyle(0x000000, 0.6).fillRoundedRect(-bgWidth / 2, -10, bgWidth, 20, 4); }
        entity.nameContainer.setPosition(sx, sy - 45);
        
        if (this.sceneName === 'partyroom') {
            entity.partyScoreContainer.setVisible(true).setPosition(sx, sy - 75);
            let sData = window.PartyLogic && window.PartyLogic.scores && window.PartyLogic.scores[currentUid] ? window.PartyLogic.scores[currentUid] : {hitCount: 0, gotHitCount: 0};
            entity.partyShotText.setText(sData.gotHitCount || 0); entity.partyAttackText.setText(sData.hitCount || 0);
            if (entity.localAura) { entity.localAura.setVisible(true).setPosition(sx, sy); }
        } else { 
            entity.partyScoreContainer.setVisible(false); 
            if (entity.localAura) { entity.localAura.setVisible(false); }
        }
        let forcedBubbleMsg = (pData.action === 'showOff' || (entity === this.localPlayer && entity.isShowingOff)) ? '這個洋蔥正在炫耀' : '';
let activeBubbleMsg = forcedBubbleMsg || ((pData.bubbleMsg && (Date.now() - (pData.bubbleTime || 0) < 10000)) ? pData.bubbleMsg : '');
let activeBubbleAnchor = activeBubbleMsg ? (pData.bubbleAnchor || '') : '';
let activeBubbleYOffset = Number(pData.bubbleYOffset);

if (activeBubbleMsg) { 
    entity.bubbleContainer.setVisible(true);
    if (entity.lastBubbleData !== activeBubbleMsg) { 
        entity.lastBubbleData = activeBubbleMsg; 
        entity.bubbleText.setText(activeBubbleMsg); 
        const bounds = entity.bubbleText.getBounds(); 
        const boxWidth = bounds.width + 20, boxHeight = bounds.height + 16; 
        entity.bubbleBg.clear()
            .fillStyle(0xf4ecd8, 0.95)
            .lineStyle(2, 0xc5a059, 1)
            .fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8)
            .strokeRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8); 
        entity.bubbleOffsetY = 65 + boxHeight / 2; 
    }

    if (activeBubbleAnchor === 'below') {
        entity.bubbleContainer.setPosition(sx, sy + (Number.isFinite(activeBubbleYOffset) ? activeBubbleYOffset : 74));
    } else {
        entity.bubbleContainer.setPosition(sx, sy - (entity.bubbleOffsetY || 80));
    }
} else { 
    entity.bubbleContainer.setVisible(false); 
} 
    }
    createFurniture(key, data) { 
    const isGiftBox = key.includes('giftbox');

    let imgKey = 'memory';
    if (isGiftBox) imgKey = 'gift-box-stay';
    else if (key.includes('scoreboard')) imgKey = 'hall-screen';
    else if (key.includes('solochicken')) imgKey = 'solochicken';
    else if (key.includes('fridge')) imgKey = 'fridge';
    else if (key.includes('shrine')) imgKey = 'shrine';
    else if (key.includes('dummy')) imgKey = 'dummy';
    else if (key.includes('bed')) imgKey = 'doghouse-bed';
    else if (key === 'altar') imgKey = 'shrine-altar';
    else if (key.startsWith('seat_')) imgKey = 'shrine-seat';
    let f = { sprite: this.physics.add.sprite(data.x, data.y, imgKey).setDepth(5).setCollideWorldBounds(true) }; 
    f.isGiftBox = isGiftBox;

    if (isGiftBox) {
        f.sprite.setDisplaySize(120, 120);

        f.rewardNoticeText = this.add.text(data.x, data.y - 85, '‼️', {
            fontSize: '34px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffeb3b',
            stroke: '#8b0000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(25).setVisible(!!window.GameLogic.hasPendingWeeklyReward);

        f.rewardNoticeTween = this.tweens.add({
            targets: f.rewardNoticeText,
            x: data.x + 3,
            y: data.y - 92,
            yoyo: true,
            repeat: -1,
            duration: 120,
            ease: 'Sine.easeInOut'
        });
    }

    f.sprite.isLocked = data.locked;  
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
        this.localPlayer.isSweeping = false; 
        this.qteContainer.setVisible(false); 
        if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1'); 
        window.GameLogic.moonBunSweepPressCount = 0;

        if (this.isCafe && window.GameLogic.currentUser) {
            update(ref(window.GameLogic.db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), {
                isSweeping: false,
                x: this.localPlayer.sprite.x,
                y: this.localPlayer.sprite.y
            });
        }

        if (success && this.closestTrash) { 
            let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y - 40; 
            let dropBaseX = this.closestTrash.x; let dropBaseY = this.closestTrash.y;
            let trashKey = this.closestTrash.key; let isOld = this.closestTrash.type === 'onion-skin-old'; 
            
            // 修正9：體力滿電啟動時，扣除 2% 體力，經驗 x2，金錢 x3
            let expGain = 10; let totalCoins = isOld ? Phaser.Math.Between(50, 60) : Phaser.Math.Between(10, 18);
            if (window.GameLogic.energyActive && (window.GameLogic.myProfile.energy || 0) >= 2) {
            window.GameLogic.myProfile.energy -= 2;
            update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
                energy: window.GameLogic.myProfile.energy 
            }).catch(err => console.warn('Firebase 掃地扣除體力失敗:', err));
            expGain *= 2;
            totalCoins *= 3;
         }
          
            this.tryPrinceCatSweepBonus(px, py);

            remove(ref(window.GameLogic.db, window.getServerRoomPath('cafeTrashes/' + trashKey))); 
            this.closestTrash = null; let leveledUp = gainRewards(0, expGain); 
            if (leveledUp) { window.playSFX(this, 'chorus_of_angels1'); } 
            
            let coinAmounts = [Math.floor(totalCoins/3), Math.floor(totalCoins/3), totalCoins - 2*Math.floor(totalCoins/3)];
            // 修正：移除高耗能的動態 import，直接使用已在頂部引入的 push 與 ref，大幅提升遊戲幀數平順度
            for (let i = 0; i < 3; i++) { 
                let angle = (Math.PI * 2 / 3) * i + Phaser.Math.FloatBetween(-0.25, 0.25);
                let dist = Phaser.Math.Between(70, 110);
                let cx = Phaser.Math.Clamp(dropBaseX + Math.cos(angle) * dist, 80, this.physics.world.bounds.width - 80); 
                let cy = Phaser.Math.Clamp(dropBaseY + Math.sin(angle) * dist, 80, this.physics.world.bounds.height - 80); 
                push(ref(db, window.getServerRoomPath('droppedCoins')), { x: cx, y: cy, amount: coinAmounts[i], scene: this.sceneName }); 
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

    processShrineEventLogic(time) {
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
                        update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'countdown', targetUid: finalWinner, startTime: Date.now() });
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
                        update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'purifying', decay: 0, startTime: Date.now() });
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
                    update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { decay: currentDecay, lastDecayTime: Date.now() });
                }
            }
            let progressVal = (totalClicks * 5) - currentDecay; if (progressVal < 0) progressVal = 0;
            let targetProgress = pUids.length * 150; let ratio = Phaser.Math.Clamp(progressVal / targetProgress, 0, 1);
            let camW = this.cameras.main.width; let camH = this.cameras.main.height;
            this.purifyBar.clear().fillStyle(0xff4500, 1).fillRoundedRect(camW/2 - 196, camH * 0.75 - 96, 392 * ratio, 32, 16);
            
            if (isHost && ratio >= 1) {
                if (!this.pendingStateChange || Date.now() - this.pendingStateChange > 2000) {
                    this.pendingStateChange = Date.now();
                    update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'success', endTime: Date.now() });
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
        } else if (evState === 'success') {
            this.stopPurifyEffects(true); let tUid = eventData.targetUid;
            if (this.pooBoss) { 
                let boss = this.pooBoss; // 先抓住實體參考
                boss.bubbleText.setText("我還會再回來的..!!!!"); 
                // 必須在 Tween 結束時 (onComplete) 確實呼叫 destroy() 釋放記憶體
                this.tweens.add({ targets: boss, y: boss.y - 300, alpha: 0, duration: 2000, onComplete: () => boss.destroy() }); 
                if(boss.bubbleContainer) boss.bubbleContainer.destroy(); 
                this.pooBoss = null; 
            }
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
                                
                                                                let dropUpdates = {};
                                let altar = this.furnitureSprites['altar'] ? this.furnitureSprites['altar'].sprite : {x: cx, y: cy};
                                for (let i = 0; i < totalCoins; i++) {
                                    // 修正1：縮小隨機半徑並加入嚴格 Clamp 邊界防禦，絕不讓金幣貼在畫面最頂端或死角
                                    let rx = Phaser.Math.Clamp(altar.x + Phaser.Math.Between(-250, 250), 100, mapW - 100);
                                    let ry = Phaser.Math.Clamp(altar.y + Phaser.Math.Between(-150, 150), 120, mapH - 120);
                                    let key = 'shrine_coin_' + Date.now() + '_' + i;
                                    dropUpdates[window.getServerRoomPath(`droppedCoins/${key}`)] = { x: rx, y: ry, amount: coinValue, scene: 'shrine' };
                                }
                                update(ref(window.GameLogic.db), dropUpdates);
                            }
                            
                            let rewardText = this.add.text(cx, cy + 100, `滿地金幣快去撿！`, { fontSize: '48px', color: '#ffcc00', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(300).setScrollFactor(0); 
                            this.tweens.add({ targets: rewardText, y: cy, alpha: 0, duration: 4000, onComplete: () => rewardText.destroy() });
                        }
                    });
                }
                this.time.delayedCall(8000, () => {
                    this.successTextShown = false; this.coinsDropped = false;
                    if (isHost) update(ref(window.GameLogic.db, window.getServerRoomPath('shrineEvents/current')), { state: 'finished' });
                    if (this.localPlayer.isSeated) { this.localPlayer.isSeated = false; update(ref(window.GameLogic.db, window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`)), { isSeated: false }); }
                });
            }
        }
    }

    handleMimiHit(x, y) {
        // 修正：徹底拔除多餘的動態 import，直接使用全域引入的 get, ref, update，解決打擊瞬間的卡頓感
        get(ref(db, window.getServerRoomPath('cafeMimi/hp'))).then(snap => {
            let chp = snap.val() || 0;
            if (chp > 0) {
                let newHp = chp - 1; 
                update(ref(db, window.getServerRoomPath('cafeMimi')), { hp: newHp });
                
                window.playSFX(this, 'mimi-thief-stealing');

    if (newHp <= 0) {
                    let downTime = Date.now();
                    update(ref(db, window.getServerRoomPath('cafeMimi')), {
                        state: 'down',
                        active: true,
                        downTime: downTime,
                        x: x,
                        y: y
                    });
                    
                    window.playSFX(this, 'mimi-thief-get-down');
                    
                    if (this.mimiSprite) {
                        this.mimiLastDownAnimToken = downTime;
                        this.tweens.killTweensOf(this.mimiSprite);
                        this.mimiSprite.isBlinking = true;
                        this.mimiSprite.setAlpha(1);
                        this.mimiSprite.play('mimi-down', true);
                        this.tweens.add({
                            targets: this.mimiSprite,
                            alpha: 0.2,
                            yoyo: true,
                            repeat: -1,
                            duration: 150
                        });
                    }

                    let mData = window.GameLogic.cafeMimiData || {}; 
                    let baseCoins = 300 * (mData.playersInvolved || 1); 
                    let totalValue = baseCoins + (mData.stolenPool || 0); 
                    let coinValue = Math.floor(totalValue / 10);
                    let dropUpdates = {};
                    for(let i=0; i<10; i++) { 
                        let cx = Phaser.Math.Clamp(x + Phaser.Math.Between(-80, 80), 100, 1948);
                        let cy = Phaser.Math.Clamp(y + Phaser.Math.Between(-80, 80) + 20, 100, 1948);
                        dropUpdates[window.getServerRoomPath(`droppedCoins/mimi_coin_${Date.now()}_${i}`)] = { x: cx, y: cy, amount: coinValue, scene: this.sceneName }; 
                    }
                    dropUpdates[window.getServerRoomPath('serverEvents/mimiNextSpawn')] = Date.now() + Phaser.Math.Between(600000, 900000);
                    update(ref(db), dropUpdates);
                    sendBubble("打倒鼠偷米米啦！掉出滿地金幣！");
                }
            }
        });
    }

    update(time, delta) {
        if (!window.GameLogic.currentUser) return;
        if (this.updateMoonBunBuffUi) this.updateMoonBunBuffUi(time);
        let vx = 0; let vy = 0; let speed = 180; const uiScene = this.scene.manager.getScene('UIScene'); let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y;
        let evData = window.GameLogic.shrineEventData; let isPurifying = (this.sceneName === 'shrine' && evData && evData.state === 'purifying');

        if (this.sceneName === 'partyroom' && window.PartyLogic && window.PartyLogic.speedBoost) speed = 360;

        this.processShrineEventLogic(time);
        if (this.sceneName === 'partyroom') window.processPartyEventLogic(this);

      if (this.isCafe && !(this.soloRocketCruiseActive || this.soloRocketCruiseFinished || window.GameLogic.soloRocketCruiseActive)) {
        let pUids = Object.keys(window.GameLogic.cafePlayers || {}).filter(uid => window.GameLogic.onlinePlayers && window.GameLogic.onlinePlayers[uid]);
            let isHost = pUids.length > 0 && pUids.sort()[0] === window.GameLogic.currentUser.uid;
            
            if (isHost) {
                if (!this.mimiCheckTime || time - this.mimiCheckTime > 3000) {
                    this.mimiCheckTime = time;
                    get(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/mimiNextSpawn'))).then(snap => {
                        let nextSpawn = snap.val(); let now = Date.now();
                        if (!nextSpawn || now > nextSpawn) {
                            let mimiData = window.GameLogic.cafeMimiData;
                            if (!mimiData || (!mimiData.active && mimiData.state !== 'down')) {
                                                                let requiredHp = Math.min(6, 2 + Math.max(1, pUids.length));
                                let spawnX = Phaser.Math.Clamp(px - 260, 100, 1948);
                                let spawnY = Phaser.Math.Clamp(py, 100, 1948);
                                update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { active: true, x: spawnX, y: spawnY, state: 'walk', hp: requiredHp, playersInvolved: Math.max(1, pUids.length), stolenPool: 0, flipX: true, stolenUids: null });
                            }
                        }
                    });
                }
                
                let mData = window.GameLogic.cafeMimiData;
                let dtMs = time - (this.lastMimiLogicTime || time);
                // 🌟 折衷降頻：米米移動與 Firebase 同步改為每 35ms (約 30 FPS) 執行一次
                if (mData && mData.active && (dtMs > 35 || !this.lastMimiLogicTime)) {
                    let calcDelta = this.lastMimiLogicTime ? dtMs : 16;
                    this.lastMimiLogicTime = time;
                    let targetX = mData.x, targetY = mData.y;
                    
                    if (mData.state === 'walk' && mData.hp > 0) {
                        let targetUid = null; let minDist = 9999; let stolenUids = mData.stolenUids || {};
                        let stolenCount = Object.keys(stolenUids).length;
                        
                        let walkSpeed = (stolenCount === 0) ? 200 : 350; 
                        
                        pUids.forEach(uid => { if (!stolenUids[uid]) { let op = this.otherPlayers[uid] ? this.otherPlayers[uid].sprite : (uid === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null); if (op) { let d = Phaser.Math.Distance.Between(mData.x, mData.y, op.x, op.y); if (d < minDist) { minDist = d; targetUid = uid; targetX = op.x; targetY = op.y; } } } });
                        if (targetUid) {
                            if (minDist > 35) { 
                                let angle = Phaser.Math.Angle.Between(mData.x, mData.y, targetX, targetY); 
                                targetX = mData.x + Math.cos(angle) * (calcDelta / 1000) * walkSpeed; 
                                targetY = mData.y + Math.sin(angle) * (calcDelta / 1000) * walkSpeed; 
                                update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { x: targetX, y: targetY, flipX: (targetX > mData.x) }); 
                            } else {
                                update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'stealing', stealingFrom: targetUid }); 
                            }
                        } else {
                            let sumX = 0, sumY = 0; pUids.forEach(u => { let op = this.otherPlayers[u] ? this.otherPlayers[u].sprite : (u === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null); if (op) { sumX += op.x; sumY += op.y; } });
                            let cX = sumX / pUids.length; let cY = sumY / pUids.length;
                            
                            let angleAway = Phaser.Math.Angle.Between(cX, cY, mData.x, mData.y);
                            let angleToCenter = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024);
                            
                            let safeX = Phaser.Math.Clamp(cX + Math.cos(angleAway) * 200, 100, 1948); let safeY = Phaser.Math.Clamp(cY + Math.sin(angleAway) * 200, 100, 1948);
                            let distToSafe = Phaser.Math.Distance.Between(mData.x, mData.y, safeX, safeY);
                            if (distToSafe > 20) { 
                                let angle = Phaser.Math.Angle.Between(mData.x, mData.y, safeX, safeY); 
                                let centerWeight = Phaser.Math.Distance.Between(mData.x, mData.y, 1024, 1024) / 1000;
                                angle = Phaser.Math.Angle.RotateTo(angle, angleToCenter, centerWeight * 0.5);
                                
                                targetX = mData.x + Math.cos(angle) * (calcDelta / 1000) * 150; 
                                targetY = mData.y + Math.sin(angle) * (calcDelta / 1000) * 150; 
                                update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { x: targetX, y: targetY, flipX: (targetX > mData.x) }); 
                            } else { 
                                update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'laughing', laughTime: Date.now() }); 
                            }
                        }
                    } else if (mData.state === 'stealing' && mData.hp > 0) {
                        if (mData.stolenUids && mData.stolenUids[mData.stealingFrom]) {
                            update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'walk' });
                        }
                    } else if (mData.state === 'laughing' && mData.hp > 0) {
                        if (Date.now() - mData.laughTime > 3000) {
                            let unrobbedExist = pUids.some(uid => !(mData.stolenUids && mData.stolenUids[uid]));
                            if (unrobbedExist) update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'walk' });
                            else update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'chase', randomAngle: Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024) });
                        }
                    } else if (mData.state === 'chase' && mData.hp > 0) {
                        let unrobbedExist = pUids.some(uid => !(mData.stolenUids && mData.stolenUids[uid]));
                        if (unrobbedExist) {
                            update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { state: 'walk' });
                        } else {
                            let minDistToPlayer = 9999; let nearestP = null;
                            pUids.forEach(uid => {
                                let op = this.otherPlayers[uid] ? this.otherPlayers[uid].sprite : (uid === window.GameLogic.currentUser.uid ? this.localPlayer.sprite : null);
                                if (op) { let d = Phaser.Math.Distance.Between(mData.x, mData.y, op.x, op.y); if (d < minDistToPlayer) { minDistToPlayer = d; nearestP = op; } }
                            });
                            
                            let angle = mData.randomAngle || 0;
                            let boostSpeed = mData.speedBoost || 200; 
                            
                            if (nearestP && minDistToPlayer < 400) {
                                angle = Phaser.Math.Angle.Between(nearestP.x, nearestP.y, mData.x, mData.y);
                                angle += Phaser.Math.FloatBetween(-0.3, 0.3); 
                            } else {
                                let angleToCenter = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024);
                                angle = Phaser.Math.Angle.RotateTo(angle, angleToCenter, 0.1);
                                if (Math.random() < 0.05) angle += Phaser.Math.FloatBetween(-0.5, 0.5); 
                            }
                            
                            targetX = mData.x + Math.cos(angle) * (calcDelta / 1000) * boostSpeed; 
                            targetY = mData.y + Math.sin(angle) * (calcDelta / 1000) * boostSpeed;
                            
                            if (targetX < 50 || targetX > 1998 || targetY < 50 || targetY > 1998) { 
                                targetX = Phaser.Math.Clamp(targetX, 50, 1998); 
                                targetY = Phaser.Math.Clamp(targetY, 50, 1998); 
                                angle = Phaser.Math.Angle.Between(mData.x, mData.y, 1024, 1024) + Phaser.Math.FloatBetween(-0.5, 0.5);
                                boostSpeed = 500; 
                            } else {
                                boostSpeed = 200;
                            }
                            update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { x: targetX, y: targetY, flipX: (targetX > mData.x), randomAngle: angle, speedBoost: boostSpeed });
                        }
                    } else if (mData.state === 'down') {
                        if (!mData.downTime) update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { downTime: Date.now() });
                        else if (Date.now() - mData.downTime > 3000) update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { active: false, state: 'none' });
                    }
                }
            } else {
                // 如果房間內已無人，清除米米
                if (pUids.length === 0 && window.GameLogic.cafeMimiData && window.GameLogic.cafeMimiData.active) {
                    update(ref(window.GameLogic.db, window.getServerRoomPath('cafeMimi')), { active: false });
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
            update(ref(window.GameLogic.db, window.getServerRoomPath(`onlinePlayers/${window.GameLogic.currentUser.uid}`)), {
                lastActive: Date.now(),
                name: window.GameLogic.myProfile.name || '匿名',
                color: window.GameLogic.myProfile.color || '#fff'
            });
        }

        // 獨樂雞 Phaser overlay 開啟期間：玩家停住、提示隱藏、背景互動不繼續處理
        // 安全版：只有 Container 真的 active 時才 return；若只是殘留旗標，立刻清掉，避免永久卡死
        const hasActiveSoloChickenMenu =
            !!(this.soloChickenMenuOpen && this.soloChickenMenuContainer && this.soloChickenMenuContainer.active);

        if ((this.soloChickenMenuOpen || this.soloChickenMenuContainer) && !hasActiveSoloChickenMenu) {
            this.closeSoloChickenMenu();
        }

        if (hasActiveSoloChickenMenu) {
            if (this.localPlayer && this.localPlayer.sprite) {
                this.localPlayer.sprite.setVelocity(0, 0);
                this.localPlayer.sprite.play('idle', true);
            }

            if (this.smartPromptBg) this.smartPromptBg.setVisible(false);
            if (this.smartPromptText) this.smartPromptText.setVisible(false);
            if (this.waterPromptBg) this.waterPromptBg.setVisible(false);
            if (this.waterPromptText) this.waterPromptText.setVisible(false);
            if (this.lockOnTarget) this.lockOnTarget.setVisible(false);
            if (this.placePrompt) this.placePrompt.setVisible(false);

            return;
        }

        if (this.soloRocketCruiseActive || this.soloRocketCruiseFinished) {
            this.updateSoloRocketCruise(time, delta);
            if (this.smartPromptBg) this.smartPromptBg.setVisible(false);
            if (this.smartPromptText) this.smartPromptText.setVisible(false);
            if (this.waterPromptBg) this.waterPromptBg.setVisible(false);
            if (this.waterPromptText) this.waterPromptText.setVisible(false);
            if (this.lockOnTarget) this.lockOnTarget.setVisible(false);
            if (this.placePrompt) this.placePrompt.setVisible(false);
            return;
        }

        if (this.localPlayer.isShowingOff) {
            if (document.activeElement.tagName !== 'INPUT' && (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown || (uiScene && uiScene.joyStick && uiScene.joyStick.force > 0))) {
                this.localPlayer.isShowingOff = false;
                this.clearShowOffFx(this.localPlayer);
                const playerPath = this.getCurrentPlayerPathForAction();
                if (playerPath) update(ref(window.GameLogic.db, playerPath), { action: null, actionTime: null, medalIcon: null, medalDate: null, medalTitle: null, medalRecord: null });
            } else {
                this.localPlayer.sprite.setVelocity(0, 0); this.localPlayer.sprite.play('show-off', true);
                this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
                vx = 0; vy = 0; // 強制阻斷後續移動計算
            }
        }
        
        if (
    this.localPlayer.sprite.isFeedingPrinceCat &&
    this.localPlayer.sprite.princeCatFeedingRestoreAt &&
    Date.now() > this.localPlayer.sprite.princeCatFeedingRestoreAt
) {
    this.finishPrinceCatFeeding(
        window.GameLogic.currentUser.uid,
        ref(window.GameLogic.db, window.getServerRoomPath('cafePrinceCat')),
        this.localPlayer.sprite.princeCatFeedingToken
    );
}

const isPrinceCatPettingLocked = this.localPlayer.sprite.isPettingPrinceCat || (this.princePettingLockUntil && Date.now() < this.princePettingLockUntil);
const isPrinceCatFeedingLocked = !!this.localPlayer.sprite.isFeedingPrinceCat;
const isPrinceCatInteractionLocked = isPrinceCatPettingLocked || isPrinceCatFeedingLocked;

        if (isPrinceCatInteractionLocked) {
            vx = 0; vy = 0;
            this.localPlayer.sprite.setVelocity(0, 0);
            if (isPrinceCatFeedingLocked && this.textures.exists('onion-feeding')) {
                this.localPlayer.sprite.setTexture('onion-feeding');
            } else {
                this.localPlayer.sprite.play('onion-petting', true);
            }
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
          
        } else if (this.soloChickenMenuOpen || this.soloChickenMenuContainer) {
            // Phaser overlay 開啟時，玩家停在原地，避免背景仍在移動或輸入穿透
            this.localPlayer.sprite.setVelocity(0, 0);
            this.localPlayer.sprite.play('idle', true);
            this.smartPromptBg.setVisible(false);
            this.smartPromptText.setVisible(false);
            this.waterPromptBg.setVisible(false);
            this.waterPromptText.setVisible(false);
        
        } else if (this.localPlayer.isSweeping) {
            this.localPlayer.sprite.setVelocity(0, 0); this.localPlayer.sprite.play('clean', true); 
            if (!(this.isCafe && this.isMoonBunBuffActive && this.isMoonBunBuffActive())) this.qteProgress -= (delta * 0.02); if (this.qteProgress < 0) this.qteProgress = 0; this.updateQTEBar(this.qteProgress);
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
            
            if (this.sceneName === 'partyroom' && window.PartyLogic && window.PartyLogic.state === 'waiting') {
                let myIdx = window.PartyLogic.mySlotIndex || 0;
                let isMobile = window.innerWidth <= 768;
                let cols = isMobile ? 2 : 5; let rows = isMobile ? 5 : 2;
                let col = myIdx % cols; let row = Math.floor(myIdx / cols);
                let cw = 1920/cols; let ch = 1080/rows;
                let minX = col*cw + 40; let maxX = (col+1)*cw - 40;
                let minY = row*ch + 40; let maxY = (row+1)*ch - 40;
                let nx = this.localPlayer.sprite.x + vx * (delta/1000);
                let ny = this.localPlayer.sprite.y + vy * (delta/1000);
                if (nx < minX) { nx = minX; vx = 0; } if (nx > maxX) { nx = maxX; vx = 0; }
                if (ny < minY) { ny = minY; vy = 0; } if (ny > maxY) { ny = maxY; vy = 0; }
                this.localPlayer.sprite.x = nx; this.localPlayer.sprite.y = ny;
            }

            let isPlacing = window.GameLogic.placingFurnitureKey !== null && (this.isCafe || this.sceneName === 'doghouse' || this.sceneName === 'shrine');

            if (isPlacing) {
                this.localPlayer.sprite.setVelocity(0, 0).play('idle', true); let f = this.furnitureSprites[window.GameLogic.placingFurnitureKey];
                if (f && f.sprite && f.sprite.active) {
                    f.sprite.setVelocity(vx, vy); this.cameras.main.startFollow(f.sprite, true, 0.1, 0.1); this.placePrompt.setPosition(f.sprite.x, f.sprite.y - 80).setVisible(true);
                    if (vx !== 0 || vy !== 0) { if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) { let path = this.isCafe ? window.getServerRoomPath(`cafeFurniture/${window.GameLogic.placingFurnitureKey}`) : (this.sceneName === 'doghouse' ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${window.GameLogic.placingFurnitureKey}` : window.getServerRoomPath(`shrineFurniture/${window.GameLogic.placingFurnitureKey}`)); update(ref(window.GameLogic.db, path), { x: f.sprite.x, y: f.sprite.y }); this.lastSyncTime = Date.now(); } }
                }
            } else {
                this.placePrompt.setVisible(false); this.localPlayer.sprite.setVelocity(vx, vy); 
                // 修正：如果不在淨化中，才跟隨自己，避免與儀式強制鎖定的鏡頭搶奪
                if (!isPurifying) {
                    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                }
                let absX = Math.abs(vx); let absY = Math.abs(vy); if (absX < 1) vx = 0; if (absY < 1) vy = 0;
                if (!this.localPlayer.isShowingOff && !this.localPlayer.sprite.isPettingPrinceCat) {
                    if (vx === 0 && vy === 0) { this.localPlayer.sprite.play('idle', true); } else if (absX >= absY) { this.localPlayer.sprite.setFlipX(vx < 0); this.localPlayer.sprite.play('walk', true); } else { if (vy < 0) { this.localPlayer.sprite.play('walk-up', true); } else { this.localPlayer.sprite.play('walk-down', true); } }
                }
                if ((this.isCafe || this.sceneName === 'shrine' || this.sceneName === 'playroom' || this.sceneName === 'partyroom') && (vx !== 0 || vy !== 0)) { 
                    if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) { 
                        let path = this.isCafe ? window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`) : (this.sceneName === 'shrine' ? window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`) : (this.sceneName === 'playroom' ? window.getServerRoomPath(`playroomPlayers/${window.GameLogic.currentRoomId}/${window.GameLogic.currentUser.uid}`) : window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${window.GameLogic.currentUser.uid}`))); 
                        update(ref(window.GameLogic.db, path), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y }); this.lastSyncTime = Date.now(); 
                    } 
                }
            }

            // 🌟 降頻計算：鎖定與互動判定每 200ms 執行一次
            if (!this.lastTargetCalcTime || time - this.lastTargetCalcTime > 200) {
                this.lastTargetCalcTime = time;
                
                this._cachedMinDist = 90; this._cachedPromptTarget = null; this._cachedPromptMsg = ""; this.closestTrash = null;
                for (let key in this.furnitureSprites) {
                    let f = this.furnitureSprites[key]; if (!f.sprite.isLocked) continue; let d = Phaser.Math.Distance.Between(px, py, f.sprite.x, f.sprite.y);
                    if (this.sceneName === 'shrine') {
                        if (key === 'altar' && d < 150) { this._cachedMinDist = d; this._cachedPromptTarget = f.sprite; this._cachedPromptMsg = "按A召喚教友"; }
                        if (key.startsWith('seat_') && d < 150) { this._cachedMinDist = d; this._cachedPromptTarget = f.sprite; this._cachedPromptMsg = "按B入席"; }
                    } else {
                        if (d < this._cachedMinDist) { 
                            this._cachedMinDist = d; 
                            this._cachedPromptTarget = f.sprite; 

                            if (key.includes('giftbox')) this._cachedPromptMsg = "按A領取週結算獎勵"; 
                            else if (key.includes('fridge')) this._cachedPromptMsg = "按A打開冰箱"; 
                            else if (key.includes('shrine')) this._cachedPromptMsg = "按A參拜神龕"; 
                            else if (key.includes('dummy')) this._cachedPromptMsg = "假人洋蔥 (裝飾中)"; 
                            else if (key.includes('bed')) this._cachedPromptMsg = "按A歐歐睏"; 
                            else if (key.includes('scoreboard')) this._cachedPromptMsg = "按A查看洋蔥王排行榜"; 
                            else if (key.includes('solochicken')) this._cachedPromptMsg = "按A打開獨樂雞";
                            else this._cachedPromptMsg = "按A打開回憶錄"; 
                        }
                    }
                }
                for (let t of this.trashes) { if (!t.active) continue; let d = Phaser.Math.Distance.Between(px, py, t.x, t.y); if (d < this._cachedMinDist) { this._cachedMinDist = d; this._cachedPromptTarget = t; this._cachedPromptMsg = "按B使出掃地"; this.closestTrash = t; } }
                if (this.sceneName === '7eonion' && this.storeManager && !window.GameLogic.isShopping) { let d = Phaser.Math.Distance.Between(px, py, this.storeManager.x, this.storeManager.y); if (d < 150) { this._cachedMinDist = d; this._cachedPromptTarget = this.storeManager; this._cachedPromptMsg = "按A對話購物"; } }
                if (this.sceneName === 'playroom' && this.rpsMachine) { 
                    let d = Phaser.Math.Distance.Between(px, py, this.rpsMachine.x, this.rpsMachine.y); 
                    if (d < 150) { this._cachedMinDist = d; this._cachedPromptTarget = this.rpsMachine; this._cachedPromptMsg = "按A進行拳頭PK"; } 
                }
                 if (this.isCafe && this.princeCatSprite) {
                    let d = Phaser.Math.Distance.Between(px, py, this.princeCatSprite.x, this.princeCatSprite.y);
                    if (d < 170) {
                        const catData = window.GameLogic.princeCatData || {};
                        const occupied = catData.interactingUid && catData.interactingUid !== window.GameLogic.currentUser.uid && catData.lockedUntil && Date.now() < catData.lockedUntil;
                        this._cachedMinDist = d;
                        this._cachedPromptTarget = this.princeCatSprite;
                        const holdingCatCan = window.GameLogic.armedItemState === 'ready' && window.GameLogic.armedItemName === '喵罐頭';
                        this._cachedPromptMsg = occupied ? "王子麵正在理別人" : (holdingCatCan ? "按A餵食喵罐頭" : "按A選擇互動");
                    }
                }

                if (window.GameLogic.armedItemState) {
                    let itemName = window.GameLogic.armedItemName || '水球';
                    this._cachedLockOnMsg = itemName === '喵罐頭' ? "靠近王子麵按A餵食" : "按A施放" + itemName; 
                    let lockOnDist = (window.GameLogic.energyActive && (window.GameLogic.myProfile.energy || 0) > 0) ? 350 : 150; 
                    this._cachedLockTargetUid = null; this._cachedLockTargetSprite = null; this._cachedIsDummy = false; this._cachedIsMimi = false;
                    for (let uid in this.otherPlayers) { let op = this.otherPlayers[uid].sprite; let d = Phaser.Math.Distance.Between(px, py, op.x, op.y); if (d < lockOnDist) { lockOnDist = d; this._cachedLockTargetUid = uid; this._cachedLockTargetSprite = op; this._cachedIsDummy = false; this._cachedIsMimi = false; } }
                    for (let key in this.furnitureSprites) { if (key.includes('dummy')) { let fDummy = this.furnitureSprites[key].sprite; let d = Phaser.Math.Distance.Between(px, py, fDummy.x, fDummy.y); if (d < lockOnDist) { lockOnDist = d; this._cachedLockTargetUid = key; this._cachedLockTargetSprite = fDummy; this._cachedIsDummy = true; this._cachedIsMimi = false; } } }
                    if (this.mimiSprite && window.GameLogic.cafeMimiData && window.GameLogic.cafeMimiData.hp > 0) {
                        let d = Phaser.Math.Distance.Between(px, py, this.mimiSprite.x, this.mimiSprite.y);
                        if (d < lockOnDist) { lockOnDist = d; this._cachedLockTargetUid = 'mimi'; this._cachedLockTargetSprite = this.mimiSprite; this._cachedIsDummy = false; this._cachedIsMimi = true; }
                    }
                    if (itemName === '煙火' && window.GameLogic.armedItemState === 'ready' && !this._cachedLockTargetSprite) { this._cachedLockOnMsg = "按A施放全頻煙火"; }
                }
            }

            let promptTarget = this._cachedPromptTarget;
            let promptMsg = this._cachedPromptMsg;

            if (promptTarget && !isPlacing) {
                if (this.lastPromptMsg !== promptMsg) { this.lastPromptMsg = promptMsg; this.smartPromptText.setText(promptMsg); const pBounds = this.smartPromptText.getBounds(); this.smartPromptW = pBounds.width + 16; this.smartPromptH = pBounds.height + 8; }
                const isPrinceCatPrompt = this.isCafe && this.princeCatSprite && promptTarget === this.princeCatSprite;
                const ptX = promptTarget.x;
                const ptY = isPrinceCatPrompt ? promptTarget.y + 78 : promptTarget.y - 60;
                if (this.lastPromptDrawX !== ptX || this.lastPromptDrawY !== ptY || this.lastPromptDrawMsg !== promptMsg) { this.smartPromptBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(ptX - this.smartPromptW/2, ptY - this.smartPromptH/2, this.smartPromptW, this.smartPromptH, 6).strokeRoundedRect(ptX - this.smartPromptW/2, ptY - this.smartPromptH/2, this.smartPromptW, this.smartPromptH, 6); this.lastPromptDrawX = ptX; this.lastPromptDrawY = ptY; this.lastPromptDrawMsg = promptMsg; }
                this.smartPromptBg.setVisible(true); this.smartPromptText.setPosition(ptX, ptY).setVisible(true);
            } else { this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false); this.lastPromptDrawMsg = null; }

            if (window.GameLogic.armedItemState) {
                // 【獨立】時不時發出竄逃或等待的怪笑聲 (每 5 ~ 9 秒隨機觸發一次)，不再受限於鎖定距離的高頻計算
                if (this.mimiSprite && window.GameLogic.cafeMimiData && window.GameLogic.cafeMimiData.hp > 0) {
                    if (!this.nextMimiRandomSfxTime || time > this.nextMimiRandomSfxTime) {
                        this.nextMimiRandomSfxTime = time + Phaser.Math.Between(5000, 9000);
                        let currentState = window.GameLogic.cafeMimiData.state;
                        if (currentState === 'chase' || currentState === 'laughing') window.playSFX(this, 'mimi-laugh');
                    }
                }

                let msg = this._cachedLockOnMsg;
                let lockTargetSprite = this._cachedLockTargetSprite;
                let lockTargetUid = this._cachedLockTargetUid;
                let isDummy = this._cachedIsDummy;
                let isMimi = this._cachedIsMimi;

                if (this.lastWaterPromptMsg !== msg) { this.lastWaterPromptMsg = msg; this.waterPromptText.setText(msg); const wpBounds = this.waterPromptText.getBounds(); this.waterPromptW = wpBounds.width + 20; this.waterPromptH = wpBounds.height + 10; }
                const wptX = px, wptY = py + 45; 
                if (this.lastWaterDrawX !== wptX || this.lastWaterDrawY !== wptY || this.lastWaterDrawMsg !== msg) { this.waterPromptBg.clear().fillStyle(0x0077cc, 0.8).lineStyle(2, 0xffffff, 1).fillRoundedRect(wptX - this.waterPromptW/2, wptY - this.waterPromptH/2, this.waterPromptW, this.waterPromptH, 6).strokeRoundedRect(wptX - this.waterPromptW/2, wptY - this.waterPromptH/2, this.waterPromptW, this.waterPromptH, 6); this.lastWaterDrawX = wptX; this.lastWaterDrawY = wptY; this.lastWaterDrawMsg = msg; }
                this.waterPromptBg.setVisible(true); this.waterPromptText.setPosition(wptX, wptY).setVisible(true);
                if (lockTargetSprite) { this.lockOnTarget.setPosition(lockTargetSprite.x, lockTargetSprite.y - 40).setVisible(true); window.GameLogic.currentTargetSprite = lockTargetSprite; window.GameLogic.currentTargetUid = lockTargetUid; window.GameLogic.currentTargetType = isMimi ? 'mimi' : (isDummy ? 'dummy' : 'player'); } else { this.lockOnTarget.setVisible(false); window.GameLogic.currentTargetSprite = null; window.GameLogic.currentTargetUid = null; }
            } else { if (this.waterPromptBg) { this.waterPromptBg.setVisible(false); this.waterPromptText.setVisible(false); this.lockOnTarget.setVisible(false); this.lastWaterDrawMsg = null; } }
        }

        if (this.isCafe && this.princeCatSprite) {
            this.updatePrinceCatAutonomy(time, delta);
            this.updatePrinceCatVisual();
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
            let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, coin.x, coin.y); 
if (dist < 30) { 
    window.playSFX(this, 'coin03'); 
    let coinAmount = coin.amount; 
    let coinRef = ref(window.GameLogic.db, window.getServerRoomPath(`droppedCoins/${key}`));

    get(coinRef).then((coinSnap) => { 
        if (coinSnap.exists()) { 
            remove(coinRef).then(() => { 
                let p = window.GameLogic.myProfile; 
                p.coins = (p.coins || 0) + coinAmount; 
                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
                    coins: p.coins 
                }); 

                let coinsEl = document.getElementById("vp-coins"); 
                if (coinsEl) coinsEl.innerText = p.coins; 

                let px = this.localPlayer.sprite.x; 
                let py = this.localPlayer.sprite.y - 40; 
                let pickupText = this.add.text(px, py, `+${coinAmount} 💰`, { 
                    fontSize: '16px', 
                    color: '#d4af37', 
                    fontStyle: 'bold', 
                    stroke: '#000', 
                    strokeThickness: 3 
                }).setOrigin(0.5).setDepth(200); 

                this.tweens.add({ 
                    targets: pickupText, 
                    y: py - 40, 
                    alpha: 0, 
                    duration: 1000, 
                    onComplete: () => pickupText.destroy() 
                }); 
            }); 
        } 
    }); 
} 
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
                if (this.furnitureSprites[key].rewardNoticeTween) this.furnitureSprites[key].rewardNoticeTween.stop();
                if (this.furnitureSprites[key].rewardNoticeText) this.furnitureSprites[key].rewardNoticeText.destroy();
                // 移除已失效的假人氣泡銷毀死碼
                this.furnitureSprites[key].sprite.destroy();
                delete this.furnitureSprites[key];
            }
        }

        if (this.isCafe || this.sceneName === 'shrine' || this.sceneName === 'playroom' || this.sceneName === 'partyroom') {
            const playersData = this.isCafe ? window.GameLogic.cafePlayers : (this.sceneName === 'shrine' ? window.GameLogic.shrinePlayers : (this.sceneName === 'playroom' ? window.GameLogic.playroomPlayers : (window.PartyLogic ? window.PartyLogic.players : {})));
            const globalOnline = window.GameLogic.onlinePlayers || {};
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let pd = playersData[uid];
                if (!pd || typeof pd.x !== 'number' || typeof pd.y !== 'number') continue;
                pd.uid = uid;
                if (!this.otherPlayers[uid]) this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                let op = this.otherPlayers[uid]; let oldX = op.sprite.x; let oldY = op.sprite.y; op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2); op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2); let diffX = op.sprite.x - oldX; let diffY = op.sprite.y - oldY; let absX = Math.abs(diffX); let absY = Math.abs(diffY);
                const actionWindow = pd.action === 'showOff'
                    ? Number.POSITIVE_INFINITY
                    : (pd.action === 'petPrinceCat' ? 3600 : (pd.action === 'feedPrinceCat' ? 4300 : 1200));
                if (pd.action && pd.actionTime && Date.now() - pd.actionTime < actionWindow) {
                    if (pd.action === 'showOff') {
                        if (op.lastActionTime !== pd.actionTime) {
                            op.lastActionTime = pd.actionTime;
                            op.sprite.isShowingOff = true;
                            this.renderShowOffFx(op, pd.medalIcon, pd.medalTitle || '', pd.medalRecord || '', pd.medalDate || '');
                        }
                        op.sprite.play('show-off', true);
                    } else if (op.lastActionTime !== pd.actionTime) {
                        op.lastActionTime = pd.actionTime;

                        if (pd.action === 'throwWater') {
                            op.sprite.isThrowing = true;
                            op.sprite.play('throw', true);
                            this.time.delayedCall(300, () => {
                                if (op.sprite && op.sprite.active) op.sprite.isThrowing = false;
                            });
                        }

                        if (pd.action === 'hitWater') {
                            op.sprite.isStunned = true;
                            op.sprite.play('wet', true);
                            this.time.delayedCall(1000, () => {
                                if (op.sprite && op.sprite.active) op.sprite.isStunned = false;
                            });
                        }
                         if (pd.action === 'petPrinceCat') {
                            op.sprite.isPettingPrinceCat = true;
                            op.sprite.play('onion-petting', true);
                            this.time.delayedCall(3500, () => {
                                if (op.sprite && op.sprite.active) op.sprite.isPettingPrinceCat = false;
                            });
                        }
                         if (pd.action === 'feedPrinceCat') {
                             op.sprite.isFeedingPrinceCat = true;
                             op.sprite.feedPrinceCatUntil = Date.now() + 4500;

                                if (this.textures.exists('onion-feeding')) {
                             op.sprite.setTexture('onion-feeding');
                         }

                            this.time.delayedCall(4300, () => {
                                if (op.sprite && op.sprite.active) {
                             op.sprite.isFeedingPrinceCat = false;
                             op.sprite.feedPrinceCatUntil = 0;
                             op.sprite.setTexture('onion');
                             op.sprite.play('idle', true);
                          }
                      });
                    }
                    }
                } else if (op.sprite.isShowingOff) {
                    op.sprite.isShowingOff = false;
                    this.clearShowOffFx(op);
} else if (op.sprite.isStunned || op.sprite.isThrowing || op.sprite.isPettingPrinceCat || op.sprite.isFeedingPrinceCat) {
    if (op.sprite.isFeedingPrinceCat && op.sprite.feedPrinceCatUntil && Date.now() > op.sprite.feedPrinceCatUntil) {
        op.sprite.isFeedingPrinceCat = false;
        op.sprite.feedPrinceCatUntil = 0;
        op.sprite.setTexture('onion');
        op.sprite.play('idle', true);
    }
                } else if (pd.isSweeping) { 
                    op.sprite.play('clean', true); 
                } else if (pd.isSeated) {
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

function initPhaser() { const config = { type: Phaser.AUTO, parent: 'phaser-app', width: '100%', height: '100%', backgroundColor: '#1a1008', scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 }, physics: { default: 'arcade', arcade: { debug: false } }, scene: [ BootScene, MainScene, UIScene ] }; window.GameLogic.phaserGame = new Phaser.Game(config); }

function openFurnitureCatalog() {
    const modal = document.getElementById('furniture-catalog-modal'); const list = document.getElementById('catalog-list'); const title = document.getElementById('catalog-title'); list.innerHTML = "";
    let items = [];
    if (window.GameLogic.currentScene === "cafe") { 
        title.innerText = "📦 大廳家俱目錄"; 
        items = [ 
            { key: 'giftbox', name: '🎁 領獎大粉蔥', img: 'gift-box-stay.png' }, 
            { key: 'scoreboard', name: '🏆 戰況看板', img: 'hall-screen-in-list.png' }, 
            { key: 'solochicken', name: '獨樂雞', img: 'me_play_cock.png' },
            { key: 'fridge', name: '🧊 公用大冰箱', img: 'fridge.png' }, 
            { key: 'memory', name: '📖 洋蔥回憶錄', img: 'memory.png' }, 
            { key: 'shrine', name: '⛩️ 洋蔥神龕', img: 'shrine.png' }, 
            { key: 'dummy', name: '🧍 假人洋蔥', img: 'dummy.png' } 
        ]; 
    }
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
                                        let seats = Object.keys(window.GameLogic.shrineFurniture || {}).filter(k => k.startsWith('seat_'));
                    let updates = {}; seats.forEach(s => updates[window.getServerRoomPath(`shrineFurniture/${s}`)] = null);
                    update(ref(window.GameLogic.db), updates).then(() => { 
                        sendBubble("已回收所有禁屎坐墊！"); 
                        modal.style.display = 'none'; 
                    });
                }
                return;
            }
            
            modal.style.display = 'none'; let isCafe = window.GameLogic.currentScene === "cafe"; let isDoghouse = window.GameLogic.currentScene === "doghouse"; let isShrine = window.GameLogic.currentScene === "shrine";
            let targetDict = isCafe ? window.GameLogic.cafeFurniture : (isDoghouse ? window.GameLogic.doghouseFurniture : window.GameLogic.shrineFurniture);
            let pathPrefix = isCafe ? window.getServerRoomPath('cafeFurniture/') : (isDoghouse ? `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/` : window.getServerRoomPath('shrineFurniture/'));
            
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
                remove(ref(window.GameLogic.db, pathPrefix + itemKey));
                window.GameLogic.placingFurnitureKey = null; if(window.GameLogic.phaserGame) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if(scene && scene.localPlayer) { scene.cameras.main.startFollow(scene.localPlayer.sprite, true, 0.08, 0.08); } }
                sendBubble("傢俱收起來了!");
            } else {
                let pX = 1024, pY = 1024; if(window.GameLogic.phaserGame) { let scene = window.GameLogic.phaserGame.scene.getScene('MainScene'); if(scene && scene.localPlayer) { pX = scene.localPlayer.sprite.x; pY = scene.localPlayer.sprite.y - 80; } }
                let newData = { x: pX, y: pY, locked: false, ownerUid: window.GameLogic.currentUser.uid };
                if (isDoghouse) { window.GameLogic.doghouseFurniture = window.GameLogic.doghouseFurniture || {}; window.GameLogic.doghouseFurniture[itemKey] = newData; }
                else if (isCafe) window.GameLogic.cafeFurniture[itemKey] = newData;
                // 修正：為神龕加入 || {} 的防護機制，避免資料庫為空時引發 null 取值報錯卡死
                else if (isShrine) { window.GameLogic.shrineFurniture = window.GameLogic.shrineFurniture || {}; window.GameLogic.shrineFurniture[itemKey] = newData; }
                update(ref(window.GameLogic.db, pathPrefix + itemKey), newData);
                window.GameLogic.placingFurnitureKey = itemKey;
            }
        }; list.appendChild(div);
    }); modal.style.display = 'block';
}

document.getElementById("view-profile-btn").addEventListener("click", async () => { actionMenu.style.display = "none"; const targetUid = actionMenu.dataset.uid; if (targetUid === window.GameLogic.currentUser.uid) showProfileModal(window.GameLogic.myProfile, targetUid); else { const snap = await get(ref(db, `users/${targetUid}`)); if (snap.exists()) showProfileModal(snap.val(), targetUid); } });
function showProfileModal(p, uid) { 
    profileViewingUid = uid; 

    document.getElementById("vp-level").innerText = p.level || 1; 
    document.getElementById("vp-exp").innerText = p.exp || 0; 
    document.getElementById("vp-coins").innerText = p.coins || 0; 
    document.getElementById("vp-sweeps").innerText = p.sweeps || 0; 
    document.getElementById("vp-name").innerText = p.name || '匿名'; 
    document.getElementById("vp-color").style.backgroundColor = p.color || '#c5a059'; 
    document.getElementById("vp-birth").innerText = p.birth || '未知'; 
    document.getElementById("vp-food").innerText = p.food || '無'; 
    document.getElementById("vp-motto").innerText = p.motto || '無'; 

    const bondVal = Number(p.princeBond || 0);
    const bondDescEl = document.getElementById("vp-prince-bond-desc");
    const bondScoreEl = document.getElementById("vp-prince-bond-score");
    const bondEffectEl = document.getElementById("vp-prince-bond-effect");
    if (bondDescEl) bondDescEl.innerText = window.getPrinceBondDesc ? window.getPrinceBondDesc(bondVal) : "王子麵把你當空氣";
    if (bondScoreEl) bondScoreEl.innerText = `${bondVal.toFixed(1)} 分`;
    if (bondEffectEl) bondEffectEl.innerText = window.getPrinceBondEffect ? window.getPrinceBondEffect(bondVal) : "效果：無";

    ['name', 'color', 'birth', 'food', 'motto'].forEach(k => { 
        document.getElementById(`vp-${k}`).style.display = k === 'color' ? 'inline-block' : 'inline'; 
        document.getElementById(`edit-${k}`).style.display = 'none'; 
    }); 

    const isMe = uid === window.GameLogic.currentUser.uid; 
    document.getElementById("start-edit-btn").style.display = isMe ? "inline-block" : "none"; 
    document.getElementById("save-edit-btn").style.display = "none"; 

    let viewMedalsBtn = document.getElementById("view-medals-btn"); 
    if(!viewMedalsBtn) { 
        viewMedalsBtn = document.createElement("button"); 
        viewMedalsBtn.id = "view-medals-btn"; 
        viewMedalsBtn.className = "btn-primary"; 
        viewMedalsBtn.innerText = "我的戰績"; 
        viewMedalsBtn.onclick = window.openMedalList; 
        document.querySelector("#view-profile-modal .modal-btns").insertBefore(viewMedalsBtn, document.getElementById("start-edit-btn")); 
    } 

    viewMedalsBtn.style.display = isMe ? "inline-block" : "none"; 
    viewProfileModal.style.display = "block"; 
}
document.getElementById("start-edit-btn").addEventListener("click", () => { document.getElementById("start-edit-btn").style.display = "none"; document.getElementById("save-edit-btn").style.display = "inline-block"; ['name', 'color', 'birth', 'food', 'motto'].forEach(k => { let t = document.getElementById(`vp-${k}`); let i = document.getElementById(`edit-${k}`); if (k === 'color') { i.value = window.GameLogic.myProfile.color || '#c5a059'; } else if (k === 'name') { i.value = window.GameLogic.myProfile.name || '匿名'; } else { i.value = t.innerText === '未知' || t.innerText === '無' ? '' : t.innerText; } t.style.display = 'none'; i.style.display = 'inline-block'; }); });
document.getElementById("save-edit-btn").addEventListener("click", () => { let newData = { name: document.getElementById("edit-name").value.trim() || '匿名', color: document.getElementById("edit-color").value || '#c5a059', birth: document.getElementById("edit-birth").value.trim() || '未知', food: document.getElementById("edit-food").value.trim() || '無', motto: document.getElementById("edit-motto").value.trim() || '無' }; update(ref(db, `users/${window.GameLogic.currentUser.uid}`), newData).then(() => { window.GameLogic.myProfile = Object.assign({}, window.GameLogic.myProfile, newData); if (window.GameLogic.currentScene === "cafe") { update(ref(db, window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`)), { name: newData.name, color: newData.color }); } update(ref(db, window.getServerRoomPath(`onlinePlayers/${window.GameLogic.currentUser.uid}`)), { name: newData.name, color: newData.color }); showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); }); });

document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { if (e.key === "Enter") { if (document.activeElement === chatInput) sendChat(); else if (document.activeElement === document.getElementById("pm-input")) window.sendPM(); } });
function sendBubble(msg, options = {}) { 
    if (msg === undefined || msg === null) {
        msg = "";
    }
    msg = String(msg);

    if (msg.trim() === "") {
        return;
    }

    if (window.GameLogic.currentUser) { 
        const bubbleTime = Date.now();
        const bubbleAnchor = options.bubbleAnchor || null;
        const parsedYOffset = Number(options.yOffset);
        const bubbleYOffset = Number.isFinite(parsedYOffset) ? parsedYOffset : null;

        window.GameLogic.myProfile.bubbleMsg = msg; 
        window.GameLogic.myProfile.bubbleTime = bubbleTime; 
        window.GameLogic.myProfile.bubbleAnchor = bubbleAnchor;
        window.GameLogic.myProfile.bubbleYOffset = bubbleYOffset;

        let path = "";
        if (window.GameLogic.currentScene === "cafe") path = window.getServerRoomPath(`cafePlayers/${window.GameLogic.currentUser.uid}`);
        else if (window.GameLogic.currentScene === "shrine") path = window.getServerRoomPath(`shrinePlayers/${window.GameLogic.currentUser.uid}`);
        else if (window.GameLogic.currentScene === "playroom" && window.GameLogic.currentRoomId) path = window.getServerRoomPath(`playroomPlayers/${window.GameLogic.currentRoomId}/${window.GameLogic.currentUser.uid}`);
        
        if (path !== "") {
            update(ref(db, path), { 
                bubbleMsg: msg, 
                bubbleTime: bubbleTime,
                bubbleAnchor: bubbleAnchor,
                bubbleYOffset: bubbleYOffset
            }); 
        }
    } 
}

function sendPrinceCatBubble(msg) {
    sendBubble(msg, { bubbleAnchor: 'below', yOffset: 74 });
}
function sendChat() {
    const msg = chatInput.value.trim();
    if (msg !== "" && window.GameLogic.currentUser) {
        const now = new Date();
        push(ref(db, window.getServerRoomPath('chats')), {
            name: window.GameLogic.myProfile.name,
            msg: msg,
            date: now.toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}),
            time: now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute:'2-digit' })
        });
        sendBubble(msg);
        chatInput.value = "";
    }
}

function listenToChat() {
    if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }

    chatUnsubscribe = onValue(ref(db, window.getServerRoomPath('chats')), (snapshot) => {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        chatBox.innerHTML = "";
        const chats = snapshot.val();

        if (chats) {
            let lastMsg = "";
            let html = "";
            let chatArray = Object.values(chats);

            if (chatArray.length > 0) {
                let latest = chatArray[chatArray.length - 1];
                lastMsg = `${latest.name}：${latest.msg}`;
            }

            chatArray.reverse().forEach(c => {
                html += `<div style="margin-bottom: 4px;"><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg} <span style="font-size:10px; color:#bbb; margin-left:8px;">${c.date||''} ${c.time||''}</span></div>`;
            });

            chatBox.innerHTML = html;

            const topBar = document.getElementById("top-notification-bar");
            if (topBar && lastMsg) {
                topBar.innerText = `💬 最新發言｜ ${lastMsg}`;
            }

            requestAnimationFrame(() => {
                setTimeout(() => { chatBox.scrollTop = 0; }, 10);
            });
        }
    });
}

document.getElementById("upload-memory-btn").onclick = () => { const fileInput = document.getElementById("memory-file"); const textInput = document.getElementById("memory-text"); const file = fileInput.files[0]; const text = textInput.value.trim(); if (!file && !text) return alert("請上傳圖片或填寫文字！"); if (file) { const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const cvs = document.createElement('canvas'); let w = img.width, h = img.height; if (w > 300) { h *= 300 / w; w = 300; } cvs.width = w; cvs.height = h; cvs.getContext('2d').drawImage(img, 0, 0, w, h); saveMemoryToDB(cvs.toDataURL('image/jpeg', 0.7), text); }; img.src = e.target.result; }; reader.readAsDataURL(file); } else saveMemoryToDB("", text); fileInput.value = ""; textInput.value = ""; };
function saveMemoryToDB(imgBase64, text) {
    push(ref(db, window.getServerRoomPath('memories')), {
        uid: window.GameLogic.currentUser.uid,
        author: window.GameLogic.myProfile.name,
        img: imgBase64,
        text: text,
        time: new Date().toLocaleDateString('zh-TW')
    });
}

window.deleteMemory = async function(key) { 
    const snap = await get(ref(db, window.getServerRoomPath(`memories/${key}`))); 
    if (snap.exists()) { 
        let m = snap.val(); 
        let isMine = (m.uid === window.GameLogic.currentUser.uid) || (m.author === window.GameLogic.myProfile.name); 
        if (isMine) { 
            if (confirm("確定要刪除這條回憶嗎？")) remove(ref(db, window.getServerRoomPath(`memories/${key}`))); 
        } else { 
            alert("您沒有權限刪除這篇回憶喔！"); 
        } 
    } 
};

function listenToMemories() {
    if (memoryUnsubscribe) { memoryUnsubscribe(); memoryUnsubscribe = null; }

    memoryUnsubscribe = onValue(ref(db, window.getServerRoomPath('memories')), snap => { 
        const feed = document.getElementById("memory-feed");
        if (!feed) return;

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
        update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/inviteReplies/${attacker}`)), { reply: replyType, replierUid: window.GameLogic.currentUser.uid, time: Date.now() });

        if (replyType === 'yes') {
            window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null;
            let roomId = `playroom_${attacker}_${window.GameLogic.currentUser.uid}`;

            // 修正2：進入 Playroom 前，強迫清空舊有房間狀態，確保一切從頭開始
            set(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'none' });

            window.switchScene('playroom', { roomId: roomId });
        }
    }
};

// 修正2：補上遺失的重置與斷線處理函式，確保隨時可將機台清空
window.cancelRpsGame = function(roomId) {
    let id = roomId || window.GameLogic.currentRoomId;
    if (!id) return;
    
    // ==========================================
    // 新增：離開時重置本機端的扣款與發獎鎖定
    window.rpsLocalBetDeducted = false; 
    window.rpsLocalRewardAdded = false; 
    // ==========================================
    
    document.getElementById('rps-modal').style.display = 'none';
    let waitPhase = document.getElementById('rps-phase-waiting');
    if (waitPhase) waitPhase.style.display = 'none';
    let summaryEl = document.getElementById('rps-phase-summary');
    if (summaryEl) summaryEl.style.display = 'none';
    
    // 清除結算音效鎖與落金粉粒子
    window.calcResultSoundPlayed = false;
    let dust = document.getElementById('rps-dust-container');
    if (dust) dust.innerHTML = '';
    
    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${id}`)), { state: 'none' });
    if (window.GameLogic.currentUser) {
        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${id}/p_${window.GameLogic.currentUser.uid}`)), { machineReady: null, betReady: null });
    }
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
    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}/p_${window.GameLogic.currentUser.uid}`)), { machineReady: true });
};

window.confirmRpsBet = function() {
    let betVal = parseInt(document.getElementById('rps-bet-slider').value) || 0;
    document.getElementById('rps-bet-input-area').style.display = 'none';
    document.getElementById('rps-bet-status-me').innerText = "✅已下注";
    document.getElementById('rps-bet-status-me').style.color = "#00ff00";
        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`)), { betReady: true, betValue: betVal });
};

window.selectRps = function(choice) {
    if (window.rpsPhase !== 'rps_countdown') return;
    
    // 加上發光選取特效
    document.querySelectorAll('.rps-choice-img').forEach(el => el.classList.remove('rps-choice-selected'));
    document.getElementById('rps-choice-' + choice).classList.add('rps-choice-selected');

    document.getElementById('rps-me-img').style.backgroundImage = `url('playroom-rps-onion-me-${choice}.png')`;
    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`)), { rpsChoice: choice });
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
    
    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${window.GameLogic.currentRoomId}/p_${window.GameLogic.currentUser.uid}`)), { spamCount: window.rpsMySpamCount });
};

window.syncRpsState = function(roomId) {
    if (window.rpsUnsubscribe) window.rpsUnsubscribe();
    window.rpsUnsubscribe = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), snap => {
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
                            update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'betting' });
                            update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}/p_${myUid}`)), { betReady: false, betValue: 0, machineReady: null });
                            update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}/p_${otherUid}`)), { betReady: false, betValue: 0, machineReady: null });
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
                // ==========================================
                // 新增：確保進入下注階段時，重置本機金流鎖定
                window.rpsLocalBetDeducted = false; 
                window.rpsLocalRewardAdded = false;
                // ==========================================
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
                    get(ref(window.GameLogic.db, `users`)).then(uSnap => {
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
                    get(ref(window.GameLogic.db, `users`)).then(uSnap => {
                        let uDB = uSnap.val();
                        const myUserData = uDB[myUid] || {};
                        const otherUserData = uDB[otherUid] || {};

                        let p1C = (myUserData.coins || 0) - avgBet;
                        let p2C = (otherUserData.coins || 0) - avgBet;
                        
                        let maxBet = Math.max(0, Math.min(myUserData.coins || 0, otherUserData.coins || 0, 10000));
                        let ratio = maxBet > 0 ? (avgBet / maxBet) : 0;
                        let mult = 1;
                        if (ratio > 2/3) mult = 2;
                        else if (ratio > 1/3) mult = 1.5;

                        update(ref(window.GameLogic.db, `users/${myUid}`), { coins: Math.max(0, p1C) });
                        update(ref(window.GameLogic.db, `users/${otherUid}`), { coins: Math.max(0, p2C) });
                        
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { 
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
                // ==========================================
                // 新增：雙方在本機端同步扣除下注金額，並立即更新 UI
                if (!window.rpsLocalBetDeducted) {
                    window.rpsLocalBetDeducted = true;
                    window.GameLogic.myProfile.coins = Math.max(0, (window.GameLogic.myProfile.coins || 0) - (data.agreedBet || 0));
                    let coinsEl = document.getElementById("vp-coins");
                    if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
                }
                // ==========================================
                if (uids.sort()[0] === myUid && !data.summaryProcessed) {
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { summaryProcessed: true });
                    setTimeout(() => {
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { 
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
                
                let rpsMsg = document.getElementById('rps-center-msg');
                rpsMsg.style.top = '20%';
                rpsMsg.style.opacity = '1';
                rpsMsg.getAnimations().forEach(a => a.cancel()); // 確保移除之前的殘留動畫
                
                if (window.rpsInterval) clearInterval(window.rpsInterval);
                window.rpsInterval = setInterval(() => {
                    let elapsed = Date.now() - data.rpsStartTime;
                    if (elapsed < 0) elapsed = 0; // 修正1：防止時差導致出現 6、7 秒
                    let remain = 5 - Math.floor(elapsed / 1000);
                    if (remain > 5) remain = 5;
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
                        if (uids.sort()[0] === myUid) update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'rps_result' });
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
                         update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { explosionPlayed: true });
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
                                update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'rps_countdown', rpsStartTime: Date.now(), [`p_${myUid}/rpsChoice`]: null, [`p_${otherUid}/rpsChoice`]: null });
                            } else {
                                update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'spam_countdown', winnerUid: result === 'win' ? myUid : otherUid, spamStartTime: Date.now(), [`p_${myUid}/spamCount`]: 0, [`p_${otherUid}/spamCount`]: 0 });
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
                    if (elapsed < 0) elapsed = 0; // 修正：防止時差導致出現 4、5 秒
                    let remain = 3 - Math.floor(elapsed / 1000);
                    if (remain > 3) remain = 3;
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
                            if (uids.sort()[0] === myUid) update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'spamming', spamPlayTime: Date.now() });
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
                        if (uids.sort()[0] === myUid) update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { state: 'round_result' });
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
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), updates);
                    }, 3000);
                    
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { roundProcessed: true });
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
                
                // ==========================================
                // 新增：雙方在本機端同步發放最終獲得的獎金，並立即更新 UI
                if (!window.rpsLocalRewardAdded) {
                    window.rpsLocalRewardAdded = true;
                    window.GameLogic.myProfile.coins = (window.GameLogic.myProfile.coins || 0) + getAmt;
                    let coinsEl = document.getElementById("vp-coins");
                    if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
                }
                // ==========================================
                
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
                    get(ref(window.GameLogic.db, `users`)).then(uSnap => {
                        let uDB = uSnap.val();
                        const myUserData = uDB[myUid] || {};
                        const otherUserData = uDB[otherUid] || {};

                        let p1C = myUserData.coins || 0;
                        let p2C = otherUserData.coins || 0;
                        
                       // ==========================================
                        // 修正：主機端分配資料庫獎金時，必須用客觀視角判斷，不能直接套用上方只算給本機看的 getAmt
                        let hostTie = (myWins === otherWins);
                        let hostWin = (myWins > otherWins);
                        let halfPool = Math.round(finalPool / 2);
                        
                        if (hostTie) { 
                            p1C += halfPool; 
                            p2C += halfPool; 
                        }
                        else if (hostWin) { 
                            p1C += finalPool; 
                        }
                        else { 
                            p2C += finalPool; 
                        }
                        // ==========================================
                        
                        update(ref(window.GameLogic.db, `users/${myUid}`), { coins: p1C });
                        update(ref(window.GameLogic.db, `users/${otherUid}`), { coins: p2C });
                        update(ref(window.GameLogic.db, window.getServerRoomPath(`playroomGames/${roomId}`)), { moneyDistributed: true });
                    });
                }
            }
    });
};

// ==================== 派對系統全域邏輯 ====================
window.PartyLogic = { roomId: null, ammo: 666, state: 'none', scores: {}, players: {}, mySlotIndex: 0, speedBoost: false, selectedGame: '水球礁谷', playPhase: 0, lastInviteTime: 0, seenInviteKeys: {} };
let partyUnsubscribe = null; let partyInvitesUnsubscribe = null;

window.createPartyRoom = function() {
    let modal = document.getElementById('party-select-modal'); modal.style.display = 'none';
    window.PartyLogic.roomId = 'party_' + Date.now() + '_' + window.GameLogic.currentUser.uid;
    
    // 扣除派對喇叭
    let inv = window.GameLogic.myProfile.inventory || {};
    if (inv['派對喇叭'] > 0) {
        inv['派對喇叭'] -= 1;
        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv }).catch(err => console.warn('Firebase 扣除派對喇叭失敗:', err));
    }
    window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null;
    
    // 播放喇叭動畫與音效
    if (window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms && ms.localPlayer) {
            window.playSFX(ms, 'tools-onion-party-trumpet');
            ms.localPlayer.sprite.play('trumpet-play', true);
            ms.localPlayer.isThrowing = true;
            setTimeout(() => { if(ms.localPlayer && ms.localPlayer.sprite) ms.localPlayer.isThrowing = false; }, 1500);
        }
    }
    
    // 向全服廣播喇叭吹奏
    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/trumpetPlay/${window.GameLogic.currentUser.uid}`)), { time: Date.now(), scene: window.GameLogic.currentScene });

    // 延遲跳轉場景，讓動畫播完
    setTimeout(() => {
        set(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'waiting', host: window.GameLogic.currentUser.uid, game: window.PartyLogic.selectedGame, startTime: Date.now() });
        set(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${window.PartyLogic.roomId}`)), {
    time: Date.now(),
    inviterUid: window.GameLogic.currentUser.uid,
    inviterName: window.GameLogic.myProfile.name,
    game: window.PartyLogic.selectedGame,
    serverRoomId: window.getCurrentServerRoomId()
});
        window.switchScene('partyroom', { roomId: window.PartyLogic.roomId });
    }, 1500);
};

window.joinPartyroom = function(roomId) {
    // 將 playPhase 初始化為 -1 解決 0 秒階段 START 音效被跳過的問題
    window.PartyLogic.roomId = roomId; window.PartyLogic.ammo = 666; window.PartyLogic.speedBoost = false; window.PartyLogic.playPhase = -1;
    window.PartyLogic.gameData = null; window.PartyLogic.rewardClaimed = false; // 徹底清空舊局資料防干擾
    window.PartyLogic.state = 'waiting';
    window.PartyLogic.players = {};
    window.PartyLogic.scores = {};
    window.PartyLogic.host = null;
    window.PartyLogic.mySlotIndex = 0;

    // 新增：每次進入新的派對等候室，都強制重設本機準備按鈕，避免上一場殘留「取消準備」
    let readyBtn = document.getElementById('party-ready-btn');
    if (readyBtn) {
        readyBtn.innerText = '準備好了';
        readyBtn.style.background = 'var(--mucha-gold)';
    }
    let startBtn = document.getElementById('party-start-btn');
    if (startBtn) startBtn.style.display = 'none';
    let waitGrid = document.getElementById('party-wait-grid');
    if (waitGrid) waitGrid.innerHTML = '';
    
    // 自動裝備水球並隱藏聊天室
    window.GameLogic.armedItemState = 'ready'; window.GameLogic.armedItemName = '水球';
    document.getElementById('chat-section').style.display = 'none';
    
    let pModal = document.getElementById('party-waiting-modal');
    pModal.style.display = 'flex';
    if (!document.getElementById('party-particles-container')) {
        let container = document.createElement('div');
        container.id = 'party-particles-container';
        container.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0; overflow:hidden;';
        for(let i=0; i<100; i++) {
            let p = document.createElement('div');
            p.className = 'party-flow-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animationDelay = (Math.random() * 4) + 's';
            container.appendChild(p);
        }
        pModal.insertBefore(container, pModal.firstChild);
    }
    document.getElementById('party-red-flash').style.display = 'none'; document.getElementById('party-red-flash').style.opacity = 0;
    
    const playerRef = ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${roomId}/players/${window.GameLogic.currentUser.uid}`));
    set(playerRef, { x: 1920/2, y: 1080/2, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, level: window.GameLogic.myProfile.level || 1, ready: false });
    onDisconnect(playerRef).remove();
    
    partyUnsubscribe = onValue(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${roomId}`)), snap => {
        let data = snap.val(); if(!data) { window.leavePartyroom(); return; }
        window.PartyLogic.state = data.state;
        window.PartyLogic.players = data.players || {};
        window.PartyLogic.scores = data.scores || {};
        window.PartyLogic.host = data.host;
        window.PartyLogic.gameData = data;
        
        let pUids = Object.keys(window.PartyLogic.players);
        if (pUids.length >= 10 && data.state === 'waiting') update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${roomId}`)), { closed: true });
        
        if (data.state === 'waiting') {
            document.getElementById('party-waiting-modal').style.display = 'flex';
            let grid = document.getElementById('party-wait-grid'); grid.innerHTML = '';
            pUids.sort().forEach((uid, idx) => {
                if (uid === window.GameLogic.currentUser.uid) window.PartyLogic.mySlotIndex = idx;
                let pd = window.PartyLogic.players[uid];
                let hostLabel = uid === data.host ? '<div class="party-slot-host">房主</div>' : '';
                let readyCls = pd.ready ? 'ready' : '';
                grid.innerHTML += `<div class="party-slot ${readyCls}">${hostLabel}<img src="onion-sprite.png"><span>${pd.name}</span></div>`;
            });
            for(let i=pUids.length; i<10; i++) { grid.innerHTML += `<div class="party-slot" style="opacity:0.3;">等待加入...</div>`; }
            
            let isHost = data.host === window.GameLogic.currentUser.uid;
            let allReady = pUids.every(u => window.PartyLogic.players[u].ready);
            document.getElementById('party-start-btn').style.display = (isHost && allReady && pUids.length > 1) ? 'block' : 'none';
        } else {
            document.getElementById('party-waiting-modal').style.display = 'none';
        }
    });
};

window.leavePartyroom = function(skipSceneSwitch = false) {
    if (partyUnsubscribe) { partyUnsubscribe(); partyUnsubscribe = null; }
    const leavingRoomId = window.PartyLogic.roomId;
    const leavingUid = window.GameLogic.currentUser ? window.GameLogic.currentUser.uid : null;
    window.PartyLogic.gameData = null; // 離開時清空快取
    window.PartyLogic.state = 'none';
    window.PartyLogic.players = {};
    window.PartyLogic.scores = {};
    window.PartyLogic.host = null;
    window.PartyLogic.speedBoost = false;
    window.PartyLogic.playPhase = -1;
    document.getElementById('party-waiting-modal').style.display = 'none';
    document.getElementById('party-result-modal').style.display = 'none';
    let rFlash = document.getElementById('party-red-flash'); if (rFlash) { rFlash.style.display = 'none'; rFlash.style.opacity = 0; }
    
    // 離開時恢復聊天室與卸下裝備
    document.getElementById('chat-section').style.display = 'flex';
    window.GameLogic.armedItemState = null; window.GameLogic.armedItemName = null;

    // 新增：離開時也把本機準備按鈕重設，避免下一場殘留「取消準備」
    let readyBtn = document.getElementById('party-ready-btn');
    if (readyBtn) {
        readyBtn.innerText = '準備好了';
        readyBtn.style.background = 'var(--mucha-gold)';
    }
    let startBtn = document.getElementById('party-start-btn');
    if (startBtn) startBtn.style.display = 'none';
    
    if (leavingRoomId && leavingUid) {
        const roomRef = ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${leavingRoomId}`));
        const playerRef = ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${leavingRoomId}/players/${leavingUid}`));

        set(playerRef, null)
            .then(() => get(roomRef))
            .then(snap => {
                let roomData = snap.val();
                if (!roomData) {
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${leavingRoomId}`)), { closed: true }).catch(err => console.warn('Firebase 關閉不存在派對邀請失敗:', err));
                    return;
                }

                let remainingPlayers = roomData.players || {};
                let remainingUids = Object.keys(remainingPlayers).filter(uid => uid !== leavingUid).sort();

                if (remainingUids.length === 0) {
                    // 所有人都離開等候室或派對房間：關閉右側邀請，並刪除空房間
                    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${leavingRoomId}`)), { closed: true }).catch(err => console.warn('Firebase 關閉空派對邀請失敗:', err));
                    set(roomRef, null).catch(err => console.warn('Firebase 清除空派對房間失敗:', err));
                } else if (roomData.host === leavingUid) {
                    // 房主離開但房內還有人：由 UID 排序第一位接手房主
                    update(roomRef, { host: remainingUids[0] }).catch(err => console.warn('Firebase 轉移派對房主失敗:', err));
                }
            })
            .catch(err => console.warn('Firebase 離開派對房間失敗:', err));
    }

    window.PartyLogic.roomId = null;
    if (!skipSceneSwitch && window.GameLogic.currentScene === 'partyroom') window.switchScene('cafe');
};

window.togglePartyReady = function() {
    let btn = document.getElementById('party-ready-btn');
    let isReady = btn.innerText === '取消準備';
    btn.innerText = isReady ? '準備好了' : '取消準備';
    btn.style.background = isReady ? 'var(--mucha-gold)' : '#5cb85c';
    update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${window.GameLogic.currentUser.uid}`)), { ready: !isReady });
};

window.startPartyGame = function() {
    let stones = [];
    // 修正9：增設額外兩條3個為一組的障礙物連成一線，無視距離判定
    for (let l = 0; l < 2; l++) {
        let sx = Phaser.Math.Between(200, 1720);
        let sy = Phaser.Math.Between(200, 880);
        let dirs = [[1,0], [0,1], [1,1], [1,-1]];
        let dir = dirs[Math.floor(Math.random() * dirs.length)];
        for (let i = 0; i < 3; i++) {
            stones.push({x: sx + dir[0]*75*i, y: sy + dir[1]*75*i});
        }
    }
    // 修正9：下修為28個隨機障礙物，安全距離判定放寬為120px避免卡死通道
    for(let i=0; i<28; i++) {
        let maxTries = 50;
        while(maxTries-- > 0) {
            let x = Phaser.Math.Between(100, 1820); let y = Phaser.Math.Between(100, 980);
            let ok = true; for(let s of stones) { if(Phaser.Math.Distance.Between(x,y, s.x, s.y) < 120) { ok = false; break; } }
            if(ok) { stones.push({x,y}); break; }
        }
    }
    // 修正：移除動態 import
    update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'starting', stones: stones, gameStartTime: Date.now() });
    update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${window.PartyLogic.roomId}`)), { closed: true });
    
    let pUids = Object.keys(window.PartyLogic.players);
    pUids.forEach(uid => {
        let rx = Phaser.Math.Between(0,1) ? Phaser.Math.Between(100, 300) : Phaser.Math.Between(1620, 1820);
        let ry = Phaser.Math.Between(0,1) ? Phaser.Math.Between(100, 300) : Phaser.Math.Between(780, 980);
        update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/players/${uid}`)), { x: rx, y: ry });
        set(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${uid}`)), { hitCount: 0, gotHitCount: 0, ammo: 666 });
    });
};

window.replyPartyInvite = function(reply) {
    document.getElementById('party-invite-modal').style.display = 'none';
    if (reply === 'yes') {
        let inviteId = window.PartyLogic.pendingInviteId;
        if (!inviteId) return alert("派對邀請資料遺失，請對方重新發起。");
        if ((window.GameLogic.myProfile.coins || 0) < 50) return alert("馬德幣不足50！無法參加派對。");

        Promise.all([
            get(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${inviteId}`))),
            get(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${inviteId}`)))
        ]).then(([inviteSnap, roomSnap]) => {
            let inviteData = inviteSnap.val();
            let roomData = roomSnap.val();
            let roomPlayers = roomData && roomData.players ? roomData.players : {};
            let playerCount = Object.keys(roomPlayers).length;

            if (!inviteData || inviteData.closed || !inviteData.time || (Date.now() - inviteData.time >= 60000) || !roomData || playerCount === 0) {
                update(ref(window.GameLogic.db, window.getServerRoomPath(`serverEvents/partyInvites/${inviteId}`)), { closed: true }).catch(err => console.warn('Firebase 關閉失效派對邀請失敗:', err));
                if (window.GameLogic.partyInvitesData && window.GameLogic.partyInvitesData[inviteId]) {
                    window.GameLogic.partyInvitesData[inviteId].closed = true;
                }
                let minList = document.getElementById('party-active-rooms');
                let minUI = document.getElementById('party-minimized-list');
                if (minList) minList.innerHTML = '';
                if (minUI) minUI.style.display = 'none';
                return alert("這個派對房間已經結束或沒有人了，請對方重新發起邀請。");
            }

            window.GameLogic.myProfile.coins -= 50;
            let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
            update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins }).catch(err => console.warn('Firebase 扣除派對參加費失敗:', err));
            window.switchScene('partyroom', { roomId: inviteId });
        }).catch(err => {
            console.warn('Firebase 檢查派對邀請失敗:', err);
            alert("派對邀請確認失敗，請稍後再試。");
        });
    }
};

window.processPartyEventLogic = function(scene) {
    let data = window.PartyLogic.gameData; if(!data) return;
    let state = data.state;
    let pUids = Object.keys(window.PartyLogic.players || {}).sort();
    let coordinatorUid = pUids[0] || data.host;
    let isCoordinator = coordinatorUid === window.GameLogic.currentUser.uid;
    
    if (state === 'starting') {
        if (pUids.length <= 1 && isCoordinator) {
            update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'finished', finishTime: Date.now(), aborted: true });
            return;
        }

        let elapsed = Date.now() - data.gameStartTime;
        let phase = Math.floor(elapsed / 1000); 
        if (phase !== window.PartyLogic.playPhase && phase < 3) {
            window.PartyLogic.playPhase = phase;
            let texts = ["START", "READY", "GO"];
            // 修正8：使用相機絕對座標並置中
            let cx = scene.cameras.main.width / 2;
            let cy = scene.cameras.main.height / 2;
            let targetScale = scene.cameras.main.width < 768 ? 1 : 2;
            scene.partyAnnounceText.setText(texts[phase]).setPosition(cx, cy).setVisible(true);
            scene.partyAnnounceText.setScale(0).setAlpha(1);
            scene.tweens.add({ targets: scene.partyAnnounceText, scale: targetScale, alpha: 0, duration: 900 });
            if (phase === 0) window.playSFX(scene, 'party-start');
        } else if (phase >= 3 && window.PartyLogic.playPhase < 3) {
            window.PartyLogic.playPhase = 3;
            scene.partyAnnounceText.setVisible(false);
            if (isCoordinator) update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'gaming', gamingStartTime: Date.now() });
        }
    } else if (state === 'gaming') {
        let elapsed = Date.now() - data.gamingStartTime;
        let remain = 60 - Math.floor(elapsed / 1000);
        
        // 若遊戲途中玩家不足2人，改由目前房內排序第一位玩家負責強制結束，避免房主消失時卡在0秒
        if (pUids.length <= 1 && isCoordinator) {
            update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'finished', finishTime: Date.now(), aborted: true }); 
            return;
        }

        if (remain <= 20) {
            window.PartyLogic.speedBoost = true;
            let bgm = scene.sound.get('bgm-party'); if(bgm) bgm.setRate(1.5);
            let rFlash = document.getElementById('party-red-flash');
            if (rFlash) { rFlash.style.opacity = (Math.floor(Date.now() / 250) % 2 === 0) ? 0.3 : 0; }
        }
        
        if (remain <= 0 && isCoordinator) {
            update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${window.GameLogic.currentUser.uid}`)), { ammo: window.PartyLogic.ammo });
            update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}`)), { state: 'finished', finishTime: Date.now() }); 
        }
    } else if (state === 'finished') {
        window.PartyLogic.speedBoost = false;
        let bgm = scene.sound.get('bgm-party'); if(bgm) bgm.setRate(1);
        let rFlash = document.getElementById('party-red-flash'); if (rFlash) { rFlash.style.display = 'none'; }
        
        if (data.aborted || Object.keys(window.PartyLogic.players || {}).length <= 1) {
            if (window.PartyLogic.playPhase < 4) {
                window.PartyLogic.playPhase = 4;
                let cx = scene.cameras.main.width / 2;
                let cy = scene.cameras.main.height / 2;
                let targetScale = scene.cameras.main.width < 768 ? 0.6 : 1;
                scene.partyAnnounceText.setText("強制結束").setPosition(cx, cy).setVisible(true).setScale(targetScale).setAlpha(1);
                setTimeout(() => { 
                    scene.partyAnnounceText.setVisible(false); 
                    document.getElementById('party-result-modal').style.display = 'block'; 
                    document.getElementById('party-result-list').innerHTML = '<div style="text-align:center; color:#fff; font-size:16px;">玩家不足，派對強制結束，無結算獎勵。</div>'; 
                }, 2000);
            }
            return;
        }

        if (window.PartyLogic.playPhase < 4) {
            window.PartyLogic.playPhase = 4;
            // 修正8：使用相機絕對座標並置中
            let cx = scene.cameras.main.width / 2;
            let cy = scene.cameras.main.height / 2;
            let targetScale = scene.cameras.main.width < 768 ? 1 : 2;
            scene.partyAnnounceText.setText("FINISH").setPosition(cx, cy).setVisible(true).setScale(0).setAlpha(1);
            scene.tweens.add({ targets: scene.partyAnnounceText, scale: targetScale, duration: 500 });
            window.playSFX(scene, 'party-finish');
            
            // Upload final ammo before scoring
            update(ref(window.GameLogic.db, window.getServerRoomPath(`partyRooms/${window.PartyLogic.roomId}/scores/${window.GameLogic.currentUser.uid}`)), { ammo: window.PartyLogic.ammo });
            
            setTimeout(() => {
                scene.partyAnnounceText.setVisible(false);
                let scoresObj = window.PartyLogic.scores || {};
                let pUids = Object.keys(window.PartyLogic.players || {});
                let results = pUids.map(uid => {
                    let s = scoresObj[uid] || {hitCount:0, gotHitCount:0, ammo:0};
                    let score = (s.hitCount * 10) - (s.gotHitCount * 5) + (s.ammo * 0.1);
                    return { uid: uid, name: window.PartyLogic.players[uid].name, hitCount: s.hitCount, gotHitCount: s.gotHitCount, ammo: s.ammo, score: score };
                });
                results.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    if (a.gotHitCount !== b.gotHitCount) return a.gotHitCount - b.gotHitCount;
                    if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
                    return b.ammo - a.ammo;
                });
                
                let html = '';
                let isTwoPlayers = (results.length === 2);
                results.forEach((r, idx) => {
                    let medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
                    let reward = 88;
                    if (isTwoPlayers) {
                        if (idx === 0) reward = 200;
                        else if (idx === 1) reward = 150;
                    } else {
                        if (idx === 0) reward = 888;
                        else if (idx === 1) reward = 250;
                        else if (idx === 2) reward = 150;
                    }
                    html += `<div style="display:flex; justify-content:space-between; padding:8px 5px; border-bottom:1px solid #ccc; font-size:14px;">
                        <span style="font-weight:bold; color:var(--mucha-brown); width:35%;">${medal} ${r.name}</span>
                        <span style="color:#005599; width:45%; font-size:12px;">擊中:${r.hitCount} / 被擊:${r.gotHitCount} / 餘彈:${r.ammo}<br>評分: ${r.score.toFixed(1)}</span>
                        <span style="color:var(--mucha-green); font-weight:bold; width:20%; text-align:right;">💰 ${reward}</span>
                    </div>`;
                    
                    if (r.uid === window.GameLogic.currentUser.uid && !window.PartyLogic.rewardClaimed) {
                        window.PartyLogic.rewardClaimed = true;
                        window.GameLogic.myProfile.coins = (window.GameLogic.myProfile.coins || 0) + reward;
                        let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
                        update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: window.GameLogic.myProfile.coins });
                    }
                });
                html += `<div style="font-size:12px; color:#666; margin-top:10px; text-align:center; background:#eee; padding:5px; border-radius:4px;">評分計算方式：(擊中人數 x 10) - (被擊中次數 x 5) + (遊戲結束時剩餘水球數 x 0.1)</div>`;
                document.getElementById('party-result-list').innerHTML = html;
                document.getElementById('party-result-modal').style.display = 'block';
                window.playSFX(scene, 'chorus_of_angels1');
            }, 3000);
        }
    }
};

// 修正5,6,7：設立獨立的計時器，不依賴資料庫 onValue 觸發，每秒更新並維護倒數、消失邏輯
if (window.partyInviteTimer) clearInterval(window.partyInviteTimer);
window.partyInviteTimer = setInterval(() => {
    let minList = document.getElementById('party-active-rooms');
    let minUI = document.getElementById('party-minimized-list');
    if (!minUI || !window.GameLogic.partyInvitesData || !window.GameLogic.currentUser) return;
    
    let invites = window.GameLogic.partyInvitesData;
    let activeInvites = Object.keys(invites).filter(k => invites[k] && !invites[k].closed && invites[k].time && (Date.now() - invites[k].time < 60000));
    
    if (activeInvites.length === 0) {
        minUI.style.display = 'none';
        minList.innerHTML = '';
        return;
    }
    
    minUI.style.display = 'flex';
    let html = '';
    activeInvites.forEach(k => {
        let inv = invites[k];
        if (inv.inviterUid !== window.GameLogic.currentUser.uid) {
            let remain = 60 - Math.floor((Date.now() - inv.time)/1000);
            if (remain > 0) {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #555; padding:5px 0; color:#fff; font-size:13px;"><span>${inv.inviterName} 的派對</span><div><span style="color:#ff4444; font-weight:bold; margin-right:8px;">${remain}s</span><button class="btn-primary" style="padding:2px 8px; font-size:12px;" onclick="window.PartyLogic.pendingInviteId='${k}'; window.replyPartyInvite('yes')">加入</button></div></div>`;
            }
        }
    });
    if (html === '') minUI.style.display = 'none';
    minList.innerHTML = html;
}, 1000);

// Global Listener for Party Invites
// 修補：不要在檔案載入時固定監聽預設房間；登入成功後依目前 currentServerRoom 重掛。
window.showPartyInviteNotice = function(inviteId, inv) {
    if (!window.GameLogic.currentUser || !inv) return;
    if (inv.closed || !inv.time || Date.now() - inv.time >= 60000) return;
    if (inv.inviterUid === window.GameLogic.currentUser.uid) return;
    if (inv.serverRoomId && inv.serverRoomId !== window.getCurrentServerRoomId()) return;

    window.PartyLogic.pendingInviteId = inviteId;
    window.PartyLogic.lastInviteTime = Math.max(
        Number(window.PartyLogic.lastInviteTime || 0),
        Number(inv.time || 0)
    );

    const nameEl = document.getElementById('party-inviter-name');
    if (nameEl) nameEl.innerText = inv.inviterName || '某位洋蔥';

    if (window.GameLogic.currentScene !== 'partyroom') {
        const inviteModal = document.getElementById('party-invite-modal');
        if (inviteModal) inviteModal.style.display = 'block';
    }
};

window.startPartyInviteListener = function() {
    if (partyInvitesUnsubscribe) {
        partyInvitesUnsubscribe();
        partyInvitesUnsubscribe = null;
    }

    if (!window.GameLogic.currentUser) return;

    const listeningRoomId = window.getCurrentServerRoomId();
    window.GameLogic.partyInvitesData = {};
    window.PartyLogic.seenInviteKeys = window.PartyLogic.seenInviteKeys || {};

    partyInvitesUnsubscribe = onValue(ref(window.GameLogic.db, window.getServerRoomPath('serverEvents/partyInvites')), snap => {
        // 若房間在監聽期間被切換，安全重掛，避免繼續聽舊房。
        if (listeningRoomId !== window.getCurrentServerRoomId()) {
            if (partyInvitesUnsubscribe) {
                partyInvitesUnsubscribe();
                partyInvitesUnsubscribe = null;
            }
            setTimeout(() => {
                if (window.startPartyInviteListener) window.startPartyInviteListener();
            }, 0);
            return;
        }

        const invites = snap.val() || {};
        window.GameLogic.partyInvitesData = invites;

        if (!window.GameLogic.currentUser) return;

        const activeInvites = Object.keys(invites).filter(k => {
            const inv = invites[k];
            return inv &&
                !inv.closed &&
                inv.time &&
                Date.now() - inv.time < 60000 &&
                inv.inviterUid !== window.GameLogic.currentUser.uid &&
                (!inv.serverRoomId || inv.serverRoomId === listeningRoomId);
        });

        activeInvites.forEach(k => {
            const inv = invites[k];
            const seenKey = `${listeningRoomId}_${k}_${inv.time || 0}`;

            if (window.PartyLogic.seenInviteKeys[seenKey]) return;

            window.PartyLogic.seenInviteKeys[seenKey] = true;
            window.showPartyInviteNotice(k, inv);
        });
    });
};

// ====== 新增：領獎系統與勳章展示 UI ======
const rewardStyles = `
<style>
    .reward-bg { background: #d32f2f !important; border: 4px solid #ffd700 !important; box-shadow: 0 0 20px #ffcc00, inset 0 0 30px #8b0000 !important; overflow: hidden; }
    .reward-neon-btn { background: #ffd700 !important; color: #b8860b !important; font-size: 18px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 0 10px #ffd700, 0 0 20px #ffaa00; text-shadow: 0 0 5px #fff; border-radius: 8px; transition: 0.2s; }
    .reward-neon-btn:hover { transform: scale(1.05); box-shadow: 0 0 20px #fff, 0 0 30px #ffaa00; }
    .reward-grid { display: grid; grid-template-columns: 1fr; gap: 10px; max-height: 40vh; overflow-y: auto; padding-right: 5px; z-index: 10; position: relative; }
    .reward-item { background: rgba(255,255,255,0.9); border: 2px solid #ffd700; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; position: relative; }
    .reward-item.claimed { background: #555; border-color: #888; filter: grayscale(100%); }
    .reward-claimed-text { color: #00ff00; font-weight: bold; text-shadow: 0 0 5px #000; font-size: 16px; display: none; }
    .reward-item.claimed .reward-claimed-text { display: block; }
    .reward-item.claimed button { display: none; }
    @keyframes reward-fall { 0% { transform: translateY(-50px) rotate(0deg); opacity: 1; } 100% { transform: translateY(120vh) rotate(360deg); opacity: 0; } }
    @keyframes confetti-burst-left { 0% { transform: translate(0, 0) scale(0); opacity: 1; } 100% { transform: translate(-100px, -100px) scale(1.5); opacity: 0; } }
    @keyframes confetti-burst-right { 0% { transform: translate(0, 0) scale(0); opacity: 1; } 100% { transform: translate(100px, -100px) scale(1.5); opacity: 0; } }
    #medal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-height: 50vh; overflow-y: auto; }
    .medal-item { display: flex; flex-direction: column; align-items: center; background: rgba(197, 160, 89, 0.2); padding: 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--mucha-gold); }
    .medal-item:hover { background: rgba(197, 160, 89, 0.4); }
</style>
<div id="reward-main-modal" class="modal reward-bg" style="z-index: 300;">
    <div id="reward-effects-container1" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;"></div>
    <h2 style="color:#ffd700; text-shadow: 0 0 10px #ff0000; position:relative; z-index:1;">🎁 領取派獎</h2>
    <div style="position:relative; z-index:1; display:flex; flex-direction:column; gap:15px; margin-top:20px;">
        <button class="reward-neon-btn" style="padding: 15px;" onclick="window.openWeeklyRewardDetail()">本週掃地王</button>
        <button class="reward-neon-btn" style="padding: 15px;" onclick="window.openPrinceCatRewardDetail()">王子麵與你</button>
        <button class="btn-secondary" style="padding: 10px;" onclick="window.closeRewardModal()">關閉</button>
    </div>
</div>
<div id="reward-detail-modal" class="modal reward-bg" style="z-index: 310; width: 90%; max-width: 400px;">
    <div id="reward-effects-container2" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;"></div>
    <div style="position:relative; z-index:1;">
        <h3 style="color:#ffd700; margin-top:0; border-bottom: 2px dashed #ffd700;">本週掃地王</h3>
        <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; margin-bottom:10px; text-align:left; color:#fff; font-size:13px;">
            <strong>【派獎規則】</strong><br>結算至每週一 00:00。<br>第1名: 10000幣+金勳章 / 第2名: 5000幣+銀勳章 / 第3名: 3000幣+銅勳章 / 參加獎: 500幣。<br>滿500次加贈5000幣及專屬勳章(滿1000次另有高階勳章)。<br>未領取將於一週後消失。
        </div>
        <div style="color:#fff; font-size:16px; font-weight:bold; margin-bottom:15px; text-shadow: 0 0 5px #000;">你的排名: <span id="reward-my-rank" style="color:#00ff00;">計算中...</span></div>
        <div id="reward-items-grid" class="reward-grid"></div>
        <button class="btn-secondary" style="width:100%; margin-top:15px; padding:10px;" onclick="document.getElementById('reward-detail-modal').style.display='none'">返回</button>
    </div>
</div>
<div id="reward-congrats-overlay" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:9999; pointer-events:none; text-align:center;">
    <div id="congrats-text" style="font-size:36px; color:#ffd700; font-weight:bold; text-shadow: 0 0 10px #ff0000, 0 0 20px #fff; animation: shake-gold-text 0.5s infinite;">恭喜獲得！</div>
    <div id="congrats-confetti-left" style="position:absolute; top:50%; left:-50px; font-size:40px;">🎉</div>
    <div id="congrats-confetti-right" style="position:absolute; top:50%; right:-50px; font-size:40px;">🎊</div>
</div>

<div id="medal-list-modal" class="modal" style="z-index: 280; width: 90%; max-width: 400px;">
    <h3 style="color:var(--mucha-green); margin-top:0;">🎖️ 我的戰績</h3>
    <div id="medal-grid"></div>
    <button class="close-modal-btn btn-secondary" style="width:100%; margin-top:15px;" onclick="document.getElementById('medal-list-modal').style.display='none'">關閉</button>
</div>
<div id="medal-detail-modal" class="modal" style="z-index: 290; text-align:center; background:#111; color:#fff; border: 3px solid var(--mucha-gold);">
    <h3 id="md-event-name" style="color:#ffd700; margin-top:0;"></h3>
    <img id="md-icon" src="" style="width:150px; height:150px; object-fit:contain; filter:drop-shadow(0 0 10px #ffd700); margin: 15px 0;">
    <div id="md-date" style="color:#aaa; font-size:14px; margin-bottom:8px;"></div>
    <div id="md-record" style="color:#00ffcc; font-size:15px; font-weight:bold; margin-bottom:15px; text-shadow:0 0 5px #000;"></div>
    <div style="display:flex; gap:10px;">
        <button class="btn-primary" style="flex:1; background:#d9534f; font-weight:bold; border:2px solid #ffcc00;" onclick="window.triggerShowOff()">炫耀</button>
        <button class="btn-secondary" style="flex:1;" onclick="document.getElementById('medal-detail-modal').style.display='none'">關閉</button>
    </div>
</div>
`;
document.getElementById('app-container').insertAdjacentHTML('beforeend', rewardStyles);

window.updateGiftBoxRewardNoticeVisual = function() {
    const hasPending = !!window.GameLogic.hasPendingWeeklyReward;
    const ms = window.GameLogic.phaserGame ? window.GameLogic.phaserGame.scene.getScene('MainScene') : null;
    if (!ms || !ms.furnitureSprites) return;

    Object.values(ms.furnitureSprites).forEach(furn => {
        if (!furn || !furn.sprite || !furn.isGiftBox) return;

        if (furn.rewardNoticeText) {
            furn.rewardNoticeText.setPosition(furn.sprite.x, furn.sprite.y - 85);
            furn.rewardNoticeText.setVisible(hasPending);
        }

        if (hasPending && !window.GameLogic.activeGiftBox) {
            furn.sprite.setTexture('gift-box-stay');
            if (furn.glow) furn.glow.setVisible(false);
        }
    });
};

window.checkPendingWeeklyRewardNotice = async function() {
    if (!window.GameLogic.currentUser) return false;

    const uid = window.GameLogic.currentUser.uid;
    const lastWeekId = window.getWeekId(-1);
    const roomRewardWeekId = `${window.getCurrentServerRoomId()}_${lastWeekId}`;

    try {
        const [rewardSnap, sweepSnap] = await Promise.all([
            get(ref(window.GameLogic.db, `users/${uid}/weeklyRewards/${roomRewardWeekId}`)),
            get(ref(window.GameLogic.db, window.getServerRoomPath(`weeklySweeps/${lastWeekId}`)))
        ]);

        let hasPending = false;

        if (rewardSnap.exists()) {
            const rewardVal = rewardSnap.val();
            const rewardList = Array.isArray(rewardVal) ? rewardVal : Object.values(rewardVal || {});
            hasPending = rewardList.some(r => r && !r.claimed);
        } else {
            const sweepsData = sweepSnap.val() || {};
            const sorted = Object.entries(sweepsData)
                .map(([k, v]) => Object.assign({ uid: k }, v))
                .sort((a, b) => (b.count || 0) - (a.count || 0));
            hasPending = sorted.findIndex(p => p.uid === uid) >= 0;
        }

        window.GameLogic.hasPendingWeeklyReward = hasPending;
        window.updateGiftBoxRewardNoticeVisual();
        return hasPending;
    } catch (err) {
        console.warn('檢查大粉蔥待領獎勵失敗:', err);
        return false;
    }
};

// 【新增】實時監聽全服是否有玩家正在與大粉蔥(派獎箱)互動
onValue(ref(db, window.getServerRoomPath('serverEvents/giftBoxInteracting')), snap => {
    let interactingUsers = snap.val() || {};
    let isAnyoneInteracting = Object.keys(interactingUsers).length > 0;
    if (window.GameLogic && window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms && ms.furnitureSprites) {
            Object.values(ms.furnitureSprites).forEach(furn => {
                if (furn.sprite && (furn.isGiftBox || furn.sprite.texture.key === 'gift-box-stay' || furn.sprite.texture.key === 'gift-box-open')) {
    if (furn.rewardNoticeText) furn.rewardNoticeText.setVisible(!!window.GameLogic.hasPendingWeeklyReward);

    if (window.GameLogic.hasPendingWeeklyReward && !window.GameLogic.activeGiftBox) {
        furn.sprite.setTexture('gift-box-stay');
        if (furn.glow) furn.glow.setVisible(false);
        return;
    }

    if (isAnyoneInteracting) {
        furn.sprite.setTexture('gift-box-open');
        if (furn.glow) furn.glow.setVisible(true);
    } else if (!window.GameLogic.activeGiftBox) {
        furn.sprite.setTexture('gift-box-stay');
        if (furn.glow) furn.glow.setVisible(false);
    }
}
            });
        }
    }
});

window.openRewardModal = function(furnitureObj) { 
    window.GameLogic.activeGiftBox = furnitureObj; 

    if (window.GameLogic.hasPendingWeeklyReward && furnitureObj && furnitureObj.sprite) {
        furnitureObj.sprite.setTexture('gift-box-stay');
        if (furnitureObj.glow) furnitureObj.glow.setVisible(false);
        if (window.updateGiftBoxRewardNoticeVisual) window.updateGiftBoxRewardNoticeVisual();
    }

    document.getElementById('reward-main-modal').style.display = 'block'; 
    
    // 【新增】寫入 Firebase 廣播互動狀態
    if (window.GameLogic.currentUser) {
        const interactRef = ref(db, window.getServerRoomPath(`serverEvents/giftBoxInteracting/${window.GameLogic.currentUser.uid}`));
        set(interactRef, true);
        onDisconnect(interactRef).remove();
    }

    ['reward-effects-container1', 'reward-effects-container2'].forEach(id => {
        let container = document.getElementById(id);
        if(!container) return;
        container.innerHTML = '';
        let emojis = ['💵','💰','💶','💷','💎','🤑','🧧'];
        for(let i=0; i<25; i++) {
            let emj = document.createElement('div');
            emj.innerText = emojis[Math.floor(Math.random()*emojis.length)];
            emj.style.cssText = `position:absolute; top:-50px; left:${Math.random()*100}%; font-size:${20+Math.random()*15}px; animation: reward-fall ${2+Math.random()*3}s linear infinite; opacity:0.8; z-index:0;`;
            container.appendChild(emj);
            let particle = document.createElement('div');
            particle.style.cssText = `position:absolute; top:-50px; left:${Math.random()*100}%; width:4px; height:12px; background:#ffd700; box-shadow:0 0 10px #ffcc00; animation: reward-fall ${1+Math.random()*2}s linear infinite; z-index:0;`;
            container.appendChild(particle);
        }
    });
};

window.closeRewardModal = function() { 
    document.getElementById('reward-main-modal').style.display = 'none'; 
    document.getElementById('reward-detail-modal').style.display = 'none'; 
    
    // 【新增】移除 Firebase 互動狀態
    if (window.GameLogic && window.GameLogic.currentUser) {
        remove(ref(db, window.getServerRoomPath(`serverEvents/giftBoxInteracting/${window.GameLogic.currentUser.uid}`)));
    }

    if (window.GameLogic.activeGiftBox) { 
        window.GameLogic.activeGiftBox.sprite.setTexture('gift-box-stay'); 
        if (window.GameLogic.activeGiftBox.glow) window.GameLogic.activeGiftBox.glow.setVisible(false); 
        window.GameLogic.activeGiftBox = null; 
        if (window.updateGiftBoxRewardNoticeVisual) window.updateGiftBoxRewardNoticeVisual();
    } 
};

window.openWeeklyRewardDetail = async function() {
    document.getElementById('reward-detail-modal').style.display = 'block';

    const title = document.querySelector('#reward-detail-modal h3');
    if (title) title.innerText = "本週掃地王";

    const ruleBox = document.querySelector('#reward-detail-modal h3 + div');
    if (ruleBox) {
        ruleBox.innerHTML = `<strong>【派獎規則】</strong><br>結算至每週一 00:00。<br>第1名: 10000幣+金勳章 / 第2名: 5000幣+銀勳章 / 第3名: 3000幣+銅勳章 / 參加獎: 500幣。<br>滿500次加贈5000幣及專屬勳章(滿1000次另有高階勳章)。<br>未領取將於一週後消失。`;
    }
    let lastWeekId = window.getWeekId(-1);
    let roomRewardWeekId = `${window.getCurrentServerRoomId()}_${lastWeekId}`;
    let uid = window.GameLogic.currentUser.uid;
    let grid = document.getElementById('reward-items-grid');
    grid.innerHTML = '<div style="color:#fff; text-align:center;">結算中...</div>';
    
    let [sweepSnap, rewardSnap] = await Promise.all([
        get(ref(window.GameLogic.db, window.getServerRoomPath(`weeklySweeps/${lastWeekId}`))),
        get(ref(window.GameLogic.db, `users/${uid}/weeklyRewards/${roomRewardWeekId}`))
    ]);
    
    let sweepsData = sweepSnap.val() || {};
    let sorted = Object.entries(sweepsData)
        .map(([k, v]) => Object.assign({ uid: k }, v))
        .sort((a, b) => b.count - a.count);
    let myRankIndex = sorted.findIndex(p => p.uid === uid);
    let mySweeps = myRankIndex >= 0 ? sorted[myRankIndex].count : 0;
    
    let rankText = myRankIndex === 0 ? '🏆 第 1 名' : (myRankIndex === 1 ? '🥈 第 2 名' : (myRankIndex === 2 ? '🥉 第 3 名' : (myRankIndex === -1 ? '未參賽' : `第 ${myRankIndex + 1} 名`)));
    document.getElementById('reward-my-rank').innerText = `${rankText} (掃了 ${mySweeps} 次)`;
    window.currentViewingRewardRecordText = `${rankText}，掃了 ${mySweeps} 次`;
    window.currentViewingRewardSweepCount = mySweeps;
    
    let myRewards = rewardSnap.exists() ? rewardSnap.val() : [];
    
    // 初次載入，生成該週專屬獎勵快取
    if (!rewardSnap.exists() && myRankIndex >= 0) {
        if (myRankIndex === 0) myRewards.push({ id: 'rank', type: 'both', coins: 10000, medal: 'ranking-medal-cleanking-no1.png', name: '掃地王第一名勳章', claimed: false });
        else if (myRankIndex === 1) myRewards.push({ id: 'rank', type: 'both', coins: 5000, medal: 'ranking-medal-cleanking-no2.png', name: '掃地王第二名勳章', claimed: false });
        else if (myRankIndex === 2) myRewards.push({ id: 'rank', type: 'both', coins: 3000, medal: 'ranking-medal-cleanking-no3.png', name: '掃地王第三名勳章', claimed: false });
        else myRewards.push({ id: 'rank', type: 'coin', coins: 500, name: '參加獎', claimed: false });
        
        if (mySweeps >= 500) {
            let mult = Math.floor(mySweeps / 500);
            myRewards.push({ id: 'sweep_coins', type: 'coin', coins: mult * 5000, name: `滿500次倍數獎金 x${mult}`, claimed: false });
            myRewards.push({ id: 'sweep_500', type: 'medal', medal: 'ranking-medal-cleanking-500ps.png', name: '猛掃五百片蔥皮勳章', claimed: false });
        }
        if (mySweeps >= 1000) { 
            myRewards.push({ id: 'sweep_1000', type: 'medal', medal: 'ranking-medal-cleanking-1000ps.png', name: '猛掃一千片蔥皮勳章', claimed: false }); 
        } 
        // 【修正】陣列資料必須使用 set 寫入，使用 update 會引發 Firebase 報錯導致中斷，卡在「結算中...」
        await set(ref(window.GameLogic.db, `users/${uid}/weeklyRewards/${roomRewardWeekId}`), myRewards); 
    } 
    window.currentViewingRewards = myRewards;
    window.currentViewingWeekId = roomRewardWeekId;
    
    if (myRewards.length === 0) {
        grid.innerHTML = '<div style="color:#aaa; text-align:center;">上週無可領取獎勵，這週繼續加油！</div>';
        return;
    }
    
    let html = '';
    myRewards.forEach((r, idx) => {
        let isClaimed = r.claimed ? 'claimed' : '';
        let iconHtml = '';
        if (r.medal) iconHtml += `<img src="${r.medal}" style="width:40px; height:40px; margin-right:5px; object-fit:contain;">`;
        if (r.coins) iconHtml += `<span style="color:#d4af37; font-weight:bold; font-size:16px;">💰 ${r.coins}</span>`;
        
        html += `<div class="reward-item ${isClaimed}" id="rew-item-${idx}">
            <div style="display:flex; align-items:center;">${iconHtml}</div>
            <div style="flex:1; margin-left:10px; color:#333; font-weight:bold; font-size:13px; text-align:left;">${r.name}</div>
            <button class="btn-primary reward-neon-btn" style="padding:6px 12px; font-size:14px;" onclick="window.claimWeeklyReward(${idx})">領取</button>
            <div class="reward-claimed-text">已領取</div>
        </div>`;
    });
    grid.innerHTML = html;
};

window.claimWeeklyReward = async function(idx) {
    let r = window.currentViewingRewards[idx];
    if (r.claimed) return;
    
    let uid = window.GameLogic.currentUser.uid;
    r.claimed = true;
    
    let updates = {};
    updates[`users/${uid}/weeklyRewards/${window.currentViewingWeekId}/${idx}/claimed`] = true;
    
    if (r.coins) {
        window.GameLogic.myProfile.coins = (window.GameLogic.myProfile.coins || 0) + r.coins;
        updates[`users/${uid}/coins`] = window.GameLogic.myProfile.coins;
        let coinsEl = document.getElementById("vp-coins"); if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
    }
    
    if (r.medal) {
    const safeSweepCount = Number(window.currentViewingRewardSweepCount || r.sweepCount || 0);
    const safeRecordText = r.recordText || window.currentViewingRewardRecordText || (safeSweepCount > 0 ? `掃了 ${safeSweepCount} 次` : '');

    let newMedal = {
        id: r.id + '_' + Date.now(),
        date: new Date().toLocaleDateString('zh-TW'),
        eventName: '本週掃地王',
        name: r.name,
        icon: r.medal,
        recordText: safeRecordText,
        sweepCount: safeSweepCount
    };
        let currentMedals = window.GameLogic.myProfile.medals || [];
        currentMedals.push(newMedal);
        window.GameLogic.myProfile.medals = currentMedals;
        updates[`users/${uid}/medals`] = currentMedals;
    }
    
    await update(ref(window.GameLogic.db), updates);
if (window.checkPendingWeeklyRewardNotice) window.checkPendingWeeklyRewardNotice();

document.getElementById(`rew-item-${idx}`).classList.add('claimed');
    
    if (window.GameLogic.phaserGame && !window.GameLogic.muteSFX) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms) window.playSFX(ms, 'reward-get-sounds');
    }
    
    let overlay = document.getElementById('reward-congrats-overlay');
    document.getElementById('congrats-text').innerText = `恭喜獲得 ${r.name}！`;
    overlay.style.display = 'block';
    
    let cl = document.getElementById('congrats-confetti-left');
    let cr = document.getElementById('congrats-confetti-right');
    cl.style.animation = 'none'; cr.style.animation = 'none';
    void cl.offsetWidth; void cr.offsetWidth;
    cl.style.animation = 'confetti-burst-left 1s ease-out forwards';
    cr.style.animation = 'confetti-burst-right 1s ease-out forwards';
    
    setTimeout(() => { overlay.style.display = 'none'; }, 2000);
};

window.openMedalList = function() {
    document.getElementById('view-profile-modal').style.display = 'none';
    let medals = window.GameLogic.myProfile.medals || [];
    let grid = document.getElementById('medal-grid');

    if (medals.length === 0) {
        window.currentRenderedMedals = [];
        grid.innerHTML = '<div style="grid-column: span 3; text-align:center; color:#888;">尚未獲得任何戰績勳章</div>';
    } else {
        let html = '';
        window.currentRenderedMedals = medals.slice().reverse();

        window.currentRenderedMedals.forEach((m, idx) => {
            html += `<div class="medal-item" onclick="window.showMedalDetail(${idx})">
                <img src="${m.icon}" style="width:50px; height:50px; object-fit:contain; filter:drop-shadow(0 0 5px var(--mucha-gold));">
                <span style="font-size:10px; color:var(--mucha-brown); font-weight:bold; margin-top:5px;">${m.date}</span>
                ${m.recordText ? `<span style="font-size:10px; color:var(--mucha-green); margin-top:3px;">${m.recordText}</span>` : ''}
            </div>`;
        });
        grid.innerHTML = html;
    }

    document.getElementById('medal-list-modal').style.display = 'block';
};

window.showMedalDetail = function(idx) {
    let rendered = window.currentRenderedMedals || (window.GameLogic.myProfile.medals || []).slice().reverse();
    let m = rendered[idx];
    if (!m) return;

    window.currentShowOffMedal = m;

    document.getElementById('md-event-name').innerText = `${m.eventName || '戰績'} - ${m.name || ''}`;
    document.getElementById('md-icon').src = m.icon;
    document.getElementById('md-date').innerText = `系統派發日期：${m.date || ''}`;
    document.getElementById('md-record').innerText = m.recordText || '';
    document.getElementById('medal-detail-modal').style.display = 'block';
};

window.triggerShowOff = function() {
    let m = window.currentShowOffMedal;
    if (!m) return;

    const medalTitle = [m.eventName, m.name].filter(Boolean).join(' - ');

    window.clearAllModals();
    if (window.GameLogic.phaserGame) {
        let ms = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (ms && ms.startShowOff) ms.startShowOff(m.icon, m.date, medalTitle, m.recordText || '');
    }
};
// ====== 新增邏輯結束 ======
