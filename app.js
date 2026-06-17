import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); 
const db = getDatabase(app);         

// 遊戲變數
let myId = `user_${Math.floor(Math.random() * 10000)}`;
let myName = "";
let myColor = "";
let players = {};
let myX = 300, myY = 200; // 本地玩家座標
const speed = 4; // 搖桿移動速度

// 搖桿變數
let isDragging = false;
let moveVector = { x: 0, y: 0 };

// 碰撞牆壁設定 (定義一個中央吧檯作為無法穿透的區域)
// {x, y, w, h} 代表矩形的左上角座標與寬高
const walls = [
    { x: 220, y: 150, w: 160, h: 60 } 
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");

// --- 圖片素材 ---
const onionImg = new Image();
onionImg.src = 'onion-sprite.png'; 

// --- 登入 ---
document.getElementById("join-btn").addEventListener("click", () => {
    myName = document.getElementById("username").value || "匿名洋蔥";
    myColor = document.getElementById("usercolor").value;
    
    loginScreen.style.display = "none";
    gameContainer.style.display = "flex";

    const playerRef = ref(db, `players/${myId}`);
    set(playerRef, { x: myX, y: myY, name: myName, color: myColor, bubbleMsg: "", bubbleTime: 0 });
    onDisconnect(playerRef).remove();

    listenToPlayers();
    listenToChat();
    gameLoop();
});

// --- 繪製 ---
function drawOnionMan(p) {
    let x = p.x;
    let y = p.y;

    // 1. 畫角色圖
    if (onionImg.complete) {
        ctx.drawImage(onionImg, x - 25, y - 40, 50, 50); 
    } else {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x - 25, y - 40, 50, 50);
    }

    // 2. 畫名字
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    if (ctx.roundRect) ctx.roundRect(x - 30, y - 55, 60, 18, 4);
    else ctx.fillRect(x - 30, y - 55, 60, 18);
    ctx.fill();
    ctx.fillStyle = p.color; 
    ctx.font = "12px 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.name, x, y - 46);

    // 3. 畫對話泡泡 (如果訊息發出不到 5 秒)
    if (p.bubbleMsg && (Date.now() - p.bubbleTime < 5000)) {
        ctx.fillStyle = "rgba(244, 236, 216, 0.95)"; // 羊皮紙底色
        ctx.strokeStyle = "#c5a059";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 60, y - 95, 120, 30, 8);
        else ctx.fillRect(x - 60, y - 95, 120, 30);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#3e2723"; // 文字顏色
        ctx.font = "bold 13px 'Georgia'";
        
        // 限制對話泡泡長度
        let displayMsg = p.bubbleMsg.length > 8 ? p.bubbleMsg.substring(0, 8) + "..." : p.bubbleMsg;
        ctx.fillText(displayMsg, x, y - 80);
    }
}

// 碰撞偵測邏輯
function canMoveTo(newX, newY) {
    const r = 20; // 角色的虛擬碰撞半徑
    
    // 檢查畫布邊界
    if(newX < r || newX > canvas.width - r || newY < 40 || newY > canvas.height - r) {
        return false;
    }

    // 檢查牆壁障礙物
    for (let wall of walls) {
        if (newX + r > wall.x && newX - r < wall.x + wall.w &&
            newY + r > wall.y && newY - r < wall.y + wall.h) {
            return false;
        }
    }
    return true;
}

// 遊戲渲染迴圈
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    // 畫出障礙物 (吧檯) 讓你稍微看得到邊界
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // 處理本地玩家移動
    if (isDragging && (moveVector.x !== 0 || moveVector.y !== 0)) {
        let nextX = myX + moveVector.x * speed;
        let nextY = myY + moveVector.y * speed;
        
        // 分別測試 X 與 Y 軸，讓玩家可以貼著牆壁滑動
        if (canMoveTo(nextX, myY)) myX = nextX;
        if (canMoveTo(myX, nextY)) myY = nextY;
    }

    // 畫出所有玩家
    Object.keys(players).forEach(id => {
        // 如果是自己，採用本地高幀率座標渲染，否則採用雲端座標
        let p = players[id];
        if (id === myId) {
            p.x = myX;
            p.y = myY;
        }
        drawOnionMan(p);
    });
    
    requestAnimationFrame(gameLoop);
}

// 每 100 毫秒將自己的座標同步到 Firebase，節省頻寬
setInterval(() => {
    if (isDragging) {
        update(ref(db, `players/${myId}`), { x: myX, y: myY });
    }
}, 100);

// --- 觸控虛擬搖桿邏輯 ---
const zone = document.getElementById('joystick-zone');
const knob = document.getElementById('joystick-knob');
const center = { x: 60, y: 60 }; // zone 的中心點
const maxDist = 35; // 搖桿最大推動距離

function handleTouch(e) {
    e.preventDefault(); // 阻止螢幕跟著滾動
    isDragging = true;
    const rect = zone.getBoundingClientRect();
    const touch = e.touches[0];
    
    let dx = touch.clientX - rect.left - center.x;
    let dy = touch.clientY - rect.top - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxDist) {
        dx = (dx / distance) * maxDist;
        dy = (dy / distance) * maxDist;
    }
    
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVector.x = dx / maxDist;
    moveVector.y = dy / maxDist;
}

zone.addEventListener('touchstart', handleTouch, {passive: false});
zone.addEventListener('touchmove', handleTouch, {passive: false});
zone.addEventListener('touchend', () => {
    isDragging = false;
    moveVector = { x: 0, y: 0 };
    knob.style.transform = `translate(0px, 0px)`;
    // 停止時發送最後一次位置確保對齊
    update(ref(db, `players/${myId}`), { x: myX, y: myY }); 
});

// --- 即時資料與聊天 ---
function listenToPlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        players = snapshot.val() || {};
    });
}

document.getElementById("send-btn").addEventListener("click", () => {
    const msgText = chatInput.value.trim();
    if (msgText !== "") {
        // 1. 新增到歷史對話紀錄
        push(ref(db, 'chats'), {
            name: myName, msg: msgText,
            time: new Date().toLocaleTimeString('zh-TW', { hour12: false })
        });
        
        // 2. 更新到自己角色的頭頂泡泡
        update(ref(db, `players/${myId}`), {
            bubbleMsg: msgText,
            bubbleTime: Date.now()
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
                chatBox.innerHTML += `<div><strong style="color:var(--mucha-gold);">${c.name}</strong>: ${c.msg}</div>`;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
}
