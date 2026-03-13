const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    // This line fixes the loop! It fetches the latest WhatsApp version.
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Connecting to WhatsApp v${version.join('.')}...`);
    
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
        
        if (qr) {
            console.log("\n=========================================");
            console.log("📱 SCAN THIS QR CODE WITH YOUR WHATSAPP:");
            console.log("=========================================\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            console.log("Connection closed. Reason Code:", reason);
            
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconnecting in 5 seconds...");
                setTimeout(connectToWhatsApp, 5000); // 5 second delay stops the spam
            } else {
                console.log("Logged out. Please restart the server.");
            }
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
