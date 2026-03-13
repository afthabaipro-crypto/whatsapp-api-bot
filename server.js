const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    // This creates a folder to save your WhatsApp login session
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true // This will show the QR code in Render's logs
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) console.log("SCAN THIS QR CODE WITH WHATSAPP!");
        if (connection === 'close') {
            console.log("Connection closed, reconnecting...");
            connectToWhatsApp(); 
        } else if (connection === 'open') { 
            console.log('✅ WhatsApp is successfully connected and ready!'); 
        }
    });
}

connectToWhatsApp();

// This is the door your InfinityFree PHP website will knock on
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

// Render gives us a dynamic PORT, so we must use process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
