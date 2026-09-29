using HabitCheckin.Domain.ValueObjects;

namespace HabitCheckin.Domain.Services;

public static class PenaltyCalculator
{
    /// <summary>
    /// Tính tiền phạt cho một ngày: đếm số hoạt động fail rồi tra bảng bậc của nhóm.
    /// Không có phạt riêng theo hoạt động — chỉ áp dụng bảng bậc nhóm.
    /// </summary>
    public static long Calculate(IEnumerable<ActivityEvaluation> items, PenaltyTiers cfg)
    {
        var n = items.Count(e => !e.Passed);

        if (cfg.Tiers.Length == 0) return 0;
        if (n < cfg.Tiers.Length) return cfg.Tiers[n];
        return cfg.Tiers[^1] + (n - (cfg.Tiers.Length - 1)) * cfg.ExtraPerActivity;
    }
}
