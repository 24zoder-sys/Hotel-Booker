/* =========================================================================
   Luxe Haven — Hotel Room Booking System  |  Frontend Application Logic
   Full-stack: Node.js + Express + SQLite backend  /  Vanilla JS frontend
   ========================================================================= */

'use strict';

const API = ''; // same-origin — Express serves /api/*

/* ─────────────────────────────── UTILITIES ─────────────────────────────── */

function fmtCurrency(n) {
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function nightCount(cin, cout) {
  const a = new Date(cin), b = new Date(cout);
  return Math.max(0, Math.round((b - a) / 86400000));
}

/* ─────────────────────────────── TOASTS ────────────────────────────────── */

const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'success', duration = 4000) {
  const colors = {
    success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200',
    error:   'bg-rose-900/90 border-rose-500/50 text-rose-200',
    info:    'bg-sky-900/90 border-sky-500/50 text-sky-200',
    warn:    'bg-amber-900/90 border-amber-500/50 text-amber-200'
  };
  const icons = { success: 'check_circle', error: 'cancel', info: 'info', warn: 'warning' };
  const div = document.createElement('div');
  div.className = `toast-enter flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl ${colors[type] || colors.info} text-xs font-medium max-w-sm`;
  div.innerHTML = `<span class="material-symbols-outlined text-sm mt-0.5" style="font-variation-settings:'FILL' 1">${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 350); }, duration);
}

/* ─────────────────────────────── API HELPERS ───────────────────────────── */

async function apiGet(path) {
  const r = await fetch(API + path);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.message || json.error || 'Request failed'), { status: r.status, data: json });
  return json;
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.message || json.error || 'Request failed'), { status: r.status, data: json });
  return json;
}

async function apiDelete(path) {
  const r = await fetch(API + path, { method: 'DELETE' });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.message || json.error || 'Request failed'), { status: r.status, data: json });
  return json;
}

/* ═══════════════════════════════ TAB ROUTING ════════════════════════════ */

const NAV_TABS   = [...document.querySelectorAll('.nav-tab')];
const TAB_PANES  = [...document.querySelectorAll('.tab-pane')];

function activateTab(id) {
  TAB_PANES.forEach(p => p.classList.toggle('active', p.id === id));
  NAV_TABS.forEach(btn => {
    const isActive = btn.dataset.tab === id;
    if (isActive) {
      btn.classList.add('gold-gradient-bg', 'text-[#07090e]');
      btn.classList.remove('text-white/70');
    } else {
      btn.classList.remove('gold-gradient-bg', 'text-[#07090e]');
      btn.classList.add('text-white/70');
    }
  });
  // Lazy-load on demand
  if (id === 'roomsTab')    loadRooms();
  if (id === 'bookingsTab') loadBookings();
  if (id === 'statsTab')    loadStats();
}

NAV_TABS.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

/* ══════════════════════════════ ROOMS TAB ══════════════════════════════ */

let allRoomsCache = [];

function roomCardHTML(r) {
  const roomStatus = r.status || r.availability_status || 'Available';
  const isAvail = roomStatus === 'Available';
  const statusBadge = isAvail
    ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 backdrop-blur-md">
         <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Available</span>`
    : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 border border-amber-500/50 text-amber-400 backdrop-blur-md">
         <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>${roomStatus}</span>`;

  const amenities = (r.amenities || 'Free Wi-Fi, Air Conditioning')
    .split(',').slice(0, 4)
    .map(a => `<span class="text-[10px] px-2.5 py-1 rounded-md bg-[#0b0f19] border border-white/10 text-slate-300">${a.trim()}</span>`).join('');

  const img = r.image_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

  return `
  <article class="group bg-[#121a2b]/80 border border-[#d4af37]/20 hover:border-[#d4af37]/60 rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 gold-glow-hover flex flex-col">
    <div class="relative h-56 overflow-hidden shrink-0">
      <img src="${img}" alt="${r.room_type}" class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'"/>
      <div class="absolute inset-0 bg-gradient-to-t from-[#121a2b] via-transparent to-black/30"></div>
      <div class="absolute top-4 left-4">${statusBadge}</div>
      <div class="absolute bottom-4 right-4">
        <span class="px-3.5 py-1.5 rounded-lg gold-gradient-bg text-[#07090e] font-bold text-xs shadow-lg">
          ${fmtCurrency(r.price_per_night)} <span class="font-normal text-[10px]">/ night</span>
        </span>
      </div>
    </div>
    <div class="p-5 flex flex-col flex-1">
      <div class="flex items-center justify-between text-xs text-[#d4af37] font-semibold mb-1">
        <span>ROOM ${r.room_number}</span>
        <span class="text-slate-300 text-[11px] flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">person</span>Max ${r.capacity || 2} guests
        </span>
      </div>
      <h3 class="font-serif-luxury text-lg font-bold text-white mb-2 group-hover:text-[#d4af37] transition-colors">${r.room_type}</h3>
      <p class="text-xs text-slate-300 line-clamp-2 mb-3 font-light leading-relaxed flex-1">${r.description || 'Elegantly appointed room with premium finishes and bespoke hospitality.'}</p>
      <div class="flex flex-wrap gap-1.5 mb-4">${amenities}</div>
      <div class="flex items-center gap-3 mt-auto">
        <button onclick="openBookingModal(${r.id})" ${!isAvail ? 'disabled' : ''} class="w-1/2 py-2.5 px-3 rounded-lg gold-gradient-bg text-[#07090e] font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          Book Now
        </button>
        <button onclick="showRoomDetails(${r.id})" class="w-1/2 py-2.5 px-3 rounded-lg border border-[#d4af37]/30 text-xs font-semibold text-white/90 hover:bg-white/5 hover:border-[#d4af37] transition-all">
          View Details
        </button>
      </div>
    </div>
  </article>`;
}

async function loadRooms(force = false) {
  if (allRoomsCache.length && !force) { renderRoomsGrid(allRoomsCache); return; }
  const grid = document.getElementById('roomsGrid');
  grid.innerHTML = `<div class="col-span-3 text-center py-16"><div class="inline-block w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin mb-4"></div><p class="text-slate-400">Loading luxury rooms...</p></div>`;
  try {
    const data = await apiGet('/api/rooms');
    const rooms = data.rooms || (Array.isArray(data) ? data : []);
    allRoomsCache = rooms;
    renderRoomsGrid(rooms);
    populateRoomDropdown(rooms);
  } catch (e) {
    grid.innerHTML = `<div class="col-span-3 text-center py-16"><span class="material-symbols-outlined text-4xl text-rose-400 block mb-3">error</span><p class="text-rose-400 text-sm">${e.message}</p><p class="text-slate-500 text-xs mt-2">Make sure the Express server is running: npm start</p></div>`;
  }
}

function renderRoomsGrid(rooms) {
  const searchVal = (document.getElementById('roomFilterSearch')?.value || '').toLowerCase();
  const typeVal   = (document.getElementById('roomFilterType')?.value   || 'All');
  const statusVal = (document.getElementById('roomFilterStatus')?.value || 'All');

  const roomsList = Array.isArray(rooms) ? rooms : (rooms.rooms || []);
  const filtered = roomsList.filter(r => {
    const rStatus = r.status || r.availability_status || 'Available';
    const matchSearch = !searchVal || String(r.room_number).toLowerCase().includes(searchVal) || (r.room_type || '').toLowerCase().includes(searchVal) || (r.amenities || '').toLowerCase().includes(searchVal);
    const matchType   = typeVal === 'All' || r.room_type === typeVal;
    const matchStatus = statusVal === 'All' || rStatus === statusVal;
    return matchSearch && matchType && matchStatus;
  });

  const grid = document.getElementById('roomsGrid');
  if (!filtered.length) {
    grid.innerHTML = `<div class="col-span-3 text-center py-16"><span class="material-symbols-outlined text-5xl text-slate-600 block mb-3">search_off</span><h3 class="text-white font-serif-luxury text-xl mb-1">No rooms match your filters</h3><p class="text-slate-400 text-sm">Try adjusting the search or filter settings.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(roomCardHTML).join('');
}

