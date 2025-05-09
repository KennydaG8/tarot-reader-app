// --- DOM 元素獲取 (部分更新) ---
const drawButton = document.getElementById('draw-button');
const cutButton = document.getElementById('cut-button');
let cardSlots = document.querySelectorAll('.card-slot'); // 可能不需要再全域，看 revealCard 邏輯
let cardImages = document.querySelectorAll('.card-slot img');
let cardMeanings = document.querySelectorAll('.card-meaning');
const topicRadios = document.querySelectorAll('input[name="topic"]');
const userQuestionInput = document.getElementById('user-question');

const guidanceInitial = document.getElementById('guidance-initial');
const guidanceShuffle = document.getElementById('guidance-shuffle');
const guidanceReveal = document.getElementById('guidance-reveal');
const footerText = document.getElementById('footer-text');
const loadingMessage = document.getElementById('loading-message'); // New

// New output sections
const conciseInterpretationSection = document.getElementById('concise-interpretation-section');
const conciseInterpretationOutput = document.getElementById('concise-interpretation-output');
const detailedAdviceSection = document.getElementById('detailed-advice-section');
const detailedAdviceOutput = document.getElementById('detailed-advice-output');
const getDetailedAdviceButton = document.getElementById('get-detailed-advice-button'); // New

let tarotData = [];
let currentDrawnCardsDetails = []; // Stores { id, name, image, isReversed, keywords_upright, keywords_reversed, meaning_upright, meaning_reversed }
let shuffledIndexes = [];
const cardBackSrc = 'images/card_back.jpg'; // Make sure this path is correct
let ritualState = 'initial'; // initial, shuffling, shuffled, cut_done, revealed_all, fetching_concise, concise_done, fetching_detailed, detailed_done

let storedConciseInterpretation = ""; // To store the first interpretation for the second API call

// --- 資料載入 ---
fetch('tarot-data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        tarotData = data;
        if (Array.isArray(tarotData) && tarotData.length > 0) {
            drawButton.disabled = false;
            guidanceShuffle.style.display = 'block';
            console.log(`塔羅資料已載入，共 ${tarotData.length} 張牌。`);
        } else {
            console.error("錯誤：載入的 tarotData 不是有效的陣列或為空！", data);
            alert('星辰資料似乎已損壞或格式錯誤，請檢查 tarot-data.json 檔案。');
            drawButton.disabled = true;
        }
    })
    .catch(error => {
        console.error('無法連結或解析星界資料庫:', error);
        alert('與星界的連結或資料解析出現異常，請檢查 tarot-data.json 檔案或網路連線。');
        drawButton.disabled = true;
    });

// --- 核心功能函式 ---

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cutTheDeck(deckIndexes) {
    if (deckIndexes.length < 10) return deckIndexes;
    const minCut = 5;
    const maxCut = deckIndexes.length - 5;
    const cutPoint = Math.floor(Math.random() * (maxCut - minCut)) + minCut;
    console.log(`命運之切點: ${cutPoint}`);
    return deckIndexes.slice(cutPoint).concat(deckIndexes.slice(0, cutPoint));
}

function finalizeDrawnCards(finalDeckIndexes) {
    if (finalDeckIndexes.length < 3) {
        console.error("牌堆數量不足");
        currentDrawnCardsDetails = [];
        return;
    }
    let drawnIndexes = finalDeckIndexes.slice(0, 3);
    currentDrawnCardsDetails = drawnIndexes.map(index => {
        const cardData = tarotData[index];
        const isReversed = Math.random() < 0.5;
        return {
            id: cardData.id,
            name: cardData.name,
            image: cardData.image, // Local image path for display
            isReversed: isReversed,
            keywords: isReversed ? cardData.keywords_reversed : cardData.keywords_upright,
            meaning: isReversed ? cardData.meaning_reversed : cardData.meaning_upright,
            // Send all relevant data, so backend doesn't need tarot-data.json
            keywords_upright: cardData.keywords_upright,
            keywords_reversed: cardData.keywords_reversed,
            meaning_upright: cardData.meaning_upright,
            meaning_reversed: cardData.meaning_reversed,
            revealed: false // For local UI state
        };
    });
    console.log("最終確定的三張牌:", currentDrawnCardsDetails.map(c => `${c.name} (${c.isReversed ? '逆位' : '正位'})`));
}

