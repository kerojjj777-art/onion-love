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
let cafeUnsubscribe = null;
const speed = 4;

// 操控變數
let isDragging = false;
let moveVector = { x: 0, y: 0 };
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };

// --- DOM 元素 ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const topBar = document.getElementById("top-bar");
const sceneTitle = document.getElementById("game-title");
const chatSection = document.getElementById("chat-section");
const dropdownMenu = document.getElementById("dropdown-menu");
const settingsModal = document.getElementById("settings-modal");
const actionMenu = document.getElementById("action-menu");
const viewProfileModal = document.getElementById("view-profile-modal");

// --- 素材準備 ---
const onionImg = new Image(); onionImg.src = 'onion-sprite.png'; 
const bgCafe = new Image(); bgCafe.src = 'cafe-bg.jpg';
const bgDoghouse = new Image(); bgDoghouse.src = 'doghouse-bg.jpg';

// ==========================================
// 1. 登入與 Auth 狀態管理
// ==========================================
document.getElementById("join-btn").addEventListener("click", () => {
    const email = document.getElementById("user-email").value;
    const pwd = document.getElementById("user-pwd").value;
    signInWithEmailAndPassword(auth, email, pwd)
        .catch(error => alert("登入失敗: " + error.message));
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = "none";
        topBar.style.display = "flex";
        gameContainer.style.display = "flex";
        
        // 讀取個人資料
        const profileSnap = await get(ref(db, `users/${user.uid}`));
        if (profileSnap.exists()) {
            myProfile = { ...myProfile, ...profileSnap.val() };
        } else {
            set(ref(db, `users/${user.uid}`), { name: myProfile.name, color: myProfile.color, birth: myProfile.birth, food: myProfile.food, motto: myProfile.motto });
        }

        switchScene("doghouse"); 
        listenToChat();
        requestAnimationFrame(gameLoop);
    } else {
        currentUser = null;
        loginScreen.style.display = "block";
        topBar.style.display = "none";
        gameContainer.style.display = "none";
        dropdownMenu.style.display = "none";
        if (cafeUnsubscribe) cafeUnsubscribe();
    }
});

document.getElementById("nav-logout").addEventListener("click", () => {
    leaveCafe();
    signOut(auth);
});

// ==========================================
// 2. 選單與場景切換
// ==========================================
function switchScene(scene) {
    currentScene = scene;
    dropdownMenu.style.display = "none";
    myX = 300; myY = 200; // 重置座標
    
    if (scene === "doghouse") {
        sceneTitle.innerText = "我的狗窩";
        chatSection.style.display = "none";
        leaveCafe();
    } else if (scene === "cafe") {
        sceneTitle.innerText = "洋蔥大廳";
        chatSection.style.display = "flex";
        joinCafe();
    }
}

document.getElementById("nav-doghouse").addEventListener("click", () => switchScene("doghouse"));
document.getElementById("nav-cafe").addEventListener("click", () => switchScene("cafe"));

function joinCafe() {
    const playerRef = ref(db, `cafePlayers/${currentUser.uid}`);
    set(playerRef, { x: myX, y: myY, name: myProfile.name, color: myProfile.color, bubbleMsg: myProfile.bubbleMsg, bubbleTime: myProfile.bubbleTime });
    onDisconnect(playerRef).remove(); 
    
    cafeUnsubscribe = onValue(ref(db, 'cafePlayers'), (snapshot) => {
        cafePlayers = snapshot.val() || {};
    });
}

function leaveCafe() {
    if (currentUser) set(ref(db, `cafePlayers/${currentUser.uid}`), null);
    if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }
}

// ==========================================
// 3. 角色點擊與資訊卡邏輯 (取代原本固定顯示)
// ==========================================
canvas.addEventListener('pointerdown', (e) => {
    if(!currentUser) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;   // 計算畫面縮放比例
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    let clickedUid = null;

    if (currentScene === "doghouse") {
        if (Math.abs(clickX - myX) < 35 && Math.abs(clickY - myY) < 45) clickedUid = currentUser.uid;
    } else if (currentScene === "cafe") {
        for (let id in cafePlayers) {
            let px = (id === currentUser.uid) ? myX : cafePlayers[id].x;
            let py = (id === currentUser.uid) ? myY : cafePlayers[id].y;
            if (Math.abs(clickX - px) < 35 && Math.abs(clickY - py) < 45) {
                clickedUid = id;
                break;
            }
        }
    }

    if (clickedUid) {
        actionMenu.style.display = "block";
        actionMenu.style.left = (e.pageX + 10) + "px"; // 顯示在點擊處右側
        actionMenu.style.top = (e.pageY - 20) + "px";
        actionMenu.dataset.uid = clickedUid;
    } else {
        actionMenu.style.display = "none";
    }
});

document.getElementById("view-profile-btn").addEventListener("click", async () => {
    actionMenu.style.display = "none";
    const targetUid = actionMenu.dataset.uid;
    
    if (targetUid === currentUser.uid) {
        showProfileModal(myProfile);
    } else {
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) {
            showProfileModal(snap.val());
        } else if (cafePlayers[targetUid]) {
            showProfileModal(cafePlayers[targetUid]); // 備用方案
        }
    }
});

function showProfileModal(profile) {
    document.getElementById("vp-title").innerText = `🧅 ${profile.name || '匿名'} 的名牌`;
    document.getElementById("vp-birth").innerText = profile.birth || '未知';
    document.getElementById("vp-food").innerText = profile.food || '無';
    document.getElementById("vp-motto").innerText = profile.motto || '無';
    viewProfileModal.style.display = "block";
}

document.getElementById("close-vp-btn").addEventListener("click", () => {
    viewProfileModal.style.display = "none";
});

