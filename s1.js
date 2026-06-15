// ====================================================================
// 1. НАЛАШТУВАННЯ ХМАРИ (JSONBin.io)
// ====================================================================
const CLOUD_API_KEY = '$2a$10$2XqOLrSsXthcKg925l/Sk.6PqMKbqGF/XzRytUJtSw29fDlVNGouq'; 
const USERS_BIN_ID = '6a2da741da38895dfebb4bcf';  
const MOVIES_BIN_ID = '6a24577af5f4af5e29c32cf6';
const COMMENTS_BIN_ID = '6a2f2a5ef5f4af5e29f1fa87'; 

// Функція для отримання даних користувачів з хмари
async function loadUsersFromCloud() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${USERS_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': CLOUD_API_KEY, 'Cache-Control': 'no-cache' }
        });
        const result = await response.json();
        return result.record; 
    } catch (err) {
        console.error("Помилка завантаження користувачів з хмари:", err);
        return null;
    }
}

// Функція для збереження даних користувачів у хмару
async function saveUsersToCloud(data) {
    try {
        await fetch(`https://api.jsonbin.io/v3/b/${USERS_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': CLOUD_API_KEY
            },
            body: JSON.stringify(data)
        });
        console.log("Дані користувачів успішно збережено в хмару!");
    } catch (err) {
        console.error("Помилка збереження в хмару:", err);
    }
}

// ====================================================================
// 2. ОНОВЛЕННЯ ІНТЕРФЕЙСУ З ХМАРИ (Баланс, Аватарка, Юзернейм)
// ====================================================================
async function updateUI() {
    const currentUser = sessionStorage.getItem('secureUser');
    const balanceElement = document.getElementById('balance');
    const usernameSpan = document.getElementById('main-username');
    const avatarElement = document.getElementById('user-avatar');

    if (!currentUser) {
        if (balanceElement) balanceElement.innerText = "0";
        if (usernameSpan) usernameSpan.innerText = "Увійти";
        return;
    }

    if (usernameSpan) usernameSpan.innerText = currentUser;

    const users = await loadUsersFromCloud();
    if (!users || !users[currentUser]) return;

    const userData = users[currentUser];

    // Оновлюємо баланс
    if (balanceElement) {
        balanceElement.innerText = Number(userData.balance || 0).toLocaleString('uk-UA');
    }

    // Оновлюємо аватарку (виправлено для кольорових аватарок та прапорів)
    if (avatarElement && userData.avatar) {
        if (userData.avatar.startsWith('#') || userData.avatar.startsWith('linear-gradient') || userData.avatar.startsWith('flag:')) {
            avatarElement.style.opacity = '0'; // Ховаємо биту картинку
            const wrapper = avatarElement.closest('.avatar-wrapper');
            if (wrapper) {
                if (userData.avatar.startsWith('flag:')) {
                    wrapper.style.background = '#4a90e2'; // Спрощений фон для прапорів у шапці
                } else {
                    wrapper.style.background = userData.avatar;
                }
            }
        } else {
            avatarElement.src = userData.avatar;
            avatarElement.style.opacity = '1';
            const wrapper = avatarElement.closest('.avatar-wrapper');
            if (wrapper) wrapper.style.background = 'transparent';
        }
    }
}

// ====================================================================
// 3. ФУНКЦІЯ ДЛЯ ЗАРОБІТКУ МОНЕТ (Для earn.html)
// ====================================================================
async function addCoinsToCloud(amountToAdd) {
    const currentUser = sessionStorage.getItem('secureUser');
    if (!currentUser) {
        alert("Увійдіть в акаунт, щоб отримувати монети!");
        return false;
    }

    try {
        const users = await loadUsersFromCloud();
        if (!users || !users[currentUser]) return false;

        let currentBalance = users[currentUser].balance || 0;
        users[currentUser].balance = currentBalance + amountToAdd;

        await saveUsersToCloud(users);
        await updateUI();
        
        alert(`🎉 Успішно нараховано ${amountToAdd} монет!`);
        return true;
    } catch (error) {
        console.error("Помилка при нарахуванні монет:", error);
        return false;
    }
}

// ====================================================================
// 4. ФУНКЦІЯ ДЛЯ ПОКУПОК У МАГАЗИНІ
// ====================================================================
async function buyItemFromShop(itemId, itemName, itemUrl, itemPrice) {
    const currentUser = sessionStorage.getItem('secureUser');
    if (!currentUser) {
        alert("Помилка: Спочатку увійдіть у свій акаунт!");
        return false;
    }

    try {
        let users = await loadUsersFromCloud();
        if (!users || !users[currentUser]) {
            alert("Помилка авторизації.");
            return false;
        }

        let currentBalance = users[currentUser].balance || 0;
        if (currentBalance < itemPrice) {
            alert(`❌ Недостатньо монет!`);
            return false;
        }

        if (!users[currentUser].inventory) users[currentUser].inventory = [];
        const alreadyOwns = users[currentUser].inventory.some(item => item.id === itemId);
        if (alreadyOwns) {
            users[currentUser].avatar = itemUrl; 
            await saveUsersToCloud(users);
            await updateUI();
            alert("✅ Аватарку встановлено!");
            return true;
        }

        users[currentUser].balance = currentBalance - itemPrice;
        users[currentUser].inventory.push({ id: itemId, name: itemName, url: itemUrl });
        users[currentUser].avatar = itemUrl;

        await saveUsersToCloud(users);
        await updateUI();

        alert(`🎉 Успішна покупка! "${itemName}" додано в інвентар та встановлено як аватарку.`);
        return true;

    } catch (err) {
        console.error("Помилка під час покупки:", err);
        return false;
    }
}

// ====================================================================
// 5. ФУНКЦІЯ "ПЕРЕГЛЯНУТИ ПІЗНІШЕ" (WATCH LATER)
// ====================================================================
async function toggleWatchLater(movieId, starElement) {
    const currentUser = sessionStorage.getItem('secureUser');
    if (!currentUser) {
        alert("Будь ласка, увійдіть в акаунт, щоб додавати фільми в обране!");
        return;
    }

    try {
        starElement.style.pointerEvents = 'none';
        starElement.style.opacity = '0.5';

        const users = await loadUsersFromCloud();

        if (!users || !users[currentUser]) {
            alert("Помилка профілю. Спробуйте перезайдіть.");
            return;
        }

        if (!users[currentUser].watchLater) {
            users[currentUser].watchLater = [];
        }

        let watchlist = users[currentUser].watchLater;

        if (watchlist.includes(movieId)) {
            watchlist = watchlist.filter(id => id !== movieId);
            starElement.innerText = "☆"; 
            starElement.style.color = "white"; 
            starElement.classList.remove('active');
        } else {
            watchlist.push(movieId);
            starElement.innerText = "⭐"; 
            starElement.style.color = "gold"; 
            starElement.classList.add('active');
        }

        users[currentUser].watchLater = watchlist;
        await saveUsersToCloud(users);

    } catch (err) {
        console.error("Помилка збереження в обране:", err);
        alert("Сталася помилка. Перевірте з'єднання.");
    } finally {
        starElement.style.pointerEvents = 'auto';
        starElement.style.opacity = '1';
    }
}

// ====================================================================
// 6. ЗАВАНТАЖЕННЯ ФІЛЬМІВ З ХМАРИ ТА РЕНДЕР КАТАЛОГУ
// ====================================================================
let moviesDatabase = []; 
let filteredMovies = []; 
let currentPage = 1;
const itemsPerPage = 4;  

async function loadMoviesFromJSON() {
    const listContainer = document.getElementById('movie-list');
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`https://api.jsonbin.io/v3/b/${MOVIES_BIN_ID}/latest?t=${timestamp}`, {
            headers: { 'X-Master-Key': CLOUD_API_KEY, 'Cache-Control': 'no-cache' }
        }); 
        if (!response.ok) throw new Error(`Помилка HTTP: ${response.status}`);
        
        const data = await response.json();
        moviesDatabase = data.record; 
        
        localStorage.setItem('movies_data', JSON.stringify(moviesDatabase));
        filteredMovies = [...moviesDatabase];      
        
        if (document.getElementById('carousel')) renderCarousel(); 
        if (document.getElementById('movie-list')) renderKinokradList();   
        if (document.getElementById('player-section') && typeof loadSpecificMovie === 'function') loadSpecificMovie();
    } catch (error) {
        console.error("Помилка завантаження фільмів:", error);
        if (listContainer) listContainer.innerHTML = '<p style="color:red; text-align:center;">Помилка підключення до онлайн бази фільмів.</p>';
    }
}

