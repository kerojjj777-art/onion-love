import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    myProfile: { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0 },
    cafePlayers: {},
    cafeFurniture: {},
    placingFurnitureKey: null, 
    phaserGame: null,
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
// 動態生成系統 UI 介面
// ==========================================
function createSystemUI() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    appContainer.innerHTML = `
        <div id="action-menu" class="action-menu">
            <button id="view-profile-btn">洋蔥身分證</button>
        </div>

        <div id="login-screen">
            <h2 style="color: var(--mucha-green); border-bottom: 2px solid var(--mucha-gold); padding-bottom: 10px;">入館登記</h2>
            <input type="email" id="user-email" placeholder="信箱 Email"><br>
            <input type="password" id="user-pwd" placeholder="密碼"><br>
            <button id="join-btn">推開洋蔥世界之門</button>
        </div>

        <div id="view-profile-modal" class="modal">
            <h3 id="vp-title">洋蔥身分證</h3>
            <div class="profile-line">
                <span>🎂 生日:</span>
                <strong id="vp-birth"></strong>
                <input type="text" id="edit-birth" style="display:none;">
            </div>
            <div class="profile-line">
                <span>🍛 最愛:</span>
                <strong id="vp-food"></strong>
                <input type="text" id="edit-food" style="display:none;">
            </div>
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
            <h3>📦 家俱倉庫目錄</h3>
            <div id="catalog-list">
                <div class="catalog-item" data-key="fridge">🧊 公用大冰箱</div>
                <div class="catalog-item" data-key="memory">📖 咖啡廳回憶錄</div>
            </div>
            <button class="close-modal-btn btn-secondary" onclick="document.getElementById('furniture-catalog-modal').style.display='none'">關閉目錄</button>
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

// 執行 UI 初始化
createSystemUI();

// --- DOM 元素 (須在 UI 生成後才能綁定) ---
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
    navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    if (confirm('發現新的更新！是否立即重新載入？')) window.location.reload();
                }
            });
        });
    });
}

// 點擊畫面其他地方關閉浮動選單
window.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#action-menu') && e.target.tagName !== 'CANVAS') {
        actionMenu.style.display = 'none';
    }
});

// 聊天室收合功能
document.getElementById('chat-toggle-btn').addEventListener('click', function() {
    chatSection.classList.toggle('chat-collapsed');
    if (chatSection.classList.contains('chat-collapsed')) {
        this.innerText = '展開對話 ▼';
    } else {
        this.innerText = '收起對話 ▲';
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
        if (profileSnap.exists()) window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...profileSnap.val() };
        else set(ref(db, `users/${user.uid}`), { name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, birth: window.GameLogic.myProfile.birth, food: window.GameLogic.myProfile.food, motto: window.GameLogic.myProfile.motto });

        onValue(ref(db, 'cafeFurniture'), snap => window.GameLogic.cafeFurniture = snap.val() || {});

        if (!window.GameLogic.phaserGame) initPhaser();

        switchScene("doghouse"); 
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
    window.GameLogic.currentScene = sceneName;
    window.GameLogic.placingFurnitureKey = null; // 切換場景取消擺放
    
    if (sceneName === "doghouse" || sceneName === "farm") {
        chatSection.style.display = "none";
        leaveCafe();
    } else if (sceneName === "cafe") {
        chatSection.style.display = "flex";
        joinCafe();
    }

    if (window.GameLogic.phaserGame) {
        const game = window.GameLogic.phaserGame;
        game.scene.stop('MainScene');
        game.scene.start('MainScene'); 
    }
}

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`);
    set(playerRef, { x: 1024, y: 1024, name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, bubbleMsg: window.GameLogic.myProfile.bubbleMsg, bubbleTime: window.GameLogic.myProfile.bubbleTime });
    onDisconnect(playerRef).remove(); 
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => window.GameLogic.cafePlayers = snapshot.val() || {});
}

function leaveCafe() {
    if (window.GameLogic.currentUser) set(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), null);
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

