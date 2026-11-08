/**
 * XIntel — the X/Twitter section of the OG scanner (W2 + W3 completions).
 *
 * Renders an XIntel payload (see web/src/crypto/xintel.ts). Every signal
 * carries an availability state: available values are shown with their
 * source, unavailable signals render as "Unavailable" with the reason —
 * NEVER as zero. No counts are ever invented here.
 *
 * Theme: black background, white text, gold accent #e8b84a (high contrast
 * per the 2026-11-08 contrast rule). No emoji icons.
 */
import { AtSign, BadgeCheck, BarChart3, Calendar, Flame, Gauge, Globe, Info, Link2, Loader2, Megaphone, MessageSquare, PhoneCall, RefreshCw, Send, ShieldCheck, TrendingUp, Twitter, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { XAccountAudit, XIntel, XOtherSocialLink, XSignal } from "@/crypto/xintel";

const GOLD = "#e8b84a";

interface Props {
  intel: XIntel | null;
  loading?: boolean;
  onRetry?: () => void;
  className?: string;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtAge(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days < 1) return "Less than a day old";
  if (days === 1) return "1 day old";
  if (days < 30) return `${days} days old`;
  if (days < 365) return `${Math.round(days / 30)} months old`;
  return `${(days / 365).toFixed(1)} years old`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtHour(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
}

function fmtGrowth(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "No baseline — previous hour had 0 mentions";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function kindLabel(kind: XOtherSocialLink["kind"]): string {
  if (kind === "telegram") return "Telegram";
  if (kind === "discord") return "Discord";
  if (kind === "website") return "Website";
  return "Link";
}

function kindIcon(kind: XOtherSocialLink["kind"]) {
  if (kind === "telegram") return <Send className="h-4 w-4 shrink-0" style={{ color: GOLD }} />;
  if (kind === "discord") return <MessageSquare className="h-4 w-4 shrink-0" style={{ color: GOLD }} />;
  if (kind === "website") return <Globe className="h-4 w-4 shrink-0" style={{ color: GOLD }} />;
  return <Link2 className="h-4 w-4 shrink-0" style={{ color: GOLD }} />;
}

/** Plain-words verdict from the audit's REAL fields only — never a bot %. */
function auditVerdict(audit: XAccountAudit): string {
  const parts: string[] = [audit.verified ? "Verified account." : "Not verified."];
  if (audit.accountAgeDays != null) {
    parts.push(
      audit.accountAgeDays < 30
        ? `Only ${audit.accountAgeDays} days old — very new, treat with caution.`
        : `${fmtAge(audit.accountAgeDays)}.`,
    );
  }
  if (audit.followers != null && audit.followers < 100) {
    parts.push("Very few followers.");
  }
  return parts.join(" ");
}

function Unavailable({ reason, detail }: { reason?: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">Unavailable</div>
        {detail ? <div className="text-xs leading-relaxed text-white/60">{detail}</div> : null}
        {reason ? <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-white/60">{reason}</div> : null}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-b-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-right text-sm font-medium text-white">{children}</span>
    </div>
  );
}

function Section({
  icon,
  title,
  source,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span style={{ color: GOLD }}>{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
        {source ? (
          <Badge variant="outline" className="ml-auto border-white/20 text-[10px] text-white/60">
            {source}
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function XIntel({ intel, loading, onRetry, className }: Props) {
  if (loading && !intel) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-black p-4 text-white", className)}>
        <div className="flex items-center gap-2">
          <Twitter className="h-5 w-5" style={{ color: GOLD }} />
          <h3 className="text-base font-bold text-white">X Intelligence</h3>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking X sources…
        </div>
      </div>
    );
  }

  if (!intel) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-black p-4 text-white", className)}>
        <div className="flex items-center gap-2">
          <Twitter className="h-5 w-5" style={{ color: GOLD }} />
          <h3 className="text-base font-bold text-white">X Intelligence</h3>
        </div>
        <p className="mt-3 text-sm text-white/60">No X data loaded for this token yet.</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-black"
            style={{ backgroundColor: GOLD, borderColor: GOLD }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Check X
          </button>
        ) : null}
      </div>
    );
  }

  const linked = intel.linkedAccount;
  const profile = intel.profile;
  const fetched = intel.fetchedAt ? new Date(intel.fetchedAt) : null;

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black p-4 text-white", className)}>
      <div className="flex items-center gap-2">
        <Twitter className="h-5 w-5" style={{ color: GOLD }} />
        <h3 className="text-base font-bold text-white">X Intelligence</h3>
        {fetched && !Number.isNaN(fetched.getTime()) ? (
          <span className="ml-auto text-xs text-white/60">
            {fetched.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Refresh X data"
            className="rounded-md border border-white/15 p-1.5 text-white/70 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        {/* Linked account — the one signal with real keyless sources. */}
        <Section
          icon={<AtSign className="h-4 w-4" />}
          title="Linked X account"
          source={linked.source}
        >
          {linked.status === "available" && linked.value ? (
            <div>
              <a
                href={linked.value.url}
                target="_blank"
                rel="noreferrer"
                className="text-base font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                @{linked.value.handle}
              </a>
              <div className="mt-1 text-xs text-white/60">
                {linked.value.agreement === "agree"
                  ? "Confirmed by DexScreener and GeckoTerminal."
                  : linked.value.agreement === "single"
                    ? `Listed by ${linked.value.sources[0]} only.`
                    : "Sources disagree — see note."}
              </div>
              {linked.value.note ? (
                <div className="mt-2 text-xs leading-relaxed text-amber-300">{linked.value.note}</div>
              ) : null}
            </div>
          ) : (
            <Unavailable reason={linked.reason} detail={linked.detail} />
          )}
        </Section>

        {/* Profile enrichment — needs the _xsocial proxy + X Bearer token. */}
        <Section
          icon={<Users className="h-4 w-4" />}
          title="Profile"
          source={profile.source}
        >
          {profile.status === "available" && profile.value ? (
            <div>
              <Row label="Followers">{fmtNum(profile.value.followers)}</Row>
              <Row label="Following">{fmtNum(profile.value.following)}</Row>
              <Row label="Posts">{fmtNum(profile.value.tweetCount)}</Row>
              <Row label="Account age">
                {fmtAge(profile.value.accountAgeDays)}
                {profile.value.createdAt ? (
                  <span className="ml-1 text-xs text-white/60">({fmtDate(profile.value.createdAt)})</span>
                ) : null}
              </Row>
              <Row label="Verified">
                {profile.value.verified ? (
                  <span className="inline-flex items-center gap-1" style={{ color: GOLD }}>
                    <BadgeCheck className="h-4 w-4" /> Yes
                  </span>
                ) : (
                  "No"
                )}
              </Row>
              {profile.value.description ? (
                <p className="mt-2 text-xs leading-relaxed text-white/60">{profile.value.description}</p>
              ) : null}
            </div>
          ) : (
            <Unavailable reason={profile.reason} detail={profile.detail} />
          )}
        </Section>

        {/* Mentions — no real source. */}
        <Section icon={<MessageSquare className="h-4 w-4" />} title="Recent mentions">
          <Unavailable reason={intel.mentions.reason} detail={intel.mentions.detail} />
        </Section>

        {/* KOL activity — no real source. */}
        <Section icon={<Flame className="h-4 w-4" />} title="KOL activity">
          <Unavailable reason={intel.kolActivity.reason} detail={intel.kolActivity.detail} />
        </Section>

        {/* Sentiment — never synthetic. */}
        <Section icon={<BarChart3 className="h-4 w-4" />} title="Sentiment">
          <Unavailable reason={intel.sentiment.reason} detail={intel.sentiment.detail} />
        </Section>

        {/* Other socials (W3) — keyless DexScreener + GeckoTerminal listings. */}
        <Section
          icon={<Globe className="h-4 w-4" />}
          title="Other socials"
          source={intel.devOtherSocials?.source}
        >
          {intel.devOtherSocials?.status === "available" && intel.devOtherSocials.value ? (
            <div>
              {intel.devOtherSocials.value.links.map((link) => (
                <div
                  key={link.url}
                  className="flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {kindIcon(link.kind)}
                    <span className="min-w-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium hover:underline"
                        style={{ color: GOLD }}
                      >
                        {link.label}
                      </a>
                      <span className="block text-xs text-white/60">
                        {kindLabel(link.kind)} · {link.sources.join(" + ")}
                        {link.agreement === "agree" ? " · both sources agree" : ""}
                      </span>
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-xs font-medium"
                    style={{
                      color:
                        link.liveStatus === "reachable"
                          ? "#3dd68c"
                          : link.liveStatus === "dead"
                            ? "#ff5c5c"
                            : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {link.liveStatus === "reachable"
                      ? `Reachable${link.httpStatus != null ? ` (HTTP ${link.httpStatus})` : ""}`
                      : link.liveStatus === "dead"
                        ? `Dead${link.httpStatus != null ? ` (HTTP ${link.httpStatus})` : ""}`
                        : link.liveStatus === "unknown"
                          ? "Liveness unknown"
                          : "Not checked"}
                  </span>
                </div>
              ))}
              {intel.devOtherSocials.value.note ? (
                <div className="mt-2 text-xs leading-relaxed text-amber-300">
                  {intel.devOtherSocials.value.note}
                </div>
              ) : null}
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                Reachable means the page responded — it does not prove a Telegram group exists or
                has members. Member counts are never claimed.
              </p>
            </div>
          ) : (
            <Unavailable reason={intel.devOtherSocials?.reason} detail={intel.devOtherSocials?.detail} />
          )}
        </Section>

        {/* AMA tracker (W3) — mentions in the dev's own recent posts only. */}
        <Section
          icon={<Megaphone className="h-4 w-4" />}
          title="AMA tracker"
          source={intel.devAmaTracker?.source}
        >
          {intel.devAmaTracker?.status === "available" && intel.devAmaTracker.value ? (
            <div>
              <p className="mb-2 text-xs leading-relaxed text-white/60">
                Mentions only — a tweet mentioning an AMA is never proof one happened.
              </p>
              {intel.devAmaTracker.value.amaMentions.length ? (
                <div className="space-y-2">
                  {intel.devAmaTracker.value.amaMentions.map((m) => (
                    <div key={m.tweetId} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                      <a
                        href={`https://x.com/i/status/${m.tweetId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm leading-relaxed text-white hover:underline"
                      >
                        {m.text}
                      </a>
                      <div className="mt-1 text-xs text-white/60">
                        @{intel.devAmaTracker.value?.handle}
                        {m.createdAt ? ` · ${fmtDate(m.createdAt)}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  No AMA or Space mentions in the linked account&apos;s recent posts.
                </p>
              )}
              <div className="mt-3">
                <Row label="Dev identity">
                  {intel.devAmaTracker.value.identityStatus === "unverifiable"
                    ? "Unverifiable"
                    : intel.devAmaTracker.value.identityStatus === "self_shared"
                      ? "Self-shared"
                      : "Anonymous"}
                </Row>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  {intel.devAmaTracker.value.identityNote}
                </p>
                <Row label="Promises kept / broken">
                  {intel.devAmaTracker.value.promisesStatus === "unverifiable"
                    ? "Unverifiable"
                    : intel.devAmaTracker.value.promisesStatus}
                </Row>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  {intel.devAmaTracker.value.promisesNote}
                </p>
              </div>
            </div>
          ) : (
            <Unavailable reason={intel.devAmaTracker?.reason} detail={intel.devAmaTracker?.detail} />
          )}
        </Section>

        {/* X account audit (W3) — age/verified from the bearer-backed profile. */}
        <Section
          icon={<ShieldCheck className="h-4 w-4" />}
          title="X account audit"
          source={intel.accountAudit?.source}
        >
          {intel.accountAudit?.status === "available" && intel.accountAudit.value ? (
            <div>
              <Row label="Account age">
                {fmtAge(intel.accountAudit.value.accountAgeDays)}
                {intel.accountAudit.value.createdAt ? (
                  <span className="ml-1 text-xs text-white/60">({fmtDate(intel.accountAudit.value.createdAt)})</span>
                ) : null}
              </Row>
              <Row label="Verified">
                {intel.accountAudit.value.verified ? (
                  <span className="inline-flex items-center gap-1" style={{ color: GOLD }}>
                    <BadgeCheck className="h-4 w-4" /> Yes
                  </span>
                ) : (
                  "No"
                )}
              </Row>
              <Row label="Protected">{intel.accountAudit.value.protected ? "Yes" : "No"}</Row>
              <Row label="Followers">{fmtNum(intel.accountAudit.value.followers)}</Row>
              <Row label="Following">{fmtNum(intel.accountAudit.value.following)}</Row>
              <Row label="Posts">{fmtNum(intel.accountAudit.value.tweetCount)}</Row>
              <Row label="Bot followers">Not measured</Row>
              <p className="mt-2 text-sm leading-relaxed text-white">
                {auditVerdict(intel.accountAudit.value)}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                {intel.accountAudit.value.botFollowerNote}
              </p>
            </div>
          ) : (
            <Unavailable reason={intel.accountAudit?.reason} detail={intel.accountAudit?.detail} />
          )}
        </Section>

        {/* Caller track records (W3) — no source names callers today. */}
        <Section
          icon={<PhoneCall className="h-4 w-4" />}
          title="Caller track records"
          source={intel.callerRecords?.source}
        >
          {intel.callerRecords?.status === "available" && intel.callerRecords.value ? (
            intel.callerRecords.value.records.length ? (
              <div>
                {intel.callerRecords.value.records.map((r) => (
                  <div
                    key={r.handle.toLowerCase()}
                    className="flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-b-0"
                  >
                    <span className="text-sm font-medium text-white">@{r.handle}</span>
                    <span className="text-right text-sm text-white/60">
                      {r.callsTracked} calls tracked · {r.correctCalls} right
                      {r.accuracyPct != null ? ` · ${r.accuracyPct}% accurate` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/60">No caller records — no calls were tracked.</p>
            )
          ) : (
            <Unavailable reason={intel.callerRecords?.reason} detail={intel.callerRecords?.detail} />
          )}
        </Section>

        {/* Social velocity (W3) — needs a real mention time series. */}
        <Section
          icon={<TrendingUp className="h-4 w-4" />}
          title="Social velocity"
          source={intel.socialVelocity?.source}
        >
          {intel.socialVelocity?.status === "available" && intel.socialVelocity.value ? (
            <div>
              <Row label="Latest hour">{fmtHour(intel.socialVelocity.value.latestHour)}</Row>
              <Row label="Mentions (latest hour)">{fmtNum(intel.socialVelocity.value.latestMentions)}</Row>
              <Row label="Previous hour">{fmtHour(intel.socialVelocity.value.previousHour)}</Row>
              <Row label="Mentions (previous hour)">{fmtNum(intel.socialVelocity.value.previousMentions)}</Row>
              <Row label="Growth">{fmtGrowth(intel.socialVelocity.value.growthPct)}</Row>
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                Measured over {intel.socialVelocity.value.windowHours} hours of real mention counts.
              </p>
            </div>
          ) : (
            <Unavailable reason={intel.socialVelocity?.reason} detail={intel.socialVelocity?.detail} />
          )}
        </Section>

        {/* Community sentiment gauge (W3) — shell only; no community text source exists. */}
        <Section
          icon={<Gauge className="h-4 w-4" />}
          title="Community sentiment"
          source={intel.communitySentiment?.source}
        >
          {intel.communitySentiment?.status === "available" && intel.communitySentiment.value ? (
            <div>
              <div
                className="relative h-2 overflow-hidden rounded-full bg-white/10"
                role="meter"
                aria-label={`Community sentiment: ${intel.communitySentiment.value.vibe ?? "not measured"}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width:
                      intel.communitySentiment.value.vibe === "positive"
                        ? "90%"
                        : intel.communitySentiment.value.vibe === "negative"
                          ? "10%"
                          : intel.communitySentiment.value.vibe === "neutral"
                            ? "50%"
                            : "0%",
                    backgroundColor: GOLD,
                  }}
                />
              </div>
              <Row label="Vibe">
                {intel.communitySentiment.value.vibe
                  ? intel.communitySentiment.value.vibe[0].toUpperCase() + intel.communitySentiment.value.vibe.slice(1)
                  : "Not measured"}
              </Row>
              <Row label="Posts analyzed">{fmtNum(intel.communitySentiment.value.postsAnalyzed)}</Row>
              <Row label="Member growth">
                {intel.communitySentiment.value.memberGrowthPct != null
                  ? `${intel.communitySentiment.value.memberGrowthPct}%`
                  : "Not measured"}
              </Row>
              <Row label="Bot %">
                {intel.communitySentiment.value.botPct != null
                  ? `${intel.communitySentiment.value.botPct}%`
                  : "Not measured"}
              </Row>
              {intel.communitySentiment.value.note ? (
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  {intel.communitySentiment.value.note}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/10" aria-label="Community sentiment gauge — no data">
                <div className="h-full w-0 rounded-full" style={{ backgroundColor: GOLD }} />
              </div>
              <p className="mt-2 text-center text-xs text-white/60">No community data — gauge not measured</p>
              <div className="mt-2">
                <Unavailable reason={intel.communitySentiment?.reason} detail={intel.communitySentiment?.detail} />
              </div>
            </div>
          )}
        </Section>

        <div className="flex items-center gap-1.5 text-[11px] leading-relaxed text-white/60">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            Only data fetched live from DexScreener, GeckoTerminal, or the X API is shown. Unavailable
            signals are never estimated or shown as zero.
          </span>
        </div>
      </div>
    </div>
  );
}

export type { XIntel, XSignal };
