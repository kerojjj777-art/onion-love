import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- 系統狀態與變數 ---
let currentUser = null;
let currentScene = "doghouse"; 
let myProfile = { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0 };
let myX = 400, myY = 300; // 起始位置調到大一點的地圖中央
let cafePlayersData = {};
let cafeFurnitureData = {}; 
let cafeUnsubscribe = null;
const speed = 4;

let isDraggingJoystick = false;
let moveVector = { x: 0, y: 0 };
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };

// --- DOM 元素 ---
const loginScreen = document.getElementById("login-screen");
const uiLayer = document.getElementById("ui-layer");
const topBar = document.getElementById("top-bar");
const sceneTitle = document.getElementById("game-title");
const chatSection = document.getElementById("chat-section");
const furniturePanel = document.getElementById("furniture-panel");
const dropdownMenu = document.getElementById("dropdown-menu");
const actionMenu = document.getElementById("action-menu");
const furnitureMenu = document.getElementById("furniture-menu");
const viewProfileModal = document.getElementById("view-profile-modal");

// ==========================================
// 1. Phaser 遊戲場景設定
// ==========================================
class OnionScene extends Phaser.Scene {
    constructor() { super({ key: 'OnionScene' }); }

    preload() {
        // 載入所有圖片素材
        this.load.image('onion', 'onion-sprite.png');
        this.load.image('bg-cafe', 'cafe-bg.jpg');
        this.load.image('bg-doghouse', 'doghouse-bg.jpg');
        this.load.image('fridge', 'fridge.png');
        this.load.image('memory', 'memory.png');
    }

    create() {
        // 1. 設定大地圖邊界與背景 (假設背景圖是 1200 x 800)
        this.cameras.main.setBounds(0, 0, 1200, 800);
        this.physics.world.setBounds(0, 0, 1200, 800);

        this.bgDoghouse = this.add.image(0, 0, 'bg-doghouse').setOrigin(0, 0);
        this.bgCafe = this.add.image(0, 0, 'bg-cafe').setOrigin(0, 0);
        this.bgCafe.setVisible(false); // 預設顯示狗窩

        // 2. 建立儲存玩家與傢俱的群組
        this.otherPlayers = {};
        this.furnitureGroup = {};

        // 3. 建立自己的洋蔥人 (使用 Container 打包圖片與文字)
        this.myPlayer = this.createPlayerContainer(myX, myY, myProfile, true);
        this.cameras.main.startFollow(this.myPlayer, true, 0.05, 0.05);

        // 4. 滑鼠點擊背景關閉 UI
        this.input.on('pointerdown', () => {
            actionMenu.style.display = 'none';
            furnitureMenu.style.display = 'none';
        });
    }

    update() {
        if (!currentUser) return;

        // 根據虛擬搖桿或鍵盤移動
        if (moveVector.x !== 0 || moveVector.y !== 0) {
            let nextX = this.myPlayer.x + moveVector.x * speed;
            let nextY = this.myPlayer.y + moveVector.y * speed;
            
            // 邊界碰撞檢測
            if (nextX > 20 && nextX < 1180) this.myPlayer.x = nextX;
            if (nextY > 40 && nextY < 760) this.myPlayer.y = nextY;
            
            myX = this.myPlayer.x;
            myY = this.myPlayer.y;

            // 自己的圖層隨時保持在最上面
            this.myPlayer.setDepth(this.myPlayer.y);
        }

        // 定期更新自己的對話泡泡狀態
        this.updateBubble(this.myPlayer, myProfile);
        
        // 更新其他玩家的深度與泡泡
        for (let uid in this.otherPlayers) {
            let pContainer = this.otherPlayers[uid];
            pContainer.setDepth(pContainer.y);
            this.updateBubble(pContainer, cafePlayersData[uid]);
        }
    }