function renderKinokradList() {
    const listContainer = document.getElementById('movie-list');
    if (!listContainer) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const moviesToShow = filteredMovies.slice(startIndex, endIndex);

    if (moviesToShow.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#aaa; width: 100%; padding: 40px; font-size: 1.1rem;">За вашим запитом нічого не знайдено.</p>';
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    listContainer.innerHTML = moviesToShow.map(m => {
        const ratingVal = parseFloat(m.rating) || 0; 
        const filledStars = Math.round(ratingVal); 
        const emptyStars = 10 - filledStars; 
        const starsHtml = '★'.repeat(filledStars) + '☆'.repeat(emptyStars > 0 ? emptyStars : 0);
        
        return `
        <div class="kinokrad-card" onclick="window.location.href='movie.html?id=${m.id || 0}'" style="cursor:pointer; position: relative;" data-id="${m.id}">
            <span class="star-badge" onclick="event.stopPropagation(); toggleWatchLater(${m.id}, this)" style="position: absolute; top: 10px; right: 10px; cursor: pointer; font-size: 24px; color: white; background: rgba(0,0,0,0.7); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; z-index: 10; transition: 0.2s;">☆</span>
            <img src="${m.img}" class="kinokrad-poster" alt="${m.title}">
            <div class="kinokrad-info">
                <h3>${m.title}</h3>
                <div class="stars" style="color: #f1c40f; margin: 5px 0;" title="${ratingVal}/10">
                    ${starsHtml} <span style="font-size: 12px; color: #888; font-weight: normal;">(${ratingVal}/10)</span>
                </div>
                <div class="kinokrad-meta">
                    <div><b>Якість:</b> ${m.quality || 'Невідомо'}</div>
                    <div><b>Рік:</b> ${m.year || 'Невідомо'}</div>
                    <div><b>Жанр:</b> ${m.genre || 'Невідомо'}</div>
                    <div><b>Країна:</b> ${m.country || 'Невідомо'}</div>
                </div>
                <p class="kinokrad-desc">${m.desc || ''}</p>
            </div>
        </div>
        `;
    }).join('');
    
    renderPagination();
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredMovies.length / itemsPerPage);
    let buttonsHTML = '';

    if (totalPages <= 1) { paginationContainer.innerHTML = ''; return; }

    buttonsHTML += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">❮</button>`;
    for (let i = 1; i <= totalPages; i++) {
        buttonsHTML += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    buttonsHTML += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">❯</button>`;

    paginationContainer.innerHTML = buttonsHTML;
}

function changePage(newPage) {
    const totalPages = Math.ceil(filteredMovies.length / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderKinokradList();
        const newsSection = document.querySelector('.news-section');
        if (newsSection) newsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ====================================================================
// 7. ДИНАМІЧНА КАРУСЕЛЬ 
// ====================================================================
const carousel = document.getElementById('carousel');
const prevBtn = document.querySelector('.prev');
const nextBtn = document.querySelector('.next');

function renderCarousel() {
    if (!carousel || !moviesDatabase || moviesDatabase.length === 0) return;
    const carouselMovies = moviesDatabase.slice(0, 7);
    
    carousel.innerHTML = carouselMovies.map(m => `
        <div class="movie-card">
            <a href="movie.html?id=${m.id}" title="${m.title}" style="display: block; width: 100%; height: 100%;">
                <img src="${m.img}" alt="${m.title}">
            </a>
        </div>
    `).join('');
    updateCarousel();
}

function updateCarousel() {
    if (!carousel) return;
    const cards = document.querySelectorAll('.movie-card');
    if (cards.length === 0) return;
    cards.forEach(card => card.className = 'movie-card');
    const center = 3; 
    if (cards[center]) {
        cards[center].classList.add('active');
        if (cards[center - 1]) cards[center - 1].classList.add('mid-left');
        if (cards[center + 1]) cards[center + 1].classList.add('mid-right');
        if (cards[center - 2]) cards[center - 2].classList.add('far-left');
        if (cards[center + 2]) cards[center + 2].classList.add('far-right');
    }
}

if (nextBtn && prevBtn && carousel) {
    nextBtn.addEventListener('click', () => { 
        const cards = document.querySelectorAll('.movie-card');
        if (cards.length > 0) { carousel.appendChild(cards[0]); updateCarousel(); }
    });
    prevBtn.addEventListener('click', () => { 
        const cards = document.querySelectorAll('.movie-card');
        if (cards.length > 0) { carousel.insertBefore(cards[cards.length - 1], cards[0]); updateCarousel(); }
    });
}

const navButtons = document.querySelectorAll('.nav-btn');
navButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
        this.style.pointerEvents = 'none';
        setTimeout(() => { this.style.pointerEvents = 'auto'; }, 400); 
    });
});

