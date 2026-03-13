/**
 * wallet.js — KriptoEdu MetaMask Connector
 * RAH-9: Setup Koneksi Wallet Sederhana
 *
 * Fitur:
 *  - Deteksi MetaMask / wallet browser
 *  - Connect & Disconnect wallet
 *  - Tampilkan alamat singkat (0x1234...abcd)
 *  - Handle: connected / not installed / wrong network
 *  - Toast notification feedback
 *  - Persist state via sessionStorage
 */

// ─── CONFIG ──────────────────────────────────────────────
const SUPPORTED_CHAIN_ID = '0x1'; // Ethereum Mainnet
const SUPPORTED_CHAIN_NAME = 'Ethereum Mainnet';

// ─── STATE ───────────────────────────────────────────────
let walletState = {
  address: null,
  chainId: null,
  isConnected: false,
};

// ─── UTILS ───────────────────────────────────────────────

/**
 * Persingkat alamat wallet
 * Contoh: 0x1234567890abcdef1234 → 0x1234...cdef
 */
function shortenAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

/**
 * Cek apakah MetaMask / injected wallet tersedia
 */
function isMetaMaskInstalled() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
}

// ─── TOAST NOTIFICATION ──────────────────────────────────

let toastTimeout;

/**
 * Tampilkan toast notifikasi
 * @param {string} message   - Teks pesan
 * @param {'success'|'error'|'warning'|'info'} type - Jenis toast
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('wallet-toast');
  const toastMsg = document.getElementById('wallet-toast-msg');
  const toastIcon = document.getElementById('wallet-toast-icon');

  if (!toast) return;

  const config = {
    success: { icon: '✅', bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-300' },
    error:   { icon: '❌', bg: 'bg-red-500/20',   border: 'border-red-500/40',   text: 'text-red-300'   },
    warning: { icon: '⚠️', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300' },
    info:    { icon: 'ℹ️', bg: 'bg-blue-500/20',  border: 'border-blue-500/40',  text: 'text-blue-300'  },
  };

  const c = config[type] || config.info;

  // Reset class
  toast.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all duration-300 ${c.bg} ${c.border}`;
  toastMsg.className = `text-sm font-semibold ${c.text}`;
  toastIcon.textContent = c.icon;
  toastMsg.textContent = message;

  // Tampilkan
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  toast.style.pointerEvents = 'auto';

  // Auto-hide setelah 3.5 detik
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), 3500);
}

function hideToast() {
  const toast = document.getElementById('wallet-toast');
  if (!toast) return;
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(16px)';
  toast.style.pointerEvents = 'none';
}

// ─── UI UPDATE ────────────────────────────────────────────

/**
 * Update semua elemen UI berdasarkan state wallet saat ini
 */
function updateWalletUI() {
  const btn         = document.getElementById('wallet-btn');
  const btnLabel    = document.getElementById('wallet-btn-label');
  const btnDot      = document.getElementById('wallet-btn-dot');
  const addressBadge = document.getElementById('wallet-address-badge');

  if (!btn) return;

  if (walletState.isConnected && walletState.address) {
    // ── STATE: CONNECTED ──
    btn.className = [
      'hidden md:inline-flex items-center gap-2',
      'bg-green-500/15 hover:bg-red-500/15',
      'border border-green-500/40 hover:border-red-500/40',
      'text-green-400 hover:text-red-400',
      'text-sm font-semibold px-4 py-2 rounded-full',
      'transition-all duration-200 cursor-pointer group',
    ].join(' ');

    btnLabel.innerHTML = `
      <span class="group-hover:hidden">${shortenAddress(walletState.address)}</span>
      <span class="hidden group-hover:inline">Disconnect</span>
    `;

    if (btnDot) {
      btnDot.className = 'w-2 h-2 rounded-full bg-green-400 group-hover:bg-red-400 transition-colors animate-pulse';
    }

    if (addressBadge) {
      addressBadge.textContent = shortenAddress(walletState.address);
      addressBadge.classList.remove('hidden');
    }

  } else {
    // ── STATE: DISCONNECTED ──
    btn.className = [
      'hidden md:inline-flex items-center gap-2',
      'bg-crypto-purple hover:bg-purple-500',
      'text-white text-sm font-semibold px-4 py-2 rounded-full',
      'transition-all duration-200 cursor-pointer',
    ].join(' ');

    if (btnLabel) btnLabel.innerHTML = '<span>🔗 Connect Wallet</span>';
    if (btnDot)   btnDot.className = 'w-2 h-2 rounded-full bg-white/50';
    if (addressBadge) addressBadge.classList.add('hidden');
  }
}

// ─── CORE WALLET FUNCTIONS ───────────────────────────────

/**
 * Hubungkan wallet MetaMask
 */
