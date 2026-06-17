// 1. 從 Firebase CDN 載入所需的模組 (替換原本的 bare imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. 你的專屬 Firebase 設定檔
const firebaseConfig = {
  apiKey: "AIzaSyC266DIMj81hWMk83GEmqSbBl85VY3tTcE",
  authDomain: "onion-love.firebaseapp.com",
  databaseURL: "https://onion-love-default-rtdb.firebaseio.com",
  projectId: "onion-love",
  storageBucket: "onion-love.firebasestorage.app",
  messagingSenderId: "431036248901",
  appId: "1:431036248901:web:533465a08cfa8410f7c42c",
  measurementId: "G-PBLP6XH2VY"
};

// 3. 初始化 Firebase 服務
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // 啟用 Google 分析 (可選)
const db = getDatabase(app);         // 啟用即時資料庫

// ==========================================
// 下方是「洋蔥人交誼廳」的遊戲核心邏輯
// ==========================================

// 遊戲變數
let myId = `user_${Math.floor(Math.random() * 10000)}`;
let myName = "";
let myColor = "";
let players = {};
const speed = 10;

// DOM 元素取得
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");

// --- 登入與初始化 ---
document.getElementById("join-btn").addEventListener("click", () => {
    myName = document.getElementById("username").value || "匿名洋蔥";
    myColor = document.getElementById("usercolor").value;
    
    loginScreen.style.display = "none";
    gameContainer.style.display = "flex";

    // 在 Firebase 建立玩家資料 (預設在畫布中間 300, 200)
    const playerRef = ref(db, `players/${myId}`);
    set(playerRef, { x: 300, y: 200, name: myName, color: myColor });
    
    // 當使用者關閉視窗或斷線時，自動從資料庫移除該角色
    onDisconnect(playerRef).remove();

    // 啟動監聽與遊戲迴圈
    listenToPlayers();
    listenToChat();
    gameLoop();
});

// --- 準備圖片素材 (新增這兩行，負責把圖片載入進來) ---
const onionImg = new Image();
onionImg.src = 'onion-sprite.png'; // 記得把你的洋蔥人去背圖檔取名為這個

// --- 繪製洋蔥人 (圖片升級版) ---
function drawOnionMan(x, y, color, name) {
    // 1. 繪製角色圖片
    if (onionImg.complete) {
        ctx.drawImage(onionImg, x - 25, y - 40, 50, 50); 
    } else {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x - 25, y - 40, 50, 50);
    }

    // 2. 繪製玩家名字背景 (半透明黑底)
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    if (ctx.roundRect) {
        ctx.roundRect(x - 30, y - 55, 60, 18, 4);
    } else {
        ctx.fillRect(x - 30, y - 55, 60, 18);
    }
    ctx.fill();

    // 3. 繪製玩家名字與選擇的光環顏色
    ctx.fillStyle = color; 
    ctx.font = "12px 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, x, y - 46);
}
}

// --- 遊戲渲染迴圈 (每秒更新約 60 次畫面) ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空舊畫布
    
    // 畫出包含自己在內的所有在線玩家
    Object.keys(players).forEach(id => {
        const p = players[id];
        drawOnionMan(p.x, p.y, p.color, p.name);
    });
    
    requestAnimationFrame(gameLoop);
}

// --- 虛擬搖桿移動控制 ---
function movePlayer(dx, dy) {
    if (!players[myId]) return;
    let newX = players[myId].x + dx;
    let newY = players[myId].y + dy;
    
    // 簡單的邊界碰撞偵測 (不讓角色跑出畫布)
    if(newX < 20) newX = 20; 
    if(newX > canvas.width - 20) newX = canvas.width - 20;
    if(newY < 40) newY = 40; 
    if(newY > canvas.height - 20) newY = canvas.height - 20;

    // 將新座標更新到 Firebase (這會自動觸發所有人畫面的更新)
    set(ref(db, `players/${myId}`), {
        x: newX, y: newY, name: myName, color: myColor
    });
}

// 綁定搖桿按鈕
document.getElementById("btn-up").onclick = () => movePlayer(0, -speed);
document.getElementById("btn-down").onclick = () => movePlayer(0, speed);
document.getElementById("btn-left").onclick = () => movePlayer(-speed, 0);
document.getElementById("btn-right").onclick = () => movePlayer(speed, 0);

// --- 即時資料同步 (監聽別人移動) ---
function listenToPlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        players = snapshot.val() || {};
    });
}

// --- 聊天室功能 ---
document.getElementById("send-btn").addEventListener("click", () => {
    if (chatInput.value.trim() !== "") {
        // push 會自動產生一組不重複的 ID 來新增對話
        push(ref(db, 'chats'), {
            name: myName,
            msg: chatInput.value,
            time: new Date().toLocaleTimeString('zh-TW', { hour12: false })
        });
        chatInput.value = ""; // 清空輸入框
    }
});

function listenToChat() {
    onValue(ref(db, 'chats'), (snapshot) => {
        chatBox.innerHTML = "";
        const chats = snapshot.val();
        if (chats) {
            Object.values(chats).forEach(c => {
                chatBox.innerHTML += `<div><strong style="color:#2e7d32;">${c.name}</strong> <span style="font-size:0.8em;color:#888;">[${c.time}]</span>: ${c.msg}</div>`;
            });
            // 自動捲動到最新訊息
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}
