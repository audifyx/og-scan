/** 
 * Bagwork Board - gig economy job posting system where players post and take tasks.
 * Integrates with NFTs for reputation and skill tracking.
 */

export type JobCategory =
  | 'delivery'
  | 'escort'
  | 'courier'
  | 'hacking'
  | 'collection'
  | 'trading'
  | 'crafting'
  | 'farming'
  | 'bounty';

export type JobDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';

export type JobStatus = 'available' | 'in-progress' | 'completed' | 'abandoned' | 'failed';

export interface BagworkJob {
  id: string;
  posterId: string;
  category: JobCategory;
  title: string;
  description: string;
  difficulty: JobDifficulty;
  reward: {
    credits: number;
    xp: number;
    nftRewards?: string[]; // NFT IDs as rewards
  };
  requirements?: {
    minReputation?: number;
    skillsRequired?: string[];
    itemsRequired?: string[];
  };
  location?: { x: number; y: number; z: number };
  deadline?: number; // Timestamp
  acceptedBy?: string;
  status: JobStatus;
  createdAt: number;
  completedAt?: number;
  timeLimit?: number; // milliseconds
}

export interface PlayerReputation {
  userId: string;
  score: number; // 0-1000
  jobsCompleted: number;
  jobsFailed: number;
  avgRating: number; // 0-5
  reviews: Array<{
    fromUser: string;
    rating: number;
    text: string;
  }>;
  badges: string[]; // NFT badge IDs
  skills: Map<string, number>; // Skill name -> level (0-100)
}

export interface SkillBadge {
  id: string;
  name: string;
  description: string;
  category: JobCategory;
  requirement: number; // Reputation score needed
  icon: string;
}

/**
 * Bagwork Board - manages all jobs.
 */
export class BagworkBoard {
  private jobs: Map<string, BagworkJob> = new Map();
  private playerReputations: Map<string, PlayerReputation> = new Map();
  private jobIdCounter: number = 0;
  private skillBadges: Map<string, SkillBadge> = new Map();

  constructor() {
    this.initializeDefaultBadges();
  }

  private initializeDefaultBadges() {
    const badges: SkillBadge[] = [
      {
        id: 'courier-1',
        name: 'Apprentice Courier',
        description: 'Completed 5 delivery jobs',
        category: 'courier',
        requirement: 100,
        icon: 'badge-courier-1',
      },
      {
        id: 'hacker-1',
        name: 'Script Kiddie',
        description: 'Completed 3 hacking jobs',
        category: 'hacking',
        requirement: 150,
        icon: 'badge-hacker-1',
      },
      {
        id: 'trader-1',
        name: 'Crypto Novice',
        description: 'Completed 10 trading jobs',
        category: 'trading',
        requirement: 200,
        icon: 'badge-trader-1',
      },
    ];

    badges.forEach((badge) => {
      this.skillBadges.set(badge.id, badge);
    });
  }

  /**
   * Post a new job.
   */
  postJob(job: Omit<BagworkJob, 'id' | 'status' | 'createdAt'>): BagworkJob {
    const fullJob: BagworkJob = {
      id: `job-${this.jobIdCounter++}`,
      status: 'available',
      createdAt: Date.now(),
      ...job,
    };

    this.jobs.set(fullJob.id, fullJob);
    console.log(`[v0] Job posted: ${fullJob.title} (${fullJob.id})`);

    return fullJob;
  }

