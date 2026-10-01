namespace HabitCheckin.Domain.Entities;

/// <summary>Một ngày cheat: user được miễn check-in và không tính phạt cho ngày đó (tối đa 1/tuần/nhóm).</summary>
public class CheatDay
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid GroupId { get; set; }
    public DateOnly LocalDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