function showRoomDetails(id) {
  const r = allRoomsCache.find(x => x.id === id);
  if (!r) return;
  const status = r.status || r.availability_status || 'Available';
  showToast(`<strong>Room ${r.room_number}</strong> — ${r.room_type} · ${fmtCurrency(r.price_per_night)}/night · ${status}`, 'info', 5000);
}

document.getElementById('refreshRoomsBtn')?.addEventListener('click', () => loadRooms(true));
document.getElementById('roomFilterSearch')?.addEventListener('input', () => renderRoomsGrid(allRoomsCache));
document.getElementById('roomFilterType')?.addEventListener('change', () => renderRoomsGrid(allRoomsCache));
document.getElementById('roomFilterStatus')?.addEventListener('change', () => renderRoomsGrid(allRoomsCache));

/* ══════════════════════════════ SEARCH TAB ══════════════════════════════ */

document.getElementById('dateSearchForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const checkIn  = document.getElementById('searchCheckIn').value;
  const checkOut = document.getElementById('searchCheckOut').value;
  const type     = document.getElementById('searchType').value;

  if (checkOut <= checkIn) {
    showToast('Check-out date must be after check-in date.', 'error');
    return;
  }

  const grid = document.getElementById('searchResultsGrid');
  grid.innerHTML = `<div class="col-span-3 text-center py-12"><div class="inline-block w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin mb-4"></div><p class="text-slate-400">Checking availability...</p></div>`;

  try {
    let url = `/api/rooms/available?check_in=${checkIn}&check_out=${checkOut}`;
    if (type && type !== 'All') url += `&type=${encodeURIComponent(type)}`;
    const res = await apiGet(url);
    const rooms = res.rooms || (Array.isArray(res) ? res : []);

    const banner = document.getElementById('searchMetaBanner');
    const textEl = document.getElementById('searchResultText');
    const badge  = document.getElementById('searchCountBadge');
    banner.classList.remove('hidden');
    textEl.textContent = `Available rooms for ${fmtDate(checkIn)} → ${fmtDate(checkOut)} (${nightCount(checkIn, checkOut)} nights)`;
    badge.textContent  = `${rooms.length} room${rooms.length !== 1 ? 's' : ''} found`;

    if (!rooms.length) {
      grid.innerHTML = `<div class="col-span-3 text-center py-16"><span class="material-symbols-outlined text-5xl text-rose-600 block mb-3">hotel_off</span><h3 class="text-white font-serif-luxury text-xl mb-1">Fully Booked for These Dates</h3><p class="text-slate-400 text-sm">No available rooms for your selected dates. Please try alternate dates.</p></div>`;
      return;
    }

    // Render cards with pre-filled booking dates
    const searchCards = rooms.map(r => {
      const nights = nightCount(checkIn, checkOut);
      const total  = r.price_per_night * nights;
      const card   = roomCardHTML(r);
      // Inject price-per-dates note before button
      return card.replace('</article>', `
        <div class="mx-5 mb-5 bg-black/30 border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-slate-400">
          <span class="text-[#d4af37] font-semibold">${nights} night${nights !== 1 ? 's' : ''}</span> · ${fmtCurrency(r.price_per_night)}/night · Total: <span class="text-[#d4af37] font-bold">${fmtCurrency(total)}</span>
        </div></article>`);
    }).join('');

    grid.innerHTML = `<div class="col-span-3"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${searchCards}</div></div>`;

    // Pre-fill booking modal dates when opening from search results
    document.querySelectorAll('#searchResultsGrid button').forEach(btn => {
      if (btn.textContent.trim() === 'Book Now') {
        const origOnclick = btn.getAttribute('onclick');
        btn.setAttribute('onclick', origOnclick);
        btn.addEventListener('click', () => {
          setTimeout(() => {
            document.getElementById('bookCheckIn').value  = checkIn;
            document.getElementById('bookCheckOut').value = checkOut;
            recalcPricing();
          }, 50);
        });
      }
    });
  } catch (e) {
    grid.innerHTML = `<div class="col-span-3 text-center py-16"><span class="material-symbols-outlined text-4xl text-rose-400 block mb-3">error</span><p class="text-rose-400">${e.message}</p></div>`;
  }
});