    // 建立角色容器的共用函數
    createPlayerContainer(x, y, pData, isMe = false) {
        let container = this.add.container(x, y);
        
        // 洋蔥本體
        let sprite = this.add.image(0, -20, 'onion').setScale(1.2);
        if (!isMe) {
            sprite.setInteractive({ cursor: 'pointer' });
            sprite.on('pointerdown', (pointer) => this.showActionMenu(pointer, pData.uid));
        }

        // 名字底色標籤
        let nameBg = this.add.graphics();
        nameBg.fillStyle(0x000000, 0.6);
        nameBg.fillRoundedRect(-30, -55, 60, 18, 4);

        // 名字文字
        let nameText = this.add.text(0, -46, pData.name, { 
            fontFamily: 'Georgia', fontSize: '12px', fill: pData.color 
        }).setOrigin(0.5);

        // 泡泡容器 (預設隱藏)
        let bubble = this.add.container(0, -90);
        let bubbleBg = this.add.graphics();
        bubbleBg.fillStyle(0xf4ecd8, 0.95);
        bubbleBg.lineStyle(2, 0xc5a059);
        bubbleBg.fillRoundedRect(-60, -15, 120, 30, 8);
        bubbleBg.strokeRoundedRect(-60, -15, 120, 30, 8);
        let bubbleText = this.add.text(0, 0, "", { 
            fontFamily: 'Georgia', fontSize: '13px', fill: '#3e2723', fontStyle: 'bold' 
        }).setOrigin(0.5);
        bubble.add([bubbleBg, bubbleText]);
        bubble.setVisible(false);

        container.add([sprite, nameBg, nameText, bubble]);
        
        // 綁定屬性方便後續更新
        container.nameText = nameText;
        container.bubble = bubble;
        container.bubbleText = bubbleText;
        container.uid = isMe ? currentUser.uid : pData.uid;

        return container;
    }

    updateBubble(container, pData) {
        if (!pData) return;
        const now = Date.now();
        if (pData.bubbleMsg && (now - pData.bubbleTime < 15000)) {
            let displayMsg = pData.bubbleMsg.length > 8 ? pData.bubbleMsg.substring(0, 8) + "..." : pData.bubbleMsg;
            container.bubbleText.setText(displayMsg);
            container.bubble.setVisible(true);
        } else {
            container.bubble.setVisible(false);
        }
    }

    // 處理 Firebase 傳來的其他玩家資料
    syncPlayers() {
        if (currentScene !== 'cafe') return;
        
        // 移除已經離線的玩家
        for (let uid in this.otherPlayers) {
            if (!cafePlayersData[uid] || uid === currentUser.uid) {
                this.otherPlayers[uid].destroy();
                delete this.otherPlayers[uid];
            }
        }

        // 新增或更新線上玩家
        for (let uid in cafePlayersData) {
            if (uid === currentUser.uid) continue; // 跳過自己
            let pData = cafePlayersData[uid];
            pData.uid = uid;

            if (!this.otherPlayers[uid]) {
                // 產生新玩家
                this.otherPlayers[uid] = this.createPlayerContainer(pData.x, pData.y, pData);
            } else {
                // 平滑移動玩家
                let pContainer = this.otherPlayers[uid];
                this.tweens.add({
                    targets: pContainer, x: pData.x, y: pData.y, duration: 100
                });
                pContainer.nameText.setText(pData.name).setColor(pData.color);
            }
        }
    }

