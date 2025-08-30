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
    let viewedChatIds = new Set(); // Track which chats have been viewed

    // --- CORE FUNCTIONS ---

    const showScreen = (screenName) => {
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        screens[screenName].classList.add('active');
    };

    const findEventById = (id) => storyData.script.find(event => event.id === id);

    const hasUnreadMessages = (chatId) => {
        // Check if there are unlocked messages in this chat that haven't been viewed
        const unlockedMessagesInChat = storyData.script.filter(item => 
            item.chatId === chatId && 
            unlockedMessageIds.has(item.id)
        );
        
        // If there are unlocked messages and the chat hasn't been viewed, it has new messages
        return unlockedMessagesInChat.length > 0 && !viewedChatIds.has(chatId);
    };

    const scrollToBottom = () => {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    };

    const initializeStory = () => {
        // Only unlock the first few messages to start the story
        let currentEvent = findEventById(1);
        let messageCount = 0;
        const maxInitialMessages = 1; // Only show first message initially
        
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

    const showChatTransitionNotification = (fromChatId, toChatId) => {
        const fromChat = storyData.chats.find(c => c.id === fromChatId);
        const toChat = storyData.chats.find(c => c.id === toChatId);
        
        const notification = document.createElement('div');
        notification.className = 'message system chat-transition';
        notification.innerHTML = `
            <p class="text">Story continues in <strong>${toChat.name}</strong>...</p>
            <div class="transition-buttons">
                <button class="go-to-chat-btn" data-chat-id="${toChatId}">Go to ${toChat.name}</button>
            </div>
        `;
        messageContainer.appendChild(notification);
        
        // Add click handlers to the buttons
        notification.querySelector('.go-to-chat-btn').addEventListener('click', () => {
            openChat(toChatId);
        });
        
        notification.querySelector('.auto-navigate-btn').addEventListener('click', () => {
            // Auto-navigate to the new chat after a short delay
            setTimeout(() => {
                openChat(toChatId);
            }, 1000);
        });
        
        // Scroll to show the entire transition message
        setTimeout(() => {
            notification.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end',
                inline: 'nearest'
            });
        }, 100);
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
            
            if (nextEvent) {
                if (nextEvent.chatId === currentEvent.chatId) {
                    // There's a next event in this chat, add continue button
                    addContinueButtonIfNeeded(currentEvent.chatId);
                } else {
                    // The next event is in a different chat - unlock it and update chat list
                    unlockedMessageIds.add(nextEvent.id);
                    renderChatList();
                    
                    // Show a notification that the story has moved to a different chat
                    showChatTransitionNotification(currentEvent.chatId, nextEvent.chatId);
                }
            }
            
        } else if (currentEvent.type === 'playerChoice') {
            unlockedMessageIds.add(currentEvent.id);
            renderChoices(currentEvent);
        }
        
        renderChatList();
        updateStoryProgress();
        scrollToBottom();
    };

    // --- START GAME & RENDERING ---

    const startGame = async () => {
        const response = await fetch('luna-archive-linear-script.json');
        storyData = await response.json();
        initializeStory();
    };

    const updateStoryProgress = () => {
        if (!storyData.script || storyData.script.length === 0) return;
        
        // Calculate total number of story events (messages and choices)
        const totalEvents = storyData.script.length;
        
        // Calculate number of unlocked events
        const unlockedEvents = unlockedMessageIds.size;
        
        // Calculate progress percentage
        const progressPercentage = Math.round((unlockedEvents / totalEvents) * 100);
        
        // Update progress bar
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
            progressBarFill.style.width = `${progressPercentage}%`;
        }
    };

    const renderChatList = () => {
        chatListContainer.innerHTML = '';
        storyData.chats.forEach(chat => {
            const allMessagesForChat = [...storyData.script].filter(item => item.chatId === chat.id && unlockedMessageIds.has(item.id));
            const lastMessage = allMessagesForChat[allMessagesForChat.length - 1];
            
            // Check if there are new messages available (unlocked but not yet viewed)
            const hasNewMessages = hasUnreadMessages(chat.id);
            
            // Count unread messages (unlocked but not viewed)
            const unreadCount = allMessagesForChat.length;
            
            const li = document.createElement('li');
            li.className = `chat-item ${hasNewMessages ? 'has-new-messages' : ''}`;
            
            // Show unread indicator or timestamp
            const rightSideContent = hasNewMessages ? 
                `<div class="chat-item-unread-indicator">
                    <div class="chat-item-unread-count">
                        <span class="chat-item-unread-number">${unreadCount}</span>
                        <svg class="chat-item-unread-arrow" width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.2071 8.70711C16.5976 8.31658 16.5976 7.68342 16.2071 7.29289L9.84315 0.928932C9.45262 0.538408 8.81946 0.538408 8.42893 0.928932C8.03841 1.31946 8.03841 1.95262 8.42893 2.34315L14.0858 8L8.42893 13.6569C8.03841 14.0474 8.03841 14.6805 8.42893 15.0711C8.81946 15.4616 9.45262 15.4616 9.84315 15.0711L16.2071 8.70711ZM0 8V9H15.5V8V7H0V8Z" fill="white"/>
                        </svg>
                    </div>
                </div>` :
                `<span class="chat-item-timestamp">${lastMessage && lastMessage.timestamp ? lastMessage.timestamp.time : ''}</span>`;
            
            li.innerHTML = `
                <div class="chat-item-avatar"></div>
                <div class="chat-item-content">
                    <div class="chat-item-header">
                        <h3 class="chat-item-title">${chat.name}</h3>
                        ${rightSideContent}
                    </div>
                    <p class="chat-item-message">${lastMessage ? (lastMessage.type === 'message' ? lastMessage.text : 'Choose a response...') : 'No messages yet'}</p>
                </div>
            `;
            li.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(li);
        });
        
        // Update progress bar after rendering chat list
        updateStoryProgress();
    };
    
    const openChat = (chatId, skipAutoProgression = false) => {
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        
        // Update chat members
        const chatMembersElement = document.getElementById('chat-members');
        if (chatMembersElement && chat.members) {
            chatMembersElement.textContent = chat.members;
        }
        
        // Mark this chat as viewed
        viewedChatIds.add(chatId);
        
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
        
        // Create character class name from author
        const characterClass = messageData.author.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        messageDiv.className = `message ${isSent ? 'sent' : 'received'} character-${characterClass}`;
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
                
                if (nextEvent && !unlockedMessageIds.has(nextEvent.id)) {
                    if (nextEvent.chatId === chatId) {
                        // There's a new event in the same chat, add continue button
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
                    } else {
                        // The next event is in a different chat - unlock it and show transition notification
                        unlockedMessageIds.add(nextEvent.id);
                        renderChatList();
                        showChatTransitionNotification(chatId, nextEvent.chatId);
                    }
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
    
    // Home back button (from chat list to start screen)
    const homeBackButton = document.getElementById('home-back-button');
    if (homeBackButton) {
        homeBackButton.addEventListener('click', () => {
            showScreen('start');
        });
    }
    
    // --- INITIAL CALL ---
    showScreen('start');
});