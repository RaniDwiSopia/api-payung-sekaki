import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 


const supabase = createClient(supabaseUrl, supabaseKey)

console.log("Mencoba menghubungkan...")

async function cekKoneksi() {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) {
        console.error("Error:", error.message)
    } else {
        console.log("Berhasil! Ini datanya:", data)
    }
}

cekKoneksi()