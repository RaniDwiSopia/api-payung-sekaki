import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 

const supabase = createClient(supabaseUrl, supabaseKey)

async function hapusData() {
    console.log("Sedang menghapus data...")

    // --- BAGIAN PENTING ---
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('name', 'Admin Ganteng')  // <--- Ganti nama ini dengan target yang mau dibuang
    
    if (error) {
        console.log("Gagal hapus:", error.message)
    } else {
        console.log("✅ SUKSES! Data sudah lenyap dari database.")
    }
}

hapusData()