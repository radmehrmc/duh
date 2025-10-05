import fs from 'fs';
import path from 'path';

const dataFile = '/tmp/chat_data.json';

function readData() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { messages: [], users: [], lastCleanup: Date.now() };
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data));
        return true;
    } catch (error) {
        return false;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const { lastId, userId } = req.query;
        const lastIdNum = parseInt(lastId) || 0;
        
        const data = readData();
        const now = Date.now();
        
        // Update user's last seen
        if (userId) {
            const userIndex = data.users.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                data.users[userIndex].lastSeen = now;
            }
            writeData(data);
        }
        
        // Clean up old users
        data.users = data.users.filter(user => now - user.lastSeen < 120000);
        
        // Get new messages since last ID
        const newMessages = data.messages.filter(msg => msg.id > lastIdNum);
        
        return res.status(200).json({
            newMessages,
            onlineUsers: data.users
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
