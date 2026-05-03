/**
 * DentAssist AI — Chat History Proxy
 * Fetches previous conversation bubbles from the N8N Database.
 */

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    const n8nHistoryUrl = process.env.N8N_HISTORY_WEBHOOK_URL;
    
    if (!n8nHistoryUrl) {
      console.warn("N8N_HISTORY_WEBHOOK_URL not set. Returning empty history.");
      return res.status(200).json({ history: [] });
    }

    // Ping N8N to fetch history for this session
    const n8nResponse = await fetch(`${n8nHistoryUrl}?sessionId=${encodeURIComponent(sessionId)}`);

    if (!n8nResponse.ok) {
      throw new Error(`N8N Webhook returned HTTP ${n8nResponse.status}`);
    }

    const data = await n8nResponse.json();
    
    return res.status(200).json(data);

  } catch (error) {
    console.error("Chat History Proxy Error:", error.message);
    return res.status(500).json({ history: [] });
  }
};