    // 處理 Firebase 傳來的傢俱資料
    syncFurniture() {
        if (currentScene !== 'cafe') return;

        for (let key in cafeFurnitureData) {
            let fData = cafeFurnitureData[key];
            
            if (!this.furnitureGroup[key]) {
                // 建立新傢俱
                let sprite = this.add.sprite(fData.x, fData.y, key).setInteractive();
                this.furnitureGroup[key] = sprite;

                // 註冊拖曳事件
                this.input.setDraggable(sprite);
                sprite.on('drag', (pointer, dragX, dragY) => {
                    if (!cafeFurnitureData[key].locked) {
                        sprite.x = dragX; sprite.y = dragY;
                    }
                });
                sprite.on('dragend', () => {
                    if (!cafeFurnitureData[key].locked) {
                        update(ref(db, `cafeFurniture/${key}`), { x: sprite.x, y: sprite.y, locked: true });
                    }
                });

                // 單擊/長按事件判定
                sprite.on('pointerdown', (pointer) => {
                    sprite.clickStartTime = Date.now();
                });
                sprite.on('pointerup', (pointer) => {
                    let holdTime = Date.now() - sprite.clickStartTime;
                    if (cafeFurnitureData[key].locked) {
                        if (holdTime > 500) {
                            // 長按解鎖選單
                            this.showFurnitureMenu(pointer, key);
                        } else {
                            // 單擊觸發功能
                            if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                            if (key === 'memory') document.getElementById('memory-modal').style.display = 'block';
                        }
                    }
                });

            } else {
                // 更新位置與鎖定狀態的發光效果
                let sprite = this.furnitureGroup[key];
                sprite.setPosition(fData.x, fData.y);
                sprite.setDepth(sprite.y - 10); // 讓洋蔥人可以走在傢俱前後
                if (!fData.locked) sprite.setTint(0xffeb3b); // 解鎖狀態給黃色提示
                else sprite.clearTint();
            }
        }
    }

    switchSceneMode(sceneName) {
        if (sceneName === 'doghouse') {
            this.bgDoghouse.setVisible(true);
            this.bgCafe.setVisible(false);
            // 隱藏大廳的人與傢俱
            for (let uid in this.otherPlayers) this.otherPlayers[uid].setVisible(false);
            for (let key in this.furnitureGroup) this.furnitureGroup[key].setVisible(false);
        } else {
            this.bgDoghouse.setVisible(false);
            this.bgCafe.setVisible(true);
            for (let uid in this.otherPlayers) this.otherPlayers[uid].setVisible(true);
            for (let key in this.furnitureGroup) this.furnitureGroup[key].setVisible(true);
        }
    }

    showActionMenu(pointer, targetUid) {
        actionMenu.style.display = "flex";
        actionMenu.style.left = (pointer.event.pageX + 10) + "px";
        actionMenu.style.top = (pointer.event.pageY - 20) + "px";
        actionMenu.dataset.uid = targetUid;
    }

    showFurnitureMenu(pointer, type) {
        furnitureMenu.style.display = "flex";
        furnitureMenu.style.left = (pointer.event.pageX + 10) + "px";
        furnitureMenu.style.top = (pointer.event.pageY - 20) + "px";
        furnitureMenu.dataset.type = type;
    }
}

// ==========================================
// 2. 啟動機制與 Firebase 驗證
// ==========================================
let game; 
const phaserConfig = {
    type: Phaser.AUTO,
    parent: 'phaser-app',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    transparent: true,
    physics: { default: 'arcade' },
    scene: [OnionScene]
};

document.getElementById("join-btn").addEventListener("click", () => {
    const email = document.getElementById("user-email").value;
    const pwd = document.getElementById("user-pwd").value;
    signInWithEmailAndPassword(auth, email, pwd).catch(error => alert("登入失敗: " + error.message));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = "none";
        topBar.style.display = "flex";
        uiLayer.style.display = "block";
        
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) myProfile = { ...myProfile, ...profileSnap.val() };
        else set(ref(db, `users/${user.uid}`), { name: myProfile.name, color: myProfile.color, birth: myProfile.birth, food: myProfile.food, motto: myProfile.motto });

        // 啟動 Phaser
        if (!game) game = new Phaser.Game(phaserConfig);

        // 讀取大廳傢俱
        onValue(ref(db, 'cafeFurniture'), snap => {
            cafeFurnitureData = snap.val() || {};
            if(game && game.scene.keys.OnionScene) game.scene.keys.OnionScene.syncFurniture();
        });

        switchScene("doghouse"); 
        listenToChat();
        listenToMemories();
    } else {
        currentUser = null;
        loginScreen.style.display = "block";
        topBar.style.display = "none";
        uiLayer.style.display = "none";
        dropdownMenu.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe();
    }
});

