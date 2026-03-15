/**
 * wallet.js: KriptoEdu Wallet Connector
 *
 * Strategi deteksi wallet (3 lapis, urutan prioritas):
 *
 * 1. EIP-6963 (Multi Injected Provider Discovery)
 *    Standar modern — setiap wallet announce diri dengan nama + ikon resmi.
 *    MetaMask dan Bitget Wallet keduanya support EIP-6963.
 *
 * 2. window.bitkeep.ethereum (Bitget legacy fallback)
 *    Bitget menyimpan provider-nya sendiri di window.bitkeep.ethereum
 *    agar tidak bentrok dengan MetaMask di window.ethereum.
 *    Jika Bitget tidak muncul via EIP-6963, kita cek jalur ini.
 *
 * 3. window.ethereum (legacy injected)
 *    Fallback untuk wallet lama yang belum support EIP-6963.
 *    Kita beri label berdasarkan property yang ada
 *    (window.ethereum.isMetaMask, isBitKeep, isCoinbaseWallet, dll).
 *
 * Alur saat user klik Connect Wallet:
 *  - 0 wallet ditemukan  → modal panduan install
 *  - 1 wallet ditemukan  → langsung connect (tanpa picker)
 *  - 2+ wallet ditemukan → tampilkan picker, user pilih satu
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPPORTED_CHAIN_ID   = '0x1';
const SUPPORTED_CHAIN_NAME = 'Ethereum Mainnet';

// ── EIP-6963: PASANG LISTENER SEBELUM APAPUN ─────────────────────────────────
// Harus dipasang sebelum dispatch agar tidak ada announce yang terlewat.
const _eip6963Wallets = new Map(); // uuid → { info, provider }

window.addEventListener('eip6963:announceProvider', (event) => {
  const { info, provider } = event.detail || {};
  if (info?.uuid && provider) {
    _eip6963Wallets.set(info.uuid, { info, provider });
  }
});

// Minta semua wallet yang terinstall untuk announce diri sekarang
window.dispatchEvent(new Event('eip6963:requestProvider'));

// ── STATE ─────────────────────────────────────────────────────────────────────
let walletState = {
  address:     null,
  chainId:     null,
  isConnected: false,
};

let _activeProvider   = null; // EIP-1193 provider dari wallet yang dipilih user
let _activeWalletName = '';   // Nama wallet yang sedang aktif (untuk label UI)

// ── UTILS ─────────────────────────────────────────────────────────────────────

/**
 * Singkat alamat: 6 karakter awal + '...' + 4 karakter akhir
 * '0xAbCd1234567890EfGh' → '0xAbCd...EfGh'
 */
function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}

/**
 * Kumpulkan semua wallet yang terdeteksi dari 3 sumber sekaligus:
 *
 * 1. EIP-6963  — nama + ikon resmi, tidak ada ambiguitas
 * 2. window.bitkeep.ethereum — Bitget legacy path (hindari bentrok dengan MM)
 * 3. window.ethereum — fallback, deteksi tipe via isMetaMask / isBitKeep / dll
 *
 * Hasil: array of { id, name, icon, provider }
 * Deduplikasi: jika provider sudah ada di EIP-6963, tidak ditambah lagi.
 */