// ====================================================================
// 8. МОДАЛЬНІ ВІКНА ТА ФІЛЬТРИ
// ====================================================================
const closeBtns = document.querySelectorAll('.close-btn');
closeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-modal');
        const modal = document.getElementById(targetId);
        if(modal) modal.classList.remove('show');
    });
});

window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) event.target.classList.remove('show');
});

const filterPills = document.querySelectorAll('.filter-pill, .filter-tab, .status-circle');
filterPills.forEach(pill => {
    pill.addEventListener('click', function() {
        if (this.innerText.trim() === "Всі") {
            filterPills.forEach(p => p.classList.remove('selected'));
            this.classList.add('selected');
        } else {
            filterPills.forEach(p => { if (p.innerText.trim() === "Всі") p.classList.remove('selected'); });
            this.classList.toggle('selected');
        }
    });
});

function applyAllFilters() {
    if (typeof moviesDatabase === 'undefined' || moviesDatabase.length === 0) return;
    
    let filtered = [...moviesDatabase];
    const activePill = document.querySelector('.filter-pill.selected, .filter-tab.selected, .status-circle.selected');
    const value = activePill ? activePill.innerText.trim() : "Всі";

    if (value === "Новинки") {
        filtered.sort((a, b) => b.year - a.year);
    } else if (value === "За рейтингом ★") {
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (value !== "Всі") {
        filtered = filtered.filter(m => 
            (m.genre && m.genre.toLowerCase().includes(value.toLowerCase())) || 
            (m.title && m.title.toLowerCase().includes(value.toLowerCase())) || 
            m.year == parseInt(value)
        );
    }

    filteredMovies = filtered;
    currentPage = 1; 
    renderKinokradList(); 
}

// ====================================================================
// 9. AI ЧАТ-БОТ 
// ====================================================================
let isAiFilterActive = false; 

function toggleAiFilter() {
    isAiFilterActive = !isAiFilterActive;
    const iconBtn = document.getElementById('aiToggleBtn');
    
    if (iconBtn) {
        if (isAiFilterActive) {
            iconBtn.classList.add('active'); 
            iconBtn.title = 'AI Фільтр: УВІМКНЕНО';
        } else {
            iconBtn.classList.remove('active'); 
            iconBtn.title = 'AI Фільтр: ВИМКНЕНО';
        }
    }
}

const toggleBtnEl = document.getElementById('aiToggleBtn');
if (toggleBtnEl) toggleBtnEl.addEventListener('click', toggleAiFilter);

const sendBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

function saveChatToLocalStorage(sender, messageText) {
    let history = JSON.parse(localStorage.getItem('chat_messages_history')) || [];
    history.push({ sender: sender, text: messageText });
    localStorage.setItem('chat_messages_history', JSON.stringify(history));
}

function loadChatHistory() {
    if (!chatMessages) return;
    const history = JSON.parse(localStorage.getItem('chat_messages_history')) || [];
    chatMessages.innerHTML = ''; 
    
    history.forEach(msg => {
        const div = document.createElement('div');
        div.className = (msg.sender === 'user') ? 'user-message' : 'bot-message';
        div.innerText = msg.text;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    if (!chatInput || !chatMessages) return;
    const text = chatInput.value.trim();
    if (text === "") return;

    const useFilter = isAiFilterActive;

    const userDiv = document.createElement('div');
    userDiv.className = 'user-message';
    userDiv.innerText = text;
    chatMessages.appendChild(userDiv);
    
    saveChatToLocalStorage('user', text);
    
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'bot-message';
    loadingDiv.innerText = useFilter ? "⏳ Шукаю фільми у базі..." : "⏳ Друкує...";
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // =========================================================================================
        // УВАГА! ТУТ ТРЕБА ВСТАВИТИ СВОЮ АДРЕСУ З RENDER, ЯКЩО ВОНА ВІДРІЗНЯЄТЬСЯ
        // =========================================================================================
        const response = await fetch('https://kinohub-oo6e.onrender.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, useFilter: useFilter }) 
        });

        if (!response.ok) throw new Error("Помилка мережі");
        const data = await response.json();

        if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);

        const botDiv = document.createElement('div');
        botDiv.className = 'bot-message';
        botDiv.innerText = data.reply;
        chatMessages.appendChild(botDiv);

        saveChatToLocalStorage('bot', data.reply);

        if (useFilter && data.action === 'filter') {
            if (data.movieIds && data.movieIds.length > 0) {
                const targetIds = data.movieIds.map(String);
                filteredMovies = moviesDatabase.filter(m => targetIds.includes(String(m.id)));
            } else {
                filteredMovies = []; 
            }
            
            currentPage = 1; 
            renderKinokradList(); 
            
            const movieListSection = document.getElementById('movie-list');
            if (movieListSection) movieListSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

    } catch (error) {
        console.error("Chat error:", error);
        if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
        const errDiv = document.createElement('div');
        errDiv.className = 'bot-message';
        errDiv.style.color = 'red';
        errDiv.innerText = "Упс... Зв'язок із сервером втрачено.";
        chatMessages.appendChild(errDiv);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (sendBtn) sendBtn.addEventListener('click', () => sendMessage()); 
if (chatInput) chatInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') sendMessage(); 
});

// ====================================================================
// 10. ГЛОБАЛЬНЕ ЗБЕРЕЖЕННЯ ЧАТУ ТА ПЕРЕТЯГУВАННЯ
// ====================================================================
function initGlobalChatPersistence() {
    const chatSidebar = document.querySelector('.chat-sidebar');
    const pinBtn = document.getElementById('pin-chat-btn');
    const chatHeader = document.querySelector('.chat-header');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    
    if (!chatSidebar) return;

    loadChatHistory();

    function saveChatState() {
        localStorage.setItem('chat_unpinned', chatSidebar.classList.contains('unpinned'));
        localStorage.setItem('chat_visible', chatSidebar.style.display !== 'none');
        localStorage.setItem('chat_left', chatSidebar.style.left);
        localStorage.setItem('chat_top', chatSidebar.style.top);
    }

    const isUnpinnedStore = localStorage.getItem('chat_unpinned') === 'true';
    const isVisibleStore = localStorage.getItem('chat_visible') !== 'false'; 
    const leftStore = localStorage.getItem('chat_left');
    const topStore = localStorage.getItem('chat_top');

    if (isUnpinnedStore) {
        chatSidebar.classList.add('unpinned');
        if (pinBtn) { pinBtn.innerText = '📌'; pinBtn.title = 'Закріпити чат'; }
        if (leftStore) chatSidebar.style.setProperty('left', leftStore, 'important');
        if (topStore) chatSidebar.style.setProperty('top', topStore, 'important');
    } else {
        chatSidebar.classList.remove('unpinned');
        if (pinBtn) { pinBtn.innerText = '🔓'; pinBtn.title = 'Відкріпити чат'; }
    }

    if (isVisibleStore) {
        chatSidebar.style.setProperty('display', 'flex', 'important');
        if (chatToggleBtn) chatToggleBtn.classList.add('active-toggle');
    } else {
        chatSidebar.style.setProperty('display', 'none', 'important');
        if (chatToggleBtn) chatToggleBtn.classList.remove('active-toggle');
    }

    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            const isCurrentlyVisible = chatSidebar.style.display !== 'none';
            if (isCurrentlyVisible) {
                chatSidebar.style.setProperty('display', 'none', 'important');
                chatToggleBtn.classList.remove('active-toggle');
            } else {
                chatSidebar.style.setProperty('display', 'flex', 'important');
                chatToggleBtn.classList.add('active-toggle');
            }
            saveChatState();
        });
    }

    if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowUnpinned = !chatSidebar.classList.contains('unpinned');
            chatSidebar.classList.toggle('unpinned', nowUnpinned);

            if (nowUnpinned) {
                pinBtn.innerText = '📌'; pinBtn.title = 'Закріпити чат';
            } else {
                pinBtn.innerText = '🔓'; pinBtn.title = 'Відкріпити чат';
                chatSidebar.style.removeProperty('left');
                chatSidebar.style.removeProperty('top');
            }
            saveChatState();
        });
    }
    
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatSidebar.style.setProperty('display', 'none', 'important');
            if (chatToggleBtn) chatToggleBtn.classList.remove('active-toggle');
            saveChatState();
        });
    }

    let isDragging = false;
    let offsetX = 0; let offsetY = 0;

    const dragHandle = chatHeader || chatSidebar;
    dragHandle.addEventListener('mousedown', (e) => {
        if (!chatSidebar.classList.contains('unpinned')) return;
        if (['INPUT', 'BUTTON', 'SPAN'].includes(e.target.tagName) || e.target.id === 'chat-messages' || e.target.closest('.chat-input-area')) return;

        isDragging = true;
        const rect = chatSidebar.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        chatSidebar.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        const maxX = window.innerWidth - chatSidebar.offsetWidth;
        const maxY = window.innerHeight - chatSidebar.offsetHeight;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;

        chatSidebar.style.setProperty('left', x + 'px', 'important');
        chatSidebar.style.setProperty('top', y + 'px', 'important');
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            chatSidebar.style.userSelect = '';
            saveChatState();
        }
    });
}