document.getElementById("nav-logout").addEventListener("click", () => { leaveCafe(); signOut(auth); });

// ==========================================
// 3. 場景切換與同步邏輯
// ==========================================
function switchScene(scene) {
    currentScene = scene;
    dropdownMenu.style.display = "none";
    
    if (scene === "doghouse") {
        sceneTitle.innerText = "我的狗窩";
        chatSection.style.display = "none";
        furniturePanel.style.display = "none";
        leaveCafe();
    } else if (scene === "cafe") {
        sceneTitle.innerText = "洋蔥大廳";
        chatSection.style.display = "flex";
        furniturePanel.style.display = "flex";
        joinCafe();
    }

    if(game && game.scene.keys.OnionScene) game.scene.keys.OnionScene.switchSceneMode(scene);
}

document.getElementById("nav-doghouse").addEventListener("click", () => switchScene("doghouse"));
document.getElementById("nav-cafe").addEventListener("click", () => switchScene("cafe"));

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${currentUser.uid}`);
    set(playerRef, { x: myX, y: myY, name: myProfile.name, color: myProfile.color, bubbleMsg: myProfile.bubbleMsg, bubbleTime: myProfile.bubbleTime });
    onDisconnect(playerRef).remove(); 
    
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => {
        cafePlayersData = snapshot.val() || {};
        if(game && game.scene.keys.OnionScene) game.scene.keys.OnionScene.syncPlayers();
    });
}

function leaveCafe() {
    if (currentUser) remove(ref(db, `cafePlayers/${currentUser.uid}`));
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

// 每 100ms 同步一次位置給伺服器 (避免洗頻)
setInterval(() => {
    if (currentScene === "cafe" && currentUser && (moveVector.x !== 0 || moveVector.y !== 0)) {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { x: Math.round(myX), y: Math.round(myY) });
    }
}, 100);

// ==========================================
// 4. 控制搖桿系統 (DOM 端點)
// ==========================================
const zone = document.getElementById('joystick-zone');
const knob = document.getElementById('joystick-knob');
const maxDist = 27;

function handleJoystickMove(e) {
    if (!isDraggingJoystick) return;
    const rect = zone.getBoundingClientRect();
    let dx = e.clientX - rect.left - 45; 
    let dy = e.clientY - rect.top - 45;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDist) { dx = (dx / distance) * maxDist; dy = (dy / distance) * maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVector.x = dx / maxDist; moveVector.y = dy / maxDist;
}

zone.addEventListener('pointerdown', (e) => { 
    isDraggingJoystick = true; knob.style.transition = 'none'; 
    zone.setPointerCapture(e.pointerId); 
    handleJoystickMove(e); 
});
zone.addEventListener('pointermove', handleJoystickMove);
const stopJoystick = () => {
    isDraggingJoystick = false; moveVector = { x: 0, y: 0 };
    knob.style.transition = 'transform 0.1s linear'; knob.style.transform = `translate(0px, 0px)`;
    if (currentScene === "cafe" && currentUser) update(ref(db, `cafePlayers/${currentUser.uid}`), { x: Math.round(myX), y: Math.round(myY) });
};
zone.addEventListener('pointerup', stopJoystick);
zone.addEventListener('pointercancel', stopJoystick);

window.addEventListener("keydown", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; checkKeyboard(); });
window.addEventListener("keyup", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; checkKeyboard(); });

function checkKeyboard() {
    if (isDraggingJoystick || document.activeElement.tagName === "INPUT") return; 
    let vx = 0, vy = 0;
    if (keys.ArrowUp || keys.w) vy = -1;
    if (keys.ArrowDown || keys.s) vy = 1;
    if (keys.ArrowLeft || keys.a) vx = -1;
    if (keys.ArrowRight || keys.d) vx = 1;
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    moveVector.x = vx; moveVector.y = vy;
}

// ==========================================
// 5. 其他 UI 邏輯 (傢俱面板、相簿、設定)
// ==========================================
document.getElementById("spawn-fridge-btn").onclick = () => {
    if (!cafeFurnitureData.fridge) update(ref(db, 'cafeFurniture/fridge'), { x: myX, y: myY + 50, locked: false });
};
document.getElementById("spawn-memory-btn").onclick = () => {
    if (!cafeFurnitureData.memory) update(ref(db, 'cafeFurniture/memory'), { x: myX + 50, y: myY, locked: false });
};
document.getElementById("move-furniture-btn").onclick = () => {
    let type = furnitureMenu.dataset.type;
    update(ref(db, `cafeFurniture/${type}`), { locked: false });
    furnitureMenu.style.display = "none";
};

// 查看名牌視窗
document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    if (targetUid === currentUser.uid) showProfileModal(myProfile);
    else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) showProfileModal(snap.val());
        else if (cafePlayersData[targetUid]) showProfileModal(cafePlayersData[targetUid]); 
    }
});
function showProfileModal(p) {
    document.getElementById("vp-title").innerText = `🧅 ${p.name || '匿名'} 的名牌`;
    document.getElementById("vp-birth").innerText = p.birth || '未知';
    document.getElementById("vp-food").innerText = p.food || '無';
    document.getElementById("vp-motto").innerText = p.motto || '無';
    viewProfileModal.style.display = "block";
}

// 相簿回憶錄邏輯
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
                push(ref(db, 'memories'), { author: myProfile.name, img: cvs.toDataURL('image/jpeg', 0.7), text: text, time: new Date().toLocaleDateString('zh-TW') });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        push(ref(db, 'memories'), { author: myProfile.name, img: "", text: text, time: new Date().toLocaleDateString('zh-TW') });
    }
    fileInput.value = ""; textInput.value = "";
};

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

// 儲存設定檔
document.getElementById("save-settings-btn").addEventListener("click", () => {
    myProfile.name = document.getElementById("set-name").value || "匿名";
    myProfile.color = document.getElementById("set-color").value;
    myProfile.birth = document.getElementById("set-birth").value || "未知";
    myProfile.food = document.getElementById("set-food").value || "無";
    myProfile.motto = document.getElementById("set-motto").value || "無";
    
    update(ref(db, `users/${currentUser.uid}`), { name: myProfile.name, color: myProfile.color, birth: myProfile.birth, food: myProfile.food, motto: myProfile.motto });
    if (currentScene === "cafe") update(ref(db, `cafePlayers/${currentUser.uid}`), { name: myProfile.name, color: myProfile.color });
    document.getElementById('settings-modal').style.display = 'none';
    
    // 即時更新畫布上的自己的名字
    if(game && game.scene.keys.OnionScene) {
        game.scene.keys.OnionScene.myPlayer.nameText.setText(myProfile.name).setColor(myProfile.color);
    }
});

// 聊天與泡泡系統
function sendBubble(msg) {
    if (currentUser) {
        myProfile.bubbleMsg = msg; 
        myProfile.bubbleTime = Date.now();
        if (currentScene === "cafe") update(ref(db, `cafePlayers/${currentUser.uid}`), { bubbleMsg: msg, bubbleTime: myProfile.bubbleTime });
    }
}

function actionA() { sendBubble("使用了 A 技能!"); }
function actionB() { sendBubble("按下了 B 按鈕!"); }
document.getElementById("btn-a").addEventListener("pointerdown", actionA);
document.getElementById("btn-b").addEventListener("pointerdown", actionB);
window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return; 
    if (e.key.toLowerCase() === 'a') actionA();
    if (e.key.toLowerCase() === 'b') actionB();
});

const chatInput = document.getElementById("chat-input");
document.getElementById("send-btn").addEventListener("click", sendChat);
window.addEventListener("keydown", (e) => { if (e.key === "Enter" && document.activeElement === chatInput) sendChat(); });

function sendChat() {
    const msg = chatInput.value.trim();
    if (msg !== "" && currentUser) {
        push(ref(db, 'chats'), { name: myProfile.name, msg: msg, time: new Date().toLocaleTimeString('zh-TW', { hour12: false }) });
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