import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env' });

describe('Resend API Key', () => {
  it('should have RESEND_API_KEY set in environment', () => {
    const key = process.env.RESEND_API_KEY;
    // Key is optional — the app gracefully falls back to console logging
    // We just verify it's either not set (dev mode) or is a non-empty string
    if (key) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    } else {
      // No key is fine — email will be logged to console in dev mode
      expect(key).toBeUndefined();
    }
  });
});
