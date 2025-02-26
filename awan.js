const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Untuk membuat nama file unik
const fileType = require('file-type'); // Untuk validasi jenis file
const sanitizeHtml = require('sanitize-html'); // Untuk membersihkan HTML (penting!)
const https = require('https'); // Untuk mengunduh dari URL
const axios = require('axios'); //Untuk request ke URL

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Melayani file statis (HTML, CSS, JS)

//  Variabel untuk menyimpan data (pertimbangkan database untuk produksi)
let backendCodeVariable = '// Kode backend default';
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
        // Baca file untuk deteksi magic number
        const buffer = fs.readFileSync(file.path);
        const type = await fileType.fromBuffer(buffer);

        if (!type) {
            // Hapus file yang tidak valid untuk mencegah penyimpanan file yang rusak
            fs.unlinkSync(file.path);
            return cb(new Error('Jenis file tidak dikenali.'));
        }

        const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'zip', 'txt', 'html', 'css', 'js']; // Daftar yang diizinkan
        if (!allowedTypes.includes(type.ext.toLowerCase())) {
             // Hapus file yang tidak valid
             fs.unlinkSync(file.path);
            return cb(new Error('Jenis file tidak diizinkan: ' + type.ext));
        }

        cb(null, true); // File diizinkan
    } catch (error) {
        console.error("Error checking file type:", error);
        // Hapus file jika terjadi kesalahan dalam pemeriksaan
        fs.unlinkSync(file.path);
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

//Rute Upload dari URL
app.post('/upload-from-url', async (req, res) => {
    const url = req.body.url;

    if (!url) {
        return res.status(400).json({ error: 'URL tidak boleh kosong.' });
    }

    try {
        // Dapatkan nama file dari URL
        const filename = path.basename(new URL(url).pathname);
        const uniqueFilename = generateUniqueFilename(filename);
        const filePath = path.join(__dirname, 'uploads', uniqueFilename);

        // Validasi URL sebelum mengunduh
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return res.status(400).json({ error: 'URL tidak valid. Harus dimulai dengan http:// atau https://' });
        }

        // Gunakan Axios untuk mengunduh file
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream' // Penting untuk file besar
        });

        // Pastikan permintaan berhasil
        if (response.status !== 200) {
            return res.status(response.status).json({ error: `Gagal mengunduh file. Status: ${response.status}` });
        }

        // Tulis stream ke file
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', async () => {
            console.log('File downloaded from URL:', uniqueFilename);

             // Validasi jenis file setelah diunduh (PENTING untuk keamanan)
             try {
                const buffer = fs.readFileSync(filePath);
                const type = await fileType.fromBuffer(buffer);

                if (!type) {
                    fs.unlinkSync(filePath); // Hapus file yang tidak valid
                    return res.status(400).json({ error: 'Jenis file tidak dikenali setelah diunduh.' });
                }

                const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'zip', 'txt', 'html', 'css', 'js']; // Daftar yang diizinkan
                if (!allowedTypes.includes(type.ext.toLowerCase())) {
                    fs.unlinkSync(filePath); // Hapus file yang tidak diizinkan
                    return res.status(400).json({ error: 'Jenis file tidak diizinkan setelah diunduh: ' + type.ext });
                }


                res.json({ message: 'File berhasil diunduh dari URL: ' + uniqueFilename });

            } catch (fileTypeError) {
                 //Tangani error yang terkait dengan validasi `fileType`
                 fs.unlinkSync(filePath);
                 console.error("Error validating downloaded file type:", fileTypeError);
                 return res.status(500).json({ error: 'Gagal memverifikasi jenis file setelah diunduh.' });
             }

        });

        writer.on('error', (err) => {
            fs.unlink(filePath, () => {}); // Bersihkan jika ada error
            console.error("Error writing file:", err);
            return res.status(500).json({ error: 'Terjadi kesalahan saat menyimpan file.' });
        });

    } catch (error) {
        console.error("Error downloading from URL:", error);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengunduh dari URL: ' + error.message });
    }
});

// Rute Update Kode
app.post('/update-code', (req, res) => {
    const code = req.body.code;
    if (!code) {
        return res.status(400).json({ error: 'Kode tidak boleh kosong.' });
    }

    // **PENTING: SANITISASI KODE DI SINI SEBELUM DISIMPAN**
    //  Gunakan library seperti DOMPurify untuk membersihkan HTML
    //  atau ESLint untuk memvalidasi JavaScript.
    const sanitizedCode = sanitizeHtml(code, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['style', 'script']),
        allowedAttributes: {
            '*': ['class', 'id', 'style'], // Izinkan semua atribut class, id, dan style
            'a': ['href', 'target'],      // Izinkan atribut href dan target pada tag <a>
            'img': ['src', 'alt']         // Izinkan atribut src dan alt pada tag <img>
        },
        allowedSchemes: ['http', 'https', 'data'] // Izinkan skema http, https, dan data (data untuk gambar base64)
    });

    backendCodeVariable = sanitizedCode;
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

            // Sanitisasi template HTML sebelum disimpan
            templateContentVariable = sanitizeHtml(data, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['style']),
                allowedAttributes: {
                    '*': ['class', 'id', 'style'],
                    'a': ['href', 'target'],
                    'img': ['src', 'alt']
                },
                allowedSchemes: ['http', 'https', 'data']
            });

            res.json({ message: 'Template berhasil diupload dan konten disimpan.' });
        });
    });
});

// Rute Data
app.get('/data', (req, res) => {
    const data = {
        backendCode: backendCodeVariable,
        templateContent: templateContentVariable
    };
    res.json(data);
});

// Rute Reset Data
app.post('/reset-data', (req, res) => {
    backendCodeVariable = '// Kode backend default';
    templateContentVariable = '<p>Tidak ada template yang diunggah.</p>';

     // Hapus semua file di folder uploads
     const uploadDir = path.join(__dirname, 'uploads');
     fs.readdir(uploadDir, (err, files) => {
        if (err) {
            console.error("Error reading uploads directory:", err);
            return res.status(500).json({ error: 'Gagal membaca direktori uploads.' });
        }

        for (const file of files) {
            const filePath = path.join(uploadDir, file);
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`Gagal menghapus file ${file}: ${unlinkErr}`);
                    //Tidak menghentikan reset jika gagal menghapus satu file
                }
            });
        }

        res.json({ message: 'Konten berhasil direset.' });
    });
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
