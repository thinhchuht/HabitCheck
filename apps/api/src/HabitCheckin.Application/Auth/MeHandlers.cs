using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Auth;

// ---------- GetMe ----------

public sealed record GetMeQuery : IRequest<UserDto>;

public sealed class GetMeHandler(IAppDbContext db, ICurrentUser user) : IRequestHandler<GetMeQuery, UserDto>
{
    public async Task<UserDto> Handle(GetMeQuery request, CancellationToken ct)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == user.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");
        return u.ToDto();
    }
}

// ---------- UpdateMe ----------

public sealed class UpdateMeValidator : AbstractValidator<UpdateMeCommand>
{
    public UpdateMeValidator()
    {
        RuleFor(x => x.DisplayName).MaximumLength(100).When(x => x.DisplayName is not null);
        RuleFor(x => x.DeadlineAheadMinutes).InclusiveBetween(0, 120).When(x => x.DeadlineAheadMinutes.HasValue);
    }
}

public sealed class UpdateMeHandler(IAppDbContext db, ICurrentUser user, IRealtimeNotifier realtime)
    : IRequestHandler<UpdateMeCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateMeCommand cmd, CancellationToken ct)
    {
        var u = await db.Users.FirstAsync(x => x.Id == user.Id, ct);

        if (!string.IsNullOrWhiteSpace(cmd.DisplayName))
            u.DisplayName = cmd.DisplayName!.Trim();
        if (cmd.DeadlineAheadMinutes.HasValue)
            u.ReminderDeadlineAheadMinutes = cmd.DeadlineAheadMinutes.Value > 0 ? cmd.DeadlineAheadMinutes.Value : null;
        if (cmd.EndOfDayReminder.HasValue)
            u.ReminderEndOfDay = cmd.EndOfDayReminder.Value;

        await db.SaveChangesAsync(ct);

        var groupIds = await db.GroupMembers.Where(m => m.UserId == u.Id).Select(m => m.GroupId).ToListAsync(ct);
        foreach (var gid in groupIds)
            await realtime.GroupAsync(gid, EventNames.ProfileUpdated,
                new ProfileUpdatedEvent(u.Id.ToString(), u.DisplayName, u.AvatarUrl), ct);

        return u.ToDto();
    }
}

// ---------- Avatar ----------

public sealed record CreateAvatarIntentCommand() : IRequest<UploadIntentDto>;

public sealed class CreateAvatarIntentHandler(IAppDbContext db, ICurrentUser user, IClock clock, IMediaStorage media)
    : IRequestHandler<CreateAvatarIntentCommand, UploadIntentDto>
{
    public async Task<UploadIntentDto> Handle(CreateAvatarIntentCommand cmd, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var intent = new UploadIntent
        {
            UserId = user.Id,
            Kind = UploadIntentKind.Avatar,
            IntentAt = now,
            ExpiresAt = now.AddMinutes(15)
        };
        db.UploadIntents.Add(intent);
        await db.SaveChangesAsync(ct);

        var sig = await media.SignAvatarAsync(user.Id, intent.Id, ct);
        return ToDto(intent, sig);
    }

    private static UploadIntentDto ToDto(UploadIntent intent, UploadSignature sig) => new(
        intent.Id.ToString(), Fmt.Iso(intent.ExpiresAt)!,
        new UploadSignatureDto(sig.CloudName, sig.ApiKey, sig.UploadPreset, sig.Folder, sig.PublicId, sig.Timestamp, sig.Signature, sig.AllowedTypes));
}

public sealed record UpdateAvatarCommand(string PublicId) : IRequest<UserDto>;

public sealed class UpdateAvatarValidator : AbstractValidator<UpdateAvatarCommand>
{
    public UpdateAvatarValidator() =>
        RuleFor(x => x.PublicId).NotEmpty().WithMessage("Thiếu publicId");
}

public sealed class UpdateAvatarHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IMediaStorage media, IRealtimeNotifier realtime)
    : IRequestHandler<UpdateAvatarCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateAvatarCommand cmd, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var intent = await db.UploadIntents
            .FirstOrDefaultAsync(i => i.UserId == user.Id && i.Kind == UploadIntentKind.Avatar && i.UsedAt == null && i.ExpiresAt > now, ct)
            ?? throw new BusinessRuleException("Upload intent không hợp lệ hoặc đã hết hạn");

        var asset = await media.VerifyAssetAsync(cmd.PublicId, ProofType.Photo, intent.IntentAt, ct);

        var u = await db.Users.FirstAsync(x => x.Id == user.Id, ct);
        var oldPublicId = u.AvatarPublicId;
        u.AvatarPublicId = asset.PublicId;
        u.AvatarUrl = asset.SecureUrl;

        asset.UserId = u.Id;
        db.MediaAssets.Add(asset);
        intent.UsedAt = now;
        await db.SaveChangesAsync(ct);

        if (oldPublicId is not null)
        {
            try { await media.DeleteAssetAsync(oldPublicId, ct); }
            catch { /* best-effort */ }
        }

        var groupIds = await db.GroupMembers.Where(m => m.UserId == u.Id).Select(m => m.GroupId).ToListAsync(ct);
        foreach (var gid in groupIds)
            await realtime.GroupAsync(gid, EventNames.ProfileUpdated,
                new ProfileUpdatedEvent(u.Id.ToString(), u.DisplayName, u.AvatarUrl), ct);

        return u.ToDto();
    }
}
