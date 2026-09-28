namespace HabitCheckin.Domain.ValueObjects;

/// <summary>Bảng bậc phạt theo nhóm: Tiers[0]=0, [1]=phạt 1 fail, ... ExtraPerActivity áp dụng khi vượt số bậc.</summary>
public sealed record PenaltyTiers(long[] Tiers, long ExtraPerActivity)
{
    public static PenaltyTiers Default => new(new long[] { 0, 20_000, 50_000, 70_000 }, 20_000);
}
