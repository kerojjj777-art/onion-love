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
    myProfile: { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0, level: 1, exp: 0, coins: 0, sweeps: 0, lastX: 640, lastY: 360, lastScene: "doghouse" },
    cafePlayers: {},
    cafeFurniture: {},
    placingFurnitureKey: null, 
    phaserGame: null,
    phaserLoaded: false,
    pendingScene: null,
    db: db 
};
let cafeUnsubscribe = null;
let profileViewingUid = null;

// 掛載方法
window.switchScene = switchScene;
window.showProfileModal = showProfileModal;
window.leaveCafe = leaveCafe;
window.signOut = signOut;
window.auth = auth;

// ==========================================
// 動態生成系統 UI 介面 (集中化管理)
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
            .catalog-item { padding: 15px 5px; border: 1px solid var(--mucha-gold); border-radius: 8px; background: #fff; cursor: pointer; font-weight: bold; display: flex; flex-direction: column; align-items: center; }
            .catalog-item:hover { background: rgba(197, 160, 89, 0.2); }
            .catalog-item img { width: 50px; height: 50px; margin-bottom: 5px; object-fit: contain;}

            #chat-section { display: none; position: absolute; top: 60px; left: 20px; width: 280px; flex-direction: column; z-index: 100; pointer-events: none; }            #chat-toggle-btn { pointer-events: auto; background: var(--mucha-gold); color: white; border: none; border-radius: 4px 4px 0 0; padding: 5px 10px; width: fit-content; cursor: pointer; font-size: 12px; font-weight: bold;}
            #chat-content { pointer-events: auto; transition: max-height 0.3s ease-in-out; overflow: hidden; display: flex; flex-direction: column; }
            #chat-box { max-height: 100px; overflow-y: auto; background: rgba(0, 0, 0, 0.5); color: #fff; padding: 8px; border-radius: 0 8px 0 0; margin-bottom: 5px; font-size: 13px; text-shadow: 1px 1px 2px #000; }            #chat-input-area { display: flex; height: 40px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); border-radius: 4px;}
            #chat-input { flex-grow: 1; padding: 8px; border: 2px solid var(--mucha-gold); border-radius: 4px 0 0 4px; background: rgba(244, 236, 216, 0.95); font-family: inherit;}
            #send-btn { padding: 8px 15px; background: var(--mucha-gold); color: white; border: 2px solid var(--mucha-gold); border-radius: 0 4px 4px 0; font-family: inherit; font-weight: bold; cursor: pointer;}
            .chat-collapsed #chat-content { max-height: 0px !important; }
            #top-notification-bar { position: absolute; top: 0; left: 0; width: 100%; padding: 8px 0; background: rgba(0, 0, 0, 0.6); color: #fff; text-align: center; font-size: 14px; z-index: 500; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 2px #000; letter-spacing: 1px; }
        </style>
        
        <div id="top-notification-bar">系統通知：歡迎來到洋蔥交誼廳！</div>
        <div id="action-menu" class="action-menu"><button id="view-profile-btn">洋蔥身分證</button></div>

        <div id="login-screen">
            <h2 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">入館登記</h2>
            <input type="email" id="user-email" placeholder="信箱 Email"><br>
            <input type="password" id="user-pwd" placeholder="密碼"><br>
            <button id="join-btn">推開洋蔥世界之門</button>
        </div>

        <div id="view-profile-modal" class="modal">
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
                <button class="close-modal-btn btn-secondary" onclick="document.getElementById('view-profile-modal').style.display='none'">收起證件</button>
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
    `;
}

createSystemUI();

const loginScreen = document.getElementById("login-screen");
const gameLayoutContainer = document.getElementById("game-layout-container");
const chatSection = document.getElementById("chat-section");
const actionMenu = document.getElementById("action-menu");
const viewProfileModal = document.getElementById("view-profile-modal");
const chatInput = document.getElementById("chat-input");

// ==========================================
// PWA 與 系統基礎事件綁定
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{}); 
}

window.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#action-menu') && e.target.tagName !== 'CANVAS') {
        actionMenu.style.display = 'none';
    }
});

document.getElementById('chat-toggle-btn').addEventListener('click', function() {
    chatSection.classList.toggle('chat-collapsed');
    this.innerText = chatSection.classList.contains('chat-collapsed') ? '展開對話 ▼' : '收起對話 ▲';
    if (!chatSection.classList.contains('chat-collapsed')) {
        const chatBox = document.getElementById("chat-box");
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

// ==========================================
// 1. 登入與場景切換
// ==========================================
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
        } else {
            set(ref(db, `users/${user.uid}`), window.GameLogic.myProfile);
        }

        onValue(ref(db, 'cafeFurniture'), snap => window.GameLogic.cafeFurniture = snap.val() || {});

        // 監聽全域的神龕傳送事件
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
    }
});

function switchScene(sceneName) {
    if (window.GameLogic.currentUser && window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) {
        let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
        if (scene && scene.localPlayer) {
            update(ref(db, `users/${window.GameLogic.currentUser.uid}`), {
                lastScene: sceneName, lastX: scene.localPlayer.sprite.x, lastY: scene.localPlayer.sprite.y
            });
            window.GameLogic.myProfile.lastScene = sceneName;
            window.GameLogic.myProfile.lastX = scene.localPlayer.sprite.x;
            window.GameLogic.myProfile.lastY = scene.localPlayer.sprite.y;
        }
    }

    window.GameLogic.currentScene = sceneName;
    window.GameLogic.placingFurnitureKey = null; 
    
    if (sceneName === "doghouse" || sceneName === "farm" || sceneName === "shrine") {
        chatSection.style.display = "none";
        leaveCafe();
    } else if (sceneName === "cafe") {
        chatSection.style.display = "flex";
        joinCafe();
    }

    if (window.GameLogic.phaserGame && window.GameLogic.phaserLoaded) {
        const game = window.GameLogic.phaserGame;
        game.scene.stop('MainScene');
        game.scene.start('MainScene'); 
        // 修正: 確保切換場景後，UI 圖層永遠保持在最上層，不會被覆蓋
        game.scene.bringToTop('UIScene');
    }
}

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`);
    set(playerRef, { 
        x: window.GameLogic.myProfile.lastX || 1024, 
        y: window.GameLogic.myProfile.lastY || 1024, 
        name: window.GameLogic.myProfile.name, 
        color: window.GameLogic.myProfile.color, 
        level: window.GameLogic.myProfile.level || 1, // 【新增此行】廣播等級資訊
        bubbleMsg: window.GameLogic.myProfile.bubbleMsg, 
        bubbleTime: window.GameLogic.myProfile.bubbleTime 
    });
    onDisconnect(playerRef).remove(); 
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => window.GameLogic.cafePlayers = snapshot.val() || {});
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
        // 修正: GitHub raw 會阻擋 JS 執行，改用 jsDelivr CDN 確保不會在 Github Pages 上死機
        this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/gh/rexrainbow/phaser3-rex-notes@master/dist/rexvirtualjoystickplugin.min.js', true);
        
        this.load.image('bgCafe', 'cafe-bg.jpg');
        this.load.image('bgDoghouse', 'doghouse-bg.jpg');
        this.load.image('bgFarm', 'farm-bg.jpg');
        this.load.image('bgShrine', 'shrine-bg.jpg'); 
        this.load.image('fridge', 'fridge.png');
        this.load.image('memory', 'memory.png');
        this.load.image('shrine', 'shrine.png'); 
        this.load.spritesheet('onion-skin', 'onion-skin-sprite.png', { frameWidth: 50, frameHeight: 50 });
        this.load.spritesheet('onion', 'onion-sprite.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-down', 'onion-down.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-up', 'onion-up.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-walk', 'onion-right.png', { frameWidth: 75, frameHeight: 75 });
        this.load.spritesheet('onion-idle', 'onion-idle.png', { frameWidth: 75, frameHeight: 75 });
    }
    create() {
        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('onion-down'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('onion-up'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('onion-walk', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('onion-idle'), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'skin-anim', frames: this.anims.generateFrameNumbers('onion-skin', { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
        
        this.scene.launch('UIScene');
        this.scene.bringToTop('UIScene'); // 確保剛載入時 UI 在最頂
        
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
        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            radius: 40,
            base: this.add.circle(0, 0, 40, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059),
            thumb: this.add.circle(0, 0, 20, 0xc5a059, 0.8)
        });

        this.btnA = this.add.circle(0, 0, 30, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtA = this.add.text(0, 0, 'A', { fontSize: '24px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);
        this.btnB = this.add.circle(0, 0, 25, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtB = this.add.text(0, 0, 'B', { fontSize: '20px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);
        this.mapBtn = this.add.circle(0, 0, 25, 0x4a5d4e).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.mapText = this.add.text(0, 0, '選單', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        this.furnBtn = this.add.circle(0, 0, 25, 0x8b5a2b).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.furnText = this.add.text(0, 0, '家俱', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.menuContainer = this.add.container(0, 0).setVisible(false).setDepth(200);
        const menuBg = this.add.graphics();
        menuBg.fillStyle(0xf4ecd8, 0.95); menuBg.lineStyle(2, 0xc5a059, 1);
        menuBg.fillRoundedRect(0, 0, 160, 260, 10); menuBg.strokeRoundedRect(0, 0, 160, 260, 10);
        this.menuContainer.add(menuBg);

        const menuOptions = [
            { text: '🏠 我的狗窩', action: () => { window.switchScene('doghouse'); this.menuContainer.setVisible(false); } },
            { text: '☕ 洋蔥大廳', action: () => { window.switchScene('cafe'); this.menuContainer.setVisible(false); } },
            { text: '🌱 我的蔥田', action: () => { window.switchScene('farm'); this.menuContainer.setVisible(false); } },
            { text: '🆔 洋蔥身分證', action: () => { window.showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid); this.menuContainer.setVisible(false); } },
            { text: '🚪 登出大廳', action: () => { window.leaveCafe(); window.signOut(window.auth); this.menuContainer.setVisible(false); } }
        ];

        menuOptions.forEach((opt, idx) => {
            let btn = this.add.text(80, 30 + idx * 50, opt.text, { fontSize: '18px', color: '#3e2723', fontFamily: 'Georgia', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
            btn.on('pointerdown', opt.action);
            this.menuContainer.add(btn);
        });

        this.mapBtn.on('pointerdown', () => {
            this.menuContainer.setVisible(!this.menuContainer.visible);
            document.getElementById('furniture-catalog-modal').style.display = 'none';
        });

        this.furnBtn.on('pointerdown', () => {
            if (this.furnText.text === '農具') return alert("農具選單尚未開放！");
            this.menuContainer.setVisible(false);
            openFurnitureCatalog();
        });

        this.aPressTime = 0;
        this.btnA.on('pointerdown', () => { this.btnA.setFillStyle(0xc5a059); this.aPressTime = Date.now(); });
        this.btnA.on('pointerup', () => { 
            this.btnA.setFillStyle(0xd4c5a0);
            let duration = Date.now() - this.aPressTime;
            const mainScene = this.scene.manager.getScene('MainScene');
            if(mainScene) {
                if (window.GameLogic.placingFurnitureKey) mainScene.events.emit('action_A_place');
                else if (duration > 500) mainScene.events.emit('action_A_long');
                else mainScene.events.emit('action_A_short');
            }
        });
        
        this.btnB.on('pointerdown', () => { 
            this.btnB.setFillStyle(0xc5a059);
            const mainScene = this.scene.manager.getScene('MainScene');
            if (mainScene) mainScene.events.emit('action_B');
        });
        this.btnB.on('pointerup', () => this.btnB.setFillStyle(0xd4c5a0));
        
        this.scale.on('resize', this.resizeUI, this);
        this.resizeUI(this.scale.gameSize);
    }

    resizeUI(gameSize) {
        if (!this.joyStick) return;
        const safeMargin = 80;
        const isPortrait = gameSize.height > gameSize.width;
        const bottomOffset = isPortrait ? 120 : 20; 

        this.joyStick.setPosition(safeMargin + 20, gameSize.height - safeMargin - bottomOffset);
        this.btnA.setPosition(gameSize.width - safeMargin, gameSize.height - safeMargin - bottomOffset + 20);
        this.txtA.setPosition(this.btnA.x, this.btnA.y);
        this.btnB.setPosition(gameSize.width - safeMargin - 70, gameSize.height - safeMargin - bottomOffset + 20);
        this.txtB.setPosition(this.btnB.x, this.btnB.y);
        
        this.mapBtn.setPosition(gameSize.width - safeMargin, gameSize.height - safeMargin - 70 - bottomOffset + 20);
        this.mapText.setPosition(this.mapBtn.x, this.mapBtn.y);
        this.furnBtn.setPosition(gameSize.width - safeMargin - 70, gameSize.height - safeMargin - 70 - bottomOffset + 20);
        this.furnText.setPosition(this.furnBtn.x, this.furnBtn.y);
        
        this.menuContainer.setPosition(gameSize.width - 240, gameSize.height - 380 - bottomOffset);
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    
    create() {
        this.cameras.main.setBackgroundColor('#1a1008');
        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        
        const mapW = this.isCafe ? 2048 : (this.sceneName === "shrine" ? 1280 : 1280);
        const mapH = this.isCafe ? 2048 : (this.sceneName === "shrine" ? 720 : 720);
        
        this.physics.world.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        if (this.isCafe) {
            this.add.tileSprite(0, 0, mapW, mapH, 'bgCafe').setOrigin(0, 0);
            this.time.addEvent({ delay: 2000, callback: this.spawnTrash, callbackScope: this, loop: true });

            const mapSize = 120; const marginX = 20; const marginY = 60; // 調整 Y 軸 margin 將其往下挪
            this.minimap = this.cameras.add(this.cameras.main.width - mapSize - marginX, marginY, mapSize, mapSize)
                .setZoom(mapSize / 2048).setName('minimap');
            this.minimap.setBackgroundColor('rgba(26, 16, 8, 0.7)');
            this.minimap.centerOn(1024, 1024);

            this.scale.on('resize', (gameSize) => { if (this.minimap) this.minimap.setPosition(gameSize.width - mapSize - marginX, marginY); });
        } else if (this.sceneName === "doghouse") {
            this.add.image(mapW/2, mapH/2, 'bgDoghouse').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "farm") {
            this.add.image(mapW/2, mapH/2, 'bgFarm').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "shrine") {
            this.add.image(mapW/2, mapH/2, 'bgShrine').setDisplaySize(mapW, mapH);
        }

        const uiScene = this.scene.manager.getScene('UIScene');
        if (uiScene && uiScene.furnText) uiScene.furnText.setText(this.sceneName === 'farm' ? '農具' : '家俱');

        this.otherPlayers = {}; this.furnitureSprites = {}; this.trashes = []; 

        let startX = window.GameLogic.myProfile.lastX || mapW / 2;
        let startY = window.GameLogic.myProfile.lastY || mapH / 2;
        
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true);
        this.localPlayer.isSweeping = false;
        
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        this.smartPromptBg = this.add.graphics().setDepth(100).setVisible(false);
        this.smartPromptText = this.add.text(0, 0, '', { fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', color: '#4a5d4e' }).setOrigin(0.5).setDepth(101).setVisible(false);
        if (this.minimap) this.minimap.ignore([this.smartPromptBg, this.smartPromptText]);

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

        this.events.on('action_A_place', () => {
            let key = window.GameLogic.placingFurnitureKey;
            if(key && this.furnitureSprites[key]) {
                let f = this.furnitureSprites[key];
                f.sprite.setVelocity(0, 0); 
                update(ref(window.GameLogic.db, `cafeFurniture/${key}`), { 
                    locked: true, x: f.sprite.x, y: f.sprite.y, ownerUid: window.GameLogic.currentUser.uid 
                });
                window.GameLogic.placingFurnitureKey = null;
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08); 
            }
        });

        this.events.on('action_A_short', () => {
            if (this.localPlayer.isSweeping) {
                this.qteProgress += (100 / this.qteTotalClicks);
                if (this.qteProgress >= 100) {
                    this.qteProgress = 100;
                    this.finishSweeping(true);
                }
                return;
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
    }

    spawnTrash() {
        if (!this.isCafe) return;
        let playerCount = Object.keys(window.GameLogic.cafePlayers || {}).length || 1;
        
        let maxTrash = Math.floor(Math.min(10 + Math.max(0, playerCount - 1) * 2.5, 20));
        let spawnChance = 0.3 + (playerCount * 0.05); 
        
        if (Math.random() < spawnChance && this.trashes.length < maxTrash) { 
            let tx = Phaser.Math.Between(150, 1898); 
            let ty = Phaser.Math.Between(150, 1898);
            let skin = this.physics.add.sprite(tx, ty, 'onion-skin').setDepth(4);
            skin.play('skin-anim');
            skin.type = 'onion-skin';
            this.trashes.push(skin);
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
        
        // 【修改點】組合暱稱與等級字串
        let displayName = `${pData.name || '匿名'} (Lv.${pData.level || 1})`;
        entity.nameText.setText(displayName);
        if(pData.color) entity.nameText.setColor(pData.color);

        // 【修改點】讓背景黑框根據文字長度動態調整寬度
        const nameBounds = entity.nameText.getBounds();
        const bgWidth = nameBounds.width + 16; 
        entity.nameBg.clear().fillStyle(0x000000, 0.6).fillRoundedRect(sx - bgWidth / 2, sy - 55, bgWidth, 20, 4);
        entity.nameText.setPosition(sx, sy - 45);
        // --- (以下氣泡框 bubbleMsg 的邏輯保留原本的即可) ---
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
        let imgKey = key.includes('fridge') ? 'fridge' : (key.includes('shrine') ? 'shrine' : 'memory');
        let f = { sprite: this.physics.add.sprite(data.x, data.y, imgKey).setDepth(5).setCollideWorldBounds(true) };
        f.sprite.isLocked = data.locked;
        return f;
    }

    finishSweeping(success) {
        this.localPlayer.isSweeping = false;
        this.qteContainer.setVisible(false);

        if (success && this.closestTrash) {
            let px = this.localPlayer.sprite.x; let py = this.localPlayer.sprite.y - 40; 
            
            this.closestTrash.destroy();
            this.trashes = this.trashes.filter(t => t !== this.closestTrash);
            this.closestTrash = null;
            
            let coinsEarned = Phaser.Math.Between(3, 5);
            let leveledUp = gainRewards(coinsEarned, 10);
            
            let txt = `✨ 打掃成功 ✨\n+${coinsEarned} 馬德幣! +10 EXP`;
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
            this.localPlayer.sprite.play('walk-down', true); 
            this.qteProgress -= (delta * 0.02); if (this.qteProgress < 0) this.qteProgress = 0;
            this.updateQTEBar(this.qteProgress);
            if (this.closestTrash) this.qteContainer.setPosition(this.closestTrash.x, this.closestTrash.y + 40);
            this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false);
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

            let isPlacing = window.GameLogic.placingFurnitureKey !== null && this.isCafe;

            if (isPlacing) {
                this.localPlayer.sprite.setVelocity(0, 0).play('idle', true);
                let f = this.furnitureSprites[window.GameLogic.placingFurnitureKey];
                if (f && f.sprite && f.sprite.active) {
                    f.sprite.setVelocity(vx, vy);
                    this.cameras.main.startFollow(f.sprite, true, 0.1, 0.1);
                    this.placePrompt.setPosition(f.sprite.x, f.sprite.y - 80).setVisible(true);
                    if (vx !== 0 || vy !== 0) {
                        if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                            update(ref(window.GameLogic.db, `cafeFurniture/${window.GameLogic.placingFurnitureKey}`), { x: f.sprite.x, y: f.sprite.y });
                            this.lastSyncTime = Date.now();
                        }
                    }
            } else if (!window.GameLogic.cafeFurniture[window.GameLogic.placingFurnitureKey]) {
                    // 修正：只有當這件家俱真的不存在(或被收起)時，才取消選取狀態，避免因精靈圖尚未生成的 1 幀落差導致取消
                    window.GameLogic.placingFurnitureKey = null;
                    this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                }
            } else {
                this.placePrompt.setVisible(false);
                this.localPlayer.sprite.setVelocity(vx, vy);
                this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                
// 【修正點】：加入浮點數死區過濾誤差，並比較主要移動軸
                let absX = Math.abs(vx);
                let absY = Math.abs(vy);

                if (absX < 1) vx = 0; // 過濾掉極小的浮點數
                if (absY < 1) vy = 0;

                if (vx === 0 && vy === 0) {
                    this.localPlayer.sprite.play('idle', true);
                } else if (absX >= absY) {
                    // 當橫向移動大於或等於縱向時，以左右動畫為主
                    this.localPlayer.sprite.setFlipX(vx < 0);
                    this.localPlayer.sprite.play('walk', true);
                } else {
                    // 當縱向移動較大時，以上下動畫為主
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
                    else promptMsg = "按A打開回憶錄"; 
                }
            }
            for (let t of this.trashes) {
                if (!t.active) continue;
                let d = Phaser.Math.Distance.Between(px, py, t.x, t.y);
                if (d < minDist) { minDist = d; promptTarget = t; promptMsg = "按B使出掃地"; this.closestTrash = t; }
            }

            if (promptTarget && !isPlacing) {
                this.smartPromptText.setText(promptMsg).setVisible(true);
                const pBounds = this.smartPromptText.getBounds(); const pWidth = pBounds.width + 16, pHeight = pBounds.height + 8, ptX = promptTarget.x, ptY = promptTarget.y - 60; 
                this.smartPromptBg.clear().fillStyle(0xf4ecd8, 0.95).lineStyle(2, 0xc5a059, 1).fillRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).strokeRoundedRect(ptX - pWidth/2, ptY - pHeight/2, pWidth, pHeight, 6).setVisible(true);
                this.smartPromptText.setPosition(ptX, ptY);
            } else { this.smartPromptBg.setVisible(false); this.smartPromptText.setVisible(false); }
        }

        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        if (this.isCafe) {
            const playersData = window.GameLogic.cafePlayers;
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let pd = playersData[uid]; pd.uid = uid;
                if (!this.otherPlayers[uid]) this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                
                let op = this.otherPlayers[uid];
                let oldX = op.sprite.x;
                let oldY = op.sprite.y;
                
                op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2);
                op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2);
                
                // === 新增：判斷其他玩家位移，並播放對應的精靈圖 ===
                let diffX = op.sprite.x - oldX;
                let diffY = op.sprite.y - oldY;
                let absX = Math.abs(diffX);
                let absY = Math.abs(diffY);

                if (absX < 0.5 && absY < 0.5) {
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
                // ===========================================

                this.updatePlayerEntity(op, pd);
            }
            for (let uid in this.otherPlayers) {
                if (!playersData[uid]) { this.otherPlayers[uid].sprite.destroy(); this.otherPlayers[uid].nameBg.destroy(); this.otherPlayers[uid].nameText.destroy(); this.otherPlayers[uid].bubbleBg.destroy(); this.otherPlayers[uid].bubbleText.destroy(); delete this.otherPlayers[uid]; }
            }

            const furnData = window.GameLogic.cafeFurniture;
            for (let key in furnData) {
                let fd = furnData[key];
                if (!this.furnitureSprites[key]) this.furnitureSprites[key] = this.createFurniture(key, fd);
                let f = this.furnitureSprites[key]; f.sprite.isLocked = fd.locked;
                if(window.GameLogic.placingFurnitureKey !== key) { f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3); f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3); }
                f.sprite.setAlpha(!fd.locked ? 0.6 : 1);
            }
            for (let key in this.furnitureSprites) {
                if (!furnData[key]) {
                    if (window.GameLogic.placingFurnitureKey === key) {
                        window.GameLogic.placingFurnitureKey = null;
                        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
                    }
                    this.furnitureSprites[key].sprite.destroy(); 
                    delete this.furnitureSprites[key]; 
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
            { key: 'shrine', name: '⛩️ 洋蔥神龕', img: 'shrine.png' }
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
                     // 【新增此行】預先更新本地端狀態，避免 Phaser update 迴圈因 Firebase 延遲而取消選取
                    window.GameLogic.cafeFurniture[item.key] = newData; 
        
                   update(ref(db, `cafeFurniture/${item.key}`), newData);
                   window.GameLogic.placingFurnitureKey = item.key;
               }
         };
            list.appendChild(div);
        });
    } else if (window.GameLogic.currentScene === "doghouse") {
        title.innerText = "🏠 房間家具擺設 (建置中)";
        list.innerHTML = "<div style='grid-column: span 2; text-align:center; padding: 20px; color: #888;'>此處可見自己擁有的專屬傢俱，未來將陸續更新。</div>";
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
    
    // 【修改點】綁定姓名與顏色的顯示
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
        
        // 【修改點】針對不同欄位給予預設編輯值
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
    // 【修改點】打包 Name 與 Color 送進資料庫
    let newData = { 
        name: document.getElementById("edit-name").value.trim() || '匿名',
        color: document.getElementById("edit-color").value || '#c5a059',
        birth: document.getElementById("edit-birth").value.trim() || '未知', 
        food: document.getElementById("edit-food").value.trim() || '無', 
        motto: document.getElementById("edit-motto").value.trim() || '無' 
    };
    
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), newData).then(() => {
        window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...newData };
        
        // 若使用者在大廳中，同步更新大廳中的玩家名稱與顏色
        if (window.GameLogic.currentScene === "cafe") {
            update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { name: newData.name, color: newData.color });
        }
        showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid);
    });
});

document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { if (e.key === "Enter" && document.activeElement === chatInput) sendChat(); });

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
            Object.values(chats).forEach(c => {
                chatBox.innerHTML += `<div style="margin-bottom: 4px;"><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg} <span style="font-size:10px; color:#bbb; margin-left:8px;">${c.date||''} ${c.time||''}</span></div>`;
                lastMsg = `${c.name}：${c.msg}`; // 記錄最後一筆對話
            });
            
            // 更新頂部全域通知欄
            const topBar = document.getElementById("top-notification-bar");
            if (topBar && lastMsg) {
                topBar.innerText = `💬 最新發言｜ ${lastMsg}`;
            }

            // 強制畫面重繪後，再進行捲動，確保永遠停在最新對話
            requestAnimationFrame(() => {
                setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 10);
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
        // 【修正】兼容舊資料沒有 uid 的情況，加上暱稱的比對
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
                // 【修正】兼容舊資料沒有 uid 的情況，加上暱稱的比對
                let isMine = (m.uid === window.GameLogic.currentUser.uid) || (m.author === window.GameLogic.myProfile.name);
                let delBtnHtml = isMine ? `<button class="del-btn" onclick="window.deleteMemory('${key}')">刪除</button>` : '';
                feed.innerHTML += `<div class="memory-card">${delBtnHtml}<div class="author">${m.author} - ${m.time}</div>${m.img ? `<img src="${m.img}" alt="回憶照片">` : ''}${m.text ? `<div class="text">${m.text}</div>` : ''}</div>`;
            });
        }
    });
}