function _gatherWallets() {
  const result    = [];
  const seenProviders = new Set();

  // ── Lapis 1: EIP-6963 ─────────────────────────────────────────────────────
  for (const { info, provider } of _eip6963Wallets.values()) {
    result.push({
      id:       info.uuid,
      name:     info.name,
      icon:     info.icon || null,
      provider,
    });
    seenProviders.add(provider);
  }

  // ── Lapis 2: window.bitkeep.ethereum (Bitget legacy) ─────────────────────
  // Bitget menyimpan provider di jalur ini agar tidak menimpa window.ethereum
  // saat MetaMask juga terinstall.
  const bitkeepProvider = window.bitkeep?.ethereum || window.isBitKeep?.ethereum;
  if (bitkeepProvider && !seenProviders.has(bitkeepProvider)) {
    result.push({
      id:       'bitkeep-legacy',
      name:     'Bitget Wallet',
      icon:     null,
      provider: bitkeepProvider,
    });
    seenProviders.add(bitkeepProvider);
  }

  // ── Lapis 3: window.ethereum (legacy injected) ───────────────────────────
  const legacyProvider = window.ethereum;
  if (legacyProvider && !seenProviders.has(legacyProvider)) {
    // Deteksi nama wallet dari property yang di-inject
    let legacyName = 'Browser Wallet';
    if (legacyProvider.isMetaMask && !legacyProvider.isBraveWallet) {
      legacyName = 'MetaMask';
    } else if (legacyProvider.isBitKeep || legacyProvider.isBitkeepChrome) {
      legacyName = 'Bitget Wallet';
    } else if (legacyProvider.isCoinbaseWallet || legacyProvider.isCoinbaseBrowser) {
      legacyName = 'Coinbase Wallet';
    } else if (legacyProvider.isBraveWallet) {
      legacyName = 'Brave Wallet';
    } else if (legacyProvider.isRabby) {
      legacyName = 'Rabby';
    } else if (legacyProvider.isOKExWallet || legacyProvider.isOkxWallet) {
      legacyName = 'OKX Wallet';
    } else if (legacyProvider.isTrust || legacyProvider.isTrustWallet) {
      legacyName = 'Trust Wallet';
    }

    // Cegah duplikat nama (jika EIP-6963 sudah ada provider dengan nama sama)
    const alreadyByName = result.some(
      (w) => w.name.toLowerCase() === legacyName.toLowerCase()
    );
    if (!alreadyByName) {
      result.push({
        id:       'legacy-injected',
        name:     legacyName,
        icon:     null,
        provider: legacyProvider,
      });
    }
  }

  return result;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

let _toastTimer;

function showToast(message, type = 'info') {
  const toast = document.getElementById('wallet-toast');
  const msg   = document.getElementById('wallet-toast-msg');
  const icon  = document.getElementById('wallet-toast-icon');
  if (!toast) return;

  const map = {
    success: { i: '✅', bg: 'bg-green-500/20',  bd: 'border-green-500/40',  tx: 'text-green-300'  },
    error:   { i: '❌', bg: 'bg-red-500/20',    bd: 'border-red-500/40',    tx: 'text-red-300'    },
    warning: { i: '⚠️', bg: 'bg-yellow-500/20', bd: 'border-yellow-500/40', tx: 'text-yellow-300' },
    info:    { i: 'ℹ️', bg: 'bg-blue-500/20',   bd: 'border-blue-500/40',   tx: 'text-blue-300'   },
  };
  const c = map[type] || map.info;

  toast.className       = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all duration-300 ${c.bg} ${c.bd}`;
  msg.className         = `text-sm font-semibold ${c.tx}`;
  icon.textContent      = c.i;
  msg.textContent       = message;
  toast.style.opacity       = '1';
  toast.style.transform     = 'translateY(0)';
  toast.style.pointerEvents = 'auto';

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, 3500);
}

function hideToast() {
  const t = document.getElementById('wallet-toast');
  if (!t) return;
  t.style.opacity       = '0';
  t.style.transform     = 'translateY(16px)';
  t.style.pointerEvents = 'none';
}

// ── UI UPDATE ─────────────────────────────────────────────────────────────────

/**
 * Refresh tampilan tombol wallet dan badge alamat.
 *
 * Alamat diambil LIVE dari _activeProvider (bukan window.ethereum),
 * sehingga selalu sinkron dengan akun aktif di wallet yang dipilih user.
 */
async function updateWalletUI() {
  const btn   = document.getElementById('wallet-btn');
  const label = document.getElementById('wallet-btn-label');
  const dot   = document.getElementById('wallet-btn-dot');
  const badge = document.getElementById('wallet-address-badge');
  if (!btn) return;

  // Ambil alamat terkini dari provider aktif (silent, tanpa popup)
  if (walletState.isConnected && _activeProvider) {
    try {
      const live = await _activeProvider.request({ method: 'eth_accounts' });
      if (live?.length > 0) {
        walletState.address = live[0];
        sessionStorage.setItem('wallet_address', live[0]);
      } else {
        _clearState();
      }
    } catch (_) { /* lanjut dengan state yang ada */ }
  }

  if (walletState.isConnected && walletState.address) {
    const short = shortenAddress(walletState.address);

    // CONNECTED
    btn.className = [
      'hidden md:inline-flex items-center gap-2',
      'bg-green-500/15 hover:bg-red-500/15',
      'border border-green-500/40 hover:border-red-500/40',
      'text-green-400 hover:text-red-400',
      'text-sm font-semibold px-4 py-2 rounded-full',
      'transition-all duration-200 cursor-pointer group',
    ].join(' ');

    if (label) label.innerHTML = `
      <span class="group-hover:hidden">${short}</span>
      <span class="hidden group-hover:inline">Disconnect</span>`;

    if (dot) dot.className = 'w-2 h-2 rounded-full bg-green-400 group-hover:bg-red-400 transition-colors animate-pulse';

    if (badge) {
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        <span class="font-mono">${short}</span>
        ${_activeWalletName ? `<span class="text-green-600 text-xs">&middot; ${_activeWalletName}</span>` : ''}`;
      badge.className = 'mt-6 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-2 rounded-full';
      badge.classList.remove('hidden');
    }

  } else {
    // DISCONNECTED
    btn.className = 'hidden md:inline-flex items-center gap-2 bg-crypto-purple hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 cursor-pointer';
    if (label) label.innerHTML = '<span>🔗 Connect Wallet</span>';
    if (dot)   dot.className   = 'w-2 h-2 rounded-full bg-white/50';
    if (badge) badge.classList.add('hidden');
  }
}