// ==========================================
// 2. Phaser 3 引擎架構
// ==========================================
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
        this.load.image('bgCafe', 'cafe-bg.jpg');
        this.load.image('bgDoghouse', 'doghouse-bg.jpg');
        this.load.image('bgFarm', 'farm-bg.jpg');
        this.load.image('fridge', 'fridge.png');
        this.load.image('memory', 'memory.png');
        this.load.spritesheet('onion', 'onion-sprite.png', { frameWidth: 50, frameHeight: 50 });
    }
    create() {
        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('onion', { start: 0, end: 0 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('onion', { start: 0, end: 0 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('onion', { start: 0, end: 0 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('onion', { start: 0, end: 0 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'idle', frames: [{ key: 'onion', frame: 0 }], frameRate: 10 });
        this.scene.launch('UIScene');
    }
}

class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }
    create() {
        const safeMargin = 100;

        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: safeMargin, y: this.cameras.main.height - safeMargin,
            radius: 40,
            base: this.add.circle(0, 0, 40, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059),
            thumb: this.add.circle(0, 0, 20, 0xc5a059, 0.8)
        });

        this.btnA = this.add.circle(this.cameras.main.width - safeMargin, this.cameras.main.height - safeMargin, 30, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtA = this.add.text(this.btnA.x, this.btnA.y, 'A', { fontSize: '24px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);
        
        this.btnB = this.add.circle(this.cameras.main.width - safeMargin - 70, this.cameras.main.height - safeMargin + 20, 25, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtB = this.add.text(this.btnB.x, this.btnB.y, 'B', { fontSize: '20px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);

        this.mapBtn = this.add.circle(this.cameras.main.width - safeMargin, this.cameras.main.height - safeMargin - 90, 25, 0x4a5d4e).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.mapText = this.add.text(this.mapBtn.x, this.mapBtn.y, '地圖', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.furnBtn = this.add.circle(this.cameras.main.width - safeMargin, this.cameras.main.height - safeMargin - 160, 25, 0x8b5a2b).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.furnText = this.add.text(this.furnBtn.x, this.furnBtn.y, '家俱', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        this.menuContainer = this.add.container(this.cameras.main.width - 200, this.cameras.main.height - 450).setVisible(false).setDepth(200);
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
            if(window.GameLogic.currentScene !== 'cafe') {
                alert("家俱只能在洋蔥大廳擺放喔！"); return;
            }
            this.menuContainer.setVisible(false);
            const furnModal = document.getElementById('furniture-catalog-modal');
            furnModal.style.display = furnModal.style.display === 'block' ? 'none' : 'block';
        });

        this.aPressTime = 0;
        this.btnA.on('pointerdown', () => { 
            this.btnA.setFillStyle(0xc5a059); 
            this.aPressTime = Date.now();
        });
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
        
        this.btnB.on('pointerdown', () => { this.btnB.setFillStyle(0xc5a059); sendBubble("使用了 B 技能!"); });
        this.btnB.on('pointerup', () => this.btnB.setFillStyle(0xd4c5a0));
        
        this.scale.on('resize', (gameSize) => {
            this.joyStick.setPosition(safeMargin, gameSize.height - safeMargin);
            this.btnA.setPosition(gameSize.width - safeMargin, gameSize.height - safeMargin);
            this.txtA.setPosition(this.btnA.x, this.btnA.y);
            this.btnB.setPosition(gameSize.width - safeMargin - 70, gameSize.height - safeMargin + 20);
            this.txtB.setPosition(this.btnB.x, this.btnB.y);
            this.mapBtn.setPosition(gameSize.width - safeMargin, gameSize.height - safeMargin - 90);
            this.mapText.setPosition(this.mapBtn.x, this.mapBtn.y);
            this.furnBtn.setPosition(gameSize.width - safeMargin, gameSize.height - safeMargin - 160);
            this.furnText.setPosition(this.furnBtn.x, this.furnBtn.y);
            this.menuContainer.setPosition(gameSize.width - 200, gameSize.height - 450);
        });
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    
    create() {
        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        
        const mapW = this.isCafe ? 2048 : 1280;
        const mapH = this.isCafe ? 2048 : 720;
        
        this.physics.world.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        if (this.isCafe) {
            this.add.tileSprite(0, 0, mapW, mapH, 'bgCafe').setOrigin(0, 0);
        } else if (this.sceneName === "doghouse") {
            this.add.image(mapW/2, mapH/2, 'bgDoghouse').setDisplaySize(mapW, mapH);
        } else if (this.sceneName === "farm") {
            this.add.image(mapW/2, mapH/2, 'bgFarm').setDisplaySize(mapW, mapH);
        }

        this.otherPlayers = {};
        this.furnitureSprites = {};

        let startX = mapW / 2;
        let startY = mapH / 2;
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true);
        
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        this.placePrompt = this.add.text(0, 0, '洋蔥精靈: 按A確定擺放', { 
            fontSize: '14px', fontFamily: 'Georgia', fontStyle: 'bold', 
            color: '#fff', backgroundColor: 'rgba(74, 93, 78, 0.8)', padding: {x:8, y:4} 
        }).setOrigin(0.5).setDepth(20).setVisible(false);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        this.events.on('action_A_place', () => {
            let key = window.GameLogic.placingFurnitureKey;
            if(key && this.furnitureSprites[key]) {
                let f = this.furnitureSprites[key];
                update(ref(window.GameLogic.db, `cafeFurniture/${key}`), { 
                    locked: true, x: f.sprite.x, y: f.sprite.y 
                });
                window.GameLogic.placingFurnitureKey = null;
            }
        });

        this.events.on('action_A_short', () => {
            if(!this.isCafe) return sendBubble("對著空氣揮舞了雙手!");
            let interacted = false;
            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                if (!f.sprite.isLocked) continue;
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                if (dist < 90) { 
                    if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                    if (key === 'memory') document.getElementById('memory-modal').style.display = 'block';
                    interacted = true; break;
                }
            }
            if(!interacted) sendBubble("使用了 A 技能!");
        });

        this.events.on('action_A_long', () => {
            if(!this.isCafe) return sendBubble("使用了集氣 A 技能!");
            let interacted = false;
            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                if (!f.sprite.isLocked) continue;
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                if (dist < 90) { 
                    if(confirm("洋蔥精靈：是否收回這件家俱？")) {
                        set(ref(window.GameLogic.db, `cafeFurniture/${key}`), null);
                    }
                    interacted = true; break;
                }
            }
            if(!interacted) sendBubble("使用了集氣 A 技能!");
        });
    }

    createPlayerEntity(x, y, pData, isLocal = false) {
        let entity = {};
        entity.sprite = this.physics.add.sprite(x, y, 'onion');
        entity.sprite.setCollideWorldBounds(true);
        entity.sprite.setDepth(10);
        
        if (!isLocal) {
            entity.sprite.setInteractive();
            entity.sprite.on('pointerdown', (pointer) => {
                actionMenu.style.display = "flex";
                actionMenu.style.left = pointer.event.pageX + "px";
                actionMenu.style.top = pointer.event.pageY + "px";
                actionMenu.dataset.uid = pData.uid;
            });
        }

        entity.nameBg = this.add.graphics().setDepth(11);
        entity.nameText = this.add.text(x, y, pData.name || '匿名', { fontSize: '13px', fontFamily: 'Georgia', color: pData.color || '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
        
        entity.bubbleBg = this.add.graphics().setDepth(13).setVisible(false);
        entity.bubbleText = this.add.text(x, y, '', { 
            fontSize: '14px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold',
            wordWrap: { width: 160, useAdvancedWrap: true }, align: 'center'
        }).setOrigin(0.5).setDepth(14).setVisible(false);

        return entity;
    }

    updatePlayerEntity(entity, pData) {
        let sx = entity.sprite.x; let sy = entity.sprite.y;
        
        entity.nameBg.clear();
        entity.nameBg.fillStyle(0x000000, 0.6);
        entity.nameBg.fillRoundedRect(sx - 35, sy - 55, 70, 20, 4);
        entity.nameText.setPosition(sx, sy - 45);
        if(pData.name) entity.nameText.setText(pData.name);
        if(pData.color) entity.nameText.setColor(pData.color);

        if (pData.bubbleMsg && (Date.now() - pData.bubbleTime < 10000)) { 
            entity.bubbleBg.setVisible(true); entity.bubbleText.setVisible(true);
            entity.bubbleText.setText(pData.bubbleMsg);

            const bounds = entity.bubbleText.getBounds();
            const paddingX = 10, paddingY = 8;
            const boxWidth = bounds.width + paddingX * 2;
            const boxHeight = bounds.height + paddingY * 2;
            const boxX = sx - boxWidth / 2;
            const boxY = sy - 65 - boxHeight; 

            entity.bubbleBg.clear();
            entity.bubbleBg.fillStyle(0xf4ecd8, 0.95);
            entity.bubbleBg.lineStyle(2, 0xc5a059, 1);
            entity.bubbleBg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
            entity.bubbleBg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
            entity.bubbleText.setPosition(sx, boxY + boxHeight / 2);
        } else {
            entity.bubbleBg.setVisible(false); entity.bubbleText.setVisible(false);
        }
    }

    createFurniture(key, data) {
        let f = { sprite: null, isLocked: data.locked, furnitureKey: key };
        let imgKey = key === 'fridge' ? 'fridge' : 'memory';
        f.sprite = this.physics.add.sprite(data.x, data.y, imgKey).setDepth(5).setCollideWorldBounds(true);
        f.sprite.furnitureKey = key;
        f.sprite.isLocked = data.locked;
        return f;
    }

    update() {
        if (!window.GameLogic.currentUser) return;
        
        let vx = 0; let vy = 0; let speed = 180;
        const uiScene = this.scene.manager.getScene('UIScene');
        
        if (uiScene && uiScene.joyStick && uiScene.joyStick.force > 0) {
            vx = Math.cos(uiScene.joyStick.angle * Math.PI / 180) * speed;
            vy = Math.sin(uiScene.joyStick.angle * Math.PI / 180) * speed;
        } else {
            if (this.cursors.left.isDown || this.wasd.a.isDown) vx = -speed;
            if (this.cursors.right.isDown || this.wasd.d.isDown) vx = speed;
            if (this.cursors.up.isDown || this.wasd.w.isDown) vy = -speed;
            if (this.cursors.down.isDown || this.wasd.s.isDown) vy = speed;
            if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; } 
        }

        let isPlacing = window.GameLogic.placingFurnitureKey !== null && this.isCafe;

        if (isPlacing) {
            this.localPlayer.sprite.setVelocity(0, 0);
            this.localPlayer.sprite.play('idle', true);
            let f = this.furnitureSprites[window.GameLogic.placingFurnitureKey];
            if (f) {
                f.sprite.setVelocity(vx, vy);
                this.cameras.main.startFollow(f.sprite, true, 0.1, 0.1);
                this.placePrompt.setPosition(f.sprite.x, f.sprite.y - 80).setVisible(true);
                
                if (vx !== 0 || vy !== 0) {
                    if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                        update(ref(window.GameLogic.db, `cafeFurniture/${window.GameLogic.placingFurnitureKey}`), { x: f.sprite.x, y: f.sprite.y });
                        this.lastSyncTime = Date.now();
                    }
                }
            }
        } else {
            this.placePrompt.setVisible(false);
            this.localPlayer.sprite.setVelocity(vx, vy);
            this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);
            
            if (vx < 0) this.localPlayer.sprite.play('walk-left', true);
            else if (vx > 0) this.localPlayer.sprite.play('walk-right', true);
            else if (vy < 0) this.localPlayer.sprite.play('walk-up', true);
            else if (vy > 0) this.localPlayer.sprite.play('walk-down', true);
            else this.localPlayer.sprite.play('idle', true);
            
            if (this.isCafe && (vx !== 0 || vy !== 0)) {
                if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                    update(ref(window.GameLogic.db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y });
                    this.lastSyncTime = Date.now();
                }
            }
        }

        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        if (this.isCafe) {
            const playersData = window.GameLogic.cafePlayers;
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let pd = playersData[uid]; pd.uid = uid;
                if (!this.otherPlayers[uid]) {
                    this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                }
                let op = this.otherPlayers[uid];
                op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2); 
                op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2);
                this.updatePlayerEntity(op, pd);
            }
            for (let uid in this.otherPlayers) {
                if (!playersData[uid]) {
                    this.otherPlayers[uid].sprite.destroy();
                    this.otherPlayers[uid].nameBg.destroy();
                    this.otherPlayers[uid].nameText.destroy();
                    this.otherPlayers[uid].bubbleBg.destroy();
                    this.otherPlayers[uid].bubbleText.destroy();
                    delete this.otherPlayers[uid];
                }
            }

            const furnData = window.GameLogic.cafeFurniture;
            for (let key in furnData) {
                let fd = furnData[key];
                if (!this.furnitureSprites[key]) {
                    this.furnitureSprites[key] = this.createFurniture(key, fd);
                }
                let f = this.furnitureSprites[key];
                f.sprite.isLocked = fd.locked;
                
                if(window.GameLogic.placingFurnitureKey !== key) {
                    f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3);
                    f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3);
                }
                
                if(!fd.locked) f.sprite.setAlpha(0.6);
                else f.sprite.setAlpha(1);
            }
            
            for (let key in this.furnitureSprites) {
                if (!furnData[key]) {
                    this.furnitureSprites[key].sprite.destroy();
                    delete this.furnitureSprites[key];
                }
            }
        }
    }
}

