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
    let currentChatId = null; // Track current active chat
    
    // --- SAVE/LOAD SYSTEM ---
    const SAVE_KEY = 'luna-archive-save-data';
    const TUTORIAL_KEY = 'luna-archive-tutorial-completed';
    
    // --- TUTORIAL SYSTEM ---
    let tutorialActive = false;
    let currentTutorialStep = 0;
    
    const saveGameState = () => {
        try {
            // Calculate current progress for save file
            const totalEvents = storyData.script ? storyData.script.length : 0;
            const unlockedEvents = unlockedMessageIds.size;
            const progressPercentage = totalEvents > 0 ? Math.round((unlockedEvents / totalEvents) * 100) : 0;
            
            const saveData = {
                unlockedMessageIds: Array.from(unlockedMessageIds),
                viewedChatIds: Array.from(viewedChatIds),
                currentChatId: currentChatId,
                timestamp: Date.now(),
                progress: progressPercentage,
                version: '1.0'
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            console.log(`Game state saved successfully - ${progressPercentage}% complete`);
        } catch (error) {
            console.warn('Failed to save game state:', error);
        }
    };
    
    const loadGameState = () => {
        try {
            const savedData = localStorage.getItem(SAVE_KEY);
            if (!savedData) {
                console.log('No saved game state found');
                return false;
            }
            
            const saveData = JSON.parse(savedData);
            
            // Validate save data structure
            if (!saveData.unlockedMessageIds || !Array.isArray(saveData.unlockedMessageIds)) {
                console.warn('Invalid save data format');
                return false;
            }
            
            // Restore state
            unlockedMessageIds = new Set(saveData.unlockedMessageIds);
            viewedChatIds = new Set(saveData.viewedChatIds || []);
            currentChatId = saveData.currentChatId || null;
            
            console.log('Game state loaded successfully');
            console.log(`Loaded ${unlockedMessageIds.size} unlocked messages`);
            console.log(`Loaded ${viewedChatIds.size} viewed chats`);
            
            return true;
        } catch (error) {
            console.warn('Failed to load game state:', error);
            return false;
        }
    };
    
    const resetGameState = () => {
        try {
            localStorage.removeItem(SAVE_KEY);
            unlockedMessageIds.clear();
            viewedChatIds.clear();
            currentChatId = null;
            console.log('Game state reset successfully');
        } catch (error) {
            console.warn('Failed to reset game state:', error);
        }
    };
    
    const hasExistingSave = () => {
        return localStorage.getItem(SAVE_KEY) !== null;
    };
    
    const showSaveNotification = (message) => {
        // Remove any existing notification
        const existingNotification = document.querySelector('.save-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Show and hide with animation
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    };
    
    const confirmNewGame = () => {
        if (hasExistingSave()) {
            return confirm('Are you sure you want to start a new game? This will delete your current progress.');
        }
        return true;
    };
    
    // --- TUTORIAL FUNCTIONS ---
    const hasCompletedTutorial = () => {
        return localStorage.getItem(TUTORIAL_KEY) === 'true';
    };
    
    const blockAllInteractions = () => {
        // Disable all interactive elements except tutorial
        const interactiveElements = document.querySelectorAll('button:not(.tutorial-btn), a, input, select, textarea, [tabindex]:not(.tutorial-modal *, .tutorial-message *)');
        interactiveElements.forEach(element => {
            element.setAttribute('data-tutorial-disabled', 'true');
            element.style.pointerEvents = 'none';
            element.setAttribute('tabindex', '-1');
        });
        
        // Disable scroll on background
        document.body.style.overflow = 'hidden';
        
        // Add global event blocker
        document.addEventListener('keydown', tutorialKeyHandler, true);
        document.addEventListener('click', tutorialClickHandler, true);
    };
    
    const unblockAllInteractions = () => {
        // Re-enable all interactive elements
        const disabledElements = document.querySelectorAll('[data-tutorial-disabled="true"]');
        disabledElements.forEach(element => {
            element.removeAttribute('data-tutorial-disabled');
            element.style.pointerEvents = '';
            element.removeAttribute('tabindex');
        });
        
        // Re-enable scroll
        document.body.style.overflow = '';
        
        // Remove global event blockers
        document.removeEventListener('keydown', tutorialKeyHandler, true);
        document.removeEventListener('click', tutorialClickHandler, true);
    };
    
    const tutorialKeyHandler = (e) => {
        // Only allow tutorial-related interactions
        if (!e.target.closest('.tutorial-modal, .tutorial-message')) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    const tutorialClickHandler = (e) => {
        // Only allow clicks on tutorial elements - NO game elements during tutorial
        const allowedSelectors = '.tutorial-modal, .tutorial-message, .tutorial-btn';
        if (!e.target.closest(allowedSelectors) || e.target.hasAttribute('data-tutorial-disabled')) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    const markTutorialCompleted = () => {
        localStorage.setItem(TUTORIAL_KEY, 'true');
        tutorialActive = false;
        currentTutorialStep = 0;
        
        // Remove any tutorial elements
        const tutorialOverlay = document.getElementById('tutorial-overlay');
        if (tutorialOverlay) {
            tutorialOverlay.remove();
        }
        
        const tutorialSpotlight = document.getElementById('tutorial-spotlight-container');
        if (tutorialSpotlight) {
            tutorialSpotlight.remove();
        }
        
        // Ensure all interactions are unblocked
        unblockAllInteractions();
    };
    
    const createTutorialModal = (title, content, buttonText = 'Got it!', onNext = null) => {
        // Remove existing modal if any
        const existingModal = document.getElementById('tutorial-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Block all other interactions
        blockAllInteractions();
        
        // Find the phone screen container for proper positioning
        const phoneScreen = document.querySelector('.screen.active') || document.body;
        const phoneRect = phoneScreen.getBoundingClientRect();
        
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-overlay';
        
        // Position overlay to match phone screen boundaries
        overlay.style.cssText = `
            position: fixed;
            top: ${phoneRect.top}px;
            left: ${phoneRect.left}px;
            width: ${phoneRect.width}px;
            height: ${phoneRect.height}px;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10002;
            border-radius: 20px;
            overflow: hidden;
            pointer-events: auto;
        `;
        
        const modal = document.createElement('div');
        modal.className = 'tutorial-modal';
        modal.innerHTML = `
            <div class="tutorial-content">
                <h3>${title}</h3>
                <p>${content}</p>
                <button class="tutorial-btn">${buttonText}</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Prevent clicks outside modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Add click handler
        const button = modal.querySelector('.tutorial-btn');
        button.addEventListener('click', () => {
            overlay.remove();
            unblockAllInteractions();
            if (onNext) {
                onNext();
            }
        });
        
        // Focus the button for keyboard accessibility
        setTimeout(() => button.focus(), 100);
        
        return overlay;
    };
    
    const highlightElement = (selector, message, buttonText = 'Continue', onNext = null) => {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn('Tutorial: Element not found:', selector);
            return;
        }
        
        // Remove any existing tutorial modals first
        const existingModal = document.getElementById('tutorial-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Also remove any existing spotlight containers
        const existingSpotlight = document.getElementById('tutorial-spotlight-container');
        if (existingSpotlight) {
            existingSpotlight.remove();
        }
        
        // Wait for next frame to ensure element is fully rendered
        requestAnimationFrame(() => {
            // Wait one more frame to be extra sure
            requestAnimationFrame(() => {
                createSpotlight(element, message, buttonText, onNext);
            });
        });
    };
    
    const createSpotlight = (element, message, buttonText, onNext) => {
        // Block all interactions except for the highlighted element
        blockAllInteractions();
        
        // Force a reflow to ensure accurate measurements
        element.offsetHeight;
        
        // Get fresh measurements
        const elementRect = element.getBoundingClientRect();
        
        // Find the phone screen container
        const phoneScreen = document.querySelector('.screen.active') || document.body;
        const phoneRect = phoneScreen.getBoundingClientRect();
        
        // Add some padding around the element
        const padding = 8;
        const spotlightTop = elementRect.top - padding;
        const spotlightLeft = elementRect.left - padding;
        const spotlightWidth = elementRect.width + (padding * 2);
        const spotlightHeight = elementRect.height + (padding * 2);
        
        // Calculate relative positions within the phone screen
        const relativeTop = spotlightTop - phoneRect.top;
        const relativeLeft = spotlightLeft - phoneRect.left;
        
        // Create a single overlay container
        const overlayContainer = document.createElement('div');
        overlayContainer.className = 'tutorial-spotlight-container';
        overlayContainer.id = 'tutorial-spotlight-container';
        
        // Create the SVG mask for precise cutout, constrained to phone screen
        const svgMask = `
            <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white"/>
                        <rect x="${relativeLeft}" y="${relativeTop}" 
                              width="${spotlightWidth}" height="${spotlightHeight}" 
                              rx="12" ry="12" fill="black"/>
                    </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.95)" mask="url(#spotlight-mask)"/>
            </svg>
        `;
        
        overlayContainer.style.cssText = `
            position: fixed;
            top: ${phoneRect.top}px;
            left: ${phoneRect.left}px;
            width: ${phoneRect.width}px;
            height: ${phoneRect.height}px;
            z-index: 9998;
            pointer-events: none;
            border-radius: 20px;
            overflow: hidden;
            background: transparent;
        `;
        
        overlayContainer.innerHTML = svgMask;
        
        // Add highlight border around the element
        const highlightBorder = document.createElement('div');
        highlightBorder.className = 'tutorial-highlight-border';
        highlightBorder.style.cssText = `
            position: fixed;
            top: ${spotlightTop}px;
            left: ${spotlightLeft}px;
            width: ${spotlightWidth}px;
            height: ${spotlightHeight}px;
            border: 3px solid rgba(255, 255, 255, 0.5);
            border-radius: 12px;
            z-index: 9999;
            pointer-events: none;
            animation: tutorial-pulse-border 2s infinite;
        `;
        
        // Create tutorial message
        const messageBox = document.createElement('div');
        messageBox.className = 'tutorial-message';
        messageBox.innerHTML = `
            <div class="tutorial-message-content">
                <p>${message}</p>
                <button class="tutorial-btn">${buttonText}</button>
            </div>
        `;
        
        // Position message box above the element by default
        const messageHeight = 140; // Estimated height of message box
        const messageWidth = 280;
        const spacing = 40; // Increased spacing from element
        
        // Try to position above first, fall back to below if not enough space
        let messageTop;
        if (elementRect.top - messageHeight - spacing > phoneRect.top + 20) {
            // Position well above the element
            messageTop = elementRect.top - messageHeight - spacing;
        } else {
            // If not enough space above, try positioning in the middle of available space
            const availableSpaceAbove = elementRect.top - phoneRect.top - 40;
            if (availableSpaceAbove > messageHeight) {
                messageTop = phoneRect.top + 20;
            } else {
                // Last resort: position below the element
                messageTop = Math.min(
                    elementRect.bottom + spacing,
                    phoneRect.bottom - messageHeight - 20
                );
            }
        }
        
        // Center horizontally relative to element, but constrain to phone screen
        const elementCenter = elementRect.left + (elementRect.width / 2);
        const messageLeft = Math.max(
            phoneRect.left + 20, 
            Math.min(elementCenter - (messageWidth / 2), phoneRect.right - messageWidth - 20)
        );
        
        messageBox.style.cssText = `
            position: fixed;
            top: ${messageTop}px;
            left: ${messageLeft}px;
            max-width: ${messageWidth}px;
            z-index: 10000;
        `;
        
        // Make the highlighted element visible but NOT clickable during tutorial
        element.style.position = 'relative';
        element.style.zIndex = '10001';
        element.style.pointerEvents = 'none'; // Disabled during tutorial
        element.setAttribute('data-tutorial-highlighted', 'true');
        
        // Add elements to DOM
        document.body.appendChild(overlayContainer);
        document.body.appendChild(highlightBorder);
        document.body.appendChild(messageBox);
        
        // Handle button click
        const button = messageBox.querySelector('.tutorial-btn');
        button.addEventListener('click', () => {
            // Clean up
            overlayContainer.remove();
            highlightBorder.remove();
            messageBox.remove();
            
            // Restore element styles
            element.style.position = '';
            element.style.zIndex = '';
            element.style.pointerEvents = '';
            element.removeAttribute('data-tutorial-highlighted');
            
            // Unblock interactions
            unblockAllInteractions();
            
            if (onNext) {
                onNext();
            }
        });
        
        return { overlayContainer, highlightBorder, messageBox };
    };
    
    const startTutorial = () => {
        if (hasCompletedTutorial()) {
            return false;
        }
        
        tutorialActive = true;
        currentTutorialStep = 0;
        
        // Show initial tutorial modal
        createTutorialModal(
            'Welcome to Luna Archives!',
            'This is an interactive story told through chat messages. Let me show you how to navigate and progress through the narrative.',
            'Start Tutorial',
            () => tutorialStep1()
        );
        
        return true;
    };
    
    const tutorialStep1 = () => {
        currentTutorialStep = 1;
        
        // Remove any existing tutorial modals first
        const existingModal = document.getElementById('tutorial-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Ensure we're on the chat list screen
        if (!screens.chatList.classList.contains('active')) {
            showScreen('chatList');
        }
        
        // Wait a moment for the screen to render
        setTimeout(() => {
            const firstChatItem = document.querySelector('.chat-item');
            if (firstChatItem) {
                // Temporarily unblock interactions to allow chat item clicks
                unblockAllInteractions();
                
                highlightElement(
                    '.chat-item',
                    'This is a chat item. When you\'re ready to start reading the story, you\'ll click on chat items like this one.',
                    'Got it!',
                    () => {
                        // When they click "Got it!", remove spotlight but keep watching for chat click
                        const tutorialElements = document.querySelectorAll('.tutorial-spotlight-container, .tutorial-highlight-border, .tutorial-message');
                        tutorialElements.forEach(el => el.remove());
                        
                        // Continue watching for chat clicks in the background
                        // Tutorial will advance when they click the chat item
                    }
                );
                
                // Add special click handler that allows chat item interaction
                const chatClickHandler = (e) => {
                    if (e.target.closest('.chat-item')) {
                        // Remove tutorial elements
                        const tutorialElements = document.querySelectorAll('.tutorial-spotlight-container, .tutorial-highlight-border, .tutorial-message');
                        tutorialElements.forEach(el => el.remove());
                        
                        // Let the normal chat click happen
                        // The tutorial will continue when the chat opens
                        tutorialWaitForChatOpen();
                    }
                };
                
                // Override the tutorial click blocker temporarily
                document.removeEventListener('click', tutorialClickHandler, true);
                document.addEventListener('click', chatClickHandler, true);
                
                // Store the handler so we can clean it up later
                window.tempChatHandler = chatClickHandler;
            } else {
                console.warn('Tutorial: No chat items found');
                tutorialStep2(); // Skip to step 2
            }
        }, 500);
    };
    
    
    const tutorialWaitForChatOpen = () => {
        // Clean up the temporary chat click handler
        if (window.tempChatHandler) {
            document.removeEventListener('click', window.tempChatHandler, true);
            window.tempChatHandler = null;
        }
        
        // Set up a listener for when the chat screen becomes active
        const checkForChatScreen = () => {
            if (screens.chat.classList.contains('active')) {
                let tutorialTriggered = false;
                let startTime = Date.now();
                
                // Check every 100ms if continue button is clicked or 6 seconds have passed
                const monitorChatScreen = () => {
                    // Check if tutorial was completed (user clicked continue button)
                    if (hasCompletedTutorial()) {
                        // Tutorial completed, don't show tutorial message
                        return;
                    }
                    
                    // Check if continue button exists and was clicked
                    const continueButton = document.querySelector('.continue-btn');
                    if (continueButton) {
                        // Continue button appeared, user can interact with it
                        // Check if they click it
                        const continueClickHandler = () => {
                            // User clicked continue, complete tutorial
                            markTutorialCompleted();
                            continueButton.removeEventListener('click', continueClickHandler);
                        };
                        continueButton.addEventListener('click', continueClickHandler);
                        
                        // Start 6-second timer once continue button appears
                        setTimeout(() => {
                            // Only show tutorial if user hasn't completed it yet
                            if (!hasCompletedTutorial() && !tutorialTriggered) {
                                tutorialTriggered = true;
                                tutorialStep2();
                            }
                        }, 6000);
                        
                        return; // Stop monitoring
                    } else {
                        // Continue button not yet available, keep checking
                        setTimeout(monitorChatScreen, 100);
                    }
                };
                
                monitorChatScreen();
            } else {
                // Keep checking for chat screen to become active
                setTimeout(checkForChatScreen, 100);
            }
        };
        checkForChatScreen();
    };
    
    const tutorialStep2 = () => {
        currentTutorialStep = 2;
        
        // Wait for continue button to appear
        const waitForContinueButton = () => {
            const continueButton = document.querySelector('.continue-btn');
            if (continueButton) {
                highlightElement(
                    '.continue-button-container',
                    'When you see this "Continue" button, click it to progress the story and unlock new messages. The story unfolds one message at a time.',
                    'Complete Tutorial',
                    () => {
                        markTutorialCompleted();
                    }
                );
            } else {
                // Check again in a bit
                setTimeout(waitForContinueButton, 500);
            }
        };
        
        waitForContinueButton();
    };

    // --- CORE FUNCTIONS ---

    const showScreen = (screenName) => {
        for (let key in screens) {
            screens[key].classList.remove('active');
        }
        screens[screenName].classList.add('active');
    };

    const findEventById = (id) => storyData.script.find(event => event.id === id);

    const findNextStoryLocation = () => {
        // Find the chat that contains the next available story content
        
        // First priority: Any chat with unlocked messages that hasn't been viewed yet
        for (const chat of storyData.chats) {
            const unlockedMessagesInChat = storyData.script.filter(item => 
                item.chatId === chat.id && 
                unlockedMessageIds.has(item.id)
            );
            
            if (unlockedMessagesInChat.length > 0 && !viewedChatIds.has(chat.id)) {
                return chat.id;
            }
        }
        
        // Second priority: Find the chat containing the most recent unlocked content
        // This helps when all chats have been viewed but there's still content to continue
        if (unlockedMessageIds.size > 0) {
            const allUnlockedIds = Array.from(unlockedMessageIds).sort((a, b) => b - a);
            const maxUnlockedId = allUnlockedIds[0];
            
            // Find which chat contains this latest message
            const latestEvent = findEventById(maxUnlockedId);
            if (latestEvent) {
                // Check if there's more content to unlock in this chat or if it's the active continuation point
                const nextEvent = findEventById(maxUnlockedId + 1);
                if (nextEvent && nextEvent.chatId === latestEvent.chatId) {
                    // There's more content coming in this same chat
                    return latestEvent.chatId;
                }
                
                // If next content is in a different chat, highlight that chat
                if (nextEvent) {
                    return nextEvent.chatId;
                }
                
                // If no next content, highlight the chat with the latest content
                return latestEvent.chatId;
            }
        }
        
        // Fallback: If no specific location found but there are unlocked messages,
        // highlight the first chat with content
        for (const chat of storyData.chats) {
            const messagesInChat = storyData.script.filter(item => 
                item.chatId === chat.id && 
                unlockedMessageIds.has(item.id)
            );
            
            if (messagesInChat.length > 0) {
                return chat.id;
            }
        }
        
        return null;
    };

    const hasUnreadMessages = (chatId) => {
        // Always show unread indicator for the chat containing the next story location
        const nextStoryLocation = findNextStoryLocation();
        return nextStoryLocation === chatId;
    };

    const scrollToBottom = () => {
        if (messageContainer) {
            // Force scroll to bottom
            messageContainer.scrollTop = messageContainer.scrollHeight;
            
            // Double-check with a small delay to handle any layout changes
            setTimeout(() => {
                messageContainer.scrollTop = messageContainer.scrollHeight;
            }, 10);
        }
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
        
        // Save initial state
        saveGameState();
        
        // Update restart button visibility after initializing
        updateRestartButtonVisibility();
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
        
        // Auto-save progress after story events
        saveGameState();
        
        // Update restart button visibility after progress
        updateRestartButtonVisibility();
    };

    // --- START GAME & RENDERING ---

    const startGame = async () => {
        const response = await fetch('luna-archive-linear-script.json');
        storyData = await response.json();
        
        // Check if there's a saved game to load
        if (hasExistingSave() && loadGameState()) {
            // Restore from save
            renderChatList();
            updateStoryProgress();
            
            // If there was an active chat, restore it
            if (currentChatId) {
                showScreen('chat');
                openChat(currentChatId, true);
            } else {
                showScreen('chatList');
            }
            
            // Update restart button after loading
            updateRestartButtonVisibility();
            
            console.log('Game restored from save');
        } else {
            // Start new game
            initializeStory();
            
            // Check if tutorial should be offered to first-time players
            if (!hasCompletedTutorial()) {
                // Show tutorial offer modal
                setTimeout(() => {
                    createTutorialModal(
                        'First time playing?',
                        'Would you like a quick tutorial to learn how to navigate the story?',
                        'Yes, show me',
                        () => startTutorial()
                    );
                    
                    // Add a "Skip" option
                    const modal = document.querySelector('.tutorial-modal');
                    if (modal) {
                        const skipButton = document.createElement('button');
                        skipButton.className = 'tutorial-btn tutorial-skip-btn';
                        skipButton.textContent = 'Skip tutorial';
                        skipButton.addEventListener('click', () => {
                            markTutorialCompleted();
                            document.getElementById('tutorial-overlay').remove();
                        });
                        
                        const content = modal.querySelector('.tutorial-content');
                        content.appendChild(skipButton);
                    }
                }, 1000); // Small delay to let the game screen load
            }
        }
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
            
            // Count unread messages - if this chat has new messages, count unviewed unlocked messages
            let unreadCount = 0;
            if (hasNewMessages) {
                if (!viewedChatIds.has(chat.id)) {
                    // If chat hasn't been viewed, count all unlocked messages
                    unreadCount = allMessagesForChat.length;
                } else {
                    // If chat has been viewed, count new messages since last view
                    // For simplicity, show 1 to indicate there's new content to continue
                    unreadCount = 1;
                }
            }
            
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
                    <p class="chat-item-message">${lastMessage ? (lastMessage.type === 'message' ? `${lastMessage.author.split(':')[0]}: ${lastMessage.text}` : 'Choose a response...') : 'No messages yet'}</p>
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
        
        // Mark this chat as viewed and set as current
        viewedChatIds.add(chatId);
        currentChatId = chatId;
        
        // Show the complete chat history for this chat
        showCompleteChatHistory(chatId);
        
        showScreen('chat');
        
        // Ensure we scroll to bottom after screen transition
        setTimeout(() => {
            scrollToBottom();
        }, 50);
        
        // Save state when opening a chat
        saveGameState();
        
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
        
        // Scroll to bottom with multiple timing strategies for reliability
        scrollToBottom();
        requestAnimationFrame(() => {
            scrollToBottom();
        });
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
    
    // Restart button on start screen
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            if (hasExistingSave()) {
                if (confirm('Are you sure you want to restart? This will delete all your progress and start the story from the beginning.')) {
                    resetGameState();
                    updateRestartButtonVisibility(); // Hide restart button after reset
                    showSaveNotification('Progress reset! Starting new game...');
                    // Small delay to let user see the notification before starting
                    setTimeout(() => {
                        startGame();
                    }, 1000);
                }
            } else {
                // No save exists, just start the game
                startGame();
            }
        });
    }
    backButton.addEventListener('click', () => {
        currentChatId = null;
        renderChatList();
        showScreen('chatList');
        saveGameState();
    });
    
    // Home back button (from chat list to start screen)
    const homeBackButton = document.getElementById('home-back-button');
    if (homeBackButton) {
        homeBackButton.addEventListener('click', () => {
            showScreen('start');
            updateRestartButtonVisibility(); // Update restart button visibility when returning to start
        });
    }
    
    // Save/Load controls
    const newGameButton = document.getElementById('new-game-btn');
    const manualSaveButton = document.getElementById('manual-save-btn');
    
    if (newGameButton) {
        newGameButton.addEventListener('click', () => {
            if (confirmNewGame()) {
                resetGameState();
                updateRestartButtonVisibility(); // Hide restart button after reset
                // Restart the game
                fetch('luna-archive-linear-script.json')
                    .then(response => response.json())
                    .then(data => {
                        storyData = data;
                        initializeStory();
                        showSaveNotification('New game started!');
                    })
                    .catch(error => {
                        console.error('Failed to restart game:', error);
                        showSaveNotification('Error starting new game');
                    });
            }
        });
    }
    
    if (manualSaveButton) {
        manualSaveButton.addEventListener('click', () => {
            saveGameState();
            renderChatList(); // Refresh unread indicators after manual save
            showSaveNotification('Progress saved!');
        });
    }
    
    // --- INITIAL CALL ---
    showScreen('start');
    
    // Show/hide restart button based on save data or current progress
    const updateRestartButtonVisibility = () => {
        const restartButton = document.getElementById('restart-button');
        if (restartButton) {
            // Show restart button if there's saved data OR current progress (any unlocked messages)
            // We check for > 0 because even starting the game unlocks the first message
            const hasProgress = hasExistingSave() || unlockedMessageIds.size > 0;
            if (hasProgress) {
                restartButton.style.display = 'flex';
            } else {
                restartButton.style.display = 'none';
            }
        }
    };
    
    // Check initial state
    updateRestartButtonVisibility();
});