using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChallengeId { get; set; }

    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    /// <summary>Đơn vị/mục tiêu tự do do user điền (VD: "10000 bước", "5 km").</summary>
    public string? Unit { get; set; }
    public ActivityType Type { get; set; }

    public TimeOnly? DeadlineTime { get; set; }
    public int GraceMinutes { get; set; }

    public int? TargetMinutes { get; set; }
    public int? MinSessionMinutes { get; set; }

    public TimeOnly? WindowStart { get; set; }
    public TimeOnly? WindowEnd { get; set; }

    public ProofType ProofType { get; set; } = ProofType.Any;
    public int SortOrder { get; set; }

    public Challenge? Challenge { get; set; }
}
