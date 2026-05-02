/**
 * DentAssist AI — Chat Widget
 * Connects to /api/chat (Gemini-powered dental receptionist)
 */

(function () {
  const API_URL = "/api/chat";
  const sessionId =
    "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);

  // DOM elements
  const toggle = document.getElementById("chatToggle");
  const chatWindow = document.getElementById("chatWindow");
  const chatClose = document.getElementById("chatClose");
  const messagesContainer = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");

  let isOpen = false;
  let isWaiting = false;

  // Toggle chat open/close
  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.classList.toggle("open", isOpen);
    toggle.classList.toggle("open", isOpen);
    if (isOpen) {
      chatInput.focus();
    }
  }

  toggle.addEventListener("click", toggleChat);
  chatClose.addEventListener("click", toggleChat);

  // Send message
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isWaiting) return;

    // Add user message to UI
    appendMessage(text, "user");
    chatInput.value = "";
    isWaiting = true;
    chatSend.disabled = true;

    // Show typing indicator
    const typingEl = showTyping();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      const data = await response.json();

      // Remove typing indicator
      removeTyping(typingEl);

      // Add AI response
      appendMessage(data.response, "ai");
    } catch (error) {
      removeTyping(typingEl);
      appendMessage(
        "I'm sorry, I'm having a brief connection issue. Please try again, or call us at (208) 555-0123!",
        "ai"
      );
    }

    isWaiting = false;
    chatSend.disabled = false;
    chatInput.focus();
  }

  chatSend.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Append a message bubble
  function appendMessage(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message message-${sender}`;

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";
    bubbleDiv.textContent = text;

    msgDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(msgDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show typing indicator
  function showTyping() {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message message-ai";

    const typingDiv = document.createElement("div");
    typingDiv.className = "typing-indicator";
    typingDiv.innerHTML = "<span></span><span></span><span></span>";

    msgDiv.appendChild(typingDiv);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return msgDiv;
  }

  // Remove typing indicator
  function removeTyping(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // Auto-open chat after 5 seconds on demo section
  let hasAutoOpened = false;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAutoOpened && !isOpen) {
          hasAutoOpened = true;
          setTimeout(() => {
            if (!isOpen) toggleChat();
          }, 1000);
        }
      });
    },
    { threshold: 0.3 }
  );

  const demoSection = document.getElementById("demo");
  if (demoSection) {
    observer.observe(demoSection);
  }
})();
