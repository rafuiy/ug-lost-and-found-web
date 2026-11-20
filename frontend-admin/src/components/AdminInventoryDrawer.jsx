import { useRef, useState } from 'react';
import { Button } from './ui/Button';
import { INPUT_CLASS, LABEL_CLASS } from './ui/styles';
import {
  LuX,
  LuChevronDown,
  LuUpload,
  LuTrash2,
  LuCircleAlert,
  LuSave,
  LuArchive,
  LuPackage,
} from 'react-icons/lu';

const INVENTORY_CATEGORIES = [
  'Elektronik',
  'Aksesoris / Dompet',
  'Identitas / Kartu',
  'Kunci / Aksesoris',
  'Tas / Pakaian',
  'Dokumen / Buku',
  'Lainnya',
];

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const LOCKER_GROUPS = [
  {
    label: 'Blok A',
    items: Array.from({ length: 10 }, (_, idx) => {
      const code = `A-${String(idx + 1).padStart(2, '0')}`;
      return { code, fullName: `Loker ${code} (Loket D)` };
    }),
  },
  {
    label: 'Blok B',
    items: Array.from({ length: 10 }, (_, idx) => {
      const code = `B-${String(idx + 1).padStart(2, '0')}`;
      return { code, fullName: `Loker ${code} (Loket D)` };
    }),
  },
  {
    label: 'Blok C',
    items: Array.from({ length: 5 }, (_, idx) => {
      const code = `C-${String(idx + 1).padStart(2, '0')}`;
      return { code, fullName: `Loker ${code} (Loket D)` };
    }),
  },
  {
    label: 'Safe',
    items: Array.from({ length: 5 }, (_, idx) => {
      const code = `Safe-${String(idx + 1).padStart(2, '0')}`;
      return { code, fullName: `Loker ${code} (Loket D)` };
    }),
  },
];

function getCurrentLocalInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function parseDisplayDateToInput(displayDate) {
  if (!displayDate) return getCurrentLocalInputValue();
  const match = displayDate
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return getCurrentLocalInputValue();
  const [, day, month, year, hour = '09', minute = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDateTimeForDisplay(isoLocal) {
  if (!isoLocal) return '';
  const match = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return isoLocal;
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function InventoryDrawerContent({
  mode,
  initialItem,
  nextId,
  inventoryList = [],
  linkedReportTicket,
  onClose,
  onSubmit,
  onDelete,
}) {
  const isEdit = mode === 'edit' && Boolean(initialItem);
  const itemId = isEdit ? initialItem.id : nextId;

  const categoryOptions =
    isEdit &&
    initialItem.category &&
    !INVENTORY_CATEGORIES.includes(initialItem.category)
      ? [initialItem.category, ...INVENTORY_CATEGORIES]
      : INVENTORY_CATEGORIES;

  const [values, setValues] = useState(() => ({
    title: isEdit ? initialItem.title || '' : '',
    category: isEdit ? initialItem.category || INVENTORY_CATEGORIES[0] : INVENTORY_CATEGORIES[0],
    storageLocker: isEdit ? initialItem.storageLocker || '' : '',
    notes: isEdit ? initialItem.notes || '' : '',
    foundLocation: isEdit ? initialItem.foundLocation || '' : '',
    foundDate: isEdit
      ? parseDisplayDateToInput(initialItem.foundDate)
      : getCurrentLocalInputValue(),
    finderName: isEdit ? initialItem.finderName || '' : '',
    finderContact: isEdit ? initialItem.finderContact || '' : '',
  }));

  const [photoUrl, setPhotoUrl] = useState(() =>
    isEdit ? initialItem.photoUrl || '' : ''
  );
  const [errors, setErrors] = useState({});
  const [photoError, setPhotoError] = useState('');
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const fieldRefs = useRef({});

  const lockerItemCounts = inventoryList.reduce((acc, item) => {
    if (item.status === 'Tersimpan' && item.storageLocker) {
      acc[item.storageLocker] = (acc[item.storageLocker] || 0) + 1;
    }
    return acc;
  }, {});

  const selectedLockerCount = values.storageLocker
    ? lockerItemCounts[values.storageLocker] || 0
    : 0;

  const handleSelectLocker = (fullName) => {
    setValues((prev) => ({ ...prev, storageLocker: fullName }));
    if (errors.storageLocker) {
      setErrors((prev) => ({ ...prev, storageLocker: '' }));
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteReason.trim()) {
      setDeleteError('Mohon cantumkan alasan penghapusan inventori.');
      return;
    }
    if (deleteConfirmId !== itemId) {
      setDeleteError(
        `Konfirmasi ID inventori harus persis "${itemId}" (case-sensitive).`
      );
      return;
    }
    setDeleteError('');
    onDelete?.(itemId, deleteReason.trim());
    onClose();
  };

  const updateField = (key) => (e) => {
    const nextVal = e.target.value;
    setValues((prev) => ({ ...prev, [key]: nextVal }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Format file harus berupa gambar (JPG, PNG, atau WEBP).');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Ukuran foto maksimal 2 MB.');
      e.target.value = '';
      return;
    }

    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    const nextErrors = {};
    if (!values.title.trim()) nextErrors.title = 'Nama barang temuan wajib diisi.';
    if (!values.category.trim()) nextErrors.category = 'Kategori barang wajib dipilih.';
    if (!values.storageLocker.trim()) {
      nextErrors.storageLocker = 'Lokasi loker penyimpanan wajib diisi.';
    }
    if (!values.notes.trim()) {
      nextErrors.notes = 'Catatan atau detail fisik barang wajib diisi.';
    }
    if (!values.foundLocation.trim()) {
      nextErrors.foundLocation = 'Lokasi ditemukannya barang wajib diisi.';
    }
    if (!values.foundDate.trim()) {
      nextErrors.foundDate = 'Tanggal dan waktu ditemukan wajib diisi.';
    }
    if (!values.finderName.trim()) {
      nextErrors.finderName = 'Nama penemu barang wajib diisi.';
    }

    setErrors(nextErrors);

    const fieldOrder = [
      'title',
      'category',
      'storageLocker',
      'notes',
      'foundLocation',
      'foundDate',
      'finderName',
    ];
    const firstInvalid = fieldOrder.find((key) => nextErrors[key]);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    onSubmit({
      id: itemId,
      title: values.title.trim(),
      category: values.category,
      storageLocker: values.storageLocker.trim(),
      foundLocation: values.foundLocation.trim(),
      foundDate: formatDateTimeForDisplay(values.foundDate),
      finderName: values.finderName.trim(),
      finderContact: values.finderContact.trim(),
      notes: values.notes.trim(),
      photoUrl,
      status: isEdit ? initialItem.status : 'Tersimpan',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-ug-950/55 transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-10">
        <div className="w-screen max-w-2xl bg-paper border-l-2 border-ug-950 flex flex-col h-full">
          {/* Header */}
          <div className="on-ug px-6 py-5 bg-ug-950 text-sheet border-b border-ug-800 flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="rounded-[3px] bg-gold px-2 py-0.5 text-xs font-bold text-ug-950 tabular-nums">
                  {itemId}
                </span>
                <h2 className="text-base font-bold text-sheet tracking-tight">
                  {isEdit ? 'Edit Detail Inventori' : 'Catat Inventori Temuan'}
                </h2>
              </div>
              <p className="text-xs text-ug-200/80 mt-1.5">
                {isEdit
                  ? 'Hanya barang berstatus Tersimpan yang dapat diubah.'
                  : 'Status awal barang temuan baru otomatis tercatat sebagai "Tersimpan".'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-sheet/80 hover:text-gold hover:bg-ug-900 rounded-[4px] transition-colors cursor-pointer shrink-0"
              aria-label="Tutup panel inventori"
              title="Tutup"
            >
              <LuX className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <form
            id="inventory-drawer-form"
            onSubmit={handleFormSubmit}
            noValidate
            className="flex-1 overflow-y-auto p-6 space-y-5"
          >
            {isEdit && linkedReportTicket && (
              <div className="rounded-[4px] border-[1.5px] border-gold-ink/40 bg-gold-wash p-3 text-xs font-semibold text-gold-ink flex items-start gap-2">
                <LuCircleAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Barang ini sedang tertaut dengan laporan tiket{' '}
                  <strong className="tabular-nums">{linkedReportTicket}</strong>. Pastikan
                  perubahan detail fisik tetap akurat.
                </span>
              </div>
            )}

            {/* Section 1: Identitas & Penyimpanan */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line-strong pb-2">
                <LuPackage className="size-4 text-ug-700" aria-hidden="true" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-[0.08em]">
                  Identitas &amp; Penyimpanan Barang
                </h3>
              </div>

              <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-5 space-y-4">
                <div>
                  <label htmlFor="inv-title" className={LABEL_CLASS}>
                    Nama Barang <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      fieldRefs.current.title = el;
                    }}
                    id="inv-title"
                    type="text"
                    value={values.title}
                    onChange={updateField('title')}
                    placeholder="Contoh: Tumbler Corkcicle Hitam 475ml"
                    aria-invalid={errors.title ? true : undefined}
                    className={`${INPUT_CLASS} h-11 ${errors.title ? 'border-danger' : ''}`}
                  />
                  {errors.title && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.title}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="inv-category" className={LABEL_CLASS}>
                    Kategori <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <select
                      ref={(el) => {
                        fieldRefs.current.category = el;
                      }}
                      id="inv-category"
                      value={values.category}
                      onChange={updateField('category')}
                      aria-invalid={errors.category ? true : undefined}
                      className={`${INPUT_CLASS} h-11 appearance-none pr-9 font-semibold cursor-pointer ${
                        errors.category ? 'border-danger' : ''
                      }`}
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <LuChevronDown
                      className="size-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                  {errors.category && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.category}</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className={LABEL_CLASS + ' mb-0'}>
                      Loker Penyimpanan (30 Loker) <span className="text-danger">*</span>
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-ink-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block w-3.5 h-1.5 rounded-[3px] bg-ok shrink-0"
                          aria-hidden="true"
                        />
                        Kosong
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block w-3.5 h-1.5 rounded-[3px] bg-danger shrink-0"
                          aria-hidden="true"
                        />
                        Terisi (bertambah vertikal sesuai isi)
                      </span>
                    </div>
                  </div>

                  <div
                    ref={(el) => {
                      fieldRefs.current.storageLocker = el;
                    }}
                    tabIndex={-1}
                    className={`rounded-[4px] border-[1.5px] bg-paper p-3 space-y-3 outline-none ${
                      errors.storageLocker ? 'border-danger' : 'border-line-strong'
                    }`}
                  >
                    {LOCKER_GROUPS.map((group) => (
                      <div key={group.label} className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 block">
                          {group.label}
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {group.items.map((locker) => {
                            const count = lockerItemCounts[locker.fullName] || 0;
                            const isSelected = values.storageLocker === locker.fullName;
                            const visibleRedIcons = Math.min(count, 4);
                            return (
                              <button
                                key={locker.code}
                                type="button"
                                onClick={() => handleSelectLocker(locker.fullName)}
                                title={`${locker.fullName} — ${
                                  count === 0 ? 'Kosong' : `${count} barang Tersimpan`
                                }`}
                                className={`px-2 py-2.5 rounded-[4px] border text-center transition-colors cursor-pointer flex flex-col items-center justify-between gap-2 min-h-[54px] ${
                                  isSelected
                                    ? 'border-ug-800 bg-ug-100 ring-1 ring-ug-700'
                                    : 'border-line-strong bg-sheet hover:border-ink-2'
                                }`}
                              >
                                <span className="text-[11px] font-bold text-ink tabular-nums leading-none">
                                  {locker.code}
                                </span>
                                <span className="flex flex-col items-center justify-end gap-1">
                                  {count === 0 ? (
                                    <span
                                      className="block w-4 h-1.5 rounded-[3px] bg-ok"
                                      aria-label="Kosong"
                                    />
                                  ) : (
                                    <>
                                      {Array.from({ length: visibleRedIcons }).map((_, idx) => (
                                        <span
                                          key={idx}
                                          className="block w-4 h-1.5 rounded-[3px] bg-danger"
                                          aria-hidden="true"
                                        />
                                      ))}
                                      {count > 4 && (
                                        <span className="text-[10px] font-bold text-danger leading-none">
                                          +{count - 4}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {values.storageLocker && (
                    <p className="mt-1.5 text-xs text-ink-2">
                      Terpilih: <strong className="text-ug-800">{values.storageLocker}</strong>
                      {selectedLockerCount > 0 &&
                        ` — sudah berisi ${selectedLockerCount} barang Tersimpan (tetap dapat ditambah jika slot penuh).`}
                    </p>
                  )}

                  {errors.storageLocker && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.storageLocker}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="inv-notes" className={LABEL_CLASS}>
                    Catatan &amp; Detail Fisik <span className="text-danger">*</span>
                  </label>
                  <textarea
                    ref={(el) => {
                      fieldRefs.current.notes = el;
                    }}
                    id="inv-notes"
                    rows={3}
                    value={values.notes}
                    onChange={updateField('notes')}
                    placeholder="Warna, kondisi fisik, kelengkapan, atau ciri khusus temuan..."
                    aria-invalid={errors.notes ? true : undefined}
                    className={`${INPUT_CLASS} min-h-24 py-2.5 leading-relaxed ${
                      errors.notes ? 'border-danger' : ''
                    }`}
                  />
                  {errors.notes && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Informasi Penemuan */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line-strong pb-2">
                <LuArchive className="size-4 text-ug-700" aria-hidden="true" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-[0.08em]">
                  Informasi Penemuan
                </h3>
              </div>

              <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-5 space-y-4">
                <div>
                  <label htmlFor="inv-location" className={LABEL_CLASS}>
                    Lokasi Ditemukan <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      fieldRefs.current.foundLocation = el;
                    }}
                    id="inv-location"
                    type="text"
                    value={values.foundLocation}
                    onChange={updateField('foundLocation')}
                    placeholder="Contoh: Kampus D Margonda - Perpustakaan Lt. 2"
                    aria-invalid={errors.foundLocation ? true : undefined}
                    className={`${INPUT_CLASS} h-11 ${
                      errors.foundLocation ? 'border-danger' : ''
                    }`}
                  />
                  {errors.foundLocation && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.foundLocation}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="inv-found-date" className={LABEL_CLASS}>
                    Tanggal &amp; Waktu Ditemukan <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      fieldRefs.current.foundDate = el;
                    }}
                    id="inv-found-date"
                    type="datetime-local"
                    value={values.foundDate}
                    onChange={updateField('foundDate')}
                    aria-invalid={errors.foundDate ? true : undefined}
                    className={`${INPUT_CLASS} h-11 tabular-nums ${
                      errors.foundDate ? 'border-danger' : ''
                    }`}
                  />
                  {errors.foundDate && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span>{errors.foundDate}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-finder-name" className={LABEL_CLASS}>
                      Nama Penemu <span className="text-danger">*</span>
                    </label>
                    <input
                      ref={(el) => {
                        fieldRefs.current.finderName = el;
                      }}
                      id="inv-finder-name"
                      type="text"
                      value={values.finderName}
                      onChange={updateField('finderName')}
                      placeholder="Contoh: Suryo (Keamanan)"
                      aria-invalid={errors.finderName ? true : undefined}
                      className={`${INPUT_CLASS} h-11 ${
                        errors.finderName ? 'border-danger' : ''
                      }`}
                    />
                    {errors.finderName && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                        <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                        <span>{errors.finderName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="inv-finder-contact" className={LABEL_CLASS}>
                      Kontak Penemu{' '}
                      <span className="font-medium text-ink-3">· opsional</span>
                    </label>
                    <input
                      id="inv-finder-contact"
                      type="text"
                      value={values.finderContact}
                      onChange={updateField('finderContact')}
                      placeholder="No. HP / WhatsApp penemu"
                      className={`${INPUT_CLASS} h-11 tabular-nums`}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Foto Barang Temuan */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-line-strong pb-2">
                <h3 className="text-xs font-bold text-ink uppercase tracking-[0.08em]">
                  Foto Barang Temuan (Opsional)
                </h3>
                <span className="text-xs text-ink-3">JPG, PNG, WEBP · maks. 2 MB</span>
              </div>

              <div className="rounded-[5px] border-[1.5px] border-line-strong bg-sheet p-5 space-y-3">
                {photoUrl ? (
                  <div className="bg-paper border-[1.5px] border-line-strong rounded-[4px] p-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-[4px] border border-line-strong bg-sheet overflow-hidden shrink-0">
                        <img
                          src={photoUrl}
                          alt="Preview foto barang temuan"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">Foto barang siap disimpan</p>
                        <p className="text-xs text-ink-3 mt-0.5">
                          Hanya tersimpan untuk verifikasi internal petugas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[5px] border-[1.5px] border-line-strong bg-sheet text-xs font-bold text-ink hover:border-ink hover:bg-paper transition-colors">
                        <LuUpload className="size-4" aria-hidden="true" />
                        <span>Ganti Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setPhotoUrl('');
                          setPhotoError('');
                        }}
                      >
                        <LuTrash2 className="size-4" aria-hidden="true" />
                        <span>Hapus</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center gap-4 rounded-[4px] border-[1.5px] border-dashed border-line-strong bg-paper p-4 hover:border-ug-700 transition-colors">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-ug-100 text-ug-700">
                      <LuUpload className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs leading-relaxed">
                      <span className="block font-bold text-ink text-sm">
                        Unggah foto kondisi barang temuan
                      </span>
                      <span className="block text-ink-3 mt-0.5">
                        Opsional — jika belum ada foto, kartu inventori akan menampilkan ikon arsip.
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}

                {photoError && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>{photoError}</span>
                  </p>
                )}
              </div>
            </section>

            {isEdit && onDelete && (
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-danger/30 pb-2">
                  <h3 className="text-xs font-bold text-danger uppercase tracking-[0.08em] flex items-center gap-2">
                    <LuTrash2 className="size-4" aria-hidden="true" />
                    <span>Hapus Barang Inventori</span>
                  </h3>
                </div>

                {!deletePrompt ? (
                  <div className="rounded-[5px] border-[1.5px] border-danger/40 bg-danger-wash/60 p-4 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-ink-2 leading-relaxed">
                      Hapus item <strong className="tabular-nums">{itemId}</strong> secara
                      permanen jika terjadi kesalahan input atau duplikasi data.
                    </p>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeletePrompt(true)}
                      className="shrink-0"
                    >
                      <LuTrash2 className="size-4" aria-hidden="true" />
                      <span>Hapus Inventori</span>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-[5px] border-2 border-danger bg-danger-wash p-4 space-y-3">
                    <p className="text-xs font-bold text-danger">
                      Verifikasi Penghapusan Inventori ({itemId})
                    </p>
                    {linkedReportTicket && (
                      <p className="text-xs text-ink-2 bg-sheet p-2.5 rounded-[4px] border border-danger/40">
                        Perhatian: Barang ini sedang tertaut dengan tiket{' '}
                        <strong className="tabular-nums">{linkedReportTicket}</strong>. Jika
                        dihapus, tautan akan dilepas dan tiket berstatus Perlu Verifikasi akan
                        dikembalikan ke <strong>Belum Ada</strong>.
                      </p>
                    )}

                    <div>
                      <label htmlFor="inv-delete-reason" className={LABEL_CLASS}>
                        Alasan Penghapusan <span className="text-danger">*</span>
                      </label>
                      <input
                        id="inv-delete-reason"
                        type="text"
                        value={deleteReason}
                        onChange={(e) => {
                          setDeleteReason(e.target.value);
                          if (deleteError) setDeleteError('');
                        }}
                        placeholder="Contoh: Salah input data barang / duplikasi entri"
                        className={`${INPUT_CLASS} h-10`}
                      />
                    </div>

                    <div>
                      <label htmlFor="inv-delete-confirm-id" className={LABEL_CLASS}>
                        Ketik ID Inventori Lengkap (<span className="tabular-nums">{itemId}</span>){' '}
                        — Case-Sensitive <span className="text-danger">*</span>
                      </label>
                      <input
                        id="inv-delete-confirm-id"
                        type="text"
                        value={deleteConfirmId}
                        onChange={(e) => {
                          setDeleteConfirmId(e.target.value);
                          if (deleteError) setDeleteError('');
                        }}
                        placeholder={`Contoh: INV-085 (ketik ${itemId})`}
                        className={`${INPUT_CLASS} h-10 font-mono tabular-nums`}
                      />
                    </div>

                    {deleteError && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                        <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                        <span>{deleteError}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => {
                          setDeletePrompt(false);
                          setDeleteReason('');
                          setDeleteConfirmId('');
                          setDeleteError('');
                        }}
                      >
                        Batal
                      </Button>
                      <Button
                        variant="dangerSolid"
                        size="sm"
                        disabled={!deleteReason.trim() || deleteConfirmId !== itemId}
                        onClick={handleConfirmDelete}
                      >
                        <LuTrash2 className="size-4" aria-hidden="true" />
                        <span>Ya, Hapus Permanen</span>
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </form>

          {/* Sticky Bottom Bar */}
          <div className="p-4 sm:p-5 bg-sheet border-t-[1.5px] border-line-strong shrink-0 flex items-center justify-end gap-3">
            <Button variant="outline" size="md" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              form="inventory-drawer-form"
              variant="gold"
              size="md"
            >
              <LuSave className="size-4" aria-hidden="true" />
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan ke Inventori'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const AdminInventoryDrawer = ({
  isOpen,
  mode = 'create',
  initialItem = null,
  nextId,
  inventoryList = [],
  linkedReportTicket = null,
  onClose,
  onSubmit,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <InventoryDrawerContent
      key={mode === 'edit' ? initialItem?.id || 'edit' : 'create'}
      mode={mode}
      initialItem={initialItem}
      nextId={nextId}
      inventoryList={inventoryList}
      linkedReportTicket={linkedReportTicket}
      onClose={onClose}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  );
};
