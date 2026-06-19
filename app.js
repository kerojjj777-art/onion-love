import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, remove, onDisconnect, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC266DIMj81hWMk83GEmqSbBl85VY3tTcE",
  authDomain: "onion-love.firebaseapp.com",
  databaseURL: "https://onion-love-default-rtdb.firebaseio.com",
  projectId: "onion-love",
  storageBucket: "onion-love.firebasestorage.app",
  messagingSenderId: "431036248901",
  appId: "1:431036248901:web:533465a08cfa8410f7c42c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);         

// --- 系統變數 ---
window.GameLogic = {
    currentUser: null,
    currentScene: "doghouse",
    myProfile: { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0, level: 1, exp: 0, coins: 0, sweeps: 0, lastX: 640, lastY: 360, lastScene: "doghouse", currentTrackIdx: 0, inventoryOrder: [] },
    cafePlayers: {},
    onlinePlayers: {}, 
    cafeFurniture: {},
    doghouseFurniture: {},
    unreadPMs: {}, 
    placingFurnitureKey: null, 
    phaserGame: null,
    phaserLoaded: false,
    pendingScene: null,
    db: db,
    armedItemState: null, 
    currentTargetUid: null,
    currentTargetSprite: null,
    currentTargetType: null,
    muteSFX: false,
    currentTrackIdx: 0,
    inventoryEditMode: false
};
let cafeUnsubscribe = null;
let profileViewingUid = null;

window.switchScene = switchScene;
window.showProfileModal = showProfileModal;
window.leaveCafe = leaveCafe;
window.signOut = signOut;
window.auth = auth;

// ==========================================
// 滿版圖片顯示功能
// ==========================================
window.openFullscreen = function(src) {
    if (!src || src.endsWith('null') || src === '') return;
    document.getElementById('fullscreen-img').src = src;
    document.getElementById('fullscreen-viewer').style.display = 'flex';
};
window.closeFullscreen = function() {
    document.getElementById('fullscreen-viewer').style.display = 'none';
};

// ==========================================
// 音樂與音效全域控制
// ==========================================
window.updateBGMVolume = function(val) {
    document.getElementById('bgm-vol-text').innerText = val + '%';
    if (window.GameLogic.phaserGame) {
        let playlist = ['bgm', 'bgm-heart', 'bgm-inside'];
        playlist.forEach(k => {
            let sndList = window.GameLogic.phaserGame.sound.getAll(k);
            sndList.forEach(snd => snd.setVolume(val / 100));
        });
    }
};

window.toggleSFX = function() {
    window.GameLogic.muteSFX = !window.GameLogic.muteSFX;
    let btn = document.getElementById('mute-sfx-btn');
    if (window.GameLogic.muteSFX) {
        btn.innerText = "開啟特殊音效";
        btn.style.backgroundColor = "#ccc";
        btn.style.color = "#333";
    } else {
        btn.innerText = "關閉特殊音效";
        btn.style.backgroundColor = "var(--mucha-green)";
        btn.style.color = "white";
    }
};

window.playSFX = function(scene, key) {
    if (window.GameLogic.muteSFX) return;
    if (scene.sound.get(key)) scene.sound.play(key);
    else scene.sound.add(key).play();
};

window.changeTrack = function(dir) {
    let playlist = [
        { key: 'bgm', title: 'Sweet-Onion', cover: 'Sweet-Onion.png' },
        { key: 'bgm-heart', title: '洋蔥心', cover: 'Onion-Heart.png' },
        { key: 'bgm-inside', title: 'Inside-of-Onion', cover: 'Inside-of-Onion.png' }
    ];
    window.GameLogic.currentTrackIdx = ((window.GameLogic.currentTrackIdx || 0) + dir + playlist.length) % playlist.length;
    let track = playlist[window.GameLogic.currentTrackIdx];

    document.getElementById('music-cover').src = track.cover;
    document.getElementById('music-title').innerText = track.title;

    if (window.GameLogic.currentUser) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), {
                currentTrackIdx: window.GameLogic.currentTrackIdx
            });
        });
    }

    if (window.GameLogic.phaserGame) {
        let volControl = document.getElementById('bgm-volume');
        let vol = volControl ? volControl.value / 100 : 0.5;

        window.GameLogic.phaserGame.sound.removeByKey('bgm');
        window.GameLogic.phaserGame.sound.removeByKey('bgm-heart');
        window.GameLogic.phaserGame.sound.removeByKey('bgm-inside');

        window.GameLogic.phaserGame.sound.add(track.key, { loop: true, volume: vol }).play();
    }
};
window.prevTrack = () => window.changeTrack(-1);
window.nextTrack = () => window.changeTrack(1);

window.closeProfileModal = function() {
    document.getElementById('view-profile-modal').style.display = 'none';
    if (profileViewingUid && profileViewingUid !== window.GameLogic.currentUser.uid) {
        document.getElementById('phone-modal').style.display = 'block';
    }
};

window.openPortalModal = function() {
    document.getElementById('inventory-modal').style.display = 'none';
    document.getElementById('portal-modal').style.display = 'block';
};

