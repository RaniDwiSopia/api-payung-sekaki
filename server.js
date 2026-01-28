import express from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv' // 1. Panggil paket rahasia

dotenv.config() // 2. Aktifkan mode baca .env

const app = express()
const port = process.env.PORT || 3001 // Ambil port dari .env, kalau gak ada pake 3001
app.use(express.json())

// 3. AMBIL KUNCI DARI .ENV (JANGAN DITULIS MANUAL LAGI)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// --- 1. ROUTE LOGIN (Buat Admin minta Token) ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body

    // Minta Supabase cek email/pass
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    })

    if (error) {
        res.status(401).json({ pesan: "Login Gagal!", error: error.message })
    } else {
        // Kalau sukses, kasih Token ke Admin
        res.json({
            pesan: "Login Berhasil!",
            token: data.session.access_token 
        })
    }
})

// --- 2. MIDDLEWARE (SATPAM) ---
const cekSatpam = async (req, res, next) => {
    const token = req.headers.authorization

    if (!token) {
        return res.status(401).json({ pesan: "✋ MAAF! Anda tidak punya akses (Token tidak ada)." })
    }

    const tokenBersih = token.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(tokenBersih)

    if (error || !user) {
        return res.status(401).json({ pesan: "✋ Token Palsu atau Kadaluarsa!" })
    }

    next()
}

// --- 3. ROUTES ---

// ✅ GET (PUBLIK)
app.get('/orang', async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) res.status(500).json({ error: error.message })
  else res.json(data)
})

// 🔒 POST (PRIVATE)
app.post('/orang', cekSatpam, async (req, res) => {
  const { error } = await supabase.from('profiles').insert(req.body)
  if (error) res.status(500).json({ error: error.message })
  else res.json({ pesan: "✅ Data berhasil disimpan oleh Admin!" })
})

// 🔒 DELETE (PRIVATE)
app.delete('/orang', cekSatpam, async (req, res) => {
  const { id } = req.body
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) res.status(500).json({ error: error.message })
  else res.json({ pesan: "✅ Data berhasil dihapus Admin!" })
})

app.listen(port, () => {
  console.log(`✅ Server Aman Terkendali di: http://localhost:${port}`)
})

