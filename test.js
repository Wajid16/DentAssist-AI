const handler = require('./api/chat.js');

process.env.GEMINI_API_KEY = "dummy";
process.env.DEEPSEEK_API_KEY = "dummy";

const req = {
  method: 'POST',
  body: {
    message: 'hello',
    sessionId: '123'
  }
};

const res = {
  setHeader: () => {},
  status: (s) => ({
    json: (j) => {
      console.log('STATUS:', s);
      console.log('RESPONSE:', j);
    },
    end: () => {}
  }),
  json: (j) => {
    console.log('RESPONSE:', j);
  }
};

handler(req, res).catch(console.error);