function displayCardBacksInitial() {
    cardImages = document.querySelectorAll('.card-slot img'); // Re-select in case DOM changes
    cardMeanings = document.querySelectorAll('.card-meaning');

    cardImages.forEach((img, index) => {
        img.src = cardBackSrc;
        img.alt = `星辰牌陣 位置 ${index + 1}`;
        img.classList.remove('revealed', 'reversed');
        img.style.cursor = 'default';
        if(cardMeanings[index]) cardMeanings[index].innerHTML = '';
    });
    // Clear previous results and hide sections
    conciseInterpretationSection.style.display = 'none';
    conciseInterpretationOutput.textContent = '';
    detailedAdviceSection.style.display = 'none';
    detailedAdviceOutput.textContent = '';
    getDetailedAdviceButton.style.display = 'none';
    footerText.style.display = 'none';
    loadingMessage.style.display = 'none';
}

function enableCardClicks() {
    console.log("enableCardClicks: Start"); // Debug
    cardSlots = document.querySelectorAll('.card-slot'); // Re-select
    cardImages = document.querySelectorAll('.card-slot img'); // Re-select at the beginning
    cardMeanings = document.querySelectorAll('.card-meaning'); // Re-select at the beginning
    console.log(`enableCardClicks: Initial query - cardSlots: ${cardSlots.length}, cardImages: ${cardImages.length}, cardMeanings: ${cardMeanings.length}`); // Debug

    cardSlots.forEach((slot, index) => {
        const imgElement = cardImages[index];
        if (imgElement && imgElement.src.includes(cardBackSrc) && ritualState === 'cut_done') {
            imgElement.style.cursor = 'pointer';
            // Clone and replace to remove old listeners, then add new one
            const newImgElement = imgElement.cloneNode(true);
            imgElement.parentNode.replaceChild(newImgElement, imgElement);
            // Add event listener to the NEW cloned element
            newImgElement.addEventListener('click', () => revealCard(index), { once: true });
        } else if (imgElement) {
            imgElement.style.cursor = 'default';
        }
    });

    // Update references AFTER cloning and replacing all relevant elements
    cardImages = document.querySelectorAll('.card-slot img');
    cardMeanings = document.querySelectorAll('.card-meaning'); // <--- ADD THIS LINE
    console.log(`enableCardClicks: Final re-query - cardImages: ${cardImages.length}, cardMeanings: ${cardMeanings.length}`); // Debug
    console.log("enableCardClicks: End"); // Debug
}

function checkAllCardsRevealed() {
    if (currentDrawnCardsDetails.length !== 3) return false;
    return currentDrawnCardsDetails.every(card => card && card.revealed === true);
}

function getUserInputs() {
    let selectedTopic = null;
    topicRadios.forEach(radio => { if (radio.checked) selectedTopic = radio.value; });
    const question = userQuestionInput.value.trim();
    return { topic: selectedTopic, question: question };
}

