const puppeteer = require('puppeteer');
const xlsx = require('xlsx'); // Library untuk membaca file Excel

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // Jalankan browser dalam mode non-headless untuk debugging
  const page = await browser.newPage();

  // Fungsi untuk retry navigasi jika terjadi error
  async function navigateWithRetry(page, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Mencoba mengakses: ${url} (Percobaan ${i + 1})`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        return; // Berhasil navigasi
      } catch (error) {
        console.error(`Navigasi gagal: ${error.message}`);
        if (i === retries - 1) throw error; // Jika gagal setelah semua percobaan
      }
    }
  }

  // **1. Login ke Akun Petugas**
  const loginUrl = 'https://serpus.ictsemart.my.id/login';
  console.log('Mengakses halaman login...');

  try {
    await navigateWithRetry(page, loginUrl);

    console.log('Halaman login berhasil diakses. Mengisi form login...');
    const username = 'admin@nandz.my.id'; // Ganti dengan username petugas
    const password = 'Nandar@123'; // Ganti dengan password petugas

    await page.waitForSelector('input[name="email"]', { visible: true, timeout: 60000 });
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');

    console.log('Berhasil login. Menunggu redirect ke dashboard...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
  } catch (error) {
    console.error('Error saat login:', error);
    await browser.close();
    return;
  }

  // **2. Navigasi ke Form Input Anggota Baru**
  const formUrl = 'https://serpus.ictsemart.my.id/admin/members/new';

  // **3. Membaca File Excel**
  const workbook = xlsx.readFile('data_anggota.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // **4. Iterasi dan Isi Form**
  for (let anggota of data) {
    console.log(`Memproses data: ${anggota.nama_depan} ${anggota.nama_belakang}`);

    try {
      // Navigasi ulang ke halaman form setiap iterasi
      await navigateWithRetry(page, formUrl);

      // Tunggu dan isi form dengan data anggota
      await page.waitForSelector('input[name="first_name"]', { visible: true });
      await page.type('input[name="first_name"]', String(anggota.nama_depan || ''));

      await page.waitForSelector('input[name="last_name"]', { visible: true });
      await page.type('input[name="last_name"]', String(anggota.nama_belakang || ''));

      await page.waitForSelector('input[name="email"]', { visible: true });
      await page.type('input[name="email"]', String(anggota.email || ''));

      await page.waitForSelector('input[name="phone"]', { visible: true });
      await page.type('input[name="phone"]', String(anggota.nomor_telepon || ''));

      await page.waitForSelector('textarea[name="address"]', { visible: true });
      await page.type('textarea[name="address"]', String(anggota.alamat || ''));

      await page.waitForSelector('input[name="date_of_birth"]', { visible: true });
      await page.type('input[name="date_of_birth"]', String(anggota.tanggal_lahir || ''));

      // Pilih jenis kelamin
      const genderMapping = {
        'laki-laki': '1',
        'perempuan': '2'
      };

      const genderValue = genderMapping[anggota.jenis_kelamin.toLowerCase()] || '1'; // Default ke "Laki-laki"
      const genderSelector = `input[name="gender"][value="${genderValue}"]`;

      try {
        await page.waitForSelector(genderSelector, { visible: true });
        await page.click(genderSelector);
        console.log(`Gender selected: ${anggota.jenis_kelamin}`);
      } catch (error) {
        console.error(`Error selecting gender with selector: ${genderSelector}`, error);
      }

      // Klik tombol simpan dan tunggu proses penyimpanan
      await page.click('button[type="submit"]');
      console.log(`Data anggota ${anggota.nama_depan} berhasil disimpan.`);

      // Tunggu proses simpan selesai
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

      // Navigasi ulang ke halaman form input untuk data berikutnya
      console.log('Kembali ke halaman form untuk data berikutnya...');
      await navigateWithRetry(page, formUrl);

    } catch (error) {
      console.error(`Error saat memproses data anggota ${anggota.nama_depan}`, error);
    }

    // Tunggu sebelum lanjut ke data berikutnya
    await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik
  }

  console.log('Semua data selesai diproses!');
  await browser.close();
})();
