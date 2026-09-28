using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Services;
using Hangfire;
using Microsoft.Extensions.Logging;

namespace HabitCheckin.Infrastructure.Jobs;

/// <summary>00:00 — kích hoạt challenge DRAFT → ACTIVE; COMPLETED challenge hết hạn.</summary>
public sealed class ChallengeActivationJob(ISettlementService settlement, ILogger<ChallengeActivationJob> logger)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        try
        {
            await settlement.ActivateChallengesAsync(ct);
            logger.LogInformation("ChallengeActivationJob hoàn tất");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ChallengeActivationJob lỗi");
        }
    }
}

/// <summary>00:05 — chốt PROVISIONAL cho ngày hôm qua (đóng phiên OPEN → ABANDONED).</summary>
public sealed class DailySettlementJob(ISettlementService settlement, IClock clock, ILogger<DailySettlementJob> logger)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        try
        {
            var yesterday = clock.TodayLocal.AddDays(-1);
            await settlement.SettleDayAsync(yesterday, closeOpenSessions: true, ct);
            logger.LogInformation("DailySettlementJob hoàn tất cho {Date}", yesterday);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "DailySettlementJob lỗi");
        }
    }
}

/// <summary>12:00 — FINAL kết quả ngày hôm qua + ghi sổ quỹ.</summary>
public sealed class FinalizeJob(ISettlementService settlement, IClock clock, ILogger<FinalizeJob> logger)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        try
        {
            var yesterday = clock.TodayLocal.AddDays(-1);
            await settlement.FinalizeDayAsync(yesterday, ct);
            logger.LogInformation("FinalizeJob hoàn tất cho {Date}", yesterday);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "FinalizeJob lỗi");
        }
    }
}

/// <summary>Mỗi 5 phút — nhắc trước hạn DEADLINE, nhắc tối nếu DURATION chưa đủ.</summary>
public sealed class ReminderJob(ISettlementService settlement, ILogger<ReminderJob> logger)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        try
        {
            await settlement.SendRemindersAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ReminderJob lỗi");
        }
    }
}

/// <summary>03:00 — xoá media Cloudinary mồ côi (intent/media chưa dùng sau 24h).</summary>
public sealed class OrphanMediaCleanupJob(ISettlementService settlement, ILogger<OrphanMediaCleanupJob> logger)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        try
        {
            await settlement.CleanOrphanMediaAsync(ct);
            logger.LogInformation("OrphanMediaCleanupJob hoàn tất");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "OrphanMediaCleanupJob lỗi");
        }
    }
}
