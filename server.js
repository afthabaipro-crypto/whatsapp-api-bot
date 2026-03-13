const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());

let sock;
let currentQR = "";       // Stores the latest QR code
let isConnected = false;  // Tracks if WhatsApp is connected

async function connectToWhatsApp() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false // We don't need the terminal QR anymore!
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // If a new QR code is generated, save it in the variable
        if (qr) {
            currentQR = qr;
        }

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
            currentQR = ""; // Clear the QR once connected
            console.log('✅ WhatsApp is successfully connected!'); 
        }
    });
}

connectToWhatsApp();

// NEW: Endpoint for your PHP Dashboard to check the status & get the QR
app.get('/status', (req, res) => {
    res.json({ connected: isConnected, qr: currentQR });
});

app.post('/send-message', async (req, res) => {
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
