import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  type PublicClient,
} from 'viem';
import { gotonFeeSplitterAbi } from '@goton/shared-types';

/**
 * Community takeover (CTO) on a token's GotonFeeSplitter. Only the creator can move the creator
 * share: propose a recipient, wait the 48h timelock, accept it, and optionally lock it forever.
 */

const ZERO = '0x0000000000000000000000000000000000000000';

/** On-chain recipient state of one splitter. */
export interface RedirectState {
  splitter: `0x${string}`;
  creator: `0x${string}`;
  /** Where the creator share is paid today. */
  recipient: `0x${string}`;
  /** Proposed recipient waiting for its timelock, or null. */
  pending: `0x${string}` | null;
  /** Unix seconds from which `pending` can be accepted (0 without a proposal). */
  validAfter: number;
  /** The recipient can never change again. */
  locked: boolean;
  /** False on v1 splitters, which predate `lockCreatorRecipient`. */
  lockSupported: boolean;
}

export type RedirectAction = 'propose' | 'accept' | 'cancel' | 'lock';

/** What the UI may show or enable for `account` at `nowSec`. */
export interface RedirectUiState {
  /** The creator share goes to someone other than the creator. */
  redirected: boolean;
  isCreator: boolean;
  hasPending: boolean;
  /** Seconds until the pending proposal can be accepted (0 when acceptable or none). */
  secondsLeft: number;
  canPropose: boolean;
  /** Accept is shown (possibly disabled while the timelock runs). */
  showAccept: boolean;
  canAccept: boolean;
  canCancel: boolean;
  /** Lock is shown: the creator, a splitter that supports locking, not locked yet. */
  canLock: boolean;
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function isRedirected(state: Pick<RedirectState, 'creator' | 'recipient'>): boolean {
  return state.recipient !== ZERO && !sameAddress(state.recipient, state.creator);
}

export function redirectUiState(
  state: RedirectState,
  account: string | null | undefined,
  nowSec: number,
): RedirectUiState {
  const isCreator = sameAddress(account, state.creator);
  const isPendingRecipient = sameAddress(account, state.pending);
  const hasPending = state.pending !== null && !state.locked;
  const secondsLeft = hasPending ? Math.max(0, Math.ceil(state.validAfter - nowSec)) : 0;
  const showAccept = hasPending && (isCreator || isPendingRecipient);
  return {
    redirected: isRedirected(state),
    isCreator,
    hasPending,
    secondsLeft,
    canPropose: isCreator && !state.locked,
    showAccept,
    canAccept: showAccept && secondsLeft === 0,
    canCancel: isCreator && hasPending,
    canLock: isCreator && state.lockSupported && !state.locked,
  };
}

/** "1d 04h 05m 09s" style countdown; drops leading zero units. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
}

/** The contract answered but has no such function, as opposed to a network failure. */
function isMissingFunction(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  const cause = err.walk(
    (e) => e instanceof ContractFunctionRevertedError || e instanceof ContractFunctionZeroDataError,
  );
  return (
    cause instanceof ContractFunctionRevertedError || cause instanceof ContractFunctionZeroDataError
  );
}

/**
 * Reads the recipient state of `splitter`. A revert on the lock view marks a v1 splitter; any other
 * failure rejects, so a network error never makes a locked splitter look unlocked.
 */
export async function readSplitterRedirectState(
  client: PublicClient,
  splitter: `0x${string}`,
): Promise<RedirectState> {
  const read = <F extends 'creator' | 'creatorRecipient' | 'pendingCreatorRecipient'>(
    functionName: F,
  ) => client.readContract({ address: splitter, abi: gotonFeeSplitterAbi, functionName });
  const [creator, recipient, pending, validAfter, locked] = await Promise.all([
    read('creator'),
    read('creatorRecipient'),
    read('pendingCreatorRecipient'),
    client.readContract({
      address: splitter,
      abi: gotonFeeSplitterAbi,
      functionName: 'pendingCreatorRecipientValidAfter',
    }),
    client
      .readContract({
        address: splitter,
        abi: gotonFeeSplitterAbi,
        functionName: 'creatorRecipientLocked',
      })
      .then((v): boolean | null => v)
      .catch((err: unknown): null => {
        if (isMissingFunction(err)) return null;
        throw err;
      }),
  ]);
  return {
    splitter,
    creator,
    recipient,
    pending: pending === ZERO ? null : pending,
    validAfter: Number(validAfter),
    locked: locked === true,
    lockSupported: locked !== null,
  };
}
