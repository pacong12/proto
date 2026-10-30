import type { PinningPort } from '../domain/ports/ipfs-storage.port';

/** Pins uploads with Pinata when PINATA_JWT is set. */
export class PinataPinningAdapter implements PinningPort {
  async pin(data: Buffer, fileName: string, mimeType: string): Promise<string | null> {
    const pinataJwt = process.env.PINATA_JWT?.trim();
    if (!pinataJwt) return null;
    try {
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), fileName);
      formData.append('pinataMetadata', JSON.stringify({ name: fileName }));

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: formData,
      });
      if (!response.ok) {
        console.warn(
          `Pinata upload failed with status ${response.status}: ${await response.text()}`,
        );
        return null;
      }
      const body = (await response.json()) as { IpfsHash?: string };
      return body?.IpfsHash || null;
    } catch (err) {
      console.warn('Pinata IPFS upload network error, falling back to deterministic CID:', err);
      return null;
    }
  }
}
