const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const app = express();
const port = 3000;

// Konfigurasi Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({storage: storage});

app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

let data = {
    files: [],
    links: []
};

function loadData() {
    try {
        const rawData = fs.readFileSync('data.json');
        data = JSON.parse(rawData);
    } catch (error) {
        console.log("File data.json tidak ditemukan atau rusak. Menggunakan data default.");
    }
}

function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data));
}

loadData();

app.get('/', (req, res) => {
    fs.readFile('index.html', 'utf8', (err, html) => {
        if (err) {
            res.status(500).send('Error loading index.html');
            return;
        }
        // Kirim data sebagai JSON agar dapat diakses dari JavaScript
        const modifiedHtml = html.replace('/* DATA_FILES_LINKS */', `
            <script>
                window.fileLinksData = ${JSON.stringify(data)};
            </script>
        `);
        res.send(modifiedHtml);
    });
});

app.get('/admin', (req, res) => {
    fs.readFile('admin.html', 'utf8', (err, html) => {
        if (err) {
            res.status(500).send('Error loading admin.html');
            return;
        }
        res.send(html);
    });
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Tidak ada file yang diunggah.');
    }

    data.files.push(req.file.originalname);
    saveData();
    res.redirect('/admin');
});

app.post('/addLink', (req, res) => {
    const link = req.body.link;
    if (link) {
        data.links.push(link);
        saveData();
    }
    res.redirect('/admin');
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'uploads', filename);
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filepath);
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
