const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

// ** Koneksi ke Database (Mongoose) **
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://zanssxploit:pISqUYgJJDfnLW9b@cluster0.fgram.mongodb.net/?retryWrites=true&w=majority', {  // Ganti dengan koneksi MongoDB Anda
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        // Exit process with failure
        process.exit(1);
    }
};

connectDB();  // Connect to MongoDB

// ** Model Pesan (Mongoose) **
const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
});

const Message = mongoose.model('Message', MessageSchema);

// Konfigurasi Multer untuk upload file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Simpan file di folder 'uploads'
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Gunakan nama file asli
    }
});
const upload = multer({ storage: storage });

// Middleware untuk parse body permintaan (untuk form data)
app.use(express.urlencoded({ extended: true }));

// Buat folder 'uploads' jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Data untuk disimpan
let data = {
    files: [],
    links: []
};

// Fungsi untuk membaca data dari file (misalnya data.json)
function loadData() {
    try {
        const rawData = fs.readFileSync('data.json');
        data = JSON.parse(rawData);
    } catch (error) {
        console.log("File data.json tidak ditemukan atau rusak. Menggunakan data default.");
    }
}

// Fungsi untuk menyimpan data ke file (misalnya data.json)
function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data));
}

// Load data saat server dimulai
loadData();

// Rute untuk halaman utama (index.html)
app.get('/', async (req, res) => {
    try {
        const html = fs.readFileSync('index.html', 'utf8'); // Baca file HTML
        const messages = await Message.find().populate('replyTo'); // Ambil data pesan dari database

        // Generate tampilan daftar file
        let fileList = data.files.map(file => `
            <div class="file-item">
                <a href="/uploads/${file}">${file}</a>
                <a href="/download/${file}" class="download-button">Unduh</a>
            </div>
        `).join('');

        // Generate tampilan daftar tautan
        let linkList = data.links.map(link => `
            <div class="link-item">
                <a href="${link}" target="_blank">${link}</a>
                <button class="try-button" onclick="tryLink('${link}')">Coba</button>
            </div>
        `).join('');

        // Generate tampilan daftar pesan
        let messageList = messages.map(msg => `
            <li class="message">
                <span class="sender">${msg.sender}</span>: ${msg.content}
            </li>
        `).join('');

        // Gabungkan data ke dalam HTML
        const modifiedHtml = html
            .replace('<!-- FILES_HERE -->', fileList)
            .replace('<!-- LINKS_HERE -->', linkList)
            .replace('<!-- MESSAGES_HERE -->', messageList);

        res.send(modifiedHtml);
    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi kesalahan saat memproses permintaan.');
    }
});

// Rute untuk halaman admin (admin.html)
app.get('/admin', (req, res) => {
    fs.readFile('admin.html', 'utf8', (err, html) => {
        if (err) {
            res.status(500).send('Error loading admin.html');
            return;
        }
        res.send(html);
    });
});

// Rute untuk menangani upload file
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Tidak ada file yang diunggah.');
    }

    data.files.push(req.file.originalname);
    saveData(); // Simpan perubahan data

    res.redirect('/admin'); // Redirect kembali ke halaman admin
});

// Rute untuk menangani penambahan link
app.post('/addLink', (req, res) => {
    const link = req.body.link;
    if (link) {
        data.links.push(link);
        saveData(); // Simpan perubahan data
    }
    res.redirect('/admin'); // Redirect kembali ke halaman admin
});

// Rute untuk menangani pengiriman pesan
app.post('/api/messages', async (req, res) => {
    try {
        const message = new Message({
            sender: req.body.sender,
            content: req.body.content,
            replyTo: req.body.replyTo || null,
        });
        await message.save();
        res.redirect('/'); // Redirect kembali ke halaman utama untuk menampilkan pesan baru
    } catch (error) {
        console.error("Gagal menyimpan pesan:", error);
        res.status(500).send('Gagal mengirim pesan.');
    }
});

// Rute untuk menangani unduhan file (penting!)
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'uploads', filename);

    // Tentukan tipe konten (MIME type) berdasarkan ekstensi file
    const contentType = mime.lookup(filename) || 'application/octet-stream'; // Fallback ke binary jika tidak dikenali

    // Set header 'Content-Type'
    res.setHeader('Content-Type', contentType);

    // Set header 'Content-Disposition' untuk memberitahu browser untuk mengunduh file
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Kirim file sebagai respons
    res.sendFile(filepath);
});

// Serve files in /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