// ==========================================
// 動態生成系統 UI 介面
// ==========================================
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
            .modal { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--mucha-paper); padding: 20px; border: 3px solid var(--mucha-gold); border-radius: 12px; z-index: 250; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.8); width: 85%; max-width: 320px; max-height: 80vh; overflow-y: auto; }
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
            .catalog-item { padding: 15px 5px; border: 1px solid var(--mucha-gold); border-radius: 8px; background: #fff; cursor: pointer; font-weight: bold; display: flex; flex-direction: column; align-items: center; transition: all 0.3s; }
            .catalog-item:hover { background: rgba(197, 160, 89, 0.2); }
            .catalog-item img { width: 50px; height: 50px; margin-bottom: 5px; object-fit: contain;}

            #chat-section { display: flex; position: absolute; top: 60px; left: 20px; width: 280px; flex-direction: column; z-index: 100; pointer-events: none; }            
            #chat-toggle-btn { pointer-events: auto; background: var(--mucha-gold); color: white; border: none; border-radius: 4px 4px 0 0; padding: 5px 10px; width: fit-content; cursor: pointer; font-size: 12px; font-weight: bold;}
            #chat-content { pointer-events: auto; transition: max-height 0.3s ease-in-out; overflow: hidden; display: flex; flex-direction: column; }
            #chat-box { max-height: 100px; overflow-y: auto; background: rgba(0, 0, 0, 0.5); color: #fff; padding: 8px; border-radius: 0 8px 0 0; margin-bottom: 5px; font-size: 13px; text-shadow: 1px 1px 2px #000; }            
            #chat-input-area { display: flex; height: 40px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); border-radius: 4px;}
            #chat-input { flex-grow: 1; padding: 8px; border: 2px solid var(--mucha-gold); border-radius: 4px 0 0 4px; background: rgba(244, 236, 216, 0.95); font-family: inherit;}
            #send-btn { padding: 8px 15px; background: var(--mucha-gold); color: white; border: 2px solid var(--mucha-gold); border-radius: 0 4px 4px 0; font-family: inherit; font-weight: bold; cursor: pointer;}
            .chat-collapsed #chat-content { max-height: 0px !important; }
            #top-notification-bar { position: absolute; top: 0; left: 0; width: 100%; padding: 8px 0; background: rgba(0, 0, 0, 0.6); color: #fff; text-align: center; font-size: 14px; z-index: 500; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 2px #000; letter-spacing: 1px; }
       
            #online-players-list { position: absolute; right: 15px; top: 220px; background: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 8px; color: white; display: none; z-index: 100; font-size: 13px; border: 1px solid var(--mucha-gold); pointer-events: none; min-width: 80px; text-shadow: 1px 1px 2px #000; }
            
            .sprite-waterball { width: 50px; height: 50px; background: url('shop-water-ball.png') left center; animation: play-waterball 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-onion-phone { width: 50px; height: 50px; background: url('tool-onion-phone.png') left center; animation: play-onion-phone 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-magic-gap { width: 50px; height: 50px; background: url('magic-gap.png') left center; animation: play-magic-gap 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-music-box { width: 50px; height: 50px; background: url('music-box.png') left center; animation: play-music-box 0.8s steps(8) infinite; margin-bottom: 5px; }
            .sprite-magic-gap-big { width: 300px; height: 300px; background: url('magic-gap-big.png') left center; animation: play-magic-gap-big 0.8s steps(8) infinite; margin: 0 auto; display: block; }
            
            @keyframes play-waterball { 100% { background-position: -400px; } }
            @keyframes play-onion-phone { 100% { background-position: -400px; } }
            @keyframes play-magic-gap { 100% { background-position: -400px; } }
            @keyframes play-music-box { 100% { background-position: -400px; } }
            @keyframes play-magic-gap-big { 100% { background-position: -2400px; } }
            
            @keyframes flash-orange {
                0% { transform: translate(-50%, -50%) scale(1); text-shadow: 0 0 10px orange; opacity: 1; }
                50% { transform: translate(-50%, -50%) scale(1.2); text-shadow: 0 0 30px #ffcc00, 0 0 50px orange; opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); text-shadow: 0 0 10px orange; opacity: 0; }
            }
            .flash-text { animation: flash-orange 2s ease-out forwards; }

            #pm-chat-box { height: 250px; overflow-y: auto; background: #fffdf5; border: 1px solid var(--mucha-gold); border-radius: 4px; padding: 10px; margin-bottom: 10px; display: flex; flex-direction: column; font-size: 14px;}
            .pm-bubble-me { background: #fff; color: #3e2723; border-radius: 12px 12px 0 12px; padding: 8px 12px; display: inline-block; max-width: 80%; text-align: left; border: 1px solid var(--mucha-gold); box-shadow: 1px 1px 3px rgba(0,0,0,0.1); word-break: break-word; }
            .pm-bubble-other { background: #dcedc8; color: #3e2723; border-radius: 12px 12px 12px 0; padding: 8px 12px; display: inline-block; max-width: 80%; text-align: left; border: 1px solid #aed581; box-shadow: 1px 1px 3px rgba(0,0,0,0.1); word-break: break-word; }
        </style>

        <div id="fullscreen-viewer" onclick="window.closeFullscreen()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; justify-content:center; align-items:center; cursor:pointer;">
            <img id="fullscreen-img" style="max-width:90%; max-height:90%; border:3px solid var(--mucha-gold); border-radius:12px; object-fit:contain; background:var(--mucha-paper);">
        </div>

        <div id="ingame-confirm" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--mucha-paper); border:3px solid var(--mucha-gold); padding:20px; z-index:400; border-radius:12px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
            <div style="margin-bottom:15px; color:var(--mucha-brown); font-weight:bold; font-size:16px;">確定要收起裝備嗎？</div>
            <div style="display:flex; justify-content:center; gap:10px;">
                <button class="btn-primary" id="ingame-confirm-yes" style="padding:8px 20px;">確定</button>
                <button class="btn-secondary" id="ingame-confirm-no" style="padding:8px 20px;">取消</button>
            </div>
        </div>
        
        <div id="top-notification-bar">系統通知：歡迎來到洋蔥交誼廳！</div>
        <div id="action-menu" class="action-menu"><button id="view-profile-btn">洋蔥身分證</button></div>
        <div id="online-players-list"></div>
        <div id="purchase-success-msg" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); color:#ffcc00; font-size:48px; z-index:400; font-weight:bold; text-align:center; pointer-events:none; -webkit-text-stroke: 2px #d4af37;">你大撒幣！</div>

        <div id="login-screen">
            <h2 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">入館登記</h2>
            <input type="email" id="user-email" placeholder="信箱 Email"><br>
            <input type="password" id="user-pwd" placeholder="密碼"><br>
            <button id="join-btn">推開洋蔥世界之門</button>
        </div>

        <div id="view-profile-modal" class="modal" style="z-index: 270;">
            <h3 id="vp-title">洋蔥身分證</h3>
            <div class="stats-container">
                <div>等級 <strong id="vp-level" style="color:var(--mucha-green);">1</strong> (EXP: <span id="vp-exp">0</span>)</div>
                <div>💰 <strong id="vp-coins" style="color:#d4af37;">0</strong> 馬德幣</div>
            </div>
            <div class="profile-line"><span>🧹 掃皮王:</span> <strong id="vp-sweeps">0</strong> 次</div>
            
            <div class="profile-line">
                <span>👤 暱稱:</span> 
                <strong id="vp-name"></strong>
                <input type="text" id="edit-name" style="display:none; width:50%;">
            </div>
            <div class="profile-line">
                <span>🎨 代表色:</span> 
                <span id="vp-color" style="display:inline-block; width:20px; height:20px; border-radius:50%; border:2px solid var(--mucha-gold);"></span>
                <input type="color" id="edit-color" style="display:none; width:40px; height:30px; border:none; padding:0; background:none;">
            </div>
            <div class="profile-line"><span>🎂 生日:</span> <strong id="vp-birth"></strong><input type="text" id="edit-birth" style="display:none;"></div>
            <div class="profile-line"><span>🍛 最愛:</span> <strong id="vp-food"></strong><input type="text" id="edit-food" style="display:none;"></div>
            <div class="profile-line" style="flex-direction: column; align-items: flex-start;">
                <span>📜 座右銘:</span>
                <i style="color:var(--mucha-green); font-size: 14px; margin-top:5px; width: 100%; text-align: center;">"<span id="vp-motto"></span>"</i>
                <input type="text" id="edit-motto" style="display:none; width: 95%; margin-top:5px;">
            </div>
            <div class="modal-btns">
                <button id="start-edit-btn" class="btn-edit" style="display:none;">編輯</button>
                <button id="save-edit-btn" class="btn-primary" style="display:none;">儲存</button>
                <button class="close-modal-btn btn-secondary" onclick="window.closeProfileModal()">收起證件</button>
            </div>
        </div>

        <div id="furniture-catalog-modal" class="modal">
            <h3 id="catalog-title">📦 家俱目錄</h3>
            <div id="catalog-list" class="catalog-grid"></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('furniture-catalog-modal').style.display='none'">關閉</button>
        </div>

        <div id="fridge-modal" class="modal">
            <h3>❄️ 公用大冰箱</h3>
            <p style="color:#888; font-size: 14px;">冰箱目前空空如也... 等待下次採買中</p>
            <button class="close-modal-btn btn-primary" onclick="document.getElementById('fridge-modal').style.display='none'">關上冰箱</button>
        </div>

        <div id="memory-modal" class="modal">
            <h3>📖 咖啡廳回憶錄</h3>
            <div id="memory-feed"></div>
            <div id="memory-upload-area">
                <input type="file" id="memory-file" accept="image/*">
                <input type="text" id="memory-text" placeholder="寫下這張照片的回憶筆記...">
                <button class="btn-primary" id="upload-memory-btn">留存回憶</button>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('memory-modal').style.display='none'">闔上回憶錄</button>
        </div>

        <div id="settings-modal" class="modal" style="width: 85%; max-width: 320px; box-sizing: border-box; z-index: 260;">
            <h3 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">🎵 蔥Music</h3>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <button class="btn-secondary" onclick="window.prevTrack()" style="border-radius:50%; width: 35px; height: 35px; padding: 0;">&lt;</button>
                    <img id="music-cover" onclick="window.openFullscreen(this.src)" src="Sweet-Onion.png" alt="Music Cover" style="width: 150px; height: 150px; border-radius: 8px; border: 2px solid var(--mucha-gold); object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor: pointer;">
                    <button class="btn-secondary" onclick="window.nextTrack()" style="border-radius:50%; width: 35px; height: 35px; padding: 0;">&gt;</button>
                </div>
                <div id="music-title" style="font-weight: bold; color: var(--mucha-brown); font-size: 16px;">Sweet-Onion</div>
                
                <div style="width: 100%; margin-top: 10px;">
                    <label style="font-size: 14px; color: var(--mucha-brown); display: flex; justify-content: space-between;">
                        <span>音樂音量</span> <span id="bgm-vol-text">50%</span>
                    </label>
                    <input type="range" id="bgm-volume" min="0" max="100" value="50" style="width: 100%; margin-top: 5px;" oninput="window.updateBGMVolume(this.value)">
                </div>
                
                <button id="mute-sfx-btn" class="btn-primary" style="margin-top: 10px; width: 100%; background-color: var(--mucha-green); border-radius: 25px;" onclick="window.toggleSFX()">關閉特殊音效</button>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px; width: 100%;" onclick="document.getElementById('settings-modal').style.display='none'">關閉播放器</button>
        </div>

        <div id="manual-modal" class="modal" style="width: 90%; max-width: none; height: 90vh; max-height: none; top: 5%; left: 5%; transform: none; box-sizing: border-box; z-index: 260;">
            <h3 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">📖 說明書</h3>
            
            <div id="manual-content" style="display:flex; justify-content:center; align-items:center; height: 60vh; position: relative;">
                <button id="manual-prev-btn" class="btn-secondary" style="position:absolute; left:0; z-index:10; font-size:24px; padding:10px 15px;">&lt;</button>
                <img id="manual-img-display" onclick="window.openFullscreen(this.src)" src="" alt="目前尚無說明書內容" style="max-width:80%; max-height:100%; object-fit:contain; border:1px solid var(--mucha-gold); border-radius:8px; cursor: pointer;">
                <button id="manual-next-btn" class="btn-secondary" style="position:absolute; right:0; z-index:10; font-size:24px; padding:10px 15px;">&gt;</button>
                <div id="manual-page-indicator" style="position:absolute; bottom: -30px; text-align:center; width:100%; font-weight:bold; color:var(--mucha-brown);">0 / 0</div>
            </div>
            
            <div id="manual-admin-area" style="display:none; margin-top: 50px; border-top:2px dashed var(--mucha-gold); padding-top:15px; text-align:center;">
                <input type="file" id="manual-file" accept="image/*" style="margin-bottom: 10px;">
                <br>
                <button class="btn-primary" onclick="window.uploadManualPage()">上傳新頁面</button>
                <button class="btn-danger" onclick="window.deleteManualPage()">刪除此頁</button>
                <div style="margin-top: 10px;">
                    <button class="btn-secondary" onclick="window.moveManualPage(-1)">前移頁面</button>
                    <button class="btn-secondary" onclick="window.moveManualPage(1)">後移頁面</button>
                </div>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 30px; width: 100%;" onclick="document.getElementById('manual-modal').style.display='none'">關閉說明書</button>
        </div>
        
        <div id="portal-modal" class="modal" style="z-index: 260; padding: 15px;">
            <h3 style="margin-top:0; color:var(--mucha-brown);">🌀 空間傳送門</h3>
            <div class="sprite-magic-gap-big" style="margin: 10px auto;"></div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-primary" style="padding:12px; font-size:16px;" onclick="window.switchScene('doghouse'); document.getElementById('portal-modal').style.display='none';">🏠 我的狗窩</button>
                <button class="btn-primary" style="padding:12px; font-size:16px;" onclick="window.switchScene('cafe'); document.getElementById('portal-modal').style.display='none';">☕ 洋蔥大廳</button>
                <button class="btn-primary" style="padding:12px; font-size:16px;" onclick="window.switchScene('farm'); document.getElementById('portal-modal').style.display='none';">🌱 我的蔥田</button>
                <button class="btn-primary" style="padding:12px; font-size:16px;" onclick="window.switchScene('7eonion'); document.getElementById('portal-modal').style.display='none';">🏪 7-EONION</button>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px; width: 100%;" onclick="document.getElementById('portal-modal').style.display='none'">關閉傳送門</button>
        </div>

        <div id="game-layout-container">
            <div id="phaser-app"></div>
            <div id="chat-section">
                <button id="chat-toggle-btn">收起對話 ▲</button>
                <div id="chat-content">
                    <div id="chat-box"></div>
                    <div id="chat-input-area">
                        <input type="text" id="chat-input" placeholder="說點什麼...">
                        <button id="send-btn">發送</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="inventory-modal" class="modal">
            <div id="inventory-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--mucha-gold); padding-bottom: 5px; margin-bottom: 15px;">
                <h3 style="margin:0; border:none; color: var(--mucha-brown);">🎒 我的給西</h3>
                <button id="inventory-edit-btn" class="btn-edit" onclick="window.toggleInventoryEdit()" style="padding:4px 8px; font-size:12px;">編輯排序</button>
            </div>
            <div id="inventory-list" class="catalog-grid" style="max-height: 50vh; overflow-y: auto; padding-right: 5px;"></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('inventory-modal').style.display='none'">關閉</button>
        </div>

        <div id="phone-modal" class="modal">
            <h3 style="color: var(--mucha-green);">📱 洋蔥手機</h3>
            <p style="font-size: 12px; color: #666; margin-top: 0;">點擊聯絡人發送私訊</p>
            <div id="phone-contacts" class="catalog-grid" style="display: flex; flex-direction: column; gap: 5px;"></div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('phone-modal').style.display='none'">收起手機</button>
        </div>

        <div id="pm-modal" class="modal" style="z-index: 260;">
            <h3 id="pm-title" style="color: var(--mucha-green);">私訊</h3>
            <div id="pm-chat-box"></div>
            <div style="display:flex; gap: 5px;">
                <input type="text" id="pm-input" style="flex-grow:1; padding:5px; border: 1px solid var(--mucha-gold); border-radius: 4px;" placeholder="輸入訊息...">
                <button class="btn-primary" onclick="window.sendPM()">發送</button>
            </div>
            <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="window.closePM()">返回聯絡人</button>
        </div>

        <div id="store-modal" class="modal" style="padding:0; overflow:hidden; z-index: 250;">
            <div style="background:#2a1b12; text-align:center; position:relative; border-bottom: 2px solid var(--mucha-gold); padding-top: 45px;">
                <div id="store-manager-bubble" style="position:absolute; top:8px; left:50%; transform:translateX(-50%); background:rgba(244, 236, 216, 0.95); color:#3e2723; padding:8px 12px; border-radius:8px; font-size:14px; border:2px solid var(--mucha-gold); font-weight:bold; white-space:nowrap; z-index:2; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">這顆臭洋蔥打什麼主意啊</div>
                <img src="store-manager-talking.png" style="width:100%; display:block;" alt="老闆">
                <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.8); color:var(--mucha-gold); padding:4px 8px; border-radius:4px; font-size:12px; border:1px solid var(--mucha-gold); font-weight:bold;">德骨拉完叻</div>
            </div>
            <div style="padding:15px;">
                <h3 style="margin-top:0; border:none; color:var(--mucha-brown);">🏪 7-EONION 便利商店</h3>
                <div id="store-list" class="catalog-grid">
                    <div class="catalog-item" onclick="window.openPurchaseModal('水球', 20)">
                        <div class="sprite-waterball"></div>
                        <span style="margin-top:5px;">水球</span>
                        <span style="color:#d4af37; font-size:12px; font-weight:bold;">20 馬德幣</span>
                    </div>
                </div>
                <button class="close-modal-btn btn-secondary" style="margin-top: 15px;" onclick="document.getElementById('store-modal').style.display='none'; window.GameLogic.isShopping = false;">離開商店</button>
            </div>
        </div>

        <div id="purchase-modal" class="modal" style="z-index: 260;">
            <h3 id="purchase-title" style="color:var(--mucha-green);">購買</h3>
            <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin: 15px 0;">
                <button class="btn-secondary" style="font-size:18px; padding:5px 15px;" onclick="window.adjustPurchaseQty(-1)">-</button>
                <span id="purchase-qty" style="font-size:24px; font-weight:bold; color:var(--mucha-brown);">1</span>
                <button class="btn-secondary" style="font-size:18px; padding:5px 15px;" onclick="window.adjustPurchaseQty(1)">+</button>
            </div>
            <div style="margin-bottom:15px; font-size:16px;">總計: <strong id="purchase-total" style="color:#d4af37; font-size:18px;">20</strong> 馬德幣</div>
            <div class="modal-btns">
                <button class="btn-primary" onclick="window.confirmPurchase()">結帳</button>
                <button class="btn-secondary" onclick="document.getElementById('purchase-modal').style.display='none'">取消</button>
            </div>
        </div>
    `;

    // 防點穿優化：為所有互動視窗阻擋 Pointer 事件，避免點擊到後方的 Phaser Canvas 元素
    setTimeout(() => {
        const stopProp = (e) => e.stopPropagation();
        document.querySelectorAll('.modal, .action-menu, #chat-section').forEach(el => {
            ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'mousedown', 'mouseup', 'click'].forEach(evt => {
                el.addEventListener(evt, stopProp, { passive: false });
            });
        });
    }, 500);
}

createSystemUI();

window.manualPages = [];
window.currentManualIndex = 0;

window.openManualModal = function() {
    document.getElementById('manual-modal').style.display = 'block';
    window.currentManualIndex = 0;
    
    if (window.GameLogic.currentUser && (window.GameLogic.currentUser.email === 'kerojjj777@gmail.com' || window.GameLogic.currentUser.email === 'kerojjj777@hotmail.com')) {
        document.getElementById('manual-admin-area').style.display = 'block';
    } else {
        document.getElementById('manual-admin-area').style.display = 'none';
    }
    
    window.renderManualPage();
};

window.renderManualPage = function() {
    const imgEl = document.getElementById('manual-img-display');
    const indEl = document.getElementById('manual-page-indicator');
    
    if (window.manualPages.length === 0) {
        imgEl.src = '';
        imgEl.alt = '目前尚無說明書內容';
        indEl.innerText = '0 / 0';
        return;
    }
    
    if (window.currentManualIndex < 0) window.currentManualIndex = 0;
    if (window.currentManualIndex >= window.manualPages.length) window.currentManualIndex = window.manualPages.length - 1;
    
    let page = window.manualPages[window.currentManualIndex];
    imgEl.src = page.imgBase64;
    indEl.innerText = `${window.currentManualIndex + 1} / ${window.manualPages.length}`;
};

document.getElementById('manual-prev-btn').addEventListener('click', () => {
    if (window.currentManualIndex > 0) { window.currentManualIndex--; window.renderManualPage(); }
});
document.getElementById('manual-next-btn').addEventListener('click', () => {
    if (window.currentManualIndex < window.manualPages.length - 1) { window.currentManualIndex++; window.renderManualPage(); }
});

window.uploadManualPage = function() {
    const fileInput = document.getElementById("manual-file");
    const file = fileInput.files[0];
    if (!file) return alert("請選擇圖片檔案！");
    
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const cvs = document.createElement('canvas'); 
            let w = img.width, h = img.height;
            if (w > 1200) { h *= 1200 / w; w = 1200; } 
            cvs.width = w; cvs.height = h;
            cvs.getContext('2d').drawImage(img, 0, 0, w, h);
            
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                module.push(module.ref(window.GameLogic.db, 'manuals'), {
                    imgBase64: cvs.toDataURL('image/jpeg', 0.8),
                    timestamp: Date.now()
                }).then(() => {
                    alert('上傳成功！');
                    fileInput.value = "";
                });
            });
        }; 
        img.src = e.target.result;
    }; 
    reader.readAsDataURL(file);
};

window.deleteManualPage = function() {
    if (window.manualPages.length === 0) return;
    if (confirm("確定要刪除當前顯示的說明書頁面嗎？")) {
        let pageKey = window.manualPages[window.currentManualIndex].key;
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.remove(module.ref(window.GameLogic.db, `manuals/${pageKey}`)).then(() => {
                alert('已刪除！');
                window.currentManualIndex = 0; 
            });
        });
    }
};

window.moveManualPage = function(dir) {
    if (window.manualPages.length < 2) return;
    let idx1 = window.currentManualIndex;
    let idx2 = idx1 + dir;
    if (idx2 < 0 || idx2 >= window.manualPages.length) return;
    
    let p1 = window.manualPages[idx1];
    let p2 = window.manualPages[idx2];
    
    let tempTime = p1.timestamp;
    p1.timestamp = p2.timestamp;
    p2.timestamp = tempTime;
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        let updates = {};
        updates[`manuals/${p1.key}/timestamp`] = p1.timestamp;
        updates[`manuals/${p2.key}/timestamp`] = p2.timestamp;
        module.update(module.ref(window.GameLogic.db), updates).then(() => {
            window.currentManualIndex = idx2;
        });
    });
};

window.updateUnreadGlow = function() {
    if (!window.GameLogic.phaserGame) return;
    const uiScene = window.GameLogic.phaserGame.scene.getScene('UIScene');
    if (!uiScene || !uiScene.itemBtn) return;
    
    const hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0;
    if (hasUnread) {
        if (!uiScene.itemGlowTween) {
            uiScene.itemGlowTween = uiScene.tweens.add({
                targets: uiScene.itemBtn,
                scaleX: 1.1, scaleY: 1.1,
                yoyo: true, repeat: -1, duration: 600
            });
        }
        uiScene.itemBtn.setStrokeStyle(4, 0xff0000);
    } else {
        if (uiScene.itemGlowTween) {
            uiScene.itemGlowTween.stop();
            uiScene.itemGlowTween = null;
            uiScene.itemBtn.setScale(1);
        }
        uiScene.itemBtn.setStrokeStyle(3, 0xc5a059);
    }
};

window.updateOnlinePlayersUI = function() {
    const listEl = document.getElementById('online-players-list');
    if (!listEl) return;
    listEl.style.display = 'block';
    let html = '<div style="color:var(--mucha-gold); font-weight:bold; margin-bottom:5px; text-align:center; border-bottom: 1px solid var(--mucha-gold); padding-bottom: 3px;">誰在線上</div>';
    let players = window.GameLogic.onlinePlayers || {};
    for (let uid in players) {
        let p = players[uid];
        html += `<div style="margin-top:5px; display:flex; align-items:center;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${p.color || '#fff'}; margin-right:8px; border:1px solid #000;"></span>${p.name || '匿名'}</div>`;
    }
    listEl.innerHTML = html;
};

window.currentPurchaseItem = null;
window.currentPurchasePrice = 0;
window.currentPurchaseQty = 1;

window.useItem = function(itemName) {
    let inv = window.GameLogic.myProfile.inventory || {};
    if (inv[itemName] && inv[itemName] > 0) {
        if (itemName === '水球') {
            window.GameLogic.armedItemState = 'armed'; 
            document.getElementById('inventory-modal').style.display = 'none'; 
            return; 
        }
        inv[itemName] -= 1; 
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv });
        });
        alert(`你成功使用了 ${itemName}！`);
        window.openInventoryModal();
    }
};

window.stopUsingItem = function(itemName) {
    if (itemName === '水球') {
        window.GameLogic.armedItemState = null;
    }
};

window.toggleInventoryEdit = function() {
    window.GameLogic.inventoryEditMode = !window.GameLogic.inventoryEditMode;
    let btn = document.getElementById('inventory-edit-btn');
    if (btn) {
        btn.innerText = window.GameLogic.inventoryEditMode ? '完成' : '編輯排序';
        btn.className = window.GameLogic.inventoryEditMode ? 'btn-primary' : 'btn-edit';
    }
    window.openInventoryModal();
};

window.moveInvItem = function(index, dir) {
    let order = window.GameLogic.myProfile.inventoryOrder || [];
    if (index + dir >= 0 && index + dir < order.length) {
        let temp = order[index];
        order[index] = order[index + dir];
        order[index + dir] = temp;
        window.GameLogic.myProfile.inventoryOrder = order;
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventoryOrder: order });
        });
        window.openInventoryModal();
    }
};

window.openInventoryModal = function() {
    const list = document.getElementById('inventory-list');
    let hasUnread = Object.keys(window.GameLogic.unreadPMs || {}).length > 0;
    let dotHtml = hasUnread ? '<div style="position:absolute; top:5px; right:5px; width:12px; height:12px; background:red; border-radius:50%; box-shadow:0 0 5px red; z-index:10;"></div>' : '';
    
    let rawItems = {};
    let isEdit = window.GameLogic.inventoryEditMode;

    let inv = window.GameLogic.myProfile.inventory || {};
    let sysKeys = ['phone', 'portal', 'profile', 'music', 'manual', 'logout'];
    let keys = Object.keys(inv).filter(k => inv[k] > 0 && k !== '假人洋蔥' && !sysKeys.includes(k));
    
    keys.forEach(k => {
        let iconHtml = (k === '水球') ? '<div class="sprite-waterball"></div>' : '<span style="font-size:24px; margin-bottom:5px;">📦</span>';
        let isUsing = (k === '水球' && window.GameLogic.armedItemState != null);
        let itemClass = isUsing ? 'catalog-item item-in-use' : 'catalog-item';
        let btnHtml = isUsing 
            ? `<span style="font-size:12px; color:#d9534f; font-weight:bold; margin-top:5px;">[點擊暫停]</span>`
            : `<span style="font-size:12px; color:var(--mucha-green); font-weight:bold; margin-top:5px;">[點擊使用]</span>`;
        let onclickStr = isUsing ? `window.stopUsingItem('${k}')` : `window.useItem('${k}')`;
        
        rawItems[k] = `
            <div class="${itemClass}" style="width: 100%; box-sizing: border-box;" ${!isEdit ? `onclick="${onclickStr}"` : ''}>
                ${iconHtml}
                <span style="margin:5px 0;">${k} x${inv[k]}</span>
                ${!isEdit ? btnHtml : ''}
            </div>`;
    });
    
    // 確保系統按鈕絕對正確載入
    rawItems['phone'] = `
        <div class="catalog-item" style="position:relative; width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.openPhoneModal()"' : ''} >
            ${dotHtml}
            <div class="sprite-onion-phone"></div>
            <span style="margin:5px 0;">洋蔥手機</span>
        </div>
    `;
    rawItems['portal'] = `
        <div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.openPortalModal()"' : ''}>
            <div class="sprite-magic-gap"></div>
            <span style="margin:5px 0;">傳送門</span>
        </div>
    `;
    rawItems['profile'] = `
        <div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); document.getElementById(\'inventory-modal\').style.display=\'none\';"' : ''}>
            <span style="font-size:32px; margin-bottom:5px; height:50px; display:flex; align-items:center; justify-content:center;">🆔</span>
            <span style="margin:5px 0;">洋蔥身分證</span>
        </div>
    `;
    rawItems['music'] = `
        <div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="document.getElementById(\'settings-modal\').style.display=\'block\'; document.getElementById(\'inventory-modal\').style.display=\'none\';"' : ''}>
            <div class="sprite-music-box"></div>
            <span style="margin:5px 0;">蔥Music</span>
        </div>
    `;
    rawItems['manual'] = `
        <div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.openManualModal(); document.getElementById(\'inventory-modal\').style.display=\'none\';"' : ''}>
            <span style="font-size:32px; margin-bottom:5px; height:50px; display:flex; align-items:center; justify-content:center;">📖</span>
            <span style="margin:5px 0;">說明書</span>
        </div>
    `;
    rawItems['logout'] = `
        <div class="catalog-item" style="width: 100%; box-sizing: border-box;" ${!isEdit ? 'onclick="window.leaveCafe(); if (window.GameLogic.currentUser) { import(\'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js\').then(module => { module.remove(module.ref(window.GameLogic.db, \'onlinePlayers/\' + window.GameLogic.currentUser.uid)); }); } window.signOut(window.auth); document.getElementById(\'inventory-modal\').style.display=\'none\';"' : ''}>
            <span style="font-size:32px; margin-bottom:5px; height:50px; display:flex; align-items:center; justify-content:center;">🚪</span>
            <span style="margin:5px 0;">登出大廳</span>
        </div>
    `;

    let activeKeys = Object.keys(rawItems);
    
    // 增添防呆機制：確保 order 一定是陣列並且清除非字串的垃圾資料，避免出錯中斷渲染
    let order = Array.isArray(window.GameLogic.myProfile.inventoryOrder) ? window.GameLogic.myProfile.inventoryOrder.filter(k => k && typeof k === 'string') : [];
    let finalOrder = order.filter(k => activeKeys.includes(k));
    
    activeKeys.forEach(k => {
        if (!finalOrder.includes(k)) finalOrder.push(k);
    });
    window.GameLogic.myProfile.inventoryOrder = finalOrder;

    let invHTML = '';
    finalOrder.forEach((k, i) => {
        let inner = rawItems[k];
        if (window.GameLogic.inventoryEditMode) {
            invHTML += `<div style="display:flex; flex-direction:column; align-items:center; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 8px;">
                            ${inner}
                            <div style="display:flex; justify-content:space-around; width:100%; margin-top:5px;">
                                <button class="btn-secondary" style="padding:2px 10px;" onclick="window.moveInvItem(${i}, -1)" ${i === 0 ? 'disabled' : ''}>◀</button>
                                <button class="btn-secondary" style="padding:2px 10px;" onclick="window.moveInvItem(${i}, 1)" ${i === finalOrder.length - 1 ? 'disabled' : ''}>▶</button>
                            </div>
                        </div>`;
        } else {
            invHTML += inner;
        }
    });

    // 強制寫入滾動屬性，解決介面項目無法全部顯示的 Bug
    list.style.display = 'grid';
    list.style.gridTemplateColumns = '1fr 1fr';
    list.style.gap = '10px';
    list.style.maxHeight = '60vh'; 
    list.style.overflowY = 'auto';
    list.style.padding = '5px';
    list.style.alignItems = 'start'; 

    list.innerHTML = invHTML;
    document.getElementById('inventory-modal').style.display = 'block';
};

window.currentPMUid = null;
window.pmUnsubscribe = null;

window.viewOtherProfile = function(uid) {
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.get(module.ref(window.GameLogic.db, `users/${uid}`)).then(snap => {
            if (snap.exists()) {
                document.getElementById('phone-modal').style.display = 'none';
                showProfileModal(snap.val(), uid);
            }
        });
    });
};

window.openPhoneModal = function() {
    document.getElementById('inventory-modal').style.display = 'none';
    document.getElementById('phone-modal').style.display = 'block';
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.get(module.ref(window.GameLogic.db, 'users')).then(snap => {
            let users = snap.val() || {};
            let html = '';
            for (let uid in users) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let u = users[uid];
                let unreadDot = (window.GameLogic.unreadPMs && window.GameLogic.unreadPMs[uid]) ? ' <span style="color:red; font-size:10px;">🔴</span>' : '';
                html += `
                    <div class="catalog-item" style="flex-direction:row; justify-content:space-between; padding: 10px;">
                        <span style="font-weight:bold; color: ${u.color || '#000'}">${u.name || '匿名'} (Lv.${u.level || 1})${unreadDot}</span>
                        <div>
                            <button class="btn-secondary" style="padding: 4px 12px; font-size:12px; margin-right: 5px;" onclick="window.viewOtherProfile('${uid}')">查看</button>
                            <button class="btn-primary" style="padding: 4px 12px; font-size:12px;" onclick="window.openPM('${uid}', '${u.name || '匿名'}')">私訊</button>
                        </div>
                    </div>
                `;
            }
            if (html === '') html = '<div style="text-align:center; color:#888;">目前沒有其他聯絡人</div>';
            document.getElementById('phone-contacts').innerHTML = html;
        });
    });
};

window.openPM = function(targetUid, targetName) {
    document.getElementById('phone-modal').style.display = 'none';
    document.getElementById('pm-modal').style.display = 'block';
    document.getElementById('pm-title').innerText = `💬 與 ${targetName} 密語`;
    window.currentPMUid = targetUid;
    
    let myUid = window.GameLogic.currentUser.uid;
    let chatId = [myUid, targetUid].sort().join('_');

    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.remove(module.ref(window.GameLogic.db, `users/${myUid}/unreadPMs/${targetUid}`));
    });
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        if (window.pmUnsubscribe) window.pmUnsubscribe();
        window.pmUnsubscribe = module.onValue(module.ref(window.GameLogic.db, `privateChats/${chatId}`), snap => {
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
    });
};

window.closePM = function() {
    if (window.pmUnsubscribe) { window.pmUnsubscribe(); window.pmUnsubscribe = null; }
    document.getElementById('pm-modal').style.display = 'none';
    document.getElementById('phone-modal').style.display = 'block';
};

window.sendPM = function() {
    let input = document.getElementById('pm-input');
    let msg = input.value.trim();
    if (!msg || !window.currentPMUid) return;
    
    let myUid = window.GameLogic.currentUser.uid;
    let chatId = [myUid, window.currentPMUid].sort().join('_');
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
        module.push(module.ref(window.GameLogic.db, `privateChats/${chatId}`), {
            uid: myUid,
            name: window.GameLogic.myProfile.name,
            msg: msg,
            time: Date.now()
        });
        module.update(module.ref(window.GameLogic.db, `users/${window.currentPMUid}/unreadPMs`), { [myUid]: true });
    });
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
    document.getElementById('purchase-qty').innerText = window.currentPurchaseQty;
    document.getElementById('purchase-total').innerText = window.currentPurchasePrice;
    document.getElementById('purchase-modal').style.display = 'block';
};

window.adjustPurchaseQty = function(delta) {
    let maxQty = Math.floor((window.GameLogic.myProfile.coins || 0) / window.currentPurchasePrice);
    let newQty = window.currentPurchaseQty + delta;
    if (newQty >= 1 && newQty <= maxQty) {
        window.currentPurchaseQty = newQty;
        document.getElementById('purchase-qty').innerText = window.currentPurchaseQty;
        document.getElementById('purchase-total').innerText = window.currentPurchaseQty * window.currentPurchasePrice;
    }
};

window.confirmPurchase = function() {
    let cost = window.currentPurchaseQty * window.currentPurchasePrice;
    if ((window.GameLogic.myProfile.coins || 0) >= cost) {
        window.GameLogic.myProfile.coins -= cost;
        
        window.GameLogic.myProfile.inventory = window.GameLogic.myProfile.inventory || {};
        window.GameLogic.myProfile.inventory[window.currentPurchaseItem] = (window.GameLogic.myProfile.inventory[window.currentPurchaseItem] || 0) + window.currentPurchaseQty;
        
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
            module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
                coins: window.GameLogic.myProfile.coins,
                inventory: window.GameLogic.myProfile.inventory
            });
        });
        
        document.getElementById('purchase-modal').style.display = 'none';
        
        let msgEl = document.getElementById('purchase-success-msg');
        msgEl.style.display = 'block';
        msgEl.classList.remove('flash-text');
        void msgEl.offsetWidth; 
        msgEl.classList.add('flash-text');
        setTimeout(() => { msgEl.style.display = 'none'; }, 2000);

        let smBubble = document.getElementById('store-manager-bubble');
        if (smBubble) {
            smBubble.innerText = "懂買的都是好蔥！";
            setTimeout(() => { smBubble.innerText = "這顆臭洋蔥打什麼主意啊"; }, 3000);
        }
        
        let coinsEl = document.getElementById("vp-coins");
        if (coinsEl) coinsEl.innerText = window.GameLogic.myProfile.coins;
    }
};

const loginScreen = document.getElementById("login-screen");
const gameLayoutContainer = document.getElementById("game-layout-container");
const chatSection = document.getElementById("chat-section");
const actionMenu = document.getElementById("action-menu");
const viewProfileModal = document.getElementById("view-profile-modal");
const chatInput = document.getElementById("chat-input");

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{}); 
}

window.addEventListener('pointerdown', (e) => {
    // 隱藏互動選單
    if (!e.target.closest('#action-menu') && e.target.tagName !== 'CANVAS') {
        actionMenu.style.display = 'none';
    }
    
    // 點擊 Canvas 背景時，關閉所有的 Modal 視窗（達成點外側取消功能）
    if (e.target.tagName === 'CANVAS') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        window.GameLogic.isShopping = false;
    }
});

document.getElementById('chat-toggle-btn').addEventListener('click', function() {
    chatSection.classList.toggle('chat-collapsed');
    this.innerText = chatSection.classList.contains('chat-collapsed') ? '展開對話 ▼' : '收起對話 ▲';
    if (!chatSection.classList.contains('chat-collapsed')) {
        const chatBox = document.getElementById("chat-box");
        chatBox.scrollTop = 0; 
    }
});

document.getElementById("join-btn").addEventListener("click", () => {
    const email = document.getElementById("user-email").value;
    const pwd = document.getElementById("user-pwd").value;
    signInWithEmailAndPassword(auth, email, pwd).catch(error => alert("登入失敗: " + error.message));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.GameLogic.currentUser = user;
        loginScreen.style.display = "none";
        gameLayoutContainer.style.display = "block";
        
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) {
            window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...profileSnap.val() };
            window.GameLogic.currentTrackIdx = window.GameLogic.myProfile.currentTrackIdx || 0;
            
            let playlist = [
                { key: 'bgm', title: 'Sweet-Onion', cover: 'Sweet-Onion.png' },
                { key: 'bgm-heart', title: '洋蔥心', cover: 'Onion-Heart.png' },
                { key: 'bgm-inside', title: 'Inside-of-Onion', cover: 'Inside-of-Onion.png' }
            ];
            let track = playlist[window.GameLogic.currentTrackIdx];
            let coverEl = document.getElementById('music-cover');
            let titleEl = document.getElementById('music-title');
            if (coverEl) coverEl.src = track.cover;
            if (titleEl) titleEl.innerText = track.title;
        } else {
            set(ref(db, `users/${user.uid}`), window.GameLogic.myProfile);
        }

        // ==========================================
        // 連線狀態丟失修復：監聽 Firebase .info/connected
        // 確保玩家因為短暫斷線引發 onDisconnect 被剔除後，還能自動補回在線清單
        // ==========================================
        onValue(ref(db, '.info/connected'), (snap) => {
            if (snap.val() === true && window.GameLogic.currentUser) {
                const globalPlayerRef = ref(db, `onlinePlayers/${window.GameLogic.currentUser.uid}`);
                set(globalPlayerRef, {
                    name: window.GameLogic.myProfile.name || '匿名',
                    color: window.GameLogic.myProfile.color || '#fff'
                });
                onDisconnect(globalPlayerRef).remove();

                if (window.GameLogic.currentScene === 'cafe') {
                    const cafeRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`);
                    set(cafeRef, {
                        x: window.GameLogic.myProfile.lastX || 1024,
                        y: window.GameLogic.myProfile.lastY || 1024,
                        name: window.GameLogic.myProfile.name,
                        color: window.GameLogic.myProfile.color,
                        level: window.GameLogic.myProfile.level || 1,
                        bubbleMsg: window.GameLogic.myProfile.bubbleMsg || "",
                        bubbleTime: window.GameLogic.myProfile.bubbleTime || 0
                    });
                    onDisconnect(cafeRef).remove();
                }
            }
        });
        
        onValue(ref(db, 'onlinePlayers'), (snapshot) => {
            window.GameLogic.onlinePlayers = snapshot.val() || {};
            window.updateOnlinePlayersUI();
        });

        onValue(ref(db, `users/${user.uid}/unreadPMs`), snap => {
            window.GameLogic.unreadPMs = snap.val() || {};
            window.updateUnreadGlow();
            if (document.getElementById('inventory-modal').style.display === 'block') {
                window.openInventoryModal(); 
            }
        });

        onValue(ref(db, 'manuals'), snap => {
            const data = snap.val();
            window.manualPages = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    window.manualPages.push({ key: key, imgBase64: data[key].imgBase64, timestamp: data[key].timestamp });
                });
                // 確保按照時間戳進行正確排序
                window.manualPages.sort((a, b) => a.timestamp - b.timestamp);
            }
            window.renderManualPage();
        });

        onValue(ref(db, 'cafeFurniture'), snap => window.GameLogic.cafeFurniture = snap.val() || {});

        onValue(ref(db, 'serverEvents/teleport'), snap => {
            let data = snap.val();
            if (data && data.target === 'shrine' && (Date.now() - data.time < 5000)) {
                if (window.GameLogic.currentScene === 'cafe') {
                    switchScene('shrine');
                }
            }
        });

        if (!window.GameLogic.phaserGame) {
            window.GameLogic.pendingScene = window.GameLogic.myProfile.lastScene || "doghouse";
            initPhaser();
        } else {
            switchScene(window.GameLogic.myProfile.lastScene || "doghouse");
        }

        listenToChat();
        listenToMemories();
    } else {
        window.GameLogic.currentUser = null;
        loginScreen.style.display = "block";
        gameLayoutContainer.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe();
        window.updateOnlinePlayersUI();
    }
});

