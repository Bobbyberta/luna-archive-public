// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const screens = {
        start: document.getElementById('start-screen'),
        chatList: document.getElementById('chat-list-screen'),
        chat: document.getElementById('chat-screen'),
    };
    const playButton = document.getElementById('play-button');
    const backButton = document.getElementById('back-button');
    const chatListContainer = document.getElementById('chat-list-container');
    const messageContainer = document.getElementById('message-container');
    const choicesContainer = document.getElementById('choices-container');
    const chatTitle = document.getElementById('chat-title');

    // --- GAME STATE ---
    let storyData = {};
    let unlockedMessageIds = new Set(); // Use a Set to track all unlocked message IDs

    // --- CORE FUNCTIONS ---

    const showScreen = (screenName) => {
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        screens[screenName].classList.add('active');
    };

    const findEventById = (id) => storyData.script.find(event => event.id === id);

    const initializeStory = () => {
        // Unlock all messages up to the first player choice
        let currentEvent = findEventById(1);
        while (currentEvent && currentEvent.type === 'message') {
            unlockedMessageIds.add(currentEvent.id);
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            currentEvent = findEventById(nextId);
        }
        // Add the choice point itself so we can render it later
        if (currentEvent && currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
        }
        
        renderChatList();
        showScreen('chatList');
    };

    const processStory = (startId) => {
        let currentEvent = findEventById(startId);
        let lastMessageChatId = null;

        while (currentEvent && currentEvent.type === 'message') {
            unlockedMessageIds.add(currentEvent.id);
            lastMessageChatId = currentEvent.chatId; // Track where the last message was
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            currentEvent = findEventById(nextId);
        }
        
        if (currentEvent && currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
        }

        // After processing, refresh the list and open the relevant chat
        renderChatList();
        if (lastMessageChatId) {
            openChat(lastMessageChatId);
        } else if (currentEvent) {
            // If the next event is a choice, open its chat
            openChat(currentEvent.chatId);
        }
    };

    const startGame = async () => {
        const response = await fetch('story.json');
        storyData = await response.json();
        initializeStory(); // This function now sets up the initial game state
    };

    // --- RENDERING FUNCTIONS ---

    const renderChatList = () => {
        chatListContainer.innerHTML = '';
        storyData.chats.forEach(chat => {
            const allMessagesForChat = [...storyData.script]
                .filter(item => item.chatId === chat.id && unlockedMessageIds.has(item.id));
            
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
                appendMessage(item);
            } else if (item.type === 'playerChoice') {
                renderChoices(item);
            }
        });
        
        showScreen('chat');
    };
    
    const appendMessage = (messageData) => {
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
        messageContainer.scrollTop = messageContainer.scrollHeight;
    };

    const renderChoices = (choiceData) => {
        choicesContainer.innerHTML = '';
        choiceData.choices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                choicesContainer.innerHTML = '';
                // When a choice is made, process the story starting from the chosen nextId
                processStory(choice.nextId);
            });
            choicesContainer.appendChild(button);
        });
    };

    // --- EVENT LISTENERS ---
    playButton.addEventListener('click', startGame);
    backButton.addEventListener('click', () => {
        renderChatList();
        showScreen('chatList');
    });

    // --- INITIAL CALL ---
    showScreen('start');
});