// ── WALLET PICKER MODAL ───────────────────────────────────────────────────────

/**
 * Entry point saat user klik Connect Wallet.
 * Beri waktu 80ms agar wallet yang lambat sempat announce via EIP-6963,
 * lalu tentukan apakah perlu picker atau langsung connect.
 */
function connectWallet() {
  // Re-broadcast request supaya wallet yang lambat announce tidak terlewat
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  setTimeout(() => {
    const wallets = _gatherWallets();

    if (wallets.length === 0) {
      _showNoWalletModal();
    } else if (wallets.length === 1) {
      // Hanya 1 wallet: langsung connect tanpa picker
      _connectWith(wallets[0]);
    } else {
      // 2+ wallet: tampilkan picker
      _showPickerModal(wallets);
    }
  }, 80);
}

function _showPickerModal(wallets) {
  document.getElementById('wallet-picker-modal')?.remove();

  // Simpan wallets ke window sementara agar onclick bisa akses
  window._walletPickerList = wallets;

  const buttons = wallets.map((w, i) => {
    const safeName = w.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Ikon: base64 dari EIP-6963 info.icon, atau emoji fallback per nama
    let iconHtml;
    if (w.icon) {
      iconHtml = `<img src="${w.icon}" alt="${safeName}" class="w-10 h-10 rounded-xl object-contain flex-shrink-0" />`;
    } else {
      const emojiMap = {
        'MetaMask':        '🦊',
        'Bitget Wallet':   '💼',
        'Coinbase Wallet': '🔵',
        'Brave Wallet':    '🦁',
        'Trust Wallet':    '🛡️',
        'Rabby':           '🐰',
        'OKX Wallet':      '⭕',
        'Rainbow':         '🌈',
      };
      const emoji = emojiMap[w.name] || '🔗';
      iconHtml = `<div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">${emoji}</div>`;
    }

    return `
      <button
        onclick="window._walletPickerList && _connectWith(window._walletPickerList[${i}]); _closePickerModal();"
        class="w-full flex items-center gap-4 px-5 py-4 rounded-2xl
               bg-white/5 hover:bg-crypto-purple/15
               border border-white/10 hover:border-crypto-purple/40
               transition-all duration-150 text-left group"
      >
        ${iconHtml}
        <div class="flex-1 min-w-0">
          <p class="font-bold text-white text-sm group-hover:text-crypto-purple transition-colors">${safeName}</p>
          <p class="text-slate-500 text-xs mt-0.5">Terdeteksi &middot; siap digunakan</p>
        </div>
        <span class="text-slate-600 group-hover:text-crypto-purple text-lg transition-colors">&rsaquo;</span>
      </button>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id        = 'wallet-picker-modal';
  overlay.className = 'fixed inset-0 z-[10002] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <div class="absolute inset-0" onclick="_closePickerModal()"></div>

    <div class="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl z-10 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
        <div>
          <h3 class="text-lg font-black text-white">Pilih Wallet</h3>
          <p class="text-slate-500 text-xs mt-0.5">${wallets.length} wallet terdeteksi</p>
        </div>
        <button onclick="_closePickerModal()"
          class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition text-xl leading-none">
          &times;
        </button>
      </div>

      <!-- Wallet list -->
      <div class="p-4 space-y-2.5 max-h-80 overflow-y-auto">
        ${buttons}
      </div>

      <!-- Footer info -->
      <div class="px-6 pb-5 pt-2">
        <p class="text-slate-600 text-xs text-center">
          Tidak melihat walletmu? Aktifkan extension-nya di browser terlebih dahulu.
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function _closePickerModal() {
  document.getElementById('wallet-picker-modal')?.remove();
  document.body.style.overflow = '';
  delete window._walletPickerList;
}

// ── CONNECT DENGAN PROVIDER SPESIFIK ─────────────────────────────────────────

async function _connectWith(wallet) {
  const { name, provider } = wallet;

  const btn = document.getElementById('wallet-btn');
  const lbl = document.getElementById('wallet-btn-label');
  if (btn) btn.disabled = true;
  if (lbl) lbl.innerHTML = `<span>Menghubungkan ${name}...</span>`;

  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    if (!accounts?.length) throw new Error('Tidak ada akun yang dipilih.');

    const chainId = await provider.request({ method: 'eth_chainId' });

    // Set provider aktif dan simpan state
    _activeProvider   = provider;
    _activeWalletName = name;

    walletState.address     = accounts[0];
    walletState.chainId     = chainId;
    walletState.isConnected = true;

    sessionStorage.setItem('wallet_connected',     'true');
    sessionStorage.setItem('wallet_address',       accounts[0]);
    sessionStorage.setItem('wallet_provider_name', name);

    // Pasang event listener ke provider yang aktif ini
    _attachListeners(provider);

    // Update UI dengan alamat asli dari provider
    await updateWalletUI();

    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`${name} terhubung, tapi jaringannya bukan Mainnet. Ganti ke ${SUPPORTED_CHAIN_NAME} ya! ⚠️`, 'warning');
    } else {
      showToast(`✅ ${name} terhubung! ${shortenAddress(accounts[0])}`, 'success');
    }

  } catch (err) {
    const code = err?.code;
    if (code === 4001 || code === 'ACTION_REJECTED') {
      showToast('Koneksi dibatalkan 😅', 'warning');
    } else if (code === -32002) {
      showToast(`Buka ${name} dan setujui permintaan koneksi`, 'info');
    } else {
      showToast('Gagal connect: ' + (err?.message || 'Error tidak diketahui'), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
    updateWalletUI();
  }
}

// ── DISCONNECT ────────────────────────────────────────────────────────────────

function _clearState() {
  const prev = walletState.address;
  const name = _activeWalletName;

  walletState.address     = null;
  walletState.chainId     = null;
  walletState.isConnected = false;
  _activeProvider         = null;
  _activeWalletName       = '';

  sessionStorage.removeItem('wallet_connected');
  sessionStorage.removeItem('wallet_address');
  sessionStorage.removeItem('wallet_provider_name');

  return { prev, name };
}

function disconnectWallet() {
  const { prev, name } = _clearState();
  updateWalletUI();
  showToast(`${name ? name + ' ' : ''}${shortenAddress(prev)} disconnect. 👋`, 'info');
}

// ── BUTTON HANDLER ────────────────────────────────────────────────────────────

function handleWalletButtonClick() {
  if (walletState.isConnected) {
    disconnectWallet();
  } else {
    connectWallet();
  }
}

// ── EVENT LISTENERS ───────────────────────────────────────────────────────────

/**
 * Pasang listener HANYA ke provider yang aktif, bukan ke semua window.ethereum.
 * Ini mencegah false event dari wallet yang tidak sedang digunakan.
 */
function _attachListeners(provider) {
  if (!provider?.on) return;

  provider.on('accountsChanged', (accounts) => {
    if (!accounts?.length) {
      disconnectWallet();
    } else {
      walletState.address = accounts[0];
      sessionStorage.setItem('wallet_address', accounts[0]);
      updateWalletUI();
      showToast(`Akun berganti ke ${shortenAddress(accounts[0])} 🔄`, 'info');
    }
  });

  provider.on('chainChanged', (chainId) => {
    walletState.chainId = chainId;
    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`Jaringan berubah! Gunakan ${SUPPORTED_CHAIN_NAME} ya. ⚠️`, 'warning');
    } else {
      showToast('Beralih ke Ethereum Mainnet ✅', 'success');
    }
  });

  // Beberapa wallet emit event disconnect (Bitget, Coinbase, dll)
  provider.on('disconnect', () => disconnectWallet());
}

// ── MODAL: TIDAK ADA WALLET ───────────────────────────────────────────────────

function _showNoWalletModal() {
  document.getElementById('no-wallet-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'no-wallet-modal';
  overlay.className = 'fixed inset-0 z-[10002] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <div class="absolute inset-0" onclick="document.getElementById('no-wallet-modal').remove(); document.body.style.overflow='';"></div>
    <div class="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl p-6 z-10">

      <div class="flex justify-center mb-5">
        <div class="w-10 h-1 bg-white/20 rounded-full"></div>
      </div>

      <div class="text-center mb-5">
        <div class="text-5xl mb-3">🔍</div>
        <h3 class="text-xl font-black text-white mb-1">Wallet Tidak Ditemukan</h3>
        <p class="text-slate-400 text-sm">Tidak ada wallet extension yang aktif di browser kamu.</p>
      </div>

      <div class="space-y-3 mb-4">
        <a href="https://metamask.io/download/" target="_blank" rel="noopener"
          class="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/15 transition group">
          <span class="text-2xl">🦊</span>
          <div class="flex-1"><p class="font-bold text-white text-sm">MetaMask</p><p class="text-slate-500 text-xs">Install extension gratis</p></div>
          <span class="text-orange-500 text-sm font-bold">&rarr;</span>
        </a>
        <a href="https://web3.bitget.com/en/wallet-download" target="_blank" rel="noopener"
          class="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/15 transition group">
          <span class="text-2xl">💼</span>
          <div class="flex-1"><p class="font-bold text-white text-sm">Bitget Wallet</p><p class="text-slate-500 text-xs">Install extension gratis</p></div>
          <span class="text-sky-400 text-sm font-bold">&rarr;</span>
        </a>
      </div>

      <div class="bg-[#1E293B] rounded-2xl p-4 border border-white/5 mb-4">
        <p class="text-slate-400 text-xs leading-relaxed mb-3">
          <strong class="text-white">Pakai HP?</strong> Buka MetaMask atau Bitget di HP kamu, lalu buka website ini melalui tab <strong class="text-white">Browser</strong> di dalam aplikasinya.
        </p>
        <button onclick="copyUrlToClipboard()"
          class="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition">
          📋 Salin URL Halaman Ini
        </button>
      </div>

      <button onclick="document.getElementById('no-wallet-modal').remove(); document.body.style.overflow='';"
        class="w-full py-2 text-slate-500 hover:text-white text-sm transition">Tutup</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function copyUrlToClipboard() {
  navigator.clipboard?.writeText(window.location.href)
    .then(() => showToast('URL disalin! Buka di browser wallet kamu 📱', 'success'))
    .catch(() => showToast('URL: ' + window.location.href, 'info'));
}

// ── RESTORE SESSION ───────────────────────────────────────────────────────────

async function restoreSession() {
  const wasSaved    = sessionStorage.getItem('wallet_connected');
  const savedAddr   = sessionStorage.getItem('wallet_address');
  const savedName   = sessionStorage.getItem('wallet_provider_name') || '';

  if (!wasSaved || !savedAddr) return;

  // Re-request agar wallet yang belum announce sempat merespons
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise(r => setTimeout(r, 80)); // beri waktu announce

  const wallets = _gatherWallets();
  let restoredWallet = null;

  // Cari provider yang punya akun sama dengan yang tersimpan
  for (const w of wallets) {
    try {
      const accs = await w.provider.request({ method: 'eth_accounts' });
      if (accs?.length && accs[0].toLowerCase() === savedAddr.toLowerCase()) {
        restoredWallet = w;
        break;
      }
    } catch (_) { /* skip provider yang error */ }
  }

  if (!restoredWallet) {
    // Tidak bisa temukan provider yang cocok, bersihkan session
    sessionStorage.removeItem('wallet_connected');
    sessionStorage.removeItem('wallet_address');
    sessionStorage.removeItem('wallet_provider_name');
    return;
  }

  try {
    const chainId = await restoredWallet.provider.request({ method: 'eth_chainId' });

    _activeProvider   = restoredWallet.provider;
    _activeWalletName = restoredWallet.name;

    walletState.address     = savedAddr;
    walletState.chainId     = chainId;
    walletState.isConnected = true;

    _attachListeners(restoredWallet.provider);
    await updateWalletUI();

    showToast(`${restoredWallet.name} ${shortenAddress(savedAddr)} terhubung kembali 🔗`, 'success');

  } catch (_) {
    sessionStorage.removeItem('wallet_connected');
    sessionStorage.removeItem('wallet_address');
    sessionStorage.removeItem('wallet_provider_name');
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────

function initWallet() {
  ['wallet-btn', 'wallet-btn-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handleWalletButtonClick);
  });

  updateWalletUI();

  // Restore session setelah 120ms (beri wallet waktu announce via EIP-6963)
  setTimeout(restoreSession, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  initWallet();
}
