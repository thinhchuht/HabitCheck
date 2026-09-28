using HabitCheckin.Application.Abstractions;
using HabitCheckin.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<CheckIn> CheckIns => Set<CheckIn>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<UploadIntent> UploadIntents => Set<UploadIntent>();
    public DbSet<ProofReview> ProofReviews => Set<ProofReview>();
    public DbSet<DailyResult> DailyResults => Set<DailyResult>();
    public DbSet<ActivityDayResult> ActivityDayResults => Set<ActivityDayResult>();
    public DbSet<PenaltyLedgerEntry> PenaltyLedger => Set<PenaltyLedgerEntry>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
