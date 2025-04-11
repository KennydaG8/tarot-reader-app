// --- DOM 元素獲取 ---
const drawButton = document.getElementById('draw-button');
let cardSlots = document.querySelectorAll('.card-slot');
let cardImages = document.querySelectorAll('.card-slot img');
let cardMeanings = document.querySelectorAll('.card-meaning');
const llmPromptOutput = document.getElementById('llm-prompt-output');
const topicRadios = document.querySelectorAll('input[name="topic"]');
const userQuestionInput = document.getElementById('user-question');
const copyPromptButton = document.getElementById('copy-prompt-button'); // 新增：獲取複製按鈕

let tarotData = [];
let currentDrawnCards = [];
const cardBackSrc = 'images/card_back.jpg';


// --- 資料載入 ---
fetch('tarot-data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('塔羅牌資料載入成功');
        tarotData = data;
        // 資料載入後啟用按鈕
        drawButton.disabled = false;
    })
    .catch(error => {
        console.error('無法載入塔羅牌資料:', error);
        alert('抱歉，無法載入塔羅牌資料，請稍後再試。');
        drawButton.disabled = true;
    });

// --- 核心功能函式 ---

// 洗牌函式 (Fisher-Yates Shuffle) - 不變
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 抽三張牌函式 - 基本不變，只返回抽到的牌資料
function drawThreeCards() {
    if (tarotData.length === 0) {
        console.error("塔羅牌資料尚未載入完成");
        return [];
    }
    let deckIndexes = Array.from({ length: tarotData.length }, (_, i) => i);
    let shuffledIndexes = shuffleDeck(deckIndexes);
    let drawnIndexes = shuffledIndexes.slice(0, 3);

    let drawnCards = drawnIndexes.map(index => {
        const isReversed = Math.random() < 0.5;
        return {
            ...tarotData[index],
            isReversed: isReversed,
            revealed: false // 新增一個狀態，標記是否已翻開
        };
    });
    console.log("抽出但未翻開的三張牌:", drawnCards);
    return drawnCards;
}

// **新增：** 顯示牌背函式
function displayCardBacks() {
    cardImages.forEach((img, index) => {
        img.src = cardBackSrc; // 設置為牌背圖片
        img.alt = `第 ${index + 1} 張牌`;
        img.classList.remove('revealed', 'reversed'); // 移除可能存在的樣式
        img.style.cursor = 'pointer'; // 確保鼠標是可點擊樣式
        cardMeanings[index].innerHTML = ''; // 清空之前的牌義
    });
     // 移除舊的監聽器 (如果有的話)，並重新附加，確保每次洗牌後能正確點擊
    cardSlots.forEach((slot, index) => {
        // 先複製再取代節點，移除所有舊監聽器 (一個簡單粗暴但有效的方法)
        const newSlot = slot.cloneNode(true);
        slot.parentNode.replaceChild(newSlot, slot);
        // 在新的節點上附加監聽器
        newSlot.addEventListener('click', () => revealCard(index));
    });
     // 更新 DOM 元素引用，因為我們替換了節點
    // 注意：這裡直接修改 NodeList 元素可能不是最佳實踐，但對於這個簡單應用是可行的
    cardSlots = document.querySelectorAll('.card-slot');
    cardImages = document.querySelectorAll('.card-slot img');
    cardMeanings = document.querySelectorAll('.card-meaning');
}


// **修改：** 翻開單張牌的函式，在產生提示詞前獲取使用者輸入
function revealCard(index) {
    console.log(`試圖翻開第 ${index + 1} 張牌`);
    if (currentDrawnCards.length === 3 && !currentDrawnCards[index].revealed) {
        const card = currentDrawnCards[index];
        const imgElement = cardImages[index];
        const meaningElement = cardMeanings[index];

        console.log(`翻開: ${card.name} (${card.isReversed ? '逆位' : '正位'})`);


        // 1. 更新圖片來源和 alt (不變)
        imgElement.src = card.image;
        imgElement.alt = card.name;

        // 2. 處理逆位樣式 (不變)
        if (card.isReversed) {
            imgElement.classList.add('reversed');
        } else {
            imgElement.classList.remove('reversed');
        }

        // 3. 顯示牌義 (不變)
        let meaningText = `<b><span class="math-inline">\{card\.name\} \(</span>{card.isReversed ? '逆位' : '正位'})</b><br>`;
        if (card.isReversed) {
            meaningText += `關鍵詞: ${card.keywords_reversed.join(', ')}<br>`;
            meaningText += `簡解: ${card.meaning_reversed}`;
        } else {
            meaningText += `關鍵詞: ${card.keywords_upright.join(', ')}<br>`;
            meaningText += `簡解: ${card.meaning_upright}`;
        }
        meaningElement.innerHTML = meaningText;

        // 4. 標記為已翻開，並改變鼠標樣式 (不變)
        currentDrawnCards[index].revealed = true;
        imgElement.style.cursor = 'default';
        imgElement.classList.add('revealed');

        // 5. **修改：** 檢查是否所有牌都已翻開
        if (checkAllCardsRevealed()) {
            console.log("所有牌已翻開，嘗試產生提示詞...");
            // **新增：** 獲取使用者輸入
            const userInputs = getUserInputs();

            // **新增：** 檢查使用者是否已選擇主題和輸入問題
            if (!userInputs.topic) {
                alert("請先選擇問題範圍！");
                llmPromptOutput.value = "請選擇問題範圍後，重新抽牌或刷新頁面。"; // 提示用戶
                return; // 阻止繼續執行
            }
            if (!userInputs.question) {
                 alert("請先輸入您的具體問題！");
                 llmPromptOutput.value = "請輸入問題後，重新抽牌或刷新頁面。"; // 提示用戶
                 return; // 阻止繼續執行
            }

            // **修改：** 傳遞主題和問題給產生函式
            const generatedPrompt = generateLLMPrompt(userInputs.topic, userInputs.question);
            llmPromptOutput.value = generatedPrompt;
        }
    } else if (currentDrawnCards.length !== 3) {
        console.log("尚未抽牌，無法翻開");
        alert("請先點擊 '洗牌 & 發牌' 按鈕！");
    } else {
        console.log(`第 ${index + 1} 張牌已經翻開過了`);
    }
}

