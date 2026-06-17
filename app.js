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
let currentScene = "doghouse"; // "doghouse" 或 "cafe"
let myProfile = { name: "初心者", color: "#c5a059", birth: "未知", food: "洋蔥", motto: "期待發芽" };
let myX = 300, myY = 200; 
let cafePlayers = {};
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

// --- 素材準備 ---
const onionImg = new Image(); onionImg.src = 'onion-sprite.png'; 
const bgCafe = new Image(); bgCafe.src = 'cafe-bg.jpg';
const bgDoghouse = new Image(); bgDoghouse.src = 'doghouse-bg.jpg'; // 請準備這張圖

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
            myProfile = profileSnap.val();
        } else {
            // 初次登入建立預設資料
            set(ref(db, `users/${user.uid}`), myProfile);
        }

        switchScene("doghouse"); // 登入後預設進入狗窩
        listenToChat();
        requestAnimationFrame(gameLoop);
    } else {
        currentUser = null;
        loginScreen.style.display = "block";
        topBar.style.display = "none";
        gameContainer.style.display = "none";
        dropdownMenu.style.display = "none";
    }
});

document.getElementById("nav-logout").addEventListener("click", () => {
    if (currentScene === "cafe") leaveCafe();
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
    set(playerRef, { x: myX, y: myY, name: myProfile.name, color: myProfile.color, bubbleMsg: "", bubbleTime: 0 });
    onDisconnect(playerRef).remove(); // 斷線自動離開
    
    onValue(ref(db, 'cafePlayers'), (snapshot) => {
        cafePlayers = snapshot.val() || {};
    });
}

function leaveCafe() {
    if (currentUser) {
        set(ref(db, `cafePlayers/${currentUser.uid}`), null);
    }
}

// ==========================================
// 3. 角色設定邏輯
// ==========================================
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
    
    update(ref(db, `users/${currentUser.uid}`), myProfile);
    if (currentScene === "cafe") {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { name: myProfile.name, color: myProfile.color });
    }
    settingsModal.style.display = "none";
});

// ==========================================
// 4. 控制系統 (搖桿、滑鼠、鍵盤、AB鍵)
// ==========================================
const zone = document.getElementById('joystick-zone');
const knob = document.getElementById('joystick-knob');
const center = { x: 50, y: 50 };
const maxDist = 30;

// Pointer Events 支援滑鼠與觸控
function handlePointerDown(e) { isDragging = true; knob.style.transition = 'none'; handlePointerMove(e); }
function handlePointerMove(e) {
    if (!isDragging) return;
    const rect = zone.getBoundingClientRect();
    let clientX = e.clientX || (e.touches && e.touches[0].clientX);
    let clientY = e.clientY || (e.touches && e.touches[0].clientY);
    let dx = clientX - rect.left - center.x;
    let dy = clientY - rect.top - center.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDist) { dx = (dx / distance) * maxDist; dy = (dy / distance) * maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVector.x = dx / maxDist; moveVector.y = dy / maxDist;
}
function handlePointerUp() {
    isDragging = false; moveVector = { x: 0, y: 0 };
    knob.style.transition = 'transform 0.1s linear';
    knob.style.transform = `translate(0px, 0px)`;
    if (currentScene === "cafe" && currentUser) update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
}

zone.addEventListener('pointerdown', handlePointerDown);
document.addEventListener('pointermove', handlePointerMove);
document.addEventListener('pointerup', handlePointerUp);

// 鍵盤移動
window.addEventListener("keydown", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; checkKeyboard(); });
window.addEventListener("keyup", (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; checkKeyboard(); });

function checkKeyboard() {
    if (isDragging) return; // 搖桿優先
    let vx = 0, vy = 0;
    if (keys.ArrowUp || keys.w) vy = -1;
    if (keys.ArrowDown || keys.s) vy = 1;
    if (keys.ArrowLeft || keys.a) vx = -1;
    if (keys.ArrowRight || keys.d) vx = 1;
    
    // 修正斜向移動速度
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    moveVector.x = vx; moveVector.y = vy;
}

// AB 鍵行為 (發送氣泡)
function actionA() { sendBubble("使用了 A 技能!"); }
function actionB() { sendBubble("按下了 B 按鈕!"); }
document.getElementById("btn-a").addEventListener("mousedown", actionA);
document.getElementById("btn-b").addEventListener("mousedown", actionB);
document.getElementById("btn-a").addEventListener("touchstart", (e) => { e.preventDefault(); actionA(); });
document.getElementById("btn-b").addEventListener("touchstart", (e) => { e.preventDefault(); actionB(); });
window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return; // 打字時不觸發
    if (e.key.toLowerCase() === 'a') actionA();
    if (e.key.toLowerCase() === 'b') actionB();
});

function sendBubble(msg) {
    if (currentScene === "cafe" && currentUser) {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { bubbleMsg: msg, bubbleTime: Date.now() });
    }
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

function drawProfileCard() {
    ctx.fillStyle = "rgba(244, 236, 216, 0.85)"; ctx.strokeStyle = "#c5a059"; ctx.lineWidth = 3;
    if (ctx.roundRect) ctx.roundRect(10, 10, 200, 120, 10); else ctx.fillRect(10, 10, 200, 120);
    ctx.fill(); ctx.stroke();
    
    ctx.fillStyle = "#3e2723"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "bold 16px 'Georgia'";
    ctx.fillText(`🧅 ${myProfile.name} 的名牌`, 20, 20);
    ctx.font = "14px 'Georgia'";
    ctx.fillText(`🎂 生日: ${myProfile.birth}`, 20, 45);
    ctx.fillText(`🍛 最愛: ${myProfile.food}`, 20, 65);
    ctx.fillText(`📜 座右銘:`, 20, 85);
    ctx.fillStyle = "#4a5d4e"; ctx.font = "italic 13px 'Georgia'";
    ctx.fillText(`"${myProfile.motto}"`, 30, 105);
}

function gameLoop() {
    if (!currentUser) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    // 處理移動
    if (moveVector.x !== 0 || moveVector.y !== 0) {
        let nextX = myX + moveVector.x * speed;
        let nextY = myY + moveVector.y * speed;
        if(nextX > 20 && nextX < canvas.width - 20) myX = nextX;
        if(nextY > 40 && nextY < canvas.height - 20) myY = nextY;
    }

    if (currentScene === "doghouse") {
        if(bgDoghouse.complete) ctx.drawImage(bgDoghouse, 0, 0, canvas.width, canvas.height);
        drawOnionMan(myX, myY, myProfile);
        drawProfileCard();
    } else if (currentScene === "cafe") {
        if(bgCafe.complete) ctx.drawImage(bgCafe, 0, 0, canvas.width, canvas.height);
        Object.keys(cafePlayers).forEach(id => {
            let p = cafePlayers[id];
            if (id === currentUser.uid) drawOnionMan(myX, myY, { ...myProfile, bubbleMsg: p.bubbleMsg, bubbleTime: p.bubbleTime });
            else drawOnionMan(p.x, p.y, p);
        });
    }
}

// 雲端同步頻率 (僅在大廳時同步座標)
setInterval(() => {
    if (currentScene === "cafe" && currentUser && (moveVector.x !== 0 || moveVector.y !== 0)) {
        update(ref(db, `cafePlayers/${currentUser.uid}`), { x: myX, y: myY });
    }
}, 100);

// ==========================================
// 6. 聊天系統
// ==========================================
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
