const express = require('express');
const cors = require('cors');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

const app = express();
app.use(cors()); // UI එකෙන් එන Requests වෙනුවෙන් CORS සක්‍රිය කිරීම
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Root Endpoint (Server Online ද යන්න පරීක්ෂා කිරීමට)
app.get('/', (req, res) => {
    res.json({ status: true, message: "JANA MODZ Pair Server is Active!" });
});

// Pair Code ලබාදෙන API Endpoint එක
app.get('/api/pair', async (req, res) => {
    let phone = req.query.phone;

    if (!phone) {
        return res.json({ status: false, message: 'දුරකථන අංකය ඇතුළත් කර නැත.' });
    }

    phone = phone.replace(/[^0-9]/g, '');

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');

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
        return res.json({ status: false, message: 'Pair Code එක සෑදීමට නොහැකි විය. නැවත උත්සාහ කරන්න.' });
    }
});

app.listen(PORT, () => {
    console.log(`JANA MODZ Pair Server is running on port ${PORT}`);
});
