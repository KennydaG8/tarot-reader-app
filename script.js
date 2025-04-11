// --- DOM 元素獲取 ---
const drawButton = document.getElementById('draw-button');
const cutButton = document.getElementById('cut-button'); // 新增：切牌按鈕
let cardSlots = document.querySelectorAll('.card-slot');
let cardImages = document.querySelectorAll('.card-slot img');
let cardMeanings = document.querySelectorAll('.card-meaning');
const llmPromptOutput = document.getElementById('llm-prompt-output');
const promptAreaDiv = document.querySelector('.prompt-area'); // 新增：獲取提示詞區塊
const topicRadios = document.querySelectorAll('input[name="topic"]');
const userQuestionInput = document.getElementById('user-question');
const copyPromptButton = document.getElementById('copy-prompt-button');
// 新增：引導文字元素
const guidanceInitial = document.getElementById('guidance-initial');
const guidanceShuffle = document.getElementById('guidance-shuffle');
const guidanceReveal = document.getElementById('guidance-reveal');
const footerText = document.getElementById('footer-text');


let tarotData = [];
let currentDrawnCards = []; // 儲存最終抽出的三張牌
let shuffledIndexes = []; // 儲存洗牌後的完整索引順序 (用於切牌)
const cardBackSrc = 'images/card_back.jpg';
let ritualState = 'initial'; // 新增：管理儀式狀態 (initial, shuffled, cut_done, revealed_all)

