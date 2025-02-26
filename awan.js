const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

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
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public'

// Buat folder 'uploads' jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Data untuk disimpan dan ditampilkan di index.html
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
app.get('/', (req, res) => {
    fs.readFile('index.html', 'utf8', (err, html) => {
        if (err) {
            res.status(500).send('Error loading index.html');
            return;
        }

        // Gabungkan data ke dalam HTML
        let fileList = '';
        data.files.forEach(file => {
            fileList += `<div class="file-item">
                            <a href="/uploads/${file}">${file}</a>
                            <a href="/uploads/${file}" download="${file}" class="download-button">Unduh</a>
                         </div>`;
        });

        let linkList = '';
        data.links.forEach(link => {
            linkList += `<p><a href="${link}" target="_blank">${link}</a></p>`;
        });

        const modifiedHtml = html.replace('<!-- FILES_HERE -->', fileList).replace('<!-- LINKS_HERE -->', linkList);
        res.send(modifiedHtml);
    });
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

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
