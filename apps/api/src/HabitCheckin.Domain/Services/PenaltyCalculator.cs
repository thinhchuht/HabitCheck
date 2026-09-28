using HabitCheckin.Domain.ValueObjects;

namespace HabitCheckin.Domain.Services;

public static class PenaltyCalculator
{
    /// <summary>
    /// Tính tiền phạt cho một ngày. Activity có OverridePenalty được tính riêng,
    /// không đếm vào bậc; số hoạt động fail còn lại (không có override) tra bảng tiers.
    /// </summary>
    public static long Calculate(IEnumerable<(ActivityEvaluation Eval, long? Override)> items, PenaltyTiers cfg)
    {
        var failed = items.Where(x => !x.Eval.Passed).ToList();
        var overrideSum = failed.Where(x => x.Override.HasValue).Sum(x => x.Override!.Value);
        var n = failed.Count(x => !x.Override.HasValue);

        long tierAmount;
        if (cfg.Tiers.Length == 0)
            tierAmount = 0;
        else if (n < cfg.Tiers.Length)
            tierAmount = cfg.Tiers[n];
        else
            tierAmount = cfg.Tiers[^1] + (n - (cfg.Tiers.Length - 1)) * cfg.ExtraPerActivity;

        return tierAmount + overrideSum;
    }
}