// **新增：** 獲取使用者輸入的函式
function getUserInputs() {
    let selectedTopic = null;
    // 遍歷 radio 按鈕，找到被選中的那個
    topicRadios.forEach(radio => {
        if (radio.checked) {
            selectedTopic = radio.value;
        }
    });

    const question = userQuestionInput.value.trim(); // 獲取問題並去除前後空格

    return {
        topic: selectedTopic,
        question: question
    };
}


// **修改：** 產生 LLM 提示詞的函式，接收主題和問題
function generateLLMPrompt(topic, question) {
    if (currentDrawnCards.length !== 3) {
        return "錯誤：尚未完成抽牌。";
    }
    if (!topic) {
         return "錯誤：請先選擇問題範圍。";
    }
     if (!question) {
         return "錯誤：請先輸入您的具體問題。";
    }


    const positionLabels = ["過去 / 背景", "現在 / 核心", "未來 / 結果"];
    let prompt = `你是一位經驗豐富的塔羅牌解讀師。請根據以下抽出的三張牌（代表過去、現在、未來），針對提問者關於「${topic}」方面提出的問題：「${question}」，生成一段連貫的、富有洞察力的情況分析與指引。\n\n`;
    prompt += `牌陣位置與牌卡資訊：\n\n`;

    currentDrawnCards.forEach((card, index) => {
        const position = positionLabels[index];
        const orientation = card.isReversed ? '逆位' : '正位';
        const keywords = card.isReversed ? card.keywords_reversed : card.keywords_upright;

        prompt += `位置 ${index + 1}: ${position}\n`;
        prompt += `牌卡: ${card.name} (${orientation})\n`;
        prompt += `關鍵詞: ${keywords.join(', ')}\n\n`;
    });

    prompt += `請將這三張牌的意義與提問者的具體問題「${question}」和「${topic}」主題背景結合起來，描述情況的發展脈絡，點出現在的核心問題，並針對可能的未來結果提供建議或啟示。請用有同理心且具啟發性的語氣撰寫。`;

    console.log("生成的提示詞:", prompt);
    return prompt;
}

function checkAllCardsRevealed() {
    if (currentDrawnCards.length !== 3) {
        return false; // 如果還沒抽滿三張牌，肯定沒翻完
    }
    // 使用 Array.every() 檢查陣列中是否所有元素的 revealed 屬性都為 true
    return currentDrawnCards.every(card => card.revealed === true);
}

// --- 事件監聽 ---
drawButton.addEventListener('click', () => {
    console.log("點擊 '洗牌 & 發牌' 按鈕");
    drawButton.disabled = true;
    drawButton.textContent = '洗牌中...';
    llmPromptOutput.value = ""; // 清空上一次的提示詞 (保留這個)

    setTimeout(() => {
        currentDrawnCards = drawThreeCards();

        if (currentDrawnCards.length === 3) {
            displayCardBacks(); // 只顯示牌背

            // **移除：** 不在這裡產生提示詞
            // const generatedPrompt = generateLLMPrompt();
            // llmPromptOutput.value = generatedPrompt;

        } else {
           if (tarotData.length === 0) {
                alert('塔羅牌資料仍在載入中，請稍候再試。');
           }
           llmPromptOutput.value = "抽牌失敗，無法產生提示詞。"; // 顯示錯誤訊息
        }

        drawButton.disabled = false;
        drawButton.textContent = '重新洗牌 & 發牌';
    }, 500);
});

// **新增：** 複製按鈕的事件監聽器
copyPromptButton.addEventListener('click', () => {
    const textToCopy = llmPromptOutput.value;

    if (!textToCopy) {
        alert("沒有內容可以複製！");
        return;
    }

    // 使用現代的 Clipboard API
    navigator.clipboard.writeText(textToCopy).then(() => {
        // 複製成功的回饋
        const originalText = copyPromptButton.textContent;
        copyPromptButton.textContent = '已複製!';
        copyPromptButton.disabled = true; // 短暫禁用按鈕

        // 設置計時器，約 2 秒後恢復按鈕文字和狀態
        setTimeout(() => {
            copyPromptButton.textContent = originalText;
            copyPromptButton.disabled = false;
        }, 2000);

    }).catch(err => {
        // 複製失敗的處理
        console.error('複製提示詞失敗:', err);
        alert('抱歉，複製失敗。請嘗試手動選取複製。');
    });
});

// --- 初始化 ---
drawButton.disabled = true; // 初始禁用按鈕，等待資料載入
// 初始顯示牌背 (displayCardBacks 會在第一次抽牌時調用，所以這裡可以不用)
// cardImages.forEach(img => img.src = cardBackSrc);