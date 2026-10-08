import { describe, it, expect } from 'vitest';
import {
  getUserIdentity,
  generateUsername,
  formatHandle,
  resolveUserAddress,
  registerUserIdentity,
} from '../src/lib/username';

describe('Deterministic Username Generator (Collision-Free)', () => {
  it('generates consistent deterministic name for the same address', () => {
    const address = '0xd58b78140974fc246f184a802bef3f35b438aced';
    const first = generateUsername(address);
    const second = generateUsername(address);
    expect(first).toBe(second);
    expect(first).toContain('#aced');
  });

  it('guarantees different addresses with different suffixes have unique names', () => {
    const addr1 = '0xd58b78140974fc246f184a802bef3f35b438aced';
    const addr2 = '0x33bbf741094172cf90a53dc8504aea9cb85b4ff1';
    const addr3 = '0x39dBED3a2bd333467115dE45665cC57F813C4571';

    const name1 = generateUsername(addr1);
    const name2 = generateUsername(addr2);
    const name3 = generateUsername(addr3);

    expect(name1).not.toBe(name2);
    expect(name2).not.toBe(name3);
    expect(name1).not.toBe(name3);
  });

  it('parses identity structure correctly', () => {
    const addr = '0x70c25d0ac76609b010a15bcb91e67c6c86e408e7';
    const identity = getUserIdentity(addr);

    expect(identity.tag).toBe('08e7');
    expect(identity.displayName).toBe(`${identity.name}#08e7`);
    expect(identity.handle).toBe(`@${identity.name}#08e7`);
    expect(identity.slug).toBe(`${identity.name.toLowerCase()}-08e7`);
    expect(formatHandle(addr)).toBe(`@${identity.name}#08e7`);
  });

  it('resolves direct Ethereum hex addresses', () => {
    const addr = '0xd58b78140974fc246f184a802bef3f35b438aced';
    expect(resolveUserAddress(addr)).toBe(addr.toLowerCase());
  });

  it('resolves usernames from registered identity and known address list', () => {
    const addr = '0x33bbf741094172cf90a53dc8504aea9cb85b4ff1';
    registerUserIdentity(addr);
    const id = getUserIdentity(addr);

    expect(resolveUserAddress(id.name)).toBe(addr.toLowerCase());
    expect(resolveUserAddress(id.displayName)).toBe(addr.toLowerCase());
    expect(resolveUserAddress(id.slug)).toBe(addr.toLowerCase());
    expect(resolveUserAddress(id.handle)).toBe(addr.toLowerCase());
    expect(resolveUserAddress(id.name, [addr])).toBe(addr.toLowerCase());
  });

  it('handles null, undefined, or empty address gracefully', () => {
    expect(generateUsername(null)).toBe('Anonymous');
    expect(generateUsername(undefined)).toBe('Anonymous');
    expect(generateUsername('')).toBe('Anonymous');
    expect(generateUsername('0x123')).toBe('Anonymous');
    expect(resolveUserAddress(null)).toBeNull();
    expect(resolveUserAddress('')).toBeNull();
  });
});
