const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Web Page එක හරහා Pairing Code එක ලබාගන්නා Endpoint එක
app.get('/pair', async (req, res) => {
    let phone = req.query.phone;

    if (!phone) {
        return res.json({ status: false, message: 'කරුණාකර දුරකථන අංකය ලබාදෙන්න.' });
    }

    // Number එකේ තියෙන අමතර ලකුණු (spaces, +, -) ඉවත් කිරීම
    phone = phone.replace(/[^0-9]/g, '');

    try {
        const sessionPath = path.join(__dirname, 'session');
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const Sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Chrome"),
        });

        Sock.ev.on('creds.update', saveCreds);

        Sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log('WhatsApp Bot සාර්ථකව සම්බන්ධ විය!');
            }
        });

        // WhatsApp එකෙන් Pairing Code එක ඉල්ලීම
        if (!Sock.authState.creds.registered) {
            await delay(1500);
            let code = await Sock.requestPairingCode(phone);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            
            return res.json({ status: true, code: code });
        } else {
            return res.json({ status: false, message: 'මෙම අංකය දැනටමත් Connect වී ඇත.' });
        }

    } catch (error) {
        console.error("Pairing Error:", error);
        return res.json({ status: false, message: 'Pairing Code එක ලබාගැනීමට නොහැකි විය. නැවත උත්සාහ කරන්න.' });
    }
});

app.listen(PORT, () => {
    console.log(`Web Server එක port ${PORT} හි ක්‍රියාත්මක වේ.`);
});
