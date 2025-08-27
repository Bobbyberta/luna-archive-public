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
        // Only unlock the first few messages to start the story
        let currentEvent = findEventById(1);
        let messageCount = 0;
        const maxInitialMessages = 3; // Only show first 3 messages initially
        
        while (currentEvent && currentEvent.type === 'message' && messageCount < maxInitialMessages) {
            unlockedMessageIds.add(currentEvent.id);
            messageCount++;
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            currentEvent = findEventById(nextId);
        }
        
        // Don't unlock the choice initially - let the story progress naturally
        renderChatList();
        showScreen('chatList');
    };

    // --- TYPING ANIMATION & STORY PROGRESSION (NOW ASYNC) ---

    const showEndOfChatMessage = () => {
        const endMessage = document.createElement('div');
        endMessage.className = 'message received end-of-chat';
        endMessage.innerHTML = `
            <p class="text">End of conversation</p>
        `;
        messageContainer.appendChild(endMessage);
        scrollToBottom();
    };

    const processStory = async (startId) => {
        let currentEvent = findEventById(startId);
        
        if (!currentEvent) return;
        
        // Only process one event at a time
        if (currentEvent.type === 'message') {
            unlockedMessageIds.add(currentEvent.id);
            appendMessage(currentEvent);
            
            // Check what comes next
            const nextId = currentEvent.nextId || currentEvent.id + 1;
            const nextEvent = findEventById(nextId);
            
            if (nextEvent && nextEvent.chatId === currentEvent.chatId) {
                // There's a next event in this chat, add continue button
                addContinueButtonIfNeeded(currentEvent.chatId);
            }
            
        } else if (currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
            renderChoices(currentEvent);
        }
        
        renderChatList();
        scrollToBottom();
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
                    <span>${lastMessage && lastMessage.timestamp ? lastMessage.timestamp.time : ''}</span>
                </div>
                <p>${lastMessage ? (lastMessage.type === 'message' ? lastMessage.text : 'Choose a response...') : 'No messages yet'}</p>
            `;
            li.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(li);
        });
    };
    
    const openChat = (chatId, skipAutoProgression = false) => {
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        
        // Show the complete chat history for this chat
        showCompleteChatHistory(chatId);
        
        showScreen('chat');
        
        // No more auto-progression - typing animations only happen on click
    };

    const startStoryProgression = async (chatId) => {
        // Clear the chat and start fresh progression
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        messageContainer.innerHTML = '';
        choicesContainer.style.display = 'none';
        choicesContainer.innerHTML = '';
        
        showScreen('chat');
        
        // Find the first unlocked message for this chat
        const firstMessage = storyData.script.find(item => 
            item.chatId === chatId && 
            unlockedMessageIds.has(item.id) && 
            item.type === 'message'
        );
        
        if (firstMessage) {
            // Start story progression from the first message
            await processStory(firstMessage.id);
        }
    };

    const appendMessage = (messageData, shouldScroll = true) => {
        const isSent = messageData.author === 'Alana';
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
        const authorHTML = !isSent ? `<strong class="author">${messageData.author}</strong>` : '';
        messageDiv.innerHTML = `
            ${authorHTML}
            <p class="text">${messageData.text}</p>
            <small class="timestamp">${messageData.timestamp ? messageData.timestamp.time : ''}</small>
        `;
        messageContainer.appendChild(messageDiv);
        if (shouldScroll) {
            scrollToBottom();
        }
    };

    const renderChoices = (choiceData) => {
        // Only show choices if there are actual choices to display
        if (!choiceData.choices || choiceData.choices.length === 0) {
            choicesContainer.style.display = 'none';
            return;
        }
        
        // Clear any existing continue button when showing choices
        const existingContinueButton = document.querySelector('.continue-button-container');
        if (existingContinueButton) {
            existingContinueButton.remove();
        }
        
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

    const startStoryProgressionIfNeeded = async (chatId) => {
        // Find the next unlocked message that should trigger story progression
        const unlockedMessages = storyData.script.filter(item => 
            item.chatId === chatId && 
            unlockedMessageIds.has(item.id)
        );
        
        // Find the last unlocked message
        const lastUnlockedMessage = unlockedMessages[unlockedMessages.length - 1];
        
        if (lastUnlockedMessage && lastUnlockedMessage.type === 'message') {
            // Check if there's a next message that should be unlocked
            const nextId = lastUnlockedMessage.nextId || lastUnlockedMessage.id + 1;
            const nextEvent = findEventById(nextId);
            
            if (nextEvent && nextEvent.chatId === chatId && !unlockedMessageIds.has(nextEvent.id)) {
                // There's a new message to unlock, start story progression
                await processStory(nextId);
            }
        } else if (lastUnlockedMessage && lastUnlockedMessage.type === 'playerChoice') {
            // If the last unlocked item is a choice, we need to wait for player input
            // Don't auto-progress, just show the choices
            const choiceData = lastUnlockedMessage;
            if (choiceData.choices && choiceData.choices.length > 0) {
                renderChoices(choiceData);
            }
        }
    };

    const showCompleteChatHistory = (chatId) => {
        // Clear the chat
        messageContainer.innerHTML = '';
        choicesContainer.style.display = 'none';
        choicesContainer.innerHTML = '';
        
        // Remove any existing continue buttons
        const existingContinueButton = document.querySelector('.continue-button-container');
        if (existingContinueButton) {
            existingContinueButton.remove();
        }
        
        let lastDate = null;
        
        // Get all unlocked messages and choices for this chat, sorted by ID
        const allItems = storyData.script
            .filter(item => item.chatId === chatId && unlockedMessageIds.has(item.id))
            .sort((a, b) => a.id - b.id);
        
        // Find the last unlocked item to determine if choices should be shown
        const lastUnlockedItem = allItems[allItems.length - 1];
        const shouldShowChoices = lastUnlockedItem && 
                                 lastUnlockedItem.type === 'playerChoice' && 
                                 lastUnlockedItem.choices && 
                                 lastUnlockedItem.choices.length > 0;
        
        allItems.forEach(item => {
            if (item.type === 'message') {
                if (item.timestamp && item.timestamp.date !== lastDate) {
                    const dateDiv = document.createElement('div');
                    dateDiv.className = 'date-divider';
                    dateDiv.textContent = item.timestamp.date;
                    messageContainer.appendChild(dateDiv);
                    lastDate = item.timestamp.date;
                }
                appendMessage(item, false);
            }
            // Don't render choices here - we'll handle them separately
        });
        
        // Only show choices if they're the current active choice (last unlocked item)
        if (shouldShowChoices) {
            renderChoices(lastUnlockedItem);
        } else {
            // If no choices to show, check if there are more messages to unlock
            addContinueButtonIfNeeded(chatId);
        }
        
        scrollToBottom();
    };

    const addContinueButtonIfNeeded = (chatId) => {
        // Check if there are more messages to unlock
        const unlockedMessages = storyData.script.filter(item => 
            item.chatId === chatId && 
            unlockedMessageIds.has(item.id)
        );
        
        // Find the last unlocked item
        const lastUnlockedItem = unlockedMessages[unlockedMessages.length - 1];
        
        if (lastUnlockedItem) {
            let nextId;
            
            if (lastUnlockedItem.type === 'message') {
                // If last item is a message, check its nextId
                nextId = lastUnlockedItem.nextId || lastUnlockedItem.id + 1;
            } else if (lastUnlockedItem.type === 'playerChoice') {
                // If last item is a choice, we need to find the next message after the choice
                // This means the choice has been resolved and there are more messages
                const nextEvent = findEventById(lastUnlockedItem.id + 1);
                if (nextEvent && nextEvent.chatId === chatId) {
                    nextId = nextEvent.id;
                }
            }
            
            if (nextId) {
                const nextEvent = findEventById(nextId);
                
                if (nextEvent && nextEvent.chatId === chatId && !unlockedMessageIds.has(nextEvent.id)) {
                    // There's a new event to unlock, add continue button at bottom
                    const continueButton = document.createElement('div');
                    continueButton.className = 'continue-button-container';
                    continueButton.innerHTML = `
                        <button class="continue-btn">Continue...</button>
                    `;
                    
                    // Add click handler to continue button
                    continueButton.querySelector('.continue-btn').addEventListener('click', () => {
                        continueButton.remove(); // Remove the button
                        processStory(nextId); // Start story progression for just the next event
                    });
                    
                    // Add to the bottom of the screen, not inside message container
                    const chatScreen = document.getElementById('chat-screen');
                    chatScreen.appendChild(continueButton);
                }
            }
        }
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