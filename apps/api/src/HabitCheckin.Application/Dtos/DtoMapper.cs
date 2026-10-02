using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;

namespace HabitCheckin.Application.Dtos;

public static class DtoMapper
{
    public static UserDto ToDto(this User u) => new(
        u.Id.ToString(), u.GoogleSub, u.Email, u.DisplayName, u.AvatarUrl,
        new ReminderDto(u.ReminderDeadlineAheadMinutes, u.ReminderEndOfDay),
        Fmt.Iso(u.CreatedAt)!, Fmt.Iso(u.LastLoginAt), u.IsAdmin);

    public static MemberDto ToDto(this GroupMember m, User u) => new(
        m.UserId.ToString(), u.DisplayName, u.AvatarUrl, m.Role.ToString().ToUpperInvariant(), Fmt.Iso(m.JoinedAt)!);

    public static GroupDto ToDto(this Group g, IReadOnlyList<(GroupMember Member, User User)> members) => new(
        g.Id.ToString(), g.Name, g.InviteCode, g.OwnerId.ToString(),
        new PenaltyTiersDto(g.PenaltyTiers.Tiers, g.PenaltyTiers.ExtraPerActivity),
        g.ReviewWindowHours, Fmt.Iso(g.CreatedAt)!,
        members.Select(x => x.Member.ToDto(x.User)).ToList());

    public static ActivityDto ToDto(this Activity a) => new(
        a.Id.ToString(), a.ChallengeId.ToString(), a.Name, a.Description, a.Icon, a.Unit, a.Type,
        Fmt.Time(a.DeadlineTime), a.GraceMinutes, a.TargetMinutes, a.MinSessionMinutes,
        Fmt.Time(a.WindowStart), Fmt.Time(a.WindowEnd), a.ProofType, a.SortOrder);

    public static ChallengeDto ToDto(this Challenge c, string ownerName, IReadOnlyList<Activity> activities) => new(
        c.Id.ToString(), c.GroupId.ToString(), c.UserId.ToString(), ownerName, c.Title,
        Fmt.Date(c.StartDate), Fmt.Date(c.EndDate), c.Status, Fmt.Iso(c.LockedAt), Fmt.Iso(c.CreatedAt)!,
        activities.OrderBy(a => a.SortOrder).Select(a => a.ToDto()).ToList());

    public static MediaDto? ToDto(this MediaAsset? m) => m is null
        ? null
        : new MediaDto(m.PublicId, m.SecureUrl, m.ThumbnailUrl, m.ResourceType, m.Bytes);

    public static CheckInDto ToDto(this CheckIn c, string? activityName = null, string? icon = null) => new(
        c.Id.ToString(), c.ActivityId.ToString(), activityName ?? string.Empty, icon,
        c.UserId.ToString(), Fmt.Date(c.LocalDate), Fmt.Iso(c.CheckinAt)!, Fmt.Iso(c.CheckoutAt),
        c.DurationMinutes, c.CheckinMedia!.ToDto()!, c.CheckoutMedia?.ToDto(), c.Note, c.Status, Fmt.Iso(c.CreatedAt)!);
}