document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
  document.getElementById('dateSearchForm').reset();
  document.getElementById('searchMetaBanner').classList.add('hidden');
  document.getElementById('searchResultsGrid').innerHTML = `<div class="col-span-3 text-center py-16"><span class="material-symbols-outlined text-5xl text-slate-600 block mb-3">calendar_search</span><h3 class="text-white font-serif-luxury text-xl mb-1">Choose your dates above</h3></div>`;
});

/* ═══════════════════════════ RESERVATIONS TAB ═══════════════════════════ */

let allBookingsCache = [];

function buildBookingRow(b) {
  const status = b.status || b.booking_status || 'CONFIRMED';
  const isConfirmed = status === 'CONFIRMED';
  const statusBadge = isConfirmed
    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">CONFIRMED</span>`
    : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-500/30">CANCELLED</span>`;

  const checkIn = b.check_in || b.check_in_date;
  const checkOut = b.check_out || b.check_out_date;
  const nights = b.total_nights || nightCount(checkIn, checkOut);
  const total  = b.total_price || (b.price_per_night * nights);
  const ref    = b.booking_ref || `BK-${String(b.id).padStart(5, '0')}`;

  return `
  <tr class="border-b border-[#d4af37]/10 hover:bg-[#1a233b]/40 transition-colors" data-booking-id="${b.id}">
    <td class="py-3.5 px-5">
      <span class="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-950/50 text-blue-300 border border-blue-500/30">${ref}</span>
    </td>
    <td class="py-3.5 px-5">
      <span class="text-[#d4af37] font-semibold text-xs">Rm ${b.room_number || b.room_id}</span>
      <span class="text-slate-400 text-[10px] block">${b.room_type || ''}</span>
    </td>
    <td class="py-3.5 px-5">
      <span class="text-white font-medium text-xs">${b.guest_name}</span>
      <span class="text-slate-400 text-[10px] block">${b.guest_email || ''}</span>
    </td>
    <td class="py-3.5 px-5 text-xs text-slate-300 whitespace-nowrap">
      <span class="material-symbols-outlined text-[10px] align-middle text-slate-500 mr-0.5">calendar_month</span>
      ${fmtDate(checkIn)} → ${fmtDate(checkOut)}
    </td>
    <td class="py-3.5 px-5 text-xs text-slate-300">${nights}</td>
    <td class="py-3.5 px-5 text-[#d4af37] font-semibold text-xs">${fmtCurrency(total)}</td>
    <td class="py-3.5 px-5">${statusBadge}</td>
    <td class="py-3.5 px-5 text-right">
      <div class="flex items-center justify-end gap-2">
        ${isConfirmed
          ? `<button onclick="cancelBooking(${b.id})" class="text-[10px] px-2.5 py-1 border border-rose-500/30 text-rose-400 rounded-lg hover:bg-rose-950/40 transition-all">Cancel</button>`
          : `<button disabled class="text-[10px] px-2.5 py-1 border border-slate-700 text-slate-600 rounded-lg cursor-not-allowed">Cancelled</button>`
        }
      </div>
    </td>
  </tr>`;
}

