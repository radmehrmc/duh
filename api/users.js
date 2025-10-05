// Share the same user storage
let users = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const user = await req.body;
            
            if (req.query.offline) {
                // Remove user if they're going offline
                users.delete(user.id);
            } else {
                // Update or add user
                users.set(user.id, {
                    ...user,
                    lastSeen: Date.now()
                });
            }
            
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update user' });
        }
    }

    if (req.method === 'GET') {
        // Clean up old users (2 minutes offline)
        const now = Date.now();
        for (let [userId, user] of users.entries()) {
            if (now - user.lastSeen > 120000) {
                users.delete(userId);
            }
        }
        
        const onlineUsers = Array.from(users.keys());
        return res.status(200).json({ onlineUsers });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