function initPhaser() {
    const config = {
        type: Phaser.AUTO,
        parent: 'phaser-app',
        width: '100%', height: '100%',
        backgroundColor: '#1a1008',
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [ BootScene, MainScene, UIScene ]
    };
    window.GameLogic.phaserGame = new Phaser.Game(config);
}

// ==========================================
// 3. 系統 UI 事件綁定
// ==========================================

document.querySelectorAll('.catalog-item').forEach(item => {
    item.addEventListener('click', () => {
        let key = item.dataset.key;
        document.getElementById('furniture-catalog-modal').style.display = 'none';
        
        let pX = 1024, pY = 1024; 
        if(window.GameLogic.phaserGame) {
            let scene = window.GameLogic.phaserGame.scene.getScene('MainScene');
            if(scene && scene.localPlayer) {
                pX = scene.localPlayer.sprite.x;
                pY = scene.localPlayer.sprite.y - 80; 
            }
        }

        update(ref(db, `cafeFurniture/${key}`), { x: pX, y: pY, locked: false });
        window.GameLogic.placingFurnitureKey = key;
    });
});

document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    if (targetUid === window.GameLogic.currentUser.uid) showProfileModal(window.GameLogic.myProfile, targetUid);
    else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) showProfileModal(snap.val(), targetUid);
        else if (window.GameLogic.cafePlayers[targetUid]) showProfileModal(window.GameLogic.cafePlayers[targetUid], targetUid); 
    }
});