async function revealCard(index) {
    console.log(`揭示第 ${index + 1} 道星光...`);
    console.log(`revealCard: Called for index ${index}`);
    console.log(`revealCard: current cardImages length: ${cardImages.length}, cardMeanings length: ${cardMeanings.length}`); // For debugging

    if (ritualState !== 'cut_done') {
        console.warn("儀式步驟錯誤，無法揭示。");
        return;
    }
    if (!(currentDrawnCardsDetails.length > index && currentDrawnCardsDetails[index] && !currentDrawnCardsDetails[index].revealed)) {
        console.log(`第 ${index + 1} 張牌不存在、資料錯誤或已被揭示。`);
        return;
    }

    const card = currentDrawnCardsDetails[index];
    const imgElement = cardImages[index]; // Assumes cardImages is correctly populated and fresh

    // --- MODIFIED WAY TO GET meaningElement ---
    let meaningElement = null;
    if (imgElement) {
        // Navigate from the imgElement to its corresponding .card-meaning sibling
        // imgElement -> parent (.card-slot) -> parent (.card-position) -> child (.card-meaning)
        const cardPositionDiv = imgElement.closest('.card-position');
        if (cardPositionDiv) {
            meaningElement = cardPositionDiv.querySelector('.card-meaning');
        }
    }
    // --- END MODIFICATION ---

    // Now the check:
    if (!imgElement || !meaningElement) {
        console.error(`無法找到索引 ${index} 的 DOM 元素。imgElement: ${imgElement}, meaningElement: ${meaningElement}`);
        // Log more details for debugging
        if (imgElement) { // If imgElement exists but meaningElement doesn't
             const cardPositionDiv = imgElement.closest('.card-position');
             console.log("Parent .card-position for imgElement:", cardPositionDiv);
             if(cardPositionDiv) console.log("Children of .card-position:", cardPositionDiv.children);
        }
        return;
    }

    console.log(`揭示: ${card.name} (${card.isReversed ? '逆位' : '正位'})`);
    imgElement.src = card.image;
    imgElement.alt = card.name;
    if (card.isReversed) { imgElement.classList.add('reversed'); } else { imgElement.classList.remove('reversed'); }

    let meaningText = `<b>${card.name} (${card.isReversed ? '逆位' : '正位'})</b><br>`;
    meaningText += `關鍵詞: ${card.keywords.join('、')}<br>啟示: ${card.meaning}`;
    meaningElement.innerHTML = meaningText;

    currentDrawnCardsDetails[index].revealed = true;
    imgElement.style.cursor = 'default';
    imgElement.classList.add('revealed');

    if (checkAllCardsRevealed()) {
        console.log("所有星光已被揭示，準備請求初步解讀...");
        ritualState = 'fetching_concise';
        loadingMessage.textContent = "正在獲取初步解讀...";
        loadingMessage.style.display = 'block';
        guidanceReveal.style.display = 'none';

        const userInputs = getUserInputs();
        if (!userInputs.topic || !userInputs.question) {
            alert("請確保已選擇探尋領域並低語您的探問！");
            loadingMessage.style.display = 'none';
            ritualState = 'cut_done'; // Revert state
            return;
        }
        const requestData = {
            topic: userInputs.topic,
            question: userInputs.question,
            drawn_cards: currentDrawnCardsDetails.map(c => ({
                name: c.name,
                isReversed: c.isReversed,
                keywords: c.keywords,
                keywords_upright: c.keywords_upright,
                keywords_reversed: c.keywords_reversed,
                meaning_upright: c.meaning_upright,
                meaning_reversed: c.meaning_reversed,
            }))
        };
        await fetchConciseInterpretation(requestData);
    }
}

// --- API Call Functions ---
async function fetchConciseInterpretation(requestData) {
    try {
        // Replace with your actual Netlify function endpoint
        const response = await fetch('/.netlify/functions/getConciseInterpretation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        loadingMessage.style.display = 'none';

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: '無法解析錯誤回應' }));
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
        }
        const data = await response.json();
        conciseInterpretationOutput.textContent = data.interpretation;
        storedConciseInterpretation = data.interpretation; // Store for later
        conciseInterpretationSection.style.display = 'block';
        getDetailedAdviceButton.style.display = 'inline-block'; // Show button
        getDetailedAdviceButton.disabled = false;
        footerText.style.display = 'block';
        ritualState = 'concise_done';
    } catch (error) {
        console.error('獲取初步解讀失敗:', error);
        conciseInterpretationOutput.textContent = `獲取初步解讀時發生錯誤：${error.message}`;
        conciseInterpretationSection.style.display = 'block'; // Show error in the section
        ritualState = 'error'; // Or revert to 'revealed_all' to allow retry?
    }
}