function switchScene(sceneName) {
    const doSwitch = () => {
        window.GameLogic.currentScene = sceneName;
        window.GameLogic.placingFurnitureKey = null; 
        
        if (sceneName === "doghouse" || sceneName === "farm" || sceneName === "shrine" || sceneName === "7eonion") {
            leaveCafe();
        } else if (sceneName === "cafe") {
            joinCafe();
        }
        
        window.updateOnlinePlayersUI();

        if (window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) {
            const game = window.GameLogic.phaserGame;
            game.scene.stop('MainScene');
            game.scene.start('MainScene'); 
            game.scene.bringToTop('UIScene');
        }
    };

    if (window.GameLogic.currentUser && window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) {
        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (scene && scene.localPlayer) {
            update(ref(db, `users/${window.GameLogic.currentUser.uid}`), {
                lastScene: sceneName, lastX: scene.localPlayer.sprite.x, lastY: scene.localPlayer.sprite.y
            });
            window.GameLogic.myProfile.lastScene = sceneName;
            window.GameLogic.myProfile.lastX = scene.localPlayer.sprite.x;
            window.GameLogic.myProfile.lastY = scene.localPlayer.sprite.y;

            let cam = scene.cameras.main;
            let tvBg = scene.add.rectangle(cam.width/2, cam.height/2, cam.width, cam.height, 0x000000).setDepth(9998).setScrollFactor(0);
            let tvLine = scene.add.rectangle(cam.width/2, cam.height/2, cam.width, cam.height, 0xffffff).setDepth(9999).setScrollFactor(0);

            scene.tweens.add({
                targets: tvLine,
                scaleY: 0.01,
                duration: 150,
                ease: 'Power2',
                onComplete: () => {
                    scene.tweens.add({
                        targets: tvLine,
                        scaleX: 0,
                        duration: 150,
                        onComplete: () => {
                            tvLine.destroy();
                            doSwitch();
                        }
                    });
                }
            });
            return; 
        }
    }
    doSwitch();
}

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`);
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
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => {
        window.GameLogic.cafePlayers = snapshot.val() || {};
    });
}

function leaveCafe() {
    if (window.GameLogic.currentUser) set(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), null);
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

function gainRewards(coins, exp) {
    let p = window.GameLogic.myProfile;
    p.coins = (p.coins || 0) + coins;
    p.exp = (p.exp || 0) + exp;
    p.sweeps = (p.sweeps || 0) + 1;
    
    let requiredExp = p.level * 100;
    let leveledUp = false;
    if (p.exp >= requiredExp) {
        p.level++;
        p.exp -= requiredExp;
        leveledUp = true;
    }
    
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins, exp: p.exp, level: p.level, sweeps: p.sweeps });
    return leveledUp;
}

// ==========================================
// 2. Phaser 3 引擎架構
// ==========================================
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/gh/rexrainbow/phaser3-rex-notes@master/dist/rexvirtualjoystickplugin.min.js', true);
        
        this.load.image('bgCafe', 'cafe-bg.jpg');
        this.load.image('bgDoghouse', 'doghouse-bg.jpg');
        this.load.image('bgFarm', 'farm-bg.jpg');
        this.load.image('bgShrine', 'shrine-bg.jpg'); 
        this.load.image('fridge', 'fridge.png');
        this.load.image('memory', 'memory.png');
        this.load.image('shrine', 'shrine.png'); 
        this.load.image('doghouse-bed', 'doghouse-bed.png'); 
        this.load.spritesheet('onion-skin', 'onion-skin-sprite.png', { frameWidth: 50, frameHeight: 50 });
        this.load.spritesheet('onion-skin-old', 'onion-skin-old-sprite.png', { frameWidth: 65, frameHeight: 65 });
        this.load.image('onion', 'onion-sprite.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-down', 'onion-down.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-up', 'onion-up.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-walk', 'onion-right.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-idle', 'onion-idle.png', { frameWidth: 75, frameHeight: 75 });
        this.load.audio('bgm', 'Sweet-Onion.mp3');
        this.load.audio('bgm-heart', 'Onion-Heart.mp3');
        this.load.audio('bgm-inside', 'Inside-of-Onion.mp3');
        this.load.spritesheet('onion-clean', 'onion-clean.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-sleep', 'onion-sleeping.png', { frameWidth: 75, frameHeight: 75 });
        this.load.image('bg7Eonion', '7eonion-bg.jpg'); 
        this.load.image('storeManager', 'store-manager.png');
        this.load.spritesheet('onion-throw', 'onion-throw.png', { frameWidth: 90, frameHeight: 75 });
        this.load.spritesheet('water-ball-blast', 'water-ball-blast.png', { frameWidth: 50, frameHeight: 50 });
        this.load.spritesheet('onion-wet', 'onion-wet.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('made-coin', 'made-coin.png', { frameWidth: 50, frameHeight: 50 });
        this.load.image('dummy', 'dummy.png');
        this.load.spritesheet('dummy-wet', 'dummy-wet.png', { frameWidth: 75, frameHeight: 75 });

        // 載入慕夏風角色狀態基底圖
        this.load.image('status-bg', 'character-status-bg.png');

        this.load.audio('minimum_laser', 'minimum_laser.mp3');
        this.load.audio('powerdown07', 'powerdown07.mp3');
        this.load.audio('coin03', 'coin03.mp3');
        this.load.audio('brooming1', 'brooming1.mp3');
        this.load.audio('chorus_of_angels1', 'chorus_of_angels1.mp3');
    }
    create() {
        // --- 產生經驗值條的流動紋理 ---
        let expGr = this.make.graphics({ x:0, y:0, add:false });
        expGr.fillStyle(0x81c784, 1);
        expGr.fillRect(0, 0, 64, 16);
        expGr.fillStyle(0xa5d6a7, 0.6);
        for(let i = -16; i < 64; i += 16) {
            expGr.beginPath();
            expGr.moveTo(i, 0);
            expGr.lineTo(i + 8, 0);
            expGr.lineTo(i + 16, 16);
            expGr.lineTo(i + 8, 16);
            expGr.closePath();
            expGr.fillPath();
        }
        expGr.generateTexture('exp-liquid', 64, 16);
        // ------------------------------

        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('onion-down'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('onion-up'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('onion-walk', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('onion-idle'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'skin-anim', frames: this.anims.generateFrameNumbers('onion-skin', { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
        this.anims.create({ key: 'skin-old-anim', frames: this.anims.generateFrameNumbers('onion-skin-old', { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
        this.anims.create({ key: 'clean', frames: this.anims.generateFrameNumbers('onion-clean'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'throw', frames: this.anims.generateFrameNumbers('onion-throw'), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'wb-blast', frames: this.anims.generateFrameNumbers('water-ball-blast'), frameRate: 15, repeat: -1 });
        this.anims.create({ key: 'wet', frames: this.anims.generateFrameNumbers('onion-wet'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'coin-anim', frames: this.anims.generateFrameNumbers('made-coin'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'dummy-hit', frames: this.anims.generateFrameNumbers('dummy-wet'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'sleep', frames: this.anims.generateFrameNumbers('onion-sleep'), frameRate: 8, repeat: -1 });
      
        this.scene.launch('UIScene');
        this.scene.bringToTop('UIScene'); 
        
        window.GameLogic.phaserLoaded = true;
        if (window.GameLogic.pendingScene) {
            window.switchScene(window.GameLogic.pendingScene);
            window.GameLogic.pendingScene = null;
        }
    }
}

class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }
    create() {
        // --- 慕夏風角色狀態圖層 ---
        this.statusContainer = this.add.container(0, 0).setDepth(-2);
        this.statusBg = this.add.image(0, 0, 'status-bg').setOrigin(0, 1);
        
        // 洋蔥頭人像
        this.portrait = this.add.sprite(0, 0, 'onion', 0);
        
        // 顯示暱稱與等級
        this.nameLevelText = this.add.text(0, 0, '初心者 Lv.1', { 
            fontSize: '14px', 
            color: '#3e2723', 
            fontStyle: 'bold', 
            fontFamily: 'Georgia' 
        }).setOrigin(0.5);

        // 新增經驗值框與動態填滿條
        this.expBarBg = this.add.graphics();
        this.expLiquid = this.add.tileSprite(0, 0, 100, 16, 'exp-liquid').setOrigin(0, 0.5);
        this.expText = this.add.text(0, 0, '0/100', { 
            fontSize: '10px', 
            color: '#ffffff', 
            fontStyle: 'bold', 
            fontFamily: 'Georgia' 
        }).setOrigin(0.5);

        // 狀態欄文字
        this.statusText = this.add.text(0, 0, '沒怎樣', { 
            fontSize: '15px', 
            color: '#3e2723', 
            fontStyle: 'bold', 
            fontFamily: 'Georgia' 
        }).setOrigin(0.5);
        
        // 裝備欄文字
        this.equipText = this.add.text(0, 0, '沒東西', { 
            fontSize: '15px', 
            color: '#3e2723', 
            fontStyle: 'bold', 
            fontFamily: 'Georgia' 
        }).setOrigin(0.5).setInteractive();

        // 收合切換按鈕 (洋蔥)
        this.statusToggleBtn = this.add.text(0, 0, '🧅', { fontSize: '24px' }).setOrigin(0, 0.5).setInteractive();
        this.isStatusCollapsed = false;

        // 動畫 Tween 變數
        this.equipBlinkTween = null;
        this.statusBlinkTween = null;

        // 點擊裝備欄位取消裝備功能
        this.equipText.on('pointerdown', () => {
            if (window.GameLogic.armedItemState === 'armed' || window.GameLogic.armedItemState === 'ready') {
                const confModal = document.getElementById('ingame-confirm');
                confModal.style.display = 'block';
                document.getElementById('ingame-confirm-yes').onclick = () => {
                    confModal.style.display = 'none';
                    window.stopUsingItem('水球');
                };
                document.getElementById('ingame-confirm-no').onclick = () => {
                    confModal.style.display = 'none';
                };
            }
        });

        // 狀態欄收合功能
        this.statusToggleBtn.on('pointerdown', () => {
            this.isStatusCollapsed = !this.isStatusCollapsed;
            
            const gameSize = this.scale.gameSize;
            const targetWidth = Math.min(gameSize.width * 0.45, 320);
            const bgW = this.statusBg.displayWidth;
            const statusX = 20;
            const targetX = this.isStatusCollapsed ? statusX - bgW + 10 : statusX;
            
            this.tweens.add({
                targets: this.statusContainer,
                x: targetX,
                duration: 300,
                ease: 'Power2'
            });
        });

        // 將所有元件加入 Container
        this.statusContainer.add([
            this.statusBg, 
            this.portrait, 
            this.nameLevelText, 
            this.expBarBg, 
            this.expLiquid, 
            this.expText, 
            this.statusText, 
            this.equipText, 
            this.statusToggleBtn
        ]);
        // -----------------------------------------------------

        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            radius: 40,
            base: this.add.circle(0, 0, 40, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059),
            thumb: this.add.circle(0, 0, 20, 0xc5a059, 0.8)
        });

        // 按鈕大小全面統一為半徑 30
        this.btnA = this.add.circle(0, 0, 30, 0xd9534f).setStrokeStyle(3, 0xffffff).setInteractive();
        this.txtA = this.add.text(0, 0, 'A', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.btnB = this.add.circle(0, 0, 30, 0x0077cc).setStrokeStyle(3, 0xffffff).setInteractive();
        this.txtB = this.add.text(0, 0, 'B', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.furnBtn = this.add.circle(0, 0, 30, 0x8b5a2b).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.furnText = this.add.text(0, 0, '家俱', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.itemBtn = this.add.circle(0, 0, 30, 0x607d8b).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.itemText = this.add.text(0, 0, '給西', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        this.itemBtn.on('pointerdown', () => {
            window.openInventoryModal();
        });
        
        this.furnBtn.on('pointerdown', () => {
            if (this.furnText.text === '農具') return alert("農具選單尚未開放！");
            openFurnitureCatalog();
        });

        this.aPressTime = 0;
        this.btnA.on('pointerdown', () => { this.btnA.setFillStyle(0xb52b27); this.aPressTime = Date.now(); });
        this.btnA.on('pointerup', () => { 
            this.btnA.setFillStyle(0xd9534f);
            let duration = Date.now() - this.aPressTime;
            const mainScene = this.scene.manager.getScene('MainScene');
            if(mainScene) {
                if (window.GameLogic.placingFurnitureKey) mainScene.events.emit('action_A_place');
                else if (duration > 500) mainScene.events.emit('action_A_long');
                else mainScene.events.emit('action_A_short');
            }
        });
        
        this.btnB.on('pointerdown', () => { 
            this.btnB.setFillStyle(0x005599);
            const mainScene = this.scene.manager.getScene('MainScene');
            if (mainScene) mainScene.events.emit('action_B');
        });
        this.btnB.on('pointerup', () => this.btnB.setFillStyle(0x0077cc));
        
        this.scale.on('resize', this.resizeUI, this);
        this.resizeUI(this.scale.gameSize);

        window.updateUnreadGlow();
    }

    update() {
        // --- 經驗值水波紋動畫持續流動 ---
        this.expLiquid.tilePositionX -= 0.5;

        if (window.GameLogic.myProfile) {
            let p = window.GameLogic.myProfile;
            this.nameLevelText.setText(`${p.name || '匿名'} Lv.${p.level || 1}`);

            // 動態更新經驗值比例顯示
            let currentExp = p.exp || 0;
            let reqExp = (p.level || 1) * 100;
            this.expText.setText(`${currentExp}/${reqExp}`);

            let ratio = Phaser.Math.Clamp(currentExp / reqExp, 0, 1);
            let baseW = this.expBarWidth || 100;
            this.expLiquid.setSize(baseW * ratio, 16);
        }

        // --- 裝備欄文字閃爍更新 ---
        if (window.GameLogic.armedItemState) {
            this.equipText.setText('水球');
            if (!this.equipBlinkTween) {
                this.equipText.setColor('#ffffff');
                this.equipText.setShadow(0, 0, '#00aaff', 8, true, true);
                this.equipBlinkTween = this.tweens.add({
                    targets: this.equipText, alpha: 0.3, yoyo: true, repeat: -1, duration: 500
                });
            }
        } else {
            this.equipText.setText('沒東西');
            if (this.equipBlinkTween) {
                this.equipBlinkTween.stop();
                this.equipBlinkTween = null;
                this.equipText.setAlpha(1);
                this.equipText.setColor('#3e2723');
                this.equipText.setShadow(0, 0, '#000', 0, false, false); 
            }
        }

        // --- 狀態欄文字更新與閃爍機制 ---
        let ms = this.scene.manager.getScene('MainScene');
        let currentStatus = '沒怎樣';
        let isStatusActive = false;

        if (ms && ms.localPlayer) {
            if (ms.localPlayer.isSleeping) { currentStatus = '補眠中'; isStatusActive = true; }
            else if (ms.localPlayer.isStunned) { currentStatus = '濕身中'; isStatusActive = true; } 
            else if (ms.localPlayer.isSweeping) { currentStatus = '打掃中'; isStatusActive = true; } 
            else if (ms.localPlayer.isThrowing) { currentStatus = '攻擊中'; isStatusActive = true; }
        }
        
        this.statusText.setText(currentStatus);

        if (isStatusActive) {
            if (!this.statusBlinkTween) {
                this.statusText.setColor('#ff0000'); 
                this.statusText.setShadow(0, 0, '#ffffff', 8, true, true);
                this.statusBlinkTween = this.tweens.add({
                    targets: this.statusText, alpha: 0.3, yoyo: true, repeat: -1, duration: 500
                });
            }
        } else {
            if (this.statusBlinkTween) {
                this.statusBlinkTween.stop();
                this.statusBlinkTween = null;
                this.statusText.setAlpha(1);
                this.statusText.setColor('#3e2723'); 
                this.statusText.setShadow(0, 0, '#000', 0, false, false); 
            }
        }
    }

    resizeUI(gameSize) {
        if (!this.joyStick) return;
        const safeMargin = 80;
        const isPortrait = gameSize.height > gameSize.width;
        const bottomOffset = isPortrait ? 120 : 20; 

        // --- 1. 定位搖桿 ---
        const joystickX = 90;
        const joystickY = gameSize.height - 90 - (isPortrait ? 80 : 0);
        this.joyStick.setPosition(joystickX, joystickY);
        
        if (this.joyStick.base) this.joyStick.base.setDepth(10);
        if (this.joyStick.thumb) this.joyStick.thumb.setDepth(10);

        // --- 2. 動態縮放狀態欄底圖 ---
        const targetWidth = Math.min(gameSize.width * 0.45, 320);
        const scaleRatio = targetWidth / this.statusBg.width;
        this.statusBg.setScale(scaleRatio);
        this.portrait.setScale(1);

        const bgW = this.statusBg.displayWidth;
        const bgH = this.statusBg.displayHeight;

        // --- 3. 定位角色狀態基底 Container ---
        const statusX = 20;
        const statusY = joystickY - 60; 
        
        const targetX = this.isStatusCollapsed ? statusX - bgW + 10 : statusX;
        this.statusContainer.setPosition(targetX, statusY);

        this.portrait.setPosition(bgW * 0.5, -bgH * 0.62);

        // 暱稱與等級文字在上
        this.nameLevelText.setPosition(bgW * 0.5, -bgH * 0.24);
        this.nameLevelText.setFontSize(`${Math.max(14, 18 * scaleRatio)}px`);
        
        // 經驗值條在下，並且加長加粗
        let expY = -bgH * 0.12;
        let expW = bgW * 0.50; 
        let expH = 22 * scaleRatio; // 加粗經驗條高度
        this.expBarWidth = expW;

        this.expBarBg.clear();
        this.expBarBg.fillStyle(0x3e2723, 0.8);
        this.expBarBg.fillRoundedRect(bgW * 0.5 - expW / 2, expY - expH / 2, expW, expH, 4);

        this.expLiquid.setPosition(bgW * 0.5 - expW / 2, expY);
        this.expLiquid.setScale(1, expH / 16); 

        this.expText.setPosition(bgW * 0.5, expY);
        this.expText.setFontSize(`${Math.max(10, 13 * scaleRatio)}px`);
        
        this.statusText.setPosition(bgW * 0.32, -bgH * 0.30);
        this.statusText.setFontSize(`${Math.max(16, 20 * scaleRatio)}px`); 

        this.equipText.setPosition(bgW * 0.75, -bgH * 0.30);
        this.equipText.setFontSize(`${Math.max(16, 20 * scaleRatio)}px`);
        
        this.statusToggleBtn.setPosition(bgW, -bgH * 0.30);

        // --- 4. 定位右側按鈕群 ---
        let clusterX = gameSize.width - 90;
        let clusterY = gameSize.height - bottomOffset - 70;
        let d = 45; 
        
        this.itemBtn.setPosition(clusterX, clusterY - d);
        this.itemText.setPosition(this.itemBtn.x, this.itemBtn.y);
        
        this.btnA.setPosition(clusterX + d, clusterY);
        this.txtA.setPosition(this.btnA.x, this.btnA.y);
        
        this.btnB.setPosition(clusterX, clusterY + d);
        this.txtB.setPosition(this.btnB.x, this.btnB.y);
        
        this.furnBtn.setPosition(clusterX - d, clusterY);
        this.furnText.setPosition(this.furnBtn.x, this.furnBtn.y);
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    
    create() {
        let trackKeys = ['bgm', 'bgm-heart', 'bgm-inside'];
        let currentTrackKey = trackKeys[window.GameLogic.currentTrackIdx] || 'bgm';
        
        trackKeys.forEach(k => {
            if (k !== currentTrackKey) this.sound.removeByKey(k);
        });
        
        let currentSnd = this.sound.get(currentTrackKey);
        if (!currentSnd || !currentSnd.isPlaying) {
            this.sound.removeByKey(currentTrackKey);
            let volControl = document.getElementById('bgm-volume');
            let vol = volControl ? volControl.value / 100 : 0.5;
            this.sound.add(currentTrackKey, { loop: true, volume: vol }).play();
        }
        
        this.cameras.main.setBackgroundColor('#1a1008');
        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        
        let cam = this.cameras.main;
        let tvBg = this.add.rectangle(cam.width/2, cam.height/2, cam.width, cam.height, 0x000000).setDepth(9998).setScrollFactor(0);
        let tvLine = this.add.rectangle(cam.width/2, cam.height/2, cam.width, cam.height, 0xffffff).setDepth(9999).setScrollFactor(0);
        tvLine.scaleX = 0;
        tvLine.scaleY = 0.01;

        this.tweens.add({
            targets: tvLine,
            scaleX: 1,
            duration: 150,
            onComplete: () => {
                this.tweens.add({
                    targets: tvLine,
                    scaleY: 1,
                    duration: 150,
                    ease: 'Power2',
                    onComplete: () => {
                        tvBg.destroy();
                        tvLine.destroy();
                    }
                });
            }
        });

        const mapW = this.isCafe ? 2048 : (this.sceneName === "shrine" ? 1280 : 1280);
        const mapH = this.isCafe ? 2048 : (this.sceneName === "shrine" ? 720 : 720);
        
        this.physics.world.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        this.trashes = [];
        
        if (this.isCafe) {
            this.add.tileSprite(0, 0, mapW, mapH, 'bgCafe').setOrigin(0, 0);
            this.time.addEvent({ delay: 2000, callback: this.spawnTrash, callbackScope: this, loop: true });

            const mapSize = 120; const marginX = 20; const marginY = 60;
            this.minimap = this.cameras.add(this.cameras.main.width - mapSize - marginX, marginY, mapSize, mapSize)
                .setZoom(mapSize / 2048).setName('minimap');
            this.minimap.setBackgroundColor('rgba(26, 16, 8, 0.7)');
            this.minimap.centerOn(1024, 1024);

            this.scale.on('resize', (gameSize) => { if (this.minimap) this.minimap.setPosition(gameSize.width - mapSize - marginX, marginY); });

            this.trashListener = onValue(ref(window.GameLogic.db, 'cafeTrashes'), (snap) => {
                let data = snap.val() || {};
                
                for (let key in data) {
                    if (!this.trashes.find(t => t.key === key)) {
                        let tData = data[key];
                        let isOld = tData.type === 'old';
                        let spriteKey = isOld ? 'onion-skin-old' : 'onion-skin';
                        let animKey = isOld ? 'skin-old-anim' : 'skin-anim';
                        let skin = this.physics.add.sprite(tData.x, tData.y, spriteKey).setDepth(4);
                        skin.play(animKey);
                        skin.type = isOld ? 'onion-skin-old' : 'onion-skin';
                        skin.key = key; 
                        this.trashes.push(skin);
                    }
                }
                
                this.trashes = this.trashes.filter(t => {
                    if (!data[t.key]) {
                        t.destroy();
                        if (this.closestTrash === t) {
                            this.closestTrash = null;
                            if (this.localPlayer && this.localPlayer.isSweeping) {
                                this.localPlayer.isSweeping = false;
                                this.qteContainer.setVisible(false);
                                if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1');
                            }
                        }
                        return false;
                    }
                    return true;
                });
            });
        } else if (this.sceneName === "doghouse") {
            this.add.image(mapW/2, mapH/2, 'bgDoghouse').setDisplaySize(mapW, mapH);
            this.doghouseFurnListener = onValue(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}/doghouseFurniture`), (snap) => {
                window.GameLogic.doghouseFurniture = snap.val() || {};
            });
        } else if (this.sceneName === "farm") {
            this.add.image(mapW/2, mapH/2, 'bgFarm').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "shrine") {
            this.add.image(mapW/2, mapH/2, 'bgShrine').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "7eonion") {
            this.add.image(mapW/2, mapH/2, 'bg7Eonion').setDisplaySize(mapW, mapH);
            this.storeManager = this.physics.add.staticSprite(mapW/2, mapH/2, 'storeManager').setDepth(5);
            let imgW = this.storeManager.width; let imgH = this.storeManager.height;
            this.storeManager.body.setSize(120, 120); 
            this.storeManager.body.setOffset((imgW - 120) / 2, (imgH - 120) / 2); 
            
            this.smBubbleBg = this.add.graphics().setDepth(6);
            this.smBubbleText = this.add.text(mapW/2, mapH/2 - 90, '好想離職......', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(7);
            
            const smPhrases = ["好想離職......", "這裡怎麼還沒倒......", "洋蔥好臭啊......"];
            let phraseIdx = 0;

            const updateSMBubble = () => {
                this.smBubbleText.setText(smPhrases[phraseIdx]);
                const bounds = this.smBubbleText.getBounds();
                const boxWidth = bounds.width + 16, boxHeight = bounds.height + 12;
                const boxX = this.smBubbleText.x - boxWidth / 2, boxY = this.smBubbleText.y - boxHeight / 2;
                this.smBubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8).strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
                phraseIdx = (phraseIdx + 1) % smPhrases.length;
            };
            updateSMBubble();
            this.time.addEvent({ delay: 4000, callback: updateSMBubble, callbackScope: this, loop: true });
        }

        const uiScene = this.scene.manager.getScene('UIScene');
        if (uiScene && uiScene.furnText) uiScene.furnText.setText(this.sceneName === 'farm' ? '農具' : '家俱');

        this.otherPlayers = {}; this.furnitureSprites = {}; this.dummySprites = {};
        this.coinSprites = {};
        
        if (this.isCafe || this.sceneName === "7eonion") {
            this.coinsListener = onValue(ref(window.GameLogic.db, 'droppedCoins'), (snap) => {
                let data = snap.val() || {};
                for (let key in data) {
                    if (!this.coinSprites[key]) {
                        let cData = data[key];
                        let coinSprite = this.physics.add.sprite(cData.x, cData.y, 'made-coin').setDepth(8);
                        coinSprite.play('coin-anim', true);
                        coinSprite.amount = cData.amount || 5;
                        this.coinSprites[key] = coinSprite;
                    }
                }
                for (let key in this.coinSprites) {
                    if (!data[key]) {
                        this.coinSprites[key].destroy();
                        delete this.coinSprites[key];
                    }
                }
            });

            this.dummiesListener = onValue(ref(window.GameLogic.db, 'cafeDummies'), (snap) => {
                let data = snap.val() || {};
                for (let key in data) {
                    if (!this.dummySprites[key]) {
                        let dData = data[key];
                        let dummySprite = this.physics.add.sprite(dData.x, dData.y, 'dummy').setDepth(8);
                        this.dummySprites[key] = dummySprite;
                    }
                }
                for (let key in this.dummySprites) {
                    if (!data[key]) {
                        this.dummySprites[key].destroy();
                        delete this.dummySprites[key];
                    }
                }
            });
        }

        let startX = mapW / 2 + 100;
        let startY = mapH / 2;
        
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true);
        this.localPlayer.isSweeping = false;
        this.localPlayer.isSleeping = false;

        this.tweens.add({
            targets: this.localPlayer.sprite,
            alpha: 0,
            yoyo: true,
            repeat: 5,
            duration: 100,
            onComplete: () => {
                this.localPlayer.sprite.setAlpha(1);
            }
        });

        if (this.sceneName === "7eonion" && this.storeManager) {
            this.physics.add.collider(this.localPlayer.sprite, this.storeManager);
        }
        
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        this.smartPromptBg = this.add.graphics().setDepth(100).setVisible(false);
        this.smartPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#4a5d4e' }).setOrigin(0.5).setDepth(101).setVisible(false);
        if (this.minimap) this.minimap.ignore([this.smartPromptBg, this.smartPromptText]);

        this.waterPromptBg = this.add.graphics().setDepth(100).setVisible(false);
        this.waterPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(101).setVisible(false);
        this.lockOnTarget = this.add.text(0, 0, '🎯', { fontSize: '28px' }).setOrigin(0.5).setDepth(150).setVisible(false);
        
        this.tweens.add({
            targets: this.lockOnTarget, scaleX: 1.2, scaleY: 1.2, yoyo: true, repeat: -1, duration: 400
        });

        if (this.minimap) this.minimap.ignore([this.waterPromptBg, this.waterPromptText, this.lockOnTarget]);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        this.spaceKey.on('down', (e) => { if (!e.repeat && document.activeElement.tagName !== 'INPUT') this.spacePressTime = Date.now(); });
        this.spaceKey.on('up', () => {
            if (document.activeElement.tagName === 'INPUT') return;
            let duration = Date.now() - this.spacePressTime;
            if (window.GameLogic.placingFurnitureKey) this.events.emit('action_A_place');
            else if (duration > 500) this.events.emit('action_A_long');
            else this.events.emit('action_A_short');
        });
        this.shiftKey.on('down', (e) => { if (!e.repeat && document.activeElement.tagName !== 'INPUT') this.events.emit('action_B'); });

        this.qteContainer = this.add.container(0, 0).setVisible(false).setDepth(300);
        const qteBg = this.add.graphics().fillStyle(0x3e2723, 0.8).fillRoundedRect(-52, -10, 104, 20, 10).lineStyle(2, 0xc5a059).strokeRoundedRect(-52, -10, 104, 20, 10);
        this.qteBar = this.add.graphics();
        const qteLabel = this.add.text(0, -25, '打掃進度', { fontSize: '14px', color: '#c5a059', fontStyle: 'bold' }).setOrigin(0.5);
        this.qteContainer.add([qteBg, this.qteBar, qteLabel]);
        if (this.minimap) this.minimap.ignore([qteBg, this.qteBar, qteLabel, this.qteContainer]);

        // Sleep Interaction setup
        this.sleepTopBg = this.add.graphics().setDepth(150).setVisible(false);
        this.sleepTopText = this.add.text(0, 0, '按A起床', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} }).setOrigin(0.5).setDepth(151).setVisible(false);
        this.sleepBotBg = this.add.graphics().setDepth(150).setVisible(false);
        this.sleepBotText = this.add.text(0, 0, 'zzZ', { fontSize: '16px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#3e2723' }).setOrigin(0.5).setDepth(151).setVisible(false);
        this.sleepZzzArray = ['zzZ', 'Zzz', 'zZz'];
        this.sleepZzzIdx = 0;
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.localPlayer && this.localPlayer.isSleeping) {
                    this.sleepZzzIdx = (this.sleepZzzIdx + 1) % 3;
                    this.sleepBotText.setText(this.sleepZzzArray[this.sleepZzzIdx]);
                    let bounds = this.sleepBotText.getBounds();
                    let w = bounds.width + 16, h = bounds.height + 12;
                    let x = this.sleepBotText.x - w/2, y = this.sleepBotText.y - h/2;
                    this.sleepBotBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(x, y, w, h, 8).strokeRoundedRect(x, y, w, h, 8);
                }
            },
            loop: true
        });

        this.events.on('action_A_place', () => {
            let key = window.GameLogic.placingFurnitureKey;
            if(key && this.furnitureSprites[key]) {
                let f = this.furnitureSprites[key];
                f.sprite.setVelocity(0, 0); 
                let path = this.isCafe ? `cafeFurniture/${key}` : `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${key}`;
                update(ref(window.GameLogic.db, path), { 
                    locked: true, x: f.sprite.x, y: f.sprite.y, ownerUid: window.GameLogic.currentUser.uid 
                });
                window.GameLogic.placingFurnitureKey = null;
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08); 
            }
        });

        this.events.on('action_A_short', () => {
            if (this.localPlayer.isSleeping) {
                this.localPlayer.isSleeping = false;
                this.sleepTopBg.setVisible(false); this.sleepTopText.setVisible(false);
                this.sleepBotBg.setVisible(false); this.sleepBotText.setVisible(false);
                this.localPlayer.sprite.play('idle');
                return;
            }

            if (this.sceneName === 'doghouse') {
                for (let key in this.furnitureSprites) {
                    if (key.includes('bed')) {
                        let f = this.furnitureSprites[key];
                        if (f.sprite.isLocked && Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y) < 90) {
                            this.localPlayer.isSleeping = true;
                            this.localPlayer.sprite.setPosition(f.sprite.x, f.sprite.y);
                            this.localPlayer.sprite.play('sleep', true);
                            this.sleepTopText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 100);
                            this.sleepBotText.setVisible(true).setPosition(f.sprite.x, f.sprite.y - 65);
                            this.sleepBotBg.setVisible(true);
                            let bounds = this.sleepBotText.getBounds();
                            let w = bounds.width + 16, h = bounds.height + 12;
                            let x = this.sleepBotText.x - w/2, y = this.sleepBotText.y - h/2;
                            this.sleepBotBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(x, y, w, h, 8).strokeRoundedRect(x, y, w, h, 8);
                            return;
                        }
                    }
                }
            }

            if (window.GameLogic.armedItemState === 'ready') {
                let inv = window.GameLogic.myProfile.inventory || {};
                inv['水球'] = Math.max(0, (inv['水球'] || 0) - 1);
                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { inventory: inv });
                
                if (inv['水球'] > 0) {
                    window.GameLogic.armedItemState = 'armed';
                } else {
                    window.GameLogic.armedItemState = null;
                }
                
                window.playSFX(this, 'minimum_laser');

                let targetUid = window.GameLogic.currentTargetUid;
                let targetSprite = window.GameLogic.currentTargetSprite;
                let targetType = window.GameLogic.currentTargetType;

                if (targetSprite) {
                    this.localPlayer.sprite.setFlipX(targetSprite.x < this.localPlayer.sprite.x);
                }

                this.localPlayer.sprite.play('throw', true);
                this.localPlayer.isThrowing = true;
                this.time.delayedCall(300, () => { this.localPlayer.isThrowing = false; });

                if (targetUid && targetSprite) {
                    let wb = this.physics.add.sprite(this.localPlayer.sprite.x, this.localPlayer.sprite.y, 'water-ball-blast').setDepth(15);
                    wb.setFrame(0); 
                    
                    this.tweens.add({
                        targets: wb, x: targetSprite.x, y: targetSprite.y, duration: 200,
                        onComplete: () => {
                            window.playSFX(this, 'powerdown07');
                            
                            wb.play('wb-blast', true); 
                            this.time.delayedCall(300, () => { wb.destroy(); });
                            
                            if (targetType === 'player') {
                                update(ref(window.GameLogic.db, `serverEvents/waterHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                            } else if (targetType === 'dummy') {
                                update(ref(window.GameLogic.db, `serverEvents/dummyHits/${targetUid}`), { time: Date.now(), attacker: window.GameLogic.currentUser.uid });
                                
                                for (let i = 0; i < 3; i++) {
                                    let cx = targetSprite.x + Phaser.Math.Between(-40, 40);
                                    let cy = targetSprite.y + Phaser.Math.Between(-40, 40) + 20;
                                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                                        module.push(module.ref(window.GameLogic.db, 'droppedCoins'), {
                                            x: cx, y: cy, amount: 5
                                        });
                                    });
                                }
                            }
                        }
                    });
                } else {
                    sendBubble("把水球砸向了空地...");
                }
                return; 
            }

            if (this.localPlayer.isSweeping) {
                if (!window.GameLogic.muteSFX && !this.sound.get('brooming1')?.isPlaying) {
                    if (this.sound.get('brooming1')) this.sound.play('brooming1'); 
                    else this.sound.add('brooming1').play();
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
                    window.GameLogic.isShopping = true;
                    document.getElementById('store-modal').style.display = 'block';
                    return;
                }
            }
          
            if(!this.isCafe) return sendBubble("對著空氣揮舞了雙手!");
            let interacted = false;
            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                if (!f.sprite.isLocked) continue;
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                if (dist < 90) { 
                    if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                    if (key.startsWith('memory')) document.getElementById('memory-modal').style.display = 'block';
                    if (key === 'shrine') {
                        update(ref(window.GameLogic.db, 'serverEvents/teleport'), { target: 'shrine', time: Date.now() });
                        sendBubble("神龕發出耀眼的光芒...");
                    }
                    interacted = true; break;
                }
            }
            if(!interacted) sendBubble("使用了 A 技能!");
        });

        this.events.on('action_B', () => {
            if (window.GameLogic.armedItemState === 'armed') {
                window.GameLogic.armedItemState = 'ready';
                return;
            }
            if (this.localPlayer.isSleeping) return;
            
            if (!this.localPlayer.isSweeping && this.closestTrash) {
                this.localPlayer.isSweeping = true;
                this.qteProgress = 0;
                this.qteTotalClicks = Phaser.Math.Between(5, 10); 
                this.qteContainer.setVisible(true);
            } else if (!this.localPlayer.isSweeping) {
                sendBubble("使用了 B 技能!");
            }
        });

        this.placePrompt = this.add.text(0, 0, '洋蔥精靈: 按A確定擺放', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} }).setOrigin(0.5).setDepth(20).setVisible(false);
        if (this.minimap) this.minimap.ignore(this.placePrompt);
      
        this.hitListener = onValue(ref(window.GameLogic.db, `serverEvents/waterHits/${window.GameLogic.currentUser.uid}`), (snap) => {
            let data = snap.val();
            if (data && data.time && (Date.now() - data.time < 2000)) {
                if (this.localPlayer.isInvincible) return; 

                this.localPlayer.isInvincible = true;
                this.localPlayer.isStunned = true;
                
                let p = window.GameLogic.myProfile;
                let loss = Math.min(p.coins || 0, 15);
                p.coins -= loss;
                update(ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { coins: p.coins });
                let coinsEl = document.getElementById("vp-coins");
                if (coinsEl) coinsEl.innerText = p.coins;

                let amounts = [12, 12, 11];
                for (let i = 0; i < 3; i++) {
                    let cx = this.localPlayer.sprite.x + Phaser.Math.Between(-40, 40);
                    let cy = this.localPlayer.sprite.y + Phaser.Math.Between(-40, 40) + 20;
                    
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                        module.push(module.ref(window.GameLogic.db, 'droppedCoins'), {
                            x: cx,
                            y: cy,
                            amount: amounts[i] 
                        });
                    });
                }

                this.time.delayedCall(500, () => { this.localPlayer.isStunned = false; }); 
                this.time.delayedCall(1500, () => { this.localPlayer.isInvincible = false; }); 
                remove(ref(window.GameLogic.db, `serverEvents/waterHits/${window.GameLogic.currentUser.uid}`)); 
            }
        });

        this.playersHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/waterHits'), (snap) => {
            let hits = snap.val() || {};
            for (let uid in hits) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let data = hits[uid];
                if (data && data.time && (Date.now() - data.time < 2000)) {
                    if (this.otherPlayers[uid] && this.otherPlayers[uid].sprite) {
                        let opSprite = this.otherPlayers[uid].sprite;
                        if (!opSprite.isStunned) {
                            opSprite.isStunned = true;
                            opSprite.play('wet', true);
                            this.time.delayedCall(1500, () => {
                                if (opSprite && opSprite.active) {
                                    opSprite.isStunned = false;
                                }
                            });
                        }
                    }
                }
            }
        });

        this.dummyHitListener = onValue(ref(window.GameLogic.db, 'serverEvents/dummyHits'), (snap) => {
            let hits = snap.val() || {};
            for (let key in hits) {
                let data = hits[key];
                if (data && data.time && (Date.now() - data.time < 2000) && this.furnitureSprites[key]) {
                    let dummy = this.furnitureSprites[key].sprite;
                    if (dummy && !dummy.isStunned) {
                        dummy.isStunned = true;
                        dummy.play('dummy-hit', true); 
                        this.time.delayedCall(1500, () => { 
                            if (dummy && dummy.active) {
                                dummy.isStunned = false; 
                                dummy.anims.stop();
                                dummy.setTexture('dummy');
                            }
                        });
                    }
                }
            }
        });

        this.events.on('shutdown', () => {
            if (this.trashListener) this.trashListener();
            if (this.coinsListener) this.coinsListener();
            if (this.dummiesListener) this.dummiesListener();
            if (this.hitListener) this.hitListener();
            if (this.dummyHitListener) this.dummyHitListener();
            if (this.playersHitListener) this.playersHitListener();
            if (this.doghouseFurnListener) this.doghouseFurnListener();
        });
    }

    spawnTrash() {
        if (!this.isCafe) return;
        let playerCount = Object.keys(window.GameLogic.cafePlayers || {}).length || 1;
        
        let limits = [10, 12, 15, 17, 20];
        let maxTrash = limits[Math.min(playerCount - 1, 4)];
        let spawnChance = 0.3 + (playerCount * 0.1); 
        
        let currentTrashCount = this.trashes.length;
        if (Math.random() < spawnChance && currentTrashCount < maxTrash) { 
            let tx = Phaser.Math.Between(150, 1898); 
            let ty = Phaser.Math.Between(150, 1898);
            let isOld = Math.random() < 0.05;
            
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                module.push(module.ref(window.GameLogic.db, 'cafeTrashes'), { x: tx, y: ty, type: isOld ? 'old' : 'normal' });
            });
        }
    }

    updateQTEBar(progress) {
        this.qteBar.clear();
        let width = Math.min(100, (progress / 100) * 100);
        this.qteBar.fillStyle(0xd9534f, 1);
        this.qteBar.fillRoundedRect(-50, -8, width, 16, 8);
    }

    createPlayerEntity(x, y, pData, isLocal = false) {
        let entity = { sprite: this.physics.add.sprite(x, y, 'onion').setCollideWorldBounds(true).setDepth(10) };
        if (!isLocal) {
            entity.sprite.setInteractive();
            entity.sprite.on('pointerdown', (pointer) => {
                const actionMenu = document.getElementById("action-menu");
                actionMenu.style.display = "flex"; actionMenu.style.left = pointer.event.pageX + "px"; actionMenu.style.top = pointer.event.pageY + "px";
                actionMenu.dataset.uid = pData.uid;
            });
        }
        entity.nameBg = this.add.graphics().setDepth(11);
        entity.nameText = this.add.text(x, y, pData.name || '匿名', { fontSize: '13px', fontFamily: 'Georgia', color: pData.color || '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
        entity.bubbleBg = this.add.graphics().setDepth(13).setVisible(false);
        entity.bubbleText = this.add.text(x, y, '', { fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', wordWrap: { width: 160, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5).setDepth(14).setVisible(false);
        if (this.minimap) this.minimap.ignore([entity.nameBg, entity.nameText, entity.bubbleBg, entity.bubbleText]);
        return entity;
    }

    updatePlayerEntity(entity, pData) {
        let sx = entity.sprite.x; let sy = entity.sprite.y;
        let displayName = `${pData.name || '匿名'} Lv.${pData.level || 1}`;
        entity.nameText.setText(displayName);
        if(pData.color) entity.nameText.setColor(pData.color);

        const nameBounds = entity.nameText.getBounds();
        const bgWidth = nameBounds.width + 16; 
        entity.nameBg.clear().fillStyle(0x000000, 0.6).fillRoundedRect(sx - bgWidth / 2, sy - 55, bgWidth, 20, 4);
        entity.nameText.setPosition(sx, sy - 45);
        if (pData.bubbleMsg && (Date.now() - pData.bubbleTime < 10000)) { 
            entity.bubbleBg.setVisible(true); entity.bubbleText.setVisible(true).setText(pData.bubbleMsg);
            const bounds = entity.bubbleText.getBounds(); const boxWidth = bounds.width + 20, boxHeight = bounds.height + 16, boxX = sx - boxWidth / 2, boxY = sy - 65 - boxHeight; 
            entity.bubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8).strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
            entity.bubbleText.setPosition(sx, boxY + boxHeight / 2);
        } else {
            entity.bubbleBg.setVisible(false); entity.bubbleText.setVisible(false);
        }
    }

    createFurniture(key, data) {
        let imgKey = key.includes('fridge') ? 'fridge' : (key.includes('shrine') ? 'shrine' : (key.includes('dummy') ? 'dummy' : (key.includes('bed') ? 'doghouse-bed' : 'memory')));
        let f = { sprite: this.physics.add.sprite(data.x, data.y, imgKey).setDepth(5).setCollideWorldBounds(true) };
        f.sprite.isLocked = data.locked;

        if (imgKey === 'dummy') {
            f.bubbleBg = this.add.graphics().setDepth(13).setVisible(false);
            f.bubbleText = this.add.text(data.x, data.y, '', { fontSize: '12px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold', wordWrap: { width: 100, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5).setDepth(14).setVisible(false);
            if (this.minimap) this.minimap.ignore([f.bubbleBg, f.bubbleText]);
            f.dummyMsgs = ["我在這幹嘛？", "怎麼有洋蔥？", "該不會要打我吧......"];
            f.msgIndex = 0;
            f.lastMsgTime = 0;
            f.isHit = false;
        }

        return f;
    }

    finishSweeping(success) {
        this.localPlayer.isSweeping = false;
        this.qteContainer.setVisible(false);
        
        if (this.sound.get('brooming1')) this.sound.stopByKey('brooming1');

        if (success && this.closestTrash) {
            let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y - 40; 
            let trashKey = this.closestTrash.key;
            let isOld = this.closestTrash.type === 'onion-skin-old';
            
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                module.remove(module.ref(window.GameLogic.db, 'cafeTrashes/' + trashKey));
            });
            this.closestTrash = null;
            
            let leveledUp = gainRewards(0, 10); 
            
            if (leveledUp) {
                window.playSFX(this, 'chorus_of_angels1');
            }

            let totalCoins = isOld ? Phaser.Math.Between(50, 60) : Phaser.Math.Between(10, 18);
            let coinAmounts = [Math.floor(totalCoins/3), Math.floor(totalCoins/3), totalCoins - 2*Math.floor(totalCoins/3)];

            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                for(let i = 0; i < 3; i++) {
                    let cx = this.localPlayer.sprite.x + Phaser.Math.Between(-30, 30);
                    let cy = this.localPlayer.sprite.y + Phaser.Math.Between(-30, 30) + 20;
                    module.push(module.ref(window.GameLogic.db, 'droppedCoins'), { x: cx, y: cy, amount: coinAmounts[i] });
                }
            });
            
            let txt = `✨ 打掃成功 ✨\n+10 EXP`;
            if (leveledUp) txt += `\n🆙 升級了!`;

            let successText = this.add.text(px, py, txt, { fontSize: '18px', color: '#c5a059', fontStyle: 'bold', stroke: '#fff', strokeThickness: 4, align:'center' }).setOrigin(0.5).setDepth(200);
            if (this.minimap) this.minimap.ignore(successText);

            this.tweens.add({ targets: successText, y: py - 60, alpha: { getStart: () => 1, getEnd: () => 0 }, delay: 1000, duration: 1500, ease: 'Power2', onComplete: () => successText.destroy() });
        }
    }

    update(time, delta) {
        if (!window.GameLogic.currentUser) return;
        
        let vx = 0; let vy = 0; let speed = 180;
        const uiScene = this.scene.manager.getScene('UIScene');
        let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y;

        if (this.localPlayer.isSweeping) {
            this.localPlayer.sprite.setVelocity(0, 0);
            this.localPlayer.sprite.play('clean', true); 
            this.qteProgress -= (delta * 0.02); if (this.qteProgress < 0) this.qteProgress = 0;
            this.updateQTEBar(this.qteProgress);
            if (this.closestTrash) this.qteContainer.setPosition(this.closestTrash.x, this.closestTrash.y + 40);
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
        } else if (this.localPlayer.isSleeping) {
            this.localPlayer.sprite.setVelocity(0, 0);
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
        } else if (this.localPlayer.isStunned) {
            this.localPlayer.sprite.setVelocity(0, 0);
            this.localPlayer.sprite.play('wet', true);
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
        } else if (this.localPlayer.isThrowing) {
            this.localPlayer.sprite.setVelocity(0, 0); 
        } else {
            if (uiScene && uiScene.joyStick && uiScene.joyStick.force > 0) {
                vx = Math.cos(uiScene.joyStick.angle * Math.PI / 180) * speed; 
                vy = Math.sin(uiScene.joyStick.angle * Math.PI / 180) * speed;
            } else {
                if (document.activeElement.tagName !== 'INPUT') {
                    if (this.cursors.left.isDown) vx = -speed;
                    else if (this.cursors.right.isDown) vx = speed;
                    
                    if (this.cursors.up.isDown) vy = -speed;
                    else if (this.cursors.down.isDown) vy = speed;
                }
                if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; } 
            }

            let isPlacing = window.GameLogic.placingFurnitureKey !== null && (this.isCafe || this.sceneName === 'doghouse');

            if (isPlacing) {
                this.localPlayer.sprite.setVelocity(0, 0).play('idle', true);
                let f = this.furnitureSprites[window.GameLogic.placingFurnitureKey];
                if (f && f.sprite && f.sprite.active) {
                    f.sprite.setVelocity(vx, vy);
                    this.cameras.main.startFollow(f.sprite, true, 0.1, 0.1);
                    this.placePrompt.setPosition(f.sprite.x, f.sprite.y - 80).setVisible(true);
                    if (vx !== 0 || vy !== 0) {
                        if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                            let path = this.isCafe ? `cafeFurniture/${window.GameLogic.placingFurnitureKey}` : `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${window.GameLogic.placingFurnitureKey}`;
                            update(ref(window.GameLogic.db, path), { x: f.sprite.x, y: f.sprite.y });
                            this.lastSyncTime = Date.now();
                        }
                    }
                } else {
                    let targetData = this.isCafe ? window.GameLogic.cafeFurniture : window.GameLogic.doghouseFurniture;
                    if (!targetData[window.GameLogic.placingFurnitureKey]) {
                        window.GameLogic.placingFurnitureKey = null;
                        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                    }
                }
            } else {
                this.placePrompt.setVisible(false);
                this.localPlayer.sprite.setVelocity(vx, vy);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                
                let absX = Math.abs(vx);
                let absY = Math.abs(vy);

                if (absX < 1) vx = 0; 
                if (absY < 1) vy = 0;

                if (vx === 0 && vy === 0) {
                    this.localPlayer.sprite.play('idle', true);
                } else if (absX >= absY) {
                    this.localPlayer.sprite.setFlipX(vx < 0);
                    this.localPlayer.sprite.play('walk', true);
                } else {
                    if (vy < 0) {
                        this.localPlayer.sprite.play('walk-up', true);
                    } else {
                        this.localPlayer.sprite.play('walk-down', true);
                    }
                }
                
                if (this.isCafe && (vx !== 0 || vy !== 0)) {
                    if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                        update(ref(window.GameLogic.db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y });
                        this.lastSyncTime = Date.now();
                    }
                }
            }

            let minDist = 90; let promptTarget = null; let promptMsg = ""; this.closestTrash = null;

            for (let key in this.furnitureSprites) {
                let f = this.furnitureSprites[key]; if (!f.sprite.isLocked) continue;
                let d = Phaser.Math.Distance.Between(px, py, f.sprite.x, f.sprite.y);
                if (d < minDist) { 
                    minDist = d; promptTarget = f.sprite; 
                    if (key.includes('fridge')) promptMsg = "按A打開冰箱";
                    else if (key.includes('shrine')) promptMsg = "按A參拜神龕";
                    else if (key.includes('dummy')) promptMsg = "假人洋蔥 (裝飾中)"; 
                    else if (key.includes('bed')) promptMsg = "按A歐歐睏";
                    else promptMsg = "按A打開回憶錄"; 
                }
            }
            for (let t of this.trashes) {
                if (!t.active) continue;
                let d = Phaser.Math.Distance.Between(px, py, t.x, t.y);
                if (d < minDist) { minDist = d; promptTarget = t; promptMsg = "按B使出掃地"; this.closestTrash = t; }
            }
            if (this.sceneName === '7eonion' && this.storeManager && !window.GameLogic.isShopping) {
                let d = Phaser.Math.Distance.Between(px, py, this.storeManager.x, this.storeManager.y);
                if (d < 150) {
                    minDist = d; promptTarget = this.storeManager; promptMsg = "按A對話購物";
                }
            }

            if (promptTarget && !isPlacing) {
                this.smartPromptText.setText(promptMsg).setVisible(true);
                const pBounds = this.smartPromptText.getBounds(); const pWidth = pBounds.width + 16, pHeight = pBounds.height + 8, ptX = promptTarget.x, ptY = promptTarget.y - 60; 
                this.smartPromptBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).strokeRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).setVisible(true);
                this.smartPromptText.setPosition(ptX, ptY);
            } else { this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false); }

            if (window.GameLogic.armedItemState) {
                let msg = window.GameLogic.armedItemState === 'armed' ? "按B填充水球" : "按A投擲水球";
                
                this.waterPromptText.setText(msg).setVisible(true);
                const wpBounds = this.waterPromptText.getBounds(); 
                const wpWidth = wpBounds.width + 20, wpHeight = wpBounds.height + 10;
                const wptX = px, wptY = py + 45; 
                
                this.waterPromptBg.clear().fillStyle(0x0077cc, 0.8).lineStyle(2, 0xffffff, 1).fillRoundedRect(wptX - wpWidth/2, wptY - wpHeight/2, wpWidth, wpHeight, 6).strokeRoundedRect(wptX - wpWidth/2, wptY - wpHeight/2, wpWidth, wpHeight, 6).setVisible(true);
                this.waterPromptText.setPosition(wptX, wptY);

                let lockOnDist = 150; 
                let lockTargetUid = null;
                let lockTargetSprite = null;
                let isDummy = false;

                for (let uid in this.otherPlayers) {
                    let op = this.otherPlayers[uid].sprite;
                    let d = Phaser.Math.Distance.Between(px, py, op.x, op.y);
                    if (d < lockOnDist) { lockOnDist = d; lockTargetUid = uid; lockTargetSprite = op; isDummy = false; }
                }
                
                for (let key in this.furnitureSprites) {
                    if (key.includes('dummy')) {
                        let fDummy = this.furnitureSprites[key].sprite;
                        let d = Phaser.Math.Distance.Between(px, py, fDummy.x, fDummy.y);
                        if (d < lockOnDist) { lockOnDist = d; lockTargetUid = key; lockTargetSprite = fDummy; isDummy = true; }
                    }
                }

                if (lockTargetSprite) {
                    this.lockOnTarget.setPosition(lockTargetSprite.x, lockTargetSprite.y - 40).setVisible(true);
                    window.GameLogic.currentTargetSprite = lockTargetSprite;
                    window.GameLogic.currentTargetUid = lockTargetUid;
                    window.GameLogic.currentTargetType = isDummy ? 'dummy' : 'player';
                } else {
                    this.lockOnTarget.setVisible(false);
                    window.GameLogic.currentTargetSprite = null;
                    window.GameLogic.currentTargetUid = null;
                }
            } else {
                if (this.waterPromptBg) {
                    this.waterPromptBg.setVisible(false);
                    this.waterPromptText.setVisible(false);
                    this.lockOnTarget.setVisible(false);
                }
            }
        }
        
        if (this.localPlayer.isInvincible) {
            this.localPlayer.sprite.setAlpha((Math.floor(time / 100) % 2 === 0) ? 0.5 : 1);
        } else {
            this.localPlayer.sprite.setAlpha(1);
        }

        for (let key in this.coinSprites) {
            let coin = this.coinSprites[key];
            let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, coin.x, coin.y);
            
            if (dist < 30) { 
                window.playSFX(this, 'coin03');

                let coinAmount = coin.amount;
                
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                    let coinRef = module.ref(window.GameLogic.db, `droppedCoins/${key}`);
                    module.get(coinRef).then((coinSnap) => {
                        if (coinSnap.exists()) {
                            module.remove(coinRef).then(() => {
                                let p = window.GameLogic.myProfile;
                                p.coins = (p.coins || 0) + coinAmount;
                                
                                module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}`), { 
                                    coins: p.coins 
                                });
                                
                                let coinsEl = document.getElementById("vp-coins");
                                if (coinsEl) coinsEl.innerText = p.coins;
                                
                                let px = this.localPlayer.sprite.x;
                                let py = this.localPlayer.sprite.y - 40;
                                let pickupText = this.add.text(px, py, `+${coinAmount} 💰`, { 
                                    fontSize: '16px', color: '#d4af37', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 
                                }).setOrigin(0.5).setDepth(200);
                                
                                this.tweens.add({
                                    targets: pickupText, y: py - 40, alpha: 0, duration: 1000,
                                    onComplete: () => pickupText.destroy()
                                });
                            });
                        }
                    });
                });
            }
        }
      
        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        const furnData = this.isCafe ? window.GameLogic.cafeFurniture : (this.sceneName === 'doghouse' ? (window.GameLogic.doghouseFurniture || {}) : {});
        for (let key in furnData) {
            let fd = furnData[key];
            if (!this.furnitureSprites[key]) this.furnitureSprites[key] = this.createFurniture(key, fd);
            let f = this.furnitureSprites[key]; f.sprite.isLocked = fd.locked;
            if(window.GameLogic.placingFurnitureKey !== key) { f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3); f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3); }
            f.sprite.setAlpha(!fd.locked ? 0.6 : 1);

            if (key.includes('dummy') && f.bubbleBg) {
                f.bubbleBg.setVisible(true); f.bubbleText.setVisible(true);
                
                if (f.sprite.isStunned) {
                    f.bubbleText.setText("真的打我QAQ");
                    f.isHit = true;
                } else {
                    if (f.isHit) { f.isHit = false; f.lastMsgTime = 0; } 
                    if (time - f.lastMsgTime > 4000) { 
                        f.lastMsgTime = time;
                        f.bubbleText.setText(f.dummyMsgs[f.msgIndex]);
                        f.msgIndex = (f.msgIndex + 1) % f.dummyMsgs.length;
                    }
                }
                let sx = f.sprite.x; let sy = f.sprite.y;
                const bounds = f.bubbleText.getBounds(); const boxWidth = bounds.width + 16, boxHeight = bounds.height + 12, boxX = sx - boxWidth / 2, boxY = sy - 60 - boxHeight; 
                f.bubbleBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 6).strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 6);
                f.bubbleText.setPosition(sx, boxY + boxHeight / 2);
            }
        }
        for (let key in this.furnitureSprites) {
            if (!furnData[key]) {
                if (window.GameLogic.placingFurnitureKey === key) {
                    window.GameLogic.placingFurnitureKey = null;
                    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                }
                if (this.furnitureSprites[key].bubbleBg) this.furnitureSprites[key].bubbleBg.destroy();
                if (this.furnitureSprites[key].bubbleText) this.furnitureSprites[key].bubbleText.destroy();
                this.furnitureSprites[key].sprite.destroy(); 
                delete this.furnitureSprites[key]; 
            }
        }

        if (this.isCafe) {
            const playersData = window.GameLogic.cafePlayers;
            const globalOnline = window.GameLogic.onlinePlayers || {}; 
            
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                if (!globalOnline[uid]) continue; // 過濾判定已離線的幽靈玩家，搭配.info/connected可達到完美同步
                
                let pd = playersData[uid]; pd.uid = uid;
                if (!this.otherPlayers[uid]) this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                
                let op = this.otherPlayers[uid];
                let oldX = op.sprite.x;
                let oldY = op.sprite.y;
                
                op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2);
                op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2);
                
                let diffX = op.sprite.x - oldX;
                let diffY = op.sprite.y - oldY;
                let absX = Math.abs(diffX);
                let absY = Math.abs(diffY);

                if (op.sprite.isStunned) {
                    op.sprite.play('wet', true);
                } else if (absX < 0.5 && absY < 0.5) {
                    op.sprite.play('idle', true);
                } else if (absX >= absY) {
                    op.sprite.setFlipX(diffX < 0);
                    op.sprite.play('walk', true);
                } else {
                    if (diffY < 0) {
                        op.sprite.play('walk-up', true);
                    } else {
                        op.sprite.play('walk-down', true);
                    }
                }

                this.updatePlayerEntity(op, pd);
            }
            
            for (let uid in this.otherPlayers) {
                // 如果該 UID 不存在於大廳資料，或是全域判斷離線，則予以刪除
                if (!playersData[uid] || !globalOnline[uid]) { 
                    this.otherPlayers[uid].sprite.destroy(); 
                    this.otherPlayers[uid].nameBg.destroy(); 
                    this.otherPlayers[uid].nameText.destroy(); 
                    this.otherPlayers[uid].bubbleBg.destroy(); 
                    this.otherPlayers[uid].bubbleText.destroy(); 
                    delete this.otherPlayers[uid]; 
                }
            }
        }
    }
}

