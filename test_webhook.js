fetch('https://wajid11.app.n8n.cloud/webhook/dentassist-chat-agent', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message: 'test', sessionId: '123'})
})
.then(r => r.text())
.then(text => console.log("RAW RESPONSE:", text))
.catch(console.error);
