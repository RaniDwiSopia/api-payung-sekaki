import express from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import cors from 'cors' // 👈 1. INI DIPANGGIL

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// 👈 2. INI DIPASANG BIAR BROWSER SENANG
app.use(cors()) 
app.use(express.json())

// --- KONEKSI DATABASE ---
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- MIDDLEWARE (SATPAM TOKEN) ---
const cekSatpam = async (req, res, next) => {
    const token = req.headers.authorization
    if (!token) return res.status(401).json({ pesan: "✋ Token tidak ada." })

    const tokenBersih = token.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(tokenBersih)

    if (error || !user) return res.status(401).json({ pesan: "✋ Token Palsu/Kadaluarsa!" })
    next()
}

// --- ROUTES ---

// LOGIN
app.post('/login', async (req, res) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) res.status(401).json({ pesan: "Login Gagal!", error: error.message })
    else res.json({ pesan: "Login Berhasil!", token: data.session.access_token })
})

// GET (PUBLIK - Bisa diakses Website tanpa token)
app.get('/orang', async (req, res) => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) res.status(500).json({ error: error.message })
    else res.json(data)
})

// POST (PRIVATE)
app.post('/orang', cekSatpam, async (req, res) => {
    const { error } = await supabase.from('profiles').insert(req.body)
    if (error) res.status(500).json({ error: error.message })
    else res.json({ pesan: "✅ Data disimpan!" })
})

// PUT (PRIVATE)
app.put('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { name, role, is_active } = req.body
    const { data, error } = await supabase.from('profiles').update({ name, role, is_active }).eq('id', id).select()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data diupdate!", data: data })
})

// DELETE (PRIVATE)
app.delete('/orang/:id', cekSatpam, async (req, res) => {
    const { id } = req.params
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ pesan: "✅ Data dihapus!" })
})

app.listen(port, () => {
    console.log(`✅ Server Jalan di port ${port}`)
})