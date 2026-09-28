namespace HabitCheckin.Domain.Entities;

public class MediaAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string PublicId { get; set; } = null!;
    public string ResourceType { get; set; } = null!; // image | video
    public string SecureUrl { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public long? Bytes { get; set; }
    public double? DurationSec { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}
