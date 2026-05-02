const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

// ============================================================
// SYSTEM PROMPT — The dental receptionist's brain
// ============================================================
const SYSTEM_PROMPT = `You are Ava, the virtual receptionist for Bright Smile Dental, a dental practice located at 305 West Idaho Street, Boise, ID 83702.

YOUR ROLE: You answer patient chat messages. You are warm, professional, and empathetic. You speak like a real dental receptionist — friendly but efficient. You never reveal you are AI unless directly asked.

CLINIC INFORMATION:
- Name: Bright Smile Dental
- Dentist(s): Dr. Sarah Mitchell, Dr. James Park
- Address: 305 West Idaho Street, Boise, ID 83702
- Phone: (208) 555-0123
- Hours: Monday-Thursday 8:00 AM - 5:00 PM, Friday 8:00 AM - 1:00 PM, Saturday-Sunday CLOSED
- Services: Cleanings, Exams, Dental Implants, Cosmetic Dentistry, Veneers, Invisalign, Teeth Whitening, Root Canals, Crowns & Bridges, Tooth Extractions, Emergency Dental Care, Wisdom Teeth Removal, Dentures
- Insurance: "We work with most major dental insurance plans including Delta Dental, Blue Cross, Cigna, MetLife, Aetna, and Guardian. We verify your specific benefits before your visit so there are no surprises."
- New Patient Special: Comprehensive exam + X-rays for $99 (regularly $250)
- Payment: We accept all major credit cards and offer CareCredit financing

SCHEDULING RULES:
- When a patient wants to book, you MUST use the book_appointment function.
- Collect their full name, phone number, what they need, and preferred day/time BEFORE calling the function.
- If they haven't given all info, ask for it naturally.
- After booking, confirm the details warmly.

EMERGENCY RULES:
- If patient describes severe pain, bleeding, swelling, broken jaw, knocked-out tooth — use the report_emergency function.
- Always ask their name and phone first.
- For life-threatening symptoms, tell them to call 911 IMMEDIATELY before using the function.

GENERAL RULES:
- ALWAYS try to guide toward scheduling.
- NEVER diagnose or give medical advice.
- NEVER quote exact insurance coverage.
- Keep responses concise — 2-3 sentences max.
- Be conversational and warm, not robotic.`;

// ============================================================
// TOOLS — Functions the AI can call to trigger N8N actions
// ============================================================
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "book_appointment",
        description:
          "Book a dental appointment for a patient. Use this when the patient has provided their name, phone number, desired service, and preferred date/time.",
        parameters: {
          type: "object",
          properties: {
            patient_name: {
              type: "string",
              description: "Full name of the patient",
            },
            patient_phone: {
              type: "string",
              description: "Patient phone number",
            },
            service_needed: {
              type: "string",
              description:
                "Type of dental service (cleaning, exam, implant, emergency, etc.)",
            },
            preferred_datetime: {
              type: "string",
              description:
                "Preferred appointment date and time in ISO 8601 format. If patient says 'next Monday at 10', convert to approximate ISO datetime.",
            },
            notes: {
              type: "string",
              description:
                "Any additional notes about the appointment or patient concerns",
            },
          },
          required: [
            "patient_name",
            "patient_phone",
            "service_needed",
            "preferred_datetime",
          ],
        },
      },
      {
        name: "report_emergency",
        description:
          "Report a dental emergency. Use this when a patient describes urgent symptoms like severe pain, uncontrolled bleeding, swelling, broken/knocked-out tooth, or jaw injury.",
        parameters: {
          type: "object",
          properties: {
            patient_name: {
              type: "string",
              description: "Patient name",
            },
            patient_phone: {
              type: "string",
              description: "Patient phone number for callback",
            },
            symptoms: {
              type: "string",
              description: "Description of the emergency symptoms",
            },
            severity: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description:
                "Severity level: low (mild discomfort), medium (significant pain), high (severe pain/bleeding), critical (life-threatening)",
            },
          },
          required: [
            "patient_name",
            "patient_phone",
            "symptoms",
            "severity",
          ],
        },
      },
    ],
  },
];

// ============================================================
// N8N WEBHOOK CALLERS
// ============================================================
// ============================================================
// N8N WEBHOOK CALLERS (With Retry for Cold Starts)
// ============================================================
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`N8N fetch attempt ${i + 1} failed:`, e.message);
      if (i === maxRetries - 1) throw e;
      // Wait 1.5s before retrying (gives N8N Cloud time to wake up)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

async function callN8NBooking(data, channel) {
  const url = process.env.N8N_BOOKING_WEBHOOK_URL;
  if (!url) {
    console.log("N8N_BOOKING_WEBHOOK_URL not set, skipping webhook");
    return { success: true, message: "Booking noted (N8N not configured)" };
  }
  try {
    return await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "book", channel, ...data }),
    });
  } catch (e) {
    console.error("N8N booking webhook error after retries:", e.message);
    return { success: false, message: "Booking system is currently starting up, please hold on or call us." };
  }
}

async function callN8NEmergency(data, channel) {
  const url = process.env.N8N_EMERGENCY_WEBHOOK_URL;
  if (!url) {
    console.log("N8N_EMERGENCY_WEBHOOK_URL not set, skipping webhook");
    return { success: true, message: "Emergency noted (N8N not configured)" };
  }
  try {
    return await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, ...data }),
    });
  } catch (e) {
    console.error("N8N emergency webhook error after retries:", e.message);
    return { success: false, message: "Alert system temporarily unavailable" };
  }
}

