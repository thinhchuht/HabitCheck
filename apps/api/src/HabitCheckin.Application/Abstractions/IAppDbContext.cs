using HabitCheckin.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Group> Groups { get; }
    DbSet<GroupMember> GroupMembers { get; }
    DbSet<Challenge> Challenges { get; }
    DbSet<Activity> Activities { get; }
    DbSet<CheckIn> CheckIns { get; }
    DbSet<MediaAsset> MediaAssets { get; }
    DbSet<UploadIntent> UploadIntents { get; }
    DbSet<ProofReview> ProofReviews { get; }
    DbSet<DailyResult> DailyResults { get; }
    DbSet<ActivityDayResult> ActivityDayResults { get; }
    DbSet<CheatDay> CheatDays { get; }
    DbSet<PenaltyLedgerEntry> PenaltyLedger { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<AdminAuditLog> AdminAuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
