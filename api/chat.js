/**
 * DentAssist AI — Web Chat Proxy
 * 
 * This file no longer holds the LLM logic. It has been decoupled.
 * It simply acts as a secure proxy to forward chat messages from the 
 * web widget to our centralized N8N Master Agent.
 */

module.exports = async function handler(req, res) {
  // 1. Handle CORS for the web widget
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 2. Extract payload from widget
  const { message, sessionId } = req.body;
  if (!message || !sessionId) {
    return res.status(400).json({ error: "message and sessionId are required" });
  }

  try {
    // 3. Forward to the N8N Master Agent
    const n8nUrl = process.env.N8N_CHAT_WEBHOOK_URL;
    
    if (!n8nUrl) {
      console.error("CRITICAL ERROR: N8N_CHAT_WEBHOOK_URL is not set in environment variables.");
      // Graceful fallback for the demo if config is missing
      return res.status(200).json({ 
        response: "Hi there! Our AI system is currently being upgraded to our new Master Agent architecture. Please check back in a few minutes, or call us at (208) 555-0123." 
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for LLM

    const n8nResponse = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        sessionId: sessionId, 
        message: message, 
        channel: "web_chat" 
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!n8nResponse.ok) {
      throw new Error(`N8N Webhook returned HTTP ${n8nResponse.status}`);
    }

    const data = await n8nResponse.json();
    
    // N8N's AI Agent node returns the text in the "output" property by default. 
    // However, since the user added a Google Sheets node before the Response node, 
    // it returns the Google Sheets JSON (e.g., {"AI Response": "..."}).
    // We check all possible variations to be flexible.
    const textResponse = data["AI Response"] || data.response || data.output || data.text || data.message || "I apologize, I didn't receive a proper response. Could you try again?";

    // 4. Send response back to the widget
    return res.status(200).json({ response: textResponse });

  } catch (error) {
    console.error("Chat Proxy Error:", error.message);
    
    // Friendly fallback if N8N is sleeping or timeouts
    return res.status(500).json({
      response: "I apologize, I'm having a brief connection issue on my end! Please give us a call directly at (208) 555-0123 and we'll be happy to help you."
    });
  }
};
