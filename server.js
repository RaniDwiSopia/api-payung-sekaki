require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const port = process.env.PORT || 3001

// --- MIDDLEWARE ---
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// --- KONEKSI DATABASE ---
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- KONFIGURASI UPLOAD (MULTER) ---
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// --- FUNGSI PENCATAT LOG (AUDIT TRAIL) ---
async function catatLog(action, details, ip) {
    const { error } = await supabase
        .from('activity_logs')
        .insert([{ action, details, ip_address: ip }])
    
    if (error) console.error("❌ Gagal mencatat log:", error.message)
    else console.log(`📝 LOG TERCATAT: [${action}] ${details}`)
}

// --- SATPAM (AUTH MIDDLEWARE) ---
const cekSatpam = async (req, res, next) => {
    const token = req.headers.authorization
    if (!token) return res.status(401).json({ pesan: "✋ Token tidak ada." })

    const tokenBersih = token.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(tokenBersih)

    if (error || !user) return res.status(401).json({ pesan: "✋ Token Invalid!" })
    
    next()
}

// ================= ROUTES =================

// --- 1. LOGIN ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) return res.status(401).json({ pesan: "Login Gagal!", error: error.message })

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await catatLog("LOGIN_SUKSES", `Admin ${email} berhasil masuk`, ip);

    res.json({ pesan: "Login Berhasil!", token: data.session.access_token })
})

// --- 2. LOGS ---
app.get('/aktivitas', cekSatpam, async (req, res) => {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})


// --- 3. USERS / PROFILES ---
app.get('/orang', async (req, res) => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/orang', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('profiles').insert(req.body)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data berhasil disimpan!" })
})

app.put('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { name, role, is_active } = req.body
    const { data, error } = await supabase.from('profiles').update({ name, role, is_active }).eq('id', id).select()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data berhasil diupdate!", data })
})

app.delete('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data berhasil dihapus!" })
})

