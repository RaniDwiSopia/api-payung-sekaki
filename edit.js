import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 

const supabase = createClient(supabaseUrl, supabaseKey)

async function editData() {
    console.log("Sedang mengupdate data...")

    const { data, error } = await supabase
        .from('profiles')
        .update({ 
            role: 'Super Admin',    // Data BARU yang diinginkan
            name: 'Admin Ganteng'   // Data BARU yang diinginkan
        })
        .eq('name', 'Admin')        // TARGET LAMA (Siapa yang mau diedit?)
        .select()

    if (error) {
        console.log("Gagal update:", error.message)
    } else {
        console.log("✅ SUKSES BERUBAH!")
        console.log(data)
    }
}

editData()