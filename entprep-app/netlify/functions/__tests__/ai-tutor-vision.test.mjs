import { describe, it, expect } from 'vitest';
import { isVisionDataUrl, buildRecentMessages } from '../ai-tutor.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA',
  JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ';

describe('isVisionDataUrl', () => {
  it('accepts jpeg/png/webp base64 data URLs', () => {
    expect(isVisionDataUrl(PNG)).toBe(true);
    expect(isVisionDataUrl(JPG)).toBe(true);
    expect(isVisionDataUrl('data:image/webp;base64,UklGRkoAAABXRUJQ')).toBe(true);
  });
  it('rejects non-image, malformed, or non-string', () => {
    expect(isVisionDataUrl('data:image/heic;base64,AAAA')).toBe(false); // heic dropped
    expect(isVisionDataUrl('data:text/plain;base64,AAAA')).toBe(false);
    expect(isVisionDataUrl('https://example.com/x.png')).toBe(false);
    expect(isVisionDataUrl('not a url')).toBe(false);
    expect(isVisionDataUrl(null)).toBe(false);
    expect(isVisionDataUrl(undefined)).toBe(false);
    expect(isVisionDataUrl(42)).toBe(false);
  });
  it('rejects payloads decoding to more than 5MB', () => {
    const tooBig = 'data:image/png;base64,' + 'A'.repeat(7_000_000); // ~5.25MB decoded
    expect(isVisionDataUrl(tooBig)).toBe(false);
    const ok = 'data:image/png;base64,' + 'A'.repeat(1000);
    expect(isVisionDataUrl(ok)).toBe(true);
  });
});

describe('buildRecentMessages', () => {
  it('keeps text-only messages as plain string content', () => {
    const { recentMessages, hasImage } = buildRecentMessages([{ role: 'user', content: 'hi' }]);
    expect(recentMessages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(hasImage).toBe(false);
  });

  it('turns a user message + valid image into a multimodal content array', () => {
    const { recentMessages, hasImage } = buildRecentMessages([{ role: 'user', content: 'реши', images: [PNG] }]);
    expect(hasImage).toBe(true);
    expect(recentMessages[0]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'реши' }, { type: 'image_url', image_url: { url: PNG } }],
    });
  });

  it('omits the text part when an image message has no text', () => {
    const { recentMessages } = buildRecentMessages([{ role: 'user', content: '', images: [PNG] }]);
    expect(recentMessages[0].content).toEqual([{ type: 'image_url', image_url: { url: PNG } }]);
  });

  it('filters out invalid image urls', () => {
    const { recentMessages } = buildRecentMessages([{ role: 'user', content: 'x', images: ['nope', PNG, 'data:image/heic;base64,AAAA'] }]);
    expect(recentMessages[0].content).toEqual([{ type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: PNG } }]);
  });

  it('never attaches images to assistant messages', () => {
    const { recentMessages, hasImage } = buildRecentMessages([{ role: 'assistant', content: 'ответ', images: [PNG] }]);
    expect(recentMessages[0]).toEqual({ role: 'assistant', content: 'ответ' });
    expect(hasImage).toBe(false);
  });

  it('caps images at 4 per message', () => {
    const six = [PNG, PNG, PNG, PNG, PNG, PNG];
    const { recentMessages } = buildRecentMessages([{ role: 'user', content: '', images: six }]);
    expect(recentMessages[0].content).toHaveLength(4);
  });

  it('only keeps the last 8 messages (slice -8)', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    const { recentMessages } = buildRecentMessages(msgs);
    expect(recentMessages).toHaveLength(8);
    expect(recentMessages[0].content).toBe('m2');
    expect(recentMessages[7].content).toBe('m9');
  });
});
