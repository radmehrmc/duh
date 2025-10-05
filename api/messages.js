// Use a simple JSON file for storage since Vercel doesn't share memory
import fs from 'fs';
import path from 'path';

const dataFile = '/tmp/chat_data.json';

// Initialize data file if it doesn't exist
function initDataFile() {
    if (!fs.existsSync(dataFile)) {
        const initialData = {
            messages: [],
            users: [],
            lastCleanup: Date.now()
        };
        fs.writeFileSync(dataFile, JSON.stringify(initialData));
    }
}

function readData() {
    initDataFile();
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

// Clean up old data
function cleanupData() {
    const data = readData();
    const now = Date.now();
    
    // Clean up users older than 2 minutes
    data.users = data.users.filter(user => now - user.lastSeen < 120000);
    
    // Keep only last 100 messages
    if (data.messages.length > 100) {
        data.messages = data.messages.slice(-100);
    }
    
    data.lastCleanup = now;
    writeData(data);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const message = await req.body;
            const data = readData();
            
            data.messages.push({
                ...message,
                id: message.id || Date.now(),
                timestamp: message.timestamp || Date.now()
            });
            
            writeData(data);
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to save message' });
        }
    }

    if (req.method === 'GET') {
        cleanupData();
        const data = readData();
        return res.status(200).json({
            messages: data.messages,
            onlineUsers: data.users
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