// --- 資料載入 ---
fetch('tarot-data.json')
    .then(response => { // 第一個 then：處理回應
        if (!response.ok) {
            // 如果 HTTP 狀態碼不是 200-299，拋出錯誤
            throw new Error('Network response was not ok ' + response.statusText);
        }
        // 解析 JSON 主體，這會返回一個 Promise
        return response.json();
    })
    .then(data => { // 第二個 then：處理解析後的 JSON data
        console.log('古老知識已載入... (原始 data 型別:', typeof data, ', 是否為陣列:', Array.isArray(data), ')'); // <-- Log C1: 檢查 data 類型
        if (Array.isArray(data)) {
            console.log('古老知識已載入... (原始 data 長度:', data.length, ')'); // <-- Log C2: 檢查 data 長度
        }

        tarotData = data; // <--- 賦值給全域變數

        console.log('全域 tarotData 已賦值，型別:', typeof tarotData, ', 是否為陣列:', Array.isArray(tarotData)); // <-- Log D1: 檢查賦值後的類型
        if (Array.isArray(tarotData)) {
             console.log('全域 tarotData 已賦值，長度:', tarotData.length); // <-- Log D2: 檢查賦值後的長度
        }

        // 增加一個嚴格檢查，確保 tarotData 是有內容的陣列才啟用按鈕
        if (Array.isArray(tarotData) && tarotData.length > 0) {
            drawButton.disabled = false; // 啟用主按鈕
            console.log(`抽牌按鈕已啟用，tarotData 確認長度為 ${tarotData.length}。`); // <-- Log E: 確認啟用時的狀態
            guidanceShuffle.style.display = 'block';
        } else {
            console.error("錯誤：載入的 tarotData 不是有效的陣列或為空！資料內容:", data); // 顯示載入的 data 是什麼
            alert('星辰資料似乎已損壞或格式錯誤，請檢查 tarot-data.json 檔案。');
            drawButton.disabled = true;
        }
    })
    .catch(error => { // 處理 fetch 或 .json() 過程中的任何錯誤
        console.error('無法連結或解析星界資料庫:', error);
        alert('與星界的連結或資料解析出現異常，請檢查 tarot-data.json 檔案或網路連線。');
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

// **修改：** 切牌模擬函式
function cutTheDeck(deckIndexes) {
    if (deckIndexes.length < 10) return deckIndexes; // 如果牌太少就不切了
    // 隨機選擇一個切牌點 (避免太靠近頭尾)
    const minCut = 5;
    const maxCut = deckIndexes.length - 5;
    const cutPoint = Math.floor(Math.random() * (maxCut - minCut)) + minCut;
    console.log(`命運之切點: ${cutPoint}`);
    // 將切點之後的部分放到前面
    const cutDeck = deckIndexes.slice(cutPoint).concat(deckIndexes.slice(0, cutPoint));
    return cutDeck;
}

// **修改：** 決定最終三張牌的函式 (在切牌後調用)
function finalizeDrawnCards(finalDeckIndexes) {
     if (finalDeckIndexes.length < 3) {
        console.error("牌堆數量不足");
        return [];
    }
    let drawnIndexes = finalDeckIndexes.slice(0, 3);
    currentDrawnCards = drawnIndexes.map(index => {
        const isReversed = Math.random() < 0.5;
        return {
            ...tarotData[index],
            isReversed: isReversed,
            revealed: false
        };
    });
     console.log("最終確定的三張牌:", currentDrawnCards);
}


// **修改：** 顯示牌背，但不附加監聽器
function displayCardBacksInitial() {
    cardImages.forEach((img, index) => {
        img.src = cardBackSrc;
        img.alt = `星辰牌陣 位置 ${index + 1}`;
        img.classList.remove('revealed', 'reversed');
        img.style.cursor = 'default'; // 初始不可點擊
        cardMeanings[index].innerHTML = '';
    });
    // 清空可能殘留的提示詞
    llmPromptOutput.value = '';
    promptAreaDiv.style.display = 'none'; // 隱藏提示詞區域
    footerText.style.display = 'none'; // 隱藏頁腳文字
}

// **新增：** 啟用牌卡點擊的函式
function enableCardClicks() {
     // 確保 DOM 引用是最新的
     cardSlots = document.querySelectorAll('.card-slot');
     cardImages = document.querySelectorAll('.card-slot img');
     cardMeanings = document.querySelectorAll('.card-meaning');

     cardSlots.forEach((slot, index) => {
        // 確保圖片是牌背且狀態允許點擊
        if (cardImages[index].src.includes(cardBackSrc) && ritualState === 'cut_done') {
             cardImages[index].style.cursor = 'pointer'; // 設定可點擊樣式
             // 移除舊監聽器並附加新監聽器 (使用 cloneNode 技巧)
             const newSlot = slot.cloneNode(true);
             slot.parentNode.replaceChild(newSlot, slot);
             newSlot.addEventListener('click', () => revealCard(index), { once: true }); // 使用 once: true 確保只觸發一次
        } else {
            cardImages[index].style.cursor = 'default';
        }
    });
     // 更新 DOM 元素引用
     cardSlots = document.querySelectorAll('.card-slot');
     cardImages = document.querySelectorAll('.card-slot img');
     cardMeanings = document.querySelectorAll('.card-meaning');
}

// 檢查是否所有牌都已翻開 - 不變
function checkAllCardsRevealed() {
    if (currentDrawnCards.length !== 3) return false;
    return currentDrawnCards.every(card => card && card.revealed === true); // 增加 card 存在的檢查
}

// 獲取使用者輸入 - 不變
function getUserInputs() {
    let selectedTopic = null;
    topicRadios.forEach(radio => { if (radio.checked) { selectedTopic = radio.value; } });
    const question = userQuestionInput.value.trim();
    return { topic: selectedTopic, question: question };
}

// **修改：** 產生 LLM 提示詞，使用新的位置標籤
function generateLLMPrompt(topic, question) {
    if (currentDrawnCards.length !== 3) return "錯誤：星辰尚未排列完成。";
    if (!topic) return "錯誤：請先選擇探尋的領域。";
    if (!question) return "錯誤：請先低語您的探問。";

    // 修改位置標籤
    const positionLabels = ["往昔之影 (過去/背景)", "當下之核 (現在/核心)", "未來之徑 (未來/結果)"];
    let prompt = `你是一位洞悉星辰密語的塔羅占卜師。請連結宇宙的智慧，根據以下為提問者抽出的三張牌陣，針對其關於「${topic}」領域提出的問題：「${question}」，給予一段充滿啟示與療癒力量的指引。\n\n`;
    prompt += `星盤位置與神諭牌卡：\n\n`;

    currentDrawnCards.forEach((card, index) => {
        const position = positionLabels[index];
        const orientation = card.isReversed ? '逆位' : '正位';
        const keywords = card.isReversed ? card.keywords_reversed : card.keywords_upright;

        prompt += `星位 ${index + 1}: ${position}\n`;
        prompt += `牌卡: ${card.name} (${orientation})\n`;
        prompt += `關鍵詞: ${keywords.join('、')}\n\n`; // 用中文頓號
    });

    prompt += `請將這三張牌的智慧與提問者的具體問題「${question}」和「${topic}」領域結合，編織成一段連貫的敘述。闡述過往的影響、點亮當下的核心、揭示未來的可能路徑，並給予充滿同理心與魔法光輝的建議。讓文字如同星光般溫暖而清晰。`;

    console.log("生成的諭示:", prompt);
    return prompt;
}


// **修改：** 翻開單張牌的函式
function revealCard(index) {
    console.log(`揭示第 ${index + 1} 道星光...`);
    // 確保是在正確的狀態下翻牌
    if (ritualState !== 'cut_done') {
        console.warn("儀式步驟錯誤，無法揭示。");
        return;
    }
    // 確保索引有效且牌未被翻開
    if (currentDrawnCards.length > index && currentDrawnCards[index] && !currentDrawnCards[index].revealed) {
        const card = currentDrawnCards[index];
        const imgElement = cardImages[index];
        const meaningElement = cardMeanings[index];

         if (!imgElement || !meaningElement) {
            console.error(`無法找到索引 ${index} 的 DOM 元素。`);
            return;
        }


        console.log(`揭示: ${card.name} (${card.isReversed ? '逆位' : '正位'})`);

        // 1. 更新圖片
        imgElement.src = card.image;
        imgElement.alt = card.name;
        // 2. 處理逆位
        if (card.isReversed) { imgElement.classList.add('reversed'); } else { imgElement.classList.remove('reversed'); }
        // 3. 顯示牌義
        let meaningText = `<b>${card.name} (${card.isReversed ? '逆位' : '正位'})</b><br>`;
        if (card.isReversed) { meaningText += `關鍵詞: ${card.keywords_reversed.join('、')}<br>啟示: ${card.meaning_reversed}`; } else { meaningText += `關鍵詞: ${card.keywords_upright.join('、')}<br>啟示: ${card.meaning_upright}`; }
        meaningElement.innerHTML = meaningText;
        // 4. 標記翻開
        currentDrawnCards[index].revealed = true;
        imgElement.style.cursor = 'default';
        imgElement.classList.add('revealed');

        // 5. 檢查是否所有牌都已翻開
        if (checkAllCardsRevealed()) {
            console.log("所有星光已被揭示，準備記錄諭示...");
            ritualState = 'revealed_all'; // 更新狀態
            const userInputs = getUserInputs();
            if (!userInputs.topic || !userInputs.question) {
                alert("請確保已選擇探尋領域並低語您的探問！");
                llmPromptOutput.value = "請補充探尋領域和問題後，重新啟動儀式。";
            } else {
                const generatedPrompt = generateLLMPrompt(userInputs.topic, userInputs.question);
                llmPromptOutput.value = generatedPrompt;
                promptAreaDiv.style.display = 'block'; // 顯示提示詞區域
                footerText.style.display = 'block'; // 顯示頁腳文字
            }
        }
    } else {
        console.log(`第 ${index + 1} 道星光已被揭示或儀式步驟不符。`);
    }
}

// --- 事件監聽 ---

// **修改：** 主按鈕 ("呼喚命運") 事件監聽器
drawButton.addEventListener('click', () => {
    console.log("啟動儀式...");

    // **新增：** 在執行任何操作前，先檢查 tarotData 是否已成功載入且包含數據
    if (!tarotData || tarotData.length === 0) {
        console.error("塔羅牌資料尚未完全準備好，無法啟動儀式。");
        alert("星辰尚未完全對齊，請稍候片刻或刷新頁面再呼喚命運。");
        // 可以選擇性地重新啟用按鈕，如果認為這只是暫時的延遲
        // drawButton.disabled = false;
        return; // 阻止繼續執行後續程式碼
    }

    const userInputs = getUserInputs();
    if (!userInputs.topic || !userInputs.question) {
         alert("請先選擇探尋領域並低語您的探問，再呼喚命運。");
         return;
    }


    // --- 確認資料和輸入都無誤後，才開始執行儀式 ---
    ritualState = 'shuffling';
    console.log("狀態設定為: shuffling");
    drawButton.disabled = true; // 禁用按鈕
    drawButton.textContent = '感應中...';
    guidanceShuffle.style.display = 'none';
    guidanceReveal.style.display = 'none';
    

    setTimeout(() => {
        // **再次檢查 (可選，作為保險)**
        if (!tarotData || tarotData.length === 0) {
            console.error("錯誤：setTimeout 內部 tarotData 意外變空！");
            drawButton.disabled = false; // 恢復按鈕以便重試
            drawButton.textContent = '呼喚命運';
            ritualState = 'initial';
            return;
        }

        // 1. 內部洗牌
        let deckIndexes = Array.from({ length: tarotData.length }, (_, i) => i);
        console.log(`牌堆索引建立，長度: ${deckIndexes.length}`); // 現在這裡應該是 78
        shuffledIndexes = shuffleDeck(deckIndexes);
        console.log(`牌堆已洗牌，shuffledIndexes 長度 (setTimeout內部): ${shuffledIndexes.length}`); // 現在這裡應該是 78

        console.log("牌堆已回應呼喚 (已洗牌)");
        displayCardBacksInitial();

        // 3. 準備切牌
        drawButton.style.display = 'none'; // 隱藏主按鈕
        cutButton.style.display = 'inline-block'; // 顯示切牌按鈕
        cutButton.disabled = false;
        guidanceInitial.textContent = "牌已洗好，請以您的直覺，進行神聖的切牌儀式..."; // 更新引導文字
        console.log("準備將狀態設為 shuffled"); // <-- Log 2
        ritualState = 'shuffled'; // **設定狀態**
        console.log("狀態已設定為: shuffled", ritualState); // <-- Log 3: 確認設定後的值


    }, 700); // 模擬感應時間
});

// **新增：** 切牌按鈕 ("命運之切") 事件監聽器
cutButton.addEventListener('click', () => {
    console.log("進行命運之切...");
    console.log(">>> 切牌時的狀態是:", ritualState); // <-- Log 4: 檢查點擊時的狀態
    console.log(">>> 切牌時 shuffledIndexes 長度:", shuffledIndexes.length); // <-- Log 5: 檢查牌堆

    // **修改：** 將 console.error 改為 console.warn 或 log，並印出更詳細資訊
    if (ritualState !== 'shuffled' || shuffledIndexes.length === 0) {
        console.warn(`儀式狀態錯誤，無法切牌。當前狀態: ${ritualState}, 牌堆長度: ${shuffledIndexes.length}`); // <-- Log 6: 顯示錯誤時的狀態
        return;
    }

    cutButton.disabled = true;
    cutButton.textContent = '切牌中...';
    ritualState = 'cutting'; // <-- 這裡設定 cutting 狀態沒問題
    console.log("狀態設定為: cutting"); // <-- Log 7

    setTimeout(() => {
        // 1. 執行切牌模擬
        const cutDeckIndexes = cutTheDeck(shuffledIndexes);

        // 2. 確定最終抽出的三張牌
        finalizeDrawnCards(cutDeckIndexes);

        // 3. 隱藏切牌按鈕，更新引導文字
        cutButton.style.display = 'none';
        cutButton.textContent = '命運之切'; // 恢復文字以便下次使用
        guidanceInitial.textContent = '牌陣已成形。'; // 更新引導文字
        guidanceReveal.style.display = 'block'; // 顯示提示翻牌文字

        // 4. 啟用牌卡點擊
        console.log("準備將狀態設為 cut_done"); // <-- Log 8
        ritualState = 'cut_done'; // **設定狀態**
        console.log("狀態已設定為: cut_done", ritualState); // <-- Log 9
        enableCardClicks();

    }, 500); // 模擬切牌時間
});


// **修改：** 複製按鈕的事件監聽器
copyPromptButton.addEventListener('click', () => {
    const textToCopy = llmPromptOutput.value;
    const originalButtonText = "複製諭示"; // 直接定義原始文字，避免依賴讀取

    if (!textToCopy || textToCopy.startsWith("錯誤：") || textToCopy.startsWith("請")) {
        alert("尚無有效諭示可複製！"); // 修改提示文字
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        // 複製成功的回饋
        copyPromptButton.textContent = '諭示已複製!'; // 修改成功提示
        copyPromptButton.disabled = true;

        setTimeout(() => {
            copyPromptButton.textContent = originalButtonText; // 恢復為 "複製諭示"
            copyPromptButton.disabled = false;
        }, 2000);

    }).catch(err => {
        // 複製失敗的處理
        console.error('複製諭示失敗:', err); // 修改 Log 文字
        alert('複製失敗，您的瀏覽器可能不支援或未授予權限。請嘗試手動複製。'); // 修改提示文字
    });
});


// --- 初始化 ---
drawButton.disabled = true; // 初始禁用，等待資料載入
// 隱藏不需要初始顯示的元素
promptAreaDiv.style.display = 'none';
guidanceShuffle.style.display = 'none';
guidanceReveal.style.display = 'none';
footerText.style.display = 'none';
cutButton.style.display = 'none'; // 初始隱藏切牌按鈕