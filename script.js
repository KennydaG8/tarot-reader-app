// script.js

// --- DOM 元素獲取 (部分在函數內動態獲取) ---
const drawButton = document.getElementById('draw-button');
const cutButton = document.getElementById('cut-button');
// Global NodeLists for cardImages and cardMeanings will be populated dynamically
// or elements will be passed directly to functions that need them.
let cardImagesNodeList; // Will be populated by document.querySelectorAll in relevant functions
let cardMeaningsNodeList; // Will be populated by document.querySelectorAll in relevant functions

const topicRadios = document.querySelectorAll('input[name="topic"]');
const userQuestionInput = document.getElementById('user-question');

const guidanceInitial = document.getElementById('guidance-initial');
const guidanceShuffle = document.getElementById('guidance-shuffle');
const guidanceReveal = document.getElementById('guidance-reveal');
const footerText = document.getElementById('footer-text');
const loadingMessage = document.getElementById('loading-message');

const conciseInterpretationSection = document.getElementById('concise-interpretation-section');
const conciseInterpretationOutput = document.getElementById('concise-interpretation-output');
const detailedAdviceSection = document.getElementById('detailed-advice-section');
const detailedAdviceOutput = document.getElementById('detailed-advice-output');
const getDetailedAdviceButton = document.getElementById('get-detailed-advice-button');

let tarotData = [];
let currentDrawnCardsDetails = []; // Stores { id, name, image, isReversed, keywords_upright, keywords_reversed, meaning_upright, meaning_reversed, revealed }
let shuffledIndexes = [];
const cardBackSrc = 'images/card_back.jpg'; // Make sure this path is correct relative to index.html
let ritualState = 'initial'; // initial, shuffling, shuffled, cut_done, revealed_all, fetching_concise, concise_done, fetching_detailed, detailed_done, error

let storedConciseInterpretation = ""; // To store the first interpretation

// --- 資料載入 ---
fetch('tarot-data.json') // Assumes tarot-data.json is in the same directory as index.html
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
    if (deckIndexes.length < 10) return deckIndexes; // If too few cards, don't cut
    const minCut = Math.min(5, Math.floor(deckIndexes.length / 3)); // Adjust min cut point
    const maxCut = deckIndexes.length - minCut;
    if (maxCut <= minCut) return deckIndexes; // Not enough range to cut meaningfully

    const cutPoint = Math.floor(Math.random() * (maxCut - minCut)) + minCut;
    console.log(`命運之切點: ${cutPoint}`);
    return deckIndexes.slice(cutPoint).concat(deckIndexes.slice(0, cutPoint));
}

function finalizeDrawnCards(finalDeckIndexes) {
    if (!tarotData || tarotData.length === 0) {
        console.error("Tarot data not loaded for finalizeDrawnCards.");
        currentDrawnCardsDetails = [];
        return;
    }
    if (finalDeckIndexes.length < 3) {
        console.error("牌堆數量不足");
        currentDrawnCardsDetails = [];
        return;
    }
    let drawnIndexes = finalDeckIndexes.slice(0, 3);
    currentDrawnCardsDetails = drawnIndexes.map(index => {
        // Ensure index is within bounds of tarotData
        if (index < 0 || index >= tarotData.length) {
            console.error(`Invalid card index: ${index}`);
            return null; // Or some placeholder for an invalid card
        }
        const cardData = tarotData[index];
        const isReversed = Math.random() < 0.5;
        return {
            id: cardData.id,
            name: cardData.name,
            image: cardData.image,
            isReversed: isReversed,
            keywords: isReversed ? cardData.keywords_reversed : cardData.keywords_upright,
            meaning: isReversed ? cardData.meaning_reversed : cardData.meaning_upright,
            keywords_upright: cardData.keywords_upright,
            keywords_reversed: cardData.keywords_reversed,
            meaning_upright: cardData.meaning_upright,
            meaning_reversed: cardData.meaning_reversed,
            revealed: false
        };
    }).filter(card => card !== null); // Filter out any nulls from invalid indexes

    if (currentDrawnCardsDetails.length < 3) {
        console.error("Could not finalize 3 valid cards.");
        // Handle this scenario, perhaps by alerting user or resetting
    }
    console.log("最終確定的三張牌:", currentDrawnCardsDetails.map(c => `${c.name} (${c.isReversed ? '逆位' : '正位'})`));
}

