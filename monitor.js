import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hwrufqtxhuachgluuruh.supabase.co' 
const supabaseKey = 'sb_publishable_lgSnLOsxOG69KgKqu4_wNw_J17ImSD3' 

const supabase = createClient(supabaseUrl, supabaseKey)

console.log("Silakan tambah/edit/hapus data di Dashboard Supabase, nanti muncul di sini.")

const channel = supabase
  .channel('room-satu') // Nama channel bebas
  .on(
    'postgres_changes', 
    { event: '*', schema: 'public', table: 'profiles' }, 
    (payload) => {
      // Payload adalah paket data yang dikirim Supabase
      console.log('\n-----------------------------')
      console.log('Jenis Kejadian:', payload.eventType) // INSERT / UPDATE / DELETE
      console.log('Data Baru:', payload.new)
      console.log('-----------------------------')
    }
  )
  .subscribe()