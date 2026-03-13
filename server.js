const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());

let sock;
let currentQR = "";       
let isConnected = false;  

async function connectToWhatsApp() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) currentQR = qr;

        if (connection === 'close') {
            isConnected = false;
            const reason = lastDisconnect.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(connectToWhatsApp, 5000); 
            } else {
                currentQR = "";
            }
        } else if (connection === 'open') { 
            isConnected = true;
            currentQR = ""; 
            console.log('✅ WhatsApp is successfully connected!'); 
        }
    });
}

connectToWhatsApp();

app.get('/status', (req, res) => {
    res.json({ connected: isConnected, qr: currentQR });
});

app.post('/send-message', async (req, res) => {
    // NEW: If not connected, instantly tell PHP to queue the message!
    if (!isConnected || !sock) {
        return res.status(503).json({ success: false, error: 'WhatsApp is currently disconnected.' });
    }

    const { number, message } = req.body;
    try {
        const jid = `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true, message: 'Sent!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