function displayCardBacksInitial() {
    // Re-query elements each time this function is called for safety
    const currentCardImages = document.querySelectorAll('.card-slot img');
    const currentCardMeanings = document.querySelectorAll('.card-meaning');

    currentCardImages.forEach((img, index) => {
        img.src = cardBackSrc;
        img.alt = `星辰牌陣 位置 ${index + 1}`;
        img.classList.remove('revealed', 'reversed');
        img.style.cursor = 'default';
        // Ensure cardMeanings element exists for this index
        if(currentCardMeanings && currentCardMeanings[index]) {
            currentCardMeanings[index].innerHTML = '';
        }
    });

    // Clear previous results and hide sections
    if (conciseInterpretationSection) conciseInterpretationSection.style.display = 'none';
    if (conciseInterpretationOutput) conciseInterpretationOutput.textContent = '';
    if (detailedAdviceSection) detailedAdviceSection.style.display = 'none';
    if (detailedAdviceOutput) detailedAdviceOutput.textContent = '';
    if (getDetailedAdviceButton) getDetailedAdviceButton.style.display = 'none';
    if (footerText) footerText.style.display = 'none';
    if (loadingMessage) loadingMessage.style.display = 'none';
}

function enableCardClicks() {
    console.log("enableCardClicks: Start");
    const allCardSlots = document.querySelectorAll('.card-slot'); // Get all .card-slot divs
    console.log(`enableCardClicks: Found ${allCardSlots.length} card slots.`);

    allCardSlots.forEach((currentCardSlotDiv, slotIndex) => {
        const originalImgElement = currentCardSlotDiv.querySelector('img');

        let associatedMeaningElement = null;
        const cardPositionDiv = currentCardSlotDiv.closest('.card-position');
        if (cardPositionDiv) {
            associatedMeaningElement = cardPositionDiv.querySelector('.card-meaning');
        }

        console.log(`enableCardClicks: Processing slotIndex ${slotIndex}. originalImgElement: ${originalImgElement}, associatedMeaningElement: ${associatedMeaningElement}`);

        if (originalImgElement && associatedMeaningElement && originalImgElement.src.includes(cardBackSrc) && ritualState === 'cut_done') {
            originalImgElement.style.cursor = 'pointer';

            const newClonedImgElement = originalImgElement.cloneNode(true);
            originalImgElement.parentNode.replaceChild(newClonedImgElement, originalImgElement);

            newClonedImgElement.addEventListener('click', () => {
                // Pass the NEW cloned image, its associated meaning element, AND the logical index
                revealCard(slotIndex, newClonedImgElement, associatedMeaningElement);
            }, { once: true });

        } else if (originalImgElement) {
            originalImgElement.style.cursor = 'default';
        } else {
            console.error(`enableCardClicks: Could not find img or related elements for slotIndex ${slotIndex}. CardPositionDiv:`, cardPositionDiv);
        }
    });
    console.log("enableCardClicks: Event listeners attached.");
    // These global NodeLists are primarily for reference by other functions if needed,
    // but revealCard now uses direct references.
    cardImagesNodeList = document.querySelectorAll('.card-slot img');
    cardMeaningsNodeList = document.querySelectorAll('.card-meaning');
    console.log(`enableCardClicks: Final query - cardImages: ${cardImagesNodeList.length}, cardMeanings: ${cardMeaningsNodeList.length}`);
}


function checkAllCardsRevealed() {
    if (currentDrawnCardsDetails.length !== 3) return false;
    return currentDrawnCardsDetails.every(card => card && card.revealed === true);
}