function initPhaser() {
    const config = { type: Phaser.AUTO, parent: 'phaser-app', width: '100%', height: '100%', backgroundColor: '#1a1008', scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { debug: false } }, scene: [ BootScene, MainScene, UIScene ] };
    window.GameLogic.phaserGame = new Phaser.Game(config);
}

// ==========================================
// 3. 系統 UI 事件綁定 (傢俱目錄與設定)
// ==========================================
function openFurnitureCatalog() {
    const isCafe = window.GameLogic.currentScene === "cafe";
    const modal = document.getElementById('furniture-catalog-modal');
    const list = document.getElementById('catalog-list');
    const title = document.getElementById('catalog-title');
    list.innerHTML = "";

    if (isCafe) {
        title.innerText = "📦 大廳家俱目錄";
            const items = [
                { key: 'fridge', name: '🧊 公用大冰箱', img: 'fridge.png' },
                { key: 'memory', name: '📖 咖啡廳回憶錄', img: 'memory.png' },
                { key: 'shrine', name: '⛩️ 洋蔥神龕', img: 'shrine.png' },
                { key: 'dummy', name: '🧍 假人洋蔥', img: 'dummy.png' } 
            ];

        items.forEach(item => {
            let div = document.createElement('div'); div.className = 'catalog-item';
            div.innerHTML = `<img src="${item.img}"><span>${item.name}</span>`;
            div.onclick = () => {
                modal.style.display = 'none';
                let fData = window.GameLogic.cafeFurniture[item.key];
                if (fData && fData.locked) {
                    remove(ref(db, `cafeFurniture/${item.key}`));
                    window.GameLogic.placingFurnitureKey = null;
                    if(window.GameLogic.phaserGame) {
                        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
                        if(scene && scene.localPlayer) {
                            scene.cameras.main.startFollow(scene.localPlayer.sprite, true, 0.08, 0.08);
                        }
                    }
                    sendBubble("傢俱收起來了!");
                } else {
                    let pX = 1024, pY = 1024; 
                    if(window.GameLogic.phaserGame) {
                        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
                        if(scene && scene.localPlayer) { pX = scene.localPlayer.sprite.x; pY = scene.localPlayer.sprite.y - 80; }
                    }
        
                    let newData = { x: pX, y: pY, locked: false, ownerUid: window.GameLogic.currentUser.uid };
                    window.GameLogic.cafeFurniture[item.key] = newData; 
        
                   update(ref(db, `cafeFurniture/${item.key}`), newData);
                   window.GameLogic.placingFurnitureKey = item.key;
               }
         };
            list.appendChild(div);
        });
    } else if (window.GameLogic.currentScene === "doghouse") {
        title.innerText = "🏠 房間家具擺設";
        const items = [
            { key: 'bed', name: '🛏️ 狗窩床鋪', img: 'doghouse-bed.png' }
        ];

        items.forEach(item => {
            let div = document.createElement('div'); div.className = 'catalog-item';
            div.innerHTML = `<img src="${item.img}"><span>${item.name}</span>`;
            div.onclick = () => {
                modal.style.display = 'none';
                let fData = window.GameLogic.doghouseFurniture && window.GameLogic.doghouseFurniture[item.key];
                if (fData && fData.locked) {
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                        module.remove(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${item.key}`));
                    });
                    window.GameLogic.placingFurnitureKey = null;
                    if(window.GameLogic.phaserGame) {
                        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
                        if(scene && scene.localPlayer) {
                            scene.cameras.main.startFollow(scene.localPlayer.sprite, true, 0.08, 0.08);
                        }
                    }
                    sendBubble("傢俱收起來了!");
                } else {
                    let pX = 640, pY = 360; 
                    if(window.GameLogic.phaserGame) {
                        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
                        if(scene && scene.localPlayer) { pX = scene.localPlayer.sprite.x; pY = scene.localPlayer.sprite.y - 80; }
                    }
                    let newData = { x: pX, y: pY, locked: false, ownerUid: window.GameLogic.currentUser.uid };
                    
                    window.GameLogic.doghouseFurniture = window.GameLogic.doghouseFurniture || {};
                    window.GameLogic.doghouseFurniture[item.key] = newData; 
                    
                    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(module => {
                        module.update(module.ref(window.GameLogic.db, `users/${window.GameLogic.currentUser.uid}/doghouseFurniture/${item.key}`), newData);
                    });
                    window.GameLogic.placingFurnitureKey = item.key;
                }
            };
            list.appendChild(div);
        });
    }
    modal.style.display = 'block';
}

document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    if (targetUid === window.GameLogic.currentUser.uid) showProfileModal(window.GameLogic.myProfile, targetUid);
    else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) showProfileModal(snap.val(), targetUid);
    }
});

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
    
    ['name', 'color', 'birth', 'food', 'motto'].forEach(k => { 
        document.getElementById(`vp-${k}`).style.display = k === 'color' ? 'inline-block' : 'inline'; 
        document.getElementById(`edit-${k}`).style.display = 'none'; 
    });

    const isMe = uid === window.GameLogic.currentUser.uid;
    document.getElementById("start-edit-btn").style.display = isMe ? "inline-block" : "none";
    document.getElementById("save-edit-btn").style.display = "none";
    
    viewProfileModal.style.display = "block";
}

document.getElementById("start-edit-btn").addEventListener("click", () => {
    document.getElementById("start-edit-btn").style.display = "none";
    document.getElementById("save-edit-btn").style.display = "inline-block";
    ['name', 'color', 'birth', 'food', 'motto'].forEach(k => {
        let t = document.getElementById(`vp-${k}`); 
        let i = document.getElementById(`edit-${k}`);
        
        if (k === 'color') {
            i.value = window.GameLogic.myProfile.color || '#c5a059';
        } else if (k === 'name') {
            i.value = window.GameLogic.myProfile.name || '匿名';
        } else {
            i.value = t.innerText === '未知' || t.innerText === '無' ? '' : t.innerText;
        }
        t.style.display = 'none'; 
        i.style.display = 'inline-block';
    });
});

document.getElementById("save-edit-btn").addEventListener("click", () => {
    let newData = { 
        name: document.getElementById("edit-name").value.trim() || '匿名',
        color: document.getElementById("edit-color").value || '#c5a059',
        birth: document.getElementById("edit-birth").value.trim() || '未知', 
        food: document.getElementById("edit-food").value.trim() || '無', 
        motto: document.getElementById("edit-motto").value.trim() || '無' 
    };
    
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), newData).then(() => {
        window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...newData };
        
        if (window.GameLogic.currentScene === "cafe") {
            update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { name: newData.name, color: newData.color });
        }
        update(ref(db, `onlinePlayers/${window.GameLogic.currentUser.uid}`), { name: newData.name, color: newData.color });
        
        showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid);
    });
});

document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { 
    if (e.key === "Enter") {
        if (document.activeElement === chatInput) sendChat();
        else if (document.activeElement === document.getElementById("pm-input")) window.sendPM();
    }
});

function sendBubble(msg) {
    if (window.GameLogic.currentUser) {
        window.GameLogic.myProfile.bubbleMsg = msg; window.GameLogic.myProfile.bubbleTime = Date.now();
        if (window.GameLogic.currentScene === "cafe") update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { bubbleMsg: msg, bubbleTime: window.GameLogic.myProfile.bubbleTime });
    }
}

function sendChat() {
    const msg = chatInput.value.trim();
    if (msg !== "" && window.GameLogic.currentUser) {
        const now = new Date();
        push(ref(db, 'chats'), { name: window.GameLogic.myProfile.name, msg: msg, date: now.toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}), time: now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute:'2-digit' }) });
        sendBubble(msg); chatInput.value = ""; 
    }
}

function listenToChat() {
    onValue(ref(db, 'chats'), (snapshot) => {
        const chatBox = document.getElementById("chat-box"); 
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

document.getElementById("upload-memory-btn").onclick = () => {
    const fileInput = document.getElementById("memory-file"); const textInput = document.getElementById("memory-text");
    const file = fileInput.files[0]; const text = textInput.value.trim();

    if (!file && !text) return alert("請上傳圖片或填寫文字！");
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas'); let w = img.width, h = img.height;
                if (w > 300) { h *= 300 / w; w = 300; } cvs.width = w; cvs.height = h;
                cvs.getContext('2d').drawImage(img, 0, 0, w, h);
                saveMemoryToDB(cvs.toDataURL('image/jpeg', 0.7), text);
            }; img.src = e.target.result;
        }; reader.readAsDataURL(file);
    } else saveMemoryToDB("", text);
    fileInput.value = ""; textInput.value = "";
};

function saveMemoryToDB(imgBase64, text) {
    push(ref(db, 'memories'), { uid: window.GameLogic.currentUser.uid, author: window.GameLogic.myProfile.name, img: imgBase64, text: text, time: new Date().toLocaleDateString('zh-TW') });
}

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
}

function listenToMemories() {
    onValue(ref(db, 'memories'), snap => {
        const feed = document.getElementById("memory-feed"); feed.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.keys(data).reverse().forEach(key => {
                let m = data[key];
                let isMine = (m.uid === window.GameLogic.currentUser.uid) || (m.author === window.GameLogic.myProfile.name);
                let delBtnHtml = isMine ? `<button class="del-btn" onclick="window.deleteMemory('${key}')">刪除</button>` : '';
                feed.innerHTML += `<div class="memory-card">${delBtnHtml}<div class="author">${m.author} - ${m.time}</div>${m.img ? `<img src="${m.img}" alt="回憶照片">` : ''}${m.text ? `<div class="text">${m.text}</div>` : ''}</div>`;
            });
        }
    });
}
