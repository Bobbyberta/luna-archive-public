// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const screens = {
        start: document.getElementById('start-screen'),
        chatList: document.getElementById('chat-list-screen'),
        chat: document.getElementById('chat-screen'),
    };
    const mainChatScreen = document.getElementById('chat-screen');
    const playButton = document.getElementById('play-button');
    const backButton = document.getElementById('back-button');
    const chatListContainer = document.getElementById('chat-list-container');
    const messageContainer = document.getElementById('message-container');
    const choicesContainer = document.getElementById('choices-container');
    const chatTitle = document.getElementById('chat-title');

    // --- GAME STATE ---
    let storyData = {};
    let unlockedMessageIds = new Set();
    let skipAnimationHandler = null; // Used to handle skipping the typing animation

    // --- CORE FUNCTIONS ---

    const showScreen = (screenName) => {
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        screens[screenName].classList.add('active');
    };

    const findEventById = (id) => storyData.script.find(event => event.id === id);

    const scrollToBottom = () => {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    };

    const initializeStory = () => {
        let currentEvent = findEventById(1);
        while (currentEvent && currentEvent.type === 'message') {
            unlockedMessageIds.add(currentEvent.id);
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            currentEvent = findEventById(nextId);
        }
        if (currentEvent && currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
        }
        renderChatList();
        showScreen('chatList');
    };

    // --- TYPING ANIMATION & STORY PROGRESSION (NOW ASYNC) ---

    const showTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.className = 'message received typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        indicator.id = 'typing-indicator';
        messageContainer.appendChild(indicator);
        scrollToBottom();
    };

    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    };

    const waitForDelayOrSkip = (duration) => {
        return new Promise(resolve => {
            const timeoutId = setTimeout(resolve, duration);
            
            // This handler will be called if the user clicks the screen
            skipAnimationHandler = () => {
                clearTimeout(timeoutId);
                resolve();
            };
        });
    };

    const processStory = async (startId) => {
        let currentEvent = findEventById(startId);
        let lastMessageChatId = null;

        while (currentEvent && currentEvent.type === 'message') {
            unlockedMessageIds.add(currentEvent.id);
            lastMessageChatId = currentEvent.chatId;

            // If message is from another character, show typing indicator
            if (currentEvent.author !== 'Alana') {
                showTypingIndicator();
                await waitForDelayOrSkip(1500); // Wait 1.5 seconds or until skipped
                removeTypingIndicator();
            }

            appendMessage(currentEvent); // The message appears after the delay
            
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            currentEvent = findEventById(nextId);
        }
        
        if (currentEvent && currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
        }

        renderChatList();
        if (lastMessageChatId) {
            openChat(lastMessageChatId);
        } else if (currentEvent) {
            openChat(currentEvent.chatId);
        }
    };

    // --- START GAME & RENDERING ---

    const startGame = async () => {
        const response = await fetch('story.json');
        storyData = await response.json();
        initializeStory();
    };

    const renderChatList = () => {
        chatListContainer.innerHTML = '';
        storyData.chats.forEach(chat => {
            const allMessagesForChat = [...storyData.script].filter(item => item.chatId === chat.id && unlockedMessageIds.has(item.id));
            const lastMessage = allMessagesForChat.pop();
            const li = document.createElement('li');
            li.className = 'chat-item';
            li.innerHTML = `
                <div class="chat-item-info">
                    <h3>${chat.name}</h3>
                    <span>${lastMessage ? lastMessage.timestamp.time : ''}</span>
                </div>
                <p>${lastMessage ? (lastMessage.type === 'message' ? lastMessage.text : 'Choose a response...') : 'No messages yet'}</p>
            `;
            li.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(li);
        });
    };
    
    const openChat = (chatId) => {
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        messageContainer.innerHTML = '';
        choicesContainer.style.display = 'none'; // Hide choices by default
        choicesContainer.innerHTML = '';
        
        let lastDate = null;
        const messagesAndChoices = storyData.script.filter(item => item.chatId === chatId && unlockedMessageIds.has(item.id));

        messagesAndChoices.forEach(item => {
            if (item.type === 'message') {
                if (item.timestamp.date !== lastDate) {
                    const dateDiv = document.createElement('div');
                    dateDiv.className = 'date-divider';
                    dateDiv.textContent = item.timestamp.date;
                    messageContainer.appendChild(dateDiv);
                    lastDate = item.timestamp.date;
                }
                appendMessage(item, false); // Don't auto-scroll when just loading a chat log
            } else if (item.type === 'playerChoice') {
                renderChoices(item);
            }
        });
        
        showScreen('chat');
        // Scroll to bottom only when opening the chat log
        scrollToBottom();
    };
    
    const appendMessage = (messageData, shouldScroll = true) => {
        const isSent = messageData.author === 'Alana';
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
        const authorHTML = !isSent ? `<strong class="author">${messageData.author}</strong>` : '';
        messageDiv.innerHTML = `
            ${authorHTML}
            <p class="text">${messageData.text}</p>
            <small class="timestamp">${messageData.timestamp.time}</small>
        `;
        messageContainer.appendChild(messageDiv);
        if (shouldScroll) {
            scrollToBottom();
        }
    };

    const renderChoices = (choiceData) => {
        choicesContainer.innerHTML = '';
        choicesContainer.style.display = 'block'; // Show the container
        choiceData.choices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                choicesContainer.style.display = 'none'; // Hide after choosing
                choicesContainer.innerHTML = '';
                processStory(choice.nextId);
            });
            choicesContainer.appendChild(button);
        });
        scrollToBottom(); // Ensure choices are visible
    };

    // --- EVENT LISTENERS ---
    playButton.addEventListener('click', startGame);
    backButton.addEventListener('click', () => {
        renderChatList();
        showScreen('chatList');
    });
    // Listener to skip the typing animation
    mainChatScreen.addEventListener('click', () => {
        if (skipAnimationHandler) {
            skipAnimationHandler();
            skipAnimationHandler = null; // Reset handler after use
        }
    });

    // --- INITIAL CALL ---
    showScreen('start');
});