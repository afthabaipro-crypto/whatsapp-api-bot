const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // We added this!

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }) // We removed the deprecated option here
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        
        // When WhatsApp sends the QR code, we print it using our new library
        if (qr) {
            console.log("📱 SCAN THIS QR CODE WITH YOUR WHATSAPP:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            console.log("Connection closed, reconnecting...");
            connectToWhatsApp(); 
        } else if (connection === 'open') { 
            console.log('✅ WhatsApp is successfully connected and ready!'); 
        }
    });
}

connectToWhatsApp();

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