  /**
   * Get available jobs.
   */
  getAvailableJobs(category?: JobCategory, maxDistance?: number, playerPos?: { x: number; y: number; z: number }): BagworkJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => {
        // Status check
        if (job.status !== 'available') return false;

        // Category filter
        if (category && job.category !== category) return false;

        // Distance filter
        if (maxDistance && playerPos && job.location) {
          const dist = Math.hypot(
            job.location.x - playerPos.x,
            job.location.z - playerPos.z
          );
          if (dist > maxDistance) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by reward
        return b.reward.credits - a.reward.credits;
      });
  }

  /**
   * Accept a job.
   */
  acceptJob(jobId: string, userId: string): BagworkJob | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'available') {
      console.error('[v0] Job not available');
      return null;
    }

    // Check requirements
    const reputation = this.getPlayerReputation(userId);
    if (job.requirements?.minReputation && reputation.score < job.requirements.minReputation) {
      console.error('[v0] Insufficient reputation');
      return null;
    }

    job.status = 'in-progress';
    job.acceptedBy = userId;

    console.log(`[v0] Job accepted: ${job.title} by ${userId}`);
    return job;
  }

  /**
   * Complete a job.
   */
  completeJob(jobId: string, userId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'in-progress' || job.acceptedBy !== userId) {
      console.error('[v0] Cannot complete job');
      return false;
    }

    job.status = 'completed';
    job.completedAt = Date.now();

    // Award reputation and rewards
    this.awardJobCompletion(userId, job);

    console.log(`[v0] Job completed: ${job.title}`);
    return true;
  }

  /**
   * Abandon a job.
   */
  abandonJob(jobId: string, userId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.acceptedBy !== userId) {
      return false;
    }

    job.status = 'abandoned';

    // Penalize reputation
    const reputation = this.getPlayerReputation(userId);
    reputation.score = Math.max(0, reputation.score - 25);
    reputation.jobsFailed++;

    console.log(`[v0] Job abandoned: ${job.title}`);
    return true;
  }

  private awardJobCompletion(userId: string, job: BagworkJob) {
    const reputation = this.getPlayerReputation(userId);

    // Award credits/XP/NFTs
    reputation.score += 50 + job.difficulty === 'legendary' ? 100 : job.difficulty === 'hard' ? 50 : 10;
    reputation.jobsCompleted++;

    // Award skill XP
    const categorySkill = `${job.category}-skill`;
    const currentLevel = reputation.skills.get(categorySkill) || 0;
    reputation.skills.set(categorySkill, currentLevel + 10);

    // Check for badge unlock
    this.checkBadgeUnlocks(userId, reputation);

    console.log(`[v0] Reputation awarded to ${userId}: +50 points`);
  }

  private checkBadgeUnlocks(userId: string, reputation: PlayerReputation) {
    this.skillBadges.forEach((badge) => {
      if (!reputation.badges.includes(badge.id) && reputation.score >= badge.requirement) {
        reputation.badges.push(badge.id);
        console.log(`[v0] Badge unlocked for ${userId}: ${badge.name}`);
      }
    });
  }

  /**
   * Get or create player reputation.
   */
  getPlayerReputation(userId: string): PlayerReputation {
    if (!this.playerReputations.has(userId)) {
      this.playerReputations.set(userId, {
        userId,
        score: 0,
        jobsCompleted: 0,
        jobsFailed: 0,
        avgRating: 0,
        reviews: [],
        badges: [],
        skills: new Map(),
      });
    }

    return this.playerReputations.get(userId)!;
  }

  /**
   * Leave a review for a user.
   */
  leaveReview(fromUserId: string, toUserId: string, rating: number, text: string) {
    const reputation = this.getPlayerReputation(toUserId);

    reputation.reviews.push({
      fromUser: fromUserId,
      rating,
      text,
    });

    // Update average rating
    const totalRating = reputation.reviews.reduce((sum, r) => sum + r.rating, 0);
    reputation.avgRating = totalRating / reputation.reviews.length;

    console.log(`[v0] Review left for ${toUserId}: ${rating}/5 stars`);
  }

  /**
   * Get leaderboard.
   */
  getLeaderboard(limit: number = 10): Array<{ userId: string; score: number; jobsCompleted: number; rating: number }> {
    return Array.from(this.playerReputations.values())
      .map((r) => ({
        userId: r.userId,
        score: r.score,
        jobsCompleted: r.jobsCompleted,
        rating: r.avgRating,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search jobs by keyword.
   */
  searchJobs(query: string): BagworkJob[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.jobs.values()).filter(
      (job) =>
        job.title.toLowerCase().includes(lowerQuery) ||
        job.description.toLowerCase().includes(lowerQuery)
    );
  }

  dispose() {
    this.jobs.clear();
    this.playerReputations.clear();
    this.skillBadges.clear();
  }
}
