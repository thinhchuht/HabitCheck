using System.Text.Json;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace HabitCheckin.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(x => x.Id);
        b.Property(x => x.GoogleSub).HasMaxLength(191).IsRequired();
        b.HasIndex(x => x.GoogleSub).IsUnique();
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
        b.Property(x => x.AvatarPublicId).HasMaxLength(512);
        b.Property(x => x.AvatarUrl).HasMaxLength(1024);
    }
}

internal sealed class GroupConfiguration : IEntityTypeConfiguration<Group>
{
    public void Configure(EntityTypeBuilder<Group> b)
    {
        b.ToTable("groups");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.InviteCode).HasMaxLength(16).IsRequired();
        b.HasIndex(x => x.InviteCode).IsUnique();
        b.Property(x => x.PenaltyTiers)
            .HasColumnType("jsonb")
            .HasConversion(new ValueConverter<PenaltyTiers, string>(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<PenaltyTiers>(v, (JsonSerializerOptions?)null)!));
        b.Property(x => x.OwnerId).IsRequired();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class GroupMemberConfiguration : IEntityTypeConfiguration<GroupMember>
{
    public void Configure(EntityTypeBuilder<GroupMember> b)
    {
        b.ToTable("group_members");
        b.HasKey(x => new { x.GroupId, x.UserId });
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(16);
        b.HasOne<Group>().WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ChallengeConfiguration : IEntityTypeConfiguration<Challenge>
{
    public void Configure(EntityTypeBuilder<Challenge> b)
    {
        b.ToTable("challenges", t => t.HasCheckConstraint("chk_challenge_date_range", "\"EndDate\" >= \"StartDate\""));
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.HasOne<Group>().WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.GroupId, x.UserId, x.StartDate });
    }
}

internal sealed class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> b)
    {
        b.ToTable("activities", t => t.HasCheckConstraint(
            "chk_activity_type_params",
            "(\"Type\" = 'Deadline' AND \"DeadlineTime\" IS NOT NULL) OR " +
            "(\"Type\" = 'Duration' AND \"TargetMinutes\" IS NOT NULL AND \"TargetMinutes\" > 0) OR " +
            "(\"Type\" = 'Window' AND \"WindowStart\" IS NOT NULL AND \"WindowEnd\" IS NOT NULL AND \"WindowEnd\" > \"WindowStart\")"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Icon).HasMaxLength(16);
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.ProofType).HasConversion<string>().HasMaxLength(16);
        b.HasOne<Challenge>(x => x.Challenge).WithMany(c => c.Activities).HasForeignKey(x => x.ChallengeId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.ChallengeId, x.SortOrder });
    }
}

internal sealed class MediaAssetConfiguration : IEntityTypeConfiguration<MediaAsset>
{
    public void Configure(EntityTypeBuilder<MediaAsset> b)
    {
        b.ToTable("media_assets");
        b.HasKey(x => x.Id);
        b.Property(x => x.PublicId).HasMaxLength(512).IsRequired();
        b.HasIndex(x => x.PublicId).IsUnique();
        b.Property(x => x.ResourceType).HasMaxLength(16).IsRequired();
        b.Property(x => x.SecureUrl).HasMaxLength(1024).IsRequired();
        b.Property(x => x.ThumbnailUrl).HasMaxLength(1024);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class UploadIntentConfiguration : IEntityTypeConfiguration<UploadIntent>
{
    public void Configure(EntityTypeBuilder<UploadIntent> b)
    {
        b.ToTable("upload_intents");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16).IsRequired();
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Activity>().WithMany().HasForeignKey(x => x.ActivityId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.UserId, x.UsedAt });
    }
}

internal sealed class CheckInConfiguration : IEntityTypeConfiguration<CheckIn>
{
    public void Configure(EntityTypeBuilder<CheckIn> b)
    {
        b.ToTable("checkins");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).HasDefaultValue(CheckInStatus.Open);
        b.Property(x => x.Note).HasMaxLength(500);
        b.HasOne<Activity>(x => x.Activity).WithMany().HasForeignKey(x => x.ActivityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<MediaAsset>(x => x.CheckinMedia).WithMany().HasForeignKey(x => x.CheckinMediaId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<MediaAsset>(x => x.CheckoutMedia).WithMany().HasForeignKey(x => x.CheckoutMediaId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.UserId, x.LocalDate });
        // Mỗi (activity, user) chỉ có tối đa 1 phiên OPEN
        b.HasIndex(x => new { x.ActivityId, x.UserId })
            .IsUnique()
            .HasFilter("\"Status\" = 'Open'");
    }
}

internal sealed class ProofReviewConfiguration : IEntityTypeConfiguration<ProofReview>
{
    public void Configure(EntityTypeBuilder<ProofReview> b)
    {
        b.ToTable("proof_reviews");
        b.HasKey(x => x.Id);
        b.Property(x => x.Action).HasConversion<string>().HasMaxLength(16).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500);
        b.HasOne<CheckIn>(x => x.Checkin).WithMany().HasForeignKey(x => x.CheckinId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>(x => x.Reviewer).WithMany().HasForeignKey(x => x.ReviewerId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.CheckinId, x.ReviewerId, x.Action });
    }
}

internal sealed class DailyResultConfiguration : IEntityTypeConfiguration<DailyResult>
{
    public void Configure(EntityTypeBuilder<DailyResult> b)
    {
        b.ToTable("daily_results");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.HasOne<Challenge>(x => x.Challenge).WithMany().HasForeignKey(x => x.ChallengeId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ChallengeId, x.LocalDate }).IsUnique();
        b.HasIndex(x => new { x.UserId, x.LocalDate });
    }
}

internal sealed class CheatDayConfiguration : IEntityTypeConfiguration<CheatDay>
{
    public void Configure(EntityTypeBuilder<CheatDay> b)
    {
        b.ToTable("cheat_days");
        b.HasKey(x => x.Id);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Group>().WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
        // Một user chỉ có 1 cheat day cho một ngày trong một nhóm
        b.HasIndex(x => new { x.UserId, x.GroupId, x.LocalDate }).IsUnique();
    }
}

internal sealed class ActivityDayResultConfiguration : IEntityTypeConfiguration<ActivityDayResult>
{
    public void Configure(EntityTypeBuilder<ActivityDayResult> b)
    {
        b.ToTable("activity_day_results");
        b.HasKey(x => new { x.DailyResultId, x.ActivityId });
        b.Property(x => x.Reason).HasMaxLength(32);
        b.HasOne<DailyResult>().WithMany(d => d.Details).HasForeignKey(x => x.DailyResultId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Activity>().WithMany().HasForeignKey(x => x.ActivityId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PenaltyLedgerEntryConfiguration : IEntityTypeConfiguration<PenaltyLedgerEntry>
{
    public void Configure(EntityTypeBuilder<PenaltyLedgerEntry> b)
    {
        b.ToTable("penalty_ledger");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16).IsRequired();
        b.Property(x => x.Note).HasMaxLength(500);
        b.HasIndex(x => x.DailyResultId).IsUnique();
        b.HasOne<Group>().WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<DailyResult>(x => x.DailyResult).WithMany().HasForeignKey(x => x.DailyResultId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<User>(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.GroupId, x.CreatedAt });
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("refresh_tokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasOne<User>(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.ExpiresAt);
    }
}
