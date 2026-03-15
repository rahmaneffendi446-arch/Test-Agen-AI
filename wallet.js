/**
 * wallet.js: KriptoEdu Wallet Connector (Simple & Stable)
 * RAH-15: Rollback ke sistem sederhana berbasis window.ethereum
 *
 * Cara kerja:
 *  - Deteksi window.ethereum yang di-inject MetaMask (desktop extension
 *    maupun MetaMask in-app browser di HP)
 *  - Jika tidak ada, tampilkan pilihan: buka MetaMask app atau info
 *  - Tidak ada dependency eksternal, tidak ada CDN tambahan
 *  - Ringan, cepat, tidak bisa error karena CDN gagal load
 *
 * Kompatibel dengan:
 *  ✓ MetaMask Desktop (Chrome, Firefox, Brave)
 *  ✓ MetaMask Mobile, built-in browser ("Browser" tab di app)
 *  ✓ Trust Wallet built-in browser
 *  ✓ Brave Wallet (inject window.ethereum)
 *  ✓ Coinbase Wallet built-in browser
 */

// CONFIG
const SUPPORTED_CHAIN_ID   = '0x1';
const SUPPORTED_CHAIN_NAME = 'Ethereum Mainnet';

// STATE (dibaca oleh donation.js, jangan rename)
let walletState = {
  address:     null,
  chainId:     null,
  isConnected: false,
};

// UTILS

/**
 * Singkat alamat wallet jadi format yang rapi:
 * 6 karakter awal + '...' + 4 karakter akhir
 * Contoh: 0xAbCd1234...5678
 */
function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}

/** Apakah ada wallet provider yang di-inject? (MetaMask, Trust, Brave, dll) */
function hasProvider() {
  return typeof window.ethereum !== 'undefined';
}

// TOAST

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

  toast.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all duration-300 ${c.bg} ${c.bd}`;
  msg.className   = `text-sm font-semibold ${c.tx}`;
  icon.textContent = c.i;
  msg.textContent  = message;
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

// UI UPDATE

/**
 * Refresh tampilan wallet di seluruh UI.
 *
 * Fungsi ini async agar bisa mengambil alamat terkini langsung
 * dari provider (eth_accounts) setiap kali dipanggil.
 * Dengan begitu, tombol wallet selalu menampilkan alamat asli
 * yang sedang aktif di MetaMask, dan otomatis berubah jika
 * user ganti akun.
 *
 * Format alamat: 6 karakter awal + '...' + 4 karakter akhir
 * Contoh: 0xAbCd12...5678
 */
async function updateWalletUI() {
  const btn   = document.getElementById('wallet-btn');
  const label = document.getElementById('wallet-btn-label');
  const dot   = document.getElementById('wallet-btn-dot');
  const badge = document.getElementById('wallet-address-badge');
  if (!btn) return;

  // ── Ambil alamat terkini langsung dari provider ──────────────────
  // eth_accounts tidak memunculkan popup, hanya query akun aktif.
  // Ini memastikan alamat yang ditampilkan selalu fresh dan sinkron
  // dengan wallet yang sedang dipakai user saat itu.
  if (walletState.isConnected && hasProvider()) {
    try {
      const liveAccounts = await window.ethereum.request({ method: 'eth_accounts' });

      if (liveAccounts && liveAccounts.length > 0) {
        // Update state dengan alamat paling baru dari provider
        walletState.address = liveAccounts[0];
        sessionStorage.setItem('wallet_address', liveAccounts[0]);
      } else {
        // Provider tidak punya akun aktif (user lock MetaMask / cabut izin)
        // Anggap disconnect agar UI konsisten
        walletState.isConnected = false;
        walletState.address     = null;
        sessionStorage.removeItem('wallet_connected');
        sessionStorage.removeItem('wallet_address');
      }
    } catch (_) {
      // Gagal fetch dari provider, lanjut render dengan walletState yang ada
    }
  }

  if (walletState.isConnected && walletState.address) {
    // Format singkat: substring(0,6) + '...' + substring(length-4)
    const short = shortenAddress(walletState.address);

    // ── CONNECTED ─────────────────────────────────────────────────────
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
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span>${short}</span>`;
      badge.className = 'mt-6 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono px-4 py-2 rounded-full';
      badge.classList.remove('hidden');
    }

  } else {
    // ── DISCONNECTED ──────────────────────────────────────────────────
    btn.className = 'hidden md:inline-flex items-center gap-2 bg-crypto-purple hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 cursor-pointer';
    if (label) label.innerHTML = '<span>🔗 Connect Wallet</span>';
    if (dot)   dot.className   = 'w-2 h-2 rounded-full bg-white/50';
    if (badge) badge.classList.add('hidden');
  }
}