async function loadBookings(force = false) {
  const tbody = document.getElementById('bookingsTableBody');
  if (allBookingsCache.length && !force) { renderBookingsTable(allBookingsCache); return; }
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-slate-400 text-sm"><div class="inline-block w-8 h-8 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin mb-3"></div><p>Loading reservations...</p></td></tr>`;
  try {
    const data = await apiGet('/api/bookings');
    const bookings = data.bookings || (Array.isArray(data) ? data : []);
    allBookingsCache = bookings;
    renderBookingsTable(bookings);
    updateBookingsBadge(bookings);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-rose-400 text-sm">${e.message}</td></tr>`;
  }
}

function renderBookingsTable(bookings) {
  const searchVal = (document.getElementById('bookingSearchInput')?.value || '').toLowerCase();
  const statusVal = (document.getElementById('bookingStatusFilter')?.value || 'All');

  const list = Array.isArray(bookings) ? bookings : (bookings?.bookings || []);
  const filtered = list.filter(b => {
    const bStatus = b.status || b.booking_status || 'CONFIRMED';
    const bRef = b.booking_ref || `BK-${String(b.id).padStart(5, '0')}`;
    const matchSearch = !searchVal ||
      (b.guest_name || '').toLowerCase().includes(searchVal) ||
      (b.guest_email || '').toLowerCase().includes(searchVal) ||
      String(b.id).includes(searchVal) ||
      bRef.toLowerCase().includes(searchVal) ||
      String(b.room_number || '').toLowerCase().includes(searchVal);
    const matchStatus = statusVal === 'All' || bStatus === statusVal;
    return matchSearch && matchStatus;
  });

  const tbody = document.getElementById('bookingsTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-slate-400 text-sm">No reservations match your filters.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(buildBookingRow).join('');
  }

  // Summary bar
  const confirmed  = list.filter(b => (b.status || b.booking_status) === 'CONFIRMED').length;
  const cancelled  = list.filter(b => (b.status || b.booking_status) === 'CANCELLED').length;
  const summaryBar = document.getElementById('bookingsSummaryBar');
  summaryBar.innerHTML = `
    <span class="text-slate-400">Showing <strong class="text-white">${filtered.length}</strong> of <strong class="text-white">${list.length}</strong> reservations</span>
    <span class="flex items-center gap-1 text-emerald-400"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>${confirmed} Confirmed</span>
    <span class="flex items-center gap-1 text-rose-400"><span class="w-2 h-2 rounded-full bg-rose-400"></span>${cancelled} Cancelled</span>`;
}

function updateBookingsBadge(bookings) {
  const list = Array.isArray(bookings) ? bookings : allBookingsCache;
  const confirmed = list.filter(b => (b.status || b.booking_status) === 'CONFIRMED').length;
  const badge = document.getElementById('bookingsBadge');
  if (badge) { badge.textContent = confirmed; badge.classList.toggle('hidden', confirmed === 0); }
}

