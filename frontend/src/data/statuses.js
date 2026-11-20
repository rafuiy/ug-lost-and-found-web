export const STATUS = {
  'Belum Ada': {
    tone: 'neutral',
    title: 'Laporan diterima',
    message: 'Laporanmu sudah tercatat, tetapi belum ada barang temuan yang cocok. Kami akan mengirim email saat ada kecocokan.',
  },
  'Perlu Verifikasi': {
    tone: 'ug',
    title: 'Datang ke loket',
    message: 'Ada barang yang cocok secara awal. Petugas tetap memeriksa KTM asli dan ciri rahasia barang sebelum menyerahkannya.',
  },
  Selesai: {
    tone: 'ok',
    title: 'Barang sudah diserahkan',
    message: 'Serah terima sudah tercatat. Laporan ini ditutup.',
  },
  Ditolak: {
    tone: 'danger',
    title: 'Laporan ditolak',
    message: 'Laporan atau verifikasi di loket tidak dapat diterima.',
  },
}

export const STALE_LABEL = 'Lawas >30 Hari'
export const STALE_MESSAGE = 'Laporan ini sudah lebih dari 30 hari tanpa kecocokan. Datanya tetap tersimpan dan tetap bisa dicocokkan saat ada barang baru.'
