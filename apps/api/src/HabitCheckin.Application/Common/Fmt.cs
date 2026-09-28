namespace HabitCheckin.Application.Common;

/// <summary>Hỗ trợ định dạng giá trị theo contract (ISO-8601 UTC, date, time).</summary>
public static class Fmt
{
    public static string Iso(DateTimeOffset? value) =>
        value is null ? null : value.Value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");

    public static string Date(DateOnly value) => value.ToString("yyyy-MM-dd");

    public static string Time(TimeOnly? value) => value?.ToString("HH:mm");
}
