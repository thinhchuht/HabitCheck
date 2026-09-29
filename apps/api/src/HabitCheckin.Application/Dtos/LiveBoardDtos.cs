namespace HabitCheckin.Application.Dtos;

public sealed record LiveItemDto(
    string ActivityId, string Status, string? FailReason,
    string Name, string? Icon, bool IsLate);

public sealed record LiveMemberDto(
    string UserId,
    string DisplayName,
    string? AvatarUrl,
    bool Online,
    List<LiveItemDto> Items,
    long ExpectedPenalty);

public sealed record TickerItemDto(
    string CheckinId,
    string UserId,
    string UserName,
    string ActivityName,
    string Text,
    string At,
    string? ThumbnailUrl);

public sealed record LiveBoardDto(
    string GroupId,
    string GroupName,
    string Date,
    string ServerTime,
    List<LiveMemberDto> Members,
    long TotalExpectedPenalty,
    List<TickerItemDto> Ticker);
