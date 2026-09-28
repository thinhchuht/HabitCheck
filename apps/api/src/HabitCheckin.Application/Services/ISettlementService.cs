namespace HabitCheckin.Application.Services;

/// <summary>
/// Logic chốt ngày / kích hoạt challenge / nhắc nhở / dọn media.
/// Mọi phương thức đều idempotent — chạy lại không sinh dữ liệu trùng.
/// </summary>
public interface ISettlementService
{
    /// <summary>DRAFT có start_date = hôm nay (VN) → ACTIVE; (chạy 00:00).</summary>
    Task ActivateChallengesAsync(CancellationToken ct = default);

    /// <summary>
    /// Tính daily_results PROVISIONAL cho ngày date. Nếu closeOpenSessions = true thì
    /// đóng các phiên DURATION còn OPEN của ngày đó thành ABANDONED (không tính).
    /// </summary>
    Task SettleDayAsync(DateOnly date, bool closeOpenSessions, CancellationToken ct = default);

    /// <summary>Tính lại 1 (challenge, ngày) — dùng sau khi từ chối bằng chứng.</summary>
    Task SettleChallengeDayAsync(Guid challengeId, DateOnly date, CancellationToken ct = default);

    /// <summary>PROVISIONAL → FINAL của ngày date + ghi sổ quỹ (chạy 12:00).</summary>
    Task FinalizeDayAsync(DateOnly date, CancellationToken ct = default);

    /// <summary>Nhắc trước hạn DEADLINE / cuối ngày DURATION (chạy 5 phút/lần).</summary>
    Task SendRemindersAsync(CancellationToken ct = default);

    /// <summary>Xoá media Cloudinary mồ côi sau 24h (chạy 03:00).</summary>
    Task CleanOrphanMediaAsync(CancellationToken ct = default);
}
