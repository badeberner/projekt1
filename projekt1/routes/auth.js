const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const secret = process.env.JWT_SECRET;
const prisma = new PrismaClient();
const router = express.Router();
router.post('/add-test-user', async (req, res) => {
    console.log("Trying to add a test user");
    try {
        const username = 'testuser';
        const plainPassword = 'testpassword123';

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        const user = await prisma.Users.create({
            data: {
                username: username,
                password: hashedPassword
            }
        });

        res.status(201).send({ message: 'Test user added!', user });
    } catch (error) {
        console.error('Error adding test user:', error);
        res.status(500).send("Error adding test user");
    }
});
router.post('/login', async (req, res) => {
    console.log('Login route called.');
    console.log('Request body:', req.body);
    
    try {
        const { username, password } = req.body;
        console.log('Credentials:', username, password);

        const user = await prisma.Users.findFirst({ where: { username } });
        console.log('User fetched from DB:', user);

        if (!user) return res.status(401).send('Invalid credentials.');

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password validation result:', validPassword);

        if (!validPassword) return res.status(401).send('Invalid credentials.');

        const token = jwt.sign({
            id: user.id,
            username: user.username
        }, secret, { expiresIn: '1h' });

        res.send({ token });
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).send("Internal Server Error");
    }
});


router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send('Username and password are required.');
        }
        const userExists = await prisma.Users.findFirst({ where: { username } });
        if (userExists) return res.status(400).send('Användarnamnet finns redan.');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.Users.create({
            data: {
                username: username,
                password: hashedPassword
            }
        });

        res.status(201).send({ id: user.id, username: user.username });
    } catch (error) {
        console.error('Error in /register route:', error);
        res.status(500).send("Internal Server Error");
    }
});

router.get('/verify-token', (req, res) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        if (!token) return res.status(401).send('Åtkomst nekad. Ingen token tillhandahållen.');

        const verified = jwt.verify(token, secret);
        res.send(verified);
    } catch (error) {
        res.status(400).send('Ogiltig token.');
    }
});

module.exports = router;