async function cancelBooking(id) {
  const b = allBookingsCache.find(x => x.id === id);
  const ref = b ? (b.booking_ref || `BK-${String(b.id).padStart(5, '0')}`) : `BK-${id}`;
  if (!confirm(`Cancel booking ${ref}? This will free up the room dates.`)) return;
  try {
    await apiDelete(`/api/bookings/${id}`);
    showToast(`Booking <strong>${ref}</strong> cancelled. Dates released.`, 'success');
    allBookingsCache = [];
    allRoomsCache = [];
    loadBookings(true);
  } catch (e) {
    showToast(`Failed to cancel: ${e.message}`, 'error');
  }
}

document.getElementById('refreshBookingsBtn')?.addEventListener('click', () => { allBookingsCache = []; loadBookings(true); });
document.getElementById('bookingSearchInput')?.addEventListener('input', () => renderBookingsTable(allBookingsCache));
document.getElementById('bookingStatusFilter')?.addEventListener('change', () => renderBookingsTable(allBookingsCache));

/* ══════════════════════════════ ADD ROOM TAB ════════════════════════════ */

// Live preview wiring
function updatePreview() {
  const el = id => document.getElementById(id);
  const roomNo   = el('newRoomNumber')?.value || '104';
  const type     = el('newRoomType')?.value   || 'Deluxe Room';
  const price    = el('newRoomPrice')?.value  || '150';
  const capacity = el('newRoomCapacity')?.value || '2';
  const img      = el('newRoomImage')?.value || '';
  const desc     = el('newRoomDescription')?.value || '';
  const status   = el('newRoomStatus')?.value || 'Available';
  const amenities = (el('newRoomAmenities')?.value || 'Free Wi-Fi')
    .split(',').slice(0, 4).map(a => `<span class="text-[10px] px-2.5 py-1 rounded-md bg-[#0b0f19] border border-white/10 text-slate-300">${a.trim()}</span>`).join('');

  if (el('previewImg') && img) el('previewImg').src = img;
  if (el('previewRoomNo')) el('previewRoomNo').textContent = roomNo;
  if (el('previewType')) el('previewType').textContent = type;
  if (el('previewPrice')) el('previewPrice').textContent = Number(price).toFixed(0);
  if (el('previewCapacity')) el('previewCapacity').textContent = capacity;
  if (el('previewDesc')) el('previewDesc').textContent = desc;
  if (el('previewAmenities')) el('previewAmenities').innerHTML = amenities;
  if (el('previewStatusBadge')) {
    el('previewStatusBadge').innerHTML = status === 'Available'
      ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Available`
      : `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Maintenance`;
    el('previewStatusBadge').className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md ${status === 'Available' ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-400' : 'bg-amber-950/80 border border-amber-500/50 text-amber-400'}`;
  }
}

['newRoomNumber','newRoomType','newRoomPrice','newRoomCapacity','newRoomStatus','newRoomAmenities','newRoomImage','newRoomDescription']
  .forEach(id => document.getElementById(id)?.addEventListener('input', updatePreview));
['newRoomType','newRoomStatus'].forEach(id => document.getElementById(id)?.addEventListener('change', updatePreview));

document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('newRoomImage').value = btn.dataset.url;
    updatePreview();
  });
});

document.getElementById('addRoomForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const roomStatus = document.getElementById('newRoomStatus').value;
  const body = {
    room_number:         document.getElementById('newRoomNumber').value.trim(),
    room_type:           document.getElementById('newRoomType').value,
    price_per_night:     parseFloat(document.getElementById('newRoomPrice').value),
    capacity:            parseInt(document.getElementById('newRoomCapacity').value) || 2,
    status:              roomStatus,
    availability_status: roomStatus,
    amenities:           document.getElementById('newRoomAmenities').value,
    image_url:           document.getElementById('newRoomImage').value.trim(),
    description:         document.getElementById('newRoomDescription').value.trim()
  };
  try {
    const res = await apiPost('/api/rooms', body);
    showToast(`✦ Room <strong>${body.room_number}</strong> (${body.room_type}) added successfully!`, 'success');
    e.target.reset();
    allRoomsCache = [];
    populateRoomDropdown([]);
    loadRooms(true);
  } catch (err) {
    if (err.status === 409) showToast(`Room number <strong>${body.room_number}</strong> already exists. Use a unique number.`, 'error', 6000);
    else showToast(`Failed to add room: ${err.message}`, 'error');
  }
});

/* ══════════════════════════════ STATS TAB ═══════════════════════════════ */