// ====================================================================
// 11. СИСТЕМА КОМЕНТАРІВ ТА ПЛЕЄР (Для movie.html)
// ====================================================================
async function loadComments() {
    const container = document.getElementById('local-comments-list');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const movieId = params.get('id');
    if (!movieId) return;

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${COMMENTS_BIN_ID}/latest?t=${Date.now()}`, {
            headers: { 'X-Master-Key': CLOUD_API_KEY, 'Cache-Control': 'no-cache' }
        });
        const result = await response.json();
        const allComments = result.record || [];

        const movieComments = allComments.filter(c => String(c.movie_id) === String(movieId));

        container.innerHTML = movieComments.map(c => `
            <div style="background: rgba(255,255,255,0.04); padding: 12px 15px; border-radius: 8px; border-left: 3px solid #4a90e2; margin-bottom: 10px; text-align: left;">
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: #ffd700; font-weight: bold;">🍿 ${c.username}</span>
                    <span style="color: #666; font-size: 11px;">${c.date}</span>
                </div>
                <div style="color: #e0e0e0; font-size: 14px; margin-top: 5px;">${c.text}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight; 
    } catch (err) {
        console.error("Помилка завантаження коментарів фільму:", err);
    }
}

async function sendComment() {
    const input = document.getElementById('local-comment-input');
    const text = input.value.trim();
    const username = sessionStorage.getItem('secureUser'); 

    if (!username) return alert("Увійди в профіль, щоб писати коментарі!");
    if (!text) return;

    const params = new URLSearchParams(window.location.search);
    const movieId = params.get('id');
    if (!movieId) return alert("Помилка: не вдалося визначити ID фільму!");

    try {
        const btn = document.getElementById('local-submit-comment');
        if (btn) btn.disabled = true;

        const getRes = await fetch(`https://api.jsonbin.io/v3/b/${COMMENTS_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': CLOUD_API_KEY, 'Cache-Control': 'no-cache' }
        });
        const getData = await getRes.json();
        let allComments = getData.record || [];

        allComments.push({ 
            movie_id: movieId, 
            username: username, 
            text: text, 
            date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        });

        await fetch(`https://api.jsonbin.io/v3/b/${COMMENTS_BIN_ID}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': CLOUD_API_KEY 
            },
            body: JSON.stringify(allComments)
        });

        input.value = ''; 
        if (btn) btn.disabled = false; 
        
        loadComments(); 
    } catch (err) {
        console.error("Помилка при відправці коментаря:", err);
        alert("Не вдалося надіслати коментар. Спробуйте ще раз.");
        const btn = document.getElementById('local-submit-comment');
        if (btn) btn.disabled = false;
    }
}

