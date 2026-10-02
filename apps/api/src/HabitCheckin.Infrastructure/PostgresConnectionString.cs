using Npgsql;

namespace HabitCheckin.Infrastructure;

/// <summary>
/// Chuẩn hoá connection string Postgres. Host managed (Render, Railway…) trả dạng URI
/// (postgresql://user:pass@host/db?sslmode=require) — chuyển về dạng keyword=value
/// (Host=...;Port=...) để Npgsql/Hangfire parse ổn định ở mọi đường dẫn.
/// Dạng keyword=value có sẵn (dev local) trả về nguyên, chỉ trim.
/// </summary>
internal static class PostgresConnectionString
{
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return raw;
        var cs = raw.Trim();

        if (!cs.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) &&
            !cs.StartsWith("npgsql://", StringComparison.OrdinalIgnoreCase))
            return cs;

        var uri = new Uri(cs);
        var b = new NpgsqlConnectionStringBuilder { Host = uri.Host };
        if (uri.Port is > 0) b.Port = uri.Port;
        if (uri.UserInfo.Length > 0)
        {
            var idx = uri.UserInfo.IndexOf(':');
            var userPart = idx >= 0 ? uri.UserInfo[..idx] : uri.UserInfo;
            var passPart = idx >= 0 ? uri.UserInfo[(idx + 1)..] : string.Empty;
            b.Username = Uri.UnescapeDataString(userPart);
            if (passPart.Length > 0) b.Password = Uri.UnescapeDataString(passPart);
        }
        var db = uri.AbsolutePath.TrimStart('/');
        if (db.Length > 0) b.Database = db;

        if (!string.IsNullOrEmpty(uri.Query))
        {
            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = pair.Split('=', 2);
                if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                    b["SSL Mode"] = MapSslMode(kv[1]);
            }
        }

        return b.ConnectionString;
    }

    private static string MapSslMode(string mode) => mode.ToLowerInvariant() switch
    {
        "disable" => "Disable",
        "allow" => "Allow",
        "prefer" => "Prefer",
        "verify-ca" => "VerifyCA",
        "verify-full" => "VerifyFull",
        _ => "Require"
    };
}