async function fetchDetailedAdvice() {
    if (ritualState !== 'concise_done' || !storedConciseInterpretation) {
        alert("請先獲取初步解讀。");
        return;
    }
    ritualState = 'fetching_detailed';
    loadingMessage.textContent = "正在獲取詳細建議...";
    loadingMessage.style.display = 'block';
    getDetailedAdviceButton.disabled = true;
    conciseInterpretationSection.style.display = 'block'; // Keep concise visible
    detailedAdviceSection.style.display = 'none'; // Hide old detailed advice if any
    detailedAdviceOutput.textContent = '';


    const userInputs = getUserInputs(); // Get fresh inputs in case they changed (though unlikely)
    const requestData = {
        topic: userInputs.topic,
        question: userInputs.question,
        drawn_cards: currentDrawnCardsDetails.map(c => ({ // Send detailed card info again
            name: c.name,
            isReversed: c.isReversed,
            keywords: c.keywords,
            keywords_upright: c.keywords_upright,
            keywords_reversed: c.keywords_reversed,
            meaning_upright: c.meaning_upright,
            meaning_reversed: c.meaning_reversed,
        })),
        concise_interpretation: storedConciseInterpretation
    };

    try {
        // Replace with your actual Netlify function endpoint
        const response = await fetch('/.netlify/functions/getDetailedAdvice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        loadingMessage.style.display = 'none';

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: '無法解析錯誤回應' }));
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
        }
        const data = await response.json();
        detailedAdviceOutput.textContent = data.advice;
        detailedAdviceSection.style.display = 'block';
        ritualState = 'detailed_done';
    } catch (error) {
        console.error('獲取詳細建議失敗:', error);
        detailedAdviceOutput.textContent = `獲取詳細建議時發生錯誤：${error.message}`;
        detailedAdviceSection.style.display = 'block'; // Show error
        ritualState = 'error';
    } finally {
        getDetailedAdviceButton.disabled = false; // Re-enable button
    }
}


// --- 事件監聽 ---
drawButton.addEventListener('click', () => {
    console.log("啟動儀式...");
    if (!tarotData || tarotData.length === 0) {
        alert("星辰尚未完全對齊，請稍候或刷新。"); return;
    }
    const userInputs = getUserInputs();
    if (!userInputs.topic || !userInputs.question) {
         alert("請先選擇探尋領域並低語您的探問，再呼喚命運。"); return;
    }

    ritualState = 'shuffling';
    drawButton.disabled = true;
    drawButton.textContent = '感應中...';
    guidanceInitial.style.display = 'none';
    guidanceShuffle.style.display = 'none';
    guidanceReveal.style.display = 'none';
    // Hide result sections on new draw
    conciseInterpretationSection.style.display = 'none';
    detailedAdviceSection.style.display = 'none';
    getDetailedAdviceButton.style.display = 'none';


    setTimeout(() => {
        let deckIndexes = Array.from({ length: tarotData.length }, (_, i) => i);
        shuffledIndexes = shuffleDeck(deckIndexes);
        console.log(`牌堆已洗牌，長度: ${shuffledIndexes.length}`);
        displayCardBacksInitial(); // Resets card images and meanings

        drawButton.style.display = 'none';
        cutButton.style.display = 'inline-block';
        cutButton.disabled = false;
        guidanceInitial.textContent = "牌已洗好，請以您的直覺，進行神聖的切牌儀式...";
        guidanceInitial.style.display = 'block';
        ritualState = 'shuffled';
    }, 700);
});

cutButton.addEventListener('click', () => {
    console.log("進行命運之切...");
    if (ritualState !== 'shuffled' || shuffledIndexes.length === 0) { return; }

    cutButton.disabled = true;
    cutButton.textContent = '切牌中...';
    ritualState = 'cutting';

    setTimeout(() => {
        const cutDeckIndexes = cutTheDeck(shuffledIndexes);
        finalizeDrawnCards(cutDeckIndexes); // Determines currentDrawnCardsDetails

        cutButton.style.display = 'none';
        cutButton.textContent = '命運之切';
        guidanceInitial.style.display = 'none';
        guidanceReveal.textContent = '牌陣已成形。請逐一揭示星辰的低語...';
        guidanceReveal.style.display = 'block';

        ritualState = 'cut_done';
        enableCardClicks(); // Important to re-enable after DOM manipulation if any
    }, 500);
});

// Event listener for the new button
getDetailedAdviceButton.addEventListener('click', fetchDetailedAdvice);


// --- 初始化 ---
drawButton.disabled = true; // Disabled until tarotData is loaded
guidanceShuffle.style.display = 'none';
guidanceReveal.style.display = 'none';
footerText.style.display = 'none';
cutButton.style.display = 'none';
// Hide result sections initially
conciseInterpretationSection.style.display = 'none';
detailedAdviceSection.style.display = 'none';
getDetailedAdviceButton.style.display = 'none';