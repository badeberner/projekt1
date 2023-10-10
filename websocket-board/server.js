const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

function validateToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        console.error('JWT validation failed:', err);
        return null;
    }
}


const usersDB = [];

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const existingUser = usersDB.find(user => user.username === username);
    if (existingUser) {
        return res.status(409).json({ success: false, message: 'Username already exists.' });
    }
    usersDB.push({ username, password });
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const token = jwt.sign({ username: username }, JWT_SECRET);
    res.json({ token: token });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});

let boards = {};
let clients = {};
let boardStates = {};

wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.substring(1));
    const boardId = urlParams.get('boardId');
    const tokenFromURL = urlParams.get('access_token');

    const decoded = validateToken(tokenFromURL);
    if (!decoded) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Invalid token." }));
        ws.close();
        return;
    }

    if (boardStates[boardId]) {
        for (const [noteId, attributes] of Object.entries(boardStates[boardId])) {
            ws.send(JSON.stringify({
                type: 'MOVE_NOTE',
                noteId: noteId,
                position: attributes.position,
                color: attributes.color
            }));
        }
    }

    if (!clients[boardId]) {
        clients[boardId] = new Set();
    }
    clients[boardId].add(ws);
    
    ws.on('message', (message) => {
        console.log('Received:', message); 
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        } catch (err) {
            console.error('Invalid message format:', err);
            return;
        }

        switch(parsedMessage.type) {
            case 'NEW_NOTE_OR_EDIT':
                if (!parsedMessage.noteId) {
                    parsedMessage.noteId = Date.now().toString();
                }
                clients[boardId].forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(parsedMessage));
                    }
                });
                break;

            case 'MOVE_NOTE':
                if (!boardStates[boardId]) {
                    boardStates[boardId] = {};
                }
                if (!boardStates[boardId][parsedMessage.noteId]) {
                    boardStates[boardId][parsedMessage.noteId] = {};
                }
                boardStates[boardId][parsedMessage.noteId].position = parsedMessage.position;
                clients[boardId].forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(parsedMessage));
                    }
                });
                break;

            case 'COLOR_CHANGE':
                if (!boardStates[boardId]) {
                    boardStates[boardId] = {};
                }
                if (!boardStates[boardId][parsedMessage.noteId]) {
                    boardStates[boardId][parsedMessage.noteId] = {};
                }
                boardStates[boardId][parsedMessage.noteId].color = parsedMessage.color;
                clients[boardId].forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(parsedMessage));
                    }
                });
                break;

            default:
                console.error('Unknown message type:', parsedMessage.type);
        }
    });
    
    ws.on('close', () => {
        clients[boardId].delete(ws);
        if (clients[boardId].size === 0) {
            delete clients[boardId];
        }
    });
});