function showProfileModal(p, uid) {
    profileViewingUid = uid;
    document.getElementById("vp-birth").innerText = p.birth || '未知';
    document.getElementById("vp-food").innerText = p.food || '無';
    document.getElementById("vp-motto").innerText = p.motto || '無';
    
    ['birth', 'food', 'motto'].forEach(k => {
        document.getElementById(`vp-${k}`).style.display = 'inline';
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
    
    ['birth', 'food', 'motto'].forEach(k => {
        let textNode = document.getElementById(`vp-${k}`);
        let inputNode = document.getElementById(`edit-${k}`);
        inputNode.value = textNode.innerText === '未知' || textNode.innerText === '無' ? '' : textNode.innerText;
        textNode.style.display = 'none';
        inputNode.style.display = 'inline-block';
    });
});

document.getElementById("save-edit-btn").addEventListener("click", () => {
    let newData = {
        birth: document.getElementById("edit-birth").value.trim() || '未知',
        food: document.getElementById("edit-food").value.trim() || '無',
        motto: document.getElementById("edit-motto").value.trim() || '無'
    };
    
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), newData).then(() => {
        window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...newData };
        showProfileModal(window.GameLogic.myProfile, window.GameLogic.currentUser.uid);
    });
});

document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { if (e.key === "Enter" && document.activeElement === chatInput) sendChat(); });