function initMovieCommentsSystem() {
    const btn = document.getElementById('local-submit-comment');
    if (btn) {
        btn.removeEventListener('click', sendComment);
        btn.addEventListener('click', sendComment);
    }
    loadComments(); 
}

function loadSpecificMovie() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = parseInt(urlParams.get('id'));
    if (isNaN(movieId) || !moviesDatabase) return;

    const movie = moviesDatabase.find(m => m.id === movieId);
    if (movie) {
        const titleEl = document.getElementById('view-movie-title');
        if (titleEl) titleEl.innerText = movie.title;

        const videoSource = document.getElementById('video-source');
        const mainVideo = document.getElementById('main-video');
        const qualitySelector = document.getElementById('quality-selector');
        
        if (videoSource && mainVideo) {
            videoSource.src = movie.video_1080 || movie.video_720 || "";
            mainVideo.load();
            if (qualitySelector) {
                qualitySelector.addEventListener('change', (e) => {
                    const quality = e.target.value;
                    const currentTime = mainVideo.currentTime;
                    const isPlaying = !mainVideo.paused;
                    
                    if (quality === '1080' && movie.video_1080) videoSource.src = movie.video_1080;
                    else if (quality === '720' && movie.video_720) videoSource.src = movie.video_720;
                    
                    mainVideo.load();
                    mainVideo.currentTime = currentTime;
                    if (isPlaying) mainVideo.play();
                });
            }
        }
    } else {
        const titleEl = document.getElementById('view-movie-title');
        if (titleEl) titleEl.innerText = "Фільм не знайдено";
    }
}

