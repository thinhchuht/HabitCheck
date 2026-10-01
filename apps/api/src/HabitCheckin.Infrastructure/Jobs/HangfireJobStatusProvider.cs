using System.Data;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Infrastructure.Jobs;

/// <summary>
/// Catalog các job định kỳ — nguồn duy nhất cho trang Vận hành admin.
/// Id + cron phải khớp với RecurringJob.AddOrUpdate trong Program.cs.
/// </summary>
public static class RecurringJobCatalog
{
    public const string TimeZoneId = "Asia/Ho_Chi_Minh";

    public static readonly IReadOnlyList<(string Id, string Name, string Cron, string Description)> Jobs =
        new (string, string, string, string)[]
        {
            ("challenge-activation", "Kích hoạt kỳ mới", "0 0 * * *",
                "00:00 hằng ngày — DRAFT có start_date hôm nay → ACTIVE; kỳ quá end_date & đã FINAL → COMPLETED"),
            ("daily-settlement", "Chốt ngày", "5 0 * * *",
                "00:05 hằng ngày — đóng phiên chưa check-out, tính kết quả hôm trước (PROVISIONAL)"),
            ("daily-finalize", "Chốt cuối (finalize)", "0 12 * * *",
                "12:00 hằng ngày — PROVISIONAL → FINAL, ghi tiền phạt vào sổ quỹ"),
            ("reminder", "Nhắc nhở", "*/5 * * * *",
                "Mỗi 5 phút — nhắc trước hạn DEADLINE, nhắc cuối ngày nếu DURATION chưa đủ"),
            ("orphan-media-cleanup", "Dọn media mồ côi", "0 3 * * *",
                "03:00 hằng ngày — xoá asset Cloudinary không gắn với check-in nào sau 24h"),
        };
}

/// <summary>
/// Trạng thái job cho trang Vận hành admin. Hangfire 1.8 không có public API đọc
/// NextExecution, nên đọc thẳng field mà scheduler đã tự ghi vào Postgres
/// (bảng hangfire.hash, key = 'recurring-job:{jobId}', value ISO-8601 UTC).
/// Job chưa từng chạy / storage chưa sẵn → next = null, không làm hỏng danh sách.
/// </summary>
public sealed class HangfireJobStatusProvider(AppDbContext db) : IJobStatusProvider
{
    public async Task<IReadOnlyList<JobStatusInfo>> GetJobsAsync(CancellationToken ct = default)
    {
        // (jobId, field) -> value
        var values = new Dictionary<(string JobId, string Field), string>();
        try
        {
            await using var conn = db.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open)
                await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT key, field, value FROM hangfire.hash " +
                "WHERE key LIKE 'recurring-job:%' AND field IN ('NextExecution', 'LastExecution')";
            cmd.CommandTimeout = 10;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (reader.IsDBNull(2)) continue;
                var key = reader.GetString(0);
                var jobId = key.Length > "recurring-job:".Length
                    ? key["recurring-job:".Length..]
                    : key;
                values[(jobId, reader.GetString(1))] = reader.GetString(2);
            }
        }
        catch
        {
            // Chưa tạo schema Hangfire (lần đầu chạy) hoặc DB lỗi thời → next/last = null.
        }

        var list = new List<JobStatusInfo>(RecurringJobCatalog.Jobs.Count);
        foreach (var (id, name, cron, description) in RecurringJobCatalog.Jobs)
        {
            values.TryGetValue((id, "NextExecution"), out var next);
            values.TryGetValue((id, "LastExecution"), out var last);
            list.Add(new JobStatusInfo(id, name, cron, description, next, last));
        }
        return list;
    }
}
