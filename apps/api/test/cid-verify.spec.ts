import { describe, it, expect } from 'vitest';
import { verifyCidContent, SINGLE_BLOCK_MAX_BYTES } from '../src/modules/ipfs/cid-verify';
import { generateDeterministicCid } from '../src/modules/ipfs/ipfs.service';

const enc = (s: string) => new TextEncoder().encode(s);
// `echo "hello world" | ipfs add` (confirmed against public gateways).
const HELLO_V0 = 'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o';

describe('IPFS CID verification (TKT-10)', () => {
  it('accepts content matching a CIDv0 single-block UnixFS file', () => {
    expect(verifyCidContent(HELLO_V0, enc('hello world\n'))).toBe('match');
  });

  it('rejects gateway notice pages or tampered bytes', () => {
    expect(verifyCidContent(HELLO_V0, enc('This IPFS gateway is switching to…'))).toBe('mismatch');
    expect(verifyCidContent(HELLO_V0, enc('hello world'))).toBe('mismatch');
  });

  it('verifies raw-leaf CIDv1, including the API fallback CID', () => {
    const content = enc('goton logo bytes');
    const cid = generateDeterministicCid(Buffer.from(content));
    expect(cid.startsWith('bafkrei')).toBe(true);
    expect(verifyCidContent(cid, content)).toBe('match');
    expect(verifyCidContent(cid, enc('other bytes'))).toBe('mismatch');
  });

  it('reports chunked or unsupported CIDs as unverifiable', () => {
    expect(verifyCidContent(HELLO_V0, new Uint8Array(SINGLE_BLOCK_MAX_BYTES + 1))).toBe(
      'unverifiable',
    );
    expect(verifyCidContent('not-a-cid', enc('x'))).toBe('unverifiable');
  });
});