async function connectWallet() {
  // 1. Cek apakah MetaMask terinstall
  if (!isMetaMaskInstalled()) {
    showToast('MetaMask belum terinstall! Install dulu di metamask.io 🦊', 'warning');
    setTimeout(() => window.open('https://metamask.io/download/', '_blank'), 1500);
    return;
  }

  const btn = document.getElementById('wallet-btn');
  if (btn) {
    btn.disabled = true;
    document.getElementById('wallet-btn-label').innerHTML = '<span>Menghubungkan...</span>';
  }

  try {
    // 2. Minta akses akun
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('Tidak ada akun yang dipilih.');
    }

    // 3. Cek chain / network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });

    walletState.address     = accounts[0];
    walletState.chainId     = chainId;
    walletState.isConnected = true;

    // 4. Simpan ke session
    sessionStorage.setItem('wallet_connected', 'true');
    sessionStorage.setItem('wallet_address', accounts[0]);

    // 5. Update UI
    updateWalletUI();

    // 6. Network warning jika bukan Mainnet
    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`Wallet terhubung di jaringan lain (bukan ${SUPPORTED_CHAIN_NAME}). Pastikan network sudah benar.`, 'warning');
    } else {
      showToast(`Wallet terhubung! ${shortenAddress(accounts[0])} ✨`, 'success');
    }

  } catch (err) {
    if (err.code === 4001) {
      // User menolak permintaan
      showToast('Koneksi dibatalkan. Kamu harus setujui permintaan di MetaMask ya! 😅', 'warning');
    } else {
      showToast('Gagal terhubung: ' + (err.message || 'Error tidak diketahui'), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
    updateWalletUI();
  }
}

/**
 * Putuskan koneksi wallet
 */
function disconnectWallet() {
  const prevAddress = walletState.address;

  walletState.address     = null;
  walletState.chainId     = null;
  walletState.isConnected = false;

  sessionStorage.removeItem('wallet_connected');
  sessionStorage.removeItem('wallet_address');

  updateWalletUI();
  showToast(`Wallet ${shortenAddress(prevAddress)} berhasil disconnect. Sampai jumpa! 👋`, 'info');
}

/**
 * Toggle connect/disconnect berdasarkan state
 */
function handleWalletButtonClick() {
  if (walletState.isConnected) {
    disconnectWallet();
  } else {
    connectWallet();
  }
}

// ─── EVENT LISTENERS (MetaMask) ──────────────────────────

function setupMetaMaskListeners() {
  if (!isMetaMaskInstalled()) return;

  // Akun berganti
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      // User disconnect dari MetaMask
      disconnectWallet();
    } else {
      walletState.address = accounts[0];
      sessionStorage.setItem('wallet_address', accounts[0]);
      updateWalletUI();
      showToast(`Akun berganti ke ${shortenAddress(accounts[0])} 🔄`, 'info');
    }
  });

  // Chain / network berganti
  window.ethereum.on('chainChanged', (chainId) => {
    walletState.chainId = chainId;
    if (chainId !== SUPPORTED_CHAIN_ID) {
      showToast(`Jaringan berubah! Gunakan ${SUPPORTED_CHAIN_NAME} untuk pengalaman terbaik. ⚠️`, 'warning');
    } else {
      showToast('Jaringan berhasil diganti ke Ethereum Mainnet ✅', 'success');
    }
    // Reload untuk reset state bersih (rekomendasi MetaMask)
    // window.location.reload();
  });
}

// ─── RESTORE SESSION ─────────────────────────────────────

/**
 * Cek jika sebelumnya user sudah connect (restore dari sessionStorage)
 */
async function restoreWalletSession() {
  const wasConnected = sessionStorage.getItem('wallet_connected');
  const savedAddress = sessionStorage.getItem('wallet_address');

  if (wasConnected && savedAddress && isMetaMaskInstalled()) {
    try {
      // Verifikasi akun masih aktif (tanpa popup)
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        walletState.address     = accounts[0];
        walletState.chainId     = chainId;
        walletState.isConnected = true;
        updateWalletUI();
        showToast(`Wallet ${shortenAddress(accounts[0])} terhubung kembali 🔗`, 'success');
      } else {
        // Session tidak valid, bersihkan
        sessionStorage.removeItem('wallet_connected');
        sessionStorage.removeItem('wallet_address');
      }
    } catch (e) {
      // Silent fail
      sessionStorage.removeItem('wallet_connected');
      sessionStorage.removeItem('wallet_address');
    }
  }
}

// ─── INIT ────────────────────────────────────────────────

/**
 * Inisialisasi wallet module saat DOM sudah siap
 */
function initWallet() {
  // Pasang event listener ke tombol
  const btn = document.getElementById('wallet-btn');
  if (btn) {
    btn.addEventListener('click', handleWalletButtonClick);
  }

  // Setup MetaMask event listeners
  setupMetaMaskListeners();

  // Coba restore session sebelumnya
  restoreWalletSession();

  // Update UI awal
  updateWalletUI();
}

// Jalankan setelah DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  initWallet();
}
