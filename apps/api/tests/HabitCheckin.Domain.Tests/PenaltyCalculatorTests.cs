using FluentAssertions;
using HabitCheckin.Domain.Services;
using HabitCheckin.Domain.ValueObjects;

namespace HabitCheckin.Domain.Tests;

public class PenaltyCalculatorTests
{
    [Theory]
    [InlineData(0, 0L)]
    [InlineData(1, 20_000)]
    [InlineData(2, 50_000)]
    [InlineData(3, 70_000)]
    [InlineData(4, 90_000)]
    [InlineData(5, 110_000)]
    public void Calculate_AppliesTierTable_DefaultConfig(int failedCount, long expected)
    {
        var actual = PenaltyCalculator.Calculate(Failures(failedCount), PenaltyTiers.Default);

        actual.Should().Be(expected);
    }

    [Fact]
    public void Calculate_PassingActivities_AreNotPenalized()
    {
        var items = new List<(ActivityEvaluation Eval, long? Override)>
        {
            (Pass(Guid.NewGuid()), null),
            (Pass(Guid.NewGuid()), null)
        };

        PenaltyCalculator.Calculate(items, PenaltyTiers.Default).Should().Be(0);
    }

    [Fact]
    public void Calculate_OverridePenalty_IsChargedSeparatelyAndSkipsTier()
    {
        // 1 fail có override 10k (không đếm bậc) + 1 fail không override (bậc 1 = 20k) => 30k
        var items = new List<(ActivityEvaluation Eval, long? Override)>
        {
            (Fail(Guid.NewGuid()), 10_000),
            (Fail(Guid.NewGuid()), null)
        };

        PenaltyCalculator.Calculate(items, PenaltyTiers.Default).Should().Be(30_000);
    }

    [Fact]
    public void Calculate_OverrideOnPassingActivity_IsIgnored()
    {
        var items = new List<(ActivityEvaluation Eval, long? Override)>
        {
            (Pass(Guid.NewGuid()), 10_000)
        };

        PenaltyCalculator.Calculate(items, PenaltyTiers.Default).Should().Be(0);
    }

    [Fact]
    public void Calculate_CustomTiers_UsesExtraPerActivityBeyondLastTier()
    {
        var cfg = new PenaltyTiers(new long[] { 0, 10_000, 30_000 }, 5_000);

        // n=4 => 30k + (4 - 2) * 5k = 40k
        PenaltyCalculator.Calculate(Failures(4), cfg).Should().Be(40_000);
    }

    private static IEnumerable<(ActivityEvaluation Eval, long? Override)> Failures(int n) =>
        Enumerable.Range(0, n).Select(_ => (Fail(Guid.NewGuid()), (long?)null));

    private static ActivityEvaluation Fail(Guid id) => new(id, false, "LATE", null, null);
    private static ActivityEvaluation Pass(Guid id) => new(id, true, null, null, null);
}
