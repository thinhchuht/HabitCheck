using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Challenges;

/// <summary>Validate chéo giữa các trường theo kiểu hoạt động.</summary>
public sealed class ActivityInputValidator : AbstractValidator<ActivityInput>
{
    public ActivityInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Thiếu tên hoạt động").MaximumLength(200);
        RuleFor(x => x.DeadlineTime).NotNull().WithMessage("Thiếu mốc giờ deadline")
            .When(x => x.Type == ActivityType.Deadline);
        RuleFor(x => x.TargetMinutes).GreaterThan(0).WithMessage("Mục tiêu phút phải > 0")
            .When(x => x.Type == ActivityType.Duration);
        RuleFor(x => x.WindowStart).NotNull().WithMessage("Thiếu giờ bắt đầu khung")
            .When(x => x.Type == ActivityType.Window);
        RuleFor(x => x.WindowEnd).NotNull().WithMessage("Thiếu giờ kết thúc khung")
            .When(x => x.Type == ActivityType.Window);
        RuleFor(x => x.GraceMinutes).InclusiveBetween(0, 240)
            .When(x => x.Type == ActivityType.Deadline);
        RuleFor(x => x.OverridePenalty).GreaterThan(0).When(x => x.OverridePenalty.HasValue);
    }
}

internal static class ActivityMapper
{
    public static void Apply(Activity a, ActivityInput input)
    {
        a.Name = input.Name.Trim();
        a.Description = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim();
        a.Icon = input.Icon;
        a.Type = input.Type;
        a.ProofType = input.ProofType ?? ProofType.Any;
        a.OverridePenalty = input.OverridePenalty;

        a.DeadlineTime = input.DeadlineTime is null ? null : TimeOnly.Parse(input.DeadlineTime!);
        a.GraceMinutes = input.Type == ActivityType.Deadline ? (input.GraceMinutes ?? 0) : 0;
        a.TargetMinutes = input.TargetMinutes;
        a.MinSessionMinutes = null; // không còn khái niệm phiên — DURATION là tick + 1 ảnh
        a.WindowStart = input.WindowStart is null ? null : TimeOnly.Parse(input.WindowStart!);
        a.WindowEnd = input.WindowEnd is null ? null : TimeOnly.Parse(input.WindowEnd!);
    }
}

// ---------- AddActivity ----------

public sealed class AddActivityHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<AddActivityCommand, ActivityDto>
{
    public async Task<ActivityDto> Handle(AddActivityCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.ChallengeId, ct);
        var maxOrder = await db.Activities
            .Where(a => a.ChallengeId == ch.Id)
            .Select(a => (int?)a.SortOrder)
            .MaxAsync(ct) ?? -1;

        var activity = new Activity
        {
            ChallengeId = ch.Id,
            SortOrder = maxOrder + 1
        };
        ActivityMapper.Apply(activity, cmd.Activity);
        db.Activities.Add(activity);
        await db.SaveChangesAsync(ct);
        return activity.ToDto();
    }
}

// ---------- UpdateActivity ----------

public sealed class UpdateActivityValidator : AbstractValidator<UpdateActivityCommand>
{
    public UpdateActivityValidator()
    {
        RuleFor(x => x.Activity).NotNull();
        RuleFor(x => x.Activity).SetValidator(new ActivityInputValidator());
    }
}

public sealed class UpdateActivityHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<UpdateActivityCommand, ActivityDto>
{
    public async Task<ActivityDto> Handle(UpdateActivityCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.ChallengeId, ct);
        var activity = await db.Activities.FirstOrDefaultAsync(a => a.Id == cmd.ActivityId && a.ChallengeId == ch.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy hoạt động");
        ActivityMapper.Apply(activity, cmd.Activity);
        await db.SaveChangesAsync(ct);
        return activity.ToDto();
    }
}

// ---------- DeleteActivity ----------

public sealed record DeleteActivityCommand(Guid ChallengeId, Guid ActivityId) : IRequest<bool>;

public sealed class DeleteActivityHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<DeleteActivityCommand, bool>
{
    public async Task<bool> Handle(DeleteActivityCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.ChallengeId, ct);
        var activity = await db.Activities.FirstOrDefaultAsync(a => a.Id == cmd.ActivityId && a.ChallengeId == ch.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy hoạt động");
        db.Activities.Remove(activity);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

// ---------- ReorderActivities ----------

public sealed class ReorderActivitiesValidator : AbstractValidator<ReorderActivitiesCommand>
{
    public ReorderActivitiesValidator() =>
        RuleFor(x => x.ActivityIds).NotNull().WithMessage("Thiếu danh sách sắp xếp");
}

public sealed class ReorderActivitiesHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<ReorderActivitiesCommand, List<ActivityDto>>
{
    public async Task<List<ActivityDto>> Handle(ReorderActivitiesCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.ChallengeId, ct);
        var activities = await db.Activities
            .Where(a => a.ChallengeId == ch.Id && cmd.ActivityIds.Contains(a.Id))
            .ToListAsync(ct);

        var found = activities.ToDictionary(a => a.Id);
        if (found.Count != cmd.ActivityIds.Count)
            throw new BusinessRuleException("Danh sách sắp xếp không khớp với hoạt động của kỳ");

        for (var i = 0; i < cmd.ActivityIds.Count; i++)
            found[cmd.ActivityIds[i]].SortOrder = i;

        await db.SaveChangesAsync(ct);
        return activities.OrderBy(a => a.SortOrder).Select(a => a.ToDto()).ToList();
    }
}
