import express from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import cors from 'cors' // Opsional: biar aman kalau nanti diakses dari frontend

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// Biar bisa baca JSON body
app.use(express.json())
app.use(cors()) // Opsional

// --- KONEKSI DATABASE ---
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- MIDDLEWARE (SATPAM) ---
const cekSatpam = async (req, res, next) => {
    const token = req.headers.authorization

    if (!token) {
        return res.status(401).json({ pesan: "✋ MAAF! Token tidak ada." })
    }

    // Buang kata "Bearer " di depan token
    const tokenBersih = token.replace('Bearer ', '')
    
    // Cek keaslian token ke Supabase
    const { data: { user }, error } = await supabase.auth.getUser(tokenBersih)

    if (error || !user) {
        return res.status(401).json({ pesan: "✋ Token Palsu atau Kadaluarsa!" })
    }

    next() // Silakan lewat
}

// --- ROUTES ---

// 1. LOGIN (Dapat Token)
app.post('/login', async (req, res) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    })

    if (error) {
        res.status(401).json({ pesan: "Login Gagal!", error: error.message })
    } else {
        res.json({
            pesan: "Login Berhasil!",
            token: data.session.access_token
        })
    }
})

// 2. GET (Lihat Data - PUBLIC)
app.get('/orang', async (req, res) => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) res.status(500).json({ error: error.message })
    else res.json(data)
})

// 3. POST (Tambah Data - PRIVATE)
app.post('/orang', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('profiles').insert(req.body)
    if (error) res.status(500).json({ error: error.message })
    else res.json({ pesan: "✅ Data berhasil disimpan oleh Admin!" })
})

// 4. PUT (Update Data - PRIVATE - Pakai ID di URL)
app.put('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { name, role, is_active } = req.body

    const { data, error } = await supabase
        .from('profiles')
        .update({ name, role, is_active })
        .eq('id', id)
        .select()

    if (error) return res.status(500).json({ error: error.message })
    
    res.json({ pesan: "✅ Data berhasil diupdate!", data: data })
})

// 5. DELETE (Hapus Data - PRIVATE - Pakai ID di URL)
app.delete('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    
    res.json({ pesan: "✅ Data berhasil dihapus selamanya!" })
})

// --- FITUR DOKUMENTASI BALAI ---