function getUserInputs() {
    let selectedTopic = null;
    if (topicRadios) { // Check if topicRadios exist
        topicRadios.forEach(radio => { if (radio.checked) selectedTopic = radio.value; });
    }
    const question = userQuestionInput ? userQuestionInput.value.trim() : "";
    return { topic: selectedTopic, question: question };
}

// MODIFIED revealCard to accept direct element references
async function revealCard(index, clickedImgElement, associatedMeaningElement) {
    console.log(`揭示第 ${index + 1} 道星光...`);
    console.log(`revealCard: Called for index ${index}. Passed imgElement valid: ${!!clickedImgElement}, Passed meaningElement valid: ${!!associatedMeaningElement}`);

    if (ritualState !== 'cut_done') {
        console.warn("儀式步驟錯誤，無法揭示。");
        return;
    }
    if (!(currentDrawnCardsDetails.length > index && currentDrawnCardsDetails[index] && !currentDrawnCardsDetails[index].revealed)) {
        console.log(`第 ${index + 1} 張牌不存在、資料錯誤或已被揭示。`);
        return;
    }

    const card = currentDrawnCardsDetails[index];
    const imgElement = clickedImgElement; // Use passed element
    const meaningElement = associatedMeaningElement; // Use passed element

    if (!imgElement || !meaningElement) {
        console.error(`無法找到索引 ${index} 的 DOM 元素 (來自傳遞的參數)。imgElement: ${imgElement}, meaningElement: ${meaningElement}`);
        return;
    }

    console.log(`揭示: ${card.name} (${card.isReversed ? '逆位' : '正位'})`);
    imgElement.src = card.image; // Use local image path from card data
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
        if (loadingMessage) {
            loadingMessage.textContent = "正在獲取初步解讀...";
            loadingMessage.style.display = 'block';
        }
        if (guidanceReveal) guidanceReveal.style.display = 'none';

        const userInputs = getUserInputs();
        if (!userInputs.topic || !userInputs.question) {
            alert("請確保已選擇探尋領域並低語您的探問！");
            if (loadingMessage) loadingMessage.style.display = 'none';
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
        const response = await fetch('/.netlify/functions/getConciseInterpretation', { // Ensure this path is correct for Netlify
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        if (loadingMessage) loadingMessage.style.display = 'none';

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '無法解析錯誤回應' }));
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
        }
        const data = await response.json();
        if (conciseInterpretationOutput) conciseInterpretationOutput.textContent = data.interpretation;
        storedConciseInterpretation = data.interpretation;
        if (conciseInterpretationSection) conciseInterpretationSection.style.display = 'block';
        if (getDetailedAdviceButton) {
            getDetailedAdviceButton.style.display = 'inline-block';
            getDetailedAdviceButton.disabled = false;
        }
        if (footerText) footerText.style.display = 'block';
        ritualState = 'concise_done';
    } catch (error) {
        console.error('獲取初步解讀失敗:', error);
        if (conciseInterpretationOutput) conciseInterpretationOutput.textContent = `獲取初步解讀時發生錯誤：${error.message}`;
        if (conciseInterpretationSection) conciseInterpretationSection.style.display = 'block';
        ritualState = 'error';
    }
}