async function loadStats(force = false) {
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  try {
    const raw = await apiGet('/api/stats');
    const s = raw.stats || raw;
    setEl('statTotalRooms',    s.total_rooms ?? s.totalRooms ?? 0);
    setEl('statAvailableNow',  s.available_rooms ?? s.availableNow ?? 0);
    setEl('statActiveBookings',s.confirmed_bookings ?? s.activeBookings ?? 0);
    setEl('statTotalRevenue',  fmtCurrency(s.total_revenue ?? s.totalRevenue ?? 0));

    // Room types distribution
    const dist = document.getElementById('roomTypesDistribution');
    const types = s.room_types || s.roomTypes;
    if (dist && types) {
      const maxPrice = Math.max(...types.map(t => t.avg_price || 0), 1);
      dist.innerHTML = types.map(t => {
        const pct = Math.round(((t.avg_price || 0) / maxPrice) * 100);
        return `
          <div class="flex items-center gap-3">
            <span class="text-slate-300 text-xs w-36 shrink-0">${t.room_type}</span>
            <div class="flex-1 bg-[#0b0f19] rounded-full h-1.5 overflow-hidden">
              <div class="bg-gradient-to-r from-[#d4af37] to-[#f7df94] h-1.5 rounded-full transition-all duration-700" style="width:${pct}%"></div>
            </div>
            <span class="text-[#d4af37] text-xs font-semibold w-20 text-right shrink-0">${fmtCurrency(t.avg_price)}/night</span>
            <span class="text-slate-500 text-[10px] w-12 text-right shrink-0">${t.count} room${t.count !== 1 ? 's' : ''}</span>
          </div>`;
      }).join('');
    }
  } catch (e) {
    showToast(`Stats load failed: ${e.message}`, 'warn');
  }
}

document.getElementById('refreshStatsBtn')?.addEventListener('click', loadStats);

/* ═══════════════════════════ BOOKING MODAL ══════════════════════════════ */

let currentSelectedRoomId = null;

function populateRoomDropdown(rooms) {
  const sel = document.getElementById('bookRoomSelect');
  if (!sel) return;
  const list = Array.isArray(rooms) ? rooms : (rooms.rooms || []);
  const available = list.filter(r => (r.status || r.availability_status || 'Available') === 'Available');
  sel.innerHTML = '<option value="">— Choose a Room —</option>' + available.map(r =>
    `<option value="${r.id}" data-price="${r.price_per_night}" data-type="${r.room_type}" data-number="${r.room_number}">Room ${r.room_number} — ${r.room_type} (${fmtCurrency(r.price_per_night)}/night)</option>`
  ).join('');
}

function openBookingModal(roomId = null) {
  document.getElementById('bookingModal').classList.remove('hidden');
  document.getElementById('overlapConflictBanner').classList.add('hidden');
  document.body.style.overflow = 'hidden';
  if (allRoomsCache.length) populateRoomDropdown(allRoomsCache);
  else loadRooms().then(() => populateRoomDropdown(allRoomsCache));
  if (roomId) {
    const sel = document.getElementById('bookRoomSelect');
    // Wait for options to render
    setTimeout(() => { if (sel) sel.value = roomId; recalcPricing(); }, 100);
  }
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
  document.body.style.overflow = '';
  document.getElementById('reservationForm').reset();
  document.getElementById('overlapConflictBanner').classList.add('hidden');
  document.getElementById('calcNights').textContent = '0 night(s)';
  document.getElementById('calcRate').textContent = '$0.00';
  document.getElementById('calcTotal').textContent = '$0.00';
}

function recalcPricing() {
  const sel   = document.getElementById('bookRoomSelect');
  const cin   = document.getElementById('bookCheckIn').value;
  const cout  = document.getElementById('bookCheckOut').value;
  const opt   = sel?.selectedOptions[0];
  const price = parseFloat(opt?.dataset.price || 0);
  const nights = (cin && cout) ? nightCount(cin, cout) : 0;
  document.getElementById('calcNights').textContent = `${nights} night(s)`;
  document.getElementById('calcRate').textContent   = price ? fmtCurrency(price) : '—';
  document.getElementById('calcTotal').textContent  = price && nights > 0 ? fmtCurrency(price * nights) : '$0.00';
}

document.getElementById('bookRoomSelect')?.addEventListener('change', recalcPricing);
document.getElementById('bookCheckIn')?.addEventListener('change', recalcPricing);
document.getElementById('bookCheckOut')?.addEventListener('change', recalcPricing);

