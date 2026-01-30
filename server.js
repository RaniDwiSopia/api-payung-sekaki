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

// --- JALANKAN SERVER (PALING BAWAH) ---
app.listen(port, () => {
    console.log(`✅ Server Aman Terkendali di port ${port}`)
})