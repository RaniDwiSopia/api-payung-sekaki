// 1. Panggil library dotenv buat baca file .env
require('dotenv').config()

// 2. Panggil Supabase pakai gaya Node.js (require)
const { createClient } = require('@supabase/supabase-js')

// 3. Ambil URL & Key dari file .env (Biar rahasia)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

console.log("🔄 Mencoba menghubungkan ke Supabase...")

async function cekKoneksi() {
    // KITA TES 2 HAL BIAR PAHAM BEDANYA

    // A. Tes ambil tabel 'news' (Yang settingannya PUBLIC)
    console.log("\n--- Tes 1: Ambil Berita (Public) ---")
    const { data: berita, error: errorBerita } = await supabase
        .from('news') // Pastikan tabel 'news' ada, atau ganti tabel public lain
        .select('*')
        .limit(1)

    if (errorBerita) console.error("❌ Error Berita:", errorBerita.message)
    else console.log("✅ Berita (Harusnya Muncul):", berita)

    // B. Tes ambil tabel 'profiles' (Yang settingannya AUTHENTICATED/LOGIN DOANG)
    console.log("\n--- Tes 2: Ambil Profiles (Private) ---")
    const { data: profil, error: errorProfil } = await supabase
        .from('profiles')
        .select('*')
    
    if (errorProfil) {
        console.error("❌ Error Profil:", errorProfil.message)
    } else {
        // INI PENTING: Kemungkinan besar hasilnya KOSONG []
        console.log("🛡️ Data Profil:", profil)
        if (profil.length === 0) {
            console.log("👉 Catatan: Profil kosong wajar! Karena script ini jalan sebagai 'Tamu' (Anonymous), sedangkan tabel profiles dikunci satpam (harus login).")
        }
    }
}

cekKoneksi()