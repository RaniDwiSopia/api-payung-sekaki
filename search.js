import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 

const supabase = createClient(supabaseUrl, supabaseKey)

async function cariData() {
    console.log("🔍 Sedang mencari data...")

    const { data, error } = await supabase
        .from('profiles')
        .select('*') // Ambil semua kolom
        
        // --- FILTERING (Penyaringan) ---
        // Mencari yang kolom 'name' mengandung huruf 'm' (besar/kecil gak masalah aka ilike)
        // % artinya "teks apapun". Jadi %m% artinya "ada m di tengah/awal/akhir"
        .ilike('name', '%m%') 

        // --- SORTING (Pengurutan) ---
        // Urutkan berdasarkan 'created_at', ascending: false (artinya Descending/Terbaru diatas)
        .order('created_at', { ascending: false })

        // --- LIMITING (Pembatasan) ---
        // Cuma ambil maksimal 5 data
        .limit(5)

    if (error) {
        console.log("Error nyari:", error.message)
    } else {
        console.log(`✅ Ketemu ${data.length} orang:`)
        console.log(data)
    }
}

cariData()