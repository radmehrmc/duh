// Vercel Serverless API endpoint
const messages = [];

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const message = req.body;
    messages.push({
      ...message,
      id: messages.length + 1,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }
    
    res.status(200).json({ success: true });
  } 
  else if (req.method === 'GET') {
    res.status(200).json(messages);
  }
}
