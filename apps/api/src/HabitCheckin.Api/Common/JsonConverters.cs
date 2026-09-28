using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HabitCheckin.Api.Common;

/// <summary>Enum serialize/deserialize dạng string hoa: "DEADLINE", "PASS"...</summary>
public sealed class UpperEnumNamingPolicy : JsonNamingPolicy
{
    public override string ConvertName(string name) => name.ToUpperInvariant();
}

/// <summary>Parse TimeOnly từ JSON string "HH:mm" (chấp nhận cả "HH:mm:ss").</summary>
internal static class TimeOnlyJson
{
    public static TimeOnly Parse(ref Utf8JsonReader reader)
    {
        var s = reader.GetString();
        if (string.IsNullOrWhiteSpace(s))
            throw new JsonException("Giá trị TimeOnly rỗng");
        if (TimeOnly.TryParseExact(s, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            || TimeOnly.TryParseExact(s, "HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out t))
            return t;
        throw new JsonException($"Không parse được TimeOnly từ \"{s}\"");
    }
}

/// <summary>TimeOnly serialize "HH:mm" (mặc định framework là "HH:mm:ss").</summary>
public sealed class TimeOnlyShortConverter : JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        TimeOnlyJson.Parse(ref reader);

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("HH:mm"));
}

/// <summary>TimeOnly? cho các trường nullable.</summary>
public sealed class TimeOnlyShortNullableConverter : JsonConverter<TimeOnly?>
{
    public override TimeOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.Null ? null : TimeOnlyJson.Parse(ref reader);

    public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
    {
        if (value is null)
            writer.WriteNullValue();
        else
            writer.WriteStringValue(value.Value.ToString("HH:mm"));
    }
}
