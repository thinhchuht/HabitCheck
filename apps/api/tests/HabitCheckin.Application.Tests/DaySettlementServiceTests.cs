using FluentAssertions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Application.Services;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HabitCheckin.Application.Tests;

public class DaySettlementServiceTests
{
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.DateTime);

    private sealed class FakeNotifier : IRealtimeNotifier
    {
        public Task GroupAsync(Guid groupId, string eventName, object payload, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task UserAsync(Guid userId, string eventName, object payload, CancellationToken ct = default)
            => Task.CompletedTask;
    }

    private sealed class FakeMedia : IMediaStorage
    {
        public Task<UploadSignature> SignProofAsync(Guid groupId, Guid userId, DateOnly date, ProofType proofType, Guid intentId, CancellationToken ct = default)
            => throw new NotImplementedException();

        public Task<UploadSignature> SignAvatarAsync(Guid userId, Guid intentId, CancellationToken ct = default)
            => throw new NotImplementedException();

        public Task<MediaAsset> VerifyAssetAsync(string publicId, ProofType proofType, DateTimeOffset intentAt, CancellationToken ct = default)
            => throw new NotImplementedException();

        public Task DeleteAssetAsync(string publicId, CancellationToken ct = default)
            => throw new NotImplementedException();
    }

    private static async Task<(AppDbContext Db, Group Group, User User, Challenge Challenge)> NewContextAsync()
    {
        var db = DbFactory.New();
        var user = new User
        {
            GoogleSub = "sub-owner",
            Email = "owner@example.com",
            DisplayName = "Chủ nhóm",
            CreatedAt = Now
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var groupHandler = new CreateGroupHandler(db, new FakeUser(user.Id), new FakeClock(Now));
        var dto = await groupHandler.Handle(new CreateGroupCommand("Team A"), default);
        var group = await db.Groups.AsNoTracking().SingleAsync(g => g.InviteCode == dto.InviteCode);

        var ch = new Challenge
        {
            GroupId = group.Id,
            UserId = user.Id,
            Title = "Kỳ test",
            StartDate = Today.AddDays(-1),
            EndDate = Today.AddDays(7),
            Status = ChallengeStatus.Active,
            LockedAt = Now,
            CreatedAt = Now
        };
        db.Challenges.Add(ch);
        // 2 hoạt động, không có check-in nào → cả 2 fail nếu không phải cheat day
        db.Activities.AddRange(
            new Activity
            {
                ChallengeId = ch.Id,
                Name = "Dậy sớm",
                Type = ActivityType.Deadline,
                DeadlineTime = new TimeOnly(6, 0),
                GraceMinutes = 0,
                ProofType = ProofType.Photo,
                SortOrder = 1
            },
            new Activity
            {
                ChallengeId = ch.Id,
                Name = "Học tiếng Anh",
                Type = ActivityType.Duration,
                TargetMinutes = 60,
                ProofType = ProofType.Any,
                SortOrder = 2
            });
        await db.SaveChangesAsync();
        return (db, group, user, ch);
    }

    private static DaySettlementService NewService(AppDbContext db) =>
        new(db, new FakeClock(Now), new FakeNotifier(), new FakeMedia(), NullLogger<DaySettlementService>.Instance);

    [Fact]
    public async Task SettleChallengeDay_CheatDay_WritesZeroPenaltyAndNoDetails()
    {
        var (db, group, user, ch) = await NewContextAsync();
        db.CheatDays.Add(new CheatDay
        {
            UserId = user.Id,
            GroupId = group.Id,
            LocalDate = Today,
            CreatedAt = Now
        });
        await db.SaveChangesAsync();

        await NewService(db).SettleChallengeDayAsync(ch.Id, Today, default);

        var result = await db.DailyResults.SingleAsync(r => r.ChallengeId == ch.Id && r.LocalDate == Today);
        result.TotalCount.Should().Be(2);
        result.PassedCount.Should().Be(0);
        result.FailedCount.Should().Be(0);
        result.PenaltyAmount.Should().Be(0);
        result.IsCheatDay.Should().BeTrue();
        result.Status.Should().Be(ResultStatus.Provisional);
        (await db.ActivityDayResults.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task SettleChallengeDay_WithoutCheatDay_CountsFailuresAndPenalty()
    {
        var (db, _, _, ch) = await NewContextAsync();

        await NewService(db).SettleChallengeDayAsync(ch.Id, Today, default);

        var result = await db.DailyResults.SingleAsync(r => r.ChallengeId == ch.Id && r.LocalDate == Today);
        result.FailedCount.Should().Be(2);
        result.PenaltyAmount.Should().BeGreaterThan(0);
        result.IsCheatDay.Should().BeFalse();
        (await db.ActivityDayResults.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task FinalizeDay_CheatDayResult_DoesNotWriteLedgerEntry()
    {
        var (db, group, user, ch) = await NewContextAsync();
        db.CheatDays.Add(new CheatDay
        {
            UserId = user.Id,
            GroupId = group.Id,
            LocalDate = Today,
            CreatedAt = Now
        });
        await db.SaveChangesAsync();

        var service = NewService(db);
        await service.SettleChallengeDayAsync(ch.Id, Today, default);
        await service.FinalizeDayAsync(Today, default);

        (await db.PenaltyLedger.CountAsync()).Should().Be(0);
        var result = await db.DailyResults.SingleAsync(r => r.ChallengeId == ch.Id && r.LocalDate == Today);
        result.Status.Should().Be(ResultStatus.Final);
    }
}
