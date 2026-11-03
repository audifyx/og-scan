import { describe, it, expect } from "vitest";
import {
  createPoll, pollTotal, pollPercentages, myPollVote, castPollVote,
  myReaction, reactionCounts, toggleReaction,
  type SocialPoll, type SocialReactions,
} from "./socialEngagement";

describe("createPoll", () => {
  it("builds a poll from 2-4 options", () => {
    const p = createPoll(["Yes", "No"]);
    expect(p).toEqual({ options: ["Yes", "No"], votes: [0, 0], voters: {} });
  });
  it("trims, drops empties and duplicates, caps at 4", () => {
    const p = createPoll(["  A ", "", "a", "B", "C", "D", "E"]);
    expect(p?.options).toEqual(["A", "B", "C", "D"]);
  });
  it("returns null with fewer than 2 usable options", () => {
    expect(createPoll(["Only"])).toBeNull();
    expect(createPoll(["", "  "])).toBeNull();
    expect(createPoll([])).toBeNull();
  });
  it("caps option length at 60 chars", () => {
    const p = createPoll(["x".repeat(100), "y"]);
    expect(p?.options[0].length).toBe(60);
  });
});

describe("poll voting", () => {
  const poll: SocialPoll = { options: ["A", "B", "C"], votes: [2, 1, 0], voters: { u1: 0, u2: 0, u3: 1 } };

  it("totals and percentages", () => {
    expect(pollTotal(poll)).toBe(3);
    expect(pollPercentages(poll)).toEqual([67, 33, 0]);
    expect(pollPercentages({ options: ["A", "B"], votes: [0, 0], voters: {} })).toEqual([0, 0]);
  });
  it("reads my vote", () => {
    expect(myPollVote(poll, "u1")).toBe(0);
    expect(myPollVote(poll, "nobody")).toBeNull();
    expect(myPollVote(null, "u1")).toBeNull();
  });
  it("casts a first vote", () => {
    const next = castPollVote(poll, "u9", 2);
    expect(next.votes).toEqual([2, 1, 1]);
    expect(next.voters.u9).toBe(2);
    expect(poll.votes).toEqual([2, 1, 0]); // input untouched
  });
  it("switches a vote to another option", () => {
    const next = castPollVote(poll, "u1", 1);
    expect(next.votes).toEqual([1, 2, 0]);
    expect(next.voters.u1).toBe(1);
  });
  it("tapping the same option removes the vote", () => {
    const next = castPollVote(poll, "u1", 0);
    expect(next.votes).toEqual([1, 1, 0]);
    expect(next.voters.u1).toBeUndefined();
  });
  it("rejects invalid votes unchanged", () => {
    expect(castPollVote(poll, "u9", 5)).toBe(poll);
    expect(castPollVote(poll, "u9", -1)).toBe(poll);
    expect(castPollVote(poll, "", 0)).toBe(poll);
  });
});

describe("reactions", () => {
  const reactions: SocialReactions = { fire: ["u1", "u2"], rocket: ["u3"] };

  it("reads my reaction and counts", () => {
    expect(myReaction(reactions, "u1")).toBe("fire");
    expect(myReaction(reactions, "u3")).toBe("rocket");
    expect(myReaction(reactions, "nobody")).toBeNull();
    expect(reactionCounts(reactions)).toEqual({ fire: 2, rocket: 1, skull: 0 });
    expect(reactionCounts(null)).toEqual({ fire: 0, rocket: 0, skull: 0 });
  });
  it("adds a first reaction", () => {
    const next = toggleReaction(reactions, "u9", "skull");
    expect(next).toEqual({ fire: ["u1", "u2"], rocket: ["u3"], skull: ["u9"] });
  });
  it("switches reaction kind (one per user)", () => {
    const next = toggleReaction(reactions, "u1", "rocket");
    expect(next).toEqual({ fire: ["u2"], rocket: ["u3", "u1"] });
  });
  it("tapping the same kind removes it and prunes the empty key", () => {
    const next = toggleReaction({ skull: ["u1"] }, "u1", "skull");
    expect(next).toEqual({});
  });
  it("rejects invalid input unchanged", () => {
    expect(toggleReaction(reactions, "", "fire")).toEqual(reactions);
    expect(toggleReaction(reactions, "u9", "nope" as never)).toEqual(reactions);
  });
});
