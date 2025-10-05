// Global storage (shared across all serverless functions)
let messages = [];
let users = new Map();
let lastCleanup = Date.now();

// Clean up old users every minute
function cleanupUsers() {
    const now = Date.now();
    if (now - lastCleanup > 60000) {
        for (let [userId, user] of users.entries()) {
            if (now - user.lastSeen > 120000) { // 2 minutes offline
                users.delete(userId);
            }
        }
        lastCleanup = now;
    }
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    cleanupUsers();

    if (req.method === 'POST') {
        try {
            const message = await req.body;
            
            // Add message to shared storage
            messages.push({
                ...message,
                id: message.id || Date.now().toString(),
                timestamp: message.timestamp || Date.now()
            });
            
            // Keep only last 100 messages
            if (messages.length > 100) {
                messages = messages.slice(-100);
            }
            
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to save message' });
        }
    }

    if (req.method === 'GET') {
        const onlineUsers = Array.from(users.keys());
        return res.status(200).json({
            messages: messages,
            onlineUsers: onlineUsers
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