// ====================================================================
// 12. МАРШРУТИЗАЦІЯ ТА ТЕМА
// ====================================================================
function handleProfileClick(event) {
    event.preventDefault(); 
    const currentUser = sessionStorage.getItem('secureUser');
    if (currentUser) window.location.href = 'profile.html';
    else window.location.href = 'aurh.html';
}

function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    if (!themeBtn) return;

    const isLightMode = localStorage.getItem('light_theme') === 'true';

    if (isLightMode) {
        document.body.classList.add('light-theme');
        themeBtn.classList.add('active-toggle');
        if (themeIcon) themeIcon.innerText = '☀️ Тема';
    }

    themeBtn.addEventListener('click', () => {
        themeBtn.classList.toggle('active-toggle');
        const isNowLight = document.body.classList.toggle('light-theme');
        
        if (isNowLight) {
            localStorage.setItem('light_theme', 'true');
            if (themeIcon) themeIcon.innerText = '☀️ Тема';
        } else {
            localStorage.setItem('light_theme', 'false');
            if (themeIcon) themeIcon.innerText = '🌙 Тема';
        }
    });
}

// ====================================================================
// 13. ІНІЦІАЛІЗАЦІЯ ДОДАТКУ (СТАРТ)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Оновлюємо UI (Баланс, Аватарка)
    try { updateUI(); } catch (e) { console.error(e); }
    
    // 2. Завантажуємо фільми
    loadMoviesFromJSON(); 
    
    // 3. Ініціалізуємо додаткові модулі
    try { initGlobalChatPersistence(); } catch (e) { console.error(e); }
    try { initThemeToggle(); } catch (e) { console.error(e); } 
    
    // Ініціалізація системи коментарів (Хмарна)
    initMovieCommentsSystem();
    
    // 4. Кнопка фільтрів
    const applyBtn = document.querySelector('.apply-filters-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyAllFilters);
    }
    
    // 5. Вивід нікнейма
    const currentUser = sessionStorage.getItem('secureUser');
    console.log("Поточний користувач:", currentUser);
});