import React, { useState } from 'react';
import { ShieldAlert, Trash2, UserX, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  mode: 'unmatch' | 'block' | 'delete_account';
  targetName: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

const BLOCK_REASONS = [
  'Inappropriate or disrespectful messages',
  'Impersonation or suspicious profile',
  'Harassment or spam',
  'Prefer not to interact',
];

export function ConfirmDialog({
  open,
  mode,
  targetName,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [selectedReason, setSelectedReason] = useState(BLOCK_REASONS[0]);

  if (!open) return null;

  const isBlock = mode === 'block';
  const isDeleteAccount = mode === 'delete_account';

  const title = isDeleteAccount
    ? 'Delete your account?'
    : isBlock
      ? `Block ${targetName}?`
      : `Unmatch ${targetName}?`;

  const subtitle = isDeleteAccount
    ? 'Permanent action · Cannot be undone'
    : isBlock
      ? 'Permanent campus privacy action'
      : 'Removes this conversation';

  const description = isDeleteAccount
    ? 'Deleting your account permanently removes your profile, photos, likes, matches, and all chat conversations. You will be signed out immediately.'
    : isBlock
      ? `Blocking ${targetName} immediately hides your conversation, removes any active match, and prevents either of you from seeing, liking, or messaging each other again.`
      : `Unmatching removes ${targetName} from your Matches list and closes this private chat for both of you.`;

  const confirmLabel = loading
    ? isDeleteAccount
      ? 'Deleting account...'
      : isBlock
        ? 'Blocking...'
        : 'Unmatching...'
    : isDeleteAccount
      ? 'Delete permanently'
      : isBlock
        ? 'Block user'
        : 'Unmatch';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full sm:max-w-md bg-[#121317] border border-[#2A2B32] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#E05A6D] shrink-0">
              {isDeleteAccount ? (
                <Trash2 className="w-5 h-5" />
              ) : isBlock ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <UserX className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="font-display text-lg font-semibold text-[#F3F4F6]"
              >
                {title}
              </h3>
              <p className="text-xs text-[#9CA3AF]">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1A1B20] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#9CA3AF] leading-relaxed mb-5">
          {description}
        </p>

        {isBlock && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-[#9CA3AF] mb-2">
              Reason (private to NearU safety)
            </label>
            <div className="space-y-2">
              {BLOCK_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${
                    selectedReason === reason
                      ? 'bg-[#1A1B20] border-[#E05A6D] text-[#F3F4F6]'
                      : 'bg-[#0D0E12] border-[#2A2B32] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium text-[#F3F4F6] bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isBlock ? selectedReason : undefined)}
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#E05A6D] hover:bg-[#cc4a5d] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