// NO-WALLET MODAL
/**
 * Muncul saat window.ethereum tidak ada. Kasih tahu user cara connect:
 *   1. Buka web ini di dalam browser MetaMask app
 *   2. Install MetaMask extension (desktop)
 */
function showNoWalletModal() {
  const existing = document.getElementById('no-wallet-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'no-wallet-modal';
  overlay.className = 'fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0';
  overlay.innerHTML = `
    <div class="absolute inset-0" onclick="document.getElementById('no-wallet-modal').remove(); document.body.style.overflow='';"></div>
    <div class="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl p-7 z-10">

      <div class="flex justify-center mb-5"><div class="w-10 h-1 bg-white/20 rounded-full"></div></div>

      <div class="text-center mb-6">
        <div class="text-5xl mb-3">🦊</div>
        <h3 class="text-xl font-black mb-1">Wallet Belum Terdeteksi</h3>
        <p class="text-slate-400 text-sm">Pilih salah satu cara di bawah ini untuk connect wallet.</p>
      </div>

      <div class="bg-[#1E293B] rounded-2xl p-5 mb-3 border border-orange-500/20">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">📱</span>
          <p class="font-bold text-orange-300">Pakai HP? Buka via MetaMask App</p>
        </div>
        <p class="text-slate-400 text-xs leading-relaxed mb-4">
          Buka aplikasi <strong class="text-white">MetaMask</strong> di HP kamu, tap tab <strong class="text-white">"Browser"</strong>, lalu ketik alamat website ini.
          MetaMask akan otomatis menghubungkan wallet kamu.
        </p>
        <div class="bg-crypto-dark rounded-xl px-4 py-2 border border-white/5 flex items-center gap-2">
          <span class="text-slate-500 text-xs">🌐</span>
          <span class="text-slate-300 text-xs font-mono break-all" id="current-url-display">${window.location.hostname}</span>
        </div>
        <button
          onclick="copyUrlToClipboard()"
          class="mt-3 w-full flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-semibold py-2.5 rounded-xl transition"
        >
          📋 Salin URL Halaman Ini
        </button>
      </div>

      <div class="bg-[#1E293B] rounded-2xl p-5 mb-4 border border-white/5">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-2xl">💻</span>
          <p class="font-bold text-slate-300">Pakai Desktop? Install Extension</p>
        </div>
        <p class="text-slate-400 text-xs leading-relaxed mb-3">
          Install ekstensi MetaMask di Chrome, Firefox, atau Brave. Gratis dan hanya butuh 2 menit.
        </p>
        <a href="https://metamask.io/download/" target="_blank" rel="noopener"
          class="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold py-2.5 rounded-xl transition">
          Install MetaMask Gratis →
        </a>
      </div>

      <button
        onclick="document.getElementById('no-wallet-modal').remove(); document.body.style.overflow='';"
        class="w-full py-2 text-slate-500 hover:text-white text-sm transition">Tutup</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

/** Salin URL halaman ke clipboard */
function copyUrlToClipboard() {
  navigator.clipboard?.writeText(window.location.href).then(() => {
    showToast('URL disalin! Buka di MetaMask Browser 📱', 'success');
  }).catch(() => {
    showToast('URL: ' + window.location.href, 'info');
  });
}

// CONNECT

async function connectWallet() {
  if (!hasProvider()) {
    showNoWalletModal();
    return;
  }

  const btn = document.getElementById('wallet-btn');
  if (btn) {
    btn.disabled = true;
    const lbl = document.getElementById('wallet-btn-label');
    if (lbl) lbl.innerHTML = '<span>Menghubungkan...</span>';
  }

  try {
    // Minta akses akun, akan buka popup MetaMask
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Tidak ada akun yang dipilih.');
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });

    // Simpan alamat asli dari provider ke walletState
    walletState.address     = accounts[0];
    walletState.chainId     = chainId;
    walletState.isConnected = true;

    sessionStorage.setItem('wallet_connected', 'true');
    sessionStorage.setItem('wallet_address',   accounts[0]);

    // updateWalletUI async: akan fetch ulang dari provider dan tampilkan alamat asli
    await updateWalletUI();

    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`Wallet terhubung, tapi kamu di jaringan lain. Ganti ke ${SUPPORTED_CHAIN_NAME} ya! ⚠️`, 'warning');
    } else {
      showToast(`✅ Wallet terhubung! ${shortenAddress(accounts[0])}`, 'success');
    }

  } catch (err) {
    if (err.code === 4001) {
      showToast('Koneksi dibatalkan 😅', 'warning');
    } else if (err.code === -32002) {
      showToast('Buka MetaMask dan setujui permintaan koneksi 🦊', 'info');
    } else {
      showToast('Gagal connect: ' + (err.message || 'Error tidak diketahui'), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
    updateWalletUI();
  }
}

// DISCONNECT

function disconnectWallet() {
  const prev = walletState.address;

  walletState.address     = null;
  walletState.chainId     = null;
  walletState.isConnected = false;

  sessionStorage.removeItem('wallet_connected');
  sessionStorage.removeItem('wallet_address');

  updateWalletUI();
  showToast(`Wallet ${shortenAddress(prev)} disconnect. 👋`, 'info');
}

// BUTTON CLICK HANDLER

function handleWalletButtonClick() {
  if (walletState.isConnected) {
    disconnectWallet();
  } else {
    connectWallet();
  }
}

// EVENT LISTENERS

function setupProviderListeners() {
  if (!hasProvider()) return;

  // Akun berganti: user switch akun di MetaMask
  // updateWalletUI akan otomatis fetch alamat baru dari provider
  window.ethereum.on('accountsChanged', (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
    } else {
      // Update state dulu, lalu biarkan updateWalletUI fetch dari provider
      walletState.address = accounts[0];
      sessionStorage.setItem('wallet_address', accounts[0]);
      updateWalletUI();
      showToast(`Akun berganti ke ${shortenAddress(accounts[0])} 🔄`, 'info');
    }
  });

  window.ethereum.on('chainChanged', (chainId) => {
    walletState.chainId = chainId;
    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`Jaringan berubah! Gunakan ${SUPPORTED_CHAIN_NAME} ya. ⚠️`, 'warning');
    } else {
      showToast('Beralih ke Ethereum Mainnet ✅', 'success');
    }
  });
}

// RESTORE SESSION

async function restoreSession() {
  const wasSaved  = sessionStorage.getItem('wallet_connected');
  const savedAddr = sessionStorage.getItem('wallet_address');

  if (!wasSaved || !savedAddr || !hasProvider()) return;

  try {
    // eth_accounts TIDAK memunculkan popup. Hanya cek apakah sudah authorized
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts && accounts.length > 0 &&
        accounts[0].toLowerCase() === savedAddr.toLowerCase()) {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });

      // Simpan alamat asli dari provider
      walletState.address     = accounts[0];
      walletState.chainId     = chainId;
      walletState.isConnected = true;

      // updateWalletUI akan fetch ulang dan tampilkan alamat live
      await updateWalletUI();
      showToast(`Wallet ${shortenAddress(accounts[0])} terhubung kembali 🔗`, 'success');
    } else {
      sessionStorage.removeItem('wallet_connected');
      sessionStorage.removeItem('wallet_address');
    }
  } catch (_) {
    sessionStorage.removeItem('wallet_connected');
    sessionStorage.removeItem('wallet_address');
  }
}

// INIT

function initWallet() {
  ['wallet-btn', 'wallet-btn-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handleWalletButtonClick);
  });

  setupProviderListeners();
  updateWalletUI();
  restoreSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  initWallet();
}