// 編輯個人設定
document.getElementById("nav-settings").addEventListener("click", () => {
    dropdownMenu.style.display = "none";
    document.getElementById("set-name").value = myProfile.name;
    document.getElementById("set-color").value = myProfile.color;
    document.getElementById("set-birth").value = myProfile.birth;
    document.getElementById("set-food").value = myProfile.food;
    document.getElementById("set-motto").value = myProfile.motto;
    settingsModal.style.display = "block";
});

document.getElementById("close-settings-btn").addEventListener("click", () => settingsModal.style.display = "none");
document.getElementById("save-settings-btn").addEventListener("click", () => {
    myProfile.name = document.getElementById("set-name").value || "匿名";
    myProfile.color = document.getElementById("set-color").value;
    myProfile.birth = document.getElementById("set-birth").value || "未知";
    myProfile.food = document.getElementById("set-food").value || "無";
    myProfile.motto = document.getElementById("set-motto").value || "無";
    
    const dbData = { name: myProfile.name, color: myProfile.color, birth: myProfile.birth, food: myProfile.food, motto: myProfile.motto };
    update(ref(db, `users/${currentUser.uid}`), dbData);
    if (currentScene === "cafe") update(ref(db, `cafePlayers/${currentUser.uid}`), { name: myProfile.name, color: myProfile.color });
    settingsModal.style.display = "none";
});

// ==========================================
// 4. 控制系統 (優化搖桿 PointerEvents)
// ==========================================
const zone = document.getElementById('joystick-zone');
const knob = document.getElementById('joystick-knob');
const maxDist = 30;

function handlePointerMove(e) {
    if (!isDragging) return;
    const rect = zone.getBoundingClientRect();
    // 計算搖桿中心點的位移 (100寬度, 中心為50)
    let dx = e.clientX - rect.left - 50; 
    let dy = e.clientY - rect.top - 50;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDist) { dx = (dx / distance) * maxDist; dy = (dy / distance) * maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVector.x = dx / maxDist; moveVector.y = dy / maxDist;
}

zone.addEventListener('pointerdown', (e) => { 
    isDragging = true; knob.style.transition = 'none'; 
    zone.setPointerCapture(e.pointerId); // 鎖定觸控焦點在搖桿區
    handlePointerMove(e); 
});
zone.addEventListener('pointermove', handlePointerMove);
zone.addEventListener('pointerup', resetJoystick);
zone.addEventListener('pointercancel', resetJoystick);

function resetJoystick() {
    isDragging = false; moveVector = { x: 0, y: 0 };
    knob.style.transition = 'transform 0.1s linear';
    knob.style.transform = `translate(0px, 0px)`;
    if (currentScene === "cafe" && currentUser) update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
}

// 鍵盤移動
window.addEventListener("keydown", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; checkKeyboard(); });
window.addEventListener("keyup", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; checkKeyboard(); });

function checkKeyboard() {
    if (isDragging) return; 
    let vx = 0, vy = 0;
    if (keys.ArrowUp || keys.w) vy = -1;
    if (keys.ArrowDown || keys.s) vy = 1;
    if (keys.ArrowLeft || keys.a) vx = -1;
    if (keys.ArrowRight || keys.d) vx = 1;
    
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    moveVector.x = vx; moveVector.y = vy;
}

// ==========================================
// 5. 繪圖與遊戲迴圈
// ==========================================
function drawOnionMan(x, y, p) {
    if (onionImg.complete) ctx.drawImage(onionImg, x - 25, y - 40, 50, 50); 
    else { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x - 25, y - 40, 50, 50); }

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    if (ctx.roundRect) ctx.roundRect(x - 30, y - 55, 60, 18, 4); else ctx.fillRect(x - 30, y - 55, 60, 18);
    ctx.fill();
    ctx.fillStyle = p.color; 
    ctx.font = "12px 'Georgia', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.name, x, y - 46);

    // 頭頂講話泡泡
    if (p.bubbleMsg && (Date.now() - p.bubbleTime < 4000)) {
        ctx.fillStyle = "rgba(244, 236, 216, 0.95)"; ctx.strokeStyle = "#c5a059"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 60, y - 95, 120, 30, 8); else ctx.fillRect(x - 60, y - 95, 120, 30);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3e2723"; ctx.font = "bold 13px 'Georgia'";
        let displayMsg = p.bubbleMsg.length > 8 ? p.bubbleMsg.substring(0, 8) + "..." : p.bubbleMsg;
        ctx.fillText(displayMsg, x, y - 80);
    }
}

function gameLoop() {
    if (!currentUser) return;
    
    // 預填底色防止圖片未載入時一片黑
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
        
        // 畫出大廳所有人
        Object.keys(cafePlayers).forEach(id => {
            let p = cafePlayers[id];
            // 本機端使用自己的高更新率座標與最新氣泡狀態
            if (id === currentUser.uid) drawOnionMan(myX, myY, { ...myProfile, bubbleMsg: myProfile.bubbleMsg, bubbleTime: myProfile.bubbleTime });
            else drawOnionMan(p.x, p.y, p);
        });
    }
    requestAnimationFrame(gameLoop);
}

setInterval(() => {
    if (currentScene === "cafe" && currentUser && (moveVector.x !== 0 || moveVector.y !== 0)) {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
    }
}, 100);

// ==========================================
// 6. 聊天系統與氣泡
// ==========================================
function sendBubble(msg) {
    if (currentUser) {
        myProfile.bubbleMsg = msg; // 讓本地畫面立刻出現泡泡
        myProfile.bubbleTime = Date.now();
        if (currentScene === "cafe") {
            update(ref(db, `cafePlayers/${currentUser.uid}`), { bubbleMsg: msg, bubbleTime: myProfile.bubbleTime });
        }
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
window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement === chatInput) sendChat();
});

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
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}
