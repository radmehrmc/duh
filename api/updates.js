// Share the same message storage across all API endpoints
let messages = [];
let users = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const { lastCheck, userId } = req.query;
        const lastCheckTime = parseInt(lastCheck) || 0;
        
        // Update user's last seen
        if (userId) {
            users.set(userId, Date.now());
        }
        
        // Clean up old users (2 minutes offline)
        const now = Date.now();
        for (let [uid, lastSeen] of users.entries()) {
            if (now - lastSeen > 120000) {
                users.delete(uid);
            }
        }
        
        // Get new messages since last check
        const newMessages = messages.filter(msg => msg.timestamp > lastCheckTime);
        const onlineUsers = Array.from(users.keys());
        
        return res.status(200).json({
            newMessages,
            onlineUsers
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
