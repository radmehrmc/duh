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
        
        // Update user's last seen
        if (userId) {
            users.set(userId, Date.now());
        }
        
        // Clean up old users
        const now = Date.now();
        for (let [uid, lastSeen] of users.entries()) {
            if (now - lastSeen > 120000) {
                users.delete(uid);
            }
        }
        
        const newMessages = messages.filter(msg => msg.timestamp > parseInt(lastCheck));
        const onlineUsers = Array.from(users.keys());
        
        return res.status(200).json({
            newMessages,
            onlineUsers
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