// 1. GET (Ambil Data Dokumentasi)
app.get('/documentation', async (req, res) => {
    const { data, error } = await supabase
        .from('documentation')  // <--- Nama tabel abang
        .select('*')
        .order('created_at', { ascending: false }) // Urutkan dari yang terbaru
    
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

// 2. POST (Upload Dokumentasi Baru)
app.post('/documentation', cekSatpam, async (req, res) => {
    // Ambil data dari Frontend sesuai nama kolom abang
    const { title, description, image_url } = req.body 

    // Validasi sederhana
    if (!title || !description) {
        return res.status(400).json({ pesan: "Judul dan Deskripsi wajib diisi!" })
    }

    const { error } = await supabase
        .from('documentation')
        .insert({ 
            title: title,             // Masuk ke kolom 'title'
            description: description, // Masuk ke kolom 'description'
            image_url: image_url      // Masuk ke kolom 'image_url'
        })
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Dokumentasi berhasil ditayangkan!" })
})

// 3. DELETE (Hapus Dokumentasi)
app.delete('/documentation/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase
        .from('documentation')
        .delete()
        .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data dihapus." })
})

// --- FITUR BERITA (NEWS) ---

// 1. GET (Ambil Berita yang Tayang Saja)
app.get('/news', async (req, res) => {
    const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_published', true) // Cuma ambil yang statusnya Published
        .order('published_at', { ascending: false }) // Yang terbaru paling atas
    
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

// 2. POST (Tambah Berita Baru)
app.post('/news', cekSatpam, async (req, res) => {
    // Frontend kirim data ini
    const { title, content, cover_image } = req.body 
    
    // VALIDASI: Judul & Konten gak boleh kosong
    if (!title || !content) {
        return res.status(400).json({ pesan: "Judul dan Isi Berita wajib diisi!" })
    }

    // LOGIC BACKEND: Bikin Slug otomatis dari Title
    // Contoh: "Kegiatan Posyandu" jadi "kegiatan-posyandu"
    const simpleSlug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

    const { error } = await supabase
        .from('news')
        .insert({ 
            title: title,
            content: content,
            cover_image: cover_image,
            slug: simpleSlug,           // Otomatis dibikin backend
            is_published: true,         // Langsung tayang
            published_at: new Date()    // Waktu sekarang
        })
        
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Berita berhasil diterbitkan!" })
})

// 3. DELETE (Hapus Berita)
app.delete('/news/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Berita dihapus." })
})

// --- FITUR HALAMAN (PAGES) ---

// 1. GET (Ambil Semua Halaman)
// Biasanya dipanggil Frontend buat nampilin menu atau list halaman di Admin Panel
app.get('/pages', async (req, res) => {
    const { data, error } = await supabase
        .from('pages')
        .select('*')
    
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

// 2. GET BY SLUG (Ambil 1 Halaman untuk ditampilkan)
// Contoh: Frontend mau buka halaman "Visi Misi", dia panggil /pages/visi-misi
app.get('/pages/:slug', async (req, res) => {
    const { slug } = req.params
    const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', slug) // Cari berdasarkan slug
        .single()
    
    if (error) return res.status(404).json({ pesam: "Halaman tidak ditemukan" })
    res.json(data)
})

// 3. POST (Buat Halaman Baru - Butuh Token)
app.post('/pages', cekSatpam, async (req, res) => {
    const { title, content } = req.body 

    if (!title || !content) {
        return res.status(400).json({ pesan: "Judul dan Konten wajib diisi!" })
    }

    // Bikin Slug Otomatis (Contoh: "Tentang Kami" -> "tentang-kami")
    const autoSlug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

    const { error } = await supabase
        .from('pages')
        .insert({ 
            title: title, 
            content: content, 
            slug: autoSlug 
        })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman berhasil dibuat!" })
})

// 4. PUT (Update Halaman - Butuh Token)
app.put('/pages/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { title, content } = req.body

    // Kita update title & content aja, slug sebaiknya jangan diubah biar link gak mati
    const { error } = await supabase
        .from('pages')
        .update({ title, content, updated_at: new Date() })
        .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman berhasil diupdate!" })
})

// 5. DELETE (Hapus Halaman)
app.delete('/pages/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('pages').delete().eq('id', id)
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman dihapus." })
})

// --- FITUR PROGRAM KERJA ---

// 1. GET (Ambil Program yang Aktif Saja)
app.get('/programs', async (req, res) => {
    const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('is_active', true) // Cuma tampilkan yang statusnya Aktif
        .order('created_at', { ascending: false })
    
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

// 2. POST (Tambah Program Baru - Butuh Token)
app.post('/programs', cekSatpam, async (req, res) => {
    // ⚠️ PERHATIAN: Cek kolom pertama di tabel abang, apakah 'name' atau 'title'?
    // Sesuaikan kodingan di bawah ini (req.body dan insert object)
    const { name, description, cover_image } = req.body 

    if (!name || !description) {
        return res.status(400).json({ pesan: "Nama Program dan Deskripsi wajib diisi!" })
    }

    const { error } = await supabase
        .from('programs')
        .insert({ 
            name: name,               // <--- Ganti jadi 'title' kalau di DB namanya title
            description: description,
            cover_image: cover_image,
            is_active: true           // Default langsung aktif saat dibuat
        })
        
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Program kerja baru ditambahkan!" })
})

// 3. DELETE (Hapus Program)
app.delete('/programs/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('programs').delete().eq('id', id)
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Program dihapus." })
})

// --- FITUR PENGATURAN WEBSITE (SITE SETTINGS) ---

// 1. GET (Ambil Data Pengaturan)
app.get('/settings', async (req, res) => {
    const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)   // Ambil 1 baris saja
        .single()   // Pastikan return object, bukan array
    
    // Kalau tabel masih kosong, data mungkin null, tapi tidak error
    if (error && error.code !== 'PGRST116') { // PGRST116 itu error kalau data kosong (kita abaikan)
        return res.status(500).json({ error: error.message })
    }
    
    res.json(data || {}) // Kirim object kosong kalau belum ada settingan
})

// 2. PUT (Simpan/Update Pengaturan - Butuh Token)
app.put('/settings', cekSatpam, async (req, res) => {
    const { 
        nama_balai, 
        alamat, 
        visi, 
        misi, 
        deskripsi, 
        struktur_organisasi 
    } = req.body

    // Teknik UPSERT: Paksa ID = 1.
    // Jadi mau di-save berapa kali pun, barisnya tetap cuma satu (ID 1).
    const { error } = await supabase
        .from('site_settings')
        .upsert({ 
            id: 1, 
            nama_balai, 
            alamat, 
            visi, 
            misi, 
            deskripsi,
            struktur_organisasi,
            updated_at: new Date()
        })
        
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Pengaturan website berhasil disimpan!" })
})

// --- JALANKAN SERVER (PALING BAWAH) ---
app.listen(port, () => {
    console.log(`✅ Server Aman Terkendali di port ${port}`)
})