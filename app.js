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
    phaserGame: null,
    db: db 
};
let cafeUnsubscribe = null;

// 將方法掛載到 window，讓 Phaser 場景可以順利呼叫
window.switchScene = switchScene;
window.showProfileModal = showProfileModal;
window.leaveCafe = leaveCafe;
window.signOut = signOut;
window.auth = auth;

// --- DOM 元素 ---
const loginScreen = document.getElementById("login-screen");
const gameLayoutContainer = document.getElementById("game-layout-container");
const chatSection = document.getElementById("chat-section");
const furniturePanel = document.getElementById("furniture-panel");
const actionMenu = document.getElementById("action-menu");
const furnitureMenu = document.getElementById("furniture-menu");
const viewProfileModal = document.getElementById("view-profile-modal");

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
    
    if (sceneName === "doghouse") {
        chatSection.style.display = "none";
        furniturePanel.style.display = "none";
        leaveCafe();
    } else if (sceneName === "cafe") {
        chatSection.style.display = "flex";
        furniturePanel.style.display = "flex";
        joinCafe();
    } else if (sceneName === "farm") {
        chatSection.style.display = "none";
        furniturePanel.style.display = "none";
        leaveCafe();
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
        // 虛擬搖桿 (左下角)
        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 80, y: this.cameras.main.height - 80,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059),
            thumb: this.add.circle(0, 0, 25, 0xc5a059, 0.8)
        });

        // A 鍵與 B 鍵 (右下角)
        this.btnA = this.add.circle(this.cameras.main.width - 60, this.cameras.main.height - 60, 30, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtA = this.add.text(this.btnA.x, this.btnA.y, 'A', { fontSize: '24px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);
        
        this.btnB = this.add.circle(this.cameras.main.width - 130, this.cameras.main.height - 40, 25, 0xd4c5a0).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.txtB = this.add.text(this.btnB.x, this.btnB.y, 'B', { fontSize: '20px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);

        // 地圖選單按鈕 (A/B 鍵上方)
        this.mapBtn = this.add.circle(this.cameras.main.width - 60, this.cameras.main.height - 150, 30, 0x4a5d4e).setStrokeStyle(3, 0xc5a059).setInteractive();
        this.mapText = this.add.text(this.mapBtn.x, this.mapBtn.y, '地圖', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

        // 地圖下拉選單容器
        this.menuContainer = this.add.container(this.cameras.main.width - 180, this.cameras.main.height - 430).setVisible(false).setDepth(200);
        const menuBg = this.add.graphics();
        menuBg.fillStyle(0xf4ecd8, 0.95);
        menuBg.lineStyle(2, 0xc5a059, 1);
        menuBg.fillRoundedRect(0, 0, 160, 260, 10);
        menuBg.strokeRoundedRect(0, 0, 160, 260, 10);
        this.menuContainer.add(menuBg);

        const menuOptions = [
            { text: '🏠 我的狗窩', action: () => { window.switchScene('doghouse'); this.menuContainer.setVisible(false); } },
            { text: '☕ 洋蔥大廳', action: () => { window.switchScene('cafe'); this.menuContainer.setVisible(false); } },
            { text: '🌱 我的蔥田', action: () => { window.switchScene('farm'); this.menuContainer.setVisible(false); } },
            { text: '🆔 洋蔥身分證', action: () => { window.showProfileModal(window.GameLogic.myProfile); this.menuContainer.setVisible(false); } },
            { text: '🚪 登出大廳', action: () => { window.leaveCafe(); window.signOut(window.auth); this.menuContainer.setVisible(false); } }
        ];

        menuOptions.forEach((opt, idx) => {
            let btn = this.add.text(80, 30 + idx * 50, opt.text, { fontSize: '18px', color: '#3e2723', fontFamily: 'Georgia', fontStyle: 'bold' }).setOrigin(0.5).setInteractive();
            btn.on('pointerdown', opt.action);
            this.menuContainer.add(btn);
        });

        // 按鈕事件綁定
        this.mapBtn.on('pointerdown', () => this.menuContainer.setVisible(!this.menuContainer.visible));
        
        this.btnA.on('pointerdown', () => { 
            this.btnA.setFillStyle(0xc5a059); 
            const mainScene = this.scene.manager.getScene('MainScene');
            if(mainScene) mainScene.events.emit('action_A');
        });
        this.btnA.on('pointerup', () => this.btnA.setFillStyle(0xd4c5a0));
        
        this.btnB.on('pointerdown', () => { this.btnB.setFillStyle(0xc5a059); sendBubble("使用了 B 技能!"); });
        this.btnB.on('pointerup', () => this.btnB.setFillStyle(0xd4c5a0));
        
        // 視窗縮放自動重新定位 UI
        this.scale.on('resize', (gameSize) => {
            this.joyStick.setPosition(80, gameSize.height - 80);
            this.btnA.setPosition(gameSize.width - 60, gameSize.height - 60);
            this.txtA.setPosition(this.btnA.x, this.btnA.y);
            this.btnB.setPosition(gameSize.width - 130, gameSize.height - 40);
            this.txtB.setPosition(this.btnB.x, this.btnB.y);
            this.mapBtn.setPosition(gameSize.width - 60, gameSize.height - 150);
            this.mapText.setPosition(this.mapBtn.x, this.mapBtn.y);
            this.menuContainer.setPosition(gameSize.width - 180, gameSize.height - 430);
        });
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    
    create() {
        this.sceneName = window.GameLogic.currentScene;
        this.isCafe = this.sceneName === "cafe";
        
        const mapSize = this.isCafe ? 2048 : 800;
        this.physics.world.setBounds(0, 0, mapSize, mapSize);
        this.cameras.main.setBounds(0, 0, mapSize, mapSize);

        // 背景生成
        if (this.sceneName === "cafe") {
            this.add.tileSprite(0, 0, mapSize, mapSize, 'bgCafe').setOrigin(0, 0);
        } else if (this.sceneName === "doghouse") {
            this.add.image(mapSize/2, mapSize/2, 'bgDoghouse').setDisplaySize(mapSize, mapSize);
        } else if (this.sceneName === "farm") {
            this.add.image(mapSize/2, mapSize/2, 'bgFarm').setDisplaySize(mapSize, mapSize);
        }

        this.otherPlayers = {};
        this.furnitureSprites = {};

        let startX = this.isCafe ? 1024 : 400;
        let startY = this.isCafe ? 1024 : 400;
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true);
        
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        this.events.on('action_A', () => {
            if(!this.isCafe) return sendBubble("對著空氣揮舞了雙手!");
            let interacted = false;
            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                if (dist < 90) { 
                    if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                    if (key === 'memory') document.getElementById('memory-modal').style.display = 'block';
                    interacted = true; break;
                }
            }
            if(!interacted) sendBubble("使用了 A 技能!");
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (!gameObject.isLocked) {
                gameObject.setPosition(dragX, dragY);
                if(gameObject.glow) gameObject.glow.setPosition(dragX, dragY);
            }
        });
        this.input.on('dragend', (pointer, gameObject) => {
            if (!gameObject.isLocked) {
                update(ref(window.GameLogic.db, `cafeFurniture/${gameObject.furnitureKey}`), { 
                    x: gameObject.x, y: gameObject.y, locked: true 
                });
            }
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
        
        // 對話氣泡設定：加入 wordWrap 實作動態縮放
        entity.bubbleBg = this.add.graphics().setDepth(13).setVisible(false);
        entity.bubbleText = this.add.text(x, y, '', { 
            fontSize: '14px', 
            fontFamily: 'Georgia', 
            color: '#3e2723', 
            fontStyle: 'bold',
            wordWrap: { width: 160, useAdvancedWrap: true },
            align: 'center'
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

        // 動態氣泡框計算邏輯
        if (pData.bubbleMsg && (Date.now() - pData.bubbleTime < 10000)) { // 縮短為 10 秒
            entity.bubbleBg.setVisible(true); entity.bubbleText.setVisible(true);
            entity.bubbleText.setText(pData.bubbleMsg);

            // 取得文字目前的邊界寬高
            const bounds = entity.bubbleText.getBounds();
            const paddingX = 10;
            const paddingY = 8;
            const boxWidth = bounds.width + paddingX * 2;
            const boxHeight = bounds.height + paddingY * 2;
            
            // 將氣泡定位在名牌上方
            const boxX = sx - boxWidth / 2;
            const boxY = sy - 65 - boxHeight; 

            entity.bubbleBg.clear();
            entity.bubbleBg.fillStyle(0xf4ecd8, 0.95);
            entity.bubbleBg.lineStyle(2, 0xc5a059, 1);
            entity.bubbleBg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
            entity.bubbleBg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 8);
            
            // 將文字置中於計算好的背景框內
            entity.bubbleText.setPosition(sx, boxY + boxHeight / 2);
        } else {
            entity.bubbleBg.setVisible(false); entity.bubbleText.setVisible(false);
        }
    }

    createFurniture(key, data) {
        let f = { sprite: null, glow: null, isLocked: data.locked, furnitureKey: key };
        let imgKey = key === 'fridge' ? 'fridge' : 'memory';
        f.sprite = this.add.sprite(data.x, data.y, imgKey).setInteractive({ draggable: true }).setDepth(5);
        f.sprite.furnitureKey = key;
        f.sprite.isLocked = data.locked;

        f.glow = this.add.graphics().setDepth(4);
        f.sprite.on('pointerdown', (pointer) => {
            if (f.sprite.isLocked) {
                furnitureMenu.style.display = "flex";
                furnitureMenu.style.left = pointer.event.pageX + "px";
                furnitureMenu.style.top = pointer.event.pageY + "px";
                furnitureMenu.dataset.type = key;
            }
        });
        
        this.input.setDraggable(f.sprite);
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

        this.localPlayer.sprite.setVelocity(vx, vy);

        if (vx < 0) this.localPlayer.sprite.play('walk-left', true);
        else if (vx > 0) this.localPlayer.sprite.play('walk-right', true);
        else if (vy < 0) this.localPlayer.sprite.play('walk-up', true);
        else if (vy > 0) this.localPlayer.sprite.play('walk-down', true);
        else this.localPlayer.sprite.play('idle', true);

        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        if (this.isCafe) {
            if (vx !== 0 || vy !== 0) {
                if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                    update(ref(window.GameLogic.db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y });
                    this.lastSyncTime = Date.now();
                }
            }

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
                if (fd.locked) {
                    f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3);
                    f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3);
                    f.glow.clear();
                } else {
                    f.glow.clear();
                    f.glow.lineStyle(3, 0xffd700, 0.8);
                    f.glow.strokeRect(f.sprite.x - 28, f.sprite.y - 28, 56, 56);
                }
            }
        }
    }
}

function initPhaser() {
    const config = {
        type: Phaser.AUTO,
        parent: 'phaser-app',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1008',
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: { debug: false }
        },
        scene: [ BootScene, MainScene, UIScene ]
    };
    window.GameLogic.phaserGame = new Phaser.Game(config);
}

// ==========================================
// 3. 系統 UI 事件綁定
// ==========================================

document.getElementById("move-furniture-btn").onclick = () => {
    let type = furnitureMenu.dataset.type;
    update(ref(window.GameLogic.db, `cafeFurniture/${type}`), { locked: false });
    furnitureMenu.style.display = "none";
};

document.getElementById("spawn-fridge-btn").onclick = () => {
    if (!window.GameLogic.cafeFurniture.fridge) update(ref(db, 'cafeFurniture/fridge'), { x: 1024, y: 1000, locked: false });
};
document.getElementById("spawn-memory-btn").onclick = () => {
    if (!window.GameLogic.cafeFurniture.memory) update(ref(db, 'cafeFurniture/memory'), { x: 900, y: 1000, locked: false });
};

document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    if (targetUid === window.GameLogic.currentUser.uid) showProfileModal(window.GameLogic.myProfile);
    else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) showProfileModal(snap.val());
        else if (window.GameLogic.cafePlayers[targetUid]) showProfileModal(window.GameLogic.cafePlayers[targetUid]); 
    }
});

function showProfileModal(p) {
    document.getElementById("vp-birth").innerText = p.birth || '未知';
    document.getElementById("vp-food").innerText = p.food || '無';
    document.getElementById("vp-motto").innerText = p.motto || '無';
    viewProfileModal.style.display = "block";
}

const chatInput = document.getElementById("chat-input");
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
        push(ref(db, 'chats'), { name: window.GameLogic.myProfile.name, msg: msg, time: new Date().toLocaleTimeString('zh-TW', { hour12: false }) });
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
                chatBox.innerHTML += `<div><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg}</div>`;
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