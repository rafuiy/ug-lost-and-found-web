import { request, requestPrivateFileBlobUrl } from './httpClient';

const LOCKER_PREFIX_RE = /^\[(Loker [^\]]+)\]\s*(.*)$/s;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatIsoToDisplay(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

export function formatIsoToDateOnly(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatIsoToWibAudit(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get(
    'second'
  )} WIB`;
}

export function parseDisplayDateToIso(displayDate) {
  if (!displayDate) return new Date().toISOString();
  const match = displayDate
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return new Date().toISOString();
  const [, day, month, year, hour = '09', minute = '00'] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  if (parsed.getTime() > Date.now()) {
    return new Date(Date.now() - 60000).toISOString();
  }
  return parsed.toISOString();
}

function splitLockerFromDetails(rawDetails = '') {
  const match = LOCKER_PREFIX_RE.exec(String(rawDetails).trim());
  if (match) {
    return {
      storageLocker: match[1],
      notes: match[2] || '',
    };
  }
  return {
    storageLocker: 'Loker A-01 (Loket D)',
    notes: String(rawDetails || ''),
  };
}

export function mapBackendInventory(inv) {
  if (!inv) return null;
  const fallback = splitLockerFromDetails(inv.item_details);
  const hasExplicitLocker = Boolean(inv.storage_locker && String(inv.storage_locker).trim());
  return {
    id: inv.id,
    title: inv.item_name || '',
    category: inv.internal_category || 'Lainnya',
    foundLocation: inv.found_location || '',
    foundDate: formatIsoToDisplay(inv.found_datetime || inv.created_at),
    finderName: inv.finder_name || '',
    finderContact: inv.finder_contact === '-' ? '' : inv.finder_contact || '',
    storageLocker: hasExplicitLocker ? String(inv.storage_locker).trim() : fallback.storageLocker,
    status: inv.status || 'Tersimpan',
    notes: hasExplicitLocker ? fallback.notes : fallback.notes,
    photoUrl: inv.photo_url || '',
  };
}

export function mapBackendReportSummary(item) {
  return {
    id: item.id,
    ticketCode: item.ticket_code,
    reportedAt: formatIsoToDisplay(item.created_at),
    reporterName: item.reporter_name || '',
    reporterNpm: item.npm || '',
    reporterEmail: item.reporter_email || '',
    reporterPhone: item.phone_number || '',
    itemName: item.item_name || '',
    category: item.category || item.matched_inventory?.internal_category || 'Lainnya',
    lostLocation: item.loss_location || '',
    lostDate: formatIsoToDateOnly(item.loss_datetime),
    description: item.item_description || '',
    secretFeature: item.secret_traits || '',
    ktmThumbnailUrl: '',
    itemThumbnailUrl: '',
    hasKtmKrs: Boolean(item.has_ktm_krs),
    hasItemImage: Boolean(item.has_item_image),
    status: item.status,
    isStale: Boolean(item.is_stale),
    matchedInventoryId: item.matched_inventory_id || '',
    adminNotes: item.admin_notes || '',
    publicRejectReason: item.rejection_reason || '',
    cancelledFrom: item.cancelled_from || '',
    cancelledBy: item.cancelled_by || '',
    cancelReason: item.cancel_reason || '',
    cancelEmailType: item.cancel_email_type || '',
    resubmitLink: item.resubmit_link || '',
    reopenedFromTicket: item.reopened_from_ticket || '',
  };
}

export function mapBackendReportDetail(detail, existingFiles = {}) {
  return {
    id: detail.id,
    ticketCode: detail.ticket_code,
    reportedAt: formatIsoToDisplay(detail.created_at),
    reporterName: detail.reporter_name || '',
    reporterNpm: detail.npm || '',
    reporterEmail: detail.reporter_email || '',
    reporterPhone: detail.phone_number || '',
    itemName: detail.item_name || '',
    category: detail.category || detail.matched_inventory?.internal_category || 'Lainnya',
    lostLocation: detail.loss_location || '',
    lostDate: formatIsoToDateOnly(detail.loss_datetime),
    description: detail.item_description || '',
    secretFeature: detail.secret_traits || '',
    ktmThumbnailUrl: existingFiles.ktmThumbnailUrl || '',
    itemThumbnailUrl: existingFiles.itemThumbnailUrl || '',
    hasKtmKrs: Boolean(detail.files?.has_ktm_krs),
    hasItemImage: Boolean(detail.files?.has_item_image),
    status: detail.status,
    isStale: Boolean(detail.is_stale),
    matchedInventoryId: detail.matched_inventory_id || '',
    adminNotes: detail.admin_notes || '',
    publicRejectReason: detail.rejection_reason || '',
    cancelledFrom: detail.cancelled_from || '',
    cancelledBy: detail.cancelled_by || '',
    cancelReason: detail.cancel_reason || '',
    cancelEmailType: detail.cancel_email_type || '',
    resubmitLink: detail.resubmit_link || '',
    reopenedFromTicket: detail.reopened_from_ticket || '',
    detailLoaded: true,
  };
}

export function mapBackendAuditLog(entry) {
  let parsedPayload = entry.payload;
  if (typeof entry.payload === 'string') {
    try {
      parsedPayload = JSON.parse(entry.payload);
    } catch {
      parsedPayload = { raw: entry.payload };
    }
  }
  return {
    id: entry.id,
    timestamp: formatIsoToWibAudit(entry.created_at),
    actorName: entry.actor_name || 'SYSTEM',
    actorId: entry.actor_username || entry.admin_id || 'SYS-DAEMON',
    action: entry.action,
    targetTable: `${entry.target_table}: ${entry.target_id}`,
    targetId: entry.target_id,
    payload: parsedPayload || {},
    ipAddress: entry.ip_address || '-',
  };
}

export async function fetchReports() {
  const { data, meta } = await request('/admin/reports?limit=100');
  const rows = Array.isArray(data) ? data.map(mapBackendReportSummary) : [];
  return { rows, counts: meta?.counts || null };
}

export async function fetchReportDetailWithFiles(idOrCode) {
  const { data } = await request(`/admin/reports/${encodeURIComponent(idOrCode)}`);
  const files = { ktmThumbnailUrl: '', itemThumbnailUrl: '' };

  if (data?.files?.has_ktm_krs) {
    try {
      files.ktmThumbnailUrl = await requestPrivateFileBlobUrl(
        `/admin/reports/${encodeURIComponent(idOrCode)}/files/ktm`
      );
    } catch {
      files.ktmThumbnailUrl = '';
    }
  }

  if (data?.files?.has_item_image) {
    try {
      files.itemThumbnailUrl = await requestPrivateFileBlobUrl(
        `/admin/reports/${encodeURIComponent(idOrCode)}/files/item`
      );
    } catch {
      files.itemThumbnailUrl = '';
    }
  }

  return mapBackendReportDetail(data, files);
}

export async function updateReportStatus(
  idOrCode,
  {
    status,
    matchedInventoryId,
    adminNotes,
    rejectionReason,
    cancelReason,
    restoreInventory,
    includeResubmitLink,
  }
) {
  const body = { status };
  if (matchedInventoryId !== undefined) {
    body.matched_inventory_id = matchedInventoryId || '';
  }
  if (adminNotes !== undefined) {
    body.admin_notes = adminNotes;
  }
  if (rejectionReason !== undefined) {
    body.rejection_reason = rejectionReason;
  }
  if (cancelReason !== undefined) {
    body.cancel_reason = cancelReason;
  }
  if (restoreInventory !== undefined) {
    body.restore_inventory = Boolean(restoreInventory);
  }
  if (includeResubmitLink !== undefined) {
    body.include_resubmit_link = Boolean(includeResubmitLink);
  }

  const { data } = await request(
    `/admin/reports/${encodeURIComponent(idOrCode)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  return {
    report: data?.report ? mapBackendReportDetail(data.report) : null,
    emailNotification: data?.email_notification || null,
  };
}

export async function updateReportNotes(idOrCode, { adminNotes, matchedInventoryId }) {
  const body = {};
  if (adminNotes !== undefined) body.admin_notes = adminNotes;
  if (matchedInventoryId !== undefined) body.matched_inventory_id = matchedInventoryId;

  const { data } = await request(
    `/admin/reports/${encodeURIComponent(idOrCode)}/notes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return data ? mapBackendReportDetail(data) : null;
}

export async function restoreStaleReport(idOrCode, adminNotes) {
  const body = adminNotes !== undefined ? { admin_notes: adminNotes } : {};
  const { data } = await request(
    `/admin/reports/${encodeURIComponent(idOrCode)}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return data ? mapBackendReportDetail(data) : null;
}

export async function fetchInventories() {
  const { data } = await request('/admin/inventories?limit=100');
  return Array.isArray(data) ? data.map(mapBackendInventory) : [];
}

export async function createInventory(item) {
  const payload = {
    item_name: item.title,
    internal_category: item.category,
    storage_locker: String(item.storageLocker || 'Loker A-01 (Loket D)').trim(),
    found_location: item.foundLocation,
    found_datetime: parseDisplayDateToIso(item.foundDate),
    item_details: String(item.notes || '').trim(),
    finder_name: item.finderName,
    finder_contact: item.finderContact?.trim() || '-',
    photo_url: item.photoUrl || '',
  };

  const { data } = await request('/admin/inventories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapBackendInventory(data);
}

export async function updateInventory(id, item) {
  const payload = {
    item_name: item.title,
    internal_category: item.category,
    storage_locker: String(item.storageLocker || 'Loker A-01 (Loket D)').trim(),
    found_location: item.foundLocation,
    found_datetime: parseDisplayDateToIso(item.foundDate),
    item_details: String(item.notes || '').trim(),
    finder_name: item.finderName,
    finder_contact: item.finderContact?.trim() || '-',
    photo_url: item.photoUrl ?? '',
  };

  const { data } = await request(`/admin/inventories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return mapBackendInventory(data);
}

export async function deleteInventory(id, { reason, confirmId }) {
  await request(`/admin/inventories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, confirm_id: confirmId }),
  });
}

export async function createHandover(params) {
  if (!(params.photoFile instanceof File || params.photoFile instanceof Blob)) {
    throw new Error('Berkas foto bukti serah terima wajib diunggah.');
  }

  const formData = new FormData();
  formData.append('report_id', params.ticketCode);
  formData.append('inventory_id', params.inventoryId);
  formData.append('recipient_name', params.recipientName);
  formData.append('recipient_npm', params.recipientNpm);
  formData.append('handover_notes', params.notes || '');
  formData.append('ktm_verified', 'true');
  formData.append('secret_traits_verified', 'true');
  formData.append(
    'handover_proof',
    params.photoFile,
    params.photoFile.name || 'handover-proof.jpg'
  );

  const { data } = await request('/admin/handovers', {
    method: 'POST',
    body: formData,
    timeoutMs: 60000,
  });
  return data;
}

export async function fetchAuditLogs() {
  const { data } = await request('/admin/audit-logs?limit=100');
  return Array.isArray(data) ? data.map(mapBackendAuditLog) : [];
}
