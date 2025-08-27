// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // Get all the screen elements
    const screens = {
        start: document.getElementById('start-screen'),
        chatList: document.getElementById('chat-list-screen'),
        chat: document.getElementById('chat-screen'),
    };

    const playButton = document.getElementById('play-button');
    const chatListContainer = document.getElementById('chat-list-container');
    const messageContainer = document.getElementById('message-container');
    const choicesContainer = document.getElementById('choices-container');
    const chatTitle = document.getElementById('chat-title');

    let storyData = {};
    let currentStoryPoint = 1; // Start at the first script item

    // --- Core Functions ---

    // Function to switch between screens
    function showScreen(screenName) {
        // Hide all screens
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        // Show the requested screen
        screens[screenName].classList.add('active');
    }

    // Function to start the game
    async function startGame() {
        // Fetch the story data from the JSON file
        const response = await fetch('story.json');
        storyData = await response.json();
        
        renderChatList();
        showScreen('chatList');
    }

    // Function to render the list of available chats
    function renderChatList() {
        chatListContainer.innerHTML = ''; // Clear previous list
        storyData.chats.forEach(chat => {
            const li = document.createElement('li');
            li.className = 'chat-item'; // Add a class for styling
            li.innerHTML = `
                <h3>${chat.name}</h3>
                <p>${chat.lastMessage}</p>
                <span>${chat.lastTime}</span>
            `;
            li.addEventListener('click', () => openChat(chat.id));
            chatListContainer.appendChild(li);
        });
    }
    
    // Function to open a specific chat and render its messages
    function openChat(chatId) {
        const chat = storyData.chats.find(c => c.id === chatId);
        chatTitle.textContent = chat.name;
        messageContainer.innerHTML = ''; // Clear old messages
        
        // Find all messages for this chat up to the current point
        storyData.script
            .filter(item => item.chatId === chatId && item.id <= currentStoryPoint && item.type === 'message')
            .forEach(item => appendMessage(item));
            
        showScreen('chat');
        // Check if the next event is a choice for this chat
        progressStory(currentStoryPoint + 1);
    }
    
    // Function to add a single message to the screen
    function appendMessage(messageData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (messageData.author === 'Alana' ? 'sent' : 'received');
        messageDiv.textContent = messageData.text;
        messageContainer.appendChild(messageDiv);
        messageContainer.scrollTop = messageContainer.scrollHeight; // Auto-scroll
    }
    
    // The main game loop function
    function progressStory(nextId) {
        currentStoryPoint = nextId;
        const currentEvent = storyData.script.find(item => item.id === currentStoryPoint);

        if (!currentEvent) return; // End of story

        if (currentEvent.type === 'message') {
            // If it's a message, show it and move to the next event
            appendMessage(currentEvent);
            setTimeout(() => progressStory(currentStoryPoint + 1), 1000); // Wait 1 sec
        } else if (currentEvent.type === 'playerChoice') {
            // If it's a choice, show the options
            renderChoices(currentEvent);
        }
    }

    // Function to render player choices as buttons
    function renderChoices(choiceData) {
        choicesContainer.innerHTML = ''; // Clear old choices
        choiceData.choices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                // When a choice is made, progress the story to the corresponding ID
                choicesContainer.innerHTML = ''; // Clear choices
                progressStory(choice.nextId);
            });
            choicesContainer.appendChild(button);
        });
    }

    // --- Event Listeners ---
    playButton.addEventListener('click', startGame);

    // Initial call to show the start screen
    showScreen('start');
});