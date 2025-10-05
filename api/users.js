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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const user = await req.body;
            const data = readData();
            
            const userIndex = data.users.findIndex(u => u.id === user.id);
            
            if (userIndex === -1) {
                // Add new user
                data.users.push({
                    ...user,
                    lastSeen: Date.now()
                });
            } else {
                // Update existing user
                data.users[userIndex].lastSeen = Date.now();
            }
            
            writeData(data);
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update user' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
