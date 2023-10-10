const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

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

router.get('/boards', authenticateJWT, async (req, res) => {
    try {
        const boards = await prisma.board.findMany();
        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Något gick fel när man hämtade boards." });
    }
});

module.exports = router;
