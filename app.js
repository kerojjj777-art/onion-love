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
    db: db // 讓 Phaser 場景可以調用資料庫
};
let cafeUnsubscribe = null;

// --- DOM 元素 ---
const loginScreen = document.getElementById("login-screen");
const gameLayoutContainer = document.getElementById("game-layout-container");
const topBar = document.getElementById("top-bar");
const sceneTitle = document.getElementById("game-title");
const chatSection = document.getElementById("chat-section");
const furniturePanel = document.getElementById("furniture-panel");
const dropdownMenu = document.getElementById("dropdown-menu");
const actionMenu = document.getElementById("action-menu");
const furnitureMenu = document.getElementById("furniture-menu");
const viewProfileModal = document.getElementById("view-profile-modal");

// ==========================================
// 1. 登入與場景切換 (Phaser Booting)
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
        topBar.style.display = "flex";
        gameLayoutContainer.style.display = "flex";
        
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) window.GameLogic.myProfile = { ...window.GameLogic.myProfile, ...profileSnap.val() };
        else set(ref(db, `users/${user.uid}`), { name: window.GameLogic.myProfile.name, color: window.GameLogic.myProfile.color, birth: window.GameLogic.myProfile.birth, food: window.GameLogic.myProfile.food, motto: window.GameLogic.myProfile.motto });

        onValue(ref(db, 'cafeFurniture'), snap => window.GameLogic.cafeFurniture = snap.val() || {});

        // 啟動 Phaser 引擎 (若尚未啟動)
        if (!window.GameLogic.phaserGame) initPhaser();

        switchScene("doghouse"); 
        listenToChat();
        listenToMemories();
    } else {
        window.GameLogic.currentUser = null;
        loginScreen.style.display = "block";
        topBar.style.display = "none";
        gameLayoutContainer.style.display = "none";
        dropdownMenu.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe();
    }
});

document.getElementById("nav-logout").addEventListener("click", () => { leaveCafe(); signOut(auth); });
document.getElementById("nav-doghouse").addEventListener("click", () => switchScene("doghouse"));
document.getElementById("nav-cafe").addEventListener("click", () => switchScene("cafe"));