async function fetchDetailedAdvice() {
    if (ritualState !== 'concise_done' || !storedConciseInterpretation) {
        alert("請先獲取初步解讀。");
        return;
    }
    ritualState = 'fetching_detailed';
    if (loadingMessage) {
        loadingMessage.textContent = "正在獲取詳細建議...";
        loadingMessage.style.display = 'block';
    }
    if (getDetailedAdviceButton) getDetailedAdviceButton.disabled = true;
    // Keep concise visible, hide old detailed advice if any
    // if (conciseInterpretationSection) conciseInterpretationSection.style.display = 'block'; // Already visible
    if (detailedAdviceSection) detailedAdviceSection.style.display = 'none';
    if (detailedAdviceOutput) detailedAdviceOutput.textContent = '';


    const userInputs = getUserInputs();
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
        })),
        concise_interpretation: storedConciseInterpretation
    };

    try {
        const response = await fetch('/.netlify/functions/getDetailedAdvice', { // Ensure this path is correct
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        if (loadingMessage) loadingMessage.style.display = 'none';

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '無法解析錯誤回應' }));
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
        }
        const data = await response.json();
        if (detailedAdviceOutput) detailedAdviceOutput.textContent = data.advice;
        if (detailedAdviceSection) detailedAdviceSection.style.display = 'block';
        ritualState = 'detailed_done';
    } catch (error) {
        console.error('獲取詳細建議失敗:', error);
        if (detailedAdviceOutput) detailedAdviceOutput.textContent = `獲取詳細建議時發生錯誤：${error.message}`;
        if (detailedAdviceSection) detailedAdviceSection.style.display = 'block';
        ritualState = 'error';
    } finally {
        if (getDetailedAdviceButton) getDetailedAdviceButton.disabled = false;
    }
}


// --- 事件監聽 ---
if (drawButton) {
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
        if(guidanceInitial) guidanceInitial.style.display = 'none';
        if(guidanceShuffle) guidanceShuffle.style.display = 'none';
        if(guidanceReveal) guidanceReveal.style.display = 'none';
        if(conciseInterpretationSection) conciseInterpretationSection.style.display = 'none';
        if(detailedAdviceSection) detailedAdviceSection.style.display = 'none';
        if(getDetailedAdviceButton) getDetailedAdviceButton.style.display = 'none';


        setTimeout(() => {
            let deckIndexes = Array.from({ length: tarotData.length }, (_, i) => i);
            shuffledIndexes = shuffleDeck(deckIndexes);
            console.log(`牌堆已洗牌，長度: ${shuffledIndexes.length}`);
            displayCardBacksInitial();

            drawButton.style.display = 'none';
            if(cutButton) {
                cutButton.style.display = 'inline-block';
                cutButton.disabled = false;
            }
            if(guidanceInitial) {
                guidanceInitial.textContent = "牌已洗好，請以您的直覺，進行神聖的切牌儀式...";
                guidanceInitial.style.display = 'block';
            }
            ritualState = 'shuffled';
        }, 700);
    });
}

if (cutButton) {
    cutButton.addEventListener('click', () => {
        console.log("進行命運之切...");
        if (ritualState !== 'shuffled' || shuffledIndexes.length === 0) { return; }

        cutButton.disabled = true;
        cutButton.textContent = '切牌中...';
        ritualState = 'cutting';

        setTimeout(() => {
            const cutDeckIndexes = cutTheDeck(shuffledIndexes);
            finalizeDrawnCards(cutDeckIndexes);

            cutButton.style.display = 'none';
            cutButton.textContent = '命運之切';
            if(guidanceInitial) guidanceInitial.style.display = 'none';
            if(guidanceReveal) {
                guidanceReveal.textContent = '牌陣已成形。請逐一揭示星辰的低語...';
                guidanceReveal.style.display = 'block';
            }

            ritualState = 'cut_done';
            enableCardClicks();
        }, 500);
    });
}

if (getDetailedAdviceButton) {
    getDetailedAdviceButton.addEventListener('click', fetchDetailedAdvice);
}


// --- 初始化 ---
if(drawButton) drawButton.disabled = true;
if(guidanceShuffle) guidanceShuffle.style.display = 'none';
if(guidanceReveal) guidanceReveal.style.display = 'none';
if(footerText) footerText.style.display = 'none';
if(cutButton) cutButton.style.display = 'none';
if(conciseInterpretationSection) conciseInterpretationSection.style.display = 'none';
if(detailedAdviceSection) detailedAdviceSection.style.display = 'none';
if(getDetailedAdviceButton) getDetailedAdviceButton.style.display = 'none';