import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Send, Gift } from 'lucide-react';
import { useT } from '../locales';
import { COLORS, SP, R, FS, FF, TYPE, CARD_HERO, BUTTON } from '../constants/styles';
import { getReferralCode, buildReferralLink } from '../utils/referralHelpers';
import { shareToWhatsApp, shareToTelegram, copyText } from '../utils/shareHelpers';

/**
 * "Invite a friend" card — the referrer's surface to fetch their referral code and
 * share the link. Isolated and self-contained: it is NOT wired into App.tsx routing
 * here (the integration session mounts it). All strings go through useT() (ru + kk)
 * and every value comes from a design token.
 */
export default function InviteFriend() {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getReferralCode()
      .then((c) => { if (alive) setCode(c); })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const link = code ? buildReferralLink(code) : '';
  const shareText = `${t.settings.inviteShareText} ${link}`;

  const onCopy = async () => {
    const ok = await copyText(link);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const shareBtn: React.CSSProperties = {
    ...BUTTON.secondary,
    flex: 1,
    justifyContent: 'center',
    fontSize: FS.base,
    minHeight: 44,
  };

  return (
    <div style={{ ...CARD_HERO, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: R.md,
            background: COLORS.xpSoft, border: '2px solid var(--ink)', color: 'var(--ink)',
          }}
        >
          <Gift size={18} />
        </span>
        <div>
          <div style={{ ...TYPE.eyebrow }}>ENTprep</div>
          <h2 style={{ ...TYPE.h2 }}>{t.settings.inviteFriend}</h2>
        </div>
      </div>

      <p style={{ ...TYPE.bodySmall, marginBottom: SP.lg }}>{t.settings.inviteFriendDesc}</p>

      {failed ? (
        <p style={{ ...TYPE.bodySmall, color: COLORS.redText }}>{t.settings.inviteError}</p>
      ) : !code ? (
        <p style={{ ...TYPE.bodySmall, color: COLORS.textMuted }}>{t.loading}</p>
      ) : (
        <>
          <div style={{ ...TYPE.eyebrow, marginBottom: SP.xs }}>{t.settings.inviteYourLink}</div>
          <div
            style={{
              fontFamily: FF.mono, fontSize: FS.sm, color: 'var(--text)',
              background: 'var(--bg)', border: '2px solid var(--ink)', borderRadius: R.md,
              padding: `${SP.md}px ${SP.md}px`, marginBottom: SP.md, wordBreak: 'break-all',
            }}
          >
            {link}
          </div>

          <button
            onClick={onCopy}
            style={{ ...BUTTON.primary, width: '100%', justifyContent: 'center', minHeight: 48, marginBottom: SP.md }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t.settings.inviteCopied : t.settings.inviteCopyLink}
          </button>

          <div style={{ display: 'flex', gap: SP.sm }}>
            <button type="button" aria-label="WhatsApp" style={shareBtn} onClick={() => shareToWhatsApp(shareText)}>
              <Send size={15} /> WhatsApp
            </button>
            <button type="button" aria-label="Telegram" style={shareBtn} onClick={() => shareToTelegram(shareText)}>
              <Send size={15} /> Telegram
            </button>
          </div>
        </>
      )}
    </div>
  );
}
