// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // Get all the screen elements
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

    let storyData = {};
    let currentStoryPoint = 0; // Start before the first script item

    // --- Core Functions ---

    function showScreen(screenName) {
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        screens[screenName].classList.add('active');
    }

    async function startGame() {
        const response = await fetch('story.json');
        storyData = await response.json();
        
        // Start the story by progressing to the first event
        progressStory(1);
    }

    function renderChatList() {
        chatListContainer.innerHTML = ''; // Clear previous list
        storyData.chats.forEach(chat => {
            // Find the very last message for this chat that has been revealed
            const lastMessage = [...storyData.script]
                .reverse()
                .find(item => item.type === 'message' && item.chatId === chat.id && item.id <= currentStoryPoint);

            const li = document.createElement('li');
            li.className = 'chat-item';
            li.innerHTML = `
                <div class="chat-item-info">
                    <h3>${chat.name}</h3>
                    <span>${lastMessage ? lastMessage.timestamp.time : ''}</span>
                </div>
                <p>${lastMessage ? lastMessage.text : 'No messages yet'}</p>
            `;
            li.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(li);
        });
    }
    
    function openChat(chatId) {
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        messageContainer.innerHTML = ''; // Clear old messages
        
        let lastDate = null;

        storyData.script
            .filter(item => item.chatId === chatId && item.id <= currentStoryPoint && item.type === 'message')
            .forEach(item => {
                // Check if the date has changed
                if (item.timestamp.date !== lastDate) {
                    const dateDiv = document.createElement('div');
                    dateDiv.className = 'date-divider';
                    dateDiv.textContent = item.timestamp.date;
                    messageContainer.appendChild(dateDiv);
                    lastDate = item.timestamp.date;
                }
                appendMessage(item);
            });
            
        showScreen('chat');
        // Check if the next event is a choice for this chat
        const nextEvent = storyData.script.find(item => item.id === currentStoryPoint + 1);
        if (nextEvent && nextEvent.chatId === chatId && nextEvent.type === 'playerChoice') {
            renderChoices(nextEvent);
        }
    }
    
    function appendMessage(messageData) {
        const isSent = messageData.author === 'Alana';
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');

        // Conditionally add the author's name for received messages
        const authorHTML = !isSent ? `<strong class="author">${messageData.author}</strong>` : '';

        messageDiv.innerHTML = `
            ${authorHTML}
            <p class="text">${messageData.text}</p>
            <small class="timestamp">${messageData.timestamp.time}</small>
        `;

        messageContainer.appendChild(messageDiv);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    function progressStory(nextId) {
        // If we've reached the end of the script
        if (nextId > storyData.script.length) {
            renderChatList();
            showScreen('chatList');
            return;
        }

        currentStoryPoint = nextId -1;
        const currentEvent = storyData.script.find(item => item.id === nextId);

        // This allows the game to start without auto-playing messages
        if (currentStoryPoint === 0) {
            renderChatList();
            showScreen('chatList');
            return;
        }

        // If it's a message, just update the state and redisplay the chat list
        if (currentEvent.type === 'message') {
            // "Unlock" this message and move to the next event automatically
            setTimeout(() => progressStory(nextId + 1), 500); // Short delay
        } else if (currentEvent.type === 'playerChoice') {
            // If we hit a choice point, stop and update the UI
            renderChatList();
        }
    }

    function renderChoices(choiceData) {
        choicesContainer.innerHTML = '';
        choiceData.choices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                choicesContainer.innerHTML = '';
                // Create the player's response message from the choice
                const playerMessage = {
                    id: currentStoryPoint + 1,
                    type: 'message',
                    chatId: choiceData.chatId,
                    author: 'Alana',
                    text: choice.text,
                    timestamp: { date: "9 May 2072", time: "08:30" } // This should be dynamic in a real game
                };
                
                // This is a temporary way to handle the choice message.
                // A better system would merge the choice into the script.
                appendMessage(playerMessage);

                progressStory(choice.nextId);
            });
            choicesContainer.appendChild(button);
        });
    }

    // --- Event Listeners ---
    playButton.addEventListener('click', startGame);
    backButton.addEventListener('click', () => {
        renderChatList(); // Refresh the chat list with latest messages
        showScreen('chatList');
    });

    // Initial call
    showScreen('start');
});