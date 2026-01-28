import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 

const supabase = createClient(supabaseUrl, supabaseKey)

async function tambahLagi() {
    console.log("Sedang memasukkan data kembali...")

    const { data, error } = await supabase
        .from('profiles')
        .insert([
            { 
                name: 'Admin Ganteng',  // Nama yang tadi dihapus
                role: 'Super Admin',    // Role-nya
                is_active: true         // Status aktif
            }
        ])
        .select() // Biar kita bisa lihat hasil inputnya langsung

    if (error) {
        console.log("Gagal nambah:", error.message)
    } else {
        console.log("✅ SUKSES! Si 'Admin Ganteng' sudah kembali (tapi dengan ID baru).")
        console.log(data)
    }
}

tambahLagi()