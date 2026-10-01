namespace HabitCheckin.Application.Abstractions;

public sealed record JobStatusInfo(
    string Id, string Name, string Cron, string Description,
    string? NextExecutionUtc, string? LastExecutionUtc);

/// <summary>Trạng thái các job định kỳ (Hangfire) — dùng cho trang Vận hành admin.</summary>
public interface IJobStatusProvider
{
    Task<IReadOnlyList<JobStatusInfo>> GetJobsAsync(CancellationToken ct = default);
}
