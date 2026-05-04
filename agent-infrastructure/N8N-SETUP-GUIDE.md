# DentAssist AI — N8N Setup Guide

## What You Need Before Starting

1. **N8N Cloud account** (you have the 14-day trial ✅)
2. **Google account** (for Calendar + Sheets + Gmail)
3. **Twilio account** (free trial for testing — get one at twilio.com)

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet called **"DentAssist AI Data"**
3. Create 3 tabs (sheets at bottom):

**Tab 1: "Sheet1"** (for bookings) with headers:
| Timestamp | Patient Name | Phone | Service | Appointment Date | Channel | Status | Notes |
|-----------|-------------|-------|---------|-----------------|---------|--------|-------|

**Tab 2: "Interactions"** (for chat logs) with headers:
| Timestamp | Session ID | Channel | Patient Message | AI Response | Clinic ID |
|-----------|-----------|---------|----------------|-------------|-----------|

**Tab 3: "Emergencies"** (for emergency logs) with headers:
| Timestamp | Patient Name | Phone | Symptoms | Severity | Channel | Status |
|-----------|-------------|-------|----------|----------|---------|--------|

4. Copy the **Sheet ID** from the URL (it's the long string between `/d/` and `/edit`)

---

## Step 2: Import N8N Workflows

### Workflow 1: Booking
1. In N8N, click **"Add workflow"** → **"Import from file"**
2. Select `n8n-workflows/booking-workflow.json`
3. You'll see the workflow with 7 nodes connected
4. **Configure credentials** (click each node with ⚠️):
   - **Google Calendar**: Connect your Google account
   - **Twilio**: Enter your Twilio Account SID + Auth Token
   - **Gmail**: Connect your Google account
   - **Google Sheets**: Connect your Google account, select your sheet
5. **Update the Google Sheets node**: Select your "DentAssist AI Data" spreadsheet
6. **Update the Gmail node**: Change `office@clinic.com` to your email
7. Click **"Save"** then **"Activate"** (toggle at top-right)
8. Copy the webhook URL from the "Booking Webhook" node — you'll need this for `.env`

### Workflow 2: Interaction Logger
1. Import `n8n-workflows/logging-workflow.json`
2. Configure Google Sheets credential
3. Select your "DentAssist AI Data" spreadsheet, "Interactions" tab
4. Save → Activate
5. Copy webhook URL

### Workflow 3: Emergency Alert
1. Import `n8n-workflows/emergency-workflow.json`
2. Configure Twilio + Gmail + Google Sheets credentials
3. Update Gmail recipient to your email
4. Save → Activate
5. Copy webhook URL

---

## Step 3: Set N8N Environment Variables

In N8N Cloud, go to **Settings → Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `TWILIO_PHONE_NUMBER` | Your Twilio number (e.g., +12085551234) |
| `ONCALL_DENTIST_PHONE` | Phone to receive emergency alerts |

---

## Step 4: Set Vercel Environment Variables

When you deploy to Vercel, add these environment variables:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `N8N_BOOKING_WEBHOOK_URL` | Webhook URL from booking workflow |
| `N8N_EMERGENCY_WEBHOOK_URL` | Webhook URL from emergency workflow |
| `N8N_LOG_WEBHOOK_URL` | Webhook URL from logging workflow |

---

## Step 5: Test Everything

### Test the Booking Flow:
1. Open the chat widget on your landing page
2. Say: "Hi, I'd like to book a cleaning appointment"
3. When Ava asks, provide: your name, phone number, and preferred time
4. Ava will trigger the booking function
5. Check:
   - ✅ Google Calendar has the new event
   - ✅ You received an SMS confirmation
   - ✅ You received an email notification
   - ✅ Google Sheets has the new row in "Sheet1"

### Test the Emergency Flow:
1. Say: "I'm in severe pain, my tooth is broken and bleeding"
2. Provide your name and phone when asked
3. Check:
   - ✅ On-call dentist received SMS alert
   - ✅ Clinic email received emergency notification
   - ✅ Google Sheets "Emergencies" tab has the new row

### Test the Logging Flow:
1. Have any conversation with the chat widget
2. Check Google Sheets "Interactions" tab
3. Every message pair (user + AI) should be logged

---

## How It All Connects

```
Chat Widget → Vercel API (api/chat.js)
                  │
                  ├── Gemini AI processes the conversation
                  │
                  ├── When AI calls book_appointment:
                  │     └── POST → N8N Booking Webhook
                  │           ├── Google Calendar (create event)
                  │           ├── Twilio SMS (confirmation)
                  │           ├── Gmail (clinic notification)
                  │           └── Google Sheets (log booking)
                  │
                  ├── When AI calls report_emergency:
                  │     └── POST → N8N Emergency Webhook
                  │           ├── Twilio SMS (alert on-call dentist)
                  │           ├── Gmail (clinic emergency email)
                  │           └── Google Sheets (log emergency)
                  │
                  └── Every message (async):
                        └── POST → N8N Logging Webhook
                              └── Google Sheets (log interaction)
```

---

## Troubleshooting

**"N8N webhook not receiving data"**
- Make sure the workflow is **activated** (green toggle)
- Check the webhook URL matches exactly in your .env
- In N8N, click "Test webhook" and send a request to verify

**"Google Calendar not creating events"**
- Re-authorize Google credentials in N8N
- Make sure the calendar is set to "primary"
- Check the datetime format in the webhook data

**"SMS not sending"**
- Verify Twilio credentials (Account SID + Auth Token)
- On Twilio trial, you can only send to verified numbers
- Check your Twilio balance

**"Chat widget shows error"**
- Check Vercel logs for API errors
- Verify GEMINI_API_KEY is set in Vercel env variables
