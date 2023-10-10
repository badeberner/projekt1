const express = require('express');
const cors = require('cors'); // Förutsatt att du har installerat detta paket
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const boardRoutes = require('./routes/boardRoutes');
const authRoutes = require('./routes/auth');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
app.get('/', (req, res) => {
    res.send('Välkommen till min server!');
});
// Middlewares
app.use(cors()); // Hantera CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Middleware
function authenticateJWT(req, res, next) {
    const token = req.header('Authorization');
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}


app.use('/auth', authRoutes);
app.use('/boards', authenticateJWT, boardRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Något gick fel!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servern kör på port ${PORT}`);
    app.use((err, req, res, next) => {
        console.error('Error:', err.message, '\nStack:', err.stack);
        res.status(500).send('Något gick fel!');
    });
});
