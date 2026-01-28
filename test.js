// Script ini pura-pura jadi "Aplikasi HP" yang kirim data ke Server Abang
async function kirimPaket() {
    console.log("🚀 Sedang mengirim data ke Localhost...")

    const response = await fetch('http://localhost:3001/orang', {
        method: 'POST', // Metode Kirim
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: "Budi Server",
            role: "security",
            is_active: true
        })
    })

    const hasil = await response.json()
    console.log("Balasan dari Server:")
    console.log(hasil)
}

kirimPaket()