document.getElementById('openBookModalBtn')?.addEventListener('click', () => openBookingModal());
document.getElementById('closeBookingModalBtn')?.addEventListener('click', closeBookingModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeBookingModal);
document.getElementById('bookingModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeBookingModal(); });

document.getElementById('reservationForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn  = document.getElementById('confirmBookingSubmitBtn');
  const sel  = document.getElementById('bookRoomSelect');
  const cin  = document.getElementById('bookCheckIn').value;
  const cout = document.getElementById('bookCheckOut').value;

  if (!sel.value) { showToast('Please select a room.', 'error'); return; }
  if (!cin || !cout) { showToast('Please fill in check-in and check-out dates.', 'error'); return; }
  if (cout <= cin)   { showToast('Check-out must be after check-in.', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">sync</span> Booking...`;

  document.getElementById('overlapConflictBanner').classList.add('hidden');

  const body = {
    room_id:        parseInt(sel.value),
    guest_name:     document.getElementById('bookGuestName').value.trim(),
    guest_email:    document.getElementById('bookGuestEmail').value.trim(),
    guest_phone:    document.getElementById('bookGuestPhone').value.trim(),
    check_in_date:  cin,
    check_out_date: cout,
    check_in:       cin,
    check_out:      cout
  };

  try {
    const res = await apiPost('/api/bookings', body);
    const booking = res.booking || res;
    closeBookingModal();
    showReceiptModal(booking);
    allBookingsCache = [];
    allRoomsCache = [];
    loadBookings(true);
  } catch (err) {
    if (err.status === 409) {
      document.getElementById('overlapConflictBanner').classList.remove('hidden');
      document.getElementById('overlapConflictMsg').textContent = err.data?.message || err.data?.error || 'This room is already reserved for the selected dates — double-booking conflict detected!';
      showToast('Booking conflict: room already reserved for these dates (HTTP 409).', 'error', 6000);
    } else if (err.status === 400) {
      showToast(`Validation error: ${err.message}`, 'warn');
    } else {
      showToast(`Booking failed: ${err.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-base">lock</span>Confirm &amp; Book Room`;
  }
});

function showReceiptModal(booking) {
  const checkIn = booking.check_in || booking.check_in_date;
  const checkOut = booking.check_out || booking.check_out_date;
  const nights = booking.total_nights || nightCount(checkIn, checkOut);
  const total  = booking.total_price || ((booking.price_per_night || 0) * nights);
  const ref    = booking.booking_ref || `BK-${String(booking.id).padStart(5,'0')}`;

  document.getElementById('receiptModalContent').innerHTML = `
    <div class="space-y-4">
      <div class="bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-5 py-4 grid grid-cols-2 gap-3 text-xs">
        <div><span class="text-slate-400 block mb-0.5">Booking Reference</span><strong class="font-mono text-sky-400 text-sm">${ref}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Room</span><strong class="text-[#d4af37]">Rm ${booking.room_number || booking.room_id} ${booking.room_type ? '· ' + booking.room_type : ''}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Guest</span><strong class="text-white">${booking.guest_name}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Email</span><span class="text-white">${booking.guest_email || '—'}</span></div>
        <div><span class="text-slate-400 block mb-0.5">Check-In</span><strong class="text-white">${fmtDate(checkIn)}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Check-Out</span><strong class="text-white">${fmtDate(checkOut)}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Duration</span><strong class="text-white">${nights} night${nights !== 1 ? 's' : ''}</strong></div>
        <div><span class="text-slate-400 block mb-0.5">Total Charged</span><strong class="text-[#d4af37] text-base font-serif-luxury">${fmtCurrency(total)}</strong></div>
      </div>
      <p class="text-xs text-slate-400 text-center">A confirmation summary has been generated. Thank you for choosing Luxe Haven.</p>
    </div>`;
  document.getElementById('receiptModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

document.getElementById('closeReceiptModalBtn')?.addEventListener('click', () => {
  document.getElementById('receiptModal').classList.add('hidden');
  document.body.style.overflow = '';
});
document.getElementById('dismissReceiptBtn')?.addEventListener('click', () => {
  document.getElementById('receiptModal').classList.add('hidden');
  document.body.style.overflow = '';
});

/* ══════════════════════════ EDGE CASE TEST MODAL ════════════════════════ */

document.getElementById('openEdgeModalBtn')?.addEventListener('click', () => {
  document.getElementById('edgeCaseModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});
['closeEdgeModalBtn','closeEdgeModalFooterBtn'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('edgeCaseModal').classList.add('hidden');
    document.body.style.overflow = '';
  });
});
document.getElementById('edgeCaseModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) { e.currentTarget.classList.add('hidden'); document.body.style.overflow = ''; }
});
document.getElementById('clearConsoleBtn')?.addEventListener('click', () => {
  document.getElementById('testOutputLog').textContent = 'Console cleared. Ready.\n';
});

function logToConsole(msg, color = '#67e8f9') {
  const el = document.getElementById('testOutputLog');
  el.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
  el.scrollTop = el.scrollHeight;
}

async function runEdgeTest(label, fn) {
  logToConsole(`\n▶ TEST: ${label}`, '#d4af37');
  logToConsole(`  Timestamp: ${new Date().toISOString()}`);
  try {
    const result = await fn();
    logToConsole(`  ✓ Result: ${JSON.stringify(result, null, 2).split('\n').join('\n  ')}`, '#4ade80');
  } catch (err) {
    logToConsole(`  HTTP ${err.status || '???'}: ${err.message}`, '#f87171');
    if (err.data) logToConsole(`  Response: ${JSON.stringify(err.data)}`, '#fb923c');
  }
}

// Test 1: Double-booking
document.getElementById('btnTestDoubleBooking')?.addEventListener('click', async () => {
  await runEdgeTest('Double-Booking Overlap Prevention (Expect: HTTP 409)', async () => {
    const res = await apiGet('/api/rooms?limit=1');
    const rooms = res.rooms || (Array.isArray(res) ? res : []);
    if (!rooms.length) throw new Error('No rooms found');
    const roomId = rooms[0].id;
    const cin  = '2026-12-01';
    const cout = '2026-12-05';

    logToConsole(`  Booking room ${roomId} for ${cin} → ${cout}...`);
    const first = await apiPost('/api/bookings', { room_id: roomId, guest_name: 'Alice Test', guest_email: 'alice@test.com', check_in: cin, check_out: cout });
    logToConsole(`  First booking created: ${first.booking_ref || first.id}`, '#4ade80');

    logToConsole(`  Attempting overlapping booking (${cin} → ${cout})...`);
    // This should throw 409
    const second = await apiPost('/api/bookings', { room_id: roomId, guest_name: 'Bob Test', guest_email: 'bob@test.com', check_in: cin, check_out: cout });
    return second; // if we get here, test failed
  });
});

// Test 2: Cancel non-existent
document.getElementById('btnTestCancelNonExistent')?.addEventListener('click', async () => {
  await runEdgeTest('Cancel Non-Existent Booking ID=999999 (Expect: HTTP 404)', async () => {
    return await apiDelete('/api/bookings/999999');
  });
});

// Test 3: Invalid dates
document.getElementById('btnTestInvalidDates')?.addEventListener('click', async () => {
  await runEdgeTest('Inverted Dates (check_out before check_in) (Expect: HTTP 400)', async () => {
    const res = await apiGet('/api/rooms?limit=1');
    const rooms = res.rooms || (Array.isArray(res) ? res : []);
    if (!rooms.length) throw new Error('No rooms found');
    return await apiPost('/api/bookings', {
      room_id:    rooms[0].id,
      guest_name: 'Invalid Date Test',
      guest_email:'invalid@test.com',
      check_in:   '2026-12-20',
      check_out:  '2026-12-10'
    });
  });
});

// Test 4: Duplicate room number
document.getElementById('btnTestDuplicateRoom')?.addEventListener('click', async () => {
  await runEdgeTest('Duplicate Room Number (Expect: HTTP 409)', async () => {
    const res = await apiGet('/api/rooms?limit=1');
    const rooms = res.rooms || (Array.isArray(res) ? res : []);
    const existingNo = rooms[0]?.room_number || '101';
    return await apiPost('/api/rooms', {
      room_number:         existingNo,
      room_type:           'Suite',
      price_per_night:     999,
      availability_status: 'Available'
    });
  });
});

/* ═══════════════════════════════════ HERO SEARCH ═══════════════════════════════════ */

document.getElementById('heroSearchForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const cin  = document.getElementById('heroCheckIn').value;
  const cout = document.getElementById('heroCheckOut').value;
  const type = document.getElementById('heroRoomType').value;

  // Pre-fill search tab and switch to it
  document.getElementById('searchCheckIn').value  = cin;
  document.getElementById('searchCheckOut').value = cout;
  document.getElementById('searchType').value     = type;
  activateTab('searchTab');
  document.getElementById('dateSearchForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ════════════════════════════════════ INIT ════════════════════════════════════ */

// Set default dates (today / today+3)
(function setDefaultDates() {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const cin   = fmt(today);
  const cout  = fmt(new Date(today.getTime() + 3 * 86400000));
  ['heroCheckIn','searchCheckIn','bookCheckIn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = cin;
  });
  ['heroCheckOut','searchCheckOut','bookCheckOut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = cout;
  });
})();

// Activate default tab & load rooms
activateTab('roomsTab');
loadRooms();
