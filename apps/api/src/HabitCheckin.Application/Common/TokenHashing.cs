using System.Security.Cryptography;
using System.Text;

namespace HabitCheckin.Application.Common;

public static class TokenHashing
{
    public static string Sha256Hex(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string NewRefreshToken() =>
        Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
}
