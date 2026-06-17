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
let currentUser = null;
let currentScene = "doghouse"; 
let myProfile = { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽", bubbleMsg: "", bubbleTime: 0 };
let myX = 300, myY = 200; 
let cafePlayers = {};
let cafeFurniture = {}; 
let cafeUnsubscribe = null;
const speed = 4;

// 操控與點擊變數
let isDraggingJoystick = false;
let moveVector = { x: 0, y: 0 };
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };

let draggingFurniture = null;
let longPressTimer = null;
let clickStart = { x: 0, y: 0 };
let canvasPointerDown = false;

// --- DOM 元素 ---
const canvas = document.getElementById("phaser-app");
const ctx = canvas.getContext("2d");
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const topBar = document.getElementById("top-bar");
const sceneTitle = document.getElementById("game-title");
const chatSection = document.getElementById("chat-section");
const furniturePanel = document.getElementById("furniture-panel");
const dropdownMenu = document.getElementById("dropdown-menu");
const actionMenu = document.getElementById("action-menu");
const furnitureMenu = document.getElementById("furniture-menu");
const viewProfileModal = document.getElementById("view-profile-modal");

// --- 素材準備 ---
const onionImg = new Image(); onionImg.src = 'onion-sprite.png'; 
const bgCafe = new Image(); bgCafe.src = 'cafe-bg.jpg';
const bgDoghouse = new Image(); bgDoghouse.src = 'doghouse-bg.jpg';
// 準備兩張傢俱圖片，請上傳至同資料夾
const fridgeImg = new Image(); fridgeImg.src = 'fridge.png'; 
const memoryImg = new Image(); memoryImg.src = 'memory.png'; 

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
        currentUser = user;
        loginScreen.style.display = "none";
        topBar.style.display = "flex";
        gameContainer.style.display = "flex";
        
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) myProfile = { ...myProfile, ...profileSnap.val() };
        else set(ref(db, `users/${user.uid}`), { name: myProfile.name, color: myProfile.color, birth: myProfile.birth, food: myProfile.food, motto: myProfile.motto });

        // 讀取大廳傢俱位置
        onValue(ref(db, 'cafeFurniture'), snap => cafeFurniture = snap.val() || {});

        switchScene("doghouse"); 
        listenToChat();
        listenToMemories();
        // requestAnimationFrame(gameLoop);
    } else {
        currentUser = null;
        loginScreen.style.display = "block";
        topBar.style.display = "none";
        gameContainer.style.display = "none";
        dropdownMenu.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe();
    }
});

document.getElementById("nav-logout").addEventListener("click", () => { leaveCafe(); signOut(auth); });

function switchScene(scene) {
    currentScene = scene;
    dropdownMenu.style.display = "none";
    myX = 300; myY = 200; 
    
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
}

