# 
# NEX AI

**NEX AI** adalah aplikasi asisten AI pribadi berbasis web yang dirancang untuk membantu pengguna mencari informasi, mengelola percakapan, menyimpan memori, dan menyelesaikan berbagai kebutuhan melalui satu antarmuka sederhana.

## ✨ Fitur Utama

- **AI Chat** — Berinteraksi dengan AI menggunakan bahasa alami.
- **Conversation History** — Menyimpan dan membuka kembali riwayat percakapan.
- **Search Chat** — Mencari percakapan berdasarkan judul atau isi pesan.
- **Edit & Regenerate** — Mengubah pesan dan membuat ulang jawaban AI.
- **AI Memory** — Menyimpan dan mengingat informasi melalui database.
- **Voice Chat** — Input suara dan fitur membaca jawaban AI.
- **Image Upload** — Mengirim foto untuk dianalisis oleh AI.
- **Projects / Workspace** — Mengelompokkan percakapan berdasarkan proyek.
- **Export Chat** — Mengekspor percakapan ke format Markdown.
- **AI Personalization** — Mengatur nama, bahasa, dan gaya jawaban.
- **Responsive Design** — Tampilan menyesuaikan desktop dan perangkat Android.
- **AI Tools** — Mendukung fitur tambahan seperti pencarian GitHub dan informasi cuaca.

## 🛠️ Teknologi

- HTML5
- CSS3
- JavaScript
- Node.js
- Gemini API
- Neon PostgreSQL
- Vercel

## 📁 Struktur Project

```text
NEX-AI/
├── api/
│   ├── chat.js
│   ├── conversations.js
│   ├── messages.js
│   ├── memories.js
│   ├── database.js
│   ├── location.js
│   └── tools.js
│
├── tools/
│   ├── index.js
│   ├── weather.js
│   ├── github.js
│   └── memory.js
│
├── index.html
├── style.css
├── script.js
├── package.json
└── README.md
```

## ⚙️ Instalasi

1. Clone repository:

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
```

2. Masuk ke folder project:

```bash
cd REPOSITORY
```

3. Install dependencies:

```bash
npm install
```

4. Buat file `.env` dan tambahkan konfigurasi:

```env
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=your_neon_database_url
```

5. Jalankan project menggunakan Vercel:

```bash
npx vercel dev
```

## 🔑 Environment Variables

| Variable | Keterangan |
|---|---|
| `GEMINI_API_KEY` | API Key untuk mengakses Gemini |
| `DATABASE_URL` | Koneksi database Neon PostgreSQL |

**Penting:** Jangan pernah membagikan API Key atau database URL ke publik. Simpan menggunakan Environment Variables di Vercel.

## 🗄️ Database

NEX AI menggunakan Neon PostgreSQL untuk menyimpan data seperti:

- Percakapan
- Pesan
- Memori AI

Beberapa preferensi pengguna dan pengelompokan workspace disimpan secara lokal menggunakan LocalStorage.

## 🌐 Deployment

Aplikasi dapat di-deploy menggunakan [Vercel](https://vercel.com/).

Hubungkan repository GitHub ke Vercel, atur Environment Variables, kemudian lakukan deployment.

## 📱 Platform

NEX AI merupakan aplikasi berbasis web yang dapat digunakan melalui:

- Desktop
- Laptop
- Smartphone Android

## 👨‍💻 Developer

**NEX AI — Personal AI Assistant**

Dibuat sebagai proyek pengembangan aplikasi AI berbasis web dengan integrasi API, database, dan teknologi web modern.

---

© 2026 NEX AI. All Rights Reserved.
