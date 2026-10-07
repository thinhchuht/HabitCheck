using FluentAssertions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Challenges;
using HabitCheckin.Application.CheckIns;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HabitCheckin.Application.Tests;

public class CheckInHandlersTests
{
    // 01:00 UTC = 08:00 giờ VN, ngày 2025-01-15
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);

    private sealed class Context
    {
        public required AppDbContext Db { get; init; }
        public required User User { get; init; }
        public required Group Group { get; init; }
        public required Challenge Challenge { get; init; }
        public required Activity DeadlineActivity { get; init; }
        public required Activity DurationActivity { get; init; }
        public required UploadIntent CheckInIntent { get; init; }
        public required UploadIntent DurationCheckInIntent { get; init; }
        public required UploadIntent CheckOutIntent { get; init; }
        public required FakeClock Clock { get; init; }
        public Mock<IMediaStorage> Media { get; } = new();
        public Mock<IRealtimeNotifier> Realtime { get; } = new();
    }

    private static async Task<Context> CreateAsync(ChallengeStatus status = ChallengeStatus.Active, DateTimeOffset? now = null)
    {
        var db = DbFactory.New();
        var nowUtc = now ?? Now;
        var today = DateOnly.FromDateTime(nowUtc.ToOffset(TimeSpan.FromHours(7)).DateTime);

        var user = new User
        {
            GoogleSub = "sub-1",
            Email = "user1@example.com",
            DisplayName = "User Một",
            CreatedAt = Now
        };
        var group = new Group
        {
            Name = "Team",
            InviteCode = "ABC123",
            OwnerId = user.Id,
            CreatedAt = Now
        };
        var challenge = new Challenge
        {
            GroupId = group.Id,
            UserId = user.Id,
            Title = "Kỳ 1",
            StartDate = today.AddDays(-1),
            EndDate = today.AddDays(1),
            Status = status,
            CreatedAt = Now
        };
        // Mốc 08:00 VN (khung 06:00–08:10: sớm nhất 2h trước, muộn nhất 10 phút sau)
        // — giờ đồng hồ giả 08:00 VN nằm trong khung.
        var deadlineActivity = new Activity
        {
            ChallengeId = challenge.Id,
            Name = "Dậy sớm",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(8, 0),
            GraceMinutes = 0,
            SortOrder = 0
        };
        var durationActivity = new Activity
        {
            ChallengeId = challenge.Id,
            Name = "Học",
            Type = ActivityType.Duration,
            TargetMinutes = 120,
            SortOrder = 1
        };
        var checkInIntent = NewIntent(user.Id, deadlineActivity.Id, UploadIntentKind.CheckIn, nowUtc.AddMinutes(-1));
        var durationCheckInIntent = NewIntent(user.Id, durationActivity.Id, UploadIntentKind.CheckIn, nowUtc.AddMinutes(-1));
        var checkOutIntent = NewIntent(user.Id, durationActivity.Id, UploadIntentKind.CheckOut, nowUtc);

        db.Users.Add(user);
        db.Groups.Add(group);
        db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = user.Id, Role = MemberRole.Owner, JoinedAt = Now });
        db.Challenges.Add(challenge);
        db.Activities.Add(deadlineActivity);
        db.Activities.Add(durationActivity);
        db.UploadIntents.Add(checkInIntent);
        db.UploadIntents.Add(durationCheckInIntent);
        db.UploadIntents.Add(checkOutIntent);
        await db.SaveChangesAsync();

        var tx = new Context
        {
            Db = db,
            User = user,
            Group = group,
            Challenge = challenge,
            DeadlineActivity = deadlineActivity,
            DurationActivity = durationActivity,
            CheckInIntent = checkInIntent,
            DurationCheckInIntent = durationCheckInIntent,
            CheckOutIntent = checkOutIntent,
            Clock = new FakeClock(nowUtc)
        };
        SetupMocks(tx);
        return tx;
    }

    private static UploadIntent NewIntent(Guid userId, Guid activityId, UploadIntentKind kind, DateTimeOffset intentAt) => new()
    {
        UserId = userId,
        ActivityId = activityId,
        Kind = kind,
        IntentAt = intentAt,
        ExpiresAt = intentAt.AddMinutes(15)
    };

    private static void SetupMocks(Context tx)
    {
        tx.Media
            .Setup(m => m.VerifyAssetAsync(It.IsAny<string>(), It.IsAny<ProofType>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Returns((string publicId, ProofType _, DateTimeOffset intentAt, CancellationToken _) =>
                Task.FromResult(new MediaAsset
                {
                    UserId = tx.User.Id,
                    PublicId = publicId,
                    ResourceType = "image",
                    SecureUrl = $"https://cdn.example/{publicId}.jpg",
                    UploadedAt = intentAt
                }));
        tx.Realtime
            .Setup(r => r.GroupAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        tx.Realtime
            .Setup(r => r.UserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private static CheckInHandler CheckInHandler(Context tx) =>
        new(tx.Db, new FakeUser(tx.User.Id), tx.Clock, tx.Media.Object, tx.Realtime.Object);

    private static CheckOutHandler CheckOutHandler(Context tx) =>
        new(tx.Db, new FakeUser(tx.User.Id), tx.Clock, tx.Media.Object, tx.Realtime.Object);

    [Fact]
    public async Task CheckIn_Deadline_Success_UsesIntentTimeAndMarksIntentUsed()
    {
        var tx = await CreateAsync();

        var result = await CheckInHandler(tx)
            .Handle(new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", "  ok  "), default);

        result.Status.Should().Be(CheckInStatus.Completed);
        result.CheckinAt.Should().Be("2025-01-15T00:59:00Z"); // intent.IntentAt, không phải giờ server
        result.LocalDate.Should().Be("2025-01-15");
        result.ActivityName.Should().Be("Dậy sớm");
        result.CheckinMedia.PublicId.Should().Be("pub-1");
        result.Note.Should().Be("ok");
        tx.CheckInIntent.UsedAt.Should().Be(Now);

        tx.Realtime.Verify(r => r.GroupAsync(tx.Group.Id, EventNames.CheckInCreated,
            It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        tx.Realtime.Verify(r => r.GroupAsync(tx.Group.Id, EventNames.SessionStarted,
            It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CheckIn_ExpiredIntent_ThrowsBusinessRule()
    {
        var tx = await CreateAsync();
        tx.CheckInIntent.ExpiresAt = Now.AddMinutes(-1);
        await tx.Db.SaveChangesAsync();

        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task CheckIn_Deadline_BeforeWindow_ThrowsBusinessRule()
    {
        var tx = await CreateAsync();
        // Mốc 11:00 VN → khung 09:00–11:10; đồng hồ 08:00 VN → chưa mở (sớm hơn 2h).
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(11, 0);
        await tx.Db.SaveChangesAsync();

        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        var ex = await act.Should().ThrowAsync<BusinessRuleException>();
        ex.Which.Message.Should().Contain("Chưa đến giờ check-in");
    }

    [Fact]
    public async Task CheckIn_Deadline_AfterWindow_ThrowsBusinessRule()
    {
        var tx = await CreateAsync();
        // Mốc 07:00 VN → khung 05:00–07:10; đồng hồ 08:00 VN → quá khung (muộn hơn 10 phút).
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(7, 0);
        await tx.Db.SaveChangesAsync();

        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        var ex = await act.Should().ThrowAsync<BusinessRuleException>();
        ex.Which.Message.Should().Contain("Quá giờ check-in");
    }

    // ---------- DEADLINE 0:00 (mốc sớm neo sang ngày sau: cửa sổ ngày X = [X 22:00 → X+1 00:10]) ----------

    [Fact]
    public async Task CheckIn_Deadline_0h_EveningWindow_AttributesToCurrentDay()
    {
        // Check-in lúc 22:30 VN ngày 15/01 (2h trước mốc 0:00 tối nay) → tính cho ngày 15/01.
        var tx = await CreateAsync(now: new DateTimeOffset(2025, 1, 15, 15, 30, 0, TimeSpan.Zero));
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(0, 0);
        await tx.Db.SaveChangesAsync();

        var result = await CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        result.LocalDate.Should().Be("2025-01-15");
    }

    [Fact]
    public async Task CheckIn_Deadline_0h_MorningGrace_AttributesToPreviousDay()
    {
        // 00:05 VN sau nửa đêm thuộc cửa sổ của ngày trước ([14/01 22:00 → 15/01 00:10])
        // → tính cho ngày 14/01, không phải ngày 15/01.
        var tx = await CreateAsync(now: new DateTimeOffset(2025, 1, 14, 17, 5, 0, TimeSpan.Zero));
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(0, 0);
        await tx.Db.SaveChangesAsync();

        var result = await CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        result.LocalDate.Should().Be("2025-01-14");
    }

    [Fact]
    public async Task CheckIn_Deadline_0h_OutsideBothWindows_ThrowsBusinessRule()
    {
        // 05:00 VN: ngoài cửa sổ ngày trước (chốt 00:10) và trước cửa sổ tối nay (mở 22:00).
        var tx = await CreateAsync(now: new DateTimeOffset(2025, 1, 14, 22, 0, 0, TimeSpan.Zero));
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(0, 0);
        await tx.Db.SaveChangesAsync();

        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        var ex = await act.Should().ThrowAsync<BusinessRuleException>();
        ex.Which.Message.Should().Contain("Chưa đến giờ check-in");
    }

    [Fact]
    public async Task CheckIn_Deadline_0h_EveningSecondCheckinSameDay_ThrowsConflict()
    {
        // Đã check-in tối ngày 15/01 (22:30) → check-in tiếp lúc 23:00 cùng ngày bị chặn.
        var tx = await CreateAsync(now: new DateTimeOffset(2025, 1, 15, 15, 30, 0, TimeSpan.Zero));
        tx.DeadlineActivity.DeadlineTime = new TimeOnly(0, 0);
        await tx.Db.SaveChangesAsync();

        var handler = CheckInHandler(tx);
        await handler.Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        var secondIntent = NewIntent(tx.User.Id, tx.DeadlineActivity.Id, UploadIntentKind.CheckIn, tx.Clock.UtcNow);
        tx.Db.UploadIntents.Add(secondIntent);
        await tx.Db.SaveChangesAsync();

        var act = () => handler.Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, secondIntent.Id, "pub-2", null), default);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task CheckIn_DraftChallengeNotStarted_ThrowsBusinessRule()
    {
        var tx = await CreateAsync(status: ChallengeStatus.Draft);
        var today = DateOnly.FromDateTime(Now.ToOffset(TimeSpan.FromHours(7)).DateTime);
        tx.Challenge.StartDate = today.AddDays(1); // DRAFT chưa đến hạn
        await tx.Db.SaveChangesAsync();

        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task CheckIn_DraftChallengeDue_ActivatesChallengeAndSucceeds()
    {
        var tx = await CreateAsync(status: ChallengeStatus.Draft); // StartDate <= hôm nay

        var result = await CheckInHandler(tx)
            .Handle(new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);

        result.Status.Should().Be(CheckInStatus.Completed);
        tx.Challenge.Status.Should().Be(ChallengeStatus.Active);
        tx.Challenge.LockedAt.Should().Be(Now);
    }

    [Fact]
    public async Task ActivateIfDue_DraftChallengeWithoutActivities_StaysDraft()
    {
        var tx = await CreateAsync(status: ChallengeStatus.Draft); // StartDate <= hôm nay
        var today = DateOnly.FromDateTime(Now.ToOffset(TimeSpan.FromHours(7)).DateTime);

        // Xoá hết hoạt động để kỳ trở nên rỗng (0 hoạt động)
        var activities = await tx.Db.Activities
            .Where(a => a.ChallengeId == tx.Challenge.Id).ToListAsync();
        tx.Db.Activities.RemoveRange(activities);
        await tx.Db.SaveChangesAsync();

        var ch = await tx.Db.Challenges.Include(c => c.Activities)
            .FirstAsync(c => c.Id == tx.Challenge.Id);

        await ChallengeAccess.ActivateIfDueAsync(tx.Db, ch, today, Now, default);

        ch.Status.Should().Be(ChallengeStatus.Draft);
        ch.LockedAt.Should().BeNull();
    }

    [Fact]
    public async Task CheckIn_DuplicateSameDay_ThrowsConflict()
    {
        var tx = await CreateAsync();
        var handler = CheckInHandler(tx);

        await handler.Handle(new CheckInCommand(tx.DeadlineActivity.Id, tx.CheckInIntent.Id, "pub-1", null), default);
        var secondIntent = NewIntent(tx.User.Id, tx.DeadlineActivity.Id, UploadIntentKind.CheckIn, Now);
        tx.Db.UploadIntents.Add(secondIntent);
        await tx.Db.SaveChangesAsync();

        var act = () => handler.Handle(
            new CheckInCommand(tx.DeadlineActivity.Id, secondIntent.Id, "pub-2", null), default);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task CheckIn_WrongIntentKind_ThrowsBusinessRule()
    {
        var tx = await CreateAsync();

        // Dùng intent CHECKOUT cho thao tác CHECKIN => không hợp lệ
        var act = () => CheckInHandler(tx).Handle(
            new CheckInCommand(tx.DurationActivity.Id, tx.CheckOutIntent.Id, "pub-1", null), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task CheckIn_Duration_CompletesWithSingleTick_AndBlocksSecond()
    {
        var tx = await CreateAsync();
        var handler = CheckInHandler(tx);

        var first = await handler.Handle(
            new CheckInCommand(tx.DurationActivity.Id, tx.DurationCheckInIntent.Id, "d1", null), default);

        first.Status.Should().Be(CheckInStatus.Completed);
        tx.Realtime.Verify(r => r.GroupAsync(tx.Group.Id, EventNames.CheckInCreated,
            It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        tx.Realtime.Verify(r => r.GroupAsync(tx.Group.Id, EventNames.SessionStarted,
            It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Never);

        var secondIntent = NewIntent(tx.User.Id, tx.DurationActivity.Id, UploadIntentKind.CheckIn, Now);
        tx.Db.UploadIntents.Add(secondIntent);
        await tx.Db.SaveChangesAsync();

        var act = () => handler.Handle(
            new CheckInCommand(tx.DurationActivity.Id, secondIntent.Id, "d2", null), default);
        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task CheckOut_LegacyOpenSession_CompletesWithDurationAndEvent()
    {
        var tx = await CreateAsync();

        // Phiên OPEN cũ (trước thay đổi tick + 1 ảnh) vẫn check-out được như cũ.
        // Checkin lúc 07:59, checkout intent lúc 08:00 => 1 phút.
        var media = new MediaAsset
        {
            UserId = tx.User.Id,
            PublicId = "seed",
            ResourceType = "image",
            SecureUrl = "https://cdn.example/seed.jpg",
            UploadedAt = Now.AddMinutes(-1)
        };
        var open = new CheckIn
        {
            ActivityId = tx.DurationActivity.Id,
            UserId = tx.User.Id,
            LocalDate = tx.Clock.TodayLocal,
            CheckinAt = Now.AddMinutes(-1),
            CheckinMediaId = media.Id,
            Status = CheckInStatus.Open,
            CreatedAt = Now.AddMinutes(-1)
        };
        tx.Db.MediaAssets.Add(media);
        tx.Db.CheckIns.Add(open);
        await tx.Db.SaveChangesAsync();

        var result = await CheckOutHandler(tx).Handle(
            new CheckOutCommand(open.Id, tx.CheckOutIntent.Id, "pub-2"), default);

        result.Status.Should().Be(CheckInStatus.Completed);
        result.CheckoutAt.Should().Be("2025-01-15T01:00:00Z");
        result.DurationMinutes.Should().Be(1);
        result.CheckoutMedia.PublicId.Should().Be("pub-2");

        tx.Realtime.Verify(r => r.GroupAsync(tx.Group.Id, EventNames.CheckOutCompleted,
            It.Is<CheckOutCompletedEvent>(e => e.DurationMinutes == 1 && e.TotalTodayMinutes == 1),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CheckOut_NotAfterCheckin_ThrowsBusinessRule()
    {
        var tx = await CreateAsync();

        // Phiên mở có checkinAt == giờ hiện tại; checkout intent cùng giờ => không sau checkin
        var media = new MediaAsset
        {
            UserId = tx.User.Id,
            PublicId = "seed",
            ResourceType = "image",
            SecureUrl = "https://cdn.example/seed.jpg",
            UploadedAt = Now
        };
        var open = new CheckIn
        {
            ActivityId = tx.DurationActivity.Id,
            UserId = tx.User.Id,
            LocalDate = tx.Clock.TodayLocal,
            CheckinAt = Now,
            CheckinMediaId = media.Id,
            Status = CheckInStatus.Open,
            CreatedAt = Now
        };
        tx.Db.MediaAssets.Add(media);
        tx.Db.CheckIns.Add(open);
        await tx.Db.SaveChangesAsync();

        var act = () => CheckOutHandler(tx).Handle(
            new CheckOutCommand(open.Id, tx.CheckOutIntent.Id, "pub-2"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }
}
