const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Untuk membuat nama file unik
const fileType = require('file-type'); // Untuk validasi jenis file

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Variabel untuk menyimpan data (pertimbangkan database untuk produksi)
let backendCodeVariable = '// Kode backend default';
let imageUrlsVariable = []; // Tidak digunakan dalam kode yang diberikan
let templateContentVariable = '<p>Tidak ada template yang diunggah.</p>';

// Fungsi untuk membuat nama file unik
const generateUniqueFilename = (originalName) => {
    const ext = path.extname(originalName);
    return `${uuidv4()}${ext}`; // Menggunakan UUID untuk nama file yang benar-benar unik
};

// Konfigurasi Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Pastikan direktori ada
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, generateUniqueFilename(file.originalname));
    }
});

// Filter file untuk Multer (Validasi Jenis File)
const fileFilter = async (req, file, cb) => {
    const maxFileSize = 10 * 1024 * 1024; // Batas ukuran file 10MB

    if (file.size > maxFileSize) {
        return cb(new Error('Ukuran file terlalu besar (maks 10MB).'));
    }

    try {
        const buffer = fs.readFileSync(file.path); // Baca file untuk deteksi magic number
        const type = await fileType.fromBuffer(buffer);

        if (!type) {
            return cb(new Error('Jenis file tidak dikenali.'));
        }

        const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'zip', 'txt', 'html', 'css', 'js']; // Daftar yang diizinkan
        if (!allowedTypes.includes(type.ext.toLowerCase())) {
            return cb(new Error('Jenis file tidak diizinkan: ' + type.ext));
        }

        cb(null, true); // File diizinkan
    } catch (error) {
        console.error("Error checking file type:", error);
        return cb(new Error('Gagal memverifikasi jenis file.'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter, // Gunakan filter file kita
    limits: {
        fileSize: 10 * 1024 * 1024 // Batas ukuran file di Multer juga
    }
}).single('file');

const uploadTemplate = multer({
    storage: storage,
    fileFilter: fileFilter, // Gunakan filter file yang sama untuk template
    limits: {
        fileSize: 10 * 1024 * 1024
    }
}).single('template');

// Middleware untuk menangani error Multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Multer error: ' + err.message });
    } else if (err) {
        return res.status(500).json({ error: 'Error: ' + err.message });
    }
    next();
});

// Rute Upload File
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error("File upload error:", err);
            return res.status(400).json({ error: err.message }); // Kirim pesan error dari filter file
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diupload.' });
        }

        console.log('File uploaded:', req.file.filename);
        res.json({ message: 'File berhasil diupload: ' + req.file.filename }); // Kirim nama file unik
    });
});

// Rute Update Kode
app.post('/update-code', (req, res) => {
    const code = req.body.code;
    if (!code) {
        return res.status(400).json({ error: 'Kode tidak boleh kosong.' });
    }

    // **PENTING: SANITISASI KODE DI SINI SEBELUM DISIMPAN**
    // Contoh: gunakan library seperti DOMPurify untuk membersihkan HTML
    // atau ESLint untuk memvalidasi JavaScript.

    backendCodeVariable = code;
    res.json({ message: 'Kode berhasil disimpan.' });
});

// Rute Upload Template
app.post('/upload-template', (req, res) => {
    uploadTemplate(req, res, (err) => {
        if (err) {
            console.error("Template upload error:", err);
            return res.status(400).json({ error: err.message }); // Kirim pesan kesalahan dari filter file
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file template yang diupload.' });
        }

        const filePath = path.join(__dirname, 'uploads', req.file.filename); // Jalur lengkap file yang diunggah
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error("Error reading template file:", err);
                templateContentVariable = '<p>Gagal membaca file template.</p>';
                return res.status(500).json({ error: 'Gagal membaca file template.' });
            }

            templateContentVariable = data;
            res.json({ message: 'Template berhasil diupload dan konten disimpan.' });
        });
    });
});

// Rute Data
app.get('/data', (req, res) => {
    const data = {
        backendCode: backendCodeVariable,
        imageUrls: imageUrlsVariable, // Meskipun tidak digunakan
        templateContent: templateContentVariable
    };
    res.json(data);
});

// Rute Reset Data
app.post('/reset-data', (req, res) => {
    backendCodeVariable = '// Kode backend default';
    imageUrlsVariable = [];
    templateContentVariable = '<p>Tidak ada template yang diunggah.</p>';
    res.json({ message: 'Konten berhasil direset.' });
});

// Rute statis
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