function sendBubble(msg) {
    if (window.GameLogic.currentUser) {
        window.GameLogic.myProfile.bubbleMsg = msg; 
        window.GameLogic.myProfile.bubbleTime = Date.now();
        if (window.GameLogic.currentScene === "cafe") {
            update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { bubbleMsg: msg, bubbleTime: window.GameLogic.myProfile.bubbleTime });
        }
    }
}

function sendChat() {
    const msg = chatInput.value.trim();
    if (msg !== "" && window.GameLogic.currentUser) {
        const now = new Date();
        push(ref(db, 'chats'), { 
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
    onValue(ref(db, 'chats'), (snapshot) => {
        const chatBox = document.getElementById("chat-box");
        chatBox.innerHTML = "";
        const chats = snapshot.val();
        if (chats) {
            Object.values(chats).forEach(c => {
                let timeStr = `<span style="font-size:10px; color:#bbb; margin-left:8px;">${c.date || ''} ${c.time || ''}</span>`;
                chatBox.innerHTML += `<div style="margin-bottom: 4px;"><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg} ${timeStr}</div>`;
            });
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
        }
    });
}

document.getElementById("upload-memory-btn").onclick = () => {
    const fileInput = document.getElementById("memory-file");
    const textInput = document.getElementById("memory-text");
    const file = fileInput.files[0];
    const text = textInput.value.trim();

    if (!file && !text) return alert("請上傳圖片或填寫文字！");
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > 300) { h *= 300 / w; w = 300; }
                cvs.width = w; cvs.height = h;
                cvs.getContext('2d').drawImage(img, 0, 0, w, h);
                saveMemoryToDB(cvs.toDataURL('image/jpeg', 0.7), text);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else saveMemoryToDB("", text);
    fileInput.value = ""; textInput.value = "";
};

function saveMemoryToDB(imgBase64, text) {
    push(ref(db, 'memories'), { author: window.GameLogic.myProfile.name, img: imgBase64, text: text, time: new Date().toLocaleDateString('zh-TW') });
}

function listenToMemories() {
    onValue(ref(db, 'memories'), snap => {
        const feed = document.getElementById("memory-feed");
        feed.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.values(data).reverse().forEach(m => {
                feed.innerHTML += `<div class="memory-card"><div class="author">${m.author} - ${m.time}</div>${m.img ? `<img src="${m.img}" alt="回憶照片">` : ''}${m.text ? `<div class="text">${m.text}</div>` : ''}</div>`;
            });
        }
    });
}