async function logToN8N(data) {
  const url = process.env.N8N_LOG_WEBHOOK_URL;
  if (!url) return;
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  } catch (e) {
    // Fire and forget — don't block
  }
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================
const sessions = new Map();

// Clean up old sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ============================================================
// MAIN HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { message, sessionId } = req.body;
  if (!message || !sessionId)
    return res.status(400).json({ error: "message and sessionId required" });

  try {
    let textResponse = "";
    let functionCalled = false;

    // Get or create session
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { history: [], lastActive: Date.now() });
    }
    const session = sessions.get(sessionId);
    session.lastActive = Date.now();

    // Inject current date/time to prevent date hallucination
    const currentDateTime = new Date().toLocaleString("en-US", { 
      timeZone: "America/Boise", 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric' 
    });
    const DYNAMIC_SYSTEM_PROMPT = SYSTEM_PROMPT + `\n\n[CRITICAL CONTEXT] CURRENT DATE AND TIME: ${currentDateTime} (Mountain Time). Use this exact date as the baseline for ALL scheduling (e.g., if the user says "tomorrow", calculate it based on this date).`;

    try {
      // ----------------------------------------------------
      // ATTEMPT 1: GEMINI
      // ----------------------------------------------------
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: DYNAMIC_SYSTEM_PROMPT,
        tools: TOOLS,
      });

      // Start chat with history
      const chat = model.startChat({
        history: session.history.map((msg) => ({
          role: msg.role,
          parts: msg.parts,
        })),
      });

      // Send user message
      const result = await chat.sendMessage(message);
      let response = result.response;

      // Check if the model wants to call a function
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.functionCall) {
          functionCalled = true;
          const fnName = part.functionCall.name;
          const fnArgs = part.functionCall.args;

          let fnResult;

          if (fnName === "book_appointment") {
            fnResult = await callN8NBooking(fnArgs, "chat");
          } else if (fnName === "report_emergency") {
            fnResult = await callN8NEmergency(fnArgs, "chat");
          }

          // Send function result back to model so it can generate a natural response
          const followUp = await chat.sendMessage([
            {
              functionResponse: {
                name: fnName,
                response: fnResult || { success: true },
              },
            },
          ]);

          textResponse = followUp.response.text();
        } else if (part.text) {
          textResponse += part.text;
        }
      }

      if (!textResponse) {
        textResponse = response.text();
      }

    } catch (geminiError) {
      console.warn("Gemini API failed/limited, falling back to DeepSeek:", geminiError.message);
      
      // ----------------------------------------------------
      // ATTEMPT 2: DEEPSEEK FALLBACK
      // ----------------------------------------------------
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error("Gemini failed and DEEPSEEK_API_KEY is not configured.");
      }

      const openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      });

      // Map session history to OpenAI/DeepSeek format
      const dsMessages = [
        { role: "system", content: DYNAMIC_SYSTEM_PROMPT },
        ...session.history.map(msg => ({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.parts[0].text
        })),
        { role: "user", content: message }
      ];

      // Map tools to OpenAI/DeepSeek format
      const dsTools = [
        {
          type: "function",
          function: {
            name: "book_appointment",
            description: TOOLS[0].functionDeclarations[0].description,
            parameters: TOOLS[0].functionDeclarations[0].parameters
          }
        },
        {
          type: "function",
          function: {
            name: "report_emergency",
            description: TOOLS[0].functionDeclarations[1].description,
            parameters: TOOLS[0].functionDeclarations[1].parameters
          }
        }
      ];

      const completion = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: dsMessages,
        tools: dsTools
      });

      const responseMessage = completion.choices[0].message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        functionCalled = true;
        const toolCall = responseMessage.tool_calls[0];
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        
        let fnResult;
        if (fnName === "book_appointment") {
          fnResult = await callN8NBooking(fnArgs, "chat");
        } else if (fnName === "report_emergency") {
          fnResult = await callN8NEmergency(fnArgs, "chat");
        }

        // Add tool call and response to messages and trigger followup
        dsMessages.push(responseMessage);
        dsMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(fnResult || { success: true })
        });

        const followUp = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: dsMessages,
          tools: dsTools
        });
        
        textResponse = followUp.choices[0].message.content;
      } else {
        textResponse = responseMessage.content;
      }
    }

    // Save to session history (using our Gemini-style storage for consistency)
    session.history.push({
      role: "user",
      parts: [{ text: message }],
    });
    session.history.push({
      role: "model",
      parts: [{ text: textResponse }],
    });

    // Trim history
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }

    // Log to N8N (async, non-blocking)
    logToN8N({
      sessionId,
      channel: "chat",
      userMessage: message,
      aiResponse: textResponse,
      functionCalled: functionCalled,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ response: textResponse });
  } catch (error) {
    console.error("Chat API error (both Gemini and DeepSeek failed):", error);
    return res.status(500).json({
      response:
        "I apologize, I'm having a brief technical issue. Please call us directly at (208) 555-0123 and we'll be happy to help!",
    });
  }
};