document.getElementById("nav-doghouse").addEventListener("click", () => switchScene("doghouse"));
document.getElementById("nav-cafe").addEventListener("click", () => switchScene("cafe"));

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${currentUser.uid}`);
    set(playerRef, { x: myX, y: myY, name: myProfile.name, color: myProfile.color, bubbleMsg: myProfile.bubbleMsg, bubbleTime: myProfile.bubbleTime });
    onDisconnect(playerRef).remove(); 
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => cafePlayers = snapshot.val() || {});
}

function leaveCafe() {
    if (currentUser) set(ref(db, `cafePlayers/${currentUser.uid}`), null);
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

// ==========================================
// 2. 傢俱系統與點擊互動 (長按、單擊)
// ==========================================

// 傢俱面板按鈕
document.getElementById("spawn-fridge-btn").onclick = () => {
    if (!cafeFurniture.fridge) update(ref(db, 'cafeFurniture/fridge'), { x: 300, y: 150, locked: false });
};
document.getElementById("spawn-memory-btn").onclick = () => {
    if (!cafeFurniture.memory) update(ref(db, 'cafeFurniture/memory'), { x: 200, y: 150, locked: false });
};

// 畫面點擊、長按與拖曳判定
canvas.addEventListener('pointerdown', (e) => {
    if (!currentUser) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    clickStart = { x: clickX, y: clickY };
    canvasPointerDown = true;
    actionMenu.style.display = "none";
    furnitureMenu.style.display = "none";

    let hitFurniture = null;
    if (currentScene === "cafe") {
        for (let key in cafeFurniture) {
            let f = cafeFurniture[key];
            if (Math.abs(clickX - f.x) < 30 && Math.abs(clickY - f.y) < 30) {
                hitFurniture = key; break;
            }
        }
    }

    if (hitFurniture) {
        if (!cafeFurniture[hitFurniture].locked) {
            draggingFurniture = hitFurniture; // 可移動狀態，開始拖曳
        } else {
            // 已鎖定，開啟長按計時器 (600ms)
            longPressTimer = setTimeout(() => {
                canvasPointerDown = false; // 取消單擊行為
                furnitureMenu.style.display = "flex";
                furnitureMenu.style.left = (e.pageX + 10) + "px";
                furnitureMenu.style.top = (e.pageY - 20) + "px";
                furnitureMenu.dataset.type = hitFurniture;
            }, 600);
        }
        return; // 點到傢俱就不再判定點到玩家
    }

    // 判定是否點擊玩家名牌
    let clickedUid = null;
    if (currentScene === "doghouse") {
        if (Math.abs(clickX - myX) < 35 && Math.abs(clickY - myY) < 45) clickedUid = currentUser.uid;
    } else if (currentScene === "cafe") {
        for (let id in cafePlayers) {
            let px = (id === currentUser.uid) ? myX : cafePlayers[id].x;
            let py = (id === currentUser.uid) ? myY : cafePlayers[id].y;
            if (Math.abs(clickX - px) < 35 && Math.abs(clickY - py) < 45) { clickedUid = id; break; }
        }
    }

    if (clickedUid) {
        actionMenu.style.display = "flex";
        actionMenu.style.left = (e.pageX + 10) + "px";
        actionMenu.style.top = (e.pageY - 20) + "px";
        actionMenu.dataset.uid = clickedUid;
    }
});

// 傢俱解除鎖定 (更改位置)
document.getElementById("move-furniture-btn").onclick = () => {
    let type = furnitureMenu.dataset.type;
    update(ref(db, `cafeFurniture/${type}`), { locked: false });
    furnitureMenu.style.display = "none";
};

window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const moveX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const moveY = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (draggingFurniture && currentScene === "cafe") {
        // 本地預覽拖曳
        cafeFurniture[draggingFurniture].x = moveX;
        cafeFurniture[draggingFurniture].y = moveY;
    }

    if (canvasPointerDown) {
        // 如果手指滑動超過 10px，取消長按判定
        if (Math.abs(moveX - clickStart.x) > 10 || Math.abs(moveY - clickStart.y) > 10) {
            clearTimeout(longPressTimer); longPressTimer = null;
        }
    }
});

window.addEventListener('pointerup', (e) => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    
    if (draggingFurniture) {
        // 拖曳結束，定格並鎖定，同步到雲端
        update(ref(db, `cafeFurniture/${draggingFurniture}`), { 
            x: cafeFurniture[draggingFurniture].x, 
            y: cafeFurniture[draggingFurniture].y, 
            locked: true 
        });
        draggingFurniture = null;
    } else if (canvasPointerDown) {
        // 是一次快速的單擊
        const rect = canvas.getBoundingClientRect();
        const endX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const endY = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        if (Math.abs(endX - clickStart.x) < 10 && Math.abs(endY - clickStart.y) < 10 && currentScene === "cafe") {
            for (let key in cafeFurniture) {
                let f = cafeFurniture[key];
                if (Math.abs(endX - f.x) < 30 && Math.abs(endY - f.y) < 30 && f.locked) {
                    if (key === 'fridge') document.getElementById('fridge-modal').style.display = 'block';
                    if (key === 'memory') document.getElementById('memory-modal').style.display = 'block';
                }
            }
        }
    }
    canvasPointerDown = false;
});

// 查看名牌視窗
document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    if (targetUid === currentUser.uid) showProfileModal(myProfile);
    else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) showProfileModal(snap.val());
        else if (cafePlayers[targetUid]) showProfileModal(cafePlayers[targetUid]); 
    }
});
function showProfileModal(p) {
    document.getElementById("vp-title").innerText = `🧅 ${p.name || '匿名'} 的名牌`;
    document.getElementById("vp-birth").innerText = p.birth || '未知';
    document.getElementById("vp-food").innerText = p.food || '無';
    document.getElementById("vp-motto").innerText = p.motto || '無';
    viewProfileModal.style.display = "block";
}

// ==========================================
// 3. 相簿回憶錄邏輯 (壓縮圖片與存取)
// ==========================================
document.getElementById("upload-memory-btn").onclick = () => {
    const fileInput = document.getElementById("memory-file");
    const textInput = document.getElementById("memory-text");
    const file = fileInput.files[0];
    const text = textInput.value.trim();

    if (!file && !text) return alert("請上傳圖片或填寫文字！");
    
    if (file) {
        // 壓縮圖片為 Base64 避免塞爆資料庫
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > 300) { h *= 300 / w; w = 300; } // 限制最大寬度 300px
                cvs.width = w; cvs.height = h;
                cvs.getContext('2d').drawImage(img, 0, 0, w, h);
                saveMemoryToDB(cvs.toDataURL('image/jpeg', 0.7), text);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        saveMemoryToDB("", text);
    }
    fileInput.value = ""; textInput.value = "";
};

function saveMemoryToDB(imgBase64, text) {
    push(ref(db, 'memories'), {
        author: myProfile.name,
        img: imgBase64,
        text: text,
        time: new Date().toLocaleDateString('zh-TW')
    });
}

function listenToMemories() {
    onValue(ref(db, 'memories'), snap => {
        const feed = document.getElementById("memory-feed");
        feed.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.values(data).reverse().forEach(m => { // 最新在前
                feed.innerHTML += `
                    <div class="memory-card">
                        <div class="author">${m.author} - ${m.time}</div>
                        ${m.img ? `<img src="${m.img}" alt="回憶照片">` : ''}
                        ${m.text ? `<div class="text">${m.text}</div>` : ''}
                    </div>`;
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
});

// ==========================================
// 4. 控制搖桿系統
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
    if (currentScene === "cafe" && currentUser) update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
};
zone.addEventListener('pointerup', stopJoystick);
zone.addEventListener('pointercancel', stopJoystick);

window.addEventListener("keydown", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; checkKeyboard(); });
window.addEventListener("keyup", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; checkKeyboard(); });

function checkKeyboard() {
    if (isDraggingJoystick) return; 
    let vx = 0, vy = 0;
    if (keys.ArrowUp || keys.w) vy = -1;
    if (keys.ArrowDown || keys.s) vy = 1;
    if (keys.ArrowLeft || keys.a) vx = -1;
    if (keys.ArrowRight || keys.d) vx = 1;
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    moveVector.x = vx; moveVector.y = vy;
}

// ==========================================
// 5. 繪圖與遊戲迴圈 (修復黑邊與泡泡)
// ==========================================
function drawOnionMan(x, y, p) {
    if (onionImg.complete) ctx.drawImage(onionImg, x - 25, y - 40, 50, 50); 
    else { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - 25, y - 40, 50, 50); }

    // 1. 修復渲染 Bug，加入 beginPath() 防止畫布被全黑覆蓋
    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    if (ctx.roundRect) ctx.roundRect(x - 30, y - 55, 60, 18, 4); else ctx.fillRect(x - 30, y - 55, 60, 18);
    ctx.fill();

    ctx.fillStyle = p.color; 
    ctx.font = "12px 'Georgia', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.name, x, y - 46);

    // 2. 泡泡條件：有內容 且 發出時間未超過 15秒 (15000毫秒)
    if (p.bubbleMsg && p.bubbleMsg.trim() !== "" && (Date.now() - p.bubbleTime < 15000)) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(244, 236, 216, 0.95)"; ctx.strokeStyle = "#c5a059"; ctx.lineWidth = 2;
        if (ctx.roundRect) ctx.roundRect(x - 60, y - 95, 120, 30, 8); else ctx.fillRect(x - 60, y - 95, 120, 30);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3e2723"; ctx.font = "bold 13px 'Georgia'";
        let displayMsg = p.bubbleMsg.length > 8 ? p.bubbleMsg.substring(0, 8) + "..." : p.bubbleMsg;
        ctx.fillText(displayMsg, x, y - 80);
    }
}

function gameLoop() {
    /*if (!currentUser) return;
    
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (moveVector.x !== 0 || moveVector.y !== 0) {
        let nextX = myX + moveVector.x * speed;
        let nextY = myY + moveVector.y * speed;
        if(nextX > 20 && nextX < canvas.width - 20) myX = nextX;
        if(nextY > 40 && nextY < canvas.height - 20) myY = nextY;
    }

    if (currentScene === "doghouse") {
        if(bgDoghouse.complete && bgDoghouse.naturalWidth !== 0) ctx.drawImage(bgDoghouse, 0, 0, canvas.width, canvas.height);
        drawOnionMan(myX, myY, myProfile);
    } else if (currentScene === "cafe") {
        if(bgCafe.complete && bgCafe.naturalWidth !== 0) ctx.drawImage(bgCafe, 0, 0, canvas.width, canvas.height);
        
        // 繪製傢俱系統
        for (let key in cafeFurniture) {
            let f = cafeFurniture[key];
            let img = key === 'fridge' ? fridgeImg : memoryImg;
            if (img.complete && img.naturalWidth !== 0) ctx.drawImage(img, f.x - 25, f.y - 25, 50, 50);
            else { ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.fillRect(f.x - 20, f.y - 20, 40, 40); }
            
            // 尚未鎖定時(拖曳模式)，繪製發光邊框提示
            if (!f.locked) {
                ctx.strokeStyle = "rgba(255, 215, 0, 0.8)"; ctx.lineWidth = 3; ctx.strokeRect(f.x - 28, f.y - 28, 56, 56);
            }
        }

        // 繪製大廳玩家
        Object.keys(cafePlayers).forEach(id => {
            let p = cafePlayers[id];
            if (id === currentUser.uid) drawOnionMan(myX, myY, { ...myProfile, bubbleMsg: myProfile.bubbleMsg, bubbleTime: myProfile.bubbleTime });
            else drawOnionMan(p.x, p.y, p);
        });
    }
    requestAnimationFrame(gameLoop);
}
*/
setInterval(() => {
    if (currentScene === "cafe" && currentUser && (moveVector.x !== 0 || moveVector.y !== 0)) {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
    }
}, 100);

// ==========================================
// 6. 聊天系統與最新留言追蹤
// ==========================================
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
            // 3. 修復對話停留：強制將滾動條拉到最新發言底部
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
        }
    });
}
// ==========================================
// 7. Phaser 引擎初始化與測試
// ==========================================
const phaserConfig = {
    type: Phaser.AUTO,
    parent: 'phaser-app',
    width: 600,
    height: 350,
    transparent: true,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(phaserConfig);

let testSprite;

function preload() {
    this.load.image('onion', 'onion-sprite.png');
    this.load.image('bgDoghouse', 'doghouse-bg.jpg');
}

function create() {
    this.add.image(300, 175, 'bgDoghouse').setAlpha(0.5); 
    testSprite = this.add.image(myX, myY, 'onion');
    testSprite.setDisplaySize(50, 50);

    this.add.text(300, 100, 'Phaser 引擎啟動成功', { 
        fontFamily: 'Georgia, serif', 
        fontSize: '22px', 
        color: '#c5a059',
        fontStyle: 'bold'
    }).setOrigin(0.5);
}

function update() {
    if (testSprite) {
        testSprite.x = myX;
        testSprite.y = myY;
    }
}