// --- 4. NEWS / BERITA (🔥 SUDAH SUPPORT MODUL) ---
app.get('/news', async (req, res) => {
    const { modul } = req.query // Tangkap ?modul=...
    
    let query = supabase.from('news').select('*').eq('is_published', true).order('published_at', { ascending: false })
    
    if (modul) { query = query.eq('modul', modul) } // Filter Modul

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/news', cekSatpam, upload.single('gambar'), async (req, res) => {
    try {
        const { title, content, modul } = req.body // Tangkap modul
        const file = req.file

        if (!title || !content) return res.status(400).json({ pesan: "Judul & Isi wajib diisi!" })
        
        let publicURL = null
        if (file) {
            const fileExt = file.originalname.split('.').pop()
            const fileName = `news-${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('image').upload(fileName, file.buffer, { contentType: file.mimetype })
            if (uploadError) throw new Error(uploadError.message)
            const { data: urlData } = supabase.storage.from('image').getPublicUrl(fileName)
            publicURL = urlData.publicUrl
        }

        const simpleSlug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

        const { data, error } = await supabase.from('news').insert({
            title, 
            content, 
            modul: modul || 'balai', // Default ke balai kalau kosong
            slug: simpleSlug, 
            cover_image: publicURL, 
            is_published: true, 
            published_at: new Date()
        }).select()

        if (error) throw new Error(error.message)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("TAMBAH_BERITA", `Admin menambah berita baru: "${title}"`, ip);

        res.json({ pesan: "✅ Berita Terbit!", data })

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})


app.put('/news/:id', cekSatpam, upload.single('gambar'), async (req, res) => {
    try {
        const { id } = req.params
        const { title, content, modul } = req.body
        const file = req.file

        if (!title || !content) return res.status(400).json({ pesan: "Judul & Isi wajib diisi!" })

        // 1. Ambil data berita lama untuk mempertahankan gambar jika tidak ada gambar baru yang diunggah
        const { data: beritaLama, error: fetchError } = await supabase
            .from('news')
            .select('cover_image')
            .eq('id', id)
            .single()
            
        if (fetchError || !beritaLama) return res.status(404).json({ pesan: "Berita tidak ditemukan!" })

        let publicURL = beritaLama.cover_image // Default gunakan url gambar lama

        // 2. Jika admin mengunggah berkas gambar baru, lakukan proses upload ke Supabase
        if (file) {
            const fileExt = file.originalname.split('.').pop()
            const fileName = `news-${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('image').upload(fileName, file.buffer, { contentType: file.mimetype })
            if (uploadError) throw new Error(uploadError.message)
            
            const { data: urlData } = supabase.storage.from('image').getPublicUrl(fileName)
            publicURL = urlData.publicUrl
        }

        const simpleSlug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')

        // 3. Eksekusi pembaruan data di Supabase
        const { data, error } = await supabase
            .from('news')
            .update({
                title,
                content,
                modul: modul || 'balai',
                slug: simpleSlug,
                cover_image: publicURL,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()

        if (error) throw new Error(error.message)
        
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("EDIT_BERITA", `Admin mengubah berita ID: ${id}`, ip);

        res.json({ pesan: "✅ Berita berhasil diupdate!", data })

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/news/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await catatLog("HAPUS_BERITA", "Admin menghapus berita ID: " + id, ip);
    res.json({ pesan: "✅ Berita dihapus." })
})

// --- 5. DOKUMENTASI (🔥 SUDAH SUPPORT MODUL) ---
app.get('/documentation', async (req, res) => {
    const { modul } = req.query
    let query = supabase.from('documentation').select('*').order('created_at', { ascending: false })
    
    if (modul) { query = query.eq('modul', modul) }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/documentation', cekSatpam, upload.single('gambar'), async (req, res) => {
    try {
        const { title, description, modul } = req.body
        const file = req.file
        let publicURL = null

        if (file) {
            const fileName = `doc-${Date.now()}-${file.originalname}`
            const { error: upErr } = await supabase.storage.from('image').upload(fileName, file.buffer, { contentType: file.mimetype })
            if (upErr) throw upErr
            const { data: urlData } = supabase.storage.from('image').getPublicUrl(fileName)
            publicURL = urlData.publicUrl
        }

        const { error } = await supabase.from('documentation').insert({ 
            title, 
            description, 
            modul: modul || 'balai',
            image_url: publicURL 
        })
        if (error) throw error
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("TAMBAH_GALERI", "Admin menambah galeri baru: " + title, ip);
        res.json({ pesan: "✅ Dokumentasi disimpan!" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.put('/documentation/:id', cekSatpam, upload.single('gambar'), async (req, res) => {
    try {
        const { id } = req.params
        const { title, description, modul } = req.body
        const file = req.file
        
        // 1. Ambil data lama dulu untuk tahu gambar lamanya apa
        const { data: dataLama, error: getErr } = await supabase
            .from('documentation')
            .select('image_url')
            .eq('id', id)
            .single()
            
        if (getErr || !dataLama) return res.status(404).json({ error: "Data dokumentasi tidak ditemukan" })

        let publicURL = dataLama.image_url // Default pakai gambar lama jika tidak upload baru

        // 2. Jika user upload gambar baru, proses upload ke storage Supabase
        if (file) {
            const fileName = `doc-${Date.now()}-${file.originalname}`
            const { error: upErr } = await supabase.storage
                .from('image')
                .upload(fileName, file.buffer, { contentType: file.mimetype })
                
            if (upErr) throw upErr
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            await catatLog("EDIT_GALERI", "Admin merubah galeri ID: " + id + " menjadi " + title, ip);
            const { data: urlData } = supabase.storage.from('image').getPublicUrl(fileName)
            publicURL = urlData.publicUrl
        }

        // 3. Update data baru ke table database Supabase
        const { error: updateErr } = await supabase
            .from('documentation')
            .update({ 
                title, 
                description, 
                modul: modul || 'balai',
                image_url: publicURL 
            })
            .eq('id', id)

        if (updateErr) throw updateErr
        res.json({ pesan: "✅ Dokumentasi berhasil diperbarui!" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/documentation/:id', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('documentation').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await catatLog("HAPUS_GALERI", "Admin menghapus galeri ID: " + req.params.id, ip);
    res.json({ pesan: "✅ Dokumentasi dihapus." })
})

// --- 6. PAGES (🔥 SUDAH SUPPORT MODUL) ---
app.get('/pages', async (req, res) => {
    const { modul } = req.query
    let query = supabase.from('pages').select('*')
    
    if (modul) { query = query.eq('modul', modul) }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.get('/pages/:slug', async (req, res) => {
    const { data, error } = await supabase.from('pages').select('*').eq('slug', req.params.slug).single()
    if (error) return res.status(404).json({ pesan: "Halaman tidak ditemukan" })
    res.json(data)
})

app.post('/pages', cekSatpam, async (req, res) => {
    const { title, content, modul } = req.body
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
    
    const { error } = await supabase.from('pages').insert({ 
        title, content, slug, modul: modul || 'balai' 
    })
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman dibuat!" })
})

app.put('/pages/:id', cekSatpam, async (req, res) => {
    const { title, content, modul } = req.body
    const { error } = await supabase.from('pages').update({ 
        title, content, modul, updated_at: new Date() 
    }).eq('id', req.params.id)
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman diupdate!" })
})

app.delete('/pages/:id', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('pages').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Halaman dihapus." })
})

// --- 7. PROGRAM KERJA (🔥 SUDAH SUPPORT MODUL) ---
app.get('/programs', async (req, res) => {
    const { modul } = req.query
    let query = supabase.from('programs').select('*').eq('is_active', true)
    
    if (modul) { query = query.eq('modul', modul) }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/programs', cekSatpam, async (req, res) => {
    const { name, description, cover_image, modul } = req.body
    
    const { error } = await supabase.from('programs').insert({ 
        name, description, cover_image, is_active: true, modul: modul || 'balai'
    })
    
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Program ditambahkan!" })
})

app.delete('/programs/:id', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('programs').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Program dihapus." })
})

// --- 8. PENGATURAN WEBSITE ---
app.get('/settings', async (req, res) => {
    const { data, error } = await supabase.from('site_settings').select('*').limit(1).single()
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message })
    res.json(data || {})
})

app.put('/settings', cekSatpam, async (req, res) => {
    const { nama_balai, alamat, visi, misi, deskripsi, struktur_organisasi } = req.body
    const { error } = await supabase.from('site_settings').upsert({ 
        id: 1, nama_balai, alamat, visi, misi, deskripsi, struktur_organisasi, updated_at: new Date() 
    })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Pengaturan disimpan!" })
})

// --- 9. BANNERS (🔥 SUDAH SUPPORT MODUL) ---
app.get('/banners', async (req, res) => {
    const { modul } = req.query
    let query = supabase.from('banners').select('*').eq('is_active', true).order('created_at', { ascending: false })
    
    if (modul) { query = query.eq('modul', modul) }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/banners', cekSatpam, upload.single('gambar'), async (req, res) => {
    try {
        const { title, subtitle, modul } = req.body
        const file = req.file
        
        if (!file) return res.status(400).json({ pesan: "Gambar banner wajib diupload!" })

        const fileName = `banner-${Date.now()}.${file.originalname.split('.').pop()}`
        const { error: upErr } = await supabase.storage.from('image').upload(fileName, file.buffer, { contentType: file.mimetype })
        if (upErr) throw upErr
        
        const { data: urlData } = supabase.storage.from('image').getPublicUrl(fileName)

        const { error } = await supabase.from('banners').insert({
            title, 
            subtitle, 
            image_url: urlData.publicUrl, 
            is_active: true,
            modul: modul || 'balai'
        })
        if (error) throw error

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("UPLOAD_BANNER", `Upload banner: ${title}`, ip);

        res.json({ pesan: "✅ Banner berhasil dipasang!" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/banners/:id', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('banners').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Banner dihapus." })
})

// --- 10. DOWNLOADS (🔥 SUDAH SUPPORT MODUL) ---
app.get('/downloads', async (req, res) => {
    const { modul } = req.query
    let query = supabase.from('downloads').select('*').order('created_at', { ascending: false })
    
    if (modul) { query = query.eq('modul', modul) }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/downloads', cekSatpam, upload.single('dokumen'), async (req, res) => {
    try {
        const { title, category, modul } = req.body
        const file = req.file

        if (!title || !file) return res.status(400).json({ pesan: "Judul dan File wajib diisi!" })

        const fileName = `file-${Date.now()}-${file.originalname}`
        const { error: upErr } = await supabase.storage.from('documents').upload(fileName, file.buffer, { contentType: file.mimetype })
        if (upErr) throw upErr

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)

        const { error } = await supabase.from('downloads').insert({
            title, 
            category, 
            file_url: urlData.publicUrl,
            modul: modul || 'balai'
        })
        if (error) throw error

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("UPLOAD_DOKUMEN", `Upload file: ${title} (${category})`, ip);

        res.json({ pesan: "✅ Dokumen berhasil diupload!" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.delete('/downloads/:id', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('downloads').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Dokumen dihapus." })
})

// --- 11. REGISTRASI PROGRAM (BINA KELUARGA / LANSIA) ---

// [GET] Admin melihat daftar pendaftar
app.get('/registrations', cekSatpam, async (req, res) => {
    // Kita pakai select('*, programs(name, modul)') untuk nge-JOIN nama program dan modulnya
    const { data, error } = await supabase
        .from('registrations')
        .select(`
            *,
            programs (
                name,
                modul
            )
        `)
        .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
})

app.post('/registrations', async (req, res) => {
    try {
        const { 
            program_id, full_name, nik, address, phone_number,
            status_peserta, jenis_kb, tanggal_pelayanan, faskes 
        } = req.body
        if (!program_id || !full_name || !nik) {
            return res.status(400).json({ pesan: "Program, Nama, dan NIK wajib diisi!" })
        }
        const { error } = await supabase.from('registrations').insert({
            program_id,
            full_name,
            nik,
            address,
            phone_number,
            status_peserta,    
            jenis_kb,          
            tanggal_pelayanan, 
            faskes             
        })

        if (error) throw error

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await catatLog("PENDAFTARAN_BARU", `Pendaftar baru: ${full_name} (NIK: ${nik})`, ip);

        res.status(201).json({ pesan: "✅ Pendaftaran berhasil dikirim!" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})


app.delete('/registrations/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    
    // 1. TAMBAHIN .select() DI UJUNG QUERY
    const { data, error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', id)
        .select() 
    
    if (error) return res.status(500).json({ error: error.message })
    if (!data || data.length === 0) {
        return res.status(404).json({ pesan: "❌ Gagal menghapus! Data tidak ditemukan atau akses ditolak oleh DB." })
    }

    res.json({ pesan: "✅ Data pendaftar berhasil dihapus." })
})

// --- START SERVER ---
app.listen(port, () => {
    console.log(`🚀 Server Payung Sekaki jalan di: http://localhost:${port}`)
})