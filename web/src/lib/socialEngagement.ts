// ============================================================
// OrbitX Social engagement — polls (#203) + reactions (#215).
// Pure & dependency-free helpers over the `gate_meta` JSONB payload
// stored on social_messages rows (no migration, no new table):
//   gate_meta.poll       -> SocialPoll
//   gate_meta.reactions  -> SocialReactions
// One vote per user per poll; one reaction per user per post.
// ============================================================

export type SocialReactionKind = "fire" | "rocket" | "skull";

export const REACTION_KINDS: readonly SocialReactionKind[] = ["fire", "rocket", "skull"];

/** A poll attached to a post. The post text is the question. */
export interface SocialPoll {
  /** 2–4 option labels. */
  options: string[];
  /** Parallel vote counts, same length as options. */
  votes: number[];
  /** user/device id -> option index. One vote per voter. */
  voters: Record<string, number>;
}

/** user ids per reaction kind. A user holds at most one kind per post. */
export type SocialReactions = Partial<Record<SocialReactionKind, string[]>>;

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;
export const MAX_POLL_OPTION_LEN = 60;

/**
 * Build a poll from raw composer inputs. Trims, drops empties and
 * case-insensitive duplicates, caps length and count. Returns null when
 * fewer than 2 usable options remain.
 */
export function createPoll(rawOptions: string[]): SocialPoll | null {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const raw of rawOptions) {
    const opt = (raw ?? "").trim().slice(0, MAX_POLL_OPTION_LEN);
    if (!opt) continue;
    const key = opt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(opt);
    if (options.length >= MAX_POLL_OPTIONS) break;
  }
  if (options.length < MIN_POLL_OPTIONS) return null;
  return { options, votes: options.map(() => 0), voters: {} };
}

/** Total votes cast on a poll (0 when absent). */
export function pollTotal(poll: SocialPoll | null | undefined): number {
  if (!poll) return 0;
  return poll.votes.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/** Vote share per option, 0–100. All zeros before the first vote. */
export function pollPercentages(poll: SocialPoll | null | undefined): number[] {
  if (!poll) return [];
  const total = pollTotal(poll);
  if (total <= 0) return poll.options.map(() => 0);
  return poll.votes.map((v) => Math.round(((Number.isFinite(v) ? v : 0) / total) * 100));
}

/** The option index this user voted for, or null. */
export function myPollVote(poll: SocialPoll | null | undefined, userId: string | null | undefined): number | null {
  if (!poll || !userId) return null;
  const v = poll.voters[userId];
  return typeof v === "number" && v >= 0 && v < poll.options.length ? v : null;
}

/**
 * Cast a poll vote. Same option again removes the vote; a different
 * option moves it. Invalid user/option returns the poll unchanged
 * (same reference). Always returns a new object on change.
 */
export function castPollVote(poll: SocialPoll, userId: string, optionIndex: number): SocialPoll {
  if (!userId || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) return poll;
  const prev = myPollVote(poll, userId);
  if (prev === optionIndex) {
    const votes = poll.votes.slice();
    votes[optionIndex] = Math.max(0, votes[optionIndex] - 1);
    const voters = { ...poll.voters };
    delete voters[userId];
    return { ...poll, votes, voters };
  }
  const votes = poll.votes.slice();
  if (prev !== null) votes[prev] = Math.max(0, votes[prev] - 1);
  votes[optionIndex] = votes[optionIndex] + 1;
  return { ...poll, votes, voters: { ...poll.voters, [userId]: optionIndex } };
}

/** The reaction kind this user holds on a post, or null. */
export function myReaction(reactions: SocialReactions | null | undefined, userId: string | null | undefined): SocialReactionKind | null {
  if (!reactions || !userId) return null;
  for (const kind of REACTION_KINDS) {
    if ((reactions[kind] ?? []).includes(userId)) return kind;
  }
  return null;
}

/** Count per reaction kind (missing kinds count as 0). */
export function reactionCounts(reactions: SocialReactions | null | undefined): Record<SocialReactionKind, number> {
  return {
    fire: reactions?.fire?.length ?? 0,
    rocket: reactions?.rocket?.length ?? 0,
    skull: reactions?.skull?.length ?? 0,
  };
}

/**
 * Toggle a reaction. Same kind again removes it; a different kind
 * switches it (one reaction per user per post). Empty kinds are
 * pruned so gate_meta stays small. Invalid input returns the
 * reactions unchanged (same reference).
 */
export function toggleReaction(
  reactions: SocialReactions | null | undefined,
  userId: string,
  kind: SocialReactionKind,
): SocialReactions {
  if (!userId || !REACTION_KINDS.includes(kind)) return reactions ?? {};
  const current = myReaction(reactions, userId);
  const next: SocialReactions = {};
  for (const k of REACTION_KINDS) {
    const ids = (reactions?.[k] ?? []).filter((id) => id !== userId);
    if (k === kind && current !== kind) ids.push(userId);
    if (ids.length > 0) next[k] = ids;
  }
  return next;
}
