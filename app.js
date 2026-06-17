import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 替換成你的 Firebase 設定
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 遊戲變數
let myId = `user_${Math.floor(Math.random() * 10000)}`;
let myName = "";
let myColor = "";
let players = {};
const speed = 10;

// DOM 元素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");

// --- 1. 登入與初始化 ---
document.getElementById("join-btn").addEventListener("click", () => {
    myName = document.getElementById("username").value || "匿名洋蔥";
    myColor = document.getElementById("usercolor").value;
    
    loginScreen.style.display = "none";
    gameContainer.style.display = "flex";

    // 在 Firebase 建立玩家資料
    const playerRef = ref(db, `players/${myId}`);
    set(playerRef, { x: 300, y: 200, name: myName, color: myColor });
    
    // 當使用者關閉視窗時，自動從資料庫移除
    onDisconnect(playerRef).remove();

    listenToPlayers();
    listenToChat();
    gameLoop();
});

// --- 2. 繪製洋蔥人 ---
function drawOnionMan(x, y, color, name) {
    ctx.fillStyle = color;
    ctx.beginPath();
    // 簡單的洋蔥形狀 (圓形底部加上尖頭)
    ctx.arc(x, y, 20, 0, Math.PI * 2); 
    ctx.fill();
    
    // 洋蔥上的綠色小芽
    ctx.fillStyle = "#4caf50";
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x - 5, y - 35);
    ctx.lineTo(x + 5, y - 35);
    ctx.fill();

    // 名字標籤
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(name, x, y - 40);
}

// 遊戲渲染迴圈
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空畫布
    
    // 畫出所有玩家
    Object.keys(players).forEach(id => {
        const p = players[id];
        drawOnionMan(p.x, p.y, p.color, p.name);
    });
    
    requestAnimationFrame(gameLoop);
}

// --- 3. 虛擬搖桿移動控制 ---
function movePlayer(dx, dy) {
    if (!players[myId]) return;
    let newX = players[myId].x + dx;
    let newY = players[myId].y + dy;
    
    // 邊界限制
    if(newX < 20) newX = 20; if(newX > canvas.width - 20) newX = canvas.width - 20;
    if(newY < 40) newY = 40; if(newY > canvas.height - 20) newY = canvas.height - 20;

    // 更新 Firebase (這會觸發 onValue，更新所有人畫面)
    set(ref(db, `players/${myId}`), {
        x: newX, y: newY, name: myName, color: myColor
    });
}

document.getElementById("btn-up").onclick = () => movePlayer(0, -speed);
document.getElementById("btn-down").onclick = () => movePlayer(0, speed);
document.getElementById("btn-left").onclick = () => movePlayer(-speed, 0);
document.getElementById("btn-right").onclick = () => movePlayer(speed, 0);

// --- 4. 即時資料同步 ---
function listenToPlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        players = snapshot.val() || {};
    });
}

// --- 5. 聊天室功能 ---
document.getElementById("send-btn").addEventListener("click", () => {
    if (chatInput.value.trim() !== "") {
        push(ref(db, 'chats'), {
            name: myName,
            msg: chatInput.value,
            time: new Date().toLocaleTimeString()
        });
        chatInput.value = "";
    }
});

function listenToChat() {
    onValue(ref(db, 'chats'), (snapshot) => {
        chatBox.innerHTML = "";
        const chats = snapshot.val();
        if (chats) {
            Object.values(chats).forEach(c => {
                chatBox.innerHTML += `<div><strong>${c.name}</strong> [${c.time}]: ${c.msg}</div>`;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}