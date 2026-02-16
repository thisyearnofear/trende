'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { X, Zap, Loader2, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
import { formatAddress, MONAD_CHAIN_ID } from '@/lib/wallet';
import { useConnectModal } from '@rainbow-me/rainbowkit';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (payment: PaymentPayload) => void;
  paymentInfo: {
    amount: string;
    recipient: string;
    chainId: string;
  };
}

export interface PaymentPayload {
  amount: string;
  token: string;
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
}

// EIP-712 domain for Trende payments
const getEIP712Domain = (chainId: number, verifyingContract: string) => ({
  name: 'Trende Intelligence',
  version: '1',
  chainId,
  verifyingContract: verifyingContract as `0x${string}`,
});

// EIP-712 types
const EIP712_TYPES = {
  PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PaymentModal({ isOpen, onClose, onPaymentComplete, paymentInfo }: PaymentModalProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { signTypedDataAsync } = useSignTypedData();

  const handlePayment = useCallback(async () => {
    if (!address) {
      openConnectModal?.();
      return;
    }

    setStatus('signing');
    setErrorMessage('');

    try {
      const chainId = parseInt(paymentInfo.chainId) || MONAD_CHAIN_ID;
      const amountWei = BigInt(Math.floor(parseFloat(paymentInfo.amount) * 1e18));
      const now = Math.floor(Date.now() / 1000);
      const nonce = generateNonce();

      const authorization = {
        from: address,
        to: paymentInfo.recipient as `0x${string}`,
        value: amountWei,
        validAfter: BigInt(now),
        validBefore: BigInt(now + 300), // 5 minutes validity
        nonce: nonce as `0x${string}`,
      };

      // Sign the typed data
      const signature = await signTypedDataAsync({
        domain: getEIP712Domain(chainId, paymentInfo.recipient),
        types: EIP712_TYPES,
        primaryType: 'PaymentAuthorization',
        message: authorization,
      });

      setStatus('success');

      // Construct the payment payload
      const payment: PaymentPayload = {
        amount: paymentInfo.amount,
        token: 'native',
        signature,
        authorization: {
          from: address,
          to: paymentInfo.recipient,
          value: amountWei.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce,
        },
      };

      // Give user a moment to see success state
      setTimeout(() => {
        onPaymentComplete(payment);
        onClose();
      }, 1000);

    } catch (error: any) {
      console.error('Payment signing error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to sign payment authorization');
    }
  }, [address, paymentInfo, signTypedDataAsync, onPaymentComplete, onClose, openConnectModal]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#0a0a0a] border-2 border-white p-6" style={{ boxShadow: '6px 6px 0px 0px #00ffff' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00ffff] flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase text-white">Unlock Research</h2>
              <p className="text-xs font-mono text-[#00ffff]">MONAD PAYMENT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="bg-[#141414] border-2 border-gray-800 p-4">
            <p className="text-xs font-mono text-gray-500 mb-1">PAYMENT_AMOUNT</p>
            <p className="text-2xl font-black text-[#00ffff]">{paymentInfo.amount} MON</p>
            <p className="text-xs text-gray-500 mt-1">≈ Unlimited searches for this session</p>
          </div>

          <div className="bg-[#141414] border-2 border-gray-800 p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-mono">NETWORK</span>
              <span className="text-white font-mono">Monad Testnet</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-mono">RECIPIENT</span>
              <span className="text-white font-mono">{formatAddress(paymentInfo.recipient)}</span>
            </div>
            {address && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-mono">YOUR_WALLET</span>
                <span className="text-[#00ff88] font-mono">{formatAddress(address)}</span>
              </div>
            )}
          </div>

          {/* Status Messages */}
          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border-2 border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{errorMessage}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-[#00ff88]/10 border-2 border-[#00ff88]/30">
              <CheckCircle className="w-4 h-4 text-[#00ff88]" />
              <p className="text-xs text-[#00ff88] font-mono">SIGNATURE_VERIFIED</p>
            </div>
          )}

          {/* Action Button */}
          {!isConnected ? (
            <button
              onClick={() => openConnectModal?.()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-black uppercase tracking-wider hover:bg-[#00ffff] transition-colors"
              style={{ boxShadow: '4px 4px 0px 0px #00ffff' }}
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handlePayment}
              disabled={status === 'signing' || status === 'success'}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#00ffff] text-black font-black uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '4px 4px 0px 0px #fff' }}
            >
              {status === 'signing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Authorized!
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Authorize Payment
                </>
              )}
            </button>
          )}

          <p className="text-[10px] text-gray-600 text-center font-mono">
            This signs an off-chain authorization. No gas required.
          </p>
        </div>
      </div>
    </div>
  );
}

// Hook for using payment flow
export function usePaymentFlow() {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: string; recipient: string; chainId: string } | null>(null);
  const [pendingCallback, setPendingCallback] = useState<((payment: PaymentPayload) => void) | null>(null);

  const requestPayment = useCallback((
    info: { amount: string; recipient: string; chainId: string },
    onComplete: (payment: PaymentPayload) => void
  ) => {
    setPaymentInfo(info);
    setPendingCallback(() => onComplete);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPaymentInfo(null);
    setPendingCallback(null);
  }, []);

  const handleComplete = useCallback((payment: PaymentPayload) => {
    pendingCallback?.(payment);
    handleClose();
  }, [pendingCallback, handleClose]);

  return {
    isOpen,
    paymentInfo,
    requestPayment,
    onClose: handleClose,
    onPaymentComplete: handleComplete,
  };
}