function switchScene(sceneName) {
    window.GameLogic.currentScene = sceneName;
    dropdownMenu.style.display = "none";
    
    if (sceneName === "doghouse") {
        sceneTitle.innerText = "我的狗窩";
        chatSection.style.display = "none";
        furniturePanel.style.display = "none";
        leaveCafe();
    } else if (sceneName === "cafe") {
        sceneTitle.innerText = "洋蔥大廳";
        chatSection.style.display = "flex";
        furniturePanel.style.display = "flex";
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
// 2. Phaser 3 引擎架構 (RPG 核心)
// ==========================================

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        // 載入虛擬搖桿插件
        this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
        
        // 載入地圖與道具
        this.load.image('bgCafe', 'cafe-bg.jpg');
        this.load.image('bgDoghouse', 'doghouse-bg.jpg');
        this.load.image('fridge', 'fridge.png');
        this.load.image('memory', 'memory.png');

        // 將洋蔥人設為精靈圖 (為未來擴充動畫做準備，單張圖也相容)
        this.load.spritesheet('onion', 'onion-sprite.png', { frameWidth: 50, frameHeight: 50 });
    }
    create() {
        // 預先部署動畫邏輯 (目前指向第0幀，未來替換圖檔只需更改 start/end)
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
        // 建立獨立 UI 層虛擬搖桿
        this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 70, y: this.cameras.main.height - 70,
            radius: 45,
            base: this.add.circle(0, 0, 45, 0xc5a059, 0.2).setStrokeStyle(2, 0xc5a059),
            thumb: this.add.circle(0, 0, 25, 0xc5a059, 0.8)
        });

        // 建立 A 鍵 (互動)
        this.btnA = this.add.circle(this.cameras.main.width - 60, this.cameras.main.height - 60, 30, 0xd4c5a0)
            .setStrokeStyle(3, 0xc5a059).setInteractive();
        this.add.text(this.btnA.x, this.btnA.y, 'A', { fontSize: '24px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);
        
        // 建立 B 鍵 (技能)
        this.btnB = this.add.circle(this.cameras.main.width - 130, this.cameras.main.height - 40, 25, 0xd4c5a0)
            .setStrokeStyle(3, 0xc5a059).setInteractive();
        this.add.text(this.btnB.x, this.btnB.y, 'B', { fontSize: '20px', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5);

        // 按鍵事件發送至主要場景
        this.btnA.on('pointerdown', () => { 
            this.btnA.setFillStyle(0xc5a059); 
            const mainScene = this.scene.manager.getScene('MainScene');
            if(mainScene) mainScene.events.emit('action_A');
        });
        this.btnA.on('pointerup', () => this.btnA.setFillStyle(0xd4c5a0));
        this.btnA.on('pointerout', () => this.btnA.setFillStyle(0xd4c5a0));

        this.btnB.on('pointerdown', () => { 
            this.btnB.setFillStyle(0xc5a059); 
            sendBubble("使用了 B 技能!"); 
        });
        this.btnB.on('pointerup', () => this.btnB.setFillStyle(0xd4c5a0));
        this.btnB.on('pointerout', () => this.btnB.setFillStyle(0xd4c5a0));
        
        // 支援視窗縮放自動重新定位 UI
        this.scale.on('resize', (gameSize) => {
            this.joyStick.setPosition(70, gameSize.height - 70);
            this.btnA.setPosition(gameSize.width - 60, gameSize.height - 60);
            this.btnB.setPosition(gameSize.width - 130, gameSize.height - 40);
            // 同步更新文字位置
            this.children.list.forEach(c => {
                if (c.text === 'A') c.setPosition(this.btnA.x, this.btnA.y);
                if (c.text === 'B') c.setPosition(this.btnB.x, this.btnB.y);
            });
        });
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }
    
    create() {
        this.isCafe = window.GameLogic.currentScene === "cafe";
        
        // 大地圖設定 (2048 x 2048)
        const mapSize = this.isCafe ? 2048 : 800;
        this.physics.world.setBounds(0, 0, mapSize, mapSize);
        this.cameras.main.setBounds(0, 0, mapSize, mapSize);

        // 背景生成
        if (this.isCafe) {
            this.add.tileSprite(0, 0, mapSize, mapSize, 'bgCafe').setOrigin(0, 0);
        } else {
            this.add.image(mapSize/2, mapSize/2, 'bgDoghouse').setDisplaySize(mapSize, mapSize);
        }

        // 玩家實體群組
        this.otherPlayers = {};
        this.furnitureSprites = {};

        // 建立本地玩家實體
        let startX = this.isCafe ? 1024 : 400;
        let startY = this.isCafe ? 1024 : 400;
        this.localPlayer = this.createPlayerEntity(startX, startY, window.GameLogic.myProfile, true);
        
        // 鏡頭平滑跟隨
        this.cameras.main.startFollow(this.localPlayer.sprite, true, 0.08, 0.08);

        // 鍵盤綁定
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

        // 監聽來自 UI 場景的 A 鍵互動 (距離偵測)
        this.events.on('action_A', () => {
            if(!this.isCafe) return sendBubble("對著空氣揮舞了雙手!");
            let interacted = false;
            for (const key in this.furnitureSprites) {
                let f = this.furnitureSprites[key];
                let dist = Phaser.Math.Distance.Between(this.localPlayer.sprite.x, this.localPlayer.sprite.y, f.sprite.x, f.sprite.y);
                if (dist < 90) { // RPG 距離互動判定
                    if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                    if (key === 'memory') document.getElementById('memory-modal').style.display = 'block';
                    interacted = true; break;
                }
            }
            if(!interacted) sendBubble("使用了 A 技能!");
        });

        // 拖曳傢俱事件
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

        // 名牌
        entity.nameBg = this.add.graphics().setDepth(11);
        entity.nameText = this.add.text(x, y, pData.name || '匿名', { fontSize: '12px', fontFamily: 'Georgia', color: pData.color || '#fff' }).setOrigin(0.5).setDepth(12);
        
        // 對話泡泡
        entity.bubbleBg = this.add.graphics().setDepth(13).setVisible(false);
        entity.bubbleText = this.add.text(x, y, '', { fontSize: '13px', fontFamily: 'Georgia', color: '#3e2723', fontStyle: 'bold' }).setOrigin(0.5).setDepth(14).setVisible(false);

        return entity;
    }

    updatePlayerEntity(entity, pData) {
        let sx = entity.sprite.x; let sy = entity.sprite.y;
        
        // 更新名牌
        entity.nameBg.clear();
        entity.nameBg.fillStyle(0x000000, 0.6);
        entity.nameBg.fillRoundedRect(sx - 30, sy - 55, 60, 18, 4);
        entity.nameText.setPosition(sx, sy - 46);
        if(pData.name) entity.nameText.setText(pData.name);
        if(pData.color) entity.nameText.setColor(pData.color);

        // 更新泡泡
        if (pData.bubbleMsg && (Date.now() - pData.bubbleTime < 15000)) {
            entity.bubbleBg.setVisible(true); entity.bubbleText.setVisible(true);
            entity.bubbleBg.clear();
            entity.bubbleBg.fillStyle(0xf4ecd8, 0.95);
            entity.bubbleBg.lineStyle(2, 0xc5a059, 1);
            entity.bubbleBg.fillRoundedRect(sx - 60, sy - 95, 120, 30, 8);
            entity.bubbleBg.strokeRoundedRect(sx - 60, sy - 95, 120, 30, 8);
            entity.bubbleText.setPosition(sx, sy - 80);
            let displayMsg = pData.bubbleMsg.length > 8 ? pData.bubbleMsg.substring(0, 8) + "..." : pData.bubbleMsg;
            entity.bubbleText.setText(displayMsg);
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
            if (f.sprite.isLocked) { // 已鎖定，點擊開啟管理選單
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
        
        // 1. 處理本機移動與動畫
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
            if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; } // 修正對角線速度
        }

        this.localPlayer.sprite.setVelocity(vx, vy);

        if (vx < 0) this.localPlayer.sprite.play('walk-left', true);
        else if (vx > 0) this.localPlayer.sprite.play('walk-right', true);
        else if (vy < 0) this.localPlayer.sprite.play('walk-up', true);
        else if (vy > 0) this.localPlayer.sprite.play('walk-down', true);
        else this.localPlayer.sprite.play('idle', true);

        // 同步標籤位置
        this.updatePlayerEntity(this.localPlayer, window.GameLogic.myProfile);

        // 2. 多人連線同步 (洋蔥大廳專屬)
        if (this.isCafe) {
            // 本機上傳
            if (vx !== 0 || vy !== 0) {
                if(!this.lastSyncTime || Date.now() - this.lastSyncTime > 100) {
                    update(ref(window.GameLogic.db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { x: this.localPlayer.sprite.x, y: this.localPlayer.sprite.y });
                    this.lastSyncTime = Date.now();
                }
            }

            // 遠端玩家同步
            const playersData = window.GameLogic.cafePlayers;
            for (let uid in playersData) {
                if (uid === window.GameLogic.currentUser.uid) continue;
                let pd = playersData[uid]; pd.uid = uid;
                if (!this.otherPlayers[uid]) {
                    this.otherPlayers[uid] = this.createPlayerEntity(pd.x, pd.y, pd, false);
                }
                let op = this.otherPlayers[uid];
                op.sprite.x = Phaser.Math.Linear(op.sprite.x, pd.x, 0.2); // 平滑移動
                op.sprite.y = Phaser.Math.Linear(op.sprite.y, pd.y, 0.2);
                this.updatePlayerEntity(op, pd);
            }
            // 清理斷線玩家
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

            // 傢俱同步
            const furnData = window.GameLogic.cafeFurniture;
            for (let key in furnData) {
                let fd = furnData[key];
                if (!this.furnitureSprites[key]) {
                    this.furnitureSprites[key] = this.createFurniture(key, fd);
                }
                let f = this.furnitureSprites[key];
                f.sprite.isLocked = fd.locked;
                if (fd.locked) {
                    // 若被其他人鎖定定點，平滑同步位置
                    f.sprite.x = Phaser.Math.Linear(f.sprite.x, fd.x, 0.3);
                    f.sprite.y = Phaser.Math.Linear(f.sprite.y, fd.y, 0.3);
                    f.glow.clear();
                } else {
                    // 解鎖狀態畫出發光外框提示
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
        backgroundColor: '#8d6e63',
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
// 3. 系統 UI 事件綁定 (傢俱、設定、聊天)
// ==========================================

// 傢俱解除鎖定
document.getElementById("move-furniture-btn").onclick = () => {
    let type = furnitureMenu.dataset.type;
    update(ref(window.GameLogic.db, `cafeFurniture/${type}`), { locked: false });
    furnitureMenu.style.display = "none";
};

// 傢俱生成
document.getElementById("spawn-fridge-btn").onclick = () => {
    if (!window.GameLogic.cafeFurniture.fridge) update(ref(db, 'cafeFurniture/fridge'), { x: 1024, y: 1000, locked: false });
};
document.getElementById("spawn-memory-btn").onclick = () => {
    if (!window.GameLogic.cafeFurniture.memory) update(ref(db, 'cafeFurniture/memory'), { x: 900, y: 1000, locked: false });
};

// 查看名牌
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
    document.getElementById("vp-title").innerText = `🧅 ${p.name || '匿名'} 的名牌`;
    document.getElementById("vp-birth").innerText = p.birth || '未知';
    document.getElementById("vp-food").innerText = p.food || '無';
    document.getElementById("vp-motto").innerText = p.motto || '無';
    viewProfileModal.style.display = "block";
}

// 聊天系統
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

// 設定與回憶錄儲存邏輯 (保留原樣)
document.getElementById("save-settings-btn").addEventListener("click", () => {
    let p = window.GameLogic.myProfile;
    p.name = document.getElementById("set-name").value || "匿名";
    p.color = document.getElementById("set-color").value;
    p.birth = document.getElementById("set-birth").value || "未知";
    p.food = document.getElementById("set-food").value || "無";
    p.motto = document.getElementById("set-motto").value || "無";
    
    update(ref(db, `users/${window.GameLogic.currentUser.uid}`), { name: p.name, color: p.color, birth: p.birth, food: p.food, motto: p.motto });
    if (window.GameLogic.currentScene === "cafe") update(ref(db, `cafePlayers/${window.GameLogic.currentUser.uid}`), { name: p.name, color: p.color });
    document.getElementById('settings-modal').style.display = 'none';
});

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